/** What the game knows about the one thing for sale: the unlock for races, cups and playing together. */
export interface Shop {
  owned: boolean;
  /** A purchase is waiting for a grown-up to approve it (Ask to Buy). */
  pending: boolean;
  /** The price as the store words it for this country, or null while it is not known. */
  price: string | null;
}

/** How one attempt to buy came out. */
export type Outcome = 'bought' | 'pending' | 'cancelled' | 'failed';

export const CLOSED: Shop = { owned: false, pending: false, price: null };

let shop: Shop = CLOSED;

export const shopNow = (): Shop => shop;

export function stock(to: Shop): void {
  shop = to;
}

/** The shop after an attempt to buy. Nothing but a refund, which the store reports by itself, shuts what is owned. */
export function settle(from: Shop, outcome: Outcome): Shop {
  if (from.owned) return from;
  if (outcome === 'bought') return { ...from, owned: true, pending: false };
  if (outcome === 'pending') return { ...from, pending: true };
  return from;
}

/** A sum for the grown-up gate: past the times tables a young child knows, quick for an adult. */
export function grownUpSum(random: () => number = Math.random): { a: number; b: number; answer: number } {
  const a = 13 + Math.floor(random() * 7);
  const b = 6 + Math.floor(random() * 4);
  return { a, b, answer: a * b };
}
