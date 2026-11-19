import type { Difficulty } from '../core/race';
import type { Level } from '../data/levels';
import { courseFor, starTimesFor } from './courses';
import type { Course } from './course';
import { jostle } from './contact';
import { Sim, TICK, type Driver } from './sim';

/**
 * How good each of the three rivals is, on the same scale as the stars a run earns: a rival at 3.2 finishes a
 * little inside the three-star time. So a place in a race goes hand in hand with the stars for the same run. The
 * hard ones are set times that only an expert's run matches, which leaves them driving as well as they are able.
 */
const FORM: Record<Difficulty, [number, number, number]> = {
  easy: [2.0, 1.5, 0.9],
  medium: [3.6, 3.2, 2.8],
  hard: [4.9, 4.6, 4.3],
};

/** Where across the road each marble starts a race: the three rivals, then the player. */
export const GRID = [-3.3, -1.1, 3.3, 1.1];

/**
 * How long each rival takes in a race like the real thing: the three of them and a careful hands-free marble in the
 * player's place, from the grid, after the countdown, on one course, bumping and sharing its crates. The countdown
 * matters: everything that swings or spins keeps moving through it.
 */
export function fieldTimes(course: Course, level: Level, drivers: Driver[]): number[] {
  const sims = drivers.map((driver, i) => {
    const sim = new Sim(course, level, () => {}, () => 0);
    sim.driver = driver;
    sim.x = GRID[i] ?? 0;
    return sim;
  });
  const player = new Sim(course, level, () => {}, () => 0);
  player.autopilot = 'smart';
  player.x = GRID[3];
  const all = [player, ...sims];
  sims.forEach((sim) => {
    sim.shareWith(player);
    sim.traffic = () => all.filter((other) => other !== sim);
  });
  for (let step = 0; step < 600 / TICK && sims.some((sim) => !sim.finished); step++) {
    for (const sim of all) if (!sim.finished) sim.step(TICK);
    jostle(all.filter((sim) => !sim.finished));
  }
  return sims.map((sim) => (sim.finished ? sim.time : Infinity));
}

/** How much a rival slows, at most, when well ahead of the player. The hard ones never wait. */
const EASE_OFF: Record<Difficulty, number> = { easy: 0.25, medium: 0.1, hard: 0 };

/**
 * How each difficulty drives. The easy ones are slow to react, have unhurried hands, read only a little of the road
 * ahead, misjudge what swings, wander even with something to aim for, take a side road on a whim and slip up
 * often. The hard ones read well ahead, have quick sure hands, judge a moving gap, tighten up when it matters, know
 * which side roads are short cuts and rarely slip: sharper in every way, but still people.
 */
const MANNER: Record<Difficulty, Pick<Driver, 'react' | 'turn' | 'quick' | 'drift' | 'slack' | 'slip' | 'swing' | 'ahead' | 'foresee' | 'loose' | 'wise'>> = {
  easy: { react: 0.42, turn: 3.4, quick: 8, drift: 1.0, slack: 0.9, slip: 0.06, swing: 0.05, ahead: 1.2, foresee: 0.3, loose: 0.7, wise: 0 },
  medium: { react: 0.3, turn: 5, quick: 10, drift: 0.7, slack: 0.6, slip: 0.04, swing: 0.035, ahead: 1.6, foresee: 0.6, loose: 0.5, wise: 0.4 },
  hard: { react: 0.2, turn: 12, quick: 16, drift: 0.35, slack: 0.3, slip: 0.008, swing: 0.02, ahead: 2.2, foresee: 1, loose: 0.25, wise: 0.9 },
};

/** The driver sent round to learn a course: a sharp one with no character, that goes where it is told at a fork. */
const SCOUT: Driver = { speed: 1, easeOff: 0, react: 0.2, turn: 12, quick: 16, drift: 0, slack: 0.3, slip: 0, swing: 0, fork: 0, wise: 1, roads: [], ahead: 2.2, keen: 1, foresee: 1, loose: 0.25, side: 0, care: 1, sight: 1.2, seed: 1 };

/** How keen on the speed pads each difficulty is to begin with, before being set to its time. */
const KEEN: Record<Difficulty, number> = { easy: 0.5, medium: 0.75, hard: 1 };

/**
 * The three rivals are three characters, at every difficulty, so a player comes to know them. Berry is steady:
 * smooth on the steering, leaves plenty of room, sees trouble early and rarely slips. Mango is bold: quick, sharp
 * turns, squeezes past with little room, dodges late, fond of a side road, and pays for it in mistakes. Plum is
 * a dreamer: slower to react, wanders about, and its pace comes and goes more than the others'.
 */
const CHARACTER = [
  { react: 1, turn: 0.92, drift: 0.6, slip: 0.6, swing: 0.7, fork: 0.2, side: 0, care: 1.25, sight: 1.3 },
  { react: 0.85, turn: 1.2, drift: 1, slip: 1.4, swing: 1, fork: 0.7, side: -1.1, care: 0.7, sight: 0.9 },
  { react: 1.2, turn: 0.95, drift: 1.5, slip: 1, swing: 1.6, fork: 0.4, side: 1.1, care: 1, sight: 1 },
];

/** The finish time each rival is set, if left to run its own race. */
export function rivalTargets(level: Level, difficulty: Difficulty): number[] {
  const [five, , , two] = starTimesFor(level);
  const perStar = (two - five) / 3;
  return FORM[difficulty].map((form) => five + (5 - form) * perStar);
}

const prepared = new Map<string, Driver[]>();
const shortCuts = new Map<string, number[]>();

/**
 * The seconds each side road of a level saves, by lane: found by sending one good driver round on its own, first
 * keeping to the main road and then taking each side road in turn.
 */
function sideRoads(level: Level): number[] {
  let saves = shortCuts.get(level.id);
  if (!saves) {
    const course = courseFor(level);
    const scout = (roads: number[]): number => {
      const sim = new Sim(course, level, () => {}, () => 0);
      sim.driver = { ...SCOUT, roads, seed: level.n * 97 };
      for (let step = 0; step < 600 / TICK && !sim.finished; step++) sim.step(TICK);
      return sim.finished ? sim.time : Infinity;
    };
    // Told to keep off every side road: left to itself it would fancy one now and then, and spoil the comparison.
    const main = course.lanes.length > 1 ? scout(course.lanes.map(() => -9)) : 0;
    saves = course.lanes.map((_, lane) => (lane ? main - scout(course.lanes.map((__, other) => (other === lane ? 9 : -9))) : 0));
    shortCuts.set(level.id, saves);
  }
  return saves;
}

/**
 * The three rivals for a level, worked out once. What sets a rival to its time is how it drives, not how fast its
 * marble is: one with time in hand goes out of its way for fewer of the speed pads, one that is behind hunts them,
 * then tidies up its driving. Only a rival still too quick while taking next to nothing is held back on speed.
 */
export function rivalDrivers(level: Level, difficulty: Difficulty): Driver[] {
  const key = `${level.id}:${difficulty}`;
  let drivers = prepared.get(key);
  if (!drivers) {
    const course = courseFor(level);
    const targets = rivalTargets(level, difficulty);
    const manner = MANNER[difficulty];
    const roads = sideRoads(level);
    const trying: Driver[] = CHARACTER.map((character, i) => ({
      speed: 1,
      easeOff: EASE_OFF[difficulty],
      react: manner.react * character.react,
      turn: manner.turn * character.turn,
      quick: manner.quick,
      drift: manner.drift * character.drift,
      slack: manner.slack,
      slip: manner.slip * character.slip,
      swing: manner.swing * character.swing,
      fork: character.fork,
      wise: manner.wise,
      roads,
      ahead: manner.ahead * character.sight,
      keen: KEEN[difficulty],
      foresee: manner.foresee,
      loose: manner.loose,
      side: character.side,
      care: character.care,
      sight: 1.2 * character.sight,
      seed: level.n * 97 + i * 13 + 1,
    }));
    // The three are set together, racing one another, since each is in the others' way. How keen each is closes
    // in on what brings it home on time; the try that left them nearest overall is kept.
    const least = [0, 0, 0];
    const most = [1, 1, 1];
    const tidied = [0, 0, 0];
    let nearest = Infinity;
    for (let tries = 0; tries < 6; tries++) {
      const times = fieldTimes(course, level, trying);
      if (times.some((time) => !Number.isFinite(time))) break;
      const off = times.reduce((sum, time, i) => sum + Math.abs(time - targets[i]) / targets[i], 0);
      if (off < nearest) {
        nearest = off;
        drivers = trying.map((driver) => ({ ...driver }));
      }
      if (off < 0.04) break;
      let settled = true;
      trying.forEach((driver, i) => {
        const late = times[i] > targets[i];
        if (late) least[i] = driver.keen;
        else most[i] = driver.keen;
        if (late && driver.keen > 0.97) {
          // Hunting every pad and still behind its time: it has to drive better. It gives up running to its
          // favourite side, then concentrates harder; past that it is as quick as its character allows.
          if (tidied[i] < 2) settled = false;
          if (tidied[i] === 0) driver.side = 0;
          else if (tidied[i] === 1) {
            driver.slip /= 2;
            driver.drift /= 2;
          }
          tidied[i]++;
          // A tidier driver is a different driver: what was learnt about how keen it needs to be no longer holds.
          least[i] = 0;
          most[i] = 1;
          return;
        } else if (!late && driver.keen < 0.15) {
          // Taking next to nothing and still too quick: only now is its marble itself held back.
          const speed = Math.max(0.8, (driver.speed * times[i]) / targets[i]);
          if (driver.speed - speed > 0.01) settled = false;
          if (driver.speed - speed > 0.01) {
            least[i] = 0;
            most[i] = 1;
            driver.speed = speed;
            return;
          }
        } else if (most[i] - least[i] > 0.06) settled = false;
        driver.keen = (least[i] + most[i]) / 2;
      });
      if (settled) break;
    }
    drivers ??= trying;
    prepared.set(key, drivers);
  }
  return drivers;
}
