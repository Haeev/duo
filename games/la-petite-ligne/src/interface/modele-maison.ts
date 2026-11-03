/**
 * La maison du tour 10 vue par l'interface: icônes des besoins doux et leurs chiffres au carnet,
 * rangement à cases et râtelier, commande des pièces à Basile et panneau du chantier, rideaux,
 * sieste, écran de nuit « endormis ensemble », lieu de l'autre par bâtiment. Fonctions pures (aucun
 * DOM), testées dans Node. Les règles partagées viennent de `etat/maison.ts`; celles qui ne vivent
 * que dans la simulation (`pieces.ts`) sont doublées ici, avec un test d'égalité.
 */
import { secondsPerGameMinuteOn } from '../donnees/calendrier';
import type { RoomDef } from '../donnees/maison';
import { HOUSE_BUILDING } from '../etat/carte';
import {
  type BellyLevel,
  type HeartLevel,
  type RestLevel,
  bellyLevel,
  curtainsAt,
  fellAsleepTogether,
  heartLevel,
  houseRoomAt,
  isNapTime,
  isNapping,
  isTool,
  mapRoomOfBuild,
  restLevel,
  storageView,
  windowsNow,
} from '../etat/maison';
import type {
  CharacterId,
  GameNotification,
  ItemStack,
  Quality,
  ReadonlyWorld,
  RoomState,
} from '../etat/types';
import { UI_SETTINGS } from './config';
import { type ReadonlyCharacter, type UiContext, characterOf, nameOf } from './contexte';
import { countIn, hourLabel, itemName, itemTitle, weekdayOf } from './format';
import { formModel, itemIcon } from './modele';

// ---------------------------------------------------------------------------
// Besoins doux (section 3)

export type NeedId = 'belly' | 'rest' | 'heart';
export type NeedLevel = BellyLevel | RestLevel | HeartLevel;

/** Ton de l'icône: `good` (bonus), `ok`, `low` (rien ne se perd, mais ça se voit), `empty` (Plus d'énergie). */
export type NeedTone = 'good' | 'ok' | 'low' | 'empty';

export interface NeedIconModel {
  need: NeedId;
  level: NeedLevel;
  tone: NeedTone;
  /** Symbole du sprite: une forme par état (lisible sans la couleur). */
  icon: string;
  /** « Ventre plein », « Besoin de souffler »... */
  state: string;
  /** Nom accessible: « Ventre: Petit creux ». */
  label: string;
}

const NEEDS: readonly NeedId[] = ['belly', 'rest', 'heart'];

const TONES: Readonly<Record<NeedId, Readonly<Record<string, NeedTone>>>> = {
  belly: { full: 'good', ok: 'ok', low: 'low' },
  rest: { high: 'good', ok: 'ok', low: 'low', empty: 'empty' },
  heart: { light: 'good', ok: 'ok', missing: 'low' },
};

/** Le texte d'un état: celui de `textes.json` (`needs.<besoin>.<état>`) s'il existe, sinon celui de l'interface. */
function needStateText(ctx: UiContext, need: NeedId, level: string): string {
  const raw = ctx.content.texts.raw.needs;
  if (typeof raw === 'object' && raw !== null) {
    const group: unknown = (raw as Record<string, unknown>)[need];
    if (typeof group === 'object' && group !== null) {
      const value: unknown = (group as Record<string, unknown>)[level];
      if (typeof value === 'string') return value;
    }
  }
  const mine: Readonly<Record<string, string>> = ctx.texts.extra.needs[need];
  return mine[level] ?? level;
}

function levelOf(ctx: UiContext, c: ReadonlyCharacter, need: NeedId): NeedLevel {
  if (need === 'belly') return bellyLevel(ctx.content, c);
  if (need === 'rest') return restLevel(ctx.content, c);
  return heartLevel(ctx.content, c);
}

/** Les trois icônes de ce personnage (à côté du portrait, et en petit sur la carte de l'autre). */
export function needIcons(ctx: UiContext, c: ReadonlyCharacter): NeedIconModel[] {
  const n = ctx.texts.extra.needs;
  return NEEDS.map((need) => {
    const level = levelOf(ctx, c, need);
    const state = ctx.t(needStateText(ctx, need, level));
    return {
      need,
      level,
      tone: TONES[need][level] ?? 'ok',
      icon: `need-${need}-${level}`,
      state,
      label: ctx.t(n.iconLabel, { need: n.names[need], state }),
    };
  });
}

export interface NeedRowModel {
  need: NeedId;
  title: string;
  icon: NeedIconModel;
  value: string;
  /** Part de la jauge (0 à 1). */
  ratio: number;
  help: string;
}

export interface NeedsPageModel {
  form: string;
  formText: string;
  rows: NeedRowModel[];
  /** « Loin de Sacha depuis 40 min de jeu », ou « Sacha n'est pas loin. » */
  apart: string;
  napped: boolean;
  muted: boolean;
  partner: string;
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Les chiffres du carnet (réponse du client: les icônes au HUD, les chiffres au carnet). */
export function needsPage(
  world: ReadonlyWorld,
  ctx: UiContext,
  muted: boolean,
): NeedsPageModel | null {
  const me = characterOf(world, ctx.me);
  if (me === null) return null;
  const n = ctx.texts.extra.needs;
  const icons = needIcons(ctx, me);
  const time = ctx.texts.game.ui.hud.time;
  const nap = ctx.content.settings.needs.soft.rest.nap;
  const partner = nameOf(world, ctx.partner);
  const row = (need: NeedId, value: number, max: number, help: string): NeedRowModel => {
    const icon = icons.find((i) => i.need === need) ?? icons[0];
    if (icon === undefined) throw new Error('icône de besoin');
    return {
      need,
      title: n.names[need],
      icon,
      value: ctx.t(n.value, { value: Math.round(value), max: Math.round(max) }),
      ratio: max > 0 ? clamp01(value / max) : 0,
      help: ctx.t(help, { from: hourLabel(nap.from, time), to: hourLabel(nap.to, time) }),
    };
  };
  const form = formModel(ctx, me);
  const minutes = Math.floor(me.needs.apartMinutes);
  return {
    form: form.name,
    formText: ctx.t(form.text),
    rows: [
      row('belly', me.needs.belly, 100, n.bellyHelp),
      row('rest', me.endurance, me.enduranceMax, n.restHelp),
      row('heart', me.needs.heart, 100, n.heartHelp),
    ],
    apart: minutes > 0 ? ctx.t(n.apart, { partner, minutes }) : ctx.t(n.near, { partner }),
    napped: me.needs.nappedToday,
    muted,
    partner,
  };
}

/**
 * Lignes des besoins que « Besoins en sourdine » fait taire (section 3.7): les signaux des besoins
 * eux-mêmes. Les retrouvailles, la sieste choisie et « Plus d'énergie » (la règle de PE-06) restent.
 */
export const NEED_MESSAGE_KEYS: ReadonlySet<string> = new Set([
  'belly_low',
  'belly_full',
  'belly_capped',
  'rest_low',
  'heart_light',
  'heart_missing',
]);

/** Les notifications à montrer, sourdine comprise. */
export function audibleNotifications<T extends Readonly<Pick<GameNotification, 'key'>>>(
  list: readonly T[],
  muted: boolean,
): T[] {
  return muted ? list.filter((n) => n.key === null || !NEED_MESSAGE_KEYS.has(n.key)) : [...list];
}

// ---------------------------------------------------------------------------
// Rangement à cases et râtelier (section 5)

export interface StorageCellModel {
  index: number;
  item: string | null;
  quality: Quality;
  count: number;
  icon: string | null;
  label: string;
  /** Au-delà de la capacité (sauvegarde qui déborde, meuble retiré): on reprend seulement. */
  over: boolean;
}

export interface FamilyDepositModel {
  family: string;
  label: string;
  /** Unités de cette famille dans le sac. */
  count: number;
}

export interface StorageModel {
  /** « 12 cases sur 20 », « Ça déborde: 30 sur 20. ». */
  count: string;
  used: number;
  total: number | null;
  overflow: boolean;
  full: boolean;
  cells: StorageCellModel[];
  rack: StorageCellModel[];
  rackCount: string;
  families: FamilyDepositModel[];
}

/** Familles de « Tout déposer », dans l'ordre du tri (`DEPOSIT_FAMILIES` de la simulation, test d'égalité). */
export const STORAGE_FAMILIES: readonly string[] = ['crop', 'fish', 'forage', 'food', 'material'];

/** Une pile du rangement découpée en cases de `stackSize` (l'ordre du rangement est gardé). */
function cellsOf(
  ctx: UiContext,
  stacks: readonly Readonly<ItemStack>[],
  size: number,
): Omit<StorageCellModel, 'index' | 'over'>[] {
  const out: Omit<StorageCellModel, 'index' | 'over'>[] = [];
  const s = ctx.texts.extra.storage;
  for (const stack of stacks) {
    let left = stack.count;
    while (left > 0) {
      const count = Math.min(left, size);
      left -= count;
      const def = ctx.content.items[stack.item];
      out.push({
        item: stack.item,
        quality: stack.quality,
        count,
        icon: itemIcon(ctx, stack.item),
        label: ctx.t(s.cell, { item: itemTitle(def, count, stack.item), count }),
      });
    }
  }
  return out;
}

export function storageModel(world: ReadonlyWorld, ctx: UiContext): StorageModel {
  const s = ctx.texts.extra.storage;
  const view = storageView(ctx.content, ctx.map, world);
  const size = ctx.content.settings.storage?.stackSize ?? Number.MAX_SAFE_INTEGER;
  const filled = cellsOf(
    ctx,
    world.cellar.filter((x) => !isTool(ctx.content, x.item)),
    size,
  );
  const total = view.total;
  const shown = Math.max(filled.length, total ?? filled.length);
  const empty = ctx.t(s.emptyCell);
  const cells: StorageCellModel[] = [];
  for (let i = 0; i < shown; i++) {
    const f = filled[i];
    const over = total !== null && i >= total;
    if (f === undefined)
      cells.push({
        index: i,
        item: null,
        quality: 'ordinary',
        count: 0,
        icon: null,
        label: empty,
        over: false,
      });
    else
      cells.push({
        ...f,
        index: i,
        over,
        label: over ? `${f.label}, ${ctx.t(s.overflowCell)}` : f.label,
      });
  }
  const rackStacks = [...world.rack, ...world.cellar.filter((x) => isTool(ctx.content, x.item))];
  const hooks = Math.max(view.hooks, view.rack);
  const rackFilled = cellsOf(ctx, rackStacks, 1);
  const hook = ctx.t(s.hook);
  const rack: StorageCellModel[] = [];
  for (let i = 0; i < hooks; i++) {
    const f = rackFilled[i];
    rack.push(
      f === undefined
        ? {
            index: i,
            item: null,
            quality: 'ordinary',
            count: 0,
            icon: null,
            label: hook,
            over: false,
          }
        : { ...f, index: i, over: false },
    );
  }
  const me = characterOf(world, ctx.me);
  const families: FamilyDepositModel[] = [];
  for (const family of STORAGE_FAMILIES) {
    const count = (me?.bag ?? []).reduce(
      (n, b) => n + (b !== null && ctx.content.items[b.item]?.category === family ? b.count : 0),
      0,
    );
    if (count > 0)
      families.push({
        family,
        label: ctx.t(s.depositFamily, { family: s.families[family] ?? family }),
        count,
      });
  }
  const count =
    total === null
      ? ctx.t(s.countFree, { used: view.used })
      : view.overflow
        ? ctx.t(s.overflow, { used: view.used, total })
        : ctx.t(s.count, { used: view.used, total });
  return {
    count,
    used: view.used,
    total,
    overflow: view.overflow,
    full: total !== null && view.used >= total,
    cells,
    rack,
    rackCount: ctx.t(s.rackCount, { used: view.rack, total: view.hooks }),
    families,
  };
}

// ---------------------------------------------------------------------------
// Pièces bâties à deux (section 4): doubles de `simulation/pieces.ts` (test d'égalité)

/** Le grand coffre se commande à Basile sous cet identifiant (`OAK_CHEST` de la simulation). */
export const OAK_CHEST = 'oak_chest';

/** `RoomState` et son travail en cours (`RoomProgress` de la simulation: `work` n'est pas encore au contrat). */
type RoomRead = Readonly<RoomState> & {
  readonly work?: {
    readonly element: string;
    readonly progress: number;
    readonly paid: boolean;
    readonly workers: readonly CharacterId[];
  } | null;
};

function roomState(world: ReadonlyWorld, id: string): RoomRead | undefined {
  return world.rooms[id] as RoomRead | undefined;
}

/** Les deux plans sont ouverts (jour et lettre `basile_rooms`), comme `roomsOpen`. */
export function roomsOpenFor(world: ReadonlyWorld, ctx: UiContext): boolean {
  const s = ctx.content.settings.rooms;
  if (s === null || world.clock.day < s.opensFromDay) return false;
  if (s.letter === null || ctx.content.letters[s.letter] === undefined) return true;
  const letter = s.letter;
  return world.letters.some((l) => l.id === letter);
}

/** La pièce commandée et pas encore à vous (une à la fois), comme `roomInProgress`. */
export function roomInProgressOf(world: ReadonlyWorld, ctx: UiContext): RoomDef | null {
  for (const def of ctx.content.home.rooms) {
    const s = roomState(world, def.id);
    if (s !== undefined && s.ordered !== null && s.builtDay === null) return def;
  }
  return null;
}

/** Le site est là (commandée la veille ou avant), comme `siteReady`. */
export function siteReadyOf(world: ReadonlyWorld, id: string): boolean {
  const s = roomState(world, id);
  return (
    s !== undefined && s.ordered !== null && s.ordered < world.clock.day && s.builtDay === null
  );
}

/** Ce qu'il reste à apporter (planches et clous), comme `roomStillNeeded`. */
export function roomNeeded(
  world: ReadonlyWorld,
  ctx: UiContext,
  id: string,
): { item: string; count: number }[] {
  const def = ctx.content.home.rooms.find((r) => r.id === id);
  const s = roomState(world, id);
  if (def === undefined || s === undefined) return [];
  const need = new Map<string, number>();
  for (const e of def.elements) {
    if (s.elementsBuilt.includes(e.id) || (s.work?.element === e.id && s.work.paid)) continue;
    for (const input of e.inputs) need.set(input.item, (need.get(input.item) ?? 0) + input.count);
  }
  return [...need]
    .map(([item, count]) => ({ item, count: Math.max(0, count - countIn(s.crate, item)) }))
    .filter((n) => n.count > 0);
}

/** Éléments qu'on peut bâtir maintenant, comme `buildableElements`. */
export function roomBuildable(world: ReadonlyWorld, ctx: UiContext, id: string): string[] {
  const def = ctx.content.home.rooms.find((r) => r.id === id);
  const s = roomState(world, id);
  if (def === undefined || s === undefined || !siteReadyOf(world, id)) return [];
  return def.elements
    .filter(
      (e) =>
        !s.elementsBuilt.includes(e.id) &&
        e.requires.every((r) => s.elementsBuilt.includes(r)) &&
        (!e.needsBeam || s.beamPlaced),
    )
    .map((e) => e.id);
}

function roomName(ctx: UiContext, id: string): string {
  return ctx.texts.extra.rooms.names[id] ?? id;
}

function roomTitle(ctx: UiContext, id: string): string {
  return ctx.texts.extra.rooms.titles[id] ?? roomName(ctx, id);
}

function elementName(ctx: UiContext, id: string): string {
  return ctx.texts.extra.rooms.elements[id] ?? id;
}

/** Totaux de planches et de clous d'une pièce (la ligne de la commande). */
function roomTotals(def: RoomDef): { planks: number; nails: number } {
  let planks = 0;
  let nails = 0;
  for (const e of def.elements) {
    for (const i of e.inputs) {
      if (i.item === 'plank') planks += i.count;
      else if (i.item === 'nail') nails += i.count;
    }
  }
  return { planks, nails };
}

export type RoomOrderState =
  'orderable' | 'too_expensive' | 'busy' | 'waiting' | 'ordered' | 'site' | 'tonight' | 'built';

export interface RoomOrderModel {
  id: string;
  title: string;
  line: string;
  use: string;
  price: number;
  state: RoomOrderState;
  /** Texte de l'état, ou du bouton (« Commander pour 450 aubrins », « Proposer à Sacha: 1200 aubrins »). */
  text: string;
  /** Il faudra l'accord de l'autre (`bigPurchaseThreshold`). */
  big: boolean;
  missing: number;
}

export interface BasileRoomsModel {
  rooms: RoomOrderModel[];
  oakChest: RoomOrderModel | null;
}

function pendingProposal(world: ReadonlyWorld, id: string): CharacterId | null {
  return (
    world.proposals.find((p) => p.purchase.source === 'improvement' && p.purchase.item === id)
      ?.by ?? null
  );
}

/**
 * « Agrandir la maisonnette » à l'établi de Basile (section 4.3): les deux plans dès qu'ils sont
 * ouverts, et le grand coffre de chêne (section 5.2). `null` tant que rien n'est à commander.
 */
export function basileRoomsModel(world: ReadonlyWorld, ctx: UiContext): BasileRoomsModel | null {
  const r = ctx.texts.extra.rooms;
  const threshold = ctx.content.settings.economy.bigPurchaseThreshold;
  const partner = nameOf(world, ctx.partner);
  const busy = roomInProgressOf(world, ctx);
  const orderState = (
    id: string,
    price: number,
  ): { state: RoomOrderState; text: string; missing: number } => {
    const by = pendingProposal(world, id);
    if (by !== null) {
      const c = ctx.texts.extra.catalogue;
      return {
        state: 'waiting',
        text: ctx.t(by === ctx.me ? c.waitingPartner : c.proposedBy, { partner }),
        missing: 0,
      };
    }
    const missing = Math.max(0, price - world.purse);
    if (missing > 0)
      return {
        state: 'too_expensive',
        text: ctx.t(ctx.texts.extra.common.missingMoney, { missing }),
        missing,
      };
    return {
      state: 'orderable',
      text: ctx.t(price >= threshold ? r.proposeFor : r.orderFor, { price, partner }),
      missing: 0,
    };
  };
  const rooms: RoomOrderModel[] = [];
  if (roomsOpenFor(world, ctx)) {
    for (const def of ctx.content.home.rooms) {
      const s = roomState(world, def.id);
      const totals = roomTotals(def);
      const base = {
        id: def.id,
        title: roomTitle(ctx, def.id),
        line: ctx.t(r.line, { room: roomTitle(ctx, def.id), price: def.price, ...totals }),
        use: ctx.t(r.uses[def.id] ?? ''),
        price: def.price,
        big: def.price >= threshold,
      };
      let st: { state: RoomOrderState; text: string; missing: number };
      if (s?.builtDay !== null && s?.builtDay !== undefined) {
        st = {
          state: 'built',
          text: ctx.t(r.built, {
            weekday: weekdayOf(s.builtDay, ctx.texts.weekdays),
            day: s.builtDay,
          }),
          missing: 0,
        };
      } else if (s?.ordered !== null && s?.ordered !== undefined) {
        const allBuilt =
          s.elementsBuilt.length === def.elements.length && (def.beam === null || s.beamPlaced);
        const state: RoomOrderState = !siteReadyOf(world, def.id)
          ? 'ordered'
          : allBuilt
            ? 'tonight'
            : 'site';
        st = {
          state,
          text: ctx.t(state === 'ordered' ? r.ordered : state === 'tonight' ? r.tonight : r.site),
          missing: 0,
        };
      } else if (busy !== null && (ctx.content.settings.rooms?.oneAtATime ?? true)) {
        st = { state: 'busy', text: ctx.t(r.busy, { room: roomName(ctx, busy.id) }), missing: 0 };
      } else {
        st = orderState(def.id, def.price);
      }
      rooms.push({ ...base, ...st });
    }
  }
  let oakChest: RoomOrderModel | null = null;
  const storage = ctx.content.settings.storage;
  const oakDef = ctx.content.items[OAK_CHEST];
  const tour9 = ctx.content.settings.improvements;
  // Le grand coffre se commande dès que l'établi prend des commandes (tour 9, lettre `basile_works`).
  if (
    storage !== null &&
    oakDef !== undefined &&
    (tour9 === null || world.clock.day >= tour9.queues.maisonnette.opensFromDay)
  ) {
    const price = storage.oakChestPrice;
    const pending = world.improvements[OAK_CHEST] !== undefined;
    const placed =
      world.furniture.some((f) => f.item === OAK_CHEST) ||
      world.groundItems.some((g) => g.item === OAK_CHEST) ||
      world.cellar.some((s) => s.item === OAK_CHEST);
    const st = pending
      ? { state: 'ordered' as const, text: ctx.t(r.oakChestPending), missing: 0 }
      : placed
        ? { state: 'built' as const, text: ctx.t(r.oakChestDone), missing: 0 }
        : orderState(OAK_CHEST, price);
    oakChest = {
      id: OAK_CHEST,
      title: ctx.t(itemTitle(oakDef, 1, OAK_CHEST)),
      line: ctx.t(r.oakChest, { price }),
      use: ctx.t(r.oakChestText),
      price,
      big: price >= threshold,
      ...st,
    };
  }
  if (rooms.length === 0 && oakChest === null) return null;
  return { rooms, oakChest };
}

export type RoomElementState = 'built' | 'working' | 'ready' | 'blocked';

export interface RoomElementModel {
  id: string;
  name: string;
  state: RoomElementState;
  /** « Bâti », « En cours: 40 % », « À bâtir », « Il faut d'abord le poteau sud. » */
  text: string;
  progress: number;
  /** Bâti en ce moment à deux. */
  together: boolean;
}

export interface RoomDepositModel {
  item: string;
  icon: string;
  /** Ce qu'on peut déposer de son sac maintenant (0: bouton inerte). */
  count: number;
  text: string;
}

export interface RoomSiteModel {
  id: string;
  title: string;
  done: number;
  total: number;
  progress: string;
  /** 0 à 1: éléments bâtis plus celui en cours. */
  ratio: number;
  bring: string;
  crate: string;
  deposits: RoomDepositModel[];
  elements: RoomElementModel[];
  /** Ligne de la panne faîtière (chambre), ou `null`. */
  beam: { text: string; help: string; done: boolean } | null;
  tonight: boolean;
}

/** Le panneau du chantier de la pièce en cours (site paru), ou `null`. */
export function roomSiteModel(world: ReadonlyWorld, ctx: UiContext): RoomSiteModel | null {
  const def = roomInProgressOf(world, ctx);
  if (def === null || !siteReadyOf(world, def.id)) return null;
  const s = roomState(world, def.id);
  if (s === undefined) return null;
  const r = ctx.texts.extra.rooms;
  const me = characterOf(world, ctx.me);
  const buildable = new Set(roomBuildable(world, ctx, def.id));
  const work = s.work ?? null;
  const elements: RoomElementModel[] = def.elements.map((e) => {
    const name = elementName(ctx, e.id);
    if (s.elementsBuilt.includes(e.id))
      return {
        id: e.id,
        name,
        state: 'built',
        text: ctx.t(r.elementBuilt),
        progress: 1,
        together: false,
      };
    if (work?.element === e.id) {
      const progress = clamp01(work.progress);
      return {
        id: e.id,
        name,
        state: 'working',
        text: ctx.t(r.elementWorking, { percent: Math.round(progress * 100) }),
        progress,
        together: work.workers.length >= 2,
      };
    }
    if (buildable.has(e.id))
      return {
        id: e.id,
        name,
        state: 'ready',
        text: ctx.t(r.elementReady),
        progress: 0,
        together: false,
      };
    const support = e.requires.find((x) => !s.elementsBuilt.includes(x));
    const text =
      support === undefined
        ? ctx.t(r.beam)
        : ctx.t(r.support, { element: elementName(ctx, support) });
    return { id: e.id, name, state: 'blocked', text, progress: 0, together: false };
  });
  const done = s.elementsBuilt.length;
  const total = def.elements.length;
  const needed = roomNeeded(world, ctx, def.id);
  const need = (item: string): number => needed.find((n) => n.item === item)?.count ?? 0;
  const deposits: RoomDepositModel[] = ['plank', 'nail'].map((item) => {
    const def2 = ctx.content.items[item];
    const wanted = need(item);
    const have = me === null ? 0 : countIn(me.bag, item);
    const count = Math.min(wanted, have);
    const text =
      wanted === 0
        ? ctx.t(r.depositDone, { item: itemName(def2, 2, item) })
        : count === 0
          ? ctx.t(r.depositNone, { item: itemName(def2, 2, item) })
          : ctx.t(r.deposit, { count, item: itemName(def2, count, item) });
    return { item, icon: itemIcon(ctx, item), count, text };
  });
  const allBuilt = done === total && (def.beam === null || s.beamPlaced);
  // « 7 planches et 1 clou »: le nombre accorde le nom.
  const list = (stacks: readonly { item: string; count: number }[]): string =>
    stacks
      .filter((x) => x.count > 0)
      .map((x) => `${String(x.count)} ${itemName(ctx.content.items[x.item], x.count, x.item)}`)
      .join(r.and);
  const inCrate = ['plank', 'nail'].map((item) => ({ item, count: countIn(s.crate, item) }));
  return {
    id: def.id,
    title: ctx.t(r.panelTitle, { room: roomName(ctx, def.id) }),
    done,
    total,
    progress: ctx.t(r.progress, { done, total }),
    ratio: clamp01((done + (work === null ? 0 : clamp01(work.progress))) / Math.max(1, total)),
    bring: needed.length === 0 ? ctx.t(r.bringNone) : ctx.t(r.bring, { list: list(needed) }),
    crate: inCrate.every((x) => x.count === 0)
      ? ctx.t(r.crateEmpty)
      : ctx.t(r.crate, { list: list(inCrate) }),
    deposits,
    elements,
    beam:
      def.beam === null
        ? null
        : {
            text: ctx.t(s.beamPlaced ? r.beamDone : r.beam),
            help: ctx.t(r.beamHelp),
            done: s.beamPlaced,
          },
    tonight: allBuilt,
  };
}

/** Le personnage est au chantier de la pièce en cours (à `feel.pointRadius` du point du site, comme `nearSite`). */
export function atRoomSite(
  world: ReadonlyWorld,
  ctx: UiContext,
  c: ReadonlyCharacter,
): string | null {
  const def = roomInProgressOf(world, ctx);
  if (def === null || !siteReadyOf(world, def.id)) return null;
  const room = mapRoomOfBuild(ctx.map, def.id);
  const at = room?.build === null || room === null ? undefined : ctx.map.points[room.build.site];
  if (at === undefined) return null;
  return Math.hypot(c.pos.x - at.x, c.pos.y - at.y) <= ctx.content.settings.feel.pointRadius
    ? def.id
    : null;
}

/** Barre de progression du HUD (R10) pour le chantier d'une pièce: avancée de la pièce entière. */
export function roomWorkProgress(
  world: ReadonlyWorld,
  ctx: UiContext,
): { name: string; ratio: number; mine: boolean; workers: number } | null {
  const def = roomInProgressOf(world, ctx);
  if (def === null) return null;
  const s = roomState(world, def.id);
  const work = s?.work ?? null;
  if (s === undefined || work === null || work.workers.length === 0) return null;
  return {
    name: roomTitle(ctx, def.id),
    ratio: clamp01(
      (s.elementsBuilt.length + clamp01(work.progress)) / Math.max(1, def.elements.length),
    ),
    mine: work.workers.includes(ctx.me),
    workers: work.workers.length,
  };
}

// ---------------------------------------------------------------------------
// Rideaux (section 6.2) et invite de la maison

export interface CurtainsInvite {
  furniture: string;
  closed: boolean;
  text: string;
}

/** Portée d'Agir sur des rideaux (m): celle de `toggleCurtains` (`ranges.action` + 1). */
function curtainsReach(ctx: UiContext): number {
  return ctx.content.settings.ranges.action + 1;
}

/**
 * Les rideaux à portée, chez soi, dans la pièce où l'on est (les plus proches): l'invite les ouvre
 * ou les ferme (Entrée ou clic). `null` sans rideaux à portée.
 */
export function curtainsInvite(
  world: ReadonlyWorld,
  ctx: UiContext,
  c: ReadonlyCharacter,
): CurtainsInvite | null {
  if (c.inside !== HOUSE_BUILDING || c.status !== 'active' || c.placement !== null) return null;
  const room = houseRoomAt(ctx.map, world.rooms, c.pos.x, c.pos.y);
  if (room === null) return null;
  const reach = curtainsReach(ctx);
  let best: { id: string; closed: boolean; d: number } | null = null;
  for (const w of windowsNow(ctx.content, ctx.map, world.rooms)) {
    if (w.room !== room.id) continue;
    const f = curtainsAt(world, w.id);
    if (f === null) continue;
    const d = Math.hypot(c.pos.x - (f.cell.cx + 0.5), c.pos.y - (f.cell.cy + 0.5));
    if (d <= reach && (best === null || d < best.d))
      best = { id: f.id, closed: f.closed === true, d };
  }
  if (best === null) return null;
  const t = ctx.texts.extra.curtains;
  return { furniture: best.id, closed: best.closed, text: ctx.t(best.closed ? t.open : t.close) };
}

// ---------------------------------------------------------------------------
// Sieste (section 3.4) et nuit (section 3.6)

/** « Faire la sieste » au lieu de « Dormir » sur un lit l'après-midi (`isNapTime`). */
export function sleepVerbText(world: ReadonlyWorld, ctx: UiContext): string {
  return isNapTime(ctx.content, world.clock.minutes)
    ? ctx.texts.extra.aim.nap
    : (ctx.texts.extra.aim.verbs.sleep ?? ctx.texts.extra.aim.nap);
}

export interface NapModel {
  title: string;
  text: string;
  together: boolean;
}

/** La rêverie de la sieste chez qui dort (le carnet reste ouvert), ou `null`. */
export function napModel(world: ReadonlyWorld, ctx: UiContext): NapModel | null {
  const me = characterOf(world, ctx.me);
  if (me === null || !isNapping(me)) return null;
  const other = characterOf(world, ctx.partner);
  const together = other !== null && isNapping(other);
  const n = ctx.texts.extra.nap;
  return { title: ctx.t(n.title), text: ctx.t(together ? n.together : n.text), together };
}

/** « Vous avez éteint la lampe en même temps. » à l'écran de nuit, ou `null`. */
export function nightTogetherLine(world: ReadonlyWorld, ctx: UiContext): string | null {
  const ticks = secondsPerGameMinuteOn(ctx.content.settings, world.clock.day) * UI_SETTINGS.simHz;
  if (!fellAsleepTogether(ctx.content, world, ticks)) return null;
  const raw = ctx.content.texts.raw.nightScreen;
  const game =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).together : undefined;
  return ctx.t(typeof game === 'string' ? game : ctx.texts.extra.night.together);
}

// ---------------------------------------------------------------------------
// Invite de la maison: rideaux à portée, chantier de la pièce (Entrée ou clic)

export type InviteModel =
  | { kind: 'curtains'; furniture: string; text: string }
  | { kind: 'room'; room: string; text: string };

/** L'invite à montrer au-dessus de la barre d'outils, ou `null`: les rideaux d'abord, puis le chantier. */
export function inviteModel(world: ReadonlyWorld, ctx: UiContext): InviteModel | null {
  const me = characterOf(world, ctx.me);
  if (me?.status !== 'active' || me.placement !== null) return null;
  const curtains = curtainsInvite(world, ctx, me);
  if (curtains !== null)
    return { kind: 'curtains', furniture: curtains.furniture, text: curtains.text };
  const room = atRoomSite(world, ctx, me);
  if (room === null) return null;
  const site = roomSiteModel(world, ctx);
  if (site === null) return null;
  return { kind: 'room', room, text: `${site.title} · ${site.progress}` };
}
