/**
 * Pose d'un joueur couché (brique `sleep`), logique pure testée dans Node. La simulation pose le
 * dormeur au milieu de sa place, tourné vers la façade du meuble; le rendu le couche sur le dos,
 * tête sur l'oreiller (vers le dos du meuble), aux mesures de la fiche du meuble (`lie`). Le moteur
 * ne connaît aucun lit: tout vient des données.
 */
import type { Content } from '../../donnees/charger';
import type { PlaceState } from '../../etat/lieu';
import type { DeepReadonly, ReadonlyWorld } from '../../etat/monde';
import { findProp } from '../../simulation/noyau/obstacles';

export interface LyingPose {
  /** Pieds sur la carte (x est, y sud). */
  x: number;
  y: number;
  /** Cap des pieds (convention de la simulation): la façade du meuble. */
  facing: number;
  /** Hauteur du dessus du couchage (m). */
  height: number;
}

/** Mesures du couchage quand la fiche n'en donne pas: le dessus de la forme provisoire. */
export interface LyingFallback {
  readonly height: number;
  /** Retrait de l'oreiller depuis le bord du dos du meuble (m). */
  readonly pillowInset: number;
}

/**
 * Pose couchée de ce joueur, `null` s'il n'est pas couché. `headHeight`: hauteur du milieu de la
 * tête au-dessus des pieds, debout (m). Le résultat est écrit dans `out`.
 */
export function lyingPose(
  content: Content,
  world: ReadonlyWorld,
  place: DeepReadonly<PlaceState>,
  index: 0 | 1,
  headHeight: number,
  fallback: LyingFallback,
  out: LyingPose,
): LyingPose | null {
  for (const object in place.objects) {
    const beds = place.objects[object]?.sleep;
    if (beds === undefined) continue;
    const seat = beds.indexOf(index);
    if (seat < 0) continue;
    const placeContent = content.places[world.common.place];
    if (placeContent === undefined) return null;
    const prop = findProp(placeContent, place, object);
    const def = prop === null ? undefined : content.props[prop.type];
    if (prop === null || def === undefined) return null;
    let height = fallback.height;
    let pillow = Math.max(0, def.size.h / 2 - fallback.pillowInset);
    let spacing = def.size.w / beds.length;
    for (const brick of def.bricks)
      if (brick.brick === 'sleep' && brick.lie !== undefined)
        ({ height, pillow, spacing } = brick.lie);
    // Façade du meuble: 0 au sud, puis par quarts de tour (est, nord, ouest), comme la simulation.
    const r = ((prop.rotation % 4) + 4) % 4;
    const fx = r === 1 ? 1 : r === 3 ? -1 : 0;
    const fy = r === 0 ? 1 : r === 2 ? -1 : 0;
    // Places côte à côte sur la largeur (première place à gauche du dormeur qui regarde la façade).
    const along = (seat - (beds.length - 1) / 2) * spacing;
    const cx = prop.x + fy * along;
    const cy = prop.y - fx * along;
    // Tête au milieu de l'oreiller, pieds vers la façade.
    const toFeet = headHeight - pillow;
    out.x = cx + fx * toFeet;
    out.y = cy + fy * toFeet;
    out.facing = Math.atan2(fy, fx);
    out.height = height;
    return out;
  }
  return null;
}
