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

/** Pip the sprout: a round green seedling with a two-leaf quiff, riding inside a striped bubble. */
export function buildPip(): Pip {
  const root = new Group();
  const body = new Group();

  const skin = new MeshLambertMaterial({ color: '#8fe04a' });
  const belly = new MeshLambertMaterial({ color: '#d8f7a0' });
  const white = new MeshLambertMaterial({ color: '#ffffff' });
  const black = new MeshLambertMaterial({ color: '#1d1d2b' });
  const pink = new MeshLambertMaterial({ color: '#ff8fb0' });
  const leaf = new MeshLambertMaterial({ color: '#2fa23a' });
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
      map: bubbleTexture(),
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
