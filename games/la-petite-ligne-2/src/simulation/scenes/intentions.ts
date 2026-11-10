/** Intentions des scènes. */
import * as v from 'valibot';

export const SCENE_INTENTS = [
  /** Réplique de scène lue: elle passe quand chaque joueur concerné l'a lue (ou au délai). */
  v.strictObject({ type: v.literal('scene_next') }),
] as const;
