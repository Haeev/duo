/** Intentions des besoins (lot L3). */
import * as v from 'valibot';
import { IdSchema } from '../../donnees/schemas/communs';
import { SlotRefSchema } from '../sac/cases';

export const NEEDS_INTENTS = [
  /** Manger l'objet de cette case. */
  v.strictObject({ type: v.literal('eat'), from: SlotRefSchema }),
  /** Servir le repas spécial de cette case aux deux joueurs assis au meuble `target`. */
  v.strictObject({ type: v.literal('serve_meal'), from: SlotRefSchema, target: IdSchema }),
] as const;
