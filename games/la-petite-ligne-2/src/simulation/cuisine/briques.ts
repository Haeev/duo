/**
 * Brique `cook` (inscrite dans `briques/registre.ts`): viser un poste et appuyer ouvre le livre de
 * recettes chez ce joueur. Le choix de la recette part ensuite en intention `cook_start`.
 */
import type { BrickRegistry } from '../briques/registre';

export const COOK_BRICKS: BrickRegistry = {
  cook: {
    verb: 'Cuisiner',
    refuse() {
      return null;
    },
    use(sim, player, target) {
      sim.emit({
        type: 'kitchen_opened',
        player,
        target: target.id,
        station: target.params.station,
      });
    },
  },
};
