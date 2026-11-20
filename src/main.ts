import { WebGLRenderer } from 'three';
import { musicFor, setMuted, startMusic, unlockAudio } from './audio';
import { asset } from './ui/dom';
import { CUP_RACES, cupById, scoreCupRace, startCup, type Cup } from './core/cups';
import { addPlayer, playing, readRoster, removePlayer, storeRoster, type Roster } from './core/players';
import { completeLevel, isUnlocked, keepSavesIn, newSave, type RunResult, type Save } from './core/progress';
import { catchUp, Party } from './core/nearby';
import { racesUnlocked, rivalsFor, SEATS, type Difficulty, type Finisher } from './core/race';
import { CLOSED, settle, shopNow, stock } from './core/shop';
import { LEVELS, levelById, type Level } from './data/levels';
import { courseFor, warmCourses } from './game/courses';
import { rivalDrivers } from './game/rivals';
import { Run } from './game/run';
import { timeCourse, type Autopilot } from './game/sim';
import { readGhost } from './game/ghost';
import { askedStore, ghostStore, nearby, oldSave, onResume, saveStore, store } from './platform';
import type { App, Screen } from './ui/app';
import { MAX_JUG, SUPER_JUG } from './core/smoothie';
import { blenderScreen } from './ui/blender';
import { bookScreen } from './ui/book';
import { cupsScreen, cupTableScreen } from './ui/cups';
import { el } from './ui/dom';
import { createHud } from './ui/hud';
import { mapScreen } from './ui/map';
import { menuScreen } from './ui/menu';
import { partyScreen } from './ui/party';
import { unlockScreen } from './ui/unlock';
import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ui = document.querySelector<HTMLDivElement>('#ui')!;
const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });

let run: Run | null = null;
// Held from the start: it cannot be fetched once the surface has gone, which is the only time it is needed.
const surface = renderer.getContext().getExtension('WEBGL_lose_context');
/** When the player first asked for a level while the 3D drawing surface was gone, or 0 if it is not being waited for. */
let waitingSince = 0;
/** How long to wait for the surface to come back before starting the game afresh to get a new one. */
const SURFACE_WAIT = 5000;
/** Kept across a reload, so a device that cannot supply a surface at all is not reloaded over and over. */
const RELOADED = 'fruitrun.reloadedForSurface';
// The device can take the surface away when it is short of memory. A run in progress cannot be drawn, so it ends;
// one that has crossed the line stays, so its result can still be blended.
canvas.addEventListener('webglcontextlost', () => {
  if (run && !run.sim.finished) app.show('map');
});
canvas.addEventListener('webglcontextrestored', () => (waitingSince = 0));
let toastTimer = 0;
const toastEl = el('div.toast.hidden');
document.body.append(toastEl);

keepSavesIn(saveStore);
let roster: Roster = readRoster(null, null);
try {
  roster = readRoster(await saveStore.get(), await oldSave());
} catch {
  // The store cannot be read: start with nobody.
}
stock(CLOSED);
let showing: Screen = 'menu';
/** An approval asked of a grown-up stays open for a day. After that the wait is no longer shown. */
const ASK_LASTS = 24 * 60 * 60 * 1000;
/** Sound on or off before anyone has started: nothing else of it is ever used. */
const nobody = newSave();
const worldOf = (save: Save) => (save.last ? levelById(save.last).world : 0);

/** The run on now is a race with friends. */
let racingTogether = false;

function endRun(): void {
  // Leaving a race with friends before the line takes this marble off their roads.
  if (run && racingTogether && !run.sim.finished) party.out();
  racingTogether = false;
  run?.dispose();
  run = null;
  canvas.classList.add('hidden');
}

/** The screens behind the unlock: cups are races, and so is a game with friends. */
const PAID: Screen[] = ['cups', 'cuptable', 'party'];

/** Anything with other marbles in it needs the unlock. Without it, shows where it is offered and answers true. */
function shut(): boolean {
  if (racesUnlocked()) return false;
  app.show('unlock');
  return true;
}

const party = new Party(nearby, 'Player', () => performance.now() / 1000);

const app: App = {
  party,
  get save() {
    return playing(roster)?.save ?? nobody;
  },
  set save(to: Save) {
    const player = playing(roster);
    if (player) player.save = to;
  },
  get hasSave() {
    return roster.players.length > 0;
  },
  roster,
  get player() {
    return playing(roster);
  },
  world: worldOf(playing(roster)?.save ?? nobody),
  persist() {
    storeRoster(roster);
  },
  choose(id: string) {
    if (!roster.players.some((p) => p.id === id)) return;
    roster.current = id;
    app.world = worldOf(app.save);
    setMuted(app.save.muted);
    app.persist();
  },
  join(name: string) {
    const player = addPlayer(roster, name, app.save.muted);
    if (!player) return false;
    ghostStore.clear(player.id, LEVELS.map((l) => l.id));
    app.world = 0;
    app.persist();
    app.show('map');
    return true;
  },
  leave(id: string) {
    removePlayer(roster, id);
    ghostStore.clear(id, LEVELS.map((l) => l.id));
    setMuted(app.save.muted);
    app.world = worldOf(app.save);
    app.persist();
  },
  show(screen: Screen) {
    if (PAID.includes(screen) && !racesUnlocked()) screen = 'unlock';
    showing = screen;
    endRun();
    musicFor(null);
    const build = {
      menu: menuScreen,
      map: mapScreen,
      blender: (a: App) => blenderScreen(a, MAX_JUG),
      superblender: (a: App) => blenderScreen(a, SUPER_JUG),
      book: bookScreen,
      cups: cupsScreen,
      cuptable: cupTableScreen,
      unlock: unlockScreen,
      party: partyScreen,
    }[screen];
    ui.replaceChildren(build(app));
  },
  cupResult: null,
  startCup(cup: Cup, difficulty: Difficulty) {
    if (shut()) return;
    startCup(app.save, cup, difficulty);
    app.persist();
    app.playCup();
  },
  playCup() {
    const entered = app.save.cup;
    const cup = entered && cupById(entered.id);
    if (!entered || !cup) return app.show('cups');
    app.play(levelById(cup.levels[entered.race]), entered.difficulty, `${cup.name}, race ${entered.race + 1} of ${CUP_RACES}`);
  },
  play(level: Level, race?: Difficulty, cup?: string, together = false) {
    if ((race || together) && shut()) return;
    if (renderer.getContext().isContextLost()) {
      // The device usually hands the surface back by itself within moments; the ask below only helps where the
      // loss was not the device's own doing. If it is still gone a good while after the first tap, start the
      // game afresh, once, for a new one: everything blended is saved, and a retry gives up its run in any case.
      waitingSince ||= performance.now();
      if (performance.now() - waitingSince > SURFACE_WAIT && !sessionStorage.getItem(RELOADED)) {
        sessionStorage.setItem(RELOADED, '1');
        location.reload();
        return;
      }
      surface?.restoreContext();
      app.toast('One moment, getting the track ready…');
      return;
    }
    waitingSince = 0;
    sessionStorage.removeItem(RELOADED);
    endRun();
    // A race with friends moves nothing of the player's own, their place on the map included.
    if (!together) app.world = level.world;
    // Everyone has the colour of their seat, the same on every device.
    const friends = together ? party.friends().flatMap((member) => {
      const marble = party.marbles.get(member.id);
      return marble ? [{ rival: { ...SEATS[party.players.indexOf(member)], name: member.name }, marble }] : [];
    }) : [];
    const partyCup = together && party.cup ? cupById(party.cup.id) : undefined;
    if (together && partyCup && party.cup) cup = `${partyCup.name}, race ${party.cup.race + 1} of ${party.cup.of}`;
    const hud = createHud(
      level,
      {
        pause: (paused) => run?.setPaused(paused),
        // Starting again keeps the kind of run it was: a race stays a race, as hard as before. With friends
        // there is no starting again.
        restart: () => app.play(level, race, cup),
        quit: () => app.show(together ? 'party' : cup ? 'cups' : 'map'),
        blend: () => {
          if (draft) {
            app.save = draft;
            app.persist();
            // A new best time is the run to chase from now on.
            if (trace && app.player) ghostStore.set(app.player.id, level.id, trace);
          }
          app.show('blender');
        },
        next: () => {
          if (!draft || !order) return;
          app.save = draft;
          app.cupResult = scoreCupRace(app.save, order);
          app.persist();
          if (trace && app.player) ghostStore.set(app.player.id, level.id, trace);
          app.show('cuptable');
        },
        muted: () => app.save.muted,
        toggleSound: () => {
          app.save.muted = !app.save.muted;
          setMuted(app.save.muted);
          app.persist();
          return app.save.muted;
        },
      },
      together ? friends.map((friend) => friend.rival) : race ? rivalsFor(race) : [],
      cup,
      // With friends nothing is kept, so there is no goal to show.
      together || (app.save.levels[level.id]?.stars ?? 0) >= level.need || !LEVELS.some((l) => l.after.includes(level.n)),
      together ? { note: `You are the ${SEATS[party.slot()].called} marble!`, color: SEATS[party.slot()].color } : undefined,
    );
    ui.replaceChildren(hud.root);
    canvas.classList.remove('hidden');
    let result: RunResult | null = null;
    let draft: Save | null = null;
    let order: Finisher[] | undefined;
    let trace: string | null = null;
    let raced = 0;
    // Marble Roll plays in the dark and on the hardest levels; everywhere else the playlist carries on.
    const dark = level.mood === 'night' || level.mood === 'midnight';
    musicFor(dark || level.difficulty >= 0.85 ? asset('assets/audio/track9.m4a') : null);
    run = new Run(
      renderer,
      courseFor(level),
      level,
      {
        hud: (state) => hud.update(state),
        pickup: (id) => hud.pickup(id),
        finish: (time, bonuses, feats, place) => {
          // A race with friends is for the fun of it: nothing is won, kept or opened by it, on any device.
          if (together) {
            raced = time;
            party.finished(time);
            return hud.finished();
          }
          // Work the result out on a copy of the save. Nothing is kept unless the player chooses to blend:
          // retrying throws the whole run away, fruit, stars, podium place and all.
          draft = structuredClone(app.save);
          result = completeLevel(draft, level, time, bonuses, feats, place ?? undefined, race);
          trace = result.newBest ? (run?.trace() ?? null) : null;
          hud.finished();
        },
        results: (finished) => {
          order = finished ?? undefined;
          if (together && order) hud.raced(raced, order, party.cup ? 'Cup points ▶' : 'Done ▶');
          else if (result) hud.results(result, order);
        },
      },
      race ? { rivals: rivalsFor(race), drivers: rivalDrivers(level, race) } : null,
      together ? { slot: party.slot(), friends } : null,
    );
    run.start();
    racingTogether = together;
    if (together) {
      // Tell the others where this marble is, and keep the finishing order on the results card up to date.
      const mine = run;
      let shown = '';
      let was = NaN;
      let raceClock = 0;
      const telling = window.setInterval(() => {
        if (run !== mine) return window.clearInterval(telling);
        const { sim } = mine;
        // A marble that has not moved since the last report is standing still, whatever speed it was doing: paused, say.
        if (!sim.finished) party.report({ lane: sim.lane, s: sim.s, x: sim.x, h: sim.h, v: sim.s === was ? 0 : sim.pace, p: sim.progress() });
        was = sim.s;
        // Whoever is behind gets a little help, eased in and out over a second or so, so it is never felt as a shove.
        // A friend whose reports have stopped is not counted: where they were says nothing of where they are.
        const clock = performance.now() / 1000;
        const lead = Math.max(0, ...friends.map(({ marble }) => (marble.time !== null ? 1 : marble.gone || marble.quiet(clock) ? 0 : marble.progress)));
        const help = sim.finished ? 0 : catchUp((lead - sim.progress()) * mine.course.finishS, lead, sim.time);
        // By the race's own clock, so it keeps pace however often this runs and stands still while paused.
        sim.help += (help - sim.help) * Math.min(1, Math.max(0, sim.time - raceClock));
        raceClock = sim.time;
        if (!order) return;
        const now = mine.standings();
        const key = JSON.stringify(now);
        if (shown && key !== shown) hud.standings(now);
        shown = key;
      }, 1000 / 15);
    }
    // On a run of your own, your best run here rolls alongside. It is fetched while the countdown plays.
    if (!race && !together && app.player && app.save.ghost !== false) {
      const mine = run;
      void ghostStore
        .get(app.player.id, level.id)
        .then((raw) => {
          const ghost = readGhost(raw);
          if (ghost && run === mine) mine.haunt(ghost);
        })
        .catch(() => {});
    }
  },
  get shop() {
    return shopNow();
  },
  async price() {
    if (!shopNow().price) {
      const price = await store.price().catch(() => null);
      if (price) stock({ ...shopNow(), price });
    }
    return shopNow().price;
  },
  async buy() {
    const outcome = await store.buy().catch(() => 'failed' as const);
    stock(settle(shopNow(), outcome));
    if (outcome === 'pending') askedStore.set(Date.now());
    if (outcome === 'bought') askedStore.clear();
    return outcome;
  },
  async restore() {
    const owned = await store.restore().catch(() => null);
    if (owned) owns(true);
    return owned;
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
// The four produced tunes lead; the synthesised ones only come round once those have all played.
startMusic(['track1.mp3', 'track7.m4a', 'track2.mp3', 'track8.m4a', 'track3.m4a', 'track5.m4a', 'track6.m4a'].map((file) => asset(`assets/audio/${file}`)), 4);
// A phone call or a trip to another app can leave the sound switched off when the game comes back.
onResume(unlockAudio);
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) run?.setPaused(true);
  else if (!document.querySelector('.hud .modal:not(.hidden):not(.clear)')) run?.setPaused(false);
});

party.onChange = () => {
  if (run) {
    if (party.phase === 'closed') app.toast('The game with friends has ended.');
  } else if (showing === 'party') app.show('party');
};
// Only someone in the waiting room, or still looking at the last race's finishing order, is taken into a race:
// anyone who has wandered off elsewhere sits it out. So does a device that cannot draw the track just now.
party.onStart = (id) => {
  const level = LEVELS.find((each) => each.id === id);
  const waiting = run ? racingTogether && run.sim.finished : showing === 'party';
  if (!level || !waiting) return false;
  const before = run;
  app.play(level, undefined, undefined, true);
  return run !== null && run !== before;
};

app.show('menu');
void app.price();
/**
 * Take the store's word on whether the unlock is owned. A run under way is left alone, and so is any screen
 * that looks the same either way.
 */
function owns(owned: boolean): void {
  if (owned === shopNow().owned) return;
  stock({ ...shopNow(), owned, pending: owned ? false : shopNow().pending });
  if (owned) askedStore.clear();
  // A game with friends cannot be kept open from behind the lock.
  else party.leave();
  if (!run && (['map', 'unlock', ...PAID] as Screen[]).includes(showing)) app.show(showing);
}
// A grown-up's yes, a purchase on another device or a refund can arrive at any time.
store.onChange(owns);
// What the account owns is kept on the device, so this needs no internet. The game does not wait for it, and it
// is asked again each time the app comes back, in case the first answer never came.
const ask = () => void store.owned().then(owns, () => {});
ask();
onResume(ask);
void askedStore
  .get()
  .then((at) => {
    if (Date.now() - at < ASK_LASTS && !shopNow().owned) stock({ ...shopNow(), pending: true });
  })
  .catch(() => {});

// Lay out courses in the background, starting with the ones the player can reach.
warmCourses([...LEVELS].sort((a, b) => Number(isUnlocked(app.save, b)) - Number(isUnlocked(app.save, a))), () => !run);

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
      play(n: number, race?: Difficulty) {
        app.play(levelById(`level-${n}`), race);
      },
    },
  });
}
