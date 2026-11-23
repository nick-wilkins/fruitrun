import { describe, expect, it } from 'vitest';
import { addPlayer, cleanName, loadRoster, MAX_PLAYERS, playing, readRoster, removePlayer, storeRoster } from '../src/core/players';
import { completeLevel, keepSavesIn, newSave, type SaveStore } from '../src/core/progress';
import { LEVELS } from '../src/data/levels';

const memoryStore = () => {
  let kept: string | null = null;
  const store: SaveStore = { get: async () => kept, set: async (value) => void (kept = value), remove: async () => void (kept = null) };
  return store;
};

describe('players', () => {
  it('turns the one save from before there were players into the first player, untouched', () => {
    const old = { ...newSave(), points: 70, inventory: { apple: 3 } };
    const roster = readRoster(null, JSON.stringify(old));
    expect(roster.players).toHaveLength(1);
    expect(roster.players[0].name).toBe('Player 1');
    expect(roster.players[0].save.points).toBe(70);
    expect(roster.players[0].save.inventory).toEqual({ apple: 3 });
    expect(playing(roster)).toBe(roster.players[0]);
  });

  it('starts with nobody when nothing is stored, or what is stored cannot be read', () => {
    expect(readRoster(null, null).players).toEqual([]);
    expect(readRoster('{"version":1,"pla', null).players).toEqual([]);
    expect(playing(readRoster(null, null))).toBeNull();
  });

  it('prefers the roster to the old save once there is one', () => {
    const roster = readRoster(null, null);
    addPlayer(roster, 'Sam');
    const again = readRoster(JSON.stringify(roster), JSON.stringify({ ...newSave(), points: 999 }));
    expect(again.players.map((p) => p.name)).toEqual(['Sam']);
    expect(again.players[0].save.points).toBe(0);
  });

  it('keeps each player to their own progress', () => {
    const roster = readRoster(null, null);
    const sam = addPlayer(roster, 'Sam')!;
    const alex = addPlayer(roster, 'Alex')!;
    completeLevel(sam.save, LEVELS[0], 40, []);
    expect(alex.save.levels).toEqual({});
    expect(playing(roster)).toBe(alex);
    const back = readRoster(JSON.stringify(roster), null);
    expect(back.players[0].save.levels[LEVELS[0].id].time).toBe(40);
    expect(back.players[1].save.levels).toEqual({});
    expect(playing(back)?.name).toBe('Alex');
  });

  it('takes four players and no more', () => {
    const roster = readRoster(null, null);
    for (let i = 0; i < MAX_PLAYERS; i++) expect(addPlayer(roster, `P${i}`)).not.toBeNull();
    expect(addPlayer(roster, 'One too many')).toBeNull();
    expect(roster.players).toHaveLength(MAX_PLAYERS);
  });

  it('removes one player and leaves the others, moving on to someone who is still there', () => {
    const roster = readRoster(null, null);
    const sam = addPlayer(roster, 'Sam')!;
    const alex = addPlayer(roster, 'Alex')!;
    removePlayer(roster, alex.id);
    expect(roster.players).toEqual([sam]);
    expect(playing(roster)).toBe(sam);
    removePlayer(roster, sam.id);
    expect(playing(roster)).toBeNull();
  });

  it('tidies a typed name, and gives a blank one a number', () => {
    expect(cleanName('   Sam   ', 2)).toBe('Sam');
    expect(cleanName('', 2)).toBe('Player 2');
    expect(cleanName('A very long name indeed', 1)).toBe('A very long');
  });

  it('reads back what was stored, and carries on playing when the store fails', async () => {
    const store = memoryStore();
    keepSavesIn(store);
    const roster = readRoster(null, null);
    addPlayer(roster, 'Sam')!.save.points = 70;
    storeRoster(roster);
    expect(readRoster(await store.get(), null).players[0].save.points).toBe(70);
    keepSavesIn({ get: async () => null, set: () => Promise.reject(new Error('full')), remove: async () => {} });
    expect(() => storeRoster(roster)).not.toThrow();
  });
});

describe('best times', () => {
  const level = LEVELS[0];

  it('keeps the five best on a level, quickest first, and says where a run ranks', () => {
    const save = newSave();
    const ranks = [50, 44, 47, 41, 49, 45].map((time) => completeLevel(save, level, time, []).rank);
    expect(save.levels[level.id].times?.map((t) => t.time)).toEqual([41, 44, 45, 47, 49]);
    expect(ranks).toEqual([1, 1, 2, 1, 4, 3]);
    expect(completeLevel(save, level, 60, []).rank).toBe(0);
    expect(save.levels[level.id].times).toHaveLength(5);
    expect(save.levels[level.id].time).toBe(41);
  });

  it('starts the list with the best time a save already had', () => {
    const save = newSave();
    completeLevel(save, level, 41, []);
    delete save.levels[level.id].times;
    completeLevel(save, level, 45, []);
    expect(save.levels[level.id].times?.map((t) => t.time)).toEqual([41, 45]);
  });
});

describe('reading the players at launch', () => {
  const stored = () => {
    const roster = readRoster(null, null);
    addPlayer(roster, 'Ada');
    addPlayer(roster, 'Ben');
    return roster;
  };
  const nothingOld = async () => null;

  it('asks again when the store fails the first time, and finds everyone', async () => {
    const raw = JSON.stringify(stored());
    let asked = 0;
    const store: SaveStore = { ...memoryStore(), get: async () => (++asked === 1 ? Promise.reject(new Error('busy')) : raw) };
    const kept: string[] = [];
    const { roster, unread } = await loadRoster(store, nothingOld, async (lost) => void kept.push(lost), 0);
    expect(roster.players.map((p) => p.name)).toEqual(['Ada', 'Ben']);
    expect(unread).toBe(false);
    expect(kept).toEqual([]);
  });

  it('says so when the store never answers, so nothing is written over what it holds', async () => {
    const store: SaveStore = { ...memoryStore(), get: () => Promise.reject(new Error('gone')) };
    const { roster, unread } = await loadRoster(store, nothingOld, async () => {}, 0);
    expect(roster.players).toEqual([]);
    expect(unread).toBe(true);
  });

  it('keeps a copy of what was stored when a player in it cannot be read', async () => {
    const broken = stored() as unknown as { players: { save: unknown }[] };
    broken.players[1].save = 'nonsense';
    const raw = JSON.stringify(broken);
    const kept: string[] = [];
    const { roster } = await loadRoster({ ...memoryStore(), get: async () => raw }, nothingOld, async (lost) => void kept.push(lost), 0);
    expect(roster.players.map((p) => p.name)).toEqual(['Ada']);
    expect(kept).toEqual([raw]);
  });

  it('keeps a copy when what was stored cannot be read at all', async () => {
    const kept: string[] = [];
    await loadRoster({ ...memoryStore(), get: async () => '{"version":1,"pla' }, nothingOld, async (lost) => void kept.push(lost), 0);
    expect(kept).toEqual(['{"version":1,"pla']);
  });
});
