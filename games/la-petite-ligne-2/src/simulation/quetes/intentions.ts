/** Intentions des quêtes. */
import * as v from 'valibot';
import { IdSchema } from '../../donnees/schemas/communs';

export const QUEST_INTENTS = [
  /** Suivre une suite ouverte (une seule à la fois par joueur), `null`: ne plus rien suivre. */
  v.strictObject({ type: v.literal('quest_track'), quest: v.nullable(IdSchema) }),
  /** Ce joueur ferme l'écran de fin de chapitre; il disparaît quand les deux l'ont fermé. */
  v.strictObject({ type: v.literal('chapter_end_close') }),
] as const;
