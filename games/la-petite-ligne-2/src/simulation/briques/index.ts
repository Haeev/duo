/**
 * Système « briques » (lot L2): la touche d'action. À chaque pas il calcule la cible de chaque
 * joueur (`visee.ts`) et l'écrit dans `player.aim`; à l'appui il refuse (ce qui manque), lance le
 * geste de l'action, ou agit tout de suite. L'effet d'un geste tombe à sa fin, après un nouveau
 * contrôle: si l'autre joueur a pris la cible entre-temps, le premier appui gagne.
 */
import type { BrickId } from '../../donnees/schemas/briques';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Stack } from '../../etat/joueur';
import { exhaustedActionRefusal } from '../besoins/blocage';
import { isObjectAbsent } from '../lieux/presents';
import { findProp, footprintOf, type PropInstance } from '../noyau/obstacles';
import { refuseVehicle, useVehicle } from '../vehicules/cible';
import { riddenBy } from '../vehicules/places';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { sleepThroughNight } from './dormir';
import { gestureOf, gestureTicks } from './geste';
import { postureOf } from './postures';
import { storePut, storeTake } from './ranger';
import { BRICK_BEHAVIOURS, ENTITY_BEHAVIOURS } from './registre';
import type { ActionId, AimKind } from './types';
import { aimOf, behaviourOf, brickView } from './visee';

/** L'action qu'un geste en cours accomplira à sa fin. Hors de l'état: un geste ne survit pas à une reprise. */
interface Pending {
  readonly kind: AimKind;
  readonly id: string;
  readonly action: ActionId;
  readonly clip: string;
}

const pendings = new WeakMap<object, [Pending | null, Pending | null]>();

function pendingOf(world: object): [Pending | null, Pending | null] {
  let pending = pendings.get(world);
  if (pending === undefined) {
    pending = [null, null];
    pendings.set(world, pending);
  }
  return pending;
}

const PLAYERS: readonly PlayerIndex[] = [0, 1];

/** Le meuble de cet identifiant et sa brique, avec l'état modifiable de ses briques. */
function propBrick(
  sim: SimContext,
  id: string,
  brickId: BrickId,
): { prop: PropInstance; target: ReturnType<typeof brickView> } | null {
  const { world, content } = sim;
  const placeContent = content.places[world.common.place];
  const place = world.places[world.common.place];
  if (placeContent === undefined || place === undefined) return null;
  // Un meuble conditionné absent (`when` de la carte) n'existe pas: aucune brique ne s'y joue.
  const prop = isObjectAbsent(sim, id) ? null : findProp(placeContent, place, id);
  const brick =
    prop === null ? undefined : content.props[prop.type]?.bricks.find((b) => b.brick === brickId);
  if (prop === null || brick === undefined) return null;
  return { prop, target: brickView(place, prop, brick) };
}

/** Distance du joueur à l'emprise d'un meuble (m). */
function distanceToProp(sim: SimContext, player: PlayerIndex, prop: PropInstance): number {
  const def = sim.content.props[prop.type];
  if (def === undefined) return Number.POSITIVE_INFINITY;
  const size = footprintOf(def, prop.rotation);
  const { x, y } = sim.world.players[player].body;
  const nx = Math.max(prop.x - size.w / 2, Math.min(x, prop.x + size.w / 2));
  const ny = Math.max(prop.y - size.h / 2, Math.min(y, prop.y + size.h / 2));
  return Math.hypot(x - nx, y - ny);
}

/** Contrôle puis effet d'une action. `clip`: geste qui vient de finir, `null` pour un effet immédiat. */
function perform(
  sim: SimContext,
  player: PlayerIndex,
  kind: AimKind,
  id: string,
  action: ActionId,
  clip: string | null,
): void {
  let refusal: string | null = 'gone';
  let use: (() => void) | null = null;
  if (kind === 'prop') {
    const found =
      action === 'pickup' || action === 'talk' || action === 'vehicle'
        ? null
        : propBrick(sim, id, action);
    const behaviour =
      found === null ? undefined : behaviourOf(BRICK_BEHAVIOURS, found.target.params.brick);
    if (found !== null && behaviour !== undefined) {
      refusal =
        clip !== null && behaviour.recheckAtEnd === false
          ? null
          : behaviour.refuse(sim, player, found.target);
      const place = sim.world.places[sim.world.common.place];
      // L'état des briques du meuble, modifiable: créé s'il manquait (meuble sans mémoire).
      const states = place === undefined ? {} : (place.objects[id] ??= {});
      const brick = found.target.params.brick;
      use = (): void => {
        behaviour.use(sim, player, { ...found.target, states });
        sim.emit({ type: 'brick_used', player, target: id, brick });
      };
    }
  } else if (kind === 'vehicle') {
    refusal = refuseVehicle(sim, player, id);
    use = (): void => {
      useVehicle(sim, player, id);
    };
  } else {
    const behaviour = kind === 'ground' ? ENTITY_BEHAVIOURS.pickup : ENTITY_BEHAVIOURS.talk;
    refusal = behaviour.refuse(sim, player, id);
    use = (): void => {
      behaviour.use(sim, player, id);
    };
  }
  if (refusal !== null || use === null) {
    sim.emit({ type: 'refused', player, reason: refusal ?? 'gone', target: id });
    return;
  }
  use();
  if (clip !== null) sim.emit({ type: 'gesture_done', player, clip, target: id });
}

/** Lance l'action sur la cible: le geste s'il y en a un, sinon l'effet tout de suite. */
function begin(
  sim: SimContext,
  player: PlayerIndex,
  kind: AimKind,
  id: string,
  action: ActionId,
  x: number,
  y: number,
): void {
  const actor = sim.world.players[player];
  const dx = x - actor.body.x;
  const dy = y - actor.body.y;
  if (Math.hypot(dx, dy) > 1e-6) actor.body.facing = Math.atan2(dy, dx);
  const spec = gestureOf(sim, player, kind, id, action);
  if (spec === null) {
    perform(sim, player, kind, id, action, null);
    return;
  }
  const until = sim.world.tick + gestureTicks(sim.content, spec);
  actor.gesture = { clip: spec.clip, target: id, until, long: spec.long === true };
  pendingOf(sim.world)[player] = { kind, id, action, clip: spec.clip };
  sim.touch('players');
  sim.emit({ type: 'gesture_started', player, clip: spec.clip, target: id });
}

/** Libre d'agir: en journée, debout (ni assis ni à bord d'un véhicule), sans geste ni dialogue en cours. */
function canAct(sim: SimContext, player: PlayerIndex): boolean {
  const { world } = sim;
  const actor = world.players[player];
  if (world.common.phase !== 'day' && world.common.phase !== 'boarding') return false;
  if (actor.gesture !== null || actor.talk !== null) return false;
  if (world.common.travel?.boarded[player] === true) return false;
  const place = world.places[world.common.place];
  if (place === undefined || riddenBy(place, player) !== null) return false;
  return postureOf(place, player) === null;
}

/** Les cases d'un rangement à portée du joueur, `null` sinon (rien n'est dit: l'interface a fermé). */
function storeInReach(sim: SimContext, player: PlayerIndex, id: string): (Stack | null)[] | null {
  if (!canAct(sim, player)) return null;
  const found = propBrick(sim, id, 'store');
  if (found === null) return null;
  if (distanceToProp(sim, player, found.prop) > sim.content.settings.reach.action) return null;
  return sim.world.places[sim.world.common.place]?.objects[id]?.store ?? null;
}

/** Finit les gestes arrivés à terme. */
function finishGestures(sim: SimContext): void {
  const pending = pendingOf(sim.world);
  for (const player of PLAYERS) {
    const actor = sim.world.players[player];
    const gesture = actor.gesture;
    if (gesture === null || sim.world.tick < gesture.until) continue;
    const mine = pending[player];
    // Un geste d'un autre système (manger, lot L3) finit chez lui, au même pas, après celui-ci.
    // Passé ce pas, un geste resté là n'a plus de maître (partie reprise en plein geste): on le lève.
    if (mine === null && sim.world.tick <= gesture.until) continue;
    actor.gesture = null;
    pending[player] = null;
    sim.touch('players');
    if (mine !== null) perform(sim, player, mine.kind, mine.id, mine.action, mine.clip);
  }
}

/** Écrit la cible de chaque joueur dans l'état, quand elle change. */
function updateAims(sim: SimContext): void {
  for (const player of PLAYERS) {
    const actor = sim.world.players[player];
    const aim = aimOf(sim, player)?.id ?? null;
    if (aim === actor.aim) continue;
    actor.aim = aim;
    sim.touch('players');
  }
}

export const brickSystem: GameSystem = {
  id: 'briques',
  intent(sim, player, intent) {
    if (intent.type === 'act') {
      // À bord, la visée ne garde que le poteau du quai (pour redescendre): `aimOf` filtre.
      const aboard = sim.world.common.travel?.boarded[player] === true;
      if (!aboard && !canAct(sim, player)) return;
      const aim = aimOf(sim, player);
      // Sans cible, la touche d'action revient aux autres systèmes (manger un plat en main, L3).
      if (aim === null) return;
      if (aim.refusal !== null)
        sim.emit({ type: 'refused', player, reason: aim.refusal, target: aim.id });
      else begin(sim, player, aim.kind, aim.id, aim.action, aim.x, aim.y);
    } else if (intent.type === 'use_brick') {
      if (!canAct(sim, player)) return;
      const found = propBrick(sim, intent.target, intent.brick);
      if (found === null) return;
      if (distanceToProp(sim, player, found.prop) > sim.content.settings.reach.action) {
        sim.emit({ type: 'refused', player, reason: 'too-far', target: intent.target });
        return;
      }
      const exhausted = exhaustedActionRefusal(sim, player, intent.brick);
      if (exhausted !== null) {
        sim.emit({ type: 'refused', player, reason: exhausted, target: intent.target });
        return;
      }
      begin(sim, player, 'prop', intent.target, intent.brick, found.prop.x, found.prop.y);
    } else if (intent.type === 'store_put') {
      const slots = storeInReach(sim, player, intent.target);
      if (slots !== null) storePut(sim, player, intent.target, slots, intent.from);
    } else if (intent.type === 'store_take') {
      const slots = storeInReach(sim, player, intent.target);
      if (slots !== null) storeTake(sim, player, intent.target, slots, intent.index);
    }
  },
  step(sim) {
    finishGestures(sim);
    sleepThroughNight(sim);
    updateAims(sim);
  },
};
