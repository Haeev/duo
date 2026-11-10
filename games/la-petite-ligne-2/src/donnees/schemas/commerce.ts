/**
 * `donnees/lieux/<lieu>/commerces/<id>.json`: un commerçant vend sa liste et ne rachète que ce
 * qui touche à son métier, à son prix (réponse 34). Prix en euros entiers. Moteur au jalon 2.
 */
import * as v from 'valibot';
import { CountSchema, FileVersionSchema, IdSchema, IntSchema, LabelSchema } from './communs';
import { ITEM_FAMILIES } from './objets';

const Price = v.pipe(CountSchema, v.minValue(1));
const MinuteOfDay = v.pipe(IntSchema, v.minValue(0), v.maxValue(1440));

export const ShopSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  name: LabelSchema,
  /** L'habitant qui tient le commerce. */
  keeper: IdSchema,
  hours: v.strictObject({ from: MinuteOfDay, to: MinuteOfDay }),
  sells: v.array(
    v.strictObject({
      item: IdSchema,
      price: Price,
      dailyStock: v.nullable(v.pipe(IntSchema, v.minValue(1))),
    }),
  ),
  /** Rachats: par objet précis ou par famille d'objets; le plus précis l'emporte. */
  buys: v.array(
    v.union([
      v.strictObject({ item: IdSchema, price: Price }),
      v.strictObject({ family: v.picklist(ITEM_FAMILIES), price: Price }),
    ]),
  ),
});
export type ShopDef = v.InferOutput<typeof ShopSchema>;
