import { sfx } from '../audio';
import { CUP_POINTS, CUP_RACES, CUPS, cupById, cupOpen, quitCup, standings, type Cup, type Standing } from '../core/cups';
import { DIFFICULTIES } from '../core/race';
import { ingredient } from '../data/ingredients';
import { levelById, WORLDS } from '../data/levels';
import type { App } from './app';
import { asset, el, onTap } from './dom';
import { pipSvg } from './pip';
import { setBackdrop } from './screen';

const TROPHY = ['', '🥇', '🥈', '🥉'];
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
            el(
              `button.btn.${id === (save.race ?? 'easy') ? 'green' : 'blue'}`,
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
  if (save.cup && entered) {
    const difficulty = DIFFICULTIES.find((d) => d.id === save.cup!.difficulty)!.name;
    body.append(
      el(
        'div.cup-going',
        {},
        el('b', {}, `${entered.name} (${difficulty}): race ${save.cup.race + 1} of ${CUP_RACES} is next`),
        el(
          'div.row',
          {},
          el('button.btn.orange.small', {
            onclick: () => {
              sfx.tap();
              quitCup(save);
              app.persist();
              app.show('cups');
            },
          }, 'Give up'),
          el('button.btn.green.small', {
            onclick: () => {
              sfx.tap();
              app.playCup();
            },
          }, 'Carry on ▶'),
        ),
      ),
    );
  }

  WORLDS.forEach((world, index) => {
    body.append(el('h3', {}, world.name));
    const grid = el('div.cup-grid');
    for (const cup of CUPS.filter((c) => c.world === index)) {
      const open = cupOpen(save, cup);
      const won = save.trophies?.[cup.id];
      const tile = el(
        `button.cup${open ? '' : '.shut'}`,
        {},
        el('img', { src: asset(ingredient(cup.fruit).img), alt: '', draggable: false }),
        el('b', {}, cup.name),
        open ? el('div.cup-won', {}, ...DIFFICULTIES.map(({ id, name }) => el(`span${won?.[id] ? '' : '.none'}`, { title: name }, name[0], el('i', {}, won?.[id] ? TROPHY[won[id]!] : '·')))) : el('small', {}, `Finish levels ${levelById(cup.levels[0]).label} to ${levelById(cup.levels[CUP_RACES - 1]).label} first`),
      );
      onTap(tile, () => {
        if (!open) {
          sfx.nope();
          app.toast('Finish all four of its levels to enter this cup!');
          return;
        }
        if (save.cup) {
          sfx.nope();
          app.toast('Finish or give up the cup you are in first.');
          return;
        }
        sfx.tap();
        enter(cup);
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
    const prize = done.position <= 3 ? TROPHY[done.position] : '';
    const line = done.position === 1 ? 'You won the cup!' : done.position <= 3 ? `You came ${ORDINAL[done.position]}!` : 'So close! Have another go.';
    setTimeout(() => stage.isConnected && (done.position <= 3 ? sfx.reveal(4) : sfx.tap()), 300);
    stage.append(
      el(
        'div.card.cup-card',
        {},
        el('div.kicker', {}, `${done.cup.name} · ${DIFFICULTIES.find((d) => d.id === done.difficulty)!.name}`),
        el('h2', {}, line),
        prize ? el('div.cup-prize', {}, prize) : el('div.pip-cheer', { innerHTML: pipSvg('cheer') }),
        done.perfect ? el('div.kicker', {}, '★ Perfect Forty: every race won!') : null,
        done.best && done.position <= 3 ? el('div.kicker.small', {}, 'A new trophy for your shelf') : null,
        table(done.table),
        el('div.row', {}, go('Cups', 'purple', () => app.show('cups')), go('Blend ▶', 'green.big', () => app.show('blender'))),
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
