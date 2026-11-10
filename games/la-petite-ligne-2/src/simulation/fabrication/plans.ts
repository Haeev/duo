/**
 * Lecture des plans et des postes, sans rien modifier: utilisable par l'hôte, l'invité et
 * l'interface. Le moteur ne nomme aucun plan: tout vient de `donnees/commun/plans/`.
 */
import type { Content } from '../../donnees/charger';
import type { Brick } from '../../donnees/schemas/briques';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { CraftService, PlanDef } from '../../donnees/schemas/plan';
import type { Stack } from '../../etat/joueur';
import type { DeepReadonly, ReadonlyWorld } from '../../etat/monde';
import type { Look } from '../briques/types';
import { findProp, footprintOf } from '../noyau/obstacles';
import { repairCostOf, upgradeOf } from '../outils/forge';
import { toolWearRatio } from '../sac/outils';
import { CRAFTING } from './reglages';

export type CraftBrick = Extract<Brick, { brick: 'craft' }>;

export function planKey(plan: string): string {
  return `${CRAFTING.memoryPrefix}${plan}`;
}

export function orderKey(player: PlayerIndex): string {
  return `${CRAFTING.orderPrefix}j${String(player)}`;
}

/** Connu: dès le début, ou retenu en mémoire (habitant, quête, papier lu, déjà fabriqué). */
export function isPlanKnown(world: ReadonlyWorld, plan: DeepReadonly<PlanDef>): boolean {
  if (plan.source === 'start') return true;
  const fact = world.progress.memory[planKey(plan.id)];
  return fact !== undefined && fact.v !== false;
}

/** Fabrications déjà faites de ce plan par le duo. */
export function timesMade(world: ReadonlyWorld, plan: string): number {
  const value = world.progress.memory[planKey(plan)]?.v;
  return typeof value === 'number' ? value : 0;
}

/** Ce que donne le plan pour cette variante (couleur d'un meuble); `null` pour une amélioration. */
export function planOutput(
  plan: DeepReadonly<PlanDef>,
  variant: number,
): { item: string; count: number } | null {
  switch (plan.makes.kind) {
    case 'furniture': {
      const chosen = plan.makes.variants[variant];
      return chosen === undefined ? null : { item: chosen.item, count: 1 };
    }
    case 'item':
      return { item: plan.makes.item, count: plan.makes.count };
    case 'upgrade':
      return null;
  }
}

export interface Station {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly brick: CraftBrick;
}

/** Le poste `target` du lieu courant (meuble à brique `craft`), ou `null`. */
export function stationOf(look: Look, target: string): Station | null {
  const place = look.content.places[look.world.common.place];
  const state = look.world.places[look.world.common.place];
  if (place === undefined || state === undefined) return null;
  const prop = findProp(place, state, target);
  const def = prop === null ? undefined : look.content.props[prop.type];
  const brick = def?.bricks.find((b): b is CraftBrick => b.brick === 'craft');
  if (prop === null || brick === undefined) return null;
  return { id: prop.id, x: prop.x, y: prop.y, brick };
}

/** Le joueur est-il à portée du poste (bord de son emprise) ? */
export function nearStation(look: Look, player: PlayerIndex, target: string): boolean {
  const place = look.content.places[look.world.common.place];
  const state = look.world.places[look.world.common.place];
  const prop = place === undefined || state === undefined ? null : findProp(place, state, target);
  const def = prop === null ? undefined : look.content.props[prop.type];
  if (prop === null || def === undefined) return false;
  const size = footprintOf(def, prop.rotation);
  const { x, y } = look.world.players[player].body;
  const nx = Math.max(prop.x - size.w / 2, Math.min(x, prop.x + size.w / 2));
  const ny = Math.max(prop.y - size.h / 2, Math.min(y, prop.y + size.h / 2));
  return Math.hypot(x - nx, y - ny) <= CRAFTING.reach;
}

export function offers(station: Station, service: CraftService): boolean {
  return station.brick.services.includes(service);
}

/** Identifiants des coffres (brique `store`) proches du poste: ceux de la maison. */
export function chestsNear(look: Look, station: Station): string[] {
  const place = look.content.places[look.world.common.place];
  const state = look.world.places[look.world.common.place];
  if (place === undefined || state === undefined) return [];
  const out: string[] = [];
  for (const prop of [...place.map.objects, ...state.placed]) {
    const def = look.content.props[prop.type];
    if (def?.bricks.some((b) => b.brick === 'store') !== true) continue;
    if (Math.hypot(prop.x - station.x, prop.y - station.y) <= CRAFTING.chestReach)
      out.push(prop.id);
  }
  return out;
}

function countIn(slots: readonly (DeepReadonly<Stack> | null)[] | undefined, item: string): number {
  let total = 0;
  for (const stack of slots ?? []) if (stack?.item === item) total += stack.count;
  return total;
}

/** Exemplaires de cet objet: dans les poches du joueur, et dans les coffres proches du poste. */
export function materialCount(
  look: Look,
  player: PlayerIndex,
  station: Station | null,
  item: string,
): { pockets: number; chests: number } {
  const state = look.world.players[player];
  const pockets = countIn(state.toolbar, item) + countIn(state.bag?.slots, item);
  let chests = 0;
  const place = look.world.places[look.world.common.place];
  if (station !== null && place !== undefined)
    for (const id of chestsNear(look, station)) chests += countIn(place.objects[id]?.store, item);
  return { pockets, chests };
}

/** Plans de ce poste pour cet usage, connus d'abord, puis par nom. */
export function plansAt(
  content: Content,
  world: ReadonlyWorld,
  station: Station,
  service: 'make' | 'upgrade',
): { plan: PlanDef; known: boolean }[] {
  return Object.values(content.plans)
    .filter(
      (plan) =>
        plan.station === station.brick.station &&
        (plan.makes.kind === 'upgrade') === (service === 'upgrade'),
    )
    .map((plan) => ({ plan, known: isPlanKnown(world, plan) }))
    .sort((a, b) => Number(b.known) - Number(a.known) || a.plan.id.localeCompare(b.plan.id));
}

/** Prix de la réparation payée de cet outil, selon son usure; `null` s'il ne se répare pas. */
export function repairPrice(content: Content, stack: DeepReadonly<Stack>): number | null {
  const cost = repairCostOf(content, stack.item);
  const durability = content.items[stack.item]?.tool?.durability ?? 0;
  if (cost === null || durability === 0) return null;
  const worn = 1 - toolWearRatio(content, stack);
  const step = CRAFTING.repairStep;
  return Math.ceil((cost.cents * worn) / step) * step;
}

/** L'amélioration de cet outil à ce poste: le plan, l'outil obtenu et son prix. */
export function upgradeAt(
  content: Content,
  world: ReadonlyWorld,
  station: Station,
  item: string,
): {
  plan: PlanDef;
  to: string;
  cents: number;
  materials: readonly { item: string; count: number }[];
} | null {
  const upgrade = upgradeOf(content, item);
  if (upgrade === null) return null;
  const found = plansAt(content, world, station, 'upgrade').find(
    ({ plan }) => plan.makes.kind === 'upgrade' && plan.makes.from === item,
  );
  if (found === undefined) return null;
  return {
    plan: found.plan,
    to: upgrade.to,
    cents: upgrade.cost.cents,
    materials: upgrade.cost.items,
  };
}

/** Commande en cours chez l'artisan: l'outil et le jour où il est prêt. */
export function orderOf(
  world: ReadonlyWorld,
  player: PlayerIndex,
): { item: string; day: number } | null {
  const value = world.progress.memory[orderKey(player)]?.v;
  if (typeof value !== 'string' || value === '') return null;
  const [item, day] = value.split('@');
  const n = Number(day);
  return item === undefined || item === '' || !Number.isInteger(n) ? null : { item, day: n };
}
