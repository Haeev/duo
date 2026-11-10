/**
 * Brique `relieve` (se débarbouiller, le baquet, boire), inscrite dans le registre
 * (`briques/registre.ts`). C'est un geste long: le gain arrive pas à pas pendant le geste
 * (`index.ts`), une direction l'interrompt et l'on garde ce qui est gagné. `use` n'ajoute donc
 * rien, et la fin du geste ne refait pas le contrôle (le besoin vient d'être comblé).
 */
import type { BrickRegistry } from '../briques/types';

export const NEEDS_BRICKS: BrickRegistry = {
  relieve: {
    verb: 'Se laver',
    recheckAtEnd: false,
    gesture(_look, _player, target) {
      return { clip: target.params.clip, seconds: target.params.seconds, long: true };
    },
    refuse(look, player, target) {
      const value = look.world.players[player].needs[target.params.need];
      return value >= target.params.cap ? 'not-needed' : null;
    },
    use: () => undefined,
  },
};
