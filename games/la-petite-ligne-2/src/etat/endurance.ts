/**
 * Endurance d'un joueur, en deux morceaux comme le reste de l'état: la jauge bouge à chaque pas
 * (canal rapide, champ `stamina` du joueur), l'essoufflement et les renforts changent rarement
 * (tranche « joueurs », champ `staminaMods`). Les deux ont une valeur par défaut: une sauvegarde
 * d'avant l'endurance se charge avec une jauge pleine, sans renfort.
 */
import * as v from 'valibot';
import { FiniteSchema, TickSchema } from '../donnees/schemas/communs';

/** Jauge, en part de la jauge de base (1: pleine; jusqu'à 2 pendant un renfort de capacité). */
export const StaminaValueSchema = v.pipe(FiniteSchema, v.minValue(0), v.maxValue(2));

export const StaminaModsSchema = v.strictObject({
  /** Jauge vidée: plus de course jusqu'au seuil de reprise (`stamina.recoverAt`). */
  winded: v.boolean(),
  /** Capacité augmentée de `extra` jusqu'au pas `until` (exclu). */
  capacity: v.nullable(
    v.strictObject({
      extra: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(1)),
      until: TickSchema,
    }),
  ),
  /** Recharge `factor` fois plus rapide jusqu'au pas `until` (exclu). */
  recovery: v.nullable(
    v.strictObject({
      factor: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(3)),
      until: TickSchema,
    }),
  ),
});
export type StaminaMods = v.InferOutput<typeof StaminaModsSchema>;

export function freshStaminaMods(): StaminaMods {
  return { winded: false, capacity: null, recovery: null };
}

/** Champ lent, avec sa valeur par défaut (sauvegardes d'avant l'endurance). */
export const StaminaModsField = v.optional(StaminaModsSchema, freshStaminaMods);
/** Champ rapide, avec sa valeur par défaut: pleine. */
export const StaminaValueField = v.optional(StaminaValueSchema, 1);
