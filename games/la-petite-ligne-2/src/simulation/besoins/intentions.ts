/** Intentions des besoins (lot L3). */
import * as v from 'valibot';
import { SlotRefSchema } from '../sac/cases';

export const NEEDS_INTENTS = [
  /** Manger l'objet de cette case. */
  v.strictObject({ type: v.literal('eat'), from: SlotRefSchema }),
] as const;
