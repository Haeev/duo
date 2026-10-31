/**
 * Évaluation des conditions des données (quêtes, dialogues, envies, emplois du
 * temps, courrier). README des données, section 3.
 */
import type { CharacterId, Vec2 } from '../etat/types';
import type { Condition, Since, Who } from '../donnees/types';
import { MINUTES_PER_DAY } from './constantes';
import { type Sim, character, distance, point } from './contexte';
import { countInBag, countInStacks, duoOwns } from './sac';

export interface ToolEvent {
  tool: string;
  pos: Vec2;
  by: CharacterId;
}

export interface ConditionContext {
  /** Le joueur concerné (celui qui parle, agit, ou a l'envie). */
  actor: CharacterId | null;
  /** Valeurs des compteurs au début de l'étape de quête (`step_start`). */
  baselines: Record<string, number> | null;
  /** Événement d'outil en cours (`used_tool_at`). */
  toolEvent: ToolEvent | null;
}

export const NO_CONTEXT: ConditionContext = { actor: null, baselines: null, toolEvent: null };

type Scope = 'duo' | CharacterId;

function counterValue(sim: Sim, scope: Scope, key: string, since: Since, ctx: ConditionContext): number {
  const now = sim.world.counters[scope][key] ?? 0;
  switch (since) {
    case 'game_start':
      return now;
    case 'day_start':
      return now - (sim.world.countersAtDawn[scope][key] ?? 0);
    case 'step_start':
      return ctx.baselines === null ? now : now - (ctx.baselines[`${scope}:${key}`] ?? 0);
  }
}

function byWho(who: Who, ctx: ConditionContext, test: (scope: Scope) => boolean): boolean {
  switch (who) {
    case 'either':
      return test('duo');
    case 'actor':
      return ctx.actor === null ? test('duo') : test(ctx.actor);
    case 'both':
      return test('p1') && test('p2');
  }
}

function byCharacter(who: Who, ctx: ConditionContext, test: (id: CharacterId) => boolean): boolean {
  switch (who) {
    case 'either':
      return test('p1') || test('p2');
    case 'actor':
      return ctx.actor === null ? test('p1') || test('p2') : test(ctx.actor);
    case 'both':
      return test('p1') && test('p2');
  }
}

/** Ordre des pas d'une quête: l'étape `step` est-elle finie ? */
function stepIndex(sim: Sim, quest: string, step: string): number {
  const def = sim.content.quests.find((q) => q.id === quest);
  return def === undefined ? -1 : def.steps.findIndex((s) => s.id === step);
}

export function orderSatisfied(sim: Sim): boolean {
  const { world } = sim;
  if (world.orderResult !== null) return world.orderResult.complete;
  return sim.content.settings.order.lines.every((line) => countInStacks(world.crate, line.item) >= line.count);
}

export function evaluate(sim: Sim, condition: Condition, ctx: ConditionContext): boolean {
  const { world } = sim;
  switch (condition.type) {
    case 'all':
      return condition.conditions.every((c) => evaluate(sim, c, ctx));
    case 'any':
      return condition.conditions.some((c) => evaluate(sim, c, ctx));
    case 'not':
      return !evaluate(sim, condition.condition, ctx);
    case 'day_is':
      return condition.days.includes(world.clock.day);
    case 'day_at_least':
      return world.clock.day >= condition.day;
    case 'weekday_is':
      return condition.weekdays.includes((world.clock.day - 1) % 7);
    case 'time_is': {
      const m = Math.min(world.clock.minutes, MINUTES_PER_DAY);
      return m >= condition.from && m < condition.to;
    }
    case 'weather_is':
      return world.weather === condition.weather;
    case 'flag':
      return world.flags.includes(condition.flag);
    case 'quest_active':
      return world.quests.some((q) => q.id === condition.quest && q.status === 'active');
    case 'quest_done':
      return world.quests.some((q) => q.id === condition.quest && q.status === 'done');
    case 'step_active': {
      const q = world.quests.find((x) => x.id === condition.quest);
      return q !== undefined && q.status === 'active' && q.step === stepIndex(sim, condition.quest, condition.step);
    }
    case 'quest_step_done': {
      const q = world.quests.find((x) => x.id === condition.quest);
      if (q === undefined) return false;
      const index = stepIndex(sim, condition.quest, condition.step);
      return index >= 0 && (q.status === 'done' || q.step > index);
    }
    case 'dialogue_done':
      return world.dialoguesDone.includes(condition.dialogue);
    case 'item_owned':
      return duoOwns(sim, condition.item) >= condition.count;
    case 'item_in_bag':
      if (condition.who === 'either') {
        return countInBag(character(sim, 'p1'), condition.item) + countInBag(character(sim, 'p2'), condition.item) >= condition.count;
      }
      return byCharacter(condition.who, ctx, (id) => countInBag(character(sim, id), condition.item) >= condition.count);
    case 'built':
      return world.constructions.some((c) => c.id === condition.construction && c.status === 'done');
    case 'recipe_known':
      return world.unlockedRecipes.includes(condition.recipe);
    case 'order_complete':
      return orderSatisfied(sim);
    case 'counter':
      return byWho(
        condition.who,
        ctx,
        (scope) => counterValue(sim, scope, condition.key, condition.since, ctx) >= condition.count,
      );
    case 'used_tool_at': {
      const ev = ctx.toolEvent;
      if (ev === null || ev.tool !== condition.tool) return false;
      const target = sim.map.points[condition.point];
      return target !== undefined && distance(ev.pos, target) <= condition.radius;
    }
    case 'stayed_at':
      return byCharacter(condition.who, ctx, (id) => (character(sim, id).stays[condition.point] ?? 0) >= condition.seconds);
  }
}

export function evaluateAll(sim: Sim, conditions: readonly Condition[], ctx: ConditionContext): boolean {
  return conditions.every((c) => evaluate(sim, c, ctx));
}

/** Contient une condition d'événement d'outil (évaluée seulement au moment de l'événement). */
export function hasToolCondition(conditions: readonly Condition[]): boolean {
  return conditions.some(
    (c) =>
      c.type === 'used_tool_at' ||
      ((c.type === 'all' || c.type === 'any') && hasToolCondition(c.conditions)) ||
      (c.type === 'not' && hasToolCondition([c.condition])),
  );
}

/** Relève les compteurs utilisés par des conditions `step_start` (début d'une étape). */
export function captureBaselines(sim: Sim, conditions: readonly Condition[]): Record<string, number> {
  const out: Record<string, number> = {};
  const visit = (c: Condition): void => {
    switch (c.type) {
      case 'all':
      case 'any':
        c.conditions.forEach(visit);
        return;
      case 'not':
        visit(c.condition);
        return;
      case 'counter':
        if (c.since === 'step_start') {
          for (const scope of ['duo', 'p1', 'p2'] as const) {
            out[`${scope}:${c.key}`] = sim.world.counters[scope][c.key] ?? 0;
          }
        }
        return;
      default:
        return;
    }
  };
  conditions.forEach(visit);
  return out;
}

/** Points suivis par les conditions « rester à » (pour compter le temps passé). */
export function stayPoints(conditions: readonly Condition[], out: Set<string>): void {
  for (const c of conditions) {
    if (c.type === 'stayed_at') out.add(c.point);
    if (c.type === 'all' || c.type === 'any') stayPoints(c.conditions, out);
    if (c.type === 'not') stayPoints([c.condition], out);
  }
}

export function pointPos(sim: Sim, id: string): Vec2 {
  return point(sim, id);
}
