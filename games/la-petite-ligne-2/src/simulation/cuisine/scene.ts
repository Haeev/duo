/**
 * Scène du repas pris à deux (cahier 4.4: 15 s, on trinque, on se sert, vapeur et couverts).
 * Elle part de l'événement `meal_shared` et se joue sur chaque machine à la même cadence: le
 * rendu et le son demandent les temps forts passés entre deux images.
 */
import { COOKING, type MealBeat } from './reglages';

/** Temps forts compris dans `]from, to]` (secondes depuis le début du repas); `from < 0` inclut le premier. */
export function mealBeatsBetween(from: number, to: number): MealBeat[] {
  return COOKING.mealScene.filter((cue) => cue.at > from && cue.at <= to).map((cue) => cue.beat);
}

export function mealSceneOver(t: number): boolean {
  return t >= COOKING.mealSceneSeconds;
}
