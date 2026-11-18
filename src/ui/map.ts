import { sfx } from '../audio';
import { ingredient } from '../data/ingredients';
import { COURSES, isUnlocked, superBlenderOpen } from '../core/progress';
import { DIFFICULTIES, racesUnlocked } from '../core/race';
import { LEVELS, levelByNumber, WORLDS, type Level } from '../data/levels';
import { newOn, starTimesFor } from '../game/courses';
import type { App } from './app';
import { asset, countOf, el, formatTime, onTap, stars } from './dom';
import { pipSvg } from './pip';
import { setBackdrop } from './screen';

const HOUSE =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10.5V20h4.5v-5h3v5H18v-9.5" fill="currentColor"/></svg>';

/** A locked plinth: the level's fruit, greyed, with the padlock in front of it. */
const lockCover = (level: Level) => {
  const fruit = ingredient(level.fruit);
  return el(
    'div.cover.grey',
    {},
    el('img.hidden-fruit', { src: asset(fruit.img), alt: fruit.name, draggable: false }),
    el('img.lock', { src: asset('assets/ui/lock.png'), alt: 'Locked', draggable: false }),
  );
};

function levelCard(app: App, level: Level, close: () => void): HTMLElement {
  const record = app.save.levels[level.id];
  const fruit = ingredient(level.fruit);
  const fresh = newOn(level);
  const leadsOn = LEVELS.some((l) => l.after.includes(level.n));
  const targets = el('div.targets');
  starTimesFor(level).forEach((limit, i) => {
    targets.append(el('div.target', {}, stars(5 - i, 5), el('span', {}, `under ${formatTime(limit).slice(0, -2)}`)));
  });
  const play = el(
    'button.btn.green.big',
    {
      onclick: () => {
        sfx.tap();
        app.play(level);
      },
    },
    '▶ Play',
  );
  const starts = el('div.starts', {}, play);
  if (racesUnlocked()) {
    // Race swaps the two buttons for the choice of how hard, with the one picked last time standing out.
    const race = el('button.btn.purple.big', {}, '🏁 Race');
    race.onclick = () => {
      sfx.tap();
      const last = app.save.race ?? 'easy';
      const pick = el(
        'div.race-pick',
        {},
        el('p', {}, 'Race three friends! How fast should they be?'),
        el(
          'div.starts',
          {},
          ...DIFFICULTIES.map(({ id, name }) =>
            el(
              `button.btn.${id === last ? 'green.big' : 'blue'}`,
              {
                onclick: () => {
                  sfx.tap();
                  app.save.race = id;
                  app.persist();
                  app.play(level, id);
                },
              },
              name,
            ),
          ),
        ),
      );
      starts.replaceWith(pick);
    };
    starts.append(race);
  }
  return el(
    'div.modal',
    { onclick: (e: MouseEvent) => e.target === e.currentTarget && close() },
    el(
      'div.card.level-card',
      {},
      el('button.round.close', { onclick: close, ariaLabel: 'Close' }, '✕'),
      el('img.big-fruit', { src: asset(fruit.img), alt: fruit.name, draggable: false }),
      el('div.kicker', {}, `${WORLDS[level.world].name} · Level ${level.label}`),
      el('h2', {}, level.name),
      record ? el('div.best', {}, stars(record.stars), record.courses === COURSES ? el('span', {}, `Best ${formatTime(record.time)}`) : null) : el('p', {}, `Roll fast to win up to ${countOf(5, fruit.name)}!`),
      fresh.length ? el('p.new-here', {}, el('b', {}, 'New here: '), fresh.join(', ')) : null,
      leadsOn ? el('p.need', {}, `Get ${level.need} stars here to open the next level`, stars(level.need, level.need)) : null,
      targets,
      starts,
    ),
  );
}

export function mapScreen(app: App): HTMLElement {
  const { save } = app;
  const world = WORLDS[app.world];
  const drawn = world.nodes !== 'art';
  const stage = el(`div.stage.map-stage${drawn ? '.small' : ''}`);
  stage.append(el('img.bg', { src: asset(world.art), alt: '', draggable: false }));
  setBackdrop(asset(world.art));

  const here = save.last ?? LEVELS[0].id;
  for (const level of LEVELS) {
    if (level.world !== app.world) continue;
    const locked = !isUnlocked(save, level);
    const record = save.levels[level.id];
    const node = el('button.node', { style: `left:${level.x}%;top:${level.y}%`, ariaLabel: `Level ${level.label}` });
    if (locked) {
      node.append(lockCover(level));
    } else {
      // The new maps' painted numbers do not follow the route, so their nodes are drawn over with their own;
      // on the first map only the stones painted as locked need covering once they open.
      if (drawn) node.append(el(`div.cover.${world.nodes}`, {}, String(level.label)));
      else if (level.artLocked) node.append(el('div.cover.gold', {}, String(level.label)));
      const fruit = ingredient(level.fruit);
      node.append(el('img.prize', { src: asset(fruit.img), alt: fruit.name, title: fruit.name, draggable: false }));
    }
    if (record) node.append(stars(record.stars));
    // Played, but not yet with enough stars to open what comes next.
    if (record && record.stars < level.need && LEVELS.some((l) => l.after.includes(level.n))) node.append(el('div.short', {}, `needs ${level.need}★`));
    // Every level waiting to be played pulses, so a fork in the path reads as a choice.
    if (!locked && !record) node.classList.add('open');
    if (level.id === here) {
      node.classList.add('here');
      node.append(el('div.marker', { innerHTML: pipSvg() }));
    }
    onTap(node, () => {
      if (locked) {
        sfx.nope();
        node.classList.remove('shake');
        void node.offsetWidth;
        node.classList.add('shake');
        const before = level.after.map(levelByNumber);
        const elsewhere = before.find((l) => l.world !== level.world);
        const gate = before[0];
        const got = save.levels[gate.id]?.stars ?? 0;
        const where = elsewhere ? `the last level of ${WORLDS[elsewhere.world].name}` : `level ${before.map((l) => l.label).join(' or ')}`;
        app.toast(got ? `Get ${gate.need} stars on ${where} to open this. You have ${got}.` : `Get ${gate.need} stars on ${where} first!`);
      } else {
        sfx.tap();
        const card = levelCard(app, level, () => card.remove());
        stage.append(card);
      }
    });
    stage.append(node);
  }

  // The purple pad on the first map is the Super Blender, powered up by finishing the path that leads to it.
  // The stands on the other maps, and the Blend button at the top, are the ordinary blender.
  const superPad = app.world === 0;
  const powered = superBlenderOpen(save);
  const blender = el(
    `button.blend-node${superPad ? '.super' : ''}${superPad && !powered ? '.shut' : ''}`,
    { style: `left:${world.blender.x}%;top:${world.blender.y}%`, ariaLabel: superPad ? 'Super Blender' : 'Blend a smoothie' },
    el('img', { src: asset('assets/smoothie-cup.png'), alt: '', draggable: false }),
    el('span', {}, superPad ? 'Super Blender' : 'Blend!'),
  );
  onTap(blender, () => {
    if (superPad && !powered) {
      sfx.nope();
      app.toast('Finish level 14 to power up the Super Blender!');
      return;
    }
    sfx.tap();
    app.show(superPad ? 'superblender' : 'blender');
  });

  const home = el('button.round.home', { ariaLabel: 'Menu', innerHTML: HOUSE });
  onTap(home, () => {
    sfx.tap();
    app.show('menu');
  });

  // Ways to the neighbouring worlds.
  for (const step of [-1, 1]) {
    const target = WORLDS[app.world + step];
    if (!target) continue;
    const open = LEVELS.some((l) => l.world === app.world + step && isUnlocked(save, l));
    const way = el(`button.way.${step < 0 ? 'back' : 'on'}${open ? '' : '.shut'}`, {}, step < 0 ? `◀ ${target.name}` : `${target.name} ▶`);
    onTap(way, () => {
      if (!open) {
        sfx.nope();
        app.toast(`Finish ${world.name} to open ${target.name}!`);
        return;
      }
      sfx.tap();
      app.world += step;
      app.show('map');
    });
    stage.append(way);
  }

  const go = (label: string, color: string, screen: 'blender' | 'book') => {
    const button = el(`button.btn.${color}.small`, {}, label);
    onTap(button, () => {
      sfx.tap();
      app.show(screen);
    });
    return button;
  };
  const items = Object.values(save.inventory).reduce((sum, n) => sum + n, 0);
  const totalStars = Object.values(save.levels).reduce((sum, r) => sum + r.stars, 0);
  const bar = el(
    'div.topbar',
    {},
    el('div.chip', {}, el('img', { src: asset('assets/ui/star.png'), alt: 'Stars' }), String(totalStars)),
    el('div.chip', {}, el('img', { src: asset('assets/fruits/apple.png'), alt: 'Ingredients' }), String(items)),
    el('div.chip', {}, el('img', { src: asset('assets/smoothie-cup.png'), alt: 'Smoothie points' }), String(save.points)),
    go('Blend', 'green', 'blender'),
    go('Book', 'orange', 'book'),
  );
  stage.append(blender, el('div.corner', {}, home, el('div.chip.world-name', {}, world.name)), bar);
  return stage;
}
