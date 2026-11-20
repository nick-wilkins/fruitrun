import { sfx } from '../audio';
import type { RunResult } from '../core/progress';
import type { Finisher, Rival } from '../core/race';
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
  /** In a cup: keep the result and go on to the points table. */
  next?(): void;
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
  /** `order` is everyone in finishing order, for a race. */
  results(result: RunResult, order?: Finisher[]): void;
  /** A race with friends is over for this player: the time and the order, with nothing to keep. */
  raced(time: number, order: Finisher[]): void;
  /** What is under that order: a button to move on, for whoever may, or word of who is being waited for. */
  racedNext(on: string | null, note: string): void;
  /** The finishing order has moved on since the results went up: a friend still out has come home. */
  standings(order: Finisher[]): void;
}

export const ORDINAL = ['', '1st', '2nd', '3rd', '4th'];

/** `rivals` are the marbles being raced, if this run is a race. */
/** A padlock, its shackle swung open or clicked shut. */
const padlock = (open: boolean) =>
  `<svg viewBox="0 0 24 24"><path d="${open ? 'M8 11V7a4 4 0 0 1 7.6-1.7' : 'M8 11V7a4 4 0 0 1 8 0v4'}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/></svg>`;

/** `passed` is true when this level already has the stars it needs to open what comes next: then there is no goal to show. */
/** Everyone in a race, in order. A friend not yet home has no time to show. */
function orderTable(order: Finisher[]): HTMLElement {
  return el(
    'div.race-order',
    {},
    ...order.map((row, i) => {
      const home = Number.isFinite(row.time);
      return el(`div.race-row${row.you ? '.you' : ''}`, {}, el('b', {}, home ? ORDINAL[i + 1] : '…'), el('i', { style: `background:${row.color}` }), el('span', {}, row.name), el('em', {}, home ? formatTime(row.time) : 'still racing'));
    }),
  );
}

export function createHud(level: Level, handlers: HudHandlers, rivals: Rival[] = [], cup?: string, passed = false, friends?: { note: string; color: string }): Hud {
  const fruit = ingredient(level.fruit);
  const root = el('div.hud');

  const timer = el('div.timer', {}, '0:00.0');
  const prizes = el('div.prizes');
  // Five stars that go out one by one as the clock runs. The ones needed to open the next level sit together
  // behind a padlock, which stays open for as long as they are all still lit.
  const prizeIcons = Array.from({ length: 5 }, () => el('img', { src: asset('assets/ui/star.png'), alt: '', draggable: false }));
  const lock = el('div.gate-lock', { innerHTML: padlock(true) });
  const gate = el('div.gate', {}, ...prizeIcons.slice(0, level.need), lock);
  const goalNote = el('div.goal-note', {}, `Keep ${level.need} ${level.need === 1 ? 'star' : 'stars'} to open the next level`);
  if (passed) {
    prizes.append(...prizeIcons);
    goalNote.classList.add('hidden');
  } else prizes.append(gate, ...prizeIcons.slice(level.need));
  const progressFill = el('div.fill');
  // With friends the bar is the player's own colour, like their marble.
  if (friends) progressFill.style.background = friends.color;
  const dots = rivals.map((rival) => el('div.rival-dot', { style: `background:${rival.color}`, title: rival.name }));
  const progress = el('div.progress', {}, progressFill, ...dots, el('div.flag', {}, '🏁'));
  const place = rivals.length ? el('div.place', {}, '') : null;
  const speedFill = el('div.fill');
  const speed = el('div.speed', {}, el('span', {}, 'SPEED'), el('div.gauge', {}, speedFill));
  const bagCount = el('span', {}, '0');
  const bagIcon = el('img', { src: asset('assets/items/seedmix.png'), alt: '', draggable: false });
  const bag = el('div.bag', {}, bagIcon, bagCount);
  const count = el('div.countdown');
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const warning = { sunny: '', night: 'Night run! ', midnight: 'Midnight run: follow the lights! ', rain: 'Rain: the road is slippery! ', snow: 'Ice: the road is very slippery! ' }[level.mood];
  const hint = el('div.hint', {}, (cup ? `${cup}. ` : '') + (friends ? `${friends.note} ` : '') + warning + (touch ? 'Swipe left and right to steer. Pull back to slow down' : 'Hold the mouse and slide, or use the arrow keys. Down slows you'));
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
        // A cup race is run once: no starting it again when it is going badly.
        cup || friends ? null : el('button.btn.orange', { onclick: () => handlers.restart() }, '↻ Start level again'),
        soundButton,
        el('button.btn.purple', { onclick: () => handlers.quit() }, friends ? '← Leave this race' : cup ? '← Leave the cup for now' : '← Back to map'),
      ),
    ),
  );
  const racedFoot = el('div.row');
  /** The card a run ends on, over the stopped race with its gauges put away. */
  const resultCard = (kind: string, ...children: (Node | string | null)[]) => {
    root.querySelectorAll('.hud-top, .speed, .bag, .pause, .hint, .countdown').forEach((node) => node.classList.add('hidden'));
    return el('div.modal.clear', {}, el(`div.card.results${kind ? `.${kind}` : ''}`, {}, ...children));
  };
  const setPaused = (value: boolean) => {
    sfx.tap();
    pauseMenu.classList.toggle('hidden', !value);
    handlers.pause(value);
  };
  onTap(pauseButton, () => setPaused(true));

  root.append(el('div.hud-top', {}, timer, place, prizes, goalNote, progress), speed, bag, count, hint, pauseButton, pauseMenu);

  let lastStars = 5;
  let lastCount = '';
  let lastPlace = 0;
  return {
    root,
    update(state) {
      timer.textContent = formatTime(state.time);
      progressFill.style.width = `${state.progress * 100}%`;
      speedFill.style.width = `${Math.max(6, state.speed * 100)}%`;
      speed.classList.toggle('boost', state.boosting);
      state.rivals.forEach((at, i) => (dots[i].style.left = `${at * 100}%`));
      if (place && state.place !== null && state.place !== lastPlace && state.countdown === null) {
        lastPlace = state.place;
        place.textContent = ORDINAL[state.place];
        place.dataset.place = String(state.place);
        place.classList.remove('pop');
        void place.offsetWidth;
        place.classList.add('pop');
      }
      if (state.stars !== lastStars) {
        lastStars = state.stars;
        prizeIcons.forEach((icon, i) => {
          icon.classList.toggle('lost', i >= state.stars);
          icon.src = asset(i < state.stars ? 'assets/ui/star.png' : 'assets/ui/star-empty.png');
        });
        if (!passed) {
          const safe = state.stars >= level.need;
          gate.classList.toggle('shut', !safe);
          lock.innerHTML = padlock(safe);
          goalNote.textContent = safe ? `Keep ${level.need} ${level.need === 1 ? 'star' : 'stars'} to open the next level` : 'Too slow to open the next level this time';
          goalNote.classList.toggle('shut', !safe);
        }
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
    racedNext(on, note) {
      // Whoever is waiting can always go and wait in the waiting room, where the way out of the game is.
      if (on) racedFoot.replaceChildren(el('button.btn.green.big', { onclick: () => handlers.quit() }, on));
      else racedFoot.replaceChildren(el('p.raced-wait', {}, note), el('button.btn.purple.small', { onclick: () => handlers.quit() }, 'Waiting room'));
    },
    raced(time, order) {
      // No banner here: nothing was completed or won, it is who came where.
      root.append(
        resultCard(
          'raced',
          el('h2.raced-title', {}, '🏁 Finished!'),
          el('div.pip-cheer', { innerHTML: pipSvg('cheer', friends?.color) }),
          el('div.time', {}, formatTime(time)),
          orderTable(order),
          racedFoot,
        ),
      );
    },
    standings(order) {
      root.querySelector('.race-order')?.replaceWith(orderTable(order));
    },
    results(result, order) {
      // A race: who came where, and what the place was worth.
      const podium = result.podium ?? 0;
      const table = order ? orderTable(order) : null;
      // One line for the fruit: in a race it says what the place added, or what a podium would.
      const won = `You won ${countOf(result.fruits, fruit.name)}`;
      const wonLine = !order || !result.place ? `${won}!` : podium ? `${won}: ${podium} for coming ${ORDINAL[result.place]}!` : rivals.length === 1 ? `${won}. Beat ${rivals[0].name} for more!` : `${won}. Reach the podium for more!`;
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
      // Whether this is enough to move on.
      const best = Math.max(result.stars, 0);
      const goal = result.opened.length
        ? el('div.goal.met', {}, `★ ${result.opened.length > 1 ? 'New levels' : 'Next level'} open!`)
        : result.passed
          ? null
          : el('div.goal', {}, `You need ${result.need} stars here to open the next level. You got ${best}.`);

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

      const card = resultCard(
          order ? 'raced' : '',
          el('img.banner', { src: asset('assets/ui/level-complete.png'), alt: 'Level complete!' }),
          el('div.pip-cheer', { innerHTML: pipSvg('cheer') }),
          el('div.time', {}, formatTime(result.time), result.newBest && !result.firstClear ? el('span.new-best', {}, 'New best!') : result.rank > 1 ? el('span.new-best.ranked', {}, `Your ${['', '', '2nd', '3rd', '4th', '5th'][result.rank]} best`) : null),
          starRow,
          table,
          el('div.kicker', {}, wonLine),
          loot,
          goal,
          feats,
          counts.size ? el('div.kicker.small', {}, 'Extras you picked up') : null,
          counts.size ? extras : null,
          // In a cup the race counts as it stands: on to the points.
          cup
            ? el('div.row', {}, el('button.btn.green.big', { onclick: () => handlers.next?.() }, 'Cup points ▶'))
            : el(
                'div.row',
                {},
                el('button.btn.orange', { onclick: () => handlers.restart() }, '↻ Retry'),
                el('button.btn.green.big', { onclick: () => handlers.blend() }, 'Keep and blend ▶'),
              ),
          cup ? null : el('p.retry-note', {}, 'Retry starts the level again. This run\'s fruit and stars are only kept if you blend.'),
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
