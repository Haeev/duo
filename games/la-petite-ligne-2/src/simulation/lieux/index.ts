/**
 * Système « lieux »: verrous d'histoire qui s'ouvrent quand leur condition devient vraie
 * (événement pour l'animation et le son, chez les deux joueurs) et portes qu'on passe en marchant
 * dessus. Les portes à la touche d'action passent par la brique `passage` (`passage.ts`).
 * Ce qui n'est pas dans l'état (dernier état connu des verrous, dernier refus de porte) ne sert
 * qu'à ne pas répéter un événement: rien ne s'y joue.
 */
import type { WorldState } from '../../etat/monde';
import { postureOf } from '../briques/postures';
import { freePlayer } from '../noyau/deblocage';
import { canWalk } from '../noyau/deplacement';
import { CORE_TUNING } from '../noyau/reglages-noyau';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { doorRefusal, passDoor, touchedDoor } from './portes';
import { conditionalObjects, refreshPresence } from './presents';
import { PLACES } from './reglages';
import { lockCount, locksOf, refreshLockStates } from './verrous';

export { isLockOpen, closedLocks, lockOfObject } from './verrous';
export { isZoneOpen, zoneViews, zoneAt, reachMask, type ZoneView } from './zones';
export { interiorAt, playerInterior, doorRefusal, passDoor, sillsOf } from './portes';
export { passageSays } from './passage';
export { edgePassable, closedLockSet } from './chemins';
export { absentObjects, isObjectAbsent, isObjectPresent } from './presents';
export { areaAt, doorChain, type DoorHop } from './traversee';

interface Runtime {
  place: string;
  readonly locks: Uint8Array;
  /** Copie de `locks` au pas précédent (gardée pour ne rien allouer à chaque pas). */
  readonly before: Uint8Array;
  /** Présence des meubles conditionnés (`when`), et sa copie au pas précédent. */
  readonly present: Uint8Array;
  readonly presentBefore: Uint8Array;
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
      present: new Uint8Array(conditionalObjects(place).length),
      presentBefore: new Uint8Array(conditionalObjects(place).length),
      refused: [null, null],
      arrived: [null, null],
    };
    refreshLockStates(sim, place, rt.locks);
    refreshPresence(sim, place, rt.present);
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

/**
 * Meubles conditionnés: un événement par meuble qui paraît ou disparaît, et un joueur pris dans
 * un meuble qui vient de paraître est dégagé sur la case libre la plus proche.
 */
function watchObjects(sim: SimContext, rt: Runtime): void {
  const place = sim.content.places[sim.world.common.place];
  const state = sim.world.places[sim.world.common.place];
  if (place === undefined || rt.present.length === 0) return;
  rt.presentBefore.set(rt.present);
  if (!refreshPresence(sim, place, rt.present)) return;
  conditionalObjects(place).forEach((object, i) => {
    if (rt.presentBefore[i] === rt.present[i]) return;
    sim.emit({ type: 'map_object_changed', object: object.id, present: rt.present[i] === 1 });
  });
  if (state === undefined) return;
  for (const player of [0, 1] as const) {
    if (postureOf(state, player) !== null) continue;
    if (!freePlayer(sim.content, sim.world, player)) continue;
    sim.touch('players');
    sim.emit({ type: 'unstuck', player });
  }
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
    watchObjects(sim, rt);
    walkThroughDoors(sim, rt);
  },
};
