/** Événements du sac et de la barre (lot L3). */
import * as v from 'valibot';
import { CountSchema, IdSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';

export const BAG_EVENTS = [
  v.strictObject({ type: v.literal('item_gained'), player: PlayerIndexSchema, item: IdSchema, count: CountSchema }),
  /** Plus de place: l'objet reste au sol et brille. */
  v.strictObject({ type: v.literal('pockets_full'), player: PlayerIndexSchema, item: IdSchema }),
] as const;
