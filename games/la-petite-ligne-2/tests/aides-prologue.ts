/**
 * Aides des tests qui jouent le prologue par la simulation: tout se lit dans les données du lieu
 * (briques des meubles, points de la carte), jamais par un identifiant de décor ni une position
 * en dur. Un wagon refait ne casse donc pas ces tests.
 */
import type { Content } from '../src/donnees/charger';
import type { BrickId } from '../src/donnees/schemas/briques';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { postureOf } from '../src/simulation/briques/postures';
import { nearestFreeCell } from '../src/simulation/noyau/grille';
import { currentBlockers } from '../src/simulation/noyau/obstacles';
import type { Sim } from '../src/simulation/noyau/pas';
import { act, wait } from './aides-l3';

/** Les meubles de la carte d'un lieu qui portent cette brique, dans l'ordre de la carte. */
export function propsWithBrick(content: Content, place: string, brick: BrickId): string[] {
  const objects = content.places[place]?.map.objects ?? [];
  return objects
    .filter((o) => content.props[o.type]?.bricks.some((b) => b.brick === brick) === true)
    .map((o) => o.id);
}

/** Pose un joueur sur la case libre la plus proche d'un meuble du lieu courant, tourné vers lui. */
export function standBy(sim: Sim, player: PlayerIndex, prop: string): void {
  const place = sim.content.places[sim.world.common.place];
  const object = place?.map.objects.find((o) => o.id === prop);
  const blockers = currentBlockers(sim.content, sim.world);
  if (object === undefined || blockers === null) throw new Error(`meuble ${prop} absent du lieu`);
  const cell = { x: 0, y: 0 };
  if (!nearestFreeCell(blockers, object.x, object.y, cell))
    throw new Error(`aucune case libre près de ${prop}`);
  sim.world.players[player].body = {
    x: cell.x,
    y: cell.y,
    facing: Math.atan2(object.y - cell.y, object.x - cell.x),
    speed: 0,
  };
}

/** Le joueur se couche sur ce lit comme à la manette: il s'en approche, puis la touche d'action. */
export function lieDown(sim: Sim, player: PlayerIndex, bed: string): void {
  standBy(sim, player, bed);
  wait(sim, 0.3);
  act(sim, player, { type: 'act' });
  wait(sim, 0.3);
}

/** Vrai si ce joueur est couché (posture `sleep`) dans le lieu courant. */
export function isLying(sim: Sim, player: PlayerIndex): boolean {
  const state = sim.world.places[sim.world.common.place];
  return state !== undefined && postureOf(state, player)?.kind === 'sleep';
}
