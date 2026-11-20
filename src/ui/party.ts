import { sfx } from '../audio';
import { CUPS, cupById, cupOpen } from '../core/cups';
import { PARTY_SIZE } from '../core/nearby';
import { isUnlocked } from '../core/progress';
import { SEATS } from '../core/race';
import { LEVELS } from '../data/levels';
import { toldStore } from '../platform';
import type { App } from './app';
import { asset, el } from './dom';
import { setBackdrop } from './screen';

const WHY = {
  denied: 'Smoothie Scramble is not allowed to look for devices nearby. A grown-up can turn it on in Settings, under Privacy & Security, then Local Network.',
  version: 'That device has a different version of the game. Update both and try again.',
  full: `That game is full: ${PARTY_SIZE} players is the most.`,
  racing: 'That game is in the middle of a race. Try again in a moment.',
  ended: 'The game has ended.',
  error: 'Something went wrong finding friends. Check Wi-Fi is switched on and try again.',
};

/** The level and the cup the host last picked, kept while the game stays open. */
let picked: string | null = null;
let pickedCup: string | null = null;

/** Whether this device has been told about the question the system asks the first time. Until that is known, it is told. */
let told = false;
void toldStore
  .get()
  .then((was) => (told ||= was))
  .catch(() => {});

/** Getting a game together with friends nearby: start one or join one, then wait for the off. */
export function partyScreen(app: App): HTMLElement {
  const { party } = app;
  const stage = el('div.stage.book-stage');
  stage.append(el('img.bg', { src: asset('assets/stall.webp'), alt: '', draggable: false }));
  setBackdrop(asset('assets/stall.webp'));
  const button = (label: string, color: string, onclick: () => void) => el(`button.btn.${color}`, { onclick: () => (sfx.tap(), onclick()) }, label);
  const card = (...children: (Node | string | null)[]) => stage.append(el('div.card.unlock-card.party-card', {}, ...children));
  const leave = (label: string) =>
    button(label, 'purple', () => {
      party.leave();
      app.show('map');
    });
  const called = (id: string, name: string) => (id === party.me ? `${name} (you)` : name);
  // Everyone has their seat's colour, here and on the road, the same on every device.
  const players = () => el('div.race-order', {}, ...party.players.map((player, seat) => el(`div.race-row${player.id === party.me ? '.you' : ''}`, {}, el('i', { style: `background:${SEATS[seat].color}` }), el('span', {}, called(player.id, player.name)))));
  const host = party.players[0]?.name ?? 'your friend';
  const cup = party.cup;
  const cupName = (cup && cupById(cup.id)?.name) || 'Cup';
  const cupOver = cup !== null && cup.race >= cup.of;
  /** The cup's points, most first. Level on points, whoever sits nearer the host is ahead. */
  const ranked = () => party.players.map((player, seat) => ({ ...player, seat, points: cup?.points[player.id] ?? 0 })).sort((a, b) => b.points - a.points || a.seat - b.seat);
  const table = () => el('div.race-order.cup-table', {}, ...ranked().map((row, i) => el(`div.race-row${row.id === party.me ? '.you' : ''}`, {}, el('b', {}, ['1st', '2nd', '3rd', '4th'][i]), el('i', { style: `background:${SEATS[row.seat].color}` }), el('span', {}, called(row.id, row.name)), el('em', {}, `${row.points} pts`))));
  const winner = () => {
    const top = ranked()[0];
    return top ? `🏆 ${top.id === party.me ? 'You win' : `${top.name} wins`} the ${cupName}!` : '';
  };

  if (party.phase === 'hosting') {
    if (party.players.length < 2) {
      card(el('h2', {}, 'Your game'), players(), el('p', {}, 'Waiting for other players…'), el('p.unlock-note', {}, 'They tap Together, then Join a game.'), el('div.row', {}, leave('Cancel')));
    } else if (!party.canStart()) {
      card(el('h2', {}, 'Your game'), players(), el('p', {}, 'Waiting for everyone to finish…'), el('div.row', {}, leave('Close game')));
    } else if (cup && cup.race > 0) {
      card(
        el('h2', {}, cupOver ? winner() : `${cupName}: race ${cup.race} of ${cup.of} done`),
        table(),
        el(
          'div.row',
          {},
          leave('Close game'),
          cupOver ? button('Choose again ▶', 'green.big', () => party.dropCup()) : button('Stop the cup', 'orange', () => party.dropCup()),
          cupOver ? null : button('Next race ▶', 'green.big', () => party.nextRace()),
        ),
      );
    } else {
      // Whoever started the game chooses, from what they have opened themselves.
      const picker = <T extends { id: string }>(open: T[], first: string | null, label: (each: T) => string, keep: (id: string) => void, go: string, start: (each: T) => void) => {
        let at = Math.max(0, open.findIndex((each) => each.id === first));
        const name = el('b.party-level');
        const turn = (step: number) => {
          at = (at + step + open.length) % open.length;
          keep(open[at].id);
          name.textContent = label(open[at]);
        };
        turn(0);
        return el('div.row.party-pick', {}, button('◀', 'blue', () => turn(-1)), name, button('▶', 'blue', () => turn(1)), button(go, 'green', () => start(open[at])));
      };
      const levels = LEVELS.filter((level) => isUnlocked(app.save, level));
      const cups = CUPS.filter((each) => cupOpen(app.save, each));
      card(
        el('h2', {}, 'Your game'),
        players(),
        el('p', {}, 'Pick a race or a cup!'),
        picker(levels, picked ?? app.save.last ?? null, (level) => `${level.n}. ${level.name}`, (id) => (picked = id), 'Race ▶', (level) => party.start(level.id)),
        cups.length ? picker(cups, pickedCup, (each) => `🏆 ${each.name}`, (id) => (pickedCup = id), 'Cup ▶', (each) => party.startCup(each.id, each.levels)) : null,
        el('div.row', {}, leave('Close game')),
      );
    }
  } else if (party.phase === 'browsing') {
    card(
      el('h2', {}, 'Join a game'),
      party.hosts.length ? el('div.column', {}, ...party.hosts.map((host) => button(`${host.name}'s game`, 'green', () => party.join(host.id)))) : el('p', {}, 'Looking for games nearby… Ask a friend to tap Together, then Start a game.'),
      el('div.row', {}, leave('Back')),
    );
  } else if (party.phase === 'joining') {
    card(el('h2', {}, 'Joining…'), el('div.row', {}, leave('Back')));
  } else if (party.phase === 'joined') {
    if (cup && cup.race > 0) card(el('h2', {}, cupOver ? winner() : `${cupName}: race ${cup.race} of ${cup.of} done`), table(), el('p', {}, cupOver ? `Waiting for ${host} to choose what is next…` : `Waiting for ${host} to start the next race…`), el('div.row', {}, leave('Leave')));
    else card(el('h2', {}, `${host}'s game`), players(), el('p', {}, `Waiting for ${host} to choose a map…`), el('div.row', {}, leave('Leave')));
  } else if (party.phase === 'closed' && party.why === 'ended') {
    card(el('h2', {}, 'Game over'), el('p', {}, `${party.closedBy || 'Your friend'} closed the game.`), el('div.row', {}, leave('Back to map')));
  } else {
    party.name = app.player?.name ?? 'Player';
    // The system asks its own question the first time a game is started or looked for. Saying what it is for,
    // just before, gets a yes far more often, and a no can only be undone in Settings.
    const go = (then: () => void) => {
      if (told) return then();
      const dialog = el('div.modal');
      const ok = button('OK', 'green.big', () => {
        told = true;
        toldStore.set();
        dialog.remove();
        then();
      });
      dialog.append(el('div.card.small.wordy', {}, el('h2', {}, '📡 One thing first'), el('p', {}, 'To find your friends, the game looks for other iPads and iPhones close by. If you are asked to let it, tap Allow.'), el('p.unlock-note', {}, 'It works without the internet and needs no account. Devices close by can see your player name.'), el('div.row', {}, el('button.btn.purple', { onclick: () => dialog.remove() }, 'Back'), ok)));
      stage.append(dialog);
    };
    const choice = (icon: string, label: string, color: string, then: () => void) => el(`button.btn.${color}.party-choice`, { onclick: () => (sfx.tap(), go(then)) }, el('span', {}, icon), label);
    card(
      el('h2', {}, '👫 Play together'),
      party.why ? el('p.unlock-wait', {}, WHY[party.why]) : el('p', {}, 'Race friends who are close by, each on their own iPad or iPhone.'),
      el('div.row.party-choices', {}, choice('🏠', 'Start a game', 'green', () => party.host()), choice('🔍', 'Join a game', 'blue', () => party.browse())),
      el('p.unlock-note', {}, `Wi-Fi needs to be switched on. Up to ${PARTY_SIZE} can play.`),
      el('div.row', {}, button('Back', 'purple', () => app.show('map'))),
    );
  }
  return stage;
}
