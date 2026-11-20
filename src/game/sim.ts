import { Vector3 } from 'three';
import type { Feats } from '../core/progress';
import type { Level } from '../data/levels';
import { GRIP, LEVEL_FRUIT, type Course, type CourseObj } from './course';
import { seeded } from './random';
import { makeFrame, type Frame } from './track';

export const BALL_RADIUS = 1;
export const CRUISE = 26;
export const MIN_SPEED = 12;
export const MAX_SPEED = 56;
/** A turbo pad's speed, and how long it holds. */
export const TURBO_SPEED = 86;
const TURBO_TIME = 2.2;
const GRAVITY = 11;
export const COUNTDOWN = 3;
/** Holding back takes this much speed off a second at its hardest, down to a gentle roll and no slower. */
const HOLD_BACK = 45;
const ROLL = 14;
const START_S = 12;
/** How far past the kerb a steering target may reach, so pressing into the wall registers as a scrape. */
export const PUSH = 1.2;
/** The rules always advance in steps this long, so a course plays the same at any frame rate. */
export const TICK = 1 / 120;
/** How fast an escalator carries the ball. */
const LIFT_SPEED = 24;
/** Reach of a windmill sail, and how far round from straight down it still sweeps the road. */
export const SAIL = 6.2;
/** In a race anyone may take a fruit, so it is back this many seconds later for whoever comes next. */
export const FRUIT_BACK = 0.5;
const SAIL_LOW = 0.76;

/** How far before a fork opens a player can already steer for its side road: about a second's rolling. */
const REACH_AHEAD = 40;

export type Autopilot = 'none' | 'smart' | 'ace';

/**
 * A computer rival. It drives the way a person would. It looks, reads the road ahead for a way through, and only
 * then steers, a few times a second. It turns the marble smoothly instead of snapping to its line, and leaves well
 * alone while it is near enough. It wanders, has good spells and off spells, picks a side to pass another marble,
 * makes its mind up early about a fork, and now and then gets something wrong.
 */
export interface Driver {
  /** How much of its speed it uses, 1 being all of it. */
  speed: number;
  /** How much it slows, at most, when well ahead of the marble it is racing. */
  easeOff: number;
  /** Seconds between one look at the road and the next: its reaction time. */
  react: number;
  /** How firmly it steers towards where it wants to be: higher gets there sooner. */
  turn: number;
  /** The fastest it moves the marble across the road: quick hands or unhurried ones. */
  quick: number;
  /** How far it wanders either side of its line on open road. */
  drift: number;
  /** How far from where it wants to be it will let the marble run before correcting. */
  slack: number;
  /** The chance, each time it looks, of a mistake: not looking for a moment, or misjudging where to go. */
  slip: number;
  /** How much its pace rises and falls over a race: its good spells and off spells. */
  swing: number;
  /** The chance it takes a fork's side road when it comes to one, going by whim. */
  fork: number;
  /** How well it knows the course, 0 to 1: one that knows it takes the side roads that save time and no others. */
  wise: number;
  /** The seconds each side road saves over staying on the main road, by lane: what there is to know. */
  roads: number[];
  /** How many seconds of road ahead it reads when choosing its line. */
  ahead: number;
  /** How hard it goes after speed pads, rings and the inside of a bend: 0 takes what is in its path, 1 hunts them. */
  keen: number;
  /** How well it judges where a swinging or turning thing will be by the time it gets there, 0 to 1. */
  foresee: number;
  /** How much of its wandering it keeps up when there is something to aim for: low for one that concentrates. */
  loose: number;
  /**
   * The last touches of an expert, 0 to 1: away the instant the race starts, holding its line through a crowd unless
   * somebody is really in the way, and lined up for the rings that hang over a jump.
   */
  polish: number;
  /** How far to one side of its line it likes to run. */
  side: number;
  /** How much room it likes to leave round other marbles and things in the road, 1 being a normal amount. */
  care: number;
  /** How many seconds ahead it notices something in its way: short for a late dodger, long for a careful one. */
  sight: number;
  /** Makes each rival's wandering and mistakes its own, and the same every time. */
  seed: number;
}

/** Another marble on the course, as a rival sees it. */
export interface Traffic {
  lane: number;
  s: number;
  x: number;
  v: number;
  gait: number;
  /** A rival's driver, or null for the player's marble. */
  driver: Driver | null;
  progress(): number;
}

/** How many strips across the road a rival weighs up when choosing where to be. */
const SLOTS = 15;
/** The most things on the road ahead a rival plans a way through at once. */
const GATES = 40;

export type SimEvent =
  | { type: 'tick' | 'go' | 'land' | 'scrape' | 'finish' | 'results' | 'fork' | 'goo' | 'launch' | 'lift' | 'knock' }
  | { type: 'boost' | 'turbo' | 'crate' | 'pin' | 'bump' | 'ring' | 'jump'; index: number }
  | { type: 'pickup'; index: number; id: string };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The rules of a run, with no rendering or sound: it can be stepped headlessly to test or time a course. */
export class Sim {
  lane = 0;
  s = START_S;
  x = 0;
  v = 0;
  xv = 0;
  /** Height above the road while airborne. */
  h = 0;
  time = 0;
  clock = 0;
  countdown = COUNTDOWN;
  finished = false;
  finishT = 0;
  boostT = 0;
  /** Where the player wants the ball, or null to hold its line. */
  steer: number | null = null;
  /** Running total of sideways re-measurements: taking a fork arm restates x from the arm's own centre. */
  shift = 0;
  /** Set while `steer` comes from a finger swiping on a touch screen. */
  swiping = false;
  autopilot: Autopilot = 'none';
  /** How hard the player is holding the ball back, 0 to 1. It works in the air too, where it also brings the ball down sooner. */
  brake = 0;
  /** A helping hand for a player behind in a race with friends: the share further it rolls on the road for its speed. */
  help = 0;
  /** Set for a computer rival: it drives itself, held back as the driver says. */
  driver: Driver | null = null;
  /** For a rival: how far through the course the marble it is racing has got, 0 to 1. */
  chase: (() => number) | null = null;
  /** For a rival: the other marbles, so it can make room instead of driving through them. */
  traffic: (() => Traffic[]) | null = null;
  /** True for a moment after a rival has been knocked by something: it shows in how the marble sits. */
  get rattled(): boolean {
    return this.knockT > 0;
  }

  /** A rival's own dice, made from its seed the first time they are needed. */
  private dice: (() => number) | null = null;
  /** Where the rival last decided to go, and how long until it looks again. */
  private goal = 0;
  private lookT = 0;
  /** While this runs the rival is not paying attention: it holds its last decision. */
  private lapseT = 0;
  /** How long after the start the rival takes to get going. */
  private getaway = 0;
  /** How much the rival is taking it easy to let the player back into the race, 0 to 1. */
  private relaxed = 0;
  /** How far off its line the rival has wandered: carried from look to look, so it meanders instead of jittering. */
  private astray = 0;
  /** How its pace is running against its usual: drifts up and down over a race, always pulled back to nothing. */
  private form = 0;
  /** Where it last settled on going, and how dangerous each strip of road looked when it last looked. */
  private aim = 0;
  /** Set when its line is aimed at something, a pad to catch or a gap to thread, and wandering would cost it. */
  private aiming = false;
  /** How far off its line it is running just now: the side it favours, its wandering, a misjudgment. */
  private lean = 0;
  /** Set while other marbles are close enough to need steering round. */
  private crowded = false;
  /** The line it last read: where along the road each thing on it comes, and where across the road to be there. */
  private readonly routeIn = new Float32Array(GATES);
  private readonly routeOut = new Float32Array(GATES);
  private readonly routeX = new Float32Array(GATES);
  private routeLane = 0;
  private routeS0 = 0;
  private routeX0 = 0;
  /** How far across it can move for each unit of road, and how many seconds up the road it steers for. */
  private routeRate = 0;
  private routeLead = 0;
  private gates = 0;
  private readonly plan = [new Float32Array(SLOTS), new Float32Array(SLOTS)];
  private readonly cameBy = new Int8Array(GATES * SLOTS);
  private readonly danger = new Float32Array(SLOTS);
  private readonly sees = new Float32Array(SLOTS);
  /** After a mistake, how long before it can make another, and how long it goes on not seeing far enough ahead. */
  private steadyT = 0;
  private blinkT = 0;
  /** Which way it went at the last fork it came to, so it does not always do the same. */
  private lastFork = false;
  /** Forks the rival has made its mind up about, and the side road it is heading for, if any. */
  private readonly settled = new Set<number>();
  private heading = 0;
  /** How much of its speed the marble is using right now: 1 unless a driver is holding it back. */
  gait = 1;
  readonly bonuses: string[] = [];
  /** Counts for the awards: rings threaded, things hit and so on. */
  readonly tally = { rings: 0, hits: 0, pins: 0, turbos: 0, launches: 0 };
  /** Fork arms the ball went down. */
  private readonly taken = new Set<number>();
  /** Per course object: smashed or knocked over. Marbles racing each other share the one list. */
  done: boolean[];
  /** Per course object: this marble has had it, a ring threaded or a fruit collected. */
  private readonly mine: boolean[];
  /** Per fruit: when it is next there to be collected. Shared in a race, where fruit comes back. */
  private freshAt: number[];
  private fruitBack = Infinity;
  /** Per course object: the ingredient a pickup holds. */
  readonly items: (string | undefined)[];
  /** Seconds of turbo left. */
  turboT = 0;

  /** The fork arm the ball has just come off, while it is still close behind. */
  private cameFrom = 0;
  private riding = false;
  /** Upward speed while airborne. */
  vh = 0;
  private knockT = 0;
  private scrapeT = 0;
  private gooT = 0;
  private dt = 0;
  private lastTick = COUNTDOWN + 1;
  private reported = false;
  private readonly readyAt: number[];
  private readonly byLane: number[][];
  private readonly f = makeFrame();
  private readonly ahead = makeFrame();
  private readonly scratch = makeFrame();
  private readonly spot = new Vector3();
  private readonly offset = new Vector3();

  constructor(
    readonly course: Course,
    readonly level: Level,
    private readonly emit: (event: SimEvent) => void = () => {},
    random: () => number = Math.random,
  ) {
    const pool = level.bonusPool.length ? level.bonusPool : [level.fruit];
    this.done = course.objects.map(() => false);
    this.mine = course.objects.map(() => false);
    this.freshAt = course.objects.map(() => 0);
    this.readyAt = course.objects.map(() => 0);
    this.items = course.objects.map((o) =>
      o.kind !== 'pickup' ? undefined : o.item === LEVEL_FRUIT ? level.fruit : (o.item ?? pool[Math.floor(random() * pool.length)]),
    );
    this.byLane = course.lanes.map(() => []);
    course.objects.forEach((o, i) => this.byLane[o.lane].push(i));
  }

  /**
   * Race on the same course as another marble: what either smashes is smashed for both, and a fruit either takes
   * is gone for the other until it comes back.
   */
  shareWith(other: Sim): void {
    this.done = other.done;
    this.freshAt = other.freshAt;
    this.fruitBack = other.fruitBack = FRUIT_BACK;
  }

  /** Has this marble threaded this ring or collected this fruit? */
  had(index: number): boolean {
    return this.mine[index];
  }

  /** Is this fruit there to be collected right now? */
  fresh(index: number): boolean {
    return this.clock >= this.freshAt[index];
  }

  /** A friend racing on another device has taken this fruit: it is gone for a moment, as when a rival takes one. */
  lose(index: number): void {
    this.freshAt[index] = this.clock + FRUIT_BACK;
  }

  /** Nothing left of this for the marble: smashed, already had, or a fruit somebody has just taken. */
  private gone(index: number): boolean {
    return this.done[index] || this.mine[index] || this.clock < this.freshAt[index];
  }

  /**
   * Knocked by another marble: its speed changes by `along` down the road and `across` it, and it is moved `aside`
   * so the two no longer overlap. A hard knock takes the steering away for a moment.
   */
  shove(along: number, across: number, aside: number, hard: boolean): void {
    // Never off the road: a marble against the kerb stays put and the other one gives way.
    const [lo, hi] = this.bounds();
    this.x = clamp(this.x + aside, Math.min(lo, this.x), Math.max(hi, this.x));
    this.xv += across;
    // A held-back rival covers less ground for its speed, so it takes more of a change to shift it as far. Past
    // the line a marble is rolling to a stop, and a knock must not set it off again; nor does a knock ever send a
    // marble off faster than the road allows.
    const change = along / Math.max(0.5, this.pace / Math.max(this.v, 1));
    this.v = clamp(this.v + change, this.finished ? 0 : MIN_SPEED, Math.max(this.v, MAX_SPEED));
    if (!hard || this.finished) return;
    if (this.knockT <= 0) this.emit({ type: 'knock' });
    this.knockT = Math.max(this.knockT, 0.15);
  }

  /** How fast the marble is really covering the road: a held-back rival uses only part of its speed on the ground. */
  get pace(): number {
    return this.v * (this.h > 0 || this.riding ? 1 : this.gait * (1 + this.help));
  }

  /** Stop sharing the course: from here what this marble smashes or takes is its own affair. */
  goAlone(): void {
    this.done = [...this.done];
    this.freshAt = [...this.freshAt];
  }

  /** How far from the centre the ball can go where it is now: the road narrows and widens. */
  get limit(): number {
    return this.course.lanes[this.lane].track.halfAt(Math.max(0, this.s)) - BALL_RADIUS;
  }

  /** The fork arms the ball is alongside but has not yet chosen between, with how far each has drawn away. */
  private parting(): { lane: number; off: number }[] {
    if (this.lane !== 0) return [];
    const out: { lane: number; off: number }[] = [];
    this.course.lanes.forEach((lane, index) => {
      const from = lane.from;
      if (!from) return;
      const d = this.s - from.s0;
      if (d >= 0 && d < from.decide) out.push({ lane: index, off: from.spread[Math.floor(d)] });
    });
    return out;
  }

  /**
   * How far left and right the ball can go. Where a fork is parting, the road is as wide as both routes together,
   * so the choice can be left until they have actually separated.
   */
  bounds(): [number, number] {
    return this.across(this.parting().map(({ off }) => off));
  }

  /** The road's edges where it takes in other roads whose centres lie `offs` to the right of this one's. */
  private across(offs: number[]): [number, number] {
    const limit = this.limit;
    return [Math.min(0, ...offs) - limit, Math.max(0, ...offs) + limit];
  }

  /**
   * How far left and right a player may steer for. A fork about to open, or opening, is reached for: far enough
   * over that a finger which has already swiped for the side road takes it the moment the road is there, and no
   * further, so a swipe back is soon answered.
   */
  reach(): [number, number] {
    const offs = this.parting().map(({ off }) => off);
    if (this.lane === 0) {
      for (const { from } of this.course.lanes) {
        if (from && this.s >= from.s0 - REACH_AHEAD && this.s < from.s0 + from.decide) offs.push(from.spread[from.decide] * 0.6);
      }
    }
    return this.across(offs);
  }

  /** What the run achieved, for the results and the awards. */
  feats(): Feats {
    const { lanes, objects } = this.course;
    // Pickups the ball could have reached: those on arms it took, and on the main route outside those arms.
    const reachable = (o: CourseObj) =>
      o.lane === 0 ? ![...this.taken].some((arm) => o.s > lanes[arm].from!.s0 + lanes[arm].from!.decide && o.s < lanes[arm].from!.s1) : this.taken.has(o.lane);
    let pickups = 0;
    let possible = 0;
    objects.forEach((o, i) => {
      if (o.kind !== 'pickup' || !reachable(o)) return;
      possible++;
      if (this.had(i)) pickups++;
    });
    return { ...this.tally, pickups, possible };
  }

  /** Where a point in the world is on a lane: how far along, and how far to the right of its centre. */
  private locate(lane: number, world: Vector3, guess: number): { s: number; x: number } {
    const track = this.course.lanes[lane].track;
    const f = this.scratch;
    let s = guess;
    // Step along until the point is square-on to the track.
    for (let i = 0; i < 8; i++) {
      track.at(s, f);
      s = Math.min(track.length, Math.max(0, s + this.offset.subVectors(world, f.p).dot(f.t)));
    }
    track.at(s, f);
    return { s, x: this.offset.subVectors(world, f.p).dot(f.r) };
  }

  /** Jump straight to racing. */
  skipCountdown(): void {
    this.countdown = 0;
    this.v = CRUISE * 0.6;
  }

  /** Frame at distance `s` along a lane. Past either end of a fork arm it carries on along the main route. */
  frameAt(s: number, out: Frame, lane = this.lane): Frame {
    const { lanes, track } = this.course;
    const from = lanes[lane].from;
    if (!from) {
      // Looking back just after leaving a fork arm, or ahead just before taking one, follow the arm rather than
      // the main route's alternative, so the camera does not jump sideways.
      if (lane === this.lane) {
        const left = this.cameFrom ? lanes[this.cameFrom] : null;
        if (left && s < left.from!.s1) return left.track.at(left.track.length - (left.from!.s1 - s), out);
        for (let i = 1; i < lanes.length; i++) {
          const next = lanes[i].from!;
          // Looking ahead past where a fork parts: follow the road the ball is heading for.
          const d = this.s - next.s0;
          if (d < next.decide && s - next.s0 >= next.decide && s - next.s0 < 60) {
            // The same test the ball itself will face: nearer the arm's centre than the main route's, once parted.
            const parted = next.spread[next.decide];
            if (Math.abs(this.x - parted) < Math.abs(this.x)) return lanes[i].track.at(s - next.s0, out);
          }
        }
      }
      return track.at(s, out);
    }
    const arm = lanes[lane].track;
    if (s < 0) return track.at(from.s0 + s, out);
    if (s > arm.length) return track.at(from.s1 + s - arm.length, out);
    return arm.at(s, out);
  }

  point(s: number, x: number, y: number, out: Vector3, lane = this.lane): Vector3 {
    const f = this.frameAt(s, this.scratch, lane);
    return out.copy(f.p).addScaledVector(f.r, x).addScaledVector(f.u, y);
  }

  /** How far through the course the ball is, 0 to 1. */
  progress(): number {
    const from = this.course.lanes[this.lane].from;
    const along = from ? from.s0 + (this.s / this.course.lanes[this.lane].track.length) * (from.s1 - from.s0) : this.s;
    return clamp((along - START_S) / (this.course.finishS - START_S), 0, 1);
  }

  /** Where a slider or pendulum is across the road, now or `lead` seconds from now. */
  swingX(o: CourseObj, lead = 0): number {
    return o.x + (o.amp ?? 0) * Math.sin((this.clock + lead) * (o.speed ?? 1) + (o.phase ?? 0));
  }

  /** Where each windmill sail that is low enough to hit is crossing the road, now or `lead` seconds from now. */
  sailsAt(o: CourseObj, lead = 0): number[] {
    const out: number[] = [];
    for (let k = 0; k < 4; k++) {
      const angle = this.spinAngle(o) + lead * (o.speed ?? 1) + (k * Math.PI) / 2;
      if (Math.cos(angle) > SAIL_LOW) out.push(SAIL * Math.sin(angle));
    }
    return out;
  }

  /** Is the ball over a stretch with no road? */
  overGap(): boolean {
    return this.course.gaps.some((g) => g.lane === this.lane && this.s > g.s0 && this.s < g.s1);
  }

  /** Is the ball on an escalator? */
  onLift(): boolean {
    return this.course.lifts.some((l) => l.lane === this.lane && this.s >= l.s0 && this.s <= l.s1);
  }

  spinAngle(o: CourseObj): number {
    return this.clock * (o.speed ?? 1) + (o.phase ?? 0);
  }

  /**
   * Where a rival wants to be across the road right now. It only looks every so often, and what it does between
   * looks is what makes it seem to be driven by someone.
   */
  private decide(driver: Driver, dt: number): number {
    const dice = (this.dice ??= seeded(driver.seed));
    // Three dice together give mostly middling numbers and the odd large one, as people's variations do.
    const bell = () => ((dice() + dice() + dice()) * 2) / 3 - 1;
    if (this.getaway === 0) {
      this.getaway = Math.max(0.001, driver.react * (0.6 + dice() * 1.6) * (1 - driver.polish));
      this.goal = this.aim = this.x;
    }
    const [lo, hi] = this.bounds();
    this.lapseT -= dt;
    this.steadyT -= dt;
    this.blinkT -= dt;
    this.lookT -= dt;
    if (this.lookT <= 0) {
      // Taking it easy shows in the driving, not only the pace: slower to look, and running wider.
      const ease = this.relaxed;
      this.lookT = driver.react * (1 + ease) * (0.7 + dice() * 0.6);
      // Wandering, and how its pace is running: each a small step from where it was, pulled gently back, so it
      // meanders and has its spells instead of jittering.
      const reach = driver.drift * (1 + ease);
      this.astray = clamp(this.astray * 0.9 + bell() * reach * 0.45, -reach, reach);
      this.form = clamp(this.form * 0.96 + bell() * driver.swing * 0.5, -2.5 * driver.swing, 2.5 * driver.swing);
      if (this.lapseT <= 0) {
        this.readRoad(driver);
        this.goal = this.onward();
        // With something to aim for it concentrates, as far as it is able; on open road it runs where it likes.
        this.lean = (driver.side + this.astray) * (this.aiming ? driver.loose : 1);
        // A mistake, but never two in quick succession: that would look broken, not human.
        let lapse = false;
        if (this.steadyT <= 0 && dice() < driver.slip) {
          this.steadyT = 4;
          // Half the time its mind wanders and it holds its line for a moment, whatever is coming; otherwise it
          // misjudges: heads a little to one side of where it meant to, and is slow to see what is in the way.
          if (dice() < 0.5) lapse = true;
          else {
            this.lean += bell() * 2.5;
            this.blinkT = 1.2;
          }
        }
        this.lookForFork(driver, dice);
        this.aim = this.weighUp(driver, lo, hi);
        if (lapse) {
          this.lapseT = 0.6 + dice() * 0.9;
          if (!this.crowded) this.aim = clamp(this.goal + this.lean, lo + 0.3, hi - 0.3);
        }
      }
    }
    // Taking a side road is one long deliberate move: over to the side it leaves from in good time, then following
    // where the side road will be a moment from now, because by the time the roads part it has to be on it.
    if (this.heading && this.lane === 0) {
      const from = this.course.lanes[this.heading].from!;
      const into = this.s - from.s0;
      if (into < from.decide) {
        const soon = Math.floor(into + this.v * 0.7);
        return clamp(soon < 0 ? from.side * 3.6 : from.spread[Math.min(from.decide, soon)], lo + 0.3, hi - 0.3);
      }
      this.heading = 0;
    }
    // Between looks it carries on with what it has already read: past one thing, on to the next. In a crowd, or
    // with its mind elsewhere, it holds to what it last settled on.
    if (!this.crowded && this.lapseT <= 0) {
      this.goal = this.onward();
      this.aim = clamp(this.goal + this.lean, lo + 0.3, hi - 0.3);
    }
    // Near enough is good enough: while the marble is heading for somewhere close to where it wants to be, it is
    // left to run straight. Only with something to aim for does every bit count.
    const bound = this.x + this.xv * 0.4;
    if (!this.aiming && !this.crowded && Math.abs(this.aim - bound) < driver.slack) return clamp(bound, lo + 0.3, hi - 0.3);
    return clamp(this.aim, lo + 0.3, hi - 0.3);
  }

  /**
   * Where the line it has read wants the marble: it steers for a point a little way up the road, since the marble
   * takes a moment to answer, moving across between one thing and the next as early as it can.
   */
  private onward(): number {
    if (this.routeLane !== this.lane) return this.x;
    const look = this.s + Math.max(MIN_SPEED, this.v * this.gait) * this.routeLead;
    let x = this.routeX0;
    let from = this.routeS0;
    for (let gate = 0; gate < this.gates; gate++) {
      const to = this.routeX[gate];
      if (look <= this.routeIn[gate]) return x + Math.sign(to - x) * Math.min(Math.abs(to - x), this.routeRate * Math.max(0, look - from));
      if (look <= this.routeOut[gate]) return to;
      x = to;
      from = this.routeOut[gate];
    }
    return x;
  }

  private slotOf(x: number, lo: number, hi: number): number {
    return clamp(Math.round(((x - lo - 0.3) / Math.max(0.1, hi - lo - 0.6)) * (SLOTS - 1)), 0, SLOTS - 1);
  }

  /**
   * Choose where across the road to be. The road is cut into strips; everything in the way marks the strips it
   * makes dangerous, and where the rival would like to be marks how much each strip appeals. It then takes the
   * most appealing strip it can get to without crossing worse danger than it is already in. So it goes round a
   * whole knot of marbles in one move, never dives through a crate for a speed pad, and is boxed in when it is.
   */
  private weighUp(driver: Driver, lo: number, hi: number): number {
    const width = Math.max(0.1, hi - lo - 0.6);
    const at = (slot: number) => lo + 0.3 + (slot / (SLOTS - 1)) * width;
    const seen = this.sees.fill(0);
    // Only what will be reached within its sight counts, and more the sooner; a misjudgment shortens its sight.
    const sight = driver.sight * (this.blinkT > 0 ? 0.4 : 1);
    const pace = Math.max(1, this.v * this.gait);
    // Something `across` the road, `wide` either side, mattering `much`: full danger over its own width, then
    // a skirt that falls away, wider for a rival that likes more room.
    const mark = (across: number, wide: number, much: number) => {
      const skirt = 1.4 * driver.care;
      for (let slot = 0; slot < SLOTS; slot++) {
        const off = Math.abs(at(slot) - across);
        const level = off < wide ? much : off < wide + skirt ? much * (1 - (off - wide) / skirt) : 0;
        if (level > seen[slot]) seen[slot] = level;
      }
    };
    this.crowded = false;
    for (const other of this.traffic?.() ?? []) {
      if (other.lane !== this.lane) continue;
      const gap = other.s - this.s;
      // Anyone alongside is in the way. Anyone ahead only if they are being caught: a marble at racing pace is
      // left alone, or nobody would ever get past anybody.
      const reached = gap > 0 && pace - other.v * other.gait > 0.5 ? gap / (pace - other.v * other.gait) : Infinity;
      // A polished driver is not put off its line by a marble that is nowhere near where it is going.
      const way = this.goal + this.lean;
      if (driver.polish && (other.x < Math.min(this.x, way) - 2.3 || other.x > Math.max(this.x, way) + 2.3)) continue;
      // Nor does it give way to one alongside: it holds its line and lets the bump settle it.
      if (!driver.polish && Math.abs(gap) < 3.5) mark(other.x, 2, 1);
      else if (reached < sight * 2) mark(other.x, 2, clamp(1 - reached / (sight * 2), 0, 1));
      else continue;
      this.crowded = true;
    }
    for (const i of this.byLane[this.lane]) {
      const o = this.course.objects[i];
      const ahead = o.s - this.s;
      if (ahead > pace * sight) break;
      if (ahead < -1 || this.gone(i)) continue;
      const much = clamp(1.15 - ahead / (pace * sight), 0, 1);
      // What swings or turns is judged where it will be on arrival, as well as this rival can judge it.
      const lead = (Math.max(0, ahead) / pace) * driver.foresee;
      if (o.kind === 'crate') mark(o.x, 2.15, much);
      else if (o.kind === 'goo') mark(o.x, 2, much * 0.8);
      else if (o.kind === 'slider' || o.kind === 'pendulum') mark(this.swingX(o, lead), 2.1, much);
      else if (o.kind === 'spinner') mark(o.x, (o.len ?? 3.2) + 0.4, much);
      else if (o.kind === 'windmill') for (const x of this.sailsAt(o, lead)) mark(x, 2.4, much);
    }
    // What it saw last time lingers, so danger builds over a look or two and it does not twitch at every flicker.
    for (let slot = 0; slot < SLOTS; slot++) this.danger[slot] = this.danger[slot] * 0.4 + seen[slot] * 0.6;

    // Where it would like to be: its line, shifted by the side it favours and how far it has wandered. The
    // strips are only for picking a way round a crowd: with the road to itself it drives the line it has read.
    const home = clamp(this.goal + this.lean * (this.crowded ? 0.25 : 1), lo + 0.3, hi - 0.3);
    if (!this.crowded) return home;

    // From where it is, it can reach a strip only by going through strips no more dangerous than its own.
    const here = this.slotOf(this.x, lo, hi);
    const ceiling = Math.max(this.danger[here], 0.12);
    let left = here;
    let right = here;
    while (left > 0 && this.danger[left - 1] <= ceiling) left--;
    while (right < SLOTS - 1 && this.danger[right + 1] <= ceiling) right++;
    // Of those, the one that appeals most: near home, and clear. Home never stops appealing altogether, so a
    // rival squeezed to the kerb still knows which way is back.
    let best = here;
    let most = -Infinity;
    for (let slot = left; slot <= right; slot++) {
      const appeal = 1 - (0.85 * Math.abs(at(slot) - home)) / width - this.danger[slot] * 1.5;
      if (appeal > most) {
        most = appeal;
        best = slot;
      }
    }
    // The strips are coarse: where home itself is reachable and clear, go exactly there.
    const homeSlot = this.slotOf(home, lo, hi);
    return homeSlot >= left && homeSlot <= right && this.danger[homeSlot] < 0.1 && Math.abs(best - homeSlot) <= 1 ? home : at(best);
  }

  /**
   * How much a rival out in front takes it easy so the player is not left racing alone, 0 to 1. Never near the
   * player, where it would show; never in the first seconds, when the field should spread out; and the rivals in
   * front ease together, by how far ahead they are between them, so they keep their distance from one another
   * instead of bunching up to be passed in one go. A rival is never sped up.
   */
  private takingItEasy(): number {
    if (!this.chase || !this.driver?.easeOff || this.time < 8) return 0;
    const player = this.chase();
    let lead = this.progress() - player;
    if (lead < 0.02) return 0;
    let count = 1;
    for (const other of this.traffic?.() ?? []) {
      const theirs = other.driver ? other.progress() - player : 0;
      if (theirs >= 0.02) {
        lead += theirs;
        count++;
      }
    }
    return clamp((lead / count - 0.02) / 0.08, 0, 1);
  }

  /** Coming up to a fork, make up its mind, once and in good time, whether to take the side road. */
  private lookForFork(driver: Driver, dice: () => number): void {
    if (this.lane !== 0) return;
    this.course.lanes.forEach((lane, index) => {
      const from = lane.from;
      if (!from || this.settled.has(index)) return;
      const ahead = from.s0 - this.s;
      if (ahead < 0 || ahead > 50) return;
      this.settled.add(index);
      // Not the same choice time after time: having just done one thing, it leans a little towards the other.
      const whim = clamp(driver.fork + (this.lastFork ? -0.2 : 0.2) * (this.settled.size > 1 ? 1 : 0), 0, 1);
      // A second either way is neither here nor there, and left to whim.
      const saves = driver.roads[index] ?? 0;
      const chance = whim + driver.wise * ((saves > 1 ? 1 : saves < -1 ? 0 : whim) - whim);
      this.lastFork = dice() < chance;
      if (this.lastFork) this.heading = index;
    });
  }

  /** How firmly a rival can turn the marble on this road: less on a wet one, less still on ice. */
  private firmness(driver: Driver): number {
    const grip = GRIP[this.course.mood];
    return driver.turn * (grip === Infinity ? 1 : grip > 4 ? 0.75 : 0.55);
  }

  /**
   * A rival's line: what it makes of the road it can see. It runs its eye over everything coming up, speed pads,
   * rings, crates, things that swing, the bends, and works out the best way through that its own hands can manage:
   * it does not set off for a pad it cannot get across to, or thread a gap that will have closed. How far ahead it
   * reads, how keen it is to go out of its way, and how well it judges moving things are what separate a sharp
   * driver from a casual one.
   */
  private readRoad(driver: Driver): void {
    const pace = Math.max(MIN_SPEED, this.v * this.gait);
    // A misjudgment shortens how far it is reading for a moment.
    const horizon = Math.max(22, pace * driver.ahead * (this.blinkT > 0 ? 0.4 : 1));
    // The road narrows and widens: it thinks across the widest of what is coming, and keeps to what each part allows.
    const halfAt = (s: number) => this.course.lanes[this.lane].track.halfAt(Math.max(0, s)) - BALL_RADIUS - 0.4;
    const edge = Math.max(0.5, halfAt(this.s), halfAt(this.s + horizon / 2), halfAt(this.s + horizon));
    const strip = (2 * edge) / (SLOTS - 1);
    const at = (slot: number) => -edge + slot * strip;
    // How far across it can get for each unit of road: its hands are only so quick.
    const rate = (Math.min((this.v * 0.34 * driver.quick) / 9, driver.quick) * 0.8) / pace;
    // Going out of its way is an effort, and more of one for a rival that is not chasing every pad.
    const effort = 0.015 + 0.2 * (1 - driver.keen);
    const room = 0.3 * driver.care + 0.3 * driver.loose;

    let now = this.plan[0];
    let next = this.plan[1];
    let left = this.s;
    let stake = false;
    this.gates = 0;
    this.routeLane = this.lane;
    this.routeS0 = this.s;
    this.routeX0 = this.x;
    this.routeRate = rate;
    this.routeLead = 2 / this.firmness(driver);
    // The marble arrives a moment behind where it is steered, and steering early for the next thing starts to
    // carry it off this one: so anything to be passed just so is reached that much sooner and held a little longer.
    const settle = pace * this.routeLead;

    // One step of the plan: from every strip it could be in at the last thing, to every strip at this one. It has
    // to be in place from `before` the thing until `after` it.
    const advance = (s: number, before: number, after: number, worth: (x: number) => number, middle = NaN) => {
      const gate = this.gates;
      const reach = rate * Math.max(0, s - before - left);
      const span = Math.ceil(reach / strip);
      const kerb = Math.max(strip, halfAt(s));
      this.frameAt((s + left) / 2, this.ahead);
      // The inside of a bend is the shorter way round.
      const inside = (this.ahead.k * Math.max(0, s - left) * driver.keen) / 54;
      for (let slot = 0; slot < SLOTS; slot++) {
        const x = at(slot);
        let best = -Infinity;
        let via = slot;
        if (!gate) {
          const move = Math.abs(x - this.x);
          if (move <= reach + strip / 2) best = -effort * move - Math.abs(x - this.goal) * 0.02;
        } else {
          for (let was = Math.max(0, slot - span); was <= Math.min(SLOTS - 1, slot + span); was++) {
            const move = Math.abs(x - at(was));
            if (move > reach + 1e-6 || now[was] === -Infinity) continue;
            // All else equal, sooner: a move left late is a move that may not come off.
            const total = now[was] - effort * move * (1 + gate * 0.03);
            if (total > best) {
              best = total;
              via = was;
            }
          }
        }
        next[slot] = best === -Infinity || Math.abs(x) > kerb ? -Infinity : best + worth(x) + inside * x;
        this.cameBy[gate * SLOTS + slot] = via;
      }
      [now, next] = [next, now];
      this.routeIn[gate] = s - before;
      this.routeOut[gate] = left = s + after;
      this.routeX[gate] = middle;
      this.gates++;
    };

    // A ramp carries the marble over whatever stands just behind it, and up to rings that hang in the air.
    let rampX = 0;
    let rampFrom = 0;
    let rampTo = 0;
    for (const i of this.byLane[this.lane]) {
      const o = this.course.objects[i];
      const ahead = o.s - this.s;
      if (ahead > horizon || this.gates >= GATES - 1) break;
      if (ahead < 0.5 || this.gone(i)) continue;
      const lead = (ahead / pace) * driver.foresee;
      const flown = o.s > rampFrom && o.s < rampTo;
      // Hitting something costs more the faster it is going: all the speed above a steady roll is gone for good.
      const cost = 1.2 + Math.max(0, this.v - CRUISE) / 13;
      const near = ahead < pace * 1.2;
      const want = (worth: number, wide: number, exact = false) => {
        if (near) stake = true;
        const value = (x: number) => {
          const off = Math.abs(x - o.x);
          return off > wide ? 0 : worth * driver.keen * (off < wide * 0.5 ? 1 : 0.7);
        };
        advance(o.s, exact ? 0.5 + settle / 2 : 1, exact ? 0.5 + settle / 2 : 0, value, o.x);
      };
      const avoid = (xs: number[], wide: number, much: number, long = 1.5) => {
        if (near) stake = true;
        const hit = (x: number) => xs.some((hx) => Math.abs(x - hx) < wide + room) && !(flown && Math.abs(x - rampX) < 1.6);
        advance(o.s, long + 0.5 + settle, long + settle / 2, (x) => (hit(x) ? -much : 0));
      };
      if (o.kind === 'pad') {
        // A pad is worth the speed it adds, and near top speed that is not much.
        if (this.clock >= this.readyAt[i]) want(Math.max(0.3, (Math.min(MAX_SPEED, Math.max(this.v, CRUISE) + 13) - this.v) / 13), 1.6);
      } else if (o.kind === 'turbo') {
        if (this.clock >= this.readyAt[i]) want(3, 2.2);
      } else if (o.kind === 'ring') {
        // Rings hung over a gap in the road are on the way across for anyone who lines up for them.
        const over = driver.polish > 0 && this.course.gaps.some((g) => g.lane === this.lane && o.s > g.s0 && o.s < g.s1 + (g.s1 - g.s0));
        if ((o.y ?? 2) < 3 || over || (flown && Math.abs(o.x - rampX) < 1)) want(0.45, 1.45, true);
      } else if (o.kind === 'jump') {
        // In the air from a moment after the ramp until a moment before landing.
        const power = o.power ?? 11.5;
        const high = Math.sqrt(Math.max(0, power * power - 4 * 13 * 2)) / 26;
        rampX = o.x;
        rampFrom = o.s + pace * (power / 26 - high);
        rampTo = o.s + pace * (power / 26 + high);
        want(0.25, 1.9, true);
      } else if (o.kind === 'crate') avoid([o.x], 2.1, cost);
      else if (o.kind === 'goo') avoid([o.x], 1.95, cost, (o.len ?? 8) / 2 + 0.5);
      else if (o.kind === 'slider' || o.kind === 'pendulum') avoid([this.swingX(o, lead)], 2.0, cost + 0.3);
      else if (o.kind === 'spinner') {
        // A turning bar blocks the whole road when it lies across it and hardly any when it lies along it: what
        // counts is which way it will be pointing on arrival, give or take.
        const angle = this.spinAngle(o) + lead * (o.speed ?? 1);
        let wide = 0;
        for (const a of [angle - 0.3, angle, angle + 0.3]) wide = Math.max(wide, Math.min(((o.len ?? 3.2) + 0.3) / Math.abs(Math.cos(a)), 1.3 / Math.abs(Math.sin(a))));
        avoid([o.x], wide + 0.2, cost);
      } else if (o.kind === 'windmill') avoid(this.sailsAt(o, lead), 2.0, cost + 0.3);
    }
    // Past the last thing it can see there is still road, and a bend has an inside.
    if (this.s + horizon - left > 4) advance(this.s + horizon, 0, 0, () => 0);
    this.aiming = stake;

    // Trace the best way through back from its far end, to find where across the road to be at each thing.
    let slot = 0;
    for (let other = 1; other < SLOTS; other++) if (now[other] > now[slot]) slot = other;
    if (now[slot] === -Infinity) {
      this.gates = 0;
      return;
    }
    for (let gate = this.gates - 1; gate >= 0; gate--) {
      const x = at(slot);
      // The strips are coarse: where it is going for a pad, go for the middle of it.
      const middle = this.routeX[gate];
      this.routeX[gate] = Math.abs(x - middle) < Math.max(strip, 0.6) ? clamp(middle, -edge, edge) : x;
      slot = this.cameBy[gate * SLOTS + slot];
    }
  }

  /** A careful player's line, for the hands-free test runs: go for everything, give blockers a wide berth. */
  private smartLine(): number {
    const hazards: { s: number; x: number; wide: number }[] = [];
    const wants: number[] = [];
    for (const i of this.byLane[this.lane]) {
      const o = this.course.objects[i];
      const ahead = o.s - this.s;
      if (ahead < 0.5 || ahead > 36 || this.gone(i)) continue;
      if (o.kind === 'crate' || o.kind === 'goo') hazards.push({ s: ahead, x: o.x, wide: 2.3 });
      else if (o.kind === 'slider' || o.kind === 'pendulum') hazards.push({ s: ahead, x: this.swingX(o), wide: 2.4 });
      else if (o.kind === 'spinner') hazards.push({ s: ahead, x: o.x, wide: (o.len ?? 3.2) + 0.6 });
      else if (o.kind === 'windmill') for (const x of this.sailsAt(o)) hazards.push({ s: ahead, x, wide: 2.6 });
      else if (o.kind !== 'pin' && ahead < 26 && (o.y ?? 0) < 3) wants.push(o.x);
    }
    this.frameAt(this.s + 8, this.ahead);
    const edge = this.limit - 0.6;
    // Never drift across a parting fork by accident: stay on the route the ball is on.
    wants.push(clamp(this.ahead.k * 160, -edge, edge), clamp(this.x, -edge, edge));
    const safe = (x: number) => hazards.every((h) => h.s > 20 || Math.abs(h.x - x) > h.wide);
    const pick = wants.find(safe);
    if (pick !== undefined) return pick;
    const room = (x: number) => Math.min(...hazards.map((h) => Math.abs(h.x - x) - h.wide));
    return [-3.8, -1.9, 0, 1.9, 3.8].sort((a, b) => room(b) - room(a))[0];
  }

  /**
   * An expert's line, driving for time alone: it sets the five-star time. It heads for the next speed pad, ring or
   * ramp it can actually reach, takes the inside of bends otherwise, and sidesteps blockers at the last moment.
   */
  private aceLine(): number {
    const edge = this.limit - 0.4;
    const reach = (ahead: number) => (26 * ahead) / Math.max(this.v, 20) + 0.8;
    const blockers: { s: number; x: number; wide: number }[] = [];
    let goal: number | null = null;
    for (const i of this.byLane[this.lane]) {
      const o = this.course.objects[i];
      const ahead = o.s - this.s;
      if (ahead < -1 || ahead > 60 || this.gone(i)) continue;
      if (o.kind === 'crate') blockers.push({ s: ahead, x: o.x, wide: 2.15 });
      else if (o.kind === 'goo') blockers.push({ s: ahead, x: o.x, wide: 2.0 });
      else if (o.kind === 'slider' || o.kind === 'pendulum') blockers.push({ s: ahead, x: this.swingX(o), wide: 2.1 });
      else if (o.kind === 'spinner') blockers.push({ s: ahead, x: o.x, wide: (o.len ?? 3.2) + 0.4 });
      else if (o.kind === 'windmill') for (const x of this.sailsAt(o)) blockers.push({ s: ahead, x, wide: 2.4 });
      else if (goal === null && ahead > 0.5 && (o.kind === 'pad' || o.kind === 'turbo' || o.kind === 'jump' || (o.kind === 'ring' && (o.y ?? 2) < 3))) {
        // Worth going for only if the ball can get across in time and it is not behind a blocker.
        const behindBlocker = blockers.some((b) => b.s < ahead + 1 && b.s > ahead - 6 && Math.abs(b.x - o.x) < b.wide);
        if (Math.abs(o.x - this.x) <= reach(ahead) && !behindBlocker) goal = o.x;
      }
    }
    if (goal === null) {
      this.frameAt(this.s + 8, this.ahead);
      goal = Math.abs(this.ahead.k) > 0.004 ? clamp(this.ahead.k * 400, -edge, edge) : clamp(this.x, -edge, edge);
    }
    // Anything about to be hit on this line: step round it by the shorter way that stays on the road.
    const soon = Math.max(8, this.v * 0.32);
    const inWay = blockers.filter((b) => b.s > -1 && b.s < soon);
    const clear = (x: number) => inWay.every((b) => Math.abs(b.x - x) > b.wide);
    if (!clear(goal)) {
      const options = inWay.flatMap((b) => [b.x - b.wide - 0.15, b.x + b.wide + 0.15]).filter((x) => Math.abs(x) <= edge && clear(x));
      if (options.length) goal = options.sort((p, q) => Math.abs(p - this.x) - Math.abs(q - this.x))[0];
    }
    return clamp(goal, -edge, edge);
  }

  step(dt: number): void {
    const { lanes, track, objects, finishS } = this.course;
    this.dt = dt;
    this.clock += dt;

    if (this.countdown > 0) {
      this.countdown -= dt;
      const shown = Math.ceil(this.countdown);
      if (shown < this.lastTick) {
        this.lastTick = shown;
        this.emit({ type: shown > 0 ? 'tick' : 'go' });
      }
      if (this.countdown > 0) return;
      this.v = CRUISE * 0.6;
    }

    const f = this.frameAt(this.s, this.f);

    // Steering: the ball chases the finger; let go and it holds its line.
    this.knockT -= dt;
    // On an escalator the ball is carried: it drifts to the middle and steering does nothing.
    const riding = this.onLift();
    if (riding && !this.riding) this.emit({ type: 'lift' });
    this.riding = riding;
    const driver = this.driver;
    const line = this.autopilot;
    const wanted = riding ? 0 : driver ? this.decide(driver, dt) : line === 'ace' ? this.aceLine() : line === 'smart' ? this.smartLine() : this.steer;
    const target = this.finished || this.knockT > 0 ? null : wanted;
    // On a wet or icy road the ball takes a moment to answer, and slides on when you let go.
    const grip = GRIP[this.course.mood];
    if (target !== null && driver && !riding) {
      // A rival turns the marble the way a hand does: it leans towards where it wants to be and eases off as it
      // arrives, without swinging past, and can only move across as fast as it is rolling allows.
      const firm = this.firmness(driver);
      const push = clamp(firm * firm * (target - this.x) - 2 * firm * this.xv, -firm * 11, firm * 11);
      const most = Math.min((this.v * 0.34 * driver.quick) / 9, driver.quick);
      this.xv = clamp(this.xv + push * dt, -most, most);
    } else if (target !== null) {
      // A swiping finger gets a snappier ball than keys or the mouse: quick enough to cross the road in about a
      // third of a second.
      const pace = this.swiping || line === 'ace' ? { pull: 14, top: 28 } : { pull: 9, top: 16 };
      const wanted = clamp((target - this.x) * (riding ? 2.5 : pace.pull), -pace.top, pace.top);
      this.xv += (wanted - this.xv) * Math.min(1, dt * grip);
    } else {
      this.xv *= Math.exp(-Math.min(8, grip * 0.5) * dt);
    }
    this.x += this.xv * dt;
    const [lo, hi] = this.bounds();
    if (this.x < lo || this.x > hi) {
      // Slide back on rather than snap: the road may have just narrowed, or a fork just closed behind the ball.
      const over = this.x - clamp(this.x, lo, hi);
      this.x -= Math.sign(over) * Math.min(Math.abs(over), 30 * dt);
      if (this.xv * (this.x - (lo + hi) / 2) > 0) this.xv = 0;
      // Pushing on a kerb costs speed, except for a swipe on the side where a fork is about to open: that is
      // reaching for it. Keys and a mouse ask afresh every moment, so for them a kerb is a kerb.
      const [least, most] = target !== null && this.swiping ? this.reach() : [lo, hi];
      if (target !== null && (target < lo ? least >= lo : target > hi && most <= hi) && this.v > CRUISE * 0.75) {
        this.v -= 7 * dt;
        this.scrapeT -= dt;
        if (this.scrapeT <= 0) {
          this.scrapeT = 0.06;
          this.emit({ type: 'scrape' });
        }
      }
    }

    // Speed: always rolling, quicker downhill, and boosts fade slowly so chaining them pays off.
    this.turboT -= dt;
    if (this.finished) {
      this.v -= this.v * 1.7 * dt;
    } else if (riding) {
      // An escalator sets its own pace: any turbo ends there.
      this.turboT = 0;
      this.v += (LIFT_SPEED - this.v) * Math.min(1, dt * 6);
      this.time += dt;
    } else if (this.brake > 0) {
      // Held back: the speed comes off, a turbo with it, but the ball never stops rolling.
      this.turboT = 0;
      this.v = this.v > ROLL ? Math.max(ROLL, this.v - HOLD_BACK * this.brake * dt) : Math.min(ROLL, this.v + 10 * dt);
      this.v = clamp(this.v, MIN_SPEED, TURBO_SPEED);
      this.time += dt;
    } else {
      if (this.v < CRUISE) this.v += 10 * dt;
      else this.v -= (this.v - CRUISE) * 0.24 * dt;
      this.v -= GRAVITY * f.t.y * dt;
      // Turbo holds a speed far above the usual limit, then it bleeds off quickly.
      if (this.turboT > 0) this.v = Math.max(this.v, TURBO_SPEED);
      else if (this.v > MAX_SPEED) this.v -= (this.v - MAX_SPEED) * 2.5 * dt;
      this.v = clamp(this.v, MIN_SPEED, TURBO_SPEED);
      this.time += dt;
    }
    this.boostT -= dt;

    // The inside of a bend is a shorter path, so taking the right line is genuinely faster.
    let before = this.s;
    if (this.driver) {
      this.relaxed = this.takingItEasy();
      // Nobody gets away at quite the same moment.
      const away = clamp(this.time / Math.max(0.01, this.getaway), 0.35, 1);
      // Nobody keeps the same pace all race either: it comes and goes slowly, with the odd short off spell when
      // a rival can be caught.
      const wanted = Math.min(1, this.driver.speed * (1 + this.form)) * away * (1 - this.driver.easeOff * this.relaxed);
      // Pace changes gently: a marble that slowed or picked up in an instant would give the game away.
      this.gait = this.time === 0 ? wanted : this.gait + clamp(wanted - this.gait, -0.35 * dt, 0.35 * dt);
    }
    // In the air and on an escalator a held-back rival still covers the full distance: a jump's arc is made for
    // it, and an escalator carries everyone alike.
    const stride = this.h > 0 || riding ? 1 : this.gait * (1 + this.help);
    this.s += (this.v * stride * dt) / clamp(1 - f.k * this.x, 0.6, 1.5);

    if (this.lane === 0) {
      this.s = Math.min(track.length - 2, this.s);
      if (this.cameFrom && this.s > lanes[this.cameFrom].from!.s1 + 14) this.cameFrom = 0;
      for (let i = 1; i < lanes.length; i++) {
        const from = lanes[i].from!;
        // The roads have parted: the ball is on whichever it is nearer the middle of. The arm points a different
        // way by now, so find where the ball actually is on it rather than assuming the two run side by side.
        const parted = from.s0 + from.decide;
        if (before < parted && this.s >= parted) {
          this.point(this.s, this.x, 0, this.spot);
          const on = this.locate(i, this.spot, this.s - from.s0);
          if (Math.abs(on.x) < Math.abs(this.x)) {
            this.shift += on.x - this.x;
            this.lane = i;
            this.s = on.s;
            this.x = on.x;
            this.taken.add(i);
            before = -1;
            this.emit({ type: 'fork' });
            break;
          }
        }
      }
    } else if (this.s >= lanes[this.lane].track.length) {
      this.s = lanes[this.lane].from!.s1 + this.s - lanes[this.lane].track.length;
      before = lanes[this.lane].from!.s1 - 0.01;
      this.cameFrom = this.lane;
      this.lane = 0;
    }

    // Where the road stops, fling the ball across to where it starts again.
    for (const gap of this.course.gaps) {
      if (gap.lane !== this.lane) continue;
      if (before < gap.s0 && this.s >= gap.s0) {
        // The arc is the same height every time, so rings and fruit hang where they can be reached, but speed is
        // kept: a boosted ball lands further on, and a slow one comes down short and has to skip the rest.
        this.v = Math.max(this.v, 30);
        this.vh = (13 * (gap.s1 - gap.s0 + 4)) / 43;
        this.h = Math.max(this.h, 0.01);
        this.tally.launches++;
        this.emit({ type: 'launch' });
      } else if (this.h === 0 && this.s > gap.s0 && this.s < gap.s1 - 1) {
        // Landed short: skip on rather than roll along thin air.
        this.vh = 7;
        this.h = 0.01;
      }
    }

    if (this.h > 0 || this.vh > 0) {
      // Held back in the air the ball drops sooner as well as travelling less far: a jump can be cut short to
      // come down on something worth landing on.
      this.vh -= 26 * (1 + this.brake) * dt;
      this.h += this.vh * dt;
      if (this.h <= 0) {
        this.h = 0;
        this.vh = 0;
        this.emit({ type: 'land' });
      }
    }

    if (!this.finished) {
      for (const i of this.byLane[this.lane]) {
        const ds = objects[i].s - this.s;
        if (ds > 6) break;
        if (ds < -6 || this.gone(i)) continue;
        this.touch(objects[i], i, before);
      }
      if (this.lane === 0 && this.s >= finishS) {
        this.finished = true;
        this.emit({ type: 'finish' });
      }
    } else {
      this.finishT += dt;
      if (this.finishT > 1.8 && !this.reported) {
        this.reported = true;
        this.emit({ type: 'results' });
      }
    }
  }

  private slow(factor: number): void {
    this.turboT = 0;
    this.v = Math.max(MIN_SPEED, Math.min(this.v, MAX_SPEED) * factor);
  }

  private touch(o: CourseObj, index: number, before: number): void {
    const ds = o.s - this.s;
    const crossed = before < o.s && this.s >= o.s;
    const dx = Math.abs(this.x - o.x);
    const ready = this.clock >= this.readyAt[index];
    switch (o.kind) {
      case 'pad':
        if (Math.abs(ds) < 3 && dx < 1.9 && this.h < 0.6 && ready) {
          this.readyAt[index] = Infinity;
          this.v = Math.max(this.v, Math.min(MAX_SPEED, Math.max(this.v, CRUISE) + 13));
          this.boostT = Math.max(this.boostT, 1.1);
          this.emit({ type: 'boost', index });
        }
        break;
      case 'turbo':
        if (Math.abs(ds) < 4 && dx < 2.6 && this.h < 0.6 && ready) {
          this.readyAt[index] = Infinity;
          this.turboT = TURBO_TIME;
          this.v = TURBO_SPEED;
          this.boostT = TURBO_TIME;
          this.tally.turbos++;
          this.emit({ type: 'turbo', index });
        }
        break;
      case 'crate':
        if (Math.abs(ds) < 1.4 && dx < 1.15 + BALL_RADIUS * 0.9 && this.h < 1.7) {
          this.done[index] = true;
          this.slow(0.5);
          this.tally.hits++;
          this.emit({ type: 'crate', index });
        }
        break;
      case 'pin':
        if (Math.abs(ds) < 0.9 && dx < 0.4 + BALL_RADIUS * 0.9 && this.h < 1.2) {
          this.done[index] = true;
          this.v *= 0.97;
          this.tally.pins++;
          this.emit({ type: 'pin', index });
        }
        break;
      case 'slider':
      case 'pendulum': {
        const sx = this.swingX(o);
        if (Math.abs(ds) < 1.2 && Math.abs(this.x - sx) < 1 + BALL_RADIUS * 0.9 && this.h < 2 && ready) {
          this.readyAt[index] = this.clock + 1;
          this.slow(0.55);
          this.xv = Math.sign(this.x - sx || 1) * 10;
          this.knockT = 0.25;
          this.tally.hits++;
          this.emit({ type: 'bump', index });
        }
        break;
      }
      case 'spinner': {
        // Work out where the ball is in the bar's own frame: along it, and across it.
        const angle = this.spinAngle(o);
        const lx = this.x - o.x;
        const along = lx * Math.cos(angle) - ds * Math.sin(angle);
        const across = lx * Math.sin(angle) + ds * Math.cos(angle);
        if (Math.abs(along) < (o.len ?? 3.2) + 0.3 && Math.abs(across) < 0.45 + BALL_RADIUS * 0.85 && this.h < 1.6 && ready) {
          this.readyAt[index] = this.clock + 0.8;
          this.slow(0.6);
          this.xv = Math.sign(lx || 1) * 9;
          this.knockT = 0.25;
          this.tally.hits++;
          this.emit({ type: 'bump', index });
        }
        break;
      }
      case 'windmill':
        if (Math.abs(ds) < 1.2 && this.h < 2.2 && ready) {
          const sail = this.sailsAt(o).find((x) => Math.abs(this.x - x) < 1.4);
          if (sail !== undefined) {
            this.readyAt[index] = this.clock + 1;
            this.slow(0.55);
            this.xv = Math.sign(this.x - sail || 1) * 10;
            this.knockT = 0.25;
            this.tally.hits++;
          this.emit({ type: 'bump', index });
          }
        }
        break;
      case 'goo':
        if (Math.abs(ds) < (o.len ?? 8) / 2 && dx < 1.9 && this.h < 0.3) {
          this.turboT = 0;
          this.v -= Math.max(0, this.v - 15) * 4 * this.dt;
          this.gooT -= this.dt;
          if (this.gooT <= 0) {
            this.gooT = 0.12;
            this.emit({ type: 'goo' });
          }
        }
        break;
      case 'ring':
        if (crossed && dx < 1.75 && Math.abs(this.h + BALL_RADIUS - (o.y ?? 2)) < 2.4) {
          this.mine[index] = true;
          this.v = Math.max(this.v, Math.min(MAX_SPEED, this.v + 6));
          this.boostT = Math.max(this.boostT, 0.5);
          this.tally.rings++;
          this.emit({ type: 'ring', index });
        }
        break;
      case 'jump':
        if (crossed && dx < 2.3 && this.h === 0) {
          this.vh = o.power ?? 11.5;
          this.h = 0.01;
          this.v = Math.max(this.v, Math.min(MAX_SPEED, this.v + 3));
          this.emit({ type: 'jump', index });
        }
        break;
      case 'pickup':
        if (Math.abs(ds) < 1.5 && dx < 1.6 && Math.abs(this.h + BALL_RADIUS - (o.y ?? 1.3)) < 1.9) {
          this.mine[index] = true;
          this.freshAt[index] = this.clock + this.fruitBack;
          const id = this.items[index]!;
          this.bonuses.push(id);
          this.emit({ type: 'pickup', index, id });
        }
        break;
    }
  }
}

/** Play a course hands-free and return the finish time in seconds, or Infinity if it never finishes. */
export function timeCourse(course: Course, level: Level, by: Autopilot | Driver): number {
  const sim = new Sim(course, level, () => {}, () => 0);
  if (typeof by === 'string') sim.autopilot = by;
  else sim.driver = by;
  sim.skipCountdown();
  for (let step = 0; step < 600 / TICK && !sim.finished; step++) sim.step(TICK);
  return sim.finished ? sim.time : Infinity;
}
