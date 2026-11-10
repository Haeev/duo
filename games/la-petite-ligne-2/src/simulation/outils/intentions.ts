/** Intentions de la forge (lot outils et cultures): améliorer ou réparer en payant un outil de la barre. */
import * as v from 'valibot';
import { IdSchema, IntSchema } from '../../donnees/schemas/communs';

const Slot = v.pipe(IntSchema, v.minValue(0), v.maxValue(9));

export const TOOL_INTENTS = [
  /** À côté d'une meule ou d'un établi (`target`, brique `repair`): l'outil de la case passe au niveau suivant. */
  v.strictObject({ type: v.literal('tool_upgrade'), target: IdSchema, slot: Slot }),
  /** Réparation payée (rustine, fil, pierre à aiguiser): prix dans `tool.work.repair`. */
  v.strictObject({ type: v.literal('tool_repair_paid'), target: IdSchema, slot: Slot }),
] as const;
