/** Événements des habitants: lus par le rendu (émotion, porte), l'interface et le son. */
import * as v from 'valibot';
import { IdSchema, IntSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';

export const VILLAGER_EVENTS = [
  /** Premier contact du jour avec ce joueur: onomatopée et petit son. */
  v.strictObject({
    type: v.literal('villager_greeted'),
    villager: IdSchema,
    player: PlayerIndexSchema,
    emote: IdSchema,
  }),
  /** Réaction à un acte du joueur déclaré dans sa fiche (`runs`, `dirty`, `gesture`). */
  v.strictObject({
    type: v.literal('villager_reacted'),
    villager: IdSchema,
    player: PlayerIndexSchema,
    act: IdSchema,
    emote: IdSchema,
  }),
  /** Cadeau reçu: ce qu'il en pense et les points d'amitié vraiment gagnés. */
  v.strictObject({
    type: v.literal('villager_gift'),
    villager: IdSchema,
    player: PlayerIndexSchema,
    item: IdSchema,
    taste: v.picklist(['loved', 'liked', 'neutral', 'disliked']),
    points: v.pipe(IntSchema, v.minValue(0)),
  }),
  /** Il passe une porte (meuble à brique `open`): le rendu l'ouvre un instant, le son grince. */
  v.strictObject({ type: v.literal('villager_door'), villager: IdSchema, door: IdSchema }),
  /** Il descend du train (fin de son absence) ou y remonte. */
  v.strictObject({ type: v.literal('villager_arrived'), villager: IdSchema }),
  v.strictObject({ type: v.literal('villager_left'), villager: IdSchema }),
] as const;
