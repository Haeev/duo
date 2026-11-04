/**
 * Identifiants du contenu auxquels le code se réfère directement (objets,
 * points, constructions). Ils existent dans `donnees/` et dans la carte; le
 * test du contenu vérifie qu'ils y sont.
 */
export const ITEM = {
  hoe: 'hoe',
  axe: 'axe',
  wateringCan: 'watering_can',
  log: 'log',
  egg: 'egg',
  fishingRod: 'fishing_rod',
  /** 0.13: le cordeau, pour poser et reprendre les parcelles. */
  gardenLine: 'garden_line',
  /** 0.13: la parcelle de la vitrine d'Odette (jamais dans un sac: l'achat monte le compteur). */
  plot: 'plot',
} as const;

export const POINT = {
  well: 'well',
  waterBarrel: 'water_barrel',
  /** 0.13 (parcelles libres, lot P5): le puisage du bief, au bord de la friche. Absent des anciennes cartes. */
  millraceDraw: 'millrace_draw',
  groceryCounter: 'grocery_counter',
  groceryInsideCounter: 'grocery_inside_counter',
  /** La place du client au comptoir intérieur, face à Odette. */
  groceryCustomer: 'grocery_customer',
  noticeBoard: 'notice_board',
  coopCrate: 'coop_crate',
  workbench: 'sawmill_workbench',
  henFeeder: 'hen_feeder',
  chickenCoop: 'chicken_coop',
  /** 0.12: la botte de paille de la litière, la porte de la chevrerie. */
  strawBale: 'straw_bale',
  goatShed: 'goat_shed',
  trainStop: 'train_stop',
  offstage: 'offstage',
} as const;

/**
 * Points où l'habitant se tient sur la case même, derrière un meuble où les joueurs n'entrent pas
 * (Odette au guichet de son comptoir): son trajet s'arrête à la case libre voisine, puis il y passe.
 */
export const VILLAGER_BEHIND_POINTS: ReadonlySet<string> = new Set([POINT.groceryInsideCounter]);

/**
 * Le râtelier des outils (tour 10, section 5): au mur sud de la pièce, entre la porte (8, 26) et la
 * fenêtre sud-est (`window_1`, case 10, 25), à portée de main en entrant. Place fixe, jamais reprise.
 */
/**
 * Le râtelier (1,6 m de large) au mur ouest de la pièce, entre le coin nord et la fenêtre (R15,
 * 2026-11-03): à sa place d'avant, au mur sud près de la porte, il passait devant la fenêtre est de
 * la façade; aucun pan du mur sud n'a sa largeur entre la porte et les fenêtres.
 */
export const TOOL_RACK = { id: 'f_rack', item: 'tool_rack', cell: { cx: 6, cy: 23 }, rotation: 1 } as const;
/** Place du râtelier avant la 0.12.2, déplacé à la reprise d'une sauvegarde. */
export const OLD_TOOL_RACK_CELL = { cx: 9, cy: 25 } as const;

/** Points d'apparition de chaque personnage à la descente du train (sinon le point de `reglages.spawn`). */
export const SPAWN_POINTS = { p1: 'spawn_1', p2: 'spawn_2' } as const;

export const ZONE = {
  henPen: 'hen_pen',
  /** Cases occupées par le train à quai, infranchissables tant qu'il est là. */
  trainAtPlatform: 'train_at_platform',
} as const;

/** États nommés du monde. */
export const WORLD_STATE = { handcarShed: 'handcar_shed' } as const;

/** Quête de l'énigme (fait marquant de fin: la clé trouvée). */
export const QUEST = { riddle: 'emile_riddle', order: 'saturday_order' } as const;
