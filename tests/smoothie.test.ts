import { describe, expect, it } from 'vitest';
import { MAX_JUG, scoreSmoothie, SUPER_JUG } from '../src/core/smoothie';

const many = (id: string, n: number) => Array.from({ length: n }, () => id);

describe('scoreSmoothie', () => {
  it('scores an empty jug as zero', () => {
    expect(scoreSmoothie([]).points).toBe(0);
  });

  it('rewards more fruit', () => {
    expect(scoreSmoothie(many('apple', 5)).points).toBeGreaterThan(scoreSmoothie(many('apple', 2)).points);
  });

  it('rewards a key combination over a similar jug without one', () => {
    const pie = scoreSmoothie(['apple', 'cinnamon', 'oats']);
    const plain = scoreSmoothie(['apple', 'turmeric', 'poppy']);
    expect(pie.combos.map((c) => c.id)).toContain('apple-pie');
    expect(plain.combos).toHaveLength(0);
    expect(pie.points).toBeGreaterThan(plain.points);
  });

  it('prefers a varied jug to ten of the same extra', () => {
    const varied = scoreSmoothie(['apple', 'apple', 'apple', 'milk', 'oats', 'cinnamon', 'honey', 'almond', 'chia', 'yogurt']);
    expect(varied.points).toBeGreaterThan(scoreSmoothie(many('cinnamon', 10)).points);
  });

  it('marks down a jug with no fruit', () => {
    const noFruit = scoreSmoothie(['milk', 'oats', 'honey']);
    expect(noFruit.notes.some((n) => n.id === 'no-fruit')).toBe(true);
    expect(noFruit.points).toBeLessThan(scoreSmoothie(['apple', 'milk', 'oats', 'honey']).points);
  });

  it('only blends the first ten items', () => {
    expect(scoreSmoothie(many('apple', 14)).points).toBe(scoreSmoothie(many('apple', MAX_JUG)).points);
  });

  it('gives a rating from 1 to 5 and a name', () => {
    const result = scoreSmoothie(['apple', 'peanutbutter', 'milk']);
    expect(result.rating).toBeGreaterThanOrEqual(1);
    expect(result.rating).toBeLessThanOrEqual(5);
    expect(result.name.length).toBeGreaterThan(3);
  });
});

describe('ratings', () => {
  it('keeps Legendary for something special: a good full jug with three recipes is only Delicious', () => {
    const jug = ['strawberry', 'strawberry', 'strawberry', 'banana', 'banana', 'peach', 'peach', 'yogurt', 'milk', 'honey'];
    const result = scoreSmoothie(jug);
    expect(result.combos.length).toBeGreaterThanOrEqual(3);
    expect(result.rating).toBe(4);
  });
});

describe('the super blender', () => {
  const fruits = ['apple', 'banana', 'strawberry', 'orange', 'grape', 'pear', 'kiwi', 'cherry'];

  it('blends up to twenty things', () => {
    const jug = [...many('apple', 12), ...many('milk', 12)];
    expect(scoreSmoothie(jug, SUPER_JUG).points).toBeGreaterThan(scoreSmoothie(jug).points);
    expect(scoreSmoothie(jug, SUPER_JUG).points).toBe(scoreSmoothie(jug.slice(0, SUPER_JUG), SUPER_JUG).points);
  });

  it('has recipes only it can make', () => {
    const jug = [...fruits, 'milk', 'honey'];
    expect(scoreSmoothie(jug).combos.map((c) => c.id)).not.toContain('rainbow');
    expect(scoreSmoothie(jug, SUPER_JUG).combos.map((c) => c.id)).toContain('rainbow');
  });

  it('expects more of a smoothie before calling it Legendary', () => {
    const jug = [...fruits, 'milk', 'honey'];
    const points = scoreSmoothie(jug).points;
    expect(points).toBeGreaterThan(420);
    expect(scoreSmoothie(jug).rating).toBeGreaterThanOrEqual(4);
    // The same score would be Delicious in the ordinary jug, but twenty slots raise the bar.
    const plain = scoreSmoothie([...many('apple', 4), 'milk', 'oats', 'honey'], SUPER_JUG);
    expect(plain.rating).toBeLessThan(scoreSmoothie([...many('apple', 4), 'milk', 'oats', 'honey']).rating);
  });
});
