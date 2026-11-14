import { describe, expect, it } from 'vitest';
import { blend, completeLevel, isUnlocked, newSave, starsForTime } from '../src/core/progress';
import { LEVELS, levelByNumber } from '../src/data/levels';
import { starTimesFor } from '../src/game/courses';

const level = LEVELS[0];
const starTimes = starTimesFor(level);

describe('starsForTime', () => {
  it('gives 5 for a fast run and never less than 1', () => {
    expect(starsForTime(level, starTimes[0] - 1)).toBe(5);
    expect(starsForTime(level, starTimes[1] - 0.1)).toBe(4);
    expect(starsForTime(level, 9999)).toBe(1);
  });
});

describe('completeLevel', () => {
  it('awards one fruit per star, banks pickups and unlocks the next level', () => {
    const save = newSave();
    const result = completeLevel(save, level, starTimes[0] - 1, ['chia', 'chia', 'honey']);
    expect(result.stars).toBe(5);
    expect(save.inventory[level.fruit]).toBe(5);
    expect(save.inventory.chia).toBe(2);
    expect(save.inventory.honey).toBe(1);
    expect(isUnlocked(save, LEVELS[1])).toBe(true);
    expect(isUnlocked(save, LEVELS[2])).toBe(false);
    expect(save.levels[level.id].stars).toBe(5);
  });

  it('keeps the best stars and time on a slower replay but still awards fruit', () => {
    const save = newSave();
    completeLevel(save, level, starTimes[0] - 1, []);
    const best = save.levels[level.id].time;
    completeLevel(save, level, 9999, []);
    expect(save.levels[level.id].stars).toBe(5);
    expect(save.levels[level.id].time).toBe(best);
    expect(save.inventory[level.fruit]).toBe(6);
  });
});

describe('the map', () => {
  const byNumber = levelByNumber;

  it('starts with only level 1 open', () => {
    const save = newSave();
    expect(LEVELS.filter((l) => isUnlocked(save, l)).map((l) => l.n)).toEqual([1]);
  });

  it('offers three ways on after level 4, as the paths on the map do', () => {
    const save = newSave();
    for (const n of [1, 2, 3, 4]) completeLevel(save, byNumber(n), 9999, []);
    const open = LEVELS.filter((l) => isUnlocked(save, l) && !save.levels[l.id]).map((l) => l.n);
    expect(open).toEqual([5, 6, 13]);
  });

  it('follows each branch on its own', () => {
    const save = newSave();
    for (const n of [1, 2, 3, 4, 13]) completeLevel(save, byNumber(n), 9999, []);
    expect(isUnlocked(save, byNumber(14))).toBe(true);
    expect(isUnlocked(save, byNumber(7))).toBe(false);
    expect(isUnlocked(save, byNumber(10))).toBe(false);
  });
});

describe('worlds', () => {
  const byNumber = levelByNumber;

  it('opens the second world from the castle and the third from the portal', () => {
    const save = newSave();
    expect(isUnlocked(save, byNumber(19))).toBe(false);
    save.levels[byNumber(18).id] = { stars: 1, time: 99 };
    expect(isUnlocked(save, byNumber(19))).toBe(true);
    expect(isUnlocked(save, byNumber(40))).toBe(false);
    save.levels[byNumber(32).id] = { stars: 1, time: 99 };
    expect(isUnlocked(save, byNumber(40))).toBe(true);
  });

  it('gives every level a way in from a level that exists', () => {
    for (const level of LEVELS.slice(1)) {
      expect(level.after.length, level.id).toBeGreaterThan(0);
      for (const n of level.after) expect(() => byNumber(n), `${level.id} after ${n}`).not.toThrow();
    }
  });
});

describe('old saves', () => {
  it('lets the first run on a re-laid course replace a best time set on the old layout', () => {
    const save = newSave();
    save.levels[level.id] = { stars: 5, time: 10 };
    const result = completeLevel(save, level, 50, []);
    expect(result.newBest).toBe(true);
    expect(save.levels[level.id].time).toBe(50);
    expect(save.levels[level.id].stars).toBe(5);
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
