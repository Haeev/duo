/**
 * Quêtes pilotées par `quetes.json`: démarrage, étapes, listes à cocher,
 * échéances et effets.
 */
import type { CharacterId, QuestState } from '../etat/types';
import type { QuestDef } from '../donnees/types';
import { questBaselines, questChecklist, setQuestBaselines, setQuestChecklist } from '../etat/quete';
import {
  captureBaselines,
  evaluate,
  evaluateAll,
  hasToolCondition,
  NO_CONTEXT,
  type ConditionContext,
  type ToolEvent,
} from './conditions';
import { currentOrder } from '../donnees/commandes';
import { type Sim, emit, format, notify, say, notifyKey } from './contexte';
import { queueHint } from './astuces';
import { textVars } from './courrier';
import { runEffects } from './effets';
import { finishSecret, startSecret, updateSecrets } from './secrets';
import { questBond } from './amitie';

function def(sim: Sim, id: string): QuestDef | undefined {
  return sim.content.quests.find((q) => q.id === id);
}

export function startQuest(sim: Sim, id: string): void {
  const { world } = sim;
  const quest = def(sim, id);
  if (quest === undefined || world.quests.some((q) => q.id === id)) return;
  const first = quest.steps[0];
  const state: QuestState = { id, status: 'active', step: 0, startedDay: world.clock.day };
  setQuestBaselines(state, first === undefined ? {} : captureBaselines(sim, first.conditions));
  if (quest.repeat === 'each_train') state.train = currentOrder(sim.content.settings, world).day;
  world.quests.push(state);
  // Quête à secret (R16): l'informé et l'autre sont fixés dès le démarrage.
  startSecret(sim, quest);
  notifyKey(sim, 'both', 'quest', 'quest_started', { quest: questTitle(sim, state, quest) });
  queueHint(sim, 'p1', { on: 'quest_started', quest: id });
  queueHint(sim, 'p2', { on: 'quest_started', quest: id });
  emit(sim, { type: 'quest_started', quest: id });
  runEffects(sim, quest.start.effects, null);
  refreshChecklist(sim, state, quest);
}

function refreshChecklist(sim: Sim, state: QuestState, quest: QuestDef): void {
  const step = quest.steps[state.step];
  if (step === undefined) {
    setQuestChecklist(state, []);
    return;
  }
  const ctx: ConditionContext = { ...NO_CONTEXT, baselines: questBaselines(state), quest: state.id };
  const items: { label: string; done: boolean }[] = [];
  for (const c of step.conditions) {
    if (c.label !== undefined) items.push({ label: c.label, done: evaluate(sim, c, ctx) });
  }
  const before = questChecklist(state);
  const same =
    items.length === before.length &&
    items.every((item, i) => {
      const previous = before[i];
      return item.label === previous?.label && item.done === previous.done;
    });
  if (!same) {
    setQuestChecklist(state, items);
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
    if (quest.story !== null) state.doneDay = sim.world.clock.day;
    setQuestChecklist(state, []);
    // Les valeurs de départ ne servent qu'aux étapes en cours (format 8: rien de gardé une fois finie).
    setQuestBaselines(state, {});
    // Une annonce (tour 9) a son propre message, avec la récompense (`annonces.ts`).
    if (quest.completionText !== '') notify(sim, 'both', 'quest', format(quest.completionText, { ...textVars(sim), day: state.train ?? '' }), { key: 'quest_done' });
    emit(sim, { type: 'quest_done', quest: quest.id });
    finishSecret(sim, quest.id);
    runEffects(sim, quest.completionEffects, actor);
    // 0.13 (lot H2): l'étape d'histoire et le lien de son habitant (section 6.2).
    questBond(sim, quest, actor);
    sim.world.revision += 1;
    sim.events.push({ type: 'save_point', reason: 'quest' });
    if (quest.repeat === 'each_train') restartForNextTrain(sim, state, quest);
    return;
  }
  setQuestBaselines(state, captureBaselines(sim, next.conditions));
  notifyKey(sim, 'both', 'quest', 'quest_step_done', { quest: questTitle(sim, state, quest) });
}

/** Quête de la semaine (`repeat: each_train`): elle repart aussitôt pour la commande nouvellement tirée. */
function restartForNextTrain(sim: Sim, state: QuestState, quest: QuestDef): void {
  const next = currentOrder(sim.content.settings, sim.world).day;
  // Plus de train après celui-ci (aucune commande tirée): la quête reste finie.
  if (state.train !== undefined && next <= state.train) return;
  const first = quest.steps[0];
  state.status = 'active';
  state.step = 0;
  setQuestChecklist(state, []);
  setQuestBaselines(state, first === undefined ? {} : captureBaselines(sim, first.conditions));
  state.startedDay = sim.world.clock.day;
  state.train = next;
  notifyKey(sim, 'both', 'quest', 'quest_started', { quest: questTitle(sim, state, quest) });
  emit(sim, { type: 'quest_started', quest: quest.id });
  refreshChecklist(sim, state, quest);
}

/** Titre de la quête, `{day}` remplacé par le jour du train d'une quête de la semaine. */
export function questTitle(sim: Sim, state: QuestState, quest: QuestDef | undefined = def(sim, state.id)): string {
  return quest === undefined ? state.id : format(quest.title, { day: state.train ?? '' });
}

/** Échéance d'une étape: écrite, ou le départ du train de la quête de la semaine. */
function stepDeadline(sim: Sim, state: QuestState, step: QuestDef['steps'][number]): { day: number; time: number } | null {
  if (step.deadline !== null) return step.deadline;
  return state.train === undefined ? null : { day: state.train, time: sim.content.settings.train.departure };
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
    if (quest.story !== null && !storyMayStart(sim, quest.story.villager)) continue;
    if (evaluateAll(sim, quest.start.when, NO_CONTEXT)) startQuest(sim, quest.id);
  }
  withdrawExpired(sim);
  for (const state of world.quests) {
    if (state.status !== 'active') continue;
    const quest = def(sim, state.id);
    if (quest === undefined) continue;
    for (;;) {
      const step = quest.steps[state.step];
      if (step === undefined) break;
      if (step.resolve === 'at_deadline') {
        refreshChecklist(sim, state, quest);
        const deadline = stepDeadline(sim, state, step);
        if (deadline !== null && deadlineReached(sim, deadline)) {
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
      const ctx: ConditionContext = { actor: toolEvent?.by ?? null, baselines: questBaselines(state), toolEvent, quest: state.id };
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
  updateSecrets(sim);
  return toolConsumed;
}

/**
 * Rythme des histoires (0.13, section 5.1): au plus `maxActive` histoires en cours, `newPerDay`
 * neuves par jour, et `cooldownDays` jours depuis la fin de la dernière étape de cet habitant. Une
 * quête d'histoire prête qui ne passe pas attend, sans rien perdre. Les autres quêtes n'y sont pas soumises.
 */
export function storyMayStart(sim: Sim, villager: string): boolean {
  const pace = sim.content.settings.bonds.storyPace;
  const today = sim.world.clock.day;
  let active = 0;
  let newToday = 0;
  let lastDone = Number.NEGATIVE_INFINITY;
  for (const state of sim.world.quests) {
    const story = def(sim, state.id)?.story ?? null;
    if (story === null) continue;
    if (state.status === 'active') active += 1;
    if (state.startedDay === today) newToday += 1;
    if (story.villager === villager && state.status === 'done') lastDone = Math.max(lastDone, state.doneDay ?? state.startedDay);
  }
  return active < pace.maxActive && newToday < pace.newPerDay && today - lastDone >= pace.cooldownDays;
}

/** Jour et heure du retrait d'une quête `expire`: le premier `weekday` à `time` après son démarrage. */
export function expiryOf(quest: QuestDef, state: QuestState): { day: number; time: number } | null {
  if (quest.expire === null) return null;
  // Le jour 1 est un samedi (indice 0 de la semaine des données).
  const startWeekday = (state.startedDay - 1) % 7;
  const ahead = (quest.expire.weekday - startWeekday + 7) % 7;
  return { day: state.startedDay + (ahead === 0 ? 7 : ahead), time: quest.expire.time };
}

/**
 * 0.12 (`expire`): la quête active dont l'heure est passée se retire, sans reproche ni récompense;
 * elle quitte l'état et peut redémarrer quand ses conditions de départ redeviennent vraies.
 */
function withdrawExpired(sim: Sim): void {
  const { world } = sim;
  const expired = world.quests.filter((state) => {
    if (state.status !== 'active') return false;
    const quest = def(sim, state.id);
    const at = quest === undefined ? null : expiryOf(quest, state);
    return at !== null && deadlineReached(sim, at);
  });
  if (expired.length === 0) return;
  world.quests = world.quests.filter((q) => !expired.includes(q));
  for (const state of expired) {
    const text = def(sim, state.id)?.expire?.text;
    if (text !== undefined) notifyKey(sim, 'both', 'quest', text, {});
  }
  sim.runtime.changed = true;
}

/** Texte de l'objectif en cours (`{order}` remplacé). */
export function objectiveText(sim: Sim, state: QuestState): string {
  const quest = def(sim, state.id);
  const step = quest?.steps[state.step];
  if (quest === undefined) return '';
  const vars = { ...textVars(sim), day: state.train ?? '' };
  if (step === undefined) return format(quest.completionText, vars);
  return format(step.objective, vars);
}
