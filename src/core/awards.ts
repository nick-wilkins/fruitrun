import { INGREDIENTS } from '../data/ingredients';
import { LEVELS } from '../data/levels';
import type { Save } from './progress';
import { COMBOS } from './smoothie';

export interface Award {
  id: string;
  name: string;
  /** How to earn it, as shown in the book. */
  how: string;
  /** Icon path, relative to the site root. */
  icon: string;
  done(save: Save): boolean;
}

const STAR = 'assets/ui/star.png';
const CUP = 'assets/smoothie-cup.png';
const fruit = (id: string) => `assets/fruits/${id}.png`;
const item = (id: string) => `assets/items/${id}.png`;

const stat = (save: Save, key: string) => save.stats[key] ?? 0;
const finished = (save: Save) => LEVELS.filter((l) => save.levels[l.id]);
const fiveStars = (save: Save) => finished(save).filter((l) => save.levels[l.id].stars === 5).length;
const worldDone = (save: Save, world: number) => LEVELS.filter((l) => l.world === world).every((l) => save.levels[l.id]);

/** A run of awards for reaching bigger and bigger counts of the same thing. */
const tiers = (id: string, icon: string, count: (save: Save) => number, steps: [number, string, string][]): Award[] =>
  steps.map(([goal, name, how]) => ({ id: `${id}-${goal}`, name, how, icon, done: (save) => count(save) >= goal }));

export const AWARDS: Award[] = [
  { id: 'first-roll', name: 'First Roll', how: 'Finish a level', icon: fruit('apple'), done: (s) => finished(s).length >= 1 },
  ...tiers('levels', fruit('banana'), (s) => finished(s).length, [
    [10, 'Getting Going', 'Finish 10 levels'],
    [34, 'Halfway There', 'Finish 34 levels'],
    [68, 'Every Last One', 'Finish all 68 levels'],
  ]),
  { id: 'world-1', name: 'Meadow Master', how: 'Finish every level in Sunny Meadow', icon: fruit('dragonfruit'), done: (s) => worldDone(s, 0) },
  { id: 'world-2', name: 'Tropic Thunder', how: 'Finish every level in Tropical Falls', icon: fruit('pineapple'), done: (s) => worldDone(s, 1) },
  { id: 'world-3', name: 'Village Hero', how: 'Finish every level in Blossom Village', icon: fruit('cherry'), done: (s) => worldDone(s, 2) },

  ...tiers('five', STAR, fiveStars, [
    [1, 'Five Star', 'Get five stars on a level'],
    [10, 'Star Collector', 'Get five stars on 10 levels'],
    [34, 'Superstar', 'Get five stars on 34 levels'],
    [68, 'Galaxy Brain', 'Get five stars on every level'],
  ]),
  ...tiers('best', STAR, (s) => stat(s, 'newBests'), [
    [5, 'Record Breaker', 'Beat your own best time 5 times'],
    [20, 'Always Faster', 'Beat your own best time 20 times'],
  ]),

  ...tiers('perfect', fruit('strawberry'), (s) => stat(s, 'perfect'), [
    [1, 'Perfect Run', 'Collect every pickup on your route in one run'],
    [5, 'Hoover', 'Make 5 perfect runs'],
    [20, 'Nothing Left Behind', 'Make 20 perfect runs'],
  ]),
  ...tiers('clean', fruit('blueberry'), (s) => stat(s, 'clean'), [
    [1, 'Untouchable', 'Finish a level without hitting anything'],
    [5, 'Smooth Operator', 'Make 5 runs without hitting anything'],
    [20, 'Ghost', 'Make 20 runs without hitting anything'],
  ]),
  { id: 'flawless', name: 'Flawless', how: 'A perfect run with five stars and nothing hit', icon: STAR, done: (s) => stat(s, 'flawless') >= 1 },

  ...tiers('rings-run', item('honey'), (s) => stat(s, 'bestRings'), [
    [10, 'Ring Leader', 'Go through 10 rings in one run'],
    [15, 'Lord of the Rings', 'Go through 15 rings in one run'],
    [20, 'Ringmaster', 'Go through 20 rings in one run'],
  ]),
  ...tiers('rings', item('honey'), (s) => stat(s, 'rings'), [
    [100, 'Hoop Dreams', 'Go through 100 rings altogether'],
    [500, 'Ring a Ding', 'Go through 500 rings altogether'],
  ]),

  { id: 'night-1', name: 'Night Owl', how: 'Finish a level at night', icon: fruit('blackberry'), done: (s) => stat(s, 'night') >= 1 },
  { id: 'midnight-1', name: 'Midnight Marble', how: 'Finish a level at midnight', icon: fruit('plum'), done: (s) => stat(s, 'midnight') >= 1 },
  { id: 'rain-1', name: 'Singing in the Rain', how: 'Finish a level in the rain', icon: fruit('grape'), done: (s) => stat(s, 'rain') >= 1 },
  { id: 'snow-1', name: 'Ice Skater', how: 'Finish a level on ice', icon: item('ice'), done: (s) => stat(s, 'snow') >= 1 },
  {
    id: 'weatherproof',
    name: 'Weatherproof',
    how: 'Finish a level in rain, on ice, at night and at midnight',
    icon: item('ice'),
    done: (s) => ['night', 'midnight', 'rain', 'snow'].every((mood) => stat(s, mood) >= 1),
  },
  { id: 'storm-chaser', name: 'Storm Chaser', how: 'Five stars in the rain or on ice', icon: STAR, done: (s) => stat(s, 'slipperyFive') >= 1 },

  ...tiers('turbo', item('ginger'), (s) => stat(s, 'turbos'), [
    [1, 'Whoosh', 'Hit a turbo pad'],
    [10, 'Rocket Fuel', 'Hit 10 turbo pads'],
  ]),
  ...tiers('launch', fruit('coconut'), (s) => stat(s, 'launches'), [
    [1, 'Lift Off', 'Fly across a gap'],
    [10, 'High Flyer', 'Fly across 10 gaps'],
  ]),
  ...tiers('pins', item('macadamia'), (s) => stat(s, 'pins'), [
    [50, 'Strike!', 'Knock over 50 skittles'],
    [200, 'Bowling Champion', 'Knock over 200 skittles'],
  ]),
  { id: 'crashes-50', name: 'Crash Test Pip', how: 'Bump into 50 things', icon: item('walnut'), done: (s) => stat(s, 'hits') >= 50 },

  ...tiers('smoothies', CUP, (s) => s.smoothies, [
    [1, 'First Sip', 'Blend a smoothie'],
    [10, 'Regular', 'Blend 10 smoothies'],
    [50, 'Smoothie Bar', 'Blend 50 smoothies'],
  ]),
  { id: 'yuck', name: 'Brave Taster', how: 'Blend something Pip thinks is yuck', icon: item('spirulina'), done: (s) => (s.ratings[0] ?? 0) >= 1 },
  ...tiers('legendary', CUP, (s) => s.ratings[4] ?? 0, [
    [1, 'Legend', 'Blend a Legendary smoothie'],
    [5, 'Living Legend', 'Blend 5 Legendary smoothies'],
  ]),
  { id: 'super-blend', name: 'Super Blender', how: 'Blend in the Super Blender', icon: CUP, done: (s) => stat(s, 'superBlends') >= 1 },
  ...tiers('recipes', item('vanilla'), (s) => s.combosFound.length, [
    [5, 'Recipe Hunter', 'Find 5 secret recipes'],
    [20, 'Head Chef', 'Find 20 secret recipes'],
    [COMBOS.length, 'Cookbook Complete', 'Find every secret recipe'],
  ]),
  ...tiers('collect', item('almond'), (s) => s.seen.length, [
    [20, 'Forager', 'Collect 20 different ingredients'],
    [50, 'Well Stocked', 'Collect 50 different ingredients'],
    [INGREDIENTS.length, 'Full Larder', 'Collect every ingredient'],
  ]),
  ...tiers('points', CUP, (s) => s.points, [
    [2000, 'Tasty Total', 'Earn 2,000 smoothie points'],
    [20000, 'Points Mountain', 'Earn 20,000 smoothie points'],
    [100000, 'Smoothie Tycoon', 'Earn 100,000 smoothie points'],
  ]),
];

/** Record any awards the save has now earned, and return the new ones. */
export function claimAwards(save: Save): Award[] {
  const fresh = AWARDS.filter((award) => !save.awards.includes(award.id) && award.done(save));
  for (const award of fresh) save.awards.push(award.id);
  return fresh;
}
