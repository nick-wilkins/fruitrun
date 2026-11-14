import { ingredient, type Category, type Ingredient, type Taste } from '../data/ingredients';

export const MAX_JUG = 10;

type Need = string | string[];

export interface Combo {
  id: string;
  name: string;
  pts: number;
  /** Every entry must be in the jug. An array entry means any one of them. */
  needs?: Need[];
  /** At least `count` different ingredients from `pool`. */
  distinct?: { pool: string[]; count: number };
}

const MILKY = ['milk', 'oatmilk', 'almondmilk', 'coconutmilk', 'yogurt', 'coconutyogurt', 'frozenyogurt', 'icecream'];
const COCONUTTY = ['coconut', 'coconutmilk', 'coconutyogurt', 'coconutflakes', 'coconutchips'];
const NUTS = ['almond', 'walnut', 'cashew', 'hazelnut', 'pecan', 'peanut', 'pistachio', 'brazil', 'macadamia', 'pinenut'];
const CHOC = ['cocoa', 'darkchoc', 'cacaonibs'];
const SEEDS = ['chia', 'flax', 'hemp', 'pumpkinseed', 'sunflower', 'poppy', 'quinoa', 'seedmix'];
const BERRIES = ['strawberry', 'blueberry', 'raspberry', 'blackberry', 'cranberry', 'cherry', 'grape'];
const CITRUS = ['orange', 'lemon', 'lime'];
const TROPICAL = ['mango', 'pineapple', 'banana', 'coconut', 'passionfruit', 'guava', 'dragonfruit'];

export const COMBOS: Combo[] = [
  { id: 'apple-pie', name: 'Apple Pie', pts: 60, needs: ['apple', 'cinnamon', 'oats'] },
  { id: 'nutty-apple', name: 'Nutty Apple', pts: 40, needs: ['apple', ['peanutbutter', 'almondbutter']] },
  { id: 'toffee-apple', name: 'Toffee Apple', pts: 40, needs: [['apple', 'greenapple'], ['dates', 'maple', 'honey']] },
  { id: 'green-machine', name: 'Green Machine', pts: 60, needs: [['apple', 'greenapple'], ['spinach', 'kale'], 'ginger'] },
  { id: 'apple-crunch', name: 'Apple Crunch', pts: 45, needs: ['apple', ['walnut', 'almond', 'hazelnut'], ['granola', 'raisins']] },
  { id: 'carrot-cake', name: 'Carrot Cake', pts: 60, needs: ['carrot', 'cinnamon', ['walnut', 'pecan']] },
  { id: 'classic', name: 'Strawberry Banana Classic', pts: 50, needs: ['strawberry', 'banana'] },
  { id: 'strawberries-cream', name: 'Strawberries and Cream', pts: 45, needs: ['strawberry', MILKY] },
  { id: 'pb-banana', name: 'Peanut Butter Banana', pts: 50, needs: [['banana', 'frozenbanana'], 'peanutbutter'] },
  { id: 'choc-banana', name: 'Choccy Banana', pts: 45, needs: [['banana', 'frozenbanana'], CHOC] },
  { id: 'pina-colada', name: 'Pina Colada', pts: 60, needs: ['pineapple', COCONUTTY] },
  { id: 'tropical', name: 'Tropical Sunshine', pts: 70, distinct: { pool: TROPICAL, count: 3 } },
  { id: 'orchard', name: 'Orchard Crush', pts: 45, distinct: { pool: ['apple', 'greenapple', 'pear', 'plum', 'apricot', 'peach'], count: 2 } },
  { id: 'fig-honey', name: 'Honeyed Fig', pts: 50, needs: ['fig', 'honey'] },
  { id: 'melon-mint', name: 'Melon Cooler', pts: 45, needs: ['melon', ['lime', 'cucumber', 'ice']] },
  { id: 'ruby', name: 'Ruby Jewel', pts: 50, needs: ['pomegranate', BERRIES] },
  { id: 'berry-blast', name: 'Berry Blast', pts: 70, distinct: { pool: BERRIES, count: 3 } },
  { id: 'blueberry-muffin', name: 'Blueberry Muffin', pts: 60, needs: ['blueberry', 'oats', 'vanilla'] },
  { id: 'citrus-sunrise', name: 'Citrus Sunrise', pts: 45, distinct: { pool: CITRUS, count: 2 } },
  { id: 'lemon-zing', name: 'Lemon Ginger Zing', pts: 60, needs: ['lemon', 'ginger', 'honey'] },
  { id: 'peaches-cream', name: 'Peaches and Cream', pts: 45, needs: ['peach', MILKY] },
  { id: 'black-forest', name: 'Black Forest', pts: 50, needs: ['cherry', CHOC] },
  { id: 'pbj', name: 'PB and J', pts: 50, needs: ['peanutbutter', ['grape', 'strawberry', 'raspberry']] },
  { id: 'kiwi-cooler', name: 'Kiwi Cooler', pts: 45, needs: ['kiwi', ['lime', 'cucumber']] },
  { id: 'watermelon-wave', name: 'Watermelon Wave', pts: 45, needs: ['watermelon', ['lime', 'cucumber', 'ice']] },
  { id: 'pear-walnut', name: 'Pear and Walnut', pts: 55, needs: ['pear', 'walnut', 'honey'] },
  { id: 'plum-spice', name: 'Spiced Plum', pts: 40, needs: ['plum', ['cinnamon', 'ginger']] },
  { id: 'raspberry-ripple', name: 'Raspberry Ripple', pts: 55, needs: ['raspberry', 'vanilla', MILKY] },
  { id: 'choc-hazelnut', name: 'Choc Hazelnut', pts: 45, needs: ['hazelnut', ['cocoa', 'darkchoc']] },
  { id: 'choc-chip', name: 'Double Choc Chip', pts: 45, needs: ['darkchoc', 'whitechoc'] },
  { id: 'sundae', name: 'Sundae Best', pts: 50, needs: [['icecream', 'sorbet', 'frozenyogurt'], CHOC, NUTS] },
  { id: 'green-goddess', name: 'Green Goddess', pts: 55, needs: ['avocado', ['spinach', 'kale'], ['cucumber', 'celery', 'lime']] },
  { id: 'golden-milk', name: 'Golden Milk', pts: 50, needs: ['turmeric', 'ginger', MILKY] },
  { id: 'matcha-latte', name: 'Matcha Latte', pts: 45, needs: ['matcha', MILKY] },
  { id: 'overnight-oats', name: 'Overnight Oats', pts: 45, needs: ['oats', 'chia', MILKY] },
  { id: 'honey-nut', name: 'Honey Nut', pts: 35, needs: ['honey', NUTS] },
  { id: 'super-seeds', name: 'Super Seeds', pts: 40, distinct: { pool: SEEDS, count: 3 } },
  { id: 'nut-party', name: 'Nut Party', pts: 40, distinct: { pool: NUTS, count: 3 } },
  { id: 'trail-mix', name: 'Trail Mix', pts: 40, needs: [NUTS, ['raisins', 'dates'], ['oats', 'granola', 'seedmix']] },
];

export interface ScoreNote {
  id: string;
  label: string;
  good: boolean;
}

export interface SmoothieResult {
  points: number;
  rating: 1 | 2 | 3 | 4 | 5;
  verdict: string;
  name: string;
  color: string;
  combos: Combo[];
  notes: ScoreNote[];
}

const DUPLICATE_WORTH = [1, 0.8, 0.6, 0.45, 0.3];
const VERDICTS = ['Yuck!', 'Hmm, not bad', 'Yummy!', 'Delicious!', 'LEGENDARY!'];
const RATING_FLOORS = [0, 60, 150, 260, 400];

function comboMatches(combo: Combo, have: Set<string>): boolean {
  if (combo.distinct) {
    const hits = combo.distinct.pool.filter((id) => have.has(id)).length;
    if (hits < combo.distinct.count) return false;
  }
  return (combo.needs ?? []).every((need) => (typeof need === 'string' ? have.has(need) : need.some((id) => have.has(id))));
}

function mixColor(items: Ingredient[]): string {
  if (!items.length) return '#ffffff';
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  for (const item of items) {
    const weight = item.cat === 'fruit' ? 3 : item.cat === 'liquid' || item.cat === 'creamy' ? 1.5 : 1;
    const n = parseInt(item.color.slice(1), 16);
    r += ((n >> 16) & 255) * weight;
    g += ((n >> 8) & 255) * weight;
    b += (n & 255) * weight;
    total += weight;
  }
  const hex = (v: number) => Math.round(v / total).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function nameSmoothie(items: Ingredient[], counts: Map<string, number>, combos: Combo[], taste: Taste): string {
  if (combos.length) {
    const top = [...combos].sort((a, b) => b.pts - a.pts)[0];
    return `${top.name} Smoothie`;
  }
  const lead = [...items].sort(
    (a, b) => Number(b.cat === 'fruit') - Number(a.cat === 'fruit') || (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || b.pts - a.pts,
  )[0];
  const feel: [number, string][] = [
    [taste.creamy, 'Creamy'],
    [taste.fresh, 'Fresh'],
    [taste.nutty, 'Nutty'],
    [taste.rich, 'Rich'],
    [taste.tart, 'Zingy'],
    [taste.sweet, 'Sweet'],
  ];
  const adjective = feel.sort((a, b) => b[0] - a[0])[0][1];
  const noun = ['Swirl', 'Whizz', 'Splash', 'Dream', 'Blitz'][items.length % 5];
  return `${adjective} ${lead.name} ${noun}`;
}

/** Score a jug of ingredient ids. Only the first MAX_JUG items are blended. */
export function scoreSmoothie(ids: string[]): SmoothieResult {
  const items = ids.slice(0, MAX_JUG).map(ingredient);
  const notes: ScoreNote[] = [];
  if (!items.length) {
    return { points: 0, rating: 1, verdict: 'The jug is empty!', name: 'Thin Air', color: '#ffffff', combos: [], notes };
  }

  const counts = new Map<string, number>();
  const taste: Taste = { sweet: 0, tart: 0, creamy: 0, nutty: 0, fresh: 0, rich: 0 };
  let base = 0;
  for (const item of items) {
    const seen = counts.get(item.id) ?? 0;
    base += item.pts * DUPLICATE_WORTH[Math.min(seen, DUPLICATE_WORTH.length - 1)];
    counts.set(item.id, seen + 1);
    for (const key of Object.keys(taste) as (keyof Taste)[]) taste[key] += item.taste[key];
  }

  const have = new Set(counts.keys());
  const cats = new Set<Category>(items.map((i) => i.cat));
  const fruitCount = items.filter((i) => i.cat === 'fruit').length;
  const fruitKinds = [...have].filter((id) => ingredient(id).cat === 'fruit').length;

  let score = base;
  score += fruitCount * 12 + Math.max(0, fruitKinds - 1) * 15;
  score += cats.size * 8;

  const combos = COMBOS.filter((combo) => comboMatches(combo, have));
  for (const combo of combos) score += combo.pts;

  let multiplier = 1;
  if (fruitCount === 0) {
    multiplier *= 0.6;
    notes.push({ id: 'no-fruit', label: "Where's the fruit?", good: false });
  } else if (fruitCount >= 4) {
    notes.push({ id: 'fruity', label: 'Super fruity!', good: true });
  }
  if (cats.has('liquid') || cats.has('creamy')) {
    multiplier *= 1.15;
    notes.push({ id: 'smooth', label: 'Silky smooth', good: true });
  } else if (items.length >= 3) {
    multiplier *= 0.9;
    notes.push({ id: 'thick', label: 'A bit thick! Try milk or yogurt', good: false });
  }
  const strong = items.filter((i) => i.strong).length;
  if (strong > 2) {
    multiplier *= 0.8;
    notes.push({ id: 'strong', label: 'Whoa, strong flavours!', good: false });
  }
  if (taste.tart > taste.sweet + 3) {
    multiplier *= 0.9;
    notes.push({ id: 'sour', label: 'Extra sour!', good: false });
  }
  if (taste.sweet >= 4 && taste.creamy >= 3 && taste.fresh >= 3 && strong <= 2) {
    multiplier *= 1.1;
    notes.push({ id: 'balanced', label: 'Perfectly balanced', good: true });
  }
  if (have.size >= 7) {
    multiplier *= 1.05;
    notes.push({ id: 'variety', label: 'So much variety!', good: true });
  }
  if (items.length === MAX_JUG) {
    multiplier *= 1.1;
    notes.push({ id: 'full', label: 'Full jug!', good: true });
  }

  const points = Math.max(5, Math.round((score * multiplier) / 5) * 5);
  let rating = 1;
  for (let i = 0; i < RATING_FLOORS.length; i++) if (points >= RATING_FLOORS[i]) rating = i + 1;

  return {
    points,
    rating: rating as SmoothieResult['rating'],
    verdict: VERDICTS[rating - 1],
    name: nameSmoothie(items, counts, combos, taste),
    color: mixColor(items),
    combos,
    notes,
  };
}
