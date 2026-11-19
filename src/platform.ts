import { App as NativeApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { ROSTER_KEY } from './core/players';
import { SAVE_KEY, type SaveStore } from './core/progress';

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

/** Call `handler` each time the app comes back to the front. */
export function onResume(handler: () => void): void {
  void NativeApp.addListener('resume', handler);
}
