/**
 * Système « besoins » (lot L3): faim, sommeil et hygiène baissent avec le temps et l'effort,
 * remontent en mangeant, en se reposant et en se lavant. L'endurance (`endurance.ts`) suit la
 * course et la posture. Un changement de palier part dans la
 * tranche « joueurs » et en événement `need_tier` (le seul moment où le médaillon paraît).
 */
import type { PropDef } from '../../donnees/schemas/meuble';
import { NEED_IDS, type PlayerIndex } from '../../donnees/schemas/communs';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { stackAt, takeOne } from '../sac/inventaire';
import { applyFoodStamina, stepStamina, type StaminaPosture } from './endurance';
import { clampGauge, decayFor, modifiersOf, neutralModifiers, tierFor } from './jauges';
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

/** Modificateurs relus à chaque pas, sans allocation. */
const scratch = neutralModifiers();

/** Posture de l'endurance: couché, assis, en course (au-dessus du pas de marche), en marche, arrêté. */
function postureOf(
  sim: SimContext,
  player: PlayerIndex,
  rest: { lying: boolean } | null,
): StaminaPosture {
  if (rest !== null) return rest.lying ? 'lying' : 'seated';
  const speed = sim.world.players[player].body.speed;
  if (speed <= 0) return 'still';
  const walkTop =
    sim.content.settings.movement.walkSpeed *
    modifiersOf(sim.content, sim.world, player, scratch).speed;
  return speed > walkTop + 1e-6 ? 'run' : 'walk';
}

function stepPlayer(sim: SimContext, player: PlayerIndex): void {
  const state = sim.world.players[player];
  const rest = restOf(sim, player);
  const posture = postureOf(sim, player, rest);
  // Effort: un geste en cours, ou courir pour de bon (essoufflé, la touche de course ne coûte rien).
  const effort = state.gesture !== null || posture === 'run';
  stepStamina(sim, player, posture);
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

/**
 * Repas spécial servi à table: les deux joueurs assis au meuble visé, la pile de la case se
 * consomme. Le renfort d'endurance du plat (`food.stamina`) vaut pour les deux, comme s'ils
 * l'avaient mangé chacun.
 */
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
  const stamina = sim.content.items[stack.item]?.food?.stamina;
  if (stamina !== undefined) for (const p of [0, 1] as const) applyFoodStamina(sim, p, stamina);
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
  if (food.stamina !== undefined) applyFoodStamina(sim, player, food.stamina);
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
