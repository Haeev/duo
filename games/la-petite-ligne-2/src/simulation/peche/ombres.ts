/**
 * Les ombres des poissons. Fonctions pures de la graine du lieu, du jour, de l'heure et de la
 * météo: l'hôte et l'invité trouvent les mêmes ombres sans qu'elles passent par le réseau.
 * Chaque ombre est un vrai poisson, tiré de la table du coin parmi ceux de l'heure, de la météo
 * et de la saison.
 */
import { createRandom, deriveSeed } from '@duo/sdk/sim';
import type { Content } from '../../donnees/charger';
import type { FishingSpot, FishTraits, ShadowSize } from '../../donnees/schemas/peche';
import { SEASONS, type CatchDef } from '../../donnees/schemas/prise';
import { FISHING } from './reglages';

export type Season = (typeof SEASONS)[number];

export interface Shadow {
  /** `<vague>-<rang>`: unique dans la vague. */
  readonly id: string;
  readonly spot: string;
  readonly catch: string;
  readonly size: ShadowSize;
  /** Centre et rayons de sa ronde (m), phase et vitesse angulaire (rad/s). */
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly phase: number;
  readonly speed: number;
}

/** Saison du jour, au printemps le premier jour. */
export function seasonOf(content: Content, day: number): Season {
  const index = Math.floor((day - 1) / content.settings.clock.seasonDays) % SEASONS.length;
  return SEASONS[index] ?? 'spring';
}

/** La prise est-elle de sortie à cette heure, par ce temps, en cette saison ? */
export function catchAvailable(
  def: CatchDef,
  minutes: number,
  weather: string,
  season: Season,
): boolean {
  const { from, to } = def.hours;
  const inHours = from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
  if (!inHours) return false;
  if (def.weathers.length > 0 && !def.weathers.some((w) => w === weather)) return false;
  return def.seasons.length === 0 || def.seasons.includes(season);
}

/** Minutes de jeu depuis le début de la partie. */
export function absoluteMinutes(day: number, minutes: number): number {
  return (day - 1) * 1440 + minutes;
}

export function waveOf(day: number, minutes: number): number {
  return Math.floor(absoluteMinutes(day, minutes) / FISHING.waveMinutes);
}

/** Les poissons d'un coin, avec leur caractère (les prises sans bloc `fish` sont écartées). */
export function fishOf(content: Content, id: string): (CatchDef & { fish: FishTraits }) | null {
  const def = content.catches[id];
  if (def?.fish === undefined) return null;
  return def as CatchDef & { fish: FishTraits };
}

export interface ShadowConditions {
  readonly seed: number;
  readonly taken: readonly string[];
  readonly day: number;
  readonly minutes: number;
  readonly weather: string;
}

/** Ombres présentes dans un coin, sans celles déjà parties. */
export function spotShadows(content: Content, spot: FishingSpot, when: ShadowConditions): Shadow[] {
  const wave = waveOf(when.day, when.minutes);
  const season = seasonOf(content, when.day);
  const candidates: { id: string; weight: number }[] = [];
  let total = 0;
  for (const entry of spot.table) {
    const def = fishOf(content, entry.catch);
    if (def === null || !catchAvailable(def, when.minutes, when.weather, season)) continue;
    const weight = entry.weight * FISHING.rarityWeight[def.rarity];
    candidates.push({ id: def.id, weight });
    total += weight;
  }
  if (total <= 0) return [];
  const random = createRandom(deriveSeed(when.seed, `${spot.id}:${String(wave)}`));
  const out: Shadow[] = [];
  const { x, y, w, h } = spot.area;
  for (let slot = 0; slot < spot.shadows; slot++) {
    // Tous les tirages ont lieu, même pour une place vide: une ombre prise ne change pas les autres.
    const present = random.chance(FISHING.shadowPresence);
    let roll = random.next() * total;
    let picked = candidates[candidates.length - 1]?.id ?? '';
    for (const c of candidates) {
      roll -= c.weight;
      if (roll < 0) {
        picked = c.id;
        break;
      }
    }
    const rx = random.float(0.3, Math.max(0.35, Math.min(1.6, w / 2 - 0.6)));
    const ry = random.float(0.2, Math.max(0.25, Math.min(1.2, h / 2 - 0.6)));
    const cx = random.float(x + 0.5 + rx, Math.max(x + 0.6 + rx, x + w - 0.5 - rx));
    const cy = random.float(y + 0.5 + ry, Math.max(y + 0.6 + ry, y + h - 0.5 - ry));
    const phase = random.float(0, Math.PI * 2);
    const def = fishOf(content, picked);
    const nervous = def?.fish.nervousness ?? 0.5;
    const speed = (random.chance(0.5) ? 1 : -1) * (0.15 + 0.35 * nervous);
    const id = `${String(wave)}-${String(slot)}`;
    if (!present || def === null || when.taken.includes(id)) continue;
    out.push({
      id,
      spot: spot.id,
      catch: def.id,
      size: def.fish.shadow,
      cx,
      cy,
      rx,
      ry,
      phase,
      speed,
    });
  }
  return out;
}

/** Position d'une ombre à un instant (secondes de jeu); `out` évite une allocation par image. */
export function shadowPosition(
  shadow: Shadow,
  seconds: number,
  out: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  const a = shadow.phase + seconds * shadow.speed;
  out.x = shadow.cx + Math.cos(a) * shadow.rx;
  out.y = shadow.cy + Math.sin(a * 1.7) * shadow.ry;
  return out;
}

/** Secondes de jeu écoulées depuis le début de la partie (horloge des rondes des ombres). */
export function gameSeconds(content: Content, day: number, minutes: number): number {
  return (absoluteMinutes(day, minutes) / 60) * content.settings.clock.secondsPerHour;
}
