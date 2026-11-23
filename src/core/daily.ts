import { LEVELS, type Level } from '../data/levels';

/** The levels the website shows, one a day in turn: all of the first world. */
const DAILY = LEVELS.filter((level) => level.world === 0);

/** The level on show on this date, by the calendar where the player is: a new one at their own midnight. */
export function dailyLevel(date: Date): Level {
  const day = Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return DAILY[day % DAILY.length];
}
