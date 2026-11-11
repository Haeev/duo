/**
 * Endurance (réponse du client du 2026-11-11: « jauge d'endurance et perte de faim, booster la
 * jauge avec des boosts de nourriture »). Réglages dans `donnees/commun/besoins.json` (section
 * `stamina`), renforts dans le bloc `food.stamina` d'un objet qui se mange.
 *
 * La jauge se compte en part de la jauge de base: 1 = pleine, 0 = vide, plus de 1 pendant un
 * renfort de capacité. Une partie neuve, une vieille sauvegarde et le réveil la donnent pleine.
 */
import * as v from 'valibot';
import { FiniteSchema } from './communs';

function Seconds(min: number, max: number) {
  return v.pipe(FiniteSchema, v.minValue(min), v.maxValue(max));
}

export const StaminaSettingsSchema = v.strictObject({
  /** Secondes de course d'une jauge pleine, à la vitesse de course (3,2 m/s). */
  runSeconds: Seconds(10, 600),
  /** Jauge vidée: on reprend la course quand elle remonte à cette part (0 à 1), pas avant. */
  recoverAt: v.pipe(FiniteSchema, v.minValue(0.05), v.maxValue(0.9)),
  /**
   * Secondes pour remplir une jauge vide, selon la posture: en marchant, arrêté (debout, geste,
   * dialogue), assis, couché. Plus la posture est reposante, plus c'est court.
   */
  refillSeconds: v.strictObject({
    walk: Seconds(5, 900),
    still: Seconds(3, 600),
    seated: Seconds(2, 600),
    lying: Seconds(1, 600),
  }),
});
export type StaminaSettings = v.InferOutput<typeof StaminaSettingsSchema>;

/** Durée d'un renfort, en secondes réelles après la bouchée. */
const BoostSeconds = Seconds(10, 1800);

export const FoodStaminaSchema = v.pipe(
  v.strictObject({
    /** Part de la jauge de base rendue tout de suite (0,25: un quart). */
    refill: v.exactOptional(v.pipe(FiniteSchema, v.minValue(0.05), v.maxValue(1))),
    /** Capacité augmentée: `extra` en part de la jauge de base (0,5: une demi-jauge de plus). */
    capacity: v.exactOptional(
      v.strictObject({
        extra: v.pipe(FiniteSchema, v.minValue(0.05), v.maxValue(1)),
        seconds: BoostSeconds,
      }),
    ),
    /** Recharge plus rapide: les durées de `refillSeconds` divisées par `factor`. */
    recovery: v.exactOptional(
      v.strictObject({
        factor: v.pipe(FiniteSchema, v.minValue(1.05), v.maxValue(3)),
        seconds: BoostSeconds,
      }),
    ),
  }),
  v.check(
    (fx) => fx.refill !== undefined || fx.capacity !== undefined || fx.recovery !== undefined,
    'un renfort d’endurance déclare au moins refill, capacity ou recovery',
  ),
);
export type FoodStamina = v.InferOutput<typeof FoodStaminaSchema>;
