import { describe, expect, it } from 'vitest';
import { blend, completeLevel, newSave, starsForTime } from '../src/core/progress';
import { LEVELS } from '../src/data/levels';
import { courseFor } from '../src/game/courses';

const level = LEVELS[0];
courseFor(level);

describe('starsForTime', () => {
  it('gives 5 for a fast run and never less than 1', () => {
    expect(starsForTime(level, level.starTimes[0] - 1)).toBe(5);
    expect(starsForTime(level, level.starTimes[1] - 0.1)).toBe(4);
    expect(starsForTime(level, 9999)).toBe(1);
  });
});

describe('completeLevel', () => {
  it('awards one fruit per star, banks pickups and unlocks the next level', () => {
    const save = newSave();
    const result = completeLevel(save, level, level.starTimes[0] - 1, ['chia', 'chia', 'honey']);
    expect(result.stars).toBe(5);
    expect(save.inventory[level.fruit]).toBe(5);
    expect(save.inventory.chia).toBe(2);
    expect(save.inventory.honey).toBe(1);
    expect(save.unlocked).toBe(2);
    expect(save.levels[level.id].stars).toBe(5);
  });

  it('keeps the best stars and time on a slower replay but still awards fruit', () => {
    const save = newSave();
    completeLevel(save, level, level.starTimes[0] - 1, []);
    const best = save.levels[level.id].time;
    completeLevel(save, level, 9999, []);
    expect(save.levels[level.id].stars).toBe(5);
    expect(save.levels[level.id].time).toBe(best);
    expect(save.inventory[level.fruit]).toBe(6);
  });
});

describe('blend', () => {
  it('uses up the ingredients and banks the points', () => {
    const save = newSave();
    save.inventory = { apple: 3, oats: 1 };
    const result = blend(save, ['apple', 'apple', 'oats']);
    expect(save.inventory.apple).toBe(1);
    expect(save.inventory.oats).toBeUndefined();
    expect(save.points).toBe(result.points);
    expect(save.smoothies).toBe(1);
  });

  it('refuses ingredients the player does not have', () => {
    const save = newSave();
    save.inventory = { apple: 1 };
    expect(() => blend(save, ['apple', 'apple'])).toThrow();
    expect(save.inventory.apple).toBe(1);
  });
});
