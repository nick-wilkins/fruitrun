import { describe, expect, it } from 'vitest';
import { CUPS, CUP_POINTS, cupOpen, quitCup, scoreCupRace, standings, startCup } from '../src/core/cups';
import { claimAwards } from '../src/core/awards';
import { completeLevel, newSave } from '../src/core/progress';
import { RIVALS, type Finisher } from '../src/core/race';
import { LEVELS, WORLDS } from '../src/data/levels';

/** A finishing order with the player in `place` and the rivals in their usual order around them. */
function order(place: number): Finisher[] {
  const rows: Finisher[] = RIVALS.map((rival, i) => ({ name: rival.name, color: rival.color, time: 50 + i, you: false }));
  rows.splice(place - 1, 0, { name: 'You', color: '#fff', time: 49, you: true });
  return rows;
}

const cup = CUPS[0];
const played = () => {
  const save = newSave();
  for (const level of LEVELS) completeLevel(save, level, 60, []);
  return save;
};

describe('cups', () => {
  it('are four levels each, cover every level, and every world has some', () => {
    for (const each of CUPS) expect(each.levels).toHaveLength(4);
    expect(new Set(CUPS.flatMap((each) => each.levels)).size).toBe(LEVELS.length);
    WORLDS.forEach((_, world) => expect(CUPS.some((each) => each.world === world)).toBe(true));
    expect(new Set(CUPS.map((each) => each.id)).size).toBe(CUPS.length);
  });

  it('open once every level in them has been finished', () => {
    const save = newSave();
    expect(cupOpen(save, cup)).toBe(false);
    for (const id of cup.levels.slice(0, 3)) completeLevel(save, LEVELS.find((l) => l.id === id)!, 60, []);
    expect(cupOpen(save, cup)).toBe(false);
    completeLevel(save, LEVELS.find((l) => l.id === cup.levels[3])!, 60, []);
    expect(cupOpen(save, cup)).toBe(true);
  });

  it('give 10, 7, 5 and 3 points by place, and carry everyone\'s through the cup', () => {
    const save = played();
    startCup(save, cup, 'medium');
    expect(scoreCupRace(save, order(2))).toBeNull();
    expect(save.cup).toMatchObject({ id: cup.id, difficulty: 'medium', race: 1 });
    expect(scoreCupRace(save, order(1))).toBeNull();
    const table = standings(save);
    expect(CUP_POINTS).toEqual([10, 7, 5, 3]);
    expect(table.map((row) => [row.name, row.points])).toEqual([
      ['You', 17],
      [RIVALS[0].name, 17],
      [RIVALS[1].name, 10],
      [RIVALS[2].name, 6],
    ]);
    expect(table[0].you).toBe(true);
  });

  it('end after four races with a trophy for the top three, kept per difficulty and never made worse', () => {
    const save = played();
    startCup(save, cup, 'easy');
    let done = null;
    for (const place of [1, 1, 1, 1]) done = scoreCupRace(save, order(place));
    expect(done).toMatchObject({ position: 1, points: 40, perfect: true });
    expect(save.cup).toBeUndefined();
    expect(save.trophies?.[cup.id]).toEqual({ easy: 1 });
    expect(save.stats.cups).toBe(1);
    expect(save.stats.cupGolds).toBe(1);

    startCup(save, cup, 'easy');
    for (const place of [3, 3, 3, 3]) done = scoreCupRace(save, order(place));
    expect(done?.position).toBe(3);
    expect(save.trophies?.[cup.id]).toEqual({ easy: 1 });

    startCup(save, cup, 'hard');
    for (const place of [4, 4, 4, 4]) done = scoreCupRace(save, order(place));
    expect(done).toMatchObject({ position: 4, points: 12 });
    expect(save.trophies?.[cup.id]).toEqual({ easy: 1 });
  });

  it('can be left part-way and carried on, or given up', () => {
    const save = played();
    startCup(save, cup, 'hard');
    scoreCupRace(save, order(1));
    const back = JSON.parse(JSON.stringify(save));
    expect(back.cup.race).toBe(1);
    expect(standings(back)[0]).toMatchObject({ you: true, points: 10 });
    quitCup(back);
    expect(back.cup).toBeUndefined();
    expect(back.trophies).toBeUndefined();
  });
});

describe('racing awards', () => {
  it('come from winning races, sweeping a level and winning cups', () => {
    const save = played();
    const level = LEVELS[0];
    const won = completeLevel(save, level, 50, [], undefined, 1, 'easy').awards.map((a) => a.id);
    expect(won).toContain('race-wins-1');
    completeLevel(save, level, 50, [], undefined, 1, 'medium');
    const swept = completeLevel(save, level, 50, [], undefined, 1, 'hard').awards.map((a) => a.id);
    expect(swept).toEqual(expect.arrayContaining(['hard-win', 'sweep-1']));
    startCup(save, cup, 'hard');
    for (let i = 0; i < 4; i++) scoreCupRace(save, order(1));
    expect(claimAwards(save).map((a) => a.id)).toEqual(expect.arrayContaining(['cups-1', 'cup-gold-1', 'cup-hard-gold', 'cup-perfect']));
  });
});
