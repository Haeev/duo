/**
 * Météo tirée (tour 8, section 3): chaîne à mémoire de la veille, garde-fous, jours imposés et
 * brume du matin. Pure et sans le générateur de la partie (`unitDraw`): la même graine donne la
 * même météo chez les deux, au robot et au script `tour8_suite.py` (même calcul, même ordre).
 */
import { seasonOfDay } from '../donnees/calendrier';
import type { Settings } from '../donnees/types';
import { unitDraw } from './tirage';
import type { Weather } from './types';

const ORDER: readonly Weather[] = ['sunny', 'cloudy', 'rain'];

export interface DrawnWeather {
  weather: Weather;
  mist: boolean;
  /** Corrigé par un garde-fou ou imposé (rapport du robot). */
  forced: 'forced' | 'rain_streak' | 'sun_due' | null;
}

type WeatherRules = Pick<Settings, 'calendar' | 'weather' | 'weatherByDay'>;

/**
 * Météo du jour `day` (au moins `weather.fromDay`), d'après les jours d'avant (`before`, le plus
 * récent à la fin, le jour `day - 1` compris). Seuls les derniers jours servent (garde-fous).
 */
export function drawWeather(
  settings: WeatherRules,
  seed: number,
  day: number,
  before: readonly Weather[],
): DrawnWeather {
  const w = settings.weather;
  const prev = before[before.length - 1] ?? 'sunny';
  const forcedDay = w.forced.find((f) => f.day === day);
  let weather: Weather;
  let forced: DrawnWeather['forced'] = null;
  if (forcedDay !== undefined) {
    weather = forcedDay.weather;
    forced = 'forced';
  } else {
    const table = w.draw[seasonOfDay(settings, day)];
    const u = unitDraw(seed, 'weather', day);
    let acc = 0;
    weather = 'rain';
    for (let i = 0; i < ORDER.length; i++) {
      const t = ORDER[i] ?? 'rain';
      acc += (1 - w.persistence) * ((table[i] ?? 0) / 100) + (t === prev ? w.persistence : 0);
      if (u < acc) {
        weather = t;
        break;
      }
    }
    let rainStreak = 0;
    for (let i = before.length - 1; i >= 0 && before[i] === 'rain'; i--) rainStreak++;
    let noSun = 0;
    for (let i = before.length - 1; i >= 0 && before[i] !== 'sunny'; i--) noSun++;
    if (weather === 'rain' && rainStreak >= w.maxRainStreak) {
      weather = 'cloudy';
      forced = 'rain_streak';
    }
    if (weather !== 'sunny' && noSun >= w.maxDaysWithoutSun) {
      weather = 'sunny';
      forced = 'sun_due';
    }
  }
  return { weather, mist: mistOn(settings, seed, day, weather, prev), forced };
}

/**
 * Brume du matin du jour `day` (section 3.3): jamais sous la pluie; toujours (`mist.afterRain`) le
 * lendemain d'une pluie, là où le moment de la brume peut sortir; sinon la chance de la saison.
 */
export function mistOn(
  settings: WeatherRules,
  seed: number,
  day: number,
  weather: Weather,
  yesterday: Weather,
): boolean {
  if (weather === 'rain' || day < settings.weather.fromDay) return false;
  const m = settings.weather.mist;
  const chance = yesterday === 'rain' ? m.afterRain : m.base[seasonOfDay(settings, day)];
  return unitDraw(seed, 'mist', day) < chance;
}

/** Jours d'avant utiles aux garde-fous et à la mémoire de la veille. */
export function historyDays(settings: Pick<Settings, 'weather'>): number {
  return Math.max(settings.weather.maxRainStreak, settings.weather.maxDaysWithoutSun) + 1;
}

/**
 * Météo des jours 1 à `to` à partir de rien (tests, robot, interface): les jours écrits, puis les
 * jours tirés. Coûte un tirage par jour.
 */
export function weatherSeries(settings: WeatherRules, seed: number, to: number): DrawnWeather[] {
  const out: DrawnWeather[] = [];
  const keep = historyDays(settings);
  for (let day = 1; day <= to; day++) {
    if (day < settings.weather.fromDay) {
      out.push({
        weather: settings.weatherByDay[day - 1] ?? out[out.length - 1]?.weather ?? 'sunny',
        mist: false,
        forced: null,
      });
      continue;
    }
    out.push(
      drawWeather(
        settings,
        seed,
        day,
        out.slice(-keep).map((d) => d.weather),
      ),
    );
  }
  return out;
}

/** La brume du matin est-elle encore là à cette heure (minutes) ? Elle s'efface de `fadeFrom` à `until`. */
export function mistAmount(
  settings: Pick<Settings, 'weather'>,
  morningMist: boolean,
  minutes: number,
): number {
  if (!morningMist) return 0;
  const m = settings.weather.mist;
  if (minutes <= m.fadeFrom) return 1;
  if (minutes >= m.until) return 0;
  return 1 - (minutes - m.fadeFrom) / Math.max(1, m.until - m.fadeFrom);
}
