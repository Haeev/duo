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

// `objets` est une liste (fiche par modèle, clé `id`): un schéma en dictionnaire passait à
// côté et toutes les assises prenaient la place par défaut.
const SeatsSchema = v.looseObject({
  objets: v.array(
    v.looseObject({
      id: v.string(),
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
  for (const o of parsed.output.objets)
    if (o.assises !== undefined && o.assises.length > 0) out.set(o.id, o.assises);
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

/** Séparateur d'une place dans son meuble: `seat-9` (première place), `seat-9#1`, `seat-9#2`. */
const PLACE_SEP = '#';

/** Identifiant d'une place: le meuble seul pour la première (sauvegardes d'avant les places). */
export function placeId(furniture: string, index: number): string {
  return index === 0 ? furniture : `${furniture}${PLACE_SEP}${String(index)}`;
}

/** Meuble d'une place (`seat-9#1` donne `seat-9`). */
export function placeFurniture(place: string): string {
  const i = place.indexOf(PLACE_SEP);
  return i < 0 ? place : place.slice(0, i);
}

function placeIndex(place: string): number {
  const i = place.indexOf(PLACE_SEP);
  const n = i < 0 ? 0 : Number(place.slice(i + 1));
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export interface SeatPlace {
  readonly id: string;
  readonly anchor: SeatAnchor;
}

/**
 * Places d'un meuble, la première la plus près de la table (puis la plus centrale): une par
 * assise déclarée du modèle (banquette de trois, banc de deux), sans dépasser le nombre de
 * places du catalogue (`seats.count`, que compte aussi l'ambiance). Chacune face à la table.
 */
export function seatPlaces(
  content: Content,
  furniture: readonly PlacedFurniture[],
  f: PlacedFurniture,
): SeatPlace[] {
  const model = furnitureModel(content, f.type);
  const list = (model === undefined ? undefined : MODEL_SEATS.get(model)) ?? [DEFAULT_SEAT];
  const table = seatTable(content, furniture, f);
  const ranked = list
    .map((a, i) => {
      const [wx, wz] = toWorld(f, a.position[0] ?? 0, a.position[2] ?? 0);
      const d =
        table === null
          ? Math.hypot(a.position[0] ?? 0, a.position[2] ?? 0)
          : Math.hypot(table.x - wx, table.z - wz);
      return { a, i, d };
    })
    // Égalité (deux bouts d'un banc à même distance): l'ordre déclaré, stable d'une image à l'autre.
    .sort((p, q) => (Math.abs(p.d - q.d) < 1e-6 ? p.i - q.i : p.d - q.d));
  const count = content.arrangement.pieces.get(f.type)?.seats?.count ?? ranked.length;
  return ranked.slice(0, Math.max(1, Math.min(count, ranked.length))).map((r, k) => ({
    id: placeId(f.id, k),
    anchor: anchorOf(content, f, model, table, r.a, list.length > 1),
  }));
}

function anchorOf(
  content: Content,
  f: PlacedFurniture,
  model: string | undefined,
  table: PlacedFurniture | null,
  chosen: Assise,
  shared = false,
): SeatAnchor {
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
  if (shared && table !== null) [fx, fz] = turnToTable(content, table, x, z, fx, fz);
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
 * Place d'un meuble à plusieurs places qui n'est pas en face de sa table (bout de banquette ou
 * de banc, plus large que la table): la personne se tourne vers le plateau, au plus de
 * `seating.endSeatTurnMaxDeg`. Ses genoux rentrent vers le milieu de l'assise (loin de
 * l'accoudoir et du bout) et ses mains vont vers la table, pas dans le vide à côté. Visée: le
 * point du plateau le plus proche, gardé à `endSeatInset` du bord.
 */
function turnToTable(
  content: Content,
  table: PlacedFurniture,
  x: number,
  z: number,
  fx: number,
  fz: number,
): [number, number] {
  const type = content.furniture.get(table.type);
  if (type === undefined) return [fx, fz];
  const seating = content.settings.seating;
  const r = (table.rotDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = x - table.x;
  const dz = z - table.z;
  const mx = Math.max(0, type.footprint[0] / 2 - seating.endSeatInset);
  const mz = Math.max(0, type.footprint[1] / 2 - seating.endSeatInset);
  const lx = Math.max(-mx, Math.min(mx, dx * cos - dz * sin));
  const lz = Math.max(-mz, Math.min(mz, dx * sin + dz * cos));
  // Point visé, repère du monde, vu depuis la place.
  const px = table.x + lx * cos + lz * sin - x;
  const pz = table.z - lx * sin + lz * cos - z;
  const ahead = px * fx + pz * fz;
  // Côté droit de la personne assise, comme `approachCandidates`.
  const side = px * -fz + pz * fx;
  if (ahead <= 1e-3 || Math.abs(side) < 1e-3) return [fx, fz];
  const max = (seating.endSeatTurnMaxDeg * Math.PI) / 180;
  const a = Math.max(-max, Math.min(max, Math.atan2(side, ahead)));
  const c = Math.cos(a);
  const s = Math.sin(a);
  // Avant tourné de `a` vers la droite: c * avant + s * droite.
  return [c * fx - s * fz, c * fz + s * fx];
}

/** Première place d'un meuble (la plus près de la table). */
export function seatAnchor(
  content: Content,
  furniture: readonly PlacedFurniture[],
  f: PlacedFurniture,
): SeatAnchor {
  const first = seatPlaces(content, furniture, f)[0];
  return first === undefined ? anchorOf(content, f, undefined, null, DEFAULT_SEAT) : first.anchor;
}

/** Point d'une place (`seat-9#1`), `null` si son meuble n'est plus là. */
export function placeAnchor(
  content: Content,
  furniture: readonly PlacedFurniture[],
  place: string,
): SeatAnchor | null {
  const id = placeFurniture(place);
  const f = furniture.find((x) => x.id === id);
  if (f === undefined) return null;
  const list = seatPlaces(content, furniture, f);
  return (list[placeIndex(place)] ?? list[0])?.anchor ?? null;
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
