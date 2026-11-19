import { sfx } from '../audio';
import { PARTY_SIZE } from '../core/nearby';
import { isUnlocked } from '../core/progress';
import { RIVALS, YOUR_COLOR } from '../core/race';
import { LEVELS } from '../data/levels';
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
      el('p', {}, ready ? 'Pick a level and press Start!' : party.players.length > 1 ? 'Waiting for everyone to finish…' : 'Waiting for friends to join…'),
      el('div.row.party-pick', {}, button('◀', 'blue', () => turn(-1)), name, button('▶', 'blue', () => turn(1))),
      el('div.row', {}, leave('Close game'), ready ? button('Start ▶', 'green.big', () => party.start(open[at].id)) : null),
    );
  } else if (party.phase === 'browsing') {
    card(
      el('h2', {}, 'Join a game'),
      party.hosts.length ? el('div.column', {}, ...party.hosts.map((host) => button(`${host.name}'s game`, 'green', () => party.join(host.id)))) : el('p', {}, 'Looking for games nearby…'),
      el('div.row', {}, leave('Back')),
    );
  } else if (party.phase === 'joining') {
    card(el('h2', {}, 'Joining…'), el('div.row', {}, leave('Back')));
  } else if (party.phase === 'joined') {
    card(el('h2', {}, `${party.players[0]?.name ?? 'A friend'}'s game`), players(), el('p', {}, 'Waiting for the start…'), el('div.row', {}, leave('Leave')));
  } else {
    party.name = app.player?.name ?? 'Player';
    card(
      el('h2', {}, '👫 Play together'),
      party.why ? el('p.unlock-wait', {}, WHY[party.why]) : el('p', {}, 'Race friends who are close by, each on their own iPad or iPhone. Wi-Fi needs to be switched on. The first time, tap Allow when asked about devices nearby.'),
      el('div.row', {}, button('Back', 'purple', () => app.show('map')), button('Join a game', 'blue', () => party.browse()), button('Start a game', 'green.big', () => party.host())),
    );
  }
  return stage;
}
