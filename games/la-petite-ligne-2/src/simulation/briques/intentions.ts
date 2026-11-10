/**
 * Intentions des briques (lot L2 pour le registre, chaque lot pour ses briques). La touche
 * d'action (`act`) choisit seule la première brique utilisable de la cible; `use_brick` sert quand
 * le joueur choisit lui-même (un meuble à plusieurs briques, un menu).
 */
import * as v from 'valibot';
import { BRICK_IDS } from '../../donnees/schemas/briques';
import { IdSchema } from '../../donnees/schemas/communs';
import { SlotRefSchema } from '../sac/cases';

const Target = IdSchema;

export const BRICK_INTENTS = [
  v.strictObject({ type: v.literal('use_brick'), target: Target, brick: v.picklist(BRICK_IDS) }),
  /** Brique `store`: déposer une case du joueur dans le meuble, ou reprendre une case du meuble. */
  v.strictObject({ type: v.literal('store_put'), target: Target, from: SlotRefSchema }),
  v.strictObject({
    type: v.literal('store_take'),
    target: Target,
    index: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(39)),
  }),
] as const;
