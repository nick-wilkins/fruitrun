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
  /** A playable course exists. */
  built: boolean;
  /** Finish at or under these times (seconds) for 5, 4, 3 and 2 stars. Anything slower is 1. */
  starTimes: [number, number, number, number];
  /** Bonus ingredients that can appear on this course. */
  bonusPool: string[];
}

const W = 1672;
const H = 941;

const node = (
  n: number,
  fruit: string,
  name: string,
  px: number,
  py: number,
  bonusPool: string[] = [],
  starTimes: [number, number, number, number] = [60, 70, 80, 95],
  built = false,
): Level => ({
  id: `level-${n}`,
  n,
  fruit,
  name,
  x: (px / W) * 100,
  y: (py / H) * 100,
  artLocked: n >= 15,
  built,
  starTimes,
  bonusPool,
});

export const LEVELS: Level[] = [
  node(
    1,
    'apple',
    'Apple Orchard',
    188,
    822,
    [
      'cinnamon', 'oats', 'honey', 'peanutbutter', 'milk', 'yogurt', 'walnut', 'almond', 'chia', 'flax',
      'ginger', 'spinach', 'dates', 'maple', 'granola', 'raisins', 'coconutflakes', 'pumpkinseed', 'vanilla', 'ice',
      'oatmilk', 'hazelnut', 'carrot', 'almondbutter', 'pecan', 'seedmix', 'icecream', 'kale', 'darkchoc', 'cashew',
      'greenapple', 'greenapple', 'blackberry', 'cranberry',
    ],
    [45, 49, 53, 58],
    true,
  ),
  node(2, 'banana', 'Banana Bend', 422, 795),
  node(3, 'strawberry', 'Strawberry Fields', 622, 773),
  node(4, 'orange', 'Orange Grove', 830, 750),
  node(5, 'grape', 'Grape Vine Valley', 563, 596),
  node(6, 'pear', 'Pear Pond', 747, 521),
  node(7, 'watermelon', 'Watermelon Wave', 398, 460),
  node(8, 'kiwi', 'Kiwi Canyon', 240, 398),
  node(9, 'cherry', 'Cherry Hilltop', 173, 241),
  node(10, 'lemon', 'Lemon Falls', 730, 330),
  node(11, 'blueberry', 'Blueberry Ridge', 838, 239),
  node(12, 'pineapple', 'Pineapple Peak', 1011, 195),
  node(13, 'peach', 'Peach Bridge', 1063, 576),
  node(14, 'plum', 'Plum Path', 1262, 581),
  node(15, 'raspberry', 'Raspberry Road', 1213, 262),
  node(16, 'mango', 'Mango Moat', 1369, 342),
  node(17, 'coconut', 'Coconut Gate', 1550, 348),
  node(18, 'dragonfruit', 'Dragon Fruit Castle', 1483, 224),
];

/** The purple pad on the map is the blender. */
export const BLENDER_NODE = { x: (1453 / W) * 100, y: (590 / H) * 100 };

export function levelById(id: string): Level {
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`Unknown level: ${id}`);
  return found;
}
