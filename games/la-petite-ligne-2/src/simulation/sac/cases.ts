/** Désignation d'une case: dans la barre ou dans le sac. Partagée par les lots qui déplacent des objets. */
import * as v from 'valibot';
import { IntSchema } from '../../donnees/schemas/communs';

export const SlotRefSchema = v.strictObject({
  area: v.picklist(['toolbar', 'bag']),
  index: v.pipe(IntSchema, v.minValue(0), v.maxValue(39)),
});
export type SlotRef = v.InferOutput<typeof SlotRefSchema>;
