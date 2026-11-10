/**
 * Brique `mirror`: se regarder dans un miroir. L'appui rouvre l'éditeur de personnage chez ce
 * joueur seulement (événement `mirror_opened`); la validation repasse par l'intention `set_look`.
 */
import type { Brick } from '../../donnees/schemas/briques';
import type { BrickBehaviour } from './types';

type MirrorBrick = Extract<Brick, { brick: 'mirror' }>;

export const mirrorBehaviour: BrickBehaviour<MirrorBrick> = {
  verb: 'Se regarder',
  refuse() {
    return null;
  },
  use(sim, player, target) {
    sim.emit({ type: 'mirror_opened', player, target: target.id });
  },
};
