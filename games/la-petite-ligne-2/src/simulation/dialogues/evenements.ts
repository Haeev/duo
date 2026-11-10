/** Événements des dialogues (lot L3). */
import * as v from 'valibot';
import { IdSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';

export const DIALOGUE_EVENTS = [
  v.strictObject({
    type: v.literal('talk_started'),
    player: PlayerIndexSchema,
    villager: IdSchema,
    dialogue: IdSchema,
  }),
  v.strictObject({ type: v.literal('talk_ended'), player: PlayerIndexSchema, villager: IdSchema }),
] as const;
