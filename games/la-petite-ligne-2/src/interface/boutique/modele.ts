/**
 * Modèle de vue de la boutique (interface.md 5.4), pur et testé: ce que montrent la grille et le
 * détail pour ce joueur, d'après l'état reçu et les règles de `simulation/commerces/prix.ts`.
 */
import type { Content } from '../../donnees/charger';
import type { ShopDef } from '../../donnees/schemas/commerce';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import {
  allShops,
  capLeft,
  isUnlocked,
  knownPrices,
  offerFor,
  shopDef,
  stockLeft,
} from '../../simulation/commerces/prix';
import { SHOP_TUNING } from '../../simulation/commerces/reglages';

export type ShopTab = 'buy' | 'sell';

export interface ShopTile {
  readonly item: string;
  readonly name: string;
  /** Prix de l'unité (centimes); `null`: il n'en veut pas (onglet Vendre). */
  readonly unit: number | null;
  /** Exemplaires dans les poches du joueur (onglet Vendre). */
  readonly owned: number;
  /** Encore en rayon (`null`: sans limite), onglet Acheter. */
  readonly stock: number | null;
  /** Pourquoi ce n'est pas possible: grisé, barré ou en pointillé. */
  readonly state: 'ok' | 'too-expensive' | 'out-of-stock' | 'refused';
  readonly need: boolean;
}

export interface KnownPrice {
  readonly shop: string;
  readonly keeper: string;
  readonly keeperName: string;
  readonly cents: number;
  readonly best: boolean;
  readonly here: boolean;
}

export interface ShopDetail {
  readonly tile: ShopTile;
  readonly hunger: number | null;
  readonly quantity: number;
  readonly max: number;
  readonly total: number;
  /** Paiement possible avec le coffre commun, et part qu'il paierait. */
  readonly chest: 'never' | 'optional' | 'always';
  readonly chestPart: number;
  readonly known: readonly KnownPrice[];
}

export interface ShopModel {
  readonly shop: ShopDef;
  readonly keeperName: string;
  readonly tab: ShopTab;
  /** Onglet Vendre: rachetés d'abord, puis refusés. Onglet Acheter: les articles visibles. */
  readonly tiles: readonly ShopTile[];
  /** Indice de la première vignette refusée (`tiles.length` s'il n'y en a pas). */
  readonly refusedFrom: number;
  readonly focus: number;
  readonly detail: ShopDetail | null;
}

export interface ShopUiState {
  readonly shop: string;
  readonly tab: ShopTab;
  readonly focus: number;
  readonly quantity: number;
  readonly chest: boolean;
}

function itemName(content: Content, item: string): string {
  return content.items[item]?.name ?? item;
}

function villagerName(content: Content, keeper: string): string {
  for (const place of Object.values(content.places)) {
    const found = place.villagers.find((v) => v.id === keeper);
    if (found !== undefined) return found.name;
  }
  return keeper;
}

/** Les piles du joueur, par objet, dans l'ordre des cases (barre puis sac). */
function pockets(world: ReadonlyWorld, me: PlayerIndex): Map<string, number> {
  const state = world.players[me];
  const out = new Map<string, number>();
  for (const slots of [state.toolbar, state.bag?.slots ?? []])
    for (const stack of slots)
      if (stack !== null) out.set(stack.item, (out.get(stack.item) ?? 0) + stack.count);
  return out;
}

/** Place restante pour cet objet dans les poches (mêmes règles que le sac). */
function room(content: Content, world: ReadonlyWorld, me: PlayerIndex, item: string): number {
  const limit = content.items[item]?.stack ?? 1;
  const state = world.players[me];
  let free = 0;
  for (const slots of [state.toolbar, state.bag?.slots ?? []])
    for (const stack of slots) {
      if (stack === null) free += limit;
      else if (stack.item === item && stack.wear === undefined) free += limit - stack.count;
    }
  return free;
}

function buyTiles(
  content: Content,
  world: ReadonlyWorld,
  me: PlayerIndex,
  shop: ShopDef,
  chest: boolean,
): ShopTile[] {
  const look = { content, world };
  const purse = world.players[me].money;
  return shop.sells
    .filter((line) => isUnlocked(look, line, me))
    .map((line) => {
      const left = stockLeft(look, shop, line);
      const canChest =
        (line.payment ?? 'purse') === 'household' || (line.payment === 'purse-or-chest' && chest);
      const wallet = purse + (canChest ? world.common.chest : 0);
      const state: ShopTile['state'] =
        left <= 0 ? 'out-of-stock' : wallet < line.price ? 'too-expensive' : 'ok';
      return {
        item: line.item,
        name: itemName(content, line.item),
        unit: line.price,
        owned: pockets(world, me).get(line.item) ?? 0,
        stock: Number.isFinite(left) ? left : null,
        state,
        need: false,
      };
    });
}

function sellTiles(
  content: Content,
  world: ReadonlyWorld,
  me: PlayerIndex,
  shop: ShopDef,
): ShopTile[] {
  const look = { content, world };
  const wanted: ShopTile[] = [];
  const refused: ShopTile[] = [];
  for (const [item, owned] of pockets(world, me)) {
    const offer = offerFor(look, shop, item, me);
    const tile: ShopTile = {
      item,
      name: itemName(content, item),
      unit: offer?.unit ?? null,
      owned,
      stock: null,
      state: offer === null ? 'refused' : 'ok',
      need: offer?.need ?? false,
    };
    (offer === null ? refused : wanted).push(tile);
  }
  return [...wanted, ...refused];
}

function known(content: Content, world: ReadonlyWorld, item: string, here: string): KnownPrice[] {
  const shops = allShops(content);
  const list = knownPrices(world, item);
  const top = list[0]?.cents ?? 0;
  return list.map(({ shop, cents }) => {
    const keeper = shops.get(shop)?.keeper ?? shop;
    return {
      shop,
      keeper,
      keeperName: villagerName(content, keeper),
      cents,
      best: list.length > 1 && cents === top,
      here: shop === here,
    };
  });
}

/** Le modèle de la boutique ouverte pour ce joueur, ou `null` si le commerce n'est pas ici. */
export function shopModel(
  content: Content,
  world: ReadonlyWorld,
  me: PlayerIndex,
  ui: ShopUiState,
): ShopModel | null {
  const shop = shopDef({ content, world }, ui.shop);
  if (shop === null) return null;
  const tiles =
    ui.tab === 'buy'
      ? buyTiles(content, world, me, shop, ui.chest)
      : sellTiles(content, world, me, shop);
  const refusedFrom = tiles.findIndex((t) => t.state === 'refused');
  const focus = tiles.length === 0 ? 0 : Math.min(Math.max(0, ui.focus), tiles.length - 1);
  const tile = tiles[focus] ?? null;
  let detail: ShopDetail | null = null;
  if (tile !== null) {
    const line = ui.tab === 'buy' ? shop.sells.find((l) => l.item === tile.item) : undefined;
    const payment = line?.payment ?? 'purse';
    const chest: ShopDetail['chest'] =
      ui.tab === 'sell' || payment === 'purse'
        ? 'never'
        : payment === 'household'
          ? 'always'
          : 'optional';
    const useChest = chest === 'always' || (chest === 'optional' && ui.chest);
    const unit = tile.unit ?? 0;
    let max = 0;
    if (tile.state !== 'refused' && unit > 0) {
      if (ui.tab === 'buy') {
        const wallet = world.players[me].money + (useChest ? world.common.chest : 0);
        max = Math.min(
          tile.stock ?? SHOP_TUNING.maxCount,
          room(content, world, me, tile.item),
          Math.floor(wallet / unit),
        );
      } else {
        const cap = capLeft({ content, world }, shop);
        max = Math.min(tile.owned, Number.isFinite(cap) ? Math.floor(cap / unit) : tile.owned);
      }
      max = Math.max(0, Math.min(max, SHOP_TUNING.maxCount));
    }
    const quantity = max === 0 ? 0 : Math.min(Math.max(1, ui.quantity), max);
    const total = unit * Math.max(quantity, 1);
    detail = {
      tile,
      hunger: content.items[tile.item]?.food?.hunger ?? null,
      quantity,
      max,
      total,
      chest,
      chestPart: useChest ? Math.min(world.common.chest, total) : 0,
      known: known(content, world, tile.item, shop.id),
    };
  }
  return {
    shop,
    keeperName: villagerName(content, shop.keeper),
    tab: ui.tab,
    tiles,
    refusedFrom: refusedFrom === -1 ? tiles.length : refusedFrom,
    focus,
    detail,
  };
}
