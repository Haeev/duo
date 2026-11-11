/**
 * Brique `perform` (« jouer ici », inscrite dans `briques/registre.ts`): instrument en main, la
 * touche d'action installe le joueur à cet endroit et ouvre le cahier de fanfare; si l'autre y
 * tient déjà le cahier, elle le rejoint pour un duo.
 */
import type { BrickRegistry } from '../briques/registre';
import { sitIn } from './index';
import { heldInstrument } from './lecture';

export const PERFORM_BRICKS: BrickRegistry = {
  perform: {
    verb: 'Jouer ici',
    // Sur un meuble qui sert aussi à autre chose (un banc), elle s'efface sans instrument en main.
    inert(look, player, target) {
      if (heldInstrument(look.content, look.world, player) !== null) return false;
      return (look.content.props[target.type]?.bricks.length ?? 1) > 1;
    },
    refuse(look, player) {
      return heldInstrument(look.content, look.world, player) === null ? 'need-instrument' : null;
    },
    use(sim, player, target) {
      sitIn(sim, player, target);
    },
  },
};
