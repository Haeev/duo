// Retour R09 (soirée du 2026-11-01): « la canne à pêche doit lancer la ligne plus loin: on la
// jette à nos pieds ». Le bouchon se pose loin dans l'eau, jamais sur la terre ni sur l'autre rive.
import { describe, expect, it } from 'vitest';
import { character } from '../src/simulation/contexte';
import { waterAhead } from '../src/simulation/peche';
import { contentAndMap, newSim } from './aides';

/** Distance minimale voulue entre le pêcheur et son bouchon (m; avant R09: environ 1 m). */
const FAR_ENOUGH = 2.5;

function cellIsWater(x: number, y: number): boolean {
  const { map } = contentAndMap();
  return map.ground[Math.floor(y) * map.width + Math.floor(x)] === 'water';
}

describe('distance du lancer (R09)', () => {
  const { map, content } = contentAndMap();
  const fishing = content.settings.fishing;
  const spots = Object.entries(map.points).filter(
    ([id]) => id.startsWith('fishing_') || id === 'riverbank',
  );

  it('la configuration fixe une distance visée, sous la portée', () => {
    expect(fishing).not.toBeNull();
    expect(fishing?.castDistance ?? 0).toBeGreaterThanOrEqual(FAR_ENOUGH);
    expect(fishing?.castDistance ?? 0).toBeLessThanOrEqual(fishing?.castRange ?? 0);
  });

  it('depuis chaque point de pêche, face à l’eau: bouchon à 2,5 m ou plus, dans l’eau', () => {
    expect(spots.length).toBeGreaterThan(0);
    const sim = newSim();
    const c = character(sim, 'p1');
    for (const [id, point] of spots) {
      // Face au sud ou au nord, vers la rivière (y de 38 à 42).
      c.pos = { x: point.x, y: point.y };
      c.facing = point.y < 40 ? Math.PI / 2 : -Math.PI / 2;
      const bobber = waterAhead(sim, c);
      expect(bobber, id).not.toBeNull();
      if (bobber === null) continue;
      expect(cellIsWater(bobber.x, bobber.y), `${id}: bouchon dans l'eau`).toBe(true);
      expect(Math.hypot(bobber.x - point.x, bobber.y - point.y), id).toBeGreaterThanOrEqual(
        FAR_ENOUGH,
      );
    }
  });

  it('n’atteint jamais l’autre rive: le bouchon reste en deçà de la fin de l’eau', () => {
    const sim = newSim();
    const c = character(sim, 'p1');
    const margin = fishing?.castShoreMargin ?? 0;
    for (let x = 22; x < 62; x += 1.5) {
      for (const y of [36.5, 37.5]) {
        c.pos = { x, y };
        c.facing = Math.PI / 2;
        const bobber = waterAhead(sim, c);
        if (bobber === null) continue;
        expect(cellIsWater(bobber.x, bobber.y)).toBe(true);
        // Encore de l'eau un peu plus loin (marge), sauf si le premier point d'eau était déjà au bout.
        const further = cellIsWater(bobber.x, bobber.y + margin * 0.5);
        expect(further, `x ${x}, y ${y}`).toBe(true);
      }
    }
  });
});
