import { createHash, randomBytes } from 'node:crypto';

/** How many races a visitor to the website may start in a day. */
export const GOES = 3;

const DAY = 86_400_000;
/** Past this many visitors in a day no more are counted, so the count can never grow without end. */
const MOST = 200_000;

/**
 * Counts the races started from each address on each day. Held in memory only: an address is kept scrambled with
 * a key that is made afresh whenever the server starts, and a day's counts are dropped once the day has passed
 * everywhere.
 */
export function createGoes(limit = GOES) {
  const salt = randomBytes(16);
  /** @type {Map<string, Map<string, number>>} */
  const days = new Map();
  const scrambled = (address) => createHash('sha256').update(salt).update(address).digest('base64');

  const serverDay = (now) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  /** Drop the days that are over everywhere. */
  function tidy(now = new Date()) {
    for (const held of days.keys()) if (Date.parse(`${held}T00:00:00Z`) < serverDay(now) - DAY) days.delete(held);
  }

  /** The visitor's own date, which may be a day either side of the server's. */
  function counts(day, now) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    const at = Date.parse(`${day}T00:00:00Z`);
    if (Number.isNaN(at) || Math.abs(at - serverDay(now)) > DAY) return null;
    tidy(now);
    if (!days.has(day)) days.set(day, new Map());
    return days.get(day);
  }

  return {
    /** How many goes this address has left on this day, or null if the day is not one a visitor could be in. */
    left(address, day, now = new Date()) {
      const today = counts(day, now);
      return today ? limit - (today.get(scrambled(address)) ?? 0) : null;
    },
    /** Use a go. Null if the day is not one a visitor could be in. */
    take(address, day, now = new Date()) {
      const today = counts(day, now);
      if (!today) return null;
      const who = scrambled(address);
      const used = today.get(who) ?? 0;
      if (used >= limit) return { ok: false, left: 0 };
      if (today.size < MOST || today.has(who)) today.set(who, used + 1);
      return { ok: true, left: limit - used - 1 };
    },
    tidy,
    /** What is held, for checking: each day and its scrambled addresses. */
    held() {
      return [...days].map(([day, each]) => [day, [...each.keys()]]);
    },
  };
}
