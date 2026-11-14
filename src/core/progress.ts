import { LEVELS, levelByNumber, type Level } from '../data/levels';
import { starTimesFor } from '../game/courses';
import { MAX_JUG, scoreSmoothie, type SmoothieResult } from './smoothie';

/** A smoothie as remembered in the book. */
export interface Sip {
  name: string;
  points: number;
  rating: number;
  color: string;
  /** Made in the super blender. */
  big: boolean;
}

const HISTORY = 12;

/** Bump when courses are re-laid, so best times set on the old layouts stop counting against the new ones. */
export const COURSES = 2;

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
  muted: boolean;
}

const KEY = 'fruitrun.save.v1';

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
    // Saves from before the book existed only know what is in the basket now.
    if (!parsed.seen) save.seen = Object.keys(save.inventory);
    // Pip stands on the level last played. Older saves did not record it, and a level may since have gone:
    // fall back to the furthest level finished.
    if (!save.last || !LEVELS.some((l) => l.id === save.last)) {
      const done = LEVELS.filter((l) => save.levels[l.id]);
      save.last = done.length ? done[done.length - 1].id : null;
    }
    return save;
  } catch {
    return null;
  }
}

export function storeSave(save: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Private browsing or a full disk: the game still plays, it just will not remember.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

/** A level opens once any level leading to it on the map has been finished. */
export function isUnlocked(save: Save, level: Level): boolean {
  return level.after.length === 0 || level.after.some((n) => Boolean(save.levels[levelByNumber(n).id]));
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
}

/** Bank a finished run: one fruit per star and every bonus picked up. Finishing a level opens the ones after it. */
export function completeLevel(save: Save, level: Level, seconds: number, bonuses: string[]): RunResult {
  const stars = starsForTime(level, seconds);
  const previous = save.levels[level.id];
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
  return { stars, time: seconds, fruits: stars, bonuses, newBest, firstClear: !previous };
}

/** The super blender stands at the end of the side path on the first map: finish that path to use it. */
export function superBlenderOpen(save: Save): boolean {
  return Boolean(save.levels['level-14']);
}

/** Blend the chosen ingredients: they are used up and the smoothie's points are banked. */
export function blend(save: Save, ids: string[], capacity = MAX_JUG): SmoothieResult {
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
  save.history.unshift({ name: result.name, points: result.points, rating: result.rating, color: result.color, big: capacity > MAX_JUG });
  save.history.length = Math.min(save.history.length, HISTORY);
  if (!save.bestSmoothie || result.points > save.bestSmoothie.points) {
    save.bestSmoothie = { name: result.name, points: result.points };
  }
  for (const combo of result.combos) {
    if (!save.combosFound.includes(combo.id)) save.combosFound.push(combo.id);
  }
  return result;
}
