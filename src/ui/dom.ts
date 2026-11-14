type Child = Node | string | null | undefined | false;

/** Minimal element builder: `el('button.btn.green', { onclick }, 'Play')`. */
export function el<K extends keyof HTMLElementTagNameMap>(
  spec: K | `${K}.${string}`,
  props: Partial<Omit<HTMLElementTagNameMap[K], 'style'>> & { style?: string; data?: Record<string, string> } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag) as HTMLElementTagNameMap[K];
  if (classes.length) node.className = classes.join(' ');
  const { style, data, ...rest } = props;
  Object.assign(node, rest);
  if (style) node.setAttribute('style', style);
  if (data) for (const [key, value] of Object.entries(data)) node.dataset[key] = value;
  for (const child of children) if (child) node.append(child);
  return node;
}

export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const tenths = Math.floor((seconds - whole) * 10);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${tenths}`;
}

export function stars(filled: number, total = 5): HTMLElement {
  const row = el('div.stars');
  for (let i = 0; i < total; i++) {
    row.append(el('img', { src: asset(i < filled ? 'assets/ui/star.png' : 'assets/ui/star-empty.png'), alt: '', draggable: false }));
  }
  return row;
}

/** Tap handler that swallows the second tap of a double-tap. */
export function onTap(node: HTMLElement, handler: () => void): void {
  let last = -Infinity;
  node.addEventListener('click', (e) => {
    e.preventDefault();
    if (e.timeStamp - last < 350) return;
    last = e.timeStamp;
    handler();
  });
}

/** "1 apple", "5 cherries", "3 peaches": ingredient names are singular or already plural. */
export function countOf(n: number, name: string): string {
  const word = name.toLowerCase();
  if (n === 1 || word.endsWith('s')) return `${n} ${word}`;
  if (word.endsWith('y')) return `${n} ${word.slice(0, -1)}ies`;
  if (word.endsWith('ch') || word.endsWith('o')) return `${n} ${word}es`;
  return `${n} ${word}s`;
}
