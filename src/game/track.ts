import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

/** Distance between stored centreline samples. */
export const STEP = 0.5;

export interface Frame {
  p: Vector3;
  /** Forward. */
  t: Vector3;
  /** Surface normal. */
  u: Vector3;
  /** Player's right. */
  r: Vector3;
  /** Sideways curvature: positive when the course bends right. */
  k: number;
}

export interface Segment {
  len: number;
  /** Total heading change in radians. Positive turns right. */
  turn?: number;
  /** Total pitch change in radians. Positive climbs. */
  pitch?: number;
  /** Peak banking in radians, eased in and out. Positive drops the right edge. */
  bank?: number;
  /** Total barrel-roll in radians, kept afterwards: a full twist is 2π. */
  roll?: number;
  /** Sideways drift across the segment, used to stop a loop meeting itself. Positive is right. */
  shift?: number;
  kind?: 'loop' | 'spiral' | 'twist';
}

export interface Span {
  kind: string;
  s0: number;
  s1: number;
}

/** Where a track starts, or where it has got to: enough to continue building from that spot. */
export interface Pose {
  pos: Vector3;
  yaw: number;
  pitch: number;
  roll: number;
}

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export function makeFrame(): Frame {
  return { p: new Vector3(), t: new Vector3(), u: new Vector3(), r: new Vector3(), k: 0 };
}

export class Track {
  readonly frames: Frame[] = [];
  readonly spans: Span[] = [];
  readonly length: number;
  private readonly yaws: number[] = [];
  private readonly pitches: number[] = [];
  private readonly rolls: number[] = [];

  constructor(
    segments: Segment[],
    readonly half = 5,
    start?: Pose,
  ) {
    const pos = start ? start.pos.clone() : new Vector3();
    let yaw = start?.yaw ?? 0;
    let pitch = start?.pitch ?? 0;
    let roll = start?.roll ?? 0;
    let s = 0;
    const push = (bank: number, k: number) => {
      const sy = Math.sin(yaw);
      const cy = Math.cos(yaw);
      const sp = Math.sin(pitch);
      const cp = Math.cos(pitch);
      const t = new Vector3(sy * cp, sp, cy * cp);
      const u = new Vector3(-sy * sp, cp, -cy * sp);
      const r = new Vector3(-cy, 0, sy);
      const cb = Math.cos(bank);
      const sb = Math.sin(bank);
      const ub = u.clone().multiplyScalar(cb).addScaledVector(r, sb);
      const rb = r.clone().multiplyScalar(cb).addScaledVector(u, -sb);
      this.frames.push({ p: pos.clone(), t, u: ub, r: rb, k });
      this.yaws.push(yaw);
      this.pitches.push(pitch);
      this.rolls.push(roll);
    };

    push(roll, 0);
    for (const seg of segments) {
      const n = Math.max(1, Math.round(seg.len / STEP));
      const len = n * STEP;
      const dYaw = -(seg.turn ?? 0) / n;
      const dPitch = (seg.pitch ?? 0) / n;
      const dRoll = (seg.roll ?? 0) / n;
      const shiftDir = new Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
      if (seg.kind) this.spans.push({ kind: seg.kind, s0: s, s1: s + len });
      let shifted = 0;
      for (let i = 0; i < n; i++) {
        const at = (i + 1) / n;
        yaw += dYaw;
        pitch += dPitch;
        roll += dRoll;
        pos.x += Math.sin(yaw) * Math.cos(pitch) * STEP;
        pos.y += Math.sin(pitch) * STEP;
        pos.z += Math.cos(yaw) * Math.cos(pitch) * STEP;
        if (seg.shift) {
          const target = seg.shift * smooth(at);
          pos.addScaledVector(shiftDir, target - shifted);
          shifted = target;
        }
        const bank = (seg.bank ?? 0) * smooth((Math.min(at, 1 - at) * len) / 14);
        push(roll + bank, (-dYaw / STEP) * Math.cos(pitch));
      }
      s += len;
    }
    this.length = s;
    this.square();
  }

  /** A shifted or bent path no longer points exactly along its turtle heading, so square the frames up to it. */
  private square(): void {
    const last = this.frames.length - 1;
    for (let i = 0; i <= last; i++) {
      const f = this.frames[i];
      const a = this.frames[Math.max(0, i - 1)].p;
      const b = this.frames[Math.min(last, i + 1)].p;
      f.t.subVectors(b, a).normalize();
      f.u.addScaledVector(f.t, -f.u.dot(f.t)).normalize();
      f.r.crossVectors(f.t, f.u).normalize();
    }
  }

  /** The pose to start another track from at distance `s`. */
  poseAt(s: number): Pose {
    const i = Math.min(this.frames.length - 1, Math.max(0, Math.round(s / STEP)));
    return { pos: this.frames[i].p.clone(), yaw: this.yaws[i], pitch: this.pitches[i], roll: this.rolls[i] };
  }

  /** Ease the whole path so it ends exactly at `target`. Returns how far the end had to move. */
  bendTo(target: Vector3): number {
    const last = this.frames.length - 1;
    const error = target.clone().sub(this.frames[last].p);
    this.frames.forEach((f, i) => f.p.addScaledVector(error, smooth(i / last)));
    this.square();
    return error.length();
  }

  /** Interpolated frame at distance `s`, written into `out`. */
  at(s: number, out: Frame): Frame {
    const x = Math.min(this.frames.length - 1.001, Math.max(0, s / STEP));
    const i = Math.floor(x);
    const w = x - i;
    const a = this.frames[i];
    const b = this.frames[i + 1];
    out.p.lerpVectors(a.p, b.p, w);
    out.t.lerpVectors(a.t, b.t, w).normalize();
    out.u.lerpVectors(a.u, b.u, w).normalize();
    out.r.lerpVectors(a.r, b.r, w).normalize();
    out.k = a.k + (b.k - a.k) * w;
    return out;
  }

  /** World position of a point `x` to the right of the centreline and `y` above the surface. */
  point(s: number, x: number, y: number, out = new Vector3()): Vector3 {
    const f = this.at(s, SCRATCH);
    return out.copy(f.p).addScaledVector(f.r, x).addScaledVector(f.u, y);
  }

  inSpan(kind: string, s: number): boolean {
    return this.spans.some((span) => span.kind === kind && s >= span.s0 && s <= span.s1);
  }
}

const SCRATCH = makeFrame();

export interface ExtrudeOptions {
  s0?: number;
  s1?: number;
  /** Texture repeats per unit of distance. */
  vScale?: number;
  /** Use every nth centreline sample. */
  stride?: number;
  /** Share vertices across profile corners for a rounded look. */
  smooth?: boolean;
}

/**
 * Sweep a cross-section along the track. Profile points are [right, up] offsets; walk the outline clockwise
 * (left to right across the top) so faces point outwards.
 */
export function extrude(track: Track, profile: [number, number][], options: ExtrudeOptions = {}): BufferGeometry {
  const stride = options.stride ?? 1;
  const vScale = options.vScale ?? 0.1;
  const i0 = Math.max(0, Math.round((options.s0 ?? 0) / STEP));
  const i1 = Math.min(track.frames.length - 1, Math.round((options.s1 ?? track.length) / STEP));
  const rows: number[] = [];
  for (let i = i0; i < i1; i += stride) rows.push(i);
  rows.push(i1);

  const lengths = [0];
  for (let j = 1; j < profile.length; j++) {
    lengths.push(lengths[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
  }
  const total = lengths[lengths.length - 1] || 1;

  // Flat shading needs each profile edge to own its two corners.
  const columns: { point: [number, number]; u: number }[] = [];
  if (options.smooth) {
    profile.forEach((point, j) => columns.push({ point, u: lengths[j] / total }));
  } else {
    for (let j = 0; j < profile.length - 1; j++) {
      columns.push({ point: profile[j], u: lengths[j] / total });
      columns.push({ point: profile[j + 1], u: lengths[j + 1] / total });
    }
  }
  const perRow = columns.length;
  const positions = new Float32Array(rows.length * perRow * 3);
  const uvs = new Float32Array(rows.length * perRow * 2);
  const v = new Vector3();
  rows.forEach((frameIndex, row) => {
    const f = track.frames[frameIndex];
    columns.forEach((column, c) => {
      v.copy(f.p).addScaledVector(f.r, column.point[0]).addScaledVector(f.u, column.point[1]);
      const o = (row * perRow + c) * 3;
      positions[o] = v.x;
      positions[o + 1] = v.y;
      positions[o + 2] = v.z;
      const q = (row * perRow + c) * 2;
      uvs[q] = column.u;
      uvs[q + 1] = frameIndex * STEP * vScale;
    });
  });

  const index: number[] = [];
  const edgeStep = options.smooth ? 1 : 2;
  for (let row = 0; row < rows.length - 1; row++) {
    for (let c = 0; c < perRow - 1; c += edgeStep) {
      const a = row * perRow + c;
      const b = a + 1;
      const a2 = a + perRow;
      const b2 = b + perRow;
      index.push(a, b, a2, b, b2, a2);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
