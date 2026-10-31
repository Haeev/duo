import { describe, expect, it } from 'vitest';
import { createFixedStepper } from '../src/stepper';

describe('boucle à pas fixe', () => {
  it('compte les pas dus et garde le reste pour l’interpolation', () => {
    const s = createFixedStepper(60);
    expect(s.advance(10)).toBe(0);
    expect(s.alpha()).toBeCloseTo(0.6, 5);
    expect(s.advance(10)).toBe(1);
    expect(s.alpha()).toBeCloseTo(0.2, 5);
    expect(s.advance(1000 / 60) + s.advance(1000 / 60)).toBe(2);
  });

  it('fait 60 pas par seconde quel que soit le découpage du temps', () => {
    const s = createFixedStepper(60);
    let steps = 0;
    for (let i = 0; i < 1000; i++) steps += s.advance(1);
    expect(steps).toBe(60);
    const t = createFixedStepper(60);
    steps = 0;
    for (let i = 0; i < 70; i++) steps += t.advance(1000 / 70);
    expect(steps).toBe(60);
  });

  it('borne le rattrapage après un gel et repart de zéro après reset', () => {
    const s = createFixedStepper(60, 15);
    expect(s.advance(5000)).toBe(15);
    expect(s.alpha()).toBe(0);
    s.advance(8);
    s.reset();
    expect(s.alpha()).toBe(0);
    expect(s.advance(-5)).toBe(0);
    expect(s.advance(Number.NaN)).toBe(0);
    expect(() => createFixedStepper(0)).toThrow(RangeError);
  });
});
