import type { Theme } from './themes';
import { STEP, Track, type Segment, type Span } from './track';

export type ObjKind = 'pad' | 'turbo' | 'crate' | 'slider' | 'pendulum' | 'spinner' | 'windmill' | 'pin' | 'goo' | 'pickup' | 'jump' | 'ring';

/** Pickups marked with this become the level's own fruit rather than a random extra. */
export const LEVEL_FRUIT = '@fruit';

export interface CourseObj {
  kind: ObjKind;
  /** Which lane it sits on: 0 is the main route, higher numbers are fork arms. */
  lane: number;
  s: number;
  x: number;
  /** Height above the road (pickups and rings). */
  y?: number;
  /** Sideways travel of a slider or pendulum. */
  amp?: number;
  speed?: number;
  phase?: number;
  /** Launch speed of a jump. */
  power?: number;
  /** Half-length of a spinner bar, or the length of a goo patch. */
  len?: number;
  /** A fixed ingredient for a pickup. */
  item?: string;
}

export type LaneSpan = Span & { lane: number };

/** The weather on a course. Rain and snow make the road slippery. */
export type Mood = 'sunny' | 'night' | 'rain' | 'snow';

/** How quickly the ball answers the controls in each mood, in changes per second. Sunny and night are instant. */
export const GRIP: Record<Mood, number> = { sunny: Infinity, night: Infinity, rain: 5.5, snow: 3 };

export interface Lane {
  track: Track;
  /** For a fork arm: where it leaves and rejoins the main route, and who takes it. */
  from?: { s0: number; s1: number; side: 1 | -1; gate: number };
  /** How far the arm had to be bent to rejoin. Large values mean a badly designed fork. */
  drift: number;
}

export interface Course {
  lanes: Lane[];
  /** The main route: lanes[0].track. */
  track: Track;
  objects: CourseObj[];
  tunnels: LaneSpan[];
  /** Stretches with no road at all: the ball is flung across. */
  gaps: LaneSpan[];
  /** Escalators: the ball is carried along at a steady speed and cannot be steered. */
  lifts: LaneSpan[];
  finishS: number;
  theme: Theme;
  mood: Mood;
}

interface Arm {
  segments: Segment[];
  s0: number;
  s1: number;
  side: 1 | -1;
  gate: number;
}

interface Shared {
  objects: CourseObj[];
  tunnels: LaneSpan[];
  gaps: LaneSpan[];
  lifts: LaneSpan[];
  arms: Arm[];
}

export interface Snapshot {
  segments: number;
  objects: number;
  tunnels: number;
  gaps: number;
  lifts: number;
  arms: number;
  s: number;
  pitch: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const snap = (len: number) => Math.max(1, Math.round(len / STEP)) * STEP;

/** Air two unrelated bits of track must leave between their edges. At the normal width that is 12 between centres. */
const MARGIN = 2;

/** Lays a course out piece by piece; objects are placed a distance ahead of the current end. */
export class CourseBuilder {
  readonly segments: Segment[] = [];
  s = 0;
  /** Set to -1 to build everything that follows as its mirror image. */
  flip: 1 | -1 = 1;
  private pitch = 0;

  constructor(
    readonly half = 5,
    private readonly shared: Shared = { objects: [], tunnels: [], gaps: [], lifts: [], arms: [] },
    private readonly lane = 0,
  ) {}

  get objects(): CourseObj[] {
    return this.shared.objects;
  }

  // ---- shape ----

  private push(segment: Segment): this {
    segment.len = snap(segment.len);
    this.segments.push(segment);
    this.s += segment.len;
    return this;
  }

  straight(len: number): this {
    return this.push({ len });
  }

  /** Squeeze or spread the road to a new half-width over `len` (5 is normal). It stays that wide until changed. */
  width(half: number, len = 16): this {
    return this.push({ len, half });
  }

  /** Positive degrees turn right. `bank` overrides the gentle default, e.g. 1 for a wall-ride. */
  turn(deg: number, radius: number, bank = Math.min(0.32, 9 / radius)): this {
    const signed = deg * this.flip;
    return this.push({ len: Math.abs(rad(deg)) * radius, turn: rad(signed), bank: Math.sign(signed) * bank });
  }

  /** Ease the slope to `deg` (positive climbs) over `len`. */
  pitchTo(deg: number, len = 14): this {
    const target = rad(deg);
    const delta = target - this.pitch;
    this.pitch = target;
    return this.push({ len, pitch: delta });
  }

  /** A full vertical loop, sliding sideways so the exit clears the entry. */
  loop(radius: number, side: 1 | -1): this {
    return this.push({ len: 2 * Math.PI * radius, pitch: 2 * Math.PI, shift: side * this.flip * 14.5, kind: 'loop' });
  }

  /** A corkscrew. Positive turns go right; a positive drop descends, a negative one climbs. */
  spiral(turns: number, radius: number, dropPerTurn: number): this {
    const angle = Math.atan(dropPerTurn / (2 * Math.PI * radius));
    const before = this.pitch;
    this.pitchTo((-angle * 180) / Math.PI, 12);
    this.push({
      len: (Math.abs(turns) * 2 * Math.PI * radius) / Math.cos(angle),
      turn: turns * this.flip * 2 * Math.PI,
      bank: Math.sign(turns * this.flip) * 0.22,
      kind: 'spiral',
    });
    return this.pitchTo((before * 180) / Math.PI, 12);
  }

  /** Barrel-roll the whole track about its own axis. Whole turns only, so it ends the right way up. */
  twist(len: number, turns = 1): this {
    return this.push({ len, roll: Math.round(turns) * this.flip * 2 * Math.PI, kind: 'twist' });
  }

  /**
   * Split the route. `main` continues this builder; `arm` lays an alternative that must end where `main` does.
   * A ball on the `side` half of the road (further out than `gate`) takes the arm.
   */
  fork(side: 1 | -1, arm: (b: CourseBuilder) => void, main: (b: CourseBuilder) => void, gate = 0): this {
    if (this.lane !== 0) throw new Error('A fork arm cannot fork again: arms always leave and rejoin the main route');
    const index = this.shared.arms.length;
    const record: Arm = { segments: [], s0: this.s, s1: this.s, side: (side * this.flip) as 1 | -1, gate };
    this.shared.arms.push(record);
    const branch = new CourseBuilder(this.half, this.shared, index + 1);
    branch.flip = this.flip;
    branch.pitch = this.pitch;
    arm(branch);
    record.segments = branch.segments;
    main(this);
    record.s1 = this.s;
    return this;
  }

  // ---- things on the road ----

  add(kind: ObjKind, ahead: number, x: number, extra: Partial<CourseObj> = {}): this {
    this.shared.objects.push({ kind, lane: this.lane, s: this.s + ahead, x: x * this.flip, ...extra });
    return this;
  }

  tunnel(ahead: number, len: number): this {
    this.shared.tunnels.push({ kind: 'tunnel', lane: this.lane, s0: this.s + ahead, s1: this.s + ahead + len });
    return this;
  }

  /** Take the road away for `len`: the ball is launched at the near edge and lands on the far one. */
  gap(ahead: number, len: number): this {
    this.shared.gaps.push({ kind: 'gap', lane: this.lane, s0: this.s + ahead, s1: this.s + ahead + len });
    return this;
  }

  /** An escalator: carries the ball at a steady speed whatever the slope. */
  lift(ahead: number, len: number): this {
    this.shared.lifts.push({ kind: 'lift', lane: this.lane, s0: this.s + ahead, s1: this.s + ahead + len });
    return this;
  }

  /** An upright windmill on an arch: its sails sweep across the road one after another. */
  windmill(ahead: number, speed = 1.1, phase = 0): this {
    return this.add('windmill', ahead, 0, { speed: speed * this.flip, phase });
  }

  pad(ahead: number, x: number): this {
    return this.add('pad', ahead, x);
  }

  /** A turbo pad: far faster than a speed pad, for a couple of seconds. */
  turbo(ahead: number, x: number): this {
    return this.add('turbo', ahead, x);
  }

  crates(ahead: number, ...xs: number[]): this {
    for (const x of xs) this.add('crate', ahead, x);
    return this;
  }

  slider(ahead: number, amp = 3, speed = 1.6, phase = 0): this {
    return this.add('slider', ahead, 0, { amp, speed, phase });
  }

  /** A ball swinging from an arch across the road. */
  pendulum(ahead: number, amp = 3.4, speed = 1.8, phase = 0): this {
    return this.add('pendulum', ahead, 0, { amp, speed, phase });
  }

  /** A windmill bar turning flat on the road. */
  spinner(ahead: number, x: number, speed = 1.6, len = 3.2): this {
    return this.add('spinner', ahead, x, { speed: speed * this.flip, len, phase: ahead });
  }

  /** A triangle of skittles: fun to smash, and they barely slow you. */
  pins(ahead: number, x: number): this {
    const rows = [[0], [-0.55, 0.55], [-1.1, 0, 1.1]];
    rows.forEach((row, n) => row.forEach((dx) => this.add('pin', ahead + n * 1.1, x + dx * this.flip)));
    return this;
  }

  /** A sticky patch that drags the ball down to a crawl. */
  goo(ahead: number, x: number, len = 8): this {
    return this.add('goo', ahead, x, { len });
  }

  pickup(ahead: number, x: number, y = 1.3, item?: string): this {
    return this.add('pickup', ahead, x, { y, ...(item ? { item } : {}) });
  }

  /** A pickup that is always the level's own fruit: the reward for the harder line. */
  fruit(ahead: number, x: number, y = 1.3): this {
    return this.pickup(ahead, x, y, LEVEL_FRUIT);
  }

  ring(ahead: number, x: number, y = 2): this {
    return this.add('ring', ahead, x, { y });
  }

  jump(ahead: number, x: number, power = 11.5): this {
    return this.add('jump', ahead, x, { power });
  }

  // ---- trial and error ----

  snapshot(): Snapshot {
    return {
      segments: this.segments.length,
      objects: this.shared.objects.length,
      tunnels: this.shared.tunnels.length,
      gaps: this.shared.gaps.length,
      lifts: this.shared.lifts.length,
      arms: this.shared.arms.length,
      s: this.s,
      pitch: this.pitch,
    };
  }

  restore(to: Snapshot): void {
    this.segments.length = to.segments;
    this.shared.objects.length = to.objects;
    this.shared.tunnels.length = to.tunnels;
    this.shared.gaps.length = to.gaps;
    this.shared.lifts.length = to.lifts;
    this.shared.arms.length = to.arms;
    this.s = to.s;
    this.pitch = to.pitch;
  }

  /** Build the tracks for the main route and every fork arm. */
  layout(): Lane[] {
    const main = new Track(this.segments, this.half);
    const lanes: Lane[] = [{ track: main, drift: 0 }];
    for (const arm of this.shared.arms) {
      const track = new Track(arm.segments, this.half, main.poseAt(arm.s0));
      const drift = track.bendTo(main.poseAt(arm.s1).pos);
      lanes.push({ track, from: { s0: arm.s0, s1: arm.s1, side: arm.side, gate: arm.gate }, drift });
    }
    return lanes;
  }

  /** True if anything laid since `since` passes too close to another part of the course. */
  clashes(since: Snapshot): boolean {
    return findClash(this.layout(), since.s, since.arms + 1) !== null;
  }

  build(theme: Theme, mood: Mood = 'sunny'): Course {
    const lanes = this.layout();
    const track = lanes[0].track;
    return {
      lanes,
      track,
      objects: [...this.shared.objects].sort((a, b) => a.lane - b.lane || a.s - b.s),
      tunnels: this.shared.tunnels,
      gaps: this.shared.gaps,
      lifts: this.shared.lifts,
      finishS: track.length - 34,
      theme,
      mood,
    };
  }
}

interface Sample {
  half: number;
  x: number;
  y: number;
  z: number;
  lane: number;
  s: number;
}

/**
 * Look for two unrelated bits of track with less than MARGIN between their edges. Only samples on the main route from `fromS`, or on
 * arms from lane `fromLane`, are tested (against everything), so a builder can check just what it has added.
 */
export function findClash(lanes: Lane[], fromS = 0, fromLane = 1): string | null {
  // Big enough that anything too close to a sample is in its own grid cell or the next one, even on wide road.
  const cell = 24;
  const grid = new Map<string, Sample[]>();
  const fresh: Sample[] = [];
  lanes.forEach((lane, index) => {
    const frames = lane.track.frames;
    for (let i = 0; i < frames.length; i += 2) {
      const p = frames[i].p;
      const sample = { half: lane.track.halfOf(i), x: p.x, y: p.y, z: p.z, lane: index, s: i * STEP };
      const key = `${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`;
      const bucket = grid.get(key);
      if (bucket) bucket.push(sample);
      else grid.set(key, [sample]);
      if (index === 0 ? sample.s >= fromS : index >= fromLane) fresh.push(sample);
    }
  });

  /** Neighbouring stretches of the same route, and a fork arm near where it leaves or rejoins, are meant to be close. */
  const related = (a: Sample, b: Sample): boolean => {
    if (a.lane === b.lane) return Math.abs(a.s - b.s) < 60;
    const [arm, main] = a.lane === 0 ? [b, a] : [a, b];
    if (main.lane !== 0) {
      // Two arms of the same three-way fork start and end on top of each other.
      const one = lanes[a.lane];
      const two = lanes[b.lane];
      if (one.from!.s0 !== two.from!.s0) return false;
      return (a.s < 55 && b.s < 55) || (a.s > one.track.length - 55 && b.s > two.track.length - 55);
    }
    const lane = lanes[arm.lane];
    const from = lane.from!;
    return (arm.s < 55 && Math.abs(main.s - from.s0) < 70) || (arm.s > lane.track.length - 55 && Math.abs(main.s - from.s1) < 70);
  };

  for (const a of fresh) {
    const cx = Math.floor(a.x / cell);
    const cz = Math.floor(a.z / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (const b of grid.get(`${cx + dx},${cz + dz}`) ?? []) {
          if (related(a, b)) continue;
          const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
          if (d < a.half + b.half + MARGIN) return `lane ${a.lane} s=${a.s} is ${d.toFixed(1)} from lane ${b.lane} s=${b.s}`;
        }
      }
    }
  }
  return null;
}
