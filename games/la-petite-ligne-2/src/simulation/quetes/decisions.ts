/**
 * Décision à deux (cahier 4.10): une étape de quête la déclare (`decision` de l'étape: son
 * identifiant, ses options); chaque joueur dit son choix par l'effet `choose` (une option de
 * dialogue, un temps de scène); elle n'est prise que si les deux choix concordent. Tant qu'elle
 * ne l'est pas, chacun peut changer d'avis; prise, elle ne bouge plus. La condition `decision_is`
 * fait parler les données: accord, désaccord (le texte invite alors à se mettre d'accord), choix
 * de l'un, choix de l'autre.
 *
 * Tout tient dans la mémoire des faits, donc dans la sauvegarde et chez l'invité, sans état
 * nouveau: `decisions.<id>.j0` et `.j1` (le choix de chacun), `decisions.<id>` (la décision prise).
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import type { SimContext } from '../noyau/systemes';
import { remember } from '../regles/memoire';

export const DECISIONS = { memoryPrefix: 'decisions.' } as const;

export function decisionKey(decision: string, player?: PlayerIndex): string {
  const base = `${DECISIONS.memoryPrefix}${decision}`;
  return player === undefined ? base : `${base}.j${String(player)}`;
}

function textAt(world: ReadonlyWorld, key: string): string | null {
  const value = world.progress.memory[key]?.v;
  return typeof value === 'string' ? value : null;
}

/** Le choix de ce joueur, `null` s'il n'a rien dit. */
export function choiceOf(
  world: ReadonlyWorld,
  decision: string,
  player: PlayerIndex,
): string | null {
  return textAt(world, decisionKey(decision, player));
}

/** L'option prise à deux, `null` tant que la décision n'est pas prise. */
export function decisionTaken(world: ReadonlyWorld, decision: string): string | null {
  return textAt(world, decisionKey(decision));
}

/** Où en est la décision: personne n'a choisi, un seul, deux avis, ou prise. */
export type DecisionState = 'open' | 'waiting' | 'split' | 'agreed';

export function decisionState(world: ReadonlyWorld, decision: string): DecisionState {
  if (decisionTaken(world, decision) !== null) return 'agreed';
  const a = choiceOf(world, decision, 0);
  const b = choiceOf(world, decision, 1);
  if (a === null && b === null) return 'open';
  if (a === null || b === null) return 'waiting';
  return 'split';
}

/** Les options déclarées de cette décision (étape d'une suite de n'importe quel lieu), `null`: inconnue. */
export function decisionOptions(content: Content, decision: string): readonly string[] | null {
  for (const place of Object.values(content.places))
    for (const line of Object.values(place.quests))
      for (const chapter of line.chapters)
        for (const step of chapter.steps)
          if (step.decision?.id === decision) return step.decision.options;
  return null;
}

/**
 * Ce joueur dit son choix (effet `choose`). Les deux choix concordent: la décision est prise, au
 * nom des deux. Sinon elle attend l'autre, ou les invite à se mettre d'accord (`decision_changed`).
 */
export function choose(
  sim: SimContext,
  player: PlayerIndex,
  decision: string,
  option: string,
): void {
  const { world } = sim;
  if (decisionTaken(world, decision) !== null) return;
  if (decisionOptions(sim.content, decision)?.includes(option) !== true) return;
  if (!remember(sim, decisionKey(decision, player), option, player)) return;
  const other = choiceOf(world, decision, player === 0 ? 1 : 0);
  const state: DecisionState = other === null ? 'waiting' : other === option ? 'agreed' : 'split';
  if (state === 'agreed') remember(sim, decisionKey(decision), option, 'duo');
  sim.emit({ type: 'decision_changed', decision, player, option, state });
}
