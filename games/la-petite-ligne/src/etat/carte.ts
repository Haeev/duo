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
export interface MapImprovement extends MapProp {
  /** Cases occupées une fois bâti (vide: sans emprise au sol). */
  cells: Cell[];
}

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
  /** Échelle du modèle (le pieu allongé jusqu'au lit de la rivière), 1 sinon. */
  scale: number;
}

/**
 * Bâtiment visitable (ADR 0016): `interieurs[].id` de la carte. Une chaîne et non une liste fermée:
 * ajouter un intérieur ne demande que des données. Ceux de la carte du tour 10: `house`
 * (la maisonnette), `grocery` (l'épicerie-pension d'Odette), `salon` (la mercerie-coiffure de Solange).
 */
export type BuildingId = string;

/** La maisonnette des joueurs, toujours présente (« chez soi »: aménagement, coucher, minuit). */
export const HOUSE_BUILDING: BuildingId = 'house';

/** Côté d'un mur ou d'une fenêtre (convention de la carte: `nord`, `est`, `sud`, `ouest`). */
export type WallSide = 'north' | 'east' | 'south' | 'west';

/** Ce qu'il faut savoir d'une pièce à bâtir (tour 10, section 4: cellier et chambre). */
export interface MapRoomBuild {
  /** Identifiant de la pièce dans `donnees/pieces.json` (`room_cellar`, `room_bedroom`), clé de `WorldState.rooms`. */
  room: string;
  /** Emprise du chantier, murs compris, sans le mur commun (bloquée une fois bâtie, sauf la pièce et sa porte). */
  footprint: Rect;
  /** Mur partagé avec la pièce d'où l'on entre. */
  sharedWall: WallSide;
  /** Porte percée à la place d'une fenêtre, et la pièce d'où l'on entre. */
  door: { cell: Cell; from: string };
  /** Point du chantier (panneau et caisse). */
  site: PointId;
  /** Places des étagères hautes (cellier), vide sinon. */
  shelves: Rect[];
  /** Fenêtres de la pièce une fois bâtie (chambre), vide sinon. */
  windows: WallSide[];
}

/** Une pièce d'un bâtiment visitable: rectangle de cases franchissables, dans l'emprise. */
export interface MapRoom {
  id: string;
  /** Nom lisible (documentation de la carte, pas un texte du jeu). */
  name: string;
  rect: Rect;
  /** Pièce à bâtir, comptée seulement une fois bâtie; `null`: toujours là. */
  build: MapRoomBuild | null;
}

/** Porte d'un bâtiment visitable, sur son pourtour. */
export interface MapDoor {
  id: string;
  /** Case de la porte (franchissable, sauf porte fermée par la couche dynamique, lot L3). */
  cell: Cell;
  /** Case libre du dehors, juste devant. */
  outside: Cell;
  /** Point de la carte devant la porte (`house_door`, `grocery_door`, `salon_door`). */
  point: PointId;
}

/** Mobilier fixe d'un intérieur (comptoir, fauteuil, banc d'attente): cases déjà bloquées dans `blocked`. */
export interface MapFixture {
  id: string;
  cells: Cell[];
  rotation: number;
}

export interface MapBuilding {
  id: BuildingId;
  /** Objet de la carte qui le porte (`gatekeeper_house`, `ferrand_shop`, `salon_shop`). */
  prop: string;
  name: string;
  /** Pièces, la principale en premier; les pièces à bâtir à la suite. */
  rooms: MapRoom[];
  /** Parties où l'on n'entre pas (salle à manger de la pension), pour le rendu. */
  closedParts: { id: string; rect: Rect }[];
  /** Au moins une porte. */
  doors: MapDoor[];
  /** Point d'apparition dedans (retour de minuit pour la maisonnette), dans une pièce toujours là. */
  spawn: Vec2;
  spawnPoint: PointId;
  /** Clé de premier niveau de `reglages.json` qui donne les heures (`grocer`, `salon`); `null`: toujours ouvert. */
  hours: string | null;
  /** Ambiance sonore de l'intérieur (`room-tone-shop`, `room-tone-salon`); `null`: aucune. */
  ambience: string | null;
  fixtures: MapFixture[];
}

/** Le lit du ru de la Côte (tour 10): colonnes d'eau vive, du nord au sud. */
export interface MapStream {
  columns: number[];
  fromY: number;
  toY: number;
}

export type CrossingKind = 'culvert' | 'bridge' | 'footbridge' | 'ford';

/** Passage sur le ru (ponceau, pont, passerelle, gué de pierres), posé par le rendu. */
export interface MapCrossing {
  id: string;
  kind: CrossingKind;
  /** Ce qu'il franchit (`ru`). */
  crosses: string;
  rect: Rect;
  model: string;
  /** Largeur utile en mètres, `null` si la carte ne la donne pas. */
  widthM: number | null;
}

export interface GameMap {
  id: string;
  name: string;
  /**
   * Première case de la grille (`taille.origine`, 0.13): les cases vont de `originX` à
   * `originX + width - 1`. Les coordonnées du monde ne dépendent pas de l'origine.
   */
  originX: number;
  originY: number;
  /** Taille en cases (1 m). */
  width: number;
  height: number;
  /** Nature du sol de chaque case, ligne par ligne, rangée par `cellIndex`. */
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
  /**
   * Bâtiments visitables (ADR 0016), par identifiant; `house` toujours présent. Intérieurs sur la
   * carte, à leur place: aucune géométrie ne passe sur le réseau.
   */
  buildings: Record<BuildingId, MapBuilding>;
  /** Le ru de la Côte, `null` sur une carte qui n'en a pas (carte de secours). */
  stream: MapStream | null;
  /** Passages du ru (`ouvrages`), vide sans ru. */
  crossings: MapCrossing[];
  /**
   * La maisonnette, lue depuis `buildings.house` (pièce principale, première porte, apparition),
   * gardée le temps de migrer ses lecteurs (lot L3).
   */
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
  /**
   * Sièges sans modèle (tour 9: le bord du ponton): des bancs où s'asseoir, sans objet dessiné ni
   * emprise. Absent: aucun.
   */
  seats?: MapProp[];
  /**
   * Chantiers (tour 9), par identifiant de `chantiers.json`: le modèle posé une fois bâti, sa place,
   * ses cases (qui bloquent alors le passage). Rien n'est posé ni bloqué avant. Absent: aucun.
   */
  improvements?: Record<string, MapImprovement>;
  /**
   * Coins de pêche (0.12, `peche.coins` de la carte): chaque case d'eau dans un seul coin. Absent
   * ou vide (carte de secours): pas d'ombres, la pêche tire comme avant dans les poissons du gué.
   */
  fishingZones?: FishingZone[];
}

/** Coin de pêche: identifiant, nom (« le gué »), forme après « à » (« au gué »), rectangles de cases. */
export interface FishingZone {
  id: string;
  name: string;
  at: string;
  rects: Rect[];
}

/** Ce que les fonctions de la grille lisent de la carte (la carte elle-même, ou un cadre de lecture). */
export interface GridFrame {
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Index d'une case dans les tableaux `ground` et `blocked` (et toute couche de la taille de la
 * grille). Seul calcul d'indice de la grille: aucun autre module ne multiplie par `width`.
 */
export function cellIndex(map: GridFrame, cx: number, cy: number): number {
  return (cy - map.originY) * map.width + (cx - map.originX);
}

/** Abscisse de la case d'index `index` (inverse de `cellIndex`). */
export function cellX(map: GridFrame, index: number): number {
  return (index % map.width) + map.originX;
}

/** Ordonnée de la case d'index `index` (inverse de `cellIndex`). */
export function cellY(map: GridFrame, index: number): number {
  return Math.floor(index / map.width) + map.originY;
}

/** Bornes de la grille en cases: `minX` à `maxX` compris (de même en y). */
export function mapMinX(map: GridFrame): number {
  return map.originX;
}
export function mapMaxX(map: GridFrame): number {
  return map.originX + map.width - 1;
}
export function mapMinY(map: GridFrame): number {
  return map.originY;
}
export function mapMaxY(map: GridFrame): number {
  return map.originY + map.height - 1;
}

/** Vrai si la case est dans la carte (`minX..maxX`, `minY..maxY`). */
export function inMap(map: GridFrame, cx: number, cy: number): boolean {
  return cx >= map.originX && cy >= map.originY && cx < map.originX + map.width && cy < map.originY + map.height;
}

/** Sol de la case, `undefined` hors de la carte. */
export function groundAt(map: GameMap, cx: number, cy: number): GroundKind | undefined {
  return inMap(map, cx, cy) ? map.ground[cellIndex(map, cx, cy)] : undefined;
}

/** Centre de la carte en mètres (caméra d'attente, repères par défaut). */
export function mapCentre(map: GridFrame): Vec2 {
  return { x: map.originX + map.width / 2, y: map.originY + map.height / 2 };
}

/**
 * Point sûrement hors de la carte, quelle que soit son origine: là où vont les habitants
 * « chez eux » (`offstage`), loin de toute case.
 */
export function offstagePoint(map: GridFrame): Vec2 {
  return { x: map.originX - 20, y: map.originY - 20 };
}

/** Vrai si le point est dans le rectangle. */
export function inRect(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}

/**
 * Bâtiment visitable dont une pièce contient le point, ou `null` dehors. Une pièce à bâtir ne compte
 * qu'une fois bâtie (`rooms`: `WorldState.rooms`). Une dizaine de rectangles, sans allocation.
 */
export function buildingAt(
  map: GameMap,
  rooms: Readonly<Record<string, { readonly builtDay: number | null } | undefined>>,
  x: number,
  y: number,
): BuildingId | null {
  for (const id in map.buildings) {
    const b = map.buildings[id];
    if (b === undefined) continue;
    for (const room of b.rooms) {
      if (room.build !== null && (rooms[room.build.room]?.builtDay ?? null) === null) continue;
      if (inRect(room.rect, x, y)) return id;
    }
  }
  return null;
}
