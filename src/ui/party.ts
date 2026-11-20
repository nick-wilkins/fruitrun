import { sfx } from '../audio';
import { PARTY_SIZE } from '../core/nearby';
import { isUnlocked } from '../core/progress';
import { RIVALS, YOUR_COLOR } from '../core/race';
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

/** The level the host last picked, kept while the game stays open. */
let picked: string | null = null;

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
  const players = () => {
    let friend = 0;
    return el('div.race-order', {}, ...party.players.map((player) => el(`div.race-row${player.id === party.me ? '.you' : ''}`, {}, el('i', { style: `background:${player.id === party.me ? YOUR_COLOR : RIVALS[friend++ % RIVALS.length].color}` }), el('span', {}, player.id === party.me ? `${player.name} (you)` : player.name))));
  };

  if (party.phase === 'hosting') {
    const open = LEVELS.filter((level) => isUnlocked(app.save, level));
    let at = Math.max(0, open.findIndex((level) => level.id === (picked ?? app.save.last)));
    const name = el('b.party-level');
    const turn = (step: number) => {
      at = (at + step + open.length) % open.length;
      picked = open[at].id;
      name.textContent = `${open[at].n}. ${open[at].name}`;
    };
    turn(0);
    const ready = party.canStart();
    card(
      el('h2', {}, 'Your game'),
      players(),
      el('p', {}, ready ? 'Pick a level and press Start!' : party.players.length > 1 ? 'Waiting for everyone to finish…' : 'Waiting for friends. They tap Together, then Join a game.'),
      el('div.row.party-pick', {}, button('◀', 'blue', () => turn(-1)), name, button('▶', 'blue', () => turn(1))),
      el('div.row', {}, leave('Close game'), ready ? button('Start ▶', 'green.big', () => party.start(open[at].id)) : null),
    );
  } else if (party.phase === 'browsing') {
    card(
      el('h2', {}, 'Join a game'),
      party.hosts.length ? el('div.column', {}, ...party.hosts.map((host) => button(`${host.name}'s game`, 'green', () => party.join(host.id)))) : el('p', {}, 'Looking for games nearby… Ask a friend to tap Together, then Start a game.'),
      el('div.row', {}, leave('Back')),
    );
  } else if (party.phase === 'joining') {
    card(el('h2', {}, 'Joining…'), el('div.row', {}, leave('Back')));
  } else if (party.phase === 'joined') {
    card(el('h2', {}, `${party.players[0]?.name ?? 'A friend'}'s game`), players(), el('p', {}, `Waiting for ${party.players[0]?.name ?? 'your friend'} to start a race…`), el('div.row', {}, leave('Leave')));
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
