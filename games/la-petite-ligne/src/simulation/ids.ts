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
} as const;

export const POINT = {
  well: 'well',
  waterBarrel: 'water_barrel',
  groceryCounter: 'grocery_counter',
  noticeBoard: 'notice_board',
  coopCrate: 'coop_crate',
  workbench: 'sawmill_workbench',
  henFeeder: 'hen_feeder',
  chickenCoop: 'chicken_coop',
  trainStop: 'train_stop',
  offstage: 'offstage',
} as const;

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
