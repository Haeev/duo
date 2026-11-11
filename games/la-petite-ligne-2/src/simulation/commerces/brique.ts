/**
 * Brique `shop`, inscrite dans le registre (`briques/registre.ts`): la touche d'action sur le
 * comptoir ouvre la boutique (événement `shop_opened`). Le commerçant lui-même l'ouvre par l'effet
 * `open_shop` d'un de ses dialogues; fermé, il le dit en dialogue.
 *
 * Comptoir tenu (`held`): le commerçant se tient derrière, hors de portée de la touche d'action
 * depuis le côté client. La touche s'adresse alors à lui: s'il a un dialogue en attente (histoire,
 * quête, première rencontre, pas encore entendu ce jour), il se joue d'abord; sinon la boutique
 * s'ouvre, et l'écran de boutique garde « Parler » (intention `shop_talk`).
 */
import type { Brick } from '../../donnees/schemas/briques';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import { talkBehaviour } from '../briques/parler';
import type { BrickBehaviour, BrickView, Look } from '../briques/types';
import { pendingDialogue } from '../dialogues/conversation';
import { footprintOf } from '../noyau/obstacles';
import { openShop } from './index';
import { isTrading, shopDef } from './prix';
import { SHOP_TUNING } from './reglages';

type ShopBrick = Extract<Brick, { brick: 'shop' }>;

const BUY_VERB = 'Acheter';

/**
 * Le commerçant à qui parle la touche d'action sur ce comptoir, `null`: la boutique s'ouvre. Il
 * faut un comptoir tenu, son commerçant debout à moins de `SHOP_TUNING.keeperReach` de l'emprise,
 * et un dialogue en attente pour ce joueur.
 */
export function counterKeeper(
  look: Look,
  player: PlayerIndex,
  target: BrickView<ShopBrick>,
): string | null {
  if (target.params.held !== true) return null;
  const shop = shopDef(look, target.params.shop);
  const def = look.content.props[target.type];
  if (shop === null || def === undefined) return null;
  const keeper = look.world.places[look.world.common.place]?.villagers[shop.keeper];
  if (keeper === undefined || keeper.life?.presence === 'away') return null;
  const size = footprintOf(def, target.rotation);
  const { x, y } = keeper.body;
  const dx = Math.max(Math.abs(x - target.x) - size.w / 2, 0);
  const dy = Math.max(Math.abs(y - target.y) - size.h / 2, 0);
  if (Math.hypot(dx, dy) > SHOP_TUNING.keeperReach) return null;
  if (talkBehaviour.refuse(look, player, shop.keeper) !== null) return null;
  return pendingDialogue(look, player, shop.keeper) === null ? null : shop.keeper;
}

export const shopBehaviour: BrickBehaviour<ShopBrick> = {
  verb: BUY_VERB,
  verbOf(look, player, target) {
    return counterKeeper(look, player, target) === null ? BUY_VERB : talkBehaviour.verb;
  },
  refuse(look, player, target) {
    if (counterKeeper(look, player, target) !== null) return null;
    const shop = shopDef(look, target.params.shop);
    if (shop === null) return 'gone';
    return isTrading(look, shop) ? null : 'shop-closed';
  },
  use(sim, player, target) {
    const keeper = counterKeeper(sim, player, target);
    if (keeper !== null) talkBehaviour.use(sim, player, keeper);
    else openShop(sim, player, target.params.shop);
  },
};
