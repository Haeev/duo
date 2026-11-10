/**
 * Système « dialogues » (lot L3). La touche d'action sur un habitant ouvre la conversation (action
 * `talk` du registre des briques, `startTalk`); ensuite `talk_next`, `talk_choose` et `talk_close`. Chaque joueur parle de son côté.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { endTalk, talkChoose, talkNext } from './conversation';

function onIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- chaque système ignore les intentions des autres
  switch (intent.type) {
    case 'talk_next':
      talkNext(sim, player);
      return;
    case 'talk_choose':
      talkChoose(sim, player, intent.option);
      return;
    case 'talk_close':
      endTalk(sim, player);
      return;
    default:
      return;
  }
}

export const dialogueSystem: GameSystem = { id: 'dialogues', intent: onIntent };
