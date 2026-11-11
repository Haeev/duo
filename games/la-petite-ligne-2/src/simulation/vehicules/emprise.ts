/**
 * Emprise au sol d'un véhicule de voie posé à l'arrêt: on le contourne, on ne le traverse pas.
 * En marche il ne bloque rien (ses deux joueurs sont à bord); dans sa remise, c'est le bâtiment
 * qui bloque. Lu par les obstacles du lieu (`noyau/obstacles.ts`), chez l'hôte comme dans la
 * prédiction de l'invité: l'état du véhicule est transmis.
 */
import type { PlaceContent } from '../../donnees/charger';
import type { PlaceState } from '../../etat/lieu';
import type { DeepReadonly } from '../../etat/monde';
import type { VehiclePose } from '../monde/trains';
import { RAIL_VEHICLES, type RailVehicleSettings } from './reglages';
import { poseVehicle } from './voie';

type ReadPlace = DeepReadonly<PlaceState>;

const pose: VehiclePose = { model: '', x: 0, y: 0, yaw: 0, front: 0, back: 0 };

/** Empreinte des véhicules arrêtés du lieu (0: aucun): les obstacles se refont quand elle change. */
export function vehicleSignature(
  state: ReadPlace,
  settings: RailVehicleSettings = RAIL_VEHICLES,
): number {
  const vehicles = state.vehicles;
  if (vehicles === undefined) return 0;
  let h = 0;
  for (const id in vehicles) {
    const vehicle = vehicles[id];
    if (vehicle === undefined || !vehicle.out || vehicle.speed > settings.rest) continue;
    h = (Math.imul(h, 31) + Math.round(vehicle.s / settings.quantum) + 1) | 0;
  }
  return h;
}

/** Marque à 1 dans `cells` (grille du lieu) les cases sous les véhicules arrêtés sur leur voie. */
export function markVehicleCells(
  place: PlaceContent,
  state: ReadPlace,
  cells: Uint8Array,
  settings: RailVehicleSettings = RAIL_VEHICLES,
): void {
  const vehicles = state.vehicles;
  if (vehicles === undefined) return;
  const { width, height } = place.map;
  for (const id in vehicles) {
    const vehicle = vehicles[id];
    const def = place.vehicles[id];
    if (vehicle === undefined || def === undefined) continue;
    if (!vehicle.out || vehicle.speed > settings.rest) continue;
    if (!poseVehicle(place, def, vehicle, pose)) continue;
    const sin = Math.sin(pose.yaw);
    const cos = Math.cos(pose.yaw);
    const front = Math.max(0, def.body.front - settings.cellShrink);
    const back = Math.max(0, def.body.back - settings.cellShrink);
    const half = Math.max(0, def.body.halfWidth - settings.cellShrink);
    for (let a = -back; a <= front + 1e-9; a += settings.sample)
      for (let b = -half; b <= half + 1e-9; b += settings.sample) {
        const cx = Math.floor(pose.x + sin * a + cos * b);
        const cy = Math.floor(pose.y + cos * a - sin * b);
        if (cx >= 0 && cy >= 0 && cx < width && cy < height) cells[cy * width + cx] = 1;
      }
  }
}
