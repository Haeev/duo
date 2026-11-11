/**
 * Réglages du rendu par tuiles des grands lieux (ADR 0022, technique 3.2.1 et 3.10). Valeurs de
 * rendu seulement: couleurs, hauteurs, densités du décor provisoire, anneau de chargement et
 * budgets. Les noms de terrain sont ceux de la légende des cartes (`terrain.legend`), pas des
 * contenus.
 */

/** Ce qu'on entend sous ses pas (son des pas, lot audio). */
export type SurfaceKind =
  'herbe' | 'terre' | 'pave' | 'sable' | 'eau' | 'bois' | 'gravier' | 'tapis';

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
  /**
   * Lames est-ouest (plancher): largeur d'une lame (m) et teinte d'une lame sur deux (part).
   * Dessinées sur le sol des petits lieux (`floor` de la carte, `sol.ts`).
   */
  readonly planks?: { readonly width: number; readonly shade: number };
  /**
   * Arbres semés (part des cases qui en portent un): `near` au bord de ce qui est aménagé, `wild`
   * à `decor.wildFull` cases et au-delà (le bois s'épaissit loin des chemins). `stumps`: part
   * des places tirées qui ne portent qu'une souche (modèle `stump` de l'essence). `bushes`:
   * buissons au bord des chemins. Absent: aucun arbre.
   */
  readonly trees?: {
    readonly near: number;
    readonly wild?: number;
    readonly stumps?: number;
    readonly bushes?: boolean;
  };
  /**
   * Hors du couloir de jeu (on ne s'y promène pas loin des sentiers): ses arbres prennent leur
   * version allégée à plus de `semis.light.beyond` cases d'une nature qui ne l'est pas, et le sol
   * lointain s'y assombrit comme un bois.
   */
  readonly outside?: boolean;
  /**
   * Ce qui couvre le sol (rendu encré), à la place du semis de sa surface: `litter` (feuilles
   * mortes: cailloux aplatis, par case), `tufts` (part des cases), `tuftSize` (largeur et
   * hauteur en multiples de la touffe d'herbe: une fougère est plus large que haute).
   */
  readonly cover?: {
    readonly litter?: number;
    readonly litterColors?: readonly string[];
    readonly tufts?: number;
    readonly tuftColors?: readonly string[];
    readonly tuftSize?: readonly [number, number];
  };
}

/**
 * Natures dessinées. Les clés `pre`, `cour`, `labour` et `greve` ne viennent pas de la légende:
 * le rendu les déduit (parcelles selon leur taille, bord de l'eau), voir `terrain-rendu.ts`.
 */
export const GROUND_LOOKS: Readonly<Record<string, GroundLook>> = {
  // Le bois hors des zones: forêt serrée où l'on ne va pas (arbres allégés loin du couloir).
  'hors-jeu': {
    color: '#6f8f4e',
    surface: 'herbe',
    trees: { near: 0.16 },
    outside: true,
  },
  herbe: { color: '#8fae5b', surface: 'herbe', trees: { near: 0.006, wild: 0.09, bushes: true } },
  pre: { color: '#a3b865', surface: 'herbe', trees: { near: 0.006 } },
  // Natures des zones du plan (section 15 de `plan.md`): densités d'arbres du tableau
  // « Végétation par zones » (arbres pour 100 m², soit des centièmes par case).
  // La Côte: bois de coteau, 4 arbres pour 100 m² en moyenne, plus clair au bord des sentiers et
  // des clairières; sol de feuilles mortes et de fougères, quelques souches. Hors des sentiers,
  // on n'y va pas: ses arbres s'allègent à distance du couloir comme ceux du bois hors jeu.
  'sous-bois': {
    color: '#71804a',
    surface: 'herbe',
    trees: { near: 0.03, wild: 0.075, stumps: 0.08, bushes: true },
    outside: true,
    cover: {
      litter: 0.7,
      litterColors: ['#9c6a3c', '#b07c45', '#86603a', '#a08a55'],
      tufts: 0.22,
      tuftColors: ['#566f37', '#5f7a3c', '#4d6a33'],
      tuftSize: [2.8, 0.9],
    },
  },
  // Le tunnel: friche rocheuse au-dessus de la ligne morte, pins et bouleaux épars (1,2 pour
  // 100 m²), herbe sèche entre les pierres.
  'friche-rocheuse': {
    color: '#a39b78',
    surface: 'gravier',
    trees: { near: 0.004, wild: 0.012, stumps: 0.15 },
    cover: { tufts: 0.22, tuftColors: ['#a49a5c', '#8f8f52', '#b3a66a'], tuftSize: [1.1, 0.8] },
  },
  // Le bourg: herbe rase des abords, tondue par les moutons et les passages (0,2 pour 100 m²).
  'herbe-rase': {
    color: '#9cb662',
    surface: 'herbe',
    trees: { near: 0.002 },
    cover: { tufts: 0.14, tuftColors: ['#8fa44e', '#9cb05a'], tuftSize: [1, 0.6] },
  },
  // Les talus de la voie et la clairière du poste: herbes hautes et ronces, sureaux épars.
  friche: {
    color: '#98a25c',
    surface: 'herbe',
    trees: { near: 0.003, wild: 0.006, bushes: true },
    cover: { tufts: 0.65, tuftColors: ['#8f9447', '#a3a052', '#74863f'], tuftSize: [1.3, 1.3] },
  },
  // La rivière: prairie humide, joncs et iris, une ripisylve (1,5 pour 100 m²).
  'prairie-humide': {
    color: '#7da464',
    surface: 'herbe',
    trees: { near: 0.01, wild: 0.02 },
    cover: { tufts: 0.7, tuftColors: ['#6f9a5a', '#86a862', '#5f8a55'], tuftSize: [0.9, 1.5] },
  },
  // La crête aux myrtilles: lande rase de bruyère et de myrtilliers, sans arbre (voulu).
  lande: {
    color: '#8f8067',
    surface: 'herbe',
    cover: { tufts: 0.6, tuftColors: ['#8a6a7a', '#6f7a48', '#9a7a8a'], tuftSize: [1.8, 0.75] },
  },
  // Le cimetière: herbe entretenue entre les tombes, rien n'y est semé.
  cimetiere: {
    color: '#93ab62',
    surface: 'herbe',
    cover: { tufts: 0.12, tuftColors: ['#8fa44e'], tuftSize: [1, 0.6] },
  },
  // Le verger communal: herbe haute qu'on fauche en juillet (coquelicots); le pommier est posé.
  verger: {
    color: '#a2b663',
    surface: 'herbe',
    cover: { tufts: 0.45, tuftColors: ['#8fa44e', '#9fb35a', '#74863f'], tuftSize: [1, 1.2] },
  },
  // La place et le parvis: pavés comme la rue (profil `place` de `reglages-relief.ts`).
  place: { color: '#c4b496', surface: 'pave', verge: 0.88 },
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
  // Natures de la légende d'Aubrune qui ne sont pas de l'herbe: le carré de terre d'un potager,
  // la vase et les galets d'un bord d'eau.
  potager: { color: '#b29468', surface: 'terre' },
  vase: { color: '#8a785a', surface: 'terre' },
  galets: { color: '#bdb5a2', surface: 'gravier' },
  annexe: { color: '#000000', surface: 'pave', hidden: true },
  // Sols d'intérieur des petits lieux (`floor` de la carte): plancher ciré, tapis d'un couloir, et
  // le vide autour d'une pièce (rien n'est dessiné: le fond de la scène).
  plancher: { color: '#9a6b45', surface: 'bois', planks: { width: 0.2, shade: 0.88 } },
  'tapis-de-couloir': { color: '#8c3f35', surface: 'tapis' },
  vide: { color: '#000000', surface: 'bois', hidden: true },
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
    /**
     * Classes d'arêtes du graphe qui suivent une voie ferrée, pour une carte sans `rails` (les
     * arêtes `interieur` sont les trajets des habitants dans les pièces: jamais des rails).
     */
    kinds: ['voie'],
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
    // Arbres par case et natures hors du couloir de jeu: `trees` et `outside` de chaque nature
    // (`GROUND_LOOKS`), lus par `tileDecor` et `groundField`.
    /** Buissons près des chemins (part des cases à 1 à 4 cases d'un chemin, natures à `bushes`). */
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
    /** Rendu encré: modèle livré de clôture (manifeste des décors) posé le long de la voie. */
    fenceModel: 'fence',
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
  /**
   * Semis de petits volumes (rendu encré, ADR 0023): cailloux du ballast et des chemins, touffes
   * du pré. Densités par case de 1 m selon la surface, tailles en mètres, teintes (une par
   * tirage). Tout est instancié: un appel par tuile et par forme.
   */
  semis: {
    pebbles: { gravier: 1.3, terre: 0.16, herbe: 0.02, sable: 0.3 } as Readonly<
      Partial<Record<SurfaceKind, number>>
    >,
    tufts: { herbe: 0.5 } as Readonly<Partial<Record<SurfaceKind, number>>>,
    pebbleSize: [0.05, 0.15] as const,
    pebbleColors: {
      gravier: ['#cfc6b4', '#b6a890', '#a49882'],
      terre: ['#d9c79f', '#bfa67c'],
      herbe: ['#c9c2ae', '#a9a08c'],
      sable: ['#e2d5b0', '#c9b98f'],
    } as Readonly<Partial<Record<SurfaceKind, readonly string[]>>>,
    tuftHeight: [0.16, 0.38] as const,
    tuftWidth: 0.11,
    tuftColors: ['#74863f', '#8fa44e', '#6f8f4e'] as readonly string[],
    /** Feuilles mortes (`cover.litter` d'une nature): largeur tirée (m) et épaisseur. */
    litter: { size: [0.08, 0.15] as const, height: 0.012 },
    /** Les touffes s'espacent loin de tout aménagement (cases), pour tenir le budget. */
    wildThin: 14,
    maxPerTile: 1200,
    /**
     * Garde (m) de chaque semis: distance tenue de l'emprise d'un meuble (un potager en est un),
     * d'un repère, d'un bâtiment, et du bord de toute autre surface (chemin, dallage, voie, eau).
     * Un arbre garde la place de son pied; un buisson, sa boule.
     */
    clear: { tufts: 0.3, pebbles: 0.12, trees: 1, bushes: 0.6 },
  },
  /**
   * Pièces (rendu encré, ADR 0023). Une pièce est un monde clos à l'écran: seule celle du joueur
   * local est dessinée. Ses matières, ses hauteurs et son fond viennent de son style
   * (`reglages-pieces.ts`); restent ici l'épaisseur des murs, les portes et les cloisons. Une
   * porte laisse dans son mur un vide de la largeur de son passage plus `doorJamb` de chaque
   * côté. Les cloisons (`blocked` de la pièce) sont des murs de `partitionThickness`, dans l'axe
   * de leur rangée. `wallHeight`, `wallColor`, `plinth*`: murs coupés d'avant les styles
   * (`interiorWalls`), que le moteur ne dessine plus.
   */
  interior: {
    wallHeight: 1.05,
    wallThickness: 0.3,
    wallColor: '#e6d9bf',
    plinthHeight: 0.24,
    plinthOut: 0.05,
    plinthColor: '#8f8474',
    floorColor: '#b98f5e',
    partitionThickness: 0.7,
    doorJamb: 0.12,
    /**
     * Porte d'une pièce: encadrement et vantail à taille humaine (m), paillasson devant. Dehors,
     * le bâtiment porte déjà sa porte: seul le paillasson marque le seuil. Porte au sol (escalier,
     * trappe): un cadre bas et ses marches.
     */
    door: {
      height: 2.05,
      depth: 0.34,
      leafDepth: 0.06,
      frameColor: '#5a4030',
      leafColor: '#8c6238',
      knobColor: '#e2c26a',
      panelColor: '#74502c',
      /** Tranche de la porte quand son mur est coupé devant la caméra. */
      cutColor: '#2a1f1a',
      /**
       * Porte fermée par l'histoire: planches clouées en travers, à ces parts de sa hauteur
       * (la plus basse reste sous la coupe d'un mur de devant), hautes et épaisses de tant (m).
       */
      boards: { at: [0.12, 0.6], height: 0.13, depth: 0.045 },
    },
    mat: { depth: 0.56, gap: 0.1, height: 0.035, color: '#b08a4a', edgeColor: '#6b4f2c' },
    hatch: {
      size: 0.86,
      curb: 0.09,
      height: 0.14,
      curbColor: '#5a4030',
      wellColor: '#231b18',
      /** Fermée par l'histoire: nombre de planches qui la bouchent, et jour entre deux planches (m). */
      planks: 4,
      plankGap: 0.012,
    },
  },
  landmark: {
    /** Repère dans un lieu sauvage (loin des chemins): un grand arbre; sinon une tour. */
    treeWildCells: 4,
    /** Un meuble de la carte à moins de cette distance (m) du repère en tient lieu: pas de volume provisoire. */
    sameAs: 1,
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
