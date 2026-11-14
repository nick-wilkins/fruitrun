export type Category =
  | 'fruit'
  | 'nut'
  | 'seed'
  | 'liquid'
  | 'creamy'
  | 'sweet'
  | 'spice'
  | 'boost'
  | 'green'
  | 'topping';

export interface Taste {
  sweet: number;
  tart: number;
  creamy: number;
  nutty: number;
  fresh: number;
  rich: number;
}

export interface Ingredient {
  id: string;
  name: string;
  cat: Category;
  pts: number;
  /** Colour it gives the smoothie. */
  color: string;
  taste: Taste;
  /** Strong flavours spoil a smoothie when overused. */
  strong?: boolean;
  /** Icon path, relative to the site root. */
  img: string;
}

const t = (sweet: number, tart: number, creamy: number, nutty: number, fresh: number, rich: number): Taste => ({
  sweet,
  tart,
  creamy,
  nutty,
  fresh,
  rich,
});

const fruit = (id: string, name: string, pts: number, color: string, taste: Taste): Ingredient => ({
  id,
  name,
  cat: 'fruit',
  pts,
  color,
  taste,
  img: `assets/fruits/${id}.png`,
});

const extra = (
  id: string,
  name: string,
  cat: Category,
  pts: number,
  color: string,
  taste: Taste,
  strong = false,
): Ingredient => ({ id, name, cat, pts, color, taste, img: `assets/items/${id}.png`, ...(strong ? { strong } : {}) });

export const INGREDIENTS: Ingredient[] = [
  // Level fruits, in map order.
  fruit('apple', 'Apple', 20, '#e9c46a', t(2, 1, 0, 0, 2, 0)),
  fruit('banana', 'Banana', 20, '#f6e27a', t(3, 0, 2, 0, 0, 1)),
  fruit('strawberry', 'Strawberry', 22, '#ff5d73', t(2, 1, 0, 0, 2, 0)),
  fruit('orange', 'Orange', 22, '#ff9f1c', t(2, 2, 0, 0, 2, 0)),
  fruit('grape', 'Grapes', 22, '#8e5bd6', t(3, 1, 0, 0, 1, 0)),
  fruit('pear', 'Pear', 22, '#c5e063', t(2, 0, 0, 0, 2, 0)),
  fruit('watermelon', 'Watermelon', 24, '#ff6f7d', t(2, 0, 0, 0, 3, 0)),
  fruit('kiwi', 'Kiwi', 24, '#9bd14b', t(1, 2, 0, 0, 2, 0)),
  fruit('cherry', 'Cherries', 24, '#d7263d', t(2, 1, 0, 0, 1, 1)),
  fruit('lemon', 'Lemon', 24, '#ffe14d', t(0, 3, 0, 0, 2, 0)),
  fruit('blueberry', 'Blueberries', 26, '#5468d4', t(2, 1, 0, 0, 1, 0)),
  fruit('pineapple', 'Pineapple', 26, '#ffd23f', t(3, 2, 0, 0, 2, 0)),
  fruit('peach', 'Peach', 26, '#ffb07c', t(3, 0, 1, 0, 1, 0)),
  fruit('plum', 'Plum', 28, '#7b3fa0', t(2, 1, 0, 0, 1, 1)),
  fruit('raspberry', 'Raspberry', 28, '#e63b7a', t(1, 2, 0, 0, 2, 0)),
  fruit('mango', 'Mango', 28, '#ffb627', t(3, 1, 1, 0, 1, 0)),
  fruit('coconut', 'Coconut', 30, '#f5efe0', t(1, 0, 2, 1, 0, 2)),
  fruit('dragonfruit', 'Dragon Fruit', 30, '#f06fb0', t(2, 0, 0, 0, 3, 0)),

  // Rare fruits: found on courses as lucky pickups rather than earned from a level.
  fruit('greenapple', 'Green Apple', 24, '#b6e05a', t(1, 2, 0, 0, 3, 0)),
  fruit('blackberry', 'Blackberry', 26, '#4a2a5e', t(2, 1, 0, 0, 1, 1)),
  fruit('melon', 'Melon', 24, '#ffb66b', t(2, 0, 0, 0, 3, 0)),
  fruit('pomegranate', 'Pomegranate', 28, '#c81f4a', t(2, 2, 0, 0, 1, 1)),
  fruit('lime', 'Lime', 24, '#a8e04a', t(0, 3, 0, 0, 3, 0)),
  fruit('cranberry', 'Cranberries', 26, '#d92b3a', t(1, 3, 0, 0, 1, 0)),
  fruit('apricot', 'Apricot', 26, '#ffa63d', t(2, 1, 0, 0, 1, 0)),
  fruit('fig', 'Fig', 28, '#8a3f6b', t(3, 0, 0, 0, 0, 2)),
  fruit('passionfruit', 'Passion Fruit', 30, '#f2b632', t(2, 3, 0, 0, 2, 0)),
  fruit('guava', 'Guava', 28, '#ff8f9c', t(3, 1, 0, 0, 2, 0)),

  // Nuts
  extra('almond', 'Almonds', 'nut', 12, '#d9b48a', t(0, 0, 1, 3, 0, 1)),
  extra('cashew', 'Cashews', 'nut', 12, '#f1dcb5', t(1, 0, 2, 2, 0, 1)),
  extra('walnut', 'Walnuts', 'nut', 12, '#c9a57c', t(0, 0, 0, 3, 0, 2)),
  extra('hazelnut', 'Hazelnuts', 'nut', 13, '#c08a55', t(1, 0, 0, 3, 0, 2)),
  extra('pistachio', 'Pistachios', 'nut', 14, '#b9d48a', t(1, 0, 0, 3, 0, 1)),
  extra('pecan', 'Pecans', 'nut', 13, '#a8683a', t(1, 0, 0, 3, 0, 2)),
  extra('brazil', 'Brazil Nuts', 'nut', 13, '#d6c2a0', t(0, 0, 1, 3, 0, 2)),
  extra('macadamia', 'Macadamias', 'nut', 14, '#f3e3c0', t(1, 0, 2, 2, 0, 2)),
  extra('peanut', 'Peanuts', 'nut', 10, '#e0bf8a', t(0, 0, 0, 3, 0, 1)),
  extra('pinenut', 'Pine Nuts', 'nut', 13, '#f0dfae', t(0, 0, 1, 3, 0, 1)),

  // Seeds and grains
  extra('chia', 'Chia Seeds', 'seed', 12, '#8d8d99', t(0, 0, 1, 1, 0, 0)),
  extra('flax', 'Flax Seeds', 'seed', 12, '#b98a55', t(0, 0, 0, 2, 0, 0)),
  extra('hemp', 'Hemp Hearts', 'seed', 13, '#d9dcae', t(0, 0, 1, 2, 0, 0)),
  extra('pumpkinseed', 'Pumpkin Seeds', 'seed', 13, '#9fbf6b', t(0, 0, 0, 2, 1, 0)),
  extra('sunflower', 'Sunflower Seeds', 'seed', 12, '#d8d2c0', t(0, 0, 0, 2, 0, 0)),
  extra('poppy', 'Poppy Seeds', 'seed', 11, '#6c7391', t(0, 0, 0, 1, 0, 0)),
  extra('quinoa', 'Quinoa', 'seed', 11, '#f0e2bd', t(0, 0, 1, 1, 0, 0)),
  extra('seedmix', 'Super Seed Mix', 'seed', 14, '#e0c48a', t(0, 0, 0, 2, 0, 1)),

  // Drinks
  extra('milk', 'Milk', 'liquid', 14, '#fdfdf5', t(1, 0, 3, 0, 0, 0)),
  extra('oatmilk', 'Oat Milk', 'liquid', 14, '#f3e8d0', t(1, 0, 2, 1, 0, 0)),
  extra('almondmilk', 'Almond Milk', 'liquid', 14, '#f6ecd9', t(1, 0, 2, 2, 0, 0)),
  extra('coconutmilk', 'Coconut Milk', 'liquid', 15, '#fbf7ec', t(1, 0, 3, 1, 0, 1)),

  // Creamy
  extra('yogurt', 'Yogurt', 'creamy', 15, '#fff8ee', t(1, 1, 3, 0, 0, 0)),
  extra('coconutyogurt', 'Coconut Yogurt', 'creamy', 15, '#fbf6ea', t(1, 0, 3, 1, 0, 1)),
  extra('peanutbutter', 'Peanut Butter', 'creamy', 16, '#c98f4e', t(1, 0, 2, 3, 0, 2)),
  extra('almondbutter', 'Almond Butter', 'creamy', 16, '#b98556', t(1, 0, 2, 3, 0, 2)),
  extra('avocado', 'Avocado', 'creamy', 16, '#b7d67a', t(0, 0, 3, 1, 1, 1)),
  extra('frozenbanana', 'Banana Slices', 'creamy', 15, '#f8e9a0', t(3, 0, 2, 0, 0, 0)),
  extra('icecream', 'Vanilla Ice Cream', 'creamy', 17, '#fff1c9', t(3, 0, 3, 0, 0, 1)),
  extra('sorbet', 'Berry Sorbet', 'creamy', 17, '#ff7fa8', t(3, 1, 1, 0, 2, 0)),
  extra('frozenyogurt', 'Frozen Yogurt', 'creamy', 17, '#c9a6ef', t(2, 1, 3, 0, 1, 0)),

  // Sweet
  extra('honey', 'Honey', 'sweet', 14, '#f2b632', t(3, 0, 0, 0, 0, 1)),
  extra('maple', 'Maple Syrup', 'sweet', 14, '#b5651d', t(3, 0, 0, 0, 0, 2)),
  extra('dates', 'Dates', 'sweet', 14, '#7a4a2a', t(3, 0, 0, 0, 0, 2)),
  extra('vanilla', 'Vanilla', 'sweet', 13, '#f5e9c8', t(2, 0, 1, 0, 0, 1)),
  extra('raisins', 'Raisins', 'sweet', 12, '#5c3a4a', t(2, 0, 0, 0, 0, 1)),

  // Spice
  extra('cinnamon', 'Cinnamon', 'spice', 13, '#b5713a', t(1, 0, 0, 0, 0, 2), true),
  extra('ginger', 'Ginger', 'spice', 13, '#e7c77b', t(0, 1, 0, 0, 2, 1), true),
  extra('turmeric', 'Turmeric', 'spice', 12, '#f0a51a', t(0, 0, 0, 0, 1, 2), true),

  // Boosts
  extra('cocoa', 'Cocoa', 'boost', 15, '#6b3f24', t(0, 0, 0, 0, 0, 3)),
  extra('cacaonibs', 'Cacao Nibs', 'boost', 14, '#4f2e1b', t(0, 0, 0, 1, 0, 3)),
  extra('protein', 'Protein Powder', 'boost', 14, '#f1e6d2', t(1, 0, 2, 0, 0, 0)),
  extra('matcha', 'Matcha', 'boost', 15, '#9cc05a', t(0, 0, 0, 0, 2, 1), true),
  extra('spirulina', 'Spirulina', 'boost', 13, '#2f7a6b', t(0, 0, 0, 0, 1, 1), true),
  extra('wheatgrass', 'Wheatgrass', 'boost', 13, '#5fbf3a', t(0, 0, 0, 0, 3, 0), true),

  // Greens and veg
  extra('spinach', 'Spinach', 'green', 14, '#5fae4a', t(0, 0, 0, 0, 3, 0), true),
  extra('kale', 'Kale', 'green', 14, '#4a8f4f', t(0, 0, 0, 0, 3, 0), true),
  extra('cucumber', 'Cucumber', 'green', 12, '#c4e6a6', t(0, 0, 0, 0, 3, 0)),
  extra('celery', 'Celery', 'green', 12, '#b8dd8a', t(0, 0, 0, 0, 3, 0)),
  extra('carrot', 'Carrot', 'green', 13, '#ff8c2a', t(1, 0, 0, 0, 2, 0)),
  extra('beetroot', 'Beetroot', 'green', 13, '#a3154f', t(1, 0, 0, 0, 1, 2), true),

  // Mix-ins
  extra('oats', 'Oats', 'topping', 13, '#ead9b5', t(0, 0, 1, 1, 0, 1)),
  extra('granola', 'Granola', 'topping', 13, '#cfa262', t(1, 0, 0, 2, 0, 1)),
  extra('coconutflakes', 'Desiccated Coconut', 'topping', 13, '#fffaf0', t(1, 0, 1, 1, 0, 1)),
  extra('coconutchips', 'Coconut Chips', 'topping', 13, '#fbf4e4', t(1, 0, 1, 1, 0, 1)),
  extra('darkchoc', 'Dark Choc Chips', 'topping', 15, '#4a2a1a', t(1, 0, 0, 0, 0, 3)),
  extra('whitechoc', 'White Choc Chips', 'topping', 15, '#fbeecb', t(3, 0, 2, 0, 0, 1)),
  extra('ice', 'Ice', 'topping', 8, '#e6f6ff', t(0, 0, 0, 0, 2, 0)),
];

const BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));

export function ingredient(id: string): Ingredient {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown ingredient: ${id}`);
  return found;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  fruit: 'Fruit',
  nut: 'Nuts',
  seed: 'Seeds',
  liquid: 'Drinks',
  creamy: 'Creamy',
  sweet: 'Sweet',
  spice: 'Spice',
  boost: 'Boosts',
  green: 'Greens',
  topping: 'Mix-ins',
};
