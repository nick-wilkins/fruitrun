import { sfx } from '../audio';
import type { Cup } from '../core/cups';
import { ingredient } from '../data/ingredients';
import { levelById, type Level } from '../data/levels';
import { asset, el } from './dom';

const WEATHER: Record<Level['mood'], string> = { sunny: '☀️', night: '🌙', midnight: '🌑', rain: '🌧️', snow: '❄️' };

export const trophySvg = `<svg viewBox="0 0 64 64"><path d="M14 10h36v12c0 12-7 20-18 20S14 34 14 22z" fill="currentColor"/><path d="M14 14H6c0 10 4 16 12 17M50 14h8c0 10-4 16-12 17" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><rect x="28" y="40" width="8" height="10" fill="currentColor"/><rect x="18" y="49" width="28" height="8" rx="3" fill="currentColor"/><path d="M20 13h8v14c-5-2-8-7-8-14z" fill="#fff" opacity=".35"/></svg>`;

/** A level as a picture card: its fruit, its number, its name and its weather. `ribbon` replaces the number, for a place in a cup. */
export function raceCard(level: Level, ribbon: string = String(level.n)): HTMLElement {
  return el(
    `div.race-card.${level.mood}`,
    {},
    el('span.race-card-n', {}, ribbon),
    el('span.race-card-sky', {}, WEATHER[level.mood]),
    el('img', { src: asset(ingredient(level.fruit).img), alt: '', draggable: false }),
    el('b', {}, level.name),
  );
}

/** A cup as a picture card: the trophy with its fruit on it, and its name. */
export function cupCard(cup: Cup): HTMLElement {
  return el('div.race-card.cup-face', {}, el('div.cup-art', { innerHTML: trophySvg }, el('img.cup-fruit', { src: asset(ingredient(cup.fruit).img), alt: '', draggable: false })), el('b', {}, cup.name));
}

/**
 * The races of a cup in the order they are run, as a row of small cards with an arrow between each. With `next`,
 * the races before it are ticked off and that one stands out.
 */
export function cupLineup(cup: Cup, next = -1): HTMLElement {
  const row = el('div.lineup');
  cup.levels.forEach((id, i) => {
    if (i) row.append(el('span.lineup-arrow', {}, '➜'));
    const card = raceCard(levelById(id), next > i ? '✓' : String(i + 1));
    if (next >= 0) card.classList.add(i < next ? 'done' : i === next ? 'next' : 'later');
    row.append(card);
  });
  return row;
}

/**
 * A row of cards to choose from by swiping: the one in the middle stands forward and the rest turn away to either
 * side. Tapping a card at the side brings it to the middle; so do the arrows. `onPick` hears of each one that
 * comes to the middle, the first included.
 */
export function carousel<T>(items: T[], face: (item: T) => HTMLElement, start: number, onPick: (item: T) => void): HTMLElement {
  const track = el('div.reel-track');
  let at = -1;
  const cards = items.map((item, i) => {
    const card = el('button.reel-card', {}, face(item));
    card.onclick = () => go(i);
    return card;
  });
  track.append(...cards);
  const middle = (card: HTMLElement) => card.offsetLeft + card.offsetWidth / 2;
  const settle = () => {
    const centre = track.scrollLeft + track.clientWidth / 2;
    let nearest = 0;
    cards.forEach((card, i) => {
      // How many cards' widths this one is from the middle: it shrinks and turns away the further it is.
      const off = (middle(card) - centre) / card.offsetWidth;
      const far = Math.min(1.5, Math.abs(off));
      card.style.transform = `perspective(30em) rotateY(${Math.max(-1, Math.min(1, off)) * -32}deg) scale(${1 - far * 0.2})`;
      card.style.opacity = String(1 - far * 0.35);
      card.style.zIndex = String(10 - Math.round(far * 4));
      if (Math.abs(off) < Math.abs((middle(cards[nearest]) - centre) / cards[nearest].offsetWidth)) nearest = i;
    });
    if (nearest === at) return;
    if (at >= 0) sfx.tap();
    at = nearest;
    cards.forEach((card, i) => card.classList.toggle('on', i === at));
    onPick(items[at]);
  };
  const go = (to: number) => {
    const card = cards[Math.max(0, Math.min(cards.length - 1, to))];
    track.scrollTo({ left: middle(card) - track.clientWidth / 2, behavior: 'smooth' });
  };
  track.addEventListener('scroll', settle, { passive: true });
  // Laid out only once it is on the page.
  setTimeout(() => {
    const card = cards[Math.max(0, Math.min(cards.length - 1, start))];
    if (card) track.scrollLeft = middle(card) - track.clientWidth / 2;
    settle();
  });
  const arrow = (label: string, step: number) => el('button.btn.blue.reel-arrow', { onclick: () => (sfx.tap(), go(at + step)), ariaLabel: step < 0 ? 'Back one' : 'On one' }, label);
  return el('div.reel', {}, items.length > 1 ? arrow('◀', -1) : null, track, items.length > 1 ? arrow('▶', 1) : null);
}
