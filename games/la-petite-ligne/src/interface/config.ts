/**
 * Réglages de l'interface (durées, seuils, correspondances d'icônes et
 * couleurs des portraits). Les valeurs de jeu restent dans `donnees/`.
 */
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

/** Symbole du sprite pour chaque objet (`ui-maquettes/icones.svg`). */
export const ITEM_ICONS: Readonly<Record<ItemId, string>> = {
  radish_seed: 'seed-radish',
  lettuce_seed: 'seed-lettuce',
  carrot_seed: 'seed-carrot',
  radish: 'radish',
  lettuce: 'lettuce',
  carrot: 'carrot',
  dandelion: 'dandelion',
  egg: 'egg',
  log: 'log',
  plank: 'plank',
  nail: 'nail',
  mattress: 'mattress',
  beam: 'beam',
  hoe: 'hoe',
  watering_can: 'watering-can',
  axe: 'axe',
  bread: 'bread',
  crunchy_radishes: 'radish',
  // Un plat, pas l'œuf de la ligne voisine de la commande.
  omelette: 'soup',
  vegetable_soup: 'soup',
  iron_box: 'tin-box',
  riddle_card: 'riddle-card',
  riddle_card_2: 'riddle-card',
  emile_logbook: 'ui-notebook',
  lucie_letter: 'ui-letter',
  gudgeon: 'fish',
  trout: 'fish',
  fishing_rod: 'fishing-rod',
  shed_key: 'key',
  old_photo: 'photo',
  straw_mattress: 'straw-bed',
  double_bed: 'double-bed',
  table: 'table',
  chair: 'chair',
  chest: 'chest',
  shelf: 'shelf',
  stove: 'stove',
  flower_pot: 'flower-pot',
  oil_lamp: 'oil-lamp',
  rug: 'rug',
  curtains: 'curtains',
  crystal_radio: 'crystal-radio',
  wood_stove: 'wood-stove',
  picture_frame: 'picture-frame',
  // Tour 9: les outils améliorés gardent le dessin de leur verbe, les poules commandées celui de la poule.
  watering_can_copper: 'watering-can',
  axe_forged: 'axe',
  fishing_rod_bamboo: 'fishing-rod',
  hen_extra: 'hen',
  hen_extra_2: 'hen',
  wicker_armchair: 'chair',
  pressed_flowers: 'picture-frame',
  jeanne_drawing: 'picture-frame',
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
export type HairStyle = 'short' | 'bob' | 'bun' | 'cap' | 'villager_bun' | 'beard' | 'braids';

export interface PortraitColors {
  skin: string;
  shade: string;
  hair: string;
  top: string;
  trim: string;
  scarf: string;
  style: HairStyle;
  bg: string;
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
};

/** Coiffures des joueurs (index `appearance.hair`), comme les modèles du rendu (court, carré, chignon). */
export const PLAYER_HAIRS: readonly HairStyle[] = ['short', 'bob', 'bun'];

/** Tenues des joueurs (index `appearance.outfit`): couleurs de `src/rendu/apparence.ts` (`OUTFITS`). */
export const PLAYER_OUTFITS: readonly { top: string; trim: string; bg: string }[] = [
  { top: '#5C7FA6', trim: '#EDE6D3', bg: '#D9E3EC' },
  { top: '#B5663F', trim: '#EDE6D3', bg: '#EADBCF' },
  { top: '#8BA37B', trim: '#F1EBDB', bg: '#E1E8DA' },
  { top: '#D4A746', trim: '#F3ECDA', bg: '#F1E6CC' },
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

/** Plumage de l'icône d'une poule, par variante (`animals.hen` de `objets.json`): blanche, rousse, noire. */
export const HEN_COLORS: Readonly<Record<string, string>> = {
  hen_white: '#f1ead9',
  hen_red: '#b5652f',
  hen_black: '#3b3430',
};

/** Icône de la météo. */
export const WEATHER_ICONS: Readonly<Record<string, string>> = {
  sunny: 'weather-sun',
  cloudy: 'weather-cloud',
  rain: 'weather-rain',
};
