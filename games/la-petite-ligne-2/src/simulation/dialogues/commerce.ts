/**
 * Le commerce n'est jamais masqué par une conversation (défaut D2 de la recette): à la fin d'une
 * conversation ordinaire avec un commerçant dont la boutique est ouverte, une dernière page
 * propose de la voir, avec les textes du commerce (`talk` de sa fiche). Sauf si le dialogue joué
 * l'ouvre déjà lui-même (effet `open_shop` de ce commerce): l'auteur a alors placé le choix où il
 * le voulait. Après la première écoute du jour d'une réplique d'histoire ou de quête, pas d'offre:
 * le comptoir tenu ouvre la boutique une fois cette réplique entendue (`commerces/brique.ts`); si
 * le joueur la réentend le même jour en parlant au commerçant, l'offre revient.
 * Pur: l'hôte s'en sert pour avancer, l'invité et l'interface pour afficher (`talkView`).
 */
import type { Content } from '../../donnees/charger';
import type { ShopDef } from '../../donnees/schemas/commerce';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { DialogueDef } from '../../donnees/schemas/dialogue';
import type { ReadonlyWorld } from '../../etat/monde';
import { isTrading } from '../commerces/prix';
import { closedByEvent } from '../monde/agenda';
import { DIALOGUES } from './reglages';

/** Le dialogue contient-il, quelque part, un effet qui ouvre ce commerce ? */
function opensItself(dialogue: DialogueDef, shop: string): boolean {
  for (const node of Object.values(dialogue.nodes)) {
    const effects =
      node.kind === 'effects'
        ? node.effects
        : node.kind === 'choice'
          ? node.options.flatMap((o) => o.effects)
          : [];
    if (effects.some((e) => e.type === 'open_shop' && e.shop === shop)) return true;
  }
  return false;
}

interface TalkLook {
  readonly content: Content;
  readonly world: ReadonlyWorld;
}

/** Le commerce du lieu courant que tient cet habitant et qui décrit son offre (`talk`), ou `null`. */
export function talkingShop(look: TalkLook, villager: string): ShopDef | null {
  const shops = look.content.places[look.world.common.place]?.shops ?? {};
  for (const shop of Object.values(shops))
    if (shop.keeper === villager && shop.talk !== undefined) return shop;
  return null;
}

/**
 * Le joueur parle à cet habitant en face, à portée de la touche d'action, et non par-dessus un
 * comptoir tenu (le commerçant s'y tient hors de cette portée, `commerces/brique.ts`).
 */
export function faceToFace(look: TalkLook, player: PlayerIndex, villager: string): boolean {
  const body = look.world.places[look.world.common.place]?.villagers[villager]?.body;
  if (body === undefined) return false;
  const me = look.world.players[player].body;
  return Math.hypot(body.x - me.x, body.y - me.y) <= look.content.settings.reach.action;
}

/**
 * Le commerce à proposer à la fin de ce dialogue avec cet habitant, ou `null`: il en tient un,
 * décrit son offre (`talk`), il est ouvert à cette heure, le dialogue ne l'ouvre pas déjà, et
 * c'est une conversation ordinaire, ou une réplique d'histoire ou de quête que ce joueur réentend
 * aujourd'hui en parlant au commerçant en face (`again`: `heardAgain` de `conversation.ts` et
 * `faceToFace`). Sa première écoute du jour ne débouche pas sur la boutique, ni une réplique dite
 * par-dessus le comptoir tenu: celui-ci ouvre la boutique ensuite (`commerces/brique.ts`).
 */
export function shopOffered(
  look: TalkLook,
  villager: string,
  dialogue: DialogueDef,
  again: boolean,
): ShopDef | null {
  if (dialogue.priority >= DIALOGUES.pendingPriority && !again) return null;
  const shop = talkingShop(look, villager);
  if (shop === null || !isTrading(look, shop) || opensItself(dialogue, shop.id)) return null;
  return shop;
}

/**
 * Ce que dit le commerçant à la place de l'offre, un jour où un événement ferme son commerce
 * (`closes`): sa réplique `lines.closed`, aux mêmes moments que l'offre, ou `null`.
 */
export function shopClosedLine(
  look: TalkLook,
  villager: string,
  dialogue: DialogueDef,
  again: boolean,
): string | null {
  if (dialogue.priority >= DIALOGUES.pendingPriority && !again) return null;
  const shop = talkingShop(look, villager);
  const line = shop?.lines?.closed;
  if (shop === null || line === undefined || opensItself(dialogue, shop.id)) return null;
  return closedByEvent(look, shop.id) ? line : null;
}
