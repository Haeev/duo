/** Création et remise au repos de l'état d'un véhicule de voie (`etat/vehicules.ts`). */
import type { PlaceState } from '../../etat/lieu';
import type { WorldState } from '../../etat/monde';
import type { RailVehicleState } from '../../etat/vehicules';

/** Un véhicule au repos dans sa remise, prêt à être posé à `launch` mètres du début de sa voie. */
export function garagedVehicle(launch: number): RailVehicleState {
  return {
    out: false,
    s: launch,
    speed: 0,
    dir: 1,
    riders: [null, null],
    brake: false,
    lever: { seat: null, tick: 0, gain: 0, rhythm: 0 },
    stop: null,
    warned: false,
  };
}

/** L'état du véhicule dans ce lieu, créé dans sa remise s'il n'y figurait pas encore. */
export function ensureVehicle(place: PlaceState, id: string, launch: number): RailVehicleState {
  const vehicles = (place.vehicles ??= {});
  return (vehicles[id] ??= garagedVehicle(launch));
}

/** Arrête un véhicule où il est: personne à bord, balancier au repos. */
export function restVehicle(state: RailVehicleState): void {
  state.speed = 0;
  state.brake = false;
  state.riders[0] = null;
  state.riders[1] = null;
  state.lever.seat = null;
  state.lever.tick = 0;
  state.lever.gain = 0;
  state.lever.rhythm = 0;
}

/**
 * Reprise d'une partie: chaque véhicule reste où il était (rangé, ou posé sur sa voie), à
 * l'arrêt, les joueurs descendus (le garde-fou des coincés les pose à côté).
 */
export function restVehicles(world: WorldState): void {
  for (const place of Object.values(world.places))
    for (const state of Object.values(place.vehicles ?? {})) restVehicle(state);
}
