import { describe, expect, it } from 'vitest';
import { RENDER_SETTINGS } from './reglages';
import { trainOffset } from './voie';

const STEPS = 50;
/** Pente maximale des courbes d'accélération cubiques. */
const CUBIC_SLOPE = 3;

/** Positions du train à chaque pas d'une phase, `progress` évoluant comme dans la simulation. */
function positions(phase: 'arriving' | 'departing'): number[] {
  const out: number[] = [];
  for (let i = 0; i <= STEPS; i += 1) {
    const t = i / STEPS;
    out.push(trainOffset(phase, phase === 'arriving' ? t : 1 - t));
  }
  return out;
}

describe('glissement du train', () => {
  const side = RENDER_SETTINGS.train.sideDirection;
  const distance = RENDER_SETTINGS.train.slideDistance;

  it('arrive du côté de la voie prévu et s’arrête au quai, sans revenir en arrière', () => {
    const xs = positions('arriving');
    expect(xs[0]).toBeCloseTo(side * distance, 6);
    expect(xs[xs.length - 1]).toBeCloseTo(0, 6);
    for (let i = 1; i < xs.length; i += 1) {
      // Toujours vers le quai: la distance au quai ne fait que diminuer.
      expect(Math.abs(xs[i] ?? 0)).toBeLessThanOrEqual(Math.abs(xs[i - 1] ?? 0) + 1e-9);
    }
  });

  it('part du quai sans saut et s’éloigne de façon monotone, vers l’ouest comme le son', () => {
    const xs = positions('departing');
    expect(xs[0]).toBeCloseTo(0, 6);
    expect(xs[xs.length - 1]).toBeCloseTo(side * distance, 6);
    expect(side).toBe(-1);
    for (let i = 1; i < xs.length; i += 1) {
      expect(Math.abs(xs[i] ?? 0)).toBeGreaterThanOrEqual(Math.abs(xs[i - 1] ?? 0) - 1e-9);
      expect(Math.sign(xs[i] ?? 0)).not.toBe(-side);
    }
    // Pas de saut: le premier pas est minuscule (le train démarre doucement), et aucun pas ne
    // dépasse la pente maximale d'une courbe cubique (trois fois le pas moyen).
    expect(Math.abs(xs[1] ?? 0)).toBeLessThan(distance / STEPS);
    for (let i = 1; i < xs.length; i += 1) {
      expect(Math.abs((xs[i] ?? 0) - (xs[i - 1] ?? 0))).toBeLessThanOrEqual(
        (CUBIC_SLOPE * distance) / STEPS + 1e-9,
      );
    }
  });

  it('n’est pas dessiné une fois parti, et reste au quai à l’arrêt', () => {
    expect(Number.isNaN(trainOffset('away', 0))).toBe(true);
    expect(trainOffset('stopped', 1)).toBe(0);
  });
});
