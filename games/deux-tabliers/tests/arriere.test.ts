// Réserve et cour (retour de séance: « la porte derrière le comptoir mène à une pièce buggée »).
// Tests courts: les cotes du rendu suivent le plan, et les murs arrêtent le joueur.
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import type { PlanElement } from '../src/donnees/schemas';
import * as C from '../src/rendu/arriere-cotes';
import { resolve } from '../src/simulation/deplacement';
import { createWorld } from '../src/simulation/monde';

const content = loadContent(DATA_FILES);
const elements = content.plan.levels[0]?.elements ?? [];

function element(id: string): PlanElement {
  const el = elements.find((e) => e.id === id);
  if (el === undefined) throw new Error(`élément ${id} absent du plan`);
  return el;
}

function rectOf(id: string): readonly [number, number, number, number] {
  const el = element(id);
  if (!('rect' in el.shape)) throw new Error(`${id} n'est pas un rectangle`);
  return el.shape.rect;
}

/** Marche en ligne droite par pas de 5 cm, repoussée par la coque et les meubles à chaque pas. */
function walkTo(
  from: { x: number; z: number },
  to: { x: number; z: number },
): { x: number; z: number } {
  const world = createWorld(content, ['a', 'b']);
  const p = { x: from.x, z: from.z };
  for (let i = 0; i < 400; i++) {
    const dx = to.x - p.x;
    const dz = to.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.01) break;
    const s = Math.min(0.05, d);
    p.x += (dx / d) * s;
    p.z += (dz / d) * s;
    resolve(content, world, p);
  }
  return p;
}

describe('Réserve et cour', () => {
  it('les cotes du rendu suivent le plan', () => {
    expect(rectOf('floor-4')).toEqual(C.RESERVE);
    expect(rectOf('door-5')).toEqual(C.DOOR_BACKBAR);
    expect(rectOf('door-2')).toEqual(C.DOOR_YARD);
    expect(rectOf('window-1')).toEqual(C.WINDOW_FOND);
    expect(element('window-1').sill).toBe(C.WINDOW_FOND_SILL);
    expect(rectOf('ground-1')).toEqual(C.YARD);
    expect(rectOf('partition-1')).toEqual(C.YARD_WALL_WEST);
    expect(rectOf('door-1')).toEqual(C.GATE);
    expect(rectOf('fixture-2')).toEqual(C.BINS);
    const fig = element('tree-2').shape;
    expect('circle' in fig && fig.circle.slice(0, 2)).toEqual([...C.FIG]);
    // Mur de la ruelle: ses deux tronçons et le portail couvrent x 11,5 à 11,7, z 0 à 3.
    const [ex, ez, ew, ed] = C.YARD_WALL_EAST;
    for (const id of ['partition-2', 'door-1', 'partition-3']) {
      const [x, z, w, d] = rectOf(id);
      expect([x, x + w]).toEqual([ex, ex + ew]);
      expect(z).toBeGreaterThanOrEqual(ez);
      expect(z + d).toBeLessThanOrEqual(ez + ed + 1e-9);
    }
    for (const id of ['partition-1', 'partition-2', 'partition-3'])
      expect(element(id).height).toBe(C.YARD_WALL_HEIGHT);
    // Vantaux ouverts de la porte de la cour: aux deux tableaux, 60 cm dans la réserve.
    const [dx, , dw] = C.DOOR_YARD;
    expect(rectOf('partition-9')[0]).toBe(dx);
    const [lx, , lw] = rectOf('partition-10');
    expect(lx + lw).toBeCloseTo(dx + dw, 9);
  });

  it('on va de l’arrière-comptoir à la cour par la réserve', () => {
    const behind = { x: 10.45, z: 7.6 };
    const a = walkTo(behind, { x: 10.45, z: 6.2 });
    expect(a.z).toBeCloseTo(6.2, 2);
    const b = walkTo(a, { x: 9.9, z: 6.2 });
    const c = walkTo(b, { x: 9.9, z: 1.5 });
    expect(c.x).toBeCloseTo(9.9, 2);
    expect(c.z).toBeCloseTo(1.5, 2);
  });

  it('murs de la cour, portail fermé et vantaux arrêtent le joueur', () => {
    const r = content.settings.player.radius;
    // Portail sur la ruelle fermé (on ne sort pas dans la ruelle).
    expect(walkTo({ x: 10.8, z: 1.4 }, { x: 13, z: 1.4 }).x).toBeLessThanOrEqual(11.5 - r + 1e-6);
    // Clôture du fond (bord du plan) et mur mitoyen ouest.
    expect(walkTo({ x: 5, z: 1.5 }, { x: 5, z: -2 }).z).toBeGreaterThanOrEqual(r - 1e-6);
    expect(walkTo({ x: 4, z: 1.5 }, { x: 0, z: 1.5 }).x).toBeGreaterThanOrEqual(2.1 + r - 1e-6);
    // On ne traverse ni la façade ni le vantail ouest ouvert.
    expect(walkTo({ x: 5, z: 1.5 }, { x: 5, z: 5 }).z).toBeLessThanOrEqual(3 - r + 1e-6);
    expect(walkTo({ x: 9.9, z: 3.8 }, { x: 8.5, z: 3.8 }).x).toBeGreaterThanOrEqual(
      9.34 + r - 1e-6,
    );
  });
});
