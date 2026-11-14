"""Compose and synthesise the game's extra music tracks.

Each tune is built from a chord progression: a bass line, an arpeggio, drums and a melody made of short motifs
that repeat and vary. Everything is plain waveforms, chiptune style.

Run from the project root: python3 tools/music.py   (needs macOS afconvert to encode)
"""
import math
import random
import struct
import subprocess
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RATE = 32000
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def freq(semitones_from_a4):
    return 440.0 * 2 ** (semitones_from_a4 / 12)


def pitch(name, octave):
    """Frequency of a note such as ("F#", 4)."""
    base = NOTE[name[0]] + (1 if name.endswith("#") else -1 if name.endswith("b") else 0)
    return freq(base - 9 + (octave - 4) * 12)


def wave_at(shape, phase):
    p = phase % 1.0
    if shape == "square":
        return 1.0 if p < 0.5 else -1.0
    if shape == "pulse":
        return 1.0 if p < 0.25 else -1.0
    if shape == "saw":
        return 2.0 * p - 1.0
    if shape == "triangle":
        return 4.0 * abs(p - 0.5) - 1.0
    return math.sin(2 * math.pi * p)


class Mix:
    def __init__(self, seconds):
        self.data = [0.0] * int(seconds * RATE)

    def tone(self, start, length, hz, shape="square", volume=0.2, attack=0.005, release=0.06, vibrato=0.0, slide=1.0):
        i0 = int(start * RATE)
        n = int(length * RATE)
        phase = 0.0
        a = max(1, int(attack * RATE))
        r = max(1, int(release * RATE))
        for i in range(n):
            if i0 + i >= len(self.data):
                break
            t = i / RATE
            f = hz * (slide ** (i / n)) * (1 + vibrato * math.sin(2 * math.pi * 5.5 * t))
            phase += f / RATE
            env = min(1.0, i / a) * min(1.0, (n - i) / r)
            self.data[i0 + i] += wave_at(shape, phase) * volume * env

    def noise(self, start, length, volume=0.2, bright=1.0, rng=random):
        i0 = int(start * RATE)
        n = int(length * RATE)
        last = 0.0
        for i in range(n):
            if i0 + i >= len(self.data):
                break
            # A one-pole filter: lower `bright` makes a duller thud.
            last += (rng.uniform(-1, 1) - last) * bright
            self.data[i0 + i] += last * volume * (1 - i / n) ** 2

    def save(self, name):
        peak = max(abs(v) for v in self.data) or 1.0
        wav = ROOT / f"tools/{name}.wav"
        with wave.open(str(wav), "wb") as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(RATE)
            out.writeframes(b"".join(struct.pack("<h", int(v / peak * 0.85 * 32767)) for v in self.data))
        target = ROOT / f"public/assets/audio/{name}.m4a"
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "64000", str(wav), str(target)], check=True)
        wav.unlink()
        print(name, f"{len(self.data) / RATE:.0f}s", target.stat().st_size // 1024, "KB")


def compose(name, seed, bpm, chords, scale, lead="square", swing=0.0, drums="pop", bars_each=1, passes=8):
    """`chords` is a list of (root note, octave, [intervals]) per bar; `scale` the semitones the melody may use."""
    rng = random.Random(seed)
    beat = 60.0 / bpm
    bar = beat * 4
    bars = len(chords) * bars_each * passes
    mix = Mix(bars * bar + 1.0)

    def step(n):
        """Start time of the nth eighth-note in a bar, with swing."""
        return (n // 2) * beat + (beat * (0.5 + swing) if n % 2 else 0.0)

    # Two melodic motifs, eight eighth-notes each, as indexes into the scale (None is a rest).
    def motif():
        notes, at = [], rng.randrange(len(scale))
        for i in range(8):
            if i and rng.random() < 0.22:
                notes.append(None)
                continue
            at = max(0, min(len(scale) - 1, at + rng.choice([-2, -1, -1, 0, 1, 1, 2])))
            notes.append(at)
        return notes

    a, b = motif(), motif()
    form = [a, a, b, a]

    for index in range(bars):
        t0 = index * bar
        root, octave, shape = chords[(index // bars_each) % len(chords)]
        base = pitch(root, octave)
        # Four sections that come round twice: a sparse opening, the full band, and the tune an octave up.
        section = (index // (len(chords) * bars_each)) % 4

        # Bass: root and fifth, bouncing.
        for n in range(8):
            hz = base / 2 * (1.5 if n in (3, 7) else 2 if n == 5 else 1)
            mix.tone(t0 + step(n), beat * 0.42, hz, "triangle", 0.34)

        # Arpeggio through the chord, an octave up.
        if section != 0 or index % 2:
            for n in range(8):
                mix.tone(t0 + step(n), beat * 0.3, base * 2 ** (shape[n % len(shape)] / 12) * 2, "pulse", 0.07)

        # Soft held chord.
        for interval in shape:
            mix.tone(t0, bar * 0.96, base * 2 ** (interval / 12), "sine", 0.06, attack=0.05, release=0.3)

        # Melody: the motif moved onto this bar's chord, resting in the first pass's opening bars.
        if not (section == 0 and index < 2):
            phrase = form[index % 4]
            lift = 12 if section == 3 else 0
            for n, degree in enumerate(phrase):
                if degree is None:
                    continue
                semis = scale[degree] + lift
                long = n in (6,) or (n < 7 and phrase[n + 1] is None)
                mix.tone(t0 + step(n), beat * (0.9 if long else 0.44), pitch("C", 5) * 2 ** (semis / 12), lead, 0.15, vibrato=0.006 if long else 0)

        # Drums.
        for n in range(8):
            at = t0 + step(n)
            if drums != "soft" or n % 2 == 0:
                mix.noise(at, 0.04, 0.09 if n % 2 else 0.13, 0.9, rng)
            if n in (0, 4) or (drums == "pop" and n == 5 and index % 2):
                mix.tone(at, 0.16, 150, "sine", 0.5, slide=0.3)
            if n in (2, 6) and drums != "soft":
                mix.noise(at, 0.14, 0.26, 0.5, rng)
        if index % 4 == 3 and drums != "soft":
            for k in range(4):
                mix.noise(t0 + bar - beat + k * beat / 4, 0.08, 0.2, 0.6, rng)

    mix.save(name)


MAJOR = [0, 4, 7]
MINOR = [0, 3, 7]
PENTA = [0, 2, 4, 7, 9, 12, 14, 16]
MINOR_PENTA = [-3, 0, 2, 4, 7, 9, 12, 14]

# Sunny Skip: bright and bouncy, for the meadow.
compose("track3", 11, 132, [("C", 3, MAJOR), ("G", 3, MAJOR), ("A", 3, MINOR), ("F", 3, MAJOR)], PENTA, lead="square")
# Night Glide: slower and dreamy, for the night levels.
compose("track4", 23, 96, [("A", 3, MINOR), ("F", 3, MAJOR), ("C", 3, MAJOR), ("G", 3, MAJOR)], MINOR_PENTA, lead="triangle", drums="soft")
# Jungle Shuffle: a swung groove, for the tropics.
compose("track5", 37, 116, [("D", 3, MINOR), ("G", 3, MAJOR), ("C", 3, MAJOR), ("A", 3, MINOR)], PENTA, lead="pulse", swing=0.16)
# Turbo Pop: fast and busy.
compose("track6", 51, 152, [("F", 3, MAJOR), ("C", 3, MAJOR), ("D", 3, MINOR), ("A#", 2, MAJOR)], [-7, -5, -3, 0, 2, 5, 7, 9], lead="saw")
