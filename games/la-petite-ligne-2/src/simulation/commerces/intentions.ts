/** Intentions des commerces: acheter et vendre par quantité, validées par l'hôte. */
import * as v from 'valibot';
import { IdSchema, IntSchema } from '../../donnees/schemas/communs';
import { SHOP_TUNING } from './reglages';

const Count = v.pipe(IntSchema, v.minValue(1), v.maxValue(SHOP_TUNING.maxCount));

export const SHOP_INTENTS = [
  /** `chest`: payer avec le coffre commun, quand l'article le permet (`payment`). */
  v.strictObject({
    type: v.literal('shop_buy'),
    shop: IdSchema,
    item: IdSchema,
    count: Count,
    chest: v.boolean(),
  }),
  v.strictObject({ type: v.literal('shop_sell'), shop: IdSchema, item: IdSchema, count: Count }),
] as const;
