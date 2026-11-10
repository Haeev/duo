/**
 * Brique `travel`: un objet visible du quai (poteau d'arrêt, portière du wagon) qui fait monter
 * dans le train. La touche d'action vise l'objet; derrière, c'est l'intention `board` qui
 * s'applique, avec les mêmes refus (`boardRefusal`). Destination: le premier lieu desservi.
 */
import type { Brick } from '../../donnees/schemas/briques';
import type { BrickBehaviour, Look } from '../briques/types';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import { boardingChoices, boardRefusal, travelSystem } from './index';

type TravelBrick = Extract<Brick, { brick: 'travel' }>;

/** Lieu où monter depuis ce quai, ou la raison du refus pour le premier lieu desservi. */
function destination(look: Look, player: PlayerIndex): { to: string } | { refusal: string } {
  const to = boardingChoices(look, player)[0];
  if (to !== undefined) return { to };
  const first = look.content.places[look.world.common.place]?.def.links[0];
  if (first === undefined) return { refusal: 'no-line' };
  return { refusal: boardRefusal(look, player, first) ?? 'no-line' };
}

export const travelBehaviour: BrickBehaviour<TravelBrick> = {
  verb: 'Monter',
  refuse(look, player) {
    const found = destination(look, player);
    return 'refusal' in found ? found.refusal : null;
  },
  use(sim, player) {
    const found = destination(sim, player);
    if ('to' in found) travelSystem.intent?.(sim, player, { type: 'board', to: found.to });
  },
};
