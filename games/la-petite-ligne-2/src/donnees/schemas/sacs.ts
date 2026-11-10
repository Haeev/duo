/** `donnees/commun/sacs.json`: barre d'outils et sacs (cahier 4.5, réponse 20). */
import * as v from 'valibot';
import { FileVersionSchema, IdSchema, IntSchema, LabelSchema } from './communs';

export const BagSchema = v.strictObject({
  id: IdSchema,
  name: LabelSchema,
  /** Cases en plus de la barre. */
  slots: v.pipe(IntSchema, v.minValue(1), v.maxValue(40)),
});
export type BagDef = v.InferOutput<typeof BagSchema>;

export const BagsFileSchema = v.strictObject({
  schema: FileVersionSchema,
  /** Cases de la barre, là dès le début: il n'y a pas de sac au départ. */
  toolbarSlots: v.pipe(IntSchema, v.minValue(1), v.maxValue(10)),
  /** Du plus petit au plus grand. */
  bags: v.array(BagSchema),
});
export type BagsFile = v.InferOutput<typeof BagsFileSchema>;
