/**
 * Système « besoins » (lot L3): faim, sommeil et hygiène baissent avec le temps et l'effort,
 * remontent en mangeant, en se reposant et en se lavant. Un changement de palier part dans la
 * tranche « joueurs » et en événement `need_tier` (le seul moment où le médaillon paraît).
 */
import type { PropDef } from '../../donnees/schemas/meuble';
import { NEED_IDS, type PlayerIndex } from '../../donnees/schemas/communs';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { stackAt, takeOne } from '../sac/inventaire';
import { clampGauge, decayFor, tierFor } from './jauges';
import { expireMealPerks, shareSpecialMeal } from './repas';
import type { SlotRef } from '../sac/cases';
import { relieveNeed } from './soins';

/** Le meuble d'une instance du lieu courant (carte ou posé par un joueur). */
function propOf(sim: SimContext, id: string): PropDef | null {
  const place = sim.world.common.place;
  const type =
    sim.content.places[place]?.map.objects.find((object) => object.id === id)?.type ??
    sim.world.places[place]?.placed.find((prop) => prop.id === id)?.type;
  return type === undefined ? null : (sim.content.props[type] ?? null);
}

/** Où le joueur se repose: assis (et à quel rythme), couché, ou nulle part. */
function restOf(
  sim: SimContext,
  player: PlayerIndex,
): { lying: boolean; perMinute: number } | null {
  const objects = sim.world.places[sim.world.common.place]?.objects;
  if (objects === undefined) return null;
  for (const id in objects) {
    const states = objects[id];
    if (states?.sleep?.includes(player) === true)
      return { lying: true, perMinute: sim.content.settings.rest.napPerMinute };
    if (states?.sit?.includes(player) === true) {
      const brick = propOf(sim, id)?.bricks.find((b) => b.brick === 'sit');
      return { lying: false, perMinute: brick?.brick === 'sit' ? brick.restPerMinute : 0 };
    }
  }
  return null;
}

/** Geste long sur une brique `relieve` (la toilette): le gain vient pas à pas. */
function relieveDuringGesture(sim: SimContext, player: PlayerIndex): void {
  const gesture = sim.world.players[player].gesture;
  const target = gesture?.target ?? null;
  if (gesture === null || target === null || !gesture.long) return;
  const brick = propOf(sim, target)?.bricks.find(
    (b) => b.brick === 'relieve' && b.clip === gesture.clip,
  );
  if (brick?.brick !== 'relieve') return;
  relieveNeed(sim, player, brick.need, (brick.amount / brick.seconds) * sim.dt, brick.cap);
}

function stepPlayer(sim: SimContext, player: PlayerIndex): void {
  const state = sim.world.players[player];
  const input = sim.inputs[player];
  // Effort: un geste en cours, ou courir (même contre un obstacle).
  const effort = state.gesture !== null || (input.run && (input.moveX !== 0 || input.moveY !== 0));
  const rest = restOf(sim, player);
  relieveDuringGesture(sim, player);
  for (const need of NEED_IDS) {
    if (need === 'sleep' && rest !== null) {
      state.needs.sleep = clampGauge(state.needs.sleep + (rest.perMinute / 60) * sim.dt);
      continue;
    }
    state.needs[need] = clampGauge(state.needs[need] - decayFor(sim.content, need, sim.dt, effort));
  }
  let changed = false;
  for (const need of NEED_IDS) {
    const previous = state.tiers[need];
    const next = tierFor(sim.content, need, state.needs[need], previous);
    if (next === previous) continue;
    state.tiers[need] = next;
    changed = true;
    sim.emit({ type: 'need_tier', player, need, state: next });
  }
  if (changed) sim.touch('players');
}

/** Repas spécial servi à table: les deux joueurs assis au meuble visé, la pile de la case se consomme. */
function serveMeal(sim: SimContext, player: PlayerIndex, from: SlotRef, target: string): void {
  const state = sim.world.players[player];
  const stack = stackAt(state, from);
  const perk = stack === null ? undefined : sim.content.items[stack.item]?.meal?.perk;
  if (stack === null || perk === undefined) {
    sim.emit({ type: 'refused', player, reason: 'not-a-meal', target });
    return;
  }
  const refusal = shareSpecialMeal(sim, target, perk);
  if (refusal !== null) {
    sim.emit({ type: 'refused', player, reason: refusal, target });
    return;
  }
  takeOne(state, from);
  sim.touch('players');
}

function onIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  if (intent.type === 'serve_meal') {
    serveMeal(sim, player, intent.from, intent.target);
    return;
  }
  if (intent.type !== 'eat') return;
  const state = sim.world.players[player];
  const stack = stackAt(state, intent.from);
  const food = stack === null ? null : (sim.content.items[stack.item]?.food ?? null);
  if (stack === null || food === null) {
    sim.emit({ type: 'refused', player, reason: 'not-edible', target: null });
    return;
  }
  takeOne(state, intent.from);
  relieveNeed(sim, player, 'hunger', food.hunger);
  sim.touch('players');
  sim.emit({ type: 'ate', player, item: stack.item });
}

export const needsSystem: GameSystem = {
  id: 'besoins',
  intent: onIntent,
  step(sim) {
    stepPlayer(sim, 0);
    stepPlayer(sim, 1);
    expireMealPerks(sim);
  },
};
