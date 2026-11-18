import { describe, expect, it } from 'vitest';
import { completeLevel, newSave } from '../src/core/progress';
import { finishingOrder, podiumFruit, RIVALS } from '../src/core/race';
import { LEVELS } from '../src/data/levels';
import { courseFor, starTimesFor } from '../src/game/courses';
import { rivalDrivers, rivalTargets } from '../src/game/rivals';
import { timeCourse, type Driver } from '../src/game/sim';

const sample = [LEVELS[0], LEVELS[6], LEVELS[29]];

describe('star times', () => {
  it('have not moved now that the hands-free drivers can be held back', () => {
    expect(sample.map((level) => starTimesFor(level))).toEqual([
      [37, 42, 47, 52],
      [52, 55, 58, 61],
      [63, 69, 76, 82],
    ]);
  });

  it('come from drivers that a rival with nothing held back matches exactly', () => {
    for (const line of ['smart', 'ace'] as const) {
      const flatOut: Driver = { line, pace: 1, speed: 1, wobble: 0, easeOff: 0, phase: 0 };
      expect(timeCourse(courseFor(sample[1]), sample[1], flatOut)).toBe(timeCourse(courseFor(sample[1]), sample[1], line));
    }
  });
});

describe('rivals', () => {
  it.each(LEVELS)('all reach the line on $name at every difficulty, near the time set for them', (level) => {
    const course = courseFor(level);
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const targets = rivalTargets(level, difficulty);
      rivalDrivers(level, difficulty).forEach((driver, i) => {
        const time = timeCourse(course, level, driver);
        expect(time, `${difficulty} rival ${i}`).toBeLessThan(Infinity);
        expect(Math.abs(time - targets[i]) / targets[i], `${difficulty} rival ${i}: ${time.toFixed(1)}s against ${targets[i].toFixed(1)}s`).toBeLessThan(0.12);
      });
    }
  });

  it('are slowest on easy and quickest on hard', () => {
    for (const level of sample) {
      const best = (difficulty: 'easy' | 'medium' | 'hard') => Math.min(...rivalDrivers(level, difficulty).map((driver) => timeCourse(courseFor(level), level, driver)));
      expect(best('easy')).toBeGreaterThan(best('medium'));
      expect(best('medium')).toBeGreaterThan(best('hard'));
    }
  });

  it('on hard can only be beaten by a four or five star run, and on easy lose to a two star one', () => {
    for (const level of sample) {
      const [, four, , two] = starTimesFor(level);
      expect(Math.min(...rivalTargets(level, 'hard'))).toBeLessThanOrEqual(four);
      expect(Math.min(...rivalTargets(level, 'easy'))).toBeGreaterThanOrEqual(two);
    }
  });

  it('drive the same race every time', () => {
    const level = sample[2];
    const [driver] = rivalDrivers(level, 'hard');
    expect(timeCourse(courseFor(level), level, driver)).toBe(timeCourse(courseFor(level), level, driver));
  });
});

describe('finishing a race', () => {
  const rivals = (times: number[]) => RIVALS.map((rival, i) => ({ ...rival, time: times[i] }));

  it('puts everyone in order of their own time', () => {
    const order = finishingOrder(50, rivals([48, 55, 60]));
    expect(order.map((row) => row.name)).toEqual([RIVALS[0].name, 'You', RIVALS[1].name, RIVALS[2].name]);
    expect(order.findIndex((row) => row.you) + 1).toBe(2);
  });

  it('gives a dead heat to the player', () => {
    expect(finishingOrder(50, rivals([50, 55, 60]))[0].you).toBe(true);
  });

  it('pays three, two and one extra fruit down the podium and nothing for fourth', () => {
    expect([1, 2, 3, 4].map(podiumFruit)).toEqual([3, 2, 1, 0]);
  });

  it('banks the podium fruit on top of the fruit the stars give', () => {
    const level = LEVELS[0];
    const fast = starTimesFor(level)[0] - 1;
    const alone = completeLevel(newSave(), level, fast, []);
    const save = newSave();
    const raced = completeLevel(save, level, fast, [], undefined, 1);
    expect(raced.stars).toBe(alone.stars);
    expect(raced.fruits).toBe(alone.fruits + 3);
    expect(raced.podium).toBe(3);
    expect(save.inventory[level.fruit]).toBe(alone.fruits + 3);
    expect(save.stats.races).toBe(1);
    expect(save.stats.raceWins).toBe(1);
  });

  it('counts a race lost without a win, and pays no podium fruit for fourth', () => {
    const level = LEVELS[0];
    const save = newSave();
    const raced = completeLevel(save, level, 9999, [], undefined, 4);
    expect(raced.podium).toBe(0);
    expect(raced.fruits).toBe(1);
    expect(save.stats.races).toBe(1);
    expect(save.stats.raceWins).toBeUndefined();
  });
});
