/**
 * Ce que l'interface affiche, tiré de l'état du monde: fonctions pures (aucun
 * DOM), testées dans Node. Les composants comparent ces modèles d'une image à
 * l'autre et ne touchent le DOM que s'ils changent.
 */
import { isTrainDay } from '../donnees/calendrier';
import { currentOrder, isGeneratedOrder } from '../donnees/commandes';
import { rawText } from '../donnees/contenu';
import { linePay, productPrice } from '../etat/commande-generee';
import { letterFrom, letterText, letterTitle } from '../etat/courrier';
import { hudSeason, questTitleOf, weatherLabel } from '../etat/semaine';
import { HOUSE_BUILDING, inRect } from '../etat/carte';
import { houseRoomAt, isNapping } from '../etat/maison';
import type { CharacterId, ItemStack, MenuKind, ReadonlyWorld } from '../etat/types';
import type { QuestDef } from '../donnees/types';
import { henLabel, objectiveTemplate, secretCards, secretVars } from '../etat/secrets';
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
import { capitalize, clockTime, contentVars, countIn, hourLabel, itemName, itemTitle, keyTokens, weekdayOf } from './format';
import { type SecretView, secretViewOf } from './modele-secrets';

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
  /** Saison sous la date: « Été · jour 3 » (`ui.hud.season`, tour 8, section 2.6). */
  season: string;
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
  if (!isTrainDay(ctx.content.settings, day)) return null;
  const window = UI_SETTINGS.trainNoticeMinutes;
  const time = (m: number): string => hourLabel(m, ctx.texts.game.ui.hud.time);
  if (minutes < s.arrival && s.arrival - minutes <= window && world.train.phase === 'away') {
    return ctx.t(ctx.texts.extra.hud.trainArrives, { time: time(s.arrival) });
  }
  const orderDay = currentOrder(ctx.content.settings, world).day;
  if (day === orderDay && minutes < s.departure && s.departure - minutes <= window && world.orderResult === null) {
    return ctx.t(ctx.texts.extra.hud.trainLeaves, { time: time(s.departure) });
  }
  return null;
}

export function clockModel(world: ReadonlyWorld, ctx: UiContext): ClockModel {
  const hud = ctx.texts.extra.hud;
  // La brume du matin se dit tant qu'elle est là (elle s'est levée à `weather.mist.until`).
  const misty = world.morningMist && world.clock.minutes < ctx.content.settings.weather.mist.until;
  const weather = misty ? weatherLabel(world, ctx.content) : (ctx.texts.weather[world.weather] ?? world.weather);
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
    season: ctx.t(hudSeason(world, ctx.content)),
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

/**
 * Celui ou celle avec qui l'on parle, comme ce joueur le connaît: le nom d'un habitant, une
 * poule par son nom s'il le voit déjà au-dessus d'elle, sinon par sa couleur (« la poule
 * rousse »). Jamais un identifiant: à défaut, « quelqu'un ».
 */
function speakerLabel(world: ReadonlyWorld, ctx: UiContext, id: string): string {
  const villager = ctx.content.villagers.find((v) => v.id === id);
  if (villager !== undefined) return villager.label;
  const hen = world.hens.find((h) => h.id === id);
  if (hen !== undefined) return henLabel(world, ctx.content, hen, ctx.me);
  return ctx.texts.extra.partner.someone;
}

/** L'autre remplit sa part d'un moment rare (dans le rayon, dans la pose): ce qu'il regarde. */
function watchingLabel(world: ReadonlyWorld, ctx: UiContext, id: CharacterId): string | null {
  const today = world.moments.today;
  if (today === null || (today.phase !== 'waiting' && today.phase !== 'climax') || !today.watching[id]) return null;
  return ctx.texts.extra.partner.watching[today.id] ?? ctx.texts.extra.partner.watchingAny;
}

/**
 * Où est un personnage qui est dans un bâtiment (ADR 0016, `Character.inside`): la pièce bâtie de
 * la maisonnette (« Dans le cellier »), sinon le bâtiment (« Au salon de Solange »), sinon « À
 * l'intérieur ». `null` dehors.
 */
export function buildingPlace(world: ReadonlyWorld, ctx: UiContext, c: ReadonlyCharacter): string | null {
  const inside = c.inside;
  if (inside === null) return null;
  const places = ctx.texts.extra.partner.places;
  if (inside === HOUSE_BUILDING) {
    const room = houseRoomAt(ctx.map, world.rooms, c.pos.x, c.pos.y);
    const built = room?.build ?? null;
    const label = built === null || room === null ? undefined : places[`room:${room.id}`];
    if (label !== undefined) return label;
  }
  return places[`building:${inside}`] ?? ctx.texts.extra.partner.inside;
}

function placeOf(world: ReadonlyWorld, ctx: UiContext, c: ReadonlyCharacter): string {
  const places = ctx.texts.extra.partner.places;
  const building = buildingPlace(world, ctx, c);
  if (building !== null) return building;
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
  // Tour 10 (lot L6): icônes à choisir avec l'interface du salon et du guichet.
  salon: 'ui-notebook',
  bakery: 'ui-coin',
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
  if (p.status === 'sleeping') return make(isNapping(p) ? txt.napping : txt.asleep, 'ui-moon', 'asleep');
  if (p.status === 'breakfast') return make(txt.breakfast, 'bread');
  if (awayMinutes !== null) return make(ctx.t(txt.away, { minutes: awayMinutes }), 'ui-hourglass', 'away');
  if (p.status === 'scene' && world.scene !== null) {
    return make(ctx.t(txt.scene, { villager: speakerLabel(world, ctx, world.scene.villager) }), 'ui-pin');
  }
  if (p.status === 'dialogue' && p.dialogue !== null) {
    const hen = p.dialogue.dialogue === UI_SETTINGS.henCallDialogue;
    return make(ctx.t(hen ? txt.callingHen : txt.talking, { villager: speakerLabel(world, ctx, p.dialogue.villager) }), hen ? 'hen' : 'ui-note');
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
  const watching = watchingLabel(world, ctx, p.id);
  if (watching !== null) return make(watching, 'ui-eye');
  if (p.seat !== null) return make(txt.seated, ACTION_ICONS.sit ?? 'ui-pin');
  const kind = p.action.kind;
  const running = p.action.duration === 0 || world.tick < p.action.since + p.action.duration;
  const actionText = txt.actions[kind];
  if (running && actionText !== undefined && kind !== 'walk' && kind !== 'idle' && kind !== 'talk') {
    return make(actionText, ACTION_ICONS[kind] ?? 'ui-pin');
  }
  return make(placeOf(world, ctx, p), p.inside === null ? 'ui-pin' : 'ui-house');
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

/**
 * La quête de la commande en cours: après les commandes écrites, la quête de la semaine
 * (`repeat: each_train`, tour 8, section 4.9); avant, celle dont l'échéance tombe au jour de son
 * train (sinon la première à échéance).
 */
export function orderQuest(ctx: UiContext, world: ReadonlyWorld): QuestDef | null {
  const settings = ctx.content.settings;
  const atDeadline = ctx.content.quests.filter((q) => q.steps.some((s) => s.resolve === 'at_deadline'));
  if (isGeneratedOrder(settings, world)) {
    const weekly = atDeadline.find((q) => q.repeat === 'each_train');
    if (weekly !== undefined) return weekly;
  }
  const day = currentOrder(settings, world).day;
  return atDeadline.find((q) => q.steps.some((s) => s.deadline?.day === day)) ?? atDeadline[0] ?? null;
}

/** Jour du train d'une quête: celui de son instance (quête de la semaine), sinon celui de la commande en cours. */
function questTrainDay(world: ReadonlyWorld, ctx: UiContext, questId: string): number {
  const state = world.quests.find((q) => q.id === questId);
  return state?.train ?? currentOrder(ctx.content.settings, world).day;
}

/** Titre de la quête de la commande, `{day}` rempli (« La commande du samedi 22 »). */
export function orderQuestTitle(ctx: UiContext, world: ReadonlyWorld): string | null {
  const def = orderQuest(ctx, world);
  return def === null ? null : ctx.t(def.title, { day: questTrainDay(world, ctx, def.id) });
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
  return currentOrder(ctx.content.settings, world).lines.map((line) => {
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

/**
 * Somme versée si la commande part complète (prime de ligne et bonus). Une commande générée paie
 * chaque ligne au moins sa part de travail (section 4.7, `linePay`, comme `payOrder`).
 */
export function orderFullAmount(ctx: UiContext, world: ReadonlyWorld): number {
  const settings = ctx.content.settings;
  const o = currentOrder(settings, world);
  const g = settings.order.generated;
  const drawn = g !== null && isGeneratedOrder(settings, world) ? world.order.generated : null;
  const base = o.lines.reduce((sum, l, i) => {
    const sellPrice = ctx.content.items[l.item]?.sellPrice ?? 0;
    const line = drawn?.lines[i];
    return sum + (g !== null && line !== undefined ? linePay(g, line, productPrice(g, l.item, sellPrice), o.linePremium) : l.count * sellPrice * o.linePremium);
  }, 0);
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
  /** P1: peut manquer à la démo (la pêche), passe après le reste dans le prochain objectif. */
  optional: boolean;
  title: string;
  text: string;
  done: boolean;
  /** Progression affichée en puce (« 2 lignes sur 4 », « 3 sur 4 »), ou vide. */
  progress: string;
  lines: ObjectiveLine[];
  /**
   * Fiche de la quête à secret (R16): le secret chez l'informé seul, « Demande-lui » chez
   * l'autre, le secret chez les deux à la fin; `null` pour une quête sans secret.
   */
  secret: SecretView | null;
  /** Annonce retirée à son échéance (tour 9): ligne grise au carnet. */
  withdrawn: boolean;
}

function questText(world: ReadonlyWorld, ctx: UiContext, def: QuestDef, step: number, done: boolean): string {
  // Objectif selon le rôle dans une quête à secret; `{secret}` n'est rempli que chez l'informé.
  // `{act}` et les autres touches: l'objectif de l'autre dit quelle touche appelle une poule.
  const vars = {
    ...contentVars(ctx.content, world, ctx.texts.orderFormat),
    ...keyTokens(ctx.key),
    ...secretVars(world, ctx.content, def, ctx.me),
    day: questTrainDay(world, ctx, def.id),
  };
  const s = def.steps[step];
  return ctx.t(done || s === undefined ? def.completionText : objectiveTemplate(world, ctx.content, def.id, step, ctx.me), vars);
}

export function questModels(world: ReadonlyWorld, ctx: UiContext): QuestModel[] {
  const order = orderQuest(ctx, world);
  const cards = secretCards(world, ctx.content, ctx.me);
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
      optional: def.tier === 'P1',
      title: ctx.t(questTitleOf(ctx.content, state)),
      text: questText(world, ctx, def, state.step, done),
      done,
      progress,
      lines,
      secret: secretViewOf(world, ctx, def.id, done, cards),
      withdrawn: false,
    });
  }
  return out;
}

export interface NotebookQuests {
  main: QuestModel[];
  side: QuestModel[];
  /** Groupe « Annonces » (tour 9, section 1.6): l'annonce ouverte, puis les deux dernières closes. */
  annonces: QuestModel[];
}

function isAnnonceQuest(id: string): boolean {
  return id.startsWith('annonce_');
}

/**
 * Les quêtes du carnet, rangées (tour 9, section 5.3): parmi les commandes faites, seulement les
 * deux dernières, avec leur résultat (« 5 lignes sur 5, 1137 sous »); les annonces à part, la
 * dernière faite ou retirée gardée au plus deux fois.
 */
export function notebookQuests(world: ReadonlyWorld, ctx: UiContext): NotebookQuests {
  const all = questModels(world, ctx);
  const n = ctx.texts.extra.notebook;
  const recent = world.orderHistory.slice(-2);
  const orderDayOf = (id: string): number | null => {
    const def = ctx.content.quests.find((q) => q.id === id);
    if (def?.repeat !== null) return null;
    return def.steps.find((st) => st.resolve === 'at_deadline')?.deadline?.day ?? null;
  };
  const kept = new Set<number>();
  const main: QuestModel[] = [];
  for (const q of all) {
    if (q.kind !== 'main') continue;
    const day = q.done ? orderDayOf(q.id) : null;
    if (day !== null) {
      if (!recent.some((o) => o.day === day)) continue;
      kept.add(day);
    }
    main.push(q);
  }
  const weekly = ctx.content.quests.find((q) => q.repeat === 'each_train');
  for (const o of recent) {
    if (kept.has(o.day) || weekly === undefined) continue;
    main.push({
      id: `order:${String(o.day)}`,
      kind: 'main',
      optional: false,
      title: ctx.t(weekly.title, { day: o.day }),
      text: ctx.t(n.orderResult, { lines: linesText(ctx, o.linesDone, o.linesTotal), amount: o.amount }),
      done: true,
      progress: '',
      lines: [],
      secret: null,
      withdrawn: false,
    });
  }
  const annonces = all.filter((q) => isAnnonceQuest(q.id));
  const keep = ctx.content.settings.board?.keepDone ?? 2;
  const closed = [world.board.current, world.board.previous].filter((a) => a !== null && a.state !== 'open').slice(0, keep);
  for (const a of closed) {
    if (a === null) continue;
    const def = ctx.content.annonces.find((x) => x.id === a.gabarit);
    const giver = ctx.content.villagers.find((v) => v.id === def?.giver)?.label ?? '';
    annonces.push({
      id: `annonce:${a.gabarit}:${String(a.posted)}`,
      kind: 'side',
      optional: false,
      title: ctx.t(rawText(ctx.content.texts, 'annonces', a.gabarit, 'title') ?? a.gabarit),
      text:
        a.state === 'expired'
          ? ctx.t(ctx.texts.extra.board.expiredText, { giver })
          : ctx.t(ctx.texts.game.ui.board.reward, { amount: a.reward }),
      done: true,
      progress: '',
      lines: [],
      secret: null,
      withdrawn: a.state === 'expired',
    });
  }
  return { main, side: all.filter((q) => q.kind === 'side' && !isAnnonceQuest(q.id)), annonces };
}

/**
 * Le prochain objectif du HUD: la trame d'abord (sauf la commande), puis les
 * coups de main, puis la commande, puis ce qui est facultatif (P1); la
 * commande passe devant à l'approche du train.
 */
export function nextObjective(world: ReadonlyWorld, ctx: UiContext): QuestModel | null {
  const open = questModels(world, ctx).filter((q) => !q.done);
  if (open.length === 0) return null;
  const quests = [...open.filter((q) => !q.optional), ...open.filter((q) => q.optional)];
  const order = orderQuest(ctx, world);
  const lastDay = currentOrder(ctx.content.settings, world).day;
  const isOrder = (q: QuestModel): boolean => q.id === order?.id;
  if (world.clock.day >= lastDay - 1) {
    const o = quests.find(isOrder);
    if (o !== undefined) return o;
  }
  return (
    quests.find((q) => q.kind === 'main' && !isOrder(q) && !q.optional) ??
    quests.find((q) => q.kind === 'side' && !q.optional) ??
    quests.find(isOrder) ??
    quests[0] ??
    null
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
  /** Ligne sous le titre dans la liste: « La coopérative de la ligne · samedi 22 » (section 5.2). */
  meta: string;
  /** Nom accessible de l'entrée: « {titre}, de {expéditeur}, {jour}, non lue ». */
  label: string;
}

/** Lettres, la plus récente d'abord. */
export function letterModels(world: ReadonlyWorld, ctx: UiContext): LetterModel[] {
  return world.letters
    .map((l, index) => ({ l, index }))
    .sort((a, b) => b.l.day - a.l.day || b.index - a.index)
    .map(({ l }) => {
      const n = ctx.texts.extra.notebook;
      const from = ctx.t(capitalize(letterFrom(ctx.content, l)));
      const title = ctx.t(letterTitle(ctx.content, l));
      const day = `${weekdayOf(l.day, ctx.texts.weekdays)} ${l.day}`;
      const unread = !l.read.includes(ctx.me);
      return {
        id: l.id,
        from,
        title,
        day: capitalize(day),
        text: ctx.t(letterText(ctx.content, l)),
        unread,
        meta: ctx.t(n.letterMeta, { from, day }),
        label: ctx.t(unread ? n.letterUnread : n.letterLabel, { title, from, day }),
      };
    });
}

// ---------------------------------------------------------------------------
// État du HUD

/** `dialogue` et `build` effacent le bas du HUD, `panel` aussi l'objectif (`interface.css`). */
export type HudState = 'dialogue' | 'panel' | 'build' | null;

/**
 * La couche ouverte l'emporte; sinon, un meuble en main met le HUD en
 * aménagement: la barre d'aménagement prend le bas de l'écran (revue I1).
 */
export function hudState(layer: 'screen' | 'dialogue' | 'panel' | null, placing: boolean): HudState {
  if (layer === 'dialogue' || layer === 'panel') return layer;
  if (layer === 'screen') return null;
  return placing ? 'build' : null;
}

// ---------------------------------------------------------------------------
// Création

/**
 * La tenue que l'autre joueur a confirmée à la création, ou `null` s'il n'a
 * pas encore confirmé (sa tenue par défaut n'est pas un choix). Déconseillée
 * à la création, jamais interdite (remarque du directeur artistique).
 */
export function outfitTakenByPartner(world: ReadonlyWorld, ctx: UiContext): number | null {
  const other = characterOf(world, ctx.partner);
  return other?.created === true ? other.appearance.outfit : null;
}

// ---------------------------------------------------------------------------
// Aménagement

/**
 * Raison d'un refus de pose (demande 11): le texte `placement_*` de
 * `textes.json`, que la simulation donne tout fait, ou sa clé. `null` si la
 * raison manque (texte absent des données): l'interface montre alors son
 * message général.
 */
export function placementReason(blocked: string | null | undefined, messages: Readonly<Record<string, string>>): string | null {
  if (blocked === null || blocked === undefined || blocked.trim() === '') return null;
  if (/^placement_[a-z_]+$/.test(blocked)) return messages[blocked] ?? null;
  return blocked;
}

// ---------------------------------------------------------------------------
// Divers

/** Nom d'objet en minuscules avec la quantité: « 3 œufs ». */
export function countedItem(ctx: UiContext, item: string, count: number): string {
  return `${count} ${itemName(ctx.content.items[item], count, item)}`;
}

/**
 * Pause d'un joueur selon la simulation (PA-04): `null` tant qu'elle ne le
 * déclare pas absent (`absent`), sinon les minutes de jeu sans entrée, comptées
 * en pas comme elle le fait (`lastInputTick`), et jamais en temps réel: quand
 * les images ralentissent, la carte n'annonce pas l'absence avant l'horloge.
 */
export function absenceMinutes(world: ReadonlyWorld, c: ReadonlyCharacter): number | null {
  if (!c.absent) return null;
  const ticksPerMinute = UI_SETTINGS.simHz * 60;
  return Math.max(0, Math.floor((world.tick - c.lastInputTick) / ticksPerMinute));
}
