/**
 * Relief du sol des grands lieux (règle « éviter le plat absolu »): un profil par nature de sol.
 * Affaire d'affichage seulement: la simulation reste en 2D et ne lit rien d'ici. Toutes les
 * hauteurs sont en mètres au-dessus du plan de la simulation (y = 0), où restent les sols posés
 * par l'homme (rues, routes, seuils des bâtiments, voie): on entre partout de plain-pied, et les
 * rails ne font aucune marche en croisant une route. L'herbe est donc un peu plus basse, les
 * chemins de terre encore un peu plus (ils sont creusés), l'eau au fond.
 *
 * Ajouter une nature de sol: une entrée dans `profiles` (recette dans le README du dossier).
 */
import type { SurfaceKind } from './reglages-tuiles';

/** Dalles ou pavés posés en volume, en rangs le long de l'axe est-ouest. */
export interface PavingProfile {
  /** Longueur moyenne d'une dalle (m) et part dont elle varie d'une dalle à l'autre (0 à 0,4). */
  readonly length: number;
  readonly jitter: number;
  /** Rangs par mètre (1 à 4): la largeur d'une dalle est 1 / `rows`. */
  readonly rows: number;
  /** Joint: largeur et profondeur (m). */
  readonly joint: number;
  readonly depth: number;
  /** Dalles inégales: écart de hauteur d'une dalle à l'autre et d'un coin à l'autre (m). */
  readonly uneven: number;
  /** Écart de teinte d'une dalle à l'autre (part de la teinte de la nature). */
  readonly tone: number;
  /** Arête abattue: retrait du dessus par rapport au pied de la dalle (m). */
  readonly chamfer: number;
}

/** Bordure de pierre posée au bord d'un sol rigide, dans sa propre case. */
export interface KerbProfile {
  /** Largeur (m, moins qu'un rang de dalles), longueur d'une pierre (m), dépassement au-dessus du sol (m). */
  readonly width: number;
  readonly length: number;
  readonly height: number;
  /** Teinte de la pierre; absente: celle de la nature, un peu éclaircie. */
  readonly color?: string;
}

export interface ReliefProfile {
  /** La raison d'être de ce profil (règle du studio: tout élément a son pourquoi). */
  readonly pourquoi: string;
  /** Hauteur de la surface (m) par rapport au plan de la simulation. */
  readonly level: number;
  /**
   * `souple`: terre, herbe, ballast, fond de l'eau; se raccorde en pente douce à ses voisins
   * souples. `rigide`: sol posé par l'homme, plat, au bord franc (une marche, une bordure).
   */
  readonly edge: 'souple' | 'rigide';
  /** Souple: amplitude des bosses (m), et portée du raccord avec les voisins (m, 1 au plus). */
  readonly bumps?: number;
  readonly spread?: number;
  /**
   * Bourrelet (hauteur positive) ou fossé (négative) que cette nature pose sur le sol souple qui
   * la borde: le petit talus d'herbe au bord d'un chemin, le fossé au pied du ballast. `width`:
   * 1 m au plus.
   */
  readonly rim?: { readonly height: number; readonly width: number };
  /** Rigide: le sol souple voisin remonte à son niveau sur cette distance (m, 1 au plus). */
  readonly apron?: number;
  /**
   * Souple: natures rigides que ce sol rejoint de plain-pied (un chemin qui débouche sur la rue):
   * il monte à leur niveau sur `joinReach`, et elles ne posent pas de bordure en travers.
   */
  readonly joins?: readonly string[];
  readonly paving?: PavingProfile;
  readonly kerb?: KerbProfile;
}

const GRASS: ReliefProfile = {
  pourquoi: 'un pré n’est jamais plan: bosses douces, un peu sous les seuils des maisons',
  level: -0.05,
  edge: 'souple',
  bumps: 0.03,
  spread: 0.45,
};

const SOIL: ReliefProfile = {
  pourquoi: 'terre battue ou travaillée: un rien sous l’herbe, presque lisse',
  level: -0.065,
  edge: 'souple',
  bumps: 0.012,
  spread: 0.45,
};

const WATER: ReliefProfile = {
  pourquoi: 'le fond: la berge descend vers lui en pente douce, l’eau la recouvre',
  level: -0.42,
  edge: 'souple',
  bumps: 0.02,
  spread: 0.5,
};

const BUILT: ReliefProfile = {
  pourquoi: 'sol posé par l’homme: plat, au niveau des seuils',
  level: 0,
  edge: 'rigide',
};

export const RELIEF_SETTINGS = {
  /**
   * Profil d'une nature de sol, par son nom (légende de la carte ou nature déduite par le rendu).
   * Une nature absente prend le profil de sa surface (`bySurface`).
   */
  profiles: {
    'hors-jeu': {
      pourquoi: 'le bois hors des zones: sol plus bosselé que le pré',
      level: -0.05,
      edge: 'souple',
      bumps: 0.06,
      spread: 0.45,
    },
    chemin: {
      pourquoi: 'chemin de terre creusé par les passages, un petit talus d’herbe sur ses bords',
      level: -0.125,
      edge: 'souple',
      bumps: 0.012,
      spread: 0.4,
      rim: { height: 0.045, width: 0.6 },
      joins: ['route', 'rue'],
    },
    sentier: {
      pourquoi: 'sentier: moins passant que le chemin, donc moins creusé',
      level: -0.095,
      edge: 'souple',
      bumps: 0.015,
      spread: 0.35,
      rim: { height: 0.02, width: 0.45 },
      joins: ['route', 'rue'],
    },
    voie: {
      pourquoi: 'ballast: un lit de cailloux tenu à niveau sous les rails, un fossé le draine',
      level: 0,
      edge: 'souple',
      bumps: 0,
      spread: 0.5,
      rim: { height: -0.07, width: 0.9 },
    },
    greve: {
      pourquoi: 'la grève descend vers l’eau',
      level: -0.11,
      edge: 'souple',
      bumps: 0.012,
      spread: 0.5,
    },
    route: {
      pourquoi: 'la route: grandes dalles usées, bordée de pierres qui retiennent la terre',
      level: 0,
      edge: 'rigide',
      paving: {
        length: 1.15,
        jitter: 0.3,
        rows: 2,
        joint: 0.02,
        depth: 0.022,
        uneven: 0.006,
        tone: 0.06,
        chamfer: 0.012,
      },
      kerb: { width: 0.15, length: 0.5, height: 0.03 },
    },
    rue: {
      pourquoi: 'la rue du bourg: dalles plus petites que celles de la route, même bordure',
      level: 0,
      edge: 'rigide',
      paving: {
        length: 0.8,
        jitter: 0.3,
        rows: 2,
        joint: 0.02,
        depth: 0.022,
        uneven: 0.007,
        tone: 0.07,
        chamfer: 0.012,
      },
      kerb: { width: 0.14, length: 0.5, height: 0.025 },
    },
    quai: {
      pourquoi:
        'le quai: une marche au-dessus de la rue et de la voie, nez de quai en pierre claire',
      level: 0.12,
      edge: 'rigide',
      paving: {
        length: 1,
        jitter: 0.22,
        rows: 2,
        joint: 0.018,
        depth: 0.02,
        uneven: 0.004,
        tone: 0.05,
        chamfer: 0.01,
      },
      kerb: { width: 0.3, length: 1, height: 0, color: '#ece6d6' },
    },
    batiment: {
      pourquoi: 'l’assise d’un bâtiment: plane, et la terre remonte contre le pied de ses murs',
      level: 0,
      edge: 'rigide',
      apron: 0.6,
    },
    ouvrage: {
      pourquoi: 'tablier d’un pont ou d’une passerelle: plan, la terre monte jusqu’à lui',
      level: 0,
      edge: 'rigide',
      apron: 0.7,
    },
  } as Readonly<Record<string, ReliefProfile>>,

  /** Profil par défaut d'une nature, d'après ce qu'on entend sous ses pas. */
  bySurface: {
    herbe: GRASS,
    terre: SOIL,
    sable: SOIL,
    gravier: SOIL,
    eau: WATER,
    pave: BUILT,
    bois: BUILT,
    tapis: BUILT,
  } as Readonly<Record<SurfaceKind, ReliefProfile>>,

  /** Profil des natures qu'on ne dessine pas (annexe des pièces): plan, au niveau de la simulation. */
  hidden: BUILT,

  /** Nature que prend l'emprise d'un bâtiment sans porte (une plateforme: le quai). */
  platformNature: 'quai',
  /** Profil que prend l'emprise de tout autre bâtiment: son assise reste plane. */
  buildingNature: 'batiment',

  /** Bosses: deux bruits lisses superposés, longueur d'onde (m) et poids de chacun. */
  noise: [
    { span: 7.3, weight: 0.75 },
    { span: 2.6, weight: 0.25 },
  ] as const,

  /**
   * Emprises tenues à niveau dans le sol souple: devant chaque porte (on entre de plain-pied) et
   * sous chaque voie ferrée (le lit des rails, même là où la carte n'a pas de ballast, et le
   * passage à niveau d'un chemin). `radius`: plat jusque-là (m); `fade`: raccord au-delà (m).
   */
  flats: {
    door: { level: 0, radius: 0.8, fade: 0.7 },
    rail: { level: 0, radius: 1.3, fade: 0.8 },
  },

  mesh: {
    /** Subdivision d'une case de sol souple là où le relief change (talus, berge, fossé). */
    fine: 4,
    /** Côté d'un morceau de sol (m, diviseur de 32): la carte graphique écarte ceux hors du champ. */
    chunk: 16,
    /** Écart de hauteur en dessous duquel deux sols sont de plain-pied: pas de marche dessinée (m). */
    flush: 0.004,
    /** Ce qui est posé sur un sol souple s'y enfonce d'autant (m): rien ne flotte sur une pente. */
    bury: 0.06,
    /** Teinte du flanc d'une marche de pierre, et d'une marche de terre. */
    stoneSide: '#8c8478',
    soilSide: '#6e5a42',
    /** Fond des joints, en part de la teinte de la dalle. */
    jointShade: 0.6,
    /** Flanc d'une dalle ou d'une bordure, en part de sa teinte. */
    sideShade: 0.8,
  },

  /** Distance sur laquelle un chemin monte au niveau du sol rigide qu'il rejoint (m, 1 au plus). */
  joinReach: 0.9,

  /** Dehors, la table du moteur (sol hors des tuiles) passe sous tout le relief (m). */
  tableDrop: 0.7,

  /** Les pieds montent une marche en douceur: demi-vie du rattrapage de hauteur (s). */
  stepHalfLife: 0.05,
} as const;

export type ReliefSettings = typeof RELIEF_SETTINGS;
