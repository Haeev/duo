/**
 * Pose d'un joueur couché (retour R05 du 2026-11-01: « les personnages se couchent à l'envers
 * dans le matelas »). La simulation pose le dormeur au centre du lit (de part et d'autre en x
 * pour un lit double) sans l'orienter: il gardait le cap de sa marche vers le lit, donc la tête
 * au pied quand il arrivait par le sud vers un lit contre le mur nord. Le rendu tire la pose du
 * lit lui-même: tête du côté de la tête de lit (-Z du modèle, comme -Z du clip `sleep`), place
 * de l'artiste (`sleep_spots`), hauteur de la couche (`sleep_height`).
 */
import { yawFromQuarter } from './contexte';

export interface SleepPose {
  x: number;
  y: number;
  /** Cap du personnage, convention de la simulation (`yawFromFacing`). */
  facing: number;
  /** Écart vertical du corps par rapport au clip (m, négatif: plus bas). */
  lift: number;
}

export interface BedPlacement {
  readonly cell: { readonly cx: number; readonly cy: number };
  readonly rotation: number;
}

/** Places de l'artiste (`sleep_spots`: [x, z] dans le repère du lit), ou le centre. */
function spotsOf(
  extras: Readonly<Record<string, unknown>>,
): readonly (readonly [number, number])[] {
  const raw = extras.sleep_spots;
  if (!Array.isArray(raw)) return [[0, 0]];
  const spots: [number, number][] = [];
  for (const entry of raw as unknown[]) {
    if (Array.isArray(entry) && typeof entry[0] === 'number' && typeof entry[1] === 'number') {
      spots.push([entry[0], entry[1]]);
    }
  }
  return spots.length > 0 ? spots : [[0, 0]];
}

/**
 * Pose couchée dans ce lit. `simPos`: position donnée par la simulation, qui dit seulement de
 * quel côté dort chacun dans un lit à deux places (ouest: première place, est: seconde).
 */
export function sleepPose(
  bed: BedPlacement,
  footprint: { readonly w: number; readonly d: number },
  extras: Readonly<Record<string, unknown>>,
  simPos: { readonly x: number; readonly y: number },
  clipBackHeight: number,
  out: SleepPose,
): SleepPose {
  const turned = bed.rotation % 2 !== 0;
  const w = turned ? footprint.d : footprint.w;
  const d = turned ? footprint.w : footprint.d;
  const cx = bed.cell.cx + w / 2;
  const cy = bed.cell.cy + d / 2;
  const yaw = yawFromQuarter(bed.rotation);
  const spots = spotsOf(extras);
  const spot = (spots.length > 1 && simPos.x >= cx ? spots[1] : spots[0]) ?? [0, 0];
  // Rotation Three.js autour de Y: x' = x cos + z sin, z' = -x sin + z cos (z du modèle = y de la carte).
  out.x = cx + spot[0] * Math.cos(yaw) + spot[1] * Math.sin(yaw);
  out.y = cy - spot[0] * Math.sin(yaw) + spot[1] * Math.cos(yaw);
  // Même lacet que le lit: `yawFromFacing(facing) = PI / 2 - facing`.
  out.facing = Math.PI / 2 - yaw;
  const height = extras.sleep_height;
  out.lift = typeof height === 'number' ? height - clipBackHeight : 0;
  return out;
}
