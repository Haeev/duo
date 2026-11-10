/**
 * Action `talk`: ouvrir un dialogue avec un habitant. Le choix du dialogue (priorité, `when`,
 * `once`), le bonjour du jour et le graphe appartiennent au lot L3 (`dialogues/`); ici, la touche
 * d'action tourne l'habitant vers le joueur et ouvre la conversation.
 */
import type { DialogueDef } from '../../donnees/schemas/dialogue';
import { pickDialogue, startTalk } from '../dialogues/conversation';
import type { EntityBehaviour, Look } from './types';

export { endTalk } from '../dialogues/conversation';

/** Le dialogue que cet habitant ouvrirait pour ce joueur, `null` s'il n'a rien à dire. */
export function openingDialogue(look: Look, villager: string, player: 0 | 1): DialogueDef | null {
  return pickDialogue(look, player, villager);
}

export const talkBehaviour: EntityBehaviour = {
  verb: 'Parler',
  refuse(look, player, id) {
    const state = look.world.places[look.world.common.place];
    if (state?.villagers[id] === undefined) return 'gone';
    return openingDialogue(look, id, player) === null ? 'nothing-to-say' : null;
  },
  use(sim, player, id) {
    const villager = sim.world.places[sim.world.common.place]?.villagers[id];
    if (villager === undefined || !startTalk(sim, player, id)) return;
    const actor = sim.world.players[player];
    villager.body.facing = Math.atan2(
      actor.body.y - villager.body.y,
      actor.body.x - villager.body.x,
    );
  },
};
