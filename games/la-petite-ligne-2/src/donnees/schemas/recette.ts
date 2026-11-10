/** `donnees/commun/recettes/<id>.json`: une recette de cuisine ou un plan d'établi (moteur au jalon 2). */
import * as v from 'valibot';
import { CountSchema, FileVersionSchema, FiniteSchema, IdSchema, LabelSchema } from './communs';
import { STATIONS } from './briques';

const Portion = v.strictObject({ item: IdSchema, count: v.pipe(CountSchema, v.minValue(1)) });

export const RecipeSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  name: LabelSchema,
  /** Poste où elle se fait (brique `cook` d'un meuble). */
  station: v.picklist(STATIONS),
  inputs: v.pipe(v.array(Portion), v.minLength(1), v.maxLength(6)),
  output: Portion,
  /** Durée de la préparation (s); une recette de `kitchen` passe par le mini-jeu. */
  seconds: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(60)),
  /** Connue dès le début, ou apprise (habitant, quête, essai). */
  known: v.picklist(['start', 'learned']),
});
export type RecipeDef = v.InferOutput<typeof RecipeSchema>;
