/**
 * Objets posés au sol par la carte (`groundItems`): ils sont là à la première visite du lieu, et
 * ceux qui ont `respawnDaily` reviennent chaque matin s'ils ont été ramassés. L'état ne retient
 * que le dernier jour de passage (`groundDay`): un objet est « manquant » quand aucune pile du
 * même objet ne repose plus à sa place. Un objet sans `respawnDaily` ne revient jamais.
 */
import type { MapDef } from '../../donnees/schemas/lieu';
import type { PlaceState } from '../../etat/lieu';
import type { SimContext } from '../noyau/systemes';
import { GROUND_MAX } from './actions';

/** Écart (m) en deçà duquel une pile est considérée à la place de l'objet de la carte. */
const SAME_SPOT = 0.05;

/** Pose au sol les objets de la carte qui manquent; `true` si le sol a changé. */
export function layMapGround(
  map: Pick<MapDef, 'groundItems'>,
  place: PlaceState,
  dailyOnly: boolean,
): boolean {
  let changed = false;
  for (const spot of map.groundItems ?? []) {
    if (dailyOnly && spot.respawnDaily !== true) continue;
    const there = place.ground.some(
      (g) =>
        g.stack.item === spot.item &&
        Math.abs(g.x - spot.x) <= SAME_SPOT &&
        Math.abs(g.y - spot.y) <= SAME_SPOT,
    );
    if (there) continue;
    while (place.ground.length >= GROUND_MAX) place.ground.shift();
    place.ground.push({
      id: place.nextGroundId,
      stack: { item: spot.item, count: spot.count },
      x: spot.x,
      y: spot.y,
    });
    place.nextGroundId += 1;
    changed = true;
  }
  return changed;
}

/** À chaque pas: au premier passage puis à chaque nouveau jour, le sol du lieu courant se complète. */
export function stepMapGround(sim: SimContext): void {
  const { world, content } = sim;
  const place = world.places[world.common.place];
  const map = content.places[world.common.place]?.map;
  if (place === undefined || map === undefined || place.groundDay === world.common.day) return;
  // Premier passage (ou sauvegarde d'avant les objets au sol): tout ce qui manque se pose.
  const first = place.groundDay === undefined;
  layMapGround(map, place, !first);
  place.groundDay = world.common.day;
  sim.touch('place');
}
