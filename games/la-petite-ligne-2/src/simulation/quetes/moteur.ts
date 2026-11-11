/**
 * Moteur des suites de quêtes (cahier 4.10, technique 3.3). Une suite s'ouvre par ses `requires`
 * ou par l'effet `open_quest`; ses actes se jouent l'un après l'autre; dans un acte, une étape
 * s'ouvre quand ses étapes `after` sont franchies (par défaut: la précédente). La progression est
 * commune: une étape franchie par l'un l'est pour les deux. L'état tient dans `progress.quests`.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { QuestLineDef, QuestStepDef } from '../../donnees/schemas/quete';
import type { ReadonlyWorld } from '../../etat/monde';
import type { SimContext } from '../noyau/systemes';
import type { Effect } from '../../donnees/schemas/regles';
import type { PlayerState } from '../../etat/joueur';
import { exchangeRefusal, type ExchangeRefusal } from '../dialogues/echanges';
import type { RuleContext } from '../regles/conditions';
import { removeItem } from '../sac/inventaire';
import { STORY } from './reglages';
import { evaluateStepAll, playersTogether } from './conditions';
import { applyStepEffects, type StoryHooks } from './effets';
import { storyOf } from './faits';

type Chapter = QuestLineDef['chapters'][number];

/** La suite et son lieu, cherchée dans tous les lieux (les identifiants de suite sont uniques). */
export function findQuest(
  content: Content,
  quest: string,
): { readonly place: string; readonly line: QuestLineDef } | null {
  for (const [place, data] of Object.entries(content.places)) {
    const line = data.quests[quest];
    if (line !== undefined) return { place, line };
  }
  return null;
}

/** Étapes à franchir avant `index` dans l'acte. */
export function prerequisites(chapter: Chapter, index: number): readonly string[] {
  const step = chapter.steps[index];
  if (step === undefined) return [];
  if (step.after !== undefined) return step.after;
  const previous = chapter.steps[index - 1];
  return previous === undefined ? [] : [previous.id];
}

/** L'acte en cours: le premier qui a une étape non franchie; `null`: suite finie. */
export function currentChapter(line: QuestLineDef, passed: readonly string[]): Chapter | null {
  return line.chapters.find((c) => c.steps.some((s) => !passed.includes(s.id))) ?? null;
}

/** Étapes ouvertes et non franchies d'une suite ouverte. */
export function activeSteps(line: QuestLineDef, passed: readonly string[]): QuestStepDef[] {
  const chapter = currentChapter(line, passed);
  if (chapter === null) return [];
  return chapter.steps.filter(
    (step, i) =>
      !passed.includes(step.id) && prerequisites(chapter, i).every((id) => passed.includes(id)),
  );
}

function passedOf(world: ReadonlyWorld, quest: string): readonly string[] {
  return world.progress.quests[quest]?.passed ?? [];
}

/** Recale `chapter` et `step` (la ligne affichée) sur l'avancement. */
function syncHeadline(sim: SimContext, line: QuestLineDef): void {
  const state = sim.world.progress.quests[line.id];
  if (state === undefined) return;
  const passed = state.passed ?? [];
  const chapter = currentChapter(line, passed);
  const first = activeSteps(line, passed)[0];
  if (chapter !== null && first !== undefined) {
    state.chapter = chapter.id;
    state.step = first.id;
  }
}

function startSteps(
  sim: SimContext,
  steps: readonly QuestStepDef[],
  actor: PlayerIndex,
  hooks: StoryHooks,
): void {
  for (const step of steps) applyStepEffects(sim, actor, step.onStart, hooks);
}

/** Ouvre une suite (sans effet si elle l'est déjà). Le joueur qui ne suit rien la suit d'office. */
export function openQuest(
  sim: SimContext,
  quest: string,
  hooks: StoryHooks,
  actor: PlayerIndex = 0,
): boolean {
  if (quest in sim.world.progress.quests) return false;
  const found = findQuest(sim.content, quest);
  const first = found?.line.chapters[0];
  const firstStep = first?.steps[0];
  if (found === null || first === undefined || firstStep === undefined) return false;
  sim.world.progress.quests[quest] = {
    chapter: first.id,
    step: firstStep.id,
    done: false,
    passed: [],
  };
  syncHeadline(sim, found.line);
  sim.touch('progress');
  const story = storyOf(sim.world);
  for (const p of [0, 1] as const) story.tracked[p] ??= quest;
  sim.touch('common');
  sim.emit({ type: 'quest_opened', quest });
  startSteps(sim, activeSteps(found.line, []), actor, hooks);
  return true;
}

/** Retire des poches les objets des conditions `deliver` de l'étape; `true` si l'un l'a été. */
function takeDelivered(
  players: readonly [PlayerState, PlayerState],
  step: QuestStepDef,
  actor: PlayerIndex,
): boolean {
  let changed = false;
  for (const c of step.done) {
    if (c.type !== 'deliver') continue;
    const order: PlayerIndex[] = actor === 0 ? [0, 1] : [1, 0];
    for (const p of order) {
      const player = players[p];
      if (player.talk?.villager !== c.villager) continue;
      if (removeItem(player, c.item, c.count)) {
        changed = true;
        break;
      }
    }
  }
  return changed;
}

/** Remet à l'habitant les objets des conditions `deliver` de l'étape. */
function handOver(sim: SimContext, step: QuestStepDef, actor: PlayerIndex): void {
  if (takeDelivered(sim.world.players, step, actor)) sim.touch('players');
}

/**
 * Le don de l'étape (`give_item` de `onDone`) tiendrait-il dans les poches, une fois les objets
 * remis à l'habitant ? Rejoué sur une copie des deux joueurs; `null`: il passe (ou rien à donner).
 */
export function stepGiftRefusal(
  look: { readonly world: ReadonlyWorld; readonly content: Content },
  step: QuestStepDef,
  actor: PlayerIndex,
): ExchangeRefusal | null {
  const gifts: Effect[] = [];
  for (const e of step.onDone) if (e.type === 'give_item') gifts.push(e);
  if (gifts.length === 0) return null;
  const players: [PlayerState, PlayerState] = [
    structuredClone(look.world.players[0]) as PlayerState,
    structuredClone(look.world.players[1]) as PlayerState,
  ];
  takeDelivered(players, step, actor);
  return exchangeRefusal(
    { world: { ...look.world, players }, content: look.content },
    actor,
    gifts,
  );
}

/** Franchit une étape ouverte, pour les deux joueurs. */
export function passStep(
  sim: SimContext,
  line: QuestLineDef,
  step: QuestStepDef,
  actor: PlayerIndex,
  hooks: StoryHooks,
): void {
  const state = sim.world.progress.quests[line.id];
  if (state === undefined || state.done) return;
  const before = activeSteps(line, state.passed ?? []).map((s) => s.id);
  if (!before.includes(step.id)) return;
  handOver(sim, step, actor);
  state.passed = [...(state.passed ?? []), step.id];
  sim.touch('progress');
  sim.emit({ type: 'quest_step_done', quest: line.id, step: step.id, by: actor });
  applyStepEffects(sim, actor, step.onDone, hooks);
  const after = activeSteps(line, state.passed);
  if (after.length === 0) {
    state.done = true;
    sim.emit({ type: 'quest_done', quest: line.id });
    const story = storyOf(sim.world);
    for (const p of [0, 1] as const) if (story.tracked[p] === line.id) story.tracked[p] = null;
    sim.touch('common');
    return;
  }
  syncHeadline(sim, line);
  startSteps(
    sim,
    after.filter((s) => !before.includes(s.id)),
    actor,
    hooks,
  );
}

/** Le joueur au nom de qui l'étape passe, `null`: pas encore. */
function stepActor(sim: SimContext, step: QuestStepDef): PlayerIndex | null {
  if (step.together && !playersTogether(sim.world)) return null;
  for (const actor of [0, 1] as const) {
    const ctx: RuleContext = { world: sim.world, content: sim.content, actor };
    if (evaluateStepAll(ctx, step.done)) return actor;
  }
  // Conditions partagées entre les deux (l'un apporte, l'autre est au rendez-vous).
  const either: RuleContext = { world: sim.world, content: sim.content, actor: null };
  return evaluateStepAll(either, step.done) ? 0 : null;
}

/** Ouvre ce qui doit l'être et franchit ce qui est fait, dans le lieu où l'on joue. */
export function checkQuests(sim: SimContext, hooks: StoryHooks): void {
  const place = sim.content.places[sim.world.common.place];
  if (place === undefined) return;
  const either: RuleContext = { world: sim.world, content: sim.content, actor: null };
  for (const line of Object.values(place.quests)) {
    if (!(line.id in sim.world.progress.quests)) {
      if (evaluateStepAll(either, line.requires)) openQuest(sim, line.id, hooks);
      continue;
    }
    const state = sim.world.progress.quests[line.id];
    if (state === undefined || state.done) continue;
    for (const step of activeSteps(line, passedOf(sim.world, line.id))) {
      const actor = stepActor(sim, step);
      if (actor === null) continue;
      // Un don d'étape ne tombe jamais au sol: l'étape attend qu'il y ait de la place.
      const refused = stepGiftRefusal(sim, step, actor);
      if (refused === null) passStep(sim, line, step, actor, hooks);
      else if (sim.world.tick % STORY.giftReminderTicks < STORY.checkEveryTicks) {
        const target = sim.world.players[actor].talk?.villager ?? null;
        sim.emit({ type: 'refused', player: actor, reason: refused, target });
      }
    }
  }
}

/** Intention « suivre cette suite » (`null`: ne plus rien suivre). */
export function trackQuest(sim: SimContext, player: PlayerIndex, quest: string | null): void {
  if (quest !== null) {
    const state = sim.world.progress.quests[quest];
    if (state === undefined || state.done) return;
  }
  const story = storyOf(sim.world);
  if (story.tracked[player] === quest) return;
  story.tracked[player] = quest;
  sim.touch('common');
}
