/** Intentions du sac et de la barre (lot L3). */
import * as v from 'valibot';
import { SlotRefSchema } from './cases';

export const BAG_INTENTS = [
  /** Déplace ou échange deux cases (les piles du même objet se rejoignent jusqu'à leur limite). */
  v.strictObject({ type: v.literal('move_stack'), from: SlotRefSchema, to: SlotRefSchema }),
  /** Pose la pile au sol, devant le personnage. */
  v.strictObject({ type: v.literal('drop'), from: SlotRefSchema }),
] as const;
