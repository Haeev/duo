/**
 * Prise en main des premiers jours ouverts (retours de la séance du 2026-11-08: « trop de monde
 * d'un coup »). Le premier jour ouvert, quelques groupes patients entrent un à la fois, le suivant
 * quand le précédent est servi; puis l'affluence monte jour après jour (`warmup` de
 * `regles.json`). Pur et déterministe: l'aléa vient du générateur de la session.
 */
import type { RandomSource } from '@duo/sdk';
import { drawGroupSize } from './attrait';
import type { ClienteleContent, Profile, WarmupDay } from './donnees';
import type { Group } from './etat';

export function warmupOf(cc: ClienteleContent, day: number): WarmupDay | undefined {
  return cc.rules.warmup.find((w) => w.day === day);
}

/** Seconde de service où finit le calme du jour (0 sans prise en main). */
export function calmEndSec(cc: ClienteleContent, day: number, spm: number): number {
  const w = warmupOf(cc, day);
  if (w === undefined || w.calmGroups === 0) return 0;
  return Math.max(0, w.calmUntil - cc.days.open) * spm;
}

/** Multiplicateur de l'affluence habituelle, après le calme. */
export function warmupAffluence(cc: ClienteleContent, day: number): number {
  return warmupOf(cc, day)?.affluence ?? 1;
}

/** Part de l'affluence habituelle prévue par la commande proposée pour ce jour. */
export function announcedWarmup(cc: ClienteleContent, day: number): number {
  return warmupOf(cc, day)?.announced ?? 1;
}

/** Patience d'un profil ce jour-là, en secondes. */
export function patienceOf(cc: ClienteleContent, day: number, p: Profile): number {
  return p.patienceSeconds * (warmupOf(cc, day)?.patience ?? 1);
}

/**
 * Arrivées calmes du jour: `[seconde, profil, taille, à emporter]`, espacées régulièrement sur la
 * fenêtre calme (un peu d'aléa dans chaque intervalle), le premier groupe peu après l'ouverture.
 */
export function calmArrivals(
  cc: ClienteleContent,
  day: number,
  spm: number,
  random: RandomSource,
): [number, string, number, boolean][] {
  const w = warmupOf(cc, day);
  const end = calmEndSec(cc, day, spm);
  if (w === undefined || end <= 0) return [];
  const profiles = w.calmProfiles
    .map((id) => cc.profiles.get(id))
    .filter((p): p is Profile => p !== undefined && p.groupsPerDay > 0);
  if (profiles.length === 0) return [];
  const out: [number, string, number, boolean][] = [];
  const span = Math.max(0, end - w.firstSeconds);
  const every = span / w.calmGroups;
  for (let k = 0; k < w.calmGroups; k++) {
    const t = k === 0 ? w.firstSeconds : w.firstSeconds + every * (k + random.next() * 0.5);
    const p = profiles[Math.floor(random.next() * profiles.length)] ?? profiles[0];
    if (p === undefined) continue;
    const size = Math.min(w.maxGroupSize, drawGroupSize(random, p));
    out.push([t, p.id, size, false]);
  }
  return out;
}

/**
 * Une arrivée calme attend tant qu'un groupe présent n'est pas servi (commande pas prise ou
 * boisson pas encore au passe), puis `gapSeconds` après le dernier servi.
 */
export function holdCalmArrival(
  cc: ClienteleContent,
  day: number,
  groups: readonly Group[],
  now: number,
): boolean {
  const w = warmupOf(cc, day);
  if (w === undefined) return false;
  let lastServed = -Infinity;
  for (const g of groups) {
    if (g.stage === 'leaving') continue;
    if (g.paid === null || g.open > 0 || g.servedAt === null) return true;
    lastServed = Math.max(lastServed, g.servedAt);
  }
  return now - lastServed < w.gapSeconds;
}
