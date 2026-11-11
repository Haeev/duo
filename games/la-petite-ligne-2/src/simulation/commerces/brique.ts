/**
 * Brique `shop`, inscrite dans le registre (`briques/registre.ts`): la touche d'action sur le
 * comptoir ouvre la boutique (événement `shop_opened`). Le commerçant lui-même l'ouvre par l'effet
 * `open_shop` d'un de ses dialogues; fermé, il le dit en dialogue.
 *
 * Comptoir tenu (`held`): le commerçant se tient derrière, hors de portée de la touche d'action
 * depuis le côté client. La touche s'adresse alors à lui: s'il a une réplique d'HISTOIRE en attente
 * (étape de quête ouverte, décision à deux, `dialogues/histoire.ts`), elle se joue d'abord, une
 * fois; sinon la boutique s'ouvre. Souvenirs, confidences, cadeaux et petites phrases ne passent
 * jamais avant la boutique: ils se disent par « Parler » de l'écran de boutique (intention
 * `shop_talk`) ou en face du commerçant.
 */
import type { Brick } from '../../donnees/schemas/briques';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { DialogueDef } from '../../donnees/schemas/dialogue';
import { talkBehaviour, talkTo } from '../briques/parler';
import type { BrickBehaviour, BrickView, Look } from '../briques/types';
import { counterDialogue } from '../dialogues/histoire';
import { footprintOf } from '../noyau/obstacles';
import { openShop } from './index';
import { isTrading, shopDef } from './prix';
import { SHOP_TUNING } from './reglages';

type ShopBrick = Extract<Brick, { brick: 'shop' }>;

const BUY_VERB = 'Acheter';

/** Le commerçant d'un comptoir tenu et la réplique d'histoire qu'il dit avant d'ouvrir la boutique. */
interface CounterTalk {
  readonly keeper: string;
  readonly dialogue: DialogueDef;
}

/**
 * Ce que dit le commerçant quand la touche d'action sur ce comptoir s'adresse à lui, `null`: la
 * boutique s'ouvre. Il faut un comptoir tenu, son commerçant à son poste derrière, et une réplique
 * d'histoire en attente pour ce joueur (`counterDialogue`). Commerçant à planning: « à son poste »
 * se lit sur son état de vie transmis (arrivé sur une ligne qui tient ce commerce), jamais sur sa
 * position, interpolée chez l'invité: la bulle et la touche disent la même chose sur les deux
 * machines pendant qu'il rejoint le comptoir. Sans planning, il ne bouge pas: à moins de
 * `SHOP_TUNING.keeperReach` de l'emprise.
 */
function counterTalk(
  look: Look,
  player: PlayerIndex,
  target: BrickView<ShopBrick>,
): CounterTalk | null {
  if (target.params.held !== true) return null;
  const shop = shopDef(look, target.params.shop);
  const def = look.content.props[target.type];
  if (shop === null || def === undefined) return null;
  const keeper = look.world.places[look.world.common.place]?.villagers[shop.keeper];
  if (keeper === undefined || keeper.life?.presence === 'away') return null;
  const schedule = look.content.places[look.world.common.place]?.villagers.find(
    (v) => v.id === shop.keeper,
  )?.life?.schedule;
  if (schedule !== undefined && keeper.life !== undefined) {
    const life = keeper.life;
    const atPost =
      life.presence === 'here' &&
      life.activity !== null &&
      schedule[life.entry]?.shop === target.params.shop;
    if (!atPost) return null;
  } else {
    const size = footprintOf(def, target.rotation);
    const { x, y } = keeper.body;
    const dx = Math.max(Math.abs(x - target.x) - size.w / 2, 0);
    const dy = Math.max(Math.abs(y - target.y) - size.h / 2, 0);
    if (Math.hypot(dx, dy) > SHOP_TUNING.keeperReach) return null;
  }
  if (talkBehaviour.refuse(look, player, shop.keeper) !== null) return null;
  const dialogue = counterDialogue(look, player, shop.keeper);
  return dialogue === null ? null : { keeper: shop.keeper, dialogue };
}

/** Le commerçant à qui parle la touche d'action sur ce comptoir, `null`: la boutique s'ouvre. */
export function counterKeeper(
  look: Look,
  player: PlayerIndex,
  target: BrickView<ShopBrick>,
): string | null {
  return counterTalk(look, player, target)?.keeper ?? null;
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
    const talk = counterTalk(sim, player, target);
    if (talk !== null) talkTo(sim, player, talk.keeper, talk.dialogue);
    else openShop(sim, player, target.params.shop);
  },
};
