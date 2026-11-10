/**
 * Réglages du rendu encré (ADR 0023): tout ce qui se règle sans toucher aux nuanceurs. Un seul
 * niveau de rendu pour le Mac et le PC: aucune de ces valeurs ne dépend de la machine. Les
 * ambiances (tons, encre, lampes, vignette) sont des données: `ambiances.json`.
 */
import type { SurfaceKind } from '../lieu/reglages-tuiles';
import type { LayerName } from './couches';

/** Style du rendu: `encre` (défaut) ou l'ancien rendu en aplats, gardé le temps de la transition. */
export type RenderStyle = 'encre' | 'aplats';

/** Règle de conversion d'un modèle livré: une teinte (degrés) et une saturation donnent une couche. */
export interface LayerRule {
  /** Teinte de 0 à 360 (intervalle fermé; `from` > `to` passe par 360). */
  readonly hue: readonly [number, number];
  /** Saturation minimale (0 à 1) et clarté maximale (0 à 1) pour que la règle s'applique. */
  readonly minSaturation: number;
  readonly maxLightness: number;
  readonly layer: LayerName;
  /** Feuillage: l'ombre se dentelle, le dessous se noircit, le vent le fait frémir. */
  readonly leafy?: boolean;
}

export const INK_SETTINGS = {
  /** Style au démarrage; `?rendu=aplats` dans l'adresse du jeu, ou `RenderOptions.style`. */
  style: 'encre' as RenderStyle,

  /** Paramètre d'adresse qui force un style (recette, comparaison). */
  styleParam: 'rendu',

  /**
   * Caméra du style encré (règle du client): 50 degrés de plongée au zoom de jeu et au-delà, la
   * caméra s'abaisse en zoomant plus près (les visages se voient), zoom de jeu de 18 m de large.
   */
  camera: {
    minWidth: 6,
    maxWidth: 28,
    defaultWidth: 18,
    pitchFarDeg: 50,
    pitchNearDeg: 35,
    /** Largeur à partir de laquelle la plongée est entière (m). */
    pitchFullWidth: 18,
  },

  /** Passe de contour: demi-épaisseur du trait en points d'écran à 768 points de haut. */
  outline: {
    radius: 1.55,
    referenceHeight: 768,
    /** Le trait épaissit en zoomant: facteur `zoomWidth / largeur de vue`, borné. */
    zoomWidth: 18,
    zoomRange: [0.75, 1.7] as const,
    /** Tremblé du trait, en part de son épaisseur. */
    wobble: 0.7,
    /** Un rang de trait apparaît quand ce qu'il cerne dépasse `fadeFrom` points, plein à `fadeTo`. */
    fadeFrom: 12,
    fadeTo: 28,
    /** Taille représentative de chaque rang (m): de la maison au bouton de porte. */
    rankMetres: [4, 1.6, 0.6, 0.25, 0.14] as const,
  },

  /**
   * Détail selon le zoom, en points d'écran par mètre: nul sous `from`, plein à `to`. Trait peint
   * des textures, hachures et gravillons, plis des personnages.
   */
  detail: {
    painted: { from: 45, to: 85 },
    hatch: { from: 30, to: 70 },
    face: { from: 34, to: 80 },
  },

  /** Ombre du soleil: une carte de profondeur cadrée sur la vue, calée sur ses texels. */
  sunShadow: {
    size: 2048,
    /** Recul de la caméra d'ombre (m), plans de coupe, marge autour du cercle vu (m). */
    distance: 90,
    near: 10,
    far: 170,
    margin: 6,
    /** Rayon maximal couvert (m): au-delà (vue haute de contrôle), l'ombre s'arrête au cadre. */
    maxRadius: 34,
  },

  /** Ombre de la lampe la plus proche du joueur local: une seule carte en cône. */
  lampShadow: { size: 512, fovDeg: 130, near: 0.28 },

  /** Lampes et fenêtres retenues autour du point visé (les plus proches), et portée de recherche (m). */
  lights: { reach: 26, lampRadius: 5.2, lampHeightShare: 0.86, windowReach: 3.4 },

  /**
   * Lampes des modèles livrés, par famille du manifeste des décors: hauteur du foyer en part de la
   * hauteur du modèle, rayon de la flaque (m). Une famille absente n'éclaire pas.
   */
  lampFamilies: {
    reverbere: { heightShare: 0.86, radius: 5.2, shadow: true },
    lampe: { heightShare: 0.82, radius: 3.6, shadow: true },
    applique: { heightShare: 0.92, radius: 3.4, shadow: false },
  } as Readonly<Record<string, { heightShare: number; radius: number; shadow: boolean }>>,

  /** Sol: couche de traits par surface entendue, et sols « durs » dont le bord reste droit. */
  ground: {
    layers: {
      herbe: 'grass',
      terre: 'dirt',
      pave: 'slab',
      gravier: 'ballast',
      bois: 'wood',
      sable: 'dirt',
      eau: 'plain',
      tapis: 'plain',
    } as Readonly<Record<SurfaceKind, LayerName>>,
    /**
     * Surfaces au motif serré: leur couche de traits est lue `fineScale` fois plus petite (une
     * dalle de quai fait 0,6 à 0,9 m, pas 2 m).
     */
    fine: ['pave'] as readonly SurfaceKind[],
    fineScale: 2.3,
    /** Surfaces posées par l'homme: leur bord n'ondule pas. */
    hard: ['pave', 'bois', 'tapis'] as readonly SurfaceKind[],
    /** La table (sol hors des tuiles, plancher des pièces) passe juste sous le sol des tuiles (m). */
    tableDrop: 0.012,
    /** Ondulation du bord entre deux natures de sol (m). */
    warp: 0.55,
    /** Sol d'un lieu sans terrain (lieux d'essai): un pré. */
    fallback: { color: '#A3B659', layer: 'grass' as LayerName },
    /** Écart des trois tons de l'herbe autour de sa teinte (clair, sombre). */
    grassTones: [1.09, 0.87] as const,
  },

  /** Eau: tons des bandes et vitesse des vaguelettes. */
  water: { light: 1.14, dark: 0.84, speed: 0.35 },

  /** Personnages: teintes poussées (1: inchangées) pour qu'ils se lisent de haut. */
  character: { saturation: 1.18, gain: 1.06 },

  /**
   * Conversion automatique des modèles livrés: la couche de traits d'un morceau se tire de sa
   * teinte moyenne (première règle qui convient, sinon `fallback`). Un nouvel objet en profite
   * sans une ligne de code.
   */
  models: {
    rules: [
      { hue: [70, 170], minSaturation: 0.18, maxLightness: 0.75, layer: 'leaf', leafy: true },
      { hue: [10, 50], minSaturation: 0.16, maxLightness: 0.62, layer: 'grain' },
      { hue: [0, 360], minSaturation: 0, maxLightness: 1, layer: 'face' },
    ] as readonly LayerRule[],
    fallback: 'plain' as LayerName,
    /** Écart en dessous duquel deux sommets sont le même point (m): les morceaux se comptent ainsi. */
    weld: 0.001,
    /** Au-delà de ce nombre de morceaux, les plus petits partagent un numéro (63 au plus). */
    maxParts: 62,
  },

  /**
   * Bâtiments livrés: couche de traits d'après le NOM du matériau du modèle (la teinte reste
   * celle des sommets). `window`: vitre (reflet du ciel le jour, lueur la nuit).
   */
  materials: {
    pierre: { layer: 'face' },
    moellon: { layer: 'slab' },
    crepi: { layer: 'wall' },
    tuile: { layer: 'roof' },
    bois: { layer: 'grain' },
    bardage: { layer: 'wood' },
    volet: { layer: 'grain' },
    vitre: { layer: 'plain', window: true },
    metal: { layer: 'plain' },
  } as Readonly<Record<string, { layer: LayerName; window?: boolean }>>,

  /** Particules de l'air (un appel instancié): nombre et emprise autour du point visé (m). */
  motes: { count: 90, span: 26 },

  /**
   * Souffle: quand le rendu est saturé (rendu logiciel des tests et du banc: plus de
   * `slowMs` entre deux images), on saute autant d'images que de `slowMs` perdus (`maxSkip` au plus). Les appels WebGL en
   * attente bloquent le fil principal; sans ces images sautées, minuteries et réseau n'ont plus
   * la main et le jeu passe pour bloqué. Jamais atteint sur une vraie carte graphique.
   */
  breath: { slowMs: 250, maxSkip: 12 },

  /**
   * Lieu clos qui déclare son ambiance (`ambience` de `lieu.json`): part de la teinte de ses
   * lampes ajoutée dans leur flaque, et force plancher de ses lampes (elles restent allumées).
   */
  placeLamps: { gain: 0.78, minimum: 0.9 },

  /** Durée du passage d'une ambiance à l'autre quand le joueur entre ou sort (s). */
  indoorFadeSeconds: 0.6,

  /**
   * Budgets du style encré par vue (ADR 0022, bible 4.6, technique 3.10), toutes passes comprises.
   * Mémoire: celle que le rendu encré ajoute au lieu (couches de traits, cartes d'ombre, cibles).
   */
  budget: { triangles: 350_000, calls: 200, programs: 14, textureMegabytes: 64 },
} as const;

export type InkSettings = typeof INK_SETTINGS;
