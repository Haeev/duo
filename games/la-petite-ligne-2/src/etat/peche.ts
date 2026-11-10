/**
 * État de la pêche d'un lieu (champ facultatif `fishing` de la tranche « lieu »). Les ombres ne
 * sont pas transmises: chaque machine les recalcule depuis `seed`, l'heure et la météo
 * (`simulation/peche/ombres.ts`); seules partent les ombres déjà prises et les lignes à l'eau.
 */
import * as v from 'valibot';
import { FiniteSchema, IdSchema, IntSchema, TickSchema } from '../donnees/schemas/communs';

const ShadowIdSchema = v.pipe(v.string(), v.regex(/^\d{1,9}-\d$/));

/** Une ligne à l'eau: le bouchon, l'ombre qui vient, la graine de la touche et du combat. */
export const FishingLineSchema = v.strictObject({
  spot: IdSchema,
  /** Bouchon (m). */
  x: FiniteSchema,
  y: FiniteSchema,
  /** Où se tenait le pêcheur au lancer: s'il s'en éloigne, la ligne est rangée. */
  stanceX: FiniteSchema,
  stanceY: FiniteSchema,
  shadow: ShadowIdSchema,
  catch: IdSchema,
  /** Graine de la touche et du combat, joués sur la machine du pêcheur. */
  seed: v.pipe(IntSchema, v.minValue(0)),
  /** Pas du lancer, et temps d'approche de l'ombre (s). */
  tick: TickSchema,
  approach: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(60)),
  /** Aide du pêcheur au lancer (canne, repos): figée pour que l'hôte rejoue le même combat. */
  help: v.pipe(FiniteSchema, v.minValue(0.2), v.maxValue(4)),
  /** Le poisson est ferré: le combat se joue (le partenaire voit la canne pliée). */
  hooked: v.boolean(),
});
export type FishingLine = v.InferOutput<typeof FishingLineSchema>;

export const FishingPlaceStateSchema = v.strictObject({
  seed: v.pipe(IntSchema, v.minValue(0)),
  /** Ombres parties (prises ou effrayées) de la vague en cours, `<vague>-<rang>`. */
  taken: v.pipe(v.array(ShadowIdSchema), v.maxLength(64)),
  lines: v.tuple([v.nullable(FishingLineSchema), v.nullable(FishingLineSchema)]),
});
export type FishingPlaceState = v.InferOutput<typeof FishingPlaceStateSchema>;
