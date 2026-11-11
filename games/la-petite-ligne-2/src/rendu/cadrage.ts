/**
 * Cadrage d'un petit lieu clos (le wagon du train de nuit): la largeur de vue qui fait tenir son
 * plancher dans une part donnée de la largeur de l'écran, au lacet courant. Sans ce cadrage, le
 * wagon flottait petit au milieu du noir (revue du 2026-11-11). Logique pure, sans Three.js.
 */
import type { FloorDef } from '../donnees/schemas/lieu';

/** Nature de sol qui ne compte pas dans l'emprise (le vide autour du wagon). */
const EMPTY = 'vide';

/** Emprise du plancher déclaré (cases hors du vide), `null` si rien n'est posé. */
export function floorExtent(
  floor: FloorDef,
  width: number,
  height: number,
): { readonly w: number; readonly h: number } | null {
  const areas = (floor.areas ?? []).filter((area) => area.nature !== EMPTY);
  if (floor.nature !== EMPTY) return { w: width, h: height };
  if (areas.length === 0) return null;
  const x0 = Math.min(...areas.map((a) => a.x));
  const y0 = Math.min(...areas.map((a) => a.y));
  const x1 = Math.max(...areas.map((a) => a.x + a.w));
  const y1 = Math.max(...areas.map((a) => a.y + a.h));
  return { w: x1 - x0, h: y1 - y0 };
}

/**
 * Largeur de vue (m) pour que l'emprise `extent`, vue au lacet `yaw` (radians), occupe `share`
 * de la largeur de l'écran, bornée par `[min, max]`.
 */
export function closedViewWidth(
  extent: { readonly w: number; readonly h: number },
  yaw: number,
  share: number,
  min: number,
  max: number,
): number {
  const across = extent.w * Math.abs(Math.cos(yaw)) + extent.h * Math.abs(Math.sin(yaw));
  return Math.min(max, Math.max(min, across / share));
}
