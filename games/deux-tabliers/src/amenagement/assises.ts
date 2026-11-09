/**
 * Règle de cohérence des assises (demande du client, 2026-11-07, chaises à l'envers de l'essai 3D):
 * une assise posée s'oriente d'elle-même vers la table la plus proche à portée; sans table à
 * portée, elle garde l'orientation choisie. Une assise dos à sa table voisine n'est jamais valide.
 * Fonctions pures: le chargement contrôle l'aménagement d'arrivée, l'aménagement (chantier c)
 * appelle `orientSeat` à chaque pose et `seatFacingIssues` avant de valider.
 */
import type { FurnitureType } from '../donnees/schemas';

export interface PlacedLike {
  readonly id: string;
  readonly type: string;
  readonly x: number;
  readonly z: number;
  readonly rotDeg: number;
}

/** Portée par défaut (m, de centre à centre), réglée par `reglages.json` (`seating.tableReach`). */
export const DEFAULT_TABLE_REACH = 1;

function nearestTable(
  seat: PlacedLike,
  placed: readonly PlacedLike[],
  catalog: ReadonlyMap<string, FurnitureType>,
  reach: number,
): PlacedLike | null {
  let best: PlacedLike | null = null;
  let bestD = reach;
  for (const p of placed) {
    if (p === seat || catalog.get(p.type)?.kind !== 'table') continue;
    const d = Math.hypot(p.x - seat.x, p.z - seat.z);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Cap (degrés) qui fait regarder l'assise vers la table (avant à 0° = +z, à 90° = +x). */
function facing(seat: PlacedLike, table: PlacedLike): number {
  const deg = (Math.atan2(table.x - seat.x, table.z - seat.z) * 180) / Math.PI;
  return Math.round(((deg % 360) + 360) % 360);
}

/** Orientation d'une assise qu'on pose: vers la table la plus proche à portée, sinon `rotDeg` inchangé. */
export function orientSeat(
  seat: PlacedLike,
  placed: readonly PlacedLike[],
  catalog: ReadonlyMap<string, FurnitureType>,
  reach = DEFAULT_TABLE_REACH,
): number {
  if (catalog.get(seat.type)?.kind !== 'seat') return seat.rotDeg;
  const table = nearestTable(seat, placed, catalog, reach);
  return table === null ? seat.rotDeg : facing(seat, table);
}

/** Problèmes d'orientation: assise dont l'avant ne regarde pas sa table la plus proche. */
export function seatFacingIssues(
  placed: readonly PlacedLike[],
  map: ReadonlyMap<string, FurnitureType>,
  reach = DEFAULT_TABLE_REACH,
): string[] {
  const issues: string[] = [];
  for (const seat of placed) {
    if (map.get(seat.type)?.kind !== 'seat') continue;
    const table = nearestTable(seat, placed, map, reach);
    if (table === null) continue;
    const a = (seat.rotDeg * Math.PI) / 180;
    const dx = table.x - seat.x;
    const dz = table.z - seat.z;
    const dot = (Math.sin(a) * dx + Math.cos(a) * dz) / Math.hypot(dx, dz);
    // Plus de 45° d'écart: l'assise ne fait pas face à sa table.
    if (dot < Math.SQRT1_2)
      issues.push(
        `l'assise ${seat.id} ne fait pas face à la table ${table.id} (orientation ${seat.rotDeg}°, attendue ${facing(seat, table)}°)`,
      );
  }
  return issues;
}
