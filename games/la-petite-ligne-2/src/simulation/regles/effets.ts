/**
 * Application des effets des données (options de dialogue, nœuds `effects`, quêtes au jalon 2),
 * au nom du joueur qui agit. Chaque effet passe par le système qui possède ce qu'il touche, qui
 * se charge des événements et des tranches à renvoyer.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Effect } from '../../donnees/schemas/regles';
import { relieveNeed } from '../besoins/soins';
import { openShop } from '../commerces/index';
import type { SimContext } from '../noyau/systemes';
import { equipBag, giveItem } from '../sac/actions';
import { earn } from '../sac/argent';
import { removeItem } from '../sac/inventaire';
import { remember } from './memoire';

export function applyEffect(sim: SimContext, actor: PlayerIndex, effect: Effect): void {
  switch (effect.type) {
    case 'remember':
      remember(sim, effect.key, effect.value, effect.by === 'duo' ? 'duo' : actor);
      return;
    case 'give_item':
      giveItem(sim, actor, effect.item, effect.count);
      return;
    case 'take_item':
      if (removeItem(sim.world.players[actor], effect.item, effect.count)) sim.touch('players');
      return;
    case 'give_money':
      earn(sim, actor, effect.amount);
      return;
    case 'change_need':
      relieveNeed(sim, actor, effect.need, effect.amount, effect.cap);
      return;
    case 'give_bag':
      equipBag(sim, actor, effect.bag);
      return;
    case 'open_shop':
      openShop(sim, actor, effect.shop);
      return;
  }
}

export function applyEffects(
  sim: SimContext,
  actor: PlayerIndex,
  effects: readonly Effect[],
): void {
  for (const effect of effects) applyEffect(sim, actor, effect);
}
