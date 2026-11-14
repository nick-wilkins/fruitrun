import { el, onTap } from './dom';

type FullscreenTarget = HTMLElement & { webkitRequestFullscreen?: () => void };
type FullscreenDocument = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };

const root = document.documentElement as FullscreenTarget;
const doc = document as FullscreenDocument;

/** Whether this browser can go full screen at all (iPhones cannot). */
export const canFullscreen = Boolean(root.requestFullscreen ?? root.webkitRequestFullscreen);

const isFullscreen = () => Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement);

/** Fill the whole screen. Browsers only allow this straight after a tap or key press, and may still say no. */
export function enterFullscreen(): void {
  if (!canFullscreen || isFullscreen()) return;
  try {
    const asked = root.requestFullscreen ? root.requestFullscreen() : root.webkitRequestFullscreen?.();
    void Promise.resolve(asked).catch(() => {});
  } catch {
    // Refused: carry on in the window.
  }
}

function leaveFullscreen(): void {
  if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
  else doc.webkitExitFullscreen?.();
}

const EXPAND =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SHRINK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** A round button that switches full screen on and off, or null where the browser cannot do it. */
export function fullscreenButton(): HTMLElement | null {
  if (!canFullscreen) return null;
  const button = el('button.round.fullscreen', { ariaLabel: 'Full screen' });
  const draw = () => (button.innerHTML = isFullscreen() ? SHRINK : EXPAND);
  draw();
  onTap(button, () => (isFullscreen() ? leaveFullscreen() : enterFullscreen()));
  // The Escape key leaves full screen without touching the button, so listen rather than assume.
  document.addEventListener('fullscreenchange', draw);
  document.addEventListener('webkitfullscreenchange', draw);
  return button;
}

/** Paint the bars either side of the stage with a soft copy of the screen's picture, so it bleeds to the edges. */
export function setBackdrop(url: string): void {
  document.body.style.setProperty('--backdrop', `url("${url}")`);
}
