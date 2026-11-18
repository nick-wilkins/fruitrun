import { WebGLRenderer } from 'three';
import { musicFor, setMuted, startMusic, unlockAudio } from './audio';
import { asset } from './ui/dom';
import { backUpSaves, clearSave, completeLevel, isUnlocked, loadSave, newSave, restoreSave, storeSave, type RunResult, type Save } from './core/progress';
import { LEVELS, levelById, type Level } from './data/levels';
import { courseFor, warmCourses } from './game/courses';
import { Run } from './game/run';
import { timeCourse, type Autopilot } from './game/sim';
import { onResume, saveBackup } from './platform';
import type { App, Screen } from './ui/app';
import { MAX_JUG, SUPER_JUG } from './core/smoothie';
import { blenderScreen } from './ui/blender';
import { bookScreen } from './ui/book';
import { el } from './ui/dom';
import { createHud } from './ui/hud';
import { mapScreen } from './ui/map';
import { menuScreen } from './ui/menu';
import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ui = document.querySelector<HTMLDivElement>('#ui')!;
const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });

let run: Run | null = null;
/** When the device last took the 3D drawing surface away. */
let surfaceLostAt = 0;
/** How long to wait for the surface to come back before starting the game afresh to get a new one. */
const SURFACE_WAIT = 5000;
// Fetched now so the renderer still holds it later: it cannot be fetched once the surface has gone.
renderer.extensions.get('WEBGL_lose_context');
// The device can take the surface away when it is short of memory. A run in progress cannot be drawn, so it ends;
// one that has crossed the line stays, so its result can still be blended.
canvas.addEventListener('webglcontextlost', () => {
  surfaceLostAt = performance.now();
  if (run && !run.sim.finished) app.show('map');
});
let toastTimer = 0;
const toastEl = el('div.toast.hidden');
document.body.append(toastEl);

// Bring back the save from the backup if the game's own copy is gone or older. Nothing is copied to the backup
// until that has been answered, so a game started in the meantime can never replace a save still on its way.
const restoring = restoreSave(localStorage, saveBackup).catch(() => false);
const answered = await Promise.race([restoring.then(() => true), new Promise<boolean>((done) => setTimeout(() => done(false), 3000))]);
if (answered) {
  backUpSaves(saveBackup);
} else {
  // Too slow to hold the menu up for. If a save does turn up, start again with it.
  void restoring.then((restored) => (restored ? location.reload() : backUpSaves(saveBackup)));
}
const stored = loadSave();

function endRun(): void {
  run?.dispose();
  run = null;
  canvas.classList.add('hidden');
}

const app: App = {
  save: stored ?? newSave(),
  hasSave: stored !== null,
  world: stored?.last ? levelById(stored.last).world : 0,
  persist() {
    app.hasSave = true;
    storeSave(app.save);
  },
  show(screen: Screen) {
    endRun();
    musicFor(null);
    const build = {
      menu: menuScreen,
      map: mapScreen,
      blender: (a: App) => blenderScreen(a, MAX_JUG),
      superblender: (a: App) => blenderScreen(a, SUPER_JUG),
      book: bookScreen,
    }[screen];
    ui.replaceChildren(build(app));
  },
  play(level: Level) {
    if (renderer.getContext().isContextLost()) {
      // The device usually hands the surface back within moments. If it has been gone a good while, start the
      // game afresh for a new one: everything blended is saved, and a retry gives up its run in any case.
      if (performance.now() - surfaceLostAt > SURFACE_WAIT) {
        location.reload();
        return;
      }
      renderer.forceContextRestore();
      app.toast('One moment, getting the track ready…');
      return;
    }
    endRun();
    app.world = level.world;
    const hud = createHud(level, {
      pause: (paused) => run?.setPaused(paused),
      restart: () => app.play(level),
      quit: () => app.show('map'),
      blend: () => {
        if (draft) {
          app.save = draft;
          app.persist();
        }
        app.show('blender');
      },
      muted: () => app.save.muted,
      toggleSound: () => {
        app.save.muted = !app.save.muted;
        setMuted(app.save.muted);
        app.persist();
        return app.save.muted;
      },
    });
    ui.replaceChildren(hud.root);
    canvas.classList.remove('hidden');
    let result: RunResult | null = null;
    let draft: Save | null = null;
    // Night levels get their own dreamy tune.
    musicFor(level.mood === 'night' || level.mood === 'midnight' ? asset('assets/audio/track4.m4a') : null);
    run = new Run(renderer, courseFor(level), level, {
      hud: (state) => hud.update(state),
      pickup: (id) => hud.pickup(id),
      finish: (time, bonuses, feats) => {
        // Work the result out on a copy of the save. Nothing is kept unless the player chooses to blend:
        // retrying throws the whole run away, fruit, stars and all.
        draft = structuredClone(app.save);
        result = completeLevel(draft, level, time, bonuses, feats);
        hud.finished();
      },
      results: () => result && hud.results(result),
    });
    run.start();
  },
  startAgain() {
    clearSave();
    app.save = { ...newSave(), muted: app.save.muted };
    app.world = 0;
    app.persist();
    app.show('map');
  },
  toast(text: string) {
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.add('hidden'), 2200);
  },
};

setMuted(app.save.muted);
// Browsers hold sound back until the player does something, and differ on which event counts.
for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(type, unlockAudio, { passive: true });
startMusic(['track1.mp3', 'track3.m4a', 'track7.m4a', 'track2.mp3', 'track5.m4a', 'track8.m4a', 'track6.m4a'].map((file) => asset(`assets/audio/${file}`)));
// A phone call or a trip to another app can leave the sound switched off when the game comes back.
onResume(unlockAudio);
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) run?.setPaused(true);
  else if (!document.querySelector('.hud .modal:not(.hidden):not(.clear)')) run?.setPaused(false);
});

app.show('menu');

// Lay out courses in the background, starting with the ones the player can reach.
warmCourses([...LEVELS].sort((a, b) => Number(isUnlocked(app.save, b)) - Number(isUnlocked(app.save, a))));

if (import.meta.env.DEV) {
  // Console helpers for tuning and testing.
  Object.assign(window, {
    __fr: {
      app,
      get run() {
        return run;
      },
      /** Hands-free finish time for a level: 'smart' takes a good line, 'none' never steers. */
      sim(mode: Autopilot, levelId = 'level-1') {
        const level = levelById(levelId);
        return Number(timeCourse(courseFor(level), level, mode).toFixed(2));
      },
      /** Jump straight into a level, skipping the map and unlocks. */
      play(n: number) {
        app.play(levelById(`level-${n}`));
      },
    },
  });
}
