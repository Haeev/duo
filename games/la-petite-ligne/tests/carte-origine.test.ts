/**
 * 0.13 (v0-13-carte.md, section 2): la carte agrandie a une origine de grille (`taille.origine`, x -24,
 * y -30). Tant que le lot L0 ne l'a pas apprise au rendu et à la simulation, la lecture la refuse: le jeu
 * garde la carte de secours et dit pourquoi, au lieu de lire toute la carte décalée de 24 et 30 cases.
 */
import { describe, expect, it } from 'vitest';
import { loadMap } from '../src/donnees/carte';
import { MAP_FILES } from '../src/donnees/cartes-fichiers';
import { LEVEL_MAP_FILE } from '../src/donnees/carte-niveau';

function withOrigin(origin: { x: number; y: number } | undefined): ReturnType<typeof loadMap> {
  const raw = structuredClone(MAP_FILES[LEVEL_MAP_FILE]) as { taille: Record<string, unknown> };
  if (origin === undefined) delete raw.taille.origine;
  else raw.taille.origine = origin;
  return loadMap({ [LEVEL_MAP_FILE]: raw });
}

describe("origine de la grille (0.13, avant le lot L0)", () => {
  it('lit la carte sans origine, et avec une origine nulle, comme avant', () => {
    expect(withOrigin(undefined).source).toBe('level');
    const zero = withOrigin({ x: 0, y: 0 });
    expect(zero.source).toBe('level');
    expect(zero.map.points.house_door).toEqual(withOrigin(undefined).map.points.house_door);
  });

  it("refuse une origine négative et garde la carte de secours, avec la raison", () => {
    const result = withOrigin({ x: -24, y: -30 });
    expect(result.source).toBe('fallback');
    expect(result.warning).toMatch(/origine de grille/);
  });
});
