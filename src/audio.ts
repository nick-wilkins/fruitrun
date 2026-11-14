/** Sound kit: effects are synthesised from oscillators and noise, music is a short playlist on repeat. */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let music: HTMLAudioElement | null = null;
let wantMusic = false;
let musicGain: GainNode | null = null;
let duckTimer = 0;

const SFX_VOLUME = 0.8;
const MUSIC_VOLUME = 0.32;

function audio(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    // A compressor keeps layered effects loud without clipping.
    const squash = ctx.createDynamicsCompressor();
    squash.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = SFX_VOLUME;
    master.connect(squash);
  }
  // iPads ignore an audio element's own volume, so the music is turned down inside the audio graph instead.
  if (music && !musicGain) {
    musicGain = ctx.createGain();
    musicGain.gain.value = MUSIC_VOLUME;
    ctx.createMediaElementSource(music).connect(musicGain).connect(ctx.destination);
    music.volume = 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function syncMusic(): void {
  if (!music) return;
  if (wantMusic && !muted && !document.hidden) void music.play().catch(() => {});
  else music.pause();
}

export function setMuted(value: boolean): void {
  muted = value;
  if (master) master.gain.value = value ? 0 : SFX_VOLUME;
  syncMusic();
}

/** Browsers only allow sound after a tap or key press, so call this from every early one. */
export function unlockAudio(): void {
  audio();
  syncMusic();
}

/** Start the soundtrack: the tracks play in turn, for ever. It begins on the first tap if the browser is not ready yet. */
export function startMusic(urls: string[]): void {
  if (!music) {
    let playing = 0;
    const player = new Audio(urls[0]);
    player.volume = MUSIC_VOLUME;
    player.preload = 'auto';
    player.addEventListener('ended', () => {
      playing = (playing + 1) % urls.length;
      player.src = urls[playing];
      syncMusic();
    });
    music = player;
    document.addEventListener('visibilitychange', syncMusic);
  }
  wantMusic = true;
  syncMusic();
}

/** Turn the music down while something noisy happens, then bring it back. */
function duck(seconds: number): void {
  const level = (value: number) => {
    if (musicGain) musicGain.gain.value = value;
    else if (music) music.volume = value;
  };
  level(MUSIC_VOLUME * 0.35);
  // One timer only: a second duck extends the first rather than being cut short by it.
  clearTimeout(duckTimer);
  duckTimer = window.setTimeout(() => level(MUSIC_VOLUME), seconds * 1000);
}

interface ToneOptions {
  type?: OscillatorType;
  volume?: number;
  delay?: number;
  /** Glide to this frequency over the note. */
  to?: number;
  /** Wobble the pitch: [speed in Hz, depth in Hz]. */
  wobble?: [number, number];
}

function tone(freq: number, length: number, options: ToneOptions = {}): void {
  const a = audio();
  if (!a || !master) return;
  const { type = 'sine', volume = 0.3, delay = 0, to, wobble } = options;
  const start = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + length);
  if (wobble) {
    const lfo = a.createOscillator();
    const depth = a.createGain();
    lfo.frequency.value = wobble[0];
    depth.gain.value = wobble[1];
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(start);
    lfo.stop(start + length + 0.03);
  }
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + length + 0.03);
}

function noise(length: number, volume: number, cutoff: number, delay = 0, sweepTo?: number, kind: BiquadFilterType = 'lowpass'): void {
  const a = audio();
  if (!a || !master) return;
  const start = a.currentTime + delay;
  const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * length), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = a.createBufferSource();
  source.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = kind;
  filter.frequency.setValueAtTime(cutoff, start);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, start + length);
  const gain = a.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  source.connect(filter).connect(gain).connect(master);
  source.start(start);
}

/** Play notes one after another. */
function run(notes: number[], gap: number, length: number, options: ToneOptions = {}): void {
  notes.forEach((f, i) => tone(f, length, { ...options, delay: (options.delay ?? 0) + i * gap }));
}

// Pickups collected in quick succession climb a scale, so a good line sounds like a tune.
const SCALE = [523, 587, 659, 784, 880, 1047, 1175, 1319];
let streak = 0;
let lastPickup = 0;

export const sfx = {
  tap: () => {
    tone(620, 0.07, { type: 'triangle', volume: 0.22 });
    tone(930, 0.05, { type: 'sine', volume: 0.12, delay: 0.03 });
  },
  /** 3, 2, 1. */
  tick: () => {
    tone(440, 0.22, { type: 'square', volume: 0.2 });
    tone(880, 0.22, { type: 'sine', volume: 0.16 });
    noise(0.05, 0.12, 3000);
  },
  go: () => {
    run([660, 880, 1320], 0.07, 0.5, { type: 'square', volume: 0.2 });
    tone(1320, 0.7, { type: 'sawtooth', volume: 0.1, delay: 0.14, wobble: [9, 14] });
    noise(0.5, 0.2, 800, 0.1, 6000, 'highpass');
  },
  pickup: () => {
    const now = performance.now();
    streak = now - lastPickup < 2200 ? Math.min(streak + 1, SCALE.length - 1) : 0;
    lastPickup = now;
    const note = SCALE[streak];
    tone(note, 0.1, { type: 'triangle', volume: 0.32 });
    tone(note * 1.5, 0.16, { type: 'triangle', volume: 0.3, delay: 0.06 });
    tone(note * 2, 0.22, { type: 'sine', volume: 0.2, delay: 0.12 });
    noise(0.12, 0.06, 6000, 0.02, 9000, 'highpass');
  },
  ring: () => {
    tone(1175, 0.45, { volume: 0.3 });
    tone(1760, 0.5, { volume: 0.2, delay: 0.04 });
    tone(2349, 0.4, { volume: 0.1, delay: 0.08 });
  },
  /** Speed pad: a whoosh with a rising zip. */
  boost: () => {
    tone(220, 0.45, { type: 'sawtooth', volume: 0.18, to: 1320 });
    tone(330, 0.45, { type: 'square', volume: 0.08, to: 1980 });
    noise(0.55, 0.3, 500, 0, 7000, 'bandpass');
    run([784, 988, 1175, 1568], 0.045, 0.12, { type: 'triangle', volume: 0.16, delay: 0.05 });
  },
  hit: () => {
    noise(0.3, 0.6, 1100, 0, 100);
    tone(160, 0.25, { type: 'square', volume: 0.26, to: 55 });
    noise(0.08, 0.3, 3500, 0.02);
  },
  pin: () => {
    tone(1100 + Math.random() * 500, 0.08, { type: 'square', volume: 0.14, to: 600 });
    noise(0.05, 0.14, 4000);
  },
  squelch: () => {
    noise(0.16, 0.2, 420, 0, 150);
    tone(140, 0.14, { volume: 0.14, to: 80, wobble: [30, 20] });
  },
  fork: () => run([523, 784], 0.08, 0.16, { type: 'triangle', volume: 0.22 }),
  jump: () => {
    tone(300, 0.35, { volume: 0.3, to: 990 });
    tone(450, 0.3, { type: 'triangle', volume: 0.14, to: 1480, delay: 0.03 });
  },
  land: () => {
    noise(0.14, 0.34, 380);
    tone(110, 0.12, { volume: 0.2, to: 60 });
  },
  finish: () => {
    duck(2.4);
    run([523, 659, 784, 1047, 784, 1047, 1319], 0.12, 0.3, { type: 'triangle', volume: 0.3 });
    run([262, 330, 392, 523], 0.12, 0.5, { type: 'square', volume: 0.1 });
    tone(1568, 0.9, { volume: 0.2, delay: 0.84, wobble: [7, 10] });
    noise(1.2, 0.1, 5000, 0.8, 9000, 'highpass');
  },
  star: (n: number) => {
    tone(660 + n * 110, 0.25, { type: 'triangle', volume: 0.32 });
    tone(1320 + n * 220, 0.3, { volume: 0.16, delay: 0.03 });
  },
  /** Blender motor: winds up, growls with a wobble, chops, and winds down. */
  blend: (seconds: number) => {
    duck(seconds + 0.4);
    tone(70, seconds, { type: 'sawtooth', volume: 0.24, to: 210, wobble: [17, 12] });
    tone(141, seconds, { type: 'square', volume: 0.08, to: 420, wobble: [23, 20] });
    noise(seconds, 0.24, 500, 0, 3200, 'bandpass');
    for (let t = 0.15; t < seconds - 0.2; t += 0.09 + Math.random() * 0.08) noise(0.05, 0.14, 1800 + Math.random() * 2000, t);
    tone(210, 0.35, { type: 'sawtooth', volume: 0.14, to: 50, delay: seconds });
  },
  sip: (seconds: number) => {
    duck(seconds);
    for (let t = 0; t < seconds; t += 0.1) tone(190 + Math.random() * 150, 0.09, { volume: 0.2, delay: t, to: 120 + Math.random() * 60 });
    noise(seconds, 0.09, 800);
  },
  yuck: () => {
    tone(330, 0.55, { type: 'sawtooth', volume: 0.22, to: 85, wobble: [11, 18] });
    tone(140, 0.35, { type: 'square', volume: 0.14, to: 70, delay: 0.32 });
  },
  reveal: (rating: number) => {
    const notes = [392, 494, 587, 784, 988].slice(0, Math.max(2, rating));
    run(notes, 0.12, 0.32, { type: 'triangle', volume: 0.3 });
    if (rating >= 4) tone(notes[notes.length - 1] * 2, 0.8, { volume: 0.16, delay: notes.length * 0.12, wobble: [7, 12] });
    if (rating === 5) noise(1, 0.1, 5000, 0.5, 9000, 'highpass');
  },
  /** Turbo pad: a rocket taking off. */
  turbo: () => {
    duck(1.6);
    tone(110, 1.3, { type: 'sawtooth', volume: 0.3, to: 1760 });
    tone(165, 1.3, { type: 'square', volume: 0.12, to: 2640, wobble: [14, 30] });
    noise(1.5, 0.4, 300, 0, 9000, 'bandpass');
    run([523, 659, 784, 1047, 1319, 1568], 0.05, 0.14, { type: 'triangle', volume: 0.2, delay: 0.1 });
  },
  /** Flung off the end of the road. */
  launch: () => {
    tone(260, 0.6, { volume: 0.32, to: 1400 });
    tone(390, 0.5, { type: 'triangle', volume: 0.16, to: 2100, delay: 0.04 });
    noise(0.7, 0.26, 400, 0, 6000, 'bandpass');
  },
  /** Escalator: a ratchety climb. */
  lift: () => {
    for (let i = 0; i < 14; i++) tone(300 + i * 28, 0.05, { type: 'square', volume: 0.1, delay: i * 0.11 });
  },
  nope: () => tone(210, 0.2, { type: 'square', volume: 0.16, to: 130 }),
};
