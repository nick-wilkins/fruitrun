export type Difficulty = 'easy' | 'medium' | 'hard' | 'legendary';

export const DIFFICULTIES: { id: Difficulty; name: string }[] = [
  { id: 'easy', name: 'Easy' },
  { id: 'medium', name: 'Medium' },
  { id: 'hard', name: 'Hard' },
  { id: 'legendary', name: 'Legendary' },
];

/** The computer marbles: Pip's friends, told apart by colour. */
export interface Rival {
  name: string;
  /** Body colour, also used for its dot and its row in the results. */
  color: string;
  /** A paler shade for the belly. */
  pale: string;
  /** A deeper shade for the leaves and the bubble's stripes. */
  deep: string;
  /** Set for the one who is out to win and looks it: a scowl, and flames behind. */
  mean?: boolean;
}

export const RIVALS: Rival[] = [
  { name: 'Berry', color: '#4aa3ff', pale: '#cfe6ff', deep: '#2563d6' },
  { name: 'Mango', color: '#ffa32e', pale: '#ffe2b0', deep: '#e0661a' },
  { name: 'Plum', color: '#ff7ac0', pale: '#ffd9ee', deep: '#c7359a' },
];

/** The legendary rival races alone: one red-hot marble, quicker than all of Pip's friends. */
export const LEGEND: Rival = { name: 'Chilli', color: '#e3262b', pale: '#ffb38a', deep: '#22141a', mean: true };

/** Who the player races at each difficulty. */
export function rivalsFor(difficulty: Difficulty): Rival[] {
  return difficulty === 'legendary' ? [LEGEND] : RIVALS;
}

/** The player's own colour in race displays: Pip's green. */
export const YOUR_COLOR = '#8fe04a';

export interface Finisher {
  name: string;
  color: string;
  time: number;
  you: boolean;
}

/** Everyone in the order they crossed the line, by each marble's own time. A dead heat goes to the player. */
export function finishingOrder(yourTime: number, rivals: { name: string; color: string; time: number }[]): Finisher[] {
  const all: Finisher[] = [{ name: 'You', color: YOUR_COLOR, time: yourTime, you: true }, ...rivals.map(({ name, color, time }) => ({ name, color, time, you: false }))];
  return all.sort((a, b) => a.time - b.time || Number(b.you) - Number(a.you));
}

/** Extra fruit for a place on the podium, on top of what the stars give. */
export function podiumFruit(place: number): number {
  return Math.max(0, 4 - place);
}

/** Whether races are open to this player. They sit behind the purchase; until that exists, everyone has them. */
export function racesUnlocked(): boolean {
  return true;
}
