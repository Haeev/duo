/**
 * Un lieu est un dossier autonome: `donnees/lieux/<id>/` avec `lieu.json`, `carte.json`, et les
 * dossiers `habitants/`, `dialogues/`, `commerces/`, `quetes/`, `interieurs/`. La carte est une
 * grille de 1 m par case (x vers l'est, y vers le sud, rotation en quarts de tour, 0 façade au
 * sud). Un grand lieu (ADR 0022) garde une seule grille, jusqu'à 512 m de côté; il est produit
 * depuis le plan vu du dessus par `outils/plan-vers-lieu.ts` et porte en plus, facultatifs, le
 * terrain, les zones, les verrous d'histoire, le graphe des chemins, les repères, les points
 * d'intérêt et les bâtiments. Le rendu le découpe en tuiles de `TILE_SIZE` m.
 */
import * as v from 'valibot';
import {
  FileVersionSchema,
  FiniteSchema,
  IdSchema,
  IntSchema,
  LabelSchema,
  PointSchema,
  RectSchema,
  TextSchema,
} from './communs';
import { ConditionSchema } from './regles';

/** Côté maximal d'une carte, en cases de 1 m (ADR 0022; 128 avant les grands lieux). */
export const MAP_MAX_SIDE = 512;
/** Côté d'une tuile de rendu, en m (ADR 0022): le rendu ne garde que les tuiles proches du joueur local. */
export const TILE_SIZE = 32;
/** Côté maximal d'un intérieur, en cases (ADR 0022). */
export const INTERIOR_MAX_SIDE = 64;
/**
 * Meubles à briques posés par la carte d'un lieu, intérieurs compris (ADR 0022): leur état part
 * dans la tranche « lieu », dont ce plafond tient le budget (`tests/grands-lieux.test.ts`).
 */
export const PLACE_BRICK_OBJECTS_MAX = 400;
import { FishingSpotSchema } from './peche';
/** Écart maximal, en m, entre deux meubles d'un même groupe (une table et ses chaises tiennent dans une pièce). */
export const GROUP_MAX_SPAN = 6;
/** Objets posés au sol que la carte déclare, par carte (le sol du lieu en garde 80 au plus). */
export const MAP_GROUND_MAX = 40;

export const PlaceSchema = v.strictObject({
  schema: FileVersionSchema,
  id: IdSchema,
  name: LabelSchema,
  station: v.strictObject({
    /** Point de la carte où les deux joueurs descendent du train. */
    arrival: IdSchema,
    /** Point du quai: il faut y être tous les deux pour monter. */
    platform: IdSchema,
    /** Rayon du quai autour de ce point (m). */
    platformRadius: v.pipe(FiniteSchema, v.minValue(1), v.maxValue(10)),
  }),
  /** Lieux reliés par le rail (le lien doit être écrit des deux côtés). */
  links: v.array(IdSchema),
  /** Activités offertes ici (réponse 28: selon le lieu). */
  activities: v.array(IdSchema),
  /** Musiques du lieu, de jour et de nuit (`assets/lieux/<id>/son/`), `null` tant qu'elles ne sont pas livrées. */
  music: v.nullable(v.strictObject({ day: IdSchema, night: IdSchema })),
  /** Coins de pêche du lieu (`schemas/peche.ts`). */
  fishing: v.exactOptional(v.pipe(v.array(FishingSpotSchema), v.maxLength(12))),
  /** Note de placement: pourquoi ce lieu est là et fait ce qu'il fait. Ignorée du moteur (`donnees/pourquoi.ts`). */
  pourquoi: v.exactOptional(TextSchema),
});
export type PlaceDef = v.InferOutput<typeof PlaceSchema>;

const QuarterSchema = v.picklist([0, 1, 2, 3]);

/**
 * Un meuble ou un élément du décor posé sur la carte par le level designer. Ce qu'il fait vient
 * de son type (`commun/meubles/<type>.json` et ses briques). Règle de ressenti: il n'existe pas
 * de zone d'action sans objet visible.
 */
export const MapObjectSchema = v.strictObject({
  id: IdSchema,
  type: IdSchema,
  /** Centre de l'emprise (m). */
  x: FiniteSchema,
  y: FiniteSchema,
  /** Quarts de tour: 0 façade au sud, 1 à l'est, 2 au nord, 3 à l'ouest. */
  rotation: QuarterSchema,
  /**
   * Ensemble de meubles: tous les meubles de la carte qui portent le même nom forment un seul
   * ensemble pour le repas à deux (une table et ses chaises: les deux joueurs peuvent être assis
   * sur deux meubles différents du groupe). Un groupe a deux meubles au moins, dont un à brique
   * `sit`, tous à `GROUP_MAX_SPAN` m au plus l'un de l'autre.
   */
  group: v.exactOptional(IdSchema),
  /** Note de placement: pourquoi cet élément est ici, dans ce sens (règle « cohérence du monde »). Ignorée du moteur. */
  pourquoi: v.exactOptional(TextSchema),
});
export type MapObject = v.InferOutput<typeof MapObjectSchema>;

/**
 * Objet ramassable posé au sol par la carte, à une position (une pomme tombée, un sac oublié).
 * Il apparaît à la première visite du lieu; avec `respawnDaily`, il revient chaque matin s'il a
 * été ramassé. Sans `respawnDaily`, une fois ramassé, il ne revient pas.
 */
export const MapGroundSchema = v.strictObject({
  id: IdSchema,
  /** Objet (`commun/objets/<id>.json`); un sac se trouve ainsi. */
  item: IdSchema,
  count: v.pipe(IntSchema, v.minValue(1), v.maxValue(99)),
  x: FiniteSchema,
  y: FiniteSchema,
  respawnDaily: v.exactOptional(v.boolean()),
  /** Note de placement: pourquoi cet objet est ici. Ignorée du moteur. */
  pourquoi: v.exactOptional(TextSchema),
});
export type MapGround = v.InferOutput<typeof MapGroundSchema>;

/**
 * Terrain d'affichage, case par case, en plages (`runs`: code, longueur, code, longueur...) lues
 * ligne après ligne depuis le coin nord-ouest. Il ne bloque rien: les collisions sont dans
 * `blocked`. Le rendu en tire le sol, les berges, les talus (`decodeTerrain` de `donnees/carte.ts`).
 */
export const TerrainSchema = v.strictObject({
  /** Nature de chaque code (`herbe`, `eau`, `route`...): le rendu associe un matériau à chacune. */
  legend: v.pipe(v.array(IdSchema), v.minLength(1), v.maxLength(64)),
  runs: v.array(v.pipe(IntSchema, v.minValue(0))),
});
export type TerrainDef = v.InferOutput<typeof TerrainSchema>;

const PolygonSchema = v.pipe(
  v.array(v.tuple([FiniteSchema, FiniteSchema])),
  v.minLength(3),
  v.maxLength(256),
);

/** Zone du lieu: nom sur la carte du carnet, musique et ambiance, acte d'ouverture. */
export const ZoneSchema = v.strictObject({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
  /** Acte où l'histoire l'ouvre (1 au départ). C'est un verrou qui l'ouvre, jamais un mur invisible. */
  act: v.pipe(IntSchema, v.minValue(1), v.maxValue(9)),
  polygon: PolygonSchema,
});
export type ZoneDef = v.InferOutput<typeof ZoneSchema>;

/**
 * Verrou d'histoire: un passage fermé par un obstacle visible (`object`, `null` tant que le décor
 * n'est pas posé) qui s'ouvre quand toutes les conditions `opens` sont vraies (d'ordinaire un fait
 * retenu, `remembered`). Fermé, ses rectangles bloquent comme un mur (un portail et un portillon
 * de la même clôture font un seul verrou); ouvert, il ne bloque plus. Son état se déduit de la
 * progression: il n'a pas d'état à lui, ni dans la sauvegarde ni sur le réseau.
 */
export const LockSchema = v.strictObject({
  rects: v.pipe(v.array(RectSchema), v.minLength(1), v.maxLength(8)),
  object: v.nullable(IdSchema),
  opens: v.pipe(v.array(ConditionSchema), v.minLength(1)),
  /** Ce que le joueur voit et ce qui le lève, pour le level designer et le game designer. */
  note: v.optional(TextSchema),
});
export type LockDef = v.InferOutput<typeof LockSchema>;

export const EDGE_KINDS = [
  'route',
  'rue',
  'chemin',
  'sentier',
  'voie',
  'interieur',
  'porte',
] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

/**
 * Graphe des chemins (celui du plan): les habitants y calculent leurs trajets longs, l'A* sur la
 * grille ne sert qu'entre deux nœuds proches. Une arête à verrou n'est passable qu'ouverte.
 */
export const PathGraphSchema = v.strictObject({
  nodes: v.record(IdSchema, PointSchema),
  edges: v.array(
    v.strictObject({
      a: IdSchema,
      b: IdSchema,
      kind: v.picklist(EDGE_KINDS),
      lock: v.nullable(IdSchema),
    }),
  ),
});
export type PathGraph = v.InferOutput<typeof PathGraphSchema>;

/** Repère visible de loin (clocher, château d'eau): le rendu le garde affiché à toute distance. */
export const LandmarkSchema = v.strictObject({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
  x: FiniteSchema,
  y: FiniteSchema,
  /** Hauteur (m). */
  height: v.pipe(FiniteSchema, v.minValue(0), v.maxValue(80)),
});

/** Point d'intérêt du plan (pêche, fouille, banc, service), rattaché à son nœud de chemin. */
export const InterestSchema = v.strictObject({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
  kind: IdSchema,
  node: IdSchema,
  x: FiniteSchema,
  y: FiniteSchema,
});

/** Bâtiment du plan: emprise, porte sur un mur (`null`: plateforme sans mur), intérieur prévu. */
export const BuildingSchema = v.strictObject({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(80)),
  rect: v.strictObject({ x: FiniteSchema, y: FiniteSchema, w: FiniteSchema, h: FiniteSchema }),
  door: v.nullable(PointSchema),
  /** Identifiant de l'intérieur prévu (`interieurs/<id>.json`, livré plus tard), `null` sans intérieur. */
  interior: v.nullable(IdSchema),
});

/**
 * Porte qui relie deux grilles du même lieu (le dehors et un intérieur, ou deux intérieurs).
 * Entrer dans sa case mène à la porte `to`, tourné vers `facing`. Les portes vont par paires.
 */
export const DoorSchema = v.strictObject({
  x: FiniteSchema,
  y: FiniteSchema,
  facing: QuarterSchema,
  to: IdSchema,
});
export type DoorDef = v.InferOutput<typeof DoorSchema>;

const mapCore = {
  schema: FileVersionSchema,
  /** Zones où l'on ne marche pas (murs, eau, bâtiments). */
  blocked: v.array(RectSchema),
  points: v.record(IdSchema, PointSchema),
  objects: v.array(MapObjectSchema),
  /** Objets ramassables posés au sol (facultatif). */
  groundItems: v.exactOptional(v.pipe(v.array(MapGroundSchema), v.maxLength(MAP_GROUND_MAX))),
  doors: v.optional(v.record(IdSchema, DoorSchema)),
} as const;

export const MapSchema = v.strictObject({
  ...mapCore,
  /** Taille en cases de 1 m, intérieurs compris (ADR 0022: 512 au plus par côté). */
  width: v.pipe(IntSchema, v.minValue(8), v.maxValue(MAP_MAX_SIDE)),
  height: v.pipe(IntSchema, v.minValue(8), v.maxValue(MAP_MAX_SIDE)),
  /**
   * Le dehors. Les intérieurs se posent hors de ce rectangle, sur la même grille (ADR 0016, 0022).
   * Absent: toute la carte est le dehors.
   */
  outdoor: v.optional(RectSchema),
  terrain: v.optional(TerrainSchema),
  zones: v.optional(v.record(IdSchema, ZoneSchema)),
  locks: v.optional(v.record(IdSchema, LockSchema)),
  /** Graphe des chemins tiré du plan: les habitants marchent dessus (absent: A* sur la grille). */
  graph: v.optional(PathGraphSchema),
  landmarks: v.optional(v.record(IdSchema, LandmarkSchema)),
  interests: v.optional(v.record(IdSchema, InterestSchema)),
  buildings: v.optional(v.record(IdSchema, BuildingSchema)),
});
export type MapDef = v.InferOutput<typeof MapSchema>;

/**
 * Un intérieur (`lieux/<lieu>/interieurs/<id>.json`): une petite grille à lui, posée sur la grille
 * du lieu à `at`, hors du dehors. Le chargement l'y fusionne (murs, points, meubles, portes) et
 * l'entoure d'un mur: la simulation, le réseau et la sauvegarde ne voient qu'une grille.
 */
export const InteriorSchema = v.strictObject({
  ...mapCore,
  id: IdSchema,
  name: LabelSchema,
  width: v.pipe(IntSchema, v.minValue(2), v.maxValue(INTERIOR_MAX_SIDE)),
  height: v.pipe(IntSchema, v.minValue(2), v.maxValue(INTERIOR_MAX_SIDE)),
  /** Coin nord-ouest sur la grille du lieu, hors du dehors et à une case au moins de tout autre intérieur. */
  at: v.strictObject({ x: IntSchema, y: IntSchema }),
  /** Note de placement de la pièce (pourquoi ici, à cette taille). Ignorée du moteur. */
  pourquoi: v.exactOptional(TextSchema),
});
export type InteriorDef = v.InferOutput<typeof InteriorSchema>;
