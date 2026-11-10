/**
 * Déplacement des deux joueurs au clavier: accélération et freinage doux, glissement le long des
 * murs, coins adoucis. La commande arrive déjà dans le repère du monde (la caméra de chaque
 * machine l'a tournée, `entrees/commandes.ts`).
 *
 * `walkStep` et `canWalk` sont purs et ne lisent que le corps, la commande et l'état transmis:
 * l'élan tient tout entier dans `body.speed` et `body.facing`. L'hôte et la prédiction de l'invité
 * (`noyau/prediction.ts`) font donc tourner le même code et trouvent la même position.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Settings } from '../../donnees/schemas/reglages';
import type { Body } from '../../etat/joueur';
import type { ReadonlyWorld } from '../../etat/monde';
import { postureOf, standUp } from '../briques/postures';
import { freePlayer } from './deblocage';
import { bodyCollides, moveBody, type Blockers } from './grille';
import { currentBlockers } from './obstacles';
import { CORE_TUNING } from './reglages-noyau';
import type { SimContext } from './systemes';

/** Pas passés à pousser sans avancer, pris dans un obstacle. Hors de l'état: ni transmis ni sauvegardé. */
const stuckSteps = new WeakMap<object, [number, number]>();

function stuckOf(world: object): [number, number] {
  let stuck = stuckSteps.get(world);
  if (stuck === undefined) {
    stuck = [0, 0];
    stuckSteps.set(world, stuck);
  }
  return stuck;
}

/** Arrête net un joueur (placement, geste, dialogue): il repartira en accélérant. */
export function stopPlayer(sim: SimContext, player: PlayerIndex): void {
  stuckOf(sim.world)[player] = 0;
  sim.world.players[player].body.speed = 0;
}

/**
 * Le joueur marche librement: ni wagon, ni geste, ni dialogue, ni marchepied, ni place assise ou
 * couchée. (Chez l'hôte, une direction relève d'abord le joueur assis et coupe un geste long.)
 */
export function canWalk(world: ReadonlyWorld, player: PlayerIndex): boolean {
  const { phase, travel } = world.common;
  const actor = world.players[player];
  if (phase === 'travel' || actor.gesture !== null || actor.talk !== null) return false;
  if (travel?.boarded[player] === true) return false;
  const place = world.places[world.common.place];
  return place !== undefined && postureOf(place, player) === null;
}

/**
 * Un pas de marche. La vitesse (`body.speed`) rejoint la vitesse voulue en `accelSeconds`, à
 * l'accélération comme au freinage; le personnage se tourne tout de suite vers la direction
 * donnée et garde son cap en freinant. Modifie `body` en place.
 */
export function walkStep(
  b: Blockers,
  body: Body,
  moveX: number,
  moveY: number,
  run: boolean,
  movement: Settings['movement'],
  dt: number,
): void {
  const length = Math.hypot(moveX, moveY);
  const wants = length >= CORE_TUNING.moveDeadzone;
  const top = run ? movement.runSpeed : movement.walkSpeed;
  const wanted = wants ? top * Math.min(1, length) : 0;
  const change = movement.accelSeconds > 0 ? (top / movement.accelSeconds) * dt : top;
  const speed =
    body.speed < wanted
      ? Math.min(wanted, body.speed + change)
      : Math.max(wanted, body.speed - change);
  if (wants) body.facing = Math.atan2(moveY, moveX);
  if (speed <= 0) {
    body.speed = 0;
    return;
  }
  const fromX = body.x;
  const fromY = body.y;
  moveBody(
    b,
    body,
    Math.cos(body.facing) * speed * dt,
    Math.sin(body.facing) * speed * dt,
    movement.radius,
  );
  const done = Math.hypot(body.x - fromX, body.y - fromY) / dt;
  // En glissant le long d'un mur on garde son élan; arrêté de face, il tombe.
  body.speed = done < speed * 0.5 ? done : speed;
}

/** Déplace les deux joueurs selon leurs commandes du pas. */
export function movePlayers(sim: SimContext): void {
  const { world, content } = sim;
  const b = currentBlockers(content, world);
  const place = world.places[world.common.place];
  if (b === null || place === undefined) return;
  const stuck = stuckOf(world);
  const { movement } = content.settings;
  for (const index of [0, 1] as const) {
    const player = world.players[index];
    const input = sim.inputs[index];
    const wants = Math.hypot(input.moveX, input.moveY) >= CORE_TUNING.moveDeadzone;
    if (wants && player.gesture?.long === true) {
      // Un geste long s'interrompt en donnant une direction.
      player.gesture = null;
      sim.touch('players');
    }
    // Assis ou couché, une direction relève.
    if (wants && postureOf(place, index) !== null) standUp(sim, index);
    if (!canWalk(world, index)) {
      stopPlayer(sim, index);
      continue;
    }
    walkStep(b, player.body, input.moveX, input.moveY, input.run, movement, sim.dt);
    const pushing = wants && player.body.speed < movement.walkSpeed * 0.05;
    if (pushing && bodyCollides(b, player.body.x, player.body.y, movement.radius)) {
      stuck[index] += 1;
      if (stuck[index] * sim.dt >= CORE_TUNING.stuckSeconds) {
        stopPlayer(sim, index);
        if (freePlayer(content, world, index)) sim.emit({ type: 'unstuck', player: index });
      }
    } else stuck[index] = 0;
  }
}
