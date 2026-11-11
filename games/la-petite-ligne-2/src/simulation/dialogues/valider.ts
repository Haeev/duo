/**
 * Contrôle des textes de dialogue (accords du cahier 1.5). À brancher dans
 * `donnees/valider.ts` (lot L0) pour qu'une faute arrête le chargement comme les autres.
 */
import type { Content } from '../../donnees/charger';
import { checkAgreementTags, hasAgreementTag } from './accords';
import { DIALOGUES } from './reglages';

/** Tous les textes d'un dialogue, avec leur emplacement. */
function* textsOf(content: Content): Generator<{ at: string; text: string }> {
  for (const place of Object.values(content.places))
    for (const dialogue of place.dialogues)
      for (const [id, node] of Object.entries(dialogue.nodes)) {
        const at = `lieu ${place.def.id}, dialogue ${dialogue.id}, nœud ${id}`;
        if (node.kind === 'line') yield { at, text: node.text };
        if (node.kind === 'choice')
          for (const option of node.options)
            yield { at: `${at}, option ${option.id}`, text: option.text };
      }
}

export function validateDialogueTexts(content: Content): string[] {
  const problems: string[] = [];
  for (const { at, text } of textsOf(content))
    for (const problem of checkAgreementTags(text)) problems.push(`${at}: ${problem}`);
  // La page « boutique » des commerçants porte un nœud réservé (`commerce.ts`).
  const reserved = [
    DIALOGUES.shopOffer.node,
    DIALOGUES.shopClosed.node,
    DIALOGUES.orderOffer.node,
    DIALOGUES.giftRefused.node,
  ];
  for (const place of Object.values(content.places)) {
    for (const dialogue of place.dialogues)
      for (const node of reserved)
        if (node in dialogue.nodes)
          problems.push(`lieu ${place.def.id}, dialogue ${dialogue.id}: nœud « ${node} » réservé`);
    for (const shop of Object.values(place.shops))
      if (shop.talk !== undefined)
        for (const text of [shop.talk.open, shop.talk.leave, shop.lines?.closed ?? ''])
          for (const problem of checkAgreementTags(text))
            problems.push(`lieu ${place.def.id}, commerce ${shop.id}: ${problem}`);
    const desk = place.orders?.desk;
    if (desk !== undefined)
      for (const text of [desk.talk.open, desk.talk.leave, ...Object.values(desk.says)])
        for (const problem of checkAgreementTags(text))
          problems.push(`lieu ${place.def.id}, commande.json: ${problem}`);
  }
  return problems;
}

/** Part des répliques balisées (cible du cahier: moins d'une sur dix). */
export function agreementTagShare(content: Content): number {
  let total = 0;
  let tagged = 0;
  for (const { text } of textsOf(content)) {
    total += 1;
    if (hasAgreementTag(text)) tagged += 1;
  }
  return total === 0 ? 0 : tagged / total;
}
