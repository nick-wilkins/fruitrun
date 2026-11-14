import type { Level } from '../data/levels';
import { CourseBuilder, type Course } from './course';
import { PIECES, type PieceName, type Rng } from './pieces';
import { timeCourse } from './sim';
import { seeded } from './random';
import { THEMES } from './themes';

/** Level 1, Apple Orchard: laid out by hand as a gentle tour of the basics. */
function appleOrchard(): CourseBuilder {
  const b = new CourseBuilder();

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
  return b;
}

/** What each generated level is made of, in order. Each level leans on one or two signature pieces. */
const RECIPES: Record<string, PieceName[]> = {
  'level-2': ['sweeper', 'forkDiamond', 'sBends', 'hairpinWall', 'padStraight', 'loopOne', 'sweeper', 'crateField', 'corkscrewDown', 'hairpinWall', 'jumpLine'],
  'level-3': ['pinAlley', 'sBends', 'gooField', 'jumpLine', 'sweeper', 'pinAlley', 'loopOne', 'forkDiamond', 'gooField', 'waves', 'megaJump'],
  'level-4': ['spinnerRun', 'sweeper', 'loopOne', 'crateField', 'forkShortcut', 'spinnerRun', 'hairpinWall', 'loopDouble', 'sBends', 'jumpLine', 'spinnerRun'],
  'level-5': ['corkscrewDown', 'twist', 'sBends', 'helixUp', 'sliderTunnel', 'corkscrewDown', 'forkDiamond', 'twist', 'pinAlley', 'bigDrop', 'loopOne'],
  'level-6': ['waves', 'forkShortcut', 'gooField', 'sweeper', 'waves', 'pendulumBridge', 'loopOne', 'sBends', 'megaJump', 'forkDiamond', 'crateField'],
  'level-7': ['waves', 'hairpinWall', 'megaJump', 'waves', 'jumpLine', 'hairpinWall', 'twist', 'bigDrop', 'loopDouble', 'forkHill', 'megaJump'],
  'level-8': ['bigDrop', 'sliderTunnel', 'pendulumBridge', 'forkHill', 'climb', 'bigDrop', 'corkscrewDown', 'spinnerRun', 'sliderTunnel', 'loopOne', 'twist', 'bigDrop'],
  'level-9': ['helixUp', 'padStraight', 'loopDouble', 'helixUp', 'bigDrop', 'forkDiamond', 'corkscrewDown', 'pinAlley', 'megaJump', 'loopOne', 'bigDrop'],
  'level-10': ['bigDrop', 'twist', 'forkDiamond', 'gooField', 'climb', 'bigDrop', 'forkShortcut', 'waves', 'loopOne', 'twist', 'pendulumBridge', 'forkHill', 'bigDrop'],
  'level-11': ['spinnerRun', 'twist', 'sBends', 'spinnerRun', 'loopDouble', 'pendulumBridge', 'forkDiamond', 'hairpinWall', 'megaJump', 'corkscrewDown', 'sliderTunnel', 'spinnerRun'],
  'level-12': ['helixUp', 'climb', 'bigDrop', 'loopDouble', 'loopOne', 'megaJump', 'forkHill', 'corkscrewDown', 'bigDrop', 'spinnerRun', 'waves'],
  'level-13': ['forkDiamond', 'pendulumBridge', 'forkShortcut', 'sweeper', 'forkHill', 'pendulumBridge', 'loopOne', 'forkDiamond', 'gooField', 'megaJump', 'twist', 'forkShortcut'],
  'level-14': ['twist', 'sliderTunnel', 'corkscrewDown', 'twist', 'forkHill', 'pendulumBridge', 'loopDouble', 'sliderTunnel', 'twist', 'bigDrop', 'spinnerRun', 'twist'],
  'level-15': ['crateField', 'spinnerRun', 'pendulumBridge', 'gooField', 'sliderTunnel', 'forkDiamond', 'pinAlley', 'loopDouble', 'spinnerRun', 'megaJump', 'corkscrewDown'],
  'level-16': ['megaJump', 'jumpLine', 'forkDiamond', 'waves', 'megaJump', 'hairpinWall', 'forkShortcut', 'loopOne', 'jumpLine', 'bigDrop', 'megaJump', 'twist', 'forkHill'],
  'level-17': ['pinAlley', 'megaJump', 'hairpinWall', 'pinAlley', 'forkDiamond', 'spinnerRun', 'bigDrop', 'megaJump', 'pinAlley', 'loopDouble', 'corkscrewDown', 'forkHill', 'pendulumBridge'],
  'level-18': ['helixUp', 'twist', 'forkDiamond', 'spinnerRun', 'loopDouble', 'bigDrop', 'pendulumBridge', 'megaJump', 'corkscrewDown', 'forkHill', 'twist', 'loopOne', 'forkShortcut', 'bigDrop', 'megaJump'],
};

type Link = (b: CourseBuilder, r: Rng) => void;

/** Clear road every piece must leave ahead of itself. The finishing sprint needs more than this. */
const RUNWAY = 90;

const bend = (min: number, spread: number): Link => (b, r) => {
  const deg = min + r() * spread;
  const radius = 36 + r() * 12;
  b.ring(((deg * Math.PI) / 180) * radius * 0.5, 3).turn(deg, radius);
};
const rise: Link = (b) => {
  b.pitchTo(11).pad(6, 0).pad(34, 0).straight(58).pitchTo(0);
};
const fall: Link = (b) => {
  b.pitchTo(-11).pad(20, 0).straight(58).pitchTo(0);
};

/** Ways to get from one piece to the next, gentlest first. Later ones change height to duck under or over what is in the way. */
const LINKS: Link[] = [
  bend(35, 40),
  () => {},
  bend(90, 40),
  (b, r) => (rise(b, r), bend(40, 50)(b, r)),
  (b, r) => (fall(b, r), bend(40, 50)(b, r)),
  rise,
  fall,
  (b, r) => (rise(b, r), rise(b, r), bend(60, 60)(b, r)),
  (b, r) => (fall(b, r), fall(b, r), bend(60, 60)(b, r)),
];

/** Assemble a level from its recipe, trying links and mirror images until each piece fits without hitting the rest. */
function generate(level: Level): CourseBuilder {
  const recipe = RECIPES[level.id];
  if (!recipe) throw new Error(`No course recipe for ${level.id}`);
  const r = seeded(level.n * 7919);
  const difficulty = (level.n - 1) / 17;
  const b = new CourseBuilder();
  b.pad(34, 0).pickup(52, -3).pickup(66, 3);
  b.straight(80);

  // Depth-first: if a later piece cannot be fitted, go back and lay the earlier one a different way.
  let budget = 600;
  const place = (index: number): boolean => {
    if (index === recipe.length) return true;
    const first = Math.floor(r() * 3);
    const mirror = r() < 0.5 ? 1 : -1;
    const start = b.snapshot();
    for (let attempt = 0; attempt < LINKS.length * 2 && budget > 0; attempt++) {
      budget--;
      const link = LINKS[(first + (attempt >> 1)) % LINKS.length];
      b.flip = (attempt % 2 ? -mirror : mirror) as 1 | -1;
      link(b, r);
      PIECES[recipe[index]](b, r, difficulty);
      // Check with a runway on the end, so the next piece is not left pointing straight at a wall.
      const end = b.snapshot();
      b.straight(RUNWAY);
      const clear = !b.clashes(start);
      b.restore(end);
      if (clear && place(index + 1)) return true;
      b.restore(start);
    }
    return false;
  };
  if (!place(0)) throw new Error(`${level.id}: could not lay out the course`);

  // Final downhill sprint to the line.
  b.flip = 1;
  b.pitchTo(-8);
  b.pad(6, 0).crates(24, -3).pad(34, 3).crates(52, 3).pad(62, -3).crates(80, 0).pad(90, 0).pickup(44, 0).fruit(72, 3);
  b.straight(104);
  b.pitchTo(0);
  b.straight(64);
  return b;
}

const built = new Map<string, Course>();

/**
 * The course for a level, built once and reused. Building it also plays it hands-free to set the level's star times:
 * five stars needs a bit slower than a good racing line, two stars is about what you get without steering at all.
 */
export function courseFor(level: Level): Course {
  let course = built.get(level.id);
  if (!course) {
    course = (level.id === 'level-1' ? appleOrchard() : generate(level)).build(THEMES[level.id]);
    built.set(level.id, course);
    const idle = timeCourse(course, level, 'none');
    const best = Math.min(timeCourse(course, level, 'smart'), idle * 0.88);
    const five = Math.ceil(best * 1.08);
    const two = Math.max(five + 9, Math.ceil(idle * 1.02));
    const gap = (two - five) / 3;
    level.starTimes = [five, Math.round(five + gap), Math.round(five + gap * 2), two];
  }
  return course;
}

export const hasCourse = (level: Level) => level.id === 'level-1' || level.id in RECIPES;
