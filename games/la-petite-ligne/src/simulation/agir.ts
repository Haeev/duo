/**
 * Viser et agir: ce que ferait Espace devant soi (case surlignée), ce que fait
 * un clic sur une cible, et l'exécution de l'action.
 */
import { mealAtPoint, mealPoints, nearMeal, orderMeal } from './drapeaux';
import type { ClickTarget } from '../etat/actions';
import type { AimInfo, AimVerb, Cell, Character, GardenCell, MenuKind, Tree, Vec2 } from '../etat/types';
import { isHome, isSheltered } from '../etat/interieurs';
import { AIM_CONE, AIM_DISTANCE } from './constantes';
import { type Sim, bump, character, distance, emit, partnerOf, point, sayIfWritten } from './contexte';
import { queueHint } from './astuces';
import { ghostAt, ghostNear } from './construction';
import { beamDistance, beamGrabRange, beamGrip, footprintCells } from './deplacement';
import { talkTo } from './dialogues';
import { nearPoint, shopOpen } from './economie';
import { isBlockedCell } from './grille';
import { refreshBlockers } from './deplacement';
import { ITEM, POINT } from './ids';
import { freeSeatsNear, fullBenchNear, homeSeats, playerBench, seatReachable, sitDown, slotTaken, villagerSeated } from './bancs';
import { standPlace } from '../etat/bancs';
import { fishAct, holdsRod, tryNet, waterAhead } from './peche';
import { toolKindOf } from './catalogue';
import { feedHens, petAnimal, pettableNear, strawCoop, takeStraw } from './poules';
import { GOAT_REACH, fillPail, goatAct, goatLedBy, goatVerb, goatsThirsty, leadGoat, plantStake, pourPail, spotNear } from './chevres';
import { chop, dig, gardenCellAt, gesture, harvest, refill, sow, till, water } from './potager';
import { isCurtains, placeFurniture, toggleCurtains } from './amenagement';
import { beginNapIfAfternoon, eatFromBag } from './besoins';
import { addToBag, countInBag, dropAt, giveToCharacter, heldStack, takeFromBag } from './sac';
import { harvestTaken, pickupTaken, pickupTakenNear, rememberPickup } from './simultane';
import { holdPlaceNear, lanternTargetNear, lightLantern, takeHold } from './moments';
import { callableHen, callHen } from './secrets';
import { refuseChop, treeStage } from './lisiere';
import { TOWN, canDrinkChocolate, drinkChocolate, openBakery } from './bourg';
import { SALON, chairTaken, openSalon, sitAtChair } from './salon';
import { CLOTHES, openClothesShop } from './vetements';
import { buildingOpen } from './interieurs';
import { nearStall, stallPose, stallSetUp } from '../etat/marche';
import { serveBuyer } from './marche';
import { MAIL_POINT, deliverMail, mailWaiting, takeMail } from './plis';

/** Cible de l'étal du dimanche (pas forcément un point de la carte: `stallPose`). */
const STALL_POINT = 'market_stall';

/** Ce sur quoi on peut agir. */
export type Target =
  | { kind: 'villager'; id: string; pos: Vec2 }
  | { kind: 'ground_item'; id: string; pos: Vec2 }
  | { kind: 'beam'; pos: Vec2 }
  | { kind: 'bed'; furniture: string; pos: Vec2 }
  | { kind: 'station'; menu: MenuKind; furniture: string; pos: Vec2 }
  | { kind: 'point'; point: string; pos: Vec2 }
  | { kind: 'construction'; id: string; pos: Vec2 }
  | { kind: 'cell'; cell: Cell; pos: Vec2 }
  | { kind: 'tree'; id: string; pos: Vec2 }
  | { kind: 'partner'; pos: Vec2 }
  | { kind: 'place'; pos: Vec2 }
  /** Place libre d'un banc: `pos` au milieu de l'assise, `stand` devant (où l'on va avant de s'asseoir). */
  | { kind: 'bench'; bench: string; slot: number; pos: Vec2; stand: Vec2 }
  /** Place de l'échelle de Basile (geste « tenir »); `taken`: l'autre la tient déjà. */
  | { kind: 'hold'; point: string; taken: boolean; pos: Vec2 }
  /** Une poule à appeler par son nom (« Les noms des poules »). */
  | { kind: 'hen'; id: string; pos: Vec2 }
  /** Une place d'allumage des lanternes (tour 9), le moment du jour à sa fenêtre. */
  | { kind: 'lantern'; place: string; pos: Vec2 }
  /** Des rideaux à une fenêtre (tour 10): les ouvrir ou les fermer, de dedans. */
  | { kind: 'curtains'; furniture: string; pos: Vec2 }
  /** Une bête de l'élevage (0.12): poule, poussine, coq, chèvre. */
  | { kind: 'animal'; id: string; pos: Vec2 }
  /** Le piquet d'une chèvre (prendre la corde). */
  | { kind: 'stake'; goat: string; pos: Vec2 }
  /** Une place de pâture libre, pour qui mène la chèvre (planter le piquet). */
  | { kind: 'spot'; spot: string; pos: Vec2 };

/** Points du bourg où l'on agit, et le menu qu'ils ouvrent s'il y en a un. */
const POINT_MENUS: Partial<Record<string, MenuKind>> = {
  [POINT.groceryCounter]: 'shop',
  // Tour 10: le même comptoir, vu de dedans la boutique d'Odette (depuis la place du client).
  [POINT.groceryCustomer]: 'shop',
  [POINT.noticeBoard]: 'catalogue',
  [POINT.coopCrate]: 'crate',
  [POINT.workbench]: 'workbench',
  [STALL_POINT]: 'stall',
  // 0.12: la basse-cour (état des bêtes, couvée, noms), au poulailler et à la chevrerie.
  [POINT.chickenCoop]: 'farm',
  [POINT.goatShed]: 'farm',
};
/** Un clic au sol à moins de tant d'une place libre (m) vise le banc. */
const BENCH_CLICK_RADIUS = 1.2;
/** Un clic au sol à moins de tant du point d'un chantier (m) vise le chantier (la porte, le poulailler). */
const GHOST_CLICK_RADIUS = 1.5;
const ACT_POINTS = [
  POINT.well,
  POINT.waterBarrel,
  POINT.groceryCounter,
  POINT.noticeBoard,
  POINT.coopCrate,
  POINT.workbench,
  POINT.henFeeder,
  // Tour 10: comptoir intérieur d'Odette, petite table (chocolat), guichet du fournil, fauteuil du salon.
  POINT.groceryCustomer,
  TOWN.table,
  TOWN.window,
  SALON.chair,
  SALON.bench,
  // 0.12: la place du client au comptoir de mercerie (boutique de vêtements).
  CLOTHES.counter,
  // 0.12: botte de paille, porte du poulailler, porte de la chevrerie.
  POINT.strawBale,
  POINT.chickenCoop,
  POINT.goatShed,
];

const actPointsCache = new WeakMap<object, readonly string[]>();

/** Points où l'on agit, plus ceux des repas payés (0.13), ajoutés une fois par contenu. */
function actPoints(sim: Sim): readonly string[] {
  let list = actPointsCache.get(sim.content);
  if (list === undefined) {
    list = [...ACT_POINTS, ...mealPoints(sim)];
    actPointsCache.set(sim.content, list);
  }
  return list;
}

function frontPoint(c: Character, out: Vec2): Vec2 {
  out.x = c.pos.x + Math.cos(c.facing) * AIM_DISTANCE;
  out.y = c.pos.y + Math.sin(c.facing) * AIM_DISTANCE;
  return out;
}

export function furnitureCentre(sim: Sim, f: { item: string; cell: Cell; rotation: number }): Vec2 {
  const def = sim.content.items[f.item];
  const fp = def?.footprint ?? { w: 1, d: 1 };
  const cells = footprintCells(fp, f.cell, f.rotation);
  let x = 0;
  let y = 0;
  for (const k of cells) {
    x += k.cx + 0.5;
    y += k.cy + 0.5;
  }
  return { x: x / cells.length, y: y / cells.length };
}

/** Le verbe d'une cible pour ce personnage, ou `null` s'il n'y a rien à faire. */
export function verbOf(sim: Sim, c: Character, t: Target): AimVerb | null {
  const held = heldStack(c);
  const heldDef = held === null ? undefined : sim.content.items[held.item];
  switch (t.kind) {
    case 'villager':
      return 'talk';
    case 'ground_item':
      return 'pickup';
    case 'beam':
      return 'carry';
    case 'bed': {
      const f = sim.world.furniture.find((x) => x.id === t.furniture);
      const sleepers = f === undefined ? 0 : (sim.content.items[f.item]?.bed?.sleepers ?? 0);
      const used = sim.world.characters.filter((x) => x.bedId === t.furniture).length;
      return used < sleepers ? 'sleep' : null;
    }
    case 'station':
      return 'open';
    case 'point':
      if (t.point === POINT.well || t.point === POINT.waterBarrel) {
        if (toolKindOf(sim, held?.item) === 'watering_can') return 'refill';
        const goats = sim.content.settings.goats;
        return goats !== null && goatsThirsty(sim) && countInBag(c, goats.pailItem) === 0 ? 'fill_pail' : null;
      }
      if (t.point === POINT.strawBale) {
        const care = sim.content.settings.hens.care;
        return care !== null && sim.world.hens.length > 0 && countInBag(c, care.straw.item) === 0 ? 'take_straw' : null;
      }
      if (t.point === POINT.chickenCoop) {
        if (sim.world.hens.length === 0) return null;
        const care = sim.content.settings.hens.care;
        return care !== null && countInBag(c, care.straw.item) > 0 ? 'straw' : 'open';
      }
      if (t.point === POINT.goatShed) {
        const goats = sim.content.settings.goats;
        if (goats === null || sim.world.breeding.goats.length === 0) return null;
        return countInBag(c, goats.pailItem) > 0 ? 'pour' : 'open';
      }
      if (t.point === POINT.henFeeder) return sim.world.hens.length > 0 ? 'feed' : null;
      if (t.point === POINT.groceryCounter) return shopOpen(sim) ? 'open' : null;
      if (t.point === STALL_POINT) return 'open';
      if (t.point === MAIL_POINT) return mailWaiting(sim, c) ? 'open' : null;
      if (t.point === POINT.groceryCustomer) return insideShopOpen(sim, c) ? 'open' : null;
      if (t.point === TOWN.table) return canDrinkChocolate(sim, c) ? 'drink' : null;
      if (t.point === TOWN.window) return sim.world.flags.includes(TOWN.bakeryOpen) && !isSheltered(c) ? 'open' : null;
      {
        // 0.13: soupe du jour au café, souper du dimanche à la pension (le drapeau de la quête les ouvre).
        const meal = mealAtPoint(sim, t.point);
        if (meal !== null) return nearMeal(sim, c, meal) ? meal.verb : null;
      }
      if (t.point === SALON.chair) return c.inside === SALON.building && c.menu === null ? 'sit' : null;
      if (t.point === SALON.bench) return c.inside === SALON.building && c.menu === null && chairTaken(sim, c) ? 'open' : null;
      if (t.point === CLOTHES.counter) return c.inside === SALON.building && c.menu === null ? 'open' : null;
      return 'open';
    case 'construction':
      return 'build';
    case 'tree': {
      const tree = sim.world.trees.find((x) => x.id === t.id);
      return tree !== undefined && !tree.felled && toolKindOf(sim, held?.item) === 'axe' ? 'chop' : null;
    }
    case 'partner':
      return held !== null && heldDef?.category !== 'tool' ? 'give' : null;
    case 'place':
      return 'place';
    case 'hold':
      return t.taken ? null : 'hold';
    case 'hen':
      return 'call';
    case 'lantern':
      return 'light';
    case 'curtains':
      return isHome(c) ? 'curtains' : null;
    case 'animal': {
      const goat = sim.world.breeding.goats.find((g) => g.id === t.id);
      return goat === undefined ? 'pet' : goatVerb(sim, c, goat);
    }
    case 'stake':
      return goatLedBy(sim, c.id) === null ? 'lead' : null;
    case 'spot':
      return 'plant';
    case 'bench': {
      const prop = playerBench(sim, t.bench);
      // On ne s'assoit qu'en journée de jeu (pas à l'écran de fin, B-T5-09).
      const free = sim.world.phase === 'day' && c.seat === null && prop !== null && seatReachable(c, prop) && !slotTaken(sim, prop, t.slot);
      return free ? 'sit' : null;
    }
    case 'cell': {
      // Qui mène la chèvre plante le piquet là où il est (refusé hors des places, avec la raison).
      if (goatLedBy(sim, c.id) !== null) return 'plant';
      const g = gardenCellAt(sim, t.cell);
      if (g !== null) return gardenVerb(sim, g, held?.item ?? null);
      if (held?.item === ITEM.hoe && !isSheltered(c) && !isBlockedCell(refreshBlockers(sim), t.cell.cx, t.cell.cy)) return 'dig';
      return null;
    }
  }
}

function gardenVerb(sim: Sim, g: GardenCell, held: string | null): AimVerb | null {
  if (g.crop?.ripe === true) return 'harvest';
  const heldDef = held === null ? undefined : sim.content.items[held];
  if (g.soil === 'grass') return held === ITEM.hoe ? 'till' : null;
  if (heldDef?.category === 'seed' && g.crop === null) return 'sow';
  if (toolKindOf(sim, held) === 'watering_can') return 'water';
  return null;
}

/** Ordre de préférence quand plusieurs cibles sont devant soi. */
const TIER: Record<Target['kind'], number> = {
  // Pendant l'étape de l'échelle, Basile se tient juste entre les deux places: tenir passe avant lui.
  hold: -1,
  lantern: -1,
  villager: 0,
  curtains: 4,
  // Pendant la quête des noms seulement (avant la mangeoire et la porte du poulailler).
  hen: 3,
  // 0.12: après les points (la mangeoire passe avant la poule qui picore à côté), le piquet après la
  // chèvre (on trait sans prendre la corde), la place de pâture avant tout (planter le piquet).
  animal: 4.5,
  stake: 5.5,
  spot: 2,
  ground_item: 1,
  beam: 2,
  place: 3,
  bed: 4,
  // Après tout geste possible: on bêche au pied du banc (énigme d'Émile) en visant le sol à côté;
  // tourné vers le banc, la case visée est la sienne (infranchissable, sans geste) et l'on s'assoit.
  bench: 9,
  station: 4,
  point: 4,
  partner: 5,
  construction: 6,
  tree: 7,
  cell: 8,
};

/**
 * Une case du potager où l'on a quelque chose à faire (bêcher, semer, arroser,
 * récolter) passe avant les chantiers et les arbres voisins: la porte touche
 * le potager au nord, le poulailler est juste à l'est.
 */
const GARDEN_TIER = TIER.partner;

/** Objets qu'un habitant ne masque pas quand on les vise de plus près que lui. */
const OBJECT_KINDS: ReadonlySet<Target['kind']> = new Set<Target['kind']>(['point', 'station', 'beam']);

/**
 * Un habitant assis sur un banc passe après la place libre à côté de lui: Espace devant le banc
 * assoit près de lui, puis, assis, parle avec lui (un clic sur lui lui parle tout de suite).
 */
const SEATED_VILLAGER_TIER = TIER.bench + 1;

/**
 * De même, le partenaire assis passe après la place libre à côté de lui (B-T5-08): Espace devant
 * elle assoit, même un objet en main. On lui donne debout face à lui hors d'une place libre visée,
 * assis à côté de lui (assis, on ne vise plus de place), ou d'un clic sur lui.
 */
const SEATED_PARTNER_TIER = TIER.bench + 1;

function tierOf(sim: Sim, c: Character, t: Target): number {
  if (t.kind === 'villager' && villagerSeated(sim, t.id)) return SEATED_VILLAGER_TIER;
  if (t.kind === 'partner' && character(sim, partnerOf(c.id)).seat !== null) return SEATED_PARTNER_TIER;
  // Une chaise de la maison (S07) se vise comme les autres meubles: la plus proche du regard passe
  // (sinon la paillasse voisine prenait Espace pour une sieste).
  if (t.kind === 'bench' && homeSeats(sim).some((x) => x.id === t.bench)) return TIER.station;
  return t.kind === 'cell' && gardenCellAt(sim, t.cell) !== null ? GARDEN_TIER : TIER[t.kind];
}

function inCone(c: Character, pos: Vec2): boolean {
  const d = distance(c.pos, pos);
  if (d < 0.6) return true;
  const angle = Math.atan2(pos.y - c.pos.y, pos.x - c.pos.x);
  let diff = Math.abs(angle - c.facing) % (2 * Math.PI);
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return diff <= AIM_CONE;
}

/** Une place libre de banc, en cible (avec le point où se lever, devant elle). */
function benchTarget(sim: Sim, seat: { bench: string; slot: number; pos: Vec2 }): Target | null {
  const prop = playerBench(sim, seat.bench);
  if (prop === null) return null;
  const stand = standPlace(prop, seat.slot, sim.content.settings.benches, { x: 0, y: 0, facing: 0 });
  return { kind: 'bench', bench: seat.bench, slot: seat.slot, pos: seat.pos, stand: { x: stand.x, y: stand.y } };
}

/** Assis, Espace ne sert qu'à parler ou à donner (on ne bêche pas depuis un banc). */
const SEATED_VERBS: ReadonlySet<AimVerb> = new Set<AimVerb>(['talk', 'give']);

/** Toutes les cibles à portée de ce personnage (et la case devant lui). */
export function candidates(sim: Sim, c: Character): Target[] {
  const s = sim.content.settings;
  const out: Target[] = [];
  const reach = s.ranges.action;
  if (c.seat === null) {
    // La place libre la plus proche de chaque banc à portée (dans la maison: ses chaises, S07).
    const seen = new Set<string>();
    for (const seat of freeSeatsNear(sim, c.pos, s.benches.sitRange, c)) {
      if (seen.has(seat.bench)) continue;
      seen.add(seat.bench);
      const t = benchTarget(sim, seat);
      if (t !== null) out.push(t);
    }
  }
  for (const v of sim.world.villagers) {
    if (v.visible && distance(c.pos, v.pos) <= s.ranges.talk) out.push({ kind: 'villager', id: v.id, pos: v.pos });
  }
  for (const g of sim.world.groundItems) {
    if (distance(c.pos, g.pos) <= reach) out.push({ kind: 'ground_item', id: g.id, pos: g.pos });
  }
  const beam = sim.world.beam;
  if (beam !== null && !beam.carried && beamDistance(sim, beam, c.pos) <= beamGrabRange(sim, beam)) out.push({ kind: 'beam', pos: beamGrip(sim, beam, c.pos) });
  if (c.placement !== null) out.push({ kind: 'place', pos: { x: c.placement.cell.cx + 0.5, y: c.placement.cell.cy + 0.5 } });
  for (const f of sim.world.furniture) {
    const def = sim.content.items[f.item];
    if (def === undefined) continue;
    const centre = furnitureCentre(sim, f);
    if (distance(c.pos, centre) > reach + 0.5) continue;
    if (def.bed !== null) out.push({ kind: 'bed', furniture: f.id, pos: centre });
    else if (f.window !== undefined && isCurtains(def)) out.push({ kind: 'curtains', furniture: f.id, pos: centre });
    else if (def.station === 'stove') out.push({ kind: 'station', menu: 'stove', furniture: f.id, pos: centre });
    else if (def.storage === 'cellar') out.push({ kind: 'station', menu: 'chest', furniture: f.id, pos: centre });
  }
  for (const id of actPoints(sim)) {
    const at = sim.map.points[id];
    if (at !== undefined && distance(c.pos, at) <= reach) out.push({ kind: 'point', point: id, pos: at });
  }
  const ghost = ghostNear(sim, c);
  if (ghost !== null) out.push({ kind: 'construction', id: ghost.state.id, pos: point(sim, ghost.def.point) });
  for (const t of sim.world.trees) {
    if (!t.felled && distance(c.pos, t.pos) <= reach + 0.3) out.push({ kind: 'tree', id: t.id, pos: t.pos });
  }
  const other = character(sim, partnerOf(c.id));
  if (other.created && distance(c.pos, other.pos) <= reach) out.push({ kind: 'partner', pos: other.pos });
  const hold = holdPlaceNear(sim, c);
  if (hold !== null) out.push({ kind: 'hold', point: hold.point, taken: hold.taken, pos: point(sim, hold.point) });
  const hen = callableHen(sim, c);
  if (hen !== null) out.push({ kind: 'hen', id: hen.id, pos: hen.pos });
  for (const t of breedingTargets(sim, c, hen?.id ?? null)) out.push(t);
  const lantern = lanternTargetNear(sim, c);
  if (lantern !== null) out.push({ kind: 'lantern', place: lantern, pos: point(sim, lantern) });
  // 0.12: l'étal du dimanche, posé sur la place (son point, ou le repli de `marche.json`).
  const pose = stallSetUp(sim.content, sim.world) ? stallPose(sim.content, sim.map) : null;
  if (pose !== null && nearStall(sim.content, sim.map, c.pos)) out.push({ kind: 'point', point: STALL_POINT, pos: pose.centre });
  // 0.12: la sacoche de Lucie sur le banc du quai, tant qu'il y a des plis à prendre.
  const bag = sim.content.settings.mailRound;
  if (bag !== null && mailWaiting(sim, c)) out.push({ kind: 'point', point: MAIL_POINT, pos: point(sim, bag.point) });
  const front = frontPoint(c, { x: 0, y: 0 });
  const cell = { cx: Math.floor(front.x), cy: Math.floor(front.y) };
  out.push({ kind: 'cell', cell, pos: { x: cell.cx + 0.5, y: cell.cy + 0.5 } });
  return out;
}

/** Bêtes, piquets et places de pâture à portée (0.12). */
function breedingTargets(sim: Sim, c: Character, calledHen: string | null): Target[] {
  const out: Target[] = [];
  const pet = calledHen === null ? pettableNear(sim, c) : null;
  if (pet !== null) out.push({ kind: 'animal', id: pet.id, pos: pet.pos });
  const reach = sim.content.settings.ranges.action;
  for (const goat of sim.world.breeding.goats) {
    if (goat.led === null && distance(c.pos, goat.pos) <= GOAT_REACH) out.push({ kind: 'animal', id: goat.id, pos: goat.pos });
    const stake = sim.map.points[goat.stake];
    if (!goat.home && goat.led === null && stake !== undefined && distance(c.pos, stake) <= reach) out.push({ kind: 'stake', goat: goat.id, pos: stake });
  }
  const spot = spotNear(sim, c);
  if (spot !== null) out.push({ kind: 'spot', spot, pos: point(sim, spot) });
  return out;
}

/** La bête visée par une cible (pour l'interface), ou `undefined`. */
function animalOf(t: Target): string | undefined {
  return t.kind === 'animal' ? t.id : t.kind === 'hen' ? t.id : undefined;
}

/** La meilleure cible devant soi (Espace), avec son verbe. */
export function bestTarget(sim: Sim, c: Character): { target: Target; verb: AimVerb | null } | null {
  const front = frontPoint(c, { x: 0, y: 0 });
  const scored: { target: Target; verb: AimVerb | null; tier: number; d: number }[] = [];
  for (const t of candidates(sim, c)) {
    // Un chantier se vise comme le reste, dans le regard (son point peut être derrière soi).
    // Une place de l'échelle à portée se prend sans viser: on y est déjà presque.
    if (t.kind !== 'cell' && t.kind !== 'place' && t.kind !== 'hold' && t.kind !== 'lantern' && !inCone(c, t.pos)) continue;
    const verb = verbOf(sim, c, t);
    if (verb === null && t.kind !== 'cell') continue;
    if (c.seat !== null && verb !== null && !SEATED_VERBS.has(verb)) continue;
    scored.push({ target: t, verb, tier: verb === null ? 99 : tierOf(sim, c, t), d: distance(front, t.pos) });
  }
  // Un habitant ne vole pas la touche à l'objet qu'on vise de plus près (R06: Basile devant son
  // établi, ou à côté de la poutre): l'objet passe avant lui; tourné vers lui, on lui parle.
  const nearestObject = Math.min(...scored.filter((e) => e.verb !== null && OBJECT_KINDS.has(e.target.kind)).map((e) => e.d));
  let best: (typeof scored)[number] | null = null;
  for (const e of scored) {
    if (e.target.kind === 'villager' && e.tier === TIER.villager && nearestObject < e.d) e.tier = TIER.partner;
    if (best === null || e.tier < best.tier || (e.tier === best.tier && e.d < best.d)) best = e;
  }
  return best === null ? null : { target: best.target, verb: best.verb };
}

/**
 * Bêcher l'herbe hors du potager vaut partout où l'on tient la houe: le simple survol du pré ne
 * le met pas en évidence (Espace garderait sinon la case sous une souris oubliée sur le jeu).
 * Le clic y va et bêche toujours, comme avant.
 */
const POINTER_IGNORED: ReadonlySet<AimVerb> = new Set<AimVerb>(['dig']);

/**
 * Ce que survole la souris (R11), s'il y a quelque chose à y faire: la cible et son verbe, tels
 * qu'un clic les prendrait. `null` sans survol, pendant l'aménagement (la souris place alors
 * l'aperçu) ou sur une cible sans geste: la visée revient à la case devant soi.
 */
export function pointerTarget(sim: Sim, c: Character): { click: ClickTarget; target: Target; verb: AimVerb } | null {
  const click = sim.runtime.pointer[c.id];
  if (click === null || c.placement !== null) return null;
  const target = resolveClick(sim, c, click);
  if (target === null) return null;
  const verb = verbOf(sim, c, target);
  return verb === null || POINTER_IGNORED.has(verb) ? null : { click, target, verb };
}

/** Case surlignée (pour le rendu): la cible survolée à la souris, sinon devant le personnage; astuces de visée. */
export function updateAim(sim: Sim, c: Character): void {
  if (c.status !== 'active' || !c.created) {
    if (c.aim !== null) c.aim = null;
    return;
  }
  const pointed = pointerTarget(sim, c);
  const best = pointed === null ? bestTarget(sim, c) : null;
  let aim: AimInfo | null = null;
  const water = pointed === null && holdsRod(sim, c) && c.seat === null ? (c.fishing?.bobber ?? waterAhead(sim, c)) : null;
  if (pointed !== null) {
    const pos = pointed.target.kind === 'cell' ? { x: pointed.target.cell.cx + 0.5, y: pointed.target.cell.cy + 0.5 } : pointed.target.pos;
    aim = { cell: { cx: Math.floor(pos.x), cy: Math.floor(pos.y) }, verb: pointed.verb, blocked: null, source: 'pointer' };
    const animal = animalOf(pointed.target);
    if (animal !== undefined) aim.animal = animal;
  } else if (water !== null) {
    aim = { cell: { cx: Math.floor(water.x), cy: Math.floor(water.y) }, verb: 'fish', blocked: null };
  } else if (best !== null) {
    const pos = best.target.kind === 'cell' ? { x: best.target.cell.cx + 0.5, y: best.target.cell.cy + 0.5 } : best.target.pos;
    aim = { cell: { cx: Math.floor(pos.x), cy: Math.floor(pos.y) }, verb: best.verb, blocked: null };
    const animal = animalOf(best.target);
    if (animal !== undefined) aim.animal = animal;
    if (best.verb !== null) queueHint(sim, c.id, { on: 'near_interactable' });
    if (best.target.kind === 'cell' && sim.world.trees.some((t) => t.felled)) {
      const young = youngTreeAhead(sim, c);
      if (young !== null && treeStage(sim, young) === 'sapling') queueHint(sim, c.id, { on: 'aim_sapling' });
    }
    if (best.target.kind === 'cell') {
      const g = gardenCellAt(sim, best.target.cell);
      const held = heldStack(c);
      if (g !== null) {
        queueHint(sim, c.id, {
          on: 'aim_cell',
          cellState: g.soil,
          tool: toolKindOf(sim, held?.item) ?? held?.item ?? null,
          holding: held === null ? null : (sim.content.items[held.item]?.category ?? null),
        });
      }
    }
  }
  const before = c.aim;
  const same =
    (before === null && aim === null) ||
    (before !== null &&
      aim !== null &&
      before.cell.cx === aim.cell.cx &&
      before.cell.cy === aim.cell.cy &&
      before.verb === aim.verb &&
      before.source === aim.source &&
      before.animal === aim.animal);
  if (!same) {
    c.aim = aim;
    sim.runtime.changed = true;
  }
}

/** La boutique vue de dedans: Odette sert et la boutique est dans ses heures (le comptoir ferme avec elle). */
function insideShopOpen(sim: Sim, c: Character): boolean {
  const grocery = sim.map.buildings[TOWN.grocery];
  return c.inside === TOWN.grocery && grocery !== undefined && buildingOpen(sim, grocery) && shopOpen(sim);
}

/** Ouvre un menu du jeu (déclaré par la simulation à côté d'un comptoir, ou par l'interface). */
export function openMenu(sim: Sim, c: Character, menu: MenuKind | null): void {
  // Quitter le fauteuil du salon efface la proposition reçue et relève.
  if (c.menu === 'salon' && menu !== 'salon') {
    c.hairOffer = null;
    if (c.action.kind === 'sit') c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  }
  c.menu = menu;
  if (c.status === 'active' || c.status === 'menu') c.status = menu === null ? 'active' : 'menu';
  sim.runtime.changed = true;
}

export function goToBed(sim: Sim, c: Character, furnitureId: string): void {
  const f = sim.world.furniture.find((x) => x.id === furnitureId);
  if (f === undefined) return;
  const centre = furnitureCentre(sim, f);
  const other = character(sim, partnerOf(c.id));
  // Lit double: chacun son côté.
  const side = other.bedId === furnitureId ? 0.45 : -0.45;
  const def = sim.content.items[f.item];
  const twoSleepers = (def?.bed?.sleepers ?? 1) > 1;
  c.pos.x = centre.x + (twoSleepers ? side : 0);
  c.pos.y = centre.y;
  c.bedId = furnitureId;
  c.status = 'sleeping';
  c.menu = null;
  c.action = { kind: 'sleep', since: sim.world.tick, duration: 0, target: null };
  bump(sim, 'bed', c.id);
  bump(sim, `bed:${f.item}`, c.id);
  emit(sim, { type: 'went_to_bed', by: c.id });
}

export function getUp(sim: Sim, c: Character): void {
  if (c.status !== 'sleeping') return;
  c.status = 'active';
  c.bedId = null;
  c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  emit(sim, { type: 'got_up', by: c.id });
}

function pickUp(sim: Sim, c: Character, id: string): void {
  const index = sim.world.groundItems.findIndex((g) => g.id === id);
  const g = sim.world.groundItems[index];
  if (g === undefined) return;
  sim.world.groundItems.splice(index, 1);
  const left = addToBag(sim, c, g.item, g.quality, g.count);
  if (left > 0) dropAt(sim, g.pos.x, g.pos.y, g.item, g.quality, left);
  if (left < g.count) rememberPickup(sim, c, g.id, g.pos);
  gesture(sim, c, 'pickup', sim.content.settings.feel.actionSeconds.pickup ?? 0, { x: g.pos.x, y: g.pos.y });
  bump(sim, `picked:${g.item}`, c.id, g.count - left);
  // Condition `picked` sans objet (tour 8): toutes les cueillettes, pas les œufs ni les objets tombés.
  if (sim.content.items[g.item]?.category === 'forage') bump(sim, 'picked', c.id, g.count - left);
  emit(sim, { type: 'picked_up', by: c.id, item: g.item, count: g.count - left });
}

function giveHeld(sim: Sim, c: Character): void {
  const held = heldStack(c);
  if (held === null) return;
  const other = character(sim, partnerOf(c.id));
  const { item, quality, count } = held;
  takeFromBag(c, item, count, quality);
  giveToCharacter(sim, other, item, quality, count);
  emit(sim, { type: 'gave', by: c.id, to: other.id, item, count });
}

/** Exécute le verbe sur la cible. */
export function perform(sim: Sim, c: Character, t: Target, verb: AimVerb): void {
  c.facing = Math.atan2(t.pos.y - c.pos.y, t.pos.x - c.pos.x);
  switch (verb) {
    case 'talk':
      // 0.12: un client qui attend à l'étal, et l'on est derrière: on le sert.
      // Un pli pour lui dans le sac: il le prend (plis de Lucie).
      if (t.kind === 'villager' && !serveBuyer(sim, c, t.id) && !deliverMail(sim, c, t.id)) talkTo(sim, c, t.id);
      return;
    case 'pickup':
      if (t.kind === 'ground_item') pickUp(sim, c, t.id);
      return;
    case 'carry':
      queueHint(sim, c.id, { on: 'near_point', point: 'beam_pickup' });
      return;
    case 'build':
      queueHint(sim, c.id, { on: 'near_construction' });
      return;
    case 'sleep':
      if (t.kind === 'bed') {
        goToBed(sim, c, t.furniture);
        beginNapIfAfternoon(sim, c);
      }
      return;
    case 'open':
      if (t.kind === 'station') openMenu(sim, c, t.menu);
      else if (t.kind === 'point' && t.point === TOWN.window) openBakery(sim, c);
      else if (t.kind === 'point' && t.point === SALON.bench) openSalon(sim, c);
      else if (t.kind === 'point' && t.point === MAIL_POINT) takeMail(sim, c);
      else if (t.kind === 'point' && t.point === CLOTHES.counter) openClothesShop(sim, c);
      else if (t.kind === 'point') {
        const menu = POINT_MENUS[t.point];
        if (menu !== undefined) openMenu(sim, c, menu);
      }
      return;
    case 'refill':
      if (t.kind === 'point') refill(sim, c, t.point);
      return;
    case 'feed':
      feedHens(sim, c);
      return;
    case 'place':
      placeFurniture(sim, c, null, null);
      return;
    case 'sit':
      // Assis, on regarde comme le banc (`sitDown` remplace l'orientation vers la cible).
      if (t.kind === 'bench') sitDown(sim, c, t.bench, t.slot);
      else if (t.kind === 'point' && t.point === SALON.chair) sitAtChair(sim, c);
      return;
    case 'drink':
      drinkChocolate(sim, c);
      return;
    case 'soup':
    case 'supper':
      if (t.kind === 'point') {
        const meal = mealAtPoint(sim, t.point);
        if (meal !== null) orderMeal(sim, c, meal);
      }
      return;
    case 'curtains':
      if (t.kind === 'curtains') toggleCurtains(sim, c, t.furniture);
      return;
    case 'give':
      giveHeld(sim, c);
      return;
    case 'hold':
      if (t.kind === 'hold') takeHold(sim, c, t.point);
      return;
    case 'light':
      if (t.kind === 'lantern') lightLantern(sim, c, t.place);
      return;
    case 'call': {
      const hen = t.kind === 'hen' ? sim.world.hens.find((h) => h.id === t.id) : undefined;
      if (hen !== undefined) callHen(sim, c, hen);
      return;
    }
    case 'chop': {
      const tree = t.kind === 'tree' ? sim.world.trees.find((x) => x.id === t.id) : undefined;
      if (tree !== undefined) chop(sim, c, tree);
      return;
    }
    case 'dig':
      if (t.kind === 'cell') dig(sim, c, t.pos);
      return;
    case 'fish':
      fishAct(sim, c);
      return;
    case 'pet':
      if (t.kind === 'animal') petAnimal(sim, c, t.id);
      return;
    case 'take_straw':
      takeStraw(sim, c);
      return;
    case 'straw':
      strawCoop(sim, c);
      return;
    case 'fill_pail':
      if (t.kind === 'point') fillPail(sim, c, t.point);
      return;
    case 'pour':
      pourPail(sim, c);
      return;
    case 'lead': {
      const goat = t.kind === 'stake' ? sim.world.breeding.goats.find((g) => g.id === t.goat) : undefined;
      if (goat !== undefined) leadGoat(sim, c, goat);
      return;
    }
    case 'plant':
      plantStake(sim, c);
      return;
    case 'brush':
    case 'milk':
    case 'goat_hold': {
      const goat = t.kind === 'animal' ? sim.world.breeding.goats.find((g) => g.id === t.id) : undefined;
      if (goat !== undefined) goatAct(sim, c, goat, verb);
      return;
    }
    case 'till':
    case 'sow':
    case 'water':
    case 'harvest': {
      const g = t.kind === 'cell' ? gardenCellAt(sim, t.cell) : null;
      if (g === null) return;
      const held = heldStack(c);
      if (verb === 'till') till(sim, c, g);
      else if (verb === 'sow' && held !== null) sow(sim, c, g, held.item);
      else if (verb === 'water') water(sim, c, g);
      else harvest(sim, c, g);
      return;
    }
  }
}

/** Espace: agir sur ce qui est devant soi. */
export function actFront(sim: Sim, c: Character): void {
  // Le mythique au bout de la ligne de l'autre: Espace près de lui tend l'épuisette (pêche 0.12).
  if (tryNet(sim, c)) return;
  if (c.seat === null && holdsRod(sim, c) && (c.fishing !== null || waterAhead(sim, c) !== null)) {
    fishAct(sim, c);
    return;
  }
  const best = bestTarget(sim, c);
  if (best !== null && best.verb !== null) {
    perform(sim, c, best.target, best.verb);
    return;
  }
  // Près de la place que l'autre tient déjà: prendre l'autre côté.
  const hold = holdPlaceNear(sim, c);
  if (hold?.taken === true) {
    takeHold(sim, c, hold.point);
    return;
  }
  // Près d'un banc plein, Espace dit pourquoi on ne s'assoit pas (aucune touche morte).
  if (c.seat === null && fullBenchNear(sim, c) !== null) {
    sayIfWritten(sim, c.id, 'bench_full');
    return;
  }
  // La hache devant une souche ou un rejet: on dit pourquoi rien ne se coupe (tour 8, section 9).
  const young = youngTreeAhead(sim, c);
  if (young !== null && toolKindOf(sim, heldStack(c)?.item) === 'axe' && c.seat === null) {
    refuseChop(sim, c, young);
    return;
  }
  // Un plat en main, rien à faire devant soi: on le mange (R04, le pain ne se mangeait qu'au carnet).
  const held = heldStack(c);
  if (held !== null && eatFromBag(sim, c, held.item)) return;
  if (best !== null && takenByPartner(sim, c, best.target, sim.world.tick)) return;
  const reach = sim.content.settings.ranges.action;
  pickupTakenNear(sim, c, (pos) => distance(c.pos, pos) <= reach && inCone(c, pos));
}

/** Rien à faire sur la cible visée au pas `since`: l'autre vient-il de la récolter (SI-01) ? Vrai si c'est dit. */
function takenByPartner(sim: Sim, c: Character, t: Target, since: number): boolean {
  if (t.kind !== 'cell') return false;
  const g = gardenCellAt(sim, t.cell);
  return g !== null && harvestTaken(sim, c, g, since);
}

/**
 * Agir sur la cible d'un clic (`target`, déjà résolue; `null` si elle n'est
 * plus là), comme le ferait la touche. `since`: pas du clic, même pour un
 * clic lointain qui agit à l'arrivée (« Déjà pris » compte depuis le clic).
 */
export function actOnClick(sim: Sim, c: Character, click: ClickTarget, target: Target | null, since: number): void {
  if (target === null) {
    if (click.kind === 'ground_item') pickupTaken(sim, c, click.groundItem, since);
    return;
  }
  const verb = verbOf(sim, c, target);
  if (verb !== null) perform(sim, c, target, verb);
  else if (target.kind === 'tree' && toolKindOf(sim, heldStack(c)?.item) === 'axe') {
    const tree = sim.world.trees.find((x) => x.id === target.id);
    if (tree?.felled === true) refuseChop(sim, c, tree);
  } else takenByPartner(sim, c, target, since);
}

/** L'arbre abattu (souche ou rejet) le plus proche devant soi, à portée de hache, ou `null`. */
export function youngTreeAhead(sim: Sim, c: Character): Tree | null {
  if (isSheltered(c)) return null;
  const reach = sim.content.settings.ranges.action + 0.3;
  let best: Tree | null = null;
  let bestD = Infinity;
  for (const t of sim.world.trees) {
    if (!t.felled) continue;
    const d = distance(c.pos, t.pos);
    if (d <= reach && d < bestD && inCone(c, t.pos)) {
      best = t;
      bestD = d;
    }
  }
  return best;
}

/** Cible d'un clic, traduite en cible de la simulation (avec sa position). */
export function resolveClick(sim: Sim, c: Character, click: ClickTarget): Target | null {
  switch (click.kind) {
    case 'villager': {
      const v = sim.world.villagers.find((x) => x.id === click.villager);
      return !v?.visible ? null : { kind: 'villager', id: v.id, pos: v.pos };
    }
    case 'ground_item': {
      const g = sim.world.groundItems.find((x) => x.id === click.groundItem);
      return g === undefined ? null : { kind: 'ground_item', id: g.id, pos: g.pos };
    }
    case 'tree': {
      const t = sim.world.trees.find((x) => x.id === click.tree);
      return t === undefined ? null : { kind: 'tree', id: t.id, pos: t.pos };
    }
    case 'character':
      return click.character === c.id ? null : { kind: 'partner', pos: character(sim, click.character).pos };
    case 'furniture': {
      const f = sim.world.furniture.find((x) => x.id === click.furniture);
      const def = f === undefined ? undefined : sim.content.items[f.item];
      if (f === undefined || def === undefined) return null;
      const centre = furnitureCentre(sim, f);
      if (def.bed !== null) return { kind: 'bed', furniture: f.id, pos: centre };
      if (f.window !== undefined && isCurtains(def)) return { kind: 'curtains', furniture: f.id, pos: centre };
      if (def.station === 'stove') return { kind: 'station', menu: 'stove', furniture: f.id, pos: centre };
      if (def.storage === 'cellar') return { kind: 'station', menu: 'chest', furniture: f.id, pos: centre };
      // Une chaise, un fauteuil posés (S07): sa place libre la plus proche de soi.
      if (def.seat) {
        const seat = freeSeatsNear(sim, c.pos, Number.POSITIVE_INFINITY, c).find((x) => x.bench === f.id);
        return seat === undefined ? null : benchTarget(sim, seat);
      }
      return null;
    }
    case 'ground': {
      const at = { x: click.x, y: click.y };
      const beam = sim.world.beam;
      if (beam !== null && beamDistance(sim, beam, at) <= 1) return { kind: 'beam', pos: beamGrip(sim, beam, at) };
      for (const id of actPoints(sim)) {
        const p = sim.map.points[id];
        if (p !== undefined && distance(p, at) <= 1.2) return { kind: 'point', point: id, pos: p };
      }
      // 0.12: un clic sur une bête de l'élevage (ou tout près d'elle), après les points d'action.
      const animal = animalAt(sim, at);
      if (animal !== null) return animal;
      const cell = { cx: Math.floor(click.x), cy: Math.floor(click.y) };
      const cellTarget: Target = { kind: 'cell', cell, pos: { x: cell.cx + 0.5, y: cell.cy + 0.5 } };
      // Un clic sur un banc (le sol juste sous ou derrière lui): sa place libre la plus proche,
      // sauf si la case cliquée a son geste (bêcher au pied du banc, comme à la touche).
      if (verbOf(sim, c, cellTarget) !== null) return cellTarget;
      const ghost = ghostAt(sim, at, GHOST_CLICK_RADIUS);
      if (ghost !== null) return { kind: 'construction', id: ghost.state.id, pos: point(sim, ghost.def.point) };
      const seat = freeSeatsNear(sim, at, BENCH_CLICK_RADIUS, c)[0];
      return (seat === undefined ? null : benchTarget(sim, seat)) ?? cellTarget;
    }
  }
}

/** La bête la plus proche d'un point cliqué (0,6 m au plus), en cible. */
function animalAt(sim: Sim, at: Vec2): Target | null {
  let best: Target | null = null;
  let bestD = 0.6;
  const b = sim.world.breeding;
  const all: { id: string; pos: Vec2 }[] = [...sim.world.hens, ...b.chicks, ...b.goats.filter((g) => g.led === null)];
  if (b.rooster !== null) all.push(b.rooster);
  for (const a of all) {
    const d = distance(a.pos, at);
    if (d <= bestD) {
      best = { kind: 'animal', id: a.id, pos: a.pos };
      bestD = d;
    }
  }
  return best;
}

/** Portée à laquelle on agit sur une cible. */
export function reachFor(sim: Sim, t: Target): number {
  const r = sim.content.settings.ranges;
  if (t.kind === 'bench') return sim.content.settings.benches.sitRange;
  return t.kind === 'villager' ? r.talk - 0.3 : t.kind === 'beam' && sim.world.beam !== null ? beamGrabRange(sim, sim.world.beam) - 0.3 : r.action;
}

export function nearPointFor(sim: Sim, c: Character, id: string): boolean {
  return nearPoint(sim, c, id, sim.content.settings.ranges.action);
}
