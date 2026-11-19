import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/data/levels';
import { jostle } from '../src/game/contact';
import { CourseBuilder, type Course } from '../src/game/course';
import { courseFor } from '../src/game/courses';
import { GRID, rivalDrivers } from '../src/game/rivals';
import { FRUIT_BACK, Sim, TICK } from '../src/game/sim';
import { themeFor } from '../src/game/themes';

const level = LEVELS[0];

function courseOf(lay: (b: CourseBuilder) => void): Course {
  const b = new CourseBuilder();
  b.straight(60);
  lay(b);
  b.straight(160);
  return b.build(themeFor(level, '#ff0000'));
}

/** Two marbles on one course, the second starting `behind` the first, both rolling down the middle. */
function pair(course: Course, behind: number, shared = true): [Sim, Sim] {
  const front = new Sim(course, level, () => {}, () => 0);
  const back = new Sim(course, level, () => {}, () => 0);
  if (shared) back.shareWith(front);
  front.skipCountdown();
  back.skipCountdown();
  front.s += behind;
  return [front, back];
}

function run(sims: Sim[], seconds: number, each: () => void = () => {}): void {
  for (let i = 0; i < seconds / TICK; i++) {
    for (const sim of sims) sim.step(TICK);
    each();
  }
}

describe('a shared course', () => {
  it('has a crate smashed for everyone once one marble has hit it', () => {
    const course = courseOf((b) => b.crates(30, 0));
    const [front, back] = pair(course, 20);
    run([front, back], 8);
    expect(front.tally.hits).toBe(1);
    expect(back.tally.hits).toBe(0);
  });

  it('leaves the crate for the next marble when they are not racing each other', () => {
    const course = courseOf((b) => b.crates(30, 0));
    const [front, back] = pair(course, 20, false);
    run([front, back], 8);
    expect(back.tally.hits).toBe(1);
  });

  it('gives a fruit to whoever gets there first, and nothing to a marble right behind', () => {
    const course = courseOf((b) => b.fruit(30, 0));
    const [front, back] = pair(course, 4);
    run([front, back], 8);
    expect(front.bonuses).toHaveLength(1);
    expect(back.bonuses).toHaveLength(0);
    expect(back.feats().pickups).toBe(0);
  });

  it('has the fruit back half a second later for whoever comes next', () => {
    const course = courseOf((b) => b.fruit(30, 0));
    const index = course.objects.findIndex((o) => o.kind === 'pickup');
    const [front, back] = pair(course, 40);
    let taken = -1;
    let gone = 0;
    run([front, back], 8, () => {
      if (taken < 0 && front.bonuses.length) taken = front.clock;
      if (taken >= 0 && !front.fresh(index) && !back.bonuses.length) gone = front.clock - taken;
    });
    expect(FRUIT_BACK).toBe(0.5);
    expect(gone).toBeGreaterThan(0.4);
    expect(gone).toBeLessThanOrEqual(0.5);
    expect(back.bonuses).toHaveLength(1);
    expect(front.bonuses).toHaveLength(1);
  });

  it('never brings fruit back in a run on your own', () => {
    const course = courseOf((b) => b.fruit(30, 0));
    const index = course.objects.findIndex((o) => o.kind === 'pickup');
    const sim = new Sim(course, level, () => {}, () => 0);
    sim.skipCountdown();
    run([sim], 8);
    expect(sim.bonuses).toHaveLength(1);
    expect(sim.fresh(index)).toBe(false);
  });
});

describe('marbles bumping', () => {
  const road = courseOf(() => {});

  it('a marble run into from behind is pushed on, and the one behind is checked', () => {
    const [front, back] = pair(road, 1.5, true);
    front.v = 20;
    back.v = 40;
    jostle([front, back]);
    expect(front.v).toBeGreaterThan(20);
    expect(back.v).toBeLessThan(40);
    expect(back.v).toBeLessThan(front.v);
    expect(back.rattled).toBe(true);
  });

  it('two marbles side by side are moved apart until they no longer overlap', () => {
    const [left, right] = pair(road, 0);
    left.x = -0.6;
    right.x = 0.6;
    jostle([left, right]);
    expect(right.x - left.x).toBeCloseTo(2, 5);
  });

  it('a marble steering into another is checked, and knocks it aside', () => {
    const [left, right] = pair(road, 0);
    left.x = -0.9;
    right.x = 0.9;
    left.xv = 10;
    jostle([left, right]);
    expect(left.xv).toBeLessThan(10);
    expect(right.xv).toBeGreaterThan(left.xv);
  });

  it('leaves marbles alone that are clear of each other, on different roads, or one in the air', () => {
    const [a, b] = pair(road, 2.5);
    const [c, d] = pair(road, 0);
    d.h = 3;
    for (const sim of [a, b, c, d]) sim.v = 30;
    b.v = 50;
    jostle([a, b]);
    jostle([c, d]);
    expect([a.v, b.v, c.x, d.x]).toEqual([30, 50, 0, 0]);
    const [e, f] = pair(road, 0);
    f.lane = 1;
    jostle([e, f]);
    const g = new Sim(road, level, () => {}, () => 0);
    const h = new Sim(road, level, () => {}, () => 0);
    jostle([g, h]);
    expect([e.x, f.x, g.x, h.x]).toEqual([0, 0, 0, 0]);
  });

  it('never pushes a marble off the road, or one on turbo off its stride', () => {
    const [inside, outside] = pair(road, 0);
    outside.x = outside.limit;
    inside.x = outside.limit - 1;
    jostle([inside, outside]);
    expect(outside.x).toBe(outside.limit);
    const [front, back] = pair(road, 1.5);
    front.v = 30;
    back.v = 86;
    back.turboT = 2;
    jostle([front, back]);
    expect(front.v).toBeLessThanOrEqual(56);
  });

  it('a whole field racing in contact all reach the line, the same way every time', () => {
    const race = () => {
      const lvl = LEVELS[6];
      const course = courseFor(lvl);
      const sims = rivalDrivers(lvl, 'medium').map((driver, i) => {
        const sim = new Sim(course, lvl, () => {}, () => 0);
        sim.driver = driver;
        sim.x = GRID[i];
        return sim;
      });
      sims.forEach((sim) => {
        if (sim !== sims[0]) sim.shareWith(sims[0]);
        sim.traffic = () => sims.filter((other) => other !== sim);
      });
      let overlap = 0;
      for (let i = 0; i < 300 / TICK && sims.some((sim) => !sim.finished); i++) {
        for (const sim of sims) sim.step(TICK);
        jostle(sims);
        for (const a of sims) for (const b of sims) if (a !== b && a.lane === b.lane && !a.finished && !b.finished && a.h === 0 && b.h === 0 && !a.onLift() && !b.onLift()) overlap = Math.max(overlap, 2 - Math.hypot(a.s - b.s, a.x - b.x));
      }
      return { times: sims.map((sim) => (sim.finished ? sim.time : Infinity)), overlap };
    };
    const first = race();
    for (const time of first.times) expect(time).toBeLessThan(Infinity);
    expect(first.overlap).toBeLessThan(0.8);
    expect(race()).toEqual(first);
  });
});
