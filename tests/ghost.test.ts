import { describe, expect, it } from 'vitest';
import { COURSES } from '../src/core/progress';
import { LEVELS } from '../src/data/levels';
import { courseFor } from '../src/game/courses';
import { ghostAt, readGhost, Recorder } from '../src/game/ghost';
import { Sim, TICK } from '../src/game/sim';

/** A hands-free run of a level, recorded as it goes, with where the marble really was at each tenth of a second. */
function recorded(n: number) {
  const level = LEVELS[n];
  const sim = new Sim(courseFor(level), level, () => {}, () => 0);
  sim.autopilot = 'smart';
  const recorder = new Recorder();
  const truth: { time: number; lane: number; s: number; x: number }[] = [];
  let next = 0.05;
  for (let i = 0; i < 300 / TICK && !sim.finished; i++) {
    // The careful line never leaves the main road, so steer for the first side road by hand.
    const from = sim.course.lanes[1]?.from;
    const turning = Boolean(from) && sim.lane === 0 && sim.s > from!.s0 - 25 && sim.s < from!.s0 + from!.decide;
    sim.autopilot = turning ? 'none' : 'smart';
    sim.steer = turning ? from!.spread[from!.decide] : null;
    sim.step(TICK);
    recorder.sample(sim);
    if (sim.time >= next) {
      truth.push({ time: sim.time, lane: sim.lane, s: sim.s, x: sim.x });
      next += 0.37;
    }
  }
  return { sim, recorder, truth };
}

describe('a ghost', () => {
  it('follows the run it was recorded from, and crosses the line at the same time', () => {
    // Level 30 has a fork and jumps: the ghost has to follow the side road and the air as well.
    const { sim, recorder, truth } = recorded(29);
    const ghost = readGhost(recorder.finish(sim.time))!;
    expect(ghost.time).toBeCloseTo(sim.time, 2);
    for (const was of truth) {
      const at = ghostAt(ghost, was.time)!;
      if (at.lane !== was.lane) continue;
      expect(Math.abs(at.s - was.s)).toBeLessThan(1);
      // A marble can cross the road at 16 a second, so between two remembered spots it may be most of a width out.
      expect(Math.abs(at.x - was.x)).toBeLessThan(0.8);
    }
    expect(truth.some((was) => was.lane !== 0)).toBe(true);
    const end = ghostAt(ghost, sim.time)!;
    expect(end.lane).toBe(0);
    expect(Math.abs(end.s - sim.s)).toBeLessThan(0.6);
  });

  it('is nowhere before the start, and gone a moment after it has finished', () => {
    const { sim, recorder } = recorded(0);
    const ghost = readGhost(recorder.finish(sim.time))!;
    expect(ghostAt(ghost, 0)).not.toBeNull();
    expect(ghostAt(ghost, sim.time + 0.5)).not.toBeNull();
    expect(ghostAt(ghost, sim.time + 3)).toBeNull();
  });

  it('stays small enough to keep one for every level', () => {
    const { sim, recorder } = recorded(29);
    expect(recorder.finish(sim.time).length).toBeLessThan(12000);
  });

  it('is ignored when it cannot be read or was set on an older layout of the course', () => {
    const { sim, recorder } = recorded(0);
    const raw = recorder.finish(sim.time);
    expect(readGhost(null)).toBeNull();
    expect(readGhost(raw.slice(0, 40))).toBeNull();
    expect(readGhost(JSON.stringify({ ...JSON.parse(raw), courses: COURSES - 1 }))).toBeNull();
  });
});
