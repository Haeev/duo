/**
 * Contrôle des textes de dialogue (accords du cahier 1.5). À brancher dans
 * `donnees/valider.ts` (lot L0) pour qu'une faute arrête le chargement comme les autres.
 */
import type { Content } from '../../donnees/charger';
import { checkAgreementTags, hasAgreementTag } from './accords';

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
