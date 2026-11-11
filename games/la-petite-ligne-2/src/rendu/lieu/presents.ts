/**
 * Ce que la progression change aux meubles de la carte, lu dans l'état déjà transmis (rien de
 * plus sur le réseau, la même réponse chez l'hôte et chez l'invité): un meuble conditionné
 * (`when`) dont la condition est fausse n'est pas dessiné, une porte au sol (escalier, trappe)
 * que son `opens` tient fermée se montre fermée. Logique pure: le moteur en fait des états de
 * volumes (`PlaceScene.setStates`), comme pour les récoltables. Rien n'y nomme un meuble.
 */
import type { PlaceContent } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import { doorRefusal } from '../../simulation/lieux/portes';
import { conditionalObjects, isObjectPresent } from '../../simulation/lieux/presents';
import type { PlaceLook } from '../../simulation/lieux/verrous';
import { HARVEST_LOOK } from './reglages-recoltes';

/** États montrés d'un meuble de carte selon la progression. */
export const MAP_STATES = {
  /** Meuble absent: rien n'est dessiné, rien ne cache, rien n'éclaire, rien ne se vise. */
  absent: HARVEST_LOOK.gone,
  /** Objet visible d'une porte fermée par l'histoire. */
  closed: 'closed',
} as const;

/** Refus d'une porte que l'histoire tient fermée (`doorRefusal`). */
const LOCKED = 'door-locked';

/**
 * Ajoute à `states` l'état montré des meubles de la carte que la progression change: absents,
 * et objets visibles des portes fermées, vus par `player` (une condition peut tenir au joueur).
 */
export function mapStates(
  look: PlaceLook,
  place: PlaceContent,
  player: PlayerIndex,
  states: Map<string, string>,
): Map<string, string> {
  for (const object of conditionalObjects(place))
    if (!isObjectPresent(look, object)) states.set(object.id, MAP_STATES.absent);
  const doors = place.map.doors;
  for (const id in doors) {
    const door = doors[id];
    if (door?.object === undefined || door.opens === undefined) continue;
    if (doorRefusal(look, player, door) === LOCKED) states.set(door.object, MAP_STATES.closed);
  }
  return states;
}

/**
 * Empreinte de ces états, lue à chaque image: le moteur ne refait les volumes que si elle change
 * (une pièce restaurée, un fait d'histoire retenu), sans attendre l'événement `map_object_changed`,
 * qui peut arriver chez l'invité avant la progression.
 */
export function mapSignature(look: PlaceLook, place: PlaceContent, player: PlayerIndex): number {
  let h = 1;
  for (const object of conditionalObjects(place))
    h = (h * 31 + (isObjectPresent(look, object) ? 1 : 2)) | 0;
  const doors = place.map.doors;
  for (const id in doors) {
    const door = doors[id];
    if (door?.object === undefined || door.opens === undefined) continue;
    h = (h * 31 + (doorRefusal(look, player, door) === LOCKED ? 3 : 4)) | 0;
  }
  return h;
}
