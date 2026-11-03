/**
 * Envies du jour (HA-07): une personnelle par joueur et par matin, jamais la
 * même deux fois en `envies.noRepeatWindowDays` jours (réserve vide: la moins
 * récente des possibles), et une envie à deux les jours prévus; après la démo (tour 8, section
 * 5.4), coup de pouce aux envies jamais reçues et envie à deux tirée un jour sur trois.
 */
import { evaluateAll, NO_CONTEXT, stayPoints } from './conditions';
import { type Sim, character, distance, emit, notifyKey } from './contexte';
import { unitDraw } from '../etat/tirage';

export function pickEnvies(sim: Sim): void {
  const { day } = sim.world.clock;
  const settings = sim.content.settings.envies;
  const longRun = settings.sharedFromDay !== null && day >= settings.sharedFromDay;
  for (const c of sim.world.characters) {
    const ctx = { ...NO_CONTEXT, actor: c.id };
    const possible = sim.content.envies.filter((e) => e.kind === 'personal' && evaluateAll(sim, e.availableWhen, ctx));
    const recent = c.envieHistory.slice(-settings.noRepeatWindowDays);
    let candidates = possible.filter((e) => !recent.includes(e.id));
    if (candidates.length === 0 && possible.length > 0) {
      const last = (id: string): number => c.envieHistory.lastIndexOf(id);
      const oldest = Math.min(...possible.map((e) => last(e.id)));
      candidates = possible.filter((e) => last(e.id) === oldest);
    }
    if (candidates.length === 0) {
      c.envie = null;
    } else {
      // Après la démo, coup de pouce aux envies jamais reçues par ce joueur (la démo garde son tirage).
      const pick = longRun ? weightedPick(sim, candidates, (e) => (c.envieHistory.includes(e.id) ? 1 : settings.unseenFactor)) : sim.rng.pick(candidates);
      c.envie = { id: pick.id, done: false };
      c.envieHistory.push(pick.id);
      if (c.envieHistory.length > ENVIE_HISTORY_MAX) c.envieHistory = compactEnvieHistory(c.envieHistory, settings.noRepeatWindowDays);
    }
  }
  const shared = longRun ? drawSharedEnvie(sim, day) : (sim.content.sharedEnvieSchedule.find((s) => s.day === day)?.envie ?? null);
  for (const c of sim.world.characters) c.sharedEnvie = shared === null ? null : { id: shared, done: false };
}

/** Au-delà de ce nombre d'entrées (six semaines), l'historique d'un joueur se compacte (QA8-02). */
export const ENVIE_HISTORY_MAX = 42;

/**
 * L'historique des envies sert à trois choses: les `window` dernières (aucune redite dans la
 * fenêtre), la moins récente parmi elles quand toutes y sont, et « déjà reçue » (coup de pouce).
 * Les `window` dernières restent telles quelles; avant elles, il suffit d'un exemplaire de chaque
 * envie absente de la fenêtre, dans l'ordre de sa dernière venue: les trois réponses ne changent
 * pas, et l'historique reste borné par le nombre d'envies (I-06).
 */
export function compactEnvieHistory(history: readonly string[], window: number): string[] {
  const tail = history.slice(-window);
  const inTail = new Set(tail);
  const older: string[] = [];
  const seen = new Set<string>();
  const head = history.slice(0, history.length - tail.length);
  for (let i = head.length - 1; i >= 0; i--) {
    const id = head[i];
    if (id === undefined || inTail.has(id) || seen.has(id)) continue;
    seen.add(id);
    older.push(id);
  }
  return [...older.reverse(), ...tail];
}

/** Tirage pondéré par le générateur de la partie (un seul nombre tiré, comme `pick`). */
function weightedPick<T>(sim: Sim, items: readonly T[], weight: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let roll = sim.rng.float(0, total);
  for (const item of items) {
    roll -= weight(item);
    if (roll < 0) return item;
  }
  const last = items[items.length - 1];
  if (last === undefined) throw new Error('tirage pondéré sur une liste vide');
  return last;
}

/**
 * Envie à deux d'après la démo (section 5.4): un jour sur `sharedEveryDays` à partir de
 * `sharedFromDay`, la même chez les deux, tirée par empreinte parmi celles possibles, jamais la
 * même en `sharedNoRepeatDays` jours (rien plutôt qu'une redite).
 */
export function drawSharedEnvie(sim: Sim, day: number): string | null {
  const s = sim.content.settings.envies;
  const world = sim.world;
  if (s.sharedFromDay === null || day < s.sharedFromDay) return null;
  world.sharedEnvieRecent = world.sharedEnvieRecent.filter((e) => day - e.day < s.sharedNoRepeatDays);
  if ((day - s.sharedFromDay) % s.sharedEveryDays !== 0) return null;
  const taken = new Set(world.sharedEnvieRecent.map((e) => e.id));
  const candidates = sim.content.envies.filter(
    (e) => e.kind === 'shared' && !taken.has(e.id) && evaluateAll(sim, e.availableWhen, NO_CONTEXT),
  );
  if (candidates.length === 0) return null;
  const index = Math.floor(unitDraw(world.seed, 'shared-envie', day) * candidates.length);
  const pick = candidates[Math.min(index, candidates.length - 1)];
  if (pick === undefined) return null;
  world.sharedEnvieRecent.push({ id: pick.id, day });
  return pick.id;
}

/**
 * Points suivis par les conditions « rester à » (calculé une fois): envies, et aussi étapes des
 * quêtes (sans eux, un rendez-vous de quête ne se remplissait jamais).
 */
export function envieStayPoints(sim: Sim): string[] {
  const set = new Set<string>();
  for (const e of sim.content.envies) stayPoints(e.fulfilledWhen, set);
  for (const q of sim.content.quests) {
    stayPoints(q.start.when, set);
    for (const step of q.steps) stayPoints(step.conditions, set);
  }
  return [...set];
}

/** Temps passé d'affilée près des points suivis. */
export function updateStays(sim: Sim, points: readonly string[], dt: number): void {
  const range = sim.content.settings.ranges.stayAt;
  for (const c of sim.world.characters) {
    for (const id of points) {
      const at = sim.map.points[id];
      if (at === undefined) continue;
      // Format 13 (taille de l'état): loin du point, rien d'écrit plutôt qu'un zéro (lu `?? 0`).
      if (distance(c.pos, at) <= range) c.stays[id] = (c.stays[id] ?? 0) + dt;
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- clé de point suivi: l'absence vaut zéro.
      else if (c.stays[id] !== undefined) delete c.stays[id];
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
