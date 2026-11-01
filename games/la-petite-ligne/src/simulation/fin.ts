/**
 * Étapes de la partie (tour 8, section 1): l'écran d'étape (effet `end_stage`, l'ancien
 * `end_demo` pour l'étape `demo`), le choix à deux « Rester à la Halte » ou « Finir la séance »,
 * et la reprise.
 */
import { nextTrainDay, stageCanContinue, stageDef, stageReached } from '../donnees/calendrier';
import type { StageId } from '../donnees/types';
import type { CharacterId, StageChoice } from '../etat/types';
import { type Sim, character, emit, partnerOf, say } from './contexte';
import { QUEST } from './ids';

/** Faits marquants de la séance, 60 caractères au plus (SV-07). */
const HIGHLIGHT_MAX = 60;

/** Texte `textes.stages.<id>.<key>` (lu tel quel dans les textes bruts), ou `null`. */
export function stageText(sim: Sim, id: StageId, key: string): string | null {
  const stages = sim.content.texts.raw.stages;
  if (typeof stages !== 'object' || stages === null) return null;
  const block = (stages as Record<string, unknown>)[id];
  if (typeof block !== 'object' || block === null) return null;
  const value = (block as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

/**
 * Ouvre l'écran de l'étape `id` (phase `ended`, horloge arrêtée). Ne fait rien avant le jour et
 * l'heure de l'étape, ni si elle est déjà franchie, ni si un écran est déjà ouvert.
 */
export function finishStage(sim: Sim, id: StageId): void {
  const { world } = sim;
  if (world.phase === 'ended') return;
  const stage = stageDef(sim.content.settings, id);
  if (stage === null || world.stages.passed.includes(id) || !stageReached(stage, world.clock))
    return;
  const keyFound = world.quests.some((q) => q.id === QUEST.riddle && q.status === 'done');
  const totals = world.orderTotals;
  world.ending = {
    days: world.clock.day,
    linesDone: totals.linesDone,
    linesTotal: totals.linesTotal,
    orders: world.orderHistory.map((o) => ({ linesDone: o.linesDone, linesTotal: o.linesTotal })),
    furniturePlaced: world.furniture.filter((f) => f.placedBy !== null).length,
    keyFound,
  };
  world.phase = 'ended';
  world.clock.running = false;
  world.clock.stoppedBy = 'ended';
  world.stages.current = id;
  world.stages.choice = { p1: null, p2: null };
  for (const c of world.characters) {
    c.menu = null;
    c.status = 'active';
    c.endReady = false;
  }
  if (id === 'demo') {
    const quest = sim.content.quests.find((q) => q.id === QUEST.order);
    if (quest !== undefined) addHighlight(sim, quest.title);
  }
  const highlight = stageText(sim, id, 'highlight');
  if (highlight !== null) addHighlight(sim, highlight);
  sim.runtime.changed = true;
  emit(sim, { type: 'demo_ended', stage: id });
}

/**
 * Choix d'un joueur sur l'écran d'étape (`null`: il revient sur son choix). Rien ne se passe tant
 * que les deux choix diffèrent ou qu'un seul a choisi; d'accord, le choix s'applique. « Rester »
 * n'existe que si une journée jouable suit l'étape.
 */
export function chooseAtStage(sim: Sim, id: CharacterId, choice: StageChoice | null): void {
  const { world } = sim;
  const stage = world.stages.current;
  if (world.phase !== 'ended' || stage === null) return;
  if (choice === 'stay' && !stageCanContinue(sim.content.settings, stage)) return;
  const before = world.stages.choice[id];
  world.stages.choice[id] = choice;
  character(sim, id).endReady = choice === 'finish';
  sim.runtime.changed = true;
  if (before !== choice) emit(sim, { type: 'stage_choice', by: id, choice });
  const other = world.stages.choice[partnerOf(id)];
  if (choice === null || other !== choice) return;
  if (choice === 'finish') {
    if (before !== 'finish') emit(sim, { type: 'session_finish' });
    return;
  }
  stayAtHalte(sim, stage);
}

/** « Rester à la Halte »: la journée reprend là où l'écran s'est ouvert, l'étape est franchie. */
function stayAtHalte(sim: Sim, stage: StageId): void {
  const { world } = sim;
  world.phase = 'day';
  world.ending = null;
  world.stages.passed.push(stage);
  world.stages.current = null;
  world.stages.choice = { p1: null, p2: null };
  world.clock.running = true;
  world.clock.stoppedBy = null;
  for (const c of world.characters) {
    c.endReady = false;
    c.status = 'active';
    // La reprise compte comme une entrée: personne n'est absent en revenant de l'écran.
    c.lastInputTick = world.tick;
  }
  const s = sim.content.settings;
  const train =
    world.order.generated?.train ?? nextTrainDay(s, world.clock.day + 1) ?? world.clock.day;
  say(sim, 'both', 'stage_continue', { day: train });
  sim.runtime.changed = true;
  emit(sim, { type: 'stage_continue', stage });
}

export function addHighlight(sim: Sim, text: string): void {
  const list = sim.world.session.highlights;
  const short = text.length > HIGHLIGHT_MAX ? text.slice(0, HIGHLIGHT_MAX) : text;
  if (!list.includes(short) && list.length < 3) list.push(short);
}
