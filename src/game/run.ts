import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { sfx } from '../audio';
import { starsForTime } from '../core/progress';
import type { Level } from '../data/levels';
import { BALL_RADIUS, buildPip, type Pip } from './character';
import type { Course, CourseObj } from './course';
import { blobTexture } from './textures';
import { makeFrame } from './track';
import { buildWorld, lying, standing, type World } from './world';

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
}

export interface RunHooks {
  hud(state: HudState): void;
  pickup(id: string): void;
  finish(time: number, bonuses: string[]): void;
}

export type Autopilot = 'none' | 'centre' | 'smart';

const CRUISE = 26;
const MIN_SPEED = 12;
const MAX_SPEED = 56;
const GRAVITY = 11;
const COUNTDOWN = 3;
const START_S = 12;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Flying {
  index: number;
  pos: Vector3;
  vel: Vector3;
  spin: Vector3;
  angle: number;
  life: number;
}

/** A small pool of glowing dots for sparkles, splinters and confetti. */
class Sparks {
  readonly points: Points;
  private readonly max = 220;
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

/** One attempt at a course: owns the scene, the ball, the rules and the frame loop. */
export class Run {
  readonly world: World;
  private readonly camera = new PerspectiveCamera(62, 1, 0.3, 2600);
  private readonly pip: Pip;
  private readonly shadow: Mesh;
  private readonly sparks = new Sparks();
  private readonly canvas: HTMLCanvasElement;

  s = START_S;
  x = 0;
  v = 0;
  time = 0;
  finished = false;
  private xv = 0;
  private h = 0;
  private vh = 0;
  private clock = 0;
  private countdown = COUNTDOWN;
  private lastTick = COUNTDOWN + 1;
  private finishT = 0;
  private reported = false;
  private boostT = 0;
  private shake = 0;
  private fov = 62;
  private scrapeT = 0;
  private readonly bonuses: string[] = [];
  private readonly pickupIds: string[];
  private readonly done: boolean[];
  private readonly cooldown: number[];
  private readonly flying: Flying[] = [];

  private pointerSteer: number | null = null;
  private keySteer = 0;
  autopilot: Autopilot = 'none';

  private raf = 0;
  private last = 0;
  private paused = false;
  private hudT = 0;
  private disposed = false;

  private readonly f = makeFrame();
  private readonly fc = makeFrame();
  private readonly fl = makeFrame();
  private readonly v1 = new Vector3();
  private readonly v2 = new Vector3();
  private readonly v3 = new Vector3();
  private readonly camPos = new Vector3();
  private readonly camLook = new Vector3();
  private readonly camUp = new Vector3(0, 1, 0);
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly axisX = new Vector3(1, 0, 0);
  private readonly axisZ = new Vector3(0, 0, 1);

  constructor(
    private readonly renderer: WebGLRenderer,
    readonly course: Course,
    readonly level: Level,
    private readonly hooks: RunHooks,
  ) {
    this.canvas = renderer.domElement;
    const pickupCount = course.objects.filter((o) => o.kind === 'pickup').length;
    this.pickupIds = Array.from({ length: pickupCount }, () => level.bonusPool[Math.floor(Math.random() * level.bonusPool.length)]);
    this.world = buildWorld(course, this.pickupIds);
    this.done = course.objects.map(() => false);
    this.cooldown = course.objects.map(() => 0);

    this.pip = buildPip();
    this.pip.root.matrixAutoUpdate = false;
    this.world.scene.add(this.pip.root);

    this.shadow = new Mesh(
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
    this.shadow.matrixAutoUpdate = false;
    this.world.scene.add(this.shadow, this.sparks.points);

    this.canvas.addEventListener('pointerdown', this.onPointer);
    this.canvas.addEventListener('pointermove', this.onPointer);
    this.canvas.addEventListener('pointerup', this.onRelease);
    this.canvas.addEventListener('pointercancel', this.onRelease);
    this.canvas.addEventListener('pointerleave', this.onRelease);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.place();
  }

  // ---- input ----

  private readonly onPointer = (e: PointerEvent) => {
    if (e.type === 'pointermove' && e.pointerType === 'mouse' && e.buttons === 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const across = (e.clientX - rect.left) / rect.width - 0.5;
    this.pointerSteer = clamp(across * 2 * this.course.track.half * 1.35, -this.limit, this.limit);
    e.preventDefault();
  };

  private readonly onRelease = () => {
    this.pointerSteer = null;
  };

  private readonly onKey = (e: KeyboardEvent) => {
    const dir = e.key === 'ArrowLeft' || e.key === 'a' ? -1 : e.key === 'ArrowRight' || e.key === 'd' ? 1 : 0;
    if (!dir) return;
    if (e.type === 'keydown') this.keySteer = dir;
    else if (this.keySteer === dir) this.keySteer = 0;
  };

  private readonly resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private get limit(): number {
    return this.course.track.half - BALL_RADIUS;
  }

  // ---- loop ----

  start(): void {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  setPaused(value: boolean): void {
    this.paused = value;
    this.last = performance.now();
  }

  /** Jump straight to racing: used by the test autopilot. */
  skipCountdown(): void {
    this.countdown = 0;
  }

  private readonly frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.paused) return;
    this.step(dt / 2);
    this.step(dt / 2);
    this.animate(dt);
    this.renderer.render(this.world.scene, this.camera);
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.08;
      this.hooks.hud(this.hud());
    }
  };

  hud(): HudState {
    return {
      time: this.time,
      stars: starsForTime(this.level, this.time),
      speed: clamp((this.v - MIN_SPEED) / (MAX_SPEED - MIN_SPEED), 0, 1),
      progress: clamp((this.s - START_S) / (this.course.finishS - START_S), 0, 1),
      bonuses: this.bonuses.length,
      countdown: this.countdown > 0 ? this.countdown : null,
      boosting: this.boostT > 0,
    };
  }

  // ---- rules ----

  private steerTarget(): number | null {
    if (this.autopilot !== 'none') return this.autopilot === 'centre' ? 0 : this.smartLine();
    if (this.pointerSteer !== null) return this.pointerSteer;
    if (this.keySteer) return clamp(this.x + this.keySteer * 3, -this.limit, this.limit);
    return null;
  }

  private sliderX(o: CourseObj): number {
    return o.x + (o.amp ?? 0) * Math.sin(this.clock * (o.speed ?? 1) + (o.phase ?? 0));
  }

  /** A sensible racing line, used to calibrate star times: chase goodies, dodge blockers, hug the inside. */
  private smartLine(): number {
    const hazards: { s: number; x: number }[] = [];
    const wants: number[] = [];
    this.course.objects.forEach((o, i) => {
      const ahead = o.s - this.s;
      if (ahead < 0.5 || ahead > 36 || this.done[i]) return;
      if (o.kind === 'crate') hazards.push({ s: ahead, x: o.x });
      else if (o.kind === 'slider') hazards.push({ s: ahead, x: this.sliderX(o) });
      else if (ahead < 26) wants.push(o.x);
    });
    this.course.track.at(this.s + 8, this.fl);
    wants.push(clamp(this.fl.k * 160, -3.4, 3.4), this.x);
    const safe = (x: number) => hazards.every((h) => h.s > 20 || Math.abs(h.x - x) > 2.3);
    const pick = wants.find(safe);
    if (pick !== undefined) return pick;
    return [-3.6, -1.8, 0, 1.8, 3.6].sort(
      (a, b) => Math.min(...hazards.map((h) => Math.abs(h.x - b))) - Math.min(...hazards.map((h) => Math.abs(h.x - a))),
    )[0];
  }

  /** Advance the game by `dt` seconds. Rendering is separate so this can be driven headlessly. */
  step(dt: number): void {
    const { track, objects, finishS } = this.course;
    this.clock += dt;

    if (this.countdown > 0) {
      this.countdown -= dt;
      const shown = Math.ceil(this.countdown);
      if (shown < this.lastTick) {
        this.lastTick = shown;
        if (shown > 0) sfx.tick();
        else sfx.go();
      }
      if (this.countdown > 0) return;
      this.v = CRUISE * 0.6;
    }

    const f = track.at(this.s, this.f);

    // Steering: the ball chases the finger; let go and it holds its line.
    const target = this.finished ? null : this.steerTarget();
    if (target !== null) this.xv = clamp((target - this.x) * 9, -16, 16);
    else this.xv *= Math.exp(-8 * dt);
    this.x += this.xv * dt;
    if (Math.abs(this.x) > this.limit) {
      this.x = Math.sign(this.x) * this.limit;
      if (target !== null && Math.abs(target) >= this.limit - 0.05 && this.v > CRUISE * 0.75) {
        this.v -= 7 * dt;
        this.scrapeT -= dt;
        if (this.scrapeT <= 0) {
          this.scrapeT = 0.06;
          this.sparks.burst(track.point(this.s, this.x + Math.sign(this.x) * 0.7, 0.4, this.v1), 2, ['#fff2a8', '#ffb347'], 3);
        }
      }
    }

    // Speed: always rolling, quicker downhill, and boosts fade slowly so chaining them pays off.
    if (this.finished) {
      this.v -= this.v * 1.7 * dt;
    } else {
      if (this.v < CRUISE) this.v += 10 * dt;
      else this.v -= (this.v - CRUISE) * 0.24 * dt;
      this.v -= GRAVITY * f.t.y * dt;
      this.v = clamp(this.v, MIN_SPEED, MAX_SPEED);
      this.time += dt;
    }
    this.boostT -= dt;

    // The inside of a bend is a shorter path, so taking the right line is genuinely faster.
    const before = this.s;
    this.s = Math.min(track.length - 2, this.s + (this.v * dt) / clamp(1 - f.k * this.x, 0.6, 1.5));

    if (this.h > 0 || this.vh > 0) {
      this.vh -= 26 * dt;
      this.h += this.vh * dt;
      if (this.h <= 0) {
        this.h = 0;
        this.vh = 0;
        sfx.land();
        this.sparks.burst(track.point(this.s, this.x, 0.2, this.v1), 8, ['#ffffff', '#ffe9a8'], 4);
      }
    }

    if (!this.finished) {
      for (let i = 0; i < objects.length; i++) {
        const o = objects[i];
        const ds = o.s - this.s;
        if (ds > 4) break;
        if (ds < -4 || this.done[i]) continue;
        this.touch(o, i, before);
      }
      if (this.s >= finishS) {
        this.finished = true;
        sfx.finish();
        const at = track.point(this.s, this.x, 2, this.v1);
        this.sparks.burst(at, 90, ['#ff4d6d', '#ffd23f', '#4cd964', '#4aa3ff', '#ffffff'], 14, this.v2.copy(f.t).multiplyScalar(this.v * 0.5));
      }
    } else {
      this.finishT += dt;
      if (this.finishT > 1.8 && !this.reported) {
        this.reported = true;
        this.hooks.finish(this.time, this.bonuses);
      }
    }
  }

  private touch(o: CourseObj, i: number, before: number): void {
    const { track } = this.course;
    const ds = o.s - this.s;
    const crossed = before < o.s && this.s >= o.s;
    const dx = Math.abs(this.x - o.x);
    this.cooldown[i] -= 1;
    switch (o.kind) {
      case 'pad':
        if (Math.abs(ds) < 3 && dx < 1.9 && this.h < 0.6 && this.cooldown[i] <= 0) {
          this.cooldown[i] = 600;
          this.v = Math.min(MAX_SPEED, Math.max(this.v, CRUISE) + 13);
          this.boostT = 1.1;
          sfx.boost();
          this.sparks.burst(track.point(this.s, this.x, 0.5, this.v1), 12, ['#eaff3d', '#7dffb0'], 5);
        }
        break;
      case 'crate':
        if (Math.abs(ds) < 1.4 && dx < 1.15 + BALL_RADIUS * 0.9 && this.h < 1.7) {
          this.done[i] = true;
          this.v = Math.max(MIN_SPEED, this.v * 0.5);
          this.shake = 0.5;
          sfx.hit();
          const f = this.f;
          const pos = track.point(o.s, o.x, 1.05, new Vector3());
          const vel = f.t.clone().multiplyScalar(this.v * 0.9).addScaledVector(f.u, 9).addScaledVector(f.r, (o.x - this.x) * 5);
          this.flying.push({ index: this.world.instance[i], pos, vel, spin: new Vector3(Math.random(), Math.random(), Math.random()).normalize(), angle: 0, life: 1.6 });
          this.sparks.burst(pos, 16, ['#d89a4e', '#8a531f', '#fff2a8'], 7);
        }
        break;
      case 'slider': {
        const sx = this.sliderX(o);
        if (Math.abs(ds) < 1.2 && Math.abs(this.x - sx) < 1.0 + BALL_RADIUS * 0.9 && this.h < 2 && this.cooldown[i] <= 0) {
          this.cooldown[i] = 240;
          this.v = Math.max(MIN_SPEED, this.v * 0.55);
          this.xv = Math.sign(this.x - sx || 1) * 10;
          this.shake = 0.4;
          sfx.hit();
          this.sparks.burst(track.point(this.s, this.x, 0.8, this.v1), 12, ['#ff4fa3', '#ffffff'], 6);
        }
        break;
      }
      case 'ring':
        if (crossed && dx < 1.75 && this.h < 2.6) {
          this.done[i] = true;
          this.v = Math.min(MAX_SPEED, this.v + 6);
          this.boostT = 0.5;
          sfx.ring();
          this.world.rings.setMatrixAt(this.world.instance[i], this.m.makeScale(0, 0, 0));
          this.world.rings.instanceMatrix.needsUpdate = true;
          this.sparks.burst(track.point(o.s, o.x, 2, this.v1), 18, ['#ffd23f', '#fff6c2'], 7);
        }
        break;
      case 'jump':
        if (crossed && dx < 2.3 && this.h === 0) {
          this.vh = 11.5;
          this.h = 0.01;
          this.v = Math.min(MAX_SPEED, this.v + 3);
          sfx.jump();
        }
        break;
      case 'pickup':
        if (Math.abs(ds) < 1.5 && dx < 1.6 && Math.abs(this.h + BALL_RADIUS - (o.y ?? 1.3)) < 1.9) {
          this.done[i] = true;
          const visual = this.world.pickups.get(i)!;
          visual.sprite.visible = false;
          visual.glow.visible = false;
          const id = this.pickupIds[this.course.objects.slice(0, i).filter((p) => p.kind === 'pickup').length];
          this.bonuses.push(id);
          sfx.pickup();
          this.hooks.pickup(id);
          this.sparks.burst(visual.base, 14, ['#ffffff', '#ffe066', '#ff9ecb'], 6);
        }
        break;
    }
  }

  // ---- presentation ----

  /** Put the ball, shadow and camera where the rules say they are. */
  private place(): void {
    const { track } = this.course;
    const f = track.at(this.s, this.f);
    this.v1.copy(f.r).negate();
    this.v2.copy(f.p).addScaledVector(f.r, this.x).addScaledVector(f.u, BALL_RADIUS + this.h);
    this.pip.root.matrix.makeBasis(this.v1, f.u, f.t).setPosition(this.v2);
    this.pip.root.matrixWorldNeedsUpdate = true;

    const shrink = 1 / (1 + this.h * 0.45);
    this.shadow.matrix.copy(lying(track, this.s, this.x, 0.06)).scale(this.v3.set(shrink, shrink, 1));
    this.shadow.matrixWorldNeedsUpdate = true;

    // Chase camera, riding the track a little way behind so it loops and corkscrews with the ball.
    const back = 8.2 + clamp((this.v - CRUISE) * 0.07, 0, 2.4);
    const fc = track.at(Math.max(0, this.s - back), this.fc);
    this.camPos.copy(fc.p).addScaledVector(fc.u, 4 + this.h * 0.45).addScaledVector(fc.r, this.x * 0.55);
    const fl = track.at(this.s + 7, this.fl);
    this.camLook.copy(fl.p).addScaledVector(fl.r, this.x * 0.75).addScaledVector(fl.u, 1 + this.h * 0.3);
    this.camUp.copy(fc.u).add(f.u).normalize();

    if (this.finished) {
      // Swing round to the front for the celebration.
      const k = clamp(this.finishT / 1.4, 0, 1);
      const ease = k * k * (3 - 2 * k);
      this.v1.copy(f.p).addScaledVector(f.t, 6.5).addScaledVector(f.u, 2.4).addScaledVector(f.r, this.x + 2.6);
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
    const { track, objects } = this.course;
    const world = this.world;
    this.shake = Math.max(0, this.shake - dt * 1.6);

    // Roll the bubble; Pip stays upright inside it.
    const racing = this.countdown <= 0;
    if (racing) {
      this.pip.shell.quaternion.premultiply(this.q.setFromAxisAngle(this.axisX, (this.v * dt) / BALL_RADIUS));
      this.pip.shell.quaternion.premultiply(this.q.setFromAxisAngle(this.axisZ, (this.xv * dt) / BALL_RADIUS));
    }
    const pace = clamp(this.v / MAX_SPEED, 0, 1);
    this.pip.leaves.rotation.x = -pace * 0.9 + Math.sin(this.clock * 13) * 0.06;
    this.pip.body.rotation.z = clamp(this.xv * 0.035, -0.5, 0.5);
    this.pip.body.position.y = this.finished ? Math.abs(Math.sin(this.clock * 7)) * 0.18 - 0.05 : Math.sin(this.clock * 15) * 0.025 * pace - 0.05;

    const target = 62 + clamp((this.v - CRUISE) / 26, 0, 1) * 16;
    this.fov += (target - this.fov) * Math.min(1, dt * 4);
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    world.padMap.offset.y -= dt * 1.8;

    let slidersMoved = false;
    objects.forEach((o, i) => {
      if (o.kind === 'slider') {
        world.sliders.setMatrixAt(world.instance[i], standing(track, o.s, this.sliderX(o), 1.2, 1, this.m));
        slidersMoved = true;
      } else if (o.kind === 'pickup' && !this.done[i]) {
        const visual = world.pickups.get(i)!;
        const bob = Math.sin(this.clock * 3 + i) * 0.22;
        visual.sprite.position.copy(visual.base).addScaledVector(visual.up, bob);
        visual.glow.position.copy(visual.sprite.position);
        visual.glow.scale.setScalar(3.4 + Math.sin(this.clock * 5 + i) * 0.4);
      }
    });
    if (slidersMoved) world.sliders.instanceMatrix.needsUpdate = true;

    if (this.flying.length) {
      for (const crate of this.flying) {
        crate.life -= dt;
        crate.vel.y -= 22 * dt;
        crate.pos.addScaledVector(crate.vel, dt);
        crate.angle += dt * 9;
        const scale = clamp(crate.life * 2, 0, 1);
        this.m.makeRotationAxis(crate.spin, crate.angle).scale(this.v3.set(scale, scale, scale)).setPosition(crate.pos);
        world.crates.setMatrixAt(crate.index, this.m);
      }
      world.crates.instanceMatrix.needsUpdate = true;
      for (let i = this.flying.length - 1; i >= 0; i--) if (this.flying[i].life <= 0) this.flying.splice(i, 1);
    }

    if (this.boostT > 0 && racing) {
      this.sparks.burst(track.point(this.s - 0.6, this.x + (Math.random() - 0.5) * 0.8, 0.5, this.v1), 1, ['#eaff3d', '#ffffff'], 2);
    }
    this.sparks.update(dt);
    this.place();
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
    window.removeEventListener('resize', this.resize);
    this.world.dispose();
  }
}
