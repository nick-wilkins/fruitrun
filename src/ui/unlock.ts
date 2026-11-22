import { sfx } from '../audio';
import type { App, Wanted } from './app';
import { el } from './dom';
import { grownUpGate } from './gate';
import { STALL, tallStage } from './screen';

/** What to tell a grown-up after asking the store what the account owns: yes, no, or no answer. */
export const restoreNote = (owned: boolean | null) => (owned ? 'Races, cups and playing together are unlocked.' : owned === null ? 'The store could not be reached. Please try again.' : 'No purchase was found for this Apple account.');

/** What the unlock screen is headed with, by which locked thing was asked for. */
const HEADING: Record<Wanted, string> = { race: '🔒 Races are locked', cups: '🔒 Cups are locked', party: '🔒 Together is locked' };
const PAID_ONCE = 'No adverts, nothing else to buy.';

/** Where races, cups and playing together are offered. The child sees what they are; the buying sits behind a sum for a grown-up. */
export function unlockScreen(app: App): HTMLElement {
  const stage = tallStage('book-stage', STALL);
  const button = (label: string, color: string, onclick: () => void) =>
    el(`button.btn.${color}`, { onclick: () => (sfx.tap(), onclick()) }, label);

  if (app.shop.owned) {
    stage.append(el('div.card.unlock-card', {}, el('h2', {}, '🎉 Races are open!'), el('p', {}, 'Pick any level on the map and tap Race, go for a cup, or play together with friends.'), el('div.row', {}, button("Let's race ▶", 'green.big', () => app.show('map')))));
    return stage;
  }

  /** The buying itself: price, unlock and restore. */
  const counter = (dialog: HTMLElement) => {
    const note = el('p.unlock-note');
    const buy = el('button.btn.green.big', {}, 'Unlock');
    const restore = el('button.btn.blue', {}, 'Restore purchase');
    const back = el('button.btn.purple', { onclick: () => dialog.remove() }, 'Back');
    // While the store is being asked, nothing can close the dialog: its answer is shown here.
    const busy = (on: boolean) => {
      dialog.classList.toggle('busy', on);
      for (const each of [buy, restore, back]) each.disabled = on;
    };
    const price = (text: string | null) => {
      buy.textContent = text ? `Unlock for ${text}` : 'Unlock';
      if (!text && !buy.disabled) note.textContent = 'The shop cannot be reached just now. Check the internet and try again.';
    };
    if (app.shop.price) price(app.shop.price);
    else void app.price().then((text) => dialog.isConnected && price(text));
    buy.onclick = async () => {
      busy(true);
      note.textContent = 'One moment…';
      const outcome = await app.buy();
      if (!dialog.isConnected) return;
      if (outcome === 'bought' || outcome === 'pending') return app.show('unlock');
      busy(false);
      note.textContent = outcome === 'failed' ? 'That did not go through. Please try again.' : '';
    };
    restore.onclick = async () => {
      busy(true);
      note.textContent = 'Asking the store…';
      const owned = await app.restore();
      if (!dialog.isConnected) return;
      if (owned) return app.show('unlock');
      busy(false);
      note.textContent = restoreNote(owned);
    };
    return el('div.card.small.wordy', {}, el('h2', {}, 'Unlock races and cups'), el('p', {}, 'Races, cups and playing together with friends nearby. One payment. No adverts and nothing else to buy.'), note, el('div.row', {}, back, restore, buy));
  };

  const gate = () => stage.append(grownUpGate(counter));

  // What they get and what it costs are in front of the child and the grown-up alike; only the buying is behind the sum.
  const cost = el('p.unlock-cost', {}, PAID_ONCE);
  const priced = (text: string | null) => text && (cost.textContent = `${text}, paid once. ${PAID_ONCE}`);
  if (app.shop.price) priced(app.shop.price);
  else void app.price().then((text) => cost.isConnected && priced(text));

  stage.append(
    el(
      'div.card.unlock-card',
      {},
      el('h2', {}, HEADING[app.wanted ?? 'race']),
      el('p.unlock-lead', {}, 'One unlock opens all of these, to keep:'),
      el('ul.unlock-list', {}, el('li', {}, '🔵 Race three speedy marbles on any level'), el('li', {}, '🌶️ Four speeds, from Easy to Legendary'), el('li', {}, '🏆 Win trophies in the cups'), el('li', {}, '👫 Play together with friends nearby')),
      cost,
      app.shop.pending ? el('p.unlock-wait', {}, '⏳ Waiting for a grown-up to say yes. Races will open by themselves!') : el('p.unlock-note', {}, 'Every level, the blender and the book stay free.'),
      el('div.row', {}, button('Back', 'purple', () => app.show('map')), button('Ask a grown-up', 'green.big', gate)),
    ),
  );
  return stage;
}
