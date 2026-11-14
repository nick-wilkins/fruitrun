import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
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
import type { Course, CourseObj } from './course';
import {
  bannerTexture,
  blobTexture,
  bumperTexture,
  checkerTexture,
  crateTexture,
  groundTexture,
  padTexture,
  roadTexture,
  seeded,
  skyTexture,
  stripeTexture,
} from './textures';
import { extrude, makeFrame, type Frame, type Track } from './track';

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

export interface World {
  scene: Scene;
  sky: Mesh;
  padMap: Texture;
  crates: InstancedMesh;
  sliders: InstancedMesh;
  rings: InstancedMesh;
  /** For each course object: its instance index within its mesh (crates, sliders, rings). */
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
  const banner = new Mesh(new BoxGeometry(reach * 2 + 1, 2.7, 0.5), [
    new MeshLambertMaterial({ color }),
    new MeshLambertMaterial({ color }),
    new MeshLambertMaterial({ color }),
    new MeshLambertMaterial({ color }),
    new MeshLambertMaterial({ map: bannerTexture(text, color) }),
    new MeshLambertMaterial({ map: bannerTexture(text, color) }),
  ]);
  banner.position.set(0, 7.4, 0);
  group.add(banner);
  place(group, standing(track, s, 0, 0));
  return group;
}

function addScenery(scene: Scene, course: Course, groundY: number): void {
  const { track, theme } = course;
  const rand = seeded(1234);
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  const samples: Vector3[] = [];
  track.frames.forEach((f, i) => {
    min.min(f.p);
    max.max(f.p);
    if (i % 8 === 0) samples.push(f.p);
  });
  const centre = new Vector3((min.x + max.x) / 2, groundY, (min.z + max.z) / 2);

  const ground = new Mesh(new CircleGeometry(1500, 48), new MeshLambertMaterial({ map: groundTexture(theme) }));
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

  // Apple trees.
  const treeCount = 320;
  const trunks = new InstancedMesh(new CylinderGeometry(0.07, 0.1, 0.42, 6), new MeshLambertMaterial({ color: '#8a5a33' }), treeCount);
  const canopies = new InstancedMesh(new IcosahedronGeometry(0.4, 1), new MeshLambertMaterial({ flatShading: true }), treeCount);
  const fruitPerTree = 5;
  const fruits = new InstancedMesh(new SphereGeometry(0.035, 7, 5), new MeshLambertMaterial({ color: theme.fruit }), treeCount * fruitPerTree);
  const color = new Color();
  let placed = 0;
  for (let attempt = 0; attempt < treeCount * 6 && placed < treeCount; attempt++) {
    const x = min.x - 170 + rand() * (max.x - min.x + 340);
    const z = min.z - 170 + rand() * (max.z - min.z + 340);
    const height = 9 + rand() * 9;
    if (clearance(x, z, 13) < height + 7) continue;
    M.makeScale(height, height, height).setPosition(x, groundY + height * 0.2, z);
    trunks.setMatrixAt(placed, M);
    M.makeScale(height * 1.15, height, height * 1.15).setPosition(x, groundY + height * 0.66, z);
    canopies.setMatrixAt(placed, M);
    canopies.setColorAt(placed, color.set(theme.canopy[Math.floor(rand() * theme.canopy.length)]));
    for (let n = 0; n < fruitPerTree; n++) {
      const a = rand() * Math.PI * 2;
      const lift = 0.1 + rand() * 0.5;
      const r = 0.4 * Math.sqrt(1 - (lift - 0.3) * (lift - 0.3)) * 1.1;
      M.makeScale(height, height, height).setPosition(
        x + Math.cos(a) * r * height,
        groundY + height * (0.5 + lift * 0.6),
        z + Math.sin(a) * r * height,
      );
      fruits.setMatrixAt(placed * fruitPerTree + n, M);
    }
    placed++;
  }
  trunks.count = canopies.count = placed;
  fruits.count = placed * fruitPerTree;
  scene.add(trunks, canopies, fruits);

  // Rolling hills around the edge.
  const hills = new InstancedMesh(new SphereGeometry(1, 16, 10), new MeshLambertMaterial({ color: theme.groundDark }), 16);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rand() * 0.3;
    const reach = Math.max(max.x - min.x, max.z - min.z) / 2 + 230 + rand() * 180;
    const size = 90 + rand() * 110;
    M.makeScale(size, size * (0.3 + rand() * 0.25), size).setPosition(centre.x + Math.cos(a) * reach, groundY - 4, centre.z + Math.sin(a) * reach);
    hills.setMatrixAt(i, M);
  }
  scene.add(hills);

  // Puffy clouds.
  const puffs = 26;
  const clouds = new InstancedMesh(new SphereGeometry(1, 10, 8), new MeshBasicMaterial({ color: '#ffffff', fog: false }), puffs * 4);
  for (let i = 0; i < puffs; i++) {
    const x = min.x - 320 + rand() * (max.x - min.x + 640);
    const z = min.z - 320 + rand() * (max.z - min.z + 640);
    const y = max.y + 45 + rand() * 80;
    const size = 9 + rand() * 12;
    for (let n = 0; n < 4; n++) {
      const scale = size * (n === 0 ? 1 : 0.55 + rand() * 0.3);
      M.makeScale(scale * 1.3, scale * 0.75, scale).setPosition(x + (n - 1.5) * size * 0.9, y + (n % 2) * size * 0.2, z + (rand() - 0.5) * size);
      clouds.setMatrixAt(i * 4 + n, M);
    }
  }
  scene.add(clouds);

  // A few giant fruit as landmarks.
  const giant = new MeshLambertMaterial({ color: theme.fruit });
  const stalk = new MeshLambertMaterial({ color: '#6b4226' });
  const leaf = new MeshLambertMaterial({ color: '#3fae3a' });
  for (let i = 0; i < 9; i++) {
    const x = min.x - 60 + rand() * (max.x - min.x + 120);
    const z = min.z - 60 + rand() * (max.z - min.z + 120);
    const size = 7 + rand() * 6;
    if (clearance(x, z, size + 12) < size * 2.6) continue;
    const apple = new Group();
    const flesh = new Mesh(new SphereGeometry(size, 20, 14), giant);
    flesh.scale.set(1, 0.9, 1);
    const stem = new Mesh(new CylinderGeometry(size * 0.06, size * 0.06, size * 0.5, 6), stalk);
    stem.position.y = size * 1.02;
    const blade = new Mesh(new SphereGeometry(size * 0.3, 10, 6), leaf);
    blade.scale.set(1, 0.18, 0.5);
    blade.position.set(size * 0.3, size * 1.15, 0);
    apple.add(flesh, stem, blade);
    apple.position.set(x, groundY + size * 0.82, z);
    apple.rotation.y = rand() * 6;
    scene.add(apple);
  }
}

function addPillars(scene: Scene, track: Track, groundY: number): void {
  const spots: Frame[] = [];
  const every = 72;
  for (let i = every; i < track.frames.length - every; i += every) {
    const f = track.frames[i];
    const s = i * 0.5;
    if (f.u.y < 0.93 || track.inSpan('loop', s) || track.inSpan('spiral', s)) continue;
    // Skip a pillar that would stab through a lower piece of track.
    const blocked = track.frames.some((g, j) => j % 6 === 0 && g.p.y < f.p.y - 4 && Math.hypot(g.p.x - f.p.x, g.p.z - f.p.z) < 9);
    if (!blocked) spots.push(f);
  }
  const pillars = new InstancedMesh(new CylinderGeometry(0.9, 1.3, 1, 10), new MeshLambertMaterial({ color: '#f4ead8' }), spots.length);
  spots.forEach((f, i) => {
    const top = f.p.y - 1.3;
    M.makeScale(1, top - groundY, 1).setPosition(f.p.x, (top + groundY) / 2, f.p.z);
    pillars.setMatrixAt(i, M);
  });
  scene.add(pillars);
}

/** Build everything you can see for a course. `pickupIds` gives the ingredient for each pickup, in course order. */
export function buildWorld(course: Course, pickupIds: string[]): World {
  const { track, theme } = course;
  const scene = new Scene();
  scene.fog = new Fog(theme.fog, 140, 620);

  scene.add(new HemisphereLight(0xffffff, 0xa8c98a, 1.2));
  const sun = new DirectionalLight(0xfff1d0, 1.5);
  sun.position.set(0.5, 1, 0.35);
  scene.add(sun);

  const sky = new Mesh(new SphereGeometry(1000, 24, 16), new MeshBasicMaterial({ map: skyTexture(theme), side: BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  scene.add(sky);

  let lowest = Infinity;
  for (const f of track.frames) lowest = Math.min(lowest, f.p.y);
  const groundY = lowest - 22;

  // Track.
  const half = track.half;
  const road = new Mesh(extrude(track, [[-half, 0], [half, 0]], { vScale: 0.1 }), trackMaterial(roadTexture(theme)));
  const kerbMaterial = trackMaterial(stripeTexture(theme.kerbA, theme.kerbB));
  const kerbL = new Mesh(extrude(track, [[-half - 0.9, -0.6], [-half - 0.9, 0.6], [-half, 0.6], [-half, 0]], { vScale: 0.25, stride: 2 }), kerbMaterial);
  const kerbR = new Mesh(extrude(track, [[half, 0], [half, 0.6], [half + 0.9, 0.6], [half + 0.9, -0.6]], { vScale: 0.25, stride: 2 }), kerbMaterial);
  const under = new Mesh(
    extrude(track, [[half + 0.9, -0.6], [half * 0.55, -1.5], [-half * 0.55, -1.5], [-half - 0.9, -0.6]], { stride: 2 }),
    new MeshLambertMaterial({ color: theme.under, emissive: theme.under, emissiveIntensity: 0.45 }),
  );
  scene.add(road, kerbL, kerbR, under);

  // Tunnels.
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
    scene.add(new Mesh(extrude(track, arch, { s0: span.s0, s1: span.s1, vScale: 0.07, stride: 2, smooth: true }), tunnelMaterial));
    for (const s of [span.s0, span.s1]) {
      const portal = new Mesh(portalGeometry, portalMaterial);
      place(portal, standing(track, s, 0, 0.3));
      scene.add(portal);
    }
  }

  addPillars(scene, track, groundY);
  addScenery(scene, course, groundY);

  scene.add(gate(track, 44, 'GO!', '#2fb344'));
  scene.add(gate(track, course.finishS, 'FINISH', '#ff4d6d'));
  const line = new Mesh(new PlaneGeometry(half * 2, 3), new MeshBasicMaterial({ map: checkerTexture() }));
  place(line, lying(track, course.finishS, 0, 0.04));
  scene.add(line);

  // Course objects.
  const count = (kind: CourseObj['kind']) => Math.max(1, course.objects.filter((o) => o.kind === kind).length);
  const padMap = padTexture();
  const pads = new InstancedMesh(
    new PlaneGeometry(3.4, 6),
    new MeshBasicMaterial({ map: padMap, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    count('pad'),
  );
  const crates = new InstancedMesh(new BoxGeometry(2.3, 2.1, 2.1), new MeshLambertMaterial({ map: crateTexture() }), count('crate'));
  const sliderMap = bumperTexture();
  sliderMap.repeat.set(3, 1.5);
  const sliders = new InstancedMesh(new CylinderGeometry(0.95, 1.15, 2.4, 16), new MeshLambertMaterial({ map: sliderMap }), count('slider'));
  const rings = new InstancedMesh(
    new TorusGeometry(1.9, 0.24, 8, 26),
    new MeshLambertMaterial({ color: '#ffd23f', emissive: '#a86a00' }),
    count('ring'),
  );
  const rampMaterial = new MeshLambertMaterial({ map: stripeTexture('#7b5cff', '#ffffff'), side: DoubleSide });
  const rampGeometry = wedgeGeometry(4.4, 5.5, 1.5);
  const glowMaterial = new SpriteMaterial({ map: blobTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, blending: AdditiveBlending });

  const instance: number[] = [];
  const pickups = new Map<number, PickupVisual>();
  const used = { pad: 0, crate: 0, slider: 0, ring: 0 };
  let pickupN = 0;
  course.objects.forEach((o, i) => {
    instance[i] = -1;
    switch (o.kind) {
      case 'pad':
        pads.setMatrixAt(used.pad++, lying(track, o.s, o.x, 0.05));
        break;
      case 'crate':
        instance[i] = used.crate;
        crates.setMatrixAt(used.crate++, standing(track, o.s, o.x, 1.05));
        break;
      case 'slider':
        instance[i] = used.slider;
        sliders.setMatrixAt(used.slider++, standing(track, o.s, o.x, 1.2));
        break;
      case 'ring':
        instance[i] = used.ring;
        rings.setMatrixAt(used.ring++, standing(track, o.s, o.x, 2.0));
        break;
      case 'jump': {
        const ramp = new Mesh(rampGeometry, rampMaterial);
        place(ramp, standing(track, o.s, o.x, 0));
        scene.add(ramp);
        break;
      }
      case 'pickup': {
        const id = pickupIds[pickupN++ % Math.max(1, pickupIds.length)];
        track.at(o.s, F);
        const base = F.p.clone().addScaledVector(F.r, o.x).addScaledVector(F.u, o.y ?? 1.3);
        const sprite = new Sprite(new SpriteMaterial({ map: iconTexture(ingredient(id).img), transparent: true }));
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
  crates.count = used.crate;
  sliders.count = used.slider;
  rings.count = used.ring;
  scene.add(pads, crates, sliders, rings);

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

  return { scene, sky, padMap, crates, sliders, rings, instance, pickups, groundY, dispose };
}
