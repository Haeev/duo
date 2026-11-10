/** Rendu 3D (lot L4): ce que les autres lots importent. */
import { createRenderer as createEngine, type GameRenderer, type RenderOptions } from './moteur';
import { gameCharacters } from './personnages/index';

export { webglAvailable } from './moteur';

/** Le moteur, avec les personnages assemblés (lot L6) sauf si l'appelant donne sa couche. */
export function createRenderer(options: RenderOptions): GameRenderer | null {
  return createEngine({ characters: gameCharacters(options.view), ...options });
}
export type { GameRenderer, RenderOptions, RenderStats } from './moteur';
export { screenToWorld } from './camera';
export type { CameraInput } from './camera';
export type {
  CharacterFrame,
  CharacterLayer,
  CharacterLayerDeps,
  CharacterLayerFactory,
} from './bonshommes';
export type { Aimable } from './cible';
export type { ModelSource } from './lieu/lieu';
export type { SceneVolume } from './lieu/description';
export {
  DEFAULT_GRAPHICS_OPTIONS,
  GRAPHICS_PRESET_ORDER,
  loadGraphicsOptions,
  saveGraphicsOptions,
  sessionGraphicsStorage,
  withLevel,
} from './options';
export type { GraphicsOptions, GraphicsPort, GraphicsPreset } from './options';
