/** Tiny synthesised sound kit: no audio files, everything is oscillators and noise. */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function audio(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setMuted(value: boolean): void {
  muted = value;
  if (master) master.gain.value = value ? 0 : 0.5;
}

/** Browsers only allow sound after a tap, so call this from the first one. */
export function unlockAudio(): void {
  audio();
}

function tone(freq: number, length: number, type: OscillatorType = 'sine', volume = 0.3, delay = 0, slideTo?: number): void {
  const a = audio();
  if (!a || !master) return;
  const start = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + length);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + length + 0.03);
}

function noise(length: number, volume: number, cutoff: number, delay = 0, sweepTo?: number): void {
  const a = audio();
  if (!a || !master) return;
  const start = a.currentTime + delay;
  const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * length), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = a.createBufferSource();
  source.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, start);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, start + length);
  const gain = a.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  source.connect(filter).connect(gain).connect(master);
  source.start(start);
}

export const sfx = {
  tap: () => tone(520, 0.08, 'triangle', 0.2),
  tick: () => tone(440, 0.14, 'square', 0.16),
  go: () => {
    tone(660, 0.12, 'square', 0.18);
    tone(990, 0.3, 'square', 0.18, 0.1);
  },
  pickup: () => {
    tone(880, 0.09, 'triangle', 0.3);
    tone(1320, 0.14, 'triangle', 0.3, 0.07);
  },
  ring: () => {
    tone(1175, 0.1, 'sine', 0.3);
    tone(1568, 0.22, 'sine', 0.3, 0.06);
  },
  boost: () => {
    tone(260, 0.4, 'sawtooth', 0.14, 0, 1040);
    noise(0.4, 0.14, 600, 0, 5000);
  },
  hit: () => {
    noise(0.28, 0.5, 900, 0, 120);
    tone(150, 0.2, 'square', 0.2, 0, 60);
  },
  jump: () => tone(330, 0.3, 'sine', 0.26, 0, 880),
  land: () => noise(0.12, 0.25, 420),
  finish: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.28, 'triangle', 0.28, i * 0.11)),
  star: (n: number) => tone(660 + n * 110, 0.22, 'triangle', 0.3),
  blend: (seconds: number) => {
    tone(90, seconds, 'sawtooth', 0.16, 0, 240);
    noise(seconds, 0.2, 500, 0, 2600);
  },
  reveal: (rating: number) => {
    const notes = [392, 494, 587, 784, 988].slice(0, Math.max(2, rating));
    notes.forEach((f, i) => tone(f, 0.3, 'triangle', 0.3, i * 0.12));
  },
  sip: (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.11) tone(180 + Math.random() * 140, 0.09, 'sine', 0.16, t, 120 + Math.random() * 60);
    noise(seconds, 0.07, 700);
  },
  yuck: () => {
    tone(320, 0.5, 'sawtooth', 0.2, 0, 90);
    tone(140, 0.3, 'square', 0.12, 0.3, 70);
  },
  nope: () => tone(200, 0.18, 'square', 0.14, 0, 140),
};
