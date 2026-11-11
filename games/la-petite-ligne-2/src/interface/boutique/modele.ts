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
  piecesOnSale,
  shopDef,
  stockLeft,
} from '../../simulation/commerces/prix';
import {
  awaitsAnswer,
  hasNews,
  heardThisDay,
  pickDialogue,
} from '../../simulation/dialogues/conversation';
import { hasPiece } from '../../simulation/regles/recompenses';
import { SHOP_TUNING } from '../../simulation/commerces/reglages';

export type ShopTab = 'buy' | 'sell';

export interface ShopTile {
  /** Objet (dans les poches) ou pièce de tenue (dans la garde-robe, ligne `pieces`). */
  readonly kind: 'item' | 'piece';
  /** Identifiant de l'objet, ou de la pièce de tenue. */
  readonly item: string;
  readonly name: string;
  /** Une ligne de description (pièce de tenue), sinon `null`. */
  readonly description: string | null;
  /** Emplacement de la pièce de tenue (`top`, `hat`...), sinon `null`. */
  readonly slot: string | null;
  /** Prix de l'unité (centimes); `null`: il n'en veut pas (onglet Vendre). */
  readonly unit: number | null;
  /** Exemplaires dans les poches du joueur (onglet Vendre). */
  readonly owned: number;
  /** Encore en rayon (`null`: sans limite), onglet Acheter. */
  readonly stock: number | null;
  /** Pourquoi ce n'est pas possible: grisé, barré ou en pointillé; `owned`: pièce déjà à toi. */
  readonly state: 'ok' | 'too-expensive' | 'out-of-stock' | 'refused' | 'owned';
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
  /** Le commerçant a une réplique que ce joueur n'a pas encore entendue (`keeperHasNews`). */
  readonly news: boolean;
}

/**
 * « Parler » a du neuf pour ce joueur: la réplique que le bouton jouerait (la plus prioritaire,
 * `pickDialogue`, la règle même de la conversation) n'a pas encore été entendue. C'est un dialogue
 * `once` pas encore épuisé (souvenir, cadeau, confidence), une décision à deux qui attend sa
 * réponse, ou une réplique qui a quelque chose à dire (`hasNews`) pas encore entendue ce jour.
 * Le bavardage du quotidien n'allume rien. Lecture seule de l'état.
 */
export function keeperHasNews(
  content: Content,
  world: ReadonlyWorld,
  me: PlayerIndex,
  keeper: string,
): boolean {
  const dialogue = pickDialogue({ content, world }, me, keeper);
  if (dialogue === null) return false;
  if (dialogue.once !== null || awaitsAnswer(world, me, dialogue)) return true;
  return hasNews(dialogue) && !heardThisDay(world, me, dialogue);
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
  const items = shop.sells
    .filter((line) => isUnlocked(look, line, me))
    .map((line): ShopTile => {
      const left = stockLeft(look, shop, line);
      const canChest =
        (line.payment ?? 'purse') === 'household' || (line.payment === 'purse-or-chest' && chest);
      const wallet = purse + (canChest ? world.common.chest : 0);
      const state: ShopTile['state'] =
        left <= 0 ? 'out-of-stock' : wallet < line.price ? 'too-expensive' : 'ok';
      return {
        kind: 'item',
        item: line.item,
        name: itemName(content, line.item),
        description: null,
        slot: null,
        unit: line.price,
        owned: pockets(world, me).get(line.item) ?? 0,
        stock: Number.isFinite(left) ? left : null,
        state,
        need: false,
      };
    });
  // Les pièces de tenue après les objets: une seule, pour soi, de la bourse seule.
  const pieces = piecesOnSale(look, shop, me).map((line): ShopTile => {
    const def = content.pieces[line.piece];
    const mine = hasPiece(world, line.piece, me);
    return {
      kind: 'piece',
      item: line.piece,
      name: def?.name ?? line.piece,
      description: def?.description ?? null,
      slot: def?.slot ?? null,
      unit: line.price,
      owned: mine ? 1 : 0,
      stock: null,
      state: mine ? 'owned' : purse < line.price ? 'too-expensive' : 'ok',
      need: false,
    };
  });
  return [...items, ...pieces];
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
      kind: 'item',
      item,
      name: itemName(content, item),
      description: null,
      slot: null,
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
  if (tile?.kind === 'piece') {
    // Une pièce de tenue: une seule, de la bourse; « déjà à toi » ou trop chère, rien à acheter.
    const quantity = tile.state === 'ok' ? 1 : 0;
    detail = {
      tile,
      hunger: null,
      quantity,
      max: quantity,
      total: tile.unit ?? 0,
      chest: 'never',
      chestPart: 0,
      known: [],
    };
  } else if (tile !== null) {
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
    news: keeperHasNews(content, world, me, shop.keeper),
  };
}
