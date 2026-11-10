/** Intentions des dialogues (lot L3). Ouvrir un dialogue passe par la touche d'action (`act`). */
import * as v from 'valibot';
import { IdSchema } from '../../donnees/schemas/communs';

export const DIALOGUE_INTENTS = [
  /** Réplique lue: passer au nœud suivant. « Tout afficher » est local et ne part pas. */
  v.strictObject({ type: v.literal('talk_next') }),
  v.strictObject({ type: v.literal('talk_choose'), option: IdSchema }),
  v.strictObject({ type: v.literal('talk_close') }),
] as const;
