import { describe, expect, it } from 'vitest';
import { RENDER_SETTINGS } from './reglages';
import { bankProfile, createRiverField, type RiverCell } from './riviere';

const T = RENDER_SETTINGS.terrain;

/**
 * Petite rivière d'essai, à l'image de la carte: herbe (y < 2), berge (y 2),
 * eau (y 3 à 5) avec une langue de sable (x 10 à 13, y 3), berge (y 6), herbe;
 * un gué de x 20 à 22.
 */
function cellAt(cx: number, cy: number): RiverCell {
  if (cy < 2 || cy > 6) return 'land';
  if (cx >= 20 && cx <= 22 && cy >= 3 && cy <= 5) return 'ford';
  if (cy === 2 || cy === 6) return 'bank';
  if (cy === 3 && cx >= 10 && cx <= 13) return 'bank';
  return 'water';
}

const field = createRiverField(cellAt, 0, 32, 2, 7);
const bed = (x: number, y: number): number => field.bedAt(x, y) ?? Number.NaN;

describe('lit de la rivière', () => {
  it('garde au sec les cases de berge, où l’on marche', () => {
    for (let x = 0.05; x < 32; x += 0.25) {
      for (const y of [2.05, 2.5, 2.95, 6.05, 6.5, 6.95]) {
        if (cellAt(Math.floor(x), Math.floor(y)) === 'bank') {
          expect(bed(x, y)).toBeGreaterThanOrEqual(T.waterSurface);
        }
      }
    }
  });

  it('rejoint l’herbe à sa hauteur (aucune marche au bord du lit)', () => {
    for (let x = 0.5; x < 32; x += 1) {
      expect(bed(x, 2)).toBeCloseTo(T.heights.grass, 3);
      expect(bed(x, 7)).toBeCloseTo(T.heights.grass, 3);
    }
  });

  it('pose une ligne d’eau qui ondule au lieu de suivre le bord des cases', () => {
    const crossings: number[] = [];
    for (let x = 1.5; x < 9; x += 0.5) {
      let y = 3;
      while (y < 4.5 && bed(x, y) >= T.waterSurface) y += 0.02;
      crossings.push(y);
    }
    // La ligne d'eau reste dans les cases d'eau, à une distance variable du bord.
    expect(Math.min(...crossings)).toBeGreaterThan(3);
    expect(Math.max(...crossings) - Math.min(...crossings)).toBeGreaterThan(0.1);
  });

  it('arrondit le bout de la langue de sable (pas d’angle droit)', () => {
    // Devant le coin saillant (14, 4), à 0,3 m en x et en y, on est plus loin du sable
    // (0,42 m) qu'à 0,3 m du côté droit: le lit y est plus bas, la rive tourne en arc.
    expect(bed(14.3, 4.3)).toBeLessThan(bed(12.5, 4.3) - 0.01);
  });

  it('met le gué 8 cm sous la surface, et le fond reste plus bas ailleurs', () => {
    expect(T.waterSurface - bed(21.5, 4.5)).toBeGreaterThan(0.05);
    expect(T.waterSurface - bed(21.5, 4.5)).toBeLessThan(0.11);
    expect(bed(5.5, 4.5)).toBeLessThan(bed(21.5, 4.5));
    expect(field.riffle[0]).toBe(0);
  });

  it('a un profil continu: dessus de berge, surface à la ligne d’eau, fond', () => {
    expect(bankProfile(0, 0.4, 0)).toBe(0);
    expect(bankProfile(0.4, 0.4, 0)).toBeCloseTo(T.waterSurface, 6);
    expect(bankProfile(10, 0.4, 0)).toBeCloseTo(T.heights.water, 6);
    expect(bankProfile(0.399, 0.4, 0)).toBeCloseTo(bankProfile(0.401, 0.4, 0), 2);
  });
});
