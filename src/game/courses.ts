import { ingredient } from '../data/ingredients';
import type { Level } from '../data/levels';
import { CourseBuilder, type Course } from './course';
import { PIECES, type PieceName, type Rng } from './pieces';
import { timeCourse } from './sim';
import { seeded } from './random';
import { inMood, themeFor } from './themes';

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

/** What each level of the first world is made of, in order. Each leans on one or two signature pieces. */
const RECIPES: Record<string, PieceName[]> = {
  'level-2': ['sweeper', 'forkDiamond', 'sBends', 'hairpinWall', 'escalatorHill', 'bigDrop', 'loopOne', 'sweeper', 'crateField', 'corkscrewDown', 'jumpLine'],
  'level-3': ['pinAlley', 'sBends', 'gooField', 'cliffFall', 'sweeper', 'plaza', 'tightLoops', 'forkDiamond', 'waves', 'megaJump'],
  'level-4': ['spinnerRun', 'turboRun', 'windmills', 'loopOne', 'forkShortcut', 'superJump', 'hairpinWall', 'loopDouble', 'sBends', 'windmills', 'jumpLine'],
  'level-5': ['tightCorkscrew', 'twist', 'forkTwinLoops', 'helixUp', 'sliderTunnel', 'corkscrewDown', 'cliffFall', 'twist', 'pinAlley', 'tightCorkscrew', 'loopOne'],
  'level-6': ['waves', 'forkShortcut', 'gooField', 'superJump', 'sweeper', 'pendulumBridge', 'tightLoops', 'escalatorHill', 'megaJump', 'forkThree', 'crateField'],
  'level-7': ['waves', 'hairpinWall', 'superJump', 'gooField', 'cliffFall', 'hairpinWall', 'twist', 'crateField', 'megaJump', 'loopDouble', 'forkHill', 'turboJump'],
  'level-8': ['cliffFall', 'sliderTunnel', 'pendulumBridge', 'forkLift', 'escalatorHill', 'bigDrop', 'tightCorkscrew', 'spinnerRun', 'cliffFall', 'loopOne', 'twist', 'bigDrop'],
  'level-9': ['escalatorHill', 'tightLoops', 'helixUp', 'bigDrop', 'forkLong', 'corkscrewDown', 'pinAlley', 'superJump', 'escalatorHill', 'cliffFall', 'loopDouble'],
  'level-10': ['cliffFall', 'twist', 'forkThree', 'gooField', 'escalatorHill', 'cliffFall', 'forkShortcut', 'waves', 'tightLoops', 'pendulumBridge', 'forkHill', 'cliffFall'],
  'level-11': ['windmills', 'twist', 'sBends', 'spinnerRun', 'tightLoops', 'pendulumBridge', 'forkLoops', 'hairpinWall', 'superJump', 'tightCorkscrew', 'sliderTunnel', 'windmills'],
  'level-12': ['escalatorHill', 'tightrope', 'turboRun', 'cliffFall', 'tightLoops', 'megaJump', 'forkLift', 'corkscrewDown', 'bigDrop', 'spinnerRun', 'waves'],
  'level-13': ['forkThree', 'pendulumBridge', 'forkTwinLoops', 'sweeper', 'forkLong', 'windmills', 'forkDiamond', 'gooField', 'megaJump', 'forkShortcut', 'twist', 'forkHill'],
  'level-14': ['twist', 'sliderTunnel', 'tightCorkscrew', 'windmills', 'forkHill', 'pendulumBridge', 'loopDouble', 'twist', 'cliffFall', 'spinnerRun', 'tightLoops'],
  'level-15': ['plaza', 'windmills', 'pendulumBridge', 'forkThree', 'gooField', 'sliderTunnel', 'cliffFall', 'pinAlley', 'tightLoops', 'spinnerRun', 'superJump', 'corkscrewDown'],
  'level-16': ['turboJump', 'jumpLine', 'forkLift', 'waves', 'megaJump', 'hairpinWall', 'forkThree', 'loopOne', 'superJump', 'cliffFall', 'twist', 'forkHill'],
  'level-17': ['plaza', 'escalatorHill', 'superJump', 'hairpinWall', 'forkLoops', 'windmills', 'bigDrop', 'megaJump', 'pinAlley', 'tightCorkscrew', 'forkLift', 'pendulumBridge'],
  'level-18': ['escalatorHill', 'tightrope', 'forkLong', 'windmills', 'turboRun', 'cliffFall', 'pendulumBridge', 'superJump', 'tightCorkscrew', 'forkLift', 'twist', 'forkLoops', 'bigDrop', 'megaJump'],
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

/** Pieces grouped by what they feel like, for writing a recipe automatically. */
const FAMILIES: Record<string, PieceName[]> = {
  speed: ['sweeper', 'hairpinWall', 'sBends', 'turboRun'],
  air: ['megaJump', 'superJump', 'cliffFall', 'jumpLine', 'turboJump'],
  loops: ['loopOne', 'loopDouble', 'tightLoops'],
  spirals: ['corkscrewDown', 'tightCorkscrew', 'helixUp'],
  hazards: ['crateField', 'pinAlley', 'spinnerRun', 'windmills', 'pendulumBridge', 'gooField', 'sliderTunnel', 'plaza'],
  hills: ['waves', 'bigDrop', 'escalatorHill', 'twist', 'tightrope'],
  forks: ['forkDiamond', 'forkShortcut', 'forkHill', 'forkThree', 'forkLoops', 'forkLift', 'forkTwinLoops', 'forkLong'],
};
const RHYTHM = ['speed', 'hazards', 'forks', 'air', 'loops', 'hazards', 'hills', 'spirals', 'forks', 'air', 'hazards', 'hills'];

/** A recipe for a level that has none written by hand: one piece from each family in a set rhythm, no piece more than twice. */
function autoRecipe(r: Rng): PieceName[] {
  const start = Math.floor(r() * RHYTHM.length);
  const recipe: PieceName[] = [];
  for (let i = 0; i < RHYTHM.length; i++) {
    const family = FAMILIES[RHYTHM[(start + i) % RHYTHM.length]];
    let piece = family[Math.floor(r() * family.length)];
    if (recipe.filter((p) => p === piece).length >= 2) piece = family[(family.indexOf(piece) + 1) % family.length];
    recipe.push(piece);
  }
  return recipe;
}

/** The final downhill sprint to the line. */
function finale(b: CourseBuilder): void {
  b.flip = 1;
  b.pitchTo(-8);
  b.pad(6, 0).crates(24, -3).pad(34, 3).crates(52, 3).pad(62, -3).crates(80, 0).pad(90, 0).pickup(44, 0).fruit(72, 3);
  b.straight(104);
  b.pitchTo(0);
  b.straight(64);
}

/** Assemble a level from its recipe, trying links and mirror images until each piece fits without hitting the rest. */
function generate(level: Level, attempt = 0): CourseBuilder {
  const r = seeded(level.n * 7919 + attempt * 104729);
  const recipe = RECIPES[level.id] ?? autoRecipe(r);
  const difficulty = level.difficulty;
  const b = new CourseBuilder();
  b.pad(34, 0).pickup(52, -3).pickup(66, 3);
  b.straight(80);

  // Depth-first: if a later piece cannot be fitted, go back and lay the earlier one a different way.
  let budget = 900;
  const place = (index: number): boolean => {
    if (index === recipe.length) {
      // The sprint to the line has to fit too, or the last piece is laid again a different way.
      const start = b.snapshot();
      finale(b);
      if (!b.clashes(start)) return true;
      b.restore(start);
      return false;
    }
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
  if (!place(0)) {
    // Boxed in: start again with different luck.
    if (attempt < 8) return generate(level, attempt + 1);
    throw new Error(`${level.id}: could not lay out the course`);
  }

  return b;
}

/** Finish at or under these times (seconds) for 5, 4, 3 and 2 stars. Anything slower is 1. */
export type StarTimes = [number, number, number, number];

const built = new Map<string, { course: Course; starTimes: StarTimes }>();

/**
 * Star times come from playing the course hands-free: five stars needs very nearly a good racing line, and
 * never steering at all lands in the two-star band at best.
 */
function calibrate(course: Course, level: Level): StarTimes {
  const idle = timeCourse(course, level, 'none');
  const best = Math.min(timeCourse(course, level, 'smart'), idle * 0.9);
  const two = Math.ceil(idle * 1.02);
  let five = Math.ceil(best * 1.03);
  const three = Math.min(Math.round(five + ((two - five) * 2) / 3), Math.ceil(idle) - 1);
  five = Math.min(five, three - 2);
  return [five, Math.round((five + three) / 2), three, two];
}

function prepared(level: Level) {
  let entry = built.get(level.id);
  if (!entry) {
    const course = (level.id === 'level-1' ? appleOrchard() : generate(level)).build(inMood(themeFor(level, ingredient(level.fruit).color), level.mood), level.mood);
    entry = { course, starTimes: calibrate(course, level) };
    built.set(level.id, entry);
  }
  return entry;
}

/** The course for a level, built once and reused. */
export const courseFor = (level: Level): Course => prepared(level).course;

export const starTimesFor = (level: Level): StarTimes => prepared(level).starTimes;

/**
 * Build courses a few at a time while nothing else is happening, so opening a level never has to wait for one.
 * `order` is the levels to prepare, soonest-needed first.
 */
export function warmCourses(order: Level[]): void {
  const queue = order.filter((level) => !built.has(level.id));
  const next = () => {
    const level = queue.shift();
    if (!level) return;
    prepared(level);
    window.setTimeout(next, 30);
  };
  window.setTimeout(next, 600);
}
