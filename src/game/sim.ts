import { Vector3 } from 'three';
import type { Level } from '../data/levels';
import { GRIP, LEVEL_FRUIT, type Course, type CourseObj } from './course';
import { makeFrame, type Frame } from './track';

export const BALL_RADIUS = 1;
export const CRUISE = 26;
export const MIN_SPEED = 12;
export const MAX_SPEED = 56;
/** A turbo pad's speed, and how long it holds. */
export const TURBO_SPEED = 86;
const TURBO_TIME = 2.2;
const GRAVITY = 11;
const COUNTDOWN = 3;
const START_S = 12;
/** How far past the kerb a steering target may reach, so pressing into the wall registers as a scrape. */
export const PUSH = 1.2;
/** The rules always advance in steps this long, so a course plays the same at any frame rate. */
export const TICK = 1 / 120;
/** How fast an escalator carries the ball. */
const LIFT_SPEED = 24;
/** Reach of a windmill sail, and how far round from straight down it still sweeps the road. */
export const SAIL = 6.2;
const SAIL_LOW = 0.76;

export type Autopilot = 'none' | 'smart';

export type SimEvent =
  | { type: 'tick' | 'go' | 'land' | 'scrape' | 'finish' | 'results' | 'fork' | 'goo' | 'launch' | 'lift' }
  | { type: 'boost' | 'turbo' | 'crate' | 'pin' | 'bump' | 'ring' | 'jump'; index: number }
  | { type: 'pickup'; index: number; id: string };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The rules of a run, with no rendering or sound: it can be stepped headlessly to test or time a course. */
export class Sim {
  lane = 0;
  s = START_S;
  x = 0;
  v = 0;
  xv = 0;
  /** Height above the road while airborne. */
  h = 0;
  time = 0;
  clock = 0;
  countdown = COUNTDOWN;
  finished = false;
  finishT = 0;
  boostT = 0;
  /** Where the player wants the ball, or null to hold its line. */
  steer: number | null = null;
  autopilot: Autopilot = 'none';
  readonly bonuses: string[] = [];
  /** Per course object: used up (smashed, collected). */
  readonly done: boolean[];
  /** Per course object: the ingredient a pickup holds. */
  readonly items: (string | undefined)[];
  /** Seconds of turbo left. */
  turboT = 0;

  /** The fork arm the ball has just come off, while it is still close behind. */
  private cameFrom = 0;
  private riding = false;
  private vh = 0;
  private knockT = 0;
  private scrapeT = 0;
  private gooT = 0;
  private dt = 0;
  private lastTick = COUNTDOWN + 1;
  private reported = false;
  private readonly readyAt: number[];
  private readonly byLane: number[][];
  private readonly f = makeFrame();
  private readonly ahead = makeFrame();
  private readonly scratch = makeFrame();

  constructor(
    readonly course: Course,
    readonly level: Level,
    private readonly emit: (event: SimEvent) => void = () => {},
    random: () => number = Math.random,
  ) {
    const pool = level.bonusPool.length ? level.bonusPool : [level.fruit];
    this.done = course.objects.map(() => false);
    this.readyAt = course.objects.map(() => 0);
    this.items = course.objects.map((o) =>
      o.kind !== 'pickup' ? undefined : o.item === LEVEL_FRUIT ? level.fruit : (o.item ?? pool[Math.floor(random() * pool.length)]),
    );
    this.byLane = course.lanes.map(() => []);
    course.objects.forEach((o, i) => this.byLane[o.lane].push(i));
  }

  /** How far from the centre the ball can go where it is now: the road narrows and widens. */
  get limit(): number {
    return this.course.lanes[this.lane].track.halfAt(Math.max(0, this.s)) - BALL_RADIUS;
  }

  /** Jump straight to racing. */
  skipCountdown(): void {
    this.countdown = 0;
    this.v = CRUISE * 0.6;
  }

  /** Frame at distance `s` along a lane. Past either end of a fork arm it carries on along the main route. */
  frameAt(s: number, out: Frame, lane = this.lane): Frame {
    const { lanes, track } = this.course;
    const from = lanes[lane].from;
    if (!from) {
      // Looking back just after leaving a fork arm, or ahead just before taking one, follow the arm rather than
      // the main route's alternative, so the camera does not jump sideways.
      if (lane === this.lane) {
        const left = this.cameFrom ? lanes[this.cameFrom] : null;
        if (left && s < left.from!.s1) return left.track.at(left.track.length - (left.from!.s1 - s), out);
        for (let i = 1; i < lanes.length; i++) {
          const next = lanes[i].from!;
          if (this.s < next.s0 && s > next.s0 && s - next.s0 < 40 && next.side * this.x > next.gate) return lanes[i].track.at(s - next.s0, out);
        }
      }
      return track.at(s, out);
    }
    const arm = lanes[lane].track;
    if (s < 0) return track.at(from.s0 + s, out);
    if (s > arm.length) return track.at(from.s1 + s - arm.length, out);
    return arm.at(s, out);
  }

  point(s: number, x: number, y: number, out: Vector3, lane = this.lane): Vector3 {
    const f = this.frameAt(s, this.scratch, lane);
    return out.copy(f.p).addScaledVector(f.r, x).addScaledVector(f.u, y);
  }

  /** How far through the course the ball is, 0 to 1. */
  progress(): number {
    const from = this.course.lanes[this.lane].from;
    const along = from ? from.s0 + (this.s / this.course.lanes[this.lane].track.length) * (from.s1 - from.s0) : this.s;
    return clamp((along - START_S) / (this.course.finishS - START_S), 0, 1);
  }

  /** Where a slider or pendulum is across the road right now. */
  swingX(o: CourseObj): number {
    return o.x + (o.amp ?? 0) * Math.sin(this.clock * (o.speed ?? 1) + (o.phase ?? 0));
  }

  /** Where each windmill sail that is low enough to hit is crossing the road right now. */
  sailsAt(o: CourseObj): number[] {
    const out: number[] = [];
    for (let k = 0; k < 4; k++) {
      const angle = this.spinAngle(o) + (k * Math.PI) / 2;
      if (Math.cos(angle) > SAIL_LOW) out.push(SAIL * Math.sin(angle));
    }
    return out;
  }

  /** Is the ball over a stretch with no road? */
  overGap(): boolean {
    return this.course.gaps.some((g) => g.lane === this.lane && this.s > g.s0 && this.s < g.s1);
  }

  /** Is the ball on an escalator? */
  onLift(): boolean {
    return this.course.lifts.some((l) => l.lane === this.lane && this.s >= l.s0 && this.s <= l.s1);
  }

  spinAngle(o: CourseObj): number {
    return this.clock * (o.speed ?? 1) + (o.phase ?? 0);
  }

  /** A sensible racing line, used to set star times: chase goodies, dodge blockers, hug the inside. */
  private smartLine(): number {
    const hazards: { s: number; x: number; wide: number }[] = [];
    const wants: number[] = [];
    for (const i of this.byLane[this.lane]) {
      const o = this.course.objects[i];
      const ahead = o.s - this.s;
      if (ahead < 0.5 || ahead > 36 || this.done[i]) continue;
      if (o.kind === 'crate' || o.kind === 'goo') hazards.push({ s: ahead, x: o.x, wide: 2.3 });
      else if (o.kind === 'slider' || o.kind === 'pendulum') hazards.push({ s: ahead, x: this.swingX(o), wide: 2.4 });
      else if (o.kind === 'spinner') hazards.push({ s: ahead, x: o.x, wide: (o.len ?? 3.2) + 0.6 });
      else if (o.kind === 'windmill') for (const x of this.sailsAt(o)) hazards.push({ s: ahead, x, wide: 2.6 });
      else if (o.kind !== 'pin' && ahead < 26 && (o.y ?? 0) < 3) wants.push(o.x);
    }
    this.frameAt(this.s + 8, this.ahead);
    const edge = this.limit - 0.6;
    wants.push(clamp(this.ahead.k * 160, -edge, edge), this.x);
    const safe = (x: number) => hazards.every((h) => h.s > 20 || Math.abs(h.x - x) > h.wide);
    const pick = wants.find(safe);
    if (pick !== undefined) return pick;
    const room = (x: number) => Math.min(...hazards.map((h) => Math.abs(h.x - x) - h.wide));
    return [-3.8, -1.9, 0, 1.9, 3.8].sort((a, b) => room(b) - room(a))[0];
  }

  step(dt: number): void {
    const { lanes, track, objects, finishS } = this.course;
    this.dt = dt;
    this.clock += dt;

    if (this.countdown > 0) {
      this.countdown -= dt;
      const shown = Math.ceil(this.countdown);
      if (shown < this.lastTick) {
        this.lastTick = shown;
        this.emit({ type: shown > 0 ? 'tick' : 'go' });
      }
      if (this.countdown > 0) return;
      this.v = CRUISE * 0.6;
    }

    const f = this.frameAt(this.s, this.f);

    // Steering: the ball chases the finger; let go and it holds its line.
    this.knockT -= dt;
    // On an escalator the ball is carried: it drifts to the middle and steering does nothing.
    const riding = this.onLift();
    if (riding && !this.riding) this.emit({ type: 'lift' });
    this.riding = riding;
    const wanted = riding ? 0 : this.autopilot === 'smart' ? this.smartLine() : this.steer;
    const target = this.finished || this.knockT > 0 ? null : wanted;
    // On a wet or icy road the ball takes a moment to answer, and slides on when you let go.
    const grip = GRIP[this.course.mood];
    if (target !== null) {
      const wanted = clamp((target - this.x) * (riding ? 2.5 : 9), -16, 16);
      this.xv += (wanted - this.xv) * Math.min(1, dt * grip);
    } else {
      this.xv *= Math.exp(-Math.min(8, grip * 0.5) * dt);
    }
    this.x += this.xv * dt;
    const limit = this.limit;
    if (Math.abs(this.x) > limit) {
      this.x = Math.sign(this.x) * limit;
      if (this.xv * this.x > 0) this.xv = 0;
      if (target !== null && Math.abs(target) > limit && this.v > CRUISE * 0.75) {
        this.v -= 7 * dt;
        this.scrapeT -= dt;
        if (this.scrapeT <= 0) {
          this.scrapeT = 0.06;
          this.emit({ type: 'scrape' });
        }
      }
    }

    // Speed: always rolling, quicker downhill, and boosts fade slowly so chaining them pays off.
    this.turboT -= dt;
    if (this.finished) {
      this.v -= this.v * 1.7 * dt;
    } else if (riding) {
      // An escalator sets its own pace: any turbo ends there.
      this.turboT = 0;
      this.v += (LIFT_SPEED - this.v) * Math.min(1, dt * 6);
      this.time += dt;
    } else {
      if (this.v < CRUISE) this.v += 10 * dt;
      else this.v -= (this.v - CRUISE) * 0.24 * dt;
      this.v -= GRAVITY * f.t.y * dt;
      // Turbo holds a speed far above the usual limit, then it bleeds off quickly.
      if (this.turboT > 0) this.v = Math.max(this.v, TURBO_SPEED);
      else if (this.v > MAX_SPEED) this.v -= (this.v - MAX_SPEED) * 2.5 * dt;
      this.v = clamp(this.v, MIN_SPEED, TURBO_SPEED);
      this.time += dt;
    }
    this.boostT -= dt;

    // The inside of a bend is a shorter path, so taking the right line is genuinely faster.
    let before = this.s;
    this.s += (this.v * dt) / clamp(1 - f.k * this.x, 0.6, 1.5);

    if (this.lane === 0) {
      this.s = Math.min(track.length - 2, this.s);
      if (this.cameFrom && this.s > lanes[this.cameFrom].from!.s1 + 14) this.cameFrom = 0;
      for (let i = 1; i < lanes.length; i++) {
        const from = lanes[i].from!;
        if (before < from.s0 && this.s >= from.s0 && from.side * this.x > from.gate) {
          this.lane = i;
          this.s -= from.s0;
          before = -1;
          this.emit({ type: 'fork' });
          break;
        }
      }
    } else if (this.s >= lanes[this.lane].track.length) {
      this.s = lanes[this.lane].from!.s1 + this.s - lanes[this.lane].track.length;
      before = lanes[this.lane].from!.s1 - 0.01;
      this.cameFrom = this.lane;
      this.lane = 0;
    }

    // Where the road stops, fling the ball across to where it starts again.
    for (const gap of this.course.gaps) {
      if (gap.lane !== this.lane) continue;
      if (before < gap.s0 && this.s >= gap.s0) {
        // The arc is the same height every time, so rings and fruit hang where they can be reached, but speed is
        // kept: a boosted ball lands further on, and a slow one comes down short and has to skip the rest.
        this.v = Math.max(this.v, 30);
        this.vh = (13 * (gap.s1 - gap.s0 + 4)) / 43;
        this.h = Math.max(this.h, 0.01);
        this.emit({ type: 'launch' });
      } else if (this.h === 0 && this.s > gap.s0 && this.s < gap.s1 - 1) {
        // Landed short: skip on rather than roll along thin air.
        this.vh = 7;
        this.h = 0.01;
      }
    }

    if (this.h > 0 || this.vh > 0) {
      this.vh -= 26 * dt;
      this.h += this.vh * dt;
      if (this.h <= 0) {
        this.h = 0;
        this.vh = 0;
        this.emit({ type: 'land' });
      }
    }

    if (!this.finished) {
      for (const i of this.byLane[this.lane]) {
        const ds = objects[i].s - this.s;
        if (ds > 6) break;
        if (ds < -6 || this.done[i]) continue;
        this.touch(objects[i], i, before);
      }
      if (this.lane === 0 && this.s >= finishS) {
        this.finished = true;
        this.emit({ type: 'finish' });
      }
    } else {
      this.finishT += dt;
      if (this.finishT > 1.8 && !this.reported) {
        this.reported = true;
        this.emit({ type: 'results' });
      }
    }
  }

  private slow(factor: number): void {
    this.turboT = 0;
    this.v = Math.max(MIN_SPEED, Math.min(this.v, MAX_SPEED) * factor);
  }

  private touch(o: CourseObj, index: number, before: number): void {
    const ds = o.s - this.s;
    const crossed = before < o.s && this.s >= o.s;
    const dx = Math.abs(this.x - o.x);
    const ready = this.clock >= this.readyAt[index];
    switch (o.kind) {
      case 'pad':
        if (Math.abs(ds) < 3 && dx < 1.9 && this.h < 0.6 && ready) {
          this.readyAt[index] = Infinity;
          this.v = Math.max(this.v, Math.min(MAX_SPEED, Math.max(this.v, CRUISE) + 13));
          this.boostT = Math.max(this.boostT, 1.1);
          this.emit({ type: 'boost', index });
        }
        break;
      case 'turbo':
        if (Math.abs(ds) < 4 && dx < 2.6 && this.h < 0.6 && ready) {
          this.readyAt[index] = Infinity;
          this.turboT = TURBO_TIME;
          this.v = TURBO_SPEED;
          this.boostT = TURBO_TIME;
          this.emit({ type: 'turbo', index });
        }
        break;
      case 'crate':
        if (Math.abs(ds) < 1.4 && dx < 1.15 + BALL_RADIUS * 0.9 && this.h < 1.7) {
          this.done[index] = true;
          this.slow(0.5);
          this.emit({ type: 'crate', index });
        }
        break;
      case 'pin':
        if (Math.abs(ds) < 0.9 && dx < 0.4 + BALL_RADIUS * 0.9 && this.h < 1.2) {
          this.done[index] = true;
          this.v *= 0.97;
          this.emit({ type: 'pin', index });
        }
        break;
      case 'slider':
      case 'pendulum': {
        const sx = this.swingX(o);
        if (Math.abs(ds) < 1.2 && Math.abs(this.x - sx) < 1 + BALL_RADIUS * 0.9 && this.h < 2 && ready) {
          this.readyAt[index] = this.clock + 1;
          this.slow(0.55);
          this.xv = Math.sign(this.x - sx || 1) * 10;
          this.knockT = 0.25;
          this.emit({ type: 'bump', index });
        }
        break;
      }
      case 'spinner': {
        // Work out where the ball is in the bar's own frame: along it, and across it.
        const angle = this.spinAngle(o);
        const lx = this.x - o.x;
        const along = lx * Math.cos(angle) - ds * Math.sin(angle);
        const across = lx * Math.sin(angle) + ds * Math.cos(angle);
        if (Math.abs(along) < (o.len ?? 3.2) + 0.3 && Math.abs(across) < 0.45 + BALL_RADIUS * 0.85 && this.h < 1.6 && ready) {
          this.readyAt[index] = this.clock + 0.8;
          this.slow(0.6);
          this.xv = Math.sign(lx || 1) * 9;
          this.knockT = 0.25;
          this.emit({ type: 'bump', index });
        }
        break;
      }
      case 'windmill':
        if (Math.abs(ds) < 1.2 && this.h < 2.2 && ready) {
          const sail = this.sailsAt(o).find((x) => Math.abs(this.x - x) < 1.4);
          if (sail !== undefined) {
            this.readyAt[index] = this.clock + 1;
            this.slow(0.55);
            this.xv = Math.sign(this.x - sail || 1) * 10;
            this.knockT = 0.25;
            this.emit({ type: 'bump', index });
          }
        }
        break;
      case 'goo':
        if (Math.abs(ds) < (o.len ?? 8) / 2 && dx < 1.9 && this.h < 0.3) {
          this.turboT = 0;
          this.v -= Math.max(0, this.v - 15) * 4 * this.dt;
          this.gooT -= this.dt;
          if (this.gooT <= 0) {
            this.gooT = 0.12;
            this.emit({ type: 'goo' });
          }
        }
        break;
      case 'ring':
        if (crossed && dx < 1.75 && Math.abs(this.h + BALL_RADIUS - (o.y ?? 2)) < 2.4) {
          this.done[index] = true;
          this.v = Math.max(this.v, Math.min(MAX_SPEED, this.v + 6));
          this.boostT = Math.max(this.boostT, 0.5);
          this.emit({ type: 'ring', index });
        }
        break;
      case 'jump':
        if (crossed && dx < 2.3 && this.h === 0) {
          this.vh = o.power ?? 11.5;
          this.h = 0.01;
          this.v = Math.max(this.v, Math.min(MAX_SPEED, this.v + 3));
          this.emit({ type: 'jump', index });
        }
        break;
      case 'pickup':
        if (Math.abs(ds) < 1.5 && dx < 1.6 && Math.abs(this.h + BALL_RADIUS - (o.y ?? 1.3)) < 1.9) {
          this.done[index] = true;
          const id = this.items[index]!;
          this.bonuses.push(id);
          this.emit({ type: 'pickup', index, id });
        }
        break;
    }
  }
}

/** Play a course hands-free and return the finish time in seconds, or Infinity if it never finishes. */
export function timeCourse(course: Course, level: Level, autopilot: Autopilot): number {
  const sim = new Sim(course, level, () => {}, () => 0);
  sim.autopilot = autopilot;
  sim.skipCountdown();
  for (let step = 0; step < 600 / TICK && !sim.finished; step++) sim.step(TICK);
  return sim.finished ? sim.time : Infinity;
}
