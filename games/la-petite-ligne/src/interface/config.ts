/**
 * Réglages de l'interface (durées, seuils, correspondances d'icônes et
 * couleurs des portraits). Les valeurs de jeu restent dans `donnees/`.
 */
import type { FishRarity } from '../etat/peche';
import { type ActionKind, type CharacterId, type FormLevel, type ItemId, TOOLBAR_SLOTS } from '../etat/types';

export const UI_SETTINGS = {
  /** Cases de la barre d'outils (les premières places du sac), comme la simulation. */
  toolbarSlots: TOOLBAR_SLOTS,
  /** Colonnes de la grille du sac dans le carnet. */
  bagColumns: 7,
  /** Notifications visibles à la fois. */
  maxToasts: 3,
  /** Durée d'une notification si les réglages du jeu n'en donnent pas (s). */
  toastSeconds: 6,
  /** Anti-double-appui à l'arrivée d'un écran ou d'un panneau (ms). */
  arrivalGuardMs: 300,
  /** Affichage du gain de la bourse (« +50 »), en ms. */
  purseDeltaMs: 1800,
  /** Marque « nouveau » sur une case qui vient de recevoir un objet (ms). */
  slotNewMs: 500,
  /** Endurance basse (hachures et « Fatigue ») sous cette part du maximum. */
  staminaLowRatio: 0.25,
  /** Carte « D'accord » tamponnée, avant de disparaître (ms). */
  proposalStampMs: 2600,
  /** Repli de la carte refusée ou retirée (ms, `--lpl-duration-slow`). */
  foldMs: 320,
  /** « Le train entre en gare… » reste affiché après les deux créations (ms). */
  creationReadyHoldMs: 1600,
  /** La ligne du train apparaît à l'horloge ce nombre de minutes de jeu avant l'arrivée ou le départ. */
  trainNoticeMinutes: 180,
  /** Rafraîchissement des modèles au plus tous les... (ms), et au moins tous les... (ms). */
  refreshMinMs: 90,
  refreshMaxMs: 500,
  /** Un menu demandé par l'interface s'affiche aussitôt; s'il n'est pas confirmé par l'état dans ce délai, l'état reprend la main (ms). */
  pendingMenuMs: 1500,
  /** Distance à un point nommé pour dire où est l'autre joueur (m). */
  partnerPlaceRadius: 4,
  /** Achat groupé au comptoir (graines, clous). */
  shopBulk: 4,
  /**
   * Interface imagée (patch 0.12.2): largeur des panneaux et vignettes par page, choisies pour
   * qu'une page tienne sans défiler à 1366x768 avec la taille d'interface à 100 % (`interface.css`,
   * grilles de 5 colonnes pour le comptoir, 4 pour les recettes, 7 pour les poissons).
   */
  vitrine: {
    shopWidth: '52rem',
    shopPerPage: 20,
    stationWidth: '52rem',
    recipesPerPage: 8,
    catalogPerPage: 24,
    farmWidth: '54rem',
    animalsPerPage: 8,
    fishPerPage: 28,
    /** Rangement: 7 colonnes sur 4 rangées de cases, le sac à côté (6 sur 4), le râtelier dessous. */
    storageWidth: '60rem',
    storagePerPage: 28,
    storageBagPerPage: 24,
    /** Quêtes du carnet: deux colonnes de cartes sur quatre rangées, le détail à droite. */
    questsPerPage: 8,
    /** Voisins du carnet (0.13): les 21 portraits sur une seule page (6 colonnes, 4 rangées). */
    neighboursPerPage: 24,
    /** Frise de la journée d'un habitant: de 6 h à minuit, lue par pas de 10 minutes. */
    dayFrom: 360,
    dayTo: 1440,
    dayStep: 10,
  },
  /** Barre de progression (R10): un geste plus court que cette durée n'en a pas (s). */
  progressMinSeconds: 1,
  /** Un arbre entamé montre ses coups ce temps après le dernier (s), à cette distance au plus (m). */
  chopProgressSeconds: 2.5,
  chopProgressRadius: 3,
  /** Pas de l'horloge affichée (minutes de jeu). */
  clockStepMinutes: 10,
  /**
   * Pas de simulation par seconde: doit valoir `SIM_HZ` de `simulation/constantes.ts`
   * (l'interface n'importe pas la simulation; un test vérifie l'égalité).
   */
  simHz: 30,
  /**
   * Moments rares: la ligne d'observation apparaît à `watch.radius` plus cette marge (m), pour
   * dire la pose demandée à qui arrive; pas au-delà (l'invitation « Montre-le » s'en charge).
   */
  watchNearMargin: 2.5,
  /** Un changement de la ligne d'observation doit tenir ce délai avant d'être affiché (ms): jamais en rafale. */
  watchSettleMs: 450,
  /**
   * Cône du regard de l'apogée (rad): doit valoir `LOOK_CONE` de `simulation/conditions.ts`
   * (un test vérifie l'égalité).
   */
  lookCone: Math.PI / 6,
  /** Conversation d'appel d'une poule: `HEN_CALL_DIALOGUE` de `simulation/secrets.ts` (un test vérifie l'égalité). */
  henCallDialogue: 'hen_call',
  /** Longueur maximale du prénom (comme la simulation). */
  nameMaxLength: 16,
  /**
   * Une touche traitée par l'interface (focus dans l'interface) arrive aussi à
   * `handleKey` au pas suivant, par les actions du SDK: on l'ignore dans ce délai (ms).
   */
  claimMs: 400,
  /**
   * Sons de l'interface: écart minimal entre deux mêmes sons (ms), en plus de
   * `minIntervalMs` de `sons.json`. Rien en rafale (focus tenu, double clic).
   */
  soundMinMs: {
    'ui-focus': 45,
    'ui-confirm': 80,
    'ui-back': 80,
    'ui-tab': 80,
    'ui-next': 80,
    'ui-panel-open': 120,
    'ui-panel-close': 120,
    'ui-refusal': 600,
  },
} as const;

/** Zones de la carte, dans l'ordre où on les teste pour dire où est l'autre. */
export const PARTNER_ZONES: readonly string[] = [
  'garden',
  'hen_pen',
  'quay',
  'square',
  'forest_edge',
  'river_ford_area',
  'river',
  'level_crossing_area',
  'meadow',
];

/** Points nommés testés avant les zones (comptoirs et établi). */
export const PARTNER_POINTS: readonly string[] = [
  'grocery_counter',
  'sawmill_workbench',
  'sawmill_yard',
  'notice_board',
  'coop_crate',
  'well',
  'firmin_house',
  'handcar_shed',
];

/** Icône de l'activité de l'autre joueur, par action. */
export const ACTION_ICONS: Partial<Record<ActionKind, string>> = {
  till: 'hoe',
  sow: 'seed-radish',
  water: 'watering-can',
  harvest: 'radish',
  chop: 'axe',
  saw: 'plank',
  hammer: 'plank',
  eat: 'bread',
  cook: 'soup',
  feed: 'grain-sack',
  pickup: 'parcel',
  refill: 'watering-can',
  carry: 'beam',
  sleep: 'ui-moon',
  sit: 'ui-house',
};

/**
 * Poissons (0.12.2): une silhouette et des couleurs par espèce (symboles `fish-*`, dessinés par
 * `ui-maquettes/outils/familles-icones.mjs`). Le poisson générique `fish` ne sert plus que de repli.
 */
export const FISH_ICONS: Readonly<Record<string, string>> = {
  gudgeon: 'fish-gudgeon',
  minnow: 'fish-minnow',
  stone_loach: 'fish-stone-loach',
  bleak: 'fish-bleak',
  roach: 'fish-roach',
  chub: 'fish-chub',
  trout: 'fish-trout',
  perch: 'fish-perch',
  dace: 'fish-dace',
  bullhead: 'fish-bullhead',
  tench: 'fish-tench',
  barbel: 'fish-barbel',
  pike: 'fish-pike',
  grayling: 'fish-grayling',
  brook_lamprey: 'fish-brook-lamprey',
  bitterling: 'fish-bitterling',
  shad: 'fish-shad',
  mirror_carp: 'fish-mirror-carp',
  salmon: 'fish-salmon',
  burbot: 'fish-burbot',
  golden_trout: 'fish-golden-trout',
  moon_pike: 'fish-moon-pike',
};

/** Fond et liseré de chaque rareté (`rarity-*`), à poser derrière l'icône du poisson. */
export const RARITY_ICONS: Readonly<Record<FishRarity, string>> = {
  common: 'rarity-common',
  rare: 'rarity-rare',
  epic: 'rarity-epic',
  legendary: 'rarity-legendary',
  mythic: 'rarity-mythic',
};

/** Portrait de chaque robe de poule (`reglages.hens.care.colors`), et la silhouette d'une robe à trouver. */
export const HEN_ROBE_ICONS: Readonly<Record<string, string>> = {
  hen_white: 'hen-white',
  hen_red: 'hen-red',
  hen_black: 'hen-black',
  hen_golden: 'hen-golden',
  hen_ash: 'hen-ash',
  hen_cuckoo: 'hen-cuckoo',
};
export const HEN_UNKNOWN_ICON = 'hen-unknown';

/**
 * Clés des icônes d'information des fiches (0.12.2): saisons et coins de pêche sous leurs identifiants
 * du jeu (`spring`, `ford`...), moments du jour, prix, record, déjà pris, soins des poules.
 */
export type InfoIconKey =
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'winter'
  | 'morning'
  | 'noon'
  | 'evening'
  | 'night'
  | 'ford'
  | 'sands'
  | 'pontoon'
  | 'confluence'
  | 'ru'
  | 'upstream'
  | 'downstream'
  | 'price'
  | 'record'
  | 'caught'
  | 'hen_fed'
  | 'hen_hungry'
  | 'hen_rest'
  | 'litter_clean'
  | 'litter_dirty'
  | 'egg_today'
  | 'brood'
  | 'hen_heart';

export const INFO_ICONS: Readonly<Record<InfoIconKey, string>> = {
  spring: 'info-season-spring',
  summer: 'info-season-summer',
  autumn: 'info-season-autumn',
  winter: 'info-season-winter',
  morning: 'info-time-morning',
  noon: 'info-time-noon',
  evening: 'info-time-evening',
  night: 'info-time-night',
  ford: 'info-spot-ford',
  sands: 'info-spot-sands',
  pontoon: 'info-spot-pontoon',
  confluence: 'info-spot-confluence',
  ru: 'info-spot-ru',
  upstream: 'info-spot-upstream',
  downstream: 'info-spot-downstream',
  price: 'info-price',
  record: 'info-record',
  caught: 'info-caught',
  hen_fed: 'info-hen-fed',
  hen_hungry: 'info-hen-hungry',
  hen_rest: 'info-hen-rest',
  litter_clean: 'info-litter-clean',
  litter_dirty: 'info-litter-dirty',
  egg_today: 'info-egg-today',
  brood: 'info-brood',
  hen_heart: 'info-hen-heart',
};

/**
 * Symbole du sprite pour chaque objet (`ui-maquettes/icones.svg`): une icône par chose (0.12.2). Deux
 * objets ne partagent jamais un symbole; les variantes de couleur (vases, rideaux, poules) ont chacune
 * le leur. Un test vérifie que chaque objet de `objets.json` a son entrée.
 */
export const ITEM_ICONS: Readonly<Record<ItemId, string>> = {
  radish_seed: 'seed-radish',
  lettuce_seed: 'seed-lettuce',
  carrot_seed: 'seed-carrot',
  radish: 'radish',
  lettuce: 'lettuce',
  carrot: 'carrot',
  dandelion: 'dandelion',
  wild_garlic: 'wild-garlic',
  chanterelle: 'chanterelle',
  blackberry: 'blackberry',
  cep: 'cep',
  elderberry: 'elderberry',
  hazelnut: 'hazelnut',
  egg: 'egg',
  log: 'log',
  plank: 'plank',
  nail: 'nail',
  mattress: 'mattress',
  beam: 'beam',
  handcar: 'handcar',
  heavy_parcel: 'parcel-heavy',
  hoe: 'hoe',
  watering_can: 'watering-can',
  axe: 'axe',
  fishing_rod: 'fishing-rod',
  // Les outils améliorés gardent le dessin de leur outil, dans leur matière.
  watering_can_copper: 'watering-can-copper',
  axe_forged: 'axe-forged',
  fishing_rod_bamboo: 'fishing-rod-bamboo',
  grain_sack: 'grain-sack',
  straw_armful: 'straw-armful',
  water_pail: 'water-pail',
  milk_can: 'milk-can',
  fresh_cheese: 'fresh-cheese',
  goat_extra: 'goat',
  // Les poules commandées montrent leur robe (`catalogue.json`, hens): Brioche la rousse, Pervenche la blanche.
  hen_extra: 'hen-red',
  hen_extra_2: 'hen-white',
  chalk_box: 'chalk-box',
  coffee_mill: 'coffee-mill',
  leather_apron: 'leather-apron',
  wool_scarf: 'wool-scarf',
  elder_jelly: 'elder-jelly',
  bread: 'bread',
  crunchy_radishes: 'crunchy-radishes',
  omelette: 'omelette',
  vegetable_soup: 'soup',
  iron_box: 'tin-box',
  riddle_card: 'riddle-card',
  shed_key: 'key',
  old_photo: 'photo',
  riddle_card_2: 'riddle-card-2',
  emile_logbook: 'logbook',
  odette_parcel: 'parcel-odette',
  jeanne_notebook: 'jeanne-notebook',
  lucie_letter: 'letter-lucie',
  ...FISH_ICONS,
  jay_feather: 'jay-feather',
  straw_mattress: 'straw-bed',
  double_bed: 'double-bed',
  table: 'table',
  chair: 'chair',
  chest: 'chest',
  shelf: 'shelf',
  stove: 'stove',
  flower_pot: 'flower-pot',
  small_vase: 'small-vase',
  small_vase_blue: 'small-vase-blue',
  small_vase_terracotta: 'small-vase-terracotta',
  oil_lamp: 'oil-lamp',
  rug: 'rug',
  curtains: 'curtains',
  crystal_radio: 'crystal-radio',
  picture_frame: 'picture-frame',
  straw_hat: 'straw-hat',
  pressed_flowers: 'pressed-flowers',
  wicker_armchair: 'wicker-armchair',
  coop_calendar: 'coop-calendar',
  wall_clock: 'wall-clock',
  autumn_wreath: 'autumn-wreath',
  jeanne_drawing: 'jeanne-drawing',
  wood_stove: 'wood-stove',
  warm_bread: 'warm-bread',
  brioche: 'brioche',
  hot_chocolate: 'hot-chocolate',
  bread_basket: 'bread-basket',
  hourglass: 'sand-timer',
  horn_comb: 'horn-comb',
  oak_chest: 'oak-chest',
  cellar_rack: 'cellar-rack',
  curtains_blue: 'curtains-blue',
  curtains_red: 'curtains-red',
  curtains_yellow: 'curtains-yellow',
  curtains_green: 'curtains-green',
  curtains_gingham: 'curtains-gingham',
  tool_rack: 'tool-rack',
  market_stall: 'market-stall',
  brick_crate: 'brick-crate',
  goat_crate: 'goat-crate',
  rooster_crate: 'rooster-crate',
  garland: 'garland',
  jeanne_chick_drawing: 'jeanne-chick-drawing',
  cloth_coupon: 'cloth-coupon',
  hen_feather: 'hen-feather',
  crate: 'crate',
  goat_bell: 'goat-bell',
  mail_letter: 'mail-letter',
  sugar: 'sugar',
  jar: 'jar',
  blackberry_jam: 'blackberry-jam',
  roasted_hazelnuts: 'roasted-hazelnuts',
  chanterelle_pan: 'chanterelle-pan',
  nest_box: 'nest-box',
  mail_parcel: 'parcel-mail',
  hopper_feeder: 'hopper-feeder',
  market_scale: 'market-scale',
};

/** Icône de secours par catégorie (objet sans dessin propre). */
export const CATEGORY_ICONS: Readonly<Record<string, string>> = {
  seed: 'seed-radish',
  crop: 'radish',
  forage: 'dandelion',
  animal_product: 'egg',
  material: 'plank',
  carried: 'beam',
  tool: 'hoe',
  food: 'bread',
  quest: 'tin-box',
  fish: 'fish',
  decoration: 'flower-pot',
  furniture: 'parcel',
  gift: 'gift',
  animal_order: 'hen',
};

/** Expression du portrait pour chaque niveau de forme (`ui-maquettes`: low, ok, good, great, radiant). */
export const FORM_EXPRESSIONS: Readonly<Record<FormLevel, Expression>> = {
  low: 'low',
  okay: 'ok',
  good: 'good',
  great: 'great',
  radiant: 'radiant',
};

export type Expression = 'low' | 'ok' | 'good' | 'great' | 'radiant';
export type HairStyle =
  | 'short'
  | 'bob'
  | 'bun'
  | 'crop'
  | 'curls'
  | 'ponytail'
  | 'braid'
  | 'pigtails'
  | 'wavy'
  | 'long'
  | 'fringe'
  | 'quiff'
  | 'cloud'
  | 'crown'
  | 'bob_long'
  | 'cap'
  | 'villager_bun'
  | 'beard'
  | 'braids'
  // 0.13 (carnet des voisins): coiffures et couvre-chefs des habitants, d'après leurs fiches (`v0-13-habitants.md`, 2.3).
  | 'bald'
  | 'beanie'
  | 'straw_hat'
  | 'calot'
  | 'kepi'
  | 'round_hat'
  | 'kid_cap';

/** Barbe ou moustache des portraits (index `appearance.beard`). */
export type BeardStyle = 'none' | 'short' | 'full' | 'moustache';

export interface PortraitColors {
  skin: string;
  shade: string;
  hair: string;
  top: string;
  trim: string;
  scarf: string;
  style: HairStyle;
  bg: string;
  /** Barbe ou moustache d'un joueur (tour 10); absent: aucune. */
  beard?: BeardStyle;
  /** Veste portée par-dessus le haut (0.12): pans et revers. */
  outer?: { main: string; second: string };
  /** Badge brodé à la couleur du profil Duo (joueurs, 0.12), à la place du foulard. */
  badge?: string;
  /** Lunettes rondes cerclées de métal (habitants de la 0.13). */
  glasses?: boolean;
}

/**
 * Habitants: couleurs des portraits provisoires des maquettes
 * (`ui-maquettes/support/portraits.js`, d'après `palette.py`).
 */
export const VILLAGER_PORTRAITS: Readonly<Record<string, PortraitColors>> = {
  firmin: { skin: '#E3B48F', shade: '#C99273', hair: '#B9B4AC', top: '#2F3F5C', trim: '#3E5070', scarf: '#E9E3D3', style: 'cap', bg: '#DCE1E8' },
  odette: { skin: '#F0C7A6', shade: '#D9A585', hair: '#8D7F78', top: '#9C4F67', trim: '#F2EBDD', scarf: '#E7B04E', style: 'villager_bun', bg: '#F1E1E3' },
  basile: { skin: '#D7A27C', shade: '#BC8463', hair: '#E4E0D8', top: '#A8B6A0', trim: '#8E5B37', scarf: '#C2563F', style: 'beard', bg: '#E8E0D0' },
  jeanne: { skin: '#F1C8A3', shade: '#DBA684', hair: '#B5652F', top: '#F2D46B', trim: '#557FB0', scarf: '#D9584F', style: 'braids', bg: '#F3EAC8' },
  // 0.13 (carnet des voisins): les dix-sept autres, couleurs des rangées de `palette.py` (CHAR_ROWS), sans
  // foulard (bible: aucune couleur vive au cou chez les habitants); coiffure ou couvre-chef de leur fiche.
  achille: { skin: '#E6B892', shade: '#CB9874', hair: '#4E3A2C', top: '#EEE8DC', trim: '#D9D1C2', scarf: '', style: 'calot', bg: '#EDE3D2' },
  solange: { skin: '#EDC3A0', shade: '#D4A080', hair: '#9A4A2C', top: '#7FA595', trim: '#F1EAD9', scarf: '', style: 'bob', bg: '#E2ECE4' },
  lucie: { skin: '#C68E68', shade: '#A9714F', hair: '#3B2A22', top: '#4E6F8F', trim: '#E0C25A', scarf: '', style: 'kepi', bg: '#DCE4EC' },
  armand: { skin: '#E6BC98', shade: '#CC9C7A', hair: '#4A3326', top: '#7A5A3F', trim: '#F1ECE2', scarf: '', style: 'short', bg: '#ECE2D6', glasses: true },
  berthe: { skin: '#E2B08A', shade: '#C79270', hair: '#A8A39C', top: '#E7D8B6', trim: '#F6F1E6', scarf: '', style: 'crop', bg: '#E4EADF', outer: { main: '#3F5A45', second: '#5B4636' } },
  martial: { skin: '#DDAA85', shade: '#C08E6A', hair: '#A9A6A0', top: '#35373C', trim: '#F2EFE8', scarf: '', style: 'round_hat', bg: '#E2E2E4' },
  marthe: { skin: '#EBC2A2', shade: '#D1A383', hair: '#CFCAC2', top: '#B9B4AC', trim: '#4A5A6A', scarf: '', style: 'villager_bun', bg: '#E1E5EA' },
  honorine: { skin: '#EEC9AE', shade: '#D6AC90', hair: '#F0ECE4', top: '#F1E5C9', trim: '#8796BF', scarf: '', style: 'villager_bun', bg: '#E3E6F1', glasses: true },
  ines: { skin: '#B9825C', shade: '#9C6646', hair: '#231C19', top: '#3F5A45', trim: '#556F59', scarf: '', style: 'braid', bg: '#DCE6DC' },
  barnabe: { skin: '#D49F7A', shade: '#B5805E', hair: '#2B2522', top: '#A4463B', trim: '#6E2C26', scarf: '', style: 'beanie', bg: '#F0DDD8', beard: 'full' },
  mado: { skin: '#E0AA84', shade: '#C48C66', hair: '#8E4A2A', top: '#E4DAC6', trim: '#4A3A30', scarf: '', style: 'curls', bg: '#EFE2D8', outer: { main: '#4A3A30', second: '#6E5640' } },
  paulin: { skin: '#D8A27A', shade: '#BB845E', hair: '#5A4636', top: '#A3A8AB', trim: '#737A80', scarf: '', style: 'straw_hat', bg: '#EFE8D2', beard: 'moustache' },
  margot: { skin: '#EDC09C', shade: '#D4A07D', hair: '#5A3B28', top: '#8BA37B', trim: '#6E7F8E', scarf: '', style: 'bun', bg: '#E4EDDD' },
  leon: { skin: '#EFC5A2', shade: '#D8A584', hair: '#2B2522', top: '#F0ECE3', trim: '#6B4E37', scarf: '', style: 'kid_cap', bg: '#F1E0DC' },
  ambroise: { skin: '#E7BE9E', shade: '#CDA080', hair: '#EDEAE4', top: '#8D8F94', trim: '#3A3B40', scarf: '', style: 'bald', bg: '#E4E4E6', outer: { main: '#2E2D30', second: '#C8A150' } },
  nour: { skin: '#B9825C', shade: '#9C6646', hair: '#231C19', top: '#8C8556', trim: '#A39B6B', scarf: '', style: 'ponytail', bg: '#ECE9D8' },
  colette: { skin: '#E8B993', shade: '#CD9A75', hair: '#221C1A', top: '#8E3F35', trim: '#2E2B2A', scarf: '', style: 'bob', bg: '#F1DEDA' },
};

/**
 * Coiffures des joueurs (index `appearance.hair`), dans l'ordre de la table 2.1 du tour 10 et des
 * maillages `player_hair_<id>`: les 12 de la création, puis les 3 du salon seulement.
 */
export const PLAYER_HAIRS: readonly HairStyle[] = [
  'short',
  'bob',
  'bun',
  'crop',
  'curls',
  'ponytail',
  'braid',
  'pigtails',
  'wavy',
  'long',
  'fringe',
  'quiff',
  'cloud',
  'crown',
  'bob_long',
];

/**
 * Couleurs des cheveux (index `appearance.hairColor`, section 2.2): noir, brun, châtain, auburn,
 * roux, blond paille, gris, blanc. Provisoires, d'après la palette de la bible (cheveux), en
 * attendant les valeurs du directeur artistique; le brun et le noir sont ceux des portraits d'avant.
 */
export const PLAYER_HAIR_COLORS: readonly string[] = ['#2E2622', '#6B4A33', '#8A5F3C', '#7E3B2A', '#B5652F', '#C9A267', '#9A948C', '#E2DCD0'];

/** Barbes des joueurs (index `appearance.beard`): aucune, courte, fournie, moustache. */
export const PLAYER_BEARDS: readonly BeardStyle[] = ['none', 'short', 'full', 'moustache'];

/**
 * Tenues d'avant la 0.12: repli des portraits et des pastilles de la création quand `vetements.json`
 * ne donne rien (les vraies couleurs viennent des vêtements de départ, `etat/garde-robe.ts`).
 */
export const PLAYER_OUTFITS: readonly { top: string; trim: string; bg: string }[] = [
  { top: '#5C7FA6', trim: '#EDE6D3', bg: '#D9E3EC' },
  { top: '#B5663F', trim: '#EDE6D3', bg: '#EADBCF' },
  { top: '#8BA37B', trim: '#F1EBDB', bg: '#E1E8DA' },
  { top: '#D4A746', trim: '#F3ECDA', bg: '#F1E6CC' },
  { top: '#8C4A5E', trim: '#EFE4D6', bg: '#EBDCE0' },
  { top: '#3F6F6A', trim: '#ECE6D5', bg: '#D8E4E1' },
  { top: '#C9B79A', trim: '#5F4B3A', bg: '#EFE8DC' },
  { top: '#6B7FB0', trim: '#F2EAD8', bg: '#DCE1EE' },
];

/** Peau et cheveux de chaque personnage (la démo ne les fait pas choisir), comme `BODY_COLORS` du rendu. */
export const PLAYER_BODIES: Readonly<Record<CharacterId, { skin: string; shade: string; hair: string }>> = {
  p1: { skin: '#E8BE9A', shade: '#D29D7B', hair: '#6B4A33' },
  p2: { skin: '#B9825C', shade: '#9C6646', hair: '#2E2622' },
};

/** Profils Duo (`design/identite/b/joueurs.json`): couleur et symbole. */
export const PROFILE_SYMBOLS: readonly { id: string; color: string }[] = [
  { id: 'orb', color: '#5CE1E6' },
  { id: 'crescent', color: '#8D6CFF' },
  { id: 'star', color: '#D4F27A' },
  { id: 'sun', color: '#FC663F' },
  { id: 'planet', color: '#E787B1' },
  { id: 'comet', color: '#22B07D' },
];

/**
 * Plumage de l'icône « hen » (appel d'une poule par son nom), par robe: blanche, rousse, noire, puis les
 * robes nées des couvées (dorée, cendrée, coucou), comme le rendu (`owl_buff`, `goose_grey`, `heron_grey`).
 */
export const HEN_COLORS: Readonly<Record<string, string>> = {
  hen_white: '#f1ead9',
  hen_red: '#b5652f',
  hen_black: '#3b3430',
  hen_golden: '#d8ae72',
  hen_ash: '#8f887c',
  hen_cuckoo: '#7f888e',
};

/** Icône de la météo. */
export const WEATHER_ICONS: Readonly<Record<string, string>> = {
  sunny: 'weather-sun',
  cloudy: 'weather-cloud',
  rain: 'weather-rain',
};

/** « Tout déposer » au rangement (0.12.2): l'icône de chaque famille, à côté du nombre. */
export const STORAGE_FAMILY_ICONS: Readonly<Record<string, string>> = {
  crop: 'radish',
  fish: 'fish',
  forage: 'blackberry',
  food: 'soup',
  material: 'plank',
};

/** Quêtes du carnet (0.12.2): les habitants sans portrait dessiné prennent l'icône de leur métier. */
export const QUEST_GIVER_ICONS: Readonly<Record<string, string>> = {
  achille: 'bread-basket',
  solange: 'horn-comb',
};

/**
 * Carnet des voisins (0.13, lot H3): les lieux des plannings, chacun avec son picto et son nom
 * (`neighbours.places` de `textes-interface.json`, avec sa préposition: « à la halte »).
 * `home` et `away` viennent de l'activité (`home`, `absent`), pas du point; `village` est le repli
 * d'un point inconnu de cette table (donnée d'une version suivante).
 */
export type NeighbourPlace =
  | 'halt'
  | 'shop'
  | 'square'
  | 'sawmill'
  | 'river'
  | 'bakery'
  | 'salon'
  | 'school'
  | 'church'
  | 'presbytery'
  | 'cemetery'
  | 'cafe'
  | 'forge'
  | 'mill'
  | 'farm'
  | 'field'
  | 'forest'
  | 'lookout'
  | 'gardens'
  | 'washhouse'
  | 'vet'
  | 'hamlet'
  | 'clockmaker'
  | 'bench'
  | 'coop'
  | 'house'
  | 'home'
  | 'away'
  | 'village';

export const NEIGHBOUR_PLACE_ICONS: Readonly<Record<NeighbourPlace, string>> = {
  halt: 'place-halt',
  shop: 'place-shop',
  square: 'place-square',
  sawmill: 'place-sawmill',
  river: 'place-river',
  bakery: 'warm-bread',
  salon: 'place-salon',
  school: 'place-school',
  church: 'place-church',
  presbytery: 'place-church',
  cemetery: 'place-cemetery',
  cafe: 'place-cafe',
  forge: 'place-forge',
  mill: 'place-mill',
  farm: 'place-farm',
  field: 'place-field',
  forest: 'place-forest',
  lookout: 'place-forest',
  gardens: 'place-garden',
  washhouse: 'water-pail',
  vet: 'place-vet',
  hamlet: 'chair',
  clockmaker: 'wall-clock',
  bench: 'place-bench',
  coop: 'hen',
  house: 'ui-house',
  home: 'ui-house',
  away: 'place-road',
  village: 'ui-pin',
};

export const NEIGHBOUR_PLACE_KEYS = Object.keys(NEIGHBOUR_PLACE_ICONS) as readonly NeighbourPlace[];

/** Lieu de chaque point des plannings (`schedule[].point` des habitants). Les tombes (`grave_*`) vont au cimetière. */
export const NEIGHBOUR_POINT_PLACES: Readonly<Record<string, NeighbourPlace>> = {
  quay_bell: 'halt',
  quay_bench: 'halt',
  train_stop: 'halt',
  station_door: 'halt',
  handcar_shed: 'halt',
  grocery_customer: 'shop',
  grocery_door: 'shop',
  grocery_inside_counter: 'shop',
  grocery_table: 'shop',
  grocery_terrace: 'shop',
  village_square: 'square',
  well_shelter: 'square',
  hopscotch: 'square',
  square_lime_tree: 'square',
  sawmill_yard: 'sawmill',
  basile_at_workbench: 'sawmill',
  basile_by_beam: 'sawmill',
  riverbank: 'river',
  fishing_ford_north: 'river',
  fishing_pontoon: 'river',
  pasture_bank: 'river',
  bakery_back: 'bakery',
  bakery_window: 'bakery',
  salon_counter: 'salon',
  salon_window: 'salon',
  school_gate: 'school',
  school_yard: 'school',
  mairie_desk: 'school',
  school_lodging_door: 'school',
  church_nave: 'church',
  church_porch: 'church',
  church_square: 'church',
  church_bell_rope: 'church',
  presbytery_door: 'presbytery',
  priest_garden: 'presbytery',
  vineyard: 'presbytery',
  cemetery_bench: 'cemetery',
  cemetery_gate: 'cemetery',
  cemetery_tap: 'cemetery',
  cafe_counter: 'cafe',
  cafe_door: 'cafe',
  cafe_terrace: 'cafe',
  skittles_alley: 'cafe',
  forge_door: 'forge',
  forge_inside: 'forge',
  forge_yard: 'forge',
  mill_door: 'mill',
  mill_inside: 'mill',
  mill_race_bank: 'mill',
  mill_sluice: 'mill',
  mill_yard: 'mill',
  farm_door: 'farm',
  farmyard: 'farm',
  barn_door: 'farm',
  threshing_floor: 'farm',
  farm_garden: 'farm',
  field_high_01: 'field',
  field_high_02: 'field',
  forest_cut: 'forest',
  forest_edge_path: 'forest',
  clearing_center: 'forest',
  charcoal_kiln: 'forest',
  spring: 'forest',
  bird_hide: 'forest',
  forester_bench: 'forest',
  forester_house_door: 'forest',
  nest_oak_basile: 'forest',
  lookout: 'lookout',
  shared_garden_plot: 'gardens',
  lucie_garden: 'gardens',
  sexton_garden: 'gardens',
  washhouse: 'washhouse',
  vet_yard: 'vet',
  hamlet_house_a_door: 'vet',
  hamlet_house_c_door: 'hamlet',
  honorine_doorstep: 'hamlet',
  honorine_window: 'hamlet',
  rail_cottage_west_window: 'clockmaker',
  rail_cottage_west_door: 'clockmaker',
  upper_street_bench: 'bench',
  chicken_coop: 'coop',
  firmin_house: 'house',
  lucie_house_door: 'house',
  sexton_house_door: 'house',
  offstage: 'away',
  village_exit: 'away',
};

/** Picto d'activité posé en coin d'une case de la frise (les autres activités n'en ont pas). */
export const NEIGHBOUR_ACTIVITY_ICONS: Readonly<Record<string, string>> = {
  work: 'ui-hammer',
  serve: 'ui-coin',
  play: 'chalk-box',
  host: 'birthday-cake',
  wait_train: 'ui-train',
};

/** Métier de chaque habitant en picto (fiche du carnet des voisins). */
export const NEIGHBOUR_JOB_ICONS: Readonly<Record<string, string>> = {
  firmin: 'place-halt',
  odette: 'place-shop',
  basile: 'place-sawmill',
  jeanne: 'chalk-box',
  achille: 'warm-bread',
  solange: 'place-salon',
  lucie: 'mail-letter',
  armand: 'place-school',
  berthe: 'place-mill',
  martial: 'place-church',
  marthe: 'job-bell',
  honorine: 'job-knit',
  ines: 'place-forest',
  barnabe: 'axe',
  mado: 'place-forge',
  paulin: 'place-field',
  margot: 'milk-can',
  leon: 'job-satchel',
  ambroise: 'wall-clock',
  nour: 'place-vet',
  colette: 'place-cafe',
};

/**
 * Lieu d'une étape de quête: l'icône et le libellé de `partner.places`. Seulement les lieux où
 * l'on attend (`stayed_at`) et les bâtiments (`inside`): le lieu d'une énigme (`used_tool_at`,
 * l'ombre de la cloche) est la réponse elle-même, il ne s'affiche jamais.
 */
export const QUEST_PLACES: Readonly<Record<string, { icon: string; place: string }>> = {
  chicken_coop: { icon: 'hen', place: 'hen_pen' },
  garland_west: { icon: 'garland', place: 'square' },
  garland_east: { icon: 'garland', place: 'square' },
  coop_crate: { icon: 'crate', place: 'coop_crate' },
  'building:salon': { icon: 'horn-comb', place: 'building:salon' },
};

/**
 * Icône d'un compteur d'étape sans objet (`nights`, `stall_kind`...), par début de clé. Un compteur
 * d'objet (`given:<habitant>:<objet>`, `caught:<objet>`...) prend l'icône de l'objet.
 */
export const QUEST_COUNTER_ICONS: Readonly<Record<string, string>> = {
  nights: 'ui-moon',
  stall_kind: 'market-stall',
  market_served: 'market-scale',
  market_served_together: 'market-scale',
  milked: 'milk-can',
  goat_grazed_spot: 'goat',
  mail_delivered: 'mail-letter',
  brood_started: 'nest-box',
  brood_hatched: 'nest-box',
  chopped: 'log',
  watered: 'watering-can',
  salon_chair: 'horn-comb',
  haircut_changed: 'horn-comb',
  moment_seen: 'ui-eye',
};
