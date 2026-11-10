/**
 * Événements des quêtes: la notification discrète (« Étape franchie: ... ») et le carnet les
 * lisent; le texte vient des données (`objective` de l'étape), jamais de l'événement.
 */
import * as v from 'valibot';
import { IdSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';

export const QUEST_EVENTS = [
  v.strictObject({ type: v.literal('quest_opened'), quest: IdSchema }),
  /** Étape franchie pour les deux; `by`: le joueur au nom de qui elle passe. */
  v.strictObject({
    type: v.literal('quest_step_done'),
    quest: IdSchema,
    step: IdSchema,
    by: PlayerIndexSchema,
  }),
  v.strictObject({ type: v.literal('quest_done'), quest: IdSchema }),
] as const;
