/**
 * Système « commerces » (cahier 4.6, R34): ouvrir une boutique, acheter de sa bourse (ou avec le
 * coffre commun quand l'article le permet), vendre par quantité au seul commerçant qui en veut, à
 * son prix. Chaque refus part en `refused` avec sa raison, pour le seul joueur concerné.
 */
import type { Content } from '../../donnees/charger';
import type { ShopDef } from '../../donnees/schemas/commerce';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ShopDay } from '../../etat/lieu';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { RULES } from '../regles/reglages';
import { earn } from '../sac/argent';
import { addItem, countItem, removeItem, roomFor } from '../sac/inventaire';
import {
  capLeft,
  isTrading,
  isUnlocked,
  offerFor,
  restockPeriod,
  shopDef,
  stockLeft,
} from './prix';
import { SHOP_TUNING } from './reglages';

/** Raisons de refus des commerces (textes: `interface/boutique/textes.ts`). */
export type ShopRefusal =
  | 'gone'
  | 'too-far'
  | 'shop-closed'
  | 'not-sold'
  | 'locked'
  | 'out-of-stock'
  | 'pockets-full'
  | 'not-enough-money'
  | 'chest-not-allowed'
  | 'not-wanted'
  | 'not-enough-items'
  | 'shop-cap-reached'
  | 'purse-full';

function refuse(sim: SimContext, player: PlayerIndex, reason: ShopRefusal, target: string): void {
  sim.emit({ type: 'refused', player, reason, target });
}

/** Le joueur est à portée du commerçant ou d'un comptoir de ce commerce. */
export function nearShop(
  content: Content,
  world: SimContext['world'],
  shop: ShopDef,
  player: PlayerIndex,
): boolean {
  const { x, y } = world.players[player].body;
  const reach2 = SHOP_TUNING.reach * SHOP_TUNING.reach;
  const near = (px: number, py: number): boolean => (px - x) ** 2 + (py - y) ** 2 <= reach2;
  const place = world.common.place;
  const keeper = world.places[place]?.villagers[shop.keeper];
  if (keeper !== undefined && near(keeper.body.x, keeper.body.y)) return true;
  const props = [
    ...(content.places[place]?.map.objects ?? []),
    ...(world.places[place]?.placed ?? []),
  ];
  return props.some(
    (prop) =>
      content.props[prop.type]?.bricks.some((b) => b.brick === 'shop' && b.shop === shop.id) ===
        true && near(prop.x, prop.y),
  );
}

/** Contrôle commun: le commerce existe ici, le joueur est à portée, c'est ouvert. */
function access(sim: SimContext, player: PlayerIndex, id: string): ShopDef | null {
  const shop = shopDef(sim, id);
  if (shop === null) {
    refuse(sim, player, 'gone', id);
    return null;
  }
  if (!nearShop(sim.content, sim.world, shop, player)) {
    refuse(sim, player, 'too-far', id);
    return null;
  }
  if (!isTrading(sim, shop)) {
    refuse(sim, player, 'shop-closed', id);
    return null;
  }
  return shop;
}

/** Journée du commerce, créée ou remise au jour à la première écriture. */
function dayOf(sim: SimContext, shop: ShopDef): ShopDay | null {
  const place = sim.world.places[sim.world.common.place];
  if (place === undefined) return null;
  const day = sim.world.common.day;
  place.shops ??= {};
  const state = (place.shops[shop.id] ??= { day, spent: 0, sold: {} });
  if (state.day !== day) {
    state.day = day;
    state.spent = 0;
  }
  return state;
}

/** Retient le prix de base de ce commerce pour cet objet (mémoire des prix, commune au duo). */
export function rememberPrice(sim: SimContext, item: string, shop: string, cents: number): void {
  const prices = sim.world.progress.prices;
  const seen = (prices[item] ??= {});
  if (seen[shop] === cents) return;
  seen[shop] = cents;
  sim.touch('progress');
}

/**
 * Ouvre la boutique pour ce joueur (brique `shop`, effet `open_shop` d'un dialogue): retient les
 * prix de ce commerçant pour ce que le joueur a sur lui, puis l'interface montre la boutique.
 */
export function openShop(sim: SimContext, player: PlayerIndex, id: string): void {
  const shop = shopDef(sim, id);
  if (shop === null) {
    refuse(sim, player, 'gone', id);
    return;
  }
  if (!isTrading(sim, shop)) {
    refuse(sim, player, 'shop-closed', id);
    return;
  }
  const state = sim.world.players[player];
  const items = new Set<string>();
  for (const slots of [state.toolbar, state.bag?.slots ?? []])
    for (const stack of slots) if (stack !== null) items.add(stack.item);
  let n = 0;
  for (const item of items) {
    if (n >= SHOP_TUNING.rememberOnOpen) break;
    const offer = offerFor(sim, shop, item, player);
    if (offer === null) continue;
    rememberPrice(sim, item, shop.id, offer.base);
    n += 1;
  }
  sim.emit({ type: 'shop_opened', player, shop: shop.id });
}

function buy(
  sim: SimContext,
  player: PlayerIndex,
  intent: Extract<Intent, { type: 'shop_buy' }>,
): void {
  const shop = access(sim, player, intent.shop);
  if (shop === null) return;
  const line = shop.sells.find((l) => l.item === intent.item);
  if (line === undefined) {
    refuse(sim, player, 'not-sold', shop.id);
    return;
  }
  if (!isUnlocked(sim, line, player)) {
    refuse(sim, player, 'locked', shop.id);
    return;
  }
  if (stockLeft(sim, shop, line) < intent.count) {
    refuse(sim, player, 'out-of-stock', shop.id);
    return;
  }
  const state = sim.world.players[player];
  if (roomFor(sim.content, state, line.item) < intent.count) {
    refuse(sim, player, 'pockets-full', shop.id);
    return;
  }
  const payment = line.payment ?? 'purse';
  if (intent.chest && payment === 'purse') {
    refuse(sim, player, 'chest-not-allowed', shop.id);
    return;
  }
  const total = line.price * intent.count;
  const useChest = payment === 'household' || intent.chest;
  const fromChest = useChest ? Math.min(sim.world.common.chest, total) : 0;
  const fromPurse = total - fromChest;
  if (state.money < fromPurse) {
    refuse(sim, player, 'not-enough-money', shop.id);
    return;
  }

  const day = dayOf(sim, shop);
  if (day !== null && line.dailyStock !== null) {
    const period = restockPeriod(line, sim.world.common.day);
    const sold = day.sold[line.item];
    day.sold[line.item] = [period, (sold?.[0] === period ? sold[1] : 0) + intent.count];
  }
  if (fromChest > 0) {
    sim.world.common.chest -= fromChest;
    sim.touch('common');
    sim.emit({ type: 'money_changed', who: 'chest', delta: -fromChest });
  }
  if (fromPurse > 0) {
    state.money -= fromPurse;
    sim.emit({ type: 'money_changed', who: player, delta: -fromPurse });
  }
  addItem(sim.content, state, line.item, intent.count);
  sim.touch('players');
  sim.touch('place');
  sim.emit({ type: 'item_gained', player, item: line.item, count: intent.count });
  sim.emit({
    type: 'shop_bought',
    player,
    shop: shop.id,
    item: line.item,
    count: intent.count,
    cents: total,
    chest: fromChest,
  });
}

function sell(
  sim: SimContext,
  player: PlayerIndex,
  intent: Extract<Intent, { type: 'shop_sell' }>,
): void {
  const shop = access(sim, player, intent.shop);
  if (shop === null) return;
  const offer = offerFor(sim, shop, intent.item, player);
  if (offer === null) {
    refuse(sim, player, 'not-wanted', shop.id);
    return;
  }
  const state = sim.world.players[player];
  if (countItem(state, intent.item) < intent.count) {
    refuse(sim, player, 'not-enough-items', shop.id);
    return;
  }
  const total = offer.unit * intent.count;
  if (capLeft(sim, shop) < total) {
    refuse(sim, player, 'shop-cap-reached', shop.id);
    return;
  }
  if (state.money + total > RULES.money.max) {
    refuse(sim, player, 'purse-full', shop.id);
    return;
  }

  removeItem(state, intent.item, intent.count);
  if (state.selected !== null && state.toolbar[state.selected] === null) state.selected = null;
  earn(sim, player, total);
  const day = dayOf(sim, shop);
  if (day !== null) day.spent += total;
  rememberPrice(sim, intent.item, shop.id, offer.base);
  sim.touch('players');
  sim.touch('place');
  sim.emit({
    type: 'shop_sold',
    player,
    shop: shop.id,
    item: intent.item,
    count: intent.count,
    cents: total,
    need: offer.need,
  });
}

function onIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- chaque système ignore les intentions des autres
  switch (intent.type) {
    case 'shop_buy':
      buy(sim, player, intent);
      return;
    case 'shop_sell':
      sell(sim, player, intent);
      return;
    default:
      return;
  }
}

export const shopSystem: GameSystem = { id: 'commerces', intent: onIntent };
