import { App as NativeApp } from '@capacitor/app';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { ROSTER_KEY } from './core/players';
import { SAVE_KEY, type SaveStore } from './core/progress';
import type { Nearby, NearbyEvent } from './core/nearby';
import type { Outcome } from './core/shop';

/**
 * The save lives in the app's own settings store. A web view's storage can be cleared by the device when it runs
 * short of space; this cannot.
 */
export const saveStore: SaveStore = {
  get: async () => (await Preferences.get({ key: ROSTER_KEY })).value,
  set: (value) => Preferences.set({ key: ROSTER_KEY, value }),
  remove: () => Preferences.remove({ key: ROSTER_KEY }),
};

/** The single save from before the game kept one per player. Read once, to become the first player; never written. */
export const oldSave = async () => (await Preferences.get({ key: SAVE_KEY })).value;

const ghostKey = (player: string, level: string) => `fruitrun.ghost.${player}.${level}`;

/** Each player's best run on each level, kept apart from the save so that stays small. */
export const ghostStore = {
  get: async (player: string, level: string) => (await Preferences.get({ key: ghostKey(player, level) })).value,
  set: (player: string, level: string, value: string) => void Preferences.set({ key: ghostKey(player, level), value }).catch(() => {}),
  /** Forget every ghost a player has: their number may be given to someone new. */
  clear: (player: string, levels: string[]) => {
    for (const level of levels) void Preferences.remove({ key: ghostKey(player, level) }).catch(() => {});
  },
};

const ASKED_KEY = 'fruitrun.unlock.asked';

/** When a grown-up was last asked to approve the unlock, so the wait is still shown after the app is reopened. */
export const askedStore = {
  get: async () => Number((await Preferences.get({ key: ASKED_KEY })).value) || 0,
  set: (at: number) => void Preferences.set({ key: ASKED_KEY, value: String(at) }).catch(() => {}),
  clear: () => void Preferences.remove({ key: ASKED_KEY }).catch(() => {}),
};

const TOLD_KEY = 'fruitrun.nearby.told';

/** Whether this device has been told what the system's question about nearby devices is for. */
export const toldStore = {
  get: async () => (await Preferences.get({ key: TOLD_KEY })).value === '1',
  set: () => void Preferences.set({ key: TOLD_KEY, value: '1' }).catch(() => {}),
};

/** Call `handler` each time the app comes back to the front. */
export function onResume(handler: () => void): void {
  void NativeApp.addListener('resume', handler);
}

/** The app store, as far as the game needs it: one thing for sale. */
export interface Store {
  /** The price as the store words it. Fails when the store cannot be reached. */
  price(): Promise<string>;
  owned(): Promise<boolean>;
  buy(): Promise<Outcome>;
  /** Ask the store afresh what this account owns. Only ever on a tap: it can ask for a password. */
  restore(): Promise<boolean>;
  /** Hear of a purchase approved later, made on another device, or refunded. */
  onChange(handler: (owned: boolean) => void): void;
}

interface StorePlugin {
  product(): Promise<{ price: string }>;
  owned(): Promise<{ owned: boolean }>;
  purchase(): Promise<{ outcome: Outcome }>;
  restore(): Promise<{ owned: boolean }>;
  addListener(event: 'change', handler: (state: { owned: boolean }) => void): Promise<PluginListenerHandle>;
}

function appStore(): Store {
  const plugin = registerPlugin<StorePlugin>('Store');
  return {
    price: async () => (await plugin.product()).price,
    owned: async () => (await plugin.owned()).owned,
    buy: async () => (await plugin.purchase()).outcome,
    restore: async () => (await plugin.restore()).owned,
    onChange: (handler) => void plugin.addListener('change', ({ owned }) => handler(owned)),
  };
}

const DEV_OWNED = 'fruitrun.dev.unlocked';
const DEV_OUTCOME = 'fruitrun.dev.outcome';

/**
 * A stand-in for trying the flow in a browser on the dev server. It remembers "bought" in the page's own storage;
 * put 'pending', 'cancelled' or 'failed' under fruitrun.dev.outcome to try the other endings.
 */
function devStore(): Store {
  // Opening the page with ?races unlocks at once, and ?noraces locks again.
  const asked = new URLSearchParams(location.search);
  if (asked.has('races')) localStorage.setItem(DEV_OWNED, '1');
  if (asked.has('noraces')) localStorage.removeItem(DEV_OWNED);
  const owned = () => localStorage.getItem(DEV_OWNED) === '1';
  return {
    price: async () => '£2.99',
    owned: async () => owned(),
    buy: async () => {
      const outcome = (localStorage.getItem(DEV_OUTCOME) as Outcome | null) ?? 'bought';
      if (outcome === 'bought') localStorage.setItem(DEV_OWNED, '1');
      return outcome;
    },
    restore: async () => owned(),
    onChange: () => {},
  };
}

/** Outside the app there is no store: nothing is owned and nothing can be bought. */
const noStore: Store = {
  price: () => Promise.reject(new Error('No store here')),
  owned: async () => false,
  buy: async () => 'failed',
  restore: () => Promise.reject(new Error('No store here')),
  onChange: () => {},
};

export const store: Store = Capacitor.isNativePlatform() ? appStore() : import.meta.env.DEV ? devStore() : noStore;

interface NearbyPlugin {
  host(options: { name: string }): Promise<void>;
  browse(): Promise<void>;
  join(options: { id: string }): Promise<void>;
  send(options: { text: string; to?: string }): Promise<void>;
  leave(): Promise<void>;
  addListener(event: 'hosts' | 'peer' | 'message' | 'failed', handler: (data: never) => void): Promise<PluginListenerHandle>;
}

function appNearby(): Nearby {
  const plugin = registerPlugin<NearbyPlugin>('Nearby');
  return {
    listen: (handler) => {
      for (const type of ['hosts', 'peer', 'message', 'failed'] as const) void plugin.addListener(type, (data: object) => handler({ type, ...data } as NearbyEvent));
    },
    host: (name) => plugin.host({ name }),
    browse: () => plugin.browse(),
    join: (id) => plugin.join({ id }),
    send: (text, to) => void plugin.send(to ? { text, to } : { text }).catch(() => {}),
    leave: () => void plugin.leave().catch(() => {}),
  };
}

/** A stand-in for the dev server: tabs of one browser find each other, so a race can be tried with no devices. */
function tabNearby(): Nearby {
  type Note = { kind: 'here' | 'who' | 'gone' | 'join' | 'joined' | 'msg'; from: string; to?: string; name?: string; text?: string };
  const channel = new BroadcastChannel('fruitrun.nearby');
  const id = Math.random().toString(36).slice(2, 8);
  const seen = new Map<string, string>();
  const guests = new Set<string>();
  let hear: (event: NearbyEvent) => void = () => {};
  let hosting: string | null = null;
  let looking = false;
  let host: string | null = null;
  const post = (note: Omit<Note, 'from'>) => channel.postMessage({ ...note, from: id });
  const hosts = () => hear({ type: 'hosts', hosts: [...seen].map(([hostId, name]) => ({ id: hostId, name })) });
  const leave = () => {
    if (hosting || host) post({ kind: 'gone' });
    hosting = host = null;
    looking = false;
    seen.clear();
    guests.clear();
  };
  channel.onmessage = ({ data }: MessageEvent<Note>) => {
    if (data.to && data.to !== id) return;
    if (data.kind === 'who' && hosting) post({ kind: 'here', name: hosting });
    else if (data.kind === 'here' && looking) (seen.set(data.from, data.name ?? '?'), hosts());
    else if (data.kind === 'join' && hosting) (guests.add(data.from), post({ kind: 'joined', to: data.from }), hear({ type: 'peer', id: data.from, joined: true }));
    else if (data.kind === 'joined' && host === data.from) hear({ type: 'peer', id: 'host', joined: true });
    else if (data.kind === 'msg' && data.text && host === data.from) hear({ type: 'message', from: 'host', text: data.text });
    else if (data.kind === 'msg' && data.text && guests.has(data.from)) hear({ type: 'message', from: data.from, text: data.text });
    else if (data.kind === 'gone') {
      if (seen.delete(data.from) && looking) hosts();
      if (guests.delete(data.from)) hear({ type: 'peer', id: data.from, joined: false });
      if (host === data.from) (host = null), hear({ type: 'peer', id: 'host', joined: false });
    }
  };
  window.addEventListener('pagehide', leave);
  return {
    listen: (handler) => (hear = handler),
    host: async (name) => {
      leave();
      hosting = name;
      post({ kind: 'here', name });
    },
    browse: async () => {
      leave();
      looking = true;
      post({ kind: 'who' });
    },
    join: async (hostId) => {
      looking = false;
      host = hostId;
      post({ kind: 'join', to: hostId });
    },
    send: (text, to) => {
      if (host) post({ kind: 'msg', to: host, text });
      else for (const guest of guests) if (!to || to === guest) post({ kind: 'msg', to: guest, text });
    },
    leave,
  };
}

const noNearby: Nearby = {
  listen: () => {},
  host: () => Promise.reject(new Error('Nobody nearby here')),
  browse: () => Promise.reject(new Error('Nobody nearby here')),
  join: () => Promise.reject(new Error('Nobody nearby here')),
  send: () => {},
  leave: () => {},
};

export const nearby: Nearby = Capacitor.isNativePlatform() ? appNearby() : import.meta.env.DEV ? tabNearby() : noNearby;
