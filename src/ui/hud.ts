import { sfx } from '../audio';
import type { RunResult } from '../core/progress';
import { ingredient } from '../data/ingredients';
import type { Level } from '../data/levels';
import type { HudState } from '../game/run';
import { asset, countOf, el, formatTime, onTap, stars } from './dom';
import { pipSvg } from './pip';

export interface HudHandlers {
  pause(paused: boolean): void;
  restart(): void;
  quit(): void;
  blend(): void;
  muted(): boolean;
  /** Flip sound on or off and return whether it is now muted. */
  toggleSound(): boolean;
}

export interface Hud {
  root: HTMLElement;
  update(state: HudState): void;
  pickup(id: string): void;
  /** The line is crossed: nothing left to pause or quit. */
  finished(): void;
  results(result: RunResult): void;
}

export function createHud(level: Level, handlers: HudHandlers): Hud {
  const fruit = ingredient(level.fruit);
  const root = el('div.hud');

  const timer = el('div.timer', {}, '0:00.0');
  const prizes = el('div.prizes');
  const prizeIcons = Array.from({ length: 5 }, () => el('img', { src: asset(fruit.img), alt: '', draggable: false }));
  prizes.append(...prizeIcons);
  const progressFill = el('div.fill');
  const progress = el('div.progress', {}, progressFill, el('div.flag', {}, '🏁'));
  const speedFill = el('div.fill');
  const speed = el('div.speed', {}, el('span', {}, 'SPEED'), el('div.gauge', {}, speedFill));
  const bagCount = el('span', {}, '0');
  const bagIcon = el('img', { src: asset('assets/items/seedmix.png'), alt: '', draggable: false });
  const bag = el('div.bag', {}, bagIcon, bagCount);
  const count = el('div.countdown');
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const warning = { sunny: '', night: 'Night run! ', midnight: 'Midnight run: follow the lights! ', rain: 'Rain: the road is slippery! ', snow: 'Ice: the road is very slippery! ' }[level.mood];
  const hint = el('div.hint', {}, warning + (touch ? 'Swipe left and right to steer' : 'Hold the mouse and slide, or use the arrow keys'));
  const pauseButton = el('button.round.pause', { ariaLabel: 'Pause' }, 'Ⅱ');

  const soundButton = el('button.btn.blue', {}, handlers.muted() ? '🔇 Sound off' : '🔊 Sound on');
  soundButton.onclick = () => {
    soundButton.textContent = handlers.toggleSound() ? '🔇 Sound off' : '🔊 Sound on';
  };

  const pauseMenu = el(
    'div.modal.hidden',
    {},
    el(
      'div.card.small',
      {},
      el('h2', {}, 'Paused'),
      el(
        'div.column',
        {},
        el('button.btn.green', { onclick: () => setPaused(false) }, '▶ Carry on'),
        el('button.btn.orange', { onclick: () => handlers.restart() }, '↻ Start level again'),
        soundButton,
        el('button.btn.purple', { onclick: () => handlers.quit() }, '← Back to map'),
      ),
    ),
  );
  const setPaused = (value: boolean) => {
    sfx.tap();
    pauseMenu.classList.toggle('hidden', !value);
    handlers.pause(value);
  };
  onTap(pauseButton, () => setPaused(true));

  root.append(el('div.hud-top', {}, timer, prizes, progress), speed, bag, count, hint, pauseButton, pauseMenu);

  let lastStars = 5;
  let lastCount = '';
  return {
    root,
    update(state) {
      timer.textContent = formatTime(state.time);
      progressFill.style.width = `${state.progress * 100}%`;
      speedFill.style.width = `${Math.max(6, state.speed * 100)}%`;
      speed.classList.toggle('boost', state.boosting);
      if (state.stars !== lastStars) {
        lastStars = state.stars;
        prizeIcons.forEach((icon, i) => icon.classList.toggle('lost', i >= state.stars));
      }
      const shown = state.countdown === null ? '' : String(Math.ceil(state.countdown));
      if (shown !== lastCount) {
        if (lastCount && !shown) {
          count.textContent = 'GO!';
          count.classList.add('go');
          hint.classList.add('hidden');
          setTimeout(() => count.classList.add('hidden'), 700);
        } else {
          count.textContent = shown;
          count.classList.remove('pop');
          void count.offsetWidth;
          count.classList.add('pop');
        }
        lastCount = shown;
      }
    },
    pickup(id) {
      const item = ingredient(id);
      bagIcon.src = asset(item.img);
      bagCount.textContent = String(Number(bagCount.textContent) + 1);
      bag.classList.remove('pop');
      void bag.offsetWidth;
      bag.classList.add('pop');
      const label = el('div.found', {}, el('img', { src: asset(item.img), alt: '' }), `${item.name}!`);
      root.append(label);
      setTimeout(() => label.remove(), 1300);
    },
    finished() {
      pauseButton.classList.add('hidden');
    },
    results(result) {
      root.querySelectorAll('.hud-top, .speed, .bag, .pause, .hint, .countdown').forEach((node) => node.classList.add('hidden'));
      const starRow = stars(0);
      const loot = el('div.loot');
      for (let i = 0; i < result.fruits; i++) loot.append(el('img', { src: asset(fruit.img), alt: fruit.name, style: `animation-delay:${1.1 + i * 0.12}s` }));
      const counts = new Map<string, number>();
      for (const id of result.bonuses) counts.set(id, (counts.get(id) ?? 0) + 1);
      const extras = el('div.extras');
      [...counts].forEach(([id, n], i) => {
        const item = ingredient(id);
        extras.append(
          el('div.extra', { title: item.name, style: `animation-delay:${1.8 + i * 0.07}s` }, el('img', { src: asset(item.img), alt: item.name }), n > 1 ? el('b', {}, `×${n}`) : null),
        );
      });
      // What made this run special, and any awards it earned.
      const feats = el('div.feats');
      if (result.perfect) feats.append(el('div.feat.gold', {}, '★ Perfect run! Every pickup collected'));
      else if (result.possible) feats.append(el('div.feat', {}, `${result.pickups} of ${result.possible} pickups`));
      if (result.clean) feats.append(el('div.feat.gold', {}, '★ Nothing hit!'));
      // Room for three; any more are waiting in the Book.
      for (const award of result.awards.slice(0, 3)) feats.append(el('div.feat.won', {}, el('img', { src: asset(award.icon), alt: '' }), `Award: ${award.name}`));
      if (result.awards.length > 3) feats.append(el('div.feat.won', {}, `+${result.awards.length - 3} more awards in your Book`));
      // Only if the card is still up: the player may already have moved on.
      if (result.awards.length) setTimeout(() => feats.isConnected && sfx.reveal(4), 1500);

      const card = el(
        'div.modal.clear',
        {},
        el(
          'div.card.results',
          {},
          el('img.banner', { src: asset('assets/ui/level-complete.png'), alt: 'Level complete!' }),
          el('div.pip-cheer', { innerHTML: pipSvg('cheer') }),
          el('div.time', {}, formatTime(result.time), result.newBest && !result.firstClear ? el('span.new-best', {}, 'New best!') : null),
          starRow,
          el('div.kicker', {}, `You won ${countOf(result.fruits, fruit.name)}!`),
          loot,
          feats,
          counts.size ? el('div.kicker.small', {}, 'Extras you picked up') : null,
          counts.size ? extras : null,
          el(
            'div.row',
            {},
            el('button.btn.orange', { onclick: () => handlers.restart() }, '↻ Again'),
            el('button.btn.purple', { onclick: () => handlers.quit() }, 'Map'),
            el('button.btn.green', { onclick: () => handlers.blend() }, '🥤 Blend!'),
          ),
        ),
      );
      root.append(card);
      const icons = starRow.querySelectorAll('img');
      for (let i = 0; i < result.stars; i++) {
        setTimeout(() => {
          icons[i].src = asset('assets/ui/star.png');
          icons[i].classList.add('pop');
          sfx.star(i);
        }, 350 + i * 170);
      }
    },
  };
}
