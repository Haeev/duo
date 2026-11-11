/**
 * Qui est à bord d'un véhicule de voie: lecture seule de l'état transmis, sans autre dépendance
 * (le déplacement, la visée et la prédiction de l'invité s'en servent).
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { PlaceState } from '../../etat/lieu';
import type { DeepReadonly } from '../../etat/monde';
import type { RailVehicleState } from '../../etat/vehicules';

type ReadPlace = DeepReadonly<PlaceState>;

/** Le véhicule où ce joueur a pris place, `null` s'il est à pied. */
export function riddenBy(place: ReadPlace, player: PlayerIndex): string | null {
  const vehicles = place.vehicles;
  if (vehicles === undefined) return null;
  for (const id in vehicles) {
    const riders = vehicles[id]?.riders;
    if (riders !== undefined && (riders[0] === player || riders[1] === player)) return id;
  }
  return null;
}

/** La place de ce joueur à bord (0 ou 1), -1 s'il n'y est pas. */
export function seatOf(state: DeepReadonly<RailVehicleState>, player: PlayerIndex): 0 | 1 | -1 {
  return state.riders[0] === player ? 0 : state.riders[1] === player ? 1 : -1;
}

/** Nombre de joueurs à bord. */
export function ridersAboard(state: DeepReadonly<RailVehicleState>): number {
  return (state.riders[0] === null ? 0 : 1) + (state.riders[1] === null ? 0 : 1);
}
