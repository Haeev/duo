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
import type { Appearance, Cell, CharacterId, DeepReadonly, ReadonlyWorld, WorldEvent } from './types';

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
  /** Journal de la plateforme (repli automatique vers le mode léger). */
  log?: { info(message: string, data?: unknown): void };
}

/**
 * L'aperçu du cordeau (0.13, parcelles libres, section 5.1), calculé chez chaque joueur par les
 * entrées: la case visée, ou le rectangle en cours de tracé. Le rendu et l'interface le dessinent
 * avec les règles pures de `etat/parcelles.ts`; l'hôte, seul, décide de ce qui est posé.
 */
export interface PlotPreview {
  /** `place`: poser (clic gauche); `remove`: reprendre (clic droit, X). */
  mode: 'place' | 'remove';
  /** Cases du tracé, dans l'ordre de pose (une seule hors d'un glissé). */
  cells: readonly Cell[];
  /** Un rectangle est en cours de tracé (bouton tenu et glissé). */
  dragging: boolean;
  /** Reprise maintenue d'une culture: avancée de 0 à 1, `null` sans maintien. */
  hold: number | null;
  /** Le pointeur à l'écran (coordonnées client) pour l'anneau et la pastille; `null` au clavier. */
  pointer: { x: number; y: number } | null;
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
  /**
   * Point du sol sous l'écran (coordonnées client), à travers les meubles et les
   * personnages: l'aperçu d'un meuble suit la case sous la souris (R11). `null` hors de la carte.
   */
  pickGround?(clientX: number, clientY: number): { x: number; y: number } | null;
  /** Statistiques de dessin pour l'indicateur de développement. */
  stats(): { drawCalls: number; triangles: number };
  /** 0.13: l'aperçu du cordeau à dessiner (`null`: aucun). */
  setPlotPreview?(preview: PlotPreview | null): void;
  /**
   * Aperçu 3D d'une tenue pour la boutique de vêtements (0.12): une petite scène à part, le
   * personnage seul. `null` avant `load` ou sans modèle des personnages.
   */
  createOutfitPreview?(options: OutfitPreviewOptions): OutfitPreview | null;
  dispose(): void;
}

/** Ce que montre l'aperçu: un joueur (peau par défaut, coiffure, barbe) et la tenue essayée. */
export interface OutfitPreviewLook {
  character: CharacterId;
  /** L'apparence du personnage, `wear` remplacé par la tenue essayée (identifiants de `vetements.json`). */
  appearance: DeepReadonly<Pick<Appearance, 'hair' | 'hairColor' | 'beard' | 'wear' | 'scarf'>>;
}

export interface OutfitPreviewOptions {
  /** Taille du canevas en points CSS (les pixels suivent l'écran, rapport 2 au plus). */
  width: number;
  height: number;
  /** Fond uni (CSS `#rrggbb`); par défaut le papier des panneaux. */
  background?: string;
}

/**
 * Aperçu 3D (boutique de vêtements): son propre canevas, à placer dans le panneau. Rendu à la
 * demande (changement de tenue, rotation, taille), jamais à chaque image: rien ne coûte tant que
 * rien ne bouge. Un seul aperçu à la fois; le créer à l'ouverture du panneau, `dispose` à la fermeture.
 */
export interface OutfitPreview {
  readonly canvas: HTMLCanvasElement;
  /** Montre ce personnage dans cette tenue (redessiné seulement si quelque chose change). */
  show(look: OutfitPreviewLook): void;
  /** Tourne le personnage autour de la verticale (radians; positif: vers la gauche de l'écran). A et E, glisser de la souris. */
  rotate(radians: number): void;
  /** Angle absolu (radians, 0: de face). */
  setAngle(radians: number): void;
  /** Nouvelle taille en points CSS. */
  resize(width: number, height: number): void;
  /** Libère le contexte WebGL de l'aperçu et ses ressources (pas celles du jeu). */
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
  /** Sons de l'interface (`ui-confirm`, `ui-focus`...): joués par l'audio du jeu, bus interface, non placés (facultatif). */
  sound?: (id: string) => void;
  /** 0.12: aperçu 3D d'une tenue pour la boutique (`Renderer.createOutfitPreview`), `null` sans rendu 3D (facultatif). */
  outfitPreview?: (options: OutfitPreviewOptions) => OutfitPreview | null;
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
  /** 0.13: l'aperçu du cordeau (pastille du tracé, anneau de maintien, raison du refus); `null`: aucun. */
  setPlotPreview?(preview: PlotPreview | null): void;
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
  /** Son d'interface demandé par l'interface (`InterfaceOptions.sound`), facultatif. */
  ui?(id: string): void;
  dispose(): void;
}

export type CreateAudio = (options: AudioOptions) => GameAudio;
