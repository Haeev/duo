/**
 * Points d'accroche du rendu pour le technical artist (eau, panache du train,
 * ciel, effets d'ambiance). Une extension reçoit les accès utiles une fois la
 * scène construite et renvoie une partie mise à jour à chaque image (ou
 * `null`); le moteur l'appelle après les siennes et la libère à la sortie.
 *
 * Pour en ajouter une: écrire son fichier dans `src/rendu/` et l'inscrire dans
 * `RENDER_EXTENSIONS` ci-dessous.
 */
import type {
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import type { GameMap } from '../etat/carte';
import type { WorldEvent } from '../etat/types';
import type { FrameContext, RenderPart } from './contexte';
import { createAmbiance } from './ambiance';
import type { LampBoard } from './lampes';
import type { DaylightRig } from './lumiere';
import type { SharedMaterials } from './materiaux';
import type { ModelLibrary } from './modeles';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

export interface RenderHooks {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: OrthographicCamera;
  map: GameMap;
  /** Matériaux partagés: `palette` (`lpl_palette`), `water`, `ghost`, et la couleur des cases de la palette. */
  materials: SharedMaterials;
  /** Matériau partagé des habitants (`lpl_characters`); les joueurs en ont chacun une copie. */
  characterMaterial: MeshStandardMaterial | null;
  library: ModelLibrary;
  terrain: Terrain;
  /** Surface de la rivière, en morceaux (`terrain.water`). */
  water: readonly Mesh[];
  /** Surface du ru de la Côte, en morceaux (`terrain.streamWater`), vide sans ru. */
  streamWater: readonly Mesh[];
  daylight: DaylightRig;
  /** Point d'émission du panache de la locomotive (`locomotive_smoke`), `null` sans modèle de train. */
  smokeEmitter(): Object3D | null;
  /** État du train à l'image courante (pour le panache). */
  trainState(): { visible: boolean; moving: boolean };
  /** Suivi des géométries, matériaux et textures créés: libérés avec le rendu. */
  resources: ResourceTracker;
  /** Allumage des lampadaires (tour 9: réverbère à bâtir, lanternes allumées à la perche). */
  lamps?: LampBoard;
}

/** Une partie ajoutée par une extension. */
export interface ExtensionPart extends RenderPart {
  update(context: FrameContext): void;
  /** Événements ponctuels du monde (arrosage, bêche, sifflet...), avant la mise à jour de l'image. */
  handleEvent?(event: WorldEvent, context: FrameContext): void;
  dispose?(): void;
}

export type RenderExtension = (hooks: RenderHooks) => ExtensionPart | null;

/** Extensions inscrites (technical artist). */
export const RENDER_EXTENSIONS: readonly RenderExtension[] = [
  // Lumière, eau, pluie, nuages, brume, lueurs de nuit, panache et particules du potager.
  createAmbiance,
];
