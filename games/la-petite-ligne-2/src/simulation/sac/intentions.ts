/** Intentions du sac, de la barre et de l'argent (lot L3). */
import * as v from 'valibot';
import { IntSchema } from '../../donnees/schemas/communs';
import { SlotRefSchema } from './cases';

/** Montant en centimes, positif. */
const Cents = v.pipe(IntSchema, v.minValue(1), v.maxValue(1_000_000));

export const BAG_INTENTS = [
  /** Déplace ou échange deux cases (les piles du même objet se rejoignent jusqu'à leur limite). */
  v.strictObject({ type: v.literal('move_stack'), from: SlotRefSchema, to: SlotRefSchema }),
  /** Pose la pile au sol, devant le personnage. */
  v.strictObject({ type: v.literal('drop'), from: SlotRefSchema }),
  /** Ramasse un objet posé au sol (identifiant de `place.ground`). */
  v.strictObject({ type: v.literal('pick_up'), ground: v.pipe(IntSchema, v.minValue(0)) }),
  /** Donne la pile de cette case à l'autre joueur, à portée de main. */
  v.strictObject({ type: v.literal('give_stack'), from: SlotRefSchema }),
  /** Coffre commun: verser de sa bourse, ou en retirer. */
  v.strictObject({ type: v.literal('chest_deposit'), amount: Cents }),
  v.strictObject({ type: v.literal('chest_withdraw'), amount: Cents }),
] as const;
