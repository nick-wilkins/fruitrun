import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { LEVELS } from '../src/data/levels';
import { Rig } from '../src/game/camera';
import { courseFor } from '../src/game/courses';
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
