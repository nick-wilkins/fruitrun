import { COURSES } from '../core/progress';
import type { Sim } from './sim';

/** Seconds between one remembered position and the next: the ghost glides between them. */
const STEP = 0.1;
/** How long a ghost stays at the line after finishing before it fades from the road. */
const LINGER = 1.5;

/** A best run, remembered as where the marble was every tenth of a second. */
export interface Ghost {
  /** The finishing time: the moment of the last position. */
  time: number;
  lane: number[];
  s: number[];
  x: number[];
  h: number[];
}

export interface GhostSpot {
  lane: number;
  s: number;
  x: number;
  h: number;
}

/** Follows a marble through a run, keeping what a ghost of it will need. */
export class Recorder {
  private readonly lane: number[] = [];
  private readonly s: number[] = [];
  private readonly x: number[] = [];
  private readonly h: number[] = [];
  private next = 0;
  private last: Sim | null = null;

  /** Call after every step of the rules. */
  sample(sim: Sim): void {
    if (sim.countdown > 0 || sim.finished) return;
    while (sim.time >= this.next) {
      this.keep(sim);
      this.next += STEP;
    }
    this.last = sim;
  }

  private keep(sim: Sim): void {
    this.lane.push(sim.lane);
    this.s.push(Math.round(sim.s * 10));
    this.x.push(Math.round(sim.x * 20));
    this.h.push(Math.round(sim.h * 10));
  }

  /** The run as text to store, once the line has been crossed at `time`. */
  finish(time: number): string {
    if (this.last) this.keep(this.last);
    // Mostly small steps forward and long spells on one road: kept as differences and runs, it is a fraction of the size.
    const steps = this.s.map((s, i) => (i === 0 || this.lane[i] !== this.lane[i - 1] ? s : s - this.s[i - 1]));
    const roads: number[] = [];
    for (const lane of this.lane) {
      if (roads.length && roads[roads.length - 2] === lane) roads[roads.length - 1]++;
      else roads.push(lane, 1);
    }
    return JSON.stringify({ v: 1, courses: COURSES, time: Math.round(time * 1000) / 1000, roads, s: steps, x: this.x, h: this.h });
  }
}

/** The ghost held in `raw`, or null if there is none, it cannot be read, or the course has been re-laid since. */
export function readGhost(raw: string | null): Ghost | null {
  try {
    if (!raw) return null;
    const kept = JSON.parse(raw) as { v: number; courses: number; time: number; roads: number[]; s: number[]; x: number[]; h: number[] };
    if (kept.v !== 1 || kept.courses !== COURSES || !(kept.time > 0)) return null;
    const lane: number[] = [];
    for (let i = 0; i < kept.roads.length; i += 2) for (let n = 0; n < kept.roads[i + 1]; n++) lane.push(kept.roads[i]);
    const count = lane.length;
    if (count < 2 || kept.s.length !== count || kept.x.length !== count || kept.h.length !== count) return null;
    const s: number[] = [];
    kept.s.forEach((step, i) => s.push(i === 0 || lane[i] !== lane[i - 1] ? step / 10 : s[i - 1] + step / 10));
    return { time: kept.time, lane, s, x: kept.x.map((x) => x / 20), h: kept.h.map((h) => h / 10) };
  } catch {
    return null;
  }
}

/** Where the ghost is `time` seconds into the run, or null once it has finished and gone. */
export function ghostAt(ghost: Ghost, time: number): GhostSpot | null {
  if (time > ghost.time + LINGER) return null;
  const last = ghost.s.length - 1;
  // Every position is a tenth of a second after the one before, except the last, taken on the line itself.
  const when = (i: number) => (i === last ? ghost.time : i * STEP);
  const i = Math.min(last - 1, Math.max(0, Math.floor(time / STEP)));
  const k = Math.min(1, Math.max(0, (time - when(i)) / Math.max(1e-6, when(i + 1) - when(i))));
  const spot = (a: number, b: number, by: number): GhostSpot => ({
    lane: ghost.lane[a],
    s: ghost.s[a] + (ghost.s[b] - ghost.s[a]) * by,
    x: ghost.x[a] + (ghost.x[b] - ghost.x[a]) * by,
    h: Math.max(0, ghost.h[a] + (ghost.h[b] - ghost.h[a]) * by),
  });
  if (ghost.lane[i] === ghost.lane[i + 1]) return spot(i, i + 1, k);
  // Changing roads at a fork: distances on the two do not compare, so carry on as it was going until it is across.
  return i > 0 && ghost.lane[i - 1] === ghost.lane[i] ? spot(i - 1, i, 1 + k) : spot(i, i, 0);
}
