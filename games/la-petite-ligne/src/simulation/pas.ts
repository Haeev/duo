/**
 * Un pas de simulation (1 / SIM_HZ s). Seul point d'entrée qui fait avancer le
 * monde: l'hôte l'appelle à pas fixe avec les entrées des deux joueurs.
 */
import type { AuthoredIntent, ControlFrame } from '../etat/actions';
import type { CharacterId } from '../etat/types';
import { MOVE_DEADZONE, RIPE_VIEW_DISTANCE, SIM_DT } from './constantes';
import { type Sim, distance } from './contexte';
import { updateAim } from './agir';
import { standUp, updateSeats } from './bancs';
import { updatePlacement } from './amenagement';
import { loadPlaced, spawnLoads } from './portages';
import { queueHint, pumpHints } from './astuces';
import { updateConstructions, completeConstruction } from './construction';
import { autoStartScenes } from './dialogues';
import { pumpScripts } from './effets';
import { envieStayPoints, updateEnvies, updateStays } from './envies';
import { clearHandcarSpot, moveCharacter, refreshBlockers, updateBeam, updateInside } from './deplacement';
import { updateVillagers } from './habitants';
import { checkNight, updateAbsence, updateClock } from './horloge';
import { applyIntent, arrive, endGesture, heldRepeat, updateCrafting } from './intentions';
import { updateFishing } from './peche';
import { wanderHens } from './poules';
import { updateQuests } from './quetes';
import { updateTrain } from './train';
import { releaseHoldsOnMove, updateHolds, updateMoments } from './moments';
import { updateHenCalls } from './secrets';
import { forageHints } from './lisiere';

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

/**
 * Commandes du pas vues par la simulation: un joueur assis qui donne une
 * direction se relève (puis marche à ce pas); assis, l'action tenue ne compte pas.
 */
function seatedControls(sim: Sim, controls: StepInput['controls']): StepInput['controls'] {
  let out = controls;
  for (const c of sim.world.characters) {
    const f = controls[c.id];
    if (c.seat === null || f === undefined) continue;
    const moving = Math.hypot(f.moveX, f.moveY) >= MOVE_DEADZONE;
    if (moving && sim.world.phase === 'day' && (c.status === 'active' || c.status === 'menu') && standUp(sim, c)) continue;
    if (f.actHeld) {
      if (out === controls) out = { ...controls };
      out[c.id] = { ...f, actHeld: false };
    }
  }
  return out;
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

  for (const c of world.characters) {
    const f = input.controls[c.id];
    if (f !== undefined && (f.actHeld || f.moveX !== 0 || f.moveY !== 0)) c.lastInputTick = world.tick;
  }
  for (const { by, intent } of input.intents) {
    applyIntent(sim, by, intent);
    sim.runtime.changed = true;
  }

  // Assis: une direction relève (avant de marcher, au même pas); Espace tenu ne porte ni ne bâtit.
  const controls = seatedControls(sim, input.controls);
  if (world.phase === 'day') {
    // L'échelle: toute direction la lâche, puis l'on marche au même pas.
    releaseHoldsOnMove(sim, controls);
    spawnLoads(sim);
    const placed = updateBeam(sim, controls, dt);
    if (placed !== null) {
      if (placed.construction !== null) completeConstruction(sim, placed.construction);
      loadPlaced(sim, placed);
      if (placed.purpose === 'handcar') clearHandcarSpot(sim);
      for (const c of world.characters) c.heartToday.gesture = true;
      world.session.togetherMoments += 1;
    }
    for (const c of world.characters) {
      if (c.status === 'gesture') continue;
      if (moveCharacter(sim, c, controls[c.id], dt)) arrive(sim, c);
      updateCrafting(sim, c);
      endGesture(sim, c);
      heldRepeat(sim, c, controls[c.id]?.actHeld === true);
      updateFishing(sim, c);
    }
    updateConstructions(sim, controls, dt);
  }
  for (const c of world.characters) updateInside(sim, c);
  updateHolds(sim);
  updateSeats(sim);
  updateVillagers(sim, dt);
  wanderHens(sim, dt);
  updateTrain(sim, dt);
  updateAbsence(sim);
  updateClock(sim, dt);
  updateMoments(sim);
  updateHenCalls(sim);

  autoStartScenes(sim);
  pumpScripts(sim);
  updateQuests(sim);
  if (world.phase === 'day') {
    updateStays(sim, stayPointsOf(sim), dt);
    updateEnvies(sim);
    nearHints(sim);
    forageHints(sim);
  }
  for (const c of world.characters) {
    updatePlacement(sim, c);
    updateAim(sim, c);
  }
  pumpHints(sim);
  checkNight(sim);
  for (const c of world.characters) {
    if (c.pin !== null && world.tick >= c.pin.until) {
      c.pin = null;
      sim.runtime.changed = true;
    }
  }

  const state = sim.rng.getState();
  world.rng[0] = state[0];
  world.rng[1] = state[1];
  world.rng[2] = state[2];
  world.rng[3] = state[3];
  if (sim.runtime.changed || sim.events.length > 0) world.revision += 1;
}
