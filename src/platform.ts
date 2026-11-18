import { App as NativeApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { SAVE_KEY, type Backup } from './core/progress';

/** The save's second home: the app's own settings store, which the device never clears on its own. */
export const saveBackup: Backup = {
  get: async () => (await Preferences.get({ key: SAVE_KEY })).value,
  set: (value) => Preferences.set({ key: SAVE_KEY, value }),
  remove: () => Preferences.remove({ key: SAVE_KEY }),
};

/** Call `handler` each time the app comes back to the front. */
export function onResume(handler: () => void): void {
  void NativeApp.addListener('resume', handler);
}
