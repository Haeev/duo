/**
 * Les véhicules de voie sous la touche d'action: à la porte de la remise, sortir le véhicule ou
 * le rentrer; à son bord de voie, monter. Fonctions pures pour la visée (l'invité montre la même
 * cible que l'hôte), effets chez l'hôte seulement (`useVehicle`).
 */
import type { PlaceContent } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { RailVehicleDef } from '../../donnees/schemas/vehicule';
import type { Look } from '../briques/types';
import { minutesToTrain, type VehiclePose } from '../monde/trains';
import { freePlayer } from '../noyau/deblocage';
import type { SimContext } from '../noyau/systemes';
import { evaluateAll } from '../regles/conditions';
import { ensureVehicle } from './etat';
import { ridersAboard } from './places';
import { RAIL_VEHICLES } from './reglages';
import {
  garageDoor,
  limitsOf,
  lineOf,
  nearestOnBody,
  poseVehicle,
  seatPlace,
  stopAt,
  type Limits,
  type Place2,
  type ReadVehicle,
  type VehicleLine,
} from './voie';

/** Préfixes des cibles (`Aim.id`): monter à bord, ou la porte de la remise. */
const BOARD = 'vehicule-';
const GARAGE = 'remise-';

export type VehicleTarget = 'board' | 'garage';

/** Identifiant de cible d'un véhicule. */
export function vehicleAimId(target: VehicleTarget, vehicle: string): string {
  return (target === 'board' ? BOARD : GARAGE) + vehicle;
}

/** Le véhicule et la cible que désigne cet identifiant, `null` si ce n'en est pas un. */
export function parseVehicleAim(id: string): { target: VehicleTarget; vehicle: string } | null {
  if (id.startsWith(BOARD)) return { target: 'board', vehicle: id.slice(BOARD.length) };
  if (id.startsWith(GARAGE)) return { target: 'garage', vehicle: id.slice(GARAGE.length) };
  return null;
}

/** Un train d'événement est-il à quai, en marche ou annoncé sur la voie de ce véhicule ? */
export function trainDue(look: Look, def: RailVehicleDef): boolean {
  return minutesToTrain(look, look.world.common.place, def.track) <= def.trains.warnMinutes;
}

const pose: VehiclePose = { model: '', x: 0, y: 0, yaw: 0, front: 0, back: 0 };
const spot: Place2 = { x: 0, y: 0, facing: 0 };
const limits: Limits = { min: 0, max: 0 };

/** Le véhicule est-il arrêté, vide, à son point de pose (on peut le rentrer) ? */
function atLaunch(line: VehicleLine, state: ReadVehicle): boolean {
  return (
    state.speed <= RAIL_VEHICLES.rest &&
    ridersAboard(state) === 0 &&
    Math.abs(state.s - line.launch) <= RAIL_VEHICLES.launchReach
  );
}

interface Offer {
  readonly verb: string;
  readonly refusal: string | null;
}

/** Ce que la porte de la remise offre à ce joueur, `null` si elle n'offre rien. */
function garageOffer(
  look: Look,
  def: RailVehicleDef,
  line: VehicleLine,
  state?: ReadVehicle,
): Offer | null {
  if (state?.out === true)
    return atLaunch(line, state) ? { verb: def.lines.rollIn, refusal: null } : null;
  // Tant que la suite n'en a pas donné la clé, la porte reste une porte: pas une cible.
  const ctx = { world: look.world, content: look.content, actor: null };
  if (!evaluateAll(ctx, def.available)) return null;
  return { verb: def.lines.rollOut, refusal: trainDue(look, def) ? 'train-due' : null };
}

/** Ce que le véhicule sorti offre à ce joueur. */
function boardOffer(look: Look, def: RailVehicleDef, state: ReadVehicle): Offer {
  const refusal =
    state.speed > RAIL_VEHICLES.rest
      ? 'vehicle-moving'
      : ridersAboard(state) >= 2
        ? 'seat-taken'
        : trainDue(look, def)
          ? 'train-due'
          : null;
  return { verb: def.lines.board, refusal };
}

/**
 * Présente à la visée (`visit`) les cibles des véhicules du lieu pour un joueur en (x, y): le
 * bord du véhicule sorti, la porte de sa remise.
 */
export function eachVehicleAim(
  look: Look,
  place: PlaceContent,
  x: number,
  y: number,
  visit: (id: string, x: number, y: number, offer: () => Offer | null) => void,
): void {
  const states = look.world.places[look.world.common.place]?.vehicles;
  for (const id in place.vehicles) {
    const def = place.vehicles[id];
    const line = def === undefined ? null : lineOf(place, def);
    if (def === undefined || line === null) continue;
    const state = states?.[id];
    garageDoor(line, spot);
    visit(vehicleAimId('garage', id), spot.x, spot.y, () => garageOffer(look, def, line, state));
    if (state?.out !== true || !poseVehicle(place, def, state, pose)) continue;
    nearestOnBody(pose, def, x, y, spot);
    visit(vehicleAimId('board', id), spot.x, spot.y, () => boardOffer(look, def, state));
  }
}

function resolve(
  look: Look,
  id: string,
): { def: RailVehicleDef; line: VehicleLine; place: PlaceContent; target: VehicleTarget } | null {
  const parsed = parseVehicleAim(id);
  const place = look.content.places[look.world.common.place];
  const def = parsed === null ? undefined : place?.vehicles[parsed.vehicle];
  const line = def === undefined || place === undefined ? null : lineOf(place, def);
  if (parsed === null || place === undefined || def === undefined || line === null) return null;
  return { def, line, place, target: parsed.target };
}

/** Clé de texte du refus de cette cible pour ce joueur, `null` si l'appui agit. */
export function refuseVehicle(look: Look, _player: PlayerIndex, id: string): string | null {
  const found = resolve(look, id);
  if (found === null) return 'gone';
  const state = look.world.places[look.world.common.place]?.vehicles?.[found.def.id];
  if (found.target === 'garage') {
    const offer = garageOffer(look, found.def, found.line, state);
    return offer === null ? 'gone' : offer.refusal;
  }
  return state?.out === true ? boardOffer(look, found.def, state).refusal : 'gone';
}

/** L'appui agit: sortir le véhicule, le rentrer, ou monter à la place libre la plus proche. */
export function useVehicle(sim: SimContext, player: PlayerIndex, id: string): void {
  const found = resolve(sim, id);
  const placeState = sim.world.places[sim.world.common.place];
  if (found === null || placeState === undefined) return;
  const { def, line, place } = found;
  const state = ensureVehicle(placeState, def.id, line.launch);
  sim.touch('place');
  if (found.target === 'garage') {
    if (state.out) {
      state.out = false;
      state.stop = null;
      sim.emit({ type: 'vehicle_in', vehicle: def.id, reason: 'player' });
      return;
    }
    state.out = true;
    state.s = line.launch;
    state.speed = 0;
    state.brake = false;
    state.warned = false;
    state.stop = stopAt(line, def, state.s);
    // Il part du côté où la voie est la plus longue: le premier coup de balancier y mène.
    limitsOf(sim, place, def, state.s, limits);
    state.dir = limits.max - state.s >= state.s - limits.min ? 1 : -1;
    sim.emit({ type: 'vehicle_out', vehicle: def.id, player });
    // Qui se tenait là où il se pose est écarté, sans un mot de plus.
    for (const p of [0, 1] as const)
      if (freePlayer(sim.content, sim.world, p)) sim.emit({ type: 'unstuck', player: p });
    return;
  }
  if (!poseVehicle(place, def, state, pose)) return;
  const body = sim.world.players[player].body;
  let seat: 0 | 1 | -1 = -1;
  let nearest = Number.POSITIVE_INFINITY;
  for (const index of [0, 1] as const) {
    if (state.riders[index] !== null) continue;
    seatPlace(pose, def.seats[index], spot);
    const distance = (spot.x - body.x) ** 2 + (spot.y - body.y) ** 2;
    // Égalité: la première place, pour un choix identique sur les deux machines.
    if (distance < nearest - 1e-9) {
      nearest = distance;
      seat = index;
    }
  }
  if (seat === -1) return;
  state.riders[seat] = player;
  seatPlace(pose, def.seats[seat], spot);
  body.x = spot.x;
  body.y = spot.y;
  body.facing = spot.facing;
  body.speed = 0;
  sim.emit({ type: 'vehicle_seat', vehicle: def.id, player, seat });
}
