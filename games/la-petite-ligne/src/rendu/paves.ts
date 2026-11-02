/**
 * Où sont les pavés, côté processeur: miroir de `ambPaveField` (`surfaces.ts`) pour les
 * contrôles de cohérence de la carte (retour R22: un buisson posé sur les pavés de la place).
 * Dans le rectangle de la place: anneau autour du puits, bandes pavées et rue de la Gare au
 * nord, unies en douceur (même union que le shader). Hors de la place: toute case de pierre
 * (rue, cour, quai) est pavée.
 */
import type { GameMap } from '../etat/carte';
import { RENDER_SETTINGS } from './reglages';

function smoothMax(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0);
  return Math.max(a, b) + (h * h) / (4 * k);
}

/** Distance signée au bord des pavés de la place (m, positive dans les pavés), comme le shader. */
export function squarePaveField(map: GameMap, x: number, y: number): number {
  const square = RENDER_SETTINGS.terrain.square;
  const k = square.border.fillet;
  let d = square.area.y - y;
  for (const shape of square.paved) {
    let di: number;
    if (shape.kind === 'ring') {
      const centre = map.props.find((prop) => prop.model === shape.model);
      if (centre === undefined) continue;
      di = shape.radius - Math.hypot(x - centre.pos.x, y - centre.pos.y);
    } else {
      const abx = shape.b[0] - shape.a[0];
      const aby = shape.b[1] - shape.a[1];
      const len = Math.hypot(abx, aby);
      const ux = abx / Math.max(len, 1e-4);
      const uy = aby / Math.max(len, 1e-4);
      const vx = x - shape.a[0];
      const vy = y - shape.a[1];
      const t = Math.min(len, Math.max(0, vx * ux + vy * uy));
      di = shape.half - Math.hypot(vx - ux * t, vy - uy * t);
    }
    d = smoothMax(d, di, k);
  }
  return d;
}

function inSquare(x: number, y: number): boolean {
  const area = RENDER_SETTINGS.terrain.square.area;
  return x > area.x && x < area.x + area.w && y > area.y && y < area.y + area.h;
}

/** Vrai si un point est sur des pavés dessinés. */
export function pavedAt(map: GameMap, x: number, y: number): boolean {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) return false;
  if (map.ground[cy * map.width + cx] !== 'stone') return false;
  return inSquare(x, y) ? squarePaveField(map, x, y) > 0 : true;
}

/** Vrai si un disque de rayon `radius` autour du point touche des pavés (échantillonné tous les 10 cm). */
export function pavedNear(map: GameMap, x: number, y: number, radius: number): boolean {
  const step = 0.1;
  for (let dy = -radius; dy <= radius + 1e-9; dy += step) {
    for (let dx = -radius; dx <= radius + 1e-9; dx += step) {
      if (dx * dx + dy * dy > radius * radius) continue;
      if (pavedAt(map, x + dx, y + dy)) return true;
    }
  }
  return false;
}
