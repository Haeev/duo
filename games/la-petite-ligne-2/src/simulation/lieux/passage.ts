/**
 * Brique `passage`: l'objet visible d'un verrou d'histoire (barrière, éboulis, ronces, grille) ou
 * d'une porte qu'on passe par la touche d'action. Le meuble ne dit rien de plus: c'est la carte
 * qui le nomme (`locks.<id>.object`, `doors.<id>.object`).
 *
 * Verrou fermé: la touche d'action refuse avec `not-yet`, et l'interface montre la phrase du
 * verrou (`passageSays`). Verrou ouvert: l'objet n'est plus une cible. Porte: on la passe, ou
 * l'on apprend pourquoi elle est fermée.
 */
import type { PlaceContent } from '../../donnees/charger';
import type { BrickBehaviour, Look } from '../briques/types';
import { doorOfObject, doorRefusal, interiorAt, passDoor } from './portes';
import { isLockOpen, lockOfObject } from './verrous';

function placeOf(look: Look): PlaceContent | undefined {
  return look.content.places[look.world.common.place];
}

/** Phrase de données à montrer devant ce passage fermé, `null` s'il n'en a pas (texte générique). */
export function passageSays(look: Look, object: string): string | null {
  const place = placeOf(look);
  if (place === undefined) return null;
  const lock = lockOfObject(place, object);
  if (lock !== null) return place.map.locks?.[lock]?.says ?? null;
  return doorOfObject(place, object)?.door.says ?? null;
}

export const passageBehaviour: BrickBehaviour<{ brick: 'passage' }> = {
  verb: 'Passer',
  verbOf(look, _player, target) {
    const place = placeOf(look);
    const found = place === undefined ? null : doorOfObject(place, target.id);
    const arrival = found === null ? undefined : place?.map.doors?.[found.door.to];
    if (place === undefined || arrival === undefined) return 'Passer';
    return interiorAt(place, arrival.x, arrival.y) === null ? 'Sortir' : 'Entrer';
  },
  inert(look, _player, target) {
    const place = placeOf(look);
    if (place === undefined) return true;
    const lock = lockOfObject(place, target.id);
    if (lock !== null) return isLockOpen(look, lock);
    return doorOfObject(place, target.id) === null;
  },
  refuse(look, player, target) {
    const place = placeOf(look);
    if (place === undefined) return 'gone';
    const lock = lockOfObject(place, target.id);
    if (lock !== null) return isLockOpen(look, lock) ? 'gone' : 'not-yet';
    const found = doorOfObject(place, target.id);
    return found === null ? 'gone' : doorRefusal(look, player, found.door);
  },
  use(sim, player, target) {
    const place = placeOf(sim);
    const found = place === undefined ? null : doorOfObject(place, target.id);
    if (found !== null) passDoor(sim, player, found.id);
  },
};
