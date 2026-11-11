/**
 * Un habitant qui écoute: il s'arrête et regarde le joueur qui joue (musique, cahier 4.7), comme
 * il s'arrête pour une conversation, puis reprend son trajet. Le système qui le retient redit
 * son écoute tant qu'elle dure (`holdAudience`); sans rappel, elle s'éteint seule.
 *
 * Rien de ceci n'est dans l'état: comme les trajets, l'écoute se refait après une reprise.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { WorldState } from '../../etat/monde';

interface Hold {
  readonly player: PlayerIndex;
  readonly untilTick: number;
}

const audiences = new WeakMap<WorldState, Map<string, Hold>>();

/** Cet habitant écoute ce joueur jusqu'au pas `untilTick`. */
export function holdAudience(
  world: WorldState,
  villager: string,
  player: PlayerIndex,
  untilTick: number,
): void {
  let holds = audiences.get(world);
  if (holds === undefined) {
    holds = new Map();
    audiences.set(world, holds);
  }
  holds.set(villager, { player, untilTick });
}

/** Le joueur que cet habitant écoute en ce moment, `null`: personne. */
export function listeningTo(world: WorldState, villager: string): PlayerIndex | null {
  const holds = audiences.get(world);
  const hold = holds?.get(villager);
  if (holds === undefined || hold === undefined) return null;
  if (world.tick <= hold.untilTick) return hold.player;
  holds.delete(villager);
  return null;
}
