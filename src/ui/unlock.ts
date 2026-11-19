import { sfx } from '../audio';
import { grownUpSum } from '../core/shop';
import type { App } from './app';
import { asset, el } from './dom';
import { setBackdrop } from './screen';

/** Where races and cups are offered. The child sees what they are; the buying sits behind a sum for a grown-up. */
export function unlockScreen(app: App): HTMLElement {
  const stage = el('div.stage.book-stage');
  stage.append(el('img.bg', { src: asset('assets/stall.webp'), alt: '', draggable: false }));
  setBackdrop(asset('assets/stall.webp'));
  const button = (label: string, color: string, onclick: () => void) =>
    el(`button.btn.${color}`, { onclick: () => (sfx.tap(), onclick()) }, label);

  if (app.shop.owned) {
    stage.append(el('div.card.unlock-card', {}, el('h2', {}, '🎉 Races are open!'), el('p', {}, 'Pick any level on the map and tap Race, or go for a cup.'), el('div.row', {}, button("Let's race ▶", 'green.big', () => app.show('map')))));
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
      note.textContent = owned === null ? 'The store could not be reached. Please try again.' : 'No purchase was found for this Apple account.';
    };
    return el('div.card.small', {}, el('h2', {}, 'Unlock races and cups'), el('p', {}, 'One payment. No adverts and nothing else to buy.'), note, el('div.row', {}, back, restore, buy));
  };

  /** A sum past the times tables a young child knows, answered on a number pad. */
  const gate = () => {
    const dialog = el('div.modal', { onclick: (e: MouseEvent) => e.target === e.currentTarget && !dialog.classList.contains('busy') && dialog.remove() });
    let sum = grownUpSum();
    let typed = '';
    const ask = el('p');
    const answer = el('div.gate-answer');
    const draw = (again = false) => {
      ask.textContent = `${again ? 'Not quite. Try this one: what' : 'What'} is ${sum.a} × ${sum.b}?`;
      answer.textContent = typed || ' ';
    };
    const press = (key: string) => {
      sfx.tap();
      if (key === '⌫') typed = typed.slice(0, -1);
      else if (key !== 'OK') typed = (typed + key).slice(0, 3);
      else if (Number(typed) === sum.answer) return dialog.replaceChildren(counter(dialog));
      else {
        sfx.nope();
        sum = grownUpSum();
        typed = '';
        return draw(true);
      }
      draw();
    };
    const pad = el('div.gate-pad', {}, ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].map((key) => el(`button.btn.${key === 'OK' ? 'green' : key === '⌫' ? 'orange' : 'blue'}`, { onclick: () => press(key) }, key)));
    draw();
    dialog.append(el('div.card.small.grownup', {}, el('h2', {}, 'Grown-ups only'), ask, answer, pad, el('div.row', {}, el('button.btn.purple', { onclick: () => dialog.remove() }, 'Back'))));
    stage.append(dialog);
  };

  stage.append(
    el(
      'div.card.unlock-card',
      {},
      el('h2', {}, '🏁 Races and Cups'),
      el('ul.unlock-list', {}, el('li', {}, '🔵 Race three friends on any level'), el('li', {}, '🌶️ Four speeds, from Easy to Legendary'), el('li', {}, '🏆 Win trophies in the cups')),
      app.shop.pending ? el('p.unlock-wait', {}, '⏳ Waiting for a grown-up to say yes. Races will open by themselves!') : null,
      el('div.row', {}, button('Back', 'purple', () => app.show('map')), button('Ask a grown-up', 'green.big', gate)),
    ),
  );
  return stage;
}
