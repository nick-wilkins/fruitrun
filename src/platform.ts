import { App as NativeApp } from '@capacitor/app';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { ROSTER_KEY } from './core/players';
import { SAVE_KEY, type SaveStore } from './core/progress';
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
