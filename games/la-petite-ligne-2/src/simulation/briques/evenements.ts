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
  /** Brique `store`: ce joueur ouvre le rangement; son interface en montre les cases. */
  v.strictObject({ type: v.literal('store_opened'), player: PlayerIndexSchema, target: IdSchema }),
  /** Brique `mirror`: ce joueur se regarde; son interface rouvre l'éditeur de personnage. */
  v.strictObject({ type: v.literal('mirror_opened'), player: PlayerIndexSchema, target: IdSchema }),
  /** Ce joueur s'est couché à l'heure de dormir, l'autre veille encore: une ligne le lui dit. */
  v.strictObject({ type: v.literal('sleep_waiting'), player: PlayerIndexSchema }),
] as const;
