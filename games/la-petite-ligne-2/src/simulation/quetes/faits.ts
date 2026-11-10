/**
 * Ce que l'histoire écrit dans la mémoire des faits (`regles/memoire.ts`), sous des clés du
 * moteur: zones ouvertes, habitants arrivés, scènes vues. Les autres lots lisent ces fonctions,
 * jamais les clés elles-mêmes. Aussi: l'état de l'histoire dans la tranche « commun ».
 */
import type { DeepReadonly, ReadonlyWorld, WorldState } from '../../etat/monde';
import type { StoryState } from '../../donnees/schemas/scene';

export function zoneKey(place: string, zone: string): string {
  return `zones.${place}.${zone}`;
}

export function arrivalKey(place: string, villager: string): string {
  return `habitants.${place}.${villager}`;
}

/** Valeur retenue: le jour où la scène a été vue jusqu'au bout pour la dernière fois. */
export function sceneKey(place: string, scene: string): string {
  return `scenes.${place}.${scene}`;
}

/** Zone ouverte par l'histoire (effet `unlock_zone`), pour le déplacement et le rendu. */
export function isZoneOpen(world: ReadonlyWorld, place: string, zone: string): boolean {
  return world.progress.memory[zoneKey(place, zone)] !== undefined;
}

/** Habitant arrivé par l'histoire (effet `villager_arrives`), pour la présence des habitants. */
export function hasArrived(world: ReadonlyWorld, place: string, villager: string): boolean {
  return world.progress.memory[arrivalKey(place, villager)] !== undefined;
}

export function sceneSeenOn(world: ReadonlyWorld, place: string, scene: string): number | null {
  const fact = world.progress.memory[sceneKey(place, scene)];
  return fact === undefined || typeof fact.v !== 'number' ? null : fact.v;
}

/** L'état de l'histoire; créé au premier besoin (l'appelant touche ensuite la tranche « commun »). */
export function storyOf(world: WorldState): StoryState {
  world.common.story ??= { tracked: [null, null], scene: null, queue: [] };
  return world.common.story;
}

export function readStory(world: ReadonlyWorld): DeepReadonly<StoryState> | null {
  return world.common.story ?? null;
}
