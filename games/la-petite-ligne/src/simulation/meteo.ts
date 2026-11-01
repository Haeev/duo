/**
 * Météo de la partie (tour 8, section 3): la météo écrite des jours de la démo, puis la météo
 * tirée (`etat/meteo.ts`), son journal des derniers jours et la brume du matin.
 */
import { drawWeather, historyDays, mistOn } from '../etat/meteo';
import type { Weather } from '../etat/types';
import type { Sim } from './contexte';

/** Météo d'un jour passé ou d'aujourd'hui: écrite, sinon lue dans le journal (`null`: inconnue). */
export function weatherOf(sim: Sim, day: number): Weather | null {
  const s = sim.content.settings;
  if (day < 1) return null;
  if (day < s.weather.fromDay) return s.weatherByDay[day - 1] ?? null;
  if (day === sim.world.clock.day) return sim.world.weather;
  return sim.world.weatherLog.find((e) => e.day === day)?.weather ?? null;
}

/** Les jours qui précèdent `day` (le plus récent à la fin), autant qu'il en faut aux garde-fous. */
function before(sim: Sim, day: number): Weather[] {
  const out: Weather[] = [];
  for (let d = Math.max(1, day - historyDays(sim.content.settings)); d < day; d++) {
    const w = weatherOf(sim, d);
    if (w !== null) out.push(w);
  }
  return out;
}

/**
 * Au matin (après le passage au jour suivant): la météo du jour (la prévision d'hier, FE-09), la
 * brume, le journal et la prévision du lendemain. Avant `weather.fromDay`, rien ne change pour la
 * démo: la météo écrite, et la prévision écrite ou tirée pour le premier jour tiré.
 */
export function morningWeather(sim: Sim): void {
  const { world } = sim;
  const s = sim.content.settings;
  const day = world.clock.day;
  if (day < s.weather.fromDay) {
    world.weather = s.weatherByDay[day - 1] ?? world.weather;
  } else {
    const yesterday = weatherOf(sim, day - 1) ?? world.weather;
    // La prévision d'hier est la météo d'aujourd'hui. Le premier jour tiré se tire ici: la
    // prévision du jour d'avant a pu être écrite par une version sans météo tirée.
    world.weather =
      day === s.weather.fromDay
        ? drawWeather(s, world.seed, day, before(sim, day)).weather
        : world.weatherTomorrow;
    world.morningMist = mistOn(s, world.seed, day, world.weather, yesterday);
    world.weatherLog.push({ day, weather: world.weather, mist: world.morningMist });
    if (world.weatherLog.length > s.weather.logDays)
      world.weatherLog.splice(0, world.weatherLog.length - s.weather.logDays);
  }
  world.weatherTomorrow = forecast(sim, day + 1);
}

/** Météo du jour `day` (demain), tirée d'après les jours écrits et le journal. */
function forecast(sim: Sim, day: number): Weather {
  const s = sim.content.settings;
  const { world } = sim;
  if (day < s.weather.fromDay) return s.weatherByDay[day - 1] ?? world.weather;
  return drawWeather(s, world.seed, day, before(sim, day)).weather;
}
