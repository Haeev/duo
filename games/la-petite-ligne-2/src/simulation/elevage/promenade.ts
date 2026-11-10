/**
 * Où sont les bêtes, pour le rendu: une fonction pure du jour, de l'heure et du numéro de la
 * bête, identique sur les deux machines sans rien transmettre. Le jour, chacune va d'un but à
 * l'autre dans l'enclos (elle marche un peu, puis picore sur place); la nuit, elle est dans
 * l'abri, rangée sur le perchoir.
 */
import type { Look } from '../briques/types';
import { readShelter } from './abri';
import { FARM_TUNING } from './reglages';

export interface AnimalSpot {
  readonly id: number;
  /** Position au sol (m), repère du monde. */
  readonly x: number;
  readonly y: number;
  /** Cap (radians, x vers l'est, y vers le sud). */
  readonly facing: number;
  /** `walk`: elle marche; `peck`: elle picore; `roost`: dans l'abri pour la nuit. */
  readonly pose: 'walk' | 'peck' | 'roost';
}

/** Hachage entier déterministe (pas de `Math.random`): un nombre dans [0, 1). */
function hash01(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) ^ Math.imul(c + 0x297a2d39, 0x165667b1);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Décalage (repère du meuble, façade au sud) tourné selon la rotation du meuble (quarts de tour). */
function turn(dx: number, dy: number, rotation: number): { x: number; y: number } {
  switch (rotation) {
    case 1:
      return { x: -dy, y: dx };
    case 2:
      return { x: -dx, y: -dy };
    case 3:
      return { x: dy, y: -dx };
    default:
      return { x: dx, y: dy };
  }
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Les bêtes de cet abri et où elles sont maintenant; `[]` si ce n'est pas un abri du lieu. */
export function animalSpots(
  look: Look,
  id: string,
  minutes: number = look.world.minutes,
): AnimalSpot[] {
  const ref = readShelter(look, id);
  if (ref === null) return [];
  const { params, species, state } = ref;
  const { out, in: home, every } = species.roam;
  const outside = minutes >= out && minutes < home;
  const day = look.world.common.day;
  const m = FARM_TUNING.margin;
  const pen = params.pen;
  const size = look.content.props[ref.type]?.size ?? { w: 1, h: 1 };
  const count = Math.max(1, state.animals.length);
  return state.animals.map((animal, index): AnimalSpot => {
    if (!outside) {
      // Perchoir: alignées dans la largeur de l'abri, en retrait de la façade.
      const dx = ((index + 0.5) / count - 0.5) * Math.max(0.2, size.w - 2 * m);
      const local = turn(dx, -size.h / 4, ref.rotation);
      return {
        id: animal.id,
        x: ref.x + local.x,
        y: ref.y + local.y,
        facing: Math.PI / 2 + (ref.rotation * Math.PI) / 2,
        pose: 'roost',
      };
    }
    const point = (segment: number): { x: number; y: number } => {
      const u = hash01(day, animal.id, segment * 2);
      const w = hash01(day, animal.id, segment * 2 + 1);
      const local = turn(
        pen.x + m + u * Math.max(0, pen.w - 2 * m),
        pen.y + m + w * Math.max(0, pen.h - 2 * m),
        ref.rotation,
      );
      return { x: ref.x + local.x, y: ref.y + local.y };
    };
    const t = (minutes - out) / every;
    const segment = Math.floor(t);
    const from = point(segment);
    const to = point(segment + 1);
    const walk = Math.min(1, (t - segment) / FARM_TUNING.walkShare);
    const k = smooth(walk);
    return {
      id: animal.id,
      x: from.x + (to.x - from.x) * k,
      y: from.y + (to.y - from.y) * k,
      facing: Math.atan2(to.y - from.y, to.x - from.x),
      pose: walk < 1 ? 'walk' : 'peck',
    };
  });
}
