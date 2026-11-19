import { describe, expect, it } from 'vitest';
import { completeLevel, newSave } from '../src/core/progress';
import { finishingOrder, podiumFruit, RIVALS, type Difficulty } from '../src/core/race';
import { LEVELS } from '../src/data/levels';
import { courseFor, starTimesFor } from '../src/game/courses';
import { fieldTimes, rivalDrivers, rivalTargets } from '../src/game/rivals';
import { raceAgainst, type Outcome, type StandIn } from './field';

const sample = [LEVELS[0], LEVELS[6], LEVELS[29]];

describe('star times', () => {
  it('have not moved now that the hands-free drivers can be held back', () => {
    expect(sample.map((level) => starTimesFor(level))).toEqual([
      [37, 42, 47, 52],
      [52, 55, 58, 61],
      [63, 69, 76, 82],
    ]);
  });
});

describe('rivals', () => {
  // The time set for a rival is a guide: what it would do driving exactly to its level. Driving like a person, with
  // wandering and mistakes, in among the others, it comes in somewhere near, and the placings are what matter.
  it.each(LEVELS)('all reach the line on $name at every difficulty, within a quarter of the time set as their guide', (level) => {
    const course = courseFor(level);
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const targets = rivalTargets(level, difficulty);
      fieldTimes(course, level, rivalDrivers(level, difficulty)).forEach((time, i) => {
        expect(time, `${difficulty} rival ${i}`).toBeLessThan(Infinity);
        expect(Math.abs(time - targets[i]) / targets[i], `${difficulty} rival ${i}: ${time.toFixed(1)}s against ${targets[i].toFixed(1)}s`).toBeLessThan(0.25);
      });
    }
  });

  it('are slowest on easy and quickest on hard', () => {
    for (const level of sample) {
      const best = (difficulty: 'easy' | 'medium' | 'hard') => Math.min(...fieldTimes(courseFor(level), level, rivalDrivers(level, difficulty)));
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
    const drivers = rivalDrivers(level, 'hard');
    expect(fieldTimes(courseFor(level), level, drivers)).toEqual(fieldTimes(courseFor(level), level, drivers));
  });
});

// Whole races against stand-ins for players of different ability, over a spread of levels. These pin how hard each
// difficulty is; the numbers behind them are in docs/superpowers/2026-11-18-ios-phase-2-ai-races.md.
describe('how hard the rivals are', () => {
  const spread = [1, 3, 7, 15, 30, 45, 60].map((n) => LEVELS[n - 1]);
  const races = (difficulty: Difficulty, standIn: StandIn) => spread.map((level) => raceAgainst(level, difficulty, standIn));
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const margins = (outcomes: Outcome[]) => outcomes.map((outcome) => outcome.margin);
  const count = (outcomes: Outcome[], test: (outcome: Outcome) => boolean) => outcomes.filter(test).length;

  it('on hard, the expert line only just wins, where it wins at all', () => {
    const ace = margins(races('hard', 'ace'));
    expect(mean(ace)).toBeLessThan(3);
    expect(Math.max(...ace)).toBeLessThan(5);
  });

  it('on hard, the careful hands-free line does not come out ahead of the leader', () => {
    expect(mean(margins(races('hard', 'smart')))).toBeLessThan(1);
  });

  it('on hard, a decent player is off the podium more often than on it, and one who misses the speed pads is last by a distance', () => {
    expect(count(races('hard', 'steady'), (outcome) => outcome.place === 4)).toBeGreaterThanOrEqual(4);
    const misser = races('hard', 'misser');
    expect(misser.map((outcome) => outcome.place)).toEqual(spread.map(() => 4));
    expect(mean(margins(misser))).toBeLessThan(-8);
  });

  it('on medium, a decent player is in a close fight for the podium, and missing the speed pads loses it', () => {
    const steady = races('medium', 'steady');
    expect(count(steady, (outcome) => outcome.place <= 3)).toBeGreaterThanOrEqual(6);
    expect(mean(margins(steady).map(Math.abs))).toBeLessThan(4);
    const misser = races('medium', 'misser');
    expect(count(misser, (outcome) => outcome.place >= 3)).toBeGreaterThanOrEqual(4);
    expect(mean(margins(misser))).toBeLessThan(-3);
  });

  it('on easy, a young child is on the podium nearly every time, and nobody is left far behind', () => {
    const kid = races('easy', 'kid');
    expect(count(kid, (outcome) => outcome.place <= 3)).toBeGreaterThanOrEqual(6);
    expect(Math.min(...margins(kid))).toBeGreaterThan(-10);
    expect(Math.min(...margins(races('easy', 'none')))).toBeGreaterThan(-10);
  });

  it('comes from how the rivals drive, not from a quicker or slower marble', () => {
    for (const level of spread) for (const difficulty of ['medium', 'hard'] as const) expect(rivalDrivers(level, difficulty).map((driver) => driver.speed)).toEqual([1, 1, 1]);
    const hits = (difficulty: Difficulty) => mean(races(difficulty, 'smart').flatMap((outcome) => outcome.hits));
    expect(hits('hard')).toBeLessThan(hits('medium') / 2);
    expect(hits('medium')).toBeLessThan(hits('easy'));
  });
});

// Legendary is for an adult who knows the game: the expert hands-free line, which wins on hard, is beaten here.
describe('how hard the legendary rivals are', () => {
  const spread = [1, 3, 7, 15, 30, 45, 60].map((n) => LEVELS[n - 1]);
  const races = (standIn: StandIn) => spread.map((level) => raceAgainst(level, 'legendary', standIn));
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const margins = (outcomes: Outcome[]) => outcomes.map((outcome) => outcome.margin);

  it('the expert line loses more often than it wins, and never wins by much', () => {
    const ace = races('ace');
    expect(ace.filter((outcome) => outcome.place > 1).length).toBeGreaterThanOrEqual(4);
    expect(mean(margins(ace))).toBeLessThan(0);
    expect(Math.max(...margins(ace))).toBeLessThan(1.5);
  });

  it('the careful line and a decent player are left well behind', () => {
    const smart = races('smart');
    expect(smart.filter((outcome) => outcome.place >= 3).length).toBeGreaterThanOrEqual(6);
    expect(mean(margins(smart))).toBeLessThan(-2);
    const steady = races('steady');
    expect(steady.map((outcome) => outcome.place)).toEqual(spread.map(() => 4));
    expect(mean(margins(steady))).toBeLessThan(-6);
  });

  it('they are quicker than the hard ones on the same marble, and never wait', () => {
    for (const level of spread) {
      const drivers = rivalDrivers(level, 'legendary');
      expect(drivers.map((driver) => [driver.speed, driver.easeOff])).toEqual([[1, 0], [1, 0], [1, 0]]);
      const first = (difficulty: Difficulty) => Math.min(...fieldTimes(courseFor(level), level, rivalDrivers(level, difficulty)));
      expect(first('legendary')).toBeLessThan(first('hard'));
    }
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
