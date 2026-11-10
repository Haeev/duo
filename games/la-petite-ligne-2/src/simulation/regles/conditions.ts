/**
 * Évaluation des conditions des données (dialogues, briques, quêtes au jalon 2). Aucun contenu
 * nommé: chaque cas lit l'état d'après les seuls paramètres de la condition.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Condition } from '../../donnees/schemas/regles';
import type { ReadonlyWorld } from '../../etat/monde';
import { bondKey } from '../../etat/progression';

export interface RuleContext {
  readonly world: ReadonlyWorld;
  readonly content: Content;
  /** Joueur qui parle ou agit; `null`: l'un ou l'autre suffit. */
  readonly actor: PlayerIndex | null;
}

/** Exemplaires d'un objet dans la barre et le sac. */
export function countHeld(player: ReadonlyWorld['players'][number], item: string): number {
  let total = 0;
  for (const slots of [player.toolbar, player.bag?.slots ?? []])
    for (const stack of slots) if (stack?.item === item) total += stack.count;
  return total;
}

function forActor(ctx: RuleContext, test: (player: PlayerIndex) => boolean): boolean {
  return ctx.actor === null ? test(0) || test(1) : test(ctx.actor);
}

export function evaluate(ctx: RuleContext, condition: Condition): boolean {
  const { world } = ctx;
  switch (condition.type) {
    case 'all':
      return condition.conditions.every((c) => evaluate(ctx, c));
    case 'any':
      return condition.conditions.some((c) => evaluate(ctx, c));
    case 'not':
      return !evaluate(ctx, condition.condition);
    case 'remembered': {
      const fact = world.progress.memory[condition.key];
      if (fact === undefined) return false;
      return condition.equals === undefined || fact.v === condition.equals;
    }
    case 'need_at_least':
      return forActor(ctx, (p) => world.players[p].needs[condition.need] >= condition.value);
    case 'item_in_bag':
      return forActor(ctx, (p) => countHeld(world.players[p], condition.item) >= condition.count);
    case 'place_is':
      return world.common.place === condition.place;
    case 'bond_at_least':
      return forActor(
        ctx,
        (p) => (world.progress.bonds[bondKey(condition.villager, p)] ?? 0) >= condition.points,
      );
    case 'time_is': {
      const m = world.minutes;
      // Une plage peut passer minuit (22 h à 2 h).
      return condition.from <= condition.to
        ? m >= condition.from && m < condition.to
        : m >= condition.from || m < condition.to;
    }
  }
}

export function evaluateAll(ctx: RuleContext, conditions: readonly Condition[]): boolean {
  return conditions.every((c) => evaluate(ctx, c));
}
