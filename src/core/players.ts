import { newSave, readSave, storeRaw, type Save, type SaveStore } from './progress';

/** One child's game on this device. */
export interface Player {
  id: string;
  name: string;
  save: Save;
}

/** Everyone who plays on this device, and whose turn it is. */
export interface Roster {
  version: 1;
  current: string | null;
  players: Player[];
}

export const ROSTER_KEY = 'fruitrun.players.v1';
export const MAX_PLAYERS = 4;
const NAME_LENGTH = 12;

/** A name as it will be shown: trimmed and short, or "Player 2" if nothing was typed. */
export function cleanName(typed: string, number: number): string {
  const name = typed.replace(/\s+/g, ' ').trim().slice(0, NAME_LENGTH).trim();
  return name || `Player ${number}`;
}

/**
 * The roster held in `raw`. Where there is none yet, the single save from before there were players (`old`)
 * becomes the first player, so nobody loses what they had.
 */
export function readRoster(raw: string | null, old: string | null): Roster {
  try {
    const parsed = raw ? (JSON.parse(raw) as Roster) : null;
    if (parsed?.version === 1 && Array.isArray(parsed.players)) {
      const players: Player[] = [];
      for (const player of parsed.players) {
        const save = readSave(JSON.stringify(player.save));
        if (save && typeof player.id === 'string') players.push({ id: player.id, name: cleanName(String(player.name ?? ''), players.length + 1), save });
      }
      return { version: 1, current: players.some((p) => p.id === parsed.current) ? parsed.current : (players[0]?.id ?? null), players };
    }
  } catch {
    // Unreadable: fall through to whatever else there is.
  }
  const save = readSave(old);
  return save ? { version: 1, current: 'p1', players: [{ id: 'p1', name: 'Player 1', save }] } : { version: 1, current: null, players: [] };
}

/** How many players `raw` says it holds, or -1 when it cannot be read at all. */
function storedPlayers(raw: string): number {
  try {
    const players = (JSON.parse(raw) as Partial<Roster> | null)?.players;
    return Array.isArray(players) ? players.length : -1;
  } catch {
    return -1;
  }
}

/**
 * The roster at launch. The store is asked up to three times, `wait` milliseconds apart. If it never answers,
 * `unread` is true: what it holds is unknown and must not be written over blind. If it holds players that cannot
 * be read, `keep` is handed everything that was stored, so the next save does not destroy it.
 */
export async function loadRoster(store: SaveStore, old: () => Promise<string | null>, keep: (raw: string) => Promise<void>, wait = 200): Promise<{ roster: Roster; unread: boolean }> {
  for (let tries = 0; tries < 3; tries++) {
    try {
      const raw = await store.get();
      const roster = readRoster(raw, await old());
      if (raw && storedPlayers(raw) !== roster.players.length) await keep(raw).catch(() => {});
      return { roster, unread: false };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  return { roster: readRoster(null, null), unread: true };
}

/** Whoever is playing now, or null before anyone has started. */
export function playing(roster: Roster): Player | null {
  return roster.players.find((p) => p.id === roster.current) ?? null;
}

/** Add a player and make it their turn. Null when the device already has as many as it takes. */
export function addPlayer(roster: Roster, name: string, muted = false): Player | null {
  if (roster.players.length >= MAX_PLAYERS) return null;
  let n = roster.players.length + 1;
  while (roster.players.some((p) => p.id === `p${n}`)) n++;
  const player = { id: `p${n}`, name: cleanName(name, roster.players.length + 1), save: { ...newSave(), muted } };
  roster.players.push(player);
  roster.current = player.id;
  return player;
}

export function removePlayer(roster: Roster, id: string): void {
  roster.players = roster.players.filter((p) => p.id !== id);
  if (roster.current === id) roster.current = roster.players[0]?.id ?? null;
}

export function storeRoster(roster: Roster): void {
  storeRaw(JSON.stringify(roster));
}
