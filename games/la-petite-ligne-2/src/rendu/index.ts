/** Rendu 3D (lot L4): ce que les autres lots importent. */
import { createRenderer as createEngine, type GameRenderer, type RenderOptions } from './moteur';
import { addressStyle } from './encre/reglages';
import { gamePlaceBuildings } from './lieu/batiments';
import { gameDecorModels } from './lieu/decors';
import { gameCharacters } from './personnages/index';

export { webglAvailable } from './moteur';

/** Le moteur, avec les personnages assemblés (lot L6) sauf si l'appelant donne sa couche. */
export function createRenderer(options: RenderOptions): GameRenderer | null {
  // Interrupteur de transition (ADR 0023): `?rendu=aplats` rend l'ancien rendu sans rien changer
  // d'autre; sans paramètre, le style de `INK_SETTINGS.style` (encre).
  const style = addressStyle(globalThis.location.search);
  return createEngine({
    characters: gameCharacters(options.view),
    models: gameDecorModels(),
    buildings: gamePlaceBuildings(),
    style,
    ...options,
  });
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
export { gameDecorModels } from './lieu/decors';
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
