import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  Vector3,
  type InstancedMesh,
  type WebGLRenderer,
} from 'three';
import { sfx } from '../audio';
import { starsForTime } from '../core/progress';
import type { Level } from '../data/levels';
import { buildPip, type Pip } from './character';
import type { Course } from './course';
import { BALL_RADIUS, CRUISE, MAX_SPEED, MIN_SPEED, PUSH, Sim, TICK, type SimEvent } from './sim';
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
}

export interface RunHooks {
  hud(state: HudState): void;
  pickup(id: string): void;
  /** The line has been crossed: bank the result now. */
  finish(time: number, bonuses: string[]): void;
  /** The celebration has played: show the results. */
  results(): void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Flying {
  mesh: InstancedMesh;
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

/** Rain streaks or snowflakes in a box that travels with the camera. */
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
    for (let i = 0; i < this.count; i++) this.at.set([(Math.random() - 0.5) * 70, Math.random() * 44 - 14, (Math.random() - 0.5) * 70], i * 3);
    const geometry = new BufferGeometry();
    if (this.snow) {
      geometry.setAttribute('position', new Float32BufferAttribute(this.at, 3));
      this.object = new Points(geometry, new PointsMaterial({ color: '#ffffff', size: 0.45, map: blobTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false }));
    } else {
      geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(this.count * 6), 3));
      this.object = new LineSegments(geometry, new LineBasicMaterial({ color: '#d6ecff', transparent: true, opacity: 0.5, depthWrite: false }));
    }
    this.object.frustumCulled = false;
  }

  update(dt: number, clock: number, camera: Vector3): void {
    const position = this.object.geometry.attributes.position;
    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      this.at[o + 1] -= this.fall * dt;
      if (this.at[o + 1] < -14) this.at[o + 1] += 44;
      if (this.snow) {
        this.at[o] += Math.sin(clock * 1.3 + i) * dt * 1.4;
      } else {
        // Each streak is a short line slanting with the wind.
        position.setXYZ(i * 2, this.at[o], this.at[o + 1], this.at[o + 2]);
        position.setXYZ(i * 2 + 1, this.at[o] + 0.25, this.at[o + 1] - 1.7, this.at[o + 2]);
      }
    }
    position.needsUpdate = true;
    this.object.position.copy(camera);
  }
}

/** One attempt at a course: the rules live in Sim; this draws them, plays the sounds and reads the controls. */
export class Run {
  readonly sim: Sim;
  readonly world: World;
  private readonly camera = new PerspectiveCamera(62, 1, 0.3, 3200);
  private readonly pip: Pip;
  private readonly shadow: Mesh;
  private readonly sparks = new Sparks();
  private readonly canvas: HTMLCanvasElement;
  private readonly flying: Flying[] = [];
  private readonly weather: Weather | null;

  private pointerSteer: number | null = null;
  private pointerId: number | null = null;
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
  private readonly fc = makeFrame();
  private readonly fl = makeFrame();
  private readonly v1 = new Vector3();
  private readonly v2 = new Vector3();
  private readonly v3 = new Vector3();
  private readonly camPos = new Vector3();
  private readonly camLook = new Vector3();
  private readonly camUp = new Vector3(0, 1, 0);
  private readonly m = new Matrix4();
  private readonly m2 = new Matrix4();
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
    this.sim = new Sim(course, level, (event) => this.react(event));
    this.world = buildWorld(course, this.sim.items);

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
    this.place();
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
    const across = (e.clientX - rect.left) / rect.width - 0.5;
    const reach = this.sim.limit + PUSH;
    this.pointerSteer = clamp(across * 2 * (this.sim.limit + BALL_RADIUS) * 1.35, -reach, reach);
    e.preventDefault();
  };

  private readonly onRelease = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.pointerSteer = null;
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
    this.pointerSteer = null;
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
    if (this.pointerSteer !== null) return this.pointerSteer;
    const reach = this.sim.limit + PUSH;
    if (this.keySteer) return clamp(this.sim.x + this.keySteer * 3, -reach, reach);
    return null;
  }

  // ---- loop ----

  start(): void {
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
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.paused) return;
    // Fixed steps, however long the frame took: the same line earns the same time on any device.
    this.sim.steer = this.steer();
    this.owed += dt;
    while (this.owed >= TICK) {
      this.sim.step(TICK);
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
    };
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

  private fling(mesh: InstancedMesh, index: number, height: number, lift: number): void {
    const sim = this.sim;
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
        this.fling(this.world.crates, event.index, 1.05, 9);
        this.sparks.burst(this.objectAt(event.index, 1, this.v1), 16, ['#d89a4e', '#8a531f', '#fff2a8'], 7);
        break;
      case 'pin':
        sfx.pin();
        this.fling(this.world.pins, event.index, 0.75, 11);
        break;
      case 'bump':
        this.shake = 0.4;
        sfx.hit();
        this.sparks.burst(this.ballAt(0.8, this.v1), 12, ['#ff4fa3', '#ffffff'], 6);
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
        visual.sprite.visible = false;
        visual.glow.visible = false;
        sfx.pickup();
        this.hooks.pickup(event.id);
        this.sparks.burst(visual.base, 14, ['#ffffff', '#ffe066', '#ff9ecb'], 6);
        break;
      }
      case 'finish': {
        this.hooks.finish(sim.time, sim.bonuses);
        sfx.finish();
        const f = sim.frameAt(sim.s, this.f);
        this.sparks.burst(this.ballAt(2, this.v1), 90, ['#ff4d6d', '#ffd23f', '#4cd964', '#4aa3ff', '#ffffff'], 14, this.v2.copy(f.t).multiplyScalar(sim.v * 0.5));
        break;
      }
      case 'results':
        this.hooks.results();
        break;
    }
  }

  // ---- presentation ----

  /** Put the ball, shadow and camera where the rules say they are. */
  private place(): void {
    const sim = this.sim;
    const f = sim.frameAt(sim.s, this.f);
    this.v1.copy(f.r).negate();
    this.v2.copy(f.p).addScaledVector(f.r, sim.x).addScaledVector(f.u, BALL_RADIUS + sim.h);
    this.pip.root.matrix.makeBasis(this.v1, f.u, f.t).setPosition(this.v2);
    this.pip.root.matrixWorldNeedsUpdate = true;

    const shrink = 1 / (1 + sim.h * 0.45);
    this.v3.copy(f.p).addScaledVector(f.r, sim.x).addScaledVector(f.u, 0.06);
    this.shadow.matrix.makeBasis(f.r, f.t, f.u).scale(this.camUp.set(shrink, shrink, 1)).setPosition(this.v3);
    this.shadow.matrixWorldNeedsUpdate = true;
    // Nothing to cast a shadow on where the road has been taken away.
    this.shadow.visible = !sim.overGap();

    // Chase camera, riding the track a little way behind so it loops, twists and corkscrews with the ball.
    const back = 8.2 + clamp((sim.v - CRUISE) * 0.07, 0, 4.2);
    const fc = sim.frameAt(sim.s - back, this.fc);
    this.camPos.copy(fc.p).addScaledVector(fc.u, 4 + sim.h * 0.8).addScaledVector(fc.r, sim.x * 0.55);
    const fl = sim.frameAt(sim.s + 7, this.fl);
    this.camLook.copy(fl.p).addScaledVector(fl.r, sim.x * 0.75).addScaledVector(fl.u, 1 + sim.h * 0.65);
    this.camUp.copy(fc.u).add(f.u).normalize();

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
      } else if (o.kind === 'pickup' && !sim.done[i]) {
        const visual = world.pickups.get(i)!;
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

    if (sim.boostT > 0 && racing) {
      const hot = sim.turboT > 0;
      this.sparks.burst(sim.point(sim.s - 0.6, sim.x + (Math.random() - 0.5) * 0.8, 0.5, this.v1), hot ? 3 : 1, hot ? ['#ff5a2a', '#ffd23f'] : ['#eaff3d', '#ffffff'], 2);
    }
    this.sparks.update(dt);
    this.place();
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
