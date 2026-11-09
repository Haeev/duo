/**
 * Lectures pures de l'installation (démo v0.3), sur les deux machines: points où « Agir » fait
 * quelque chose, état des appareils, ce qui manque pour ouvrir (`openingCheck`). Tout se déduit du
 * monde partagé: l'invité vise et lit comme l'hôte, qui revérifie.
 */
import type { Content } from '../donnees/charger';
import type { PlayerIndex, World } from '../etat/monde';
import type { Eye } from '../simulation/visee';
import { prompt, type InstallationContent, type InstallPurchase, type NeedId } from './donnees';
import type { InstallationState } from './etat';

/** Un point de l'installation où « Agir » fait (ou dirait pourquoi il ne fait pas) quelque chose. */
export interface InstallSpot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Rayon de la sphère de visée. */
  readonly radius: number;
  /** Portée au sol, du joueur au point. */
  readonly reach: number;
  /** Durée du maintien (s), 0 pour un appui. */
  readonly hold: number;
  readonly label: string;
  /** Raison du refus (le point se montre quand même), `null` si « Agir » marche. */
  readonly refused: string | null;
  /** Meuble à encadrer (surlignage du guide), s'il y en a un. */
  readonly furniture: string | null;
}

export function installationOf(world: World): InstallationState | null {
  return world.installation ?? null;
}

/** L'installation est en cours (lundi, puis le premier jour ouvert jusqu'à la pancarte). */
export function installing(world: World): boolean {
  const i = installationOf(world);
  return i !== null && i.stage !== 'opened';
}

export function owns(world: World, purchase: string): boolean {
  return world.clientele.purchases.some(([id]) => id === purchase);
}

function placed(world: World, type: string): boolean {
  return world.furniture.some((f) => f.type === type);
}

export function euros(n: number): string {
  return `${n.toFixed(Number.isInteger(n) ? 0 : 2).replace('.', ',')} €`;
}

export interface Appliances {
  /** Machine achetée (et laquelle), posée à sa place, raccordée, chaude. */
  readonly machine: string | null;
  readonly machinePlaced: boolean;
  readonly connected: boolean;
  readonly ready: boolean;
  readonly grinder: boolean;
  readonly register: boolean;
  readonly fridge: boolean;
  readonly kettle: boolean;
  readonly vitrine: boolean;
  /** Pièces de vaisselle propres. */
  readonly dishes: number;
}

export function appliances(content: Content, world: World): Appliances {
  const i = installationOf(world);
  const model = i?.machine.model ?? null;
  const machineType =
    model === null ? null : (content.installation?.purchases.get(model)?.furniture ?? null);
  const c = world.service.clean;
  return {
    machine: model,
    machinePlaced: machineType !== null && placed(world, machineType),
    connected: i?.machine.connected ?? true,
    ready: i?.machine.ready ?? true,
    grinder: placed(world, 'moulin') || placed(world, 'moulin-dose'),
    register: placed(world, 'caisse'),
    fridge: placed(world, 'frigo-sous-plan'),
    kettle: placed(world, 'bouilloire') || placed(world, 'bouilloire-temperature'),
    vitrine: placed(world, 'vitrine'),
    dishes: placed(world, 'pile-tasses') ? c.tasse + c.verre + c.assiette : 0,
  };
}

/** Achats « Pour ouvrir » d'un besoin. */
export function purchasesOf(ic: InstallationContent, need: NeedId): InstallPurchase[] {
  return ic.purchaseList.filter((p) => p.need === need);
}

/** Un besoin est couvert: un achat fait (posé, en place ou en route). */
export function needBought(content: Content, world: World, need: NeedId): boolean {
  const ic = content.installation;
  if (ic === null) return true;
  return purchasesOf(ic, need).some((p) => owns(world, p.id));
}

/** Un besoin est posé et prêt à servir. */
export function needInstalled(content: Content, world: World, need: NeedId): boolean {
  const a = appliances(content, world);
  switch (need) {
    case 'machine':
      return a.machinePlaced;
    case 'moulin':
      return a.grinder;
    case 'caisse':
      return a.register;
    case 'vaisselle':
      return a.dishes > 0;
    case 'frais':
      return a.fridge;
    case 'thes':
      return a.kettle;
    case 'viennoiseries':
      return a.vitrine;
    case 'places':
      return seatsInside(content, world) > 0;
  }
}

/** Places assises dans les pièces fermées (le banc de Simone, dehors, ne compte pas). */
export function seatsInside(content: Content, world: World): number {
  const rooms = content.arrangement.rooms.filter((r) => !r.outdoor);
  let n = 0;
  for (const f of world.furniture) {
    if (content.furniture.get(f.type)?.kind !== 'seat') continue;
    if (
      rooms.some((r) => {
        const [x, z, w, d] = r.space;
        return f.x >= x && f.x <= x + w && f.z >= z && f.z <= z + d;
      })
    )
      n++;
  }
  return n;
}

/** Recettes de l'ardoise servables maintenant (postes posés, ingrédients en réserve). */
export function servableLines(content: Content, world: World): string[] {
  const s = world.clientele;
  const cc = content.clientele;
  return s.slate
    .map(([id]) => id)
    .filter((id) => {
      const r = cc.recipes.get(id);
      if (r === undefined) return false;
      if (!r.stations.every((st) => (s.stations[st] ?? 0) > 0)) return false;
      return r.ingredients.every(([ing, qty]) => (s.stock[ing] ?? 0) + 1e-9 >= qty);
    });
}

/** Postes de la clientèle que donnent les appareils posés (avant les achats qui les montent). */
export function stationsFromAppliances(
  content: Content,
  world: World,
): Readonly<Record<string, number>> {
  const a = appliances(content, world);
  const out: Record<string, number> = {};
  if (a.ready && a.machinePlaced) {
    if (a.grinder) out.espresso = 1;
    out.vapeur = a.machine === 'machine-revisee' ? 2 : 1;
  }
  if (a.kettle) out.bouilloire = 1;
  if (a.vitrine) out.vitrine = 1;
  if (a.fridge) {
    out.plan = 1;
    out.frigo = 1;
  }
  return out;
}

export interface OpeningItem {
  readonly key: string;
  readonly text: string;
}

export interface OpeningCheck {
  /** Ce qui empêche d'ouvrir: l'hôte refuse le vote `open`. */
  readonly blocks: readonly OpeningItem[];
  /** Ce qui se dit avant d'ouvrir, sans rien bloquer. */
  readonly warnings: readonly OpeningItem[];
}

const NO_CHECK: OpeningCheck = { blocks: [], warnings: [] };

/** Première raison pour laquelle la première ligne de l'ardoise ne se sert pas. */
function slateReason(content: Content, world: World): string {
  const s = world.clientele;
  const id = s.slate[0]?.[0];
  if (id === undefined) return 'L’ardoise est vide.';
  const r = content.clientele.recipes.get(id);
  if (r === undefined) return '';
  const st = r.stations.find((x) => (s.stations[x] ?? 0) <= 0);
  if (st !== undefined) return `Il faut : ${STATION_NEED[st] ?? st}.`;
  const ing = r.ingredients.find(([x, qty]) => (s.stock[x] ?? 0) + 1e-9 < qty);
  if (ing !== undefined)
    return `Plus de ${content.clientele.ingredients.get(ing[0])?.name ?? ing[0]} en réserve.`;
  return '';
}

/** Ce qui manque à une recette, dit comme sur l'ardoise (« Il faut : une bouilloire »). */
export const STATION_NEED: Readonly<Record<string, string>> = {
  espresso: 'la machine, raccordée, et un moulin',
  vapeur: 'la machine, raccordée',
  bouilloire: 'une bouilloire',
  vitrine: 'la cloche à viennoiseries',
  plan: 'le réfrigérateur',
  frigo: 'le réfrigérateur',
};

/**
 * Peut-on retourner la pancarte (section 7.1)? Vide pour une maison déjà ouverte: seule la
 * première ouverture d'une maison partie de rien est vérifiée.
 */
export function openingCheck(content: Content, world: World): OpeningCheck {
  const i = installationOf(world);
  const ic = content.installation;
  if (i === null || ic === null || i.stage === 'opened') return NO_CHECK;
  const t = ic.texts.open;
  const a = appliances(content, world);
  const blocks: OpeningItem[] = [];
  const warnings: OpeningItem[] = [];
  const say = (list: OpeningItem[], key: string, extra = ''): void => {
    list.push({ key, text: `${t[key] ?? key}${extra === '' ? '' : ` ${extra}`}` });
  };
  if (i.shutter === 'down') say(blocks, 'shutter');
  if (!a.register) say(blocks, 'register');
  if (a.dishes <= 0) say(blocks, 'dishes');
  const servable = servableLines(content, world);
  if (servable.length === 0) say(blocks, 'slate', slateReason(content, world));
  if (seatsInside(content, world) === 0) say(warnings, 'seats');
  if (i.panes.length > 0) say(warnings, 'windows');
  if (i.dust.length > 0) say(warnings, 'dust');
  if (a.machine !== null && !a.ready && servable.length > 0) say(warnings, 'unplugged');
  return { blocks, warnings };
}

/** Besoins obligatoires pas encore couverts (« une caisse, de la vaisselle »). */
export function missingNeeds(content: Content, world: World, placedOnly = false): string[] {
  const ic = content.installation;
  if (ic === null) return [];
  return ic.needs
    .filter((n) => ic.required.includes(n.id))
    .filter((n) =>
      placedOnly ? !needInstalled(content, world, n.id) : !needBought(content, world, n.id),
    )
    .map((n) => n.short);
}

// ---------------------------------------------------------------------------------------------
// Points d'action

function heldTool(world: World, player: PlayerIndex): string | null {
  return installationOf(world)?.tools[player] ?? null;
}

/** Points où ce joueur peut agir (ou lire pourquoi pas), pour la visée et pour l'hôte. */
export function installSpots(content: Content, world: World, player: PlayerIndex): InstallSpot[] {
  const i = installationOf(world);
  const ic = content.installation;
  if (i === null || ic === null) return [];
  const { cell, rules } = ic;
  const out: InstallSpot[] = [];
  const P = (key: string, values: Readonly<Record<string, string | number>> = {}): string =>
    prompt(ic, key, values);
  const furnitureAt = (id: string): { x: number; z: number; y: number; h: number } | null => {
    const f = world.furniture.find((x) => x.id === id);
    if (f === undefined) return null;
    return { x: f.x, z: f.z, y: f.y, h: content.furniture.get(f.type)?.height ?? 0.5 };
  };
  const add = (spot: Omit<InstallSpot, 'reach'> & { reach?: number }): void => {
    out.push({ ...spot, reach: spot.reach ?? rules.spotReach });
  };

  if (i.shutter === 'down' && i.stage !== 'opened') {
    const h = cell.shutterHandle;
    add({
      id: 'shutter',
      x: h.x,
      y: 0.9,
      z: h.z,
      radius: 0.6,
      reach: h.reach,
      hold: rules.shutterHoldSec,
      label: P('shutterHold'),
      refused: null,
      furniture: cell.shutters.find((s) => s.door)?.id ?? null,
    });
    // Rideau baissé: on est dehors, rien d'autre ne se fait.
    return out;
  }
  for (const sheet of cell.sheets) {
    if (!i.sheets.includes(sheet.id)) continue;
    const f = furnitureAt(sheet.id);
    const big = sheet.id === cell.sheets[0]?.id && sheet.covers.length > 1 ? 0.9 : 0.5;
    add({
      id: `sheet:${sheet.id}`,
      x: sheet.x,
      y: sheet.y,
      z: sheet.z,
      radius: big,
      reach: rules.spotReach + big,
      hold: 0,
      label: P('sheet'),
      refused: null,
      furniture: f === null ? null : sheet.id,
    });
  }
  if (!i.mail) {
    const m = cell.mail;
    add({
      id: 'mail',
      x: m.x,
      y: m.y,
      z: m.z,
      radius: 0.25,
      hold: 0,
      label: P('mail'),
      refused: null,
      furniture: m.id,
    });
  }
  const mine = heldTool(world, player);
  const other: PlayerIndex = player === 0 ? 1 : 0;
  for (const tool of cell.tools) {
    const name = tool.tool === 'broom' ? 'le balai' : 'l’éponge';
    if (mine === tool.id) {
      add({
        id: `tool:${tool.id}`,
        x: tool.x,
        y: tool.y,
        z: tool.z,
        radius: 0.3,
        hold: 0,
        label: P('putBack', { tool: name }),
        refused: null,
        furniture: tool.id,
      });
      continue;
    }
    const taken = i.tools[other] === tool.id;
    add({
      id: `tool:${tool.id}`,
      x: tool.x,
      y: tool.y,
      z: tool.z,
      radius: 0.3,
      hold: 0,
      label: P(tool.tool === 'broom' ? 'broom' : 'sponge'),
      refused: taken ? P('takenBy') : null,
      furniture: tool.id,
    });
  }
  const broom = cell.tools.find((x) => x.tool === 'broom')?.id;
  const sponge = cell.tools.find((x) => x.tool === 'sponge')?.id;
  for (const id of i.dust) {
    const f = furnitureAt(id);
    if (f === null) continue;
    add({
      id: `dust:${id}`,
      x: f.x,
      y: 0.02,
      z: f.z,
      radius: 0.3,
      hold: rules.sweepHoldSec,
      label: P('sweep'),
      refused: mine === broom ? null : P('needBroom'),
      furniture: id,
    });
  }
  for (const pane of cell.panes) {
    if (!i.panes.includes(pane.id)) continue;
    add({
      id: `pane:${pane.id}`,
      x: pane.x,
      y: pane.y,
      z: pane.z,
      radius: 0.6,
      reach: rules.spotReach + 0.4,
      hold: rules.wipeHoldSec,
      label: P('wipe'),
      refused: mine === sponge ? null : P('needSponge'),
      furniture: pane.id,
    });
  }
  // Ce qui est à Simone, une fois découvert: s'achète sur place (même intention que le téléphone).
  const counterSheet = cell.sheets.find((x) => x.covers.includes(cell.oldMachine));
  const old = world.furniture.find(
    (f) => f.id === cell.oldMachine && f.type === 'machine-espresso',
  );
  const oldBuy = ic.purchaseList.find((p) => p.delivery === 'en-place' && p.need === 'machine');
  if (
    old !== undefined &&
    oldBuy !== undefined &&
    i.machine.model === null &&
    (counterSheet === undefined || !i.sheets.includes(counterSheet.id))
  )
    add({
      id: `buy:${oldBuy.id}`,
      x: old.x,
      y: old.y + 0.25,
      z: old.z,
      radius: 0.35,
      hold: rules.buyHoldSec,
      label: P('buySimone', { price: euros(oldBuy.price) }),
      refused: null,
      furniture: old.id,
    });
  for (const lot of cell.lots) {
    const state = i.lots[lot.id] ?? 'simone';
    if (state === 'down' || i.sheets.includes(lot.sheet)) continue;
    const table = furnitureAt(lot.table);
    const buyLot = ic.purchaseList.find((p) => p.lot === lot.id);
    if (table === null || buyLot === undefined) continue;
    add({
      id: state === 'simone' ? `buy:${buyLot.id}` : `chairs:${lot.id}`,
      x: table.x,
      y: 1.0,
      z: table.z,
      radius: 0.45,
      hold: state === 'simone' ? rules.buyHoldSec : rules.chairsDownSec,
      label:
        state === 'simone'
          ? `${P('buySimone', { price: euros(buyLot.price) })} (${P('tag', { price: euros(buyLot.price) })})`
          : P('chairsDown'),
      refused: null,
      furniture: lot.table,
    });
  }
  const a = appliances(content, world);
  const machineId = cell.appliances.find((x) => x.reason === 'machine')?.id ?? cell.oldMachine;
  const machine = world.furniture.find((f) => f.id === machineId);
  if (a.machine !== null && a.machinePlaced && machine !== undefined && !a.ready)
    add({
      id: a.connected ? 'heat' : 'connect',
      x: machine.x,
      y: machine.y + 0.25,
      z: machine.z,
      radius: 0.35,
      hold: a.connected ? 0 : rules.connectHoldSec,
      label: a.connected
        ? P('heating', { s: Math.max(0, (i.machine.heatEnd ?? i.sec) - i.sec) })
        : P('connect'),
      refused: a.connected
        ? P('heating', { s: Math.max(0, (i.machine.heatEnd ?? i.sec) - i.sec) })
        : null,
      furniture: machine.id,
    });
  for (const [carton] of i.cartons) {
    const f = furnitureAt(carton);
    if (f === null || world.arrangement.carry?.furniture === carton) continue;
    add({
      id: `return:${carton}`,
      x: f.x,
      y: f.y + f.h * 0.6,
      z: f.z,
      radius: 0.35,
      hold: rules.returnHoldSec,
      label: P('returnCarton'),
      refused: null,
      furniture: carton,
    });
  }
  return out;
}

/**
 * Ce que dessine le café fermé (`rendu/cafe-ferme.ts`): vitres encore blanches (identifiants du
 * plan), taches encore là (index dans `cell.dust`), et leurs positions.
 */
export function closedCafeLook(
  content: Content,
  world: World,
): { panes: string[]; dust: number[] } | null {
  const i = installationOf(world);
  const cell = content.installation?.cell;
  if (i === null || cell === undefined) return null;
  return {
    panes: [...i.panes],
    dust: cell.dust.flatMap((id, k) => (i.dust.includes(id) ? [k] : [])),
  };
}

/** Positions des taches de l'adresse, dans l'ordre de `cell.dust` (départ en cellule). */
export function dustSpots(content: Content): { x: number; z: number }[] {
  const cell = content.installation?.cell;
  if (cell === undefined) return [];
  return cell.dust.flatMap((id) => {
    const f = content.cellStart?.furniture.find((x) => x.id === id);
    return f === undefined ? [] : [{ x: f.x, z: f.z }];
  });
}

export interface InstallAim {
  readonly spot: InstallSpot;
  /** Distance des yeux au point visé. */
  readonly distance: number;
}

/** Point visé depuis `eye` (même cône que la visée du cœur), ou `null`. */
export function installAim(
  content: Content,
  world: World,
  player: PlayerIndex,
  eye: Eye,
): InstallAim | null {
  const spots = installSpots(content, world, player);
  if (spots.length === 0) return null;
  const yaw = (eye.yawDeg * Math.PI) / 180;
  const pitch = (eye.pitchDeg * Math.PI) / 180;
  const dx = -Math.sin(yaw) * Math.cos(pitch);
  const dy = Math.sin(pitch);
  const dz = -Math.cos(yaw) * Math.cos(pitch);
  const cone = (content.settings.aim.coneDeg * Math.PI) / 180;
  let best: InstallAim | null = null;
  let bestScore = Infinity;
  let bestOk = false;
  for (const spot of spots) {
    if (Math.hypot(spot.x - eye.x, spot.z - eye.z) > spot.reach) continue;
    const vx = spot.x - eye.x;
    const vy = spot.y - eye.y;
    const vz = spot.z - eye.z;
    const dist = Math.hypot(vx, vy, vz);
    if (dist < 1e-6) continue;
    const cos = (vx * dx + vy * dy + vz * dz) / dist;
    const score = Math.acos(Math.max(-1, Math.min(1, cos))) - Math.atan(spot.radius / dist);
    if (score > cone) continue;
    const ok = spot.refused === null;
    if ((ok && !bestOk) || (ok === bestOk && score < bestScore)) {
      best = { spot, distance: dist };
      bestScore = score;
      bestOk = ok;
    }
  }
  return best;
}

/** Point encore valable pour ce joueur (l'hôte revérifie l'intention), avec sa portée. */
export function spotFor(
  content: Content,
  world: World,
  player: PlayerIndex,
  id: string,
): InstallSpot | null {
  return installSpots(content, world, player).find((s) => s.id === id) ?? null;
}
