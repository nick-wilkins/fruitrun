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
  hard: [4.7, 4.3, 3.9],
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
const EASE_OFF: Record<Difficulty, number> = { easy: 0.2, medium: 0.1, hard: 0 };

/**
 * How each difficulty drives. The easy ones are slow to react, steer gently, wander, let the marble run wide before
 * correcting and slip up often; the hard ones are sharper in every way, but still people.
 */
const MANNER: Record<Difficulty, { react: number; turn: number; drift: number; slack: number; slip: number; swing: number; far: number }> = {
  easy: { react: 0.42, turn: 2.6, drift: 1.0, slack: 0.9, slip: 0.08, swing: 0.05, far: 2.4 },
  medium: { react: 0.3, turn: 3.4, drift: 0.7, slack: 0.6, slip: 0.05, swing: 0.035, far: 2.0 },
  hard: { react: 0.22, turn: 4.8, drift: 0.35, slack: 0.3, slip: 0.02, swing: 0.02, far: 2.0 },
};

/**
 * The three rivals are three characters, at every difficulty, so a player comes to know them. Berry is steady:
 * smooth on the steering, leaves plenty of room, sees trouble early and rarely slips. Mango is bold: quick, sharp
 * turns, squeezes past with little room, dodges late, fond of a side road, and pays for it in mistakes. Plum is
 * a dreamer: slower to react, wanders about, and its pace comes and goes more than the others'.
 */
const CHARACTER = [
  { react: 1, turn: 0.85, drift: 0.6, slip: 0.6, swing: 0.7, fork: 0.2, side: 0, care: 1.25, sight: 1.6 },
  { react: 0.85, turn: 1.3, drift: 1, slip: 1.4, swing: 1, fork: 0.7, side: -1.1, care: 0.7, sight: 1.1 },
  { react: 1.2, turn: 0.9, drift: 1.5, slip: 1, swing: 1.6, fork: 0.4, side: 1.1, care: 1, sight: 1.2 },
];

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
      const manner = MANNER[difficulty];
      const character = CHARACTER[i];
      const driver: Driver = {
        line,
        speed: Math.min(1, handsFree[line] / target),
        easeOff: EASE_OFF[difficulty],
        react: manner.react * character.react,
        turn: manner.turn * character.turn,
        drift: manner.drift * character.drift,
        slack: manner.slack,
        slip: manner.slip * character.slip,
        swing: manner.swing * character.swing,
        fork: character.fork,
        far: manner.far,
        side: character.side,
        care: character.care,
        sight: character.sight,
        seed: level.n * 97 + i * 13 + 1,
      };
      // Going slower changes more than the pace: jumps fall short, bumpers are met at other moments. So try the
      // course, correct, and keep whichever try came nearest the time.
      let best = { ...driver };
      let nearest = Infinity;
      for (let tries = 0; tries < 8; tries++) {
        const time = raceTime(course, level, driver, i);
        if (!Number.isFinite(time)) break;
        const off = Math.abs(time - target) / target;
        if (off < nearest) {
          nearest = off;
          best = { ...driver };
        }
        if (off < 0.02) break;
        // Flat out and still behind its time: it has to drive better, so it keeps to the line, leaves the side
        // roads alone, concentrates harder and slips up less, a step at a time.
        if (driver.speed < 1 || time < target) driver.speed = Math.min(1, (driver.speed * time) / target);
        else if (driver.side) driver.side = 0;
        else if (driver.fork) driver.fork = 0;
        else if (driver.slip > 0.005) {
          driver.slip /= 2;
          driver.drift /= 2;
          driver.slack /= 2;
        } else break;
      }
      return best;
    });
    prepared.set(key, drivers);
  }
  return drivers;
}
