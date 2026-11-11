/**
 * Système « véhicules de voie »: la draisine d'Aubrune et tout véhicule à deux places déclaré
 * dans `lieux/<lieu>/vehicules/`. L'hôte fait autorité: position sur la voie, vitesse, qui est à
 * bord vivent dans l'état du lieu (`place.vehicles`), transmis et sauvegardé avec lui.
 *
 * À bord: la touche d'action donne un coup de balancier (brique `drive` de la fiche), la touche
 * de course serre le frein et, à l'arrêt, inverse le sens de marche; une direction donnée à
 * l'arrêt fait descendre. Le véhicule suit le tracé de sa voie entre ses butées et les cases
 * fermées (verrous d'histoire), s'arrête de lui-même en bout de voie, et cède toujours la voie
 * aux trains des événements: il ne part pas quand l'un d'eux est annoncé, et il est rangé
 * d'office, sans dommage, quand le train arrive.
 */
import type { PlaceContent } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { RailVehicleDef } from '../../donnees/schemas/vehicule';
import type { RailVehicleState } from '../../etat/vehicules';
import { minutesToTrain, type VehiclePose } from '../monde/trains';
import { bodyCollides, nearestFreeCell } from '../noyau/grille';
import { currentBlockers } from '../noyau/obstacles';
import { CORE_TUNING } from '../noyau/reglages-noyau';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { evaluateAll } from '../regles/conditions';
import { applyEffects } from '../regles/effets';
import { restVehicle } from './etat';
import { walkerAhead } from './passants';
import { ridersAboard, riddenBy, seatOf } from './places';
import { strokeLever, type Stroke } from './pompe';
import { SIM_HZ } from '../noyau/constantes';
import { RAIL_VEHICLES } from './reglages';
import {
  exitPlace,
  limitsOf,
  lineOf,
  poseVehicle,
  seatPlace,
  stopAt,
  type Limits,
  type Place2,
  type VehicleLine,
} from './voie';

/** Ce qui ne vit que le temps d'une séance: ni transmis ni sauvegardé. */
interface Runtime {
  /** Touche de frein tenue au pas précédent (l'inversion se fait à l'appui, pas au maintien). */
  readonly braking: [boolean, boolean];
  /** Le joueur a lâché ses directions depuis l'arrêt: la prochaine le fait descendre. */
  readonly ready: [boolean, boolean];
  /** Véhicules en marche: le départ ne s'annonce qu'une fois, quand il roule vraiment. */
  readonly rolling: Set<string>;
  /** Véhicules qui cèdent la voie à un passant: la vitesse à reprendre quand elle sera libre. */
  readonly held: Map<string, number>;
  /** Véhicules arrêtés devant un passant: ils repartent avec un coup de timbre. */
  readonly waiting: Set<string>;
}

const runtimes = new WeakMap<object, Runtime>();

function runtimeOf(world: object): Runtime {
  let runtime = runtimes.get(world);
  if (runtime === undefined) {
    runtime = {
      braking: [false, false],
      ready: [false, false],
      rolling: new Set(),
      held: new Map(),
      waiting: new Set(),
    };
    runtimes.set(world, runtime);
  }
  return runtime;
}

const PLAYERS: readonly PlayerIndex[] = [0, 1];
const SEATS = [0, 1] as const;
const pose: VehiclePose = { model: '', x: 0, y: 0, yaw: 0, front: 0, back: 0 };
const spot: Place2 = { x: 0, y: 0, facing: 0 };
const limits: Limits = { min: 0, max: 0 };
const stroke: Stroke = { kind: 'same', quality: 0, gain: 0 };

/** Pose ce joueur à côté du véhicule: du côté de sa place, sinon de l'autre, sinon au plus près. */
function setDown(
  sim: SimContext,
  place: PlaceContent,
  def: RailVehicleDef,
  state: RailVehicleState,
  seat: 0 | 1,
): void {
  const player = state.riders[seat];
  if (player === null) return;
  state.riders[seat] = null;
  runtimeOf(sim.world).ready[player] = false;
  sim.touch('place');
  sim.emit({ type: 'vehicle_seat', vehicle: def.id, player, seat: null });
  const blockers = currentBlockers(sim.content, sim.world);
  if (blockers === null || !poseVehicle(place, def, state, pose)) return;
  const body = sim.world.players[player].body;
  const radius = sim.content.settings.movement.radius;
  const first: 1 | -1 = def.seats[seat].exit === 'left' ? 1 : -1;
  for (const side of [first, first === 1 ? -1 : 1] as const) {
    exitPlace(pose, def, def.seats[seat], side, radius, spot);
    if (bodyCollides(blockers, spot.x, spot.y, radius)) continue;
    body.facing = Math.atan2(spot.y - body.y, spot.x - body.x);
    body.x = spot.x;
    body.y = spot.y;
    body.speed = 0;
    return;
  }
  exitPlace(pose, def, def.seats[seat], first, radius, spot);
  if (nearestFreeCell(blockers, spot.x, spot.y, spot)) {
    body.x = spot.x;
    body.y = spot.y;
  }
  body.speed = 0;
}

/** Rentre le véhicule d'office (un train arrive): chacun est posé à côté de la voie. */
function putAway(
  sim: SimContext,
  place: PlaceContent,
  def: RailVehicleDef,
  line: VehicleLine,
  state: RailVehicleState,
): void {
  for (const seat of SEATS) setDown(sim, place, def, state, seat);
  restVehicle(state);
  state.out = false;
  state.s = line.launch;
  state.stop = null;
  state.warned = false;
  sim.touch('place');
  sim.emit({ type: 'vehicle_in', vehicle: def.id, reason: 'train' });
}

/** Place libre devant le véhicule dans son sens de marche (m). */
function roomAhead(state: RailVehicleState, range: Limits): number {
  return state.dir === 1 ? range.max - state.s : state.s - range.min;
}

/** Un coup de balancier de ce joueur (touche d'action à bord). */
function pump(
  sim: SimContext,
  place: PlaceContent,
  def: RailVehicleDef,
  state: RailVehicleState,
  player: PlayerIndex,
  seat: 0 | 1,
): void {
  const vehicle = def.id;
  if (ridersAboard(state) < 2) {
    sim.emit({ type: 'vehicle_stroke', vehicle, player, kind: 'alone', quality: 0 });
    return;
  }
  const done = strokeLever(def.drive, state.lever, seat, sim.world.tick, stroke);
  sim.touch('place');
  sim.emit({ type: 'vehicle_stroke', vehicle, player, kind: done.kind, quality: done.quality });
  if (done.kind === 'same') return;
  const rest = RAIL_VEHICLES.rest;
  const resting = state.speed <= rest;
  if (resting && done.gain > 0) {
    // En bout de voie, il ne peut repartir que dans l'autre sens.
    limitsOf(sim, place, def, state.s, limits);
    if (roomAhead(state, limits) <= RAIL_VEHICLES.clearance) {
      state.dir = state.dir === 1 ? -1 : 1;
      if (roomAhead(state, limits) <= RAIL_VEHICLES.clearance) return;
      sim.emit({ type: 'vehicle_turned', vehicle, dir: state.dir });
    }
  }
  state.speed = Math.max(0, Math.min(def.speed.max, state.speed + done.gain));
}

/** Le véhicule vient de s'arrêter: arrêt de la fiche, bout de voie, effets pour les suites. */
function halt(
  sim: SimContext,
  def: RailVehicleDef,
  line: VehicleLine,
  state: RailVehicleState,
  end: boolean,
): void {
  state.speed = 0;
  const runtime = runtimeOf(sim.world);
  runtime.rolling.delete(def.id);
  runtime.held.delete(def.id);
  runtime.waiting.delete(def.id);
  state.stop = stopAt(line, def, state.s);
  // En bout de voie, le seul chemin est le retour: le sens s'inverse de lui-même.
  if (end) state.dir = state.dir === 1 ? -1 : 1;
  sim.emit({ type: 'vehicle_stopped', vehicle: def.id, stop: state.stop, end });
  const actor = state.riders[0] ?? state.riders[1];
  const rules = def.stops.find((stop) => stop.id === state.stop)?.arrive;
  if (actor === null || rules === undefined) return;
  for (const rule of rules) {
    if (!evaluateAll({ world: sim.world, content: sim.content, actor }, rule.when)) continue;
    applyEffects(sim, actor, rule.effects);
  }
}

/** Un pas d'un véhicule sorti. */
function advance(
  sim: SimContext,
  place: PlaceContent,
  def: RailVehicleDef,
  line: VehicleLine,
  state: RailVehicleState,
): void {
  const runtime = runtimeOf(sim.world);
  const rest = RAIL_VEHICLES.rest;
  const due = minutesToTrain(sim, sim.world.common.place, def.track);
  if (due <= 0) {
    putAway(sim, place, def, line, state);
    return;
  }
  const warned = due <= def.trains.warnMinutes;
  if (warned !== state.warned) {
    state.warned = warned;
    sim.touch('place');
    if (warned) sim.emit({ type: 'vehicle_warning', vehicle: def.id });
  }

  // Frein et sens de marche: la touche de course de qui est à bord.
  let brake = false;
  let turn = false;
  // Qui serre le frein, ou qui le lâche (il le tenait au pas d'avant).
  let by: PlayerIndex | null = null;
  for (const seat of SEATS) {
    const player = state.riders[seat];
    if (player === null) continue;
    const held = sim.inputs[player].run;
    if (held && !runtime.braking[player] && state.speed <= rest) turn = true;
    if (held !== runtime.braking[player]) by ??= player;
    brake ||= held;
  }
  if (brake !== state.brake) {
    state.brake = brake;
    sim.touch('place');
    const player = by ?? state.riders[0] ?? state.riders[1] ?? 0;
    sim.emit({ type: 'vehicle_brake', vehicle: def.id, player, on: brake, speed: state.speed });
  }
  if (turn) {
    state.dir = state.dir === 1 ? -1 : 1;
    sim.touch('place');
    sim.emit({ type: 'vehicle_turned', vehicle: def.id, dir: state.dir });
  }

  if (state.speed > rest && !runtime.rolling.has(def.id)) {
    runtime.rolling.add(def.id);
    state.stop = null;
    sim.emit({ type: 'vehicle_started', vehicle: def.id });
  }

  // Un passant sur la voie (habitant, joueur à pied): il lui cède, freine en douceur pour
  // s'arrêter à `yield.gap` de lui, et repart quand la voie est libre. Jamais de choc.
  const { endBrake } = def.speed;
  const yielding = RAIL_VEHICLES.yield;
  const placeState = sim.world.places[sim.world.common.place];
  const free =
    placeState === undefined
      ? Infinity
      : walkerAhead(sim.world, placeState, def, line, state, sim.content.settings.movement.radius);
  const cap = Math.sqrt(2 * endBrake * Math.max(0, free - yielding.gap));
  let held = runtime.held.get(def.id);
  if (held !== undefined && (brake || ridersAboard(state) === 0)) {
    // Frein serré ou plus personne à bord: il ne reprendra rien de lui-même.
    runtime.held.delete(def.id);
    held = undefined;
    if (state.speed <= rest) halt(sim, def, line, state, false);
  } else if (cap < state.speed || held !== undefined) {
    held = Math.max(held ?? 0, state.speed);
    runtime.held.set(def.id, held);
  }

  if (state.speed > 0 || held !== undefined) {
    const { roll, drag, brake: brakeForce } = def.speed;
    let speed = state.speed - (roll + drag * state.speed + (brake ? brakeForce : 0)) * sim.dt;
    if (held !== undefined) {
      const waiting = runtime.waiting.has(def.id);
      if (!waiting || free > yielding.gap + yielding.resume) {
        if (waiting) {
          // Voie libre: un petit coup de timbre, et il reprend sa vitesse.
          runtime.waiting.delete(def.id);
          sim.emit({ type: 'vehicle_bell', vehicle: def.id });
        }
        speed = Math.max(speed, Math.min(held, state.speed + yielding.accel * sim.dt));
      }
      speed = Math.min(speed, cap);
    }
    limitsOf(sim, place, def, state.s, limits);
    const room = Math.max(0, roomAhead(state, limits));
    // Il freine de lui-même pour s'arrêter à la butée, jamais contre elle.
    speed = Math.min(speed, Math.sqrt(2 * endBrake * room));
    const end = room <= RAIL_VEHICLES.atEnd;
    if (end || (speed <= rest && held === undefined)) {
      halt(sim, def, line, state, end);
      sim.touch('place');
    } else if (speed <= rest) {
      // Arrêté devant le passant: il attend, sans être « arrêté » (ni arrêt, ni effets).
      runtime.waiting.add(def.id);
      if (state.speed !== 0) {
        state.speed = 0;
        sim.touch('place');
      }
    } else {
      state.speed = speed;
      state.s = Math.max(limits.min, Math.min(limits.max, state.s + state.dir * speed * sim.dt));
      if (held !== undefined && speed >= held) runtime.held.delete(def.id);
      sim.touch('place');
    }
  }

  // Rythme perdu: l'indicateur retombe.
  const lever = state.lever;
  if (lever.rhythm > 0 && sim.world.tick - lever.tick > def.drive.lost * SIM_HZ) {
    lever.rhythm = 0;
    sim.touch('place');
  }

  // Qui est à bord suit sa place; à l'arrêt, une direction donnée après l'avoir lâchée fait descendre.
  if (!poseVehicle(place, def, state, pose)) return;
  const still = state.speed <= rest;
  for (const seat of SEATS) {
    const player = state.riders[seat];
    if (player === null) continue;
    const input = sim.inputs[player];
    const wants = Math.hypot(input.moveX, input.moveY) >= CORE_TUNING.moveDeadzone;
    if (still && wants && runtime.ready[player]) {
      runtime.ready[player] = false;
      setDown(sim, place, def, state, seat);
      continue;
    }
    runtime.ready[player] = still && !wants;
    const body = sim.world.players[player].body;
    seatPlace(pose, def.seats[seat], spot);
    body.x = spot.x;
    body.y = spot.y;
    body.facing = spot.facing;
    body.speed = 0;
  }
}

export const vehicleSystem: GameSystem = {
  id: 'vehicules',
  intent(sim, player, intent) {
    if (intent.type !== 'act' || sim.world.common.phase !== 'day') return;
    const placeState = sim.world.places[sim.world.common.place];
    const place = sim.content.places[sim.world.common.place];
    if (placeState === undefined || place === undefined) return;
    const id = riddenBy(placeState, player);
    const state = id === null ? undefined : placeState.vehicles?.[id];
    const def = id === null ? undefined : place.vehicles[id];
    if (state === undefined || def === undefined) return;
    const seat = seatOf(state, player);
    if (seat !== -1) pump(sim, place, def, state, player, seat);
  },
  step(sim) {
    const placeState = sim.world.places[sim.world.common.place];
    const place = sim.content.places[sim.world.common.place];
    const runtime = runtimeOf(sim.world);
    if (placeState !== undefined && place !== undefined && placeState.vehicles !== undefined)
      for (const id in placeState.vehicles) {
        const state = placeState.vehicles[id];
        const def = place.vehicles[id];
        const line = def === undefined ? null : lineOf(place, def);
        if (state === undefined || def === undefined || line === null || !state.out) continue;
        advance(sim, place, def, line, state);
      }
    for (const player of PLAYERS) runtime.braking[player] = sim.inputs[player].run;
  },
};
