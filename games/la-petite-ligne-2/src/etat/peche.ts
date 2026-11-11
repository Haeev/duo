/**
 * État de la pêche d'un lieu (champ facultatif `fishing` de la tranche « lieu »). Les ombres ne
 * sont pas transmises: chaque machine les recalcule depuis `seed`, l'heure et la météo
 * (`simulation/peche/ombres.ts`); seules partent les ombres déjà prises et les lignes à l'eau.
 */
import * as v from 'valibot';
import {
  FiniteSchema,
  IdSchema,
  IntSchema,
  PlayerIndexSchema,
  TickSchema,
} from '../donnees/schemas/communs';

/** `<vague>-<rang>`; `<vague>-u<rang>` pour l'ombre d'une prise unique. */
const ShadowIdSchema = v.pipe(v.string(), v.regex(/^\d{1,9}-u?\d$/));

/**
 * Pêche à deux (prise unique `crew: "pair"`), tenue par l'hôte: l'un à la canne (le joueur de la
 * ligne), l'autre à l'épuisette. Les élans et remontées du poisson sont une fonction pure de la
 * graine et des pas (`simulation/peche/a-deux.ts`): seuls partent les gestes des joueurs.
 */
export const PairFightSchema = v.strictObject({
  netter: PlayerIndexSchema,
  /** Pas de la touche (début du combat). */
  since: TickSchema,
  /** Secondes tenues pendant ses élans (moins celles tenues à contretemps). */
  held: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(120)),
  /** La canne est tenue (touche enfoncée chez le pêcheur). */
  down: v.boolean(),
  /** Pas où elle s'est fatiguée (elle remonte par moments), `null`: elle se bat encore. */
  tired: v.nullable(TickSchema),
  /** Plongeons d'épuisette ratés. */
  misses: v.pipe(IntSchema, v.minValue(0), v.maxValue(99)),
  /**
   * Aides de la canne et de l'épuisette (cran de chaque joueur, `simulation/aide`), figées à la
   * touche: les deux machines lisent les mêmes phases. Absentes: 1 (combats d'avant).
   */
  rodAid: v.exactOptional(v.pipe(FiniteSchema, v.minValue(1), v.maxValue(2))),
  netAid: v.exactOptional(v.pipe(FiniteSchema, v.minValue(1), v.maxValue(2))),
});
export type PairFight = v.InferOutput<typeof PairFightSchema>;

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
  /** Appât de la ligne (objet du sac, retiré à la touche). */
  bait: v.exactOptional(IdSchema),
  /** Pêche à deux en cours (après la touche d'une prise qui la demande). */
  pair: v.exactOptional(PairFightSchema),
});
export type FishingLine = v.InferOutput<typeof FishingLineSchema>;

export const FishingPlaceStateSchema = v.strictObject({
  seed: v.pipe(IntSchema, v.minValue(0)),
  /** Ombres parties (prises ou effrayées) de la vague en cours, `<vague>-<rang>`. */
  taken: v.pipe(v.array(ShadowIdSchema), v.maxLength(64)),
  lines: v.tuple([v.nullable(FishingLineSchema), v.nullable(FishingLineSchema)]),
});
export type FishingPlaceState = v.InferOutput<typeof FishingPlaceStateSchema>;
