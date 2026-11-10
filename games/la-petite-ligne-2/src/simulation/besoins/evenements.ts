/** Événements des besoins (lot L3). */
import * as v from 'valibot';
import { IdSchema, NeedIdSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';
import { NeedStateSchema } from '../../donnees/schemas/besoins';

export const NEEDS_EVENTS = [
  /** Un besoin change de palier: seul moment où sa jauge paraît à l'écran. */
  v.strictObject({
    type: v.literal('need_tier'),
    player: PlayerIndexSchema,
    need: NeedIdSchema,
    state: NeedStateSchema,
  }),
  v.strictObject({ type: v.literal('ate'), player: PlayerIndexSchema, item: IdSchema }),
] as const;
