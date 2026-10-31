import { describe, expect, it } from 'vitest';
import { createRandom, deriveSeed } from '../src/random';

describe('aléa à graine', () => {
  it('donne la même suite pour la même graine, figée par ces valeurs', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const suite = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(suite);
    // Valeurs de référence: un changement d'algorithme casserait les parties en lockstep et les tests des jeux.
    expect(createRandom(1).getState()).toMatchInlineSnapshot(`
      [
        2527132011,
        314344336,
        2535364964,
        2041432039,
      ]
    `);
    const ref = createRandom(1);
    expect([ref.int(0, 1_000_000), ref.int(0, 1_000_000), ref.next()]).toMatchInlineSnapshot(`
      [
        136890,
        861191,
        0.5877782991155982,
      ]
    `);
    expect(suite.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('reprend exactement depuis un état sauvegardé', () => {
    const a = createRandom(7);
    a.next();
    a.next();
    const state = a.getState();
    const suite = [a.next(), a.int(0, 100), a.float(-1, 1)];
    const b = createRandom(state);
    expect([b.next(), b.int(0, 100), b.float(-1, 1)]).toEqual(suite);
    const c = createRandom(0);
    c.setState(state);
    expect(c.next()).toBe(suite[0]);
  });

  it('tire des entiers dans [min, max) et couvre tout l’intervalle', () => {
    const r = createRandom(3);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const x = r.int(-2, 3);
      expect(Number.isInteger(x) && x >= -2 && x < 3).toBe(true);
      seen.add(x);
    }
    expect([...seen].sort((x, y) => x - y)).toEqual([-2, -1, 0, 1, 2]);
    expect(() => r.int(3, 3)).toThrow(RangeError);
    expect(() => r.pick([])).toThrow(RangeError);
  });

  it('mélange en gardant les éléments, et dérive des flux indépendants par libellé', () => {
    const r = createRandom(9);
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect([...r.shuffle([...items])].sort((x, y) => x - y)).toEqual(items);
    expect(deriveSeed(9, 'meteo')).toBe(deriveSeed(9, 'meteo'));
    expect(deriveSeed(9, 'meteo')).not.toBe(deriveSeed(9, 'village'));
    expect(createRandom(deriveSeed(9, 'meteo')).next()).not.toBe(createRandom(9).next());
  });
});
