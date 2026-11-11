/**
 * Brique `sit`: s'asseoir sur une place libre du meuble. On y reste jusqu'à donner une direction
 * (`noyau/deplacement.ts`); le sommeil remonte doucement tant qu'on est assis (`index.ts`).
 */
import type { Brick } from '../../donnees/schemas/briques';
import { freeSeat, nearestFreeSeat, settle } from './postures';
import type { BrickBehaviour } from './types';

type SitBrick = Extract<Brick, { brick: 'sit' }>;

export const sitBehaviour: BrickBehaviour<SitBrick> = {
  verb: 'S’asseoir',
  refuse(_look, _player, target) {
    return freeSeat(target.states.sit) < 0 ? 'seat-taken' : null;
  },
  use(sim, player, target) {
    const def = sim.content.props[target.type];
    const seats = target.states.sit;
    if (def === undefined || seats === undefined) return;
    const seat = nearestFreeSeat(sim, player, target, def, seats);
    if (seat < 0) return;
    settle(sim, player, target, def, seats, seat);
  },
};
