import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  Vector3,
  type Material,
  type Texture,
} from 'three';
import { ingredient } from '../data/ingredients';
import type { Course, CourseObj, Lane } from './course';
import { seeded } from './random';
import {
  bannerTexture,
  blobTexture,
  bumperTexture,
  checkerTexture,
  crateTexture,
  forkSignTexture,
  gooTexture,
  groundTexture,
  padTexture,
  roadTexture,
  skyTexture,
  stripeTexture,
} from './textures';
import type { Scenery, Theme } from './themes';
import { extrude, makeFrame, STEP, type Frame, type Track } from './track';

const loader = new TextureLoader();
const iconCache = new Map<string, Texture>();

/** Icon textures are shared between runs, so they are cached and never disposed. */
export function iconTexture(url: string): Texture {
  let texture = iconCache.get(url);
  if (!texture) {
    texture = loader.load(url);
    texture.colorSpace = SRGBColorSpace;
    iconCache.set(url, texture);
  }
  return texture;
}

export interface PickupVisual {
  sprite: Sprite;
  glow: Sprite;
  base: Vector3;
  up: Vector3;
}

/** Height of the arch a pendulum hangs from. */
export const PIVOT = 6.6;

export interface World {
  scene: Scene;
  sky: Mesh;
  padMap: Texture;
  crates: InstancedMesh;
  pins: InstancedMesh;
  sliders: InstancedMesh;
  spinners: InstancedMesh;
  balls: InstancedMesh;
  rods: InstancedMesh;
  rings: InstancedMesh;
  /** For each course object: its instance index within the mesh for its kind. */
  instance: number[];
  pickups: Map<number, PickupVisual>;
  groundY: number;
  dispose(): void;
}

const M = new Matrix4();
const X = new Vector3();
const Y = new Vector3();
const Z = new Vector3();
const P = new Vector3();
const F = makeFrame();

/** Matrix that stands an object on the road facing the oncoming player: x right, y up, z back towards them. */
export function standing(track: Track, s: number, x: number, y: number, scale = 1, out = M): Matrix4 {
  track.at(s, F);
  X.copy(F.r).multiplyScalar(scale);
  Y.copy(F.u).multiplyScalar(scale);
  Z.copy(F.t).multiplyScalar(-scale);
  P.copy(F.p).addScaledVector(F.r, x).addScaledVector(F.u, y);
  return out.makeBasis(X, Y, Z).setPosition(P);
}

/** Matrix that lays an object flat on the road: x right, y forward, z up. */
export function lying(track: Track, s: number, x: number, y: number, out = M): Matrix4 {
  track.at(s, F);
  P.copy(F.p).addScaledVector(F.r, x).addScaledVector(F.u, y);
  return out.makeBasis(F.r, F.t, F.u).setPosition(P);
}

function place(object: Object3D, matrix: Matrix4): void {
  object.matrixAutoUpdate = false;
  object.matrix.copy(matrix);
}

/** Track surfaces glow a little with their own colour so they stay readable upside down in a loop. */
function trackMaterial(map: Texture): MeshLambertMaterial {
  return new MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.5 });
}

function wedgeGeometry(width: number, length: number, height: number): BufferGeometry {
  const w = width / 2;
  const l = length / 2;
  // Local z points back at the player, so the ramp is low at +z and high at -z.
  const a = [-w, 0, l];
  const b = [w, 0, l];
  const c = [w, 0, -l];
  const d = [-w, 0, -l];
  const e = [w, height, -l];
  const f = [-w, height, -l];
  const tris = [a, b, e, a, e, f, b, c, e, a, f, d, d, f, e, d, e, c];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(tris.flat(), 3));
  const uv = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0];
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function gate(track: Track, s: number, text: string, color: string): Group {
  const group = new Group();
  const reach = track.half + 1.7;
  const poleMap = bumperTexture(color, '#ffffff');
  poleMap.repeat.set(2, 5);
  const pole = new CylinderGeometry(0.55, 0.65, 9, 12);
  const poleMaterial = new MeshLambertMaterial({ map: poleMap });
  for (const side of [-1, 1]) {
    const mesh = new Mesh(pole, poleMaterial);
    mesh.position.set(side * reach, 4, 0);
    group.add(mesh);
    const cap = new Mesh(new SphereGeometry(0.85, 12, 10), new MeshLambertMaterial({ color }));
    cap.position.set(side * reach, 8.7, 0);
    group.add(cap);
  }
  const plain = new MeshLambertMaterial({ color });
  const face = new MeshLambertMaterial({ map: bannerTexture(text, color) });
  const banner = new Mesh(new BoxGeometry(reach * 2 + 1, 2.7, 0.5), [plain, plain, plain, plain, face, face]);
  banner.position.set(0, 7.4, 0);
  group.add(banner);
  place(group, standing(track, s, 0, 0));
  return group;
}

/** Is this point on the road surface of `track` somewhere between two distances along it? */
function onRoad(q: Vector3, track: Track, s0: number, s1: number): boolean {
  const i0 = Math.max(0, Math.floor(s0 / STEP));
  const i1 = Math.min(track.frames.length - 1, Math.ceil(s1 / STEP));
  for (let i = i0; i <= i1; i += 2) {
    const f = track.frames[i];
    P.subVectors(q, f.p);
    if (Math.abs(P.dot(f.t)) < 1.3 && Math.abs(P.dot(f.r)) < track.half - 0.1 && Math.abs(P.dot(f.u)) < 1.5) return true;
  }
  return false;
}

/**
 * Stretches of a lane's kerb to actually build. Where a fork arm peels away the two roads overlap, and a kerb
 * there would be a wall across the other route, so it is left out until the roads have parted.
 */
function kerbRuns(lanes: Lane[], index: number, side: 1 | -1): [number, number][] {
  const track = lanes[index].track;
  const reach = 110;
  const near: { other: Track; mine: [number, number]; theirs: [number, number] }[] = [];
  lanes.forEach((lane, i) => {
    if (!lane.from) return;
    const { s0, s1 } = lane.from;
    const len = lane.track.length;
    if (index === 0) {
      near.push({ other: lane.track, mine: [s0 - 4, s0 + reach], theirs: [0, reach] });
      near.push({ other: lane.track, mine: [s1 - reach, s1 + 4], theirs: [len - reach, len] });
    } else if (i === index) {
      near.push({ other: lanes[0].track, mine: [0, reach], theirs: [s0 - 4, s0 + reach] });
      near.push({ other: lanes[0].track, mine: [len - reach, len], theirs: [s1 - reach, s1 + 4] });
    }
  });
  if (!near.length) return [[0, track.length]];

  const runs: [number, number][] = [];
  let open: number | null = null;
  const q = new Vector3();
  for (let i = 0; i < track.frames.length; i += 2) {
    const s = i * STEP;
    const f = track.frames[i];
    q.copy(f.p).addScaledVector(f.r, side * (track.half + 0.45));
    const covered = near.some((n) => s >= n.mine[0] && s <= n.mine[1] && onRoad(q, n.other, n.theirs[0], n.theirs[1]));
    if (!covered && open === null) open = s;
    if (covered && open !== null) {
      if (s - open > 2) runs.push([open, s]);
      open = null;
    }
  }
  if (open !== null) runs.push([open, track.length]);
  return runs;
}

interface TreeKind {
  trunk: BufferGeometry;
  trunkColor: string;
  /** Trunk centre as a fraction of tree height. */
  trunkLift: number;
  canopy: BufferGeometry;
  /** Canopy size relative to tree height: across, up. */
  spread: [number, number];
  /** Canopy centre as a fraction of tree height. */
  lift: number;
  dots: boolean;
  flat: boolean;
}

function treeKind(scenery: Scenery): TreeKind {
  const stick = new CylinderGeometry(0.07, 0.1, 0.42, 6);
  switch (scenery) {
    case 'pine':
      return { trunk: stick, trunkColor: '#7a5230', trunkLift: 0.2, canopy: new ConeGeometry(0.34, 0.85, 7), spread: [1, 1], lift: 0.62, dots: false, flat: true };
    case 'palm':
      return { trunk: new CylinderGeometry(0.035, 0.06, 0.8, 6), trunkColor: '#b08a52', trunkLift: 0.4, canopy: new IcosahedronGeometry(0.4, 1), spread: [1.5, 0.28], lift: 0.84, dots: true, flat: true };
    case 'mushroom':
      return { trunk: new CylinderGeometry(0.1, 0.14, 0.5, 8), trunkColor: '#fff3da', trunkLift: 0.24, canopy: new SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), spread: [1.2, 1], lift: 0.45, dots: true, flat: false };
    case 'cactus':
      return { trunk: new CylinderGeometry(0.11, 0.12, 0.8, 8), trunkColor: '#5fae4a', trunkLift: 0.4, canopy: new SphereGeometry(0.13, 8, 6), spread: [1, 1], lift: 0.82, dots: false, flat: false };
    case 'crystal':
      return { trunk: stick, trunkColor: '#6a6a8a', trunkLift: 0.2, canopy: new OctahedronGeometry(0.34), spread: [0.8, 1.6], lift: 0.6, dots: false, flat: true };
    default:
      return { trunk: stick, trunkColor: '#8a5a33', trunkLift: 0.2, canopy: new IcosahedronGeometry(0.4, 1), spread: [1.15, 1], lift: 0.66, dots: true, flat: true };
  }
}

function addScenery(scene: Scene, course: Course, groundY: number): void {
  const { theme } = course;
  const rand = seeded(1234);
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  const samples: Vector3[] = [];
  for (const lane of course.lanes) {
    lane.track.frames.forEach((f, i) => {
      min.min(f.p);
      max.max(f.p);
      if (i % 8 === 0) samples.push(f.p);
    });
  }
  const centre = new Vector3((min.x + max.x) / 2, groundY, (min.z + max.z) / 2);

  const ground = new Mesh(new CircleGeometry(1900, 48), new MeshLambertMaterial({ map: groundTexture(theme) }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.copy(centre);
  scene.add(ground);

  /** Lowest the track gets above this spot, or Infinity if it is not overhead. */
  const clearance = (x: number, z: number, reach: number) => {
    let lowest = Infinity;
    for (const p of samples) {
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < reach * reach) lowest = Math.min(lowest, p.y - groundY);
    }
    return lowest;
  };

  const kind = treeKind(theme.scenery);
  const treeCount = 340;
  const trunks = new InstancedMesh(kind.trunk, new MeshLambertMaterial({ color: kind.trunkColor }), treeCount);
  const canopies = new InstancedMesh(kind.canopy, new MeshLambertMaterial({ flatShading: kind.flat }), treeCount);
  const dotsPerTree = 5;
  const dots = new InstancedMesh(new SphereGeometry(0.035, 7, 5), new MeshLambertMaterial({ color: theme.fruit }), treeCount * dotsPerTree);
  const color = new Color();
  let placed = 0;
  for (let attempt = 0; attempt < treeCount * 6 && placed < treeCount; attempt++) {
    const x = min.x - 180 + rand() * (max.x - min.x + 360);
    const z = min.z - 180 + rand() * (max.z - min.z + 360);
    const height = 9 + rand() * 9;
    if (clearance(x, z, 13) < height + 7) continue;
    M.makeScale(height, height, height).setPosition(x, groundY + height * kind.trunkLift, z);
    trunks.setMatrixAt(placed, M);
    M.makeScale(height * kind.spread[0], height * kind.spread[1], height * kind.spread[0]).setPosition(x, groundY + height * kind.lift, z);
    canopies.setMatrixAt(placed, M);
    canopies.setColorAt(placed, color.set(theme.canopy[Math.floor(rand() * theme.canopy.length)]));
    for (let n = 0; n < dotsPerTree; n++) {
      const a = rand() * Math.PI * 2;
      const up = rand() * 0.22;
      const r = 0.36 * kind.spread[0] * (1 - up * 1.4);
      M.makeScale(height, height, height).setPosition(x + Math.cos(a) * r * height, groundY + height * (kind.lift - 0.04 + up), z + Math.sin(a) * r * height);
      dots.setMatrixAt(placed * dotsPerTree + n, M);
    }
    placed++;
  }
  trunks.count = canopies.count = placed;
  dots.count = kind.dots ? placed * dotsPerTree : 0;
  scene.add(trunks, canopies, dots);

  // Rolling hills around the edge.
  const hills = new InstancedMesh(new SphereGeometry(1, 16, 10), new MeshLambertMaterial({ color: theme.groundDark }), 16);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand() * 0.3;
    const reach = Math.max(max.x - min.x, max.z - min.z) / 2 + 260 + rand() * 200;
    const size = 100 + rand() * 120;
    M.makeScale(size, size * (0.3 + rand() * 0.25), size).setPosition(centre.x + Math.cos(a) * reach, groundY - 4, centre.z + Math.sin(a) * reach);
    hills.setMatrixAt(i, M);
  }
  scene.add(hills);

  // Puffy clouds.
  const puffs = 28;
  const clouds = new InstancedMesh(new SphereGeometry(1, 10, 8), new MeshBasicMaterial({ color: theme.cloud, fog: false }), puffs * 4);
  for (let i = 0; i < puffs; i++) {
    const x = min.x - 340 + rand() * (max.x - min.x + 680);
    const z = min.z - 340 + rand() * (max.z - min.z + 680);
    const y = max.y + 45 + rand() * 80;
    const size = 9 + rand() * 12;
    for (let n = 0; n < 4; n++) {
      const scale = size * (n === 0 ? 1 : 0.55 + rand() * 0.3);
      M.makeScale(scale * 1.3, scale * 0.75, scale).setPosition(x + (n - 1.5) * size * 0.9, y + (n % 2) * size * 0.2, z + (rand() - 0.5) * size);
      clouds.setMatrixAt(i * 4 + n, M);
    }
  }
  scene.add(clouds);

  // A few giant fruit as landmarks, and towers for the castle.
  const giant = new MeshLambertMaterial({ color: theme.fruit });
  const stalk = new MeshLambertMaterial({ color: '#6b4226' });
  const leaf = new MeshLambertMaterial({ color: '#3fae3a' });
  const stone = new MeshLambertMaterial({ color: '#d9c9e8' });
  const roof = new MeshLambertMaterial({ color: theme.kerbA });
  for (let i = 0; i < 12; i++) {
    const x = min.x - 70 + rand() * (max.x - min.x + 140);
    const z = min.z - 70 + rand() * (max.z - min.z + 140);
    const size = 7 + rand() * 6;
    const tower = theme.scenery === 'castle' && i % 2 === 0;
    if (clearance(x, z, size + 12) < size * (tower ? 6 : 2.6)) continue;
    const landmark = new Group();
    if (tower) {
      const shaft = new Mesh(new CylinderGeometry(size * 0.6, size * 0.7, size * 4, 12), stone);
      shaft.position.y = size * 2;
      const cap = new Mesh(new ConeGeometry(size * 0.85, size * 1.6, 12), roof);
      cap.position.y = size * 4.8;
      landmark.add(shaft, cap);
      landmark.position.set(x, groundY, z);
    } else {
      const flesh = new Mesh(new SphereGeometry(size, 20, 14), giant);
      flesh.scale.set(1, 0.9, 1);
      const stem = new Mesh(new CylinderGeometry(size * 0.06, size * 0.06, size * 0.5, 6), stalk);
      stem.position.y = size * 1.02;
      const blade = new Mesh(new SphereGeometry(size * 0.3, 10, 6), leaf);
      blade.scale.set(1, 0.18, 0.5);
      blade.position.set(size * 0.3, size * 1.15, 0);
      landmark.add(flesh, stem, blade);
      landmark.position.set(x, groundY + size * 0.82, z);
      landmark.rotation.y = rand() * 6;
    }
    scene.add(landmark);
  }
}

function addPillars(scene: Scene, course: Course, groundY: number): void {
  const track = course.track;
  const spots: Frame[] = [];
  const every = 72;
  const lower: Vector3[] = [];
  for (const lane of course.lanes) lane.track.frames.forEach((f, i) => i % 6 === 0 && lower.push(f.p));
  for (let i = every; i < track.frames.length - every; i += every) {
    const f = track.frames[i];
    const s = i * STEP;
    if (f.u.y < 0.93 || track.inSpan('loop', s) || track.inSpan('spiral', s) || track.inSpan('twist', s)) continue;
    // Skip a pillar that would stab through a lower piece of track.
    const blocked = lower.some((p) => p.y < f.p.y - 4 && Math.hypot(p.x - f.p.x, p.z - f.p.z) < 9);
    if (!blocked) spots.push(f);
  }
  const pillars = new InstancedMesh(new CylinderGeometry(0.9, 1.3, 1, 10), new MeshLambertMaterial({ color: '#f4ead8' }), Math.max(1, spots.length));
  pillars.count = spots.length;
  spots.forEach((f, i) => {
    const top = f.p.y - 1.3;
    M.makeScale(1, top - groundY, 1).setPosition(f.p.x, (top + groundY) / 2, f.p.z);
    pillars.setMatrixAt(i, M);
  });
  scene.add(pillars);
}

function addTrack(scene: Scene, course: Course, theme: Theme): void {
  const roadMaterial = trackMaterial(roadTexture(theme));
  const kerbMaterial = trackMaterial(stripeTexture(theme.kerbA, theme.kerbB));
  const underMaterial = new MeshLambertMaterial({ color: theme.under, emissive: theme.under, emissiveIntensity: 0.45 });
  course.lanes.forEach((lane, index) => {
    const track = lane.track;
    const half = track.half;
    // Fork arms sit a hair lower so they do not flicker where they overlap the main road.
    const dip = index === 0 ? 0 : -0.04;
    scene.add(new Mesh(extrude(track, [[-half, dip], [half, dip]], { vScale: 0.1 }), roadMaterial));
    scene.add(new Mesh(extrude(track, [[half + 0.9, -0.6 + dip], [half * 0.55, -1.5 + dip], [-half * 0.55, -1.5 + dip], [-half - 0.9, -0.6 + dip]], { stride: 2 }), underMaterial));
    for (const [s0, s1] of kerbRuns(course.lanes, index, -1)) {
      scene.add(new Mesh(extrude(track, [[-half - 0.9, -0.6], [-half - 0.9, 0.6], [-half, 0.6], [-half, 0]], { s0, s1, vScale: 0.25, stride: 2 }), kerbMaterial));
    }
    for (const [s0, s1] of kerbRuns(course.lanes, index, 1)) {
      scene.add(new Mesh(extrude(track, [[half, 0], [half, 0.6], [half + 0.9, 0.6], [half + 0.9, -0.6]], { s0, s1, vScale: 0.25, stride: 2 }), kerbMaterial));
    }
  });

  // A sign on the island where each fork parts.
  const signFace = new MeshBasicMaterial({ map: forkSignTexture() });
  const wood = new MeshLambertMaterial({ color: '#8a5a2b' });
  for (const lane of course.lanes) {
    if (!lane.from) continue;
    const at = 46;
    const a = course.track.at(lane.from.s0 + at, makeFrame());
    const b = lane.track.at(at, makeFrame());
    const sign = new Group();
    const board = new Mesh(new BoxGeometry(4.6, 2.3, 0.3), [wood, wood, wood, wood, signFace, wood]);
    board.position.y = 4.2;
    const pole = new Mesh(new CylinderGeometry(0.25, 0.25, 6, 8), wood);
    pole.position.y = 0.6;
    sign.add(board, pole);
    X.copy(a.r);
    Y.copy(a.u);
    Z.copy(a.t).negate();
    P.copy(a.p).add(b.p).multiplyScalar(0.5);
    place(sign, M.makeBasis(X, Y, Z).setPosition(P));
    scene.add(sign);
  }
}

/** Build everything you can see for a course. `items` gives the ingredient held by each pickup object. */
export function buildWorld(course: Course, items: (string | undefined)[]): World {
  const { track, theme, lanes } = course;
  const scene = new Scene();
  scene.fog = new Fog(theme.fog, 140, 620);

  scene.add(new HemisphereLight(0xffffff, 0xa8c98a, 1.2 * theme.light));
  const sun = new DirectionalLight(0xfff1d0, 1.5 * theme.light);
  sun.position.set(0.5, 1, 0.35);
  scene.add(sun);

  const sky = new Mesh(new SphereGeometry(1000, 24, 16), new MeshBasicMaterial({ map: skyTexture(theme), side: BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  scene.add(sky);

  let lowest = Infinity;
  for (const lane of lanes) for (const f of lane.track.frames) lowest = Math.min(lowest, f.p.y);
  const groundY = lowest - 22;

  addTrack(scene, course, theme);

  // Tunnels.
  const half = track.half;
  const arch: [number, number][] = [];
  const radius = half + 1.3;
  for (let i = 0; i <= 14; i++) {
    const a = Math.PI - (i / 14) * Math.PI;
    arch.push([Math.cos(a) * radius, Math.sin(a) * radius * 0.95 + 0.3]);
  }
  const tunnelMaterial = trackMaterial(stripeTexture(theme.tunnelA, theme.tunnelB));
  tunnelMaterial.side = DoubleSide;
  const portalGeometry = new TorusGeometry(radius + 0.3, 0.75, 8, 22, Math.PI);
  const portalMaterial = new MeshLambertMaterial({ color: '#ffffff' });
  for (const span of course.tunnels) {
    const on = lanes[span.lane].track;
    scene.add(new Mesh(extrude(on, arch, { s0: span.s0, s1: span.s1, vScale: 0.07, stride: 2, smooth: true }), tunnelMaterial));
    for (const s of [span.s0, span.s1]) {
      const portal = new Mesh(portalGeometry, portalMaterial);
      place(portal, standing(on, s, 0, 0.3));
      scene.add(portal);
    }
  }

  addPillars(scene, course, groundY);
  addScenery(scene, course, groundY);

  scene.add(gate(track, 44, 'GO!', '#2fb344'));
  scene.add(gate(track, course.finishS, 'FINISH', '#ff4d6d'));
  const line = new Mesh(new PlaneGeometry(half * 2, 3), new MeshBasicMaterial({ map: checkerTexture() }));
  place(line, lying(track, course.finishS, 0, 0.04));
  scene.add(line);

  // Course objects.
  const count = (kind: CourseObj['kind']) => Math.max(1, course.objects.filter((o) => o.kind === kind).length);
  const decal = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  const padMap = padTexture();
  const pads = new InstancedMesh(new PlaneGeometry(3.4, 6), new MeshBasicMaterial({ map: padMap, ...decal }), count('pad'));
  const goo = new InstancedMesh(new PlaneGeometry(3.7, 8), new MeshBasicMaterial({ map: gooTexture(theme.goo), ...decal }), count('goo'));
  const crates = new InstancedMesh(new BoxGeometry(2.3, 2.1, 2.1), new MeshLambertMaterial({ map: crateTexture() }), count('crate'));
  const pinMap = bumperTexture('#ff3d3d', '#ffffff');
  pinMap.repeat.set(1, 0.6);
  const pins = new InstancedMesh(new CylinderGeometry(0.2, 0.32, 1.5, 10), new MeshLambertMaterial({ map: pinMap }), count('pin'));
  const sliderMap = bumperTexture();
  sliderMap.repeat.set(3, 1.5);
  const sliders = new InstancedMesh(new CylinderGeometry(0.95, 1.15, 2.4, 16), new MeshLambertMaterial({ map: sliderMap }), count('slider'));
  const barMap = bumperTexture('#3d7bff', '#ffffff');
  barMap.repeat.set(4, 1);
  const spinners = new InstancedMesh(new BoxGeometry(6.4, 0.9, 0.8), new MeshLambertMaterial({ map: barMap }), count('spinner'));
  const hubs = new InstancedMesh(new CylinderGeometry(0.55, 0.7, 1.5, 12), new MeshLambertMaterial({ color: '#ffd23f' }), count('spinner'));
  const balls = new InstancedMesh(new SphereGeometry(1.1, 16, 12), new MeshLambertMaterial({ color: '#7b5cff', emissive: '#2a1a6e' }), count('pendulum'));
  const rods = new InstancedMesh(new CylinderGeometry(0.12, 0.12, 1, 6), new MeshLambertMaterial({ color: '#5a4a3a' }), count('pendulum'));
  const rings = new InstancedMesh(new TorusGeometry(1.9, 0.24, 8, 26), new MeshLambertMaterial({ color: '#ffd23f', emissive: '#a86a00' }), count('ring'));
  const rampMaterial = new MeshLambertMaterial({ map: stripeTexture('#7b5cff', '#ffffff'), side: DoubleSide });
  const rampGeometry = wedgeGeometry(4.4, 5.5, 1.5);
  const archMaterial = new MeshLambertMaterial({ color: '#7b5cff' });
  const glowMaterial = new SpriteMaterial({ map: blobTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, blending: AdditiveBlending });

  const instance: number[] = [];
  const pickups = new Map<number, PickupVisual>();
  const used = { pad: 0, goo: 0, crate: 0, pin: 0, slider: 0, spinner: 0, pendulum: 0, ring: 0 };
  const stretch = new Matrix4();
  course.objects.forEach((o, i) => {
    const on = lanes[o.lane].track;
    instance[i] = -1;
    switch (o.kind) {
      case 'pad':
        pads.setMatrixAt(used.pad++, lying(on, o.s, o.x, 0.05));
        break;
      case 'goo':
        goo.setMatrixAt(used.goo++, lying(on, o.s, o.x, 0.045).multiply(stretch.makeScale(1, (o.len ?? 8) / 8, 1)));
        break;
      case 'crate':
        instance[i] = used.crate;
        crates.setMatrixAt(used.crate++, standing(on, o.s, o.x, 1.05));
        break;
      case 'pin':
        instance[i] = used.pin;
        pins.setMatrixAt(used.pin++, standing(on, o.s, o.x, 0.75));
        break;
      case 'slider':
        instance[i] = used.slider;
        sliders.setMatrixAt(used.slider++, standing(on, o.s, o.x, 1.2));
        break;
      case 'spinner':
        instance[i] = used.spinner;
        hubs.setMatrixAt(used.spinner, standing(on, o.s, o.x, 0.75));
        spinners.setMatrixAt(used.spinner++, standing(on, o.s, o.x, 0.95));
        break;
      case 'pendulum': {
        instance[i] = used.pendulum;
        balls.setMatrixAt(used.pendulum, standing(on, o.s, o.x, 1.2));
        rods.setMatrixAt(used.pendulum++, standing(on, o.s, o.x, 4));
        const hoop = new Mesh(portalGeometry, archMaterial);
        place(hoop, standing(on, o.s, 0, 0.3));
        scene.add(hoop);
        break;
      }
      case 'ring':
        instance[i] = used.ring;
        rings.setMatrixAt(used.ring++, standing(on, o.s, o.x, o.y ?? 2));
        break;
      case 'jump': {
        const ramp = new Mesh(rampGeometry, rampMaterial);
        place(ramp, standing(on, o.s, o.x, 0));
        scene.add(ramp);
        break;
      }
      case 'pickup': {
        on.at(o.s, F);
        const base = F.p.clone().addScaledVector(F.r, o.x).addScaledVector(F.u, o.y ?? 1.3);
        const sprite = new Sprite(new SpriteMaterial({ map: iconTexture(ingredient(items[i]!).img), transparent: true }));
        sprite.scale.setScalar(2.2);
        sprite.position.copy(base);
        const glow = new Sprite(glowMaterial);
        glow.scale.setScalar(3.6);
        glow.position.copy(base);
        glow.renderOrder = -1;
        scene.add(glow, sprite);
        pickups.set(i, { sprite, glow, base, up: F.u.clone() });
        break;
      }
    }
  });
  pads.count = used.pad;
  goo.count = used.goo;
  crates.count = used.crate;
  pins.count = used.pin;
  sliders.count = used.slider;
  spinners.count = hubs.count = used.spinner;
  balls.count = rods.count = used.pendulum;
  rings.count = used.ring;
  // Moving things can stray outside the bounds they were first given.
  for (const mesh of [crates, pins, sliders, spinners, balls, rods]) mesh.frustumCulled = false;
  scene.add(pads, goo, crates, pins, sliders, spinners, hubs, balls, rods, rings);

  const dispose = () => {
    const shared = new Set(iconCache.values());
    scene.traverse((object) => {
      const mesh = object as Mesh;
      mesh.geometry?.dispose();
      const materials = (Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) as (Material & { map?: Texture | null })[];
      for (const material of materials) {
        if (material.map && !shared.has(material.map)) material.map.dispose();
        material.dispose();
      }
    });
  };

  return { scene, sky, padMap, crates, pins, sliders, spinners, balls, rods, rings, instance, pickups, groundY, dispose };
}
