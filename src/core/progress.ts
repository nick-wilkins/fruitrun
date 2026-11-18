import { LEVELS, levelByNumber, type Level } from '../data/levels';
import { starTimesFor } from '../game/courses';
import { claimAwards, type Award } from './awards';
import { MAX_JUG, scoreSmoothie, type SmoothieResult } from './smoothie';

/** What happened on a run, beyond the time: counted by the rules engine. */
export interface Feats {
  rings: number;
  /** Crates, bumpers, pendulums, spinners and windmills hit. */
  hits: number;
  pins: number;
  turbos: number;
  launches: number;
  /** Pickups collected, and how many there were on the route taken. */
  pickups: number;
  possible: number;
}

/** A smoothie as remembered in the book. */
export interface Sip {
  name: string;
  points: number;
  rating: number;
  color: string;
  /** Made in the super blender. */
  big: boolean;
  /** What went into the jug. Missing on smoothies made before the book kept it. */
  items?: string[];
}

const HISTORY = 12;

/** Bump when courses are re-laid, so best times set on the old layouts stop counting against the new ones. */
export const COURSES = 4;

export interface LevelRecord {
  stars: number;
  time: number;
  /** Which set of course layouts the time was set on. Missing on saves from before layouts were versioned. */
  courses?: number;
}

export interface Save {
  version: 1;
  /** The level played most recently: where Pip stands on the map. */
  last: string | null;
  levels: Record<string, LevelRecord>;
  inventory: Record<string, number>;
  points: number;
  smoothies: number;
  bestSmoothie: { name: string; points: number } | null;
  combosFound: string[];
  /** Every ingredient ever collected, whether or not any are left. */
  seen: string[];
  /** The most recent smoothies, newest first. */
  history: Sip[];
  /** How many smoothies earned each rating, from Yuck to Legendary. */
  ratings: number[];
  /** Running totals behind the awards: rings, skittles, perfect runs and so on. */
  stats: Record<string, number>;
  /** Ids of awards earned. */
  awards: string[];
  muted: boolean;
}

const KEY = 'fruitrun.save.v1';
export const SAVE_KEY = KEY;

/** A second home for the save, outside the web view's own storage, which the device may wipe when it runs short. */
export interface Backup {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  remove(): Promise<void>;
}

let backup: Backup | null = null;

/** Copy every save to `to` from now on. */
export function backUpSaves(to: Backup): void {
  backup = to;
}

/** Before the game reads its save: if the device has wiped it, bring it back from the backup. */
export async function restoreSave(storage: Pick<Storage, 'getItem' | 'setItem'>, from: Backup): Promise<void> {
  if (storage.getItem(KEY) !== null) return;
  const kept = await from.get();
  if (kept !== null) storage.setItem(KEY, kept);
}

export function newSave(): Save {
  return {
    version: 1,
    last: null,
    levels: {},
    inventory: {},
    points: 0,
    smoothies: 0,
    bestSmoothie: null,
    combosFound: [],
    seen: [],
    history: [],
    ratings: [0, 0, 0, 0, 0],
    stats: {},
    awards: [],
    muted: false,
  };
}

export function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Save & { unlocked?: number };
    if (parsed.version !== 1) return null;
    delete parsed.unlocked;
    const save = { ...newSave(), ...parsed };
    // Saves from before the book existed: what is in the basket now, plus the fruit of every level finished.
    if (!parsed.seen) save.seen = [...new Set([...Object.keys(save.inventory), ...LEVELS.filter((l) => save.levels[l.id]).map((l) => l.fruit)])];
    // Pip stands on the level last played. Older saves did not record it, and a level may since have gone:
    // fall back to the furthest level finished.
    if (!save.last || !LEVELS.some((l) => l.id === save.last)) {
      const done = LEVELS.filter((l) => save.levels[l.id]);
      save.last = done.length ? done[done.length - 1].id : null;
    }
    // Awards arrived after some saves were made: hand over, quietly, any that have already been earned.
    claimAwards(save);
    return save;
  } catch {
    return null;
  }
}

export function storeSave(save: Save): void {
  const json = JSON.stringify(save);
  try {
    localStorage.setItem(KEY, json);
  } catch {
    // A full disk: the game still plays, and the backup below may yet remember.
  }
  try {
    void backup?.set(json).catch(() => {});
  } catch {
    // No backup to be had.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
  try {
    void backup?.remove().catch(() => {});
  } catch {
    // No backup to be had.
  }
}

/**
 * A level opens once any level leading to it on the map has earned the stars that level asks for. A level that
 * has already been played stays open whatever is asked now.
 */
export function isUnlocked(save: Save, level: Level): boolean {
  if (level.after.length === 0 || save.levels[level.id]) return true;
  return level.after.some((n) => {
    const before = levelByNumber(n);
    return (save.levels[before.id]?.stars ?? 0) >= before.need;
  });
}

export function starsForTime(level: Level, seconds: number): number {
  const beaten = starTimesFor(level).findIndex((limit) => seconds <= limit);
  return beaten === -1 ? 1 : 5 - beaten;
}

export interface RunResult {
  stars: number;
  time: number;
  fruits: number;
  bonuses: string[];
  newBest: boolean;
  firstClear: boolean;
  /** Every pickup on the route taken was collected. */
  perfect: boolean;
  /** Nothing was hit. */
  clean: boolean;
  pickups: number;
  possible: number;
  /** Awards earned by this run. */
  awards: Award[];
  /** Stars this level asks for before the next ones open, and whether the best so far is enough. */
  need: number;
  passed: boolean;
  /** Levels this run has just opened. */
  opened: Level[];
}

/** Bank a finished run: one fruit per star and every bonus picked up. Finishing a level opens the ones after it. */
export function completeLevel(save: Save, level: Level, seconds: number, bonuses: string[], feats?: Feats): RunResult {
  const stars = starsForTime(level, seconds);
  const previous = save.levels[level.id];
  const shut = LEVELS.filter((l) => !isUnlocked(save, l));
  // A time set on an older layout of this course cannot be compared: the first run on the new one replaces it.
  const comparable = previous?.courses === COURSES;
  const newBest = !previous || !comparable || seconds < previous.time;
  save.levels[level.id] = {
    stars: Math.max(stars, previous?.stars ?? 0),
    time: newBest ? seconds : previous.time,
    courses: COURSES,
  };
  save.inventory[level.fruit] = (save.inventory[level.fruit] ?? 0) + stars;
  for (const id of bonuses) save.inventory[id] = (save.inventory[id] ?? 0) + 1;
  for (const id of [level.fruit, ...bonuses]) if (!save.seen.includes(id)) save.seen.push(id);
  save.last = level.id;

  // Without the run's feats (a bare result, as in some tests) nothing is known about pickups or bumps.
  const perfect = Boolean(feats && feats.possible > 0 && feats.pickups >= feats.possible);
  const clean = Boolean(feats && feats.hits === 0);
  const add = (key: string, by = 1) => (save.stats[key] = (save.stats[key] ?? 0) + by);
  if (feats) {
    add('rings', feats.rings);
    add('pins', feats.pins);
    add('hits', feats.hits);
    add('turbos', feats.turbos);
    add('launches', feats.launches);
    save.stats.bestRings = Math.max(save.stats.bestRings ?? 0, feats.rings);
  }
  if (perfect) add('perfect');
  if (clean) add('clean');
  if (perfect && clean && stars === 5) add('flawless');
  if (level.mood !== 'sunny') add(level.mood);
  if (stars === 5 && (level.mood === 'rain' || level.mood === 'snow')) add('slipperyFive');
  if (previous && comparable && newBest) add('newBests');

  return {
    stars,
    time: seconds,
    fruits: stars,
    bonuses,
    newBest,
    firstClear: !previous,
    perfect,
    clean,
    pickups: feats?.pickups ?? 0,
    possible: feats?.possible ?? 0,
    awards: claimAwards(save),
    need: level.need,
    passed: save.levels[level.id].stars >= level.need,
    opened: shut.filter((l) => isUnlocked(save, l)),
  };
}

/** The super blender stands at the end of the side path on the first map: finish that path to use it. */
export function superBlenderOpen(save: Save): boolean {
  return Boolean(save.levels['level-14']);
}

/** Blend the chosen ingredients: they are used up and the smoothie's points are banked. */
export function blend(save: Save, ids: string[], capacity = MAX_JUG): SmoothieResult & { awards: Award[] } {
  const jug = ids.slice(0, capacity);
  const needed: Record<string, number> = {};
  for (const id of jug) needed[id] = (needed[id] ?? 0) + 1;
  for (const [id, count] of Object.entries(needed)) {
    if ((save.inventory[id] ?? 0) < count) throw new Error(`Not enough ${id} to blend`);
  }
  const result = scoreSmoothie(jug, capacity);
  for (const [id, count] of Object.entries(needed)) {
    const left = save.inventory[id] - count;
    if (left > 0) save.inventory[id] = left;
    else delete save.inventory[id];
  }
  save.points += result.points;
  save.smoothies += 1;
  save.ratings[result.rating - 1] += 1;
  save.history.unshift({ name: result.name, points: result.points, rating: result.rating, color: result.color, big: capacity > MAX_JUG, items: jug });
  save.history.length = Math.min(save.history.length, HISTORY);
  if (!save.bestSmoothie || result.points > save.bestSmoothie.points) {
    save.bestSmoothie = { name: result.name, points: result.points };
  }
  for (const combo of result.combos) {
    if (!save.combosFound.includes(combo.id)) save.combosFound.push(combo.id);
  }
  if (capacity > MAX_JUG) save.stats.superBlends = (save.stats.superBlends ?? 0) + 1;
  return { ...result, awards: claimAwards(save) };
}
