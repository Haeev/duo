/**
 * Lecture et écriture des champs d'une quête que le format 13 n'écrit plus à vide (taille de
 * l'état transmis à l'invité): la liste à cocher et les valeurs de départ des compteurs. Absents,
 * ils valent une liste vide et aucune valeur de départ.
 */
import type { QuestChecklistItem, QuestState } from './types';

const NO_CHECKLIST: readonly QuestChecklistItem[] = [];
const NO_BASELINES: Readonly<Record<string, number>> = Object.freeze({});

export function questChecklist(state: { readonly checklist?: readonly Readonly<QuestChecklistItem>[] }): readonly Readonly<QuestChecklistItem>[] {
  return state.checklist ?? NO_CHECKLIST;
}

export function questBaselines(state: { readonly baselines?: Readonly<Record<string, number>> }): Readonly<Record<string, number>> {
  return state.baselines ?? NO_BASELINES;
}

/** Pose la liste à cocher; vide, le champ disparaît. */
export function setQuestChecklist(state: QuestState, items: QuestChecklistItem[]): void {
  if (items.length === 0) delete state.checklist;
  else state.checklist = items;
}

/** Pose les valeurs de départ; sans aucune, le champ disparaît. */
export function setQuestBaselines(state: QuestState, baselines: Record<string, number>): void {
  if (Object.keys(baselines).length === 0) delete state.baselines;
  else state.baselines = baselines;
}
