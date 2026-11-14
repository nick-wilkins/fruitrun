import { STEP, Track, type Segment, type Span } from './track';

export type ObjKind = 'pad' | 'crate' | 'slider' | 'pickup' | 'jump' | 'ring';

export interface CourseObj {
  kind: ObjKind;
  s: number;
  x: number;
  /** Height above the road (pickups). */
  y?: number;
  /** Sideways travel of a slider. */
  amp?: number;
  speed?: number;
  phase?: number;
}

export interface Theme {
  skyTop: string;
  skyBottom: string;
  fog: string;
  ground: string;
  groundDark: string;
  road: string;
  roadLine: string;
  kerbA: string;
  kerbB: string;
  under: string;
  tunnelA: string;
  tunnelB: string;
  canopy: string[];
  fruit: string;
}

export interface Course {
  track: Track;
  objects: CourseObj[];
  tunnels: Span[];
  finishS: number;
  theme: Theme;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const snap = (len: number) => Math.max(1, Math.round(len / STEP)) * STEP;

/** Lays a course out piece by piece; objects are placed a distance ahead of the current end. */
export class CourseBuilder {
  readonly segments: Segment[] = [];
  readonly objects: CourseObj[] = [];
  readonly tunnels: Span[] = [];
  s = 0;
  private pitch = 0;

  private push(segment: Segment): this {
    segment.len = snap(segment.len);
    this.segments.push(segment);
    this.s += segment.len;
    return this;
  }

  straight(len: number): this {
    return this.push({ len });
  }

  /** Positive degrees turn right. */
  turn(deg: number, radius: number): this {
    const bank = Math.sign(deg) * Math.min(0.32, 9 / radius);
    return this.push({ len: Math.abs(rad(deg)) * radius, turn: rad(deg), bank });
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
    return this.push({ len: 2 * Math.PI * radius, pitch: 2 * Math.PI, shift: side * 14.5, kind: 'loop' });
  }

  /** A descending corkscrew. Positive turns go right. */
  spiral(turns: number, radius: number, dropPerTurn: number): this {
    const angle = Math.atan(dropPerTurn / (2 * Math.PI * radius));
    const dir = Math.sign(turns);
    const before = this.pitch;
    this.pitchTo((-angle * 180) / Math.PI, 12);
    this.push({
      len: (Math.abs(turns) * 2 * Math.PI * radius) / Math.cos(angle),
      turn: turns * 2 * Math.PI,
      bank: dir * 0.22,
      kind: 'spiral',
    });
    return this.pitchTo((before * 180) / Math.PI, 12);
  }

  tunnel(ahead: number, len: number): this {
    this.tunnels.push({ kind: 'tunnel', s0: this.s + ahead, s1: this.s + ahead + len });
    return this;
  }

  add(kind: ObjKind, ahead: number, x: number, extra: Partial<CourseObj> = {}): this {
    this.objects.push({ kind, s: this.s + ahead, x, ...extra });
    return this;
  }

  pad(ahead: number, x: number): this {
    return this.add('pad', ahead, x);
  }

  crates(ahead: number, ...xs: number[]): this {
    for (const x of xs) this.add('crate', ahead, x);
    return this;
  }

  slider(ahead: number, amp = 3, speed = 1.6, phase = 0): this {
    return this.add('slider', ahead, 0, { amp, speed, phase });
  }

  pickup(ahead: number, x: number, y = 1.3): this {
    return this.add('pickup', ahead, x, { y });
  }

  ring(ahead: number, x: number): this {
    return this.add('ring', ahead, x);
  }

  jump(ahead: number, x: number): this {
    return this.add('jump', ahead, x);
  }

  build(theme: Theme, half = 5): Course {
    const track = new Track(this.segments, half);
    return {
      track,
      objects: [...this.objects].sort((a, b) => a.s - b.s),
      tunnels: this.tunnels,
      finishS: track.length - 34,
      theme,
    };
  }
}

const ORCHARD: Theme = {
  skyTop: '#2f9bff',
  skyBottom: '#c9f0ff',
  fog: '#bfe8ff',
  ground: '#7fd14f',
  groundDark: '#58b23a',
  road: '#f2d7a0',
  roadLine: '#ffffff',
  kerbA: '#ff4d4d',
  kerbB: '#ffffff',
  under: '#b8793e',
  tunnelA: '#ff5a5a',
  tunnelB: '#ffd23f',
  canopy: ['#3fae3a', '#58c244', '#2f9a3f'],
  fruit: '#e8302a',
};

/** Level 1, Apple Orchard: a gentle tour of every course feature. */
export function buildAppleOrchard(): Course {
  const b = new CourseBuilder();

  // Start straight.
  b.pad(34, 0).pickup(52, -3).pickup(66, 3);
  b.straight(80);

  // S-bend: rings mark the fast inside line.
  b.ring(16, 2.6).turn(35, 50);
  b.ring(16, -2.6).turn(-35, 50);

  // Downhill dash.
  b.pitchTo(-9);
  b.pad(8, -3).pad(30, 3).pickup(42, -3).pad(54, 0);
  b.straight(70);
  b.pitchTo(0);

  // Crate field: one open lane in every row.
  b.crates(16, -3, 0).crates(42, 0, 3).crates(68, -3, 3).pickup(68, 0).crates(92, -3, 0).pad(100, 3);
  b.straight(112);

  // Big banked hairpin.
  b.pad(26, 3).ring(48, 3).pickup(66, 3.2).pad(84, 3).ring(104, 3).crates(70, -2.5);
  b.turn(180, 40);

  // Tunnel with sliding bumpers.
  b.tunnel(6, 90);
  b.slider(30, 3, 1.5).pickup(46, 0).slider(62, 3, 1.5, Math.PI).pickup(76, -3).pad(90, 0);
  b.straight(104);

  // First loop.
  b.pad(4, 0).straight(18);
  b.pickup(47, 0);
  b.loop(15, -1);

  // Jump the crates, or sneak down the left lane.
  b.slider(14, 2.6, 1.9).jump(36, 1.6).pickup(45, 1.6, 3.4).crates(50, 0, 3.1).pad(64, -3);
  b.straight(76);

  b.ring(26, -3).pickup(40, -3.2);
  b.turn(-90, 36);

  // Hilltop.
  b.pitchTo(9);
  b.pickup(14, 0).straight(24);
  b.pitchTo(0, 16);
  b.pad(2, 0).straight(12);

  // Corkscrew down.
  b.pad(40, -2.5).pickup(70, 3.2).crates(112, -0.5).pickup(150, 3.2).pad(178, -2.5).crates(232, 0.5).pickup(262, 3.2).pad(296, 0);
  b.spiral(2, 24, 13);

  b.pad(10, 0).slider(30, 3, 2).pad(48, -3).pickup(40, 3);
  b.straight(62);

  b.ring(30, 3).pad(50, 3);
  b.turn(90, 40);

  // Wiggles.
  b.pickup(12, -3).turn(-45, 30);
  b.crates(10, -3).pickup(24, 3.2).ring(30, 3).turn(90, 30);
  b.crates(6, 3).pickup(14, -3.2).turn(-45, 30);

  // Second, bigger loop.
  b.pad(4, 0).pad(16, 0).straight(26);
  b.pickup(56, 0);
  b.loop(18, 1);

  // Curved tunnel.
  b.straight(14);
  b.tunnel(2, 66);
  b.slider(20, 2.4, 1.7).pickup(36, -3.2).ring(52, -3);
  b.turn(-90, 45);

  // Final downhill sprint.
  b.pitchTo(-8);
  b.pad(6, 0).crates(24, -3).pad(34, 3).crates(52, 3).pad(62, -3).crates(80, 0).pad(90, 0).pickup(44, 0).pickup(72, 3);
  b.straight(104);
  b.pitchTo(0);
  b.straight(64);

  return b.build(ORCHARD);
}
