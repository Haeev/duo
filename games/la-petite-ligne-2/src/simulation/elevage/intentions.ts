/** Intentions de la basse-cour: chaque geste de l'écran de l'abri part à l'hôte, qui valide. */
import * as v from 'valibot';
import { IdSchema, IntSchema, LabelSchema } from '../../donnees/schemas/communs';

const Animal = v.pipe(IntSchema, v.minValue(0));

export const FARM_INTENTS = [
  /** Remplir la mangeoire: autant que possible, depuis le sac puis les coffres du lieu. */
  v.strictObject({ type: v.literal('shelter_fill'), target: IdSchema }),
  /** Ramasser tous les produits du nid. */
  v.strictObject({ type: v.literal('shelter_collect'), target: IdSchema }),
  /** Caresser une bête (une fois par jour et par joueur). */
  v.strictObject({ type: v.literal('animal_pet'), target: IdSchema, animal: Animal }),
  /** Acheter une bête de l'espèce de l'abri, payée de la bourse du joueur. */
  v.strictObject({ type: v.literal('animal_buy'), target: IdSchema }),
  /** Donner un nom à une bête. */
  v.strictObject({
    type: v.literal('animal_rename'),
    target: IdSchema,
    animal: Animal,
    name: LabelSchema,
  }),
] as const;
