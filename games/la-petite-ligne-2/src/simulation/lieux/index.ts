/**
 * Système « lieux »: verrous d'histoire qui s'ouvrent quand leur condition devient vraie
 * (événement pour l'animation et le son, chez les deux joueurs) et portes qu'on passe en marchant
 * dessus. Les portes à la touche d'action passent par la brique `passage` (`passage.ts`).
 * Ce qui n'est pas dans l'état (dernier état connu des verrous, dernier refus de porte) ne sert
 * qu'à ne pas répéter un événement: rien ne s'y joue.
 */
import type { WorldState } from '../../etat/monde';
import { canWalk } from '../noyau/deplacement';
import { CORE_TUNING } from '../noyau/reglages-noyau';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { doorRefusal, passDoor, touchedDoor } from './portes';
import { PLACES } from './reglages';
import { lockCount, locksOf, refreshLockStates } from './verrous';

export { isLockOpen, closedLocks, lockOfObject } from './verrous';
export { isZoneOpen, zoneViews, zoneAt, reachMask, type ZoneView } from './zones';
export { interiorAt, playerInterior, doorRefusal, passDoor, sillsOf } from './portes';
export { passageSays } from './passage';
export { edgePassable, closedLockSet } from './chemins';

interface Runtime {
  place: string;
  readonly locks: Uint8Array;
  /** Copie de `locks` au pas précédent (gardée pour ne rien allouer à chaque pas). */
  readonly before: Uint8Array;
  /** Porte refusée à chaque joueur, tant qu'il la touche (un seul refus par approche). */
  readonly refused: [string | null, string | null];
  /**
   * Point d'arrivée du dernier passage de chaque joueur, tant que la direction tenue alors ne
   * peut pas le faire repasser (`rearmDistance`); `null`: il peut passer.
   */
  readonly arrived: [{ x: number; y: number } | null, { x: number; y: number } | null];
}

const runtimes = new WeakMap<WorldState, Runtime>();

function runtimeOf(sim: SimContext): Runtime | null {
  const place = sim.content.places[sim.world.common.place];
  if (place === undefined) return null;
  let rt = runtimes.get(sim.world);
  if (rt?.place !== sim.world.common.place) {
    // Arrivée dans un lieu ou reprise d'une sauvegarde: l'état des verrous se relit sans événement.
    rt = {
      place: sim.world.common.place,
      locks: new Uint8Array(lockCount(place)),
      before: new Uint8Array(lockCount(place)),
      refused: [null, null],
      arrived: [null, null],
    };
    refreshLockStates(sim, place, rt.locks);
    runtimes.set(sim.world, rt);
  }
  return rt;
}

function watchLocks(sim: SimContext, rt: Runtime): void {
  const place = sim.content.places[sim.world.common.place];
  if (place === undefined) return;
  rt.before.set(rt.locks);
  if (!refreshLockStates(sim, place, rt.locks)) return;
  locksOf(place).forEach(([id, lock], i) => {
    if (rt.before[i] === rt.locks[i]) return;
    sim.emit({
      type: rt.locks[i] === 1 ? 'lock_opened' : 'lock_closed',
      lock: id,
      object: lock.object,
    });
  });
}

/** Le joueur peut-il repasser une porte en marchant ? Faux tant qu'il tient la direction du dernier passage. */
function rearmed(sim: SimContext, rt: Runtime, player: 0 | 1, wants: boolean): boolean {
  const from = rt.arrived[player];
  if (from === null) return true;
  const body = sim.world.players[player].body;
  if (wants && Math.hypot(body.x - from.x, body.y - from.y) < PLACES.rearmDistance) return false;
  rt.arrived[player] = null;
  return true;
}

function walkThroughDoors(sim: SimContext, rt: Runtime): void {
  const place = sim.content.places[sim.world.common.place];
  if (place?.map.doors === undefined || sim.world.common.phase !== 'day') return;
  const radius = sim.content.settings.movement.radius;
  for (const player of [0, 1] as const) {
    const input = sim.inputs[player];
    const wants = Math.hypot(input.moveX, input.moveY) >= CORE_TUNING.moveDeadzone;
    const body = sim.world.players[player].body;
    const id =
      rearmed(sim, rt, player, wants) && canWalk(sim.world, player)
        ? touchedDoor(place, body, radius, wants)
        : null;
    const door = id === null ? undefined : place.map.doors[id];
    if (id === null || door === undefined) {
      rt.refused[player] = null;
      continue;
    }
    const refusal = doorRefusal(sim, player, door);
    if (refusal === null) {
      rt.refused[player] = null;
      if (passDoor(sim, player, id)) rt.arrived[player] = { x: body.x, y: body.y };
    } else if (rt.refused[player] !== id) {
      rt.refused[player] = id;
      sim.emit({ type: 'refused', player, reason: refusal, target: door.object ?? id });
    }
  }
}

export const placeSystem: GameSystem = {
  id: 'lieux',
  step(sim) {
    const rt = runtimeOf(sim);
    if (rt === null) return;
    watchLocks(sim, rt);
    walkThroughDoors(sim, rt);
  },
};
