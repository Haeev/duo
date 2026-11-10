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
 * Un pas de marche. La vitesse (`body.speed`) rejoint la vitesse voulue en `accelSeconds` à
 * l'accélération, en `brakeSeconds` au freinage; le personnage se tourne tout de suite vers la
 * direction donnée et garde son cap en freinant. Modifie `body` en place.
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
  // Mise en vitesse en `accelSeconds`, freinage en `brakeSeconds` (plus court: on s'arrête net).
  const speeding = body.speed < wanted;
  const seconds = speeding ? movement.accelSeconds : movement.brakeSeconds;
  const change = seconds > 0 ? (top / seconds) * dt : top;
  const speed = speeding
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
  separateBodies(sim, b);
}

/**
 * Écarte de `share` du chevauchement le corps `body` de (x, y), s'il ne finit pas dans un mur.
 * `tie`: sens est (1) ou ouest (-1) pour deux corps exactement superposés.
 */
function nudge(
  b: Blockers,
  body: Body,
  x: number,
  y: number,
  gap: number,
  share: number,
  radius: number,
  tie = 1,
): void {
  const dx = body.x - x;
  const dy = body.y - y;
  const distance = Math.hypot(dx, dy);
  const overlap = gap - distance;
  if (overlap <= 0) return;
  // Deux corps exactement superposés: sens fixé par l'appelant, le même sur les deux machines.
  const ux = distance > 1e-6 ? dx / distance : tie;
  const uy = distance > 1e-6 ? dy / distance : 0;
  const nx = body.x + ux * overlap * share;
  const ny = body.y + uy * overlap * share;
  if (bodyCollides(b, nx, ny, radius)) return;
  body.x = nx;
  body.y = ny;
}

/**
 * Les joueurs ne traversent plus l'autre joueur ni les habitants: chaque pas rend une part du
 * chevauchement (`bodyPushPerSecond`). Seuls les joueurs libres de marcher bougent; un habitant
 * garde sa route (son système le mène), c'est le joueur qui s'écarte.
 */
function separateBodies(sim: SimContext, b: Blockers): void {
  const { world, content } = sim;
  const place = world.places[world.common.place];
  if (place === undefined) return;
  const radius = content.settings.movement.radius;
  const gap = radius * 2;
  const share = Math.min(1, CORE_TUNING.bodyPushPerSecond * sim.dt);
  const [first, second] = world.players;
  const free0 = canWalk(world, 0);
  const free1 = canWalk(world, 1);
  if (free0 && free1) {
    const x0 = first.body.x;
    const y0 = first.body.y;
    nudge(b, first.body, second.body.x, second.body.y, gap, share / 2, radius);
    nudge(b, second.body, x0, y0, gap, share / 2, radius, -1);
  } else if (free0) nudge(b, first.body, second.body.x, second.body.y, gap, share, radius);
  else if (free1) nudge(b, second.body, first.body.x, first.body.y, gap, share, radius);
  for (const id in place.villagers) {
    const villager = place.villagers[id];
    if (villager === undefined) continue;
    if (free0) nudge(b, first.body, villager.body.x, villager.body.y, gap, share, radius);
    if (free1) nudge(b, second.body, villager.body.x, villager.body.y, gap, share, radius);
  }
}
