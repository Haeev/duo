// Planification de la marche des parcours à deux (`tests/aides-e2e/prologue.ts`): après une porte,
// le joueur arrive au bord de la case de cette porte. Un trajet tracé depuis cette case longeait
// le seuil, et le premier pas du robot faisait repasser la porte (parcours D1, 2026-11-11: hôte
// ressorti du fournil dans la rue). Test court sur la carte livrée d'Aubrune.
import { describe, expect, it } from 'vitest';
import { doorChain } from '../src/simulation/lieux/traversee';
import { doorCells, loadMapWithInteriors } from './aides-e2e/contenu';
import { planPath } from './aides-e2e/prologue';
import { gameContent } from './aides';

const MAP = loadMapWithInteriors('aubrune');
/** Devant le fournil, dans la rue, et devant son comptoir (comme le parcours D1). */
const STREET = { x: 232.5, y: 107.6 };
const COUNTER = { x: 73.6, y: 213.5 };

/** Où le jeu pose le joueur qui entre au fournil: devant la porte, côté pièce. */
function arrival(): { x: number; y: number } {
  const place = gameContent().places.aubrune;
  if (place === undefined) throw new Error('lieu « aubrune » absent');
  const hop = doorChain(place, STREET.x, STREET.y, COUNTER.x, COUNTER.y)?.at(-1);
  if (hop === undefined) throw new Error('aucune porte entre la rue et le fournil');
  return { x: hop.toX, y: hop.toY };
}

describe('marche des parcours: départ d’une case de porte', () => {
  it('le jeu pose le joueur au bord de la case de la porte du fournil', () => {
    const at = arrival();
    const door = doorCells(MAP).find((d) => Math.hypot(d.x - at.x, d.y - at.y) < 1);
    expect(door, 'porte du fournil côté pièce').toBeDefined();
    // Le relevé du parcours: 71,50; 214,00, sur la case même de la porte (71; 214).
    expect(Math.floor(at.x)).toBe(Math.floor(door?.x ?? 0));
    expect(Math.floor(at.y)).toBe(Math.floor(door?.y ?? 0));
  });

  it('sans la règle, la première étape longe le seuil (le défaut relevé)', () => {
    const at = arrival();
    const path = planPath(MAP, at, COUNTER, doorCells(MAP));
    expect(path?.[0]?.y, 'première étape sur le rang de la porte').toBeGreaterThan(at.y);
  });

  it('avec la règle, le trajet part vers la pièce et ne repasse ni par le rang ni par l’axe de la porte', () => {
    const at = arrival();
    const path = planPath(MAP, at, COUNTER, doorCells(MAP), { leaveAvoided: true });
    expect(path).not.toBeNull();
    expect(path?.[0]?.y, 'première étape vers la pièce').toBeLessThan(at.y);
    for (const step of path ?? []) {
      expect(step.y, 'hors du rang de la porte').toBeLessThan(at.y);
      // Une étape dans l'axe de la porte ferait revenir dos à la pièce un joueur qui l'a dépassée.
      expect(Math.abs(step.x - at.x), 'hors de l’axe de la porte').toBeGreaterThan(0.5);
    }
    expect(path?.at(-1)).toEqual(COUNTER);
  });

  it('hors d’une case de porte, le trajet ne change pas', () => {
    const from = { x: 70.5, y: 211.5 };
    expect(planPath(MAP, from, COUNTER, doorCells(MAP), { leaveAvoided: true })).toEqual(
      planPath(MAP, from, COUNTER, doorCells(MAP)),
    );
  });
});
