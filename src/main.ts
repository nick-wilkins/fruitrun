import { WebGLRenderer } from 'three';
import { setMuted, startMusic, unlockAudio } from './audio';
import { asset } from './ui/dom';
import { clearSave, completeLevel, loadSave, newSave, storeSave, type RunResult } from './core/progress';
import { levelById, type Level } from './data/levels';
import { courseFor } from './game/courses';
import { Run } from './game/run';
import { timeCourse, type Autopilot } from './game/sim';
import type { App, Screen } from './ui/app';
import { blenderScreen } from './ui/blender';
import { el } from './ui/dom';
import { createHud } from './ui/hud';
import { mapScreen } from './ui/map';
import { menuScreen } from './ui/menu';
import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ui = document.querySelector<HTMLDivElement>('#ui')!;
const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });

let run: Run | null = null;
let toastTimer = 0;
const toastEl = el('div.toast.hidden');
document.body.append(toastEl);

const stored = loadSave();

function endRun(): void {
  run?.dispose();
  run = null;
  canvas.classList.add('hidden');
}

const app: App = {
  save: stored ?? newSave(),
  hasSave: stored !== null,
  persist() {
    app.hasSave = true;
    storeSave(app.save);
  },
  show(screen: Screen) {
    endRun();
    const build = { menu: menuScreen, map: mapScreen, blender: blenderScreen }[screen];
    ui.replaceChildren(build(app));
  },
  play(level: Level) {
    endRun();
    const hud = createHud(level, {
      pause: (paused) => run?.setPaused(paused),
      restart: () => app.play(level),
      quit: () => app.show('map'),
      blend: () => app.show('blender'),
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
    run = new Run(renderer, courseFor(level), level, {
      hud: (state) => hud.update(state),
      pickup: (id) => hud.pickup(id),
      finish: (time, bonuses) => {
        result = completeLevel(app.save, level, time, bonuses);
        app.persist();
        hud.finished();
      },
      results: () => result && hud.results(result),
    });
    run.start();
  },
  startAgain() {
    clearSave();
    app.save = { ...newSave(), muted: app.save.muted };
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
startMusic([asset('assets/audio/track1.mp3'), asset('assets/audio/track2.mp3')]);
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) run?.setPaused(true);
  else if (!document.querySelector('.hud .modal:not(.hidden):not(.clear)')) run?.setPaused(false);
});

app.show('menu');

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
