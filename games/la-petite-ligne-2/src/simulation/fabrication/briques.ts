/**
 * Brique `craft` (inscrite dans `briques/registre.ts`): viser un poste (établi, forge, métier,
 * meule) et appuyer ouvre l'atelier chez ce joueur. Le reste passe par les intentions `craft_*`.
 */
import type { BrickRegistry } from '../briques/registre';
import { openWorkshop } from './index';

const VERBS = {
  workbench: 'Fabriquer',
  forge: 'Forge',
  loom: 'Tisser',
  grindstone: 'Affûter',
} as const;

export const CRAFT_BRICKS: BrickRegistry = {
  craft: {
    verb: 'Fabriquer',
    verbOf(_look, _player, target) {
      return VERBS[target.params.station];
    },
    refuse() {
      return null;
    },
    use(sim, player, target) {
      openWorkshop(sim, player, target.id);
    },
  },
};
