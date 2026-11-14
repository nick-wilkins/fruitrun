export type Scenery = 'orchard' | 'pine' | 'palm' | 'mushroom' | 'cactus' | 'crystal' | 'castle';
export type RoadStyle = 'planks' | 'tiles' | 'plain';

export interface Theme {
  skyTop: string;
  skyBottom: string;
  fog: string;
  ground: string;
  groundDark: string;
  road: string;
  roadStyle: RoadStyle;
  roadLine: string;
  kerbA: string;
  kerbB: string;
  under: string;
  tunnelA: string;
  tunnelB: string;
  scenery: Scenery;
  canopy: string[];
  /** Fruit on the trees and the giant landmark fruit. */
  fruit: string;
  /** Sticky patches on the road. */
  goo: string;
  cloud: string;
  /** Overall brightness: 1 is midday, lower for dusk and night. */
  light: number;
}

const base: Theme = {
  skyTop: '#2f9bff',
  skyBottom: '#c9f0ff',
  fog: '#bfe8ff',
  ground: '#7fd14f',
  groundDark: '#58b23a',
  road: '#f2d7a0',
  roadStyle: 'planks',
  roadLine: '#ffffff',
  kerbA: '#ff4d4d',
  kerbB: '#ffffff',
  under: '#b8793e',
  tunnelA: '#ff5a5a',
  tunnelB: '#ffd23f',
  scenery: 'orchard',
  canopy: ['#3fae3a', '#58c244', '#2f9a3f'],
  fruit: '#e8302a',
  goo: '#c2185b',
  cloud: '#ffffff',
  light: 1,
};

const theme = (changes: Partial<Theme>): Theme => ({ ...base, ...changes });

/** One look per level, keyed by level id. */
export const THEMES: Record<string, Theme> = {
  'level-1': base,
  'level-2': theme({
    skyTop: '#ffb347', skyBottom: '#fff1c1', fog: '#ffe9b0', ground: '#e9d27a', groundDark: '#cdb35a',
    road: '#fff3b8', roadStyle: 'plain', kerbA: '#ffcf1f', kerbB: '#6b4a1e', under: '#a8782f',
    tunnelA: '#ffd23f', tunnelB: '#8a5a2b', scenery: 'palm', canopy: ['#4fb53a', '#6fcf4a'], fruit: '#ffd92e', goo: '#8a5a2b',
  }),
  'level-3': theme({
    skyTop: '#ff8fb3', skyBottom: '#ffe3ec', fog: '#ffd6e2', ground: '#8fd86a', groundDark: '#5fbf4a',
    road: '#ffe1e8', roadStyle: 'tiles', kerbA: '#ff3d6e', kerbB: '#ffffff', under: '#c2547a',
    tunnelA: '#ff5d8a', tunnelB: '#ffffff', canopy: ['#3fae3a', '#69c94a'], fruit: '#ff2e55', goo: '#d81b60',
  }),
  'level-4': theme({
    skyTop: '#ff9a3d', skyBottom: '#ffe2b8', fog: '#ffd9a6', ground: '#9fd15a', groundDark: '#74b33f',
    road: '#ffe8c2', kerbA: '#ff8a00', kerbB: '#ffffff', under: '#b8651e',
    tunnelA: '#ff9f1c', tunnelB: '#fff0c2', canopy: ['#3f9a3a', '#5cb548'], fruit: '#ff9f1c', goo: '#ff6d00',
  }),
  'level-5': theme({
    skyTop: '#7a5cff', skyBottom: '#e3d6ff', fog: '#d9ccff', ground: '#7fc76a', groundDark: '#4f9f5a',
    road: '#ede3ff', roadStyle: 'tiles', kerbA: '#8e5bd6', kerbB: '#ffffff', under: '#6a4aa8',
    tunnelA: '#8e5bd6', tunnelB: '#c9f27a', canopy: ['#4f9f3a', '#77bf4a'], fruit: '#8e5bd6', goo: '#6a1b9a',
  }),
  'level-6': theme({
    skyTop: '#49c6e5', skyBottom: '#dff7ff', fog: '#cdefff', ground: '#4fb7e0', groundDark: '#3a9fd0',
    road: '#f4f1d0', kerbA: '#8fcf3f', kerbB: '#ffffff', under: '#8a9a4a',
    tunnelA: '#b8e04a', tunnelB: '#ffffff', scenery: 'mushroom', canopy: ['#c5e063', '#9fd14b'], fruit: '#ffffff', goo: '#7cb342',
  }),
  'level-7': theme({
    skyTop: '#1fb5c9', skyBottom: '#d6fff2', fog: '#c2f5ea', ground: '#3fc9a0', groundDark: '#2fae8a',
    road: '#ffd9df', roadStyle: 'plain', kerbA: '#2e9e4a', kerbB: '#ff5d73', under: '#2e7d4a',
    tunnelA: '#ff6f7d', tunnelB: '#2e9e4a', scenery: 'palm', canopy: ['#2e9e4a', '#57c26a'], fruit: '#ff5d73', goo: '#ff5d73',
  }),
  'level-8': theme({
    skyTop: '#e07a3f', skyBottom: '#ffe2c2', fog: '#f5cfa6', ground: '#d9a066', groundDark: '#bf8048',
    road: '#f5e6c8', roadStyle: 'tiles', kerbA: '#7fb53a', kerbB: '#5a3a1e', under: '#8a5a33',
    tunnelA: '#9bd14b', tunnelB: '#7a4f2e', scenery: 'cactus', canopy: ['#5fae4a', '#7fc45a'], fruit: '#9bd14b', goo: '#689f38',
  }),
  'level-9': theme({
    skyTop: '#ff7aa2', skyBottom: '#fff0f5', fog: '#ffe3ee', ground: '#a8e07a', groundDark: '#7fc95a',
    road: '#fff6f8', kerbA: '#d7263d', kerbB: '#ffffff', under: '#b8485a',
    tunnelA: '#d7263d', tunnelB: '#ffd1dc', canopy: ['#ffb3c7', '#ff8fb0', '#ffd1dc'], fruit: '#d7263d', goo: '#ad1457',
  }),
  'level-10': theme({
    skyTop: '#3fa9f5', skyBottom: '#fffbd1', fog: '#eef7c2', ground: '#5fc0e8', groundDark: '#3fa0d8',
    road: '#fffbe0', roadStyle: 'plain', kerbA: '#ffd92e', kerbB: '#3fa0d8', under: '#c9a82e',
    tunnelA: '#ffe14d', tunnelB: '#4fc3f7', scenery: 'pine', canopy: ['#3f9a5a', '#58b56a'], fruit: '#ffe14d', goo: '#f9a825',
  }),
  'level-11': theme({
    skyTop: '#141a4a', skyBottom: '#4a3f8a', fog: '#3a3475', ground: '#2f4a6a', groundDark: '#243a58',
    road: '#cfd6ff', roadStyle: 'tiles', roadLine: '#8fe3ff', kerbA: '#5468d4', kerbB: '#8fe3ff', under: '#2a3070',
    tunnelA: '#5468d4', tunnelB: '#8fe3ff', scenery: 'pine', canopy: ['#2f5a6a', '#3f7080'], fruit: '#7f8fff', goo: '#283593',
    cloud: '#8f95d6', light: 0.62,
  }),
  'level-12': theme({
    skyTop: '#00b4d8', skyBottom: '#fff3b0', fog: '#ffeaa0', ground: '#f2d98a', groundDark: '#d9bb62',
    road: '#fff0b8', kerbA: '#ff9f1c', kerbB: '#2e9e4a', under: '#b8862e',
    tunnelA: '#ffd23f', tunnelB: '#2e9e4a', scenery: 'palm', canopy: ['#2e9e4a', '#4fb85a'], fruit: '#ffd23f', goo: '#ef6c00',
  }),
  'level-13': theme({
    skyTop: '#ff9e7a', skyBottom: '#ffe8d6', fog: '#ffdcc7', ground: '#9fd88a', groundDark: '#74bf6a',
    road: '#fff1e3', roadStyle: 'plain', kerbA: '#ff8f5a', kerbB: '#ffffff', under: '#c9744a',
    tunnelA: '#ffb07c', tunnelB: '#ffffff', canopy: ['#ffc2a6', '#ffa98a', '#8fd17a'], fruit: '#ffb07c', goo: '#e64a19',
  }),
  'level-14': theme({
    skyTop: '#3a1f6e', skyBottom: '#c98fd6', fog: '#a878c2', ground: '#5a8f5a', groundDark: '#3f6f4a',
    road: '#ead9f5', roadStyle: 'tiles', kerbA: '#7b3fa0', kerbB: '#ffd23f', under: '#4a2a6e',
    tunnelA: '#7b3fa0', tunnelB: '#ffd23f', scenery: 'mushroom', canopy: ['#9a5ac2', '#7b3fa0'], fruit: '#ffe9a8', goo: '#4a148c',
    cloud: '#e3c9f0', light: 0.8,
  }),
  'level-15': theme({
    skyTop: '#e63b7a', skyBottom: '#ffd6e6', fog: '#ffc2d9', ground: '#7fc98a', groundDark: '#55a86a',
    road: '#fff0f6', kerbA: '#e63b7a', kerbB: '#3fae5a', under: '#a82a5a',
    tunnelA: '#e63b7a', tunnelB: '#ffffff', scenery: 'pine', canopy: ['#3fae5a', '#2f8f4a'], fruit: '#e63b7a', goo: '#c2185b',
  }),
  'level-16': theme({
    skyTop: '#ff7b25', skyBottom: '#ffe9a8', fog: '#ffd98a', ground: '#3fb8c9', groundDark: '#2f9fb3',
    road: '#fff2c9', roadStyle: 'plain', kerbA: '#ffb627', kerbB: '#e2452f', under: '#b8651e',
    tunnelA: '#ffb627', tunnelB: '#e2452f', scenery: 'palm', canopy: ['#3fa84a', '#5cc25a'], fruit: '#ffb627', goo: '#f57f17',
  }),
  'level-17': theme({
    skyTop: '#22b8cf', skyBottom: '#e6fbff', fog: '#d1f4fa', ground: '#f5e3b0', groundDark: '#e0c98a',
    road: '#fbf3e0', kerbA: '#8a5a33', kerbB: '#ffffff', under: '#7a4f2e',
    tunnelA: '#8a5a33', tunnelB: '#f5efe0', scenery: 'palm', canopy: ['#3fa84a', '#2f8f3f'], fruit: '#8a5a33', goo: '#6d4c41',
  }),
  'level-18': theme({
    skyTop: '#2a1658', skyBottom: '#f06fb0', fog: '#b85aa8', ground: '#4a7f6a', groundDark: '#356a58',
    road: '#ffe3f3', roadStyle: 'tiles', roadLine: '#fff36b', kerbA: '#f06fb0', kerbB: '#7dffb0', under: '#5a2a7a',
    tunnelA: '#f06fb0', tunnelB: '#7dffb0', scenery: 'castle', canopy: ['#3f8f6a', '#57a87a'], fruit: '#f06fb0', goo: '#880e4f',
    cloud: '#f5c2e3', light: 0.78,
  }),
};
