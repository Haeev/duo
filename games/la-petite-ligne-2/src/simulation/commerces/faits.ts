/**
 * Faits écrits par les commerces dans la mémoire (`regles/memoire.ts`), pour que les habitants s'en
 * souviennent (« ta moitié m'a vendu douze œufs ») et que les quêtes les lisent: premier achat et
 * première vente chez un commerçant (l'objet, datés du premier jour), total vendu d'un objet, par
 * joueur et pour le duo. Clés: `SHOP_TUNING.facts`. Rien de nouveau dans l'état ni sur le réseau.
 */
import type { Content } from '../../donnees/charger';
import type { ShopDef } from '../../donnees/schemas/commerce';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { FactValue } from '../../donnees/schemas/regles';
import type { SimContext } from '../noyau/systemes';
import { bump, playerFactKey, recall, remember } from '../regles/memoire';
import { basePrice } from './prix';
import { SHOP_TUNING } from './reglages';

const F = SHOP_TUNING.facts;

/** Premier achat de ce joueur chez ce commerçant (sans `player`: la clé à compléter par `of`). */
export function firstBuyKey(shop: string, player?: PlayerIndex): string {
  const key = `${F.prefix}.${shop}.${F.firstBuy}`;
  return player === undefined ? key : playerFactKey(key, player);
}

export function firstSaleKey(shop: string, player?: PlayerIndex): string {
  const key = `${F.prefix}.${shop}.${F.firstSale}`;
  return player === undefined ? key : playerFactKey(key, player);
}

/** Total vendu de cet objet à ce commerçant: par le duo, ou par ce joueur. */
export function soldKey(shop: string, item: string, player?: PlayerIndex): string {
  const key = `${F.sold}.${shop}.${item}`;
  return player === undefined ? key : playerFactKey(key, player);
}

/** Un achat fait: le premier chez ce commerçant se retient, daté de ce jour. */
export function noteBuy(sim: SimContext, player: PlayerIndex, shop: string, item: string): void {
  const key = firstBuyKey(shop, player);
  if (recall(sim.world, key) === null) remember(sim, key, item, player);
}

/** Une vente faite: la première se retient, et les totaux vendus (joueur, duo) augmentent. */
export function noteSale(
  sim: SimContext,
  player: PlayerIndex,
  shop: string,
  item: string,
  count: number,
): void {
  const key = firstSaleKey(shop, player);
  if (recall(sim.world, key) === null) remember(sim, key, item, player);
  bump(sim, soldKey(shop, item, player), player, count);
  bump(sim, soldKey(shop, item), 'duo', count);
}

/**
 * Les faits qu'un commerce peut écrire, pour le contrôle des quêtes (`quetes/valider.ts`): valeurs
 * possibles par clé, `null` pour un compteur (toute valeur numérique).
 */
export function shopFacts(content: Content, shop: ShopDef): Map<string, Set<FactValue> | null> {
  const facts = new Map<string, Set<FactValue> | null>();
  const sold = Object.keys(content.items).filter((item) => basePrice(content, shop, item) !== null);
  const bought = new Set<FactValue>(shop.sells.map((line) => line.item));
  for (const p of [0, 1] as const) {
    facts.set(firstBuyKey(shop.id, p), bought);
    facts.set(firstSaleKey(shop.id, p), new Set(sold));
    for (const item of sold) facts.set(soldKey(shop.id, item, p), null);
  }
  for (const item of sold) facts.set(soldKey(shop.id, item), null);
  return facts;
}
