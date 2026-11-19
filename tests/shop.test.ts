import { describe, expect, it } from 'vitest';
import { racesUnlocked } from '../src/core/race';
import { CLOSED, grownUpSum, settle, stock } from '../src/core/shop';

describe('the shop', () => {
  it('keeps races shut until the unlock is owned', () => {
    stock(CLOSED);
    expect(racesUnlocked()).toBe(false);
    stock({ ...CLOSED, owned: true });
    expect(racesUnlocked()).toBe(true);
    stock(CLOSED);
  });

  it('opens on a purchase and clears any wait', () => {
    expect(settle({ owned: false, pending: true, price: '£2.99' }, 'bought')).toEqual({ owned: true, pending: false, price: '£2.99' });
  });

  it('waits, still shut, when a grown-up has to approve', () => {
    expect(settle(CLOSED, 'pending')).toEqual({ ...CLOSED, pending: true });
  });

  it('changes nothing when the purchase is cancelled or fails', () => {
    const waiting = { owned: false, pending: true, price: '£2.99' };
    expect(settle(waiting, 'cancelled')).toEqual(waiting);
    expect(settle(waiting, 'failed')).toEqual(waiting);
  });

  it('never shuts what is already owned', () => {
    const owned = { owned: true, pending: false, price: null };
    expect(settle(owned, 'cancelled')).toEqual(owned);
    expect(settle(owned, 'pending')).toEqual(owned);
  });
});

describe('the grown-up sum', () => {
  it('is a two digit number times a one digit number, harder than a times table', () => {
    for (let seed = 0; seed < 200; seed++) {
      let n = seed;
      const random = () => ((n = (n * 9301 + 49297) % 233280), n / 233280);
      const sum = grownUpSum(random);
      expect(sum.a).toBeGreaterThanOrEqual(13);
      expect(sum.a).toBeLessThanOrEqual(19);
      expect(sum.b).toBeGreaterThanOrEqual(6);
      expect(sum.b).toBeLessThanOrEqual(9);
      expect(sum.answer).toBe(sum.a * sum.b);
    }
  });
});
