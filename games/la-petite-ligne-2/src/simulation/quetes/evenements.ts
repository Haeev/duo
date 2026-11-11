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
  /** Un départ vers un lieu à venir montre l'écran de fin de chapitre (`chapterEndView`). */
  v.strictObject({ type: v.literal('chapter_ended'), place: IdSchema, ending: IdSchema }),
  /**
   * Le duo reçoit une récompense qui n'est pas un objet (`regles/recompenses.ts`): une recette,
   * un plan d'artisanat ou une pièce de tenue (`id` dans son catalogue). L'interface des deux
   * joueurs l'annonce; `by`: le joueur dont le geste l'a value.
   */
  /**
   * Décision à deux: `player` vient de dire `option`. `waiting`: l'autre n'a rien dit; `split`:
   * deux avis, l'interface invite à se mettre d'accord; `agreed`: la décision est prise.
   */
  v.strictObject({
    type: v.literal('decision_changed'),
    decision: IdSchema,
    player: PlayerIndexSchema,
    option: IdSchema,
    state: v.picklist(['waiting', 'split', 'agreed']),
  }),
  v.strictObject({
    type: v.literal('reward_given'),
    by: PlayerIndexSchema,
    kind: v.picklist(['recipe', 'plan', 'piece']),
    id: IdSchema,
  }),
] as const;
