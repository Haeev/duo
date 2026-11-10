/** Intentions du voyage en train (lot L2, ADR 0018). */
import * as v from 'valibot';
import { IdSchema } from '../../donnees/schemas/communs';

export const TRAVEL_INTENTS = [
  /** Sur le quai: « Monter » vers ce lieu, ou redescendre (`to: null`). */
  v.strictObject({ type: v.literal('board'), to: v.nullable(IdSchema) }),
  /** La machine de ce joueur a chargé le lieu d'arrivée. */
  v.strictObject({ type: v.literal('place_loaded'), place: IdSchema }),
] as const;
