import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMBOS } from '../src/core/smoothie';
import { INGREDIENTS, ingredient } from '../src/data/ingredients';
import { LEVELS } from '../src/data/levels';

describe('game data', () => {
  it('has an icon file for every ingredient', () => {
    for (const item of INGREDIENTS) expect(existsSync(`public/${item.img}`), item.id).toBe(true);
  });

  it('only references real ingredients in combos and levels', () => {
    const ids = COMBOS.flatMap((c) => [...(c.needs ?? []).flat(), ...(c.distinct?.pool ?? [])]);
    for (const id of [...ids, ...LEVELS.flatMap((l) => [l.fruit, ...l.bonusPool])]) expect(() => ingredient(id)).not.toThrow();
  });
});
