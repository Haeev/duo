/**
 * Pêche (cahier 4.7, R29): caractère d'un poisson (bloc `fish` d'une prise) et coins de pêche
 * d'un lieu (champ `fishing` de `lieu.json`). Moteur: `src/simulation/peche/`.
 */
import * as v from 'valibot';
import { FiniteSchema, IdSchema, IntSchema, RectSchema } from './communs';

const Unit = v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1));
const Seconds = (min: number, max: number) =>
  v.pipe(FiniteSchema, v.minValue(min), v.maxValue(max));

export const SHADOW_SIZES = ['small', 'medium', 'large', 'huge'] as const;
export type ShadowSize = (typeof SHADOW_SIZES)[number];

/** Comment le poisson se défend: c'est tout ce qui distingue un combat d'un autre. */
export const FishTraitsSchema = v.strictObject({
  /** Poids de ses élans, de 0 (il se laisse tirer) à 1 (il emporte la ligne). */
  force: Unit,
  /** Changements de côté pendant un élan et frétillement, de 0 à 1. */
  nervousness: Unit,
  /** Durée moyenne d'un élan et d'un souffle (s). */
  rhythm: v.strictObject({ pull: Seconds(0.5, 6), rest: Seconds(0.5, 6) }),
  /** Secondes à le tenir dans la bonne tension pour l'épuiser. */
  stamina: Seconds(2, 30),
  /** Creux du bouchon avant le vrai plongeon (au plus). */
  feints: v.pipe(IntSchema, v.minValue(0), v.maxValue(4)),
  /** Longueur tirée à la prise (cm). */
  sizeCm: v.strictObject({
    min: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(300)),
    max: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(300)),
  }),
  shadow: v.picklist(SHADOW_SIZES),
});
export type FishTraits = v.InferOutput<typeof FishTraitsSchema>;

/** Un coin de pêche: une étendue d'eau de la carte et la table de ses poissons. */
export const FishingSpotSchema = v.strictObject({
  id: IdSchema,
  /** Cases d'eau du coin (elles sont aussi dans `blocked` de la carte: on ne marche pas dans l'eau). */
  area: RectSchema,
  /** Ombres visibles en même temps, au plus. */
  shadows: v.pipe(IntSchema, v.minValue(1), v.maxValue(8)),
  /** Poissons du coin (`commun/prises/<id>.json`, avec un bloc `fish`) et leur poids de tirage. */
  table: v.pipe(
    v.array(
      v.strictObject({
        catch: IdSchema,
        weight: v.pipe(FiniteSchema, v.minValue(0.01), v.maxValue(100)),
      }),
    ),
    v.minLength(1),
  ),
});
export type FishingSpot = v.InferOutput<typeof FishingSpotSchema>;
