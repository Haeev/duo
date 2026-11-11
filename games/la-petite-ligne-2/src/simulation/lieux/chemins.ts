/**
 * Passage sur le graphe des chemins (`map.graph`), pour les habitants et tout ce qui y circule:
 * une arête à verrou n'est passable que verrou ouvert. Les habitants s'en servent dans
 * `habitants/chemins.ts` (`findRoute`, paramètre `closed`).
 */
import type { PlaceContent } from '../../donnees/charger';
import type { PathGraph } from '../../donnees/schemas/lieu';
import { evaluateAll } from '../regles/conditions';
import { closedLocks, type PlaceLook } from './verrous';

type Edge = PathGraph['edges'][number];

/** Verrous fermés du lieu courant: ce que reçoit le calcul des trajets. */
export function closedLockSet(look: PlaceLook): ReadonlySet<string> {
  return closedLocks(look);
}

/**
 * Portes du lieu que cet habitant ne franchit pas: celles dont les conditions (`opens`) sont
 * fausses, comme les joueurs les voient fermées. Le commerçant passe toujours la porte de son
 * commerce (porte ou porte d'en face marquée `shop`), qu'il ouvre et ferme lui-même. Lu au
 * changement de ligne du planning, pas à chaque pas.
 */
export function closedDoorSet(
  look: PlaceLook,
  place: PlaceContent,
  villager: string,
): ReadonlySet<string> {
  const doors = place.map.doors ?? {};
  const shut = new Set<string>();
  for (const id in doors) {
    const door = doors[id];
    if (door?.opens === undefined) continue;
    const pair = doors[door.to];
    const keeps = [door.shop, pair?.shop].some(
      (shop) => shop !== undefined && place.shops[shop]?.keeper === villager,
    );
    if (keeps) continue;
    if (!evaluateAll({ world: look.world, content: look.content, actor: null }, door.opens))
      shut.add(id);
  }
  return shut;
}

/** L'arête se parcourt-elle, verrous fermés `closed` ? */
export function edgePassable(edge: Edge, closed: ReadonlySet<string>): boolean {
  return edge.lock === null || !closed.has(edge.lock);
}
