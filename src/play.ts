import { WebGLRenderer } from 'three';
import { setMuted, startMusic, stopMusic, unlockAudio } from './audio';
import { dailyLevel } from './core/daily';
import { rivalsFor, type Difficulty } from './core/race';
import { ingredient } from './data/ingredients';
import type { Level } from './data/levels';
import { courseFor } from './game/courses';
import { rivalDrivers } from './game/rivals';
import { Run } from './game/run';
import { asset, el, formatTime } from './ui/dom';
import { createHud } from './ui/hud';
import './style.css';
import './play.css';

// The website's race of the day: one level of the first world, a new one each day, raced against Pip's three
// friends, three goes a day. Nothing of the race is kept: no save, no stars, and the best time lasts only as long
// as the page is open. Everything runs in the browser: once the page, its pictures and its tune have been fetched,
// a race asks the server for one thing, a go.

// The server keeps the count of goes, by address (`goes.mjs`).

/** How quick the three friends are. */
const SPEED: Difficulty = 'medium';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ui = document.querySelector<HTMLDivElement>('#ui')!;
/** Null where the browser cannot draw in 3D at all. */
const renderer = (() => {
  try {
    return new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
})();
// Held from the start: it cannot be fetched once the surface has gone, which is the only time it is needed.
const surface = renderer?.getContext().getExtension('WEBGL_lose_context');
/** When Go was first pressed while the 3D drawing surface was gone, or 0 if it is not being waited for. */
let waitingSince = 0;
/** How long to wait for the surface to come back before loading the page afresh, once, to get a new one. */
const SURFACE_WAIT = 5000;
const RELOADED = 'fruitrun.reloadedForSurface';

let run: Run | null = null;
let muted = false;
/** The quickest finish since the page was opened, and the level it was set on. */
let best: { level: string; time: number } | null = null;

/** Goes left today, as last heard from the server. Null until it has answered, or if it cannot be reached. */
let left: number | null = null;
/** The date `left` was heard for. */
let leftOn = '';
/** How many times the server has been asked, so that answers can be told apart. */
let asked = 0;

/** The visitor's own date, which is what a day is here. */
function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Ask the server how many goes are left, or with `take` use one. Answers false only when the server says there are
 * none: if it cannot be reached the race goes ahead, so a fault there never shuts the game.
 */
async function goes(take: boolean): Promise<boolean> {
  const day = today();
  const mine = ++asked;
  try {
    // A server that does not answer within a few seconds counts as one that cannot be reached.
    const answer = await fetch(`${import.meta.env.BASE_URL}go?day=${day}`, { method: take ? 'POST' : 'GET', cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (answer.status !== 200 && answer.status !== 429) return true;
    const body = (await answer.json()) as { left?: unknown };
    if (typeof body.left !== 'number') return true;
    // An answer overtaken by a later question is out of date: the later one's count stands.
    if (mine === asked) {
      left = body.left;
      leftOn = day;
    }
    return answer.status === 200;
  } catch {
    return true;
  }
}

const TUNE = () => startMusic([asset('assets/audio/track1.mp3')]);
/** A go is being asked for: further presses wait for the answer. */
let asking = false;

/** Goes left today if the server has said, or null. */
const leftToday = () => (leftOn === today() ? left : null);
/** Races started since the page was opened. */
let started = 0;

/** No go is left. A race under way is left to finish: it was the last, and asking to start again must not end it. */
function refused(): void {
  if (run && !run.sim.finished) return;
  stopMusic();
  home();
}

/** Use a go and race, or show that today's are gone. */
async function go(): Promise<void> {
  if (asking) return;
  if (leftToday() === 0) return refused();
  // A go is only used once the track can be drawn.
  if (!ready()) return;
  // Started at the press itself, where browsers allow sound to begin, not after the server's answer.
  TUNE();
  asking = true;
  const from = run;
  const ok = await goes(true);
  asking = false;
  if (!ok) return refused();
  // The visitor has gone elsewhere while the server was answering: nothing starts over the top of where they are.
  // The card being drawn again in the meantime is not going elsewhere.
  if (run !== from) return;
  started += 1;
  race(dailyLevel(new Date()));
}

/** Whether the track can be drawn now. If not, says so on the card and sets about getting the surface back. */
function ready(): boolean {
  if (!renderer) {
    home();
    return false;
  }
  if (!renderer.getContext().isContextLost()) {
    waitingSince = 0;
    sessionStorage.removeItem(RELOADED);
    return true;
  }
  // The browser can take the 3D drawing surface away. It usually hands it back within moments; if it is still
  // gone a good while after the first press, load the page afresh, once, for a new one.
  waitingSince ||= performance.now();
  if (performance.now() - waitingSince > SURFACE_WAIT && !sessionStorage.getItem(RELOADED)) {
    sessionStorage.setItem(RELOADED, '1');
    location.reload();
    return false;
  }
  surface?.restoreContext();
  home('One moment, getting the track ready…');
  return false;
}

function endRun(): void {
  run?.dispose();
  run = null;
  canvas.classList.add('hidden');
}

/** The card the visitor starts from, and comes back to. `note` is a word about why nothing has started. */
function home(note = ''): void {
  endRun();
  // Asked afresh each time, so a page left open overnight moves on to the new day's level.
  const level = dailyLevel(new Date());
  const fruit = ingredient(level.fruit);
  const mine = best?.level === level.id ? best.time : null;
  const known = leftToday();
  const none = known === 0;
  if (!renderer) {
    ui.replaceChildren(
      el('div.daily', {}, el('div.card.daily-card', {}, el('h1', {}, 'Oh no!'), el('p', {}, 'This browser cannot draw the track, so the race cannot run here. Try another browser or another device.'), el('a.btn.purple', { href: '/' }, '← Smoothie Scramble'))),
    );
    return;
  }
  ui.replaceChildren(
    el(
      'div.daily',
      {},
      el('a.btn.purple.small.daily-back', { href: '/' }, '← Smoothie Scramble'),
      el(
        'div.card.daily-card',
        {},
        el('div.daily-top', {}, el('img', { src: asset(fruit.img), alt: fruit.name, draggable: false }), el('div', {}, el('div.kicker', {}, "Today's race"), el('h1', {}, level.name))),
        el('p', {}, 'Race Berry, Mango and Plum to the line. There is a new track every day, and you get three goes at it.'),
        mine === null ? null : el('p.daily-best', {}, `Your best today: ${formatTime(mine)}`),
        none
          ? // An address can be shared, so someone who has not raced here may find its goes already used.
            el('p.daily-none', {}, started ? 'That is your three goes for today. Come back tomorrow for a new track!' : 'Today\'s three goes from this internet connection have been used. Come back tomorrow for a new track!')
          : // The level is asked for again at the press: the card may have been sitting there since yesterday.
            el('button.btn.green.big', { onclick: () => void go() }, mine === null ? '▶ Go!' : '▶ Race again'),
        none || known === null ? null : el('p.daily-left', {}, known === 1 ? 'Last go today!' : `${known} goes left today`),
        note ? el('p.daily-wait', {}, note) : null,
        el('p.daily-more', {}, 'This is one of 68 tracks. The whole game is coming soon to iPhone and iPad. ', el('a', { href: '/' }, 'See what is in it')),
      ),
    ),
  );
}

function race(level: Level): void {
  if (!renderer || !ready()) return;
  endRun();
  const rivals = rivalsFor(SPEED);
  let time = 0;
  const hud = createHud(
    level,
    {
      pause: (paused) => run?.setPaused(paused),
      // Starting again is another go.
      restart: () => void go(),
      quit: () => home(),
      quitLabel: '← Leave the race',
      blend: () => {},
      muted: () => muted,
      toggleSound: () => {
        muted = !muted;
        setMuted(muted);
        return muted;
      },
    },
    rivals,
    undefined,
    // Nothing is opened by a run here, so there is no goal to show.
    true,
  );
  ui.replaceChildren(hud.root);
  canvas.classList.remove('hidden');
  // One tune, fetched when the first race starts and not before: a visitor who only looks costs the server no music.
  TUNE();
  run = new Run(
    renderer,
    courseFor(level),
    level,
    {
      hud: (state) => hud.update(state),
      pickup: (id) => hud.pickup(id),
      finish: (finished) => {
        time = finished;
        hud.finished();
      },
      results: (order) => {
        if (!order) return;
        const quickest = best?.level !== level.id || time <= best.time;
        const known = leftToday();
        if (quickest) best = { level: level.id, time };
        hud.raced(
          time,
          order,
          ...[
          el(
            'p.raced-wait.daily-note',
            {},
            (quickest ? 'Your best today! ' : `Your best today: ${formatTime(best?.time ?? time)}. `) + (known === null ? '' : known === 0 ? 'That was your last go today.' : known === 1 ? 'One go left.' : `${known} goes left.`),
          ),
          known === 0 ? null : el('button.btn.orange', { onclick: () => void go() }, '↻ Race again'),
          shareButton(level, order.findIndex((finisher) => finisher.you) + 1, time),
          el('button.btn.green', { onclick: () => home() }, 'Done ▶'),
          ].filter((node) => node !== null),
        );
      },
    },
    { rivals, drivers: rivalDrivers(level, SPEED) },
  );
  run.start();
}

const PLACES = ['', '🏆 I won', '🥈 I came 2nd in', '🥉 I came 3rd in', '🏁 I came 4th in'];

/** Hands the time to the device's own share sheet, or copies it where there is none. */
function shareButton(level: Level, place: number, time: number): HTMLButtonElement {
  const url = 'https://smoothiescramble.com/play/';
  const text = `${PLACES[place] ?? '🏁 I raced'} today's Smoothie Scramble race on ${level.name} in ${formatTime(time)}! Can you beat my time? 🍓🥭🫐`;
  const button = el('button.btn.blue', {}, '📤 Share');
  button.onclick = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
      } catch {
        // Closing the share sheet without sharing lands here, and needs nothing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      button.textContent = '✓ Copied!';
      if (!button.parentElement?.querySelector('.share-note')) {
        button.parentElement?.append(el('p.raced-wait.daily-note.share-note', {}, 'Copied! Paste it to your friends and see if they can beat your time.'));
      }
    } catch {
      button.textContent = 'Could not copy';
    }
    setTimeout(() => (button.textContent = '📤 Share'), 2000);
  };
  return button;
}

// A run in progress cannot be drawn without the surface, so it ends.
canvas.addEventListener('webglcontextlost', () => {
  if (run && !run.sim.finished) home();
});
canvas.addEventListener('webglcontextrestored', () => {
  waitingSince = 0;
  if (!run) home();
});

setMuted(muted);
// Browsers hold sound back until the player does something, and differ on which event counts.
for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(type, unlockAudio, { passive: true });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
/** A phone held upright shows the turn-sideways card over everything, so a race waits behind it. */
const upright = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
const hold = () => {
  if (document.hidden || upright.matches) run?.setPaused(true);
  else if (!document.querySelector('.hud .modal:not(.hidden):not(.clear)')) run?.setPaused(false);
  // A card left showing overnight moves on to the new day's level when the page is looked at again.
  if (!document.hidden && !run) home();
};
document.addEventListener('visibilitychange', hold);
upright.addEventListener('change', hold);
// The painted village from the website, soft behind the card.
document.body.style.setProperty('--backdrop', 'url(/assets/hero.webp)');

home();
// The card is up at once; the count of goes joins it when the server answers.
void goes(false).then(() => {
  if (!run) home();
});
