import { sfx } from '../audio';
import { CUP_POINTS, CUP_RACES, CUPS, cupById, cupLegendaryOpen, cupOpen, quitCup, standings, type Cup, type Standing } from '../core/cups';
import { DIFFICULTIES } from '../core/race';
import { ingredient } from '../data/ingredients';
import { levelById, WORLDS } from '../data/levels';
import type { App } from './app';
import { cupLineup } from './cards';
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
        'div.card.small.lineup-card',
        {},
        el('h2', {}, `🏆 ${cup.name}`),
        cupLineup(cup),
        el('div.kicker.small', {}, `Points each race: ${CUP_POINTS.join(', ')}. Most points takes the trophy!`),
        el('p.lineup-ask', {}, 'How fast shall they be?'),
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
        'div.card.small.lineup-card',
        {},
        el('div.kicker', {}, `${cup.name} · ${hardness(run.difficulty)}`),
        el('h2', {}, `Race ${run.race + 1} of ${CUP_RACES} is next`),
        cupLineup(cup, run.race),
        run.race ? table(standings(save)) : null,
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

  const art = (name: string) => asset(`assets/cups/${name}.webp`);
  /** The shelf each world's cups stand on. A world with no picture of its own borrows the meadow's. */
  const SHELVES: Record<string, string> = { meadow: 'shelf-meadow', tropics: 'shelf-tropics', village: 'shelf-village' };
  /** A flower from each world, for its sign. */
  const BLOOMS: Record<string, string> = { meadow: 'daisy', tropics: 'hibiscus-red', village: 'hibiscus-pink' };
  // The first cup still shut is the one to work towards.
  const nextUp = CUPS.find((cup) => !cupOpen(save, cup));

  WORLDS.forEach((world, index) => {
    const strip = el('div.shelf-cups');
    for (const cup of CUPS.filter((c) => c.world === index)) {
      const open = cupOpen(save, cup);
      const won = save.trophies?.[cup.id];
      // A trophy at every difficulty, Legendary included: the cup itself turns into a prize.
      const champion = DIFFICULTIES.every(({ id }) => won?.[id]);
      // A star for each speed, lit once a trophy has been won at it. Legendary's is locked until it opens.
      const stars = el(
        'div.shelf-stars',
        {},
        ...DIFFICULTIES.map(({ id, name }) => {
          const shut = id === 'legendary' && !cupLegendaryOpen(save, cup);
          const star = shut ? 'star-locked' : !won?.[id] ? 'star-unearned' : id === 'legendary' ? 'star-legend' : 'star-earned';
          // The star takes the colour of the trophy won there: gold, silver or bronze. Legendary's own star is for winning it.
          const metal = id !== 'legendary' && won?.[id] ? ['', 'gold', 'silver', 'bronze'][won[id]!] : '';
          return el(`span.${metal || (!shut && !won?.[id] ? 'none' : 'plain')}`, { title: won?.[id] ? `${name}: ${ORDINAL[won[id]!]}` : `${name}: not won yet` }, el('img', { src: art(star), alt: '', draggable: false }), name);
        }),
      );
      const done = cup.levels.filter((id) => save.levels[id]).length;
      const tile = el(
        `button.shelf-cup${open ? '' : '.shut'}${entered === cup ? '.going' : ''}${champion ? '.champion' : ''}`,
        {},
        entered === cup ? el('div.cup-flag', {}, `Race ${save.cup!.race + 1} of ${CUP_RACES} next ▶`) : cup === nextUp ? el('div.cup-flag.next-up', {}, 'Next up!') : null,
        el(
          'div.shelf-trophy',
          {},
          el('img.shelf-cup-art', { src: art(champion ? 'cup-legend' : open ? 'cup-gold' : 'cup-grey'), alt: '', draggable: false }),
          el('img.shelf-fruit', { src: asset(ingredient(cup.fruit).img), alt: '', draggable: false }),
          open ? null : el('img.shelf-lock', { src: asset('assets/ui/lock.png'), alt: 'Locked', draggable: false }),
          champion ? el('span.cup-crown', {}, '👑') : null,
        ),
        // The cup stands on a plinth with its name on, and under that what has been won, or what it takes to open.
        el('div.shelf-plinth', {}, el('img', { src: art('plinth'), alt: '', draggable: false }), el('b', {}, cup.name)),
        el('div.shelf-under', {}, ...(open ? [stars] : [el('small', {}, `Finish levels ${levelById(cup.levels[0]).label} to ${levelById(cup.levels[CUP_RACES - 1]).label}`), el('div.shelf-progress', {}, el('i', { style: `width:${(done / CUP_RACES) * 100}%` }), el('span', {}, `${done} / ${CUP_RACES}`))])),
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
      strip.append(tile);
    }
    body.append(el(`section.shelf.${world.id}`, {}, el('img.shelf-art', { src: art(SHELVES[world.id] ?? 'shelf-meadow'), alt: '', draggable: false }), el('div.shelf-sign', {}, el('img', { src: art(BLOOMS[world.id] ?? 'daisy'), alt: '', draggable: false }), world.name), strip));
  });

  const close = el('button.round.book-close', { ariaLabel: 'Back to map' }, '✕');
  onTap(close, () => {
    sfx.tap();
    app.show('map');
  });
  const vine = (side: string) => el(`img.cups-vine.${side}`, { src: asset(`assets/cups/vine-${side}.webp`), alt: '', draggable: false });
  stage.append(el('div.book.cups-book', {}, vine('left'), vine('right'), el('h2.cups-ribbon', {}, el('span', {}, 'Cups')), body, close));
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
