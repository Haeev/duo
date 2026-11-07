/**
 * Système de l'aménagement, chez l'hôte: achats, livraison du lendemain matin, travaux des
 * extensions, brocante du lundi, pièce tenue en fantôme, port à deux. Toute demande est revérifiée
 * ici (portée, prix, palier, règles de pose); un refus part en `refused` avec sa phrase.
 */
import type { Content } from '../donnees/charger';
import type { PlacedFurniture, PlayerIndex, World } from '../etat/monde';
import type { Intent } from '../simulation/entrees';
import type { SimContext } from '../simulation/systemes';
import { orientSeat } from './assises';
import { CARTON_HEAVY, CARTON_SMALL, isCovering } from './donnees';
import { economy } from './economie';
import type { Held, Piece, Pose3 } from './etat';
import { roomOpen } from './extensions';
import {
  isCarrying,
  carriedFurniture,
  handlesOf,
  nearestHandle,
  otherPlayer,
  poseFree,
  snapCarriers,
  stepCarry,
  turnCarry,
} from './port';
import { checkPlacement, countsInLimit, footprintOf, overlaps } from './regles';

type ArrangementIntent = Extract<Intent, { type: `amenagement-${string}` }>;

const REACH_TOLERANCE = 0.4;
const SERVICE_REFUSAL = 'Le café est ouvert : on aménage avant l’ouverture ou après la fermeture.';

function refuse(sim: SimContext, player: PlayerIndex, reason: string): void {
  sim.emit({ type: 'refused', player, reason: reason.slice(0, 80) });
}

function newId(world: World, prefix: string): string {
  return `${prefix}-${world.arrangement.nextFurnitureId++}`;
}

function isHeavy(content: Content, type: string): boolean {
  return content.furniture.get(type)?.carry === 'two';
}

function distance(world: World, player: PlayerIndex, x: number, z: number): number {
  const p = world.players[player];
  return Math.hypot(p.x - x, p.z - z);
}

// ---------------------------------------------------------------------------------------------
// Prix et achats

/** Prix d'un article ou d'une extension, revêtements comptés par mur ou par m² de la pièce. */
export function priceOf(
  content: Content,
  world: World,
  id: string,
  room: string | null,
): number | null {
  const ext = content.arrangement.extensions.get(id);
  if (ext !== undefined) return ext.price;
  const item = content.arrangement.items.get(id);
  if (item === undefined) return null;
  let price = item.price;
  if (isCovering(item)) {
    const r = content.arrangement.rooms.find((x) => x.id === room);
    if (r === undefined) return null;
    price =
      item.priceUnit === 'm2'
        ? Math.round(item.price * r.surfaceM2)
        : item.price * Math.max(1, r.walls);
  }
  if (item.unlock.kind === 'brocante') price *= 1 - content.arrangement.brocante.discount;
  const off = economy().discount?.(world, item) ?? 0;
  return Math.round(price * (1 - Math.max(0, Math.min(1, off))));
}

/** Pourquoi un article ne s'achète pas maintenant, ou `null`. */
export function purchaseRefusal(
  content: Content,
  world: World,
  id: string,
  room: string | null,
): string | null {
  const eco = economy();
  const ext = content.arrangement.extensions.get(id);
  if (ext !== undefined) {
    if (world.arrangement.extensions.includes(id)) return 'C’est déjà ouvert.';
    if (world.arrangement.works.some((w) => w.extension === id))
      return 'Les travaux sont déjà lancés.';
    if (!eco.tierOpen(world, content, ext.tier)) return 'Pas encore : il faut plus de réputation.';
  } else {
    const item = content.arrangement.items.get(id);
    if (item === undefined) return 'Article inconnu.';
    if (item.unlock.kind === 'regular' || item.unlock.kind === 'event')
      return 'Cette pièce ne s’achète pas : elle se mérite.';
    if (item.unlock.kind === 'tier' && !eco.tierOpen(world, content, item.unlock.tier))
      return 'Pas encore : il faut plus de réputation.';
    if (item.unlock.kind === 'brocante' && !world.arrangement.brocante.items.includes(id))
      return 'Pas à la brocante cette semaine.';
    if (isCovering(item)) {
      const r = content.arrangement.rooms.find((x) => x.id === room);
      if (r === undefined || !roomOpen(world, r.extension) || r.outdoor)
        return 'Choisis une pièce ouverte.';
      if (item.placement === 'wall_cover' && r.walls === 0)
        return 'Cette pièce n’a pas de murs à peindre.';
    }
  }
  const price = priceOf(content, world, id, room);
  if (price === null) return 'Article inconnu.';
  if (price > eco.available(world)) return `Pas assez dans la caisse : il faut ${price} €.`;
  return null;
}

function buy(
  sim: SimContext,
  player: PlayerIndex,
  id: string,
  room: string | null,
  agreed: boolean,
): void {
  const { content, world } = sim;
  const refusal = purchaseRefusal(content, world, id, room);
  if (refusal !== null) {
    refuse(sim, player, refusal);
    return;
  }
  const price = priceOf(content, world, id, room) ?? 0;
  const eco = economy();
  if (!agreed && eco.needsAgreement(world, content, price)) {
    if (world.arrangement.proposal !== null) {
      refuse(sim, player, 'Une proposition attend déjà sa réponse.');
      return;
    }
    world.arrangement.proposal = { player, item: id, room, price };
    sim.emit({ type: 'amenagement-proposition', player, item: id, price, answer: null });
    return;
  }
  eco.spend(sim, price, id, player);
  const ext = content.arrangement.extensions.get(id);
  if (ext !== undefined) {
    world.arrangement.works.push({ extension: id, readyDay: world.clientele.day + ext.nights });
    sim.emit({ type: 'amenagement-extension', extension: id, state: 'travaux' });
    sim.emit({ type: 'amenagement-achat', player, item: id, price, delivery: 'travaux' });
    return;
  }
  const item = content.arrangement.items.get(id);
  if (item === undefined) return;
  if (isCovering(item) && room !== null) {
    // Peinture, papier peint, sol: appliqués tout de suite (Gaby passe pendant la nuit).
    if (item.placement === 'wall_cover') world.arrangement.walls[room] = id;
    else world.arrangement.floors[room] = id;
    sim.emit({ type: 'amenagement-achat', player, item: id, price, delivery: 'direct' });
    return;
  }
  if (item.unlock.kind === 'brocante')
    world.arrangement.brocante.items = world.arrangement.brocante.items.filter((x) => x !== id);
  world.arrangement.orders.push({
    piece: { id: newId(world, 'piece'), type: id, worn: false },
    day: world.clientele.day,
  });
  sim.emit({
    type: 'amenagement-achat',
    player,
    item: id,
    price,
    delivery: isHeavy(content, id) ? 'carton-lourd' : 'carton',
  });
}

// ---------------------------------------------------------------------------------------------
// Matin: livraisons, travaux, brocante

/** Une place libre pour un carton dans les zones de livraison de la cour. */
export function deliverySpot(
  content: Content,
  world: World,
  type: string,
): { x: number; z: number } | null {
  const t = content.furniture.get(type);
  if (t === undefined) return null;
  const [w, d] = t.footprint;
  const step = content.arrangement.rules.grid;
  for (const [ax, az, aw, ad] of content.arrangement.delivery.areas) {
    for (let z = az + d / 2; z <= az + ad - d / 2 + 1e-6; z += step) {
      for (let x = ax + aw - w / 2; x >= ax + w / 2 - 1e-6; x -= step) {
        const fp = footprintOf(t, x, z, 0);
        const taken = world.furniture.some((f) => {
          const ft = content.furniture.get(f.type);
          return (
            ft !== undefined &&
            f.y < 0.05 &&
            overlaps(fp, footprintOf(ft, f.x, f.z, f.rotDeg), 0.05)
          );
        });
        // Un gros carton laisse la place de ses deux porteurs (rien ne se coince contre la clôture).
        const free =
          t.carry !== 'two' ||
          poseFree(content, world, { id: '__livraison__', type, x, z, y: 0, rotDeg: 0 }, x, z, 0);
        if (!taken && free) return { x, z };
      }
    }
  }
  return null;
}

function addCarton(content: Content, world: World, piece: Piece): boolean {
  const type = isHeavy(content, piece.type) ? CARTON_HEAVY : CARTON_SMALL;
  const spot = deliverySpot(content, world, type);
  if (spot === null) return false;
  const id = newId(world, 'carton');
  world.furniture.push({ id, type, x: spot.x, z: spot.z, y: 0, rotDeg: 0 });
  world.arrangement.cartons.push({ furniture: id, piece });
  return true;
}

function deliver(sim: SimContext, day: number): void {
  const { content, world } = sim;
  const waiting: typeof world.arrangement.orders = [];
  let cartons = 0;
  let heavy = 0;
  for (const order of world.arrangement.orders) {
    if (order.day >= day) {
      waiting.push(order);
      continue;
    }
    if (addCarton(content, world, order.piece)) {
      cartons++;
      if (isHeavy(content, order.piece.type)) heavy++;
    } else waiting.push(order);
  }
  world.arrangement.orders = waiting;
  if (cartons > 0 || waiting.some((o) => o.day < day))
    sim.emit({
      type: 'amenagement-livraison',
      cartons,
      heavy,
      waiting: waiting.filter((o) => o.day < day).length,
    });
}

function openExtension(sim: SimContext, id: string): void {
  const { content, world } = sim;
  const ext = content.arrangement.extensions.get(id);
  if (ext === undefined || world.arrangement.extensions.includes(id)) return;
  world.arrangement.extensions.push(id);
  const removed = new Set(ext.works.removeFurniture);
  // Les affaires de Simone partent; rien de ce qui était dessus ne se perd (réserve).
  world.furniture = world.furniture.filter((f) => !removed.has(f.id));
  for (const spec of ext.works.furniture) {
    if (world.furniture.some((f) => f.id === spec.id)) continue;
    world.furniture.push({ ...spec, y: 0 });
  }
  for (const spec of ext.works.furniture) {
    const f = world.furniture.find((x) => x.id === spec.id);
    if (f !== undefined && content.furniture.get(f.type)?.kind === 'seat')
      f.rotDeg = orientSeat(
        f,
        world.furniture,
        content.furniture,
        content.settings.seating.tableReach,
      );
  }
  sim.emit({ type: 'amenagement-extension', extension: id, state: 'ouverte' });
}

function drawBrocante(sim: SimContext, day: number): void {
  const { content, world } = sim;
  const pool = [...content.arrangement.items.values()]
    .filter((i) => i.unlock.kind === 'brocante')
    .map((i) => i.id);
  const n = Math.min(pool.length, content.arrangement.brocante.piecesPerMonday);
  const picked: string[] = [];
  while (picked.length < n && pool.length > 0) {
    const k = Math.floor(sim.random.next() * pool.length);
    const [id] = pool.splice(k, 1);
    if (id !== undefined) picked.push(id);
  }
  world.arrangement.brocante = { day, items: picked };
  sim.emit({ type: 'amenagement-brocante', items: picked.length });
}

function morning(sim: SimContext, day: number): void {
  const { world } = sim;
  for (const w of world.arrangement.works.filter((x) => x.readyDay <= day))
    openExtension(sim, w.extension);
  world.arrangement.works = world.arrangement.works.filter((x) => x.readyDay > day);
  deliver(sim, day);
  // Le jour 1 est un lundi (démo, section 4): brocante les jours 1, 8, 15.
  if ((day - 1) % 7 === 0) drawBrocante(sim, day);
}

/** Front d'un objet au cap `rotDeg` (0 = +z, 90 = +x). */
function front(rotDeg: number): { x: number; z: number } {
  const a = (rotDeg * Math.PI) / 180;
  return { x: Math.sin(a), z: Math.cos(a) };
}

function initialize(sim: SimContext): void {
  const { content, world } = sim;
  const a = world.arrangement;
  a.initialized = true;
  a.lastDay = world.clientele.day;
  for (const f of world.furniture) {
    const info = content.arrangement.pieces.get(f.type);
    if (info?.worn === true && !a.worn.includes(f.id)) a.worn.push(f.id);
  }
  for (const p of content.arrangement.startPieces) {
    const type = content.furniture.get(p.item);
    if (type === undefined) continue;
    const id = newId(world, 'piece');
    let { x, z } = p.at;
    if (p.at.kind === 'wall') {
      const f = front(p.at.rotDeg);
      x += (f.x * type.footprint[1]) / 2;
      z += (f.z * type.footprint[1]) / 2;
    }
    world.furniture.push({ id, type: p.item, x, z, y: p.at.y, rotDeg: p.at.rotDeg });
    if (p.at.support !== undefined) a.supports.push({ piece: id, support: p.at.support });
    if (p.worn === true) a.worn.push(id);
  }
  if ((a.lastDay - 1) % 7 === 0) drawBrocante(sim, a.lastDay);
}

// ---------------------------------------------------------------------------------------------
// Prendre, poser, ranger

function poseOf(f: PlacedFurniture): Pose3 {
  return { x: f.x, z: f.z, y: f.y, rotDeg: f.rotDeg };
}

/** Les objets de décoration posés sur `support` vont en réserve (rien ne flotte). */
function clearSupport(world: World, support: string): void {
  const a = world.arrangement;
  const on = new Set(a.supports.filter((s) => s.support === support).map((s) => s.piece));
  if (on.size === 0) return;
  for (const f of world.furniture.filter((x) => on.has(x.id)))
    a.stock.push({ id: f.id, type: f.type, worn: a.worn.includes(f.id) });
  world.furniture = world.furniture.filter((x) => !on.has(x.id));
  a.supports = a.supports.filter((s) => !on.has(s.piece) && s.support !== support);
  a.worn = a.worn.filter((id) => !on.has(id));
}

function hasObjects(world: World, furniture: string): boolean {
  return world.objects.some((o) => o.at.kind === 'slot' && o.at.furniture === furniture);
}

/** Pourquoi ce meuble ne se prend pas, ou `null`. */
export function takeRefusal(
  content: Content,
  world: World,
  player: PlayerIndex,
  f: PlacedFurniture,
): string | null {
  const type = content.furniture.get(f.type);
  if (type === undefined || type.fixed || type.carry === 'none')
    return 'Ce meuble ne se déplace pas.';
  if (world.arrangement.held[player] !== null) return 'Tu tiens déjà quelque chose.';
  if (hasObjects(world, f.id)) return 'Débarrasse d’abord : il y a quelque chose dessus.';
  if (economy().occupied?.(world, f.id) === true) return 'Un client est assis à cette table.';
  return null;
}

function take(sim: SimContext, player: PlayerIndex, furnitureId: string): void {
  const { content, world } = sim;
  const a = world.arrangement;
  const f = world.furniture.find((x) => x.id === furnitureId);
  if (f === undefined) return;
  if (distance(world, player, f.x, f.z) > content.arrangement.rules.reach + REACH_TOLERANCE) {
    refuse(sim, player, 'Trop loin');
    return;
  }
  // Rejoindre une charge qui attend son second porteur.
  if (a.carry !== null && a.carry.furniture === f.id) {
    if (a.carry.handles[player] !== null) return;
    const other = a.carry.handles[otherPlayer(player)];
    const side: 0 | 1 = other === 0 ? 1 : 0;
    const free = handlesOf(content, f)[side];
    const me = world.players[player];
    if (Math.hypot(free.x - me.x, free.z - me.z) > content.arrangement.carry.grabReach) {
      refuse(sim, player, 'Prends l’autre côté.');
      return;
    }
    a.carry.handles[player] = side;
    snapCarriers(content, world, f);
    sim.emit({ type: 'amenagement-port', player, state: 'depart', furniture: f.id });
    return;
  }
  const refusal = takeRefusal(content, world, player, f);
  if (refusal !== null) {
    refuse(sim, player, refusal);
    return;
  }
  const type = content.furniture.get(f.type);
  if (type?.carry === 'two') {
    if (a.carry !== null) {
      refuse(sim, player, 'Une autre charge est déjà portée.');
      return;
    }
    const h = nearestHandle(content, f, world.players[player].x, world.players[player].z);
    if (h.distance > content.arrangement.carry.grabReach) {
      refuse(sim, player, 'Approche-toi d’un bout pour le saisir.');
      return;
    }
    clearSupport(world, f.id);
    a.carry = { furniture: f.id, handles: player === 0 ? [h.side, null] : [null, h.side] };
    snapCarriers(content, world, f);
    sim.emit({ type: 'amenagement-port', player, state: 'attente', furniture: f.id });
    return;
  }
  const carton = a.cartons.find((c) => c.furniture === f.id);
  world.furniture = world.furniture.filter((x) => x.id !== f.id);
  if (carton !== undefined) {
    a.cartons = a.cartons.filter((c) => c !== carton);
    a.held[player] = {
      piece: carton.piece,
      from: { kind: 'carton', carton: f.id, pose: poseOf(f) },
    };
    sim.emit({
      type: 'amenagement-geste',
      player,
      gesture: 'deballage',
      furniture: f.id,
      item: carton.piece.type,
    });
    return;
  }
  clearSupport(world, f.id);
  const support = a.supports.find((s) => s.piece === f.id)?.support ?? null;
  a.supports = a.supports.filter((s) => s.piece !== f.id);
  const worn = a.worn.includes(f.id);
  a.worn = a.worn.filter((id) => id !== f.id);
  a.held[player] = {
    piece: { id: f.id, type: f.type, worn },
    from: { kind: 'placed', pose: poseOf(f), support },
  };
  sim.emit({ type: 'amenagement-geste', player, gesture: 'prise', furniture: f.id, item: f.type });
}

function place(
  sim: SimContext,
  player: PlayerIndex,
  piece: Piece,
  at: Pose3,
  support: string | null,
): boolean {
  const { content, world } = sim;
  const verdict = checkPlacement(
    content,
    world,
    { type: piece.type, ...at, support },
    new Set(),
    piece.id,
  );
  if (!verdict.ok) {
    refuse(sim, player, verdict.reason);
    return false;
  }
  for (const r of verdict.reorient) {
    const f = world.furniture.find((x) => x.id === r.id);
    if (f !== undefined) f.rotDeg = r.rotDeg;
  }
  world.furniture.push({
    id: piece.id,
    type: piece.type,
    x: at.x,
    z: at.z,
    y: at.y,
    rotDeg: verdict.rotDeg,
  });
  const a = world.arrangement;
  if (support !== null) a.supports.push({ piece: piece.id, support });
  if (piece.worn) a.worn.push(piece.id);
  sim.emit({
    type: 'amenagement-geste',
    player,
    gesture: 'pose',
    furniture: piece.id,
    item: piece.type,
  });
  return true;
}

/** Pose de la charge portée à deux, là où elle est (un gros carton se déballe en son meuble). */
function placeCarry(sim: SimContext, player: PlayerIndex): void {
  const { content, world } = sim;
  const a = world.arrangement;
  const f = carriedFurniture(world);
  if (a.carry === null || f === undefined) return;
  const carton = a.cartons.find((c) => c.furniture === f.id);
  const type = carton?.piece.type ?? f.type;
  const verdict = checkPlacement(
    content,
    world,
    { type, x: f.x, z: f.z, y: 0, rotDeg: f.rotDeg, support: null },
    new Set([f.id]),
    carton?.piece.id ?? f.id,
  );
  if (!verdict.ok) {
    refuse(sim, player, verdict.reason);
    return;
  }
  for (const r of verdict.reorient) {
    const g = world.furniture.find((x) => x.id === r.id);
    if (g !== undefined) g.rotDeg = r.rotDeg;
  }
  if (carton !== undefined) {
    world.furniture = world.furniture.filter((x) => x.id !== f.id);
    world.furniture.push({
      id: carton.piece.id,
      type,
      x: f.x,
      z: f.z,
      y: 0,
      rotDeg: verdict.rotDeg,
    });
    if (carton.piece.worn) a.worn.push(carton.piece.id);
    a.cartons = a.cartons.filter((c) => c !== carton);
  } else f.rotDeg = verdict.rotDeg;
  a.carry = null;
  sim.emit({
    type: 'amenagement-port',
    player,
    state: 'pose',
    furniture: carton?.piece.id ?? f.id,
  });
}

function stash(sim: SimContext, player: PlayerIndex, furnitureId: string | null): void {
  const { content, world } = sim;
  const a = world.arrangement;
  const held = a.held[player];
  if (furnitureId === null) {
    if (held === null) return;
    a.stock.push(held.piece);
    a.held[player] = null;
    a.ghosts[player] = null;
    sim.emit({
      type: 'amenagement-geste',
      player,
      gesture: 'rangement',
      furniture: held.piece.id,
      item: held.piece.type,
    });
    return;
  }
  const f = world.furniture.find((x) => x.id === furnitureId);
  if (f === undefined) return;
  if (a.carry?.furniture === f.id) {
    refuse(sim, player, 'Posez-le d’abord.');
    return;
  }
  if (distance(world, player, f.x, f.z) > content.arrangement.rules.reach + REACH_TOLERANCE) {
    refuse(sim, player, 'Trop loin');
    return;
  }
  const type = content.furniture.get(f.type);
  if (type === undefined || type.fixed || type.carry === 'none') {
    refuse(sim, player, 'Ce meuble ne se range pas.');
    return;
  }
  if (hasObjects(world, f.id)) {
    refuse(sim, player, 'Débarrasse d’abord : il y a quelque chose dessus.');
    return;
  }
  if (economy().occupied?.(world, f.id) === true) {
    refuse(sim, player, 'Un client est assis à cette table.');
    return;
  }
  clearSupport(world, f.id);
  const carton = a.cartons.find((c) => c.furniture === f.id);
  world.furniture = world.furniture.filter((x) => x.id !== f.id);
  a.supports = a.supports.filter((s) => s.piece !== f.id);
  if (carton !== undefined) {
    a.cartons = a.cartons.filter((c) => c !== carton);
    a.stock.push(carton.piece);
  } else {
    a.stock.push({ id: f.id, type: f.type, worn: a.worn.includes(f.id) });
    a.worn = a.worn.filter((id) => id !== f.id);
  }
  sim.emit({
    type: 'amenagement-geste',
    player,
    gesture: 'rangement',
    furniture: f.id,
    item: carton?.piece.type ?? f.type,
  });
}

function cancel(sim: SimContext, player: PlayerIndex): void {
  const { world } = sim;
  const a = world.arrangement;
  const held = a.held[player];
  if (held === null) return;
  a.held[player] = null;
  a.ghosts[player] = null;
  if (held.from.kind === 'placed') {
    const ok = place(sim, player, held.piece, held.from.pose, held.from.support);
    if (!ok) a.stock.push(held.piece);
  } else if (held.from.kind === 'carton') {
    world.furniture.push({ id: held.from.carton, type: CARTON_SMALL, ...held.from.pose });
    a.cartons.push({ furniture: held.from.carton, piece: held.piece });
  } else a.stock.push(held.piece);
  sim.emit({
    type: 'amenagement-geste',
    player,
    gesture: 'annulation',
    furniture: held.piece.id,
    item: held.piece.type,
  });
}

function takeOut(sim: SimContext, player: PlayerIndex, pieceId: string): void {
  const { content, world } = sim;
  const a = world.arrangement;
  const piece = a.stock.find((p) => p.id === pieceId);
  if (piece === undefined) return;
  if (a.held[player] !== null) {
    refuse(sim, player, 'Tu tiens déjà quelque chose.');
    return;
  }
  if (isHeavy(content, piece.type)) {
    // Un gros meuble de la réserve revient en carton dans la cour: il se porte à deux.
    if (!addCarton(content, world, piece)) {
      refuse(sim, player, 'Pas de place dans la cour pour le sortir.');
      return;
    }
    a.stock = a.stock.filter((p) => p !== piece);
    refuse(sim, player, 'Il t’attend dans la cour, en carton : il faut être deux.');
    return;
  }
  a.stock = a.stock.filter((p) => p !== piece);
  const held: Held = { piece, from: { kind: 'stock' } };
  a.held[player] = held;
  sim.emit({
    type: 'amenagement-geste',
    player,
    gesture: 'prise',
    furniture: piece.id,
    item: piece.type,
  });
}

function release(sim: SimContext, player: PlayerIndex): void {
  const { world } = sim;
  const a = world.arrangement;
  const carry = a.carry;
  if (carry === null || !isCarrying(world, world.players[player])) return;
  carry.handles[player] = null;
  const f = carriedFurniture(world);
  if (carry.handles[0] === null && carry.handles[1] === null) a.carry = null;
  sim.emit({ type: 'amenagement-port', player, state: 'lache', furniture: f?.id ?? '' });
}

function renovate(sim: SimContext, player: PlayerIndex, furnitureId: string): void {
  const { content, world } = sim;
  const a = world.arrangement;
  const f = world.furniture.find((x) => x.id === furnitureId);
  if (f === undefined || !a.worn.includes(f.id)) {
    refuse(sim, player, 'Ce meuble n’a pas besoin d’être rénové.');
    return;
  }
  const price = content.arrangement.pieces.get(f.type)?.renovationPrice ?? 0;
  if (price > economy().available(world)) {
    refuse(sim, player, `Pas assez dans la caisse : il faut ${price} €.`);
    return;
  }
  economy().spend(sim, price, `renovation:${f.type}`, player);
  a.worn = a.worn.filter((id) => id !== f.id);
  sim.emit({
    type: 'amenagement-geste',
    player,
    gesture: 'renovation',
    furniture: f.id,
    item: f.type,
  });
}

// ---------------------------------------------------------------------------------------------

export function arrangementStep(sim: SimContext): void {
  const { world, content } = sim;
  const a = world.arrangement;
  if (!a.initialized) initialize(sim);
  const day = world.clientele.day;
  if (day > a.lastDay) {
    a.lastDay = day;
    morning(sim, day);
  }
  stepCarry(content, world, sim.inputs, sim.dt);
}

const GESTURES_IN_SERVICE: ReadonlySet<string> = new Set([
  'amenagement-acheter',
  'amenagement-repondre',
  'amenagement-fantome',
  'amenagement-lacher',
  'amenagement-annuler',
]);

const MOVES_FURNITURE: ReadonlySet<string> = new Set([
  'amenagement-prendre',
  'amenagement-poser',
  'amenagement-ranger',
  'amenagement-annuler',
  'amenagement-lacher',
]);

/**
 * Après qu'un meuble a bougé, chaque assise regarde la table la plus proche à portée (règle du
 * client): une table retirée ou déplacée ne laisse aucune chaise dos à sa nouvelle voisine.
 */
export function settleSeats(content: Content, world: World): void {
  const reach = content.settings.seating.tableReach;
  const carried = world.arrangement.carry?.furniture;
  for (const f of world.furniture) {
    const t = content.furniture.get(f.type);
    if (t?.kind !== 'seat' || f.id === carried) continue;
    const r = orientSeat(f, world.furniture, content.furniture, reach);
    if (Math.round(r) === Math.round(f.rotDeg)) continue;
    const turned = footprintOf(t, f.x, f.z, r);
    const blocked = world.furniture.some((g) => {
      if (g.id === f.id || g.y > 0.05) return false;
      const gt = content.furniture.get(g.type);
      return gt?.blocks === true && overlaps(turned, footprintOf(gt, g.x, g.z, g.rotDeg));
    });
    if (!blocked) f.rotDeg = r;
  }
}

export function arrangementIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  if (!intent.type.startsWith('amenagement-')) return;
  applyIntent(sim, player, intent as ArrangementIntent);
  if (MOVES_FURNITURE.has(intent.type)) settleSeats(sim.content, sim.world);
}

function applyIntent(sim: SimContext, player: PlayerIndex, i: ArrangementIntent): void {
  const { world, content } = sim;
  if (!world.arrangement.initialized) initialize(sim);
  if (economy().serviceOpen(world) && !GESTURES_IN_SERVICE.has(i.type)) {
    refuse(sim, player, SERVICE_REFUSAL);
    return;
  }
  switch (i.type) {
    case 'amenagement-acheter':
      buy(sim, player, i.item, i.room, false);
      return;
    case 'amenagement-repondre': {
      const p = world.arrangement.proposal;
      if (p === null || p.player === player) return;
      world.arrangement.proposal = null;
      sim.emit({
        type: 'amenagement-proposition',
        player: p.player,
        item: p.item,
        price: p.price,
        answer: i.accept,
      });
      if (i.accept) buy(sim, p.player, p.item, p.room, true);
      return;
    }
    case 'amenagement-prendre':
      take(sim, player, i.furniture);
      return;
    case 'amenagement-sortir':
      takeOut(sim, player, i.piece);
      return;
    case 'amenagement-poser': {
      const a = world.arrangement;
      if (a.carry !== null && a.carry.handles[player] !== null) {
        placeCarry(sim, player);
        return;
      }
      const held = a.held[player];
      if (held === null) return;
      if (
        distance(world, player, i.at.x, i.at.z) >
        content.arrangement.rules.reach + REACH_TOLERANCE
      ) {
        refuse(sim, player, 'Trop loin');
        return;
      }
      if (place(sim, player, held.piece, i.at, i.at.support)) {
        a.held[player] = null;
        a.ghosts[player] = null;
      }
      return;
    }
    case 'amenagement-annuler':
      cancel(sim, player);
      return;
    case 'amenagement-ranger':
      stash(sim, player, i.furniture);
      return;
    case 'amenagement-lacher':
      release(sim, player);
      return;
    case 'amenagement-tourner': {
      if (!isCarrying(world, world.players[player])) return;
      if (!turnCarry(content, world, i.dir, 15))
        refuse(sim, player, 'Pas la place de tourner ici.');
      return;
    }
    case 'amenagement-renover':
      renovate(sim, player, i.furniture);
      return;
    case 'amenagement-fantome': {
      const held = world.arrangement.held[player];
      world.arrangement.ghosts[player] =
        held === null || i.at === null
          ? null
          : {
              type: held.piece.type,
              pose: { x: i.at.x, z: i.at.z, y: i.at.y, rotDeg: i.at.rotDeg },
              ok: i.ok,
            };
      return;
    }
  }
}

/** Pièce unique gagnée (habitué, événement): rangée dans la réserve, une seule fois. */
export function grantUniquePiece(sim: SimContext, item: string): boolean {
  const { content, world } = sim;
  const a = world.arrangement;
  if (a.uniques.includes(item) || !content.arrangement.items.has(item)) return false;
  a.uniques.push(item);
  a.stock.push({ id: newId(world, 'piece'), type: item, worn: false });
  sim.emit({ type: 'amenagement-unique', item });
  return true;
}

/** Meubles et objets posés qui comptent dans la limite (C6), pour la tablette. */
export function placedCount(content: Content, world: World): number {
  return world.furniture.filter((f) => countsInLimit(content.furniture.get(f.type))).length;
}

export { poseFree };
