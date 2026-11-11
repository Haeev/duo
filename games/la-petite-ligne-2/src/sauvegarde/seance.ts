/**
 * Résultat d'une séance pour Duo (cahier 4.11, ADR 0005 et 0009): l'avancement de l'histoire,
 * porté par chaque sauvegarde (`SaveSnapshot.progress`, que la plateforme reprend dans
 * l'historique et le score cumulé), et trois nombres de la séance: jours vécus, étapes de quête
 * franchies, entrées de collection ajoutées. Lecture pure de l'état, sans rien sauvegarder de plus:
 * le point de départ de la séance se relève à son ouverture (`tallyOf`).
 */
import type { SessionSummary } from '@duo/sdk';
import type { Content } from '../donnees/charger';
import type { QuestLineDef } from '../donnees/schemas/quete';
import type { ReadonlyWorld } from '../etat/monde';
import { SAVE_TEXTS } from './textes';

/** Ce qu'on compte au début et à la fin d'une séance. */
export interface SessionTally {
  readonly day: number;
  readonly steps: number;
  readonly entries: number;
}

function stepCount(line: QuestLineDef): number {
  return line.chapters.reduce((sum, chapter) => sum + chapter.steps.length, 0);
}

/** Étapes franchies d'une suite: toutes si elle est finie, sinon celles qu'elle retient. */
function passedSteps(world: ReadonlyWorld, line: QuestLineDef): number {
  const state = world.progress.quests[line.id];
  if (state === undefined) return 0;
  if (state.done) return stepCount(line);
  const known = new Set(line.chapters.flatMap((c) => c.steps.map((s) => s.id)));
  return (state.passed ?? []).filter((id) => known.has(id)).length;
}

function allLines(content: Content): QuestLineDef[] {
  return Object.values(content.places).flatMap((place) => Object.values(place.quests));
}

/**
 * Part de l'histoire franchie, de 0 à 1: étapes franchies sur toutes les étapes des suites
 * principales qui forment une histoire (`kind: "main"` avec `saga`, les actes d'Aubrune). Les
 * lieux d'essai et le prologue, sans histoire en actes, n'y entrent pas. `null`: aucune histoire.
 */
export function storyProgress(content: Content, world: ReadonlyWorld): number | null {
  let total = 0;
  let passed = 0;
  for (const line of allLines(content)) {
    if (line.kind !== 'main' || line.saga === undefined) continue;
    total += stepCount(line);
    passed += passedSteps(world, line);
  }
  return total === 0 ? null : Math.min(1, passed / total);
}

/** Relevé du moment: jour, étapes de quête franchies (toutes suites), entrées de collection. */
export function tallyOf(content: Content, world: ReadonlyWorld): SessionTally {
  let steps = 0;
  for (const line of allLines(content)) steps += passedSteps(world, line);
  const entries = Object.values(world.progress.collections).reduce(
    (sum, found) => sum + found.length,
    0,
  );
  return { day: world.common.day, steps, entries };
}

/** Le résultat de la séance commencée à `start`: avancement et trois statistiques (écran de fin, historique). */
export function sessionSummary(
  content: Content,
  start: SessionTally,
  world: ReadonlyWorld,
): SessionSummary {
  const now = tallyOf(content, world);
  const stat = (label: string, value: number): { label: string; value: string } => ({
    label,
    value: String(Math.max(0, value)),
  });
  const progress = storyProgress(content, world);
  return {
    ...(progress === null ? {} : { progress }),
    stats: [
      stat(SAVE_TEXTS.session.days, now.day - start.day),
      stat(SAVE_TEXTS.session.steps, now.steps - start.steps),
      stat(SAVE_TEXTS.session.entries, now.entries - start.entries),
    ],
  };
}
