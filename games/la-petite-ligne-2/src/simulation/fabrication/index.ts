/**
 * Système « fabrication » (cahier 4.5 et 4.7, R19 et R59): fabriquer sur plans à un poste, par
 * coups courts (à deux sur le même poste, les coups s'additionnent), améliorer un outil chez
 * l'artisan (tout de suite ou le lendemain), le réparer en payant selon l'usure, ou l'affûter
 * soi-même à la meule jusqu'à la moitié. Chaque refus part en `refused` avec sa raison.
 *
 * L'ouvrage en cours d'un poste vit hors de l'état (moins d'une minute, rien n'est pris avant la
 * fin): comme la cuisine, il ne se sauvegarde pas.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { WorldState } from '../../etat/monde';
import type { Stack } from '../../etat/joueur';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { SIM_HZ } from '../noyau/constantes';
import { bump, remember } from '../regles/memoire';
import { giveItem } from '../sac/actions';
import { pay } from '../sac/argent';
import { countItem, removeItem } from '../sac/inventaire';
import { repairTool, toolCondition, toolWearRatio, wearTool } from '../sac/outils';
import {
  chestsNear,
  isPlanKnown,
  materialCount,
  nearStation,
  offers,
  orderKey,
  orderOf,
  planKey,
  planOutput,
  repairPrice,
  stationOf,
  upgradeAt,
  type Station,
} from './plans';
import { CRAFTING } from './reglages';

/** Raisons de refus de l'atelier (textes: `interface/atelier/textes.ts`). */
export type CraftRefusal =
  | 'too-far'
  | 'not-here'
  | 'unknown-plan'
  | 'missing-materials'
  | 'not-enough-money'
  | 'busy'
  | 'no-work'
  | 'too-soon'
  | 'no-tool-in-hand'
  | 'cannot-upgrade'
  | 'cannot-repair'
  | 'already-sharp'
  | 'cannot-sharpen'
  | 'sharp-enough'
  | 'order-pending';

interface Job {
  plan: string;
  variant: number;
  by: PlayerIndex;
  points: number;
  struck: [boolean, boolean];
}

interface Workshop {
  jobs: Map<string, Job>;
  /** Pas du dernier coup de chaque joueur (cadence bornée chez l'hôte). */
  lastHit: [number, number];
}

const workshops = new WeakMap<WorldState, Workshop>();

function workshopOf(world: WorldState): Workshop {
  let found = workshops.get(world);
  if (found === undefined) {
    found = { jobs: new Map(), lastHit: [-1e9, -1e9] };
    workshops.set(world, found);
  }
  return found;
}

/** L'ouvrage en cours à ce poste (lecture chez l'hôte, pour les tests et le mode bot). */
export function jobAt(world: WorldState, target: string): Readonly<Job> | null {
  return workshops.get(world)?.jobs.get(target) ?? null;
}

function refuse(sim: SimContext, player: PlayerIndex, reason: CraftRefusal, target: string): void {
  sim.emit({ type: 'refused', player, reason, target });
}

/** Poste à portée qui offre cet usage, sinon le refus. */
function access(
  sim: SimContext,
  player: PlayerIndex,
  target: string,
  service: Parameters<typeof offers>[1],
): Station | null {
  const station = stationOf(sim, target);
  if (station === null || !offers(station, service)) {
    refuse(sim, player, 'not-here', target);
    return null;
  }
  if (!nearStation(sim, player, target)) {
    refuse(sim, player, 'too-far', target);
    return null;
  }
  return station;
}

function hasMaterials(
  sim: SimContext,
  player: PlayerIndex,
  station: Station,
  materials: readonly { item: string; count: number }[],
): boolean {
  return materials.every((m) => {
    const { pockets, chests } = materialCount(sim, player, station, m.item);
    return pockets + chests >= m.count;
  });
}

/** Prend les matériaux: les poches d'abord, puis les coffres proches. À appeler après `hasMaterials`. */
function takeMaterials(
  sim: SimContext,
  player: PlayerIndex,
  station: Station,
  materials: readonly { item: string; count: number }[],
): void {
  const state = sim.world.players[player];
  const place = sim.world.places[sim.world.common.place];
  for (const m of materials) {
    const fromPockets = Math.min(m.count, countItem(state, m.item));
    if (fromPockets > 0) removeItem(state, m.item, fromPockets);
    let left = m.count - fromPockets;
    for (const id of chestsNear(sim, station)) {
      const slots = place?.objects[id]?.store;
      if (slots === undefined || left === 0) continue;
      for (let i = slots.length - 1; i >= 0 && left > 0; i--) {
        const stack = slots[i];
        if (stack?.item !== m.item) continue;
        const taken = Math.min(left, stack.count);
        stack.count -= taken;
        left -= taken;
        if (stack.count === 0) slots[i] = null;
      }
    }
  }
  if (state.selected !== null && state.toolbar[state.selected] === null) state.selected = null;
  sim.touch('players');
  sim.touch('place');
}

/** Ouvre l'atelier: apprend les plans papier qu'on a sur soi, rend l'outil commandé s'il est prêt. */
export function openWorkshop(sim: SimContext, player: PlayerIndex, target: string): void {
  const station = stationOf(sim, target);
  if (station === null) return;
  const state = sim.world.players[player];
  for (const plan of Object.values(sim.content.plans)) {
    if (plan.paper === undefined || isPlanKnown(sim.world, plan)) continue;
    if (countItem(state, plan.paper) === 0) continue;
    removeItem(state, plan.paper, 1);
    remember(sim, planKey(plan.id), 0, player);
    sim.touch('players');
    sim.emit({ type: 'plan_learned', player, plan: plan.id });
  }
  const order = orderOf(sim.world, player);
  if (order !== null && offers(station, 'upgrade') && sim.world.common.day >= order.day) {
    remember(sim, orderKey(player), '', player);
    giveItem(sim, player, order.item, 1);
  }
  sim.emit({ type: 'workshop_opened', player, target, station: station.brick.station });
}

function start(
  sim: SimContext,
  player: PlayerIndex,
  intent: Extract<Intent, { type: 'craft_start' }>,
): void {
  const station = access(sim, player, intent.target, 'make');
  if (station === null) return;
  const plan = sim.content.plans[intent.plan];
  if (plan?.station !== station.brick.station || plan.makes.kind === 'upgrade') {
    refuse(sim, player, 'not-here', intent.target);
    return;
  }
  if (!isPlanKnown(sim.world, plan)) {
    refuse(sim, player, 'unknown-plan', intent.target);
    return;
  }
  if (planOutput(plan, intent.variant) === null) {
    refuse(sim, player, 'not-here', intent.target);
    return;
  }
  const shop = workshopOf(sim.world);
  const current = shop.jobs.get(intent.target);
  if (current !== undefined && current.by !== player) {
    refuse(sim, player, 'busy', intent.target);
    return;
  }
  if (!hasMaterials(sim, player, station, plan.materials)) {
    refuse(sim, player, 'missing-materials', intent.target);
    return;
  }
  shop.jobs.set(intent.target, {
    plan: plan.id,
    variant: intent.variant,
    by: player,
    points: 0,
    struck: [false, false],
  });
  sim.emit({
    type: 'craft_started',
    player,
    target: intent.target,
    plan: plan.id,
    variant: intent.variant,
  });
}

/** Points et durée d'un coup: le marteau en main, sinon les mains nues. */
function strikeOf(
  sim: SimContext,
  player: PlayerIndex,
): { power: number; seconds: number; slot: number | null } {
  const state = sim.world.players[player];
  const slot = state.selected;
  const stack = slot === null ? null : (state.toolbar[slot] ?? null);
  const tool = stack === null ? null : (sim.content.items[stack.item]?.tool ?? null);
  if (stack === null || tool?.kind !== 'hammer')
    return { power: CRAFTING.barehandPower, seconds: CRAFTING.barehandSeconds, slot: null };
  const blunt = toolCondition(sim.content, stack) === 'blunt';
  const work = tool.work;
  const power = work === undefined ? CRAFTING.barehandPower : blunt ? work.bluntPower : work.power;
  return { power, seconds: blunt ? tool.bluntGestureSeconds : tool.gestureSeconds, slot };
}

/** Cadence: un coup au plus par geste (90 % de sa durée, pour la gigue du réseau). */
function tooSoon(sim: SimContext, player: PlayerIndex, seconds: number): boolean {
  const shop = workshopOf(sim.world);
  if (sim.world.tick - shop.lastHit[player] < seconds * SIM_HZ * 0.9) return true;
  shop.lastHit[player] = sim.world.tick;
  return false;
}

function strike(sim: SimContext, player: PlayerIndex, target: string): void {
  const station = access(sim, player, target, 'make');
  if (station === null) return;
  const shop = workshopOf(sim.world);
  const job = shop.jobs.get(target);
  const plan = job === undefined ? undefined : sim.content.plans[job.plan];
  if (job === undefined || plan === undefined) {
    refuse(sim, player, 'no-work', target);
    return;
  }
  const hit = strikeOf(sim, player);
  if (tooSoon(sim, player, hit.seconds)) return;
  job.points = Math.min(plan.work, job.points + hit.power);
  job.struck[player] = true;
  sim.emit({ type: 'craft_hit', player, target, plan: plan.id, progress: job.points / plan.work });
  if (job.points < plan.work) return;

  shop.jobs.delete(target);
  const output = planOutput(plan, job.variant);
  if (output === null || !hasMaterials(sim, job.by, station, plan.materials)) {
    refuse(sim, job.by, 'missing-materials', target);
    return;
  }
  takeMaterials(sim, job.by, station, plan.materials);
  // Le marteau s'use d'un cran par fabrication (cahier 4.5: « 100 fabrications »).
  for (const p of [0, 1] as const) {
    if (!job.struck[p]) continue;
    const s = strikeOf(sim, p).slot;
    if (s !== null) wearTool(sim, p, s);
  }
  const first = (sim.world.progress.memory[planKey(plan.id)]?.v ?? 0) === 0;
  bump(sim, planKey(plan.id), job.struck[0] && job.struck[1] ? 'duo' : job.by);
  giveItem(sim, job.by, output.item, output.count);
  sim.emit({
    type: 'crafted',
    player: job.by,
    target,
    plan: plan.id,
    item: output.item,
    first,
    together: job.struck[0] && job.struck[1],
  });
}

function cancel(sim: SimContext, player: PlayerIndex, target: string): void {
  const shop = workshopOf(sim.world);
  const job = shop.jobs.get(target);
  if (job?.by !== player) return;
  shop.jobs.delete(target);
  sim.emit({ type: 'craft_cancelled', player, target });
}

function toolJob(
  sim: SimContext,
  player: PlayerIndex,
  intent: Extract<Intent, { type: 'craft_tool' }>,
): void {
  const station = access(sim, player, intent.target, intent.job);
  if (station === null) return;
  const state = sim.world.players[player];
  const stack: Stack | null = state.toolbar[intent.slot] ?? null;
  const tool = stack === null ? null : (sim.content.items[stack.item]?.tool ?? null);
  if (stack === null || tool === null) {
    refuse(sim, player, 'no-tool-in-hand', intent.target);
    return;
  }
  switch (intent.job) {
    case 'upgrade': {
      const up = upgradeAt(sim.content, sim.world, station, stack.item);
      if (up === null || !isPlanKnown(sim.world, up.plan)) {
        refuse(sim, player, up === null ? 'cannot-upgrade' : 'unknown-plan', intent.target);
        return;
      }
      const later = up.plan.delay === 'next-day';
      if (later && orderOf(sim.world, player) !== null) {
        refuse(sim, player, 'order-pending', intent.target);
        return;
      }
      if (state.money < up.cents) {
        refuse(sim, player, 'not-enough-money', intent.target);
        return;
      }
      if (!hasMaterials(sim, player, station, up.materials)) {
        refuse(sim, player, 'missing-materials', intent.target);
        return;
      }
      takeMaterials(sim, player, station, up.materials);
      if (up.cents > 0) pay(sim, player, up.cents);
      const durability = sim.content.items[up.to]?.tool?.durability ?? 0;
      if (later) {
        state.toolbar[intent.slot] = null;
        if (state.selected === intent.slot) state.selected = null;
        const day = sim.world.common.day + 1;
        remember(sim, orderKey(player), `${up.to}@${String(day)}`, player);
        sim.emit({ type: 'tool_ordered', player, item: up.to, day });
      } else {
        state.toolbar[intent.slot] =
          durability === 0
            ? { item: up.to, count: 1 }
            : { item: up.to, count: 1, wear: durability };
      }
      sim.touch('players');
      sim.emit({ type: 'tool_upgraded', player, from: stack.item, to: up.to });
      return;
    }
    case 'repair': {
      const price = repairPrice(sim.content, stack);
      const cost = sim.content.items[stack.item]?.tool?.work?.repair ?? null;
      if (price === null || cost === null) {
        refuse(sim, player, 'cannot-repair', intent.target);
        return;
      }
      if (toolWearRatio(sim.content, stack) >= 1) {
        refuse(sim, player, 'already-sharp', intent.target);
        return;
      }
      if (state.money < price) {
        refuse(sim, player, 'not-enough-money', intent.target);
        return;
      }
      if (!hasMaterials(sim, player, station, cost.items)) {
        refuse(sim, player, 'missing-materials', intent.target);
        return;
      }
      takeMaterials(sim, player, station, cost.items);
      if (price > 0) pay(sim, player, price);
      repairTool(sim, player, stack);
      sim.emit({ type: 'tool_mended', player, item: stack.item, cents: price });
      return;
    }
    case 'sharpen': {
      const rule = CRAFTING.sharpen;
      if (tool.durability === 0 || !rule.kinds.includes(tool.kind)) {
        refuse(sim, player, 'cannot-sharpen', intent.target);
        return;
      }
      const ratio = toolWearRatio(sim.content, stack);
      if (ratio >= rule.cap) {
        refuse(sim, player, ratio >= 1 ? 'already-sharp' : 'sharp-enough', intent.target);
        return;
      }
      if (tooSoon(sim, player, rule.seconds)) return;
      const cap = Math.floor(tool.durability * rule.cap);
      stack.wear = Math.min(cap, (stack.wear ?? 0) + Math.ceil(tool.durability * rule.perTurn));
      sim.touch('players');
      sim.emit({
        type: 'tool_sharpened',
        player,
        item: stack.item,
        ratio: toolWearRatio(sim.content, stack),
      });
      return;
    }
  }
}

function onIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- chaque système ignore les intentions des autres
  switch (intent.type) {
    case 'craft_start':
      start(sim, player, intent);
      return;
    case 'craft_strike':
      strike(sim, player, intent.target);
      return;
    case 'craft_cancel':
      cancel(sim, player, intent.target);
      return;
    case 'craft_tool':
      toolJob(sim, player, intent);
      return;
    default:
      return;
  }
}

export const craftSystem: GameSystem = { id: 'fabrication', intent: onIntent };
