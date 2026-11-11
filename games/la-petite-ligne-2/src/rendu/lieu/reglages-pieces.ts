/**
 * Styles de pièce (rendu encré, ADR 0023): la matière des murs et du sol, les hauteurs, la
 * plinthe, les menuiseries et l'éclairage d'une pièce se choisissent par le champ `style` de son
 * fichier (`donnees/lieux/<lieu>/interieurs/<id>.json`). Sans ce champ: `DEFAULT_ROOM_STYLE`.
 * Ajouter un style: une entrée de `ROOM_STYLES`, qui hérite de `base`; aucun code.
 */
import type { LayerName } from '../encre/couches';

/** Sol d'une pièce, posé pièce par pièce en volume léger. */
export interface RoomFloorStyle {
  /**
   * `lames`: lames de 25 cm le long du grand côté (le pas de la couche de traits `wood`, qui y
   * dessine abouts, fil et noeuds); `carreaux`: carreaux carrés à joints, deux teintes en damier;
   * `dalles`: grandes pierres à joints larges.
   */
  readonly kind: 'lames' | 'carreaux' | 'dalles';
  /** Teintes tirées par pièce (lames, dalles) ou alternées (carreaux). */
  readonly colors: readonly string[];
  /** Côté d'un carreau ou d'une dalle (m); sans effet sur des lames. */
  readonly size: number;
  /** Largeur du joint (m) et teinte du fond qu'on y voit. */
  readonly joint: number;
  readonly jointColor: string;
}

export interface RoomStyle {
  /** Ce que ce style raconte (jamais lu par le moteur). */
  readonly pourquoi: string;
  /** Hauteur sous plafond (m): celle des murs du fond. */
  readonly height: number;
  /** Hauteur de coupe des murs du devant et des cloisons (m). */
  readonly cut: number;
  /** Enduit: teinte et couche de traits. */
  readonly wall: { readonly color: string; readonly layer: LayerName };
  /** Lambris de planches debout sous une cimaise; `null`: l'enduit descend jusqu'à la plinthe. */
  readonly wainscot: {
    readonly height: number;
    readonly color: string;
    readonly board: number;
    readonly railColor: string;
  } | null;
  readonly plinth: { readonly height: number; readonly out: number; readonly color: string };
  /** Pan de bois apparent: sablière sous le plafond et poteaux tous les `every` mètres; `null`: aucun. */
  readonly timber: { readonly color: string; readonly every: number } | null;
  /** Soubassement vu du dehors (pied des murs du devant): teinte, couche, profondeur sous le plancher (m). */
  readonly footing: { readonly color: string; readonly layer: LayerName; readonly drop: number };
  /**
   * Dessus d'un mur coupé (coupe d'architecte): le ton de son enduit assombri de `darken` points
   * de clarté (L*), bordé sur ses deux grandes arêtes d'un liseré d'encre de `rim` m. Un aplat
   * noir se lisait comme une poutre posée sur le mur (revue du 2026-11-11).
   */
  readonly cap: { readonly darken: number; readonly rim: number; readonly rimColor: string };
  readonly floor: RoomFloorStyle;
  /**
   * Fenêtres. `facades`: celles du bâtiment de la pièce (manifeste des bâtiments), sinon une par
   * travée de `bay` mètres; `aucune`: pièce aveugle (cave). Cotes par défaut, menuiserie, rideaux
   * (`null`: fenêtre nue).
   */
  readonly windows: {
    readonly rule: 'facades' | 'aucune';
    readonly bay: number;
    readonly width: number;
    readonly sill: number;
    readonly height: number;
    readonly frameColor: string;
    readonly glassColor: string;
    readonly curtains: readonly string[] | null;
  };
  /**
   * Appliques: une par pan de mur libre, espacées d'au moins `every` mètres, foyer à `height`,
   * flaque de `radius`; `null`: pièce sans lampe.
   */
  readonly lamps: {
    readonly every: number;
    readonly height: number;
    readonly radius: number;
  } | null;
}

const base: RoomStyle = {
  pourquoi:
    'maison de bourg d’Aubrune: enduit à la chaux crème, lambris sauge à hauteur d’appui, pan de bois apparent, plancher de chêne',
  height: 2.5,
  cut: 0.42,
  wall: { color: '#ead9bb', layer: 'wall' },
  wainscot: { height: 0.92, color: '#93a58b', board: 0.17, railColor: '#6f8068' },
  plinth: { height: 0.13, out: 0.025, color: '#5d4a38' },
  timber: { color: '#6a4a30', every: 1.7 },
  footing: { color: '#8d8272', layer: 'slab', drop: 0.34 },
  cap: { darken: 20, rim: 0.025, rimColor: '#2a1f1a' },
  floor: {
    kind: 'lames',
    colors: ['#b98a55', '#c79a62', '#ad7f4c', '#c08f58'],
    size: 0.25,
    joint: 0.014,
    jointColor: '#3a2a1e',
  },
  windows: {
    rule: 'facades',
    bay: 3.4,
    width: 0.95,
    sill: 0.98,
    height: 1.25,
    frameColor: '#f1e8d6',
    glassColor: '#6f8e97',
    curtains: ['#c9574a', '#e9dfc8'],
  },
  lamps: { every: 4.2, height: 1.78, radius: 5 },
};

/** Style des pièces d'Aubrune sans champ `style`. */
export const DEFAULT_ROOM_STYLE = 'aubrune';

export const ROOM_STYLES: Readonly<Record<string, RoomStyle>> = {
  aubrune: base,
  commerce: {
    ...base,
    pourquoi:
      'boutique ou salle de café: enduit ocre clair, lambris de bois sombre qui ne craint pas les chaises, carreaux de terre cuite en damier qu’on lave à grande eau',
    wall: { color: '#ecd4a4', layer: 'wall' },
    wainscot: { height: 1.0, color: '#7a5a3c', board: 0.2, railColor: '#5c4129' },
    floor: {
      kind: 'carreaux',
      colors: ['#b9694a', '#d9c3a0'],
      size: 0.4,
      joint: 0.014,
      jointColor: '#4a3a30',
    },
    windows: { ...base.windows, curtains: null },
  },
  atelier: {
    ...base,
    pourquoi:
      'atelier, forge, moulin: murs chaulés sans lambris, charpente apparente, dalles de pierre qui supportent le feu, l’eau et les charges',
    height: 2.7,
    wall: { color: '#ddd2bd', layer: 'wall' },
    wainscot: null,
    plinth: { height: 0.2, out: 0.03, color: '#7f7566' },
    floor: {
      kind: 'dalles',
      colors: ['#a59a88', '#b3a894', '#978c7b'],
      size: 0.8,
      joint: 0.02,
      jointColor: '#4b4339',
    },
    windows: { ...base.windows, frameColor: '#6a4a30', curtains: null },
  },
  cave: {
    ...base,
    pourquoi:
      'cave voûtée sous la maison: moellons nus, sol de dalles, aucune fenêtre, une seule lampe',
    height: 2.1,
    wall: { color: '#a89c8a', layer: 'slab' },
    wainscot: null,
    plinth: { height: 0.16, out: 0.03, color: '#6f665a' },
    timber: null,
    floor: {
      kind: 'dalles',
      colors: ['#8f8576', '#9a9080', '#84796b'],
      size: 0.7,
      joint: 0.022,
      jointColor: '#3c352e',
    },
    windows: { ...base.windows, rule: 'aucune' },
    lamps: { every: 6, height: 1.7, radius: 4.2 },
  },
  eglise: {
    ...base,
    pourquoi:
      'nef de pierre claire: murs hauts sans lambris ni pan de bois, grandes dalles, baies étroites et hautes sans rideaux',
    height: 3.4,
    wall: { color: '#ddd3be', layer: 'wall' },
    wainscot: null,
    plinth: { height: 0.3, out: 0.05, color: '#a0957f' },
    timber: null,
    floor: {
      kind: 'dalles',
      colors: ['#b5ab98', '#c0b6a3', '#a89e8c'],
      size: 0.9,
      joint: 0.02,
      jointColor: '#544b40',
    },
    windows: {
      ...base.windows,
      bay: 4.5,
      width: 0.7,
      sill: 1.3,
      height: 1.7,
      frameColor: '#8d8474',
      curtains: null,
    },
    lamps: { every: 7, height: 2.1, radius: 6.5 },
  },
};

/** Le style d'une pièce: celui de son champ `style`, sinon (absent ou inconnu) celui par défaut. */
export function roomStyle(
  id: string | undefined,
  styles: Readonly<Record<string, RoomStyle>> = ROOM_STYLES,
): RoomStyle {
  return (id === undefined ? undefined : styles[id]) ?? styles[DEFAULT_ROOM_STYLE] ?? base;
}

/** Réglages communs à toutes les pièces, quel que soit leur style. */
export const ROOM_SETTINGS = {
  /**
   * Un mur est « du devant » (coupé bas) quand sa normale vers le dehors pointe vers la caméra
   * de plus que ce seuil (produit scalaire à plat); l'écart évite le clignotement quand la vue
   * est dans l'axe d'un mur.
   */
  frontDot: 0.02,
  frontHysteresis: 0.02,
  /**
   * Épaisseur dessinée d'une cloison d'une case (m): un mur de refend, pas un bloc. La case
   * entière reste pleine pour la simulation.
   */
  partitionThickness: 0.4,
  window: {
    /** Dormant et petits bois (m). */
    frame: 0.06,
    bar: 0.035,
    /** Tablette de l'appui: épaisseur et saillie dans la pièce (m). */
    ledge: 0.04,
    ledgeOut: 0.07,
    /** Écart gardé entre une fenêtre et une porte, une cloison ou un angle (m). */
    margin: 0.3,
    /** Décalages essayés (m) quand la place d'une fenêtre est prise, avant d'y renoncer. */
    shifts: [0, 0.5, -0.5, 1, -1] as readonly number[],
    /** Un meuble de cette hauteur au moins (m), posé contre le mur, masque une fenêtre. */
    tallObject: 1.3,
    /** Tringle et rideaux: débord de chaque côté (m), largeur d'un pan, épaisseur. */
    curtainOut: 0.16,
    curtainWidth: 0.24,
    curtainDepth: 0.05,
  },
  lamp: {
    /** Écart gardé entre une applique et une ouverture (m), et saillie du foyer dans la pièce. */
    margin: 0.45,
    out: 0.2,
    /** Pas plus d'appliques que cela par pièce: le rendu en éclaire quatre à la fois. */
    max: 4,
    ironColor: '#2e2a28',
    globeColor: '#f3e2b0',
  },
  /** Tapis déclarés (`rugs`): épaisseur, liseré, teinte par défaut. */
  rug: { height: 0.035, border: 0.09, color: '#a8443a', borderColor: '#e2cfa3' },
  /**
   * Fond d'une pièce: une nappe sombre et chaude sous la pièce, plus claire au pied des murs
   * sur `halo` mètres (la pièce est posée, pas découpée dans le noir). Ni dehors ni autres pièces.
   */
  backdrop: {
    color: '#2a211d',
    haloColor: '#57483b',
    halo: 4.2,
    /** Demi-côté de la nappe au-delà de la pièce (m): plus que la vue la plus large. */
    reach: 60,
  },
  /** Coque d'ombre (jamais dessinée): plafond et murs pleins, le soleil n'entre que par les fenêtres. */
  shell: { thickness: 0.06, roof: 0.2 },
} as const;

export type RoomSettings = typeof ROOM_SETTINGS;
