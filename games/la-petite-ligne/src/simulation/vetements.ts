/**
 * Garde-robe et boutique de vêtements (0.12, contrat `docs/jeux/jeu-1/garde-robe-0-12.md`):
 * le comptoir de la mercerie de Solange (menu `clothes_shop`, stock de la semaine), l'achat
 * personnel (`clothes_buy`, sans accord à deux) et le changement de tenue (`wear`) au coffre de la
 * maison (menu `wardrobe`) ou dans la cabine de la boutique.
 */
import { REQUIRED_SLOTS } from '../donnees/vetements';
import { clothesStock } from '../etat/garde-robe';
import { isHome } from '../etat/interieurs';
import type { Character, ClothingSlot } from '../etat/types';
import { type Sim, bump, distance, emit, say } from './contexte';
import { nearChest } from './economie';
import { buildingOpen } from './interieurs';
import { SALON, solangeHere } from './salon';

export const CLOTHES = {
  /** La place du client devant le comptoir de mercerie (point de la carte). */
  counter: 'salon_clothes',
  /** Compteur des vêtements achetés (envies et quêtes à venir). */
  boughtCounter: 'clothes_bought',
} as const;

/** Portée du comptoir (m), comme la place du client d'Odette. */
const COUNTER_REACH = 1.2;

export function nearClothesCounter(sim: Sim, c: Character): boolean {
  const at = sim.map.points[CLOTHES.counter];
  return at !== undefined && c.inside === SALON.building && distance(c.pos, at) <= COUNTER_REACH;
}

/** Solange vend aux heures de son salon, quand elle est là. */
export function clothesShopServing(sim: Sim): boolean {
  const b = sim.map.buildings[SALON.building];
  return b !== undefined && buildingOpen(sim, b) && solangeHere(sim);
}

/** Le stock de la mercerie aujourd'hui (le même chez les deux joueurs: graine et jour). */
export function stockToday(sim: Sim): string[] {
  return clothesStock(sim.content.clothes, sim.content.settings, sim.world.seed, sim.world.clock.day);
}

/** Ouvre la boutique au comptoir; refus dit si Solange n'y est pas. */
export function openClothesShop(sim: Sim, c: Character): boolean {
  if (!nearClothesCounter(sim, c)) return false;
  if (!clothesShopServing(sim)) {
    say(sim, c.id, 'clothes_shop_closed');
    return false;
  }
  c.menu = 'clothes_shop';
  if (c.status === 'active') c.status = 'menu';
  sim.runtime.changed = true;
  return true;
}

/** Se changer: au coffre de la maison (menu `wardrobe` ou à portée), ou dans la cabine de la boutique. */
export function canChangeClothes(sim: Sim, c: Character): boolean {
  if (c.menu === 'clothes_shop') return nearClothesCounter(sim, c);
  return isHome(c) && (c.menu === 'wardrobe' || nearChest(sim, c));
}

/** Ouvre la garde-robe au coffre (menu `wardrobe`); ignoré ailleurs. */
export function openWardrobe(sim: Sim, c: Character): boolean {
  if (!isHome(c) || !nearChest(sim, c)) return false;
  c.menu = 'wardrobe';
  if (c.status === 'active') c.status = 'menu';
  sim.runtime.changed = true;
  return true;
}

/** Achat personnel au comptoir: refusé hors stock, déjà possédé, ou si la bourse ne suffit pas. */
export function clothesBuy(sim: Sim, c: Character, item: string): void {
  if (c.menu !== 'clothes_shop' || !nearClothesCounter(sim, c)) return;
  const def = sim.content.clothes.byId[item];
  if (def === undefined) return;
  if (!clothesShopServing(sim)) {
    say(sim, c.id, 'clothes_shop_closed');
    return;
  }
  if (c.wardrobe.includes(item)) {
    say(sim, c.id, 'clothes_owned');
    return;
  }
  if (!stockToday(sim).includes(item)) {
    say(sim, c.id, 'clothes_not_in_stock');
    return;
  }
  if (def.prix > sim.world.purse) {
    say(sim, c.id, 'not_enough_money', { missing: def.prix - sim.world.purse });
    return;
  }
  sim.world.purse -= def.prix;
  c.wardrobe.push(item);
  bump(sim, CLOTHES.boughtCounter, c.id);
  emit(sim, { type: 'bought', by: c.id, item, count: 1, price: def.prix });
}

/** Porter un vêtement de sa garde-robe (ou ôter le par-dessus et le chapeau: `item` nul). */
export function wearClothing(sim: Sim, c: Character, slot: ClothingSlot, item: string | null): void {
  if (!canChangeClothes(sim, c)) {
    say(sim, c.id, 'clothes_change_where');
    return;
  }
  const wear = c.appearance.wear;
  if (item === null) {
    if ((REQUIRED_SLOTS as readonly ClothingSlot[]).includes(slot)) {
      say(sim, c.id, 'clothes_slot_required');
      return;
    }
    if (slot === 'outer' || slot === 'hat') wear[slot] = null;
    sim.runtime.changed = true;
    return;
  }
  const def = sim.content.clothes.byId[item];
  if (def?.slot !== slot) return;
  if (!c.wardrobe.includes(item)) {
    say(sim, c.id, 'clothes_not_owned');
    return;
  }
  wear[slot] = item;
  sim.runtime.changed = true;
}
