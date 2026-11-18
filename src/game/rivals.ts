import type { Difficulty } from '../core/race';
import type { Level } from '../data/levels';
import { courseFor, handsFreeFor, starTimesFor } from './courses';
import { timeCourse, type Driver } from './sim';

/**
 * How good each of the three rivals is, on the same scale as the stars a run earns: a rival at 3.2 finishes a
 * little inside the three-star time. So a place in a race goes hand in hand with the stars for the same run.
 */
const FORM: Record<Difficulty, [number, number, number]> = {
  easy: [2.0, 1.6, 1.2],
  medium: [3.6, 3.2, 2.8],
  hard: [4.7, 4.3, 4.0],
};

/** How much a rival slows, at most, when well ahead of the player. The hard ones never wait. */
const EASE_OFF: Record<Difficulty, number> = { easy: 0.3, medium: 0.15, hard: 0 };

/** The finish time each rival is set, if left to run its own race. */
export function rivalTargets(level: Level, difficulty: Difficulty): number[] {
  const [five, , , two] = starTimesFor(level);
  const perStar = (two - five) / 3;
  return FORM[difficulty].map((form) => five + (5 - form) * perStar);
}

const prepared = new Map<string, Driver[]>();

/**
 * The three rivals for a level, worked out once. Each takes the careful line if that is quick enough for its
 * time, the expert's if not, and uses just enough of its speed to come home on that time.
 */
export function rivalDrivers(level: Level, difficulty: Difficulty): Driver[] {
  const key = `${level.id}:${difficulty}`;
  let drivers = prepared.get(key);
  if (!drivers) {
    const handsFree = handsFreeFor(level);
    const course = courseFor(level);
    drivers = rivalTargets(level, difficulty).map((target, i) => {
      const line = handsFree.smart <= target ? 'smart' : 'ace';
      const driver: Driver = {
        line,
        pace: difficulty === 'easy' ? 0.8 : 1,
        speed: Math.min(1, handsFree[line] / target),
        wobble: difficulty === 'hard' ? 0.4 : 0.25,
        easeOff: EASE_OFF[difficulty],
        phase: level.n * 1.7 + i * 2.1,
      };
      // Going slower changes more than the pace: jumps fall short, bumpers are met at other moments. So try the
      // course and correct the speed until the time is right.
      for (let tries = 0; tries < 3; tries++) {
        const time = timeCourse(course, level, driver);
        if (!Number.isFinite(time) || Math.abs(time - target) / target < 0.02) break;
        driver.speed = Math.min(1, (driver.speed * time) / target);
      }
      return driver;
    });
    prepared.set(key, drivers);
  }
  return drivers;
}
