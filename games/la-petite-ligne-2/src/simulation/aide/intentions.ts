/** Intention de l'aide: la machine du joueur dit son cran (au départ et à chaque changement). */
import * as v from 'valibot';
import { AssistLevelSchema } from '../../etat/joueur';

export const ASSIST_INTENTS = [
  v.strictObject({ type: v.literal('set_assist'), level: AssistLevelSchema }),
] as const;
