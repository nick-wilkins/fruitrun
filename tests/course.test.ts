import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { starsForTime } from '../src/core/progress';
import { LEVELS } from '../src/data/levels';
import { findClash, type CourseObj } from '../src/game/course';
import { courseFor, starTimesFor } from '../src/game/courses';
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
      if (o.kind !== 'spinner') expect(Math.abs(o.x) + (o.amp ?? 0)).toBeLessThanOrEqual(track.halfAt(o.s) - 0.5);
    }
  });

  it('puts only things you can reach in mid-air over a gap', () => {
    for (const gap of course.gaps) {
      for (const o of course.objects) {
        if (o.lane !== gap.lane || o.s <= gap.s0 || o.s >= gap.s1) continue;
        expect(['ring', 'pickup'], `${o.kind} over a gap at s=${o.s}`).toContain(o.kind);
        expect(o.y ?? 0).toBeGreaterThan(2.5);
      }
    }
  });

  it('can be finished hands-free, and a good line is faster', () => {
    const idle = timeCourse(course, level, 'none');
    const good = timeCourse(course, level, 'smart');
    expect(idle).toBeLessThan(150);
    expect(good).toBeLessThan(idle);
  });

  it('gives five stars for a good line and no more than two for never steering', () => {
    const [five, four, three, two] = starTimesFor(level);
    expect(five).toBeLessThan(four);
    expect(four).toBeLessThan(three);
    expect(three).toBeLessThan(two);
    expect(starsForTime(level, timeCourse(course, level, 'smart'))).toBe(5);
    expect(starsForTime(level, timeCourse(course, level, 'none'))).toBeLessThanOrEqual(2);
  });

  it('keeps solid obstacles off the stretch where a fork\'s two roads overlap', () => {
    // The ball only collides with things on its own route, so anything solid there could be driven through.
    const solid = new Set(['crate', 'slider', 'pendulum', 'spinner', 'windmill', 'goo', 'pin', 'jump']);
    const p = new Vector3();
    const d = new Vector3();
    course.lanes.forEach((lane, index) => {
      if (!lane.from) return;
      const onOther = (o: CourseObj) => {
        const mine = course.lanes[o.lane].track;
        const other = o.lane === 0 ? lane.track : course.track;
        mine.point(o.s, o.x, 0, p);
        return other.frames.some((f) => {
          d.subVectors(p, f.p);
          return Math.abs(d.dot(f.t)) < 1 && Math.abs(d.dot(f.r)) < other.half + 1 && Math.abs(d.dot(f.u)) < 3;
        });
      };
      for (const o of course.objects) {
        if (!solid.has(o.kind)) continue;
        const inFork = o.lane === index || (o.lane === 0 && o.s > lane.from.s0 && o.s < lane.from.s1);
        if (inFork) expect(onOther(o), `${o.kind} on lane ${o.lane} at s=${o.s}`).toBe(false);
      }
    });
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
      for (let i = 0; i < 120 * 30 && !(sim.lane === 0 && sim.s > from.s1 + 5); i++) {
        sim.step(1 / 120);
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
