/**
 * Système « temps du monde »: tient `common.weather` et `common.outlook` à jour pour le lieu
 * courant, annonce la pluie aux cultures, ouvre et ferme les événements du calendrier (faits
 * écrits au nom du duo). Tout le reste se lit par les fonctions pures de ce dossier.
 */
import type { WorldState } from '../../etat/monde';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { remember } from '../regles/memoire';
import { noteMemories } from '../regles/souvenirs';
import { activeEvents, announcedFor } from './agenda';
import { morningWeather, weatherAt } from './meteo';

/**
 * Ce que le système a vu au pas précédent. Non sauvegardé: après une reprise, les événements en
 * cours repartent (`calendar_started` de nouveau, faits réécrits à l'identique).
 */
interface Seen {
  place: string;
  day: number;
  active: Set<string>;
  wateredOn: number;
}
const seen = new WeakMap<WorldState, Seen>();

function updateOutlook(sim: SimContext, announce: boolean): void {
  const { world, content } = sim;
  const { place, day } = world.common;
  const weather = morningWeather(content, world.seed, place, day + 1);
  const events = announcedFor(sim, day + 1)
    .map((e) => e.id)
    .slice(0, 8);
  const before = world.common.outlook;
  const same =
    before?.weather === weather &&
    before.events.length === events.length &&
    before.events.every((e, i) => e === events[i]);
  if (!same) {
    world.common.outlook = { weather, events };
    sim.touch('common');
  }
  if (announce) sim.emit({ type: 'outlook_ready', place, day: day + 1, weather, events });
}

function step(sim: SimContext): void {
  const { world, content } = sim;
  if (world.common.phase === 'travel') return;
  const { place, day } = world.common;
  let memo = seen.get(world);
  // Premier pas d'une partie neuve ou reprise: l'état se met à jour sans rien annoncer.
  const fresh = memo === undefined;
  if (memo === undefined) {
    memo = { place: '', day: 0, active: new Set(), wateredOn: 0 };
    seen.set(world, memo);
  }

  const weather = weatherAt(content, world.seed, place, day, world.minutes);
  if (world.common.weather !== weather) {
    world.common.weather = weather;
    sim.touch('common');
    if (!fresh) sim.emit({ type: 'weather_changed', place, weather });
  }
  if (content.time.file.wateringWeathers.includes(weather) && memo.wateredOn !== day) {
    memo.wateredOn = day;
    sim.emit({ type: 'rain_watered', place, day });
  }

  if (memo.place !== place || memo.day !== day) {
    if (memo.place !== place) memo.active.clear();
    memo.place = place;
    memo.day = day;
    updateOutlook(sim, !fresh);
  }

  const active = activeEvents(sim);
  const now = new Set(active.map((e) => e.id));
  for (const id of memo.active)
    if (!now.has(id)) sim.emit({ type: 'calendar_ended', place, event: id });
  for (const event of active) {
    if (memo.active.has(event.id)) continue;
    for (const fact of event.activates.facts) remember(sim, fact.key, fact.value, 'duo');
    sim.emit({ type: 'calendar_started', place, event: event.id });
  }
  memo.active = now;
  noteMemories(sim);
}

export const worldTimeSystem: GameSystem = { id: 'monde', step };
