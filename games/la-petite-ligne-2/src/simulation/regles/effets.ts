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
import { changeBond } from '../dialogues/amitie';
import { effectTargets } from '../dialogues/echanges';
import { earn, pay } from '../sac/argent';
import { removeItem } from '../sac/inventaire';
import { revealLook } from './apparence';
import { bump, playerFactKey, remember } from './memoire';
import { giveEntry, givePiece, givePlan, giveRecipe } from './recompenses';
import { choose } from '../quetes/decisions';

export function applyEffect(sim: SimContext, actor: PlayerIndex, effect: Effect): void {
  switch (effect.type) {
    case 'remember':
    case 'bump': {
      const key = effect.of === 'actor' ? playerFactKey(effect.key, actor) : effect.key;
      const by = effect.by === 'duo' ? 'duo' : actor;
      if (effect.type === 'remember') remember(sim, key, effect.value, by);
      else bump(sim, key, by, effect.amount ?? 1);
      return;
    }
    case 'give_item':
      for (const p of effectTargets(actor, effect.to)) giveItem(sim, p, effect.item, effect.count);
      return;
    case 'take_item':
      for (const p of effectTargets(actor, effect.to))
        if (removeItem(sim.world.players[p], effect.item, effect.count)) sim.touch('players');
      return;
    case 'give_money':
      for (const p of effectTargets(actor, effect.to)) earn(sim, p, effect.amount);
      return;
    case 'take_money':
      // Sans contrôle préalable (`exchangeRefusal`), une bourse trop maigre refuse sans payer.
      for (const p of effectTargets(actor, effect.to))
        if (pay(sim, p, effect.amount) !== null)
          sim.emit({ type: 'refused', player: p, reason: 'not-enough-money', target: null });
      return;
    case 'change_bond':
      for (const p of effectTargets(actor, effect.to))
        changeBond(sim, p, effect.villager, effect.points);
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
    case 'give_recipe':
      giveRecipe(sim, actor, effect.recipe);
      return;
    case 'give_plan':
      givePlan(sim, actor, effect.plan);
      return;
    case 'give_entry':
      giveEntry(sim, actor, effect.entry);
      return;
    case 'give_piece':
      givePiece(sim, actor, effect.piece);
      return;
    case 'choose':
      choose(sim, actor, effect.decision, effect.option);
      return;
    case 'reveal_look':
      for (const p of effectTargets(actor, effect.to)) revealLook(sim, p);
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
