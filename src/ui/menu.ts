import { setMuted, sfx } from '../audio';
import { MAX_PLAYERS, type Player } from '../core/players';
import { HELP_PAGE, PRIVACY_PAGE } from '../data/links';
import type { App } from './app';
import { asset, el, onTap } from './dom';
import { grownUpGate } from './gate';
import { pipSvg } from './pip';
import { setBackdrop } from './screen';

export function menuScreen(app: App): HTMLElement {
  const stage = el('div.stage.menu-stage');
  stage.append(
    el('img.bg', { src: asset('assets/ui/menu-bg.webp'), alt: '', draggable: false }),
    el('img.menu-logo', { src: asset('assets/ui/menu-logo.webp'), alt: 'Smoothie Scramble', draggable: false }),
  );

  const starsOf = (player: Player) => Object.values(player.save.levels).reduce((sum, record) => sum + record.stars, 0);
  const who = el('div.chip.menu-who');
  const refresh = () => {
    carryOn.classList.toggle('off', !app.hasSave);
    who.classList.toggle('hidden', !app.player);
    who.textContent = app.player ? `Playing as ${app.player.name}` : '';
  };

  /** Who's playing? One button a player, each with a small one to remove them. */
  const pick = () => {
    const list = el('div.players');
    const dialog = el('div.modal', { onclick: (e: MouseEvent) => e.target === e.currentTarget && dialog.remove() }, el('div.card.small', {}, el('h2', {}, "Who's playing?"), list));
    const fill = () => {
      list.replaceChildren();
      for (const player of app.roster.players) {
        const go = el('button.btn.green', {}, el('span', {}, player.name), el('small', {}, `★ ${starsOf(player)}`));
        onTap(go, () => {
          sfx.tap();
          app.choose(player.id);
          app.show('map');
        });
        const remove = el('button.round.small', { ariaLabel: `Remove ${player.name}` }, '✕');
        onTap(remove, () => {
          sfx.tap();
          const sure = el(
            'div.modal',
            {},
            el(
              'div.card.small',
              {},
              el('h2', {}, `Remove ${player.name}?`),
              el('p', {}, 'Their stars, fruit, best times and smoothie points will be gone for good.'),
              el(
                'div.row',
                {},
                el('button.btn.purple', { onclick: () => sure.remove() }, 'Keep'),
                el('button.btn.orange', {
                  onclick: () => {
                    app.leave(player.id);
                    sure.remove();
                    refresh();
                    if (app.hasSave) fill();
                    else dialog.remove();
                  },
                }, 'Remove'),
              ),
            ),
          );
          stage.append(sure);
        });
        list.append(el('div.player', {}, go, remove));
      }
    };
    fill();
    stage.append(dialog);
  };

  const carryOn = el('button.menu-btn.menu-carry', { ariaLabel: 'Carry on' }, el('img', { src: asset('assets/ui/menu-carry.webp'), alt: '', draggable: false }));
  setBackdrop(asset('assets/ui/menu-bg.webp'));
  onTap(carryOn, () => {
    if (!app.hasSave) {
      sfx.nope();
      app.toast('Nobody to carry on yet. Tap Start New!');
      return;
    }
    sfx.tap();
    if (app.roster.players.length > 1) pick();
    else app.show('map');
  });
  onTap(who, () => {
    sfx.tap();
    pick();
  });

  const startNew = el('button.menu-btn.menu-new', { ariaLabel: 'Start new' }, el('img', { src: asset('assets/ui/menu-new.webp'), alt: '', draggable: false }));
  onTap(startNew, () => {
    if (app.roster.players.length >= MAX_PLAYERS) {
      sfx.nope();
      app.toast(`${MAX_PLAYERS} players already. Remove one to make room.`);
      pick();
      return;
    }
    sfx.tap();
    const number = app.roster.players.length + 1;
    const name = el('input.name', { type: 'text', maxLength: 12, placeholder: `Player ${number}`, autocapitalize: 'words', autocomplete: 'off', spellcheck: false, ariaLabel: 'Your name' });
    const start = () => {
      sfx.tap();
      app.join(name.value);
    };
    name.addEventListener('keydown', (e) => e.key === 'Enter' && start());
    const dialog = el(
      'div.modal',
      { onclick: (e: MouseEvent) => e.target === e.currentTarget && dialog.remove() },
      el('div.card.small', {}, el('h2', {}, 'New player'), el('p', {}, "What's your name?"), name, el('div.row', {}, el('button.btn.purple', { onclick: () => dialog.remove() }, 'Back'), el('button.btn.green', { onclick: start }, "Let's roll!"))),
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

  /** What a parent wants to know, and the ways out of the game, which only a grown-up may take. */
  const forGrownUps = (dialog: HTMLElement) => {
    const note = el('p.unlock-note');
    const page = (label: string, url: string) => (url ? el('button.btn.blue', { onclick: () => window.open(url, '_blank') }, label) : null);
    const restore = el('button.btn.blue', {}, 'Restore purchase');
    const back = el('button.btn.purple', { onclick: () => dialog.remove() }, 'Back');
    restore.onclick = async () => {
      dialog.classList.add('busy');
      restore.disabled = back.disabled = true;
      note.textContent = 'Asking the store…';
      const owned = await app.restore();
      dialog.classList.remove('busy');
      back.disabled = false;
      restore.disabled = owned === true;
      note.textContent = owned ? 'Races, cups and playing together are unlocked.' : owned === null ? 'The store could not be reached. Please try again.' : 'No purchase was found for this Apple account.';
    };
    return el(
      'div.card.small.wordy',
      {},
      el('h2', {}, 'For grown-ups'),
      el('p', {}, 'Smoothie Scramble has no adverts, no accounts and no tracking. Nothing your child does is collected or sent anywhere: it all stays on this device.'),
      el('p', {}, 'Playing together talks only to the iPads and iPhones in the same room.'),
      note,
      el('div.row', {}, back, page('Privacy', PRIVACY_PAGE), page('Help', HELP_PAGE), app.shop.owned ? null : restore),
    );
  };
  const grownUps = el('button.chip.menu-grownups', {}, 'Grown-ups');
  onTap(grownUps, () => {
    sfx.tap();
    stage.append(grownUpGate(forGrownUps));
  });

  const pip = el('div.menu-pip', { innerHTML: pipSvg('cheer') });
  const bubble = el('div.bubble', {}, "Hi, I'm Pip! Let's roll!");
  stage.append(carryOn, startNew, who, mute, grownUps, pip, bubble);
  refresh();
  return stage;
}
