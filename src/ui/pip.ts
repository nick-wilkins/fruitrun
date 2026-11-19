export type PipMood = 'happy' | 'cheer' | 'sip' | 'yuck' | 'meh' | 'nice' | 'yum' | 'wow';

const INK = '#2e2a2a';

const openEyes = (lookX = 0, lookY = 0) => `
  <ellipse cx="37" cy="56" rx="9.5" ry="11.5" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
  <ellipse cx="63" cy="56" rx="9.5" ry="11.5" fill="#fff" stroke="${INK}" stroke-width="2.5"/>
  <circle cx="${39 + lookX}" cy="${58 + lookY}" r="5.2" fill="#1d1d2b"/><circle cx="${61 + lookX}" cy="${58 + lookY}" r="5.2" fill="#1d1d2b"/>
  <circle cx="${41 + lookX}" cy="${55.5 + lookY}" r="1.9" fill="#fff"/><circle cx="${63 + lookX}" cy="${55.5 + lookY}" r="1.9" fill="#fff"/>`;

const star = (cx: number, cy: number) => {
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 4.6 : 11;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  });
  return `<polygon points="${points.join(' ')}" fill="#ffd23f" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
};

const FACES: Record<PipMood, { eyes: string; mouth: string; extra?: string; skin?: string; armsUp?: boolean }> = {
  happy: {
    eyes: openEyes(),
    mouth: `<path d="M41 71 Q50 80 59 71" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
  },
  cheer: {
    eyes: openEyes(),
    mouth: `<path d="M40 70 Q50 86 60 70 Z" fill="#7a1f2b" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
    armsUp: true,
  },
  sip: {
    eyes: openEyes(-2.5, 2),
    mouth: `<ellipse cx="46" cy="74" rx="4.2" ry="4.8" fill="#7a1f2b" stroke="${INK}" stroke-width="2.5"/>`,
  },
  yuck: {
    skin: '#b7c95a',
    eyes: `<path d="M29 50 L44 57 L29 64 M71 50 L56 57 L71 64" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    mouth: `<path d="M36 76 Q41 70 46 76 T56 76 T66 74" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M46 77 Q46 92 53 92 Q60 92 59 77 Z" fill="#ff7a9a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
    extra: `<path d="M82 34 Q88 44 82 48 Q76 44 82 34 Z" fill="#8fd8ff" stroke="${INK}" stroke-width="2"/>`,
  },
  meh: {
    eyes: `${openEyes(0, 1)}<path d="M26 48 L48 48 M52 48 L74 48" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
    mouth: `<path d="M40 76 Q46 72 51 76 T61 73" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
  },
  nice: {
    eyes: openEyes(),
    mouth: `<path d="M38 70 Q50 84 62 70" fill="none" stroke="${INK}" stroke-width="3.8" stroke-linecap="round"/>`,
  },
  yum: {
    eyes: `<path d="M28 59 Q37 46 46 59 M54 59 Q63 46 72 59" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    mouth: `<path d="M37 68 Q50 90 63 68 Z" fill="#7a1f2b" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M52 78 Q62 86 66 74 Q60 72 56 76 Z" fill="#ff7a9a" stroke="${INK}" stroke-width="2"/>`,
    armsUp: true,
  },
  wow: {
    eyes: star(37, 56) + star(63, 56),
    mouth: `<ellipse cx="50" cy="77" rx="10" ry="11" fill="#7a1f2b" stroke="${INK}" stroke-width="2.5"/><ellipse cx="50" cy="83" rx="6" ry="4" fill="#ff7a9a"/>`,
    extra: `<path d="M8 22 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z M92 26 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#ffd23f" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
    armsUp: true,
  },
};

/** Pip the sprout, drawn flat for menus, the map and the taste test. Matches the 3D model in game/character.ts. */
/** `tint` gives the sprout another body colour, for Pip's friends. */
export function pipSvg(mood: PipMood = 'happy', tint?: string): string {
  const face = FACES[mood];
  const skin = tint ?? face.skin ?? '#8fe04a';
  const arm = (cx: number, up: boolean, flip: number) =>
    `<ellipse cx="${cx}" cy="${up ? 44 : 66}" rx="7" ry="${up ? 12 : 11}" ${up ? `transform="rotate(${flip * 35} ${cx} 44)"` : ''} fill="${skin}" stroke="#2e6b1f" stroke-width="3"/>`;
  return `<svg viewBox="0 0 100 112" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="50" cy="107" rx="26" ry="4" fill="rgba(0,0,0,0.18)"/>
    <ellipse cx="37" cy="102" rx="11" ry="6" fill="#ff9f1c" stroke="#8a4b00" stroke-width="3"/>
    <ellipse cx="63" cy="102" rx="11" ry="6" fill="#ff9f1c" stroke="#8a4b00" stroke-width="3"/>
    ${arm(face.armsUp ? 14 : 13, !!face.armsUp, -1)}${arm(face.armsUp ? 86 : 87, !!face.armsUp, 1)}
    <path d="M50 26 L50 14" stroke="#2e6b1f" stroke-width="5" stroke-linecap="round"/>
    <path d="M50 16 C38 2 22 6 20 12 C26 22 42 22 50 16 Z" fill="#3fb54a" stroke="#2e6b1f" stroke-width="3" stroke-linejoin="round"/>
    <path d="M50 16 C62 2 78 6 80 12 C74 22 58 22 50 16 Z" fill="#3fb54a" stroke="#2e6b1f" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="50" cy="64" rx="36" ry="38" fill="${skin}" stroke="#2e6b1f" stroke-width="3.5"/>
    <ellipse cx="50" cy="76" rx="22" ry="20" fill="rgba(255,255,255,0.45)"/>
    <ellipse cx="36" cy="40" rx="12" ry="6" fill="rgba(255,255,255,0.45)" transform="rotate(-25 36 40)"/>
    ${face.eyes}
    <ellipse cx="25" cy="70" rx="6" ry="4" fill="#ff8fb0" opacity="0.85"/>
    <ellipse cx="75" cy="70" rx="6" ry="4" fill="#ff8fb0" opacity="0.85"/>
    ${face.mouth}${face.extra ?? ''}
  </svg>`;
}
