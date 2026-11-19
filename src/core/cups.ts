import { ingredient } from '../data/ingredients';
import { LEVELS, type Level } from '../data/levels';
import { claimAwards, type Award } from './awards';
import type { Save } from './progress';
import { RIVALS, YOUR_COLOR, type Difficulty, type Finisher } from './race';

/** Four levels raced one after another, with points for each place and a trophy at the end. */
export interface Cup {
  id: string;
  name: string;
  world: number;
  /** Level ids, in the order they are raced. */
  levels: string[];
  /** The fruit the cup is named after: its picture stands for the cup. */
  fruit: string;
}

export const CUP_RACES = 4;
/** Points for coming 1st, 2nd, 3rd and 4th. */
export const CUP_POINTS = [10, 7, 5, 3];

/** A cup being raced: who it is against, which race is next and everyone's points so far. */
export interface CupRun {
  id: string;
  difficulty: Difficulty;
  /** How many races have been run. */
  race: number;
  /** The player's points, then each rival's in their usual order. */
  points: number[];
}

/** How a finished cup came out. */
export interface CupResult {
  cup: Cup;
  difficulty: Difficulty;
  /** Final position, 1 to 4. */
  position: number;
  points: number;
  /** Won every race. */
  perfect: boolean;
  /** The trophy is better than any won in this cup at this difficulty before. */
  best: boolean;
  /** Awards the cup earned. */
  awards: Award[];
  table: Standing[];
}

export interface Standing {
  name: string;
  color: string;
  points: number;
  you: boolean;
}

/** Fruit already lending its name to a cup: two worlds can start with the same one, and no two cups share a name. */
const named = new Set<string>();

function cupsOf(world: number, levels: Level[]): Cup[] {
  const cups: Cup[] = [];
  for (let from = 0; from < levels.length; from += CUP_RACES) {
    // A world's levels rarely divide by four: its last cup takes the last four, sharing a level or two.
    const four = levels.slice(Math.min(from, levels.length - CUP_RACES), Math.min(from, levels.length - CUP_RACES) + CUP_RACES);
    const fruit = (four.find((l) => !named.has(l.fruit)) ?? four[0]).fruit;
    named.add(fruit);
    cups.push({ id: `cup-${world}-${cups.length + 1}`, name: `${ingredient(fruit).name} Cup`, world, levels: four.map((l) => l.id), fruit });
  }
  return cups;
}

export const CUPS: Cup[] = [...new Set(LEVELS.map((l) => l.world))].flatMap((world) => cupsOf(world, LEVELS.filter((l) => l.world === world)));

export const cupById = (id: string) => CUPS.find((cup) => cup.id === id);

/** A cup can be entered once every level in it has been finished. */
export function cupOpen(save: Save, cup: Cup): boolean {
  return cup.levels.every((id) => save.levels[id]);
}

export function startCup(save: Save, cup: Cup, difficulty: Difficulty): void {
  save.cup = { id: cup.id, difficulty, race: 0, points: [0, ...RIVALS.map(() => 0)] };
}

export function quitCup(save: Save): void {
  delete save.cup;
}

/** Everyone in the cup under way, most points first. Level on points, the player is ahead. */
export function standings(save: Save): Standing[] {
  const run = save.cup;
  if (!run) return [];
  const rows: Standing[] = [{ name: 'You', color: YOUR_COLOR, points: run.points[0], you: true }, ...RIVALS.map((rival, i) => ({ name: rival.name, color: rival.color, points: run.points[i + 1] ?? 0, you: false }))];
  return rows.sort((a, b) => b.points - a.points || Number(b.you) - Number(a.you));
}

/**
 * Add a race's points to the cup under way. After the last race the cup is over: the trophy is kept if it beats
 * what was there, and the result is returned. Until then, null.
 */
export function scoreCupRace(save: Save, order: Finisher[]): CupResult | null {
  const run = save.cup;
  const cup = run && cupById(run.id);
  if (!run || !cup) return null;
  order.forEach((row, place) => {
    const rival = RIVALS.findIndex((each) => each.name === row.name);
    if (!row.you && rival < 0) return;
    const who = row.you ? 0 : rival + 1;
    run.points[who] = (run.points[who] ?? 0) + (CUP_POINTS[place] ?? 0);
  });
  run.race++;
  if (run.race < CUP_RACES) return null;

  const table = standings(save);
  const position = table.findIndex((row) => row.you) + 1;
  const points = run.points[0];
  const perfect = points === CUP_POINTS[0] * CUP_RACES;
  const before = save.trophies?.[cup.id]?.[run.difficulty];
  const best = position <= 3 && (!before || position < before);
  if (best) save.trophies = { ...save.trophies, [cup.id]: { ...save.trophies?.[cup.id], [run.difficulty]: position } };
  const add = (key: string) => (save.stats[key] = (save.stats[key] ?? 0) + 1);
  add('cups');
  if (position === 1 && before !== 1) add('cupGolds');
  if (position === 1 && run.difficulty === 'hard' && before !== 1) add('cupHardGolds');
  if (perfect) add('cupPerfect');
  const result = { cup, difficulty: run.difficulty, position, points, perfect, best, table, awards: claimAwards(save) };
  delete save.cup;
  return result;
}
