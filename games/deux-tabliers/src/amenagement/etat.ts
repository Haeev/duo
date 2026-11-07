// Domaine « amenagement » de l'état partagé: réserve, commandes et cartons, pièce tenue par
// chaque joueur (fantôme), port à deux, travaux des extensions, revêtements, brocante.
// Sérialisé dans les sauvegardes et envoyé à l'invité quand il change (canal du domaine).
// Toute évolution du format: monter WORLD_FORMAT (etat/monde.ts) et écrire la migration.
import { v } from '@duo/sdk';

const Int = v.pipe(v.number(), v.integer(), v.minValue(0));
const Player = v.picklist([0, 1]);

/** Une pièce sans place: en réserve, dans un carton, ou tenue en fantôme. */
const PieceSchema = v.strictObject({
  /** Identifiant du meuble posé qu'elle deviendra (stable: la sauvegarde le cite). */
  id: v.string(),
  /** Type de meuble (identifiant du catalogue, ou meuble de Simone). */
  type: v.string(),
  /** Usée (mobilier de Simone pas encore rénové): charme compté à moitié. */
  worn: v.boolean(),
});
export type Piece = v.InferOutput<typeof PieceSchema>;

const PoseSchema = v.strictObject({
  x: v.number(),
  z: v.number(),
  y: v.number(),
  rotDeg: v.number(),
});
export type Pose3 = v.InferOutput<typeof PoseSchema>;

/** Pièce tenue par un joueur en mode aménagement, et d'où elle vient (pour « Annuler »). */
const HeldSchema = v.strictObject({
  piece: PieceSchema,
  from: v.variant('kind', [
    v.strictObject({
      kind: v.literal('placed'),
      pose: PoseSchema,
      support: v.nullable(v.string()),
    }),
    v.strictObject({ kind: v.literal('stock') }),
    v.strictObject({ kind: v.literal('carton'), carton: v.string(), pose: PoseSchema }),
  ]),
});
export type Held = v.InferOutput<typeof HeldSchema>;

/** Fantôme montré chez l'autre joueur (ux 4.12, DE-10), mis à jour quelques fois par seconde. */
const GhostSchema = v.strictObject({ type: v.string(), pose: PoseSchema, ok: v.boolean() });
export type Ghost = v.InferOutput<typeof GhostSchema>;

export const ArrangementStateSchema = v.strictObject({
  /** Prochain numéro de meuble acheté (chantier aménagement). */
  nextFurnitureId: Int,
  /** Pièces de départ (horloge, applique, bocal) posées. */
  initialized: v.boolean(),
  /** Dernier jour vu: un changement de jour livre les commandes et avance les travaux. */
  lastDay: Int,
  /** Réserve de la maison: rien ne se perd (DE-08). */
  stock: v.array(PieceSchema),
  /** Achats en attente de la livraison du lendemain matin. */
  orders: v.array(v.strictObject({ piece: PieceSchema, day: Int })),
  /** Cartons livrés dans la cour: meuble posé `furniture` (type carton) et son contenu. */
  cartons: v.array(v.strictObject({ furniture: v.string(), piece: PieceSchema })),
  /** Pièce tenue en fantôme par chaque joueur. */
  held: v.tuple([v.nullable(HeldSchema), v.nullable(HeldSchema)]),
  ghosts: v.tuple([v.nullable(GhostSchema), v.nullable(GhostSchema)]),
  /** Port à deux: meuble posé porté, et le côté tenu par chaque joueur (0 ou 1, `null` libre). */
  carry: v.nullable(
    v.strictObject({
      furniture: v.string(),
      handles: v.tuple([v.nullable(v.picklist([0, 1])), v.nullable(v.picklist([0, 1]))]),
    }),
  ),
  /** Meubles posés encore usés (mobilier de Simone, rénovation à faire). */
  worn: v.array(v.string()),
  /** Objets de décoration posés sur un meuble: ils partent en réserve si on le déplace. */
  supports: v.array(v.strictObject({ piece: v.string(), support: v.string() })),
  /** Extensions achetées (travaux) et ouvertes. */
  works: v.array(v.strictObject({ extension: v.string(), readyDay: Int })),
  extensions: v.array(v.string()),
  /** Revêtements appliqués par pièce (identifiant d'article). */
  walls: v.record(v.string(), v.string()),
  floors: v.record(v.string(), v.string()),
  /** Offre de la brocante de la semaine (jour du tirage, articles). */
  brocante: v.strictObject({ day: Int, items: v.array(v.string()) }),
  /** Pièces uniques déjà reçues (une seule fois chacune). */
  uniques: v.array(v.string()),
  /** Achat important proposé à l'autre (DE-10), en attente de sa réponse. */
  proposal: v.nullable(
    v.strictObject({
      player: Player,
      item: v.string(),
      room: v.nullable(v.string()),
      price: v.number(),
    }),
  ),
});
export type ArrangementState = v.InferOutput<typeof ArrangementStateSchema>;

export function createArrangementState(): ArrangementState {
  return {
    nextFurnitureId: 0,
    initialized: false,
    lastDay: 0,
    stock: [],
    orders: [],
    cartons: [],
    held: [null, null],
    ghosts: [null, null],
    carry: null,
    worn: [],
    supports: [],
    works: [],
    extensions: [],
    walls: {},
    floors: {},
    brocante: { day: 0, items: [] },
    uniques: [],
    proposal: null,
  };
}
