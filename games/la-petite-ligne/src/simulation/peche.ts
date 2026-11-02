/**
 * Pêche au gué (CN-05, P1): lancer sur l'eau à portée, attendre la touche,
 * ferrer pendant la fenêtre; manqué, le poisson repart et l'on relance.
 */
import type { Character, Vec2 } from '../etat/types';
import { type Sim, bump, emit, sayIfWritten, secondsToTicks } from './contexte';
import { spend } from './besoins';
import { giveToCharacter, heldItem } from './sac';
import { seasonOfDay } from '../donnees/calendrier';

/** Pas d'échantillonnage du regard vers l'eau (m). */
const LOOK_STEP = 0.5;
/** Pas plus fin pour le lancer à distance: la rive d'en face se trouve à 25 cm près. */
const CAST_STEP = 0.25;

/** Tient une canne (la canne de départ ou une canne améliorée, même `toolKind`). */
export function holdsRod(sim: Pick<Sim, 'content'>, c: Character): boolean {
  const held = heldItem(c);
  return held !== null && (sim.content.items[held]?.tool?.toolKind ?? null) === 'fishing_rod';
}

/** Valeurs de la canne tenue (tour 9: la canne en bambou attend moins et laisse plus de temps pour ferrer). */
function rodStats(sim: Sim, c: Character): { wait: number; hook: number | null } {
  const tool = sim.content.items[heldItem(c) ?? '']?.tool ?? null;
  return { wait: tool?.biteWaitFactor ?? 1, hook: tool?.hookWindowSeconds ?? null };
}

/**
 * Point d'eau où le bouchon se pose devant le personnage, à portée de lancer, ou `null`.
 *
 * Retour R09 (2026-11-01): « on la jette à nos pieds ». Le bouchon allait au premier point
 * d'eau, soit à un mètre du bord. Il va maintenant à `castDistance` (configuration) le long
 * du regard, sans passer la fin de cette étendue d'eau (rive d'en face, moins
 * `castShoreMargin`), et jamais plus près que le premier point d'eau. Toujours sur un point
 * échantillonné dans l'eau, donc jamais sur la terre.
 */
export function waterAhead(sim: Sim, c: Character): Vec2 | null {
  const fishing = sim.content.settings.fishing;
  if (fishing === null) return null;
  const { map } = sim;
  const dx = Math.cos(c.facing);
  const dy = Math.sin(c.facing);
  const stepSize = fishing.castDistance === null ? LOOK_STEP : CAST_STEP;
  let first: number | null = null;
  let lastWater = 0;
  for (let d = stepSize; d <= fishing.castRange; d += stepSize) {
    const cx = Math.floor(c.pos.x + dx * d);
    const cy = Math.floor(c.pos.y + dy * d);
    if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) break;
    const water = map.ground[cy * map.width + cx] === 'water';
    if (first === null) {
      if (!water) continue;
      if (fishing.castDistance === null) return { x: cx + 0.5, y: cy + 0.5 };
      first = d;
    } else if (!water) {
      break;
    }
    lastWater = d;
  }
  if (first === null) return null;
  const wanted = Math.max(first, Math.min(fishing.castDistance ?? first, lastWater - fishing.castShoreMargin));
  // Ramené sur un point échantillonné (tous dans l'eau entre `first` et `lastWater`).
  const d = first + Math.floor((wanted - first) / stepSize + 1e-9) * stepSize;
  return { x: c.pos.x + dx * d, y: c.pos.y + dy * d };
}

/** Poids des poissons ce jour-là: ceux de la saison (tour 8, section 5.3), sinon `fishWeights`. */
export function fishWeightsOn(sim: Sim, day: number): Record<string, number> {
  const feel = sim.content.settings.feel;
  return feel.fishWeightsBySeason[seasonOfDay(sim.content.settings, day)] ?? feel.fishWeights;
}

/**
 * Attente avant la touche multipliée selon le temps (pluie, brume du matin), à partir du premier
 * jour de météo tirée: la démo garde ses attentes.
 */
export function biteWaitFactor(sim: Sim): number {
  const { world } = sim;
  const w = sim.content.settings.weather;
  if (world.clock.day < w.fromDay) return 1;
  const mist = world.morningMist && world.clock.minutes < w.mist.until ? w.mist.biteWaitFactor : 1;
  return w.biteWaitFactor[world.weather] * mist;
}

function pickFish(sim: Sim): string | null {
  const weights = Object.entries(fishWeightsOn(sim, sim.world.clock.day)).filter(([item, w]) => w > 0 && item in sim.content.items);
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return null;
  let roll = sim.rng.float(0, total);
  for (const [item, w] of weights) {
    roll -= w;
    if (roll < 0) return item;
  }
  return weights[weights.length - 1]?.[0] ?? null;
}

/** Espace avec la canne: lancer, ferrer, ou remonter la ligne. */
export function fishAct(sim: Sim, c: Character): void {
  const fishing = sim.content.settings.fishing;
  if (fishing === null) return;
  const line = c.fishing;
  if (line?.phase === 'bite') {
    const item = pickFish(sim);
    c.fishing = null;
    if (item === null) return;
    giveToCharacter(sim, c, item, 'ordinary', 1);
    bump(sim, 'caught', c.id);
    bump(sim, `caught:${item}`, c.id);
    emit(sim, { type: 'caught', by: c.id, item });
    return;
  }
  if (line !== null) {
    // Ligne remontée avant la touche: rien n'est perdu.
    c.fishing = null;
    sim.runtime.changed = true;
    return;
  }
  const bobber = waterAhead(sim, c);
  if (bobber === null) return;
  const [min, max] = fishing.biteWaitSeconds;
  const wait = sim.rng.float(min, max) * biteWaitFactor(sim) * rodStats(sim, c).wait;
  c.fishing = { phase: 'waiting', bobber, biteAt: sim.world.tick + secondsToTicks(wait), until: 0 };
  c.facing = Math.atan2(bobber.y - c.pos.y, bobber.x - c.pos.x);
  spend(sim, c, 'fish_cast');
  emit(sim, { type: 'cast', by: c.id, at: { ...bobber } });
}

/** La touche, puis le poisson qui s'échappe si l'on n'a pas ferré à temps; marcher remonte la ligne. */
export function updateFishing(sim: Sim, c: Character): void {
  const fishing = sim.content.settings.fishing;
  const line = c.fishing;
  if (line === null || fishing === null) return;
  if (c.speed > 0 || c.status !== 'active' || !holdsRod(sim, c)) {
    c.fishing = null;
    sim.runtime.changed = true;
    return;
  }
  const tick = sim.world.tick;
  if (line.phase === 'waiting' && tick >= line.biteAt) {
    line.phase = 'bite';
    line.until = tick + secondsToTicks(rodStats(sim, c).hook ?? fishing.hookWindowSeconds);
    emit(sim, { type: 'bite', by: c.id });
  } else if (line.phase === 'bite' && tick > line.until) {
    c.fishing = null;
    sayIfWritten(sim, c.id, 'fish_escaped');
    emit(sim, { type: 'escaped', by: c.id });
  }
}
