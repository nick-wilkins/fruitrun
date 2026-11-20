import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { starsForTime } from '../src/core/progress';
import { LEVELS } from '../src/data/levels';
import { findClash, type CourseObj } from '../src/game/course';
import { courseFor, INTRO, RECIPES, starTimesFor } from '../src/game/courses';
import { MIN_SPEED, Sim, timeCourse } from '../src/game/sim';

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

  it('keeps five stars for beating the test drivers, four for matching them, and one for never steering', () => {
    const [five, four, three, two] = starTimesFor(level);
    expect(five).toBeLessThan(four);
    expect(four).toBeLessThan(three);
    expect(three).toBeLessThan(two);
    const best = Math.min(timeCourse(course, level, 'ace'), timeCourse(course, level, 'smart'));
    expect(five).toBeLessThan(best);
    expect(starsForTime(level, best)).toBeGreaterThanOrEqual(4);
    expect(starsForTime(level, timeCourse(course, level, 'none'))).toBe(1);
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

describe('the first world', () => {
  it('only uses a kind of piece from the level that introduces it', () => {
    for (const [id, recipe] of Object.entries(RECIPES)) {
      const n = Number(id.split('-')[1]);
      for (const piece of recipe) expect(INTRO[piece], `${piece} on level ${n}`).toBeLessThanOrEqual(n);
    }
  });

  it('brings something new on every level from 2 to 12', () => {
    for (let n = 2; n <= 12; n++) {
      const fresh = RECIPES[`level-${n}`].filter((piece) => INTRO[piece] === n);
      expect(fresh.length, `level ${n}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('has used every kind of piece by level 12', () => {
    const used = new Set(Object.entries(RECIPES).filter(([id]) => Number(id.split('-')[1]) <= 12).flatMap(([, recipe]) => recipe));
    expect(Object.keys(INTRO).filter((piece) => !used.has(piece as keyof typeof INTRO))).toEqual([]);
  });
});

describe('forks', () => {
  const level = LEVELS[1];
  const course = courseFor(level);
  const arm = course.lanes.findIndex((l) => l.from);
  const from = course.lanes[arm].from!;

  /** Arrive at the fork at `x`, then hold the stick `towards` one side all the way through. */
  const play = (x: number, towards: number) => {
    const sim = new Sim(course, level);
    sim.skipCountdown();
    sim.s = from.s0 - 5;
    sim.x = x;
    const seen = new Set<number>();
    for (let i = 0; i < 120 * 30 && !(sim.lane === 0 && sim.s > from.s1 + 5); i++) {
      sim.steer = sim.s > from.s0 ? towards * 30 : x;
      sim.step(1 / 120);
      seen.add(sim.lane);
    }
    return { seen, s: sim.s };
  };

  it('sends a ball steered to the fork side down the arm and brings it back', () => {
    const taken = play(from.side * 3, from.side);
    expect(taken.seen.has(arm)).toBe(true);
    expect(taken.s).toBeGreaterThan(from.s1);
    expect(play(-from.side * 3, -from.side).seen.has(arm)).toBe(false);
  });

  it('lets you choose right up to where the roads part, not where they start to', () => {
    // In the middle as the fork begins, then steering for the arm: you get the arm.
    expect(play(0, from.side).seen.has(arm)).toBe(true);
    // On the arm's side as the fork begins, then steering away from it: you stay on the main route.
    expect(play(from.side * 3, -from.side).seen.has(arm)).toBe(false);
  });

  /** A swipe made 15 short of the fork and then held still, as far over as `limits` allows: which roads it leads down. */
  const swipeEarly = (limits: (sim: Sim) => [number, number]) => {
    const sim = new Sim(course, level);
    sim.skipCountdown();
    sim.s = from.s0 - 15;
    sim.swiping = true;
    const [lo, hi] = limits(sim);
    sim.steer = from.side > 0 ? hi : lo;
    const seen = new Set<number>();
    for (let i = 0; i < 120 * 3; i++) {
      sim.step(1 / 120);
      seen.add(sim.lane);
    }
    return seen;
  };

  it('keeps a swipe for the side road made before it opens, and takes it', () => {
    expect(swipeEarly((sim) => sim.reach()).has(arm)).toBe(true);
    // Held at the main road's kerb, as a swipe used to be, the ball is still on the main road when they part.
    expect(swipeEarly((sim) => sim.bounds()).has(arm)).toBe(false);
  });

  it('lets a finger reach for a side road just before it opens, and not before that', () => {
    const sim = new Sim(course, level);
    sim.skipCountdown();
    const far = from.side > 0 ? 1 : 0;
    sim.s = from.s0 - 80;
    expect(sim.reach()).toEqual(sim.bounds());
    sim.s = from.s0 - 15;
    expect(Math.abs(sim.reach()[far])).toBeGreaterThan(Math.abs(sim.bounds()[far]) + 3);
    expect(sim.reach()[1 - far]).toBe(sim.bounds()[1 - far]);
  });

  it('takes no speed off a ball reaching for the road to come, as it does off one pushing on a kerb', () => {
    const after = (steer: number, swiping = true) => {
      const sim = new Sim(course, level);
      sim.skipCountdown();
      sim.s = from.s0 - 15;
      sim.x = steer > 0 ? 4.2 : -4.2;
      sim.v = 40;
      sim.steer = steer;
      sim.swiping = swiping;
      for (let i = 0; i < 12; i++) sim.step(1 / 120);
      return sim.v;
    };
    expect(after(from.side * 8)).toBeGreaterThan(after(-from.side * 8) + 0.3);
    // However hard the swipe: as far as a finger can ask for, and further.
    expect(after(from.side * 30)).toBeCloseTo(after(from.side * 8));
    // Only a swipe can be held for a road to come. Keys and a mouse ask afresh all the time: for them it is a kerb.
    expect(after(from.side * 8, false)).toBeCloseTo(after(-from.side * 8, false));
  });
});

describe('a helping hand', () => {
  it('carries a ball further along the road for the same speed', () => {
    const level = LEVELS[0];
    const roll = (help: number) => {
      const sim = new Sim(courseFor(level), level);
      sim.skipCountdown();
      sim.help = help;
      for (let i = 0; i < 120 * 3; i++) sim.step(1 / 120);
      return sim;
    };
    const plain = roll(0);
    const helped = roll(0.06);
    expect(helped.s / plain.s).toBeGreaterThan(1.04);
    expect(helped.s / plain.s).toBeLessThan(1.08);
  });
});

describe('holding back', () => {
  const level = LEVELS[0];
  const fresh = (v: number) => {
    const sim = new Sim(courseFor(level), level);
    sim.skipCountdown();
    sim.s = 40;
    sim.v = v;
    return sim;
  };
  const roll = (sim: Sim, seconds: number) => {
    for (let i = 0; i < 120 * seconds; i++) sim.step(1 / 120);
    return sim;
  };

  it('slows the ball to a gentle roll and never stops it', () => {
    const sim = fresh(50);
    sim.brake = 1;
    roll(sim, 0.5);
    expect(sim.v).toBeLessThan(35);
    roll(sim, 3);
    expect(sim.v).toBeGreaterThanOrEqual(MIN_SPEED);
    expect(sim.v).toBeLessThan(18);
    const at = sim.s;
    roll(sim, 1);
    expect(sim.s).toBeGreaterThan(at + 10);
  });

  it('is felt in proportion, and lets the ball pick up again when let go', () => {
    const hard = roll(Object.assign(fresh(50), { brake: 1 }), 0.4);
    const soft = roll(Object.assign(fresh(50), { brake: 0.3 }), 0.4);
    const none = roll(fresh(50), 0.4);
    expect(hard.v).toBeLessThan(soft.v);
    expect(soft.v).toBeLessThan(none.v);
    const slow = roll(Object.assign(fresh(50), { brake: 1 }), 3);
    slow.brake = 0;
    const was = slow.v;
    roll(slow, 1);
    expect(slow.v).toBeGreaterThan(was + 5);
  });

  it('works in the air: the ball comes down sooner and shorter', () => {
    const jump = (brake: number) => {
      const sim = fresh(50);
      sim.vh = 11.5;
      sim.h = 0.01;
      const from = sim.s;
      let steps = 0;
      sim.step(1 / 120);
      sim.brake = brake;
      while (sim.h > 0 && steps++ < 1200) sim.step(1 / 120);
      return { far: sim.s - from, time: steps / 120 };
    };
    const free = jump(0);
    const held = jump(1);
    expect(held.far).toBeLessThan(free.far * 0.75);
    expect(held.time).toBeLessThan(free.time * 0.9);
  });

  it('ends a turbo', () => {
    const sim = fresh(80);
    sim.turboT = 2;
    sim.brake = 1;
    roll(sim, 0.5);
    expect(sim.v).toBeLessThan(65);
    expect(sim.turboT).toBeLessThanOrEqual(0);
  });
});

describe('fruit a friend takes', () => {
  it('is gone for a moment and then back, as in any race', () => {
    const level = LEVELS[0];
    const course = courseFor(level);
    const sim = new Sim(course, level);
    sim.skipCountdown();
    const fruit = course.objects.findIndex((o) => o.kind === 'pickup');
    expect(sim.fresh(fruit)).toBe(true);
    sim.lose(fruit);
    expect(sim.fresh(fruit)).toBe(false);
    for (let i = 0; i < 120; i++) sim.step(1 / 120);
    expect(sim.fresh(fruit)).toBe(true);
  });
});
