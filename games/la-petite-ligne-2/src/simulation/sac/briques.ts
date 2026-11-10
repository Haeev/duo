/**
 * Briques du lot L3 côté sac, à inscrire dans le registre (`briques/registre.ts`, lot L2):
 * `store` (le meuble s'ouvre; les dépôts passent par `store_put` et `store_take`) et `repair`
 * (l'outil en main retrouve toute son usure).
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Stack } from '../../etat/joueur';
import type { BrickRegistry } from '../briques/registre';
import type { SimContext } from '../noyau/systemes';
import { repairTool } from './outils';

/** La pile de la case de la barre en main, ou `null` (mains libres). */
export function heldStack(sim: SimContext, player: PlayerIndex): Stack | null {
  const state = sim.world.players[player];
  return state.selected === null ? null : (state.toolbar[state.selected] ?? null);
}

export const BAG_BRICKS: BrickRegistry = {
  store: {
    verb: 'Ranger',
    refuse: () => null,
    // La fenêtre de rangement s'ouvre en local (événement `brick_used`): rien ne change ici.
    use: () => undefined,
  },
  repair: {
    verb: 'Réparer',
    refuse(sim, player, target) {
      const stack = heldStack(sim, player);
      const tool = stack === null ? null : (sim.content.items[stack.item]?.tool ?? null);
      if (stack === null || tool === null) return 'no-tool-in-hand';
      if (!target.params.tools.includes(tool.kind) || tool.durability === 0) return 'cannot-repair';
      if (stack.wear === tool.durability) return 'already-sharp';
      return null;
    },
    use(sim, player) {
      const stack = heldStack(sim, player);
      if (stack !== null) repairTool(sim, player, stack);
    },
  },
};
