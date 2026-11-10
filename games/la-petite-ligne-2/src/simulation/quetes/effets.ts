/**
 * Effets des étapes et des scènes: ceux des règles communes passent par `regles/effets.ts`
 * (réutilisé tel quel), ceux de l'histoire s'appliquent ici. Le lieu est celui où l'on joue.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { StepEffect, StoryEffect } from '../../donnees/schemas/quete';
import type { SimContext } from '../noyau/systemes';
import { applyEffect } from '../regles/effets';
import { remember } from '../regles/memoire';
import { arrivalKey, storyOf, zoneKey } from './faits';

const STORY_TYPES: ReadonlySet<string> = new Set([
  'unlock_zone',
  'villager_arrives',
  'open_quest',
  'play_scene',
  'travel_to',
]);

function isStoryEffect(e: StepEffect): e is StoryEffect {
  return STORY_TYPES.has(e.type);
}

/** Ce que les effets de l'histoire demandent aux deux moteurs (branché par `index.ts`). */
export interface StoryHooks {
  openQuest(sim: SimContext, quest: string): void;
  playScene(sim: SimContext, scene: string, by: PlayerIndex): void;
}

export function applyStepEffects(
  sim: SimContext,
  actor: PlayerIndex,
  effects: readonly StepEffect[],
  hooks: StoryHooks,
): void {
  const place = sim.world.common.place;
  for (const effect of effects) {
    if (!isStoryEffect(effect)) {
      applyEffect(sim, actor, effect);
      continue;
    }
    switch (effect.type) {
      case 'unlock_zone':
        remember(sim, zoneKey(place, effect.zone), true, 'duo');
        break;
      case 'villager_arrives':
        remember(sim, arrivalKey(place, effect.villager), true, 'duo');
        break;
      case 'open_quest':
        hooks.openQuest(sim, effect.quest);
        break;
      case 'play_scene':
        hooks.playScene(sim, effect.scene, actor);
        break;
      case 'travel_to':
        // Pris par le voyage quand la scène en cours est finie (`voyage/depart.ts`).
        storyOf(sim.world).departure = {
          to: effect.place,
          since: sim.world.tick,
          ending: effect.ending?.id ?? null,
          ...(effect.arrival === undefined ? {} : { arrival: effect.arrival }),
        };
        sim.touch('common');
        break;
    }
  }
}
