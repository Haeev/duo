/**
 * Contrats entre le cœur du jeu (simulation, réseau, entrées) et les modules
 * d'affichage: le rendu 3D (`src/rendu/`) et l'interface (`src/interface/`).
 *
 * Le point d'entrée (`src/main.ts`) crée une `GameView`, puis appelle
 * `createRenderer` de `src/rendu/index.ts` et `createInterface` de
 * `src/interface/index.ts` avec elle. Ni le rendu ni l'interface n'importent la
 * simulation ou le réseau.
 */
import type { Audio } from '@duo/sdk';
import type { Intent } from './actions';
import type { GameMap } from './carte';
import type { CharacterId, ReadonlyWorld, WorldEvent } from './types';
import type { Content } from '../donnees/types';

export interface GameView {
  /** Contenu du game designer, validé (objets, cultures, habitants, textes...). */
  readonly content: Content;
  /** Carte du bourg. */
  readonly map: GameMap;
  /** Personnage du joueur de cette machine. */
  localCharacter(): CharacterId;
  /**
   * État à afficher. Chez l'hôte: l'état de la simulation. Chez l'invité:
   * le dernier état reçu, avec les positions interpolées des autres et la
   * position prédite de son propre personnage. Ne pas garder de référence
   * d'une image à l'autre: relire à chaque image.
   */
  world(): ReadonlyWorld;
  /** Facteur d'interpolation entre `prev` et `pos` (0 à 1) pour cette image. */
  alpha(): number;
  /** Envoyer une intention du joueur local. */
  send(intent: Intent): void;
  /** Événements ponctuels (sons, effets), chez l'hôte comme chez l'invité. */
  onEvent(listener: (event: WorldEvent) => void): () => void;
  /** Libellé réel d'une touche (`KeyW` donne « Z » sur un clavier AZERTY). */
  keyLabel(code: string): string;
  /** Rôle de cette machine, pour l'affichage de diagnostic seulement. */
  readonly role: 'host' | 'guest';
}

/** Ce que le clic du joueur a touché, calculé par le rendu (lancer de rayon). */
export type PickResult =
  | { kind: 'ground'; x: number; y: number }
  | { kind: 'villager'; villager: string }
  | { kind: 'character'; character: CharacterId }
  | { kind: 'furniture'; furniture: string }
  | { kind: 'ground_item'; groundItem: string }
  | { kind: 'tree'; tree: string };

/**
 * Qualité du rendu. `light`: mode léger pour les essais en rendu logiciel
 * (Chromium du cloud, SwiftShader): petite résolution interne, ombres coupées,
 * moins de particules et de végétation. Activé par `?rendu=leger`.
 */
export type RenderQuality = 'normal' | 'light';

export interface RendererOptions {
  view: GameView;
  /** Élément qui reçoit le canevas (il occupe tout l'élément). */
  container: HTMLElement;
  /** Réduction des animations (réglage de la plateforme). */
  reducedMotion: boolean;
  /** Qualité demandée (`normal` si absent). */
  quality?: RenderQuality;
}

export interface Renderer {
  /** Charge les assets et compile les shaders. Appelée une fois. */
  load(onProgress: (ratio: number) => void): Promise<void>;
  /** Dessine une image (appelée à chaque `requestAnimationFrame`). */
  frame(dtSeconds: number): void;
  /** Orientation de la caméra autour de la verticale (radians), pour tourner Z Q S D. */
  cameraYaw(): number;
  /** Commandes de caméra locales (A et E, R et F, Maj et molette). */
  camera(command: CameraCommand): void;
  /** Lancer de rayon depuis un point de l'écran (coordonnées client). */
  pick(clientX: number, clientY: number): PickResult | null;
  /** Statistiques de dessin pour l'indicateur de développement. */
  stats(): { drawCalls: number; triangles: number };
  dispose(): void;
}

export type CreateRenderer = (options: RendererOptions) => Renderer;

/** Commandes de caméra locales, du clavier ou des boutons du HUD. */
export type CameraCommand = 'rotate_left' | 'rotate_right' | 'zoom_in' | 'zoom_out';

export interface InterfaceOptions {
  view: GameView;
  /** Couche DOM au-dessus du canevas. */
  overlay: HTMLElement;
  /** Taille de l'interface (1, 1,25 ou 1,5) et réduction des animations. */
  uiScale: number;
  reducedMotion: boolean;
  /** Boutons de caméra du HUD: transmis au rendu par `main.ts` (facultatif). */
  camera?: (command: CameraCommand) => void;
}

export interface GameInterface {
  /** Mise à jour à chaque image (l'interface relit `view.world()`). */
  frame(dtSeconds: number): void;
  /**
   * Touche d'interface reçue par le jeu (Tab, Retour arrière, Entrée, flèches):
   * renvoie vrai si l'interface l'a consommée (le personnage ne bouge pas).
   */
  handleKey(code: string): boolean;
  /** Vrai si un menu de l'interface capte le clavier (on ne marche pas). */
  capturesMovement(): boolean;
  dispose(): void;
}

export type CreateInterface = (options: InterfaceOptions) => GameInterface;

export interface AudioOptions {
  view: GameView;
  /** Module audio du SDK: bus musique, effets, interface; volumes de la machine appliqués. */
  audio: Audio;
  /** Adresse d'un fichier du paquet du jeu (`assets/son/...`). */
  url: (path: string) => string;
  reducedMotion: boolean;
}

export interface GameAudio {
  /** Chargement des sons (appelé pendant le chargement du jeu). */
  load(onProgress: (ratio: number) => void): Promise<void>;
  /** À chaque image (ambiances, musique selon l'heure et le lieu). */
  frame(dtSeconds: number): void;
  dispose(): void;
}

export type CreateAudio = (options: AudioOptions) => GameAudio;
