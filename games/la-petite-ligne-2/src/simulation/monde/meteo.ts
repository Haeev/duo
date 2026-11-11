/**
 * Météo par lieu (cahier 4.3): tirée chaque matin selon le climat du lieu et la saison, puis
 * retirée ou gardée à chaque tranche de la journée (`temps.json`, `weatherSlots`). Fonction pure
 * de la graine de la partie, du lieu et du jour: la météo de demain se connaît dès aujourd'hui,
 * sans rien sauvegarder. L'invité n'a pas la graine: il lit `common.weather` et `common.outlook`.
 */
import type { Content } from '../../donnees/charger';
import { WEATHERS, type Weather } from '../../donnees/schemas/temps';
import { calendarOf, minutesSinceDawn } from './calendrier';

/** Empreinte 32 bits d'un texte (FNV-1a). */
function hashText(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Nombre de 0 (inclus) à 1 (exclu), fonction pure de ses entiers (mélange de type murmur). */
export function unitHash(...values: readonly number[]): number {
  let h = 0x9e3779b9;
  for (const value of values) {
    h = Math.imul(h ^ (value | 0), 0x85ebca6b) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
  }
  return h / 0x1_0000_0000;
}

export function placeKey(place: string): number {
  return hashText(place);
}

/** Tranche météo d'une heure de la journée (0: le tirage du matin). */
export function weatherSlot(content: Content, minutes: number): number {
  const now = minutesSinceDawn(content, minutes);
  const slots = content.time.file.weatherSlots;
  let slot = 0;
  for (let i = 0; i < slots.length; i++)
    if (minutesSinceDawn(content, slots[i] ?? 0) <= now) slot = i;
  return slot;
}

function draw(content: Content, place: string, day: number, roll: number): Weather {
  const climate = content.time.climates[place] ?? content.time.file.defaultClimate;
  const weights = climate.seasons[calendarOf(content, day).season].weights;
  let total = 0;
  for (const w of WEATHERS) total += weights[w] ?? 0;
  let pick = roll * total;
  for (const w of WEATHERS) {
    const weight = weights[w] ?? 0;
    if (weight <= 0) continue;
    if (pick < weight) return w;
    pick -= weight;
  }
  // Arrondi: la dernière météo de poids positif (le schéma en garantit une).
  return [...WEATHERS].reverse().find((w) => (weights[w] ?? 0) > 0) ?? 'clear';
}

/** Météo d'une tranche d'un jour dans un lieu. */
export function weatherOfSlot(
  content: Content,
  seed: number,
  place: string,
  day: number,
  slot: number,
): Weather {
  const key = placeKey(place);
  const climate = content.time.climates[place] ?? content.time.file.defaultClimate;
  let weather = draw(content, place, day, unitHash(seed, key, day, 0, 1));
  for (let i = 1; i <= slot; i++)
    if (unitHash(seed, key, day, i, 2) < climate.changeChance)
      weather = draw(content, place, day, unitHash(seed, key, day, i, 1));
  return weather;
}

/** Météo d'un lieu à un jour et une heure donnés. */
export function weatherAt(
  content: Content,
  seed: number,
  place: string,
  day: number,
  minutes: number,
): Weather {
  return weatherOfSlot(content, seed, place, day, weatherSlot(content, minutes));
}

/** La météo du matin: celle qu'on annonce la veille. */
export function morningWeather(
  content: Content,
  seed: number,
  place: string,
  day: number,
): Weather {
  return weatherOfSlot(content, seed, place, day, 0);
}

/** Il a plu (ou neigé, selon `wateringWeathers`) ce jour-là: pour le rattrapage des cultures d'un lieu quitté. */
export function wateredOn(content: Content, seed: number, place: string, day: number): boolean {
  const watering = content.time.file.wateringWeathers;
  for (let slot = 0; slot < content.time.file.weatherSlots.length; slot++)
    if (watering.includes(weatherOfSlot(content, seed, place, day, slot))) return true;
  return false;
}

/**
 * Il a plu ce jour-là pendant le jour: une tranche météo de `wateringWeathers` couvre au moins
 * `minMinutes` entre `dayStart` et `nightStart`. Pur et déterministe (graine, lieu, jour): rien à
 * sauvegarder ni à transmettre, l'invité calcule la même chose que l'hôte. Condition
 * `rainedYesterday` des lignes de butin (trouvailles de berge après la pluie).
 */
export function rainedOn(
  content: Content,
  seed: number,
  place: string,
  day: number,
  minMinutes: number,
): boolean {
  if (day < 1) return false;
  const { dayStart, nightStart } = content.settings.clock;
  const slots = content.time.file.weatherSlots;
  const watering = content.time.file.wateringWeathers;
  for (let slot = 0; slot < slots.length; slot++) {
    const start = slots[slot] ?? 0;
    const end = slots[slot + 1] ?? (slots[0] ?? 0) + 1440;
    const overlap = Math.min(end, nightStart) - Math.max(start, dayStart);
    if (overlap < minMinutes) continue;
    if (watering.includes(weatherOfSlot(content, seed, place, day, slot))) return true;
  }
  return false;
}

/** Ambiance de la saison dans ce lieu (rendu, son): une métropole n'a pas celle d'un bourg. */
export function ambienceOf(content: Content, place: string, day: number): string {
  const climate = content.time.climates[place] ?? content.time.file.defaultClimate;
  return climate.seasons[calendarOf(content, day).season].ambience;
}
