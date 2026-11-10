/**
 * Système « dialogues » (lot L3). La touche d'action (`act`) sur un habitant visé ouvre la
 * conversation; ensuite `talk_next`, `talk_choose` et `talk_close`. Chaque joueur parle de son côté.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { endTalk, startTalk, talkChoose, talkNext } from './conversation';

function onIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- chaque système ignore les intentions des autres
  switch (intent.type) {
    case 'act': {
      const state = sim.world.players[player];
      const aim = state.aim;
      // Un habitant visé (et non un meuble): le registre des briques (L2) s'occupe des meubles.
      if (aim === null || state.talk !== null) return;
      if (sim.world.places[sim.world.common.place]?.villagers[aim] === undefined) return;
      startTalk(sim, player, aim);
      return;
    }
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
