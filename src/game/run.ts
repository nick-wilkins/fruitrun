import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PointLight,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  Vector3,
  type InstancedMesh,
  type WebGLRenderer,
} from 'three';
import { sfx } from '../audio';
import { starsForTime, type Feats } from '../core/progress';
import type { Marble } from '../core/nearby';
import { finishingOrder, SEATS, YOUR_COLOR, type Finisher, type Rival, type Seat } from '../core/race';
import type { Level } from '../data/levels';
import { Rig } from './camera';
import { buildPip, PIP, type Pip, type PipLook } from './character';
import { jostle } from './contact';
import { ghostAt, Recorder, type Ghost } from './ghost';
import type { Course } from './course';
import { seeded } from './random';
import { GRID, gridSlot } from './rivals';
import { BALL_RADIUS, COUNTDOWN, CRUISE, MAX_SPEED, MIN_SPEED, PUSH, Sim, TICK, type Driver, type SimEvent } from './sim';
import { blobTexture } from './textures';
import { makeFrame } from './track';
import { buildWorld, PIVOT, standing, type World } from './world';

export interface HudState {
  time: number;
  stars: number;
  /** 0 to 1. */
  speed: number;
  progress: number;
  bonuses: number;
  /** Seconds left before the start, or null once racing. */
  countdown: number | null;
  boosting: boolean;
  /** In a race: where the player is running, 1 being the lead, and how far along each rival is, 0 to 1. */
  place: number | null;
  rivals: number[];
}

/** A race: who the player is up against, and how each of them drives. */
export interface Field {
  rivals: Rival[];
  drivers: Driver[];
}

/** How a marble in a game with friends is painted: the green one is Pip as ever, the rest in their seat's colours. */
const seatLook = (seat: Seat): PipLook => (seat.pip ? PIP : { skin: seat.color, belly: seat.pale, leaf: seat.deep, bands: [seat.deep, '#ffffff', seat.color] });

/** Somebody racing on another device: how to draw them, and the marble their reports move. */
export interface Friend {
  /** Where they sit: 0 for whoever started the game. */
  seat: number;
  rival: Seat;
  marble: Marble;
}

/** A race with friends nearby: where this player lines up, and the others. */
export interface Together {
  slot: number;
  friends: Friend[];
}

/** How a race ended: everyone in finishing order, and where the player came. */

interface Racer {
  rival: Rival;
  sim: Sim;
  pip: Pip;
  shadow: Mesh;
  /** The fire streaming off the back of the mean one. */
  flame?: Group;
}

export interface RunHooks {
  hud(state: HudState): void;
  pickup(id: string): void;
  /** The line has been crossed: bank the result now. */
  /** In a race, `place` is where the player came. */
  finish(time: number, bonuses: string[], feats: Feats, place: number | null): void;
  /** The celebration has played: show the results, with everyone's finishing order if it was a race. */
  results(order: Finisher[] | null): void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How long after the player crosses the line the results will wait for a rival who is nearly home, in seconds. */
const WAIT_FOR_RIVALS = 7;

/** How much of the screen's width a finger swipes to take the ball from one kerb to the other. */
const SWIPE = 0.24;

interface Flying {
  mesh: InstancedMesh;
  index: number;
  pos: Vector3;
  vel: Vector3;
  spin: Vector3;
  angle: number;
  life: number;
}

/** A tail of fire streaming out of the back of a marble, made to ripple by `waveFlame`. */
function buildFlame(): Group {
  const flame = new Group();
  const tongues: [string, number, number][] = [
    ['#ff5a1f', 0.55, 3.6],
    ['#ffd84a', 0.32, 2.5],
  ];
  tongues.forEach(([color, radius, length], i) => {
    const geometry = new ConeGeometry(radius, length, 8, 12, true);
    // Lay it down pointing backwards, its mouth at the marble.
    geometry.rotateX(-Math.PI / 2).translate(0, 0, -length / 2);
    geometry.userData = { rest: geometry.attributes.position.array.slice(), length };
    const tongue = new Mesh(geometry, new MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
    tongue.position.set(0, 0.35, -0.55);
    tongue.renderOrder = 2 + i;
    tongue.frustumCulled = false;
    flame.add(tongue);
  });
  return flame;
}

/** Ripple a flame like a ribbon in the wind: still at the marble, swinging wider towards its tip. `burn` is how long it is. */
function waveFlame(flame: Group, clock: number, burn: number): void {
  flame.children.forEach((child, i) => {
    const geometry = (child as Mesh).geometry;
    const { rest, length } = geometry.userData as { rest: Float32Array; length: number };
    const at = geometry.attributes.position;
    for (let v = 0; v < at.count; v++) {
      const along = -rest[v * 3 + 2] / length;
      const sway = along * along;
      at.setXYZ(
        v,
        rest[v * 3] + Math.sin(clock * 11 - along * 5.5 + i * 0.9) * 1.05 * sway,
        rest[v * 3 + 1] + Math.sin(clock * 8 - along * 4 + i) * 0.2 * sway + sway * 0.7,
        rest[v * 3 + 2] * burn,
      );
    }
    at.needsUpdate = true;
  });
}

/** A small pool of glowing dots for sparkles, splinters and confetti. */
class Sparks {
  readonly points: Points;
  private readonly max = 240;
  private readonly pos = new Float32Array(this.max * 3);
  private readonly col = new Float32Array(this.max * 3);
  private readonly vel = new Float32Array(this.max * 3);
  private readonly life = new Float32Array(this.max);
  private next = 0;
  private readonly color = new Color();

  constructor() {
    const geometry = new BufferGeometry();
    this.pos.fill(-99999);
    geometry.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    this.points = new Points(
      geometry,
      new PointsMaterial({
        size: 0.7,
        map: blobTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
  }

  burst(at: Vector3, count: number, colors: string[], speed: number, drift?: Vector3): void {
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      this.pos.set([at.x, at.y, at.z], i * 3);
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 2 - 0.4;
      const k = speed * (0.4 + Math.random() * 0.8);
      this.vel.set([Math.cos(a) * k + (drift?.x ?? 0), up * k + (drift?.y ?? 0), Math.sin(a) * k + (drift?.z ?? 0)], i * 3);
      this.color.set(colors[n % colors.length]);
      this.col.set([this.color.r, this.color.g, this.color.b], i * 3);
      this.life[i] = 0.5 + Math.random() * 0.5;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const o = i * 3;
      if (this.life[i] <= 0) {
        this.pos[o + 1] = -99999;
        continue;
      }
      this.vel[o + 1] -= 9 * dt;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

const BOX = { x: 70, y: 44, z: 70 };

/** Keep `v` within half a box either side of `centre` by wrapping it round. */
const wrap = (v: number, centre: number, size: number) => centre + ((((v - centre + size / 2) % size) + size) % size) - size / 2;

/**
 * Rain streaks or snowflakes. Each one stays put in the world and simply falls; any that drop out of the box
 * around the camera reappear on the far side, so the weather streams past as the ball moves.
 */
class Weather {
  readonly object: LineSegments | Points;
  private readonly count: number;
  private readonly at: Float32Array;
  private readonly fall: number;
  private readonly snow: boolean;

  constructor(mood: 'rain' | 'snow') {
    this.snow = mood === 'snow';
    this.count = this.snow ? 420 : 520;
    this.fall = this.snow ? 7 : 58;
    this.at = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) this.at.set([Math.random() * BOX.x, Math.random() * BOX.y, Math.random() * BOX.z], i * 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.count * (this.snow ? 3 : 6)), 3));
    this.object = this.snow
      ? new Points(geometry, new PointsMaterial({ color: '#ffffff', size: 0.45, map: blobTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false }))
      : new LineSegments(geometry, new LineBasicMaterial({ color: '#d6ecff', transparent: true, opacity: 0.5, depthWrite: false }));
    this.object.frustumCulled = false;
  }

  update(dt: number, clock: number, camera: Vector3): void {
    const position = this.object.geometry.attributes.position;
    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      const drift = this.snow ? Math.sin(clock * 1.3 + i) * dt * 1.4 : 0;
      const x = (this.at[o] = wrap(this.at[o] + drift, camera.x, BOX.x));
      const y = (this.at[o + 1] = wrap(this.at[o + 1] - this.fall * dt, camera.y + 8, BOX.y));
      const z = (this.at[o + 2] = wrap(this.at[o + 2], camera.z, BOX.z));
      if (this.snow) {
        position.setXYZ(i, x, y, z);
      } else {
        // Each streak is a short line slanting with the wind.
        position.setXYZ(i * 2, x, y, z);
        position.setXYZ(i * 2 + 1, x + 0.25, y - 1.7, z);
      }
    }
    position.needsUpdate = true;
  }
}

/** One attempt at a course: the rules live in Sim; this draws them, plays the sounds and reads the controls. */
export class Run {
  readonly sim: Sim;
  readonly world: World;
  // The near plane is kept well out: it sharpens depth in the distance, where overlapping roads would shimmer.
  private readonly camera = new PerspectiveCamera(62, 1, 0.6, 3200);
  private readonly pip: Pip;
  private readonly shadow: Mesh;
  private readonly sparks = new Sparks();
  private readonly rig = new Rig();
  private readonly canvas: HTMLCanvasElement;
  private readonly flying: Flying[] = [];
  private readonly weather: Weather | null;
  private readonly racers: Racer[] = [];
  /** Friends on other devices. They are drawn where they say they are and touch nothing here. */
  private readonly friends: (Friend & { pip: Pip; shadow: Mesh })[] = [];
  /** Every marble on the course, the player's first. */
  private readonly marbles: Sim[];
  private readonly recorder = new Recorder();
  /** The player's best run here, shown as a see-through marble to chase. It touches nothing. */
  private ghost: { run: Ghost; pip: Pip } | null = null;
  /** The celebration is over and the results are owed, once any rival about to finish has done so. */
  private resultsDue = false;
  private knockHeard = 0;
  /** Set once the player has finished and the rivals still out have been brought home out of sight. */
  private over = false;

  /** Where the steering finger is across the screen, -0.5 to 0.5, or null when nothing is held. */
  private pointerAcross: number | null = null;
  private pointerId: number | null = null;
  /**
   * For a finger: where the ball is being asked to go, built up from each movement of the finger, with where the
   * finger was last and the sim's sideways re-measurement at that moment.
   */
  private swipe: { target: number; across: number; shift: number } | null = null;
  private keySteer = 0;
  private shake = 0;
  private fov = 62;
  private raf = 0;
  private last = 0;
  private paused = false;
  private hudT = 0;
  private owed = 0;
  private disposed = false;

  private readonly f = makeFrame();
  private readonly v1 = new Vector3();
  private readonly v2 = new Vector3();
  private readonly v3 = new Vector3();
  private readonly v4 = new Vector3();
  private readonly camPos = new Vector3();
  private readonly camLook = new Vector3();
  private readonly camUp = new Vector3(0, 1, 0);
  private readonly m = new Matrix4();
  private readonly m2 = new Matrix4();
  private readonly q = new Quaternion();
  private readonly axisX = new Vector3(1, 0, 0);
  private readonly axisZ = new Vector3(0, 0, 1);
  /** The player's colour in the finishing order: Pip's green, or their seat's in a game with friends. */
  private readonly color: string;
  private readonly mySeat: number;

  constructor(
    private readonly renderer: WebGLRenderer,
    readonly course: Course,
    readonly level: Level,
    private readonly hooks: RunHooks,
    field: Field | null = null,
    together: Together | null = null,
  ) {
    this.canvas = renderer.domElement;
    this.sim = new Sim(course, level, (event) => this.react(event));
    this.world = buildWorld(course, this.sim.items, level.fruit);

    this.color = together ? SEATS[together.slot].color : YOUR_COLOR;
    this.mySeat = together?.slot ?? 0;
    this.pip = buildPip(together ? seatLook(SEATS[together.slot]) : undefined);
    this.pip.root.matrixAutoUpdate = false;
    this.world.scene.add(this.pip.root);
    // In the dark the ball carries a lamp that lights the road just around it.
    if (course.mood === 'night' || course.mood === 'midnight') {
      // Bright enough to pick the road out a few lengths ahead, not so bright that it bleaches it.
      const lamp = new PointLight(0xfff0c2, course.mood === 'midnight' ? 34 : 12, 42, 1.4);
      lamp.position.set(0, 3.2, 3);
      this.pip.root.add(lamp);
    }

    this.shadow = this.makeShadow();
    this.world.scene.add(this.shadow, this.sparks.points);
    // Line the field up side by side across the road, a bubble's width apart.
    if (field) this.sim.x = GRID[3];
    field?.rivals.forEach((rival, i) => {
      // Everyone races on the one course: a crate a rival smashes is gone for all, and so is fruit it takes.
      const sim = new Sim(course, level, (event) => this.rivalReact(sim, event), seeded(level.n * 31 + i));
      sim.shareWith(this.sim);
      sim.driver = field.drivers[i];
      sim.chase = () => this.sim.progress();
      sim.x = gridSlot(i, field.rivals.length);
      // In the dark only the player carries a lamp, so the rivals glow a little to stay in sight.
      const dark = course.mood === 'night' || course.mood === 'midnight';
      const pip = buildPip({ skin: rival.color, belly: rival.pale, leaf: rival.deep, bands: rival.mean ? [rival.deep, rival.color, '#ffb000'] : [rival.deep, '#ffffff', rival.color], glow: dark ? 0.55 : rival.mean ? 0.2 : 0, mean: rival.mean });
      pip.root.matrixAutoUpdate = false;
      const shadow = this.makeShadow();
      this.world.scene.add(pip.root, shadow);
      const flame = rival.mean ? buildFlame() : undefined;
      if (flame) pip.root.add(flame);
      this.racers.push({ rival, sim, pip, shadow, flame });
    });
    if (together) this.sim.x = GRID[together.slot] ?? 0;
    together?.friends.forEach((friend) => {
      const { rival } = friend;
      const dark = course.mood === 'night' || course.mood === 'midnight';
      const pip = buildPip({ ...seatLook(rival), glow: dark ? 0.55 : 0 });
      pip.root.matrixAutoUpdate = false;
      pip.root.visible = false;
      const shadow = this.makeShadow();
      shadow.visible = false;
      this.world.scene.add(pip.root, shadow);
      this.friends.push({ ...friend, pip, shadow });
    });
    // Each rival can see every other marble, the player's included, and makes room for it.
    this.marbles = [this.sim, ...this.racers.map((racer) => racer.sim)];
    for (const racer of this.racers) {
      const others = this.marbles.filter((sim) => sim !== racer.sim);
      racer.sim.traffic = () => others;
    }
    this.weather = course.mood === 'rain' || course.mood === 'snow' ? new Weather(course.mood) : null;
    if (this.weather) this.world.scene.add(this.weather.object);

    this.canvas.addEventListener('pointerdown', this.onPointer);
    this.canvas.addEventListener('pointermove', this.onPointer);
    this.canvas.addEventListener('pointerup', this.onRelease);
    this.canvas.addEventListener('pointercancel', this.onRelease);
    this.canvas.addEventListener('pointerleave', this.onRelease);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.dropInput);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.settle(0);
  }

  private makeShadow(): Mesh {
    const shadow = new Mesh(
      new PlaneGeometry(3, 3),
      new MeshBasicMaterial({
        map: blobTexture('rgba(0,0,0,0.5)', 'rgba(0,0,0,0)'),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      }),
    );
    shadow.matrixAutoUpdate = false;
    return shadow;
  }

  // ---- input ----

  private readonly onPointer = (e: PointerEvent) => {
    if (e.type === 'pointerdown') {
      // The first finger down steers; extra fingers or a resting palm are ignored.
      if (this.pointerId !== null) return;
      this.pointerId = e.pointerId;
    } else if (e.pointerId !== this.pointerId) {
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.pointerAcross = (e.clientX - rect.left) / rect.width - 0.5;
    // A finger steers by swiping from wherever it lands; a mouse steers by where it points.
    if (e.type === 'pointerdown') this.swipe = e.pointerType === 'mouse' ? null : { target: this.sim.x, across: this.pointerAcross, shift: this.sim.shift };
    e.preventDefault();
  };

  private readonly onRelease = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.pointerAcross = null;
    this.swipe = null;
  };

  private readonly onKey = (e: KeyboardEvent) => {
    const dir = e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : e.code === 'ArrowRight' || e.code === 'KeyD' ? 1 : 0;
    if (!dir) return;
    if (e.type === 'keydown') this.keySteer = dir;
    else if (this.keySteer === dir) this.keySteer = 0;
  };

  /** Forget held keys and fingers: their release can be missed while paused or in another window. */
  private readonly dropInput = () => {
    this.keySteer = 0;
    this.pointerId = null;
    this.pointerAcross = null;
    this.swipe = null;
  };

  private readonly resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private steer(): number | null {
    // Worked out afresh every frame: the road narrows, widens, and spreads out at a fork.
    const [lo, hi] = this.sim.bounds();
    // A swipe may reach for a side road that is about to open: it is held until the road is there.
    const [far, wide] = this.sim.reach();
    const least = far - PUSH;
    const most = wide + PUSH;
    if (this.pointerAcross !== null && this.swipe) {
      // The ball moves as far as the finger moves: SWIPE of the screen's width carries it right across the road.
      // Only movement counts, so a finger held still asks for nothing when the road widens or a fork is taken.
      const swipe = this.swipe;
      swipe.target += ((this.pointerAcross - swipe.across) / SWIPE) * (this.sim.limit + PUSH) * 2 + (this.sim.shift - swipe.shift);
      swipe.across = this.pointerAcross;
      swipe.shift = this.sim.shift;
      // Never far beyond the kerb, so swiping back is soon answered.
      swipe.target = clamp(swipe.target, least, most);
      return swipe.target;
    }
    if (this.pointerAcross !== null) return clamp((lo + hi) / 2 + this.pointerAcross * (hi - lo + BALL_RADIUS * 2) * 1.35, least, most);
    if (this.keySteer) return clamp(this.sim.x + this.keySteer * 3, least, most);
    return null;
  }

  // ---- loop ----

  /**
   * Get every shader and picture onto the graphics chip now. Left alone, each is prepared the first time it comes
   * into view, which is a dropped frame or several in the middle of a run.
   */
  private warm(): void {
    this.renderer.compile(this.world.scene, this.camera);
    this.world.scene.traverse((object) => {
      const material = (object as Mesh).material;
      for (const one of Array.isArray(material) ? material : material ? [material] : []) {
        const { map, emissiveMap, alphaMap } = one as MeshBasicMaterial & { emissiveMap?: MeshBasicMaterial['map'] };
        for (const texture of [map, emissiveMap, alphaMap]) if (texture?.image) this.renderer.initTexture(texture);
      }
    });
  }

  start(): void {
    this.warm();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  setPaused(value: boolean): void {
    this.paused = value;
    this.last = performance.now();
    if (value) this.dropInput();
  }

  private readonly frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    if (this.paused) return;
    // Fixed steps, however long the frame took: the same line earns the same time on any device.
    this.sim.steer = this.steer();
    this.sim.swiping = this.pointerAcross !== null && this.swipe !== null;
    this.owed += dt;
    while (this.owed >= TICK) {
      this.sim.step(TICK);
      this.recorder.sample(this.sim);
      for (const racer of this.racers) racer.sim.step(TICK);
      if (this.racers.length) jostle(this.marbles);
      if (this.resultsDue && !this.awaited()) {
        this.resultsDue = false;
        this.hooks.results(this.raceResult());
      }
      this.owed -= TICK;
    }
    this.animate(dt);
    this.renderer.render(this.world.scene, this.camera);
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.08;
      this.hooks.hud(this.hud());
    }
  };

  hud(): HudState {
    const sim = this.sim;
    return {
      time: sim.time,
      stars: starsForTime(this.level, sim.time),
      speed: clamp((sim.v - MIN_SPEED) / (MAX_SPEED - MIN_SPEED), 0, 1),
      progress: sim.progress(),
      bonuses: sim.bonuses.length,
      countdown: sim.countdown > 0 ? sim.countdown : null,
      boosting: sim.boostT > 0,
      place: this.racing() ? this.place() : null,
      rivals: [...this.racers.map((racer) => racer.sim.progress()), ...this.friends.map((friend) => (friend.marble.time === null ? friend.marble.progress : 1))],
    };
  }

  /** This run so far, as a ghost to keep: ask once the line has been crossed. */
  trace(): string {
    return this.recorder.finish(this.sim.time);
  }

  /** Show a best run alongside this one. */
  haunt(run: Ghost): void {
    if (this.ghost || this.disposed) return;
    const pip = buildPip({ skin: '#ffffff', belly: '#ffffff', leaf: '#dff4ff', bands: ['#ffffff', '#bfe9ff', '#ffffff'], glow: 0.4 });
    pip.root.traverse((part) => {
      const material = (part as Mesh).material as MeshBasicMaterial | undefined;
      if (!material) return;
      material.transparent = true;
      material.opacity = 0.38;
      material.depthWrite = false;
    });
    pip.root.matrixAutoUpdate = false;
    pip.root.visible = false;
    this.world.scene.add(pip.root);
    // It arrives during the countdown: have its see-through shaders ready before it is first shown.
    this.renderer.compile(pip.root, this.camera, this.world.scene);
    this.ghost = { run, pip };
  }

  /** Put the ghost where the best run was at this moment of it. */
  private seatGhost(lead: number): void {
    if (!this.ghost) return;
    const { run, pip } = this.ghost;
    const sim = this.sim;
    const spot = sim.countdown > 0 ? null : ghostAt(run, sim.time + lead);
    // Out of the way once the player is home, so the celebration is theirs.
    pip.root.visible = spot !== null && !sim.finished;
    if (!spot) return;
    const f = this.course.lanes[spot.lane].track.at(spot.s, this.f);
    this.v1.copy(f.r).negate();
    this.v2.copy(f.p).addScaledVector(f.r, spot.x).addScaledVector(f.u, BALL_RADIUS + spot.h);
    pip.root.matrix.makeBasis(this.v1, f.u, f.t).setPosition(this.v2);
    pip.root.matrixWorldNeedsUpdate = true;
  }

  /** Whether anyone else is on the course, computer or friend. */
  private racing(): boolean {
    return this.racers.length + this.friends.length > 0;
  }

  /** Put each friend's marble where their device last said it was, rolled on to now. */
  private seatFriends(): void {
    const now = performance.now() / 1000;
    for (const { marble, pip, shadow } of this.friends) {
      // Once over the line it is taken off the road, out of the way of those still coming.
      const spot = marble.gone || marble.time !== null ? null : marble.spot(now);
      const lane = spot ? this.course.lanes[spot.lane] : undefined;
      pip.root.visible = shadow.visible = Boolean(spot && lane);
      if (!spot || !lane) continue;
      const f = lane.track.at(spot.s, this.f);
      this.v1.copy(f.r).negate();
      this.v2.copy(f.p).addScaledVector(f.r, spot.x).addScaledVector(f.u, BALL_RADIUS + spot.h);
      pip.root.matrix.makeBasis(this.v1, f.u, f.t).setPosition(this.v2);
      pip.root.matrixWorldNeedsUpdate = true;
      const shrink = 1 / (1 + spot.h * 0.45);
      this.v3.copy(f.p).addScaledVector(f.r, spot.x).addScaledVector(f.u, 0.06);
      shadow.matrix.makeBasis(f.r, f.t, f.u).scale(this.v4.set(shrink, shrink, 1)).setPosition(this.v3);
      shadow.matrixWorldNeedsUpdate = true;
    }
  }

  /**
   * A race with friends as it stands: those home in the order of their own clocks, then those still out, the
   * furthest along first. Anyone who left before finishing is not in it.
   */
  standings(): Finisher[] {
    const sim = this.sim;
    const rows = [
      { name: 'You', color: this.color, time: sim.finished ? sim.time : Infinity, you: true, progress: sim.progress(), seat: this.mySeat },
      ...this.friends.filter(({ marble }) => marble.time !== null || !marble.gone).map(({ rival, marble, seat }) => ({ name: rival.name, color: rival.color, time: marble.time ?? Infinity, you: false, progress: marble.progress, seat })),
    ];
    rows.sort((a, b) => (a.time === b.time ? (Number.isFinite(a.time) ? a.seat - b.seat : b.progress - a.progress) : a.time - b.time));
    return rows.map(({ name, color, time, you }) => ({ name, color, time, you }));
  }

  /** Where the player is running: one more than the number of rivals in front. */
  private place(): number {
    const sim = this.sim;
    if (this.friends.length) return 1 + this.standings().findIndex((row) => row.you);
    const ahead = (rival: Sim) => (sim.finished ? rival.finished && rival.time < sim.time : rival.finished || rival.progress() > sim.progress());
    return 1 + this.racers.filter((racer) => ahead(racer.sim)).length;
  }

  /** The line is crossed: bring home anyone still out on the course, so the result is complete. */
  private raceResult(): Finisher[] | null {
    if (this.friends.length) return this.standings();
    if (!this.racers.length) return null;
    this.over = true;
    for (const racer of this.racers) {
      if (racer.sim.finished) continue;
      // Each on its own copy of the course, so who is brought home first makes no difference to anyone's time.
      racer.sim.goAlone();
      // Out of sight is out of the way: nothing left on the road to bump into, and nothing it does is shown.
      this.marbles.splice(this.marbles.indexOf(racer.sim), 1);
      // They run their own race from here, out of sight: nobody waits for a player who has already finished.
      racer.sim.chase = null;
      for (let step = 0; step < 600 / TICK && !racer.sim.finished; step++) racer.sim.step(TICK);
      racer.pip.root.visible = false;
      racer.shadow.visible = false;
    }
    return finishingOrder(this.sim.time, this.racers.map((racer) => ({ name: racer.rival.name, color: racer.rival.color, time: racer.sim.time })));
  }

  /**
   * After the player is home the results wait a little for rivals close behind, so they are seen crossing the
   * line. Nobody is waited for who will not make it in the time left.
   */
  private awaited(): boolean {
    const left = WAIT_FOR_RIVALS - this.sim.finishT;
    return this.racers.some((racer) => {
      const rival = racer.sim;
      if (rival.finished) return rival.finishT < 0.6 && left > 0;
      const togo = (1 - rival.progress()) * (this.course.finishS - 12);
      return togo / Math.max(MIN_SPEED, rival.pace) < left;
    });
  }

  // ---- reactions ----

  /** Where a course object is in the world. */
  private objectAt(index: number, y: number, out: Vector3): Vector3 {
    const o = this.course.objects[index];
    return this.sim.point(o.s, o.x, y, out, o.lane);
  }

  private ballAt(y: number, out: Vector3): Vector3 {
    return this.sim.point(this.sim.s, this.sim.x, y, out);
  }

  private fling(sim: Sim, mesh: InstancedMesh, index: number, height: number, lift: number): void {
    const o = this.course.objects[index];
    const f = sim.frameAt(sim.s, this.f);
    const pos = this.objectAt(index, height, new Vector3());
    const vel = f.t
      .clone()
      .multiplyScalar(sim.v * (0.8 + Math.random() * 0.4))
      .addScaledVector(f.u, lift * (0.7 + Math.random() * 0.6))
      .addScaledVector(f.r, (o.x - sim.x) * 5 + (Math.random() - 0.5) * 4);
    this.flying.push({ mesh, index: this.world.instance[index], pos, vel, spin: new Vector3(Math.random(), Math.random(), Math.random()).normalize(), angle: 0, life: 1.6 });
  }

  /** What a rival does to the course is seen by everyone: crates and pins fly, fruit goes. No sound. */
  private rivalReact(sim: Sim, event: SimEvent): void {
    if (this.over && !this.marbles.includes(sim)) return;
    if (event.type === 'crate') {
      this.fling(sim, this.world.crates, event.index, 1.05, 9);
      this.sparks.burst(this.objectAt(event.index, 1, this.v1), 16, ['#d89a4e', '#8a531f', '#fff2a8'], 7);
    } else if (event.type === 'pin') this.fling(sim, this.world.pins, event.index, 0.75, 11);
    else if (event.type === 'pickup') this.sparks.burst(this.world.pickups.get(event.index)!.base, 8, ['#ffffff', '#ffe066'], 4);
    else if (event.type === 'bump') this.sparks.burst(sim.point(sim.s, sim.x, 0.8, this.v1), 10, ['#ffffff', '#ffd9a8'], 5);
    else if (event.type === 'knock') {
      this.sparks.burst(sim.point(sim.s, sim.x, 0.8, this.v1), 6, ['#ffffff', '#ffd9a8'], 4);
      // Rivals knocking each other close by are heard, more quietly; a knock with the player has its own sound.
      // One knock, one sound, though both marbles report it.
      if (!this.sim.rattled && sim.lane === this.sim.lane && Math.abs(sim.s - this.sim.s) < 30 && this.sim.clock - this.knockHeard > 0.12) {
        this.knockHeard = this.sim.clock;
        sfx.knock(0.45);
      }
    } else if (event.type === 'finish') this.sparks.burst(sim.point(sim.s, sim.x, 2, this.v1), 40, ['#ffffff', '#ffd23f', '#4aa3ff', '#ff7ac0'], 10);
    else if (event.type === 'boost' || event.type === 'turbo') this.sparks.burst(sim.point(sim.s, sim.x, 0.5, this.v1), 8, ['#eaff3d', '#ffffff'], 4);
  }

  private react(event: SimEvent): void {
    const sim = this.sim;
    switch (event.type) {
      case 'tick':
        sfx.tick();
        break;
      case 'go':
        sfx.go();
        break;
      case 'boost':
        sfx.boost();
        this.sparks.burst(this.ballAt(0.5, this.v1), 12, ['#eaff3d', '#7dffb0'], 5);
        break;
      case 'turbo':
        sfx.turbo();
        this.shake = 0.35;
        this.sparks.burst(this.ballAt(0.5, this.v1), 30, ['#ff5a2a', '#ffd23f', '#ffffff'], 9);
        break;
      case 'crate':
        this.shake = 0.5;
        sfx.hit();
        this.fling(sim, this.world.crates, event.index, 1.05, 9);
        this.sparks.burst(this.objectAt(event.index, 1, this.v1), 16, ['#d89a4e', '#8a531f', '#fff2a8'], 7);
        break;
      case 'pin':
        sfx.pin();
        this.fling(sim, this.world.pins, event.index, 0.75, 11);
        break;
      case 'bump':
        this.shake = 0.4;
        sfx.hit();
        this.sparks.burst(this.ballAt(0.8, this.v1), 12, ['#ff4fa3', '#ffffff'], 6);
        break;
      case 'knock':
        this.shake = 0.25;
        sfx.knock();
        this.sparks.burst(this.ballAt(0.8, this.v1), 8, ['#ffffff', '#ffd9a8'], 5);
        break;
      case 'ring':
        sfx.ring();
        this.world.rings.setMatrixAt(this.world.instance[event.index], this.m.makeScale(0, 0, 0));
        this.world.rings.instanceMatrix.needsUpdate = true;
        this.sparks.burst(this.objectAt(event.index, this.course.objects[event.index].y ?? 2, this.v1), 18, ['#ffd23f', '#fff6c2'], 7);
        break;
      case 'jump':
        sfx.jump();
        break;
      case 'land':
        sfx.land();
        this.sparks.burst(this.ballAt(0.2, this.v1), 8, ['#ffffff', '#ffe9a8'], 4);
        break;
      case 'goo':
        sfx.squelch();
        this.sparks.burst(this.ballAt(0.3, this.v1), 3, [this.course.theme.goo], 3);
        break;
      case 'scrape':
        this.sparks.burst(sim.point(sim.s, sim.x + Math.sign(sim.x) * 0.9, 0.4, this.v1), 2, ['#fff2a8', '#ffb347'], 3);
        break;
      case 'fork':
        sfx.fork();
        break;
      case 'launch':
        sfx.launch();
        this.sparks.burst(this.ballAt(0.4, this.v1), 16, ['#ffffff', '#ffd23f', '#ff7a1a'], 8);
        break;
      case 'lift':
        sfx.lift();
        break;
      case 'pickup': {
        const visual = this.world.pickups.get(event.index)!;
        sfx.pickup();
        this.hooks.pickup(event.id);
        this.sparks.burst(visual.base, 14, ['#ffffff', '#ffe066', '#ff9ecb'], 6);
        break;
      }
      case 'finish': {
        // Anyone already home is ahead; the rest race on to the line by themselves, with nobody left to wait for.
        this.hooks.finish(sim.time, sim.bonuses, sim.feats(), this.racing() ? this.place() : null);
        for (const racer of this.racers) racer.sim.chase = null;
        sfx.finish();
        const f = sim.frameAt(sim.s, this.f);
        this.sparks.burst(this.ballAt(2, this.v1), 90, ['#ff4d6d', '#ffd23f', '#4cd964', '#4aa3ff', '#ffffff'], 14, this.v2.copy(f.t).multiplyScalar(sim.v * 0.5));
        break;
      }
      case 'results':
        this.resultsDue = true;
        break;
    }
  }

  // ---- presentation ----

  /** Put a marble and its shadow where its rules say they are, `lead` seconds into the step to come. */
  private seat(sim: Sim, pip: Pip, shadow: Mesh, lead: number): void {
    const s = sim.s + sim.v * sim.gait * lead;
    const x = sim.x + sim.xv * lead;
    const h = sim.h > 0 ? Math.max(0, sim.h + sim.vh * lead) : 0;
    const f = sim.frameAt(s, this.f);
    this.v1.copy(f.r).negate();
    this.v2.copy(f.p).addScaledVector(f.r, x).addScaledVector(f.u, BALL_RADIUS + h);
    pip.root.matrix.makeBasis(this.v1, f.u, f.t).setPosition(this.v2);
    pip.root.matrixWorldNeedsUpdate = true;

    const shrink = 1 / (1 + h * 0.45);
    this.v3.copy(f.p).addScaledVector(f.r, x).addScaledVector(f.u, 0.06);
    shadow.matrix.makeBasis(f.r, f.t, f.u).scale(this.v4.set(shrink, shrink, 1)).setPosition(this.v3);
    shadow.matrixWorldNeedsUpdate = true;
    // Nothing to cast a shadow on where the road has been taken away.
    shadow.visible = pip.root.visible && !sim.overGap();
  }

  /** Put the marbles, their shadows and the camera where the rules say they are. */
  private settle(dt: number): void {
    const sim = this.sim;
    // The rules move in fixed steps that rarely line up with the screen's frames. Draw each marble where it will
    // be by now, part-way into the next step, so its motion is even rather than a step ahead or behind.
    const lead = sim.countdown > 0 || sim.finished ? 0 : this.owed;
    // A rival still racing after the player is home keeps its own smooth motion.
    for (const racer of this.racers) this.seat(racer.sim, racer.pip, racer.shadow, racer.sim.finished || racer.sim.countdown > 0 ? 0 : this.owed);
    this.seatGhost(lead);
    this.seatFriends();
    // The player last: the camera works from what is left behind.
    this.seat(sim, this.pip, this.shadow, lead);
    const s = sim.s + sim.v * lead;
    const x = sim.x + sim.xv * lead;
    const h = sim.h > 0 ? Math.max(0, sim.h + sim.vh * lead) : 0;
    const f = this.f;

    this.rig.update(sim, s, x, h, dt);
    this.camPos.copy(this.rig.pos);
    this.camLook.copy(this.rig.look);
    this.camUp.copy(this.rig.up);

    if (this.racing() && sim.countdown > 0) {
      // Before a race the view starts in front, facing the grid, and swings round to its place behind for "go".
      const k = clamp(1 - sim.countdown / COUNTDOWN, 0, 1);
      const smooth = (t: number) => t * t * (3 - 2 * t);
      const swing = smooth(clamp((k - 0.15) / 0.7, 0, 1));
      const angle = swing * Math.PI;
      const out = 11 - swing * 2;
      this.v1.copy(f.p).addScaledVector(f.t, Math.cos(angle) * out).addScaledVector(f.r, Math.sin(angle) * out).addScaledVector(f.u, 2.2 + swing * 1.8);
      this.v3.copy(f.p).addScaledVector(f.u, 2.8 - swing * 1.6);
      const home = smooth(clamp((k - 0.75) / 0.25, 0, 1));
      this.camPos.copy(this.v1).lerp(this.rig.pos, home);
      this.camLook.copy(this.v3).lerp(this.rig.look, home);
    }
    if (sim.finished) {
      // Swing round to the front for the celebration.
      const k = clamp(sim.finishT / 1.4, 0, 1);
      const ease = k * k * (3 - 2 * k);
      this.v1.copy(f.p).addScaledVector(f.t, 6.5).addScaledVector(f.u, 2.4).addScaledVector(f.r, sim.x + 2.6);
      this.camPos.lerp(this.v1, ease);
      this.camLook.lerp(this.v2, ease);
    }
    if (this.shake > 0) {
      this.camPos.x += (Math.random() - 0.5) * this.shake;
      this.camPos.y += (Math.random() - 0.5) * this.shake;
    }
    this.camera.position.copy(this.camPos);
    this.camera.up.copy(this.camUp);
    this.camera.lookAt(this.camLook);
    this.world.sky.position.copy(this.camPos);
  }

  private animate(dt: number): void {
    const sim = this.sim;
    const { objects, lanes } = this.course;
    const world = this.world;
    this.shake = Math.max(0, this.shake - dt * 1.6);

    // Roll the bubble; Pip stays upright inside it.
    const racing = sim.countdown <= 0;
    if (racing) {
      this.pip.shell.quaternion.premultiply(this.q.setFromAxisAngle(this.axisX, (sim.v * dt) / BALL_RADIUS));
      this.pip.shell.quaternion.premultiply(this.q.setFromAxisAngle(this.axisZ, (sim.xv * dt) / BALL_RADIUS));
    }
    for (const racer of this.racers) {
      if (racer.flame) {
        // It smoulders on the grid and streams out with speed, flickering all the while.
        const burn = racer.sim.countdown > 0 ? 0.3 : 0.5 + clamp(racer.sim.v / MAX_SPEED, 0, 1) * 0.6;
        racer.flame.visible = !racer.sim.finished;
        waveFlame(racer.flame, sim.clock, burn);
      }
      if (racer.sim.countdown > 0) continue;
      racer.pip.shell.quaternion.premultiply(this.q.setFromAxisAngle(this.axisX, (racer.sim.v * racer.sim.gait * dt) / BALL_RADIUS));
      racer.pip.leaves.rotation.x = -clamp(racer.sim.v / MAX_SPEED, 0, 1) * 0.9;
      // The mean one burns as it goes.
      if (racer.rival.mean && !racer.sim.finished && racer.pip.root.visible && dt > 0) {
        this.sparks.burst(racer.sim.point(racer.sim.s - 1 - Math.random() * 0.8, racer.sim.x + (Math.random() - 0.5) * 0.9, 0.4 + Math.random() * 0.9, this.v1), 2, ['#ff5a2a', '#ffd23f', '#ff2a2a', '#ffffff'], 3);
      }
      // Knocked by something, it rocks about for a moment; otherwise it leans the way it is steering.
      racer.pip.body.rotation.z = racer.sim.rattled ? Math.sin(racer.sim.clock * 38) * 0.45 : clamp(racer.sim.xv * 0.06, -0.5, 0.5);
    }
    const pace = clamp(sim.v / MAX_SPEED, 0, 1);
    this.pip.leaves.rotation.x = -pace * 0.9 + Math.sin(sim.clock * 13) * 0.06;
    this.pip.body.rotation.z = clamp(sim.xv * 0.035, -0.5, 0.5);
    this.pip.body.position.y = sim.finished ? Math.abs(Math.sin(sim.clock * 7)) * 0.18 - 0.05 : Math.sin(sim.clock * 15) * 0.025 * pace - 0.05;

    // The view widens with speed, and stretches right out under turbo.
    const target = 62 + clamp((sim.v - CRUISE) / 26, 0, 1) * 16 + clamp((sim.v - MAX_SPEED) / 30, 0, 1) * 16;
    this.fov += (target - this.fov) * Math.min(1, dt * 4);
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    world.padMap.offset.y -= dt * 1.8;

    const moved = { slider: false, spinner: false, pendulum: false };
    objects.forEach((o, i) => {
      const track = lanes[o.lane].track;
      const slot = world.instance[i];
      if (o.kind === 'slider') {
        world.sliders.setMatrixAt(slot, standing(track, o.s, sim.swingX(o), 1.2, 1, this.m));
        moved.slider = true;
      } else if (o.kind === 'spinner') {
        standing(track, o.s, o.x, 0.95, 1, this.m);
        this.m.multiply(this.m2.makeRotationY(sim.spinAngle(o))).scale(this.v3.set((o.len ?? 3.2) / 3.2, 1, 1));
        world.spinners.setMatrixAt(slot, this.m);
        moved.spinner = true;
      } else if (o.kind === 'windmill') {
        const sails = world.windmills.get(i)!;
        sails.matrix.copy(standing(track, o.s, 0, PIVOT + 0.4, 1, this.m)).multiply(this.m2.makeRotationZ(sim.spinAngle(o)));
        sails.matrixWorldNeedsUpdate = true;
      } else if (o.kind === 'pendulum') {
        // The ball swings on a rod from the top of its arch, lifting a little at each end of the swing.
        const px = sim.swingX(o);
        const arm = PIVOT - 1.2;
        const py = PIVOT - Math.sqrt(Math.max(1, arm * arm - px * px));
        world.balls.setMatrixAt(slot, standing(track, o.s, px, py, 1, this.m));
        const f = track.at(o.s, this.f);
        this.v1.copy(f.p).addScaledVector(f.u, PIVOT);
        this.v2.copy(f.p).addScaledVector(f.r, px).addScaledVector(f.u, py);
        const length = this.v3.subVectors(this.v2, this.v1).length();
        this.v3.divideScalar(length);
        this.camUp.crossVectors(this.v3, f.t).normalize();
        this.m.makeBasis(this.camUp, this.v3.multiplyScalar(length), f.t).setPosition(this.v1.add(this.v2).multiplyScalar(0.5));
        world.rods.setMatrixAt(slot, this.m);
        moved.pendulum = true;
      } else if (o.kind === 'pickup') {
        // In a race a fruit somebody has taken is back a moment later.
        const visual = world.pickups.get(i)!;
        visual.sprite.visible = visual.glow.visible = sim.fresh(i);
        if (!visual.sprite.visible) return;
        const bob = Math.sin(sim.clock * 3 + i) * 0.22;
        visual.sprite.position.copy(visual.base).addScaledVector(visual.up, bob);
        visual.glow.position.copy(visual.sprite.position);
        visual.glow.scale.setScalar(3.4 + Math.sin(sim.clock * 5 + i) * 0.4);
      }
    });
    if (moved.slider) world.sliders.instanceMatrix.needsUpdate = true;
    if (moved.spinner) world.spinners.instanceMatrix.needsUpdate = true;
    if (moved.pendulum) world.balls.instanceMatrix.needsUpdate = world.rods.instanceMatrix.needsUpdate = true;

    if (this.flying.length) {
      for (const item of this.flying) {
        item.life -= dt;
        item.vel.y -= 22 * dt;
        item.pos.addScaledVector(item.vel, dt);
        item.angle += dt * 9;
        const scale = clamp(item.life * 2, 0, 1);
        this.m.makeRotationAxis(item.spin, item.angle).scale(this.v3.set(scale, scale, scale)).setPosition(item.pos);
        item.mesh.setMatrixAt(item.index, this.m);
        item.mesh.instanceMatrix.needsUpdate = true;
      }
      for (let i = this.flying.length - 1; i >= 0; i--) if (this.flying[i].life <= 0) this.flying.splice(i, 1);
    }

    if ((sim.boostT > 0 || sim.turboT > 0) && racing) {
      const hot = sim.turboT > 0;
      this.sparks.burst(sim.point(sim.s - 0.6, sim.x + (Math.random() - 0.5) * 0.8, 0.5, this.v1), hot ? 3 : 1, hot ? ['#ff5a2a', '#ffd23f'] : ['#eaff3d', '#ffffff'], 2);
    }
    this.sparks.update(dt);
    this.settle(dt);
    this.weather?.update(dt, sim.clock, this.camPos);
  }

  /** Render a single frame without advancing time. */
  renderOnce(): void {
    this.animate(0);
    this.renderer.render(this.world.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onPointer);
    this.canvas.removeEventListener('pointermove', this.onPointer);
    this.canvas.removeEventListener('pointerup', this.onRelease);
    this.canvas.removeEventListener('pointercancel', this.onRelease);
    this.canvas.removeEventListener('pointerleave', this.onRelease);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.dropInput);
    window.removeEventListener('resize', this.resize);
    this.world.dispose();
  }
}
