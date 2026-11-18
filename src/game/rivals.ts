import type { Difficulty } from '../core/race';
import type { Level } from '../data/levels';
import { courseFor, handsFreeFor, starTimesFor } from './courses';
import type { Course } from './course';
import { Sim, TICK, type Driver } from './sim';

/**
 * How good each of the three rivals is, on the same scale as the stars a run earns: a rival at 3.2 finishes a
 * little inside the three-star time. So a place in a race goes hand in hand with the stars for the same run.
 */
const FORM: Record<Difficulty, [number, number, number]> = {
  easy: [2.0, 1.6, 1.2],
  medium: [3.6, 3.2, 2.8],
  hard: [4.7, 4.3, 4.0],
};

/** Where across the road each marble starts a race: the three rivals, then the player. */
export const GRID = [-3.3, -1.1, 3.3, 1.1];

/**
 * How long rival number `index` takes when left to run its own race, started exactly as a race starts it: from
 * its place on the grid, after the countdown. The countdown matters: everything that swings or spins keeps moving
 * through it, so a rival meets it all at different moments than a run that skips straight to racing.
 */
export function raceTime(course: Course, level: Level, driver: Driver, index: number): number {
  const sim = new Sim(course, level, () => {}, () => 0);
  sim.driver = driver;
  sim.x = GRID[index] ?? 0;
  for (let step = 0; step < 600 / TICK && !sim.finished; step++) sim.step(TICK);
  return sim.finished ? sim.time : Infinity;
}

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
      // The careful line if that is quick enough; if neither is, whichever is the quicker here.
      const line = handsFree.smart <= target || handsFree.smart <= handsFree.ace ? 'smart' : 'ace';
      const driver: Driver = {
        line,
        pace: difficulty === 'easy' ? 0.8 : 1,
        speed: Math.min(1, handsFree[line] / target),
        wobble: difficulty === 'hard' ? 0.4 : 0.25,
        easeOff: EASE_OFF[difficulty],
        phase: level.n * 1.7 + i * 2.1,
        bias: [0, -1.2, 1.2][i],
      };
      // Going slower changes more than the pace: jumps fall short, bumpers are met at other moments. So try the
      // course, correct, and keep whichever try came nearest the time.
      let best = { ...driver };
      let nearest = Infinity;
      for (let tries = 0; tries < 6; tries++) {
        const time = raceTime(course, level, driver, i);
        if (!Number.isFinite(time)) break;
        const off = Math.abs(time - target) / target;
        if (off < nearest) {
          nearest = off;
          best = { ...driver };
        }
        if (off < 0.02) break;
        // Flat out and still behind its time: running wide of the best line, then wandering about it, is costing
        // too much, so give those up in turn.
        if (driver.speed < 1 || time < target) driver.speed = Math.min(1, (driver.speed * time) / target);
        else if (driver.bias) driver.bias = 0;
        else if (driver.wobble) driver.wobble = 0;
        else break;
      }
      return best;
    });
    prepared.set(key, drivers);
  }
  return drivers;
}
