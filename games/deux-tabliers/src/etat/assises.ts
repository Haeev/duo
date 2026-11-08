/**
 * Où et dans quel sens on s'assoit sur un meuble posé (clients et avatars, simulation et rendu):
 * assise déclarée par l'artiste dans `assets/modeles/modeles.json` (`assises`: position dans le
 * repère du modèle, avant +Z), tournée comme le meuble. Pure, sans Three.js: la simulation et
 * le rendu lisent la même géométrie (une règle dupliquée finit par diverger).
 */
import { v } from '@duo/sdk';
import rawModelInfo from '../../assets/modeles/modeles.json';
import type { Content } from '../donnees/charger';
import { FURNITURE_MODEL } from '../rendu/correspondances';
import type { PlacedFurniture } from './monde';

export interface SeatAnchor {
  /** Point de l'assise (milieu du coussin, sur sa surface), repère du monde. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Avant de la personne assise (vecteur unitaire au sol). */
  readonly fx: number;
  readonly fz: number;
  /** Cap de la personne assise, comme `yawDeg` des joueurs (0 regarde le nord, -z). */
  readonly yawDeg: number;
  /** Demi-largeur et demi-profondeur du meuble (m), pour s'en écarter. */
  readonly halfWidth: number;
  readonly halfDepth: number;
}

const SeatsSchema = v.looseObject({
  objets: v.record(
    v.string(),
    v.looseObject({
      assises: v.optional(
        v.array(
          v.looseObject({
            position: v.tuple([v.number(), v.number(), v.number()]),
            avant: v.tuple([v.number(), v.number(), v.number()]),
          }),
        ),
      ),
    }),
  ),
});

interface Assise {
  readonly position: readonly number[];
  readonly avant: readonly number[];
}

const MODEL_SEATS: ReadonlyMap<string, readonly Assise[]> = (() => {
  const parsed = v.safeParse(SeatsSchema, rawModelInfo);
  const out = new Map<string, readonly Assise[]>();
  if (!parsed.success) return out;
  for (const [name, o] of Object.entries(parsed.output.objets))
    if (o.assises !== undefined && o.assises.length > 0) out.set(name, o.assises);
  return out;
})();

/**
 * Assises sans dossier: on s'y assoit du côté de sa table (le banc de ferme de la terrasse a son
 * avant déclaré au sud, mais une table posée au nord se rejoint en s'asseyant dans l'autre sens).
 */
const NO_BACKREST: ReadonlySet<string> = new Set([
  'banc_ferme',
  'brocante_banc_nordique',
  'tabouret_bois',
  'tabourets_zinc',
]);

/** Hauteur d'assise d'un meuble sans fiche (substitut): chaise ordinaire. */
const DEFAULT_SEAT: Assise = { position: [0, 0.45, 0], avant: [0, 0, 1] };

/** Modèle livré du meuble posé (même choix que le rendu, `rendu/monde3d.ts`). */
export function furnitureModel(content: Content, type: string): string | undefined {
  const mapped = FURNITURE_MODEL[type];
  if (mapped === null) return undefined;
  return (
    mapped ?? content.arrangement.pieces.get(type)?.model ?? content.furniture.get(type)?.model
  );
}

/** Table la plus proche à portée (`seating.tableReach`), comme l'orientation des assises. */
export function seatTable(
  content: Content,
  furniture: readonly PlacedFurniture[],
  seat: PlacedFurniture,
): PlacedFurniture | null {
  let best: PlacedFurniture | null = null;
  let bestD = content.settings.seating.tableReach;
  for (const t of furniture) {
    if (t === seat || content.furniture.get(t.type)?.kind !== 'table') continue;
    const d = Math.hypot(t.x - seat.x, t.z - seat.z);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

/** Repère du monde d'un point du modèle (rotation de `rotDeg` autour de +Y, avant +Z). */
function toWorld(f: PlacedFurniture, lx: number, lz: number): [number, number] {
  const r = (f.rotDeg * Math.PI) / 180;
  return [f.x + lx * Math.cos(r) + lz * Math.sin(r), f.z - lx * Math.sin(r) + lz * Math.cos(r)];
}

/**
 * Place assise d'un meuble: un client ou un avatar par meuble. Plusieurs assises déclarées
 * (banquette, banc): celle qui est le plus près de la table, sinon la plus centrale.
 */
export function seatAnchor(
  content: Content,
  furniture: readonly PlacedFurniture[],
  f: PlacedFurniture,
): SeatAnchor {
  const model = furnitureModel(content, f.type);
  const list = (model === undefined ? undefined : MODEL_SEATS.get(model)) ?? [DEFAULT_SEAT];
  const table = seatTable(content, furniture, f);
  let chosen = list[0] ?? DEFAULT_SEAT;
  let best = Infinity;
  for (const a of list) {
    const [wx, wz] = toWorld(f, a.position[0] ?? 0, a.position[2] ?? 0);
    const d =
      table === null
        ? Math.hypot(a.position[0] ?? 0, a.position[2] ?? 0)
        : Math.hypot(table.x - wx, table.z - wz);
    if (d < best - 1e-6) {
      best = d;
      chosen = a;
    }
  }
  const [x, z] = toWorld(f, chosen.position[0] ?? 0, chosen.position[2] ?? 0);
  const [ex, ez] = toWorld(f, chosen.avant[0] ?? 0, chosen.avant[2] ?? 1);
  let fx = ex - f.x;
  let fz = ez - f.z;
  const len = Math.hypot(fx, fz) || 1;
  fx /= len;
  fz /= len;
  if (table !== null && model !== undefined && NO_BACKREST.has(model)) {
    if (fx * (table.x - x) + fz * (table.z - z) < 0) {
      fx = -fx;
      fz = -fz;
    }
  }
  const type = content.furniture.get(f.type);
  return {
    x,
    y: f.y + (chosen.position[1] ?? DEFAULT_SEAT.position[1] ?? 0.45),
    z,
    fx,
    fz,
    yawDeg: ((((Math.atan2(-fx, -fz) * 180) / Math.PI) % 360) + 360) % 360,
    halfWidth: (type?.footprint[0] ?? 0.45) / 2,
    halfDepth: (type?.footprint[1] ?? 0.45) / 2,
  };
}

/**
 * Points d'où l'on s'approche d'une assise, dans l'ordre de préférence: devant (si la table
 * laisse la place), sur les côtés, derrière. L'appelant garde le premier point libre: on ne
 * passe jamais à travers la table.
 */
export function approachCandidates(a: SeatAnchor, clearance: number): [number, number][] {
  // Côté droit de la personne assise: (-fz, fx) tourné d'un quart vers la droite du regard.
  const rx = -a.fz;
  const rz = a.fx;
  const ahead = 0.35 + clearance;
  const side = a.halfWidth + clearance + 0.05;
  const back = a.halfDepth + clearance + 0.1;
  return [
    [a.x + a.fx * ahead, a.z + a.fz * ahead],
    [a.x + rx * side, a.z + rz * side],
    [a.x - rx * side, a.z - rz * side],
    [a.x + (rx - a.fx) * side * 0.75, a.z + (rz - a.fz) * side * 0.75],
    [a.x - (rx + a.fx) * side * 0.75, a.z - (rz + a.fz) * side * 0.75],
    [a.x - a.fx * back, a.z - a.fz * back],
  ];
}
