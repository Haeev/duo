/**
 * Conditions des étapes et des scènes: celles des règles communes (`regles/conditions.ts`,
 * réutilisées telles quelles) et celles de l'histoire. Aucun contenu nommé.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { StepCondition, StoryCondition } from '../../donnees/schemas/quete';
import type { ReadonlyWorld } from '../../etat/monde';
import { postureOf } from '../briques/postures';
import { onceKey } from '../dialogues/conversation';
import { countHeld, evaluate, type RuleContext } from '../regles/conditions';
import { sceneSeenOn } from './faits';
import { STORY } from './reglages';

const STORY_TYPES: ReadonlySet<string> = new Set([
  'deliver',
  'reach',
  'talked',
  'together',
  'posture',
  'scene_seen',
  'quest_step',
]);

export function isStoryCondition(c: StepCondition): c is StoryCondition {
  return STORY_TYPES.has(c.type);
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function playersTogether(
  world: ReadonlyWorld,
  radius: number = STORY.togetherRadius,
): boolean {
  const [a, b] = world.players;
  return distance(a.body.x, a.body.y, b.body.x, b.body.y) <= radius;
}

/** Étape franchie (ou, `step` absent, suite finie). */
export function questStepPassed(world: ReadonlyWorld, quest: string, step?: string): boolean {
  const state = world.progress.quests[quest];
  if (state === undefined) return false;
  if (step === undefined) return state.done;
  return state.done || (state.passed ?? []).includes(step);
}

function forActor(ctx: RuleContext, test: (player: PlayerIndex) => boolean): boolean {
  return ctx.actor === null ? test(0) || test(1) : test(ctx.actor);
}

function evaluateStory(ctx: RuleContext, c: StoryCondition): boolean {
  const { world, content } = ctx;
  const placeId = world.common.place;
  const place = content.places[placeId];
  switch (c.type) {
    case 'deliver':
      return forActor(
        ctx,
        (p) =>
          world.players[p].talk?.villager === c.villager &&
          countHeld(world.players[p], c.item) >= c.count,
      );
    case 'reach': {
      const point = place?.map.points[c.point];
      if (point === undefined) return false;
      const radius = c.radius ?? STORY.reachRadius;
      const near = (p: PlayerIndex): boolean =>
        distance(world.players[p].body.x, world.players[p].body.y, point.x, point.y) <= radius;
      return c.who === 'both' ? near(0) && near(1) : forActor(ctx, near);
    }
    case 'talked': {
      const dialogue = place?.dialogues.find((d) => d.id === c.dialogue);
      if (dialogue === undefined) return false;
      return forActor(ctx, (p) => {
        const talk = world.players[p].talk;
        if (talk?.dialogue === c.dialogue && (c.node === undefined || talk.node === c.node))
          return true;
        // Un dialogue joué une fois se souvient de lui-même: il compte encore après coup.
        return (
          c.node === undefined &&
          dialogue.once !== null &&
          world.progress.memory[onceKey(placeId, dialogue, p)] !== undefined
        );
      });
    }
    case 'together':
      return playersTogether(world, c.radius);
    case 'posture': {
      const state = world.places[placeId];
      if (state === undefined) return false;
      const holds = (p: PlayerIndex): boolean => postureOf(state, p)?.kind === c.posture;
      return c.who === 'both' ? holds(0) && holds(1) : forActor(ctx, holds);
    }
    case 'scene_seen':
      return sceneSeenOn(world, placeId, c.scene) !== null;
    case 'quest_step':
      return questStepPassed(world, c.quest, c.step);
  }
}

export function evaluateStep(ctx: RuleContext, c: StepCondition): boolean {
  return isStoryCondition(c) ? evaluateStory(ctx, c) : evaluate(ctx, c);
}

export function evaluateStepAll(ctx: RuleContext, conditions: readonly StepCondition[]): boolean {
  return conditions.every((c) => evaluateStep(ctx, c));
}
