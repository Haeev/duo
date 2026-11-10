/**
 * Passage sur le graphe des chemins (`map.graph`), pour les habitants et tout ce qui y circule:
 * une arête à verrou n'est passable que verrou ouvert. Les habitants s'en servent dans
 * `habitants/chemins.ts` (`findRoute`, paramètre `closed`).
 */
import type { PathGraph } from '../../donnees/schemas/lieu';
import { closedLocks, type PlaceLook } from './verrous';

type Edge = PathGraph['edges'][number];

/** Verrous fermés du lieu courant: ce que reçoit le calcul des trajets. */
export function closedLockSet(look: PlaceLook): ReadonlySet<string> {
  return closedLocks(look);
}

/** L'arête se parcourt-elle, verrous fermés `closed` ? */
export function edgePassable(edge: Edge, closed: ReadonlySet<string>): boolean {
  return edge.lock === null || !closed.has(edge.lock);
}
