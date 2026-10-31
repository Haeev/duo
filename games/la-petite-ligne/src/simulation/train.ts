/**
 * Le train du samedi (TE-05): arrivée à 10 h, départ à 16 h, glissement
 * d'entrée et de sortie; colis du catalogue et témoins de l'arrivée.
 */
import { catalogueWindow } from '../donnees/commandes';
import { type Sim, bump, distance, emit, say } from './contexte';
import { deliverCatalogue } from './economie';
import { POINT } from './ids';

/** L'heure `t` a-t-elle été franchie entre deux lectures de l'horloge ? */
export function crossed(before: number, after: number, t: number): boolean {
  return before < t && after >= t;
}

function witnesses(sim: Sim, event: string): void {
  const at = sim.map.points[POINT.trainStop];
  if (at === undefined) return;
  for (const c of sim.world.characters) {
    if (distance(c.pos, at) <= sim.content.settings.ranges.witness) bump(sim, `witnessed:${event}`, c.id);
  }
}

/** Événements du train liés à l'heure (appelée quand l'horloge avance). */
export function trainClock(sim: Sim, before: number, after: number): void {
  const s = sim.content.settings;
  const { day } = sim.world.clock;
  if (!s.train.days.includes(day)) return;
  const train = sim.world.train;
  if (day !== s.clock.firstDay.day && crossed(before, after, s.train.arrival)) {
    train.phase = 'arriving';
    train.progress = 0;
    sim.runtime.dynamicDirty = true;
    emit(sim, { type: 'train_whistle' });
    emit(sim, { type: 'train_arriving' });
    say(sim, 'both', 'train_arrived');
    witnesses(sim, 'train_arrival');
  }
  const delivery = catalogueWindow(s, day).delivery;
  if (day === delivery.day && crossed(before, after, delivery.time)) deliverCatalogue(sim);
  if (day !== s.clock.firstDay.day && crossed(before, after, s.train.departure - s.feel.trainWarningMinutes)) {
    say(sim, 'both', 'train_leaves_soon');
  }
  if (crossed(before, after, s.train.departure) && train.phase !== 'away') {
    train.phase = 'departing';
    emit(sim, { type: 'train_whistle' });
    emit(sim, { type: 'train_departing' });
    witnesses(sim, 'train_departure');
  }
}

/** Glissement du train, en temps réel (il roule même horloge arrêtée). */
export function updateTrain(sim: Sim, dt: number): void {
  const train = sim.world.train;
  train.prevProgress = train.progress;
  const rate = dt / sim.content.settings.feel.trainSlideSeconds;
  if (train.phase === 'arriving') {
    train.progress = Math.min(1, train.progress + rate);
    if (train.progress >= 1) train.phase = 'stopped';
    sim.runtime.changed = true;
  } else if (train.phase === 'departing') {
    train.progress = Math.max(0, train.progress - rate);
    if (train.progress <= 0) {
      train.phase = 'away';
      sim.runtime.dynamicDirty = true;
    }
    sim.runtime.changed = true;
  }
}
