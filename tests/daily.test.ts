import { describe, expect, it } from 'vitest';
import { dailyLevel } from '../src/core/daily';
import { LEVELS } from '../src/data/levels';

const day = (n: number, hour = 12) => new Date(2026, 10, 23 + n, hour);

describe('the level of the day', () => {
  it('is the same from the first minute of a day to the last', () => {
    expect(dailyLevel(new Date(2026, 10, 23, 0, 1)).id).toBe(dailyLevel(new Date(2026, 10, 23, 23, 59)).id);
  });

  it('changes at midnight', () => {
    expect(dailyLevel(new Date(2026, 10, 24, 0, 1)).id).not.toBe(dailyLevel(new Date(2026, 10, 23, 23, 59)).id);
  });

  it('goes through every level of the first world, and only those, before coming round again', () => {
    const first = LEVELS.filter((level) => level.world === 0).map((level) => level.id);
    const shown = first.map((_, i) => dailyLevel(day(i)).id);
    expect([...shown].sort()).toEqual([...first].sort());
    expect(dailyLevel(day(first.length)).id).toBe(shown[0]);
  });

  it('keeps to one a day across a change of the clocks', () => {
    const march = Array.from({ length: 4 }, (_, i) => dailyLevel(new Date(2027, 2, 27 + i, 12)).id);
    expect(new Set(march).size).toBe(4);
  });
});
