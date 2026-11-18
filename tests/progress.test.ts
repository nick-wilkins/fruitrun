import { describe, expect, it } from 'vitest';
import { blend, clearSave, completeLevel, isUnlocked, keepSavesIn, newSave, readSave, starsForTime, storeSave, superBlenderOpen, type Save, type SaveStore } from '../src/core/progress';
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

/** Finish a level fast enough for five stars. */
const pass = (save: Save, n: number) => completeLevel(save, levelByNumber(n), starTimesFor(levelByNumber(n))[0] - 1, []);

describe('the map', () => {
  const byNumber = levelByNumber;

  it('starts with only level 1 open', () => {
    const save = newSave();
    expect(LEVELS.filter((l) => isUnlocked(save, l)).map((l) => l.n)).toEqual([1]);
  });

  it('offers three ways on after level 4, as the paths on the map do', () => {
    const save = newSave();
    for (const n of [1, 2, 3, 4]) pass(save, n);
    const open = LEVELS.filter((l) => isUnlocked(save, l) && !save.levels[l.id]).map((l) => l.n);
    expect(open).toEqual([5, 6, 13]);
  });

  it('follows each branch on its own', () => {
    const save = newSave();
    for (const n of [1, 2, 3, 4, 13]) pass(save, n);
    expect(isUnlocked(save, byNumber(14))).toBe(true);
    expect(isUnlocked(save, byNumber(7))).toBe(false);
    expect(isUnlocked(save, byNumber(10))).toBe(false);
  });
});

describe('stars needed to move on', () => {
  const byNumber = levelByNumber;

  it('keeps the next level shut until this one has enough stars, and says how many', () => {
    const save = newSave();
    const first = byNumber(1);
    const slow = completeLevel(save, first, 9999, []);
    expect(slow.stars).toBe(1);
    expect(slow.need).toBe(first.need);
    expect(slow.passed).toBe(false);
    expect(slow.opened).toEqual([]);
    expect(isUnlocked(save, byNumber(2))).toBe(false);

    const quick = completeLevel(save, first, starTimesFor(first)[0] - 1, []);
    expect(quick.passed).toBe(true);
    expect(quick.opened.map((l) => l.n)).toEqual([2]);
    expect(isUnlocked(save, byNumber(2))).toBe(true);
    // Passing again opens nothing new.
    expect(completeLevel(save, first, starTimesFor(first)[0] - 1, []).opened).toEqual([]);
  });

  it('asks for two or three early on, four sometimes, and five now and again near the end of a world', () => {
    for (let world = 0; world < 3; world++) {
      const needs = LEVELS.filter((l) => l.world === world).map((l) => l.need);
      expect(Math.min(...needs)).toBe(2 + Math.min(world, 1));
      expect(needs.slice(0, 3).every((n) => n <= 3)).toBe(true);
      expect(needs).toContain(4);
      expect(needs.filter((n) => n === 5).length).toBeGreaterThanOrEqual(1);
      expect(needs.filter((n) => n === 5).length).toBeLessThanOrEqual(4);
    }
    // It goes up and down rather than climbing steadily.
    const meadow = LEVELS.filter((l) => l.world === 0).map((l) => l.need);
    expect(meadow.some((n, i) => i > 0 && n < meadow[i - 1])).toBe(true);
  });

  it('never locks a level that has already been played', () => {
    const save = newSave();
    save.levels[byNumber(1).id] = { stars: 1, time: 99 };
    save.levels[byNumber(2).id] = { stars: 1, time: 99 };
    expect(isUnlocked(save, byNumber(2))).toBe(true);
    expect(isUnlocked(save, byNumber(3))).toBe(false);
  });
});

describe('worlds', () => {
  const byNumber = levelByNumber;

  it('opens the second world from the castle and the third from the portal', () => {
    const save = newSave();
    expect(isUnlocked(save, byNumber(19))).toBe(false);
    save.levels[byNumber(18).id] = { stars: byNumber(18).need - 1, time: 99 };
    expect(isUnlocked(save, byNumber(19))).toBe(false);
    save.levels[byNumber(18).id] = { stars: byNumber(18).need, time: 99 };
    expect(isUnlocked(save, byNumber(19))).toBe(true);
    expect(isUnlocked(save, byNumber(40))).toBe(false);
    save.levels[byNumber(32).id] = { stars: 5, time: 99 };
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

describe('the smoothie book', () => {
  it('remembers every ingredient ever collected, even after it is blended away', () => {
    const save = newSave();
    completeLevel(save, level, 9999, ['chia', 'honey', 'chia']);
    blend(save, ['chia', 'honey']);
    expect([...save.seen].sort()).toEqual([level.fruit, 'chia', 'honey'].sort());
  });

  it('keeps a history of smoothies, newest first, and counts each rating', () => {
    const save = newSave();
    save.inventory = { apple: 5, cinnamon: 3 };
    const first = blend(save, ['cinnamon', 'cinnamon', 'cinnamon']);
    const second = blend(save, ['apple', 'apple']);
    expect(save.history.map((h) => h.name)).toEqual([second.name, first.name]);
    expect(save.ratings[first.rating - 1]).toBeGreaterThanOrEqual(1);
    expect(save.ratings.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('remembers what went into each smoothie, so the book can show it', () => {
    const save = newSave();
    save.inventory = { apple: 2, honey: 1 };
    blend(save, ['apple', 'honey', 'apple']);
    expect(save.history[0].items).toEqual(['apple', 'honey', 'apple']);
  });

  it('opens the super blender once the path to it is finished', () => {
    const save = newSave();
    expect(superBlenderOpen(save)).toBe(false);
    save.levels['level-14'] = { stars: 1, time: 99 };
    expect(superBlenderOpen(save)).toBe(true);
  });

  it('lets the super blender take twenty', () => {
    const save = newSave();
    save.inventory = { apple: 20 };
    blend(save, Array.from({ length: 20 }, () => 'apple'), 20);
    expect(save.inventory.apple).toBeUndefined();
    expect(save.history[0].big).toBe(true);
  });
});

describe('keeping the save', () => {
  const memoryStore = () => {
    let kept: string | null = null;
    const store: SaveStore = {
      get: async () => kept,
      set: async (value) => void (kept = value),
      remove: async () => void (kept = null),
    };
    return store;
  };

  it('reads back what was stored', async () => {
    const store = memoryStore();
    keepSavesIn(store);
    storeSave({ ...newSave(), points: 70 });
    expect(readSave(await store.get())?.points).toBe(70);
  });

  it('forgets the save when the game is started again', async () => {
    const store = memoryStore();
    keepSavesIn(store);
    storeSave({ ...newSave(), points: 70 });
    clearSave();
    expect(await store.get()).toBeNull();
  });

  it('carries on playing when the store fails', () => {
    keepSavesIn({ get: async () => null, set: () => Promise.reject(new Error('full')), remove: () => { throw new Error('gone'); } });
    expect(() => storeSave(newSave())).not.toThrow();
    expect(() => clearSave()).not.toThrow();
  });

  it('starts fresh when nothing is stored or it cannot be read', () => {
    expect(readSave(null)).toBeNull();
    expect(readSave('{"version":1,"poi')).toBeNull();
  });
});
