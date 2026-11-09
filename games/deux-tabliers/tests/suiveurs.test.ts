// Retour de séance du 2026-11-09 (« PNJ dans le mur », 20 h 28): la seconde cliente d'un groupe de
// deux, à la caisse, se dessinait à moitié dans le mur est. Test court: les suiveurs restent hors
// des murs et des meubles, le long de toute la file.
import { describe, expect, it } from 'vitest';
import { queueLine, queueSpot } from '../src/clientele/places';
import { FOLLOWER_RADIUS, FOLLOWER_SIDE, followerSpot } from '../src/clientele/suiveurs';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import { furnitureObstacles, shellObstacles } from '../src/simulation/collisions';
import { pushOut, type Vec2 } from '../src/simulation/geometrie';
import { createWorld } from '../src/simulation/monde';

const content = loadContent(DATA_FILES);
const world = createWorld(content, ['a', 'b']);
const spacing = 0.6;

/** Le point touche-t-il un mur ou un meuble (même test que le rendu, rayon des épaules)? */
function touches(p: Vec2): boolean {
  for (const o of [...shellObstacles(content, world), ...furnitureObstacles(content, world)]) {
    const q = { x: p.x, z: p.z };
    if (pushOut(q, FOLLOWER_RADIUS - 0.01, o)) return true;
  }
  return false;
}

describe('suiveurs des groupes debout', () => {
  it('à la caisse, la seconde cliente reste hors du mur est (situation du retour)', () => {
    const reg = queueLine(content).register;
    // Ancienne règle: 30 cm à droite du meneur qui regarde la caisse (nord), un rang derrière.
    const old = { x: reg.x + FOLLOWER_SIDE, z: reg.z + spacing };
    expect(touches(old)).toBe(true);
    const out = followerSpot(content, world, { x: reg.x, z: reg.z, yawDeg: 0 }, 1, spacing, {
      x: 0,
      z: 0,
    });
    expect(touches(out)).toBe(false);
    // Toujours derrière son meneur, de l'autre côté (vers la salle).
    expect(out.z).toBeCloseTo(reg.z + spacing, 5);
    expect(out.x).toBeLessThan(reg.x);
  });

  it('tous les rangs de la file, groupes jusqu’à six: personne dans un mur ni un meuble', () => {
    const out = { x: 0, z: 0 };
    for (let row = 0; row < 4; row++) {
      const lead = queueSpot(content, row, spacing);
      for (let k = 1; k < 6; k++) {
        followerSpot(content, world, { ...lead, yawDeg: 0 }, k, spacing, out);
        expect(touches(out), `rang ${String(row)}, membre ${String(k)}`).toBe(false);
      }
    }
  });
});
