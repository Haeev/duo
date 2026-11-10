/**
 * Brique `gather`: prendre une hache au râtelier, cueillir une pomme, une part de tourte à l'étal.
 * Geste court, puis l'objet entre dans les poches. Avec un stock, chaque usage en retire un; le
 * stock revient en entier `refillMinutes` minutes de jeu après l'épuisement.
 */
import type { Brick } from '../../donnees/schemas/briques';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { DeepReadonly } from '../../etat/monde';
import type { BrickStates } from '../../etat/briques';
import { heldTool } from '../outils/outils';
import { giveToPlayer, roomFor } from './piles';
import type { BrickBehaviour, Look } from './types';

type Gather = Extract<Brick, { brick: 'gather' }>;

/** Minute absolue du jeu (jour 1 à 0 h: 0); le retour du stock s'y mesure. */
export function gameMinute(look: Look): number {
  return (look.world.common.day - 1) * 1440 + Math.floor(look.world.minutes);
}

/** Usages restants maintenant, retour du stock compris. `null`: sans limite. */
export function gatherLeft(
  look: Look,
  params: Gather,
  states: DeepReadonly<BrickStates>,
): number | null {
  if (params.stock === null) return null;
  const state = states.gather;
  if (state === undefined) return params.stock.count;
  if (state.refillAt !== null && gameMinute(look) >= state.refillAt) return params.stock.count;
  return state.left;
}

function refusal(
  look: Look,
  player: PlayerIndex,
  params: Gather,
  states: DeepReadonly<BrickStates>,
): string | null {
  if (params.tool !== null && heldTool(look, player, params.tool) === null)
    return `needs-${params.tool}`;
  if (gatherLeft(look, params, states) === 0) return 'not-yet-back';
  const stack = { item: params.gives.item, count: params.gives.count };
  return roomFor(look.content, look.world.players[player], stack) > 0 ? null : 'pockets-full';
}

export const gatherBehaviour: BrickBehaviour<Gather> = {
  verb: 'Prendre',
  verbOf(_look, _player, target) {
    return target.params.verb;
  },
  gesture(_look, _player, target) {
    return { clip: target.params.clip, seconds: target.params.seconds };
  },
  refuse(look, player, target) {
    return refusal(look, player, target.params, target.states);
  },
  use(sim, player, target) {
    const { params, states } = target;
    const left = gatherLeft(sim, params, states);
    const stack = { item: params.gives.item, count: params.gives.count };
    const rest = giveToPlayer(sim.content, sim.world.players[player], stack);
    const gained = stack.count - rest;
    if (gained > 0) sim.emit({ type: 'item_gained', player, item: stack.item, count: gained });
    if (rest > 0) sim.emit({ type: 'pockets_full', player, item: stack.item });
    if (params.stock !== null && left !== null && gained > 0) {
      const now = left - 1;
      states.gather = {
        left: now,
        refillAt: now === 0 ? gameMinute(sim) + params.stock.refillMinutes : null,
      };
      sim.touch('place');
    }
    sim.touch('players');
  },
};
