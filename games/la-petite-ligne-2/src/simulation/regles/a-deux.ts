/**
 * Gestes à deux (cahier R12): un travail fait à deux va deux fois plus vite (les coups des deux
 * s'additionnent déjà) et rapporte `RULES.together.lootFactor` fois plus, quand chacun a frappé
 * le même point de récolte ou le même établi dans la fenêtre `windowSeconds` avant le dernier
 * coup. Les coups se retiennent hors de l'état, comme un geste: rien ne change dans la sauvegarde
 * ni sur le réseau, et seul l'hôte décide du butin.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import { SIM_HZ } from '../noyau/constantes';
import type { SimContext } from '../noyau/systemes';
import { RULES } from './reglages';

const strikes = new WeakMap<object, Map<string, [number, number]>>();

function strikesOf(sim: SimContext): Map<string, [number, number]> {
  let found = strikes.get(sim.world);
  if (found === undefined) {
    found = new Map();
    strikes.set(sim.world, found);
  }
  return found;
}

function keyOf(sim: SimContext, target: string): string {
  return `${sim.world.common.place}/${target}`;
}

/** Retient le coup de ce joueur sur cette cible (point de récolte, établi), à ce pas. */
export function noteStrike(sim: SimContext, player: PlayerIndex, target: string): void {
  const all = strikesOf(sim);
  const key = keyOf(sim, target);
  const ticks = all.get(key) ?? [-Infinity, -Infinity];
  ticks[player] = sim.world.tick;
  all.set(key, ticks);
}

/**
 * Le travail qui s'achève sur cette cible a-t-il été fait à deux (les deux coups dans la fenêtre) ?
 * La mémoire de la cible s'efface: le travail suivant repart de zéro.
 */
export function finishedTogether(sim: SimContext, target: string): boolean {
  const all = strikesOf(sim);
  const key = keyOf(sim, target);
  const ticks = all.get(key);
  all.delete(key);
  if (ticks === undefined) return false;
  const window = RULES.together.windowSeconds * SIM_HZ;
  return ticks.every((tick) => sim.world.tick - tick <= window);
}

/** Quantité d'un butin fait à deux: multipliée, la part fractionnaire tirée à l'aléa à graine. */
export function togetherCount(sim: SimContext, count: number): number {
  const raw = count * RULES.together.lootFactor;
  const whole = Math.floor(raw);
  const rest = raw - whole;
  return rest > 1e-9 && sim.random.chance(rest) ? whole + 1 : whole;
}
