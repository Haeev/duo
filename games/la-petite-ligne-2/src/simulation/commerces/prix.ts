/**
 * Lecture pure d'un commerce (hôte, invité et interface lisent les mêmes règles): ouverture,
 * articles visibles et stock, prix de rachat de ce commerçant pour ce joueur, besoin du jour,
 * plafond du jour, mémoire des prix. Aucun contenu nommé: tout vient des données du commerce.
 */
import type { Content } from '../../donnees/charger';
import type { ShopDef, ShopSell } from '../../donnees/schemas/commerce';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import { bondKey } from '../../etat/progression';
import { modifiersOf } from '../besoins/jauges';
import { evaluate } from '../regles/conditions';
import { RULES } from '../regles/reglages';
import { SHOP_TUNING } from './reglages';

export interface ShopLook {
  readonly content: Content;
  readonly world: ReadonlyWorld;
}

/** Le commerce de ce nom dans le lieu courant, ou `null`. */
export function shopDef(look: ShopLook, shop: string): ShopDef | null {
  return look.content.places[look.world.common.place]?.shops[shop] ?? null;
}

/** Ouvert à cette heure (la plage peut passer minuit). */
export function isOpen(shop: ShopDef, minutes: number): boolean {
  const { from, to } = shop.hours;
  return from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

function roundPrice(cents: number): number {
  const step = SHOP_TUNING.priceStep;
  return Math.max(step, Math.round(cents / step) * step);
}

function familyPrice(shop: ShopDef, family: string): number | null {
  for (const line of shop.buys) if ('family' in line && line.family === family) return line.price;
  return null;
}

/**
 * Prix de rachat de base de ce commerçant (centimes), sans bonus: objet précis d'abord (prix ou
 * coefficient du prix de sa famille), puis famille; `null`: il n'en veut pas.
 */
export function basePrice(content: Content, shop: ShopDef, item: string): number | null {
  // Un objet d'histoire ne se vend pas.
  if (content.items[item]?.story === true) return null;
  const family = content.items[item]?.family;
  for (const line of shop.buys) {
    if (!('item' in line) || line.item !== item) continue;
    if ('price' in line) return line.price;
    const ref = family === undefined ? null : familyPrice(shop, family);
    return ref === null ? null : roundPrice(ref * line.factor);
  }
  return family === undefined ? null : familyPrice(shop, family);
}

/** Petit hachage stable (FNV-1a): le même chez l'hôte et chez l'invité, sans `Math.random`. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Le besoin du jour écrit à la craie devant la boutique, tiré de la graine de la partie et du jour. */
export function dailyNeed(look: ShopLook, shop: ShopDef): string | null {
  const candidates =
    shop.dailyNeeds ?? shop.buys.flatMap((line) => ('item' in line ? [line.item] : []));
  if (candidates.length === 0) return null;
  const pick = hash(`${String(look.world.seed)}:${String(look.world.common.day)}:${shop.id}`);
  return candidates[pick % candidates.length] ?? null;
}

/** Cœurs d'amitié de ce joueur avec cet habitant. */
export function heartsWith(world: ReadonlyWorld, villager: string, player: PlayerIndex): number {
  const points = world.progress.bonds[bondKey(villager, player)] ?? 0;
  return Math.min(RULES.bonds.hearts, Math.floor(points / RULES.bonds.perHeart));
}

export interface Offer {
  /** Prix de l'unité pour ce joueur, aujourd'hui (centimes, multiple du pas). */
  readonly unit: number;
  /** Prix de base, celui que retient la mémoire des prix. */
  readonly base: number;
  /** C'est le besoin du jour. */
  readonly need: boolean;
}

/** Ce que ce commerçant donne à ce joueur pour une unité: base, besoin du jour, amitié, besoins. */
export function offerFor(
  look: ShopLook,
  shop: ShopDef,
  item: string,
  player: PlayerIndex,
): Offer | null {
  const base = basePrice(look.content, shop, item);
  if (base === null) return null;
  const need = dailyNeed(look, shop) === item;
  let factor = need ? SHOP_TUNING.dailyNeedFactor : 1;
  const hearts = heartsWith(look.world, shop.keeper, player);
  let friend = 1;
  for (const tier of shop.friendship ?? [])
    if (hearts >= tier.hearts) friend = Math.max(friend, tier.factor);
  factor *= friend * modifiersOf(look.content, look.world, player).sellPrice;
  return { unit: roundPrice(base * factor), base, need };
}

/** Premier jour de la période de réassort qui contient `day`. */
export function restockPeriod(line: ShopSell, day: number): number {
  const every = line.restockDays ?? 1;
  return day - ((day - 1) % every);
}

/** Exemplaires encore en rayon (`Infinity`: sans limite). */
export function stockLeft(look: ShopLook, shop: ShopDef, line: ShopSell): number {
  if (line.dailyStock === null) return Number.POSITIVE_INFINITY;
  const state = look.world.places[look.world.common.place]?.shops?.[shop.id];
  const sold = state?.sold[line.item];
  const period = restockPeriod(line, look.world.common.day);
  return sold?.[0] !== period ? line.dailyStock : Math.max(0, line.dailyStock - sold[1]);
}

/** L'article est débloqué pour ce joueur (fait d'histoire, amitié). */
export function isUnlocked(look: ShopLook, line: ShopSell, player: PlayerIndex): boolean {
  return line.unlock === undefined || evaluate({ ...look, actor: player }, line.unlock);
}

/** Centimes que le commerçant peut encore dépenser aujourd'hui en rachats (`Infinity`: sans plafond). */
export function capLeft(look: ShopLook, shop: ShopDef): number {
  if (shop.dailyBuyCap === undefined) return Number.POSITIVE_INFINITY;
  const state = look.world.places[look.world.common.place]?.shops?.[shop.id];
  const spent = state?.day === look.world.common.day ? state.spent : 0;
  return Math.max(0, shop.dailyBuyCap - spent);
}

/** Mémoire des prix d'un objet: commerce et prix de base vus, du meilleur au moins bon. */
export function knownPrices(world: ReadonlyWorld, item: string): { shop: string; cents: number }[] {
  const seen = world.progress.prices[item] ?? {};
  return Object.entries(seen)
    .map(([shop, cents]) => ({ shop, cents }))
    .sort((a, b) => b.cents - a.cents || a.shop.localeCompare(b.shop));
}

/** Tous les commerces du jeu, par identifiant (pour retrouver le tenancier d'un prix retenu). */
export function allShops(content: Content): Map<string, ShopDef> {
  const out = new Map<string, ShopDef>();
  for (const place of Object.values(content.places))
    for (const shop of Object.values(place.shops)) out.set(shop.id, shop);
  return out;
}
