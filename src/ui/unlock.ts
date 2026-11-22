import { sfx } from '../audio';
import type { App, Wanted } from './app';
import { levelById } from '../data/levels';
import { rivalDrivers } from '../game/rivals';
import { asset, el } from './dom';
import { grownUpGate } from './gate';
import { STALL, tallStage } from './screen';

/** What to tell a grown-up after asking the store what the account owns: yes, no, or no answer. */
export const restoreNote = (owned: boolean | null) => (owned ? 'Races, cups and playing together are unlocked.' : owned === null ? 'The store could not be reached. Please try again.' : 'No purchase was found for this Apple account.');

/** What the unlock screen is headed with, by which locked thing was asked for. */
const HEADING: Record<Wanted, string> = { race: '🔒 Races are locked', cups: '🔒 Cups are locked', party: '🔒 Starting a game is locked' };
/** What can be had without the unlock, said beside whichever thing was asked for. */
const FREE: Record<Wanted, string> = {
  race: 'Level 1 has a free race to try. All levels stay free.',
  cups: 'Every level, the blender and the book stay free to play.',
  party: 'Joining a game a friend starts is free. Every level stays free.',
};
const PAID_ONCE = 'No adverts, nothing else to buy.';

/** A few seconds of each thing the unlock opens, filmed from the game. */
const CLIPS: { id: Wanted; file: string; tab: string; say: string }[] = [
  { id: 'race', file: 'race', tab: '🏁 Races', say: 'Zoom past Berry, Mango and Plum to the finish!' },
  { id: 'cups', file: 'cup', tab: '🏆 Cups', say: 'Four races, one shiny trophy. Fill the shelf!' },
  { id: 'party', file: 'together', tab: '👫 Together', say: 'Race your friends, each on your own screen!' },
];

/** The clips, one after another for ever, starting with the one for what was asked for. A tap on a name shows that one. */
function preview(first: Wanted): HTMLElement {
  const film = el('video.unlock-film', { muted: true, playsInline: true, autoplay: true, preload: 'auto', disablePictureInPicture: true });
  // An iPhone only plays a film in its place, without sound, when the element itself says so.
  film.setAttribute('muted', '');
  film.setAttribute('playsinline', '');
  const say = el('p.unlock-say');
  const tabs = CLIPS.map((clip, i) => el('button.unlock-tab', { onclick: () => (sfx.tap(), show(i)) }, clip.tab));
  let at = 0;
  const show = (to: number) => {
    at = to % CLIPS.length;
    const clip = CLIPS[at];
    film.poster = asset(`assets/video/${clip.file}.jpg`);
    film.src = asset(`assets/video/${clip.file}.mp4`);
    say.textContent = clip.say;
    tabs.forEach((tab, i) => tab.classList.toggle('on', i === at));
    void film.play().catch(() => {});
  };
  film.onended = () => show(at + 1);
  show(CLIPS.findIndex((clip) => clip.id === first));
  return el('div.unlock-show', {}, film, say, el('div.unlock-tabs', {}, ...tabs));
}

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
  const wanted = app.wanted ?? 'race';
  const cost = el('p.unlock-cost', {}, `A grown-up can unlock it. Paid once. ${PAID_ONCE}`);
  const priced = (text: string | null) => text && (cost.textContent = `A grown-up can unlock it: ${text}, paid once. ${PAID_ONCE}`);
  if (app.shop.price) priced(app.shop.price);
  else void app.price().then((text) => cost.isConnected && priced(text));

  // Setting the rivals up takes a few trial runs of the course: do it now, so the free race starts at once.
  if (wanted === 'race') window.setTimeout(() => stage.isConnected && rivalDrivers(levelById('level-1'), 'easy'), 300);

  stage.append(
    el(
      'div.card.unlock-card.pitch',
      {},
      preview(wanted),
      el(
        'div.unlock-words',
        {},
        el('h2', {}, HEADING[wanted]),
        el('p.unlock-lead', {}, 'One unlock opens all the racing, to keep:'),
        el('ul.unlock-list', {}, el('li', {}, '🔵 Race Berry, Mango and Plum on every level'), el('li', {}, '🌶️ Four speeds, up to red-hot Chilli'), el('li', {}, '🏆 Win shiny trophies in the cups'), el('li', {}, '👫 Start games with friends nearby')),
        cost,
        app.shop.pending ? el('p.unlock-wait', {}, '⏳ Waiting for a grown-up to say yes. Races will open by themselves!') : el('p.unlock-note', {}, FREE[wanted]),
      ),
      el(
        'div.row',
        {},
        button('Back', 'purple', () => app.show(wanted === 'party' ? 'party' : 'map')),
        wanted === 'race' ? button('Try a free race ▶', 'orange', () => app.play(levelById('level-1'), 'easy')) : null,
        button('Ask a grown-up', 'green.big', gate),
      ),
    ),
  );
  return stage;
}
