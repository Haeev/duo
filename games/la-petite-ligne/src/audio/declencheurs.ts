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
import { isSheltered } from '../etat/interieurs';
import { currentOrder } from '../donnees/commandes';
import type { RandomSource } from '@duo/sdk/sim';
import type { Content } from '../donnees/types';
import { groundAt, inRect, type GameMap } from '../etat/carte';
import { seasonOfDay, weekdayOf } from '../donnees/calendrier';
import type { Cell, CharacterId, ReadonlyWorld, Vec2, WorldEvent } from '../etat/types';
import type { AudioSettings } from './reglages';
import { isRefusal, refusalTexts } from '../interface/refus';

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
  /** Tour 10: entendu à travers les murs (l'autre joueur dans un autre bâtiment visitable). */
  muffled?: boolean;
  /** Variante imposée (index du fichier: rideaux ouverts 0, fermés 1), sinon tirée. */
  variant?: number;
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
  /** Le son existe dans `sons.json`. */
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

/** Le bouchon de ce pêcheur, ou le pêcheur lui-même si la ligne est déjà rentrée. */
function bobberAt(world: ReadonlyWorld, id: CharacterId): Vec2 | null {
  const bobber = world.characters.find((k) => k.id === id)?.fishing?.bobber;
  return bobber === undefined ? characterAt(world, id) : { x: bobber.x, y: bobber.y };
}

function pointAt(map: GameMap, id: string): Vec2 | null {
  const p = map.points[id];
  return p === undefined ? null : { x: p.x, y: p.y };
}

/** Tour 10: lieux et objets des sons de la rue Haute et de la maison (`sons.json`, son.md 4.8). */
const BAKERY_WINDOW = 'bakery_window';
const BAKERY_ITEMS: ReadonlySet<string> = new Set(['bread', 'warm_bread', 'brioche']);
const WARM_BREAD = 'warm_bread';
const BAKERY_REACH_M = 4;
const BREAD_CRACK_DELAY_S = 0.3;
const SALON = 'salon';
const RACK_MODEL = 'tool_rack';
const RACK_DELAY_S = 0.25;
const FOOTBRIDGE_STEPS = 'footbridge-steps';
/** Récréation de l'école (son.md 4.8): jours d'école d'automne (lundi à vendredi), 10 h 30 et 15 h, au milieu de la cour. */
const RECESS_MINUTES: readonly number[] = [10 * 60 + 30, 15 * 60];
const SCHOOL_WEEKDAYS: ReadonlySet<number> = new Set([2, 3, 4, 5, 6]);
const SCHOOL_YARD: Vec2 = { x: 79, y: 16 };
/**
 * Petit creux: le Ventre passe sous ce seuil (règle du lot L4 à venir, `needs`); le gargouillis
 * ne joue qu'une fois, chez soi seulement (`localOnly`), jusqu'à ce que le Ventre remonte.
 */
const PECKISH_BELOW = 40;
/** Coupe au salon: coups de ciseaux espacés (s), puis la révélation, chez la personne au fauteuil. */
const SNIP_TIMES: readonly number[] = [0, 0.28, 0.55];
const REVEAL_DELAY_S = 0.85;
/** Rideaux: variante du fichier `curtain-draw` pour ouvrir et pour fermer. */
const CURTAIN_OPEN_VARIANT = 0;
const CURTAIN_CLOSE_VARIANT = 1;
const NAP_LOOP_KEY = 'nap';
/** Une porte de bâtiment visitable est celle de qui passe à moins de tant (m). */
const DOOR_REACH_M = 2.5;

/** Porte d'un bâtiment visitable la plus proche du point (à `DOOR_REACH_M` au plus), ou `null`. */
function nearestDoor(map: GameMap, at: Vec2 | null): { at: Vec2; building: string } | null {
  if (at === null) return null;
  let best: { at: Vec2; building: string } | null = null;
  let bestDistance = DOOR_REACH_M;
  for (const id in map.buildings) {
    for (const door of map.buildings[id]?.doors ?? []) {
      const centre = cellCenter(door.cell);
      const distance = Math.hypot(centre.x - at.x, centre.y - at.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { at: centre, building: id };
      }
    }
  }
  return best;
}

/** Le râtelier de la maison (meuble posé dont le modèle est `tool_rack`), ou `null`. */
function rackAt(world: ReadonlyWorld, content: Content): Vec2 | null {
  const rack = world.furniture.find((f) => (content.items[f.item]?.model ?? f.item) === RACK_MODEL);
  return rack === undefined ? null : cellCenter(rack.cell);
}

class Emitter {
  constructor(
    private readonly ctx: TriggerContext,
    private readonly out: SoundRequest[],
  ) {}

  /**
   * Son du monde, placé; `by` donne le niveau (l'autre joueur plus bas). L'autre joueur dans un
   * autre bâtiment visitable que moi s'entend à travers les murs (ADR 0016): plus bas, étouffé.
   */
  world(sound: string, at: Vec2 | null, by: CharacterId | null, delay = 0, variant?: number): void {
    if (!this.ctx.hasSound(sound)) return;
    const peer = by !== null && by !== this.ctx.local;
    const walled = peer && this.walledOff(by);
    // L'étouffement (passe-bas et niveau de `otherPlayerInside`) est appliqué par le moteur.
    const gainDb = peer ? this.ctx.peerDb : 0;
    const request: SoundRequest = { sound, at, gainDb, delay, offset: 0, tag: null };
    if (walled) request.muffled = true;
    if (variant !== undefined) request.variant = variant;
    this.out.push(request);
  }

  private walledOff(by: CharacterId): boolean {
    let mine: string | null = null;
    let theirs: string | null = null;
    for (const c of this.ctx.world.characters) {
      if (c.id === this.ctx.local) mine = c.inside;
      if (c.id === by) theirs = c.inside;
    }
    return theirs !== null && theirs !== mine;
  }

  /** Son d'interface, chez son auteur seulement (`both`: chez les deux). */
  ui(sound: string, owner: CharacterId | 'both', delay = 0): void {
    if (!this.ctx.hasSound(sound)) return;
    if (owner !== 'both' && owner !== this.ctx.local) return;
    this.out.push({ sound, at: null, gainDb: 0, delay, offset: 0, tag: null });
  }
}

/** Son d'arrosage propre à un arrosoir (tour 9, son.md 4.7). */
const WATER_SOUNDS: Readonly<Record<string, string>> = { watering_can_copper: 'water-pour-copper' };

function villagerAt(world: ReadonlyWorld, id: string): Vec2 | null {
  const v = world.villagers.find((k) => k.id === id);
  return v === undefined ? null : { x: v.pos.x, y: v.pos.y };
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
    case 'watered': {
      // L'arrosoir de cuivre (tour 9) a son timbre, plus clair.
      const c = world.characters.find((k) => k.id === event.by);
      const held = c?.bag[c.selected]?.item ?? null;
      const own = held === null ? undefined : WATER_SOUNDS[held];
      emit.world(own !== undefined && ctx.hasSound(own) ? own : 'water', cellCenter(event.cell), event.by);
      break;
    }
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
      // Tour 10 (son.md 4.8): des rideaux accrochés à une fenêtre ont leur son, à la place du meuble posé.
      const hung = f?.window !== undefined && ctx.hasSound('curtain-hang');
      emit.world(hung ? 'curtain-hang' : 'furniture-place', f === undefined ? characterAt(world, event.by) : cellCenter(f.cell), event.by);
      break;
    }
    case 'sat_down':
      // Le bois du banc qui craque sous le poids, et l'étoffe sur la planche.
      emit.world('bench-sit', characterAt(world, event.by), event.by);
      break;
    case 'furniture_taken':
      emit.world('pickup', characterAt(world, event.by), event.by);
      break;
    case 'picked_up': {
      // Une cueillette a son propre son (herbes, girolles, mûres, noisettes); le reste, `pickup`.
      const pick = settings.pickSounds[event.item];
      emit.world(pick !== undefined && ctx.hasSound(pick) ? pick : 'pickup', characterAt(world, event.by), event.by);
      break;
    }
    // 0.13, parcelles libres (section 5.5), en attendant les sons du sound designer (lot P5): un
    // « toc » de maillet par rangée posée, la motte d'une reprise, le froissement d'un défrichage, le
    // petit carillon d'une parcelle gagnée. Un refus a déjà son son par sa notification (`placement_`).
    case 'plot_placed': {
      const rows: number[] = [];
      for (const cell of event.cells) {
        if (rows.includes(cell.cy)) continue;
        rows.push(cell.cy);
        emit.world('hammer-tap', cellCenter(cell), event.by, (rows.length - 1) * d.plotRowSeconds);
      }
      break;
    }
    case 'plot_removed':
      emit.world(event.returned === null ? 'hoe' : 'harvest', cellCenter(event.cell), event.by);
      break;
    case 'friche_cleared':
      emit.world('grass-strike', cellCenter(event.cell), event.by);
      break;
    case 'plot_gained':
      emit.ui('bond-chime', event.by);
      break;
    case 'plot_refused':
    case 'plot_kept':
      break;
    case 'chop_refused': {

      // Le refus de la hache est le son lui-même: un coup mat, sans `ui-refusal` (son.md 4.6).
      const tree = world.trees.find((t) => t.id === event.tree);
      emit.world('axe-thud-soft', tree === undefined ? characterAt(world, event.by) : { x: tree.pos.x, y: tree.pos.y }, event.by);
      break;
    }
    case 'season_started':
      emit.ui(`${settings.seasonTurnPrefix}${event.season}`, 'both');
      break;
    case 'stage_choice':
      // Le bouton de l'écran d'étape joue déjà ui-confirm chez son auteur (interface/sons.ts).
      break;
    case 'gave':
    case 'fed_hens':
      emit.world('bag', characterAt(world, event.by), event.by);
      if (event.type === 'fed_hens') signals.hensFed = true;
      break;
    case 'bought': {
      emit.ui('coins', event.by);
      // Tour 10: au guichet du fournil, la clochette; le pain chaud craque dans les mains.
      const window = pointAt(map, BAKERY_WINDOW);
      const buyer = characterAt(world, event.by);
      if (window !== null && buyer !== null && BAKERY_ITEMS.has(event.item) && Math.hypot(buyer.x - window.x, buyer.y - window.y) <= BAKERY_REACH_M) {
        emit.world('bakery-bell', window, event.by);
        if (event.item === WARM_BREAD) emit.world('bread-crack', buyer, event.by, BREAD_CRACK_DELAY_S);
      }
      break;
    }
    case 'sold':
    case 'market_sale':
    case 'mail_delivered':
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
      // Le chocolat chaud d'Odette se boit (tour 10): une gorgée plutôt qu'une bouchée.
      emit.world(event.item === 'hot_chocolate' && ctx.hasSound('cup-sip') ? 'cup-sip' : 'eat', characterAt(world, event.by), event.by);
      break;
    case 'ate_together':
      emit.ui('eat-together', 'both');
      break;
    case 'door_locked':
      emit.world('door-locked', nearestDoor(map, characterAt(world, event.by))?.at ?? characterAt(world, event.by), event.by);
      break;
    case 'salon_seated':
      emit.world('chair-creak', characterAt(world, event.by), event.by);
      break;
    case 'hair_noticed':
      emit.ui('hair-noticed', 'both');
      break;
    case 'storage_full':
      emit.world('chest-full', characterAt(world, event.by), event.by);
      break;
    case 'went_to_bed':
      if (event.by === local) signals.wentToBed = true;
      break;
    case 'door': {
      // Tour 10: la porte la plus proche de celui qui passe (tous les bâtiments visitables).
      const near = nearestDoor(map, characterAt(world, event.by));
      const at = near?.at ?? cellCenter(map.house.door);
      emit.world('door-open', at, event.by);
      emit.world('door-close', at, event.by, d.doorCloseSeconds);
      // La mercerie a sa sonnette de porte, à l'entrée (son.md 4.8).
      if (event.entering && near?.building === SALON) emit.world('salon-bell', at, event.by);
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
    // Pêche (son.md 4): le lancer au pêcheur, puis le plouf, la touche et la prise au bouchon.
    case 'cast':
      emit.world('fishing-cast', characterAt(world, event.by), event.by);
      emit.world('fishing-splash', { x: event.at.x, y: event.at.y }, event.by, d.fishingSplashSeconds);
      break;
    case 'bite':
      emit.world('fishing-bite', bobberAt(world, event.by), event.by);
      break;
    case 'caught':
      emit.world('fishing-catch', bobberAt(world, event.by), event.by);
      break;
    case 'escaped':
      emit.world('fishing-escape', bobberAt(world, event.by), event.by);
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
    case 'stood_up':
    case 'hens_arrived':
    case 'train_whistle':
    case 'train_arriving':
    case 'train_departing':
    case 'veillee_started':
    case 'midnight':
    case 'night':
    case 'letter':
    case 'ardoise_posted':
    case 'market_opened':
    case 'market_buyer_arrived':
    case 'market_refused':
    case 'market_closed':
    case 'mail_ready':
    case 'mail_returned':
    case 'save_point':
    case 'session_finish':
    case 'absence':
      break;
    // Moments rares (tour 6): l'échelle posée contre le chêne quand le moment s'installe, le
    // montant qui craque quand on la prend; le reste suit l'état du moment (`moments.ts`).
    case 'moment_waiting':
      if (event.moment === 'ladder') emit.world('ladder-lean', pointAt(map, 'ladder_foot'), null);
      break;
    case 'hold_started':
      emit.world('ladder-grip', pointAt(map, event.point) ?? characterAt(world, event.by), event.by);
      break;
    case 'hen_called': {
      // La bonne réponse: la poule glousse et vient (jamais de son d'échec: une erreur ne coûte rien).
      const hen = world.hens.find((h) => h.id === event.hen);
      if (event.correct) emit.world('hen', hen === undefined ? characterAt(world, event.by) : { x: hen.pos.x, y: hen.pos.y }, event.by);
      break;
    }
    // Tour 8: le retour du thème après `stage_continue` suit l'état (musique); la commande tirée arrive par lettre.
    // Tour 9 (son.md 4.7): chantiers, cadeaux, poules commandées, outils, salut et lanternes.
    case 'improvement_paid':
      if (event.amount > 0) emit.ui('coins-drop', event.by);
      else emit.world('bag', characterAt(world, event.by), event.by);
      break;
    case 'improvement_built':
      emit.ui('chantier-built', 'both');
      break;
    case 'gift_given':
      emit.world('gift-give', villagerAt(world, event.villager) ?? characterAt(world, event.by), event.by);
      break;
    case 'hen_delivered':
      emit.world('hen', pointAt(map, 'chicken_coop'), null);
      break;
    // Élevage (0.12): sons existants en attendant ceux du sound-designer (`hen-cluck-happy`, `goat-bleat`, `milk-squirt`, `straw-rustle`, `rooster-crow`).
    case 'animal_petted':
    case 'brood_hatched':
    case 'animal_arrived':
      emit.world('hen', pointAt(map, 'chicken_coop'), null);
      break;
    case 'straw_taken':
    case 'coop_strawed':
    case 'pail_filled':
    case 'goat_watered':
    case 'goat_brushed':
    case 'goat_milked':
    case 'goat_led':
    case 'goat_staked':
    case 'brood_started':
      emit.world('bag', characterAt(world, event.by), event.by);
      break;
    case 'roosterling_left':
    case 'rooster_crowed':
    case 'naming_requested':
    case 'animal_named':
      break;
    case 'tool_upgraded':
      emit.world('pickup', characterAt(world, event.by), event.by);
      // Tour 10 (section 5.3): l'ancien outil va au râtelier.
      if (event.previous !== null) emit.world('rack-hang', rackAt(world, content) ?? characterAt(world, event.by), event.by, RACK_DELAY_S);
      break;
    case 'moment_armed':
      // Les deux manivelles tournent, puis chaque lisse se verrouille (fin des 2,5 s de l'armement).
      for (const crank of GATE_CRANKS) {
        emit.world('gate-crank', pointAt(map, crank), null);
        emit.world('gate-lock', pointAt(map, crank), null, d.gateLockSeconds);
      }
      break;
    case 'lantern_lit':
      emit.world('lantern-light', pointAt(map, event.place) ?? characterAt(world, event.by), event.by);
      break;
    case 'lantern_out':
      emit.world('lantern-out', pointAt(map, event.place) ?? characterAt(world, event.by), event.by);
      break;
    // Tour 10 (lot L5): loquet, salon, coupe remarquée et panière, sons à brancher.
    case 'annonce_posted':
    case 'annonce_done':
    case 'annonce_expired':
    case 'improvement_funded':
    case 'catalogue_page':
    case 'hen_named':
    case 'haircut':
    case 'hair_offer':
    case 'basket_delivered':
    case 'nap_started':
    case 'reunion':
    case 'curtains':
    case 'room_built':
      break;
    case 'moment_climax':
    case 'moment_paused':
    case 'moment_resumed':
    case 'moment_left':
    case 'hold_released':
    case 'dialogue_choice':
    case 'stage_continue':
    case 'order_drawn':
    case 'tree_regrown':
    case 'secret_revealed':
      break;
    // 0.13 (lot H1): crayon du carnet, écriteau lu, remarque en passant; sons du lot H8 (`pencil-note`).
    case 'habit_found':
    case 'sign_read':
    case 'villager_remark':
      break;
    // 0.13 (lot H2): le cadeau prend le son existant en attendant `gift-happy` et `gift-polite` du
    // lot H8; lanternes (`bond-chime`, `bond-level`), goûts et anniversaires (`birthday-chime`) attendent leurs sons.
    case 'gift_offered':
      emit.world('gift-give', villagerAt(world, event.villager) ?? characterAt(world, event.by), event.by);
      break;
    case 'bond_gain':
    case 'bond_level':
    case 'taste_found':
    case 'birthday_wished':
    case 'birthday_attended':
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
const COVERING_UI = new Set(['journal-new', 'duo-done', 'purchase-proposal', 'purchase-accept', 'purchase-decline', 'chantier-built', 'coins-drop']);
/** Manivelles du passage à niveau (salut du mécanicien, tour 9). */
const GATE_CRANKS: readonly string[] = ['gate_north_crank', 'gate_south_crank'];
const NOTIFY_KINDS = new Set(['hint', 'message', 'letter', 'envie']);
const NOTEBOOK_MENUS = new Set(['notebook', 'letter']);
/** Clés des boucles de chaque personnage (pas de texte fabriqué à chaque image). */
const LOOP_KEYS: Readonly<Record<CharacterId, { saw: string; stove: string }>> = {
  p1: { saw: 'saw:p1', stove: 'stove:p1' },
  p2: { saw: 'saw:p2', stove: 'stove:p2' },
};

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
  /** Tour 10: ce qui s'est vu à l'image d'avant (coupes, siestes, retrouvailles, rideaux, pièces). */
  private readonly looks = new Map<CharacterId, string>();
  private readonly napping = new Set<CharacterId>();
  private reunions = -1;
  private peckish = false;
  private readonly curtains = new Map<string, boolean>();
  private readonly roomsBuilt = new Set<string>();
  private readonly beamsPlaced = new Set<string>();
  private lastMinutes = -1;

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
    const refusal = refusalTexts(content.texts.raw);
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
          emit.world(this.stepSound(map, isSheltered(c), at), at, c.id);
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
      if (kind === 'saw') loops.push({ key: LOOP_KEYS[c.id].saw, sound: 'saw-loop', at, gainDb: peerDb });
      if (kind === 'cook') loops.push({ key: LOOP_KEYS[c.id].stove, sound: 'stove-loop', at: this.stoveAt(ctx) ?? at, gainDb: peerDb });
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
      let refused = false;
      for (const n of me.notifications) {
        if (n.id > this.lastNotification) {
          newest = Math.max(newest, n.id);
          // Un refus (« Déjà pris », sac plein, « Il manque 40 aubrins ») n'a pas le carillon des bonnes nouvelles (revue S2):
          // il a son son à lui, feutré, 600 ms au moins entre deux (`minIntervalMs` de `sons.json`).
          if (isRefusal(n, refusal)) refused = true;
          else if (NOTIFY_KINDS.has(n.kind)) notify = true;
        }
      }
      if (refused && !first) emit.ui('ui-refusal', local);
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
    this.tour10(ctx, emit, loops, first);
  }

  /**
   * Sons du tour 10 qui se lisent dans l'état (son.md 4.8): coupe au salon, sieste, sieste à deux,
   * retrouvailles, petit creux, rideaux ouverts et fermés, pièce bâtie, panne faîtière au faîte,
   * récréation de l'école. À la première image, rien ne sonne (on prend l'état comme il est).
   */
  private tour10(ctx: TriggerContext, emit: Emitter, loops: LoopWish[], first: boolean): void {
    const { world, local, map, content } = ctx;
    let asleep = 0;
    for (const c of world.characters) {
      const look = `${c.appearance.hair}|${c.appearance.hairColor}|${c.appearance.beard}`;
      const before = this.looks.get(c.id);
      this.looks.set(c.id, look);
      if (!first && before !== undefined && before !== look && c.inside === SALON) {
        const at = { x: c.pos.x, y: c.pos.y };
        SNIP_TIMES.forEach((delay, index) => {
          emit.world('scissors-snip', at, c.id, delay, index % 3);
        });
        const me = world.characters.find((k) => k.id === local);
        emit.ui('hair-reveal', me?.inside === SALON ? 'both' : c.id, REVEAL_DELAY_S);
      }
      const napping = c.needs.napStart !== null;
      if (napping) asleep += 1;
      if (napping && !this.napping.has(c.id) && !first) emit.world('yawn-soft', { x: c.pos.x, y: c.pos.y }, c.id);
      if (napping) this.napping.add(c.id);
      else this.napping.delete(c.id);
    }
    // Sieste à deux: l'horloge file, le tic-tac doux chez les deux.
    if (asleep >= 2) loops.push({ key: NAP_LOOP_KEY, sound: 'nap-tick', at: null, gainDb: 0 });
    const me = world.characters.find((c) => c.id === local);
    if (me !== undefined) {
      const reunions = me.needs.reunionsToday;
      if (!first && this.reunions >= 0 && reunions > this.reunions) emit.ui('reunion-chime', local);
      this.reunions = reunions;
      const peckish = me.needs.belly < PECKISH_BELOW && world.phase === 'day';
      if (peckish && !this.peckish && !first) emit.ui('belly-rumble', local);
      this.peckish = peckish;
    }
    for (const f of world.furniture) {
      if (f.window === undefined) continue;
      const closed = f.closed === true;
      const before = this.curtains.get(f.id);
      this.curtains.set(f.id, closed);
      if (!first && before !== undefined && before !== closed) {
        emit.world('curtain-draw', cellCenter(f.cell), null, 0, closed ? CURTAIN_CLOSE_VARIANT : CURTAIN_OPEN_VARIANT);
      }
    }
    for (const [id, room] of Object.entries(world.rooms)) {
      const built = room.builtDay !== null;
      if (built && !this.roomsBuilt.has(id) && !first) emit.ui('room-built', 'both');
      if (built) this.roomsBuilt.add(id);
      if (room.beamPlaced && !this.beamsPlaced.has(id) && !first) {
        const rect = Object.values(map.buildings)
          .flatMap((b) => b.rooms)
          .find((r) => r.build?.room === id)?.rect;
        emit.world('beam-ridge', rect === undefined ? null : { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }, null);
      }
      if (room.beamPlaced) this.beamsPlaced.add(id);
    }
    const minutes = world.clock.minutes;
    const day = world.clock.day;
    const schoolDay = seasonOfDay(content.settings, day) === 'autumn' && SCHOOL_WEEKDAYS.has(weekdayOf(day));
    if (!first && schoolDay && world.phase === 'day' && this.lastMinutes >= 0) {
      for (const at of RECESS_MINUTES) {
        if (this.lastMinutes < at && minutes >= at) emit.world('school-recess', SCHOOL_YARD, null);
      }
    }
    this.lastMinutes = minutes;
  }

  private stepSound(map: GameMap, inHouse: boolean, at: Vec2): string {
    const s = this.settings.steps;
    if (inHouse) return s.indoor;
    const cx = Math.floor(at.x);
    const cy = Math.floor(at.y);
    // Tour 10: les planches de la passerelle du ru ont leurs pas à elles (son.md 4.8).
    for (const crossing of map.crossings) {
      if (crossing.kind === 'footbridge' && inRect(crossing.rect, at.x, at.y)) return FOOTBRIDGE_STEPS;
    }
    const ground = groundAt(map, cx, cy);
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
    for (const line of currentOrder(content.settings, world).lines) if ((totals.get(line.item) ?? 0) >= line.count) done += 1;
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
