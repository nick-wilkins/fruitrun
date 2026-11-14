import { sfx } from '../audio';
import { blend } from '../core/progress';
import { COMBOS, MAX_JUG, RATINGS, type SmoothieResult } from '../core/smoothie';
import { INGREDIENTS, ingredient } from '../data/ingredients';
import type { App } from './app';
import { asset, el, onTap } from './dom';
import { pipSvg } from './pip';
import { setBackdrop } from './screen';

const PER_PAGE = 9;
const BLEND_SECONDS = 2.4;
const SIP_SECONDS = 1.5;


/** Where each of the ten ingredients settles inside the glass, as a percentage of its box. */
const PILE: [number, number][] = [
  [36, 86], [58, 87], [47, 72], [68, 73], [28, 70],
  [53, 56], [36, 53], [71, 57], [46, 40], [63, 41],
];

/** Where the nth ingredient settles in the glass, as a percentage of its box: a brick-like pile from the bottom up. */
function pile(index: number, capacity: number): [number, number] {
  if (capacity <= MAX_JUG) return PILE[index];
  const row = Math.floor(index / 4);
  return [30 + (index % 4) * 14 + (row % 2) * 5, 89 - row * 12];
}

/** The blender: `capacity` is 10 for the ordinary one and 20 for the super blender. */
export function blenderScreen(app: App, capacity = MAX_JUG): HTMLElement {
  const { save } = app;
  const big = capacity > MAX_JUG;
  const stage = el(`div.stage.blend-stage${big ? '.big' : ''}`);
  stage.append(el('img.bg', { src: asset('assets/stall.webp'), alt: '', draggable: false }));
  setBackdrop(asset('assets/stall.webp'));

  const jug: string[] = [];
  let page = 0;
  let busy = false;

  const slots = el('div.slots');
  const pager = el('div.pager');
  const glassItems = el('div.glass-items');
  const liquid = el('div.liquid');
  const glass = el('div.glass', {}, liquid, glassItems);
  const power = el('div.power');
  const mixTitle = el('h3');
  const mix = el('div.mix');
  const mixHint = el('p.mix-hint');
  const recipes = el('div.recipes');
  const panel = el('div.mix-panel', {}, mixTitle, mix, mixHint, recipes);
  const blendButton = el('button.hit.blend-go', { ariaLabel: 'Blend' });
  const close = el('button.hit.blend-close', { ariaLabel: 'Back to map' });
  const points = el('div.chip.blend-points');
  stage.append(slots, pager, glass, power, panel, blendButton, close, points);
  if (big) stage.append(el('div.super-tag', {}, 'Super Blender'));

  const left = (id: string) => (save.inventory[id] ?? 0) - jug.filter((j) => j === id).length;
  const owned = () => INGREDIENTS.filter((item) => (save.inventory[item.id] ?? 0) > 0);

  const add = (id: string) => {
    if (busy) return;
    if (jug.length >= capacity) {
      sfx.nope();
      app.toast(`The jug is full! ${capacity} things is the most it holds.`);
      return;
    }
    if (left(id) <= 0) {
      sfx.nope();
      return;
    }
    jug.push(id);
    sfx.pickup();
    render();
  };

  const remove = (index: number) => {
    if (busy) return;
    jug.splice(index, 1);
    sfx.tap();
    render();
  };

  function render(): void {
    const items = owned();
    const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
    page = Math.min(page, pages - 1);

    slots.replaceChildren();
    if (!items.length) {
      slots.append(el('div.empty', {}, 'Your basket is empty. Play a level to win fruit!'));
    }
    for (const item of items.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)) {
      const remaining = left(item.id);
      const slot = el(
        'button.slot',
        { title: item.name, disabled: remaining <= 0 },
        el('img', { src: asset(item.img), alt: item.name, draggable: false }),
        el('b', {}, String(remaining)),
        el('span', {}, item.name),
      );
      onTap(slot, () => add(item.id));
      slots.append(slot);
    }

    pager.replaceChildren();
    if (pages > 1) {
      const previous = el('button.page', { disabled: page === 0 }, '◀');
      const next = el('button.page', { disabled: page === pages - 1 }, '▶');
      onTap(previous, () => {
        page--;
        sfx.tap();
        render();
      });
      onTap(next, () => {
        page++;
        sfx.tap();
        render();
      });
      pager.append(previous, el('span', {}, `${page + 1} / ${pages}`), next);
    }

    glassItems.replaceChildren();
    mix.replaceChildren();
    jug.forEach((id, i) => {
      const item = ingredient(id);
      const [x, y] = pile(i, capacity);
      glassItems.append(el('img', { src: asset(item.img), alt: '', draggable: false, style: `left:${x}%;top:${y}%;--tilt:${((i * 47) % 50) - 25}deg` }));
      const chip = el('button.mix-item', { title: `Take out ${item.name}` }, el('img', { src: asset(item.img), alt: item.name, draggable: false }), el('i', {}, '✕'));
      onTap(chip, () => remove(i));
      mix.append(chip);
    });
    for (let i = jug.length; i < capacity; i++) mix.append(el('div.mix-item.blank'));

    mixTitle.textContent = `Your mix ${jug.length}/${capacity}`;
    mixHint.textContent = jug.length ? 'Tap one to take it back out.' : 'Tap ingredients to drop them in the jug.';
    recipes.textContent = `Secret recipes found: ${save.combosFound.length}/${COMBOS.length}`;
    blendButton.classList.toggle('off', jug.length === 0);
    points.replaceChildren(el('img', { src: asset('assets/smoothie-cup.png'), alt: 'Smoothie points' }), String(save.points));
  }

  function reveal(result: SmoothieResult, fresh: string[]): void {
    const total = el('div.score', {}, '0');
    const cups = el('div.cups');
    for (let i = 0; i < 5; i++) cups.append(el('img', { src: asset('assets/smoothie-cup.png'), alt: '', className: i < result.rating ? '' : 'dim', style: `animation-delay:${0.2 + i * 0.12}s` }));
    const badges = el('div.badges');
    for (const combo of result.combos) {
      badges.append(el('div.badge.combo', {}, `${fresh.includes(combo.id) ? 'NEW! ' : ''}${combo.name} +${combo.pts}`));
    }
    for (const note of result.notes) badges.append(el(`div.badge.${note.good ? 'good' : 'bad'}`, {}, note.label));
    const buttons = el(
      'div.row',
      {},
      el(
        'button.btn.purple',
        {
          onclick: () => {
            sfx.tap();
            app.show('map');
          },
        },
        'Map',
      ),
      el(
        'button.btn.green',
        {
          onclick: () => {
            sfx.tap();
            card.remove();
            busy = false;
            liquid.style.height = '0%';
            stage.classList.remove('blending');
            render();
          },
        },
        'Blend another',
      ),
    );

    // Pip tastes it first: a long sip, then a face that says it all.
    const level = el('div.level');
    const taster = el('div.taster', { innerHTML: pipSvg('sip') });
    const verdict = el('div.verdict', {}, result.verdict);
    const taste = el('div.taste', {}, el('div.glassful', { style: `--smoothie:${result.color}` }, level, el('div.straw')), taster, verdict);
    // Pip on the left, the score on the right, so the card stays short enough for the buttons to be on screen.
    const scorebox = el('div.scorebox.late', {}, cups, total, el('div.kicker.small', {}, 'smoothie points'));
    badges.classList.add('late');
    buttons.classList.add('late');
    const panel = el('div.card.smoothie', {}, el('h2', {}, result.name), el('div.reveal', {}, taste, scorebox), badges, buttons);
    const card = el('div.modal', {}, panel);
    stage.append(card);
    sfx.sip(SIP_SECONDS);
    requestAnimationFrame(() => level.classList.add('drained'));

    setTimeout(() => {
      if (!card.isConnected) return;
      taster.innerHTML = pipSvg(RATINGS[result.rating - 1].face);
      taste.classList.add('reacted', `rated-${result.rating}`);
      if (result.rating === 1) sfx.yuck();
      else sfx.reveal(result.rating);
    }, SIP_SECONDS * 1000);

    setTimeout(() => {
      if (!card.isConnected) return;
      panel.classList.add('done');
      const started = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - started) / 900);
        total.textContent = String(Math.round((result.points * (1 - Math.pow(1 - k, 3))) / 5) * 5);
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, SIP_SECONDS * 1000 + 900);
  }

  onTap(blendButton, () => {
    if (busy) return;
    if (!jug.length) {
      sfx.nope();
      app.toast('Pop something in the jug first!');
      return;
    }
    busy = true;
    const known = new Set(save.combosFound);
    const result = blend(save, jug, capacity);
    app.persist();
    const fresh = result.combos.map((c) => c.id).filter((id) => !known.has(id));
    sfx.blend(BLEND_SECONDS);
    liquid.style.background = result.color;
    liquid.style.height = `${40 + (jug.length / capacity) * 50}%`;
    stage.classList.add('blending');
    setTimeout(() => {
      jug.length = 0;
      render();
      reveal(result, fresh);
    }, BLEND_SECONDS * 1000);
  });

  onTap(close, () => {
    if (busy) return;
    sfx.tap();
    app.show('map');
  });

  render();
  return stage;
}
