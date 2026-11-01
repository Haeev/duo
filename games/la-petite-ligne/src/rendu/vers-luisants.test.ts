import { describe, expect, it } from 'vitest';
import { glowUnit } from './vers-luisants';

describe('vers luisants: tirages', () => {
  it('tire toujours dans [0, 1[ (le hachage finissait sur un entier signé: un tirage sur deux était négatif)', () => {
    let low = 1;
    for (const seed of [1, 7, 42, 20_261_030]) {
      for (let i = 0; i < 600; i += 1) {
        for (const salt of [3, 5, 7, 11, 13, 41, 43, 47]) {
          const u = glowUnit(seed, i, salt);
          expect(u).toBeGreaterThanOrEqual(0);
          expect(u).toBeLessThan(1);
          low = Math.min(low, u);
        }
      }
    }
    expect(low).toBeLessThan(0.01);
  });
});
