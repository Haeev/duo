/** Intentions de la pêche. Le joueur joue la touche et le combat chez lui, puis envoie le résultat. */
import * as v from 'valibot';
import { FiniteSchema, IdSchema } from '../../donnees/schemas/communs';
import { FISHING } from './reglages';

export const FISHING_INTENTS = [
  /** Bouchon lâché à ce point de l'eau (m), la ligne amorcée de `bait` (objet du sac). */
  v.strictObject({
    type: v.literal('fish_cast'),
    x: FiniteSchema,
    y: FiniteSchema,
    bait: v.exactOptional(IdSchema),
  }),
  /** Pêche à deux, à la canne: la touche est enfoncée (`down`) ou relâchée. */
  v.strictObject({ type: v.literal('fish_hold'), down: v.boolean() }),
  /** Pêche à deux, à l'épuisette: plongée dans ce couloir (-1 gauche, 0 milieu, 1 droite). */
  v.strictObject({ type: v.literal('fish_net'), lane: v.picklist([-1, 0, 1]) }),
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
