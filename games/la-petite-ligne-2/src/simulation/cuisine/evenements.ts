/** Événements de la cuisine: l'interface, le rendu et le son des deux machines les lisent. */
import * as v from 'valibot';
import { IdSchema, IntSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';
import { STATIONS } from '../../donnees/schemas/briques';

const Part = v.picklist([0, 1]);
const Grade = v.pipe(IntSchema, v.minValue(1), v.maxValue(3));

export const COOK_EVENTS = [
  /** Le joueur a ouvert le livre de recettes à ce poste. */
  v.strictObject({
    type: v.literal('kitchen_opened'),
    player: PlayerIndexSchema,
    target: IdSchema,
    station: v.picklist(STATIONS),
  }),
  /** Début du mini-jeu: sa part et la graine qui place les zones, identiques sur les deux machines. */
  v.strictObject({
    type: v.literal('cook_started'),
    player: PlayerIndexSchema,
    recipe: IdSchema,
    part: Part,
    target: IdSchema,
    seed: v.pipe(IntSchema, v.minValue(0)),
  }),
  /** Une étape notée: le partenaire voit la frise avancer, le son du geste part. */
  v.strictObject({
    type: v.literal('cook_step_done'),
    player: PlayerIndexSchema,
    recipe: IdSchema,
    part: Part,
    step: v.pipe(IntSchema, v.minValue(0)),
    grade: Grade,
    /** Faite avant l'étape qu'elle attend (repas à deux): un cran de moins. */
    early: v.boolean(),
  }),
  /** Une part d'un repas à deux est prête: on attend l'autre. */
  v.strictObject({
    type: v.literal('cook_part_done'),
    player: PlayerIndexSchema,
    recipe: IdSchema,
    part: Part,
  }),
  v.strictObject({
    type: v.literal('cook_cancelled'),
    player: PlayerIndexSchema,
    recipe: IdSchema,
  }),
  /** Le plat sort; `first`: jamais cuisiné, on le fête; `shared`: repas fait à deux. */
  v.strictObject({
    type: v.literal('dish_cooked'),
    player: PlayerIndexSchema,
    recipe: IdSchema,
    quality: Grade,
    item: IdSchema,
    count: v.pipe(IntSchema, v.minValue(1)),
    first: v.boolean(),
    shared: v.boolean(),
  }),
  /** Recette apprise pour les deux (livre lu, essai réussi). */
  v.strictObject({
    type: v.literal('recipe_learned'),
    player: PlayerIndexSchema,
    recipe: IdSchema,
    how: v.picklist(['book', 'trial']),
  }),
] as const;
