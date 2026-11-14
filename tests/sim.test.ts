import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/data/levels';
import { CourseBuilder, type Course } from '../src/game/course';
import { PIECES } from '../src/game/pieces';
import { MAX_SPEED, Sim, TICK } from '../src/game/sim';
import { themeFor } from '../src/game/themes';

const level = LEVELS[0];

function courseOf(lay: (b: CourseBuilder) => void): Course {
  const b = new CourseBuilder();
  b.straight(60);
  lay(b);
  b.straight(120);
  return b.build(themeFor(level, '#ff0000'));
}

/** Roll down the middle without steering until the finish, calling `each` every step. */
function roll(course: Course, each: (sim: Sim) => void = () => {}): Sim {
  const sim = new Sim(course, level, () => {}, () => 0);
  sim.skipCountdown();
  for (let i = 0; i < 120 * 60 && !sim.finished; i++) {
    sim.step(TICK);
    each(sim);
  }
  return sim;
}

describe('turbo jump', () => {
  it('hangs its rings and fruit where a turbo-launched ball can reach them', () => {
    const course = courseOf((b) => PIECES.turboJump(b));
    const sim = roll(course);
    const missed = course.objects.filter((o, i) => (o.kind === 'ring' || o.kind === 'pickup') && !sim.done[i]);
    expect(missed.map((o) => `${o.kind} at ${o.s}`)).toEqual([]);
    expect(sim.bonuses).toContain(level.fruit);
  });
});

describe('turbo', () => {
  it('is over once the ball has ridden an escalator', () => {
    const course = courseOf((b) => {
      b.turbo(4, 0).straight(20);
      PIECES.escalatorHill(b);
    });
    const lift = course.lifts[0];
    let after = 0;
    roll(course, (sim) => {
      if (!after && sim.s > lift.s1 + 3) after = sim.v;
    });
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(MAX_SPEED);
  });

  it('is stopped by a sticky patch', () => {
    const course = courseOf((b) => {
      b.turbo(4, 0).goo(40, 0, 12).straight(80);
    });
    let slowest = Infinity;
    roll(course, (sim) => {
      if (sim.s > 60 + 50 && sim.s < 60 + 70) slowest = Math.min(slowest, sim.v);
    });
    expect(slowest).toBeLessThan(MAX_SPEED);
  });
});
