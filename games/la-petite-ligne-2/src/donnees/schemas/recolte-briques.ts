/**
 * Briques du potager et des ressources du monde (lot outils et cultures), et leur état. Fichier à
 * part: `briques.ts` l'étale dans `BRICK_SCHEMAS`, `etat/briques.ts` y prend les états. Il
 * n'importe rien de `briques.ts` (import circulaire): les outils du potager y sont redits.
 */
import * as v from 'valibot';
import { IdSchema, IntSchema } from './communs';

/** Les outils dont la terre cultivable se sert en plus des graines et des mains nues. */
export const FIELD_TOOLS = ['spade', 'can'] as const;

/** Clé d'un fait de la mémoire (`regles.ts`, `FactKeySchema`), redite ici pour la même raison. */
const FactKey = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]*(\.[a-z0-9-]+){0,3}$/));

export const HARVEST_BRICK_SCHEMAS = [
  /**
   * Point de récolte du monde (arbre, rocher, buisson, fleurs, point de fouille, arbre fruitier):
   * tout ce qu'il fait vient de sa fiche `commun/ressources/<resource>.json`.
   */
  v.strictObject({ brick: v.literal('harvest'), resource: IdSchema }),
  /**
   * Terre cultivable: chaque case de l'emprise du meuble peut devenir une parcelle. Le nombre de
   * parcelles monte avec les améliorations: la plus grande valeur de `plots` dont le fait est
   * retenu (`fact: null`: dès le départ).
   */
  v.strictObject({
    brick: v.literal('field'),
    tools: v.pipe(v.array(v.picklist(FIELD_TOOLS)), v.minLength(1)),
    plots: v.pipe(
      v.array(
        v.strictObject({
          cells: v.pipe(IntSchema, v.minValue(1), v.maxValue(64)),
          fact: v.nullable(FactKey),
        }),
      ),
      v.minLength(1),
      v.maxLength(6),
    ),
  }),
] as const;

/** Un point de récolte: travail déjà fait (coups cumulés) et jour de sa repousse (`null`: en place). */
export const HarvestStateSchema = v.strictObject({
  work: v.pipe(IntSchema, v.minValue(0)),
  back: v.nullable(v.pipe(IntSchema, v.minValue(1))),
});
export type HarvestState = v.InferOutput<typeof HarvestStateSchema>;

/** Une parcelle bêchée: sa culture (`null`: terre nue) et sa pousse. */
export const PlotSchema = v.strictObject({
  crop: v.nullable(IdSchema),
  /** Points de pousse cumulés (jour sec: 1, jour arrosé ou de pluie: 2, `cultures/reglages.ts`). */
  growth: v.pipe(IntSchema, v.minValue(0), v.maxValue(999)),
  /** Arrosée aujourd'hui (ou pluie). */
  watered: v.boolean(),
  /** Jours de pousse et jours arrosés depuis le semis (ou la dernière récolte): la qualité. */
  days: v.pipe(IntSchema, v.minValue(0), v.maxValue(999)),
  wet: v.pipe(IntSchema, v.minValue(0), v.maxValue(999)),
  /** Dernier jour compté. */
  day: v.pipe(IntSchema, v.minValue(1)),
});
export type Plot = v.InferOutput<typeof PlotSchema>;

/** Terre cultivable: une case par mètre carré de l'emprise (`null`: pas bêchée), et le coup en cours. */
export const FieldStateSchema = v.strictObject({
  cells: v.pipe(v.array(v.nullable(PlotSchema)), v.maxLength(64)),
  /** Bêchage commencé sur une case (les coups se cumulent), `null`: aucun. */
  work: v.nullable(v.strictObject({ cell: v.pipe(IntSchema, v.minValue(0)), points: IntSchema })),
});
export type FieldState = v.InferOutput<typeof FieldStateSchema>;
