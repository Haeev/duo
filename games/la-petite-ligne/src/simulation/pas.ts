/**
 * Un pas de simulation (1 / SIM_HZ s). Seul point d'entrée qui fait avancer le
 * monde: l'hôte l'appelle à pas fixe avec les entrées des deux joueurs.
 */
import type { AuthoredIntent, ControlFrame } from '../etat/actions';
import type { CharacterId } from '../etat/types';
import { RIPE_VIEW_DISTANCE, SIM_DT } from './constantes';
import { type Sim, distance } from './contexte';
import { updateAim } from './agir';
import { updatePlacement } from './amenagement';
import { queueHint, pumpHints } from './astuces';
import { updateConstructions, completeConstruction } from './construction';
import { autoStartScenes } from './dialogues';
import { pumpScripts } from './effets';
import { envieStayPoints, updateEnvies, updateStays } from './envies';
import { moveCharacter, refreshBlockers, updateBeam, updateInside } from './deplacement';
import { updateVillagers } from './habitants';
import { checkNight, updateClock } from './horloge';
import { applyIntent, arrive, updateCrafting } from './intentions';
import { wanderHens } from './poules';
import { updateQuests } from './quetes';
import { updateTrain } from './train';

export interface StepInput {
  /** Commandes continues de chaque joueur pour ce pas (absent: rien de tenu). */
  controls: Partial<Record<CharacterId, ControlFrame>>;
  /** Intentions reçues depuis le pas précédent, dans leur ordre d'arrivée. */
  intents: readonly AuthoredIntent[];
}

const stayCache = new WeakMap<Sim['content'], string[]>();

function stayPointsOf(sim: Sim): string[] {
  let points = stayCache.get(sim.content);
  if (points === undefined) {
    points = envieStayPoints(sim);
    stayCache.set(sim.content, points);
  }
  return points;
}

function nearHints(sim: Sim): void {
  const reach = sim.content.settings.ranges.action;
  for (const c of sim.world.characters) {
    if (!c.created || c.status !== 'active') continue;
    for (const hint of sim.content.hints) {
      const t = hint.trigger;
      if (t.on === 'near_point') {
        const at = sim.map.points[t.point];
        if (at !== undefined && distance(c.pos, at) <= reach + 1) queueHint(sim, c.id, t);
      }
    }
    for (const g of sim.world.garden) {
      if (g.crop?.ripe === true && distance(c.pos, { x: g.cell.cx + 0.5, y: g.cell.cy + 0.5 }) <= RIPE_VIEW_DISTANCE) {
        queueHint(sim, c.id, { on: 'crop_ripe_in_view' });
        break;
      }
    }
  }
}

export function step(sim: Sim, input: StepInput): void {
  const { world } = sim;
  const dt = SIM_DT;
  world.tick += 1;
  sim.events.length = 0;
  sim.runtime.changed = false;

  for (const c of world.characters) {
    c.prev.x = c.pos.x;
    c.prev.y = c.pos.y;
  }
  for (const v of world.villagers) {
    v.prev.x = v.pos.x;
    v.prev.y = v.pos.y;
  }
  for (const h of world.hens) {
    h.prev.x = h.pos.x;
    h.prev.y = h.pos.y;
  }
  if (world.beam !== null) {
    world.beam.prev.x = world.beam.pos.x;
    world.beam.prev.y = world.beam.pos.y;
  }
  refreshBlockers(sim);

  for (const { by, intent } of input.intents) {
    applyIntent(sim, by, intent);
    sim.runtime.changed = true;
  }

  if (world.phase === 'day') {
    if (updateBeam(sim, input.controls, dt)) {
      const def = sim.content.constructions.find((k) => k.kind === 'carry');
      if (def !== undefined) completeConstruction(sim, def.id);
      for (const c of world.characters) c.heartToday.gesture = true;
      world.session.togetherMoments += 1;
    }
    for (const c of world.characters) {
      if (c.status === 'gesture') continue;
      if (moveCharacter(sim, c, input.controls[c.id], dt)) arrive(sim, c);
      updateCrafting(sim, c);
    }
    updateConstructions(sim, input.controls, dt);
  }
  for (const c of world.characters) updateInside(sim, c);
  updateVillagers(sim, dt);
  wanderHens(sim, dt);
  updateTrain(sim, dt);
  updateClock(sim, dt);

  autoStartScenes(sim);
  pumpScripts(sim);
  updateQuests(sim);
  if (world.phase === 'day') {
    updateStays(sim, stayPointsOf(sim), dt);
    updateEnvies(sim);
    nearHints(sim);
  }
  for (const c of world.characters) {
    updatePlacement(sim, c);
    updateAim(sim, c);
  }
  pumpHints(sim);
  checkNight(sim);

  const state = sim.rng.getState();
  world.rng[0] = state[0];
  world.rng[1] = state[1];
  world.rng[2] = state[2];
  world.rng[3] = state[3];
  if (sim.runtime.changed || sim.events.length > 0) world.revision += 1;
}
