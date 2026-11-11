/** Intentions de l'écran de livraison: l'hôte valide (guichet ouvert, à portée de qui reçoit). */
import * as v from 'valibot';
import { IdSchema } from '../../donnees/schemas/communs';

export const ORDER_INTENTS = [
  /** Livre une ligne: autant que possible, du sac d'abord, puis des rangements du guichet. */
  v.strictObject({ type: v.literal('order_deliver'), line: IdSchema }),
  /** Prend le courrier qui attend (les pièces jointes vont à ce joueur). */
  v.strictObject({ type: v.literal('mail_take') }),
] as const;
