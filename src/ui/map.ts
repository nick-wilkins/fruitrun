import { sfx } from '../audio';
import { ingredient } from '../data/ingredients';
import { COURSES, isUnlocked, superBlenderOpen } from '../core/progress';
import { LEVELS, levelByNumber, WORLDS, type Level } from '../data/levels';
import { starTimesFor } from '../game/courses';
import type { App } from './app';
import { asset, countOf, el, formatTime, onTap, stars } from './dom';
import { pipSvg } from './pip';

const lockCover = () => el('div.cover.grey', {}, el('img', { src: asset('assets/ui/lock.png'), alt: 'Locked', draggable: false }));

function levelCard(app: App, level: Level, close: () => void): HTMLElement {
  const record = app.save.levels[level.id];
  const fruit = ingredient(level.fruit);
  const targets = el('div.targets');
  starTimesFor(level).forEach((limit, i) => {
    targets.append(el('div.target', {}, stars(5 - i, 5), el('span', {}, `under ${formatTime(limit).slice(0, -2)}`)));
  });
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
      targets,
      el(
        'button.btn.green.big',
        {
          onclick: () => {
            sfx.tap();
            app.play(level);
          },
        },
        '▶ Play',
      ),
    ),
  );
}

export function mapScreen(app: App): HTMLElement {
  const { save } = app;
  const world = WORLDS[app.world];
  const drawn = world.nodes !== 'art';
  const stage = el(`div.stage.map-stage${drawn ? '.small' : ''}`);
  stage.append(el('img.bg', { src: asset(world.art), alt: '', draggable: false }));

  const here = save.last ?? LEVELS[0].id;
  for (const level of LEVELS) {
    if (level.world !== app.world) continue;
    const locked = !isUnlocked(save, level);
    const record = save.levels[level.id];
    const node = el('button.node', { style: `left:${level.x}%;top:${level.y}%`, ariaLabel: `Level ${level.label}` });
    if (drawn) {
      // This map's painted numbers do not follow the route, so every node is drawn over with its own.
      node.append(locked ? lockCover() : el(`div.cover.${world.nodes}`, {}, String(level.label)));
    } else {
      if (locked && !level.artLocked) node.append(lockCover());
      if (!locked && level.artLocked) node.append(el('div.cover.gold', {}, String(level.label)));
    }
    const fruit = ingredient(level.fruit);
    node.append(el(`img.prize${locked ? '.locked' : ''}`, { src: asset(fruit.img), alt: fruit.name, title: fruit.name, draggable: false }));
    if (record) node.append(stars(record.stars));
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
        app.toast(elsewhere ? `Finish ${WORLDS[elsewhere.world].name} first!` : `Finish level ${before.map((l) => l.label).join(' or ')} first!`);
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

  const home = el('button.round.home', { ariaLabel: 'Menu' }, '⌂');
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
  stage.append(blender, home, el('div.chip.world-name', {}, world.name), bar);
  return stage;
}
