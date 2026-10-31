/**
 * Quêtes pilotées par `quetes.json`: démarrage, étapes, listes à cocher,
 * échéances et effets.
 */
import type { CharacterId, QuestState } from '../etat/types';
import type { QuestDef } from '../donnees/types';
import {
  captureBaselines,
  evaluate,
  evaluateAll,
  hasToolCondition,
  NO_CONTEXT,
  type ConditionContext,
  type ToolEvent,
} from './conditions';
import { type Sim, emit, format, message, notify, say , notifyKey } from './contexte';
import { queueHint } from './astuces';
import { textVars } from './courrier';
import { runEffects } from './effets';

function def(sim: Sim, id: string): QuestDef | undefined {
  return sim.content.quests.find((q) => q.id === id);
}

export function startQuest(sim: Sim, id: string): void {
  const { world } = sim;
  const quest = def(sim, id);
  if (quest === undefined || world.quests.some((q) => q.id === id)) return;
  const first = quest.steps[0];
  const state: QuestState = {
    id,
    status: 'active',
    step: 0,
    checklist: [],
    baselines: first === undefined ? {} : captureBaselines(sim, first.conditions),
    startedDay: world.clock.day,
  };
  world.quests.push(state);
  notifyKey(sim, 'both', 'quest', 'quest_started', { quest: quest.title });
  queueHint(sim, 'p1', { on: 'quest_started', quest: id });
  queueHint(sim, 'p2', { on: 'quest_started', quest: id });
  emit(sim, { type: 'quest_started', quest: id });
  runEffects(sim, quest.start.effects, null);
  refreshChecklist(sim, state, quest);
}

function refreshChecklist(sim: Sim, state: QuestState, quest: QuestDef): void {
  const step = quest.steps[state.step];
  if (step === undefined) {
    state.checklist = [];
    return;
  }
  const ctx: ConditionContext = { ...NO_CONTEXT, baselines: state.baselines };
  const items: { label: string; done: boolean }[] = [];
  for (const c of step.conditions) {
    if (c.label !== undefined) items.push({ label: c.label, done: evaluate(sim, c, ctx) });
  }
  const same =
    items.length === state.checklist.length &&
    items.every((item, i) => {
      const previous = state.checklist[i];
      return item.label === previous?.label && item.done === previous.done;
    });
  if (!same) {
    state.checklist = items;
    sim.runtime.changed = true;
  }
}

function advance(sim: Sim, state: QuestState, quest: QuestDef, actor: CharacterId | null): void {
  const step = quest.steps[state.step];
  state.step += 1;
  emit(sim, { type: 'quest_step', quest: quest.id });
  if (step !== undefined) runEffects(sim, step.effects, actor);
  const next = quest.steps[state.step];
  if (next === undefined) {
    state.status = 'done';
    state.checklist = [];
    notify(sim, 'both', 'quest', format(quest.completionText, textVars(sim)));
    emit(sim, { type: 'quest_done', quest: quest.id });
    runEffects(sim, quest.completionEffects, actor);
    sim.world.revision += 1;
    sim.events.push({ type: 'save_point', reason: 'quest' });
    return;
  }
  state.baselines = captureBaselines(sim, next.conditions);
  notifyKey(sim, 'both', 'quest', 'quest_step_done', { quest: quest.title });
}

function deadlineReached(sim: Sim, deadline: { day: number; time: number }): boolean {
  const { day, minutes } = sim.world.clock;
  return day > deadline.day || (day === deadline.day && minutes >= deadline.time);
}

/**
 * Fait avancer les quêtes. `toolEvent`: un outil vient de servir (conditions
 * `used_tool_at`); renvoie vrai si une étape l'attendait et s'est réalisée.
 */
export function updateQuests(sim: Sim, toolEvent: ToolEvent | null = null): boolean {
  const { world } = sim;
  let toolConsumed = false;
  for (const quest of sim.content.quests) {
    if (quest.start.byEffect || world.quests.some((q) => q.id === quest.id)) continue;
    if (evaluateAll(sim, quest.start.when, NO_CONTEXT)) startQuest(sim, quest.id);
  }
  for (const state of world.quests) {
    if (state.status !== 'active') continue;
    const quest = def(sim, state.id);
    if (quest === undefined) continue;
    for (;;) {
      const step = quest.steps[state.step];
      if (step === undefined) break;
      if (step.resolve === 'at_deadline') {
        refreshChecklist(sim, state, quest);
        if (step.deadline !== null && deadlineReached(sim, step.deadline)) {
          runEffects(sim, step.onDeadline, null);
          advance(sim, state, quest, null);
          continue;
        }
        break;
      }
      const needsTool = hasToolCondition(step.conditions);
      if (needsTool && toolEvent === null) {
        refreshChecklist(sim, state, quest);
        break;
      }
      const ctx: ConditionContext = { actor: toolEvent?.by ?? null, baselines: state.baselines, toolEvent };
      if (evaluateAll(sim, step.conditions, ctx)) {
        if (needsTool) toolConsumed = true;
        advance(sim, state, quest, toolEvent?.by ?? null);
        continue;
      }
      if (needsTool && toolEvent !== null && step.failText !== null) {
        const atSpot = step.conditions.some((c) => c.type === 'used_tool_at' && evaluate(sim, c, ctx));
        if (atSpot) say(sim, toolEvent.by, step.failText);
      }
      refreshChecklist(sim, state, quest);
      break;
    }
  }
  return toolConsumed;
}

/** Texte de l'objectif en cours (`{order}` remplacé). */
export function objectiveText(sim: Sim, state: QuestState): string {
  const quest = def(sim, state.id);
  const step = quest?.steps[state.step];
  if (quest === undefined) return '';
  if (step === undefined) return format(quest.completionText, textVars(sim));
  return format(step.objective, textVars(sim));
}
