import { el, onTap } from './dom';

/** Chrome's offer to install, which it hands over once and lets us show when we choose. */
interface InstallOffer extends Event {
  prompt(): Promise<unknown>;
}

const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Read once, before the game goes full screen itself and muddies the answer.
let installed =
  matchMedia('(display-mode: standalone)').matches ||
  matchMedia('(display-mode: fullscreen)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

let offer: InstallOffer | null = null;
const buttons = new Set<HTMLElement>();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  offer = e as InstallOffer;
  for (const button of buttons) button.classList.remove('waiting');
});

window.addEventListener('appinstalled', () => {
  installed = true;
  offer = null;
  for (const button of buttons) button.remove();
  buttons.clear();
});

const ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10M7.5 10 12 14.5 16.5 10M5 19h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * A round button that puts the game on the home screen, or null once it is there. iPhones and iPads have no way to
 * ask, so there it explains the two taps; elsewhere it stays out of sight until the browser offers an install.
 */
export function installButton(host: HTMLElement): HTMLElement | null {
  if (installed) return null;
  const button = el('button.round.install', { ariaLabel: 'Add to home screen', innerHTML: ICON });
  if (!IOS && !offer) button.classList.add('waiting');
  // Each visit to the menu makes a new button, so let go of the ones from menus that have gone.
  for (const old of buttons) if (!old.isConnected) buttons.delete(old);
  buttons.add(button);
  onTap(button, () => {
    if (offer) {
      void offer.prompt();
      // An offer can only be shown once; the browser sends another if this one is turned down.
      offer = null;
      button.classList.add('waiting');
      return;
    }
    const dialog = el(
      'div.modal',
      {},
      el(
        'div.card.small',
        {},
        el('h2', {}, 'Add to Home Screen'),
        el('p', {}, 'Tap the Share button, then "Add to Home Screen". The game will open full screen and work with no internet.'),
        el('div.row', {}, el('button.btn.purple', { onclick: () => dialog.remove() }, 'Got it')),
      ),
    );
    host.append(dialog);
  });
  return button;
}
