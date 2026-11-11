/**
 * Endurance (réponse du client du 2026-11-11): la course vide la jauge, la marche la recharge,
 * plus vite à l'arrêt, assis et couché. Vide, on marche (sans autre peine) jusqu'au seuil de
 * reprise: la course ne clignote pas. Un plat peut la renforcer (`food.stamina` d'un objet).
 * Réglages: section `stamina` de `donnees/commun/besoins.json`. La faim reste la vraie dépense de
 * la course (`effortFactor`), l'endurance n'en est que le rythme.
 *
 * Pur et déterministe: l'hôte l'applique à chaque pas; la prédiction de l'invité ne lit que
 * `canRun`, qui dépend de l'état lent qu'il reçoit (`staminaMods.winded`).
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { FoodStamina } from '../../donnees/schemas/endurance';
import type { StaminaMods } from '../../etat/endurance';
import type { ReadonlyWorld } from '../../etat/monde';
import { SIM_HZ } from '../noyau/constantes';
import type { SimContext } from '../noyau/systemes';

/** Posture qui règle la recharge. */
export type StaminaPosture = 'run' | 'walk' | 'still' | 'seated' | 'lying';

/** Le joueur peut-il courir ? Non tant qu'il est essoufflé. */
export function canRun(world: ReadonlyWorld, player: PlayerIndex): boolean {
  return !world.players[player].staminaMods.winded;
}

/** Capacité au pas `tick`: 1, plus le renfort de capacité en cours. */
export function staminaCapacity(mods: Readonly<StaminaMods>, tick: number): number {
  return mods.capacity !== null && tick < mods.capacity.until ? 1 + mods.capacity.extra : 1;
}

/** Facteur de recharge au pas `tick`: 1, ou celui du renfort en cours. */
export function recoveryFactor(mods: Readonly<StaminaMods>, tick: number): number {
  return mods.recovery !== null && tick < mods.recovery.until ? mods.recovery.factor : 1;
}

/** Un renfort est-il actif à ce pas ? */
export function staminaBoosted(mods: Readonly<StaminaMods>, tick: number): boolean {
  return staminaCapacity(mods, tick) > 1 || recoveryFactor(mods, tick) > 1;
}

/** Retire les renforts finis; la jauge redescend à la capacité de base. Vrai si l'état lent change. */
function expireBoosts(sim: SimContext, player: PlayerIndex): boolean {
  const state = sim.world.players[player];
  const mods = state.staminaMods;
  const tick = sim.world.tick;
  let changed = false;
  if (mods.capacity !== null && tick >= mods.capacity.until) {
    mods.capacity = null;
    state.stamina = Math.min(state.stamina, 1);
    changed = true;
  }
  if (mods.recovery !== null && tick >= mods.recovery.until) {
    mods.recovery = null;
    changed = true;
  }
  return changed;
}

/** Passe l'essoufflement selon la jauge. Vrai s'il change. */
function updateWinded(sim: SimContext, player: PlayerIndex): boolean {
  const state = sim.world.players[player];
  const mods = state.staminaMods;
  const recoverAt = sim.content.needs.stamina.recoverAt;
  if (!mods.winded && state.stamina <= 0) {
    mods.winded = true;
    return true;
  }
  if (mods.winded && state.stamina >= recoverAt) {
    mods.winded = false;
    return true;
  }
  return false;
}

/** Un pas d'endurance pour ce joueur, dans la posture donnée. */
export function stepStamina(sim: SimContext, player: PlayerIndex, posture: StaminaPosture): void {
  const state = sim.world.players[player];
  const settings = sim.content.needs.stamina;
  let changed = expireBoosts(sim, player);
  const tick = sim.world.tick;
  const capacity = staminaCapacity(state.staminaMods, tick);
  if (posture === 'run') state.stamina -= sim.dt / settings.runSeconds;
  else {
    const seconds = settings.refillSeconds[posture];
    state.stamina += (sim.dt / seconds) * recoveryFactor(state.staminaMods, tick);
  }
  state.stamina = Math.max(0, Math.min(capacity, state.stamina));
  changed = updateWinded(sim, player) || changed;
  if (changed) sim.touch('players');
}

/** Pas de renfort plus court qu'un pas. */
function ticksOf(seconds: number): number {
  return Math.max(1, Math.round(seconds * SIM_HZ));
}

/**
 * Applique le renfort d'un plat. Deux renforts du même genre ne s'additionnent pas: on garde le
 * plus fort et la fin la plus tardive (« on ne devient pas un dieu parce qu'on a dîné »).
 */
export function applyFoodStamina(sim: SimContext, player: PlayerIndex, fx: FoodStamina): void {
  const state = sim.world.players[player];
  const mods = state.staminaMods;
  const tick = sim.world.tick;
  if (fx.capacity !== undefined) {
    const until = tick + ticksOf(fx.capacity.seconds);
    const active = mods.capacity !== null && tick < mods.capacity.until ? mods.capacity : null;
    mods.capacity = {
      extra: Math.max(active?.extra ?? 0, fx.capacity.extra),
      until: Math.max(active?.until ?? 0, until),
    };
  }
  if (fx.recovery !== undefined) {
    const until = tick + ticksOf(fx.recovery.seconds);
    const active = mods.recovery !== null && tick < mods.recovery.until ? mods.recovery : null;
    mods.recovery = {
      factor: Math.max(active?.factor ?? 1, fx.recovery.factor),
      until: Math.max(active?.until ?? 0, until),
    };
  }
  const capacity = staminaCapacity(mods, tick);
  if (fx.refill !== undefined) state.stamina = Math.min(capacity, state.stamina + fx.refill);
  updateWinded(sim, player);
  sim.touch('players');
}

/** Réveil après une nuit au lit: jauge pleine, souffle repris; les renforts suivent leur durée. */
export function restStamina(sim: SimContext, player: PlayerIndex): void {
  const state = sim.world.players[player];
  state.stamina = Math.max(state.stamina, 1);
  if (state.staminaMods.winded) {
    state.staminaMods.winded = false;
    sim.touch('players');
  }
}
