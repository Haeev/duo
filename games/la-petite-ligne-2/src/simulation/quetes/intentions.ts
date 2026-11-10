/** Intentions des quêtes. */
import * as v from 'valibot';
import { IdSchema } from '../../donnees/schemas/communs';

export const QUEST_INTENTS = [
  /** Suivre une suite ouverte (une seule à la fois par joueur), `null`: ne plus rien suivre. */
  v.strictObject({ type: v.literal('quest_track'), quest: v.nullable(IdSchema) }),
] as const;
