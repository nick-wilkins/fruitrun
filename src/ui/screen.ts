/** Paint the bars either side of the stage with a soft copy of the screen's picture, so it bleeds to the edges. */
export function setBackdrop(url: string): void {
  document.body.style.setProperty('--backdrop', `url("${url}")`);
}
