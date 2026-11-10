/**
 * Ce qui remonte ou baisse les jauges hors de l'usure du temps: manger, se laver, dormir, se
 * salir. Les jauges partent sur le canal rapide (aucun `touch`); le palier suit au pas suivant.
 */
import type { NeedId, PlayerIndex } from '../../donnees/schemas/communs';
import type { SimContext } from '../noyau/systemes';
import { RULES } from '../regles/reglages';
import { clampGauge } from './jauges';

/** Ajoute `amount` à un besoin sans dépasser `cap`; une jauge déjà au-dessus de `cap` ne baisse pas. */
export function relieveNeed(
  sim: SimContext,
  player: PlayerIndex,
  need: NeedId,
  amount: number,
  cap = 100,
): void {
  const needs = sim.world.players[player].needs;
  const before = needs[need];
  if (amount >= 0) needs[need] = before >= cap ? before : Math.min(cap, before + amount);
  else needs[need] = clampGauge(before + amount);
}

/** Réveil après une nuit au lit (cahier 4.4): sommeil au niveau du lit, faim et hygiène en baisse. */
export function wakeUp(sim: SimContext, player: PlayerIndex, wakeAt: number): void {
  const needs = sim.world.players[player].needs;
  needs.sleep = Math.max(needs.sleep, clampGauge(wakeAt));
  needs.hunger = clampGauge(needs.hunger - RULES.needs.nightHungerLoss);
  needs.hygiene = clampGauge(needs.hygiene - RULES.needs.nightHygieneLoss);
}

/** Un geste salissant (bêcher, fouiller): appelé par les briques concernées. */
export function soil(sim: SimContext, player: PlayerIndex, times = 1): void {
  relieveNeed(sim, player, 'hygiene', -RULES.needs.dirtyGestureLoss * times);
}
