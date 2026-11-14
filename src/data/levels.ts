import { seeded } from '../game/random';
import { INGREDIENTS, ingredient } from './ingredients';

export interface World {
  id: string;
  name: string;
  /** Map picture, relative to the site root. */
  art: string;
  /**
   * How level nodes are drawn. 'art' trusts the numbers painted on the map and only covers what differs;
   * a colour draws every node itself, for maps whose painted numbers do not match the route.
   */
  nodes: 'art' | 'blue' | 'yellow';
  /** Where the blender stand is on the map, as a percentage of its width and height. */
  blender: { x: number; y: number };
}

export interface Level {
  id: string;
  /** Position in the whole game, from 1. */
  n: number;
  /** Index into WORLDS. */
  world: number;
  /** The number shown on the map: levels are numbered afresh in each world. */
  label: number;
  fruit: string;
  name: string;
  /** Node centre on the map image, as a percentage of its width and height. */
  x: number;
  y: number;
  /** Whether the map art draws this node as locked (grey) rather than open. Only matters for 'art' worlds. */
  artLocked: boolean;
  /** Levels (by `n`) that lead here on the map: finishing any one of them opens this level. Empty for the first. */
  after: number[];
  /** 0 (gentle) to 1 (busy): how many obstacles the course pieces lay down. */
  difficulty: number;
  /** Bonus ingredients that can appear on this course. */
  bonusPool: string[];
}

const W = 1672;
const H = 941;
const at = (px: number, py: number) => ({ x: (px / W) * 100, y: (py / H) * 100 });

export const WORLDS: World[] = [
  { id: 'meadow', name: 'Sunny Meadow', art: 'assets/map.webp', nodes: 'art', blender: at(1453, 590) },
  { id: 'tropics', name: 'Tropical Falls', art: 'assets/map-tropics.webp', nodes: 'blue', blender: at(1545, 690) },
  { id: 'village', name: 'Blossom Village', art: 'assets/map-village.webp', nodes: 'yellow', blender: at(800, 118) },
];

/** Staples that turn up everywhere. */
const BASICS = ['oats', 'honey', 'milk', 'yogurt', 'chia', 'almond', 'ice', 'granola', 'vanilla', 'dates', 'flax', 'oatmilk'];

// ---- World 1: Sunny Meadow. The paths drawn on the map run 1 to 4 in a line, then a junction with three ways on:
// 5 (then 7, 8, 9), 6 (then 10, 11, 12 and round the castle, 15 to 18), and 13 (then 14 and the blender).

const meadow = (n: number, after: number[], fruit: string, name: string, px: number, py: number, specials: string[]): Level => ({
  id: `level-${n}`,
  n,
  world: 0,
  label: n,
  fruit,
  name,
  ...at(px, py),
  artLocked: n >= 15,
  after,
  difficulty: (n - 1) / 17,
  // Specials are listed twice so the ingredients that suit this fruit turn up more often.
  bonusPool: [...BASICS, ...specials, ...specials],
});

const MEADOW: Level[] = [
  meadow(1, [], 'apple', 'Apple Orchard', 188, 822, ['cinnamon', 'peanutbutter', 'walnut', 'ginger', 'spinach', 'maple', 'raisins', 'hazelnut', 'carrot', 'greenapple', 'pumpkinseed', 'almondbutter']),
  meadow(2, [1], 'banana', 'Banana Bend', 422, 795, ['peanutbutter', 'cocoa', 'darkchoc', 'frozenbanana', 'peanut', 'coconutflakes', 'lime', 'pecan']),
  meadow(3, [2], 'strawberry', 'Strawberry Fields', 622, 773, ['frozenyogurt', 'sorbet', 'peanutbutter', 'whitechoc', 'cranberry', 'blackberry', 'cashew', 'hemp']),
  meadow(4, [3], 'orange', 'Orange Grove', 830, 750, ['carrot', 'ginger', 'turmeric', 'lime', 'apricot', 'coconutmilk', 'sunflower', 'pistachio']),
  meadow(5, [4], 'grape', 'Grape Vine Valley', 563, 596, ['peanutbutter', 'almondbutter', 'hemp', 'blackberry', 'pomegranate', 'walnut', 'kale', 'seedmix']),
  meadow(6, [4], 'pear', 'Pear Pond', 747, 521, ['walnut', 'cinnamon', 'ginger', 'spinach', 'greenapple', 'maple', 'pecan', 'quinoa']),
  meadow(7, [5], 'watermelon', 'Watermelon Wave', 398, 460, ['cucumber', 'lime', 'melon', 'coconutchips', 'sorbet', 'celery', 'poppy', 'pumpkinseed']),
  meadow(8, [7], 'kiwi', 'Kiwi Canyon', 240, 398, ['lime', 'cucumber', 'spinach', 'kale', 'avocado', 'celery', 'wheatgrass', 'pinenut']),
  meadow(9, [8], 'cherry', 'Cherry Hilltop', 173, 241, ['cocoa', 'darkchoc', 'cacaonibs', 'icecream', 'cranberry', 'hazelnut', 'almondmilk', 'brazil']),
  meadow(10, [6], 'lemon', 'Lemon Falls', 730, 330, ['ginger', 'turmeric', 'lime', 'matcha', 'poppy', 'coconutyogurt', 'cashew', 'beetroot']),
  meadow(11, [10], 'blueberry', 'Blueberry Ridge', 838, 239, ['quinoa', 'protein', 'blackberry', 'almondmilk', 'whitechoc', 'frozenyogurt', 'macadamia', 'seedmix']),
  meadow(12, [11], 'pineapple', 'Pineapple Peak', 1011, 195, ['coconutmilk', 'coconutflakes', 'coconutchips', 'passionfruit', 'guava', 'macadamia', 'frozenbanana', 'spirulina']),
  meadow(13, [4], 'peach', 'Peach Bridge', 1063, 576, ['icecream', 'apricot', 'pistachio', 'maple', 'cashew', 'coconutyogurt', 'raisins', 'sunflower']),
  meadow(14, [13], 'plum', 'Plum Path', 1262, 581, ['cinnamon', 'ginger', 'fig', 'pecan', 'beetroot', 'hazelnut', 'cacaonibs', 'kale']),
  meadow(15, [12], 'raspberry', 'Raspberry Road', 1213, 262, ['whitechoc', 'darkchoc', 'sorbet', 'pomegranate', 'brazil', 'frozenyogurt', 'protein', 'avocado']),
  meadow(16, [15], 'mango', 'Mango Moat', 1369, 342, ['coconutyogurt', 'passionfruit', 'guava', 'lime', 'pinenut', 'spirulina', 'frozenbanana', 'turmeric']),
  meadow(17, [16], 'coconut', 'Coconut Gate', 1550, 348, ['coconutmilk', 'coconutflakes', 'coconutchips', 'cocoa', 'macadamia', 'pumpkinseed', 'melon', 'wheatgrass']),
  meadow(18, [17], 'dragonfruit', 'Dragon Fruit Castle', 1483, 224, ['passionfruit', 'guava', 'fig', 'pomegranate', 'melon', 'matcha', 'seedmix', 'whitechoc', 'apricot', 'blackberry']),
];

// ---- Worlds 2 and 3 are laid out as a list of stops: where each node is on the map, its fruit, and which stop in
// the same world leads to it (0 means the last stop on the main path of the world before).

interface Stop {
  px: number;
  py: number;
  fruit: string;
  /** Label of the stop before this one in the same world, or 0 for the way in from the previous world. */
  from: number;
}

const stop = (px: number, py: number, fruit: string, from: number): Stop => ({ px, py, fruit, from });

const EXTRAS = INGREDIENTS.filter((i) => i.cat !== 'fruit' && !BASICS.includes(i.id)).map((i) => i.id);
const RARE = ['greenapple', 'blackberry', 'melon', 'pomegranate', 'lime', 'cranberry', 'apricot', 'fig', 'passionfruit', 'guava'];

function world(index: number, first: number, entry: number, easiest: number, hardest: number, places: string[], stops: Stop[]): Level[] {
  return stops.map((s, i) => {
    const n = first + i;
    const random = seeded(n * 2053);
    const specials = Array.from({ length: 7 }, () => EXTRAS[Math.floor(random() * EXTRAS.length)]);
    specials.push(RARE[Math.floor(random() * RARE.length)]);
    return {
      id: `level-${n}`,
      n,
      world: index,
      label: i + 1,
      fruit: s.fruit,
      name: `${ingredient(s.fruit).name} ${places[i % places.length]}`,
      ...at(s.px, s.py),
      artLocked: false,
      after: [s.from === 0 ? entry : first + s.from - 1],
      difficulty: easiest + ((hardest - easiest) * i) / (stops.length - 1),
      bonusPool: [...BASICS, ...specials, ...specials],
    };
  });
}

// Tropical Falls: a main path of 14 from the garden gate to the portal, with seven side paths to the grey stones.
const TROPICS = world(1, 19, 18, 0.45, 0.85, ['Lagoon', 'Terrace', 'Crossing', 'Cove', 'Springs', 'Grove', 'Cascade', 'Pavilion', 'Maze', 'Glasshouse', 'Lookout', 'Canopy', 'Falls', 'Portal', 'Ledge', 'Hollow', 'Nook', 'Steps', 'Summit', 'Bluff', 'Hideaway'], [
  stop(365, 765, 'lime', 0),
  stop(512, 712, 'melon', 1),
  stop(705, 738, 'passionfruit', 2),
  stop(1070, 670, 'guava', 3),
  stop(978, 548, 'mango', 4),
  stop(1200, 512, 'pineapple', 5),
  stop(1185, 398, 'coconut', 6),
  stop(957, 365, 'banana', 7),
  stop(568, 373, 'kiwi', 8),
  stop(482, 288, 'dragonfruit', 9),
  stop(617, 196, 'pomegranate', 10),
  stop(805, 165, 'orange', 11),
  stop(1068, 180, 'watermelon', 12),
  stop(1343, 190, 'fig', 13),
  stop(522, 588, 'lemon', 2),
  stop(310, 598, 'apricot', 15),
  stop(405, 490, 'peach', 15),
  stop(1402, 500, 'cherry', 6),
  stop(1545, 380, 'blackberry', 18),
  stop(875, 245, 'cranberry', 8),
  stop(430, 112, 'greenapple', 10),
]);

// Blossom Village: a main path of 17 from the start arch up to the smoothie shop, with side paths to the islands
// and the locked cave.
const VILLAGE = world(2, 40, 32, 0.55, 1, ['Lane', 'Green', 'Fence', 'Bridge', 'Bank', 'Meadow', 'Mill', 'Rise', 'Waterfall', 'Orchard', 'Crossing', 'Arch', 'Cottage', 'Garden', 'Path', 'Market', 'Shop', 'Swing', 'Corner', 'Hill', 'Pergola', 'Stall', 'Island', 'Bench', 'Blossom', 'Treehouse', 'Lantern', 'Roots', 'Cave'], [
  stop(163, 795, 'apple', 0),
  stop(342, 810, 'pear', 1),
  stop(526, 810, 'plum', 2),
  stop(705, 782, 'strawberry', 3),
  stop(975, 715, 'grape', 4),
  stop(1178, 660, 'cherry', 5),
  stop(1300, 578, 'raspberry', 6),
  stop(1436, 470, 'blueberry', 7),
  stop(1430, 357, 'orange', 8),
  stop(1225, 362, 'lemon', 9),
  stop(1080, 350, 'peach', 10),
  stop(948, 405, 'apricot', 11),
  stop(800, 435, 'blackberry', 12),
  stop(662, 362, 'cranberry', 13),
  stop(588, 287, 'greenapple', 14),
  stop(667, 220, 'fig', 15),
  stop(830, 208, 'pomegranate', 16),
  stop(1340, 768, 'kiwi', 6),
  stop(1483, 780, 'banana', 18),
  stop(165, 510, 'watermelon', 1),
  stop(262, 465, 'melon', 20),
  stop(350, 420, 'lime', 21),
  stop(325, 208, 'guava', 22),
  stop(222, 180, 'passionfruit', 23),
  stop(368, 150, 'mango', 23),
  stop(1185, 190, 'pineapple', 11),
  stop(1282, 192, 'coconut', 26),
  stop(1337, 150, 'strawberry', 27),
  stop(1500, 240, 'dragonfruit', 9),
]);

export const LEVELS: Level[] = [...MEADOW, ...TROPICS, ...VILLAGE];

export function levelById(id: string): Level {
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`Unknown level: ${id}`);
  return found;
}
