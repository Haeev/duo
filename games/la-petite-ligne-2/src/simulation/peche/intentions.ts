/** Intentions de la pêche. Le joueur joue la touche et le combat chez lui, puis envoie le résultat. */
import * as v from 'valibot';
import { FiniteSchema } from '../../donnees/schemas/communs';
import { FISHING } from './reglages';

export const FISHING_INTENTS = [
  /** Bouchon lâché à ce point de l'eau (m). */
  v.strictObject({ type: v.literal('fish_cast'), x: FiniteSchema, y: FiniteSchema }),
  /** Le poisson est ferré: le combat commence (le partenaire voit la canne pliée). */
  v.strictObject({ type: v.literal('fish_hooked') }),
  /**
   * Fin de la pêche jouée sur la machine du joueur. `strike`: instant du ferrage (s depuis le
   * lancer); `log`: journal des touches du combat (`combat.ts`), rejoué par l'hôte.
   */
  v.strictObject({
    type: v.literal('fish_result'),
    outcome: v.picklist(['landed', 'escaped', 'missed']),
    strike: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(120)),
    log: v.pipe(v.string(), v.maxLength(FISHING.logMax)),
  }),
  /** Ranger la ligne. */
  v.strictObject({ type: v.literal('fish_cancel') }),
] as const;
