/**
 * Brique `mirror`: se regarder dans un miroir. L'appui rouvre l'éditeur de personnage chez ce
 * joueur seulement (événement `mirror_opened`); la validation repasse par l'intention `set_look`.
 */
import type { Brick } from '../../donnees/schemas/briques';
import { lookRevealed } from '../regles/apparence';
import type { BrickBehaviour } from './types';

type MirrorBrick = Extract<Brick, { brick: 'mirror' }>;

export const mirrorBehaviour: BrickBehaviour<MirrorBrick> = {
  verb: 'Se regarder',
  refuse(look, player) {
    // Avant la photo, le personnage n'a pas de visage: rien à regarder, rien à changer.
    return lookRevealed(look.world, player) ? null : 'no-face-yet';
  },
  use(sim, player, target) {
    sim.emit({ type: 'mirror_opened', player, target: target.id });
  },
};
