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
import { canRun } from '../besoins/endurance';
import { modifiersOf, neutralModifiers } from '../besoins/jauges';
import { postureOf, standUp } from '../briques/postures';
import { riddenBy } from '../vehicules/places';
import { freePlayer } from './deblocage';
import { bodyCollides, keepOffBars, moveBody, type Blockers } from './grille';
import { currentBlockers } from './obstacles';
import { CORE_TUNING } from './reglages-noyau';
import type { SimContext } from './systemes';

/** Modificateurs des besoins relus à chaque pas, sans allocation. */
const scratch = neutralModifiers();

/** Facteur de vitesse que les besoins donnent à ce joueur (bien reposé, affamé, épuisé). */
export function speedFactorOf(
  content: SimContext['content'],
  world: ReadonlyWorld,
  player: PlayerIndex,
): number {
  return modifiersOf(content, world, player, scratch).speed;
}

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
 * couchée, ni place à bord d'un véhicule de voie. (Chez l'hôte, une direction relève d'abord le joueur assis et coupe un geste long.)
 */
export function canWalk(world: ReadonlyWorld, player: PlayerIndex): boolean {
  const { phase, travel } = world.common;
  const actor = world.players[player];
  if (phase === 'travel' || actor.gesture !== null || actor.talk !== null) return false;
  if (travel?.boarded[player] === true) return false;
  const place = world.places[world.common.place];
  if (place === undefined || riddenBy(place, player) !== null) return false;
  return postureOf(place, player) === null;
}

/**
 * Prochaine vitesse au sol. Jusqu'au pas de marche: élan en `accelSeconds`, arrêt en
 * `brakeSeconds`. Entre la marche et la course: `runShiftSeconds` dans les deux sens, pour prendre
 * son pas de course en quelques foulées et le quitter sans à-coup.
 */
function nextSpeed(
  speed: number,
  wanted: number,
  walkTop: number,
  runTop: number,
  movement: Settings['movement'],
  dt: number,
): number {
  const shift = movement.runShiftSeconds ?? movement.accelSeconds;
  const rate = (span: number, seconds: number): number =>
    seconds > 0 ? (span / seconds) * dt : Number.POSITIVE_INFINITY;
  if (speed < wanted) {
    // Sous le pas de marche, l'élan; au-dessus, le passage à la course.
    const next =
      speed < walkTop
        ? Math.min(walkTop, speed + rate(walkTop, movement.accelSeconds))
        : speed + rate(runTop - walkTop, shift);
    return Math.min(wanted, next);
  }
  if (speed > walkTop && wanted > 0) return Math.max(wanted, speed - rate(runTop - walkTop, shift));
  return Math.max(wanted, speed - rate(Math.max(walkTop, speed), movement.brakeSeconds));
}

/**
 * Un pas de marche. La vitesse (`body.speed`) rejoint la vitesse voulue (`nextSpeed`); `factor`
 * est celui des besoins (`modifiersOf(...).speed`). Le personnage se tourne tout de suite vers la
 * direction donnée (le rendu adoucit le virage et le fait pencher) et garde son cap en freinant.
 * Modifie `body` en place.
 */
export function walkStep(
  b: Blockers,
  body: Body,
  moveX: number,
  moveY: number,
  run: boolean,
  movement: Settings['movement'],
  dt: number,
  factor = 1,
): void {
  const length = Math.hypot(moveX, moveY);
  const wants = length >= CORE_TUNING.moveDeadzone;
  const walkTop = movement.walkSpeed * factor;
  const runTop = Math.max(walkTop, movement.runSpeed * factor);
  const wanted = wants ? (run ? runTop : walkTop) * Math.min(1, length) : 0;
  const speed = nextSpeed(body.speed, wanted, walkTop, runTop, movement, dt);
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
  // Une barrière de passage à niveau baissée: on s'y arrête en venant de la route.
  keepOffBars(b, fromX, fromY, body, movement.radius);
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
    const factor = speedFactorOf(content, world, index);
    // Essoufflé, la touche de course ne fait que marcher (`besoins/endurance.ts`).
    const run = input.run && canRun(world, index);
    walkStep(b, player.body, input.moveX, input.moveY, run, movement, sim.dt, factor);
    const pushing = wants && player.body.speed < movement.walkSpeed * factor * 0.05;
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
