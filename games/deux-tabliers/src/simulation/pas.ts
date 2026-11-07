/**
 * Un pas de simulation chez l'hôte: déplacements, intentions dans l'ordre d'arrivée (arbitrage:
 * premier arrivé l'emporte), postes à maintien, puis les systèmes des chantiers.
 */
import type { RandomSource } from '@duo/sdk';
import type { Content } from '../donnees/charger';
import type { PlayerIndex, World } from '../etat/monde';
import { CHANTIERS, stationHandler } from './chantiers';
import { walk } from './deplacement';
import type { Intent, StepInput, Target } from './entrees';
import type { GameEvent } from './evenements';
import { planAct, planDrop, targetDistance, type ActPlan } from './interactions';
import { furnitureById, furnitureType, objectById, objectOnSlot } from './monde';
import type { SimContext } from './systemes';

export interface QueuedIntent {
  readonly player: PlayerIndex;
  readonly intent: Intent;
}

/** Tolérance de portée chez l'hôte: le joueur a visé un pas plus tôt, sur sa propre image. */
const REACH_TOLERANCE = 0.4;

export function stepWorld(
  content: Content,
  world: World,
  inputs: readonly [StepInput, StepInput],
  intents: readonly QueuedIntent[],
  dt: number,
  random: RandomSource,
  emit: (event: GameEvent) => void,
): void {
  const sim: SimContext = { world, content, dt, random, inputs, emit };
  walk(content, world, world.players[0], inputs[0], dt);
  walk(content, world, world.players[1], inputs[1], dt);
  for (const { player, intent } of intents) applyIntent(sim, player, intent);
  for (const index of [0, 1] as const) advanceUse(sim, index);
  for (const c of CHANTIERS) c.system.step?.(sim);
  world.tick++;
}

function inReach(sim: SimContext, player: PlayerIndex, target: Target): boolean {
  const d = targetDistance(sim.content, sim.world, player, target);
  const reach =
    target.kind === 'player'
      ? sim.content.settings.player.giveReach
      : sim.content.settings.player.reach;
  return d !== null && d <= reach + REACH_TOLERANCE;
}

function applyIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  // Un `if` plutôt qu'un `switch`: la règle d'exhaustivité d'ESLint exigerait chaque intention
  // des chantiers ici.
  if (intent.type === 'act' || intent.type === 'drop') {
    if (!inReach(sim, player, intent.target)) {
      sim.emit({ type: 'refused', player, reason: 'Trop loin' });
      return;
    }
    const plan =
      intent.type === 'act'
        ? planAct(sim.content, sim.world, player, intent.target)
        : planDrop(sim.world, player, intent.target);
    execute(sim, player, plan);
    return;
  }
  for (const c of CHANTIERS) c.system.intent?.(sim, player, intent);
}

function execute(sim: SimContext, player: PlayerIndex, plan: ActPlan): void {
  const { world } = sim;
  switch (plan.kind) {
    case 'refuse':
      sim.emit({ type: 'refused', player, reason: plan.reason });
      return;
    case 'take':
    case 'take-to-tray': {
      const o = objectById(world, plan.object);
      if (o === undefined) return;
      o.at =
        plan.kind === 'take'
          ? { kind: 'hand', player }
          : { kind: 'tray', tray: plan.tray, place: plan.place };
      sim.emit({ type: 'taken', player, object: o.id, objectType: o.type });
      return;
    }
    case 'take-source': {
      const id = world.nextObjectId++;
      world.objects.push({
        id,
        type: plan.objectType,
        at:
          plan.tray === null
            ? { kind: 'hand', player }
            : { kind: 'tray', tray: plan.tray, place: plan.place },
      });
      sim.emit({ type: 'taken', player, object: id, objectType: plan.objectType });
      return;
    }
    case 'place': {
      const o = objectById(world, plan.object);
      if (o === undefined) return;
      o.at = { kind: 'slot', furniture: plan.furniture, slot: plan.slot };
      sim.emit({ type: 'placed', player, object: o.id, objectType: o.type });
      return;
    }
    case 'give': {
      const o = objectById(world, plan.object);
      if (o === undefined) return;
      o.at = { kind: 'hand', player: plan.to };
      sim.emit({ type: 'given', from: player, to: plan.to, object: o.id });
      return;
    }
    case 'use': {
      const refusal = stationHandler(plan.station)?.refuse?.(sim, player, plan.furniture) ?? null;
      if (refusal !== null) {
        sim.emit({ type: 'refused', player, reason: refusal });
        return;
      }
      const type = sim.content.stations.get(plan.station);
      if (type === undefined) return;
      if (type.use === 'click') completeUse(sim, player, plan.furniture);
      else world.players[player].use = { furniture: plan.furniture, elapsed: 0 };
      return;
    }
  }
}

/** Maintien: le temps compte tant qu'« Agir » est tenu; relâché trop tôt, rien n'est perdu ni fait. */
function advanceUse(sim: SimContext, player: PlayerIndex): void {
  const state = sim.world.players[player];
  const use = state.use;
  if (use === null) return;
  const placed = furnitureById(sim.world, use.furniture);
  const stationId = placed === undefined ? null : furnitureType(sim.content, placed).station;
  const type = stationId === null ? undefined : sim.content.stations.get(stationId);
  if (type === undefined || !sim.inputs[player].actHeld) {
    state.use = null;
    return;
  }
  use.elapsed += sim.dt;
  if (use.elapsed + 1e-9 >= type.seconds) {
    state.use = null;
    completeUse(sim, player, use.furniture);
  }
}

function completeUse(sim: SimContext, player: PlayerIndex, furniture: string): void {
  const placed = furnitureById(sim.world, furniture);
  const stationId = placed === undefined ? null : furnitureType(sim.content, placed).station;
  const type = stationId === null ? undefined : sim.content.stations.get(stationId);
  if (type === undefined || stationId === null) return;
  const onSlot = objectOnSlot(sim.world, furniture, type.slot);
  const transform =
    onSlot === undefined ? undefined : type.transforms.find((t) => t.from === onSlot.type);
  if (onSlot !== undefined && transform !== undefined) onSlot.type = transform.to;
  stationHandler(stationId)?.complete?.(sim, player, furniture);
  sim.emit({ type: 'station-done', player, furniture, station: stationId });
}
