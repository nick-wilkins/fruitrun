import { setMuted, sfx } from '../audio';
import type { App } from './app';
import { asset, el, onTap } from './dom';
import { installButton } from './install';
import { pipSvg } from './pip';
import { enterFullscreen, fullscreenButton, setBackdrop } from './screen';

export function menuScreen(app: App): HTMLElement {
  const stage = el('div.stage.menu-stage');
  stage.append(el('img.bg', { src: asset('assets/ui/menu.webp'), alt: 'Smoothie Adventure', draggable: false }));

  const carryOn = el('button.hit.menu-carry', { ariaLabel: 'Carry on' });
  if (!app.hasSave) carryOn.classList.add('off');
  setBackdrop(asset('assets/ui/menu.webp'));
  onTap(carryOn, () => {
    if (!app.hasSave) {
      sfx.nope();
      app.toast('Nothing to carry on yet. Tap Start New!');
      return;
    }
    sfx.tap();
    // Starting to play is the moment to fill the screen: it needs a tap, and this is one.
    enterFullscreen();
    app.show('map');
  });

  const startNew = el('button.hit.menu-new', { ariaLabel: 'Start new' });
  onTap(startNew, () => {
    sfx.tap();
    if (!app.hasSave) {
      enterFullscreen();
      app.startAgain();
      return;
    }
    const dialog = el(
      'div.modal',
      {},
      el(
        'div.card.small',
        {},
        el('h2', {}, 'Start again?'),
        el('p', {}, 'Your stars, fruit and smoothie points will be wiped.'),
        el(
          'div.row',
          {},
          el('button.btn.purple', { onclick: () => dialog.remove() }, 'Keep playing'),
          el('button.btn.orange', { onclick: () => app.startAgain() }, 'Start again'),
        ),
      ),
    );
    stage.append(dialog);
  });

  const mute = el('button.round.mute', { ariaLabel: 'Sound' }, app.save.muted ? '🔇' : '🔊');
  onTap(mute, () => {
    app.save.muted = !app.save.muted;
    setMuted(app.save.muted);
    mute.textContent = app.save.muted ? '🔇' : '🔊';
    if (app.hasSave) app.persist();
    sfx.tap();
  });

  const pip = el('div.menu-pip', { innerHTML: pipSvg('cheer') });
  const bubble = el('div.bubble', {}, "Hi, I'm Pip! Let's roll!");
  stage.append(carryOn, startNew, mute, pip, bubble);
  const fullscreen = fullscreenButton();
  if (fullscreen) stage.append(fullscreen);
  const install = installButton(stage);
  if (install) {
    if (!fullscreen) install.classList.add('edge');
    stage.append(install);
  }
  return stage;
}
