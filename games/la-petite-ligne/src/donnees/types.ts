/**
 * Contenu du game designer (`donnees/*.json`), une fois lu et contrôlé par
 * `donnees/contenu.ts`. Les noms de champs suivent les fichiers JSON.
 */
import type { CropStage, Quality, Weather } from '../etat/types';

// ---------------------------------------------------------------------------
// Conditions et effets (quêtes, dialogues, envies, emplois du temps)

/**
 * Portée d'un compteur: depuis le début de l'étape de quête, de la journée, ou
 * de la partie. Par défaut: `step_start` dans une quête, `day_start` dans une
 * envie, `game_start` ailleurs (dialogues, emplois du temps, courrier).
 */
export type Since = 'step_start' | 'day_start' | 'game_start';
/** Qui doit l'avoir fait: l'un ou l'autre (cumulé), le joueur concerné, ou chacun des deux. */
export type Who = 'either' | 'actor' | 'both';

/**
 * Condition, après lecture. Les conditions qui comptent des actions des
 * données (`sowed`, `harvested`, `given`, `talked_to`, `ate`...) deviennent
 * une condition `counter` sur une clé de `Counters` (voir `etat/types.ts`).
 * `label` sert de ligne à cocher au carnet.
 */
export type Condition = { label?: string } & (
  | { type: 'all'; conditions: Condition[] }
  | { type: 'any'; conditions: Condition[] }
  | { type: 'not'; condition: Condition }
  | { type: 'day_is'; days: number[] }
  | { type: 'day_at_least'; day: number }
  | { type: 'weekday_is'; weekdays: number[] }
  | { type: 'time_is'; from: number; to: number }
  | { type: 'weather_is'; weather: Weather }
  | { type: 'flag'; flag: string }
  | { type: 'quest_active'; quest: string }
  | { type: 'quest_done'; quest: string }
  | { type: 'step_active'; quest: string; step: string }
  | { type: 'quest_step_done'; quest: string; step: string }
  | { type: 'dialogue_done'; dialogue: string }
  | { type: 'item_owned'; item: string; count: number }
  | { type: 'item_in_bag'; item: string; count: number; who: Who }
  | { type: 'built'; construction: string }
  | { type: 'recipe_known'; recipe: string }
  /** La commande du train de ce jour (`day`), sinon la commande en cours. */
  | { type: 'order_complete'; day: number | null }
  | { type: 'counter'; key: string; count: number; since: Since; who: Who }
  | { type: 'used_tool_at'; tool: string; point: string; radius: number }
  /** Rester près d'un point; `seated`: assis sur un banc à portée du point (`ranges.stayAt`), pendant `seconds`. */
  | { type: 'stayed_at'; point: string; seconds: number; who: Who; seated: boolean }
  /** Variante tirée par la graine pour ce groupe (de 0 à `of` - 1): buts d'après-midi, aléa par partie. */
  | { type: 'variant'; group: string; value: number; of: number }
  /** Observer: à moins de `distance` m du point et tourné vers lui. */
  | { type: 'looked_at'; point: string; distance: number; who: Who }
);

export type Effect =
  | { type: 'give_item'; item: string; count: number; to: 'each' | 'actor' | 'cellar' }
  | { type: 'take_item'; item: string; count: number; from: 'actor' | 'either' | 'cellar' }
  | { type: 'give_money'; amount: number }
  | { type: 'set_flag'; flag: string }
  | { type: 'start_quest'; quest: string }
  | { type: 'send_letter'; letter: string }
  | { type: 'unlock_recipe'; recipe: string }
  | { type: 'spawn_object'; item: string; point: string }
  | { type: 'spawn_animals'; animal: string; count: number; names: string[]; point: string }
  | { type: 'set_need'; need: 'belly' | 'sleep' | 'heart'; value: number; who: 'both' | 'actor' }
  | { type: 'play_dialogue'; dialogue: string }
  | { type: 'gather_players'; point: string }
  | { type: 'show_text'; text: string }
  | { type: 'set_world_state'; key: string; value: string }
  | { type: 'pay_order' }
  | { type: 'end_demo' }
  | { type: 'if'; condition: Condition; then: Effect[]; else: Effect[] };

// ---------------------------------------------------------------------------
// Objets

export type ItemCategory =
  | 'seed'
  | 'crop'
  | 'forage'
  | 'animal_product'
  | 'material'
  | 'carried'
  | 'tool'
  | 'food'
  | 'quest'
  | 'fish'
  | 'decoration'
  | 'furniture';

export type DishKind = 'bread' | 'simple' | 'stew';

export interface ItemDef {
  id: string;
  name: string;
  plural: string;
  /** Avec l'article indéfini (« un matelas », « des rideaux »), pour les messages; `null`: le nom seul. */
  indefinite: string | null;
  /** Pas en vente (épicerie ou catalogue) avant ce jour; `null`: dès le début. */
  availableFromDay: number | null;
  category: ItemCategory;
  stack: number;
  buyPrice: number | null;
  sellPrice: number | null;
  shop: 'grocery' | 'catalogue' | null;
  model: string;
  tier: 'P0' | 'P1';
  plants: string | null;
  capacity: number | null;
  dish: DishKind | null;
  readText: string | null;
  footprint: { w: number; d: number } | null;
  comfort: number;
  beauty: number;
  bed: { sleep: number; sleepers: number } | null;
  station: string | null;
  storage: string | null;
  /** Se pose au sol sous les autres meubles (tapis). */
  floor: boolean;
  /** Se pose contre un mur (rideaux). */
  wall: boolean;
  /** Meuble à tuyau (poêle): se pose dos à un mur, tourné vers la pièce. */
  backToWall: boolean;
  /** Table: le souper pris ensemble à côté compte comme souper partagé. */
  dining: boolean;
  seat: boolean;
  light: boolean;
  /** Se porte à deux (la poutre). */
  carriedByTwo: boolean;
}

export interface RecipeDef {
  id: string;
  name: string;
  station: 'workbench' | 'stove';
  inputs: { item: string; count: number }[];
  output: { item: string; count: number };
  seconds: number;
  requiresUnlock: boolean;
}

export interface ConstructionElementDef {
  id: string;
  inputs: { item: string; count: number }[];
  seconds: number;
}

export interface ConstructionDef {
  id: string;
  name: string;
  point: string;
  kind: 'carry' | 'guided';
  requires: string[];
  carry: { item: string; from: string } | null;
  elements: ConstructionElementDef[];
}

export interface AnimalDef {
  id: string;
  name: string;
  variants: string[];
  produces: { item: string; count: number };
}

// ---------------------------------------------------------------------------
// Cultures

export interface CropDef {
  id: string;
  name: string;
  seed: string;
  harvest: string;
  growthDays: number;
  yieldPerCell: number;
  stagesByDay: CropStage[];
}

export interface QualityDef {
  id: Quality;
  name: string;
  priceMultiplier: number;
}

// ---------------------------------------------------------------------------
// Habitants et dialogues

export interface ScheduleEntry {
  when: Condition[];
  from: number;
  to: number;
  point: string;
  activity: string;
}

export interface DialogueLineDef {
  speaker: string;
  text: string;
}

export interface DialogueChoiceDef {
  id: string;
  text: string;
  reply: DialogueLineDef[];
}

export type DialogueKind = 'scene' | 'meeting' | 'quest' | 'daily' | 'hint' | 'ending';

export interface DialogueDef {
  id: string;
  villager: string;
  kind: DialogueKind;
  shared: boolean;
  point: string | null;
  once: 'duo' | 'player' | null;
  priority: number;
  tier: 'P0' | 'P1';
  when: Condition[];
  lines: DialogueLineDef[];
  choices: DialogueChoiceDef[];
  effects: Effect[];
}

export interface VillagerDef {
  id: string;
  firstName: string;
  lastName: string;
  label: string;
  role: string;
  model: string;
  scale: number;
  soundMotif: string;
  schedule: ScheduleEntry[];
  dialogues: DialogueDef[];
}

// ---------------------------------------------------------------------------
// Quêtes

export interface QuestStepDef {
  id: string;
  objective: string;
  conditions: Condition[];
  effects: Effect[];
  /** `at_deadline`: l'étape se résout à l'échéance, pas avant (la commande). */
  resolve: 'on_conditions' | 'at_deadline';
  deadline: { day: number; time: number } | null;
  onDeadline: Effect[];
  failText: string | null;
}

export interface QuestDef {
  id: string;
  kind: 'main' | 'side';
  tier: 'P0' | 'P1';
  title: string;
  giver: string;
  /** Démarrage automatique quand `when` est vrai; `byEffect`: seulement par un effet. */
  start: { when: Condition[]; byEffect: boolean; effects: Effect[] };
  steps: QuestStepDef[];
  completionEffects: Effect[];
  completionText: string;
}

// ---------------------------------------------------------------------------
// Courrier, astuces, envies, textes

export interface LetterDef {
  id: string;
  from: string;
  title: string;
  /** `null`: seulement par un effet; sinon arrivée à ce jour et cette heure. */
  delivery: { day: number; time: number } | null;
  text: string;
  variants: { when: Condition[]; text: string }[];
}

export type HintTrigger =
  | { on: 'spawned' }
  | { on: 'near_interactable' }
  | { on: 'tool_used' }
  | { on: 'near_point'; point: string }
  | { on: 'near_construction' }
  | { on: 'quest_started'; quest: string }
  | { on: 'aim_cell'; cellState: 'grass' | 'tilled'; tool?: string; holding?: string }
  | { on: 'sowed' }
  | { on: 'tool_empty'; item: string }
  | { on: 'crop_ripe_in_view' }
  | { on: 'time_reached'; time: number }
  | { on: 'veillee_started' }
  | { on: 'holding_furniture' }
  | { on: 'big_purchase_attempt' }
  | { on: 'letter_received' };

export interface HintDef {
  id: string;
  text: string;
  trigger: HintTrigger;
  tier: 'P0' | 'P1';
}

export interface EnvieDef {
  id: string;
  kind: 'personal' | 'shared';
  text: string;
  availableWhen: Condition[];
  fulfilledWhen: Condition[];
}

export interface Texts {
  form: { level: string; name: string; text: string }[];
  messages: Record<string, string>;
  orderFormat: { line: string; separator: string; lastSeparator: string };
  weekdays: string[];
  weather: Record<string, string>;
  /** Le reste (`ui`, `nightScreen`, `endScreen`) est lu tel quel par l'interface. */
  raw: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Réglages (`reglages.json`, profil « démo »)

export interface CatalogueWindow {
  orderDeadline: { day: number; time: number };
  delivery: { day: number; time: number };
}

/** La commande d'un train (EC-08): lignes, et prix de la ligne remplie et de la commande complète. */
export interface OrderDef {
  /** Jour du train qui l'emporte (départ à `train.departure`). */
  day: number;
  lines: { item: string; count: number }[];
  linePremium: number;
  fullBonus: number;
}

export interface Settings {
  profile: string;
  clock: {
    secondsPerGameMinute: number;
    dayStart: number;
    dayEnd: number;
    veilleeFrom: number;
    firstDay: { day: number; start: number };
    lastDay: { day: number; end: number };
    stopWhenBothInMenu: boolean;
  };
  train: { days: number[]; arrival: number; departure: number };
  weatherByDay: Weather[];
  spawn: { point: string };
  economy: {
    startPurse: number;
    bigPurchaseThreshold: number;
    grocer: { buyRate: number; dailyCap: number; buysAfterFlag: string };
    /** Une fenêtre de commande par semaine, dans l'ordre (la livraison arrive par le train). */
    catalogue: { windows: CatalogueWindow[] };
  };
  order: {
    /** Une commande par train du samedi qui emporte la caisse, dans l'ordre des jours. */
    trains: OrderDef[];
    extraItemsRate: number;
  };
  trees: { chopsPerTree: number; logsPerTree: number };
  hens: { eggsPerHenPerDay: number; feedRequired: boolean };
  endurance: {
    base: number;
    perFormPoint: number;
    costMultiplier: number;
    atZeroDurationMultiplier: number;
    costs: Record<string, number>;
  };
  snacks: Record<string, number>;
  needs: {
    belly: { none: number; bread: number; simple: number; stew: number; stewPlusDish: number };
    sleep: { midnightPenalty: number };
    heart: { base: number; envie: number; sharedEnvie: number; ateTogether: number; gestureTogether: number; max: number };
    formWeights: { belly: number; sleep: number; heart: number };
    formLevels: { level: string; below: number }[];
  };
  movement: { walkSpeed: number; carrySpeedTogether: number; carrySpeedOneMoving: number };
  ranges: {
    action: number;
    talk: number;
    gesture: number;
    together: number;
    witness: number;
    /** Repas pris ensemble: distance entre les deux (défaut dans `defauts.ts`). */
    eatTogether: number;
    /** « Rester à un point »: rayon (défaut dans `defauts.ts`). */
    stayAt: number;
  };
  building: { twoPlayersSpeedMultiplier: number };
  hints: { durationSeconds: number };
  absence: { minutes: number };
  /** Pêche (P1): `null` si `reglages.json` ne la décrit pas. */
  /** Gestes à deux de la semaine 2 (`reglages.carry`): draisine poussée et colis lourd; `null` si absents. */
  carry: {
    /** `path`: points de passage sur les rails, en décalages (m) depuis `from`; le dernier est l'arrêt. */
    handcar: {
      item: string;
      from: string;
      path: [number, number][];
      /** Le point d'arrêt (dernier de `path`), pour le rendu de démonstration. */
      toOffset: [number, number];
      /** Emprise de la draisine posée (m): longueur dans l'axe de la voie, largeur en travers. Elle bloque ces cases. */
      size: [number, number];
      quest: string;
      step: string;
      flag: string;
    } | null;
    parcel: { item: string; from: string; to: string } | null;
  };
  /** Envies (HA-07): une envie ne revient pas pour un joueur avant ce nombre de jours. */
  envies: { noRepeatWindowDays: number };
  /** Bancs de la carte: places, assise et lever (`reglages.benches`, défauts dans `defauts.ts`). */
  benches: BenchSettings;
  fishing: {
    castRange: number;
    biteWaitSeconds: [number, number];
    hookWindowSeconds: number;
    /** Drapeau posé au début de la partie: il ouvre les dialogues et la quête de la pêche. */
    flag: string;
  } | null;
  /** Valeurs de ressenti que `reglages.json` ne fixe pas encore (voir `defauts.ts`). */
  feel: FeelSettings;
}

/** S'asseoir sur un banc de la carte (modèle `bench`). */
export interface BenchSettings {
  /** Places le long du banc, en mètres depuis son milieu (deux places: jamais deux corps sur la même). */
  slots: number[];
  /** Décalage du milieu de l'assise vers l'avant depuis l'origine du modèle (m). */
  seatForward: number;
  /** On se relève devant sa place, à cette distance de l'assise (m), sur une case libre. */
  standForward: number;
  /** Espace près d'une place libre, à moins de cette distance (m), fait s'asseoir. */
  sitRange: number;
  /** Un habitant arrêté à cette distance du banc (m, au-delà de son emprise) y est assis. */
  villagerReach: number;
}

/**
 * Réglages de ressenti, avec des valeurs par défaut dans `defauts.ts`; une clé
 * `feel` dans `reglages.json` les remplace une à une.
 */
export interface FeelSettings {
  /** Durée des gestes simples, en secondes. */
  actionSeconds: Record<string, number>;
  /** Durée d'entrée et de départ du train (glissement), en secondes réelles. */
  trainSlideSeconds: number;
  /** Rayon autour d'un point pour « y être » (rendez-vous, comptoir), en mètres. */
  pointRadius: number;
  /** Distance à la poutre pour la soulever. */
  beamGrabRange: number;
  /** Rayon d'arrivée de la poutre sur son emplacement. */
  beamDropRadius: number;
  /** Vitesse de marche des habitants (m/s). */
  villagerSpeed: number;
  /** Vitesse des poules (m/s). */
  henSpeed: number;
  /** Fenêtre de « Déjà pris par... » après une récolte (s). */
  alreadyTakenSeconds: number;
  /** Répliques quotidiennes de priorité au moins égale: datées (jour du train, pluie), dites d'abord, une fois par jour. */
  dailyStoryPriority: number;
  /** Mémoire d'un appui (Espace, clic à portée) reçu pendant un geste: joué à la fin du geste s'il a moins de tant (s). */
  inputBufferSeconds: number;
  /** Espace tenu sur le potager: pause minimale entre la fin d'un geste et le geste sur la case suivante (s). */
  heldRepeatSeconds: number;
  /** Nombre de notifications gardées par joueur. */
  notificationsKept: number;
  /** Minutes avant le départ du train pour l'annonce « dans une heure ». */
  trainWarningMinutes: number;
  /** Durée d'un repère planté (GE-07: 15 s). */
  pinSeconds: number;
  /** Poids de tirage des poissons (CN-04: commun 6, peu commun 3, rare 1). */
  fishWeights: Record<string, number>;
}

export interface Content {
  settings: Settings;
  items: Record<string, ItemDef>;
  recipes: Record<string, RecipeDef>;
  constructions: ConstructionDef[];
  startingInventory: {
    cellar: { item: string; count: number }[];
    eachPlayer: { item: string; count: number }[];
    houseFurniture: { item: string; count: number }[];
  };
  animals: Record<string, AnimalDef>;
  crops: Record<string, CropDef>;
  qualities: Record<Quality, QualityDef>;
  villagers: VillagerDef[];
  /** Tous les dialogues, indexés par identifiant. */
  dialogues: Record<string, DialogueDef>;
  quests: QuestDef[];
  letters: Record<string, LetterDef>;
  senders: Record<string, string>;
  hints: HintDef[];
  envies: EnvieDef[];
  sharedEnvieSchedule: { day: number; envie: string }[];
  texts: Texts;
}
