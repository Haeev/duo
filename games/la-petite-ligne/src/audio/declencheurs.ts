/**
 * Ce qui fait du bruit (son.md 4), logique pure:
 * - `soundsForEvent`: les événements ponctuels de la simulation (`WorldEvent`);
 * - `StateWatcher`: ce qui se lit dans l'état d'une image à l'autre (pas selon
 *   le sol, coups de marteau, scie et réchaud, poutre portée, menus, outil,
 *   repère de destination, notifications, lignes de la commande, poules).
 *
 * Les sons du monde sont placés (case, personnage, point de la carte); ceux de
 * l'autre joueur sont joués plus bas (`peerDb`). Les sons d'interface de
 * l'autre ne s'entendent pas chez soi, sauf la proposition d'achat.
 */
import type { RandomSource } from '@duo/sdk/sim';
import type { Content } from '../donnees/types';
import type { GameMap } from '../etat/carte';
import type { Cell, CharacterId, ReadonlyWorld, Vec2, WorldEvent } from '../etat/types';
import type { AudioSettings } from './reglages';

export interface SoundRequest {
  sound: string;
  /** Position au sol (m), ou `null` pour un son non placé. */
  at: Vec2 | null;
  /** Écart de niveau (dB): l'autre joueur plus bas. */
  gainDb: number;
  /** Départ différé (s). */
  delay: number;
  /** Position de départ dans le fichier (s). */
  offset: number;
  /** Long son recalé sur une séquence: son étiquette. */
  tag: string | null;
}

/** Boucle d'effet voulue à cette image (le moteur démarre, déplace ou arrête). */
export interface LoopWish {
  key: string;
  sound: string;
  at: Vec2 | null;
  gainDb: number;
}

export interface TriggerContext {
  world: ReadonlyWorld;
  local: CharacterId;
  content: Content;
  map: GameMap;
  /** Niveau des sons du monde de l'autre joueur (dB). */
  peerDb: number;
  /** Le son existe dans `sons.json` et passe par le bus d'interface. */
  isUiSound(sound: string): boolean;
  hasSound(sound: string): boolean;
}

/** Ce qu'un événement demande au reste du son (séquences, musique). */
export interface EventSignals {
  morning: boolean;
  wentToBed: boolean;
  demoEnded: boolean;
  hensFed: boolean;
}

export function noSignals(out: EventSignals): EventSignals {
  out.morning = false;
  out.wentToBed = false;
  out.demoEnded = false;
  out.hensFed = false;
  return out;
}

function cellCenter(cell: Cell): Vec2 {
  return { x: cell.cx + 0.5, y: cell.cy + 0.5 };
}

function characterAt(world: ReadonlyWorld, id: CharacterId): Vec2 | null {
  const c = world.characters.find((k) => k.id === id);
  return c === undefined ? null : { x: c.pos.x, y: c.pos.y };
}

function pointAt(map: GameMap, id: string): Vec2 | null {
  const p = map.points[id];
  return p === undefined ? null : { x: p.x, y: p.y };
}

class Emitter {
  constructor(
    private readonly ctx: TriggerContext,
    private readonly out: SoundRequest[],
  ) {}

  /** Son du monde, placé; `by` donne le niveau (l'autre joueur plus bas). */
  world(sound: string, at: Vec2 | null, by: CharacterId | null, delay = 0): void {
    if (!this.ctx.hasSound(sound)) return;
    const gainDb = by !== null && by !== this.ctx.local ? this.ctx.peerDb : 0;
    this.out.push({ sound, at, gainDb, delay, offset: 0, tag: null });
  }

  /** Son d'interface, chez son auteur seulement (`both`: chez les deux). */
  ui(sound: string, owner: CharacterId | 'both', delay = 0): void {
    if (!this.ctx.hasSound(sound)) return;
    if (owner !== 'both' && owner !== this.ctx.local) return;
    this.out.push({ sound, at: null, gainDb: 0, delay, offset: 0, tag: null });
  }
}

function sawRecipe(content: Content, recipe: string): boolean {
  return content.recipes[recipe]?.inputs.some((i) => i.item === 'log') === true;
}

/** Sons d'un événement de la simulation; les signaux disent ce qui démarre une séquence. */
export function soundsForEvent(
  event: WorldEvent,
  ctx: TriggerContext,
  settings: AudioSettings,
  out: SoundRequest[],
  signals: EventSignals,
): void {
  const { world, map, content, local } = ctx;
  const d = settings.delays;
  const emit = new Emitter(ctx, out);
  switch (event.type) {
    case 'tilled':
      emit.world('hoe', cellCenter(event.cell), event.by);
      break;
    case 'sowed':
      emit.world('sow', cellCenter(event.cell), event.by);
      break;
    case 'watered':
      emit.world('water', cellCenter(event.cell), event.by);
      break;
    case 'can_empty':
      emit.world('water-empty', characterAt(world, event.by), event.by);
      break;
    case 'refilled':
      emit.world('water-fill', pointAt(map, event.at) ?? characterAt(world, event.by), event.by);
      break;
    case 'harvested': {
      const at = cellCenter(event.cell);
      emit.world('harvest', at, event.by);
      if (event.quality === 'fine') emit.world('quality-fine', at, event.by, d.qualitySeconds);
      break;
    }
    case 'chop': {
      const tree = world.trees.find((t) => t.id === event.tree);
      const at = tree === undefined ? characterAt(world, event.by) : { x: tree.pos.x, y: tree.pos.y };
      emit.world('axe-chop', at, event.by);
      if (event.felled) {
        emit.world('tree-crack', at, event.by, d.treeCrackSeconds);
        emit.world('tree-fall', at, event.by, d.treeFallSeconds);
      }
      break;
    }
    case 'dig': {
      const at = cellCenter(event.cell);
      emit.world('hoe', at, event.by);
      if (event.found) emit.world('quality-fine', at, event.by, d.digFoundSeconds);
      break;
    }
    case 'crafted': {
      const at = characterAt(world, event.by);
      const recipe = content.recipes[event.recipe];
      if (sawRecipe(content, event.recipe)) emit.world('saw-end', at, event.by);
      else if (recipe?.station === 'workbench') emit.world('build-done', at, event.by);
      else emit.world('bag', at, event.by);
      break;
    }
    case 'element_built': {
      const def = content.constructions.find((c) => c.id === event.construction);
      emit.world('build-done', def === undefined ? null : pointAt(map, def.point), null);
      break;
    }
    case 'beam_lifted':
      emit.world('duo-hop', world.beam === null ? null : { x: world.beam.pos.x, y: world.beam.pos.y }, null);
      break;
    case 'beam_dropped':
      emit.world('furniture-place', world.beam === null ? null : { x: world.beam.pos.x, y: world.beam.pos.y }, null);
      break;
    case 'beam_placed': {
      const spot = content.constructions.find((c) => c.carry !== null);
      emit.world('build-done', spot === undefined ? null : pointAt(map, spot.point), null);
      emit.ui('duo-done', 'both', d.duoDoneSeconds);
      break;
    }
    case 'furniture_placed': {
      const f = world.furniture.find((k) => k.id === event.furniture);
      emit.world('furniture-place', f === undefined ? characterAt(world, event.by) : cellCenter(f.cell), event.by);
      break;
    }
    case 'furniture_taken':
    case 'picked_up':
      emit.world('pickup', characterAt(world, event.by), event.by);
      break;
    case 'gave':
    case 'fed_hens':
      emit.world('bag', characterAt(world, event.by), event.by);
      if (event.type === 'fed_hens') signals.hensFed = true;
      break;
    case 'bought':
    case 'sold':
      emit.ui('coins', event.by);
      break;
    case 'deposited':
      emit.world('crate-deposit', pointAt(map, 'coop_crate') ?? characterAt(world, event.by), event.by);
      break;
    case 'money':
      emit.ui('coins', 'both');
      break;
    case 'order_paid':
      emit.ui('coins', 'both');
      emit.ui('order-stamp', 'both', d.stampSeconds);
      break;
    case 'proposal':
      // Chez celui qui doit répondre (son.md 4.3).
      if (event.by !== local) emit.ui('purchase-proposal', 'both');
      break;
    case 'proposal_resolved':
      emit.ui(event.accepted ? 'purchase-accept' : 'purchase-decline', 'both');
      break;
    case 'talk':
      emit.ui(`${settings.villagerMotifPrefix}${event.villager}`, event.by);
      break;
    case 'scene_started':
      emit.ui(`${settings.villagerMotifPrefix}${event.villager}`, 'both');
      break;
    case 'ate':
      emit.world('eat', characterAt(world, event.by), event.by);
      break;
    case 'went_to_bed':
      if (event.by === local) signals.wentToBed = true;
      break;
    case 'door': {
      const at = cellCenter(map.house.door);
      emit.world('door-open', at, event.by);
      emit.world('door-close', at, event.by, d.doorCloseSeconds);
      break;
    }
    case 'eggs_laid':
      emit.world('hen', pointAt(map, 'chicken_coop'), null);
      break;
    case 'morning':
      signals.morning = true;
      break;
    case 'quest_started':
    case 'quest_step':
    case 'quest_done':
    case 'unlocked':
      emit.ui('journal-new', 'both');
      break;
    case 'envie_done':
      if (event.by === 'both') emit.ui('duo-done', 'both');
      break;
    case 'shed_opened':
      emit.world('door-open', pointAt(map, 'handcar_shed'), null);
      emit.ui('duo-done', 'both', d.duoDoneSeconds);
      break;
    case 'demo_ended':
      signals.demoEnded = true;
      break;
    case 'pin':
      // Le repère: le sien, ou celui de l'autre (plus grave, trois notes), placé à l'épingle.
      emit.world(event.by === local ? 'ping-self' : 'ping-peer', { x: event.pos.x, y: event.pos.y }, null);
      break;
    // Rien à jouer: un autre son les porte (train, état, notification) ou ils sont muets.
    case 'already_taken':
    case 'build_progress':
    case 'construction_done':
    case 'bag_full':
    case 'scene_ended':
    case 'cooked':
    case 'got_up':
    case 'hens_arrived':
    case 'train_whistle':
    case 'train_arriving':
    case 'train_departing':
    case 'veillee_started':
    case 'midnight':
    case 'night':
    case 'letter':
    case 'save_point':
    case 'session_finish':
    case 'absence':
      break;
  }
}

// ---------------------------------------------------------------------------
// Ce qui se lit dans l'état

interface CharacterTrack {
  stepPhase: number;
  actionKind: string;
  actionSince: number;
  hammerTimer: number;
  placementItem: string | null;
  placementRotation: number;
}

/** Sons d'interface qui couvrent déjà une notification arrivée dans la même image. */
const COVERING_UI = new Set(['journal-new', 'duo-done', 'purchase-proposal', 'purchase-accept', 'purchase-decline']);
const NOTIFY_KINDS = new Set(['hint', 'message', 'letter', 'envie']);
const NOTEBOOK_MENUS = new Set(['notebook', 'letter']);

export class StateWatcher {
  private initialized = false;
  private readonly tracks = new Map<CharacterId, CharacterTrack>();
  private lastMenu: string | null = null;
  private lastSelected = -1;
  private lastDestination: { x: number; y: number } | null = null;
  private lastNotification = -1;
  private lastOrderLines = -1;
  private readonly henNext = new Map<string, number>();
  private hensExcitedUntil = -1;
  private readonly orderTotals = new Map<string, number>();

  constructor(
    private readonly settings: AudioSettings,
    private readonly random: RandomSource,
  ) {}

  /** Les poules viennent d'être nourries: elles gloussent plus souvent un moment. */
  excite(now: number): void {
    this.hensExcitedUntil = now + this.settings.hens.fedForSeconds;
    for (const id of this.henNext.keys()) this.henNext.set(id, now + this.draw(this.settings.hens.fedIntervalSeconds) * 0.3);
  }

  /** Une image: sons dérivés de l'état (`out`), boucles voulues (`loops`). */
  update(ctx: TriggerContext, dt: number, now: number, out: SoundRequest[], loops: LoopWish[]): void {
    const { world, local, map, content } = ctx;
    const s = this.settings;
    const emit = new Emitter(ctx, out);
    const first = !this.initialized;
    this.initialized = true;

    for (const c of world.characters) {
      let track = this.tracks.get(c.id);
      if (track === undefined) {
        track = {
          stepPhase: s.steps.firstStepPhase,
          actionKind: c.action.kind,
          actionSince: c.action.since,
          hammerTimer: s.hammer.firstHitSeconds,
          placementItem: c.placement?.item ?? null,
          placementRotation: c.placement?.rotation ?? 0,
        };
        this.tracks.set(c.id, track);
      }
      const at: Vec2 = { x: c.pos.x, y: c.pos.y };
      // Pas, au rythme de l'animation de marche.
      const walking = c.created && (c.status === 'active' || c.status === 'gesture') && c.speed > s.steps.threshold;
      if (walking) {
        const cycle = c.action.kind === 'carry' ? s.steps.carryCycleSeconds : s.steps.walkCycleSeconds;
        const scale = Math.min(s.steps.scaleMax, Math.max(s.steps.scaleMin, c.speed / s.steps.referenceSpeed));
        track.stepPhase += (dt * s.steps.stepsPerCycle * scale) / cycle;
        if (track.stepPhase >= 1) {
          track.stepPhase -= Math.floor(track.stepPhase);
          emit.world(this.stepSound(map, c.inHouse, at), at, c.id);
        }
      } else {
        track.stepPhase = s.steps.firstStepPhase;
      }
      // Actions continues.
      const kind = c.action.kind;
      const changed = kind !== track.actionKind || c.action.since !== track.actionSince;
      if (changed) {
        track.actionKind = kind;
        track.actionSince = c.action.since;
        track.hammerTimer = s.hammer.firstHitSeconds;
        if (kind === 'cook' && !first) emit.world('stove-light', this.stoveAt(ctx) ?? at, c.id);
      }
      if (kind === 'hammer') {
        track.hammerTimer -= dt;
        if (track.hammerTimer <= 0) {
          track.hammerTimer += s.hammer.periodSeconds;
          const target = c.action.target;
          emit.world('hammer', target === null ? at : { x: target.x, y: target.y }, c.id);
        }
      }
      const peerDb = c.id === local ? 0 : ctx.peerDb;
      if (kind === 'saw') loops.push({ key: `saw:${c.id}`, sound: 'saw-loop', at, gainDb: peerDb });
      if (kind === 'cook') loops.push({ key: `stove:${c.id}`, sound: 'stove-loop', at: this.stoveAt(ctx) ?? at, gainDb: peerDb });
      // Meuble tourné dans le plan.
      const placement = c.placement;
      if (placement !== null) {
        if (!first && placement.item === track.placementItem && placement.rotation !== track.placementRotation) {
          emit.world('furniture-rotate', cellCenter(placement.cell), c.id);
        }
        track.placementItem = placement.item;
        track.placementRotation = placement.rotation;
      } else {
        track.placementItem = null;
      }
    }

    // La poutre portée à deux.
    const beam = world.beam;
    if (beam?.carried === true) loops.push({ key: 'beam', sound: 'duo-carry-loop', at: { x: beam.pos.x, y: beam.pos.y }, gainDb: 0 });

    // Le joueur local: menus, outil, repère de destination, notifications.
    const me = world.characters.find((c) => c.id === local);
    if (me !== undefined) {
      const menu = me.menu;
      if (!first && menu !== this.lastMenu) {
        if (menu !== null && NOTEBOOK_MENUS.has(menu)) emit.ui('journal-open', local);
        const chest = this.chestAt(ctx) ?? { x: me.pos.x, y: me.pos.y };
        if (menu === 'chest') emit.world('chest-open', chest, local);
        else if (this.lastMenu === 'chest') emit.world('chest-close', chest, local);
      }
      this.lastMenu = menu;
      if (!first && me.selected !== this.lastSelected) emit.ui('tool-switch', local);
      this.lastSelected = me.selected;
      const dest = me.destination;
      const last = this.lastDestination;
      if (dest !== null && !first && (last?.x !== dest.x || last.y !== dest.y)) {
        emit.ui('ui-click', local);
      }
      this.lastDestination = dest === null ? null : { x: dest.x, y: dest.y };
      let newest = this.lastNotification;
      let notify = false;
      for (const n of me.notifications) {
        if (n.id > this.lastNotification) {
          newest = Math.max(newest, n.id);
          if (NOTIFY_KINDS.has(n.kind)) notify = true;
        }
      }
      if (notify && !first && !out.some((r) => COVERING_UI.has(r.sound) || r.sound.startsWith(s.villagerMotifPrefix))) emit.ui('notify', local);
      this.lastNotification = newest;
      // Une ligne de la commande se coche: le tampon, chez qui est à la caisse.
      const lines = this.orderLinesDone(world, content);
      const crate = pointAt(map, 'coop_crate');
      if (!first && lines > this.lastOrderLines && this.lastOrderLines >= 0 && crate !== null) {
        if (Math.hypot(me.pos.x - crate.x, me.pos.y - crate.y) <= s.stampNearCrateM) emit.ui('order-stamp', local, s.delays.stampSeconds);
      }
      this.lastOrderLines = lines;
    }

    this.hens(ctx, now, emit);
  }

  private stepSound(map: GameMap, inHouse: boolean, at: Vec2): string {
    const s = this.settings.steps;
    if (inHouse) return s.indoor;
    const cx = Math.floor(at.x);
    const cy = Math.floor(at.y);
    const ground = cx >= 0 && cy >= 0 && cx < map.width && cy < map.height ? map.ground[cy * map.width + cx] : undefined;
    return ground === undefined ? s.byGround.grass : s.byGround[ground];
  }

  private furnitureAt(ctx: TriggerContext, test: (item: string) => boolean): Vec2 | null {
    const f = ctx.world.furniture.find((k) => test(k.item));
    if (f === undefined) return null;
    const fp = ctx.content.items[f.item]?.footprint;
    const w = fp?.w ?? 1;
    const h = fp?.d ?? 1;
    const turned = f.rotation % 2 === 1;
    return { x: f.cell.cx + (turned ? h : w) / 2, y: f.cell.cy + (turned ? w : h) / 2 };
  }

  private stoveAt(ctx: TriggerContext): Vec2 | null {
    return this.furnitureAt(ctx, (item) => ctx.content.items[item]?.station === 'stove');
  }

  private chestAt(ctx: TriggerContext): Vec2 | null {
    return this.furnitureAt(ctx, (item) => (ctx.content.items[item]?.storage ?? null) !== null);
  }

  /** Lignes de la commande déjà remplies par la caisse du quai. */
  private orderLinesDone(world: ReadonlyWorld, content: Content): number {
    const totals = this.orderTotals;
    totals.clear();
    for (const stack of world.crate) totals.set(stack.item, (totals.get(stack.item) ?? 0) + stack.count);
    let done = 0;
    for (const line of content.settings.order.lines) if ((totals.get(line.item) ?? 0) >= line.count) done += 1;
    return done;
  }

  /** Gloussements: chaque poule à son rythme, plus souvent après la mangeoire, jamais la nuit. */
  private hens(ctx: TriggerContext, now: number, emit: Emitter): void {
    const { world } = ctx;
    const h = this.settings.hens;
    const minutes = world.clock.minutes;
    const quiet = minutes >= h.quietFromMinutes || minutes < h.quietUntilMinutes || world.phase === 'night' || world.phase === 'creation';
    for (const hen of world.hens) {
      const next = this.henNext.get(hen.id);
      if (next === undefined) {
        this.henNext.set(hen.id, now + this.draw(h.intervalSeconds));
        continue;
      }
      if (now < next) continue;
      const excited = now < this.hensExcitedUntil;
      this.henNext.set(hen.id, now + this.draw(excited ? h.fedIntervalSeconds : h.intervalSeconds));
      if (!quiet) emit.world('hen', { x: hen.pos.x, y: hen.pos.y }, null);
    }
  }

  private draw(range: readonly [number, number]): number {
    const [low, high] = range;
    return high > low ? this.random.float(low, high) : low;
  }
}
