/**
 * La maison qui grandit (tour 10, section 4): le cellier et la chambre, bâtis à deux. On commande
 * la charpente à Basile (l'accord de l'autre au-delà de 100 sous); au matin, le site paraît (caisse,
 * éléments fantômes, et pour la chambre la panne faîtière à `beam_pickup`); on dépose planches et
 * clous à la caisse; chaque élément se bâtit en maintenant Agir, ceux qui portent avant ceux qu'ils
 * portent; la panne se porte à deux jusqu'au faîte; la nuit d'après, Basile et Firmin posent les
 * tuiles et percent la porte à la place d'une fenêtre. Une pièce à la fois. Rien ne se perd.
 * Aussi: le grand coffre de chêne, commandé à Basile et livré le lendemain matin.
 */
import type { ControlFrame } from '../etat/actions';
import { HOUSE_BUILDING, type MapRoom } from '../etat/carte';
import { curtainsAt, mapRoomOfBuild } from '../etat/maison';
import type { Beam, Character, CharacterId, ItemStack, RoomState } from '../etat/types';
import type { RoomDef, RoomElementDef } from '../donnees/maison';
import { type Sim, bump, distance, emit, newId, notifyKey, partnerOf, point, say } from './contexte';
import { durationMultiplier, spend } from './besoins';
import { clearDoorway, isCurtains } from './amenagement';
import { storeAtHome } from './rangement';
import { addStack, countInBag, countInStacks, takeFromBag, takeFromStacks } from './sac';
import { POINT } from './ids';

/** Travail en cours sur un élément (dans l'état: l'invité suit la barre, une reprise la garde). */
export interface RoomWork {
  element: string;
  /** 0 à 1. */
  progress: number;
  /** Planches et clous de l'élément déjà pris (caisse, puis sac de qui travaille). */
  paid: boolean;
  workers: CharacterId[];
}

/**
 * `RoomState` et son travail en cours. Le champ `work` manque au contrat de L0 (`etat/types.ts`,
 * au lot L3): il est déclaré ici, facultatif, en attendant d'y être repris.
 */
export type RoomProgress = RoomState & { work?: RoomWork | null };

/** Le grand coffre se commande comme un chantier de Basile (`improvement_pay`), sous cet identifiant. */
export const OAK_CHEST = 'oak_chest';

export function roomDef(sim: Pick<Sim, 'content'>, id: string): RoomDef | undefined {
  return sim.content.home.rooms.find((r) => r.id === id);
}

export function isRoomOrder(sim: Pick<Sim, 'content'>, id: string): boolean {
  return id === OAK_CHEST || roomDef(sim, id) !== undefined;
}

function rawSection(sim: Sim, section: string): Record<string, unknown> | null {
  const raw = sim.content.texts.raw[section];
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null;
}

/** « le cellier », « la chambre » (`textes.rooms`), sinon l'identifiant. */
export function roomName(sim: Sim, id: string): string {
  if (id === OAK_CHEST) return sim.content.items[OAK_CHEST]?.name ?? id;
  const short = id.replace(/^room_/, '');
  const value = rawSection(sim, 'rooms')?.[short];
  return typeof value === 'string' ? value : id;
}

function state(sim: Sim, id: string): RoomProgress | undefined {
  return sim.world.rooms[id];
}

export function roomBuilt(sim: Pick<Sim, 'world'>, id: string): boolean {
  return (sim.world.rooms[id]?.builtDay ?? null) !== null;
}

/** Les deux plans s'ouvrent ensemble (jour 23 et lettre `basile_rooms`, si elle existe dans le courrier). */
export function roomsOpen(sim: Sim): boolean {
  const s = sim.content.settings.rooms;
  if (s === null || sim.world.clock.day < s.opensFromDay) return false;
  if (s.letter === null || sim.content.letters[s.letter] === undefined) return true;
  const letter = s.letter;
  return sim.world.letters.some((l) => l.id === letter);
}

/** La pièce commandée et pas encore à vous, ou `null` (une seule à la fois). */
export function roomInProgress(sim: Sim): RoomDef | null {
  for (const def of sim.content.home.rooms) {
    const s = state(sim, def.id);
    if (s !== undefined && s.ordered !== null && s.builtDay === null) return def;
  }
  return null;
}

/** Le site est là: commandée, et le matin d'après est venu. */
export function siteReady(sim: Sim, id: string): boolean {
  const s = state(sim, id);
  return s !== undefined && s.ordered !== null && s.ordered < sim.world.clock.day && s.builtDay === null;
}

function atWorkbench(sim: Sim, c: Character): boolean {
  const at = sim.map.points[POINT.workbench];
  return c.menu === 'workbench' || (at !== undefined && distance(c.pos, at) <= sim.content.settings.ranges.talk);
}

/** Prix d'une commande à Basile (pièce ou grand coffre), `null` si rien à commander sous ce nom. */
export function orderPrice(sim: Sim, id: string): number | null {
  if (id === OAK_CHEST) return sim.content.settings.storage?.oakChestPrice ?? null;
  return roomDef(sim, id)?.price ?? null;
}

/** Pourquoi on ne peut pas commander (clé de message), ou `null`. */
export function orderProblem(sim: Sim, id: string): string | null {
  if (id === OAK_CHEST) {
    if (sim.content.settings.storage === null || sim.content.items[OAK_CHEST] === undefined) return 'unknown';
    const pending = sim.world.improvements[OAK_CHEST];
    if (pending !== undefined || sim.world.furniture.some((f) => f.item === OAK_CHEST)) return 'oak_chest_done';
    return null;
  }
  const def = roomDef(sim, id);
  if (def === undefined || !roomsOpen(sim)) return 'unknown';
  if ((state(sim, id)?.ordered ?? null) !== null) return 'room_ordered';
  const busy = roomInProgress(sim);
  if (busy !== null && (sim.content.settings.rooms?.oneAtATime ?? true)) return 'room_busy';
  return null;
}

/**
 * Commander à l'établi de Basile (intention `improvement_pay` sous l'identifiant de la pièce ou
 * `oak_chest`): l'argent part tout de suite; au-delà de `bigPurchaseThreshold`, l'autre doit accepter
 * (le refus rend l'argent, `economie.ts`), puis `confirmOrder`.
 */
export function orderAtBasile(sim: Sim, c: Character, id: string): void {
  if (!atWorkbench(sim, c)) return;
  const price = orderPrice(sim, id);
  const problem = orderProblem(sim, id);
  if (price === null || problem === 'unknown') return;
  if (problem !== null) {
    const busy = roomInProgress(sim);
    say(sim, c.id, problem, { room: busy === null ? roomName(sim, id) : roomName(sim, busy.id) });
    return;
  }
  if (sim.world.proposals.some((p) => p.purchase.source === 'improvement' && p.purchase.item === id)) return;
  if (price > sim.world.purse) {
    say(sim, c.id, 'not_enough_money', { missing: price - sim.world.purse });
    return;
  }
  sim.world.purse -= price;
  sim.runtime.changed = true;
  if (price >= sim.content.settings.economy.bigPurchaseThreshold) {
    const proposal = newId(sim, 'o');
    sim.world.proposals = sim.world.proposals.filter((p) => p.by !== c.id);
    sim.world.proposals.push({ id: proposal, by: c.id, purchase: { source: 'improvement', item: id, count: price }, price });
    notifyKey(sim, partnerOf(c.id), 'proposal', 'improvement_proposal', { partner: c.name, name: roomName(sim, id), price }, { proposal });
    emit(sim, { type: 'proposal', by: c.id, proposal });
    return;
  }
  confirmOrder(sim, c, id, price);
}

/** La commande est payée (directement, ou proposition acceptée): Basile prépare pour le matin. */
export function confirmOrder(sim: Sim, c: Character, id: string, paid: number): void {
  if (orderProblem(sim, id) !== null) {
    // Commande devenue impossible entre la proposition et l'accord: l'argent revient.
    sim.world.purse += paid;
    return;
  }
  const day = sim.world.clock.day;
  if (id === OAK_CHEST) sim.world.improvements[OAK_CHEST] = { paid, planks: 0, funded: true, builtDay: null };
  else sim.world.rooms[id] = { ordered: day, crate: [], elementsBuilt: [], beamPlaced: false, builtDay: null };
  sim.runtime.changed = true;
  bump(sim, `ordered:${id}`, c.id);
  say(sim, 'both', 'room_ordered_ok', { room: roomName(sim, id) });
}

/** Le site de la pièce (point de la carte), ou `null`. */
function sitePoint(sim: Sim, def: RoomDef): { x: number; y: number } | null {
  const room = mapRoomOfBuild(sim.map, def.id);
  return room?.build === null || room === null ? null : (sim.map.points[room.build.site] ?? null);
}

function nearSite(sim: Sim, c: Character, def: RoomDef): boolean {
  const at = sitePoint(sim, def);
  return at !== null && distance(c.pos, at) <= sim.content.settings.feel.pointRadius;
}

/** Ce qu'il reste à apporter pour tous les éléments pas encore payés (affiché sur le panneau). */
export function roomStillNeeded(sim: Sim, id: string): ItemStack[] {
  const def = roomDef(sim, id);
  const s = state(sim, id);
  if (def === undefined || s === undefined) return [];
  const need: ItemStack[] = [];
  for (const e of def.elements) {
    if (s.elementsBuilt.includes(e.id) || (s.work?.element === e.id && s.work.paid)) continue;
    for (const input of e.inputs) addStack(need, input.item, 'ordinary', input.count);
  }
  for (const n of need) n.count = Math.max(0, n.count - countInStacks(s.crate, n.item));
  return need.filter((n) => n.count > 0);
}

/**
 * Déposer à la caisse du chantier (n'importe qui): au plus ce que les éléments demandent encore;
 * ce qui est déposé reste à la caisse.
 */
export function roomDeposit(sim: Sim, c: Character, id: string, item: string, count: number): number {
  const def = roomDef(sim, id);
  const s = state(sim, id);
  if (def === undefined || s === undefined || !siteReady(sim, id) || !nearSite(sim, c, def) || count < 1) return 0;
  const wanted = roomStillNeeded(sim, id).find((n) => n.item === item)?.count ?? 0;
  const n = Math.min(count, wanted, countInBag(c, item));
  if (n <= 0) return 0;
  for (const t of takeFromBag(c, item, n)) addStack(s.crate, t.item, t.quality, t.count);
  sim.runtime.changed = true;
  emit(sim, { type: 'deposited', by: c.id, item, count: n });
  return n;
}

/** Éléments qu'on peut bâtir maintenant: supports bâtis, et la panne posée pour ce qui la demande. */
export function buildableElements(sim: Sim, id: string): RoomElementDef[] {
  const def = roomDef(sim, id);
  const s = state(sim, id);
  if (def === undefined || s === undefined || !siteReady(sim, id)) return [];
  return def.elements.filter(
    (e) => !s.elementsBuilt.includes(e.id) && e.requires.every((r) => s.elementsBuilt.includes(r)) && (!e.needsBeam || s.beamPlaced),
  );
}

/** Prend les entrées d'un élément: la caisse d'abord, puis les sacs de ceux qui travaillent. Rien si ça manque. */
function payElement(s: RoomProgress, workers: readonly Character[], e: RoomElementDef): { item: string; count: number }[] {
  const missing: { item: string; count: number }[] = [];
  for (const input of e.inputs) {
    const have = countInStacks(s.crate, input.item) + workers.reduce((n, c) => n + countInBag(c, input.item), 0);
    if (have < input.count) missing.push({ item: input.item, count: input.count - have });
  }
  if (missing.length > 0) return missing;
  for (const input of e.inputs) {
    let left = input.count - takeFromStacks(s.crate, input.item, input.count).reduce((n, t) => n + t.count, 0);
    for (const c of workers) {
      if (left <= 0) break;
      left -= takeFromBag(c, input.item, left).reduce((n, t) => n + t.count, 0);
    }
  }
  return [];
}

/** La panne faîtière de la chambre: posée par terre à `beam_pickup` tant qu'elle n'est pas au faîte. */
function spawnRoomBeam(sim: Sim, def: RoomDef): void {
  const s = state(sim, def.id);
  const room = mapRoomOfBuild(sim.map, def.id);
  if (def.beam === null || s === undefined || s.beamPlaced || room?.build === undefined || room.build === null) return;
  const { world } = sim;
  // Un colis lourd passe avant: la panne attend par terre (le rendu la montre d'après `rooms`).
  if (world.beam !== null) {
    if (world.beam.purpose === 'construction' && world.beam.construction === def.id && !world.beam.carried && world.heavyDeliveries.length > 0) world.beam = null;
    return;
  }
  if (world.heavyDeliveries.length > 0) return;
  const from = sim.map.points[def.beam.from];
  if (from === undefined) return;
  const f = room.build.footprint;
  const to = { x: f.x + f.w / 2, y: f.y + f.h / 2 };
  world.beam = {
    item: def.beam.item,
    purpose: 'construction',
    construction: def.id,
    contents: null,
    to,
    route: null,
    leg: 0,
    pos: { x: from.x, y: from.y },
    prev: { x: from.x, y: from.y },
    facing: Math.atan2(to.y - from.y, to.x - from.x),
    carried: false,
    holders: [],
  };
  sim.runtime.dynamicDirty = true;
  sim.runtime.changed = true;
}

/** La charge posée était la panne d'une pièce (appelé par le pas après `updateBeam`). */
export function roomBeamPlaced(sim: Sim, beam: Beam): void {
  if (beam.purpose !== 'construction' || beam.construction === null) return;
  const s = state(sim, beam.construction);
  if (s === undefined || roomDef(sim, beam.construction) === undefined) return;
  s.beamPlaced = true;
  sim.runtime.changed = true;
  bump(sim, `beam_placed:${beam.construction}`, null);
}

/** Ce qui a déjà été dit pendant ce maintien d'Agir (une fois par maintien), par simulation. */
const notifiedBySim = new WeakMap<Sim['runtime'], Record<CharacterId, string | null>>();

function notifiedOf(sim: Sim): Record<CharacterId, string | null> {
  let n = notifiedBySim.get(sim.runtime);
  if (n === undefined) {
    n = { p1: null, p2: null };
    notifiedBySim.set(sim.runtime, n);
  }
  return n;
}

/**
 * Travail maintenu sur le chantier de la pièce (à chaque pas de jour): un seul élément à la fois, le
 * premier qu'on peut bâtir; deux fois plus vite à deux (`building.twoPlayersSpeedMultiplier`).
 */
export function updateRoomWork(sim: Sim, frames: Partial<Record<CharacterId, ControlFrame>>, dt: number): void {
  const def = roomInProgress(sim);
  if (def === null || !siteReady(sim, def.id)) return;
  spawnRoomBeam(sim, def);
  const s = state(sim, def.id);
  if (s === undefined) return;
  const holdNotified = notifiedOf(sim);
  const workers: Character[] = [];
  for (const c of sim.world.characters) {
    const holding = frames[c.id]?.actHeld === true && c.status === 'active' && c.crafting === null && nearSite(sim, c, def);
    if (!holding || sim.runtime.holdForTool[c.id]) {
      holdNotified[c.id] = null;
      continue;
    }
    workers.push(c);
  }
  if (s.work !== undefined && s.work !== null) s.work.workers = [];
  if (workers.length === 0) return;
  let work = s.work ?? null;
  if (work === null) {
    const next = buildableElements(sim, def.id)[0];
    if (next === undefined) {
      const waiting = def.elements.find((e) => e.needsBeam && !s.beamPlaced && !s.elementsBuilt.includes(e.id));
      for (const c of workers) {
        if (waiting === undefined || holdNotified[c.id] === 'beam') continue;
        holdNotified[c.id] = 'beam';
        say(sim, c.id, 'room_beam', { partner: sim.world.characters.find((x) => x.id === partnerOf(c.id))?.name ?? '' });
      }
      return;
    }
    work = { element: next.id, progress: 0, paid: false, workers: [] };
    s.work = work;
  }
  const element = def.elements.find((e) => e.id === work.element);
  if (element === undefined) {
    s.work = null;
    return;
  }
  if (!work.paid) {
    const missing = payElement(s, workers, element);
    if (missing.length > 0) {
      for (const c of workers) {
        if (holdNotified[c.id] === 'missing') continue;
        holdNotified[c.id] = 'missing';
        say(sim, c.id, 'room_bring', { planks: missing.find((m) => m.item === 'plank')?.count ?? 0, nails: missing.find((m) => m.item === 'nail')?.count ?? 0 });
      }
      return;
    }
    work.paid = true;
  }
  const speed = workers.length >= 2 ? sim.content.settings.building.twoPlayersSpeedMultiplier : 1;
  const slowest = Math.max(...workers.map((w) => durationMultiplier(sim, w)));
  work.progress = Math.min(1, work.progress + (dt * speed) / (element.seconds * slowest));
  work.workers = workers.map((w) => w.id);
  const target = sitePoint(sim, def);
  for (const c of workers) {
    if (c.action.kind !== 'hammer') {
      c.action = { kind: 'hammer', since: sim.world.tick, duration: 0, target: target === null ? null : { ...target } };
      emit(sim, { type: 'build_progress', by: c.id, construction: def.id, element: element.id });
    }
    spend(sim, c, 'build_per_second', dt);
  }
  sim.runtime.changed = true;
  if (work.progress >= 1) {
    s.elementsBuilt.push(element.id);
    s.work = null;
    emit(sim, { type: 'element_built', construction: def.id, element: element.id });
    if (s.elementsBuilt.length === def.elements.length) say(sim, 'both', 'room_done_tonight', { room: roomName(sim, def.id) });
  }
}

/** Tous les éléments bâtis (et la panne au faîte): les tuiles se posent la nuit suivante. */
export function roomReadyForNight(sim: Sim, id: string): boolean {
  const def = roomDef(sim, id);
  const s = state(sim, id);
  return def !== undefined && s !== undefined && siteReady(sim, id) && s.elementsBuilt.length === def.elements.length && (def.beam === null || s.beamPlaced);
}

/** La case de la pièce d'où l'on entre, juste devant la porte percée. */
function doorwayCell(room: MapRoom, from: MapRoom): { cx: number; cy: number } | null {
  const door = room.build?.door.cell;
  if (door === undefined) return null;
  const r = from.rect;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const cx = door.cx + dx;
    const cy = door.cy + dy;
    if (cx >= r.x && cy >= r.y && cx < r.x + r.w && cy < r.y + r.h) return { cx, cy };
  }
  return null;
}

/** La nuit a bâti la pièce: tuiles, porte percée à la place de la fenêtre, seuil dégagé. */
function finishRoom(sim: Sim, def: RoomDef): void {
  const s = state(sim, def.id);
  const room = mapRoomOfBuild(sim.map, def.id);
  if (s === undefined || room?.build === undefined || room.build === null) return;
  // Rideaux de la fenêtre qui devient porte: décrochés et rangés (section 6.1).
  const hung = curtainsAt(sim.world, def.doorWindow);
  if (hung !== null) {
    const item = hung.item;
    sim.world.furniture = sim.world.furniture.filter((f) => f.id !== hung.id);
    storeAtHome(sim, item, 'ordinary', 1);
    say(sim, 'both', 'room_curtains_unhooked');
  }
  s.builtDay = sim.world.clock.day;
  s.work = null;
  const from = sim.map.buildings[HOUSE_BUILDING]?.rooms.find((r) => r.id === room.build?.door.from);
  const cell = from === undefined ? null : doorwayCell(room, from);
  if (cell !== null && from !== undefined) {
    for (const item of clearDoorway(sim, cell, from.id)) say(sim, 'both', 'room_moved_item', { item: sim.content.items[item]?.name ?? item });
  }
  const flag = `${def.id}_built`;
  if (!sim.world.flags.includes(flag)) sim.world.flags.push(flag);
  bump(sim, 'room_built', null);
  bump(sim, `room_built:${def.id}`, null);
  sim.runtime.dynamicDirty = true;
  sim.runtime.changed = true;
  notifyKey(sim, 'both', 'message', 'room_built', { room: roomName(sim, def.id) });
}

/** Objets laissés sur l'emprise du site: devant la porte de la maison, au matin du site. */
function clearSite(sim: Sim, def: RoomDef): void {
  const room = mapRoomOfBuild(sim.map, def.id);
  const door = sim.map.points.house_door;
  if (room?.build === undefined || room.build === null || door === undefined) return;
  const f = room.build.footprint;
  for (const g of sim.world.groundItems) {
    if (g.pos.x >= f.x && g.pos.y >= f.y && g.pos.x < f.x + f.w && g.pos.y < f.y + f.h) {
      g.pos = { x: door.x, y: door.y };
      sim.runtime.changed = true;
    }
  }
}

/**
 * Le matin (appelé avec les chantiers de Basile): le site paraît le lendemain de la commande, la pièce
 * est bâtie le lendemain du dernier élément, le grand coffre prend la place du coffre (son contenu
 * aussi: le rangement est commun).
 */
export function morningRooms(sim: Sim): void {
  const day = sim.world.clock.day;
  for (const def of sim.content.home.rooms) {
    const s = state(sim, def.id);
    if (s === undefined || s.ordered === null || s.builtDay !== null) continue;
    if (s.ordered === day - 1) {
      clearSite(sim, def);
      notifyKey(sim, 'both', 'message', 'room_site_ready', { room: roomName(sim, def.id) });
    } else if (roomReadyForNight(sim, def.id) && s.ordered < day - 1) finishRoom(sim, def);
  }
  const oak = sim.world.improvements[OAK_CHEST];
  if (oak !== undefined) {
    const chest = sim.world.furniture.find((f) => sim.content.items[f.item]?.storage === 'cellar' && f.item !== OAK_CHEST && f.item in (sim.content.settings.storage?.cells ?? {}));
    if (chest !== undefined) chest.item = OAK_CHEST;
    else storeOakChestNearDoor(sim);
    // Livré: la commande ne compte pas parmi les chantiers bâtis.
    delete sim.world.improvements.oak_chest;
    sim.runtime.dynamicDirty = true;
    sim.runtime.changed = true;
    notifyKey(sim, 'both', 'message', 'oak_chest_delivered', {});
  }
}

/** Plus de coffre posé (repris dans un sac): le grand coffre attend au pied de la porte, dans la maison. */
function storeOakChestNearDoor(sim: Sim): void {
  const spawn = point(sim, 'house_spawn');
  sim.world.groundItems.push({ id: newId(sim, 'g'), item: OAK_CHEST, quality: 'ordinary', count: 1, pos: { x: spawn.x, y: spawn.y } });
}

/** Une pièce bâtie (conditions des quêtes `room_built`, compteur de l'écran d'étape). */
export function roomsBuilt(sim: Pick<Sim, 'world'>): number {
  return Object.values(sim.world.rooms).filter((r) => r.builtDay !== null).length;
}

/** Pour le lot L3 (`refreshBlockers`): cases murées et porte ouverte de chaque pièce bâtie. */
export function builtRoomCells(sim: Sim): { walls: { cx: number; cy: number }[]; doors: { cx: number; cy: number }[] } {
  const walls: { cx: number; cy: number }[] = [];
  const doors: { cx: number; cy: number }[] = [];
  for (const def of sim.content.home.rooms) {
    const room = mapRoomOfBuild(sim.map, def.id);
    if (!roomBuilt(sim, def.id) || room?.build === undefined || room.build === null) continue;
    const f = room.build.footprint;
    const r = room.rect;
    for (let cy = f.y; cy < f.y + f.h; cy++) {
      for (let cx = f.x; cx < f.x + f.w; cx++) {
        const inside = cx >= r.x && cy >= r.y && cx < r.x + r.w && cy < r.y + r.h;
        if (!inside) walls.push({ cx, cy });
      }
    }
    doors.push({ ...room.build.door.cell });
  }
  return { walls, doors };
}

/** Rideaux posés (meubles accrochés à une fenêtre). */
export function hungCurtains(sim: Sim): number {
  return sim.world.furniture.filter((f) => f.window !== undefined && isCurtains(sim.content.items[f.item])).length;
}
