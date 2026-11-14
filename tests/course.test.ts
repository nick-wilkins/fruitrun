import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/data/levels';
import { findClash } from '../src/game/course';
import { courseFor } from '../src/game/courses';
import { Sim, timeCourse } from '../src/game/sim';

describe.each(LEVELS)('$name course', (level) => {
  const course = courseFor(level);

  it('keeps every frame square', () => {
    for (const lane of course.lanes) {
      for (const f of lane.track.frames) {
        expect(Math.abs(f.t.length() - 1)).toBeLessThan(1e-4);
        expect(Math.abs(f.t.dot(f.u))).toBeLessThan(1e-4);
        expect(Math.abs(f.r.dot(f.u))).toBeLessThan(1e-4);
      }
    }
  });

  it('never passes through itself', () => {
    expect(findClash(course.lanes)).toBeNull();
  });

  it('rejoins every fork where the main route is', () => {
    for (const lane of course.lanes) expect(lane.drift).toBeLessThan(2.5);
  });

  it('places every object on the road before the finish', () => {
    for (const o of course.objects) {
      const track = course.lanes[o.lane].track;
      expect(o.s).toBeGreaterThan(o.lane === 0 ? 10 : 0);
      expect(o.s).toBeLessThan(o.lane === 0 ? course.finishS - 5 : track.length);
      if (o.kind !== 'spinner') expect(Math.abs(o.x) + (o.amp ?? 0)).toBeLessThanOrEqual(track.half - 0.5);
    }
  });

  it('can be finished hands-free, and a good line is faster', () => {
    const idle = timeCourse(course, level, 'none');
    const good = timeCourse(course, level, 'smart');
    expect(idle).toBeLessThan(150);
    expect(good).toBeLessThan(idle);
  });

  it('has star times in order with room between them', () => {
    const [five, four, three, two] = level.starTimes;
    expect(five).toBeLessThan(four);
    expect(four).toBeLessThan(three);
    expect(three).toBeLessThan(two);
    expect(five).toBeGreaterThan(20);
  });
});

describe('forks', () => {
  it('sends a ball on the fork side down the arm and brings it back', () => {
    const level = LEVELS[1];
    const course = courseFor(level);
    const arm = course.lanes.findIndex((l) => l.from);
    expect(arm).toBeGreaterThan(0);
    const from = course.lanes[arm].from!;
    const play = (x: number) => {
      const sim = new Sim(course, level);
      sim.skipCountdown();
      sim.s = from.s0 - 5;
      sim.x = x;
      const seen = new Set<number>();
      for (let i = 0; i < 60 * 30 && !(sim.lane === 0 && sim.s > from.s1 + 5); i++) {
        sim.step(1 / 60);
        seen.add(sim.lane);
      }
      return { seen, s: sim.s };
    };
    const taken = play(from.side * 3);
    expect(taken.seen.has(arm)).toBe(true);
    expect(taken.s).toBeGreaterThan(from.s1);
    expect(play(-from.side * 3).seen.has(arm)).toBe(false);
  });
});
