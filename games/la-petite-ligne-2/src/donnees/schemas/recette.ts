/**
 * `donnees/commun/recettes/<id>.json`: une recette de cuisine ou un plan d'établi. Moteur de la
 * cuisine: `simulation/cuisine/` (conception: `docs/jeux/jeu-1/refonte/cuisine.md`).
 */
import * as v from 'valibot';
import {
  CountSchema,
  FileVersionSchema,
  FiniteSchema,
  IdSchema,
  IntSchema,
  LabelSchema,
} from './communs';
import { STATIONS } from './briques';

const Portion = v.strictObject({ item: IdSchema, count: v.pipe(CountSchema, v.minValue(1)) });
const Inputs = v.pipe(v.array(Portion), v.minLength(1), v.maxLength(6));
const StationSchema = v.picklist(STATIONS);

/** Gestes du mini-jeu: couper, remuer, cuire, assaisonner, dresser. */
export const COOK_STEP_KINDS = ['chop', 'stir', 'heat', 'season', 'plate'] as const;
export type CookStepKind = (typeof COOK_STEP_KINDS)[number];

export const CookStepSchema = v.strictObject({
  kind: v.picklist(COOK_STEP_KINDS),
  /** Nombre de gestes de l'étape (coups, tours, cuissons, pincées, flèches). */
  count: v.pipe(IntSchema, v.minValue(1), v.maxValue(12)),
  /** Allure: 1 normale, plus grand plus vif (borné pour ne jamais marteler). */
  pace: v.exactOptional(v.pipe(FiniteSchema, v.minValue(0.6), v.maxValue(1.5))),
  /** Seconde part d'un repas à deux: cette étape attend l'étape n de la première part. */
  after: v.exactOptional(v.pipe(IntSchema, v.minValue(0), v.maxValue(5))),
});
export type CookStep = v.InferOutput<typeof CookStepSchema>;

const Steps = v.pipe(v.array(CookStepSchema), v.minLength(1), v.maxLength(6));

export const RecipeSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  name: LabelSchema,
  /** Poste où elle se fait (brique `cook` d'un meuble). */
  station: StationSchema,
  inputs: Inputs,
  output: Portion,
  /** Durée visée (s): celle du mini-jeu s'il y a des étapes; une recette sans étapes est immédiate. */
  seconds: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(60)),
  /** Connue dès le début, ou apprise (habitant, livre, essai). */
  known: v.picklist(['start', 'learned']),
  /** Étapes du mini-jeu; absentes: recette simple, sans mini-jeu. */
  steps: v.exactOptional(Steps),
  /** Ce que donne un plat meilleur (remplace `output`); absent: le même plat. */
  quality: v.exactOptional(
    v.strictObject({ good: v.exactOptional(Portion), perfect: v.exactOptional(Portion) }),
  ),
  /** Comment l'apprendre, en plus d'un habitant (effet `remember` sur `cuisine.recette.<id>`). */
  learn: v.exactOptional(
    v.strictObject({
      /** Objet livre: le lire au poste apprend la recette. */
      book: v.exactOptional(IdSchema),
      /** Se trouve en cuisinant ses ingrédients, sans la connaître. */
      trial: v.exactOptional(v.boolean()),
    }),
  ),
  /** Seconde part d'un repas à deux, sur un autre poste de la même cuisine. */
  second: v.exactOptional(v.strictObject({ station: StationSchema, inputs: Inputs, steps: Steps })),
});
export type RecipeDef = v.InferOutput<typeof RecipeSchema>;
