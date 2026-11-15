import { sfx } from '../audio';
import { AWARDS } from '../core/awards';
import { isUnlocked, type Sip } from '../core/progress';
import { COMBOS, RATINGS, type Combo } from '../core/smoothie';
import { CATEGORY_LABEL, INGREDIENTS, ingredient } from '../data/ingredients';

type Show = (dialog: HTMLElement) => void;
import { LEVELS, WORLDS } from '../data/levels';
import type { App } from './app';
import { asset, el, onTap } from './dom';
import { pipSvg } from './pip';
import { setBackdrop } from './screen';

/** One ingredient that gives a recipe away a little, for recipes not found yet. */
function clue(combo: Combo): string | null {
  const first = combo.needs?.[0];
  if (typeof first === 'string') return first;
  return first?.[0] ?? combo.distinct?.pool[0] ?? null;
}

/** A smoothie from the book, close up: the glass, what Pip made of it, and what went in. */
function sipCard(sip: Sip): HTMLElement {
  const rating = RATINGS[sip.rating - 1];
  const cups = el('div.cups');
  for (let i = 0; i < 5; i++) cups.append(el('img', { src: asset('assets/smoothie-cup.png'), alt: '', className: i < sip.rating ? '' : 'dim', style: `animation-delay:${i * 0.08}s` }));

  const counts = new Map<string, number>();
  // An ingredient may have left the game since this was blended.
  for (const id of sip.items ?? []) if (INGREDIENTS.some((i) => i.id === id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  const contents = el('div.sip-items');
  for (const [id, n] of counts) {
    const item = ingredient(id);
    contents.append(el('div.sip-item', {}, el('img', { src: asset(item.img), alt: '' }), item.name, n > 1 ? el('b', {}, `×${n}`) : null));
  }

  const dialog = el(
    'div.modal',
    {},
    el(
      'div.card.smoothie.sip-card',
      {},
      el('h2', {}, sip.name, sip.big ? el('em', {}, 'Super') : null),
      el(
        'div.reveal',
        {},
        el(
          `div.taste.reacted.rated-${sip.rating}`,
          {},
          el('div.glassful', { style: `--smoothie:${sip.color}` }, el('div.level'), el('div.straw')),
          el('div.taster', { innerHTML: pipSvg(rating.face) }),
          el('div.verdict', {}, rating.shout),
        ),
        el('div.scorebox', {}, cups, el('div.score', {}, String(sip.points)), el('div.kicker.small', {}, 'smoothie points')),
      ),
      counts.size ? contents : el('p.sip-lost', {}, 'Pip has forgotten what went into this one!'),
      el(
        'div.row',
        {},
        el(
          'button.btn.purple',
          {
            onclick: () => {
              sfx.tap();
              dialog.remove();
            },
          },
          'Close',
        ),
      ),
    ),
  );
  // A tap on the dimmed page behind the card closes it too.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.remove();
  });
  return dialog;
}

function trophies(app: App, show: Show): HTMLElement {
  const { save } = app;
  const done = LEVELS.filter((l) => save.levels[l.id]);
  const starCount = done.reduce((sum, l) => sum + save.levels[l.id].stars, 0);
  const fives = done.filter((l) => save.levels[l.id].stars === 5).length;

  const worlds = el('div.book-worlds');
  WORLDS.forEach((world, index) => {
    const levels = LEVELS.filter((l) => l.world === index);
    const finished = levels.filter((l) => save.levels[l.id]).length;
    const open = levels.some((l) => isUnlocked(save, l));
    worlds.append(
      el(
        `div.book-world${open ? '' : '.shut'}`,
        {},
        el('b', {}, world.name),
        el('div.bar', {}, el('div.fill', { style: `width:${(finished / levels.length) * 100}%` })),
        el('span', {}, open ? `${finished} of ${levels.length} levels` : 'Not reached yet'),
      ),
    );
  });

  const tally = el('div.book-tally');
  RATINGS.forEach((rating, i) => {
    tally.append(el('div.tally', {}, el('div.face', { innerHTML: pipSvg(rating.face) }), el('b', {}, String(save.ratings[i] ?? 0)), el('span', {}, rating.name)));
  });

  const recent = el('div.book-recent');
  if (!save.history.length) recent.append(el('p', {}, 'No smoothies yet. Collect some fruit and get blending!'));
  for (const sip of save.history) {
    const cups = el('div.mini-cups');
    for (let i = 0; i < 5; i++) cups.append(el('img', { src: asset('assets/smoothie-cup.png'), alt: '', className: i < sip.rating ? '' : 'dim' }));
    const row = el('div.sip', { role: 'button' }, el('i', { style: `background:${sip.color}` }), el('span', {}, sip.name, sip.big ? el('em', {}, 'Super') : null), cups, el('b', {}, String(sip.points)));
    onTap(row, () => {
      sfx.tap();
      show(sipCard(sip));
    });
    recent.append(row);
  }

  const stat = (value: string, label: string, icon: string) => el('div.stat', {}, el('img', { src: asset(icon), alt: '' }), el('b', {}, value), el('span', {}, label));
  return el(
    'div.book-page',
    {},
    el(
      'div.book-stats',
      {},
      stat(`${starCount}`, `stars of ${LEVELS.length * 5}`, 'assets/ui/star.png'),
      stat(`${done.length}`, `levels of ${LEVELS.length}`, 'assets/fruits/apple.png'),
      stat(`${fives}`, 'five-star runs', 'assets/ui/star.png'),
      stat(`${save.points}`, 'smoothie points', 'assets/smoothie-cup.png'),
      stat(`${save.smoothies}`, 'smoothies made', 'assets/smoothie-cup.png'),
      stat(`${save.bestSmoothie?.points ?? 0}`, save.bestSmoothie ? `best: ${save.bestSmoothie.name}` : 'best smoothie', 'assets/smoothie-cup.png'),
    ),
    el('h3', {}, 'Worlds'),
    worlds,
    el('h3', {}, 'What Pip thought'),
    tally,
    el('h3', {}, 'Latest smoothies'),
    recent,
  );
}

function awards(app: App): HTMLElement {
  const won = new Set(app.save.awards);
  const page = el('div.book-page', {}, el('p.book-note', {}, `${AWARDS.filter((a) => won.has(a.id)).length} of ${AWARDS.length} awards won.`));
  for (const group of new Set(AWARDS.map((a) => a.group))) {
    const awards = AWARDS.filter((a) => a.group === group);
    const grid = el('div.book-awards');
    for (const award of awards) {
      grid.append(el(`div.award${won.has(award.id) ? '.won' : ''}`, {}, el('img', { src: asset(award.icon), alt: '' }), el('b', {}, award.name), el('span', {}, award.how)));
    }
    page.append(el('h3', {}, group, el('small', {}, `${awards.filter((a) => won.has(a.id)).length} of ${awards.length}`)), grid);
  }
  return page;
}

function recipes(app: App): HTMLElement {
  const found = new Set(app.save.combosFound);
  const grid = el('div.book-recipes');
  for (const combo of [...COMBOS].sort((a, b) => Number(found.has(b.id)) - Number(found.has(a.id)) || Number(a.big ?? false) - Number(b.big ?? false))) {
    const hint = clue(combo);
    grid.append(
      found.has(combo.id)
        ? el('div.recipe.known', {}, hint ? el('img', { src: asset(ingredient(hint).img), alt: '' }) : null, el('b', {}, combo.name), el('span', {}, `+${combo.pts}`), combo.big ? el('em', {}, 'Super') : null)
        : el('div.recipe', {}, hint ? el('img', { src: asset(ingredient(hint).img), alt: '' }) : null, el('b', {}, '? ? ?'), el('span', {}, hint ? `Try ${ingredient(hint).name}…` : 'A mystery'), combo.big ? el('em', {}, 'Super') : null),
    );
  }
  return el('div.book-page', {}, el('p.book-note', {}, `${COMBOS.filter((c) => found.has(c.id)).length} of ${COMBOS.length} secret recipes found. Purple ones need the Super Blender.`), grid);
}

function collection(app: App): HTMLElement {
  const seen = new Set(app.save.seen);
  const page = el('div.book-page');
  page.append(el('p.book-note', {}, `${INGREDIENTS.filter((i) => seen.has(i.id)).length} of ${INGREDIENTS.length} ingredients collected.`));
  const groups = new Map<string, HTMLElement>();
  for (const item of INGREDIENTS) {
    let grid = groups.get(item.cat);
    if (!grid) {
      grid = el('div.book-items');
      groups.set(item.cat, grid);
      page.append(el('h3', {}, CATEGORY_LABEL[item.cat]), grid);
    }
    const have = app.save.inventory[item.id] ?? 0;
    grid.append(
      seen.has(item.id)
        ? el('div.item', {}, el('img', { src: asset(item.img), alt: item.name }), el('span', {}, item.name), have ? el('b', {}, String(have)) : null)
        : el('div.item.unseen', {}, el('img', { src: asset(item.img), alt: '' }), el('span', {}, '???')),
    );
  }
  return page;
}

/** The smoothie book: everything the player has done, found and collected. */
export function bookScreen(app: App): HTMLElement {
  const stage = el('div.stage.book-stage');
  stage.append(el('img.bg', { src: asset('assets/stall.webp'), alt: '', draggable: false }));
  setBackdrop(asset('assets/stall.webp'));
  const pages = { Trophies: trophies, Awards: awards, Recipes: recipes, Collection: collection };
  const body = el('div.book-body');
  const tabs = el('div.book-tabs');
  const open = (name: keyof typeof pages) => {
    body.replaceChildren(pages[name](app, (dialog) => stage.append(dialog)));
    body.scrollTop = 0;
    tabs.querySelectorAll('button').forEach((tab) => tab.classList.toggle('on', tab.textContent === name));
  };
  for (const name of Object.keys(pages) as (keyof typeof pages)[]) {
    const tab = el('button.tab', {}, name);
    onTap(tab, () => {
      sfx.tap();
      open(name);
    });
    tabs.append(tab);
  }
  const close = el('button.round.book-close', { ariaLabel: 'Back to map' }, '✕');
  onTap(close, () => {
    sfx.tap();
    app.show('map');
  });
  stage.append(el('div.book', {}, el('h2', {}, 'Smoothie Book'), tabs, body, close));
  open('Trophies');
  return stage;
}
