/**
 * Évaluation des conditions des données (quêtes, dialogues, envies, emplois du
 * temps, courrier). README des données, section 3.
 */
import { dialogueDone } from '../etat/dialogues-faits';
import { currentOrder } from '../donnees/commandes';
import type { CharacterId, SecretEntry, Vec2 } from '../etat/types';
import type { Condition, Since, Who } from '../donnees/types';
import { MINUTES_PER_DAY } from './constantes';
import { type Sim, character, distance, point } from './contexte';
import { countInBag, countInStacks, duoOwns } from './sac';
import { seatedSeconds } from './bancs';
import { dayOfSeason, seasonOfDay, stageDef, stageReached } from '../donnees/calendrier';
import { weatherOf } from './meteo';
import { momentOf, planningCondition } from '../etat/planning';

/** D7, du moins au plus tendre. */
const TENDERNESS_ORDER = ['none', 'accomplices', 'gentle'] as const;

export interface ToolEvent {
  tool: string;
  pos: Vec2;
  by: CharacterId;
}

export interface ConditionContext {
  /** Le joueur concerné (celui qui parle, agit, ou a l'envie). */
  actor: CharacterId | null;
  /** Valeurs des compteurs au début de l'étape de quête (`step_start`). */
  baselines: Readonly<Record<string, number>> | null;
  /** Événement d'outil en cours (`used_tool_at`). */
  toolEvent: ToolEvent | null;
  /** Quête dont on évalue l'étape (rôles `informed` et `doer` d'une quête à secret). */
  quest?: string | null;
}

export const NO_CONTEXT: ConditionContext = { actor: null, baselines: null, toolEvent: null };

type Scope = 'duo' | CharacterId;

function counterValue(sim: Sim, scope: Scope, key: string, since: Since, ctx: ConditionContext): number {
  const now = sim.world.counters[scope][key] ?? 0;
  switch (since) {
    case 'game_start':
      return now;
    case 'day_start':
      return sim.world.countersToday[scope][key] ?? 0;
    case 'step_start':
      return ctx.baselines === null ? now : now - (ctx.baselines[`${scope}:${key}`] ?? 0);
  }
}

/** Ce qu'il manque à un compteur d'une étape de quête (même lecture que la condition). */
export function counterRemaining(sim: Sim, baselines: Readonly<Record<string, number>>, key: string, count: number, since: Since): number {
  return count - counterValue(sim, 'duo', key, since, { ...NO_CONTEXT, baselines });
}

/** Le personnage qui tient ce rôle dans le secret de la quête en cours (ou du dernier secret actif). */
function roleHolder(sim: Sim, ctx: ConditionContext, role: 'informed' | 'doer'): CharacterId | null {
  const entry = secretEntry(sim, ctx.quest ?? null);
  return entry === null ? null : entry[role];
}

function byWho(sim: Sim, who: Who, ctx: ConditionContext, test: (scope: Scope) => boolean): boolean {
  switch (who) {
    case 'informed':
    case 'doer': {
      const id = roleHolder(sim, ctx, who);
      return id !== null && test(id);
    }
    case 'either':
      return test('duo');
    case 'actor':
      return ctx.actor === null ? test('duo') : test(ctx.actor);
    case 'both':
      return test('p1') && test('p2');
  }
}

function byCharacter(sim: Sim, who: Who, ctx: ConditionContext, test: (id: CharacterId) => boolean): boolean {
  switch (who) {
    case 'informed':
    case 'doer': {
      const id = roleHolder(sim, ctx, who);
      return id !== null && test(id);
    }
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

/**
 * La commande est-elle complète ? Celle du train du jour `day` si on le donne
 * (payée: son résultat; en cours: la caisse), sinon celle de la caisse, ou la
 * dernière payée tant que la caisse ne s'est pas rouverte (jusqu'au matin).
 */
export function orderSatisfied(sim: Sim, day: number | null = null): boolean {
  const { world } = sim;
  if (day !== null) {
    const paid = world.orderHistory.find((o) => o.day === day);
    if (paid !== undefined) return paid.complete;
    if (currentOrder(sim.content.settings, world).day !== day || world.orderResult !== null) return false;
  } else if (world.orderResult !== null) {
    return world.orderResult.complete;
  }
  return currentOrder(sim.content.settings, world).lines.every((line) => countInStacks(world.crate, line.item) >= line.count);
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
    case 'weather_was':
      // La veille: écrite pendant la démo, puis lue dans le journal de la météo tirée.
      return weatherOf(sim, world.clock.day - 1) === condition.weather;
    case 'weather_tomorrow_is':
      return world.weatherTomorrow === condition.weather;
    case 'morning_mist':
      return world.morningMist;
    case 'tenderness_at_least':
      return TENDERNESS_ORDER.indexOf(sim.content.settings.tenderness) >= TENDERNESS_ORDER.indexOf(condition.level);
    case 'stage_due': {
      const stage = stageDef(sim.content.settings, condition.stage);
      return stage !== null && !world.stages.passed.includes(condition.stage) && stageReached(stage, world.clock);
    }
    case 'season_is': {
      const s = sim.content.settings;
      return condition.seasons.includes(seasonOfDay(s, world.clock.day)) && dayOfSeason(s, world.clock.day) >= condition.fromSeasonDay;
    }
    case 'flag':
      return world.flags.includes(condition.flag);
    case 'quest_active':
      return world.quests.some((q) => q.id === condition.quest && q.status === 'active');
    case 'quest_done':
      return world.quests.some((q) => q.id === condition.quest && q.status === 'done');
    case 'step_active': {
      const q = world.quests.find((x) => x.id === condition.quest);
      return q?.status === 'active' && q.step === stepIndex(sim, condition.quest, condition.step);
    }
    case 'quest_step_done': {
      const q = world.quests.find((x) => x.id === condition.quest);
      if (q === undefined) return false;
      const index = stepIndex(sim, condition.quest, condition.step);
      return index >= 0 && (q.status === 'done' || q.step > index);
    }
    case 'dialogue_done':
      return dialogueDone(world.dialoguesDone, condition.dialogue);
    case 'item_owned':
      return duoOwns(sim, condition.item) >= condition.count;
    case 'item_in_bag':
      if (condition.who === 'either') {
        return countInBag(character(sim, 'p1'), condition.item) + countInBag(character(sim, 'p2'), condition.item) >= condition.count;
      }
      return byCharacter(sim, condition.who, ctx, (id) => countInBag(character(sim, id), condition.item) >= condition.count);
    case 'built':
      return world.constructions.some((c) => c.id === condition.construction && c.status === 'done');
    case 'recipe_known':
      return world.unlockedRecipes.includes(condition.recipe);
    case 'order_complete':
      return orderSatisfied(sim, condition.day);
    case 'counter':
    case 'choice_made':
      return byWho(
        sim,
        condition.who,
        ctx,
        (scope) => counterValue(sim, scope, condition.key, condition.since, ctx) >= condition.count,
      );
    case 'used_tool_at': {
      const ev = ctx.toolEvent;
      if (ev?.tool !== condition.tool) return false;
      const target = sim.map.points[condition.point];
      return target !== undefined && distance(ev.pos, target) <= condition.radius;
    }
    case 'stayed_at':
      return byCharacter(sim, condition.who, ctx, (id) => {
        const c = character(sim, id);
        return (condition.seated ? seatedSeconds(sim, c, condition.point) : (c.stays[condition.point] ?? 0)) >= condition.seconds;
      });
    case 'variant':
      return variantOf(sim.world.seed, condition.group, condition.of) === condition.value;
    case 'looked_at': {
      const at = sim.map.points[condition.point];
      if (at === undefined) return false;
      return byCharacter(sim, condition.who, ctx, (id) => {
        const c = character(sim, id);
        const d = Math.hypot(at.x - c.pos.x, at.y - c.pos.y);
        if (d > condition.distance || d < condition.minDistance) return false;
        if (condition.still && c.speed >= sim.content.settings.moments.stillSpeed) return false;
        if (d < 0.5) return true;
        let diff = Math.abs(Math.atan2(at.y - c.pos.y, at.x - c.pos.x) - c.facing) % (2 * Math.PI);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        return diff <= LOOK_CONE;
      });
    }
    case 'secret_role': {
      const entry = secretEntry(sim, condition.quest);
      return entry !== null && ctx.actor !== null && entry[condition.role] === ctx.actor;
    }
    case 'hens_named': {
      if (condition.who === 'either') return world.hens.filter((h) => h.namedBy !== null).length >= condition.count;
      return byCharacter(sim, condition.who, ctx, (id) => world.hens.filter((h) => h.namedBy === id).length >= condition.count);
    }
    case 'annonce_active': {
      const a = world.board.current;
      if (a?.state !== 'open' || (condition.gabarit !== null && a.gabarit !== condition.gabarit)) return false;
      if (condition.step === null) return true;
      const q = world.quests.find((x) => x.id === a.quest);
      return q?.status === 'active' && q.step === stepIndex(sim, a.quest, condition.step);
    }
    case 'improvement_built':
      return (world.improvements[condition.id]?.builtDay ?? null) !== null;
    case 'bought':
      return (world.catalogueBought[condition.item] ?? 0) > 0;
    case 'inside':
      return byCharacter(sim, condition.who, ctx, (id) => character(sim, id).inside === condition.building);
    case 'money_at_least':
      return world.purse >= condition.amount;
    // 0.13 (lot H1): calendrier du bourg, décisions à deux, carnet; mêmes règles que le carnet (`etat/planning.ts`).
    case 'school_day':
    case 'special_day':
    case 'season_day_is':
    case 'birthday_of':
    case 'decision_made':
    case 'habit_known':
    case 'bond_at_least':
      return planningCondition(sim.content, world, condition, momentOf(world));
  }
}

/** Le secret de cette quête (`null`: le dernier secret d'une quête active), ou `null`. */
export function secretEntry(sim: Sim, quest: string | null): SecretEntry | null {
  const entries = sim.world.secrets.entries;
  if (quest !== null) return entries.find((e) => e.quest === quest) ?? null;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e !== undefined && sim.world.quests.some((q) => q.id === e.quest && q.status === 'active')) return e;
  }
  return null;
}

/** Écart maximal du regard pour `looked_at` et les moments qui demandent de regarder. */
export const LOOK_CONE = Math.PI / 6;


/**
 * Variante d'un groupe pour cette partie: empreinte (FNV-1a) de la graine et du nom du groupe.
 * Ne consomme pas le générateur (le reste de la partie ne change pas) et se relit à l'identique.
 */
export function variantOf(seed: number, group: string, of: number): number {
  let h = 0x811c9dc5;
  const text = `${String(seed)}:${group}`;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % of;
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
    if (c.type === 'all' || c.type === 'any') c.conditions.forEach(visit);
    else if (c.type === 'not') visit(c.condition);
    else if ((c.type === 'counter' || c.type === 'choice_made') && c.since === 'step_start') {
      for (const scope of ['duo', 'p1', 'p2'] as const) {
        out[`${scope}:${c.key}`] = sim.world.counters[scope][c.key] ?? 0;
      }
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
