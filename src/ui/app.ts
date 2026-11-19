import type { Player, Roster } from '../core/players';
import type { Save } from '../core/progress';
import type { Difficulty } from '../core/race';
import type { Level } from '../data/levels';

export type Screen = 'menu' | 'map' | 'blender' | 'superblender' | 'book';

export interface App {
  /** The save of whoever is playing. Before anyone has started, a blank one that is never kept. */
  save: Save;
  /** True once somebody has started a game on this device. */
  readonly hasSave: boolean;
  readonly roster: Roster;
  /** Whoever is playing, or null before anyone has started. */
  readonly player: Player | null;
  /** Make it this player's turn. */
  choose(id: string): void;
  /** Add a player, make it their turn and open the map. False if the device already has as many as it takes. */
  join(name: string): boolean;
  /** Remove a player and everything they have. */
  leave(id: string): void;
  /** Which world's map is on show: an index into WORLDS. */
  world: number;
  persist(): void;
  show(screen: Screen): void;
  /** Start a level, as a race against the computer marbles if `race` says how hard. */
  play(level: Level, race?: Difficulty): void;
  toast(text: string): void;
}
