import { sfx } from '../audio';
import { ingredient } from '../data/ingredients';
import { BLENDER_NODE, LEVELS, type Level } from '../data/levels';
import type { App } from './app';
import { asset, el, formatTime, onTap, stars } from './dom';
import { pipSvg } from './pip';

function levelCard(app: App, level: Level, close: () => void): HTMLElement {
  const record = app.save.levels[level.id];
  const fruit = ingredient(level.fruit);
  const targets = el('div.targets');
  level.starTimes.forEach((limit, i) => {
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
      el('div.kicker', {}, `Level ${level.n}`),
      el('h2', {}, level.name),
      record ? el('div.best', {}, stars(record.stars), el('span', {}, `Best ${formatTime(record.time)}`)) : el('p', {}, `Roll fast to win up to 5 ${fruit.name.toLowerCase()}s!`),
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
  const stage = el('div.stage.map-stage');
  stage.append(el('img.bg', { src: asset('assets/map.webp'), alt: '', draggable: false }));

  const current = Math.min(save.unlocked, LEVELS.length);
  for (const level of LEVELS) {
    const locked = level.n > save.unlocked;
    const record = save.levels[level.id];
    const node = el('button.node', { style: `left:${level.x}%;top:${level.y}%`, ariaLabel: `Level ${level.n}` });
    if (locked && !level.artLocked) node.append(el('div.cover.grey', {}, el('img', { src: asset('assets/ui/lock.png'), alt: 'Locked', draggable: false })));
    if (!locked && level.artLocked) node.append(el('div.cover.gold', {}, String(level.n)));
    if (record) node.append(stars(record.stars));
    if (level.n === current) {
      node.classList.add('current');
      node.append(el('div.marker', { innerHTML: pipSvg() }));
    }
    onTap(node, () => {
      if (locked) {
        sfx.nope();
        node.classList.remove('shake');
        void node.offsetWidth;
        node.classList.add('shake');
        app.toast(`Finish level ${level.n - 1} first!`);
      } else if (!level.built) {
        sfx.nope();
        app.toast(`${level.name} is coming soon!`);
      } else {
        sfx.tap();
        const card = levelCard(app, level, () => card.remove());
        stage.append(card);
      }
    });
    stage.append(node);
  }

  const blender = el(
    'button.blend-node',
    { style: `left:${BLENDER_NODE.x}%;top:${BLENDER_NODE.y}%`, ariaLabel: 'Blend a smoothie' },
    el('img', { src: asset('assets/smoothie-cup.png'), alt: '', draggable: false }),
    el('span', {}, 'Blend!'),
  );
  onTap(blender, () => {
    sfx.tap();
    app.show('blender');
  });

  const home = el('button.round.home', { ariaLabel: 'Menu' }, '⌂');
  onTap(home, () => {
    sfx.tap();
    app.show('menu');
  });

  const items = Object.values(save.inventory).reduce((sum, n) => sum + n, 0);
  const totalStars = Object.values(save.levels).reduce((sum, r) => sum + r.stars, 0);
  const bar = el(
    'div.topbar',
    {},
    el('div.chip', {}, el('img', { src: asset('assets/ui/star.png'), alt: 'Stars' }), String(totalStars)),
    el('div.chip', {}, el('img', { src: asset('assets/fruits/apple.png'), alt: 'Ingredients' }), String(items)),
    el('div.chip', {}, el('img', { src: asset('assets/smoothie-cup.png'), alt: 'Smoothie points' }), String(save.points)),
  );
  stage.append(blender, home, bar);
  return stage;
}
