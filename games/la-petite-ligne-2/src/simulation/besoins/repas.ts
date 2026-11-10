/**
 * Repas spécial à deux (cahier 4.4, R26): servi à table, les deux assis au même meuble. Faim au
 * maximum pour les deux et un bonus exclusif, qui tient pour chacun tant que sa faim reste
 * au-dessus du seuil. Le bonus vit dans la mémoire des faits (sauvegardée, envoyée à l'invité,
 * lisible par les dialogues), sous une clé par joueur.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import type { SimContext } from '../noyau/systemes';
import { remember } from '../regles/memoire';
import { MEAL_PERKS, RULES, type MealPerk } from '../regles/reglages';

export function mealPerkKey(player: PlayerIndex): string {
  return `besoins.repas.j${String(player)}`;
}

function isPerk(value: unknown): value is MealPerk {
  return (MEAL_PERKS as readonly unknown[]).includes(value);
}

/** Bonus de repas en cours pour ce joueur, ou `null`. */
export function mealPerkOf(world: ReadonlyWorld, player: PlayerIndex): MealPerk | null {
  const value = world.progress.memory[mealPerkKey(player)]?.v;
  return isPerk(value) ? value : null;
}

export function hasPerk(world: ReadonlyWorld, player: PlayerIndex, perk: MealPerk): boolean {
  return mealPerkOf(world, player) === perk;
}

/** Les deux joueurs sont-ils assis au même meuble (une table et ses chaises comptent comme un) ? */
export function seatedTogether(sim: SimContext, target: string): boolean {
  const seats = sim.world.places[sim.world.common.place]?.objects[target]?.sit ?? [];
  return seats.includes(0) && seats.includes(1);
}

export type MealRefusal = 'not-together';

/** Sert le repas spécial à deux, assis au meuble `target`. */
export function shareSpecialMeal(
  sim: SimContext,
  target: string,
  perk: MealPerk,
): MealRefusal | null {
  if (!seatedTogether(sim, target)) return 'not-together';
  for (const player of [0, 1] as const) {
    const state = sim.world.players[player];
    state.needs.hunger = Math.max(state.needs.hunger, RULES.needs.specialMealHunger);
    remember(sim, mealPerkKey(player), perk, 'duo');
    sim.emit({ type: 'meal_shared', player, perk });
  }
  return null;
}

/** Fin du bonus quand la faim repasse au seuil: appelé à chaque pas par le système des besoins. */
export function expireMealPerks(sim: SimContext): void {
  for (const player of [0, 1] as const) {
    if (mealPerkOf(sim.world, player) === null) continue;
    if (sim.world.players[player].needs.hunger > RULES.needs.specialMealKeepAbove) continue;
    remember(sim, mealPerkKey(player), false, 'duo');
  }
}
