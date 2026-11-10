/**
 * L'horloge du jeu. Une seule heure pour tous les lieux; la nuit se joue comme le jour et le
 * lendemain arrive seul à l'aube, où que l'on soit. Dormir à deux saute au matin (brique `sleep`).
 * Rythme et bornes dans `reglages.json` (`clock`): à 125 s par heure de jeu, le jour (6 h à
 * 20 h 30) dure 30 min 12 s réelles et la nuit 19 min 48 s.
 */
import type { Settings } from '../../donnees/schemas/reglages';
import { MINUTES_PER_DAY } from './constantes';
import type { SimContext } from './systemes';

type Clock = Settings['clock'];

export function isNight(clock: Clock, minutes: number): boolean {
  return minutes >= clock.nightStart || minutes < clock.dayStart;
}

/** Heure où dormir à deux fait passer au lendemain: de `sleepFrom` jusqu'à l'aube. */
export function canSkipNight(clock: Clock, minutes: number): boolean {
  return minutes >= clock.sleepFrom || minutes < clock.dayStart;
}

function startDay(sim: SimContext, slept: boolean): void {
  sim.world.common.day += 1;
  sim.touch('common');
  sim.emit({ type: 'day_started', day: sim.world.common.day, slept });
}

/** Avance l'heure de `minutes` minutes de jeu; chaque aube franchie ouvre un nouveau jour. */
export function addMinutes(sim: SimContext, minutes: number): void {
  const { world } = sim;
  const { dayStart } = sim.content.settings.clock;
  const before = world.minutes;
  const after = before + minutes;
  const dawns =
    Math.floor((after - dayStart) / MINUTES_PER_DAY) -
    Math.floor((before - dayStart) / MINUTES_PER_DAY);
  world.minutes = after % MINUTES_PER_DAY;
  for (let i = 0; i < dawns; i++) startDay(sim, false);
}

/** Le temps passe, sauf dans le wagon (le trajet ajoute ses heures d'un coup à l'arrivée). */
export function advanceClock(sim: SimContext): void {
  if (sim.world.common.phase === 'travel') return;
  addMinutes(sim, (sim.dt * 60) / sim.content.settings.clock.secondsPerHour);
}

/** Les deux joueurs dorment: réveil à l'aube du lendemain. */
export function skipToMorning(sim: SimContext): void {
  sim.world.minutes = sim.content.settings.clock.dayStart;
  startDay(sim, true);
}
