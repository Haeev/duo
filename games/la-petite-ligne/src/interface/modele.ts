/**
 * Ce que l'interface affiche, tiré de l'état du monde: fonctions pures (aucun
 * DOM), testées dans Node. Les composants comparent ces modèles d'une image à
 * l'autre et ne touchent le DOM que s'ils changent.
 */
import { inRect } from '../etat/carte';
import type { CharacterId, ItemStack, MenuKind, ReadonlyWorld } from '../etat/types';
import type { QuestDef } from '../donnees/types';
import {
  ACTION_ICONS,
  CATEGORY_ICONS,
  type Expression,
  FORM_EXPRESSIONS,
  ITEM_ICONS,
  PARTNER_POINTS,
  PARTNER_ZONES,
  UI_SETTINGS,
  WEATHER_ICONS,
} from './config';
import { type ReadonlyCharacter, type UiContext, characterOf, nameOf } from './contexte';
import { capitalize, clockTime, contentVars, countIn, hourLabel, itemName, itemTitle, weekdayOf } from './format';

// ---------------------------------------------------------------------------
// Écran courant

export type ScreenKind = 'title' | 'creation' | 'breakfast' | 'night' | 'session_end' | 'ended';

/** Ce que l'interface retient localement pour choisir l'écran. */
export interface ScreenFlags {
  /** L'écran titre est passé (les deux joueurs prêts, ou partie déjà en cours). */
  titleDone: boolean;
  /** La séance est finie (événement `session_finish`, « Finir la séance » des deux à l'écran de nuit). */
  sessionFinished: boolean;
  /** « Le train entre en gare… »: l'écran de création reste un instant après les deux créations. */
  creationHold: boolean;
}

export function screenOf(world: ReadonlyWorld, me: CharacterId, flags: ScreenFlags): ScreenKind | null {
  // La fin de la démo garde son écran jusqu'à ce que la plateforme prenne le relais.
  if (world.phase === 'ended') return 'ended';
  if (flags.sessionFinished) return 'session_end';
  const self = characterOf(world, me);
  if (self === null) return null;
  if (!flags.titleDone && (world.phase === 'creation' || world.phase === 'breakfast')) return 'title';
  if (world.phase === 'creation' || flags.creationHold) return 'creation';
  if (world.phase === 'night') return 'night';
  if (self.status === 'breakfast') return 'breakfast';
  return null;
}

// ---------------------------------------------------------------------------
// Icônes

export function itemIcon(ctx: UiContext, item: string): string {
  const direct = ITEM_ICONS[item];
  if (direct !== undefined) return direct;
  const category = ctx.content.items[item]?.category;
  return (category === undefined ? undefined : CATEGORY_ICONS[category]) ?? 'parcel';
}

// ---------------------------------------------------------------------------
// Horloge

export type ClockState = '' | 'stopped' | 'evening' | 'waiting';

export interface ClockModel {
  day: string;
  weather: string;
  weatherIcon: string;
  time: string;
  state: ClockState;
  status: string | null;
  statusIcon: string;
  train: string | null;
}

/** « Mercredi, jour 5 » (gabarit `textes.ui.hud.day`). */
export function dayLabel(ctx: UiContext, day: number): string {
  return capitalize(ctx.t(ctx.texts.game.ui.hud.day, { weekday: weekdayOf(day, ctx.texts.weekdays), day }));
}

function trainNotice(world: ReadonlyWorld, ctx: UiContext): string | null {
  const s = ctx.content.settings.train;
  const { day, minutes } = world.clock;
  if (!s.days.includes(day)) return null;
  const window = UI_SETTINGS.trainNoticeMinutes;
  const time = (m: number): string => hourLabel(m, ctx.texts.game.ui.hud.time);
  if (minutes < s.arrival && s.arrival - minutes <= window && world.train.phase === 'away') {
    return ctx.t(ctx.texts.extra.hud.trainArrives, { time: time(s.arrival) });
  }
  const lastDay = ctx.content.settings.clock.lastDay;
  if (day === lastDay.day && minutes < s.departure && s.departure - minutes <= window && world.orderResult === null) {
    return ctx.t(ctx.texts.extra.hud.trainLeaves, { time: time(s.departure) });
  }
  return null;
}

export function clockModel(world: ReadonlyWorld, ctx: UiContext): ClockModel {
  const hud = ctx.texts.extra.hud;
  const weather = ctx.texts.weather[world.weather] ?? world.weather;
  let state: ClockState = '';
  let status: string | null = null;
  let statusIcon = 'ui-pause';
  const stop = world.clock.stoppedBy;
  if (stop === 'absence') {
    state = 'waiting';
    status = ctx.t(hud.stopped.absence, { partner: nameOf(world, ctx.partner) });
    statusIcon = 'ui-hourglass';
  } else if (stop === 'scene') {
    state = 'stopped';
    status = ctx.t(hud.stopped.scene);
  } else if (stop === 'veillee') {
    state = 'evening';
    status = ctx.t(hud.stopped.veillee);
    statusIcon = 'ui-moon';
  } else if (stop === 'midnight') {
    state = 'evening';
    status = ctx.t(hud.stopped.midnight);
    statusIcon = 'ui-moon';
  } else if (stop === 'both_busy') {
    state = 'stopped';
    status = ctx.t(hud.stopped.both_busy);
    statusIcon = 'ui-hourglass';
  }
  return {
    day: `${dayLabel(ctx, world.clock.day)} · ${weather}`,
    weather,
    weatherIcon: WEATHER_ICONS[world.weather] ?? 'weather-sun',
    time: ctx.t(clockTime(world.clock.minutes, ctx.texts.game.ui.hud.time)),
    state,
    status,
    statusIcon,
    train: trainNotice(world, ctx),
  };
}

// ---------------------------------------------------------------------------
// Bourse

export interface PurseModel {
  /** Bourse affichée: ce qui reste plus ce qui est réservé par une proposition. */
  amount: number;
  reserved: number;
}

export function purseModel(world: ReadonlyWorld): PurseModel {
  const reserved = world.proposals.reduce((sum, p) => sum + p.price, 0);
  return { amount: world.purse + reserved, reserved };
}

/** Sépare `{amount} sous` en montant et unité (le montant a son propre style). */
export function splitAmount(template: string): { before: string; after: string } {
  const at = template.indexOf('{amount}');
  if (at < 0) return { before: '', after: template };
  return { before: template.slice(0, at), after: template.slice(at + '{amount}'.length) };
}

// ---------------------------------------------------------------------------
// Soi et l'autre

export interface FormModel {
  name: string;
  text: string;
  expression: Expression;
}

export function formModel(ctx: UiContext, c: ReadonlyCharacter): FormModel {
  const entry = ctx.texts.form.find((f) => f.level === c.form);
  return { name: entry?.name ?? '', text: entry?.text ?? '', expression: FORM_EXPRESSIONS[c.form] };
}

export type StaminaLevel = '' | 'low' | 'empty';

export interface StaminaModel {
  ratio: number;
  level: StaminaLevel;
  label: string;
}

export function staminaModel(ctx: UiContext, c: ReadonlyCharacter): StaminaModel {
  const ratio = c.enduranceMax > 0 ? Math.max(0, Math.min(1, c.endurance / c.enduranceMax)) : 1;
  if (c.endurance <= 0 && c.enduranceMax > 0) return { ratio: 0, level: 'empty', label: ctx.texts.extra.hud.noEnergy };
  if (ratio < UI_SETTINGS.staminaLowRatio) return { ratio, level: 'low', label: ctx.texts.extra.hud.tired };
  return { ratio, level: '', label: '' };
}

export type PartnerState = '' | 'away' | 'asleep';

export interface PartnerModel {
  name: string;
  expression: Expression;
  activity: string;
  icon: string;
  state: PartnerState;
}

function villagerLabel(ctx: UiContext, id: string): string {
  return ctx.content.villagers.find((v) => v.id === id)?.label ?? id;
}

function placeOf(ctx: UiContext, c: ReadonlyCharacter): string {
  const places = ctx.texts.extra.partner.places;
  if (c.inHouse) return places.house_interior ?? ctx.texts.extra.partner.elsewhere;
  const radius = UI_SETTINGS.partnerPlaceRadius;
  for (const id of PARTNER_POINTS) {
    const at = ctx.map.points[id];
    const label = places[id];
    if (at !== undefined && label !== undefined && Math.hypot(at.x - c.pos.x, at.y - c.pos.y) <= radius) return label;
  }
  for (const id of PARTNER_ZONES) {
    const zone = ctx.map.zones[id];
    const label = places[id];
    if (zone !== undefined && label !== undefined && inRect(zone, c.pos.x, c.pos.y)) return label;
  }
  return ctx.texts.extra.partner.elsewhere;
}

const MENU_ICONS: Readonly<Record<MenuKind, string>> = {
  notebook: 'ui-notebook',
  shop: 'ui-coin',
  catalogue: 'ui-notebook',
  crate: 'parcel',
  workbench: 'plank',
  stove: 'soup',
  chest: 'chest',
  proposal: 'ui-coin',
  letter: 'ui-letter',
};

/** Ce que fait l'autre joueur, en mots. `awayMinutes`: minutes sans entrée (mesurées par l'interface), ou `null`. */
export function partnerModel(world: ReadonlyWorld, ctx: UiContext, awayMinutes: number | null): PartnerModel | null {
  const p = characterOf(world, ctx.partner);
  if (p === null) return null;
  const txt = ctx.texts.extra.partner;
  const form = formModel(ctx, p);
  const base = { name: p.name, expression: form.expression };
  const make = (activity: string, icon: string, state: PartnerState = ''): PartnerModel => ({
    ...base,
    activity: ctx.t(activity),
    icon,
    state,
  });
  if (p.status === 'night') return make(txt.night, 'ui-moon', 'asleep');
  if (p.status === 'sleeping') return make(txt.asleep, 'ui-moon', 'asleep');
  if (p.status === 'breakfast') return make(txt.breakfast, 'bread');
  if (awayMinutes !== null) return make(ctx.t(txt.away, { minutes: awayMinutes }), 'ui-hourglass', 'away');
  if (p.status === 'scene' && world.scene !== null) {
    return make(ctx.t(txt.scene, { villager: villagerLabel(ctx, world.scene.villager) }), 'ui-pin');
  }
  if (p.status === 'dialogue' && p.dialogue !== null) {
    return make(ctx.t(txt.talking, { villager: villagerLabel(ctx, p.dialogue.villager) }), 'ui-note');
  }
  if (p.status === 'menu' && p.menu !== null) {
    return make(txt.menus[p.menu] ?? txt.elsewhere, MENU_ICONS[p.menu]);
  }
  if (p.crafting !== null) {
    const recipe = ctx.content.recipes[p.crafting.recipe];
    return recipe?.station === 'stove' ? make(txt.cooking, 'soup') : make(txt.crafting, 'plank');
  }
  if (world.beam?.holders.includes(p.id) === true) return make(txt.carrying, 'beam');
  if (world.constructions.some((k) => k.elements.some((e) => e.workers.includes(p.id)))) return make(txt.building, 'plank');
  const kind = p.action.kind;
  const running = p.action.duration === 0 || world.tick < p.action.since + p.action.duration;
  const actionText = txt.actions[kind];
  if (running && actionText !== undefined && kind !== 'walk' && kind !== 'idle' && kind !== 'talk') {
    return make(actionText, ACTION_ICONS[kind] ?? 'ui-pin');
  }
  return make(placeOf(ctx, p), 'ui-pin');
}

// ---------------------------------------------------------------------------
// Barre d'outils

export interface SlotModel {
  index: number;
  item: string | null;
  icon: string | null;
  count: number;
  fine: boolean;
  /** Niveau d'eau de l'arrosoir (0 à 1), ou `null`. */
  gauge: number | null;
  /** Nom accessible: « Radis, belle qualité, 6 ». */
  label: string;
  unusable: boolean;
}

export function slotModel(ctx: UiContext, c: ReadonlyCharacter, index: number): SlotModel {
  const stack: Readonly<ItemStack> | null = c.bag[index] ?? null;
  if (stack === null) {
    return { index, item: null, icon: null, count: 0, fine: false, gauge: null, label: ctx.texts.extra.common.emptySlot, unusable: false };
  }
  const def = ctx.content.items[stack.item];
  const capacity = def?.capacity ?? null;
  const gauge = capacity !== null && capacity > 0 ? Math.max(0, Math.min(1, c.water / capacity)) : null;
  const fine = stack.quality === 'fine';
  const parts = [itemTitle(def, stack.count, stack.item)];
  if (gauge !== null && capacity !== null) parts.push(ctx.t(ctx.texts.extra.hud.water, { water: c.water, capacity }));
  if (fine) parts.push(ctx.texts.extra.common.fineQuality);
  if (stack.count > 1 || (def?.stack ?? 1) > 1) parts.push(String(stack.count));
  return {
    index,
    item: stack.item,
    icon: itemIcon(ctx, stack.item),
    count: (def?.stack ?? 1) > 1 ? stack.count : 0,
    fine,
    gauge,
    label: ctx.t(parts.join(', ')),
    unusable: gauge !== null && c.water <= 0,
  };
}

export interface ToolbarModel {
  slots: SlotModel[];
  selected: number;
  held: string;
  detail: string;
}

export function toolbarModel(ctx: UiContext, c: ReadonlyCharacter): ToolbarModel {
  const slots: SlotModel[] = [];
  for (let i = 0; i < UI_SETTINGS.toolbarSlots; i++) slots.push(slotModel(ctx, c, i));
  const stack = c.bag[c.selected] ?? null;
  let detail = '';
  let name = ctx.texts.extra.hud.emptyHand;
  if (stack !== null) {
    const def = ctx.content.items[stack.item];
    name = itemTitle(def, stack.count, stack.item);
    const capacity = def?.capacity ?? null;
    if (capacity !== null) detail = ctx.t(ctx.texts.extra.hud.water, { water: c.water, capacity });
    else if (stack.count > 1) detail = ctx.t(ctx.texts.extra.hud.stack, { count: stack.count });
  }
  return { slots, selected: c.selected, held: ctx.t(name), detail };
}

// ---------------------------------------------------------------------------
// Commande du samedi

/** La quête de la commande: celle dont une étape se résout à l'échéance. */
export function orderQuest(ctx: UiContext): QuestDef | null {
  return ctx.content.quests.find((q) => q.steps.some((s) => s.resolve === 'at_deadline')) ?? null;
}

export interface OrderLineModel {
  item: string;
  icon: string;
  name: string;
  need: number;
  inCrate: number;
  inBag: number;
  done: boolean;
}

export function orderLines(world: ReadonlyWorld, ctx: UiContext): OrderLineModel[] {
  const me = characterOf(world, ctx.me);
  return ctx.content.settings.order.lines.map((line) => {
    const def = ctx.content.items[line.item];
    const inCrate = countIn(world.crate, line.item);
    return {
      item: line.item,
      icon: itemIcon(ctx, line.item),
      name: itemTitle(def, 2, line.item),
      need: line.count,
      inCrate,
      inBag: me === null ? 0 : countIn(me.bag, line.item),
      done: inCrate >= line.count,
    };
  });
}

/** Somme versée si la commande part complète (prime de ligne et bonus). */
export function orderFullAmount(ctx: UiContext): number {
  const o = ctx.content.settings.order;
  const base = o.lines.reduce((sum, l) => sum + l.count * (ctx.content.items[l.item]?.sellPrice ?? 0) * o.linePremium, 0);
  return Math.round(base * (1 + o.fullBonus));
}

/** « 2 lignes sur 4 » (singulier sous 2). */
export function linesText(ctx: UiContext, done: number, total: number): string {
  const c = ctx.texts.extra.common;
  return ctx.t(done < 2 ? c.lineOf : c.linesOf, { done, total });
}

// ---------------------------------------------------------------------------
// Quêtes et prochain objectif

export interface ObjectiveLine {
  icon: string | null;
  text: string;
  done: boolean;
}

export interface QuestModel {
  id: string;
  kind: 'main' | 'side';
  title: string;
  text: string;
  done: boolean;
  /** Progression affichée en puce (« 2 lignes sur 4 », « 3 sur 4 »), ou vide. */
  progress: string;
  lines: ObjectiveLine[];
}

function questText(world: ReadonlyWorld, ctx: UiContext, def: QuestDef, step: number, done: boolean): string {
  const vars = contentVars(ctx.content, world.orderResult, ctx.texts.orderFormat);
  const s = def.steps[step];
  return ctx.t(done || s === undefined ? def.completionText : s.objective, vars);
}

export function questModels(world: ReadonlyWorld, ctx: UiContext): QuestModel[] {
  const order = orderQuest(ctx);
  const out: QuestModel[] = [];
  for (const state of world.quests) {
    const def = ctx.content.quests.find((q) => q.id === state.id);
    if (def === undefined) continue;
    const done = state.status === 'done';
    let progress = '';
    let lines: ObjectiveLine[] = [];
    if (def.id === order?.id && !done) {
      const ol = orderLines(world, ctx);
      progress = linesText(ctx, ol.filter((l) => l.done).length, ol.length);
      lines = ol.map((l) => ({
        icon: l.icon,
        text: ctx.t(ctx.texts.extra.common.itemCountOf, { item: l.name, have: Math.min(l.inCrate, l.need), need: l.need }),
        done: l.done,
      }));
    } else if (!done && state.checklist.length > 1) {
      progress = ctx.t(ctx.texts.extra.common.countOf, {
        have: state.checklist.filter((i) => i.done).length,
        need: state.checklist.length,
      });
      lines = state.checklist.map((i) => ({ icon: null, text: ctx.t(i.label), done: i.done }));
    }
    out.push({
      id: def.id,
      kind: def.kind,
      title: ctx.t(def.title),
      text: questText(world, ctx, def, state.step, done),
      done,
      progress,
      lines,
    });
  }
  return out;
}

/**
 * Le prochain objectif du HUD: la trame d'abord (sauf la commande), puis les
 * coups de main, puis la commande; la commande passe devant à l'approche du train.
 */
export function nextObjective(world: ReadonlyWorld, ctx: UiContext): QuestModel | null {
  const quests = questModels(world, ctx).filter((q) => !q.done);
  if (quests.length === 0) return null;
  const order = orderQuest(ctx);
  const lastDay = ctx.content.settings.clock.lastDay.day;
  const isOrder = (q: QuestModel): boolean => q.id === order?.id;
  if (world.clock.day >= lastDay - 1) {
    const o = quests.find(isOrder);
    if (o !== undefined) return o;
  }
  return (
    quests.find((q) => q.kind === 'main' && !isOrder(q)) ?? quests.find((q) => q.kind === 'side') ?? quests.find(isOrder) ?? null
  );
}

// ---------------------------------------------------------------------------
// Courrier

export interface LetterModel {
  id: string;
  from: string;
  title: string;
  day: string;
  text: string;
  unread: boolean;
}

/** Lettres, la plus récente d'abord. */
export function letterModels(world: ReadonlyWorld, ctx: UiContext): LetterModel[] {
  return world.letters
    .map((l, index) => ({ l, index }))
    .sort((a, b) => b.l.day - a.l.day || b.index - a.index)
    .map(({ l }) => ({
      id: l.id,
      from: ctx.t(capitalize(l.from)),
      title: ctx.t(l.title),
      day: capitalize(`${weekdayOf(l.day, ctx.texts.weekdays)} ${l.day}`),
      text: ctx.t(l.text),
      unread: !l.read.includes(ctx.me),
    }));
}

// ---------------------------------------------------------------------------
// Divers

/** Nom d'objet en minuscules avec la quantité: « 3 œufs ». */
export function countedItem(ctx: UiContext, item: string, count: number): string {
  return `${count} ${itemName(ctx.content.items[item], count, item)}`;
}

/** Minutes réelles depuis un instant (pour « depuis 3 min »). */
export function minutesSince(fromMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - fromMs) / 60_000));
}
