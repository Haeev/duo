/** Événements de la commande de la semaine et du courrier: l'interface et le son les lisent. */
import * as v from 'valibot';
import { CentsSchema, IdSchema, IntSchema, PlayerIndexSchema } from '../../donnees/schemas/communs';

const Count = v.pipe(IntSchema, v.minValue(0));

export const ORDER_EVENTS = [
  /** Le joueur a choisi « Livrer la commande »: son écran de livraison s'ouvre. */
  v.strictObject({ type: v.literal('order_opened'), player: PlayerIndexSchema, place: IdSchema }),
  /** Une nouvelle commande est au carnet (`lines`: lignes, reports compris). */
  v.strictObject({
    type: v.literal('order_renewed'),
    place: IdSchema,
    due: v.pipe(IntSchema, v.minValue(1)),
    lines: Count,
  }),
  /** Une ligne livrée, en tout ou en partie, et payée (`paid`, centimes). */
  v.strictObject({
    type: v.literal('order_delivered'),
    player: PlayerIndexSchema,
    place: IdSchema,
    line: IdSchema,
    item: IdSchema,
    count: Count,
    paid: CentsSchema,
    /** La ligne est complète. */
    done: v.boolean(),
  }),
  /** Le courrier qui attendait est remis à ce joueur. */
  v.strictObject({
    type: v.literal('mail_taken'),
    player: PlayerIndexSchema,
    place: IdSchema,
    letters: v.pipe(v.array(IdSchema), v.maxLength(12)),
  }),
] as const;
