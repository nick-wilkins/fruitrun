import { WebGLRenderer } from 'three';
import { setMuted, startMusic, unlockAudio } from './audio';
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
// friends as often as the visitor likes. Nothing is kept: no save, no stars, and the best time lasts only as
// long as the page is open. Everything runs in the browser: once the page, its pictures and its tune have been
// fetched, racing again asks the server for nothing.

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
        el('p', {}, 'Race Berry, Mango and Plum to the line. There is a new track every day, and you can race it as many times as you like.'),
        mine === null ? null : el('p.daily-best', {}, `Your best today: ${formatTime(mine)}`),
        // The level is asked for again at the press: the card may have been sitting there since yesterday.
        el('button.btn.green.big', { onclick: () => race(dailyLevel(new Date())) }, mine === null ? '▶ Go!' : '▶ Race again'),
        note ? el('p.daily-wait', {}, note) : null,
        el('p.daily-more', {}, 'This is one of 68 tracks. The whole game is coming soon to iPhone and iPad. ', el('a', { href: '/' }, 'See what is in it')),
      ),
    ),
  );
}

function race(level: Level): void {
  if (!renderer) return home();
  if (renderer.getContext().isContextLost()) {
    // The browser can take the 3D drawing surface away. It usually hands it back within moments; if it is still
    // gone a good while after the first press, load the page afresh, once, for a new one.
    waitingSince ||= performance.now();
    if (performance.now() - waitingSince > SURFACE_WAIT && !sessionStorage.getItem(RELOADED)) {
      sessionStorage.setItem(RELOADED, '1');
      location.reload();
      return;
    }
    surface?.restoreContext();
    return home('One moment, getting the track ready…');
  }
  waitingSince = 0;
  sessionStorage.removeItem(RELOADED);
  endRun();
  const rivals = rivalsFor(SPEED);
  let time = 0;
  const hud = createHud(
    level,
    {
      pause: (paused) => run?.setPaused(paused),
      restart: () => race(level),
      quit: home,
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
  // One tune, fetched when the first race starts and not before: a visitor who only looks costs the server no music,
  // and one who races all day fetches it once.
  startMusic([asset('assets/audio/track1.mp3')]);
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
        if (quickest) best = { level: level.id, time };
        hud.raced(
          time,
          order,
          el('p.raced-wait.daily-note', {}, quickest ? 'Your best today!' : `Your best today: ${formatTime(best?.time ?? time)}`),
          el('button.btn.orange', { onclick: () => race(level) }, '↻ Race again'),
          el('button.btn.green', { onclick: () => home() }, 'Done ▶'),
        );
      },
    },
    { rivals, drivers: rivalDrivers(level, SPEED) },
  );
  run.start();
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
