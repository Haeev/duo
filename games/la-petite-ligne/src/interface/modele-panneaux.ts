/**
 * Modèles des panneaux (comptoir, catalogue, établi, réchaud, coffre, sac):
 * fonctions pures sur l'état, testées dans Node.
 */
import { catalogueWindow, onSale } from '../donnees/commandes';
import { rawText } from '../donnees/contenu';
import type { ItemDef } from '../donnees/types';
import type { ItemStack, Quality, ReadonlyWorld } from '../etat/types';
import { UI_SETTINGS } from './config';
import { type ReadonlyCharacter, type UiContext, characterOf, nameOf } from './contexte';
import { capitalize, countIn, itemName, itemTitle, joinList } from './format';
import { itemIcon } from './modele';

/** Quantité possédée pour une fabrication: le sac, puis le cellier (comme la simulation). */
export function available(world: ReadonlyWorld, c: ReadonlyCharacter, item: string): number {
  return countIn(c.bag, item) + countIn(world.cellar, item);
}

/** « 2 planches, 1 clou » */
export function missingText(ctx: UiContext, missing: readonly { item: string; count: number }[]): string {
  return joinList(
    missing.map((m) => `${m.count} ${itemName(ctx.content.items[m.item], m.count, m.item)}`),
    ctx.texts.orderFormat,
  );
}

// ---------------------------------------------------------------------------
// Catalogue

export type ProductState = 'orderable' | 'ordered' | 'delivered' | 'waiting' | 'partner_waiting' | 'too_expensive' | 'closed';

export interface ProductModel {
  item: string;
  icon: string;
  name: string;
  effect: string;
  price: number;
  state: ProductState;
  /** Demande l'accord de l'autre (prix au-dessus du seuil). */
  big: boolean;
  missing: number;
  available: boolean;
}

export function catalogueOpen(world: ReadonlyWorld, ctx: UiContext): boolean {
  const deadline = catalogueWindow(ctx.content.settings, world.clock.day).orderDeadline;
  const { day, minutes } = world.clock;
  return day < deadline.day || (day === deadline.day && minutes < deadline.time);
}

export function catalogueDelivered(world: ReadonlyWorld, ctx: UiContext): boolean {
  const d = catalogueWindow(ctx.content.settings, world.clock.day).delivery;
  const { day, minutes } = world.clock;
  return world.catalogueOrders.length === 0 && (day > d.day || (day === d.day && minutes >= d.time));
}

function effectOf(ctx: UiContext, def: ItemDef): string {
  return ctx.t(ctx.texts.extra.catalogue.effects[def.id] ?? '');
}

export function catalogueProducts(world: ReadonlyWorld, ctx: UiContext): ProductModel[] {
  const open = catalogueOpen(world, ctx);
  const delivered = catalogueDelivered(world, ctx);
  const threshold = ctx.content.settings.economy.bigPurchaseThreshold;
  return Object.values(ctx.content.items)
    .filter((def) => def.shop === 'catalogue' && def.buyPrice !== null && onSale(def, world.clock.day))
    .map((def) => {
      const price = def.buyPrice ?? 0;
      const ordered = world.catalogueOrders.includes(def.id);
      const proposal = world.proposals.find((p) => p.purchase.source === 'catalogue' && p.purchase.item === def.id);
      let state: ProductState;
      if (ordered) state = 'ordered';
      else if (delivered && countIn(world.cellar, def.id) > 0) state = 'delivered';
      else if (proposal !== undefined) state = proposal.by === ctx.me ? 'waiting' : 'partner_waiting';
      else if (!open) state = 'closed';
      else if (price > world.purse) state = 'too_expensive';
      else state = 'orderable';
      return {
        item: def.id,
        icon: itemIcon(ctx, def.id),
        name: itemTitle(def, 1, def.id),
        effect: effectOf(ctx, def),
        price,
        state,
        big: price >= threshold,
        missing: Math.max(0, price - world.purse),
        available: state === 'orderable',
      };
    });
}

// ---------------------------------------------------------------------------
// Comptoir d'Odette

export interface BuyEntry {
  item: string;
  icon: string;
  name: string;
  info: string;
  price: number;
  big: boolean;
  missing: number;
  /** Une proposition est déjà en attente pour cet objet. */
  waiting: boolean;
  available: boolean;
}

/** Odette tient la boutique (activité « serve »), comme le vérifie la simulation. */
export function shopIsOpen(world: ReadonlyWorld, ctx: UiContext): boolean {
  const counter = ctx.map.points.grocery_counter;
  const radius = ctx.content.settings.feel.pointRadius * 2;
  return world.villagers.some(
    (v) => v.visible && v.activity === 'serve' && counter !== undefined && Math.hypot(v.pos.x - counter.x, v.pos.y - counter.y) <= radius,
  );
}

export function shopBuyEntries(world: ReadonlyWorld, ctx: UiContext): BuyEntry[] {
  const threshold = ctx.content.settings.economy.bigPurchaseThreshold;
  return Object.values(ctx.content.items)
    .filter((def) => def.shop === 'grocery' && def.buyPrice !== null && onSale(def, world.clock.day))
    .map((def) => {
      const price = def.buyPrice ?? 0;
      const crop = def.plants === null ? undefined : ctx.content.crops[def.plants];
      const info =
        crop === undefined
          ? effectOf(ctx, def)
          : ctx.t(ctx.texts.extra.shop.seedInfo, { days: crop.growthDays, yield: crop.yieldPerCell });
      const waiting = world.proposals.some((p) => p.purchase.source === 'grocery' && p.purchase.item === def.id);
      return {
        item: def.id,
        icon: itemIcon(ctx, def.id),
        name: itemTitle(def, 1, def.id),
        info,
        price,
        big: price >= threshold,
        missing: Math.max(0, price - world.purse),
        waiting,
        available: price <= world.purse && !waiting,
      };
    });
}

export interface SellEntry {
  item: string;
  quality: Quality;
  icon: string;
  name: string;
  count: number;
  /** Prix d'une pièce chez Odette (arrondi), et du lot entier. */
  unit: number;
  total: number;
}

/** Ce que paie Odette pour `count` pièces (même calcul que la simulation). */
export function grocerPrice(ctx: UiContext, item: string, quality: Quality, count: number): number {
  const def = ctx.content.items[item];
  if (def?.sellPrice === null || def === undefined) return 0;
  const unit = def.sellPrice * ctx.content.qualities[quality].priceMultiplier * ctx.content.settings.economy.grocer.buyRate;
  return Math.round(unit * count);
}

export function shopSellEntries(world: ReadonlyWorld, ctx: UiContext): SellEntry[] {
  const me = characterOf(world, ctx.me);
  if (me === null) return [];
  const seen = new Map<string, SellEntry>();
  for (const stack of me.bag) {
    if (stack === null) continue;
    const def = ctx.content.items[stack.item];
    if (def?.sellPrice === null || def === undefined) continue;
    const key = `${stack.item}:${stack.quality}`;
    const entry = seen.get(key);
    if (entry !== undefined) {
      entry.count += stack.count;
      continue;
    }
    seen.set(key, {
      item: stack.item,
      quality: stack.quality,
      icon: itemIcon(ctx, stack.item),
      name: itemTitle(def, 2, stack.item),
      count: stack.count,
      unit: 0,
      total: 0,
    });
  }
  const out = [...seen.values()];
  for (const e of out) {
    e.name = itemTitle(ctx.content.items[e.item], e.count, e.item);
    e.unit = grocerPrice(ctx, e.item, e.quality, 1);
    e.total = grocerPrice(ctx, e.item, e.quality, e.count);
  }
  return out;
}

export interface GrocerBudget {
  buys: boolean;
  room: number;
}

export function grocerBudget(world: ReadonlyWorld, ctx: UiContext): GrocerBudget {
  const g = ctx.content.settings.economy.grocer;
  return { buys: world.flags.includes(g.buysAfterFlag), room: Math.max(0, g.dailyCap - world.grocerSoldToday) };
}

// ---------------------------------------------------------------------------
// Établi et réchaud

export interface RecipeEntry {
  id: string;
  icon: string;
  name: string;
  /** « 1 rondin : 4 planches » */
  makes: string;
  missing: { item: string; count: number }[];
  available: boolean;
  /** Fabrication en cours chez ce joueur (0 à 1), ou `null`. */
  progress: number | null;
}

export function recipeEntries(world: ReadonlyWorld, ctx: UiContext, station: 'workbench' | 'stove'): { entries: RecipeEntry[]; locked: number } {
  const me = characterOf(world, ctx.me);
  const entries: RecipeEntry[] = [];
  let locked = 0;
  for (const r of Object.values(ctx.content.recipes)) {
    if (r.station !== station) continue;
    if (r.requiresUnlock && !world.unlockedRecipes.includes(r.id)) {
      locked++;
      continue;
    }
    const missing =
      me === null
        ? r.inputs.map((i) => ({ item: i.item, count: i.count }))
        : r.inputs
            .map((i) => ({ item: i.item, count: i.count - available(world, me, i.item) }))
            .filter((m) => m.count > 0);
    const inputs = joinList(
      r.inputs.map((i) => `${i.count} ${itemName(ctx.content.items[i.item], i.count, i.item)}`),
      ctx.texts.orderFormat,
    );
    const output = `${r.output.count} ${itemName(ctx.content.items[r.output.item], r.output.count, r.output.item)}`;
    let progress: number | null = null;
    const job = me?.crafting ?? null;
    if (job !== null && job.recipe === r.id && me !== null) {
      // La fabrication pose aussi l'action du personnage (début et durée en pas).
      const total = Math.max(1, me.action.duration);
      progress = Math.max(0, Math.min(1, (world.tick - me.action.since) / total));
    }
    entries.push({
      id: r.id,
      icon: itemIcon(ctx, r.output.item),
      name: ctx.t(capitalize(r.name)),
      makes: ctx.t(ctx.texts.extra.workbench.makes, { inputs, output }),
      missing,
      available: missing.length === 0 && (me?.crafting ?? null) === null,
      progress,
    });
  }
  return { entries, locked };
}

export interface FoodEntry {
  item: string;
  icon: string;
  name: string;
  count: number;
  snack: number;
}

export function foodEntries(world: ReadonlyWorld, ctx: UiContext): FoodEntry[] {
  const me = characterOf(world, ctx.me);
  if (me === null) return [];
  const out = new Map<string, FoodEntry>();
  for (const s of me.bag) {
    if (s === null) continue;
    const def = ctx.content.items[s.item];
    if (def?.dish === null || def === undefined) continue;
    const e = out.get(s.item);
    if (e !== undefined) e.count += s.count;
    else {
      out.set(s.item, {
        item: s.item,
        icon: itemIcon(ctx, s.item),
        name: itemTitle(def, 1, s.item),
        count: s.count,
        snack: ctx.content.settings.snacks[def.dish] ?? 0,
      });
    }
  }
  return [...out.values()];
}

/** L'autre est dans la maison aussi (manger ensemble compte au souper partagé). */
export function partnerAtHome(world: ReadonlyWorld, ctx: UiContext): boolean {
  return characterOf(world, ctx.partner)?.inHouse === true && characterOf(world, ctx.me)?.inHouse === true;
}

// ---------------------------------------------------------------------------
// Coffre et sac

export interface StackEntry {
  item: string;
  quality: Quality;
  icon: string;
  name: string;
  count: number;
}

export function stackEntries(ctx: UiContext, stacks: readonly (Readonly<ItemStack> | null)[], includeTools = false): StackEntry[] {
  const out = new Map<string, StackEntry>();
  for (const s of stacks) {
    if (s === null) continue;
    const def = ctx.content.items[s.item];
    if (!includeTools && def?.category === 'tool') continue;
    const key = `${s.item}:${s.quality}`;
    const e = out.get(key);
    if (e !== undefined) e.count += s.count;
    else out.set(key, { item: s.item, quality: s.quality, icon: itemIcon(ctx, s.item), name: '', count: s.count });
  }
  const list = [...out.values()];
  for (const e of list) e.name = itemTitle(ctx.content.items[e.item], e.count, e.item);
  return list;
}

export type ItemAction = 'eat' | 'hold' | 'read';

export interface ItemDetail {
  name: string;
  icon: string;
  meta: string;
  text: string;
  fine: boolean;
  actions: ItemAction[];
  eatAmount: number;
}

/** Détail d'une case du sac (carnet). */
export function itemDetail(ctx: UiContext, stack: Readonly<ItemStack>): ItemDetail {
  const def = ctx.content.items[stack.item];
  const n = ctx.texts.extra.notebook;
  const fine = stack.quality === 'fine';
  const parts = [itemTitle(def, stack.count, stack.item)];
  if (fine) parts.push(ctx.texts.extra.common.fineQuality);
  if ((def?.stack ?? 1) > 1) parts.push(String(stack.count));
  const name = ctx.t(parts.join(', '));
  const category = def?.category ?? 'material';
  let meta = n.categories[category] ?? '';
  let text = '';
  const actions: ItemAction[] = [];
  let eatAmount = 0;
  if (def?.dish !== null && def !== undefined) {
    eatAmount = ctx.content.settings.snacks[def.dish] ?? 0;
    actions.push('eat');
    text = n.snack;
  }
  if (def?.readText !== null && def !== undefined) actions.push('read');
  if (category === 'furniture') {
    text = n.furniture;
    actions.push('hold');
  } else if (category === 'tool') {
    text = n.tool;
    actions.push('hold');
  } else if (category === 'seed' && def?.plants !== null && def !== undefined) {
    const crop = ctx.content.crops[def.plants];
    if (crop !== undefined) text = ctx.t(n.seed, { days: crop.growthDays, yield: crop.yieldPerCell });
    actions.push('hold');
  }
  if (def?.sellPrice !== null && def !== undefined) {
    const mult = ctx.content.qualities[stack.quality].priceMultiplier;
    const price = Math.round(def.sellPrice * mult);
    if (fine) {
      meta = n.fineMeta;
      text = ctx.t(n.fineText, { multiplier: String(mult).replace('.', ','), price });
    } else if (text === '') {
      text = ctx.t(n.sellText, { price });
    }
  }
  return { name, icon: itemIcon(ctx, stack.item), meta: ctx.t(meta), text: ctx.t(text), fine, actions, eatAmount };
}

/** Le sac est plein: aucune case libre. */
export function bagFull(c: ReadonlyCharacter): boolean {
  return c.bag.every((s) => s !== null);
}

export function bagEmpty(c: ReadonlyCharacter): boolean {
  return c.bag.every((s) => s === null);
}

/** Nombre de places du sac hors barre d'outils. */
export function bagRestCount(c: ReadonlyCharacter): number {
  return Math.max(0, c.bag.length - UI_SETTINGS.toolbarSlots);
}

// ---------------------------------------------------------------------------
// Propositions

export interface ProposalModel {
  id: string;
  mine: boolean;
  item: string;
  icon: string;
  /** « un matelas » (article indéfini des textes, sinon le nom seul). */
  itemText: string;
  price: number;
  /** `improvement` (tour 9): un versement à un chantier, `item` est le chantier. */
  source: 'grocery' | 'catalogue' | 'improvement';
  by: string;
  byName: string;
}

/** « un matelas »: le champ `indefinite` de l'objet dans `objets.json` (demande 12), sinon le nom seul. */
export function indefiniteItem(ctx: UiContext, item: string): string {
  const def = ctx.content.items[item];
  const article = def?.indefinite ?? null;
  return article !== null && article.trim() !== '' ? article : itemName(def, 1, item);
}

export function proposalModels(world: ReadonlyWorld, ctx: UiContext): ProposalModel[] {
  return world.proposals.map((p) => ({
    id: p.id,
    mine: p.by === ctx.me,
    item: p.purchase.item,
    icon: itemIcon(ctx, p.purchase.item),
    itemText: p.purchase.source === 'improvement' ? (rawText(ctx.content.texts, 'chantiers', p.purchase.item, 'name') ?? p.purchase.item) : indefiniteItem(ctx, p.purchase.item),
    price: p.price,
    source: p.purchase.source,
    by: p.by,
    byName: nameOf(world, p.by),
  }));
}
