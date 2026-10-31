import { describe, expect, it } from 'vitest';
import type { SpatialDef } from './catalogue';
import { distanceGain, distanceToRect, earPosition, withinCull } from './espace';
import { dbToGain } from './reglages';

const STEP: SpatialDef = { model: 'inverse', refDistance: 2, rolloff: 1.3, maxDistance: 28, cullBeyond: 28, minGainDb: null };
const WHISTLE: SpatialDef = { model: 'inverse', refDistance: 15, rolloff: 0.5, maxDistance: 400, cullBeyond: 100000, minGainDb: -14 };

describe('écoute placée', () => {
  it('suit le modèle « inverse » de Web Audio', () => {
    expect(distanceGain(STEP, 0)).toBe(1);
    expect(distanceGain(STEP, 2)).toBe(1);
    // ref / (ref + rolloff * (d - ref)) = 2 / (2 + 1.3 * 8)
    expect(distanceGain(STEP, 10)).toBeCloseTo(2 / 12.4, 6);
  });

  it('garantit le plancher du sifflet (jamais sous -14 dB)', () => {
    expect(distanceGain(WHISTLE, 1000)).toBeCloseTo(dbToGain(-14), 6);
    expect(distanceGain(WHISTLE, 20)).toBeGreaterThan(dbToGain(-14));
  });

  it('ne lance pas un son au-delà de sa portée', () => {
    expect(withinCull(STEP, 27.9)).toBe(true);
    expect(withinCull(STEP, 28.1)).toBe(false);
  });

  it('pose l oreille derrière le personnage, vers le bas de l écran', () => {
    const ear = earPosition({ x: 10, y: 10 }, 0, 4, { x: 0, y: 0 });
    expect(ear.x).toBeCloseTo(6);
    expect(ear.y).toBeCloseTo(10);
  });

  it('mesure la distance à une zone de la carte', () => {
    const quay = { x: 21, y: 15, w: 30, h: 4 };
    expect(distanceToRect({ x: 30, y: 16 }, quay)).toBe(0);
    expect(distanceToRect({ x: 30, y: 22 }, quay)).toBe(3);
  });
});
