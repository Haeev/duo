/**
 * Tout ce qui bouge ou change pendant la partie: personnages, habitants,
 * potager, arbres à couper, maisonnette (constructions, meubles, coupe des
 * murs), poules, objets au sol, train et effets. Chaque partie lit l'état à
 * chaque image; les événements ponctuels déclenchent les effets.
 */
import type { Scene } from 'three';
import type { WorldEvent } from '../etat/types';
import type { GameView } from '../etat/vue';
import type { IsoCameraRig } from './camera';
import type { FrameContext, PickRegistry, RenderPart } from './contexte';
import type { SharedMaterials } from './materiaux';
import type { ModelLibrary } from './modeles';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

export interface WorldPartsOptions {
  scene: Scene;
  view: GameView;
  library: ModelLibrary;
  materials: SharedMaterials;
  terrain: Terrain;
  resources: ResourceTracker;
  picks: PickRegistry;
  rig: IsoCameraRig;
}

/** Une partie qui réagit aussi aux événements ponctuels. */
export interface EventfulPart extends RenderPart {
  handleEvent?(event: WorldEvent, context: FrameContext): void;
  dispose?(): void;
}

export class WorldParts implements RenderPart {
  private readonly parts: EventfulPart[] = [];

  constructor(readonly options: WorldPartsOptions) {}

  add(part: EventfulPart): void {
    this.parts.push(part);
  }

  handleEvent(event: WorldEvent, context: FrameContext): void {
    for (const part of this.parts) {
      part.handleEvent?.(event, context);
    }
  }

  update(context: FrameContext): void {
    for (const part of this.parts) {
      part.update(context);
    }
  }

  dispose(): void {
    for (const part of this.parts) {
      part.dispose?.();
    }
    this.parts.length = 0;
  }
}
