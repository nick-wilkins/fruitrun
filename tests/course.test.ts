import { describe, expect, it } from 'vitest';
import { buildAppleOrchard } from '../src/game/course';
import { STEP } from '../src/game/track';

const course = buildAppleOrchard();
const { track } = course;

describe('Apple Orchard course', () => {
  it('keeps every frame square', () => {
    for (const f of track.frames) {
      expect(Math.abs(f.t.length() - 1)).toBeLessThan(1e-4);
      expect(Math.abs(f.t.dot(f.u))).toBeLessThan(1e-4);
      expect(Math.abs(f.r.dot(f.u))).toBeLessThan(1e-4);
    }
  });

  it('never passes through itself', () => {
    const frames = track.frames;
    let closest = Infinity;
    let where = '';
    for (let i = 0; i < frames.length; i += 2) {
      for (let j = i + Math.round(50 / STEP); j < frames.length; j += 2) {
        const d = frames[i].p.distanceTo(frames[j].p);
        if (d < closest) {
          closest = d;
          where = `s=${i * STEP} and s=${j * STEP}`;
        }
      }
    }
    expect(closest, where).toBeGreaterThan(11.5);
  });

  it('places every object on the road before the finish', () => {
    for (const o of course.objects) {
      expect(o.s).toBeGreaterThan(10);
      expect(o.s).toBeLessThan(course.finishS - 5);
      expect(Math.abs(o.x) + (o.amp ?? 0)).toBeLessThanOrEqual(track.half - 0.8);
    }
  });
});
