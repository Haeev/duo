/**
 * Brique `repair` (lot L3), inscrite dans le registre (`briques/registre.ts`): l'outil amélioré en
 * main retrouve toute son usure. Le rangement (`store`) est la brique du lot L2 (`briques/ranger.ts`).
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Stack } from '../../etat/joueur';
import type { BrickRegistry, Look } from '../briques/registre';
import { repairTool } from './outils';

/** La pile de la case de la barre en main, ou `null` (mains libres). */
export function heldStack(look: Look, player: PlayerIndex): Readonly<Stack> | null {
  const state = look.world.players[player];
  return state.selected === null ? null : (state.toolbar[state.selected] ?? null);
}

export const BAG_BRICKS: BrickRegistry = {
  repair: {
    verb: 'Réparer',
    refuse(look, player, target) {
      const stack = heldStack(look, player);
      const tool = stack === null ? null : (look.content.items[stack.item]?.tool ?? null);
      if (stack === null || tool === null) return 'no-tool-in-hand';
      if (!target.params.tools.includes(tool.kind) || tool.durability === 0) return 'cannot-repair';
      if (stack.wear === tool.durability) return 'already-sharp';
      return null;
    },
    use(sim, player) {
      const state = sim.world.players[player];
      const stack = state.selected === null ? null : (state.toolbar[state.selected] ?? null);
      if (stack !== null) repairTool(sim, player, stack);
    },
  },
};
