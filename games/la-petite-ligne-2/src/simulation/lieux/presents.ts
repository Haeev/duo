/**
 * Meubles de carte conditionnés (champ `when` d'un objet de `carte.json` ou d'un intérieur): le
 * meuble n'existe que si toutes ses conditions sont vraies (fait d'histoire, pièce de logement
 * restaurée). Absent, il ne bloque pas, ne se vise pas, ne sert à rien, et le rendu ne le montre
 * pas. Comme un verrou, il n'a pas d'état à lui: tout se déduit de la progression transmise, donc
 * l'hôte, la prédiction de l'invité et les deux rendus trouvent les mêmes meubles. Fonctions pures.
 */
import type { PlaceContent } from '../../donnees/charger';
import type { MapObject } from '../../donnees/schemas/lieu';
import { evaluateAll } from '../regles/conditions';
import type { PlaceLook } from './verrous';

const conditional = new WeakMap<PlaceContent, readonly MapObject[]>();

/** Les meubles conditionnés de la carte, dans l'ordre du fichier (le même chez les deux joueurs). */
export function conditionalObjects(place: PlaceContent): readonly MapObject[] {
  let list = conditional.get(place);
  if (list === undefined) {
    list = place.map.objects.filter((o) => o.when !== undefined);
    conditional.set(place, list);
  }
  return list;
}

/** Ce meuble de carte existe-t-il maintenant ? Sans `when`: toujours. */
export function isObjectPresent(look: PlaceLook, object: Pick<MapObject, 'when'>): boolean {
  return (
    object.when === undefined ||
    evaluateAll({ world: look.world, content: look.content, actor: null }, object.when)
  );
}

/** Le meuble de carte `id` du lieu courant est-il absent (condition fausse) ? Inconnu: non. */
export function isObjectAbsent(look: PlaceLook, id: string): boolean {
  const place = look.content.places[look.world.common.place];
  if (place === undefined) return false;
  for (const object of conditionalObjects(place))
    if (object.id === id) return !isObjectPresent(look, object);
  return false;
}

/** Identifiants des meubles de carte absents du lieu courant: ce que le rendu ne dessine pas. */
export function absentObjects(look: PlaceLook): ReadonlySet<string> {
  const out = new Set<string>();
  const place = look.content.places[look.world.common.place];
  if (place === undefined) return out;
  for (const object of conditionalObjects(place))
    if (!isObjectPresent(look, object)) out.add(object.id);
  return out;
}

/**
 * Relit la présence des meubles conditionnés dans `states` (1 présent, 0 absent, dans l'ordre de
 * `conditionalObjects`); vrai si l'un a changé. Sans allocation: le cache des obstacles s'y fie.
 */
export function refreshPresence(look: PlaceLook, place: PlaceContent, states: Uint8Array): boolean {
  let changed = false;
  const list = conditionalObjects(place);
  for (let i = 0; i < list.length; i++) {
    const object = list[i];
    const present = object === undefined || isObjectPresent(look, object) ? 1 : 0;
    if (states[i] !== present) {
      states[i] = present;
      changed = true;
    }
  }
  return changed;
}
