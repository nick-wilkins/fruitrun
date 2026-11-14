/** Pip the sprout, drawn flat for menus and the map. Matches the 3D model in game/character.ts. */
export function pipSvg(mood: 'happy' | 'cheer' = 'happy'): string {
  const arms =
    mood === 'cheer'
      ? '<ellipse cx="14" cy="44" rx="7" ry="12" transform="rotate(-35 14 44)" fill="#8fe04a" stroke="#2e6b1f" stroke-width="3"/><ellipse cx="86" cy="44" rx="7" ry="12" transform="rotate(35 86 44)" fill="#8fe04a" stroke="#2e6b1f" stroke-width="3"/>'
      : '<ellipse cx="13" cy="66" rx="7" ry="11" fill="#8fe04a" stroke="#2e6b1f" stroke-width="3"/><ellipse cx="87" cy="66" rx="7" ry="11" fill="#8fe04a" stroke="#2e6b1f" stroke-width="3"/>';
  const mouth =
    mood === 'cheer'
      ? '<path d="M40 70 Q50 86 60 70 Z" fill="#7a1f2b" stroke="#2e2a2a" stroke-width="2.5" stroke-linejoin="round"/>'
      : '<path d="M41 71 Q50 80 59 71" fill="none" stroke="#2e2a2a" stroke-width="3.5" stroke-linecap="round"/>';
  return `<svg viewBox="0 0 100 112" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="50" cy="107" rx="26" ry="4" fill="rgba(0,0,0,0.18)"/>
    <ellipse cx="37" cy="102" rx="11" ry="6" fill="#ff9f1c" stroke="#8a4b00" stroke-width="3"/>
    <ellipse cx="63" cy="102" rx="11" ry="6" fill="#ff9f1c" stroke="#8a4b00" stroke-width="3"/>
    ${arms}
    <path d="M50 26 L50 14" stroke="#2e6b1f" stroke-width="5" stroke-linecap="round"/>
    <path d="M50 16 C38 2 22 6 20 12 C26 22 42 22 50 16 Z" fill="#3fb54a" stroke="#2e6b1f" stroke-width="3" stroke-linejoin="round"/>
    <path d="M50 16 C62 2 78 6 80 12 C74 22 58 22 50 16 Z" fill="#3fb54a" stroke="#2e6b1f" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="50" cy="64" rx="36" ry="38" fill="#8fe04a" stroke="#2e6b1f" stroke-width="3.5"/>
    <ellipse cx="50" cy="76" rx="22" ry="20" fill="#d8f7a0"/>
    <ellipse cx="36" cy="40" rx="12" ry="6" fill="rgba(255,255,255,0.45)" transform="rotate(-25 36 40)"/>
    <ellipse cx="37" cy="56" rx="9.5" ry="11.5" fill="#fff" stroke="#2e2a2a" stroke-width="2.5"/>
    <ellipse cx="63" cy="56" rx="9.5" ry="11.5" fill="#fff" stroke="#2e2a2a" stroke-width="2.5"/>
    <circle cx="39" cy="58" r="5.2" fill="#1d1d2b"/><circle cx="61" cy="58" r="5.2" fill="#1d1d2b"/>
    <circle cx="41" cy="55.5" r="1.9" fill="#fff"/><circle cx="63" cy="55.5" r="1.9" fill="#fff"/>
    <ellipse cx="25" cy="70" rx="6" ry="4" fill="#ff8fb0" opacity="0.85"/>
    <ellipse cx="75" cy="70" rx="6" ry="4" fill="#ff8fb0" opacity="0.85"/>
    ${mouth}
  </svg>`;
}
