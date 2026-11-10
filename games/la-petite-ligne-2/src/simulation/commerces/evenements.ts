/** Événements des commerces. Les refus partent en `refused` (raisons dans le README du dossier). */
import * as v from 'valibot';
import {
  CentsSchema,
  CountSchema,
  IdSchema,
  PlayerIndexSchema,
} from '../../donnees/schemas/communs';

export const SHOP_EVENTS = [
  /** Ce joueur ouvre la boutique: son interface la montre (les deux peuvent y être ensemble). */
  v.strictObject({ type: v.literal('shop_opened'), player: PlayerIndexSchema, shop: IdSchema }),
  /** Achat fait: `chest` centimes payés par le coffre commun, le reste par la bourse. */
  v.strictObject({
    type: v.literal('shop_bought'),
    player: PlayerIndexSchema,
    shop: IdSchema,
    item: IdSchema,
    count: CountSchema,
    cents: CentsSchema,
    chest: CentsSchema,
  }),
  /** Vente faite; `need`: c'était le besoin du jour (une belle vente, « ♪ »). */
  v.strictObject({
    type: v.literal('shop_sold'),
    player: PlayerIndexSchema,
    shop: IdSchema,
    item: IdSchema,
    count: CountSchema,
    cents: CentsSchema,
    need: v.boolean(),
  }),
] as const;
