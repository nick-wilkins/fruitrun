import { sfx } from '../audio';
import { grownUpSum } from '../core/shop';
import { el } from './dom';

/**
 * A dialog only a grown-up gets through: a sum past the times tables a young child knows, answered on a number
 * pad. Once it is answered the dialog holds whatever `inside` builds. While the dialog carries the class `busy`
 * a tap outside does not close it.
 */
export function grownUpGate(inside: (dialog: HTMLElement) => HTMLElement): HTMLElement {
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
    else if (Number(typed) === sum.answer) return dialog.replaceChildren(inside(dialog));
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
  return dialog;
}
