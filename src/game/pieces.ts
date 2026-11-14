import type { CourseBuilder } from './course';

export type Rng = () => number;

/** A stretch of course. `d` is the level's difficulty from 0 (gentle) to 1 (busy). Every piece ends level. */
export type Piece = (b: CourseBuilder, r: Rng, d: number) => void;

const LANES = [-3, 0, 3];
const lane = (r: Rng) => LANES[Math.floor(r() * 3)];
const side = (r: Rng): 1 | -1 => (r() < 0.5 ? 1 : -1);
const others = (x: number) => LANES.filter((l) => l !== x);
const rad = (deg: number) => (deg * Math.PI) / 180;

/** One side of a fork: swing out, run parallel for `middle`, swing back to the original line. */
function bulge(b: CourseBuilder, dir: 1 | -1, middle: (b: CourseBuilder) => void, angle = 28, radius = 30, out = 14): void {
  b.turn(dir * angle, radius).straight(out).turn(-dir * angle, radius);
  middle(b);
  b.turn(-dir * angle, radius).straight(out).turn(dir * angle, radius);
}

/** How far into a fork the two roads still overlap: nothing solid goes on the main route before this. */
const PARTED = 54;

/** Straight-line distance a bulge covers, so a straight alternative can be made to match. */
const bulgeAdvance = (middle: number, angle = 28, radius = 30, out = 14) =>
  4 * radius * Math.sin(rad(angle)) + 2 * out * Math.cos(rad(angle)) + middle;

export const PIECES = {
  /** Breather: pads and pickups down a straight. */
  padStraight(b, r) {
    const x = lane(r);
    b.pad(10, x).pickup(26, others(x)[0]).pad(40, others(x)[1]).pickup(52, x);
    b.straight(62);
  },

  /** Long banked bend with the goodies on the fast inside line. */
  sweeper(b, r, d) {
    const deg = 110 + Math.floor(r() * 70);
    const radius = 38 + r() * 10;
    const len = rad(deg) * radius;
    b.pad(len * 0.15, 3).ring(len * 0.4, 3).pickup(len * 0.55, 3.2).pad(len * 0.75, 3);
    if (d > 0.25) b.crates(len * 0.5, -2.5);
    if (d > 0.6) b.crates(len * 0.88, 0);
    b.turn(deg, radius);
  },

  /** Tight hairpin tipped right over like a wall of death. */
  hairpinWall(b) {
    const radius = 30;
    const len = Math.PI * radius;
    b.pad(4, 0).pickup(len * 0.25, -2).fruit(len * 0.5, -3.4).pickup(len * 0.75, -2).ring(len * 0.5, 2.5).pad(len * 0.9, 0);
    b.turn(180, radius, 0.95);
  },

  /** Left-right-left wiggle with a ring on each apex. */
  sBends(b, r, d) {
    const first = side(r);
    for (let i = 0; i < 3; i++) {
      const dir = (i % 2 ? -first : first) as 1 | -1;
      b.ring(14, dir * 3).pickup(22, dir * 3.2);
      if (d > 0.4) b.crates(10, -dir * 3);
      b.turn(dir * 55, 32);
    }
  },

  /** Rows of crates with one lane open each time. */
  crateField(b, r, d) {
    const rows = 3 + Math.round(d * 2);
    for (let i = 0; i < rows; i++) {
      const open = lane(r);
      b.crates(16 + i * 24, ...others(open));
      if (i % 2 === 0) b.pickup(16 + i * 24, open);
    }
    b.pad(rows * 24 + 6, lane(r));
    b.straight(rows * 24 + 20);
  },

  /** Skittles to smash through. */
  pinAlley(b, r) {
    for (let i = 0; i < 4; i++) {
      const x = lane(r);
      b.pins(14 + i * 22, x);
      if (i % 2) b.pad(24 + i * 22, x);
      else b.pickup(22 + i * 22, others(x)[i % 2]);
    }
    b.straight(100);
  },

  /** Windmill bars: each leaves one side of the road clear. */
  spinnerRun(b, _r, d) {
    const count = 2 + Math.round(d * 2);
    let at = 24;
    for (let i = 0; i < count; i++) {
      const dir = i % 2 ? 1 : -1;
      b.spinner(at, dir * 1.9, 1.3 + d * 0.9, 2.3).pickup(at, -dir * 3.3).pad(at + 14, 0);
      at += 34;
    }
    b.straight(at);
  },

  /** Tunnel with bumpers sliding across it. */
  sliderTunnel(b, r, d) {
    const count = 2 + Math.round(d * 2);
    const len = 30 + count * 28;
    b.tunnel(6, len - 12);
    for (let i = 0; i < count; i++) {
      b.slider(28 + i * 28, 3, 1.4 + d * 0.8, i * 2.1).pickup(42 + i * 28, lane(r));
    }
    b.pad(len - 8, 0);
    b.straight(len);
  },

  /** Swinging balls to time your way past. */
  pendulumBridge(b, r, d) {
    const count = 2 + Math.round(d * 1.5);
    for (let i = 0; i < count; i++) {
      b.pendulum(26 + i * 30, 3.4, 1.5 + d * 0.7, i * 1.7).pad(40 + i * 30, lane(r));
    }
    b.fruit(26 + 15, 0).pickup(26 + 45, lane(r));
    b.straight(36 + count * 30);
  },

  /** Sticky patches across two lanes at a time. */
  gooField(b, r) {
    for (let i = 0; i < 3; i++) {
      const open = lane(r);
      for (const x of others(open)) b.goo(20 + i * 28, x);
      b.pickup(20 + i * 28, open);
    }
    b.pad(96, lane(r));
    b.straight(108);
  },

  /** Hop the crates. */
  jumpLine(b, r) {
    const first = lane(r) * 0.5;
    b.jump(18, first).pickup(27, first, 3.6).crates(32, first - 1.2, first + 1.2);
    const second = -first || 1.5;
    b.pad(46, second).jump(60, second).fruit(69, second, 3.6).crates(74, second - 1.2, second + 1.2);
    b.straight(96);
  },

  /** Downhill run-up, a huge launch, and rings to thread in mid-air. Line it up: the ramp is on one lane. */
  megaJump(b, r) {
    const x = lane(r) * 0.8;
    b.pitchTo(-12);
    b.pad(6, x).pad(26, x);
    b.straight(44);
    b.pitchTo(0, 14);
    b.jump(4, x, 17).ring(22, x, 5.6).fruit(31, x, 6.4).ring(40, x, 6).pad(72, x);
    b.straight(86);
  },

  /** Rolling humps: pads on the way down, pickups on the crests. */
  waves(b, r) {
    b.pitchTo(7, 10);
    for (let i = 0; i < 3; i++) {
      const x = side(r) * 3;
      b.pickup(2, -x).pad(12, x);
      b.pitchTo(-7, 20);
      if (i < 2) b.pitchTo(7, 20);
    }
    b.pitchTo(0, 10);
  },

  /** Stomach-flipping plunge. */
  bigDrop(b, r) {
    b.pitchTo(-26, 16);
    b.pad(6, lane(r)).pad(30, lane(r)).ring(20, 0);
    b.straight(46);
    b.pitchTo(0, 22);
    b.straight(20);
  },

  climb(b, r) {
    b.pitchTo(10);
    b.pad(6, 0).pickup(20, lane(r)).pad(34, 0);
    b.straight(60);
    b.pitchTo(0);
  },

  loopOne(b, r, d) {
    const radius = 15 + Math.round(d * 3);
    b.pad(4, 0).straight(18);
    b.pickup(Math.PI * radius, 0);
    b.loop(radius, side(r));
  },

  /** Two loops back to back. */
  loopDouble(b, r) {
    const first = side(r);
    b.pad(4, 0).straight(18);
    b.pickup(Math.PI * 15, 0).loop(15, first);
    b.pad(4, 0).pad(14, 0).straight(22);
    // Same side again: the second loop keeps sliding away from the first rather than back into it.
    b.fruit(Math.PI * 15, 0).loop(15, first);
  },

  /** Corkscrew down: inside line for pickups, outside for pads. */
  corkscrewDown(b, r, d) {
    const turns = 1.5 + Math.round(r() * 2) * 0.5;
    const len = turns * 2 * Math.PI * 24;
    for (let at = 40; at < len; at += 75) {
      b.pad(at, -2.5).pickup(at + 30, 3.2);
      if (d > 0.3) b.crates(at + 52, at % 2 ? 0.5 : -0.5);
    }
    b.spiral(turns, 24, 13);
  },

  /** Corkscrew up to a viewpoint. */
  helixUp(b) {
    const len = 1.5 * 2 * Math.PI * 26;
    for (let at = 20; at < len; at += 50) b.pad(at, 2.5).pickup(at + 25, 3.2);
    b.spiral(1.5, 26, -13);
  },

  /** The whole track barrel-rolls. */
  twist(b, r) {
    b.pad(4, 0).straight(16);
    const x = side(r) * 2.6;
    b.pickup(18, x).pad(30, -x).pickup(46, -x).fruit(62, x).pad(84, x);
    b.tunnel(8, 74);
    b.twist(90, side(r));
    b.straight(10);
  },

  /** Split round an island: the left is quick, the right is tasty. */
  forkDiamond(b, r, d) {
    const hazard = r() < 0.5;
    b.straight(12);
    b.pad(-6, -3).pickup(-6, 3);
    b.fork(
      -1,
      (arm) =>
        bulge(arm, -1, (m) => {
          m.pad(2, 0).pad(22, lane(r)).ring(12, 0);
          if (d > 0.2) hazard ? m.crates(32, lane(r)) : m.spinner(32, 1.9, 1.6, 2.3);
          m.straight(44);
        }),
      (main) =>
        bulge(main, 1, (m) => {
          m.pickup(4, lane(r)).fruit(16, 0).pickup(28, lane(r)).pickup(40, lane(r));
          m.straight(44);
        }),
    );
    b.straight(12);
  },

  /** Straight on is short but cluttered; swing left for a clear, boosted detour with fruit. */
  forkShortcut(b, _r, d) {
    const middle = 80;
    b.straight(12);
    b.pad(-6, -3.4);
    b.fork(
      -1,
      (arm) =>
        bulge(arm, -1, (m) => {
          m.pad(2, 0).fruit(22, 0).pad(40, 0).pickup(58, 0).pad(72, 0);
          m.straight(middle);
        }),
      (main) => {
        const len = bulgeAdvance(middle);
        // Hazards only start once the detour has peeled clear, or its takers would drive through them.
        const rows = 3 + Math.round(d * 2);
        for (let i = 0; i < rows; i++) {
          const open = i % 2 ? 3 : 0;
          const at = PARTED + (i * (len - PARTED * 2)) / (rows - 1);
          i % 2 ? main.goo(at, others(open)[1]).crates(at, others(open)[0]) : main.crates(at, ...others(open));
        }
        main.straight(len);
      },
      1.2,
    );
    b.straight(12);
  },

  /** Left climbs over a hill with a jump; right dives through a tunnel underneath the sky. */
  forkHill(b, r, d) {
    b.straight(12);
    b.pad(-6, -3).pickup(-6, 3);
    b.fork(
      -1,
      (arm) =>
        bulge(arm, -1, (m) => {
          m.pitchTo(9, 12);
          m.pad(2, 0).jump(13, 0, 13).fruit(24, 0, 4.4).ring(34, 0, 4.2);
          m.straight(16).pitchTo(-9, 24);
          m.pad(4, 0).straight(16).pitchTo(0, 12);
        }),
      (main) =>
        bulge(main, 1, (m) => {
          m.tunnel(4, 72);
          m.slider(22, 3, 1.5 + d * 0.6).pickup(34, lane(r)).pickup(48, lane(r)).slider(60, 3, 1.5 + d * 0.6, 2);
          m.straight(80);
        }),
    );
    b.straight(12);
  },

  /** The road just stops: sail off the edge and drop to the level below. */
  cliffFall(b, r) {
    b.pad(4, lane(r)).straight(16);
    b.gap(0, 40);
    b.fruit(18, 0, 3.2);
    b.pitchTo(-42, 8).straight(22).pitchTo(0, 10);
    b.pad(6, 0).pickup(16, lane(r));
    b.straight(30);
  },

  /** A long gap with nothing underneath: thread the rings on the way over. */
  superJump(b, r) {
    b.pad(4, 0).pad(16, 0).straight(26);
    b.gap(0, 60);
    b.ring(15, 0, 6.5).fruit(30, 0, 8.3).ring(45, 0, 6.5);
    b.straight(60);
    b.pad(6, lane(r)).pickup(18, lane(r));
    b.straight(30);
  },

  /** Upright windmills: slip through between the sails. */
  windmills(b, r, d) {
    const count = 2 + Math.round(d);
    for (let i = 0; i < count; i++) {
      const at = 26 + i * 34;
      b.windmill(at, 1 + d * 0.6, i * 0.9).pickup(at + 12, lane(r)).pad(at + 20, lane(r));
    }
    b.straight(30 + count * 34);
  },

  /** Escalator up a steep hill: sit back and enjoy the view. */
  escalatorHill(b) {
    b.straight(8);
    b.lift(0, 66);
    b.pitchTo(28, 10);
    b.pickup(10, 0).pickup(24, 0).fruit(38, 0);
    b.straight(46).pitchTo(0, 10);
    b.pad(4, 0).straight(20);
  },

  /** A corkscrew wound up tight. */
  tightCorkscrew(b, r) {
    const turns = 2.5 + Math.round(r()) * 0.5;
    const len = turns * 2 * Math.PI * 13;
    for (let at = 30; at < len; at += 60) b.pad(at, -2.5).pickup(at + 25, 3.2);
    b.spiral(turns, 13, 13);
  },

  /** Three small loops in a row. */
  tightLoops(b, r) {
    const way = side(r);
    b.pad(4, 0).pad(14, 0).straight(20);
    for (let i = 0; i < 3; i++) {
      i === 1 ? b.fruit(Math.PI * 10, 0) : b.pickup(Math.PI * 10, 0);
      b.loop(10, way);
      b.pad(4, 0).straight(16);
    }
  },

  /** Three ways on: fast on the left, tasty on the right, or brave the windmill down the middle. */
  forkThree(b, r, d) {
    const middle = 70;
    b.straight(12);
    b.pad(-6, -3.4).pickup(-6, 3.4);
    b.fork(
      -1,
      (arm) =>
        bulge(arm, -1, (m) => {
          m.pad(2, 0).ring(18, 0).pad(34, lane(r)).pad(58, 0);
          m.straight(middle);
        }),
      (main) =>
        main.fork(
          1,
          (arm) =>
            bulge(arm, 1, (m) => {
              m.pickup(4, lane(r)).fruit(22, 0).pickup(40, lane(r)).fruit(58, 0);
              m.straight(middle);
            }),
          (centre) => {
            const len = bulgeAdvance(middle);
            centre.windmill(PARTED + 6, 1 + d * 0.5).pins(PARTED + 22, 0).pad(len - PARTED, 0);
            centre.straight(len);
          },
          1.3,
        ),
      1.3,
    );
    b.straight(12);
  },

  /** Left for two tight loops, right for an easy cruise. */
  forkLoops(b, r) {
    b.straight(12);
    b.ring(-6, -3.2).pickup(-6, 3.2);
    b.fork(
      -1,
      (arm) =>
        bulge(arm, -1, (m) => {
          m.pad(2, 0).straight(18);
          m.fruit(Math.PI * 10, 0).loop(10, -1);
          m.pad(4, 0).pad(24, 0).straight(40);
          m.fruit(Math.PI * 10, 0).loop(10, 1);
          m.straight(18);
        }),
      (main) =>
        bulge(main, 1, (m) => {
          m.pickup(10, lane(r)).pickup(34, lane(r)).pickup(58, lane(r));
          m.straight(76);
        }),
    );
    b.straight(12);
  },

  /** Left rides an escalator up and jumps off the top; right stays down among the crates. */
  forkLift(b, r) {
    b.straight(12);
    b.ring(-6, -3.2).pickup(-6, 3.2);
    b.fork(
      -1,
      (arm) =>
        bulge(arm, -1, (m) => {
          m.lift(0, 50);
          m.pitchTo(28, 10).straight(30).pitchTo(0, 10);
          m.fruit(4, 0).pad(8, 0).straight(14);
          m.gap(0, 50);
          m.fruit(24, 0, 3.6);
          m.pitchTo(-28, 10).straight(30).pitchTo(0, 10);
        }),
      (main) =>
        bulge(main, 1, (m) => {
          const open = lane(r);
          m.pad(6, open).crates(30, ...others(open)).pickup(30, open).pad(54, lane(r)).crates(80, lane(r));
          // The same ground covered as the hill on the other side, measured flat.
          m.straight(105.5);
        }),
    );
    b.straight(12);
  },
} satisfies Record<string, Piece>;

export type PieceName = keyof typeof PIECES;
