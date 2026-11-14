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

/**
 * When each kind of piece first appears. The first world drip-feeds them, a few new ones a level, so there is
 * always something not seen before; by level 12 everything is in play.
 */
export const INTRO: Record<PieceName, number> = {
  sweeper: 2, sBends: 2, hairpinWall: 2, forkDiamond: 2, padStraight: 2, crateField: 2, loopOne: 2, corkscrewDown: 2, jumpLine: 2,
  pinAlley: 3, gooField: 3, waves: 3, megaJump: 3,
  pendulumBridge: 4, spinnerRun: 4, cliffFall: 4, tunnelSweep: 4,
  twist: 5, sliderTunnel: 5, tightCorkscrew: 5, escalatorHill: 5,
  windmills: 6, plaza: 6, forkShortcut: 6, loopDouble: 6,
  turboRun: 7, superJump: 7, bottleneck: 7, tunnelDive: 7,
  turboJump: 8, tightrope: 8, forkHill: 8, bigDrop: 8, helixUp: 8,
  tightLoops: 9, forkLong: 9, wideSweeper: 9,
  forkThree: 10, tunnelWiggle: 10, climb: 10,
  forkTwinLoops: 11, forkLoops: 11,
  forkLift: 12,
};

/** What a child would call each kind of piece, for the "new on this level" line. */
const PIECE_NAMES: Partial<Record<PieceName, string>> = {
  forkDiamond: 'a fork in the road', hairpinWall: 'wall-ride bends', pinAlley: 'skittles', gooField: 'sticky patches', waves: 'rolling waves', megaJump: 'a mega jump',
  pendulumBridge: 'swinging pendulums', spinnerRun: 'spinning bars', cliffFall: 'a cliff to fall off', tunnelSweep: 'a bendy tunnel',
  twist: 'a barrel-roll tunnel', tightCorkscrew: 'a tight corkscrew', escalatorHill: 'an escalator',
  windmills: 'windmills', plaza: 'a wide plaza', forkShortcut: 'a shortcut', loopDouble: 'a double loop',
  turboRun: 'TURBO pads', superJump: 'a super jump', bottleneck: 'a bottleneck', tunnelDive: 'a tunnel dive',
  turboJump: 'a turbo jump', tightrope: 'a tightrope', forkHill: 'over or under', bigDrop: 'a big drop', helixUp: 'a climbing spiral',
  tightLoops: 'triple loops', forkLong: 'a long split', wideSweeper: 'a giant bend',
  forkThree: 'a three-way split', tunnelWiggle: 'a snaking tunnel',
  forkTwinLoops: 'twin loops', forkLoops: 'loop or cruise',
  forkLift: 'escalator or crates',
};

/** What each level of the first world is made of, in order. */
export const RECIPES: Record<string, PieceName[]> = {
  'level-2': ['sweeper', 'forkDiamond', 'sBends', 'hairpinWall', 'padStraight', 'loopOne', 'crateField', 'corkscrewDown', 'jumpLine', 'sweeper'],
  'level-3': ['pinAlley', 'sBends', 'gooField', 'waves', 'sweeper', 'megaJump', 'loopOne', 'forkDiamond', 'pinAlley', 'hairpinWall'],
  'level-4': ['pendulumBridge', 'sweeper', 'spinnerRun', 'cliffFall', 'tunnelSweep', 'forkDiamond', 'gooField', 'loopOne', 'pendulumBridge', 'megaJump', 'jumpLine'],
  'level-5': ['twist', 'tightCorkscrew', 'sliderTunnel', 'escalatorHill', 'cliffFall', 'forkDiamond', 'pinAlley', 'twist', 'spinnerRun', 'corkscrewDown', 'waves'],
  'level-6': ['windmills', 'forkShortcut', 'plaza', 'loopDouble', 'pendulumBridge', 'escalatorHill', 'megaJump', 'windmills', 'tunnelSweep', 'gooField', 'forkDiamond'],
  'level-7': ['turboRun', 'waves', 'superJump', 'bottleneck', 'tunnelDive', 'hairpinWall', 'twist', 'crateField', 'turboRun', 'loopDouble', 'forkShortcut', 'superJump'],
  'level-8': ['turboJump', 'tightrope', 'forkHill', 'bigDrop', 'helixUp', 'sliderTunnel', 'pendulumBridge', 'cliffFall', 'tightCorkscrew', 'spinnerRun', 'turboRun', 'bigDrop'],
  'level-9': ['tightLoops', 'forkLong', 'wideSweeper', 'escalatorHill', 'bigDrop', 'superJump', 'pinAlley', 'helixUp', 'cliffFall', 'loopDouble', 'tunnelDive'],
  'level-10': ['forkThree', 'tunnelWiggle', 'climb', 'cliffFall', 'twist', 'gooField', 'forkShortcut', 'waves', 'tightLoops', 'pendulumBridge', 'forkHill', 'turboJump'],
  'level-11': ['forkTwinLoops', 'windmills', 'twist', 'spinnerRun', 'forkLoops', 'tunnelWiggle', 'hairpinWall', 'superJump', 'tightCorkscrew', 'sliderTunnel', 'plaza', 'turboRun'],
  'level-12': ['forkLift', 'escalatorHill', 'tightrope', 'turboRun', 'cliffFall', 'tightLoops', 'megaJump', 'wideSweeper', 'corkscrewDown', 'bigDrop', 'spinnerRun', 'forkThree'],
  'level-13': ['forkThree', 'pendulumBridge', 'forkTwinLoops', 'sweeper', 'forkLong', 'windmills', 'bottleneck', 'gooField', 'megaJump', 'forkShortcut', 'twist', 'forkHill'],
  'level-14': ['twist', 'sliderTunnel', 'tightCorkscrew', 'windmills', 'forkHill', 'tunnelWiggle', 'loopDouble', 'tightrope', 'cliffFall', 'spinnerRun', 'tightLoops', 'turboJump'],
  'level-15': ['plaza', 'windmills', 'pendulumBridge', 'forkThree', 'gooField', 'tunnelDive', 'cliffFall', 'wideSweeper', 'tightLoops', 'spinnerRun', 'superJump', 'corkscrewDown', 'forkLift'],
  'level-16': ['turboJump', 'jumpLine', 'forkLift', 'waves', 'megaJump', 'hairpinWall', 'forkThree', 'bottleneck', 'superJump', 'cliffFall', 'twist', 'forkLong'],
  'level-17': ['plaza', 'escalatorHill', 'superJump', 'tunnelSweep', 'forkLoops', 'windmills', 'bigDrop', 'megaJump', 'tightrope', 'tightCorkscrew', 'forkLift', 'pendulumBridge', 'turboRun'],
  'level-18': ['escalatorHill', 'tightrope', 'forkLong', 'windmills', 'turboRun', 'cliffFall', 'pendulumBridge', 'superJump', 'tightCorkscrew', 'forkLift', 'tunnelWiggle', 'forkTwinLoops', 'bigDrop', 'wideSweeper', 'turboJump'],
};

/** The kinds of piece a level introduces, in words, for its card on the map. */
export function newOn(level: Level): string[] {
  return (RECIPES[level.id] ?? []).filter((piece, i, all) => INTRO[piece] === level.n && all.indexOf(piece) === i && PIECE_NAMES[piece]).map((piece) => PIECE_NAMES[piece]!);
}

type Link = (b: CourseBuilder, r: Rng) => void;

/** Pieces that work just as well on a broader road: nothing in them is built to the standard width. */
const ROOMY = new Set<PieceName>(['crateField', 'pinAlley', 'gooField', 'spinnerRun', 'jumpLine', 'sBends', 'sweeper', 'waves', 'padStraight']);

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
  speed: ['sweeper', 'hairpinWall', 'sBends', 'turboRun', 'wideSweeper'],
  air: ['megaJump', 'superJump', 'cliffFall', 'jumpLine', 'turboJump'],
  loops: ['loopOne', 'loopDouble', 'tightLoops'],
  spirals: ['corkscrewDown', 'tightCorkscrew', 'helixUp'],
  hazards: ['crateField', 'pinAlley', 'spinnerRun', 'windmills', 'pendulumBridge', 'gooField', 'sliderTunnel', 'plaza', 'bottleneck'],
  hills: ['waves', 'bigDrop', 'escalatorHill', 'twist', 'tightrope'],
  tunnels: ['tunnelSweep', 'tunnelDive', 'tunnelWiggle', 'sliderTunnel'],
  forks: ['forkDiamond', 'forkShortcut', 'forkHill', 'forkThree', 'forkLoops', 'forkLift', 'forkTwinLoops', 'forkLong'],
};
const RHYTHM = ['speed', 'hazards', 'forks', 'air', 'tunnels', 'loops', 'hazards', 'hills', 'spirals', 'forks', 'air', 'hazards', 'speed', 'tunnels', 'loops'];

/** A recipe for a level that has none written by hand: one piece from each family in a set rhythm, no piece more than twice. */
function autoRecipe(r: Rng, difficulty: number): PieceName[] {
  const start = Math.floor(r() * RHYTHM.length);
  const recipe: PieceName[] = [];
  // Harder levels are longer: 11 pieces for the gentlest, 15 for the hardest.
  const length = 11 + Math.round(difficulty * 4);
  for (let i = 0; i < length; i++) {
    const family = FAMILIES[RHYTHM[(start + i) % RHYTHM.length]];
    let piece = family[Math.floor(r() * family.length)];
    if (recipe.filter((p) => p === piece).length >= 2) piece = family[(family.indexOf(piece) + 1) % family.length];
    recipe.push(piece);
  }
  return recipe;
}

/** Ways for a course to end. Each finishes with a flat straight for the line and the fruit arch. */
const FINALES: Link[] = [
  // A downhill sprint through crates.
  (b) => {
    b.pitchTo(-8);
    b.pad(6, 0).crates(24, -3).pad(34, 3).crates(52, 3).pad(62, -3).crates(80, 0).pad(90, 0).pickup(44, 0).fruit(72, 3);
    b.straight(104).pitchTo(0).straight(64);
  },
  // A turbo dash through a line of rings.
  (b, r) => {
    b.straight(10);
    b.turbo(6, 0);
    for (let at = 46; at < 190; at += 36) b.ring(at, (r() - 0.5) * 4);
    b.fruit(120, 0);
    b.straight(200).straight(64);
  },
  // Down a ramp and a last big hop over the crates.
  (b) => {
    b.pitchTo(-10);
    b.pad(6, 0).pad(28, 0);
    b.straight(46).pitchTo(0, 14);
    b.jump(6, 0, 13).fruit(22, 0, 4.4).crates(26, -3, 0, 3).pad(50, 0);
    b.straight(70).straight(64);
  },
  // One last loop.
  (b, r) => {
    b.pad(4, 0).pad(14, 0).straight(20);
    b.fruit(Math.PI * 12, r() < 0.5 ? 2.6 : -2.6).loop(12, r() < 0.5 ? 1 : -1);
    b.pad(6, 0).straight(30).straight(64);
  },
  // Out of a tunnel and into the light.
  (b, r) => {
    b.tunnel(4, 96);
    b.slider(26, 2.6, 1.8).pickup(40, r() < 0.5 ? 3 : -3).slider(58, 2.6, 1.8, 2).fruit(76, 0).pad(90, 0);
    b.straight(108).straight(64);
  },
  // A plunge to the line.
  (b, r) => {
    b.pitchTo(-24, 16);
    b.pad(6, r() < 0.5 ? 3 : -3).ring(22, 0).pad(34, 0).fruit(44, 0);
    b.straight(50).pitchTo(0, 22).straight(64);
  },
];

/** Assemble a level from its recipe, trying links and mirror images until each piece fits without hitting the rest. */
function generate(level: Level, attempt = 0): CourseBuilder {
  const r = seeded(level.n * 7919 + attempt * 104729);
  const recipe = RECIPES[level.id] ?? autoRecipe(r, level.difficulty);
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
      // Finishes are always built the same way round, whatever mirror the last piece was laid in.
      b.flip = 1;
      FINALES[level.n % FINALES.length](b, r);
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
      // Now and then a piece is laid on a broad stretch of road, for a change of feel.
      const broad = ROOMY.has(recipe[index]) && r() < 0.3;
      if (broad) b.width(7.4, 14);
      PIECES[recipe[index]](b, r, difficulty);
      if (broad) b.width(5, 14);
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
 * Star times come from playing the course hands-free. Five stars means matching a good racing line; the other
 * bands are spread evenly from there towards never steering at all, which earns one star.
 */
function calibrate(course: Course, level: Level): StarTimes {
  const idle = timeCourse(course, level, 'none');
  const best = Math.min(timeCourse(course, level, 'smart'), idle - 4);
  const five = Math.ceil(best);
  const step = Math.max(1, (idle - five) / 4);
  return [five, Math.round(five + step), Math.round(five + step * 2), Math.max(Math.round(five + step * 3), five + 3)];
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
