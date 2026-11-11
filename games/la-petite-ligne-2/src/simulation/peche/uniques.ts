/**
 * Appâts et prises uniques (champs `baits` et `unique` d'une prise, `schemas/prise.ts`). Lectures
 * pures, les mêmes chez l'hôte et l'invité: aucune prise n'est nommée ici.
 */
import { createRandom, deriveSeed } from '@duo/sdk/sim';
import type { Content } from '../../donnees/charger';
import type { FishingSpot, FishTraits } from '../../donnees/schemas/peche';
import type { CatchDef, UniqueCatchDef } from '../../donnees/schemas/prise';
import type { ReadonlyWorld } from '../../etat/monde';
import { evaluateAll } from '../regles/conditions';
import { catchAvailable, seasonOf, waveOf, type Shadow } from './ombres';

export type UniqueFish = CatchDef & { fish: FishTraits; unique: UniqueCatchDef };

/** La prise unique de cet identifiant (avec son bloc `fish`), ou `null`. */
export function uniqueOf(content: Content, id: string): UniqueFish | null {
  const def = content.catches[id];
  if (def?.fish === undefined || def.unique === undefined) return null;
  return def as UniqueFish;
}

/** Les prises uniques qui vivent dans ce coin, dans l'ordre des identifiants (rang de l'ombre). */
export function uniquesOfSpot(content: Content, place: string, spot: string): UniqueFish[] {
  const out: UniqueFish[] = [];
  for (const id of Object.keys(content.catches).sort()) {
    const def = uniqueOf(content, id);
    if (def?.unique.spot === spot && def.places.includes(place)) out.push(def);
  }
  return out;
}

/** Déjà sortie (fait retenu): elle ne revient jamais. */
export function uniqueTaken(world: ReadonlyWorld, def: UniqueFish): boolean {
  return world.progress.memory[def.unique.fact] !== undefined;
}

/** Ombres des prises uniques présentes dans le coin en ce moment (heure, météo, condition). */
export function uniqueShadows(
  content: Content,
  world: ReadonlyWorld,
  spot: FishingSpot,
  seed: number,
): Shadow[] {
  const place = world.common.place;
  const defs = uniquesOfSpot(content, place, spot.id);
  if (defs.length === 0) return [];
  const wave = waveOf(world.common.day, world.minutes);
  const season = seasonOf(content, world.common.day);
  const out: Shadow[] = [];
  defs.forEach((def, rank) => {
    if (rank > 9 || uniqueTaken(world, def)) return;
    if (!catchAvailable(def, world.minutes, world.common.weather, season)) return;
    if (!evaluateAll({ world, content, actor: null }, def.unique.when)) return;
    // Sa ronde ne dépend que du coin: elle hante toujours le même creux.
    const random = createRandom(deriveSeed(seed, `${spot.id}:unique:${def.id}`));
    const { x, y, w, h } = spot.area;
    const rx = Math.max(0.3, Math.min(1.4, w / 2 - 0.8));
    const ry = Math.max(0.2, Math.min(0.8, h / 2 - 0.6));
    out.push({
      id: `${String(wave)}-u${String(rank)}`,
      spot: spot.id,
      catch: def.id,
      size: def.fish.shadow,
      cx: x + w / 2,
      cy: y + h / 2,
      rx,
      ry,
      phase: random.float(0, Math.PI * 2),
      speed: (random.chance(0.5) ? 1 : -1) * 0.12,
    });
  });
  return out;
}

/** Attrait de l'appât `bait` pour cette prise (1: aucun). */
export function baitFactor(def: CatchDef, bait: string | null | undefined): number {
  if (bait === null || bait === undefined) return 1;
  return def.baits?.find((b) => b.item === bait)?.factor ?? 1;
}

/** Objets qui servent d'appât à au moins une prise (champ `baits` ou appât d'une prise unique). */
export function baitItems(content: Content): ReadonlySet<string> {
  const out = new Set<string>();
  for (const def of Object.values(content.catches)) {
    for (const b of def.baits ?? []) out.add(b.item);
    if (def.unique?.bait !== null && def.unique?.bait !== undefined) out.add(def.unique.bait);
  }
  return out;
}
