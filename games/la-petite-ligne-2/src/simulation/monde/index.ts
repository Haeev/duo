/**
 * Système « temps du monde »: tient `common.weather` et `common.outlook` à jour pour le lieu
 * courant, annonce la pluie aux cultures, ouvre et ferme les événements du calendrier (faits
 * écrits au nom du duo, jour du début `agenda.<lieu>.<événement>` que lit `event_is`, décisions
 * rejouables rouvertes). Tout le reste se lit par les fonctions pures de ce dossier.
 */
import type { WorldState } from '../../etat/monde';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { decisionsReopenedBy, reopenDecision } from '../quetes/decisions';
import { remember } from '../regles/memoire';
import { noteMemories } from '../regles/souvenirs';
import { activeEvents, announcedFor } from './agenda';
import { eventDayKey } from './calendrier';
import { freePlayer } from '../noyau/deblocage';
import { stopPlayer } from '../noyau/deplacement';
import { stepBell } from './cloche';
import { morningWeather, weatherAt } from './meteo';
import { crossingBellRinging, touchesTrain, trainsPresent } from './trains';

const PLAYERS = [0, 1] as const;

/**
 * Un joueur surpris sur la voie quand un train d'événement arrive (ou chargé là en plein
 * événement): il est posé sur la case libre la plus proche, sans dommage ni arrêt de la partie.
 */
function clearTrainPath(sim: SimContext): void {
  const { world, content } = sim;
  const place = content.places[world.common.place];
  if (place === undefined || !trainsPresent(sim, place)) return;
  const radius = content.settings.movement.radius;
  for (const player of PLAYERS) {
    const body = world.players[player].body;
    if (!touchesTrain(sim, place, body.x, body.y, radius)) continue;
    if (!freePlayer(content, world, player)) continue;
    stopPlayer(sim, player);
    sim.touch('players');
    sim.emit({ type: 'unstuck', player });
  }
}

/**
 * Sonnerie des passages à niveau: elle part quand une rame qui va passer sur une route approche
 * (début du freinage) ou démarre, et se tait quand la route est dégagée (`trains.ts`). Après une
 * reprise en pleine approche, elle repart.
 */
function ringCrossings(sim: SimContext, memo: Seen): void {
  const place = sim.content.places[sim.world.common.place];
  const ringing = place !== undefined && crossingBellRinging(sim, place);
  if (ringing === memo.ringing) return;
  memo.ringing = ringing;
  sim.emit({ type: 'crossing_bell', place: sim.world.common.place, ringing });
}

/**
 * Ce que le système a vu au pas précédent. Non sauvegardé: après une reprise, les événements en
 * cours repartent (`calendar_started` de nouveau, faits réécrits à l'identique).
 */
interface Seen {
  place: string;
  day: number;
  active: Set<string>;
  wateredOn: number;
  /** La sonnerie des passages à niveau sonnait au pas précédent. */
  ringing: boolean;
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
    memo = { place: '', day: 0, active: new Set(), wateredOn: 0, ringing: false };
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
    if (memo.place !== place) {
      memo.active.clear();
      memo.ringing = false;
    }
    memo.place = place;
    memo.day = day;
    updateOutlook(sim, !fresh);
  }

  const active = activeEvents(sim);
  const now = new Set(active.map((e) => e.id));
  for (const id of memo.active)
    if (!now.has(id)) sim.emit({ type: 'calendar_ended', place, event: id });
  for (const event of active) {
    // Début de l'occurrence du jour (une fois, même après une reprise): `event_is` le lit, et
    // les décisions rejouables de cet événement se rouvrent.
    const key = eventDayKey(place, event.id);
    if (world.progress.memory[key]?.v !== day) {
      for (const decision of decisionsReopenedBy(content, event.id)) reopenDecision(sim, decision);
      remember(sim, key, day, 'duo');
    }
    if (memo.active.has(event.id)) continue;
    for (const fact of event.activates.facts) remember(sim, fact.key, fact.value, 'duo');
    sim.emit({ type: 'calendar_started', place, event: event.id });
  }
  memo.active = now;
  clearTrainPath(sim);
  ringCrossings(sim, memo);
  noteMemories(sim);
  stepBell(sim);
}

export const worldTimeSystem: GameSystem = { id: 'monde', step };
