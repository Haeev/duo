/** Événements du voyage en train (lot L2). */
import * as v from 'valibot';
import { IdSchema } from '../../donnees/schemas/communs';

export const TRAVEL_EVENTS = [
  /** Les deux sont à bord: chaque machine lance la scène du wagon et charge le lieu. */
  v.strictObject({ type: v.literal('train_departed'), from: IdSchema, to: IdSchema }),
  /** Les deux machines sont prêtes: on descend sur le quai d'arrivée. */
  v.strictObject({ type: v.literal('train_arrived'), place: IdSchema }),
] as const;
