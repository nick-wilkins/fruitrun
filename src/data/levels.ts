export interface Level {
  id: string;
  n: number;
  fruit: string;
  name: string;
  /** Node centre on the map image, as a percentage of its width and height. */
  x: number;
  y: number;
  /** Whether the map art draws this node as locked (grey) rather than gold. */
  artLocked: boolean;
  /** Levels that lead here on the map: finishing any one of them opens this level. Empty for the first. */
  after: number[];
  /** Bonus ingredients that can appear on this course. */
  bonusPool: string[];
}

const W = 1672;
const H = 941;

/** Staples that turn up everywhere. */
const BASICS = ['oats', 'honey', 'milk', 'yogurt', 'chia', 'almond', 'ice', 'granola', 'vanilla', 'dates', 'flax', 'oatmilk'];

const node = (n: number, after: number[], fruit: string, name: string, px: number, py: number, specials: string[]): Level => ({
  id: `level-${n}`,
  n,
  fruit,
  name,
  x: (px / W) * 100,
  y: (py / H) * 100,
  artLocked: n >= 15,
  after,
  // Specials are listed twice so the ingredients that suit this fruit turn up more often.
  bonusPool: [...BASICS, ...specials, ...specials],
});

// The paths drawn on the map: 1 to 4 in a line, then a junction with three ways on: 5 (then 7, 8, 9),
// 6 (then 10, 11, 12 and round the castle, 15 to 18), and 13 (then 14 and the blender).
export const LEVELS: Level[] = [
  node(1, [], 'apple', 'Apple Orchard', 188, 822, ['cinnamon', 'peanutbutter', 'walnut', 'ginger', 'spinach', 'maple', 'raisins', 'hazelnut', 'carrot', 'greenapple', 'pumpkinseed', 'almondbutter']),
  node(2, [1], 'banana', 'Banana Bend', 422, 795, ['peanutbutter', 'cocoa', 'darkchoc', 'frozenbanana', 'peanut', 'coconutflakes', 'lime', 'pecan']),
  node(3, [2], 'strawberry', 'Strawberry Fields', 622, 773, ['frozenyogurt', 'sorbet', 'peanutbutter', 'whitechoc', 'cranberry', 'blackberry', 'cashew', 'hemp']),
  node(4, [3], 'orange', 'Orange Grove', 830, 750, ['carrot', 'ginger', 'turmeric', 'lime', 'apricot', 'coconutmilk', 'sunflower', 'pistachio']),
  node(5, [4], 'grape', 'Grape Vine Valley', 563, 596, ['peanutbutter', 'almondbutter', 'hemp', 'blackberry', 'pomegranate', 'walnut', 'kale', 'seedmix']),
  node(6, [4], 'pear', 'Pear Pond', 747, 521, ['walnut', 'cinnamon', 'ginger', 'spinach', 'greenapple', 'maple', 'pecan', 'quinoa']),
  node(7, [5], 'watermelon', 'Watermelon Wave', 398, 460, ['cucumber', 'lime', 'melon', 'coconutchips', 'sorbet', 'celery', 'poppy', 'pumpkinseed']),
  node(8, [7], 'kiwi', 'Kiwi Canyon', 240, 398, ['lime', 'cucumber', 'spinach', 'kale', 'avocado', 'celery', 'wheatgrass', 'pinenut']),
  node(9, [8], 'cherry', 'Cherry Hilltop', 173, 241, ['cocoa', 'darkchoc', 'cacaonibs', 'icecream', 'cranberry', 'hazelnut', 'almondmilk', 'brazil']),
  node(10, [6], 'lemon', 'Lemon Falls', 730, 330, ['ginger', 'turmeric', 'lime', 'matcha', 'poppy', 'coconutyogurt', 'cashew', 'beetroot']),
  node(11, [10], 'blueberry', 'Blueberry Ridge', 838, 239, ['quinoa', 'protein', 'blackberry', 'almondmilk', 'whitechoc', 'frozenyogurt', 'macadamia', 'seedmix']),
  node(12, [11], 'pineapple', 'Pineapple Peak', 1011, 195, ['coconutmilk', 'coconutflakes', 'coconutchips', 'passionfruit', 'guava', 'macadamia', 'frozenbanana', 'spirulina']),
  node(13, [4], 'peach', 'Peach Bridge', 1063, 576, ['icecream', 'apricot', 'pistachio', 'maple', 'cashew', 'coconutyogurt', 'raisins', 'sunflower']),
  node(14, [13], 'plum', 'Plum Path', 1262, 581, ['cinnamon', 'ginger', 'fig', 'pecan', 'beetroot', 'hazelnut', 'cacaonibs', 'kale']),
  node(15, [12], 'raspberry', 'Raspberry Road', 1213, 262, ['whitechoc', 'darkchoc', 'sorbet', 'pomegranate', 'brazil', 'frozenyogurt', 'protein', 'avocado']),
  node(16, [15], 'mango', 'Mango Moat', 1369, 342, ['coconutyogurt', 'passionfruit', 'guava', 'lime', 'pinenut', 'spirulina', 'frozenbanana', 'turmeric']),
  node(17, [16], 'coconut', 'Coconut Gate', 1550, 348, ['coconutmilk', 'coconutflakes', 'coconutchips', 'cocoa', 'macadamia', 'pumpkinseed', 'melon', 'wheatgrass']),
  node(18, [17], 'dragonfruit', 'Dragon Fruit Castle', 1483, 224, ['passionfruit', 'guava', 'fig', 'pomegranate', 'melon', 'matcha', 'seedmix', 'whitechoc', 'apricot', 'blackberry']),
];

/** The purple pad on the map is the blender. */
export const BLENDER_NODE = { x: (1453 / W) * 100, y: (590 / H) * 100 };

export function levelById(id: string): Level {
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`Unknown level: ${id}`);
  return found;
}
