import type { Save } from '../core/progress';
import type { Level } from '../data/levels';

export type Screen = 'menu' | 'map' | 'blender';

export interface App {
  save: Save;
  /** True once the player has started a game on this device. */
  hasSave: boolean;
  persist(): void;
  show(screen: Screen): void;
  play(level: Level): void;
  startAgain(): void;
  toast(text: string): void;
}
