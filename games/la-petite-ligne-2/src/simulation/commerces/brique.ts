/**
 * Brique `shop`, inscrite dans le registre (`briques/registre.ts`): la touche d'action sur le
 * comptoir ouvre la boutique (événement `shop_opened`). Le commerçant lui-même l'ouvre par l'effet
 * `open_shop` d'un de ses dialogues; fermé, il le dit en dialogue.
 */
import type { Brick } from '../../donnees/schemas/briques';
import type { BrickBehaviour } from '../briques/types';
import { openShop } from './index';
import { isOpen, shopDef } from './prix';

type ShopBrick = Extract<Brick, { brick: 'shop' }>;

export const shopBehaviour: BrickBehaviour<ShopBrick> = {
  verb: 'Acheter',
  refuse(look, _player, target) {
    const shop = shopDef(look, target.params.shop);
    if (shop === null) return 'gone';
    return isOpen(shop, look.world.minutes) ? null : 'shop-closed';
  },
  use(sim, player, target) {
    openShop(sim, player, target.params.shop);
  },
};
