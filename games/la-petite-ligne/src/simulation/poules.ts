/**
 * Poules (FE-07 réduit): trois poules au poulailler, une mangeoire à remplir,
 * un œuf par poule nourrie et par jour.
 */
import type { Character } from '../etat/types';
import { type Sim, bump, distance, emit, message, newId, notify, point } from './contexte';
import { gesture } from './potager';
import { ITEM, POINT, ZONE } from './ids';
import { dropAt } from './sac';

export function spawnHens(sim: Sim, animal: string, count: number, names: string[], pointId: string): void {
  const def = sim.content.animals[animal];
  if (def === undefined || sim.world.hens.length > 0) return;
  const at = point(sim, pointId);
  for (let i = 0; i < count; i++) {
    const pos = { x: at.x + (i - (count - 1) / 2) * 0.8, y: at.y + 0.6 };
    sim.world.hens.push({
      id: newId(sim, 'h'),
      name: names[i] ?? def.name,
      variant: def.variants[i % def.variants.length] ?? def.id,
      pos,
      prev: { ...pos },
      facing: 0,
      wander: { ...pos },
    });
  }
  notify(sim, 'both', 'message', message(sim, 'hens_arrived'));
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
      notify(sim, 'both', 'message', message(sim, 'eggs_found', { count }));
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
