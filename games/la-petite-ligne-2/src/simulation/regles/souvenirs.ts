/**
 * Faits de souvenirs écrits par le moteur là où l'état les sait déjà (cahier 4.9, R41), pour que
 * les habitants s'en souviennent: première prise à la pêche, nuit blanche, jour de pluie passé
 * dehors ensemble. Clés et seuils: `RULES.memories`. Rien de nouveau dans l'état ni sur le réseau:
 * tout passe par la mémoire des faits (tranche « progression »).
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import { postureOf } from '../briques/postures';
import { interiorAt } from '../lieux/portes';
import type { SimContext } from '../noyau/systemes';
import { playerFactKey, recall, remember } from './memoire';
import { RULES } from './reglages';

const M = RULES.memories;

/** Première prise de ce joueur: l'espèce, datée du jour (jamais réécrite ensuite). */
export function noteFirstCatch(sim: SimContext, player: PlayerIndex, species: string): void {
  const key = playerFactKey(M.firstCatchKey, player);
  if (recall(sim.world, key) === null) remember(sim, key, species, player);
}

/**
 * À chaque pas du jour (système « monde »): l'aube arrivée d'elle-même (`day_started` sans
 * `slept`) retient une nuit blanche pour chaque joueur qui n'était pas couché; la pluie, les deux
 * dehors et proches, retient le jour de pluie ensemble.
 */
export function noteMemories(sim: SimContext): void {
  const { world, content } = sim;
  if (world.common.phase !== 'day') return;
  const placeState = world.places[world.common.place];
  const dawn = sim.events?.some((e) => e.type === 'day_started' && !e.slept) === true;
  if (dawn)
    for (const p of [0, 1] as const)
      if (placeState === undefined || postureOf(placeState, p)?.kind !== 'sleep')
        remember(sim, playerFactKey(M.sleeplessKey, p), true, p);
  if (!M.rainWeathers.includes(world.common.weather)) return;
  const place = content.places[world.common.place];
  if (place === undefined) return;
  const [a, b] = [world.players[0].body, world.players[1].body];
  if (Math.hypot(a.x - b.x, a.y - b.y) > M.togetherRadius) return;
  if (interiorAt(place, a.x, a.y) !== null || interiorAt(place, b.x, b.y) !== null) return;
  remember(sim, M.rainTogetherKey, world.common.weather, 'duo');
}
