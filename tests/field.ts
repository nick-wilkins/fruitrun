import type { Difficulty } from '../src/core/race';
import type { Level } from '../src/data/levels';
import { jostle } from '../src/game/contact';
import { courseFor } from '../src/game/courses';
import { GRID, gridSlot, rivalDrivers } from '../src/game/rivals';
import { Sim, TICK, type Driver } from '../src/game/sim';

const hands = { speed: 1, easeOff: 0, fork: 0, wise: 0, polish: 0, roads: [] as number[], side: 0, care: 1, sight: 1.2, seed: 0 };

/**
 * Players to race the rivals against. `ace` and `smart` are the hands-free lines and `none` never steers. The rest
 * are people, as far as the rivals' own model of a driver can stand in for one: `steady` is a decent player who goes
 * for most of the speed pads, `misser` has the same hands but hardly ever goes out of the way for one, and `kid` is
 * six to eight: slow hands, short sight, wanders, slips, and takes a pad when it is close.
 */
const PEOPLE: Record<string, Driver> = {
  steady: { ...hands, react: 0.3, turn: 4.5, quick: 10, drift: 0.5, slack: 0.5, slip: 0.04, swing: 0.03, ahead: 1.6, keen: 0.8, foresee: 0.7, loose: 0.5 },
  misser: { ...hands, react: 0.3, turn: 4.5, quick: 10, drift: 0.5, slack: 0.5, slip: 0.04, swing: 0.03, ahead: 1.6, keen: 0.1, foresee: 0.7, loose: 0.5 },
  kid: { ...hands, react: 0.5, turn: 2.4, quick: 7, drift: 1.2, slack: 1, slip: 0.1, swing: 0.05, ahead: 1, keen: 0.3, foresee: 0.2, loose: 1 },
};

export type StandIn = 'ace' | 'smart' | 'none' | 'steady' | 'misser' | 'kid';

export interface Outcome {
  /** Where the stand-in finished, 1 to 4. */
  place: number;
  /** Seconds it finished ahead of the first rival home; negative when it was behind. */
  margin: number;
  /** Crates and bumpers each rival ran into. */
  hits: number[];
}

/** A whole race run as the game runs it: three rivals and a stand-in for the player, in contact, on one course. */
export function raceAgainst(level: Level, difficulty: Difficulty, standIn: StandIn): Outcome {
  const course = courseFor(level);
  const hits = [0, 0, 0];
  const player = new Sim(course, level, () => {}, () => 0);
  player.x = GRID[3];
  if (standIn === 'ace' || standIn === 'smart') player.autopilot = standIn;
  else if (standIn !== 'none') player.driver = { ...PEOPLE[standIn], seed: level.n * 7 + 3 };
  const rivals = rivalDrivers(level, difficulty).map((driver, i, cast) => {
    const sim = new Sim(course, level, (event) => {
      if (event.type === 'crate' || event.type === 'bump') hits[i]++;
    }, () => 0);
    sim.shareWith(player);
    sim.driver = driver;
    sim.chase = () => player.progress();
    sim.x = gridSlot(i, cast.length);
    return sim;
  });
  const all = [player, ...rivals];
  rivals.forEach((sim) => (sim.traffic = () => all.filter((other) => other !== sim)));
  if (player.driver) player.traffic = () => rivals;
  for (let step = 0; step < 400 / TICK && all.some((sim) => !sim.finished); step++) {
    for (const sim of all) sim.step(TICK);
    jostle(all.filter((sim) => !sim.finished || sim === player));
  }
  const times = rivals.map((sim) => (sim.finished ? sim.time : Infinity));
  const mine = player.finished ? player.time : Infinity;
  return { place: 1 + times.filter((time) => time < mine).length, margin: Math.min(...times) - mine, hits };
}
