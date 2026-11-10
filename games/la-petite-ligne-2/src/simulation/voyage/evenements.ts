/** Événements du voyage en train (lot L2). */
import * as v from 'valibot';
import { IdSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';

export const TRAVEL_EVENTS = [
  /** Ce joueur est monté sur le marchepied vers `to`, ou en est redescendu (`null`). */
  v.strictObject({
    type: v.literal('train_boarded'),
    player: PlayerIndexSchema,
    to: v.nullable(IdSchema),
  }),
  /** Le chargement dure: quelle machine est prête (« l'autre charge encore »). */
  v.strictObject({ type: v.literal('train_waiting'), loaded: v.tuple([v.boolean(), v.boolean()]) }),
  /** Les deux sont à bord: chaque machine lance la scène du wagon et charge le lieu. */
  v.strictObject({ type: v.literal('train_departed'), from: IdSchema, to: IdSchema }),
  /** Les deux machines sont prêtes: on descend sur le quai d'arrivée. */
  v.strictObject({ type: v.literal('train_arrived'), place: IdSchema }),
] as const;
