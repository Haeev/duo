/** Événements des briques: l'objet touché réagit chez les deux joueurs (rebond, son). */
import * as v from 'valibot';
import { BRICK_IDS } from '../../donnees/schemas/briques';
import { IdSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';

export const BRICK_EVENTS = [
  v.strictObject({
    type: v.literal('brick_used'),
    player: PlayerIndexSchema,
    target: IdSchema,
    brick: v.picklist(BRICK_IDS),
  }),
] as const;
