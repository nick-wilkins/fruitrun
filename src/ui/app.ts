import type { Cup, CupResult } from '../core/cups';
import type { Player, Roster } from '../core/players';
import type { Save } from '../core/progress';
import type { Difficulty } from '../core/race';
import type { Outcome, Shop } from '../core/shop';
import type { Level } from '../data/levels';

export type Screen = 'menu' | 'map' | 'blender' | 'superblender' | 'book' | 'cups' | 'cuptable' | 'unlock';

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
  play(level: Level, race?: Difficulty, cup?: string): void;
  /** Enter a cup at this difficulty and start its first race. */
  startCup(cup: Cup, difficulty: Difficulty): void;
  /** Start the next race of the cup under way. */
  playCup(): void;
  /** How the cup just finished came out, for the table shown after its last race. */
  cupResult: CupResult | null;
  toast(text: string): void;
  /** What is known of the unlock for races and cups. */
  readonly shop: Shop;
  /** The unlock's price, asking the store if it is not yet known; null if the store cannot be reached. */
  price(): Promise<string | null>;
  /** Try to buy the unlock. Only ever called from behind the grown-up gate. */
  buy(): Promise<Outcome>;
  /** Ask the store whether this account already owns the unlock; null if the store cannot be reached. */
  restore(): Promise<boolean | null>;
}
