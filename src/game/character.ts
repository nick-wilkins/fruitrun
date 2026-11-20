import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  SphereGeometry,
} from 'three';
import { BALL_RADIUS } from './sim';
import { bubbleTexture } from './textures';


export interface Pip {
  /** Everything: move this to place the ball. */
  root: Group;
  /** The rolling bubble. */
  shell: Mesh;
  /** Pip, who stays upright inside it. */
  body: Group;
  leaves: Group;
}

/** The colours of a sprout: Pip's own unless told otherwise, so the marbles in a race can be told apart. */
export interface PipLook {
  skin: string;
  belly: string;
  leaf: string;
  /** The bubble's stripes. */
  bands: string[];
  /** How brightly it shines with its own light, 0 to 1, for marbles with no lamp in the dark. */
  glow?: number;
  /** A scowl: heavy brows drawn down over the eyes. */
  mean?: boolean;
}

export const PIP: PipLook = { skin: '#8fe04a', belly: '#d8f7a0', leaf: '#2fa23a', bands: ['#ff7a1a', '#ffffff', '#ffd23f'] };

/** Pip the sprout: a round green seedling with a two-leaf quiff, riding inside a striped bubble. */
export function buildPip(look: PipLook = PIP): Pip {
  const root = new Group();
  const body = new Group();

  const glow = look.glow ?? 0;
  const skin = new MeshLambertMaterial({ color: look.skin, emissive: look.skin, emissiveIntensity: glow });
  const belly = new MeshLambertMaterial({ color: look.belly, emissive: look.belly, emissiveIntensity: glow });
  const white = new MeshLambertMaterial({ color: '#ffffff' });
  const black = new MeshLambertMaterial({ color: '#1d1d2b' });
  const pink = new MeshLambertMaterial({ color: '#ff8fb0' });
  const leaf = new MeshLambertMaterial({ color: look.leaf });
  const foot = new MeshLambertMaterial({ color: '#ff9f1c' });
  const ball = new SphereGeometry(1, 18, 14);

  const part = (material: MeshLambertMaterial, x: number, y: number, z: number, sx: number, sy = sx, sz = sx) => {
    const mesh = new Mesh(ball, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    body.add(mesh);
    return mesh;
  };

  part(skin, 0, 0, 0, 0.44, 0.47, 0.44);
  part(belly, 0, -0.06, 0.2, 0.3, 0.3, 0.26);
  for (const side of [-1, 1]) {
    part(white, side * 0.17, 0.13, 0.34, 0.13, 0.15, 0.1);
    part(black, side * 0.17, 0.13, 0.42, 0.065, 0.08, 0.05);
    part(pink, side * 0.3, -0.02, 0.3, 0.07, 0.05, 0.04);
    part(foot, side * 0.17, -0.44, 0.06, 0.13, 0.08, 0.17);
    part(skin, side * 0.44, -0.02, 0.02, 0.09, 0.15, 0.09);
  }
  part(black, 0, -0.03, 0.43, 0.07, 0.035, 0.03);
  if (look.mean) {
    for (const side of [-1, 1]) {
      // Brows slanting down to the middle, low enough to cut across the top of each eye.
      const brow = part(black, side * 0.17, 0.25, 0.4, 0.15, 0.045, 0.07);
      brow.rotation.z = side * 0.55;
    }
  }

  const leaves = new Group();
  leaves.position.set(0, 0.45, 0);
  const stem = new Mesh(new CylinderGeometry(0.035, 0.045, 0.16, 6), leaf);
  stem.position.y = 0.06;
  leaves.add(stem);
  for (const side of [-1, 1]) {
    const blade = new Mesh(ball, leaf);
    blade.scale.set(0.2, 0.035, 0.11);
    blade.position.set(side * 0.17, 0.17, 0);
    blade.rotation.z = side * 0.5;
    leaves.add(blade);
  }
  body.add(leaves);
  body.scale.setScalar(1.4);
  root.add(body);

  const shell = new Mesh(
    new SphereGeometry(BALL_RADIUS, 32, 22),
    new MeshPhongMaterial({
      map: bubbleTexture(look.bands),
      transparent: true,
      depthWrite: false,
      shininess: 120,
      specular: 0xffffff,
    }),
  );
  shell.renderOrder = 5;
  root.add(shell);

  return { root, shell, body, leaves };
}
