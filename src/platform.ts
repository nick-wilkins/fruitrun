import { App as NativeApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { SAVE_KEY, type SaveStore } from './core/progress';

/**
 * The save lives in the app's own settings store. A web view's storage can be cleared by the device when it runs
 * short of space; this cannot.
 */
export const saveStore: SaveStore = {
  get: async () => (await Preferences.get({ key: SAVE_KEY })).value,
  set: (value) => Preferences.set({ key: SAVE_KEY, value }),
  remove: () => Preferences.remove({ key: SAVE_KEY }),
};

/** Call `handler` each time the app comes back to the front. */
export function onResume(handler: () => void): void {
  void NativeApp.addListener('resume', handler);
}
