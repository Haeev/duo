/**
 * Garde des choix d'un dialogue (retour du 2026-11-11: un robot qui martelait Espace pour passer
 * le texte a tranché une décision à deux par accident). Lecture pure, testable sans DOM:
 * - à leur apparition, les choix restent inactifs `choiceGuardMs` (Espace et Entrée n'y font rien);
 * - une décision à deux (option à effet `choose`) ne se valide qu'avec Entrée (ou un clic):
 *   Espace sert à passer le texte, il ne tranche donc jamais une décision; il rappelle la touche.
 */
import type { Content } from '../donnees/charger';
import type { PlayerIndex } from '../donnees/schemas/communs';
import type { ReadonlyWorld } from '../etat/monde';

/** Ce que fait une touche sur des choix affichés: `other`, une touche qui n'est pas de validation. */
export type ChoiceKeyOutcome = 'swallow' | 'choose' | 'remind' | 'other';

export function choiceKeyOutcome(
  code: string,
  shownForMs: number,
  guardMs: number,
  decision: boolean,
): ChoiceKeyOutcome {
  if (code !== 'Space' && code !== 'Enter') return 'other';
  if (shownForMs < guardMs) return 'swallow';
  if (code === 'Space' && decision) return 'remind';
  return 'choose';
}

/** Le nœud de choix ouvert chez ce joueur offre une décision à deux (une option à effet `choose`). */
export function isDecisionChoice(content: Content, world: ReadonlyWorld, me: PlayerIndex): boolean {
  const talk = world.players[me].talk;
  if (talk === null) return false;
  const dialogue = content.places[world.common.place]?.dialogues.find(
    (d) => d.id === talk.dialogue,
  );
  const node = dialogue?.nodes[talk.node];
  return (
    node?.kind === 'choice' &&
    node.options.some((option) => option.effects.some((effect) => effect.type === 'choose'))
  );
}
