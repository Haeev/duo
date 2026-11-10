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
  /**
   * Une page s'affiche (réplique ou choix): le babil de `speaker` part chez les deux joueurs, le
   * texte se lit dans les données au nœud `node` (`talkView`).
   */
  v.strictObject({
    type: v.literal('talk_page'),
    player: PlayerIndexSchema,
    villager: IdSchema,
    node: IdSchema,
    speaker: IdSchema,
  }),
] as const;
