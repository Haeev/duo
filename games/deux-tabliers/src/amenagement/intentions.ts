// Intentions du chantier « amenagement » (invité vers hôte, et joueur local de l'hôte).
// L'hôte revérifie tout (portée, prix, palier, règles de pose): une intention n'est qu'une demande.
import { v } from '@duo/sdk';

const Coord = v.pipe(v.number(), v.minValue(-100), v.maxValue(100));
const Rot = v.pipe(v.number(), v.minValue(-720), v.maxValue(720));
const Name = v.pipe(v.string(), v.maxLength(60));

/** Où l'on pose la pièce tenue: proposée par la machine qui vise, revérifiée par l'hôte. */
export const PlacementRequestSchema = v.strictObject({
  x: Coord,
  z: Coord,
  y: v.pipe(v.number(), v.minValue(0), v.maxValue(4)),
  rotDeg: Rot,
  /** Meuble qui porte un objet de décoration (étagère, table, comptoir), sinon `null`. */
  support: v.nullable(Name),
});
export type PlacementRequest = v.InferOutput<typeof PlacementRequestSchema>;

export const ARRANGEMENT_INTENTS = [
  /** Acheter un article du catalogue ou une extension (`room`: pièce d'un revêtement). */
  v.strictObject({ type: v.literal('amenagement-acheter'), item: Name, room: v.nullable(Name) }),
  /** Répondre à un achat important proposé par l'autre (DE-10). */
  v.strictObject({ type: v.literal('amenagement-repondre'), accept: v.boolean() }),
  /** Prendre un meuble posé, ouvrir un carton, ou saisir un côté d'une pièce lourde. */
  v.strictObject({ type: v.literal('amenagement-prendre'), furniture: Name }),
  /** Sortir une pièce de la réserve (index dans `stock`, type pour vérifier). */
  v.strictObject({ type: v.literal('amenagement-sortir'), piece: Name }),
  /** Poser la pièce tenue (ou la charge portée à deux). */
  v.strictObject({ type: v.literal('amenagement-poser'), at: PlacementRequestSchema }),
  /** Remettre la pièce tenue là où on l'a prise. */
  v.strictObject({ type: v.literal('amenagement-annuler') }),
  /** Ranger en réserve la pièce tenue, ou le meuble visé (`furniture`). */
  v.strictObject({ type: v.literal('amenagement-ranger'), furniture: v.nullable(Name) }),
  /** Lâcher son côté d'une charge portée à deux. */
  v.strictObject({ type: v.literal('amenagement-lacher') }),
  /** Tourner la charge portée à deux d'un pas (-1 ou 1). */
  v.strictObject({ type: v.literal('amenagement-tourner'), dir: v.picklist([-1, 1]) }),
  /** Rénover un meuble usé de Simone. */
  v.strictObject({ type: v.literal('amenagement-renover'), furniture: Name }),
  /** Position du fantôme, pour que l'autre la voie (quelques fois par seconde au plus). */
  v.strictObject({
    type: v.literal('amenagement-fantome'),
    at: v.nullable(PlacementRequestSchema),
    ok: v.boolean(),
  }),
] as const;
