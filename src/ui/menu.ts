import { setMuted, sfx } from '../audio';
import type { App } from './app';
import { asset, el, onTap } from './dom';
import { pipSvg } from './pip';
import { setBackdrop } from './screen';

export function menuScreen(app: App): HTMLElement {
  const stage = el('div.stage.menu-stage');
  stage.append(
    el('img.bg', { src: asset('assets/ui/menu-bg.webp'), alt: '', draggable: false }),
    el('img.menu-logo', { src: asset('assets/ui/menu-logo.webp'), alt: 'Smoothie Scramble', draggable: false }),
  );

  const carryOn = el('button.menu-btn.menu-carry', { ariaLabel: 'Carry on' }, el('img', { src: asset('assets/ui/menu-carry.webp'), alt: '', draggable: false }));
  if (!app.hasSave) carryOn.classList.add('off');
  setBackdrop(asset('assets/ui/menu-bg.webp'));
  onTap(carryOn, () => {
    if (!app.hasSave) {
      sfx.nope();
      app.toast('Nothing to carry on yet. Tap Start New!');
      return;
    }
    sfx.tap();
    app.show('map');
  });

  const startNew = el('button.menu-btn.menu-new', { ariaLabel: 'Start new' }, el('img', { src: asset('assets/ui/menu-new.webp'), alt: '', draggable: false }));
  onTap(startNew, () => {
    sfx.tap();
    if (!app.hasSave) {
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
  return stage;
}
