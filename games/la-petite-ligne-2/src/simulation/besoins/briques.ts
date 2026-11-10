/**
 * Brique `relieve` (se débarbouiller, le baquet, boire), à inscrire dans le registre
 * (`briques/registre.ts`, lot L2). Le gain arrive pendant le geste long, pas à pas (`index.ts`):
 * on peut sortir avant la fin et garder ce qui est gagné. `use` n'ajoute donc rien.
 */
import type { BrickRegistry } from '../briques/registre';

export const NEEDS_BRICKS: BrickRegistry = {
  relieve: {
    verb: 'Se laver',
    refuse(sim, player, target) {
      const value = sim.world.players[player].needs[target.params.need];
      return value >= target.params.cap ? 'not-needed' : null;
    },
    use: () => undefined,
  },
};
