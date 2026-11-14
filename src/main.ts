import { WebGLRenderer } from 'three';
import { setMuted, unlockAudio } from './audio';
import { clearSave, completeLevel, loadSave, newSave, storeSave } from './core/progress';
import { levelById, type Level } from './data/levels';
import { buildAppleOrchard, type Course } from './game/course';
import { Run, type Autopilot } from './game/run';
import type { App, Screen } from './ui/app';
import { blenderScreen } from './ui/blender';
import { el } from './ui/dom';
import { createHud } from './ui/hud';
import { mapScreen } from './ui/map';
import { menuScreen } from './ui/menu';
import './style.css';

const COURSES: Record<string, () => Course> = {
  'level-1': buildAppleOrchard,
};

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
    });
    ui.replaceChildren(hud.root);
    canvas.classList.remove('hidden');
    run = new Run(renderer, COURSES[level.id](), level, {
      hud: (state) => hud.update(state),
      pickup: (id) => hud.pickup(id),
      finish: (time, bonuses) => {
        const result = completeLevel(app.save, level, time, bonuses);
        app.persist();
        hud.results(result);
      },
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
window.addEventListener('pointerdown', unlockAudio, { once: true });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) run?.setPaused(true);
  else if (!document.querySelector('.hud .modal:not(.hidden)')) run?.setPaused(false);
});

app.show('menu');

if (import.meta.env.DEV) {
  // Console helpers for tuning: __fr.sim('smart') plays the current course headlessly and returns the time.
  Object.assign(window, {
    __fr: {
      app,
      get run() {
        return run;
      },
      sim(mode: Autopilot, levelId = 'level-1') {
        const probe = new Run(renderer, COURSES[levelId](), levelById(levelId), { hud: () => {}, pickup: () => {}, finish: () => {} });
        setMuted(true);
        probe.autopilot = mode;
        probe.skipCountdown();
        let steps = 0;
        while (!probe.finished && steps++ < 60 * 400) probe.step(1 / 120);
        const time = probe.time;
        probe.dispose();
        setMuted(app.save.muted);
        return Number(time.toFixed(2));
      },
    },
  });
}
