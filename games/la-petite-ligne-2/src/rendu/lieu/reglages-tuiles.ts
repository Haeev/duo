/**
 * Réglages du rendu par tuiles des grands lieux (ADR 0022, technique 3.2.1 et 3.10). Valeurs de
 * rendu seulement: couleurs, hauteurs, densités du décor provisoire, anneau de chargement et
 * budgets. Les noms de terrain sont ceux de la légende des cartes (`terrain.legend`), pas des
 * contenus.
 */

/** Ce qu'on entend sous ses pas (son des pas, lot audio). */
export type SurfaceKind = 'herbe' | 'terre' | 'pave' | 'sable' | 'eau' | 'bois' | 'gravier';

/** Rendu d'une nature de terrain: couleur du sol, surface entendue, eau ou non. */
export interface GroundLook {
  readonly color: string;
  readonly surface: SurfaceKind;
  /** Rien n'est dessiné (annexe des intérieurs, posés à part). */
  readonly hidden?: boolean;
  /** Case d'eau: surface animée à `waterLevel`, berges verticales autour. */
  readonly water?: boolean;
  /** Bord assombri là où elle touche une autre nature (bas-côté d'un chemin). */
  readonly verge?: number;
}

/**
 * Natures dessinées. Les clés `pre`, `cour`, `labour` et `greve` ne viennent pas de la légende:
 * le rendu les déduit (parcelles selon leur taille, bord de l'eau), voir `terrain-rendu.ts`.
 */
export const GROUND_LOOKS: Readonly<Record<string, GroundLook>> = {
  'hors-jeu': { color: '#6f8f4e', surface: 'herbe' },
  herbe: { color: '#8fae5b', surface: 'herbe' },
  pre: { color: '#a3b865', surface: 'herbe' },
  cour: { color: '#c9b48c', surface: 'terre' },
  labour: { color: '#9a7b55', surface: 'terre' },
  champ: { color: '#c9b48c', surface: 'terre' },
  route: { color: '#a19a8e', surface: 'pave', verge: 0.82 },
  rue: { color: '#bfae92', surface: 'pave', verge: 0.86 },
  chemin: { color: '#c7a676', surface: 'terre', verge: 0.9 },
  sentier: { color: '#b4a06c', surface: 'terre', verge: 0.94 },
  voie: { color: '#857c72', surface: 'gravier' },
  ouvrage: { color: '#8a6748', surface: 'bois' },
  eau: { color: '#4d8aa0', surface: 'eau', water: true },
  batiment: { color: '#a59b8c', surface: 'pave' },
  quai: { color: '#cfc4b0', surface: 'pave' },
  lisiere: { color: '#7d9c52', surface: 'herbe' },
  greve: { color: '#d8c79a', surface: 'sable' },
  annexe: { color: '#000000', surface: 'pave', hidden: true },
};

/** Repli pour une nature inconnue de la table. */
export const DEFAULT_LOOK: GroundLook = { color: '#8fae5b', surface: 'herbe' };

export const TILE_SETTINGS = {
  ring: {
    /** Chargement: tuiles qui touchent le disque de rayon (rayon de vue + `loadMargin`). */
    loadMargin: 8,
    /** Déchargement au-delà de (rayon de vue + `unloadMargin`): hystérésis. */
    unloadMargin: 32,
    /** Temps de construction par image (ms), sauf pour une tuile déjà dans la vue (trou à l'écran). */
    buildMsPerFrame: 4,
    /** Ombres portées seulement par les tuiles à moins de (rayon de vue + `shadowMargin`). */
    shadowMargin: 4,
  },
  budget: {
    /** Par tuile (technique 3.10): triangles du décor et du terrain, appels par passe. */
    tileTriangles: 50_000,
    tileCalls: 12,
  },
  ground: {
    /** Variation douce de la couleur du sol (part), sans casser les bords entre natures. */
    noise: 0.07,
    /** Niveau de l'eau sous le sol (m) et teinte des berges. */
    waterLevel: -0.16,
    bankDepth: 0.45,
    bankColor: '#6e5a42',
    /** Pièces d'eau d'au moins ce nombre de cases dans une parcelle: labour (cultures en rangs). */
    fieldMinCells: 1000,
    /** En dessous: cour de terre battue (place, cour, jardin); entre les deux: pré. */
    yardMaxCells: 300,
    /** Grève: herbe à une case de l'eau. */
    shoreCells: 1,
  },
  rail: {
    /** Classes d'arêtes du graphe qui suivent une voie ferrée. */
    kinds: ['voie', 'interieur'],
    halfGauge: 0.72,
    railWidth: 0.08,
    railHeight: 0.14,
    railColor: '#6b6865',
    sleeperStep: 0.65,
    sleeper: { w: 2.5, h: 0.12, d: 0.24 },
    sleeperColor: '#5b4634',
    /** Longueur d'un morceau de rail rangé dans une tuile (m). */
    pieceLength: 2,
  },
  decor: {
    /** Distance (cases) au chemin, au bâtiment ou à l'eau au-delà de laquelle le bois s'épaissit. */
    wildStart: 3,
    wildFull: 11,
    /** Arbres par case: isolés près du bourg, bois loin des chemins, forêt hors des zones. */
    treeSparse: 0.006,
    treeWild: 0.09,
    treeOutside: 0.16,
    /** Buissons près des chemins (part des cases d'herbe à 1 à 4 cases d'un chemin). */
    bushNear: 0.035,
    trunkColor: '#6e5440',
    crownColors: ['#5f8a4a', '#6c9650', '#557d45', '#7b9f57'],
    bushColor: '#6a9150',
    cropColor: '#9fb35a',
    /** Haie d'une lisière (m), talus au bord de l'eau, clôture le long de la voie. */
    hedgeHeight: 1.45,
    hedgeColor: '#4f7a3f',
    bankHeight: 0.7,
    bankColor: '#7f8c4f',
    fenceHeight: 1.1,
    fenceColor: '#8a7058',
  },
  building: {
    /** Hauteur des murs: base, plus une part du petit côté, bornée (m). */
    wallBase: 2.6,
    wallPerMeter: 0.25,
    wallMax: 7,
    wallThickness: 0.3,
    /** Toit à deux pans sur le grand côté: faîtage en part du petit côté, débord (m). */
    ridgeShare: 0.42,
    ridgeMax: 4,
    overhang: 0.35,
    wallColors: ['#e8dcc2', '#dccaa4', '#cfc2ab', '#e6d3b3', '#d7c7b6'],
    roofColors: ['#b3624a', '#9c5843', '#6f6f78', '#a46a50'],
    door: { width: 1.2, height: 2.1, color: '#5e4330', stepColor: '#9d958a' },
    window: { width: 0.8, height: 0.9, sill: 1.1, spacing: 2.6, color: '#3c4a5a' },
    /** Lueur des fenêtres et de la lampe de porte la nuit. */
    glowColor: '#ffc27a',
    glowNight: 1.4,
    lamp: { size: 0.22, color: '#f0e2b8' },
    /** Plateforme sans mur (le quai): dalle basse. */
    platformHeight: 0.12,
    platformEdgeColor: '#ece6d6',
  },
  landmark: {
    /** Repère dans un lieu sauvage (loin des chemins): un grand arbre; sinon une tour. */
    treeWildCells: 4,
    towerColor: '#d2c4a6',
    towerRoofColor: '#7c5a4a',
  },
  far: {
    /** Niveau de détail des tuiles non chargées: une case de `cell` m, couleur majoritaire. */
    cell: 4,
    /** Assombrissement du sol lointain là où le bois est dense. */
    woodShade: 0.72,
  },
  fog: {
    /** Brume légère au bord du champ: début et fin, en multiples de la demi-hauteur de vue au sol. */
    start: 0.9,
    end: 6,
  },
  water: {
    color: '#4f8fa8',
    roughness: 0.22,
    /** Ondulation de la surface: force et vitesse. */
    ripple: 0.09,
    speed: 1.2,
  },
} as const;

export type TileSettings = typeof TILE_SETTINGS;
