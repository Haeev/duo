/**
 * Points d'arrivée d'un lieu: une paire écartée déduite du point `station.arrival` et de
 * l'orientation `station.facing` (données du lieu). Les deux joueurs descendent côte à côte,
 * face au lieu; tout ce qui se pose près d'eux (habitant qui descend, acteur d'une scène) part de
 * ce repère, sans cas particulier par lieu.
 */
import type { PlaceContent } from '../../donnees/charger';
import { CORE_TUNING } from '../noyau/reglages-noyau';

/** Un point au sol (m). */
export interface Spot {
  readonly x: number;
  readonly y: number;
}

/** Le repère de la descente: centre, regard des joueurs (radians) et leurs deux places. */
export interface ArrivalFrame {
  readonly x: number;
  readonly y: number;
  readonly facing: number;
  readonly spots: readonly [Spot, Spot];
}

/** Angle d'un quart de tour des données (0 sud = +y, 1 est = +x, 2 nord, 3 ouest). */
export function quarterAngle(quarter: 0 | 1 | 2 | 3): number {
  return [Math.PI / 2, 0, -Math.PI / 2, Math.PI][quarter] ?? Math.PI / 2;
}

/**
 * Repère d'arrivée du lieu, `null` si son point manque. Les deux places sont sur la
 * perpendiculaire au regard, à `arrivalSpread` du centre chacune (face au sud: joueur 0 à l'ouest).
 */
export function arrivalFrame(place: Pick<PlaceContent, 'def' | 'map'>): ArrivalFrame | null {
  const at = place.map.points[place.def.station.arrival];
  if (at === undefined) return null;
  const facing = quarterAngle(place.def.station.facing ?? 0);
  const half = CORE_TUNING.arrivalSpread;
  // Perpendiculaire au regard: vers l'est quand on regarde le sud.
  const rx = Math.sin(facing);
  const ry = -Math.cos(facing);
  return {
    x: at.x,
    y: at.y,
    facing,
    spots: [
      { x: at.x - rx * half, y: at.y - ry * half },
      { x: at.x + rx * half, y: at.y + ry * half },
    ],
  };
}
