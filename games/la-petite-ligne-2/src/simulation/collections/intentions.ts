/**
 * Intentions des collections. La touche d'action (`act`) fait aussi le geste quand rien n'est
 * visé et que le filet ou l'appareil est en main; ces deux intentions le demandent directement.
 */
import * as v from 'valibot';

export const COLLECTION_INTENTS = [
  v.strictObject({ type: v.literal('net_swing') }),
  v.strictObject({ type: v.literal('photo_take') }),
] as const;
