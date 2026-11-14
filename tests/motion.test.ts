import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { LEVELS } from '../src/data/levels';
import { Rig } from '../src/game/camera';
import { courseFor } from '../src/game/courses';
import { seeded } from '../src/game/random';
import { Sim, TICK } from '../src/game/sim';

/** Ways of driving that between them take both sides of every fork and wander all over the road. */
const DRIVERS: Record<string, (sim: Sim) => number | null> = {
  left: () => -40,
  right: () => 40,
  weave: (sim) => Math.sin(sim.clock * 1.7) * 40,
};

const degrees = (cosine: number) => (Math.acos(Math.min(1, cosine)) * 180) / Math.PI;

describe.each(LEVELS)('$name motion', (level) => {
  const course = courseFor(level);

  it.each(Object.keys(DRIVERS))('is smooth when driven %s', (name) => {
    const sim = new Sim(course, level, () => {}, () => 0);
    sim.skipCountdown();
    const was = new Vector3();
    const now = new Vector3();
    sim.point(sim.s, sim.x, sim.h, was);
    const rig = new Rig();
    rig.update(sim, sim.s, sim.x, sim.h, 0);
    const camWas = rig.pos.clone();
    const dirWas = rig.look.clone().sub(rig.pos).normalize();
    const dir = new Vector3();
    const worst = { ball: 0, camera: 0, swing: 0, through: [] as string[] };

    for (let i = 0; i < 120 * 240 && !sim.finished; i++) {
      sim.steer = DRIVERS[name](sim);
      const before = sim.s;
      const lane = sim.lane;
      sim.step(TICK);

      // The ball's place in the world must never jump, whatever road it is measured from.
      sim.point(sim.s, sim.x, sim.h, now);
      worst.ball = Math.max(worst.ball, now.distanceTo(was) - Math.max(sim.v, 30) * TICK * 2);
      was.copy(now);

      // Nothing solid may be passed through untouched.
      if (lane === sim.lane) {
        course.objects.forEach((o, index) => {
          if (o.kind !== 'crate' || o.lane !== sim.lane || sim.done[index]) return;
          if (before < o.s && sim.s >= o.s && Math.abs(sim.x - o.x) < 1 && sim.h < 1) worst.through.push(`crate at ${o.s}`);
        });
      }

      // The camera, sixty times a second.
      if (i % 2) {
        rig.update(sim, sim.s, sim.x, sim.h, TICK * 2);
        worst.camera = Math.max(worst.camera, rig.pos.distanceTo(camWas) - Math.max(sim.v, 30) * TICK * 4);
        dir.subVectors(rig.look, rig.pos).normalize();
        worst.swing = Math.max(worst.swing, degrees(dir.dot(dirWas)));
        camWas.copy(rig.pos);
        dirWas.copy(dir);
      }
    }

    expect(sim.finished).toBe(true);
    expect(worst.ball).toBeLessThan(0.35);
    expect(worst.through).toEqual([]);
    expect(worst.camera).toBeLessThan(1.2);
    expect(worst.swing).toBeLessThan(22);
  });
});

describe('camera with uneven frames', () => {
  // Real screens do not deliver frames evenly: a slow tablet, a hitch, a tab switched away and back.
  it.each([2, 7, 12, 18, 30, 45])('stays with the ball on level %i', (n) => {
    const level = LEVELS[n - 1];
    const course = courseFor(level);
    const sim = new Sim(course, level, () => {}, () => 0);
    sim.autopilot = 'smart';
    sim.skipCountdown();
    const rig = new Rig();
    const ball = new Vector3();
    const random = seeded(n);
    let furthest = 0;
    for (let frame = 0; frame < 60 * 240 && !sim.finished; frame++) {
      // Mostly 60 a second, with stretches at 30 and 20 and the odd long hitch.
      const roll = random();
      const ticks = frame % 400 < 80 ? 4 : frame % 400 < 120 ? 6 : roll < 0.02 ? 6 : roll < 0.1 ? 3 : 2;
      for (let i = 0; i < ticks; i++) sim.step(TICK);
      rig.update(sim, sim.s, sim.x, sim.h, ticks * TICK);
      sim.point(sim.s, sim.x, sim.h, ball);
      furthest = Math.max(furthest, rig.pos.distanceTo(ball));
    }
    expect(sim.finished).toBe(true);
    // The camera rides 8 to 12 behind and 4 above: anything much more means it has wandered off.
    expect(furthest).toBeLessThan(22);
  });
});
