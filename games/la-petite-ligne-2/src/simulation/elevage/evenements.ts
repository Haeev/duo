/** Événements de la basse-cour: l'interface, le rendu et le son des deux machines les lisent. */
import * as v from 'valibot';
import { IdSchema, IntSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';

const Count = v.pipe(IntSchema, v.minValue(0));

export const FARM_EVENTS = [
  /** Le joueur est entré dans l'écran de l'abri. */
  v.strictObject({
    type: v.literal('shelter_opened'),
    player: PlayerIndexSchema,
    target: IdSchema,
  }),
  /** Mangeoire remplie de `rations` (les bêtes picorent). */
  v.strictObject({
    type: v.literal('shelter_filled'),
    player: PlayerIndexSchema,
    target: IdSchema,
    rations: Count,
  }),
  /** Produits ramassés au nid (ils volent vers le sac). */
  v.strictObject({
    type: v.literal('shelter_collected'),
    player: PlayerIndexSchema,
    target: IdSchema,
    count: Count,
  }),
  /** Bête caressée: un cœur monte, elle s'ébroue. */
  v.strictObject({
    type: v.literal('animal_petted'),
    player: PlayerIndexSchema,
    target: IdSchema,
    animal: Count,
    hearts: Count,
  }),
  /** Bête arrivée (achetée ou reçue); `by` `null`: reçue par l'histoire. */
  v.strictObject({
    type: v.literal('animal_arrived'),
    by: v.nullable(PlayerIndexSchema),
    target: IdSchema,
    animal: Count,
  }),
] as const;
