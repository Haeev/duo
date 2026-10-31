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
  /** Quarts de tour (0 à 3). */
  rotation: number;
  /** Emprise au sol, pour le rendu (la collision est dans `blocked`). */
  rect: Rect | null;
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
