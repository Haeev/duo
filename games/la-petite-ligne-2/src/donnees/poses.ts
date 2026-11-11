/**
 * Objets posés sur un meuble (champ `on` d'un objet de carte): hauteur de pose et présence
 * héritée du porteur. Logique pure, sans rendu: la description de scène, le chargement et le
 * validateur la partagent, et rien n'y nomme un meuble (le plateau vient de `top` de sa fiche).
 */
import type { MapObject } from './schemas/lieu';
import type { PropDef } from './schemas/meuble';

/** Profondeur maximale d'une chaîne de porteurs (un livre sur un plateau sur un meuble): coupe aussi les boucles. */
export const POSE_MAX_DEPTH = 4;

/** L'objet est-il posé sur un meuble ou une hauteur ? Un tel objet est du décor: il ne bloque ni ne se vise. */
export function isPosed(object: Pick<MapObject, 'on'>): boolean {
  return object.on !== undefined;
}

/**
 * Hauteur du pied de l'objet (m): 0 au sol, la hauteur donnée, ou le plateau du porteur plus sa
 * propre hauteur de pose. `null`: porteur inconnu, sans plateau, ou chaîne trop longue (le
 * validateur le signale; le rendu retombe au sol plutôt que de planter).
 */
export function poseHeight(
  props: Readonly<Record<string, PropDef | undefined>>,
  byId: ReadonlyMap<string, MapObject>,
  object: MapObject,
  depth = 0,
): number | null {
  const on = object.on;
  if (on === undefined) return 0;
  if (typeof on === 'number') return on;
  if (depth >= POSE_MAX_DEPTH) return null;
  const carrier = byId.get(on);
  if (carrier === undefined) return null;
  const top = props[carrier.type]?.top;
  const below = poseHeight(props, byId, carrier, depth + 1);
  return top === undefined || below === null ? null : below + top;
}

/** Index des objets d'une carte par identifiant. */
export function objectsById(objects: readonly MapObject[]): Map<string, MapObject> {
  return new Map(objects.map((o) => [o.id, o]));
}

/**
 * Carte dont chaque objet posé sur un porteur conditionné (`when`) hérite des conditions du
 * porteur, et de celles de son propre porteur plus haut: absent le porteur, absent l'objet, sans
 * autre code (collisions, visée, rendu et signatures lisent déjà `when`).
 */
export function withInheritedPresence<M extends { readonly objects: readonly MapObject[] }>(
  map: M,
): M {
  if (!map.objects.some((o) => typeof o.on === 'string')) return map;
  const byId = objectsById(map.objects);
  const conditions = (object: MapObject, depth: number): MapObject['when'] => {
    const carrier =
      typeof object.on === 'string' && depth < POSE_MAX_DEPTH ? byId.get(object.on) : undefined;
    const inherited = carrier === undefined ? undefined : conditions(carrier, depth + 1);
    if (inherited === undefined) return object.when;
    return [...(object.when ?? []), ...inherited];
  };
  const objects = map.objects.map((o) => {
    if (typeof o.on !== 'string') return o;
    const when = conditions(o, 0);
    return when === undefined || when === o.when ? o : { ...o, when };
  });
  return { ...map, objects };
}
