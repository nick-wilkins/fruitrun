import { LEVELS, levelByNumber, type Level } from '../data/levels';
import { starTimesFor } from '../game/courses';
import { claimAwards, type Award } from './awards';
import type { CupRun } from './cups';
import { DIFFICULTIES, podiumFruit, type Difficulty } from './race';
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
  /** The five best times on the current layout, quickest first, with the day each was set. */
  times?: { time: number; on: string }[];
  /** The best place finished in a race here, at each difficulty raced. */
  races?: Partial<Record<Difficulty, number>>;
}

/** Today as the player's own calendar has it, as 2026-11-19. */
function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** How many best times a level remembers. */
export const BEST_TIMES = 5;

/** Has every difficulty of race been won on this level? */
export function swept(record: LevelRecord | undefined): boolean {
  return DIFFICULTIES.every(({ id }) => record?.races?.[id] === 1);
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
  /** The cup being raced, if one has been started and not finished or given up. */
  cup?: CupRun;
  /** The best trophy won in each cup at each difficulty: 1 gold, 2 silver, 3 bronze. */
  trophies?: Record<string, Partial<Record<Difficulty, number>>>;
  /** False once the player has switched off the ghost of their best run. */
  ghost?: boolean;
  /** How hard the last race was set: offered first next time. */
  race?: Difficulty;
}

export const SAVE_KEY = 'fruitrun.save.v1';

/** Where the save is kept between visits. */
export interface SaveStore {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  remove(): Promise<void>;
}

let store: SaveStore | null = null;

/** Keep the save in `to` from now on. */
export function keepSavesIn(to: SaveStore): void {
  store = to;
}

/** Do something with the store without ever letting a failure there trip the game up: it still plays, it just will not remember. */
function withStore(action: (to: SaveStore) => Promise<void>): void {
  if (!store) return;
  try {
    void action(store).catch(() => {});
  } catch {
    // Nowhere to keep it.
  }
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

/** The save held in `raw`, as it came from the store, or null if there is none or it cannot be read. */
export function readSave(raw: string | null): Save | null {
  try {
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

/** Keep `json` in the store, replacing what was there. */
export function storeRaw(json: string): void {
  withStore((to) => to.set(json));
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
  /** Where this time comes among the level's best five, 1 being the best, or 0 if it does not make the list. */
  rank: number;
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
  /** For a race: where the player finished, and the extra fruit that place won (already counted in `fruits`). */
  place?: number;
  podium?: number;
}

/** Bank a finished run: one fruit per star and every bonus picked up. Finishing a level opens the ones after it. */
export function completeLevel(save: Save, level: Level, seconds: number, bonuses: string[], feats?: Feats, place?: number, difficulty?: Difficulty): RunResult {
  const stars = starsForTime(level, seconds);
  const podium = place === undefined ? 0 : podiumFruit(place);
  const previous = save.levels[level.id];
  const shut = LEVELS.filter((l) => !isUnlocked(save, l));
  // A time set on an older layout of this course cannot be compared: the first run on the new one replaces it.
  const comparable = previous?.courses === COURSES;
  const newBest = !previous || !comparable || seconds < previous.time;
  // The list starts from the best time a save already had, from before the list was kept.
  const before = comparable ? (previous.times ?? [{ time: previous.time, on: '' }]) : [];
  const rank = before.filter((t) => t.time <= seconds).length + 1;
  const times = [...before.slice(0, rank - 1), { time: seconds, on: today() }, ...before.slice(rank - 1)].slice(0, BEST_TIMES);
  save.levels[level.id] = {
    stars: Math.max(stars, previous?.stars ?? 0),
    time: newBest ? seconds : previous.time,
    courses: COURSES,
    times,
    ...(previous?.races ? { races: previous.races } : {}),
  };
  if (place !== undefined && difficulty) {
    const record = save.levels[level.id];
    const before = swept(record);
    record.races = { ...record.races, [difficulty]: Math.min(place, record.races?.[difficulty] ?? Infinity) };
    if (!before && swept(record)) save.stats.sweeps = (save.stats.sweeps ?? 0) + 1;
  }
  save.inventory[level.fruit] = (save.inventory[level.fruit] ?? 0) + stars + podium;
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
  if (place !== undefined) add('races');
  if (place === 1) add('raceWins');
  if (place === 1 && difficulty === 'hard') add('hardWins');
  if (level.mood !== 'sunny') add(level.mood);
  if (stars === 5 && (level.mood === 'rain' || level.mood === 'snow')) add('slipperyFive');
  if (previous && comparable && newBest) add('newBests');

  return {
    stars,
    time: seconds,
    fruits: stars + podium,
    bonuses,
    newBest,
    rank: rank <= BEST_TIMES ? rank : 0,
    firstClear: !previous,
    perfect,
    clean,
    pickups: feats?.pickups ?? 0,
    possible: feats?.possible ?? 0,
    awards: claimAwards(save),
    need: level.need,
    passed: save.levels[level.id].stars >= level.need,
    opened: shut.filter((l) => isUnlocked(save, l)),
    ...(place === undefined ? {} : { place, podium }),
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
