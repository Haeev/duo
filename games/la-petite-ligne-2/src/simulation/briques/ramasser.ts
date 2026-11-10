/**
 * Action `pickup`: ramasser un objet posé au sol (`place.ground`). Geste court; à sa fin, ce qui
 * tient dans les poches y entre, le reste demeure au sol. Si l'autre joueur a pris l'objet entre
 * l'appui et la fin du geste, le premier appui gagne (cahier 4.11): refus doux.
 */
import { CORE_TUNING } from '../noyau/reglages-noyau';
import { giveToPlayer, roomFor } from './piles';
import type { EntityBehaviour, Look } from './types';

const PREFIX = 'sol-';

/** Identifiant de cible d'un objet au sol. */
export function groundAimId(id: number): string {
  return `${PREFIX}${id}`;
}

function groundIndex(look: Look, aimId: string): number {
  const state = look.world.places[look.world.common.place];
  if (state === undefined || !aimId.startsWith(PREFIX)) return -1;
  const id = Number(aimId.slice(PREFIX.length));
  return state.ground.findIndex((item) => item.id === id);
}

export const pickupBehaviour: EntityBehaviour = {
  verb: 'Ramasser',
  gesture(look) {
    return { clip: CORE_TUNING.pickupClip, seconds: look.content.settings.gestures.pickSeconds };
  },
  refuse(look, player, id) {
    const state = look.world.places[look.world.common.place];
    const item = state?.ground[groundIndex(look, id)];
    if (item === undefined) return 'gone';
    return roomFor(look.content, look.world.players[player], item.stack) > 0
      ? null
      : 'pockets-full';
  },
  use(sim, player, id) {
    const state = sim.world.places[sim.world.common.place];
    const index = groundIndex(sim, id);
    const item = state?.ground[index];
    if (state === undefined || item === undefined) return;
    const left = giveToPlayer(sim.content, sim.world.players[player], item.stack);
    const gained = item.stack.count - left;
    if (left === 0) state.ground.splice(index, 1);
    else {
      item.stack.count = left;
      sim.emit({ type: 'pockets_full', player, item: item.stack.item });
    }
    if (gained > 0) sim.emit({ type: 'item_gained', player, item: item.stack.item, count: gained });
    sim.touch('players');
    sim.touch('place');
  },
};
