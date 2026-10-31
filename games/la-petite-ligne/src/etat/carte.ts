/**
 * Carte statique du bourg, telle que la simulation et le rendu la voient
 * (après lecture et contrôle de `donnees/cartes/` par `donnees/carte.ts`).
 * Elle ne change jamais pendant la partie et ne passe pas sur le réseau:
 * chaque machine la lit dans ses propres fichiers.
 */
import type { Cell, PointId, Vec2 } from './types';

export type GroundKind =
  | 'grass'
  | 'path'
  | 'dirt'
  | 'gravel'
  | 'wood'
  | 'floor'
  | 'water'
  | 'rail'
  | 'stone';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapTree {
  id: string;
  kind: 'oak' | 'fir';
  pos: Vec2;
}

/** Bâtiment ou décor fixe, placé par le level designer. */
export interface MapProp {
  id: string;
  /** Nom du modèle (`assets/modeles/`), libre pour le rendu. */
  model: string;
  pos: Vec2;
  /** Quarts de tour (0 à 3): 0 façade au sud, 1 à l'est, 2 au nord, 3 à l'ouest (convention de la carte). */
  rotation: number;
  /** Emprise au sol, pour le rendu (la collision est dans `blocked`). */
  rect: Rect | null;
  /** Hauteur du modèle en mètres (`hauteur` du type dans la carte), 0 si inconnue. */
  height: number;
  /** Catégorie du type (`batiment`, `sol`, `equipement`, `mobilier`, `decor`, `arbre`), `decor` si inconnue. */
  category: string;
}

/**
 * Petit objet accroché à un objet de la carte (`accroches` de la carte: nichoir, chicot, pieu): sans
 * emprise ni collision, posé par le rendu sur son support.
 */
export interface MapHook {
  id: string;
  model: string;
  /** Objet qui le porte (`tree_oak_01`, `pontoon`). */
  on: string;
  /** Point d'attache (m): x, y sur la carte, z au-dessus du sol. */
  pos: { x: number; y: number; z: number };
  /** Quarts de tour, comme les objets (0 tourné vers le sud). */
  rotation: number;
  /** Penché au départ (degrés), le nichoir de travers; 0 sinon. */
  tiltDeg: number;
}

export interface GameMap {
  id: string;
  name: string;
  /** Taille en cases (1 m). */
  width: number;
  height: number;
  /** Nature du sol de chaque case, ligne par ligne: index = cy * width + cx. */
  ground: GroundKind[];
  /** Case infranchissable (murs, eau profonde, bâtiments, arbres debout). */
  blocked: boolean[];
  /** Points nommés (rendez-vous, comptoirs, emplois du temps). */
  points: Record<PointId, Vec2>;
  /**
   * Où regarde celui qui se tient à un point (`facing` de la simulation: radians, 0 vers l'est,
   * sens horaire vu du dessus), pour les points qui le disent (`cap_degres`: places de l'échelle).
   */
  pointFacings: Record<PointId, number>;
  /** Petits objets accrochés (nichoir, chicot, pieu), dessinés par le rendu des moments. */
  hooks: MapHook[];
  /** Zones nommées (`garden`, `forest_edge`, `quay`, `square`, `river`...). */
  zones: Record<string, Rect>;
  house: {
    /** Pièce jouable de la maisonnette (5x4 cases). */
    room: Rect;
    /** Case de la porte (franchissable). */
    door: Cell;
    /** Où l'on réapparaît au retour de minuit. */
    spawn: Vec2;
  };
  /** Les 12 cases du potager, dans l'ordre des index. */
  garden: Cell[];
  trees: MapTree[];
  props: MapProp[];
  /** Meubles déjà posés au début (paillasses, coffre, réchaud): coin nord-ouest et quarts de tour. */
  startFurniture: { item: string; cell: Cell; rotation: number }[];
}

/** Index d'une case dans les tableaux `ground` et `blocked`. */
export function cellIndex(map: GameMap, cx: number, cy: number): number {
  return cy * map.width + cx;
}

/** Vrai si la case est dans la carte. */
export function inMap(map: GameMap, cx: number, cy: number): boolean {
  return cx >= 0 && cy >= 0 && cx < map.width && cy < map.height;
}

/** Vrai si le point est dans le rectangle. */
export function inRect(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}
