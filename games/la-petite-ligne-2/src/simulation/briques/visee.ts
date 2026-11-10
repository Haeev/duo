/**
 * Visée de la touche d'action: une seule cible à la fois, toujours un objet visible (meuble,
 * objet au sol, habitant), montrée avant l'appui avec son verbe. Fonction pure de l'état transmis
 * (ADR 0020): l'hôte s'en sert pour agir, l'invité et l'interface pour montrer la cible.
 *
 * Choix: parmi ce qui est à portée et dans le cône devant le personnage, d'abord ce qui sert
 * l'outil en main, puis ce qui peut servir, enfin ce qui est refusé (la bulle dit ce qui manque);
 * à rang égal, le plus proche de l'axe du regard.
 */
import type { Brick, BrickId } from '../../donnees/schemas/briques';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { PropDef } from '../../donnees/schemas/meuble';
import { isWallCell, type Blockers } from '../noyau/grille';
import {
  currentBlockers,
  footprintOf,
  type PropInstance,
  type ReadPlace,
} from '../noyau/obstacles';
import { CORE_TUNING } from '../noyau/reglages-noyau';
import { postureOf } from './postures';
import { groundAimId } from './ramasser';
import { BRICK_BEHAVIOURS, ENTITY_BEHAVIOURS } from './registre';
import type {
  ActionId,
  Aim,
  AimKind,
  BrickBehaviour,
  BrickRegistry,
  BrickView,
  Look,
} from './types';

/** Le comportement d'une brique; les méthodes acceptent la brique large (elles relisent `params`). */
export function behaviourOf(registry: BrickRegistry, brick: BrickId): BrickBehaviour | undefined {
  return registry[brick];
}

/** Ce que voit une brique de son meuble (lecture seule). */
export function brickView(place: ReadPlace, prop: PropInstance, params: Brick): BrickView {
  const { id, type, x, y, rotation } = prop;
  return { id, type, x, y, rotation, params, states: place.objects[id] ?? {} };
}

/** Sorte d'outil tenue en main, `null` mains libres ou objet qui n'est pas un outil. */
function heldTool(look: Look, player: PlayerIndex): string | null {
  const actor = look.world.players[player];
  const stack = actor.selected === null ? null : (actor.toolbar[actor.selected] ?? null);
  return stack === null ? null : (look.content.items[stack.item]?.tool?.kind ?? null);
}

/** La brique demande-t-elle l'outil tenu ? */
function wantsTool(brick: Brick, tool: string | null): boolean {
  if (tool === null) return false;
  if ('tool' in brick) return brick.tool === tool;
  if ('tools' in brick) return brick.tools.some((kind) => kind === tool);
  return false;
}

/**
 * La brique d'un meuble que ferait la touche d'action: la première utilisable dans l'ordre de ses
 * données (celle de l'outil en main d'abord), sinon la première refusée. `null`: meuble inerte.
 */
export function chooseBrick(
  look: Look,
  player: PlayerIndex,
  place: ReadPlace,
  prop: PropInstance,
  def: PropDef,
  registry: BrickRegistry,
): { brick: Brick; behaviour: BrickBehaviour; refusal: string | null; tool: boolean } | null {
  const tool = heldTool(look, player);
  let fallback: ReturnType<typeof chooseBrick> = null;
  let usable: ReturnType<typeof chooseBrick> = null;
  for (const brick of def.bricks) {
    const behaviour = behaviourOf(registry, brick.brick);
    if (behaviour === undefined) continue;
    const refusal = behaviour.refuse(look, player, brickView(place, prop, brick));
    const withTool = wantsTool(brick, tool);
    const found = { brick, behaviour, refusal, tool: withTool };
    if (refusal !== null) fallback ??= found;
    else if (withTool) return found;
    else usable ??= found;
  }
  return usable ?? fallback;
}

function wrap(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Un mur entre le personnage et le point visé ? (les meubles ne cachent pas une cible) */
function behindWall(b: Blockers, fromX: number, fromY: number, x: number, y: number): boolean {
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    if (isWallCell(b, Math.floor(fromX + (x - fromX) * t), Math.floor(fromY + (y - fromY) * t)))
      return true;
  }
  return false;
}

/** La cible de la touche d'action de ce joueur, `null` s'il n'y en a pas. */
export function aimOf(
  look: Look,
  player: PlayerIndex,
  registry: BrickRegistry = BRICK_BEHAVIOURS,
): Aim | null {
  const { content, world } = look;
  const { phase, travel } = world.common;
  if (phase !== 'day' && phase !== 'boarding') return null;
  const actor = world.players[player];
  if (actor.gesture !== null || actor.talk !== null || travel?.boarded[player] === true)
    return null;
  const placeContent = content.places[world.common.place];
  const place = world.places[world.common.place];
  const blockers = currentBlockers(content, world);
  if (placeContent === undefined || place === undefined || blockers === null) return null;
  if (postureOf(place, player) !== null) return null;

  const { x: px, y: py, facing } = actor.body;
  const reach = content.settings.reach.action;
  const halfAngle = (content.settings.reach.aimHalfAngleDeg * Math.PI) / 180;
  let best: Aim | null = null;
  let bestRank = Number.POSITIVE_INFINITY;

  const consider = (
    kind: AimKind,
    id: string,
    x: number,
    y: number,
    pick: () => { action: ActionId; verb: string; refusal: string | null; tool: boolean } | null,
  ): void => {
    const distance = Math.hypot(x - px, y - py);
    if (distance > reach) return;
    const angle = distance < 1e-6 ? 0 : Math.abs(wrap(Math.atan2(y - py, x - px) - facing));
    if (angle > halfAngle || behindWall(blockers, px, py, x, y)) return;
    const picked = pick();
    if (picked === null) return;
    const tier = picked.tool && picked.refusal === null ? 0 : picked.refusal === null ? 1 : 2;
    const rank = tier * 10 + angle / halfAngle + (CORE_TUNING.aimDistanceWeight * distance) / reach;
    if (rank >= bestRank) return;
    bestRank = rank;
    best = { kind, id, action: picked.action, verb: picked.verb, refusal: picked.refusal, x, y };
  };

  const considerProp = (prop: PropInstance): void => {
    const def = content.props[prop.type];
    if (def === undefined || def.bricks.length === 0) return;
    // Point de l'emprise le plus proche du personnage: un banc large se vise par n'importe quel bout.
    const size = footprintOf(def, prop.rotation);
    const x = Math.max(prop.x - size.w / 2, Math.min(px, prop.x + size.w / 2));
    const y = Math.max(prop.y - size.h / 2, Math.min(py, prop.y + size.h / 2));
    consider('prop', prop.id, x, y, () => {
      const chosen = chooseBrick(look, player, place, prop, def, registry);
      if (chosen === null) return null;
      const { brick, behaviour, refusal, tool } = chosen;
      const verb =
        behaviour.verbOf?.(look, player, brickView(place, prop, brick)) ??
        ('verb' in brick ? brick.verb : behaviour.verb);
      return { action: brick.brick, verb, refusal, tool };
    });
  };
  for (const object of placeContent.map.objects) considerProp(object);
  for (const placed of place.placed) considerProp(placed);

  const { pickup, talk } = ENTITY_BEHAVIOURS;
  for (const item of place.ground) {
    const id = groundAimId(item.id);
    consider('ground', id, item.x, item.y, () => ({
      action: 'pickup',
      verb: pickup.verb,
      refusal: pickup.refuse(look, player, id),
      tool: false,
    }));
  }
  for (const id in place.villagers) {
    const body = place.villagers[id]?.body;
    if (body === undefined) continue;
    consider('villager', id, body.x, body.y, () => ({
      action: 'talk',
      verb: talk.verb,
      refusal: talk.refuse(look, player, id),
      tool: false,
    }));
  }
  return best;
}
