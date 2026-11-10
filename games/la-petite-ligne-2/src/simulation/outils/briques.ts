/** Briques du lot outils et cultures, inscrites d'une ligne dans `briques/registre.ts`. */
import type { BrickRegistry } from '../briques/types';
import { fieldBehaviour } from '../cultures/potager';
import { harvestBehaviour } from './ressources';

export const HARVEST_BRICKS: BrickRegistry = {
  harvest: harvestBehaviour,
  field: fieldBehaviour,
};
