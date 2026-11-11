/**
 * Le commerce n'est jamais masqué par une conversation (défaut D2 de la recette): à la fin de tout
 * dialogue avec un commerçant dont la boutique est ouverte, une dernière page propose de la voir,
 * avec les textes du commerce (`talk` de sa fiche). Sauf si le dialogue joué l'ouvre déjà lui-même
 * (effet `open_shop` de ce commerce): l'auteur a alors placé le choix où il le voulait.
 * Pur: l'hôte s'en sert pour avancer, l'invité et l'interface pour afficher (`talkView`).
 */
import type { Content } from '../../donnees/charger';
import type { ShopDef } from '../../donnees/schemas/commerce';
import type { DialogueDef } from '../../donnees/schemas/dialogue';
import type { ReadonlyWorld } from '../../etat/monde';
import { isTrading } from '../commerces/prix';

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
 * Le commerce à proposer à la fin de ce dialogue avec cet habitant, ou `null`: il en tient un,
 * décrit son offre (`talk`), il est ouvert à cette heure et le dialogue ne l'ouvre pas déjà.
 */
export function shopOffered(
  look: TalkLook,
  villager: string,
  dialogue: DialogueDef,
): ShopDef | null {
  const shop = talkingShop(look, villager);
  if (shop === null || !isTrading(look, shop) || opensItself(dialogue, shop.id)) return null;
  return shop;
}
