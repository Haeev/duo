/**
 * Qui marche sur la voie devant un véhicule: un habitant présent, ou un joueur à pied (pas à
 * bord). Fonction pure, lue par le système chez l'hôte: le véhicule freine pour s'arrêter devant
 * lui, à `yield.gap`, et repart quand la voie est libre. Jamais de choc.
 */
import type { RailVehicleDef } from '../../donnees/schemas/vehicule';
import type { PlaceState } from '../../etat/lieu';
import type { DeepReadonly, ReadonlyWorld } from '../../etat/monde';
import type { RailVehicleState } from '../../etat/vehicules';
import { pointOn, project } from '../monde/trains';
import { RAIL_VEHICLES, type RailVehicleSettings } from './reglages';
import type { VehicleLine } from './voie';

const near = { x: 0, y: 0 };

/**
 * Place libre (m) entre le tampon de tête et le premier passant sur la voie, dans le sens de
 * marche et à moins de `yield.lookahead`; `Infinity` si la voie est libre. Un passant compte
 * quand son corps (rayon `radius`) touche le gabarit, à `yield.side` près.
 */
export function walkerAhead(
  world: ReadonlyWorld,
  place: DeepReadonly<PlaceState>,
  def: RailVehicleDef,
  line: VehicleLine,
  state: DeepReadonly<RailVehicleState>,
  radius: number,
  settings: RailVehicleSettings = RAIL_VEHICLES,
): number {
  const { lookahead, side } = settings.yield;
  const nose = state.dir === 1 ? def.body.front : def.body.back;
  const reach = def.body.halfWidth + radius + side;
  pointOn(line.track, state.s, near);
  const cx = near.x;
  const cy = near.y;
  let best = Infinity;
  const check = (x: number, y: number): void => {
    // Tri grossier avant la projection sur tout le tracé.
    if (Math.hypot(x - cx, y - cy) > lookahead + nose + reach) return;
    const s = project(line.track, x, y);
    pointOn(line.track, s, near);
    if (Math.hypot(x - near.x, y - near.y) > reach) return;
    const gap = (s - state.s) * state.dir - nose - radius;
    // Déjà à côté ou derrière le tampon: il n'est pas devant (il monte, il descend, il est passé).
    if (gap < -radius || gap > lookahead) return;
    best = Math.min(best, Math.max(0, gap));
  };
  for (const id in place.villagers) {
    const villager = place.villagers[id];
    if (villager === undefined || villager.life?.presence === 'away') continue;
    check(villager.body.x, villager.body.y);
  }
  for (const player of [0, 1] as const) {
    if (state.riders[0] === player || state.riders[1] === player) continue;
    const body = world.players[player].body;
    check(body.x, body.y);
  }
  return best;
}
