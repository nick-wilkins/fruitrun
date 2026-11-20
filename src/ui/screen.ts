import { asset } from './dom';

/** Paint the bars either side of the stage with a soft copy of the screen's picture, so it bleeds to the edges. */
export function setBackdrop(url: string): void {
  document.body.style.setProperty('--backdrop', `url("${url}")`);
}

/** A taller, 4:3 painting of a screen's picture, and where the 16:9 picture sits inside it, in percentages of its size. */
export interface Tall {
  art: string;
  top: number;
  height: number;
  left?: number;
  width?: number;
}

/** The stall, which the blender, the book, the cups and the waiting rooms all stand in front of. */
export const STALL: Tall = { art: 'assets/stall-tall.webp', top: 9.21, height: 74.4, left: 0.28, width: 99.17 };

const wholes = new WeakMap<HTMLElement, HTMLElement>();

/** The whole of a screen, given what it was built in: the same thing, unless it was built in the window of a taller one. */
export const wholeOf = (built: HTMLElement): HTMLElement => wholes.get(built) ?? built;

/**
 * A screen that fills squarer devices with a taller painting. What comes back is the 16:9 window over the place
 * the old picture has in the painting: a screen is built in it exactly as it was in a 16:9 stage, and stays in
 * step with the painting at every shape of device.
 */
export function tallStage(classes: string, tall: Tall): HTMLElement {
  const stage = document.createElement('div');
  stage.className = `stage tall ${classes}`;
  const art = document.createElement('div');
  art.className = 'tall-art';
  art.style.setProperty('--lift', (tall.top / (100 - tall.height)).toFixed(4));
  const picture = document.createElement('img');
  picture.className = 'bg';
  picture.src = asset(tall.art);
  picture.alt = '';
  picture.draggable = false;
  const window = document.createElement('div');
  window.className = 'tall-window';
  window.style.cssText = `left:${tall.left ?? 0}%;top:${tall.top}%;width:${tall.width ?? 100}%;height:${tall.height}%`;
  art.append(picture, window);
  stage.append(art);
  setBackdrop(asset(tall.art));
  wholes.set(window, stage);
  return window;
}
