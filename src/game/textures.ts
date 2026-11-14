import { CanvasTexture, LinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { seeded } from './random';
import type { Theme } from './themes';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  return [el, el.getContext('2d')!];
}

function finish(el: HTMLCanvasElement, repeat = true): CanvasTexture {
  const texture = new CanvasTexture(el);
  texture.colorSpace = SRGBColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

/** The road surface in the theme's style. U runs across the road, V along it. */
export function roadTexture(theme: Theme): Texture {
  const [el, g] = canvas(512, 512);
  const rand = seeded(7);
  g.fillStyle = theme.road;
  g.fillRect(0, 0, 512, 512);
  if (theme.roadStyle === 'planks') {
    const boards = 8;
    for (let i = 0; i < boards; i++) {
      const y = (i * 512) / boards;
      g.fillStyle = shade(theme.road, (rand() - 0.5) * 0.16);
      g.fillRect(0, y, 512, 512 / boards);
      g.strokeStyle = shade(theme.road, -0.12);
      g.lineWidth = 1.5;
      for (let n = 0; n < 5; n++) {
        const gy = y + 8 + rand() * (512 / boards - 16);
        g.beginPath();
        g.moveTo(0, gy);
        g.bezierCurveTo(170, gy + (rand() - 0.5) * 10, 340, gy + (rand() - 0.5) * 10, 512, gy);
        g.stroke();
      }
      g.fillStyle = shade(theme.road, -0.3);
      g.fillRect(0, y, 512, 3);
    }
  } else if (theme.roadStyle === 'tiles') {
    const size = 64;
    for (let y = 0; y < 512; y += size) {
      for (let x = 0; x < 512; x += size) {
        g.fillStyle = shade(theme.road, ((x + y) / size) % 2 ? -0.07 : 0.05);
        g.fillRect(x, y, size, size);
      }
    }
    g.strokeStyle = shade(theme.road, -0.2);
    g.lineWidth = 2;
    for (let i = 0; i <= 512; i += size) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 512);
      g.moveTo(0, i);
      g.lineTo(512, i);
      g.stroke();
    }
  } else {
    for (let i = 0; i < 260; i++) {
      g.fillStyle = shade(theme.road, (rand() - 0.5) * 0.3);
      g.globalAlpha = 0.5;
      g.beginPath();
      g.arc(rand() * 512, rand() * 512, 2 + rand() * 6, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  g.fillStyle = theme.roadLine;
  g.fillRect(14, 0, 12, 512);
  g.fillRect(486, 0, 12, 512);
  g.globalAlpha = 0.85;
  g.fillRect(250, 40, 12, 176);
  g.fillRect(250, 296, 12, 176);
  return finish(el);
}

/** A splat of something sticky. */
export function gooTexture(color: string): Texture {
  const [el, g] = canvas(128, 256);
  const rand = seeded(99);
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(64, 128, 50, 112, 0, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    g.beginPath();
    g.arc(64 + Math.cos(a) * 46, 128 + Math.sin(a) * 106, 6 + rand() * 9, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.ellipse(34 + rand() * 60, 40 + rand() * 170, 5 + rand() * 6, 3 + rand() * 3, rand() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return finish(el, false);
}

/** Arrows for the sign at a fork. */
export function forkSignTexture(): Texture {
  const [el, g] = canvas(256, 128);
  g.fillStyle = '#ffd23f';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#5a2d0c';
  g.lineWidth = 12;
  g.strokeRect(6, 6, 244, 116);
  g.fillStyle = '#5a2d0c';
  for (const dir of [-1, 1]) {
    const cx = 128 + dir * 62;
    g.beginPath();
    g.moveTo(cx + dir * 42, 64);
    g.lineTo(cx - dir * 6, 26);
    g.lineTo(cx - dir * 6, 48);
    g.lineTo(cx - dir * 40, 48);
    g.lineTo(cx - dir * 40, 80);
    g.lineTo(cx - dir * 6, 80);
    g.lineTo(cx - dir * 6, 102);
    g.closePath();
    g.fill();
  }
  return finish(el, false);
}

/** Two-colour stripes that repeat along the track. */
export function stripeTexture(a: string, b: string): Texture {
  const [el, g] = canvas(16, 128);
  g.fillStyle = a;
  g.fillRect(0, 0, 16, 64);
  g.fillStyle = b;
  g.fillRect(0, 64, 16, 64);
  return finish(el);
}

/** Glowing forward-pointing chevrons for speed pads. */
export function padTexture(): Texture {
  const [el, g] = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(40, 255, 140, 0.28)';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2; i++) {
    const y = i * 64;
    g.beginPath();
    g.moveTo(10, y + 58);
    g.lineTo(64, y + 14);
    g.lineTo(118, y + 58);
    g.lineTo(118, y + 34);
    g.lineTo(64, y - 10);
    g.lineTo(10, y + 34);
    g.closePath();
    g.fillStyle = '#eaff3d';
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = '#ffffff';
    g.stroke();
  }
  const texture = finish(el);
  texture.repeat.set(1, 1.5);
  return texture;
}

export function crateTexture(): Texture {
  const [el, g] = canvas(128, 128);
  g.fillStyle = '#d89a4e';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#b87a35';
  g.lineWidth = 3;
  for (let x = 32; x < 128; x += 32) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 128);
    g.stroke();
  }
  g.strokeStyle = '#8a531f';
  g.lineWidth = 14;
  g.strokeRect(7, 7, 114, 114);
  g.lineWidth = 12;
  g.beginPath();
  g.moveTo(12, 12);
  g.lineTo(116, 116);
  g.moveTo(116, 12);
  g.lineTo(12, 116);
  g.stroke();
  return finish(el, false);
}

/** Candy stripes for bumper posts and gate poles. */
export function bumperTexture(a = '#ff4fa3', b = '#ffffff'): Texture {
  const [el, g] = canvas(64, 64);
  g.fillStyle = b;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = a;
  for (let i = -64; i < 128; i += 32) {
    g.beginPath();
    g.moveTo(i, 64);
    g.lineTo(i + 16, 64);
    g.lineTo(i + 80, 0);
    g.lineTo(i + 64, 0);
    g.closePath();
    g.fill();
  }
  return finish(el);
}

/** The bubble Pip rolls in: mostly clear, with swirling bands so the spin reads at speed. */
export function bubbleTexture(): Texture {
  const [el, g] = canvas(512, 256);
  g.clearRect(0, 0, 512, 256);
  g.fillStyle = 'rgba(170, 235, 255, 0.24)';
  g.fillRect(0, 0, 512, 256);
  const bands = ['#ff7a1a', '#ffffff', '#ffd23f'];
  for (let i = 0; i < 6; i++) {
    g.fillStyle = bands[i % bands.length];
    g.globalAlpha = 0.92;
    const x = (i * 512) / 6;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + 70, 80, x - 10, 170, x + 60, 256);
    g.lineTo(x + 104, 256);
    g.bezierCurveTo(x + 34, 170, x + 114, 80, x + 44, 0);
    g.closePath();
    g.fill();
  }
  return finish(el);
}

export function skyTexture(theme: Theme): Texture {
  const [el, g] = canvas(8, 256);
  const gradient = g.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, theme.skyTop);
  gradient.addColorStop(0.5, theme.skyBottom);
  gradient.addColorStop(0.56, theme.fog);
  gradient.addColorStop(1, theme.fog);
  g.fillStyle = gradient;
  g.fillRect(0, 0, 8, 256);
  const texture = finish(el, false);
  texture.minFilter = LinearFilter;
  return texture;
}

export function groundTexture(theme: Theme): Texture {
  const [el, g] = canvas(256, 256);
  const rand = seeded(21);
  g.fillStyle = theme.ground;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 46; i++) {
    g.fillStyle = rand() > 0.5 ? theme.groundDark : shade(theme.ground, 0.14);
    g.globalAlpha = 0.35;
    const x = rand() * 256;
    const y = rand() * 256;
    const r = 10 + rand() * 26;
    for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      g.beginPath();
      g.ellipse(x + ox, y + oy, r, r * 0.7, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  const texture = finish(el);
  texture.repeat.set(60, 60);
  return texture;
}

export function bannerTexture(text: string, background: string, color = '#ffffff'): Texture {
  const [el, g] = canvas(512, 128);
  g.fillStyle = background;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(0, 0, 512, 44);
  g.font = '900 92px "Arial Rounded MT Bold", ui-rounded, "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 14;
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.strokeText(text, 256, 70);
  g.fillStyle = color;
  g.fillText(text, 256, 70);
  return finish(el, false);
}

export function checkerTexture(): Texture {
  const [el, g] = canvas(64, 64);
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? '#ffffff' : '#222222';
      g.fillRect(x * 32, y * 32, 32, 32);
    }
  }
  const texture = finish(el);
  texture.repeat.set(5, 1.5);
  return texture;
}

/** Soft round blob: ball shadow and pickup glow. */
export function blobTexture(inner: string, outer: string): Texture {
  const [el, g] = canvas(128, 128);
  const gradient = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  g.fillStyle = gradient;
  g.fillRect(0, 0, 128, 128);
  return finish(el, false);
}
