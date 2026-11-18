import type { Save } from '../core/progress';
import type { Difficulty } from '../core/race';
import type { Level } from '../data/levels';

export type Screen = 'menu' | 'map' | 'blender' | 'superblender' | 'book';

export interface App {
  save: Save;
  /** True once the player has started a game on this device. */
  hasSave: boolean;
  /** Which world's map is on show: an index into WORLDS. */
  world: number;
  persist(): void;
  show(screen: Screen): void;
  /** Start a level, as a race against the computer marbles if `race` says how hard. */
  play(level: Level, race?: Difficulty): void;
  startAgain(): void;
  toast(text: string): void;
}
