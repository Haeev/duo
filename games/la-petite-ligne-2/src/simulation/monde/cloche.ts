/**
 * Cloche des heures: l'hôte émet `clock_struck` à chaque coup d'une heure pleine sonnée par le
 * clocher; l'invité rejoue l'événement. État de suivi non sauvegardé: après une reprise, la cloche
 * attend l'heure suivante au lieu de sonner celle en cours.
 */
import type { WorldState } from '../../etat/monde';
import type { SimContext } from '../noyau/systemes';
import { recall } from '../regles/memoire';
import { BELL, strokesFor, type BellTuning } from './reglages-cloche';

interface Ringing {
  hour: number;
  strokes: number;
  done: number;
  wait: number;
}
interface BellState {
  hour: number | null;
  ringing: Ringing | null;
}
const states = new WeakMap<WorldState, BellState>();

export function stepBell(sim: SimContext, tuning: BellTuning = BELL): void {
  const { world } = sim;
  let state = states.get(world);
  if (state === undefined) {
    state = { hour: null, ringing: null };
    states.set(world, state);
  }
  const place = world.common.place;
  if (place !== tuning.place) {
    state.hour = null;
    state.ringing = null;
    return;
  }
  const late = recall(world, tuning.repairedFact)?.v === true ? 0 : tuning.lateMinutes;
  const hour = Math.floor(((world.minutes - late + 1440) % 1440) / 60);
  const before = state.hour;
  state.hour = hour;
  // Seule l'heure suivante sonne: un saut (sommeil, trajet) ne fait pas sonner.
  if (before !== null && hour === before + 1 && hour >= tuning.firstHour && hour <= tuning.lastHour)
    state.ringing = { hour, strokes: strokesFor(hour), done: 0, wait: 0 };
  const ringing = state.ringing;
  if (ringing === null) return;
  ringing.wait -= sim.dt;
  if (ringing.wait > 0) return;
  ringing.done += 1;
  ringing.wait = tuning.strokeGapSeconds;
  sim.emit({
    type: 'clock_struck',
    place,
    hour: ringing.hour,
    stroke: ringing.done,
    strokes: ringing.strokes,
  });
  if (ringing.done >= ringing.strokes) state.ringing = null;
}
