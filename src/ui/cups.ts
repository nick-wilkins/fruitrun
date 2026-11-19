import { sfx } from '../audio';
import { CUP_POINTS, CUP_RACES, CUPS, cupById, cupLegendaryOpen, cupOpen, quitCup, standings, type Cup, type Standing } from '../core/cups';
import { DIFFICULTIES } from '../core/race';
import { ingredient } from '../data/ingredients';
import { levelById, WORLDS } from '../data/levels';
import type { App } from './app';
import { asset, el, onTap } from './dom';
import { pipSvg } from './pip';
import { setBackdrop } from './screen';

const TROPHY = ['', '🥇', '🥈', '🥉'];
const METAL = ['none', 'gold', 'silver', 'bronze'];

/** A two-handled trophy cup, in whatever colour it is given. */
const trophySvg = `<svg viewBox="0 0 64 64"><path d="M14 10h36v12c0 12-7 20-18 20S14 34 14 22z" fill="currentColor"/><path d="M14 14H6c0 10 4 16 12 17M50 14h8c0 10-4 16-12 17" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><rect x="28" y="40" width="8" height="10" fill="currentColor"/><rect x="18" y="49" width="28" height="8" rx="3" fill="currentColor"/><path d="M20 13h8v14c-5-2-8-7-8-14z" fill="#fff" opacity=".35"/></svg>`;
const ORDINAL = ['', '1st', '2nd', '3rd', '4th'];

function table(rows: Standing[]): HTMLElement {
  return el(
    'div.race-order.cup-table',
    {},
    ...rows.map((row, i) => el(`div.race-row${row.you ? '.you' : ''}`, {}, el('b', {}, ORDINAL[i + 1]), el('i', { style: `background:${row.color}` }), el('span', {}, row.name), el('em', {}, `${row.points} pts`))),
  );
}

function backdrop(): HTMLElement {
  const stage = el('div.stage.book-stage');
  stage.append(el('img.bg', { src: asset('assets/stall.webp'), alt: '', draggable: false }));
  setBackdrop(asset('assets/stall.webp'));
  return stage;
}

/** Every cup, with the trophies won in it, and the way into one. */
export function cupsScreen(app: App): HTMLElement {
  const { save } = app;
  const stage = backdrop();
  const body = el('div.book-body');

  const enter = (cup: Cup) => {
    const dialog = el(
      'div.modal',
      { onclick: (e: MouseEvent) => e.target === e.currentTarget && dialog.remove() },
      el(
        'div.card.small',
        {},
        el('h2', {}, cup.name),
        el('p', {}, `${CUP_RACES} races: ${cup.levels.map((id) => levelById(id).name).join(', ')}.`),
        el('div.kicker.small', {}, `Points each race: ${CUP_POINTS.join(', ')}. Most points takes the trophy!`),
        el(
          'div.row',
          {},
          ...DIFFICULTIES.map(({ id, name }) =>
            id === 'legendary' && !cupLegendaryOpen(save, cup)
              ? el(
                  'button.btn.blue.locked',
                  {
                    onclick: () => {
                      sfx.nope();
                      app.toast('Win a trophy in this cup on Hard to open Legendary!');
                    },
                  },
                  `🔒 ${name}`,
                )
              : el(
                  `button.btn.${id === (save.race ?? 'easy') ? 'green' : id === 'legendary' ? 'orange' : 'blue'}`,
                  {
                    onclick: () => {
                      sfx.tap();
                      save.race = id;
                      app.startCup(cup, id);
                    },
                  },
                  name,
                ),
          ),
        ),
      ),
    );
    stage.append(dialog);
  };

  const entered = save.cup && cupById(save.cup.id);
  const hardness = (id: string) => DIFFICULTIES.find((d) => d.id === id)!.name;
  const button = (label: string, color: string, action: () => void) =>
    el(`button.btn.${color}`, {
      onclick: () => {
        sfx.tap();
        action();
      },
    }, label);
  const giveUp = () => {
    quitCup(save);
    app.persist();
  };

  /** The cup under way: where it stands, and on with it or out of it. */
  const resume = (cup: Cup) => {
    const run = save.cup!;
    const dialog = el(
      'div.modal',
      { onclick: (e: MouseEvent) => e.target === e.currentTarget && dialog.remove() },
      el(
        'div.card.small',
        {},
        el('div.kicker', {}, `${cup.name} · ${hardness(run.difficulty)}`),
        el('h2', {}, `Race ${run.race + 1} of ${CUP_RACES} is next`),
        run.race ? table(standings(save)) : el('p', {}, `First up: ${levelById(cup.levels[0]).name}.`),
        el('div.row', {}, button('Give up', 'orange', () => (giveUp(), app.show('cups'))), button('Carry on ▶', 'green.big', () => app.playCup())),
      ),
    );
    stage.append(dialog);
  };

  /** Another cup is under way: one at a time. */
  const swap = (cup: Cup, going: Cup) => {
    const dialog = el(
      'div.modal',
      { onclick: (e: MouseEvent) => e.target === e.currentTarget && dialog.remove() },
      el(
        'div.card.small',
        {},
        el('h2', {}, `You are in the ${going.name}`),
        el('p', {}, `Starting the ${cup.name} gives that one up.`),
        el(
          'div.row',
          {},
          button(`Back to the ${going.name}`, 'green', () => (dialog.remove(), resume(going))),
          button(`Start the ${cup.name}`, 'orange', () => {
            giveUp();
            dialog.remove();
            enter(cup);
          }),
        ),
      ),
    );
    stage.append(dialog);
  };

  WORLDS.forEach((world, index) => {
    body.append(el('h3', {}, world.name));
    const grid = el('div.cup-grid');
    for (const cup of CUPS.filter((c) => c.world === index)) {
      const open = cupOpen(save, cup);
      const won = save.trophies?.[cup.id];
      // A big trophy with the cup's fruit on it; under it, a little trophy for each difficulty, coloured once won.
      const shelf = el(
        'div.cup-won',
        {},
        ...DIFFICULTIES.filter(({ id }) => id !== 'legendary' || cupLegendaryOpen(save, cup)).map(({ id, name }) => el(`span.${METAL[won?.[id] ?? 0]}`, { title: won?.[id] ? `${name}: ${ORDINAL[won[id]!]}` : `${name}: not won yet` }, el('i', { innerHTML: trophySvg }), name)),
      );
      const tile = el(
        `button.cup${open ? '' : '.shut'}${entered === cup ? '.going' : ''}`,
        {},
        entered === cup ? el('div.cup-flag', {}, `Race ${save.cup!.race + 1} of ${CUP_RACES} next ▶`) : null,
        el('div.cup-art', { innerHTML: trophySvg }, el('img.cup-fruit', { src: asset(ingredient(cup.fruit).img), alt: '', draggable: false }), open ? null : el('img.cup-lock', { src: asset('assets/ui/lock.png'), alt: 'Locked', draggable: false })),
        el('b', {}, cup.name),
        open ? shelf : el('small', {}, `Finish levels ${levelById(cup.levels[0]).label} to ${levelById(cup.levels[CUP_RACES - 1]).label}`),
      );
      onTap(tile, () => {
        if (!open) {
          sfx.nope();
          app.toast('Finish all four of its levels to enter this cup!');
          return;
        }
        sfx.tap();
        if (save.cup && entered === cup) resume(cup);
        else if (save.cup && entered) swap(cup, entered);
        else enter(cup);
      });
      grid.append(tile);
    }
    body.append(grid);
  });

  const close = el('button.round.book-close', { ariaLabel: 'Back to map' }, '✕');
  onTap(close, () => {
    sfx.tap();
    app.show('map');
  });
  stage.append(el('div.book', {}, el('h2', {}, 'Cups'), body, close));
  return stage;
}

/** The points after a cup race: who is where, and on to the next race, or the trophy if that was the last. */
export function cupTableScreen(app: App): HTMLElement {
  const stage = backdrop();
  const done = app.cupResult;
  const go = (label: string, color: string, action: () => void) =>
    el(`button.btn.${color}`, {
      onclick: () => {
        sfx.tap();
        action();
      },
    }, label);

  if (done) {
    app.cupResult = null;
    const beaten = done.difficulty === 'legendary' && done.position > 1;
    const line = done.position === 1 ? 'You won the cup!' : beaten ? `${done.table[0].name} takes it. Go again!` : done.position <= 3 ? `You came ${ORDINAL[done.position]}!` : 'So close! Have another go.';
    // In a legendary duel the only step worth having is the top one.
    const onPodium = done.difficulty === 'legendary' ? done.position === 1 : done.position <= 3;
    setTimeout(() => stage.isConnected && (onPodium ? sfx.reveal(4) : sfx.tap()), 300);
    // The top three on their steps, silver and bronze either side of gold, with the winner jumping for joy.
    const step = (place: number) => {
      const row = done.table[place - 1];
      return el(
        `div.podium-step.p${place}`,
        {},
        el(`div.podium-pip${place === 1 ? '.jump' : ''}`, { innerHTML: pipSvg(row.mean ? 'mean' : place === 1 ? 'cheer' : 'happy', row.you ? undefined : row.color) }),
        el(`div.podium-name${row.you ? '.you' : ''}`, {}, row.name),
        el('div.podium-block', {}, el('b', {}, TROPHY[place]), el('span', {}, `${row.points} pts`)),
      );
    };
    const confetti = el('div.confetti');
    if (onPodium) {
      const colors = ['#ff4d6d', '#ffd23f', '#4cd964', '#4aa3ff', '#b574f2', '#ff9f1c'];
      for (let i = 0; i < 60; i++) {
        confetti.append(el('i', { style: `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${(Math.random() * 3).toFixed(2)}s;animation-duration:${(2.4 + Math.random() * 2).toFixed(2)}s;rotate:${Math.floor(Math.random() * 360)}deg` }));
      }
    }
    const fourth = done.table[3];
    stage.append(
      confetti,
      el(
        'div.card.cup-card',
        {},
        el('div.kicker', {}, `${done.cup.name} · ${DIFFICULTIES.find((d) => d.id === done.difficulty)!.name}`),
        el('h2', {}, line),
        el('div.podium', {}, ...[2, 1, 3].filter((place) => done.table[place - 1]).map(step)),
        fourth ? el('div.kicker.small', {}, `4th: ${fourth.name}, ${fourth.points} pts`) : null,
        done.perfect ? el('div.kicker', {}, '★ Perfect Forty: every race won!') : null,
        done.best && onPodium ? el('div.kicker.small', {}, 'A new trophy for your shelf') : null,
        ...done.awards.slice(0, 3).map((award) => el('div.cup-award', {}, el('img', { src: asset(award.icon), alt: '' }), `Award: ${award.name}`)),
        el('div.row', {}, go('Cups', 'purple', () => app.show('cups')), go('Map ▶', 'green.big', () => app.show('map'))),
      ),
    );
    return stage;
  }

  const run = app.save.cup;
  const cup = run && cupById(run.id);
  if (!run || !cup) {
    stage.append(el('div.card.cup-card', {}, el('h2', {}, 'No cup under way'), el('div.row', {}, go('Cups', 'purple', () => app.show('cups')))));
    return stage;
  }
  stage.append(
    el(
      'div.card.cup-card',
      {},
      el('div.kicker', {}, `${cup.name} · after race ${run.race} of ${CUP_RACES}`),
      el('h2', {}, 'Cup points'),
      table(standings(app.save)),
      el('div.kicker.small', {}, `Next: ${levelById(cup.levels[run.race]).name}`),
      el('div.row', {}, go('Later', 'purple', () => app.show('cups')), go('Next race ▶', 'green.big', () => app.playCup())),
    ),
  );
  return stage;
}
