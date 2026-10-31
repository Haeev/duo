/**
 * Envies du jour (HA-07): une personnelle par joueur et par matin, jamais la
 * même deux fois en `envies.noRepeatWindowDays` jours (réserve vide: la moins
 * récente des possibles), et une envie à deux les jours prévus.
 */
import { evaluateAll, NO_CONTEXT, stayPoints } from './conditions';
import { type Sim, character, distance, emit, notifyKey } from './contexte';

export function pickEnvies(sim: Sim): void {
  const { day } = sim.world.clock;
  for (const c of sim.world.characters) {
    const ctx = { ...NO_CONTEXT, actor: c.id };
    const possible = sim.content.envies.filter((e) => e.kind === 'personal' && evaluateAll(sim, e.availableWhen, ctx));
    const recent = c.envieHistory.slice(-sim.content.settings.envies.noRepeatWindowDays);
    let candidates = possible.filter((e) => !recent.includes(e.id));
    if (candidates.length === 0 && possible.length > 0) {
      const last = (id: string): number => c.envieHistory.lastIndexOf(id);
      const oldest = Math.min(...possible.map((e) => last(e.id)));
      candidates = possible.filter((e) => last(e.id) === oldest);
    }
    if (candidates.length === 0) {
      c.envie = null;
    } else {
      const pick = sim.rng.pick(candidates);
      c.envie = { id: pick.id, done: false };
      c.envieHistory.push(pick.id);
    }
    const shared = sim.content.sharedEnvieSchedule.find((s) => s.day === day);
    c.sharedEnvie = shared === undefined ? null : { id: shared.envie, done: false };
  }
}

/** Points suivis par les envies « rester à » (calculé une fois). */
export function envieStayPoints(sim: Sim): string[] {
  const set = new Set<string>();
  for (const e of sim.content.envies) stayPoints(e.fulfilledWhen, set);
  return [...set];
}

/** Temps passé d'affilée près des points suivis. */
export function updateStays(sim: Sim, points: readonly string[], dt: number): void {
  const range = sim.content.settings.ranges.stayAt;
  for (const c of sim.world.characters) {
    for (const id of points) {
      const at = sim.map.points[id];
      if (at === undefined) continue;
      c.stays[id] = distance(c.pos, at) <= range ? (c.stays[id] ?? 0) + dt : 0;
    }
  }
}

export function updateEnvies(sim: Sim): void {
  if (sim.world.phase !== 'day') return;
  for (const c of sim.world.characters) {
    const ctx = { ...NO_CONTEXT, actor: c.id };
    const own = c.envie;
    if (own !== null && !own.done) {
      const def = sim.content.envies.find((e) => e.id === own.id);
      if (def !== undefined && evaluateAll(sim, def.fulfilledWhen, ctx)) {
        own.done = true;
        c.heartToday.envie = true;
        notifyKey(sim, c.id, 'envie', 'envie_done', { envie: def.text });
        emit(sim, { type: 'envie_done', by: c.id, envie: def.id });
      }
    }
  }
  const first = character(sim, 'p1').sharedEnvie;
  if (first !== null && !first.done) {
    const def = sim.content.envies.find((e) => e.id === first.id);
    if (def !== undefined && evaluateAll(sim, def.fulfilledWhen, NO_CONTEXT)) {
      for (const c of sim.world.characters) {
        if (c.sharedEnvie !== null) c.sharedEnvie.done = true;
        c.heartToday.sharedEnvie = true;
      }
      sim.world.session.togetherMoments += 1;
      notifyKey(sim, 'both', 'envie', 'envie_done', { envie: def.text });
      emit(sim, { type: 'envie_done', by: 'both', envie: def.id });
    }
  }
}
