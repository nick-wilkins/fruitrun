import { describe, expect, it } from 'vitest';
import { createGoes } from '../goes.mjs';

const now = new Date('2026-11-23T12:00:00Z');
const today = '2026-11-23';

describe('three goes a day on the website', () => {
  it('gives an address three goes, then no more that day', () => {
    const goes = createGoes();
    expect(goes.left('1.2.3.4', today, now)).toBe(3);
    expect(goes.take('1.2.3.4', today, now)).toEqual({ ok: true, left: 2 });
    expect(goes.take('1.2.3.4', today, now)).toEqual({ ok: true, left: 1 });
    expect(goes.take('1.2.3.4', today, now)).toEqual({ ok: true, left: 0 });
    expect(goes.take('1.2.3.4', today, now)).toEqual({ ok: false, left: 0 });
    expect(goes.left('1.2.3.4', today, now)).toBe(0);
  });

  it('counts each address by itself', () => {
    const goes = createGoes();
    for (let i = 0; i < 3; i++) goes.take('1.2.3.4', today, now);
    expect(goes.take('5.6.7.8', today, now)).toEqual({ ok: true, left: 2 });
  });

  it('starts afresh on the next day', () => {
    const goes = createGoes();
    for (let i = 0; i < 3; i++) goes.take('1.2.3.4', today, now);
    expect(goes.take('1.2.3.4', '2026-11-24', new Date('2026-11-24T09:00:00Z'))).toEqual({ ok: true, left: 2 });
  });

  it('takes the visitor\'s own date, a day either side of the server\'s, and nothing else', () => {
    const goes = createGoes();
    expect(goes.left('1.2.3.4', '2026-11-22', now)).toBe(3);
    expect(goes.left('1.2.3.4', '2026-11-24', now)).toBe(3);
    expect(goes.left('1.2.3.4', '2026-11-25', now)).toBeNull();
    expect(goes.take('1.2.3.4', '2027-01-01', now)).toBeNull();
    expect(goes.take('1.2.3.4', 'tomorrow', now)).toBeNull();
  });

  it('keeps no address as it came, and forgets days gone by', () => {
    const goes = createGoes();
    goes.take('1.2.3.4', today, now);
    expect(JSON.stringify(goes.held())).not.toContain('1.2.3.4');
    goes.tidy(new Date('2026-11-24T23:00:00Z'));
    expect(goes.held().map(([day]) => day)).toEqual([today]);
    goes.tidy(new Date('2026-11-25T00:00:01Z'));
    expect(goes.held()).toEqual([]);
  });
});
