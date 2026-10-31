/**
 * Poules (FE-07 réduit): trois poules au poulailler, une mangeoire à remplir,
 * un œuf par poule nourrie et par jour.
 */
import type { Character } from '../etat/types';
import { type Sim, bump, distance, emit, newId, point, notifyKey } from './contexte';
import { gesture } from './potager';
import { ITEM, POINT, ZONE } from './ids';
import { dropAt } from './sac';
import { variantOf } from './conditions';

/**
 * La permutation n° `k` (ordre lexicographique) des indices 0 à n - 1: avec trois variantes,
 * 0 donne [0, 1, 2], 1 donne [0, 2, 1]... 5 donne [2, 1, 0] (tableau 2.2 de la conception).
 */
export function permutation(n: number, k: number): number[] {
  const pool = Array.from({ length: n }, (_, i) => i);
  const out: number[] = [];
  let factorial = 1;
  for (let i = 2; i < n; i++) factorial *= i;
  let rest = k % (factorial * Math.max(1, n));
  for (let left = n; left > 0; left--) {
    const index = Math.floor(rest / factorial);
    rest %= factorial;
    out.push(pool.splice(index, 1)[0] ?? 0);
    if (left > 1) factorial /= left - 1;
  }
  return out;
}

/** Nombre de permutations de n variantes (n!). */
export function permutationCount(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

export function spawnHens(
  sim: Sim,
  animal: string,
  count: number,
  names: string[],
  pointId: string,
  shuffleVariantsBy: string | null = null,
): void {
  const def = sim.content.animals[animal];
  if (def === undefined || sim.world.hens.length > 0) return;
  const at = point(sim, pointId);
  const n = def.variants.length;
  // Qui porte quelle couleur change d'une partie à l'autre (R16): tirage par la graine, sans le générateur.
  const order = shuffleVariantsBy === null || n === 0 ? null : permutation(n, variantOf(sim.world.seed, shuffleVariantsBy, permutationCount(n)));
  for (let i = 0; i < count; i++) {
    const pos = { x: at.x + (i - (count - 1) / 2) * 0.8, y: at.y + 0.6 };
    const v = order === null ? i % Math.max(1, n) : (order[i % n] ?? 0);
    sim.world.hens.push({
      id: newId(sim, 'h'),
      name: names[i] ?? def.name,
      variant: def.variants[v] ?? def.id,
      pos,
      prev: { ...pos },
      facing: 0,
      wander: { ...pos },
      nameKnownBy: [],
      namedBy: null,
    });
  }
  notifyKey(sim, 'both', 'message', 'hens_arrived');
  emit(sim, { type: 'hens_arrived' });
}

export function feedHens(sim: Sim, c: Character): void {
  if (sim.world.hens.length === 0) return;
  sim.world.feederFilled = true;
  gesture(sim, c, 'feed', sim.content.settings.feel.actionSeconds.feed ?? 0, point(sim, POINT.henFeeder));
  bump(sim, 'fed', c.id);
  emit(sim, { type: 'fed_hens', by: c.id });
}

/** Le matin: les œufs des poules nourries la veille, au poulailler. */
export function morningEggs(sim: Sim): void {
  const hens = sim.world.hens.length;
  const s = sim.content.settings.hens;
  if (hens > 0 && (sim.world.feederFilled || !s.feedRequired)) {
    const count = hens * s.eggsPerHenPerDay;
    const at = point(sim, POINT.chickenCoop);
    if (count > 0) {
      dropAt(sim, at.x + 0.5, at.y - 0.6, ITEM.egg, 'ordinary', count);
      notifyKey(sim, 'both', 'message', 'eggs_found', { count });
      emit(sim, { type: 'eggs_laid', count });
    }
  }
  sim.world.feederFilled = false;
}

/** Les poules picorent dans leur enclos. */
export function wanderHens(sim: Sim, dt: number): void {
  const pen = sim.map.zones[ZONE.henPen];
  const speed = sim.content.settings.feel.henSpeed;
  for (const hen of sim.world.hens) {
    const d = distance(hen.pos, hen.wander);
    if (d < 0.1) {
      if (pen !== undefined && sim.rng.chance(0.02)) {
        hen.wander.x = sim.rng.float(pen.x + 0.3, pen.x + pen.w - 0.3);
        hen.wander.y = sim.rng.float(pen.y + 0.3, pen.y + pen.h - 0.3);
      }
      continue;
    }
    const stepLen = Math.min(d, speed * dt);
    hen.pos.x += ((hen.wander.x - hen.pos.x) / d) * stepLen;
    hen.pos.y += ((hen.wander.y - hen.pos.y) / d) * stepLen;
    hen.facing = Math.atan2(hen.wander.y - hen.pos.y, hen.wander.x - hen.pos.x);
  }
}
