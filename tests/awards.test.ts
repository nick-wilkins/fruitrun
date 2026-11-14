import { describe, expect, it } from 'vitest';
import { AWARDS } from '../src/core/awards';
import { blend, completeLevel, newSave, type Feats } from '../src/core/progress';
import { LEVELS } from '../src/data/levels';
import { starTimesFor } from '../src/game/courses';

const level = LEVELS[0];
const feats = (changes: Partial<Feats> = {}): Feats => ({ rings: 0, hits: 0, pins: 0, turbos: 0, launches: 0, pickups: 3, possible: 6, ...changes });
const names = (ids: string[]) => ids.map((id) => AWARDS.find((a) => a.id === id)?.name);

describe('awards', () => {
  it('gives a first award for finishing a level, once', () => {
    const save = newSave();
    const first = completeLevel(save, level, 9999, [], feats({ hits: 2 }));
    expect(first.awards.map((a) => a.id)).toContain('first-roll');
    const second = completeLevel(save, level, 9999, [], feats({ hits: 2 }));
    expect(second.awards.map((a) => a.id)).not.toContain('first-roll');
  });

  it('marks a perfect run when every pickup on the route was collected', () => {
    const save = newSave();
    const result = completeLevel(save, level, 9999, [], feats({ pickups: 6, possible: 6, hits: 1 }));
    expect(result.perfect).toBe(true);
    expect(result.clean).toBe(false);
    expect(result.awards.map((a) => a.id)).toContain('perfect-1');
    expect(completeLevel(save, level, 9999, [], feats()).perfect).toBe(false);
  });

  it('marks a clean run when nothing was hit', () => {
    const save = newSave();
    const result = completeLevel(save, level, 9999, [], feats({ hits: 0 }));
    expect(result.clean).toBe(true);
    expect(result.awards.map((a) => a.id)).toContain('clean-1');
  });

  it('counts rings in a run and across runs', () => {
    const save = newSave();
    expect(completeLevel(save, level, 9999, [], feats({ rings: 9 })).awards.map((a) => a.id)).not.toContain('rings-run-10');
    expect(completeLevel(save, level, 9999, [], feats({ rings: 15 })).awards.map((a) => a.id)).toEqual(expect.arrayContaining(['rings-run-10', 'rings-run-15']));
    expect(save.stats.rings).toBe(24);
  });

  it('rewards runs in the dark and the wet', () => {
    const save = newSave();
    const night = LEVELS.find((l) => l.mood === 'night')!;
    const rain = LEVELS.find((l) => l.mood === 'rain')!;
    expect(completeLevel(save, night, 9999, [], feats({ hits: 1 })).awards.map((a) => a.id)).toContain('night-1');
    expect(completeLevel(save, rain, 9999, [], feats({ hits: 1 })).awards.map((a) => a.id)).toContain('rain-1');
  });

  it('rewards smoothies too', () => {
    const save = newSave();
    save.inventory = { cinnamon: 3 };
    const yuck = blend(save, ['cinnamon', 'cinnamon', 'cinnamon']);
    expect(yuck.rating).toBe(1);
    expect(yuck.awards.map((a) => a.name)).toEqual(expect.arrayContaining(['First Sip', 'Brave Taster']));
    expect(names(save.awards)).toEqual(expect.arrayContaining(['First Sip', 'Brave Taster']));
  });

  it('has a good spread of awards, each with a name and a way to earn it', () => {
    expect(AWARDS.length).toBeGreaterThanOrEqual(35);
    expect(new Set(AWARDS.map((a) => a.id)).size).toBe(AWARDS.length);
    for (const award of AWARDS) expect(award.name.length * award.how.length).toBeGreaterThan(0);
  });
});

describe('a result without feats', () => {
  it('claims nothing about pickups or bumps and adds nothing to the totals', () => {
    const save = newSave();
    const result = completeLevel(save, level, 9999, []);
    expect(result.perfect).toBe(false);
    expect(result.clean).toBe(false);
    expect(save.stats.hits ?? 0).toBe(0);
  });
});

describe('star times', () => {
  it('are spread out, with at least a second between each band', () => {
    for (const each of LEVELS.slice(0, 6)) {
      const [five, four, three, two] = starTimesFor(each);
      expect(four - five).toBeGreaterThanOrEqual(1);
      expect(three - four).toBeGreaterThanOrEqual(1);
      expect(two - three).toBeGreaterThanOrEqual(1);
    }
  });
});
