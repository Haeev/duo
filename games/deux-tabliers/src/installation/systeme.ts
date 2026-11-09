/**
 * Système de l'installation, chez l'hôte (démo v0.3): arrivée devant le rideau baissé, rideau à
 * deux, draps, courrier, ménage, lots de Simone, achats « Pour ouvrir » livrés par Gaby sur le
 * trottoir, appareils posés à leur place, raccord et chauffe de la machine, café d'essai, nuit
 * du lundi et grand jour. Tout est revérifié ici; un refus part en `refused` avec sa phrase.
 */
import { CARTON_HEAVY, CARTON_SMALL } from '../amenagement/donnees';
import { footprintOf, overlaps } from '../amenagement/regles';
import { ctxOf } from '../clientele';
import { addLot, cents, lastGoodDay, nextOpenDay, requestPurchase } from '../clientele/economie';
import type { Content } from '../donnees/charger';
import type { PlacedFurniture, PlayerIndex, World } from '../etat/monde';
import type { Piece } from '../amenagement/etat';
import { collectTicket } from '../service';
import { openTicket, placeFurniture } from '../service/regles';
import type { Intent } from '../simulation/entrees';
import type { SimContext } from '../simulation/systemes';
import { prompt, type InstallationContent, type InstallPurchase } from './donnees';
import type { InstallationState } from './etat';
import {
  appliances,
  installationOf,
  spotFor,
  stationsFromAppliances,
  type InstallSpot,
} from './regles';

/** Client du service pour le café d'essai de Simone (ni payé, ni compté). */
export const TRIAL_CUSTOMER = 'essai-simone';
const REACH_TOLERANCE = 0.4;

/** Fractions de seconde de l'horloge de l'installation (hors état: le domaine ne bouge qu'à la seconde). */
const fractions = new WeakMap<World, number>();

function refuse(sim: SimContext, player: PlayerIndex, reason: string | null): void {
  if (reason !== null && reason !== '')
    sim.emit({ type: 'refused', player, reason: reason.slice(0, 80) });
}

function say(sim: SimContext, text: string): void {
  sim.emit({ type: 'clientele-say', who: 'Simone', text, player: null });
}

/** Une réplique de Simone, une seule fois (`key`). */
function sayOnce(sim: SimContext, i: InstallationState, key: string, text: string): void {
  if (i.said.includes(key)) return;
  i.said.push(key);
  say(sim, text);
}

function startPose(content: Content, id: string): PlacedFurniture | undefined {
  return content.cellStart?.furniture.find((f) => f.id === id);
}

function removeFurniture(world: World, id: string): void {
  world.furniture = world.furniture.filter((f) => f.id !== id);
}

function restoreFurniture(content: Content, world: World, id: string): void {
  const f = startPose(content, id);
  if (f !== undefined && !world.furniture.some((x) => x.id === id)) world.furniture.push({ ...f });
}

// ---------------------------------------------------------------------------------------------
// Arrivée

/** Premier pas d'une maison partie de rien: caisse d'épargne, rien d'autre que les murs. */
function setup(sim: SimContext, ic: InstallationContent, i: InstallationState): void {
  const { world } = sim;
  const s = world.clientele;
  const e = ic.cell.economy;
  // Le loyer du lundi est déjà prélevé (aube du jour 1): on remplace seulement la caisse de départ.
  s.cash += cents(e.startCash) - cents(sim.content.clientele.economy.startCash);
  s.stations = {};
  s.dishes = 0;
  s.stock = {};
  s.lots = {};
  s.slate = [];
  s.startDecor = e.startDecor.map(([id, n, worn]): [string, number, boolean] => [id, n, worn]);
  const sv = world.service;
  sv.clean = { tasse: 0, verre: 0, assiette: 0 };
  sv.stock = {};
  i.lastDay = s.day;
  for (const line of ic.texts.prologue) say(sim, line);
}

// ---------------------------------------------------------------------------------------------
// Achats et livraisons

function purchaseOf(ic: InstallationContent, id: string): InstallPurchase | undefined {
  return ic.purchases.get(id);
}

/** Une place libre pour un carton dans la zone du trottoir. */
function sidewalkSpot(
  content: Content,
  world: World,
  type: string,
  area: readonly [number, number, number, number],
): { x: number; z: number } | null {
  const t = content.furniture.get(type);
  if (t === undefined) return null;
  const [w, d] = t.footprint;
  const [ax, az, aw, ad] = area;
  const step = 0.25;
  for (let z = az + d / 2; z <= az + ad - d / 2 + 1e-6; z += step) {
    for (let x = ax + w / 2; x <= ax + aw - w / 2 + 1e-6; x += step) {
      const fp = footprintOf(t, x, z, 0);
      const taken = world.furniture.some((f) => {
        const ft = content.furniture.get(f.type);
        return (
          ft !== undefined &&
          ft.blocks &&
          f.y < 0.05 &&
          overlaps(fp, footprintOf(ft, f.x, f.z, f.rotDeg), 0.1)
        );
      });
      if (!taken) return { x, z };
    }
  }
  return null;
}

function addCarton(
  sim: SimContext,
  i: InstallationState,
  p: InstallPurchase,
  area: readonly [number, number, number, number],
): boolean {
  const { content, world } = sim;
  if (p.furniture === null) return true;
  const type = p.heavy ? CARTON_HEAVY : CARTON_SMALL;
  const spot = sidewalkSpot(content, world, type, area);
  if (spot === null) return false;
  const a = world.arrangement;
  const id = `carton-${String(a.nextFurnitureId++)}`;
  const piece: Piece = {
    id: `piece-${p.id}-${String(a.nextFurnitureId++)}`,
    type: p.furniture,
    worn: false,
  };
  world.furniture.push({ id, type, x: spot.x, z: spot.z, y: 0, rotDeg: 0 });
  a.cartons.push({ furniture: id, piece });
  i.cartons.push([id, p.id]);
  return true;
}

/** Achats « Pour ouvrir » faits depuis le dernier pas (téléphone ou monde, propositions comprises). */
function takeNewPurchases(sim: SimContext, ic: InstallationContent, i: InstallationState): void {
  const { world } = sim;
  const r = ic.rules;
  for (const [id] of world.clientele.purchases) {
    const p = purchaseOf(ic, id);
    if (p === undefined || i.handled.includes(id)) continue;
    i.handled.push(id);
    i.spent += cents(p.price);
    i.lastActSec = i.sec;
    if (p.price >= r.budgetLineAbove) sayOnce(sim, i, 'budget', ic.texts.budget);
    if (p.exclusive === 'machine') i.machine.model = p.id;
    if (p.lot !== null) i.lots[p.lot] = 'ours';
    if (p.delivery === 'simone') addCarton(sim, i, p, ic.cell.deliveryArea);
    else if (p.delivery === 'gaby') {
      // Une tournée en route l'emporte s'il lui reste plus de `deliveryJoinSec`.
      const next = i.deliveries.find(([, due]) => due - i.sec > r.deliveryJoinSec);
      const first = !i.said.includes('gaby-run');
      const due = next?.[1] ?? i.sec + Math.round(first ? r.deliveryFirstSec : r.deliveryNextSec);
      i.said.push('gaby-run');
      i.deliveries.push([id, due]);
    }
  }
}

function stepDeliveries(sim: SimContext, ic: InstallationContent, i: InstallationState): void {
  const due = i.deliveries.filter(([, at]) => at <= i.sec);
  if (due.length === 0) return;
  let count = 0;
  const waiting: [string, number][] = i.deliveries.filter(([, at]) => at > i.sec);
  for (const [id, at] of due) {
    const p = purchaseOf(ic, id);
    if (p === undefined) continue;
    if (addCarton(sim, i, p, ic.cell.deliveryArea)) count++;
    // Plus de place sur le trottoir: Gaby repasse avec la tournée suivante.
    else waiting.push([id, at + Math.round(ic.rules.deliveryNextSec)]);
  }
  i.deliveries = waiting;
  if (count === 0) return;
  sim.emit({ type: 'installation-delivery', cartons: count });
  sim.emit({
    type: 'installation-message',
    from: 'Gaby',
    text: ic.texts.messages.delivery ?? '',
  });
  if (!i.said.includes('gaby')) {
    i.said.push('gaby');
    sim.emit({ type: 'clientele-say', who: 'Gaby', text: ic.texts.gaby, player: null });
  }
}

/** Rendre un carton fermé à Gaby (ou à Simone): remboursé entier, l'achat se refait. */
function returnCarton(
  sim: SimContext,
  ic: InstallationContent,
  i: InstallationState,
  player: PlayerIndex,
  carton: string,
): void {
  const { world } = sim;
  const entry = i.cartons.find(([c]) => c === carton);
  const p = entry === undefined ? undefined : purchaseOf(ic, entry[1]);
  if (entry === undefined || p === undefined) return;
  const s = world.clientele;
  const price = cents(p.price);
  s.cash += price;
  s.today.spent = Math.max(0, s.today.spent - price);
  const k = s.purchases.findIndex(([id]) => id === p.id);
  if (k >= 0) s.purchases.splice(k, 1);
  i.handled = i.handled.filter((id) => id !== p.id);
  i.spent = Math.max(0, i.spent - price);
  i.cartons = i.cartons.filter(([c]) => c !== carton);
  if (i.machine.model === p.id) i.machine.model = null;
  removeFurniture(world, carton);
  world.arrangement.cartons = world.arrangement.cartons.filter((c) => c.furniture !== carton);
  const seller = p.seller === 'simone' ? 'Simone' : 'Gaby';
  sim.emit({ type: 'installation-gesture', player, gesture: 'return', furniture: carton });
  sim.emit({
    type: 'installation-message',
    from: seller,
    text: (ic.texts.catalog.returned ?? '')
      .replace('{name}', seller)
      .replace('{amount}', `${(price / 100).toFixed(2).replace('.', ',')} €`),
  });
}

// ---------------------------------------------------------------------------------------------
// Appareils et machine

/** Postes de la clientèle: ceux des appareils posés, montés par les achats qui les améliorent. */
function syncStations(sim: SimContext): void {
  const { world, content } = sim;
  const s = world.clientele;
  const base = stationsFromAppliances(content, world);
  const bought: Record<string, number> = {};
  for (const [id] of s.purchases)
    for (const e of content.clientele.purchases.get(id)?.effects ?? []) {
      const [kind, st, level] = e.split(':');
      if (kind === 'poste' && st !== undefined)
        bought[st] = Math.max(bought[st] ?? 0, Number(level ?? 1));
    }
  const next: Record<string, number> = {};
  for (const [st, level] of Object.entries(base)) next[st] = Math.max(level, bought[st] ?? 0);
  for (const [st, level] of Object.entries(s.stations)) {
    // Un poste qui ne dépend d'aucun appareil de l'installation (crêperie, agrumes) reste acquis.
    if (!(st in STATION_KEYS)) next[st] = level;
  }
  if (JSON.stringify(next) !== JSON.stringify(s.stations)) s.stations = next;
}

const STATION_KEYS: Readonly<Record<string, true>> = {
  espresso: true,
  vapeur: true,
  bouilloire: true,
  vitrine: true,
  plan: true,
  frigo: true,
};

function stepMachine(sim: SimContext, ic: InstallationContent, i: InstallationState): void {
  const { world, content } = sim;
  const m = i.machine;
  if (m.connected && !m.ready && m.heatEnd !== null && i.sec >= m.heatEnd) {
    m.ready = true;
    // Les pièces de la machine (groupes, buse) deviennent des postes du service.
    for (const id of ic.cell.machineParts) {
      const p = content.service.settings.installation.find((x) => x.id === id);
      if (p === undefined || world.furniture.some((f) => f.id === id)) continue;
      const placed = placeFurniture(world, p);
      if (placed !== null) world.furniture.push(placed);
    }
    if (m.model === 'machine-revisee')
      for (const eq of ['niveau:vapeur:2', 'machine-perfect-bonus'])
        if (!world.service.equipment.includes(eq)) world.service.equipment.push(eq);
    // Le cadeau de Simone: de quoi faire le café d'essai, puis le premier matin.
    const s = world.clientele;
    const cc = content.clientele;
    for (const [ing, qty] of ic.cell.economy.simoneGift) {
      const sid = ing.replaceAll('_', '-');
      world.service.stock[sid] = (world.service.stock[sid] ?? 0) + qty;
      const def = cc.ingredients.get(ing);
      if (def !== undefined) addLot(s, ing, qty, lastGoodDay(def, nextOpenDay(cc, s.day)));
    }
    const furniture = ic.cell.appliances.find((a) => a.reason === 'machine')?.id ?? '';
    sim.emit({ type: 'installation-hot', furniture });
    sayOnce(sim, i, 'hot', ic.texts.hot);
  }
  if (!m.ready || m.tested) return;
  const sv = world.service;
  const trial = sv.tickets.find((t) => t.customer === TRIAL_CUSTOMER);
  const a = appliances(content, world);
  if (trial === undefined) {
    if (!a.grinder || a.dishes <= 0) {
      if (i.sec % 30 === 0)
        sayOnce(sim, i, 'trial-needs', 'Il te faut un moulin et une tasse, d’abord.');
      return;
    }
    const t = openTicket(
      sim,
      TRIAL_CUSTOMER,
      [{ recipe: 'noisette', options: [], price: 0, object: null }],
      null,
    );
    // Ni encaissé ni compté: c'est pour Simone.
    sv.receipts = sv.receipts.filter((r) => r.ticket !== t.id);
    return;
  }
  if (trial.status !== 'ready') return;
  const got = collectTicket(sim, trial.id, null);
  const gone = new Set(got?.objects ?? []);
  world.objects = world.objects.filter((o) => !gone.has(o.id));
  sv.items = sv.items.filter((x) => !gone.has(x.object));
  sv.tickets = sv.tickets.filter((x) => x.id !== trial.id);
  m.tested = true;
  say(sim, m.model === 'machine-revisee' ? ic.texts.testedNew : ic.texts.testedOld);
}

// ---------------------------------------------------------------------------------------------
// Gestes

function shutterUp(sim: SimContext, ic: InstallationContent, i: InstallationState): void {
  const { world } = sim;
  i.shutter = 'up';
  i.together = 0;
  i.holds = [null, null];
  i.lastActSec = i.sec;
  const door = ic.cell.shutters.find((x) => x.door)?.id ?? '';
  for (const s of ic.cell.shutters) removeFurniture(world, s.id);
  sim.emit({ type: 'installation-shutter-up', furniture: door });
  sayOnce(sim, i, 'note', ic.texts.note);
}

function shutterDown(sim: SimContext, ic: InstallationContent, i: InstallationState): void {
  i.shutter = 'down';
  i.together = 0;
  for (const s of ic.cell.shutters) restoreFurniture(sim.content, sim.world, s.id);
  sim.emit({
    type: 'installation-shutter-down',
    furniture: ic.cell.shutters.find((x) => x.door)?.id ?? '',
  });
}

function perform(
  sim: SimContext,
  ic: InstallationContent,
  i: InstallationState,
  player: PlayerIndex,
  spot: InstallSpot,
): void {
  const { world, content } = sim;
  const [kind = '', arg = ''] = spot.id.split(':');
  i.lastActSec = i.sec;
  const gesture = (
    g: 'sheet' | 'mail' | 'sweep' | 'wipe' | 'chairs' | 'tool' | 'connect',
    furniture: string,
  ): void => {
    sim.emit({ type: 'installation-gesture', player, gesture: g, furniture });
  };
  switch (kind) {
    case 'sheet': {
      i.sheets = i.sheets.filter((x) => x !== arg);
      removeFurniture(world, arg);
      gesture('sheet', arg);
      return;
    }
    case 'mail': {
      i.mail = true;
      removeFurniture(world, ic.cell.mail.id);
      gesture('mail', ic.cell.mail.id);
      for (const [from, text] of ic.texts.mails)
        sim.emit({ type: 'installation-message', from, text });
      return;
    }
    case 'tool': {
      const mine = i.tools[player];
      if (mine === arg) {
        i.tools[player] = null;
        restoreFurniture(content, world, arg);
      } else {
        if (mine !== null) restoreFurniture(content, world, mine);
        i.tools[player] = arg;
        removeFurniture(world, arg);
      }
      gesture('tool', arg);
      return;
    }
    case 'dust': {
      // Le balai passe dans un rayon: une tache sous un carton ou un meuble se balaie aussi.
      const at = world.furniture.find((f) => f.id === arg);
      const near = new Set(
        i.dust.filter((d) => {
          const f = world.furniture.find((x) => x.id === d);
          return (
            d === arg ||
            (at !== undefined &&
              f !== undefined &&
              Math.hypot(f.x - at.x, f.z - at.z) <= ic.rules.sweepRadius / 2)
          );
        }),
      );
      i.dust = i.dust.filter((d) => !near.has(d));
      for (const d of near) removeFurniture(world, d);
      gesture('sweep', arg);
      return;
    }
    case 'pane': {
      i.panes = i.panes.filter((x) => x !== arg);
      removeFurniture(world, arg);
      gesture('wipe', arg);
      return;
    }
    case 'buy': {
      const ctx = ctxOf(sim);
      // Achat d'un objet de Simone visé dans le monde: même chemin que le téléphone.
      refuse(sim, player, requestPurchase(ctx, player, arg));
      sim.emit({
        type: 'installation-gesture',
        player,
        gesture: 'buy',
        furniture: spot.furniture ?? '',
      });
      return;
    }
    case 'chairs': {
      const lot = ic.cell.lots.find((l) => l.id === arg);
      if (lot === undefined || i.lots[arg] !== 'ours') return;
      i.lots[arg] = 'down';
      removeFurniture(world, lot.chairs);
      for (const seat of lot.seats)
        if (!world.furniture.some((f) => f.id === seat.id)) world.furniture.push({ ...seat, y: 0 });
      // Les chaises de Simone comptent à l'ambiance, usées (charme à moitié).
      const s = world.clientele;
      const decor = s.startDecor ?? [];
      for (const [id, n] of lot.decor) decor.push([id.replaceAll('-', '_'), n, true]);
      s.startDecor = decor;
      const worn = world.arrangement.worn;
      for (const id of [lot.table, ...lot.seats.map((x) => x.id)])
        if (!worn.includes(id)) worn.push(id);
      gesture('chairs', lot.table);
      return;
    }
    case 'connect': {
      i.machine.connected = true;
      i.machine.heatEnd = i.sec + Math.round(ic.rules.heatSec);
      gesture('connect', spot.furniture ?? '');
      sim.emit({ type: 'installation-heat', furniture: spot.furniture ?? '' });
      return;
    }
    case 'return':
      returnCarton(sim, ic, i, player, arg);
      return;
    default:
      return;
  }
}

function stepHolds(sim: SimContext, ic: InstallationContent, i: InstallationState): void {
  const { world, content } = sim;
  const shutterHolders = ([0, 1] as const).filter((p) => i.holds[p]?.spot === 'shutter');
  for (const p of [0, 1] as const) {
    const h = i.holds[p];
    if (h === null) continue;
    const spot = spotFor(content, world, p, h.spot);
    if (spot === null || !sim.inputs[p].actHeld) {
      i.holds[p] = null;
      if (h.spot === 'shutter' && spot !== null) {
        // Seul, le rideau se soulève à peine et retombe (IN-03).
        sim.emit({ type: 'installation-shutter-down', furniture: spot.furniture ?? '' });
        refuse(sim, p, prompt(ic, 'shutterAlone'));
      }
      continue;
    }
    h.elapsed = Math.round((h.elapsed + sim.dt) * 1000) / 1000;
    if (h.spot === 'shutter') continue;
    if (h.elapsed + 1e-9 >= spot.hold) {
      i.holds[p] = null;
      perform(sim, ic, i, p, spot);
    }
  }
  // Rideau: les deux maintiens se recouvrent pendant `shutterHoldSec`.
  const both = shutterHolders.length === 2 && i.holds[0] !== null && i.holds[1] !== null;
  i.together = both ? Math.round((i.together + sim.dt) * 1000) / 1000 : 0;
  const door = ic.cell.shutters.find((x) => x.door)?.id;
  const lifted = world.furniture.find((f) => f.id === door);
  if (lifted !== undefined) {
    const start = startPose(content, lifted.id);
    const lift = i.holds.some((x) => x?.spot === 'shutter') ? ic.rules.soloLift : 0;
    lifted.y = (start?.y ?? 0) + lift;
  }
  if (both && i.together + 1e-9 >= ic.rules.shutterHoldSec) shutterUp(sim, ic, i);
}

/** Répliques de Simone quand un joueur regarde un lieu de près (une fois chacune). */
function stepLooks(sim: SimContext, ic: InstallationContent, i: InstallationState): void {
  if (i.shutter === 'down') return;
  const { world } = sim;
  const cell = ic.cell;
  const r = ic.rules.lookLineReach;
  const counter = cell.sheets.find((x) => x.covers.includes(cell.oldMachine));
  const machine = cell.appliances.find((a) => a.reason === 'machine');
  const firstTable = cell.lots[0];
  const table =
    firstTable === undefined ? undefined : cell.sheets.find((x) => x.id === firstTable.sheet);
  const looks: [string, string, number, number, boolean][] = [];
  if (counter !== undefined) {
    looks.push(['counter', ic.texts.counter, counter.x, counter.z, true]);
    looks.push(['machine', ic.texts.machine, counter.x, counter.z, i.sheets.includes(counter.id)]);
  }
  if (machine !== undefined && counter !== undefined)
    looks.push(['trace', ic.texts.trace, machine.x, machine.z, !i.sheets.includes(counter.id)]);
  if (table !== undefined) looks.push(['tables', ic.texts.tables, table.x, table.z, true]);
  if (!i.mail) looks.push(['mail', ic.texts.mail, cell.mail.x, cell.mail.z, true]);
  for (const [key, text, x, z, ok] of looks) {
    if (!ok || i.said.includes(key)) continue;
    const seen = world.players.some((p) => {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d > r) return false;
      const yaw = (p.yawDeg * Math.PI) / 180;
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      return ((x - p.x) * fx + (z - p.z) * fz) / Math.max(d, 1e-6) > Math.cos((25 * Math.PI) / 180);
    });
    if (seen) {
      sayOnce(sim, i, key, text);
      return;
    }
  }
  if (i.sec - i.lastActSec >= ic.rules.lookLineAfterSec)
    sayOnce(sim, i, 'minimum', ic.texts.minimum);
}

// ---------------------------------------------------------------------------------------------
// Nuit et grand jour

function night(sim: SimContext, ic: InstallationContent, i: InstallationState): void {
  const { world, content } = sim;
  // Les cartons restés dehors sont rentrés par Gaby, contre le mur ouest de la salle (IN-05).
  const [ax, az, aw, ad] = ic.cell.deliveryArea;
  const [nx, nz] = ic.cell.nightCartonSpot;
  for (const [carton] of i.cartons) {
    const f = world.furniture.find((x) => x.id === carton);
    if (f === undefined || f.x < ax || f.x > ax + aw || f.z < az || f.z > az + ad) continue;
    const spot = sidewalkSpot(content, world, f.type, [nx - 0.6, nz - 1.2, 1.2, 2.4]);
    if (spot === null) continue;
    f.x = spot.x;
    f.z = spot.z;
  }
  i.holds = [null, null];
  for (const p of [0, 1] as const) {
    const tool = i.tools[p];
    if (tool !== null) restoreFurniture(content, world, tool);
    i.tools[p] = null;
  }
  if (i.stage !== 'setup' || world.clientele.phase !== 'prep') return;
  // Le grand jour: rideaux baissés, les deux arrivent sur la place (une seule fois).
  i.stage = 'bigday';
  shutterDown(sim, ic, i);
  const start = content.cellStart;
  if (start === null) return;
  for (const p of [0, 1] as const) {
    const pl = world.players[p];
    pl.x = start.spawns[p][0];
    pl.z = start.spawns[p][1];
    pl.yawDeg = start.spawnYawDeg ?? 0;
    pl.seat = null;
  }
  say(sim, ic.texts.bigDay);
}

// ---------------------------------------------------------------------------------------------

export function installationStep(sim: SimContext): void {
  const { world, content } = sim;
  const i = installationOf(world);
  const ic = content.installation;
  if (i === null || ic === null || world.clientele.day === 0) return;
  if (i.lastDay === 0) setup(sim, ic, i);
  if (world.clientele.day > i.lastDay) {
    i.lastDay = world.clientele.day;
    night(sim, ic, i);
  }
  if (i.stage === 'bigday' && world.clientele.phase === 'service') i.stage = 'opened';
  const f = (fractions.get(world) ?? 0) + sim.dt;
  const whole = Math.floor(f + 1e-9);
  fractions.set(world, f - whole);
  if (whole > 0) i.sec += whole;
  stepHolds(sim, ic, i);
  takeNewPurchases(sim, ic, i);
  stepDeliveries(sim, ic, i);
  stepMachine(sim, ic, i);
  syncStations(sim);
  if (i.stage !== 'opened') stepLooks(sim, ic, i);
}

export function installationIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  if (intent.type !== 'installation-act') return;
  const { world, content } = sim;
  const i = installationOf(world);
  const ic = content.installation;
  if (i === null || ic === null) return;
  const spot = spotFor(content, world, player, intent.spot);
  if (spot === null) return;
  const me = world.players[player];
  if (Math.hypot(spot.x - me.x, spot.z - me.z) > spot.reach + REACH_TOLERANCE) {
    refuse(sim, player, 'Trop loin');
    return;
  }
  if (spot.refused !== null) {
    refuse(sim, player, spot.refused);
    return;
  }
  if (spot.hold > 0) {
    i.holds[player] = { spot: spot.id, elapsed: 0 };
    return;
  }
  perform(sim, ic, i, player, spot);
}
