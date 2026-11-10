/**
 * Points d'entrée de la forge (cahier 4.5), sans écran: ce que coûte l'amélioration ou la
 * réparation payée d'un outil, et l'intention qui l'accomplit à côté d'un meuble à brique
 * `repair` qui sert cette sorte d'outil (meule, établi). La réparation gratuite à la meule reste
 * la brique `repair` du sac.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Cost } from '../../donnees/schemas/recolte';
import { findProp, footprintOf } from '../noyau/obstacles';
import type { SimContext } from '../noyau/systemes';
import { pay } from '../sac/argent';
import { countItem, removeItem } from '../sac/inventaire';
import { repairTool } from '../sac/outils';
import { HARVEST_TUNING } from './reglages';

/** L'amélioration d'un outil: l'objet obtenu et son prix, `null` s'il n'y en a pas. */
export function upgradeOf(content: Content, item: string): { to: string; cost: Cost } | null {
  return content.items[item]?.tool?.work?.upgrade ?? null;
}

/** Le prix d'une réparation payée, `null` si l'outil ne se répare pas. */
export function repairCostOf(content: Content, item: string): Cost | null {
  return content.items[item]?.tool?.work?.repair ?? null;
}

/** Ce qui manque pour payer ce prix, `null` si le joueur peut payer. */
export function missingFor(sim: SimContext, player: PlayerIndex, cost: Cost): string | null {
  const state = sim.world.players[player];
  if (state.money < cost.cents) return 'not-enough-money';
  for (const material of cost.items)
    if (countItem(state, material.item) < material.count) return 'missing-materials';
  return null;
}

function payCost(sim: SimContext, player: PlayerIndex, cost: Cost): void {
  if (cost.cents > 0) pay(sim, player, cost.cents);
  for (const material of cost.items)
    removeItem(sim.world.players[player], material.item, material.count);
  sim.touch('players');
}

/** Le meuble `target` sert-il cette sorte d'outil, à portée du joueur ? */
function forgeServes(sim: SimContext, player: PlayerIndex, target: string, kind: string): boolean {
  const place = sim.content.places[sim.world.common.place];
  const state = sim.world.places[sim.world.common.place];
  const prop = place === undefined || state === undefined ? null : findProp(place, state, target);
  const def = prop === null ? undefined : sim.content.props[prop.type];
  if (prop === null || def === undefined) return false;
  const serves = def.bricks.some(
    (brick) => brick.brick === 'repair' && brick.tools.some((tool) => tool === kind),
  );
  const size = footprintOf(def, prop.rotation);
  const { x, y } = sim.world.players[player].body;
  const nx = Math.max(prop.x - size.w / 2, Math.min(x, prop.x + size.w / 2));
  const ny = Math.max(prop.y - size.h / 2, Math.min(y, prop.y + size.h / 2));
  return serves && Math.hypot(x - nx, y - ny) <= HARVEST_TUNING.forgeReach;
}

/** Améliore ou répare (payé) l'outil de la case `slot` de la barre; renvoie la raison d'un refus. */
export function forgeTool(
  sim: SimContext,
  player: PlayerIndex,
  target: string,
  slot: number,
  job: 'upgrade' | 'repair',
): string | null {
  const actor = sim.world.players[player];
  const stack = actor.toolbar[slot] ?? null;
  const tool = stack === null ? null : (sim.content.items[stack.item]?.tool ?? null);
  if (stack === null || tool === null) return 'no-tool-in-hand';
  if (!forgeServes(sim, player, target, tool.kind)) return 'too-far';
  if (job === 'upgrade') {
    const upgrade = upgradeOf(sim.content, stack.item);
    if (upgrade === null) return 'cannot-upgrade';
    const missing = missingFor(sim, player, upgrade.cost);
    if (missing !== null) return missing;
    payCost(sim, player, upgrade.cost);
    const durability = sim.content.items[upgrade.to]?.tool?.durability ?? 0;
    actor.toolbar[slot] =
      durability === 0
        ? { item: upgrade.to, count: 1 }
        : { item: upgrade.to, count: 1, wear: durability };
    sim.touch('players');
    sim.emit({ type: 'tool_upgraded', player, from: stack.item, to: upgrade.to });
    return null;
  }
  const cost = repairCostOf(sim.content, stack.item);
  if (cost === null || tool.durability === 0) return 'cannot-repair';
  if ((stack.wear ?? tool.durability) >= tool.durability) return 'already-sharp';
  const missing = missingFor(sim, player, cost);
  if (missing !== null) return missing;
  payCost(sim, player, cost);
  repairTool(sim, player, stack);
  return null;
}
