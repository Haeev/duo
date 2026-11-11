/**
 * Lecture de l'histoire pour l'interface (lot L7), chez l'hôte comme chez l'invité: carnet des
 * quêtes, scènes à relire, direction du coup d'œil. Fonctions pures sur l'état reçu.
 */
import type { Content, PlaceContent } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ChapterEndDef, QuestLineDef, StepEffect } from '../../donnees/schemas/quete';
import type { ReadonlyWorld } from '../../etat/monde';
import { agreeFor } from '../dialogues/accords';
import { doorChain } from '../lieux/traversee';
import { choiceOf, decisionState } from './decisions';
import { sceneSeenOn } from './faits';
import { activeSteps, currentChapter, findQuest } from './moteur';
import { STORY } from './reglages';

/** Durée du coup d'œil (touche G), en secondes. */
export const GLANCE_SECONDS = STORY.glanceSeconds;

export interface JournalStep {
  readonly id: string;
  /** Texte accordé pour le joueur qui lit. */
  readonly objective: string;
  readonly together: boolean;
}

export interface JournalEntry {
  readonly quest: string;
  readonly place: string;
  readonly kind: QuestLineDef['kind'];
  readonly title: string;
  readonly done: boolean;
  /** Titre de l'acte en cours (`null`: suite finie). */
  readonly chapter: string | null;
  /** Ce qu'il faut faire maintenant (une étape ou plusieurs en parallèle). */
  readonly steps: readonly JournalStep[];
  readonly passed: number;
  readonly total: number;
  readonly tracked: boolean;
  /**
   * Histoire dont cette suite est un acte (`saga` des données), pour regrouper les suites au
   * carnet; absent: suite seule.
   */
  readonly saga?: { readonly id: string; readonly title: string; readonly act: number };
}

const KIND_ORDER: Readonly<Record<QuestLineDef['kind'], number>> = { main: 0, side: 1, errand: 2 };

/** Le carnet du joueur: suites ouvertes, la principale d'abord, les finies à la fin. */
export function journal(
  world: ReadonlyWorld,
  content: Content,
  player: PlayerIndex,
): JournalEntry[] {
  const tracked = world.common.story?.tracked[player] ?? null;
  const out: JournalEntry[] = [];
  for (const [quest, state] of Object.entries(world.progress.quests)) {
    const found = findQuest(content, quest);
    if (found === null) continue;
    const { line, place } = found;
    const passed = state.passed ?? [];
    out.push({
      quest,
      place,
      kind: line.kind,
      title: line.title,
      done: state.done,
      chapter: state.done ? null : (currentChapter(line, passed)?.title ?? null),
      steps: state.done
        ? []
        : activeSteps(line, passed).map((s) => ({
            id: s.id,
            objective: agreeFor(world, player, s.objective),
            together: s.together,
          })),
      passed: passed.length,
      total: line.chapters.reduce((n, c) => n + c.steps.length, 0),
      tracked: tracked === quest,
      ...(line.saga === undefined ? {} : { saga: line.saga }),
    });
  }
  return out.sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.quest.localeCompare(b.quest),
  );
}

/** Texte d'une étape (notification « Étape franchie: ... » à l'événement `quest_step_done`). */
export function stepText(
  world: ReadonlyWorld,
  content: Content,
  player: PlayerIndex,
  quest: string,
  step: string,
): string | null {
  const line = findQuest(content, quest)?.line;
  const def = line?.chapters.flatMap((c) => c.steps).find((s) => s.id === step);
  return def === undefined ? null : agreeFor(world, player, def.objective);
}

/** Scènes vues, à relire au carnet. */
export function seenScenes(
  world: ReadonlyWorld,
  content: Content,
): { readonly place: string; readonly scene: string; readonly title: string }[] {
  const out: { place: string; scene: string; title: string }[] = [];
  for (const [place, data] of Object.entries(content.places))
    for (const scene of Object.values(data.scenes))
      if (sceneSeenOn(world, place, scene.id) !== null)
        out.push({ place, scene: scene.id, title: scene.title });
  return out;
}

export interface GlanceTarget {
  readonly quest: string;
  readonly step: string;
  readonly objective: string;
  /** Ce qui est visé: un point de la carte ou un habitant, avec sa position actuelle (m). */
  readonly target:
    | { readonly kind: 'point'; readonly id: string; readonly x: number; readonly y: number }
    | { readonly kind: 'villager'; readonly id: string; readonly x: number; readonly y: number };
}

/**
 * Où pointe le coup d'œil de ce joueur: l'étape ouverte de sa suite suivie qui a un repère, dans
 * le lieu où l'on joue. `null`: rien à montrer (aucune suite suivie, autre lieu, pas de repère).
 */
export function glanceTarget(
  world: ReadonlyWorld,
  content: Content,
  player: PlayerIndex,
): GlanceTarget | null {
  const quest = world.common.story?.tracked[player] ?? null;
  if (quest === null) return null;
  const state = world.progress.quests[quest];
  const found = findQuest(content, quest);
  if (state === undefined || state.done || found === null) return null;
  if (found.place !== world.common.place) return null;
  const place = content.places[found.place];
  if (place === undefined) return null;
  for (const step of activeSteps(found.line, state.passed ?? [])) {
    const t = step.target;
    if (t === null) continue;
    const head = { quest, step: step.id, objective: agreeFor(world, player, step.objective) };
    // Le but est dans une autre pièce (un commerçant derrière son comptoir): le repère mène à la
    // porte à prendre, pas à travers les murs.
    const me = world.players[player].body;
    const via = (x: number, y: number): { x: number; y: number } => {
      const hop = doorChain(place, me.x, me.y, x, y)?.[0];
      return hop === undefined ? { x, y } : { x: hop.fromX, y: hop.fromY };
    };
    if ('point' in t) {
      const point = place.map.points[t.point];
      if (point !== undefined)
        return { ...head, target: { kind: 'point', id: t.point, ...via(point.x, point.y) } };
    } else {
      const body = world.places[found.place]?.villagers[t.villager]?.body;
      if (body !== undefined)
        return { ...head, target: { kind: 'villager', id: t.villager, ...via(body.x, body.y) } };
    }
  }
  return null;
}

/**
 * Rappel d'une décision à deux encore ouverte (HUD et carnet), pour ce joueur. Tout se lit dans les
 * données: le titre de la suite nomme la décision; l'habitant et les mots du choix sont ceux du
 * dialogue qui l'offre (option qui porte l'effet `choose`).
 */
export interface DecisionReminder {
  readonly quest: string;
  readonly decision: string;
  /** Titre de la suite (la décision nommée). */
  readonly title: string;
  /** `waiting`: un seul a choisi; `split`: deux avis différents. */
  readonly state: 'waiting' | 'split';
  /** À qui le dire (identifiant et nom), `null`: aucun dialogue du lieu ne l'offre. */
  readonly villager: { readonly id: string; readonly name: string } | null;
  /** Les mots du choix de ce joueur et de l'autre, accordés; `null`: pas encore choisi. */
  readonly mine: string | null;
  readonly theirs: string | null;
}

/** Le dialogue qui offre cette option de la décision, et les mots de l'option (sans point final). */
function decisionOffer(
  place: PlaceContent,
  decision: string,
  option: string | null,
): { villager: string; text: string | null } | null {
  let first: { villager: string; text: string | null } | null = null;
  for (const dialogue of place.dialogues)
    for (const node of Object.values(dialogue.nodes)) {
      if (node.kind !== 'choice') continue;
      for (const o of node.options)
        for (const effect of o.effects) {
          if (effect.type !== 'choose' || effect.decision !== decision) continue;
          if (effect.option === option)
            return { villager: dialogue.villager, text: o.text.replace(/[.!]+$/u, '') };
          first ??= { villager: dialogue.villager, text: null };
        }
    }
  return first;
}

/** Les décisions à deux ouvertes (étape en cours, pas encore prise) où l'un au moins a choisi. */
export function decisionReminders(
  world: ReadonlyWorld,
  content: Content,
  player: PlayerIndex,
): DecisionReminder[] {
  const out: DecisionReminder[] = [];
  const other: PlayerIndex = player === 0 ? 1 : 0;
  for (const [quest, progress] of Object.entries(world.progress.quests)) {
    if (progress.done) continue;
    const found = findQuest(content, quest);
    const place = found === null ? undefined : content.places[found.place];
    if (found === null || place === undefined) continue;
    for (const step of activeSteps(found.line, progress.passed ?? [])) {
      const decision = step.decision?.id;
      if (decision === undefined) continue;
      const state = decisionState(world, decision);
      if (state !== 'waiting' && state !== 'split') continue;
      const words = (who: PlayerIndex): string | null => {
        const choice = choiceOf(world, decision, who);
        const text = choice === null ? null : decisionOffer(place, decision, choice)?.text;
        return text === null || text === undefined ? choice : agreeFor(world, player, text);
      };
      const offer = decisionOffer(place, decision, null);
      const def = offer === null ? undefined : place.villagers.find((v) => v.id === offer.villager);
      out.push({
        quest,
        decision,
        title: found.line.title,
        state,
        villager: def === undefined ? null : { id: def.id, name: def.name },
        mine: words(player),
        theirs: words(other),
      });
    }
  }
  return out;
}

export interface ChapterEndView {
  readonly id: string;
  readonly title: string;
  /** Lignes accordées pour le joueur qui lit. */
  readonly lines: readonly string[];
  /** Ce joueur l'a déjà fermé (il attend l'autre). */
  readonly closed: boolean;
}

/** L'écran de fin de chapitre décrit par un effet `travel_to` du lieu, ou `null`. */
export function findChapterEnd(content: Content, place: string, id: string): ChapterEndDef | null {
  const data = content.places[place];
  if (data === undefined) return null;
  const effects: StepEffect[] = [];
  for (const line of Object.values(data.quests))
    for (const chapter of line.chapters)
      for (const step of chapter.steps) effects.push(...step.onStart, ...step.onDone);
  for (const scene of Object.values(data.scenes))
    for (const beat of scene.beats) if (beat.do === 'effects') effects.push(...beat.effects);
  for (const effect of effects)
    if (effect.type === 'travel_to' && effect.ending?.id === id) return effect.ending;
  return null;
}

/** Ce que l'écran de fin de chapitre affiche à ce joueur, `null`: aucun (ou déjà fermé par les deux). */
export function chapterEndView(
  world: ReadonlyWorld,
  content: Content,
  player: PlayerIndex,
): ChapterEndView | null {
  const ending = world.common.story?.ending;
  if (ending === undefined) return null;
  const def = findChapterEnd(content, ending.place, ending.id);
  if (def === null) return null;
  return {
    id: def.id,
    title: def.title,
    lines: def.lines.map((line) => agreeFor(world, player, line)),
    closed: ending.closed[player],
  };
}
