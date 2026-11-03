/**
 * Contenu du game designer (`donnees/*.json`), une fois lu et contrôlé par
 * `donnees/contenu.ts`. Les noms de champs suivent les fichiers JSON.
 */
import type { CharacterId, CropStage, Quality, Weather } from '../etat/types';
import type {
  AppearanceSettings,
  BakerySettings,
  GrocerSettings,
  HomeContent,
  RoomsSettings,
  SalonSettings,
  SoftNeedsSettings,
  StorageSettings,
} from './maison';
import type { TownSettings } from './bourg';
import type { Currency } from './monnaie';
import type { MarketSettings } from './marche';
import type { MailRoundSettings } from './plis';

/** Comptoir d'Odette (0.12, section 2.2 de `v0-12-conception.md`). */
export interface GrocerPricing {
  buyRate: number;
  dailyCap: number;
  buysAfterFlag: string;
  /** Avant ce jour, prix fixes (`buyRate`, sans saison, offre ni ardoise): la démo reste celle du tour 9. */
  pricesFromDay: number;
  supply: {
    floor: number;
    slope: number;
    /** Chaque aube, le compteur d'unités vendues de chaque article est multiplié par ce facteur (arrondi vers le bas). */
    dawnDecay: number;
    saturation: Record<string, number>;
    categorySaturation: Record<string, number>;
    defaultSaturation: number;
  };
  /** Facteur de saison par article (printemps, été, automne, hiver); absent: 1. */
  seasonFactor: Record<string, readonly [number, number, number, number]>;
  ardoise: { factor: number; max: number; time: number };
  words: { plentyAtMost: number; wantedFrom: number };
}
import type { FishDef, FishingRules } from './poissons';
import type { ClothesContent } from './vetements';

// ---------------------------------------------------------------------------
// Conditions et effets (quêtes, dialogues, envies, emplois du temps)

/**
 * Portée d'un compteur: depuis le début de l'étape de quête, de la journée, ou
 * de la partie. Par défaut: `step_start` dans une quête, `day_start` dans une
 * envie, `game_start` ailleurs (dialogues, emplois du temps, courrier).
 */
export type Since = 'step_start' | 'day_start' | 'game_start';
/** Saisons du calendrier (printemps au jour 1). */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
/**
 * Qui doit l'avoir fait: l'un ou l'autre (cumulé), le joueur concerné, ou chacun des deux;
 * dans une quête à secret (R16), l'informé (`informed`) ou l'autre (`doer`).
 */
export type Who = 'either' | 'actor' | 'both' | 'informed' | 'doer';
/** Rôle d'un joueur dans une quête à secret (R16). */
export type SecretRole = 'informed' | 'doer';

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
  /** Météo de la veille (la brume après la pluie, tour 7); faux le premier jour. */
  | { type: 'weather_was'; weather: Weather }
  /** Saison du jour (calendrier de `reglages.calendar`), pas avant le jour `fromSeasonDay` de la saison. */
  | { type: 'season_is'; seasons: Season[]; fromSeasonDay: number }
  /** Prévision du lendemain (tour 8): la météo tirée du jour suivant. */
  | { type: 'weather_tomorrow_is'; weather: Weather }
  /** Brume du matin aujourd'hui (tour 8, `world.morningMist`). */
  | { type: 'morning_mist' }
  /** Réglage de tendresse entre les personnages au moins égal à `level` (D7). */
  | { type: 'tenderness_at_least'; level: Tenderness }
  /** L'étape est due (son jour et son heure passés) et pas encore franchie. */
  | { type: 'stage_due'; stage: StageId }
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
  /** Observer: entre `minDistance` et `distance` m du point, tourné vers lui (immobile si `still`). */
  | { type: 'looked_at'; point: string; distance: number; minDistance: number; still: boolean; who: Who }
  /** Le joueur concerné a ce rôle dans le secret de cette quête (dialogues réservés à un rôle). */
  | { type: 'secret_role'; quest: string; role: SecretRole }
  /** Poules différentes appelées par leur bon nom (par l'autre, en général). */
  | { type: 'hens_named'; count: number; who: Who }
  /**
   * Un choix fait dans un dialogue personnel: compteur `choice:<dialogue>` (n'importe lequel),
   * `choice:<dialogue>:<choix>` ou `choice:<dialogue>:correct` (un choix juste).
   */
  | { type: 'choice_made'; key: string; count: number; since: Since; who: Who }
  // Tour 9: annonce au tableau en cours (de ce gabarit), chantier bâti, article du catalogue acheté
  | { type: 'annonce_active'; gabarit: string | null; step: string | null }
  | { type: 'improvement_built'; id: string }
  | { type: 'bought'; item: string }
  // Tour 10: dans un bâtiment visitable (ADR 0016), le joueur concerné ou l'un des deux.
  | { type: 'inside'; building: string; who: Who }
  // 0.12 (lot L-quêtes): la bourse commune a au moins cette somme (choix payants d'un dialogue).
  | { type: 'money_at_least'; amount: number }
);

export type Effect =
  | { type: 'give_item'; item: string; count: number; to: 'each' | 'actor' | 'cellar' | SecretRole }
  | { type: 'take_item'; item: string; count: number; from: 'actor' | 'either' | 'cellar' }
  | { type: 'give_money'; amount: number }
  /** 0.12: retire de la bourse commune (jamais sous zéro: un choix payant vérifie `money_at_least`). */
  | { type: 'take_money'; amount: number }
  | { type: 'set_flag'; flag: string }
  | { type: 'start_quest'; quest: string }
  | { type: 'send_letter'; letter: string }
  | { type: 'unlock_recipe'; recipe: string }
  | { type: 'spawn_object'; item: string; point: string }
  /** `shuffleVariantsBy`: les variantes suivent la permutation tirée pour ce groupe (les noms des poules). */
  | { type: 'spawn_animals'; animal: string; count: number; names: string[]; point: string; shuffleVariantsBy: string | null }
  /** Le secret de la quête devient visible des deux joueurs (fin d'une quête secrète). */
  | { type: 'reveal_secret'; quest: string }
  | { type: 'set_need'; need: 'belly' | 'sleep' | 'heart'; value: number; who: 'both' | 'actor' }
  | { type: 'play_dialogue'; dialogue: string }
  | { type: 'gather_players'; point: string }
  | { type: 'show_text'; text: string }
  | { type: 'set_world_state'; key: string; value: string }
  | { type: 'pay_order' }
  /** Écran d'étape (tour 8); `end_demo` des données vaut `end_stage` de l'étape `demo`. */
  | { type: 'end_stage'; stage: StageId }
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
  | 'furniture'
  /** Livré en animal (une poule commandée au catalogue, tour 9). */
  | 'animal_order'
  /** Cadeau pour un habitant (rayon « Pour offrir », tour 9). */
  | 'gift';

export type DishKind = 'bread' | 'simple' | 'stew';

/** Verbe d'un outil (tour 9, section 2.4): un outil amélioré garde celui de l'outil de départ. */
export type ToolKind = 'hoe' | 'watering_can' | 'axe' | 'fishing_rod';

/** Valeurs propres d'un outil (`null`: celles des réglages, comme l'outil de départ). */
export interface ToolStats {
  toolKind: ToolKind;
  /** Coups pour abattre un arbre (hache). */
  chops: number | null;
  /** Attente avant la touche multipliée par ce facteur (canne). */
  biteWaitFactor: number | null;
  /** Fenêtre pour ferrer, en secondes (canne). */
  hookWindowSeconds: number | null;
}

/** Boutiques où s'achète un objet. */
export type ShopId = 'grocery' | 'catalogue' | 'haberdashery';

/** Une place sur le dessus d'un meuble porteur (repère du modèle, mètres). */
export interface SurfacePlace {
  x: number;
  z: number;
}

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
  /** Où il se vend: épicerie d'Odette, catalogue de la coopérative, mercerie de Solange (0.11.2). */
  shop: ShopId | null;
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
  /** Siège (chaise, fauteuil, banc): on s'y assoit comme sur les bancs du bourg (S07). */
  seat: boolean;
  /**
   * Places d'un siège, en mètres le long du meuble depuis son milieu (repère du modèle, X), comme
   * `reglages.benches.slots`; une place au milieu par défaut.
   */
  seatSlots: readonly number[];
  /** Petit objet décoratif (S03): se pose aussi sur le dessus d'un meuble porteur. */
  small: boolean;
  /**
   * Dessus d'un meuble porteur (S03): les places où poser un petit objet, en mètres dans le repère du
   * modèle (X le long, Z vers l'avant), au milieu de l'empreinte. La hauteur se lit dans le modèle.
   * Vide: rien ne s'y pose.
   */
  surface: readonly SurfacePlace[];
  light: boolean;
  /** Se porte à deux (la poutre). */
  carriedByTwo: boolean;
  /** Outil (tour 9): son verbe et ses valeurs, ou `null` pour un objet qui n'en est pas un. */
  tool: ToolStats | null;
  /** Poisson (0.12, `category: "fish"`): rareté, coins, saisons, heures, ombre, textes du carnet. */
  fish: FishDef | null;
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
  /** Saisons où l'on sème (tour 8, section 2.3); une culture semée en saison finit sa pousse. */
  seasons: readonly Season[];
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
  /** Choix juste si cette condition est vraie (`null`: pas de bonne ou de mauvaise réponse). */
  correct: Condition | null;
  /** Réponse de l'habitant à un choix faux (`correct` faux). */
  replyWrong: DialogueLineDef[];
  /** Effets du choix (juste, ou sans `correct`), puis du choix faux. */
  effects: Effect[];
  effectsWrong: Effect[];
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
  /**
   * Scène à deux (tour 10, le miroir de Solange): ce que dit l'habitant après les deux choix, selon
   * qu'ils sont pareils (`same`) ou non (`different`). Absent: rien de plus.
   */
  agreement?: { same: DialogueLineDef[]; different: DialogueLineDef[] };
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
  /** Objectif vu par chaque rôle d'une quête à secret (`objective` reste le texte par défaut). */
  objectiveByRole: { informed: string; doer: string } | null;
  conditions: Condition[];
  effects: Effect[];
  /** `at_deadline`: l'étape se résout à l'échéance, pas avant (la commande). */
  resolve: 'on_conditions' | 'at_deadline';
  deadline: { day: number; time: number } | null;
  onDeadline: Effect[];
  failText: string | null;
}

/** Charge de quête portée à deux (`reglages.carry.quests`). */
export interface QuestLoadDef {
  item: string;
  from: string;
  to: string;
  quest: string;
  step: string;
  when: Condition[];
  flag: string;
  /** Message de `textes.messages` à la pose, chez les deux (`null`: aucun). */
  placedText: string | null;
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
  /** Information propre à un seul joueur (R16), ou `null`. */
  secret: QuestSecretDef | null;
  /**
   * `each_train` (tour 8): la quête redémarre aussitôt finie, pour le train suivant; une étape
   * `at_deadline` sans `deadline` échoit au départ de ce train. `{day}`: le jour de ce train.
   */
  repeat: 'each_train' | null;
  /**
   * 0.12: la quête se retire d'elle-même, sans reproche, au premier `weekday` à `time` après son
   * démarrage (message `text` de `textes.messages`); elle peut redémarrer plus tard. `null`: jamais.
   */
  expire: { weekday: number; time: number; text: string } | null;
}

/**
 * Secret d'une quête (R16): au démarrage, un seul joueur (l'informé) le reçoit, l'autre agit.
 * `card.lines`: une liste de textes, ou une liste par variante (`of` > 1). `{secret}` et
 * `{henColor1}`... sont permis dans les lignes.
 */
export interface QuestSecretDef {
  id: string;
  /** `turn`: le joueur dont c'est le tour (`world.secrets.turn`). */
  informed: 'turn' | CharacterId;
  variantGroup: string;
  of: number;
  card: { title: string; lines: string[] | string[][] };
  /** La fiche apparaît chez l'informé quand cette condition devient vraie (`null`: dès le démarrage). */
  revealOn: Condition | null;
  /** Coup de coude chez l'informé après `secrets.nudgeAfterErrors` erreurs (clé de `textes.messages`). */
  nudge: string | null;
  /** Vignette du souvenir de la quête finie (onglet Souvenirs): symbole du sprite, `null`: générique. */
  vignette: string | null;
}

// ---------------------------------------------------------------------------
// Moments rares (`moments.json`, tour 6)

/**
 * Image clé d'une chorégraphie: `[t, x, y, z, clip]`, et un cap facultatif (radians, comme
 * `facing`) tenu par une bête à l'arrêt; `null` en x ou y: la position courante.
 */
export type MomentKeyframe = [number, number | null, number | null, number, string | null, number?];

/** Conditions de l'apogée: deux joueurs dans le rayon de la cible, dans la pose demandée. */
export interface MomentWatch {
  radius: number;
  minRadius: number;
  holdSeconds: number;
  still: boolean;
  facing: boolean;
  seated: boolean;
  /** Banc où s'asseoir (`seated`), objet de la carte, ou `null`. */
  bench: string | null;
  /** Places à tenir (geste « tenir »), points de la carte, ou `null`. */
  hold: string[] | null;
  /** `anchor` (le point du moment) ou l'identifiant d'un acteur qui bouge. */
  target: string;
  /** Chacun regarde l'autre, à `LOOK_CONE` près (`"facing": "partner"`, la brume). */
  facingPartner: boolean;
  /** De part et d'autre de l'eau: l'un à au plus `at - gap`, l'autre à au moins `at + gap` sur l'axe. */
  opposite: { axis: 'x' | 'y'; at: number; gap: number } | null;
  /** « Un, deux, trois, soleil » (la chevrette): le compteur ne tourne que pendant un regard. */
  freeze: MomentFreeze | null;
  /** Tour 9 (la dame blanche): les deux joueurs à au plus cette distance l'un de l'autre (m), ou `null`. */
  closeTogether: number | null;
  /** Tour 9 (les lanternes): deux allumages, un à chaque place, à moins de `gapSeconds` l'un de l'autre. */
  syncPress: { places: string[]; gapSeconds: number } | null;
  /**
   * Tour 9 (le salut du mécanicien): les places tenues `holdSeconds` arment le moment (`seconds` de
   * descente des lisses, cases `cells` fermées, joueur poussé vers `pushToward`), puis l'apogée part
   * à l'heure `climaxAt`.
   */
  arm: { seconds: number; climaxAt: number; liftAt: number; cells: { x: number; y: number; w: number; h: number }; pushToward: [number, number] } | null;
}

/**
 * La bête lève la tête de temps en temps (`etat/moments.ts`, `freezeState`); qui bouge à moins de
 * `moments.noticeRadius` pendant un regard, ou passe sous `watch.minRadius`, l'effarouche.
 */
export interface MomentFreeze {
  /** Acteur qui regarde (son point d'attente est la cible). */
  actor: string;
  everySeconds: [number, number];
  lookSeconds: number;
  lookClip: string;
  /** Premier regard après l'arrivée (s depuis le début de l'attente). */
  firstAfterSeconds: number;
  /** Recul (m) vers `startleToward`, sans dépasser ce point; clip et sons de l'effarouchement. */
  startleBack: number;
  startleToward: [number, number];
  startleClip: string;
  startleSeconds: number;
  /** Elle broute au point de recul, puis revient à son point (vitesse de marche, m/s). */
  resumeAfterSeconds: number;
  walkSpeed: number;
  walkClip: string;
  sounds: [number, string][];
  /** Message aux deux joueurs quand elle s'effarouche (clé de `textes.messages`), ou `null`. */
  startleText: string | null;
}

/** Une chorégraphie en images clés (apogée, départ, arrivée). */
export interface MomentChoreography {
  seconds: number;
  keyframes: Record<string, MomentKeyframe[]>;
  fadeLastSeconds: number;
  sounds: [number, string][];
  /** Habitants qui tournent la tête vers la cible. */
  lookers: string[];
  /** L'échelle: la chorégraphie se fige si un joueur lâche, avant `pauseBefore` s. */
  pauseWhenReleased: boolean;
  pauseBefore: number;
  /** Formation en V des oies (section 1.4.2), lue par le rendu; `null` sinon. */
  formation: { fromSeconds: number; toSeconds: number; spacing: number; armAngleDeg: number } | null;
  /** Teinte de la lumière pendant l'apogée (la brume dorée), montée en `inSeconds`, rendue en `outSeconds` après. */
  lightGrade: { color: string; force: number; inSeconds: number; outSeconds: number } | null;
}

export interface MomentActorDef {
  id: string;
  model: string;
  count: number;
  /** Point de l'attente. */
  at: string;
  /** Décalages `[dx, dy]` des membres d'un groupe (`count` > 1). */
  offsets: [number, number][];
  facing: number;
  idle: string;
  /**
   * Un geste de temps en temps pendant l'attente: un clip, ou un passage de l'apogée rejoué
   * (`segment`, le plongeon manqué du martin-pêcheur), avec ses sons datés depuis son début.
   */
  idleExtra: { clip: string; everySeconds: [number, number]; segment: [number, number] | null; sounds: [number, string][] } | null;
  /** Hauteur de l'attente au-dessus du sol ou de l'eau (le faon couché dans l'herbe, le martin-pêcheur sur son pieu). */
  z: number;
  arrive: MomentChoreography | null;
  collisionRadius: number;
  /**
   * Rayon (m) où la bête se promène autour de son point pendant l'attente (le renard qui mulote):
   * la zone d'où les joueurs sont repoussés le couvre, pour qu'elle ne les traverse pas. 0 sinon.
   */
  roam: number;
  /**
   * Timidité: `hideAway`, la bête file à `stepTo` et disparaît jusqu'au retour (le martin-pêcheur),
   * sinon elle y fait un pas de côté (le héron); `sounds` partent au début.
   */
  shy: {
    distance: number;
    clip: string;
    stepTo: [number, number] | null;
    stepClip: string | null;
    returnAfterSeconds: number;
    hideAway: boolean;
    sounds: [number, string][];
  } | null;
  /** Habitant joué par cet acteur pendant le moment (Basile sur l'échelle), ou `null`. */
  villager: string | null;
  /**
   * Garde son `facing` pendant les chorégraphies au lieu de se tourner dans le sens du mouvement
   * (Basile face à l'échelle, qui en descend et recule sans se retourner).
   */
  keepFacing: boolean;
}

export interface MomentDef {
  id: string;
  tier: 'P0' | 'P1';
  name: string;
  mode: 'quest' | 'ambient' | 'both';
  quest: string | null;
  /** Étape de la quête pendant laquelle l'apogée peut partir (`null`: toute la quête). */
  questStep: string | null;
  anchor: string;
  weight: number;
  maxPerSeason: number | null;
  /** Fenêtre propre en jours (`null`: `moments.cooldownDays`, puis `cooldownDaysLong`). */
  cooldownDays: number | null;
  /** Fenêtre propre à partir de `moments.longFromDay` (tour 9: le héron et le renard), sinon la règle commune. */
  longCooldownDays: number | null;
  /** `only`: seulement les jours du train (le salut du mécanicien); `never`: jamais ces jours-là. */
  trainDays: 'never' | 'only';
  availableWhen: Condition[];
  present: { from: number; to: number };
  window: { from: number; to: number };
  watch: MomentWatch;
  questWatch: MomentWatch | null;
  actors: MomentActorDef[];
  climax: MomentChoreography;
  /** État d'après l'apogée: où se tient chaque acteur et ce qu'il joue (`null`: l'attente reprend). */
  after: { actors: Record<string, { at: string | null; idle: string | null }> } | null;
  leave: MomentChoreography | null;
  sounds: { idle: { id: string; everySeconds: [number, number]; range: number }[] };
  /**
   * Clés de `textes.json`. `rumor`: la rumeur du bourg (onglet Souvenirs), `null` si le moment
   * n'en a pas (l'échelle); `vignette`: texte de remplacement de la vignette; `missed` (0.12.2):
   * dit aux deux quand un moment de quête attendu (étape en cours) s'en va sans apogée, il
   * revient le lendemain (`null`: rien).
   */
  texts: { hint: string | null; climax: string; memory: string; rumor: string | null; vignette: string | null; missed: string | null };
  /** Vignette du souvenir: symbole du sprite des icônes (`null`: vignette générique). */
  vignette: string | null;
  hintFrom: string | null;
  reward: { heart: number; money: number };
  /** Effets à l'apogée (le drapeau du nichoir redressé). */
  effects: Effect[];
  /** Valeurs propres au rendu (lumières des vers luisants...), lues telles quelles par le rendu. */
  render: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Courrier, astuces, envies, textes

export interface LetterDef {
  id: string;
  from: string;
  title: string;
  /** `null`: seulement par un effet (ou chaque semaine, `instance`); sinon arrivée à ce jour et cette heure. */
  delivery: { day: number; time: number } | null;
  /**
   * Lettre hebdomadaire (tour 8): une instance par train (`<id>@<jour du train>`). `time`: arrivée
   * à cette heure le jour où la commande du train est tirée (aussitôt si elle est passée); `null`:
   * seulement par un effet.
   */
  instance: { kind: 'train'; time: number | null } | null;
  text: string;
  variants: { when: Condition[]; text: string }[];
  /** Variantes tirées par la graine parmi celles dont `when` tient, jamais celle de la fois d'avant. */
  variantsNoRepeat: boolean;
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
  | { on: 'letter_received' }
  /** Tour 8: une cueillette posée à moins de 6 m (`forage_hint`). */
  | { on: 'near_forage' }
  /** Tour 8: on vise un rejet ou un jeune sapin (`sapling_hint`). */
  | { on: 'aim_sapling' }
  /** Tour 9: une annonce au tableau, à moins de 6 m du tableau du quai (`board_hint`). */
  | { on: 'near_board_annonce' }
  /** Pêche 0.12: première prise au coin qui frémit, premier guet (`fishing_hot_spot`, `fishing_watch`). */
  | { on: 'fishing_hot_spot' }
  | { on: 'fishing_watch' };

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

/** Étapes de la partie (tour 8, section 1.1). */
export type StageId = 'demo' | 'summer_end' | 'autumn_end';
export interface StageDef {
  id: StageId;
  day: number;
  /** Minutes depuis minuit. */
  time: number;
  /** Bloc de `textes.stages`. */
  texts: StageId;
}
/** Rythme de la journée (R14): vif (l'ancienne journée), normal, paisible. */
export type ClockPace = 'vif' | 'normal' | 'paisible';

/** Rythme de l'horloge à partir d'un jour (D1), appliqué à l'aube. */
export interface ClockStep {
  fromDay: number;
  secondsPerGameMinute: number;
}
/** Soleil, nuages, pluie (en %). */
export type WeatherOdds = readonly [sunny: number, cloudy: number, rain: number];
export interface WeatherSettings {
  /** Premier jour tiré (le jour après la dernière météo écrite). */
  fromDay: number;
  draw: Record<Season, WeatherOdds>;
  target: Record<Season, WeatherOdds>;
  persistence: number;
  maxRainStreak: number;
  maxDaysWithoutSun: number;
  forced: readonly { day: number; weather: Weather }[];
  logDays: number;
  biteWaitFactor: Record<Weather, number>;
  mist: { afterRain: number; base: Record<Season, number>; fadeFrom: number; until: number; biteWaitFactor: number };
}
export type OrderFamily = 'potager' | 'basse-cour' | 'cuisine' | 'rivière' | 'bois' | 'lisière';
export type OrderResource = 'garden' | 'eggs' | 'river' | 'wood' | 'forage';
export interface OrderProduct {
  item: string;
  family: OrderFamily;
  resource: OrderResource;
  cost: number;
  min: number;
  /** Prix de la commande; `null`: le prix de vente de l'objet. */
  price: number | null;
  seasons: readonly Season[];
  /** Compteur du duo qui dit que le produit est obtenu (`harvested:radish`). */
  obtained: string;
  leadDays: number;
}
/** Commande du samedi générée (tour 8, sections 4.2 à 4.7). */
export interface GeneratedOrderSettings {
  fromOrder: number;
  linesByOrder: readonly { from: number; lines: number }[];
  minLines: number;
  maxPerFamily: number;
  minFamilies: number;
  maxRepeatFromPrevious: number;
  weights: { absentFamily: number; neverOrdered: number; twoOrdersAgo: number };
  budget: { start: number; stepOnComplete: number; max: number; afterMiss: number; afterTwoMisses: number; floor: number };
  size: { current: string; factors: Record<string, number> };
  resources: {
    garden: number;
    eggs: number;
    river: number;
    wood: number;
    resourceCap: number;
    minLineShare: number;
    forageCap: number;
    forageShare: number;
    woodPlanksPerTree: number;
    woodCap: number;
    woodMinTrees: number;
  };
  paymentPerWorkWeek: number;
  noSharedBase: Record<string, readonly string[]>;
  products: readonly OrderProduct[];
  /** Tour 9 (section 2.11): coût d'un poisson selon la saison de la commande, tiré des poids des poissons. */
  fishCostFromWeights: boolean;
  fishCostReferenceSeason: Season;
  /**
   * Pêche 0.12 (section 8.2): coût d'une ligne de poisson = `riverUnitCost / part`, la part du poisson
   * dans les prises de la saison de production (`fishShareBySeason`); `null`: la règle du tour 9.
   */
  riverUnitCost: number | null;
  fishShareBySeason: Partial<Record<Season, Record<string, number>>>;
  /** Quantités arrondies au rendement d'une case (radis, carottes). */
  roundTo: Record<string, number>;
  /** Plafond de chaque ligne. */
  lineMax: Record<string, number>;
  /** Part perdue au plafond au-delà de laquelle la commande gagne une ligne (`null`: jamais). */
  extraLineMinShare: number | null;
  /** Lignes au plus d'une commande (ligne ajoutée comprise). */
  maxLines: number;
  /** Œufs d'une poule par semaine de commande (la capacité suit le nombre de poules); `null`: `resources.eggs`. */
  eggsPerHenPerWeek: number | null;
}
export interface ForagePoint {
  point: string;
  items: readonly string[];
}
export interface ForageItem {
  item: string;
  seasons: readonly Season[];
  /** Jours de saison où elle pousse (tour 9, le sureau: 1 à 14), `null`: toute la saison. */
  days: readonly [number, number] | null;
  weight: number;
  count: readonly [number, number];
}
/** Cueillette de la lisière (tour 8, section 5.2). */
export interface ForageSettings {
  fromDay: number;
  spawnChance: number;
  unseenFactor: number;
  /** Coups de pouce du lendemain de pluie (girolles, cèpes). */
  rainBoost: readonly { item: string; factor: number }[];
  points: readonly ForagePoint[];
  items: readonly ForageItem[];
}
/** Arbres de la lisière (tour 8, section 5.1): abattage, puis souche, rejet et arbre adulte. */
export interface TreeSettings {
  chopsPerTree: number;
  logsPerTree: number;
  /** Les arbres abattus repoussent (`false`: une souche pour toujours, comme la démo). */
  regrow: boolean;
  /** Rien ne repousse avant ce jour. */
  regrowFromDay: number;
  /** Une souche abattue avant `regrowFromDay` compte au plus ce nombre de jours d'avance ce jour-là. */
  catchUpDays: number;
  /** Jours de souche, puis jours de rejet (ou de jeune sapin), avant l'arbre adulte. */
  stumpDays: number;
  saplingDays: number;
  /** Taille du rejet (part de l'arbre adulte): le premier jour, la pousse par jour, le plafond. */
  saplingScale: { first: number; perDay: number; max: number };
}
/** Envies (HA-07, tour 8 section 5.4). */
export interface EnvieSettings {
  /** Une envie personnelle ne revient pas pour un joueur avant ce nombre de jours. */
  noRepeatWindowDays: number;
  /** À partir de `sharedFromDay`: poids d'une envie personnelle jamais reçue par ce joueur multiplié par ce facteur. */
  unseenFactor: number;
  /** Envie à deux tirée un jour sur `sharedEveryDays` à partir de ce jour (`null`: seulement `sharedSchedule`). */
  sharedFromDay: number | null;
  sharedEveryDays: number;
  /** Une envie à deux tirée ne revient pas avant ce nombre de jours. */
  sharedNoRepeatDays: number;
}
/** Répliques du quotidien (tour 8, section 5.5). */
export interface DialogueSettings {
  /** Une réplique datée (priorité `feel.dailyStoryPriority` ou plus) n'est prioritaire que si ce joueur ne l'a pas entendue depuis ce nombre de jours. */
  datedRepeatDays: number;
  /** Jour à partir duquel la règle s'applique (la démo garde la sienne). */
  datedRepeatFromDay: number;
}
/**
 * Rangement de la nuit (QA8-02): à partir de `fromDay`, ce qui traîne par terre (piles tombées
 * d'un sac plein) rentre au coffre pendant la nuit, et deux piles du même objet au même endroit
 * n'en font qu'une. `null`: rien ne se range (la démo).
 */
export interface TidySettings {
  fromDay: number | null;
}
export type ContinuationMode = 'same_save' | 'new_game_per_stage';
/** D7: tendresse entre les personnages, du moins au plus. */
export type Tenderness = 'none' | 'accomplices' | 'gentle';

export interface Settings {
  profile: string;
  /** Calendrier (tour 8): saisons de `seasonDays` jours, le jour 1 ouvre le printemps. */
  calendar: { seasonDays: number; seasonsPerYear: number };
  clock: {
    /** Rythme du jour 1 (le premier pas de `schedule`). */
    secondsPerGameMinute: number;
    /** Rythme par jour (D1), dans l'ordre des jours. */
    schedule: ClockStep[];
    /** Rythme choisi (R14): multiplie les secondes par minute de jeu de `schedule` par `paces[pace]`. */
    pace: ClockPace;
    paces: Record<ClockPace, number>;
    dayStart: number;
    dayEnd: number;
    veilleeFrom: number;
    firstDay: { day: number; start: number };
    lastDay: { day: number; end: number };
    stopWhenBothInMenu: boolean;
  };
  /** Trains écrits (`days`), puis un tous les `repeatEveryDays` jours après le dernier (0: aucun). */
  train: { days: number[]; repeatEveryDays: number; arrival: number; departure: number; saluteSlowRoll: boolean };
  /** Météo écrite des jours 1 à `weather.fromDay - 1`. */
  weatherByDay: Weather[];
  /** Météo tirée (tour 8, section 3). */
  weather: WeatherSettings;
  /** Étapes de la partie, dans l'ordre (tour 8). */
  stages: StageDef[];
  /** D4: la partie de la démo continue dans la même sauvegarde. */
  continuation: { mode: ContinuationMode };
  /** D7. */
  tenderness: Tenderness;
  spawn: { point: string };
  /** 0.12: les plis de Lucie (section 2.4), `null` sans tournée. */
  mailRound: MailRoundSettings | null;
  economy: {
    startPurse: number;
    /** La monnaie (0.12): nom, accord et icône, lus par `monnaie.ts`. */
    currency: Currency;
    bigPurchaseThreshold: number;
    grocer: GrocerPricing;
    /**
     * Une fenêtre de commande par semaine, dans l'ordre (la livraison arrive par le train); après
     * la dernière, une fenêtre par semaine (`repeatWeekly`, tour 8), ou aucune (`null`).
     */
    catalogue: {
      windows: CatalogueWindow[];
      repeatWeekly: { deadlineWeekday: number; deadlineTime: number; deliveryTime: number } | null;
    };
  };
  order: {
    /** Une commande par train du samedi qui emporte la caisse, dans l'ordre des jours. */
    trains: OrderDef[];
    extraItemsRate: number;
    /** Commandes tirées après les commandes écrites (tour 8), ou `null`. */
    generated: GeneratedOrderSettings | null;
  };
  trees: TreeSettings;
  /** Cueillette (tour 8), ou `null`. */
  forage: ForageSettings | null;
  hens: { eggsPerHenPerDay: number; feedRequired: boolean; max: number; care: HenCareSettings | null };
  /** La chèvre au piquet (0.12, section 4.3); `null`: pas de chèvre. */
  goats: GoatSettings | null;
  /** Tableau des annonces (tour 9, section 1); `null`: pas de tableau. */
  board: BoardSettings | null;
  /** Chantiers (tour 9, section 2.6); `null`: pas de chantiers. */
  improvements: ImprovementSettings | null;
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
    /** Tour 10 (section 3): besoins doux, lus sous les mêmes clés de `reglages.needs`. */
    soft: SoftNeedsSettings;
  };
  /** Tour 10 (section 4): pièces à bâtir; `null`: aucune. */
  rooms: RoomsSettings | null;
  /** Tour 10 (section 5): rangement à cases et râtelier; `null`: coffre sans limite, comme avant. */
  storage: StorageSettings | null;
  /** Tour 10 (sections 1.5, 1.6, 2): fournil, salon, épicerie et apparence (règles du lot L3). */
  bakery: BakerySettings | null;
  salon: SalonSettings | null;
  grocer: GrocerSettings | null;
  appearance: AppearanceSettings | null;
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
  /** `twoPlayersRecipes` (0.12, section 2.5): recettes faites deux fois plus vite à deux devant le même poste. */
  building: { twoPlayersSpeedMultiplier: number; twoPlayersRecipes: string[] };
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
    /**
     * Longueur (m) des charges longues, par objet (la poutre): on les prend n'importe où le long de
     * leur axe, un bout chacun (retour S01). Absente: charge ramassée, prise depuis son centre.
     */
    lengths: Record<string, number>;
    /**
     * Où se met chaque porteur d'une charge longue en la soulevant: à `side` m de son axe, du côté
     * où il était, et à `fromEnd` m au moins de chaque bout (les mains sur le bois, pas dans le vide).
     * `reach`: portée (m) jusqu'à l'axe d'une charge longue, plus courte que `feel.beamGrabRange`
     * (comptée depuis le centre d'une charge ramassée): Espace tenu au chantier voisin ne soulève
     * pas la poutre couchée à côté.
     */
    grip: { side: number; fromEnd: number; reach: number };
    /**
     * 0.12: charges de quête, portées à deux de `from` à `to` pendant l'étape `step` de `quest`, quand
     * `when` est vrai (conditions évaluées dans l'étape); posées, elles lèvent `flag`.
     */
    quests: QuestLoadDef[];
  };
  /** Envies (HA-07, tour 8 section 5.4). */
  envies: EnvieSettings;
  /** Répliques du quotidien (tour 8, section 5.5). */
  dialogues: DialogueSettings;
  /** Rangement de la nuit (QA8-02). */
  tidy: TidySettings;
  /** Bancs de la carte: places, assise et lever (`reglages.benches`, défauts dans `defauts.ts`). */
  benches: BenchSettings;
  /** Rue Haute (tour 10): fournil, salon, heures d'Odette, apparence (`bourg.ts`, défauts de la conception). */
  town: TownSettings;
  fishing: {
    castRange: number;
    /**
     * Distance visée du lancer (m, retour R09 du 2026-11-01): le bouchon se pose aussi loin
     * dans l'eau, sans dépasser la rive d'en face (marge `castShoreMargin`); à défaut, au
     * premier point d'eau. Sans valeur: le premier point d'eau (avant R09).
     */
    castDistance: number | null;
    /** Distance gardée entre le bouchon et la fin de l'eau sur la ligne du lancer (m). */
    castShoreMargin: number;
    biteWaitSeconds: [number, number];
    hookWindowSeconds: number;
    /** Drapeau posé au début de la partie: il ouvre les dialogues et la quête de la pêche. */
    flag: string;
    /** Pêche de la 0.12: raretés, ombres, coin qui frémit, guet, grands (`poissons.ts`). */
    rules: FishingRules;
  } | null;
  /** Moments rares (`reglages.moments`, tour 6). */
  moments: MomentSettings;
  /** Informations propres à un seul joueur (`reglages.secrets`, R16). */
  secrets: SecretSettings;
  /** Souvenirs du carnet et calendrier des saisons (`reglages.memories`, tour 7). */
  memories: MemorySettings;
  /** Valeurs de ressenti que `reglages.json` ne fixe pas encore (voir `defauts.ts`). */
  feel: FeelSettings;
}

export interface BoardSettings {
  fromDay: number;
  /** Affiches: jour de la semaine (index de `weekdayOf`, 0 samedi) et sorte. */
  post: readonly { weekday: number; kind: AnnonceKind }[];
  postTime: number;
  /** Jours de l'annonce, jour de l'affiche compris (échéance à `deadlineTime` du dernier). */
  deadlineDays: number;
  deadlineTime: number;
  noRepeatDays: number;
  weights: { neverPosted: number; sameGiver: number };
  reward: Record<AnnonceKind, AnnonceReward>;
  keepDone: number;
}

/** Récompense d'une annonce (section 1.4): facteur x valeur + ajout, arrondi, bornée; Cœur à deux. */
export interface AnnonceReward {
  factor: number;
  add: number;
  min: number;
  max: number;
  round: number;
  heart: number;
}

export interface ImprovementSettings {
  /** `quest` (0.12): la file n'ouvre qu'une fois cette quête commencée (la chevrerie avec la trame). */
  queues: Record<ImprovementQueue, { opensFromDay: number; quest?: string }>;
  /** Versements proposés au tableau (en plus de « le reste »). */
  steps: readonly number[];
  plankDiscount: number;
  plankDiscountMax: number;
}

export interface MomentSettings {
  dailyChance: number;
  maxPerDay: number;
  cooldownDays: number;
  firstAmbientDay: number;
  noAmbientOnTrainDays: boolean;
  /** Vitesse au sol sous laquelle on est « immobile » (m/s). */
  stillSpeed: number;
  noticeRadius: number;
  heartBonus: number;
  musicDuckDb: number;
  musicDuckInSeconds: number;
  musicDuckOutSeconds: number;
  firstHint: CharacterId;
  maxSyncGapSeconds: number;
  /** Agir à moins de tant d'une place libre de l'échelle la prend (m). */
  holdRange: number;
  /** Niveaux de moments tirés au matin (`["P0"]`: les P1 ne sortent pas). */
  tiers: ('P0' | 'P1')[];
  /** Tour 7 (section 1.2): aucun moment d'ambiance les jours de fête. */
  noAmbientOnFestivalDays: boolean;
  festivalDays: number[];
  /** Fenêtre longue à partir de `longFromDay` (J2); la démo et J1 gardent `cooldownDays`. */
  cooldownDaysLong: number;
  longFromDay: number;
  /** Dès `longFromDay`: chance du jour x min(1, réserve de la saison / `seasonPoolFull`). */
  seasonPoolFull: number;
  /** Dès `longFromDay`: poids d'un moment jamais vu ensemble multiplié par ce facteur. */
  unseenWeightFactor: number;
}

export interface SecretSettings {
  firstInformed: CharacterId;
  nudgeAfterErrors: number;
  firstTryHeart: number;
  henChoiceRange: number;
  henChoiceKeepOpen: number;
  hideFromGuestSnapshot: boolean;
  /** Drapeau posé à la reprise d'une sauvegarde où les poules avaient déjà leurs noms: la quête des noms ne démarre pas. */
  knownHensFlag: string;
}

/** Souvenirs du carnet (tour 7, section 2): calendrier des saisons et borne de taille. */
export interface MemorySettings {
  /** Jours par saison (le jour 1 ouvre le printemps de la première année). */
  seasonDays: number;
  /** Saisons par année. */
  seasonsPerYear: number;
  /** Taille maximale de `world.memories` en JSON (octets), contrôlée par les tests (S-14). */
  maxBytes: number;
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
  /**
   * Habitants qui passent le ru au gué de pierres, en sautant (Jeanne, `carte-halte.md`). Les autres
   * prennent le pont, la passerelle ou le ponceau (retour S04: Achille semblait marcher dans l'eau).
   */
  steppingStoneVillagers: string[];
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
  /** Poids par saison (tour 8, section 5.3); une saison absente garde `fishWeights`. */
  fishWeightsBySeason: Partial<Record<Season, Record<string, number>>>;
}

export type AnnonceKind = 'help' | 'together';

/** Une ligne demandée par une annonce. */
export interface AnnonceLine {
  item: string;
  count: number;
}

/** Gabarit d'annonce (`annonces.json`, tour 9, table 1.3). */
export interface AnnonceDef {
  id: string;
  kind: AnnonceKind;
  giver: string;
  seasons: readonly Season[];
  /** Jours de saison où elle peut s'afficher (`odette_elder`: 1 à 10), `null`: toute la saison. */
  seasonDays: readonly [number, number] | null;
  /** Variantes (une seule pour la plupart): la ligne de `odette_shelf` est tirée parmi les obtenues. */
  variants: readonly (readonly AnnonceLine[])[];
  /** Scène à deux qui finit l'annonce (après les dons), ou `null`. */
  scene: string | null;
  /** Objet unique donné la première fois (au coffre), ou `null`. */
  unique: string | null;
  /** Scène jouée la première fois en plus (le dessin de Jeanne), ou `null`. */
  uniqueScene: string | null;
}

export type ImprovementQueue = 'bourg' | 'maisonnette' | 'elevage';

/** Bonheur d'une bête (0.12, sections 4.2 et 4.3): points sur 100, jamais sous `floor`. */
export interface HappinessSettings {
  start: number;
  /** Par aube. */
  drift: number;
  floor: number;
  max: number;
  /** Seuils des mots: « Ravie » à partir de `happy`, « Tranquille » à partir de `calm`, sinon « Ébouriffée ». */
  happy: number;
  calm: number;
}

/** Soins de la basse-cour (0.12, section 4.2), dans `reglages.hens.care`. */
export interface HenCareSettings {
  happiness: HappinessSettings & {
    /** Bonheur des poules d'une partie reprise (migration). */
    migration: number;
    fed: number;
    straw: number;
    /** La litière compte fraîche tant qu'elle a au plus tant de jours. */
    strawDays: number;
    pet: number;
    callByName: number;
    /** En dessous: un œuf un jour sur deux. */
    everyOtherBelow: number;
    /** À partir de: bel œuf (`fine`). */
    fineFrom: number;
    /** À partir de: la poule veut couver. */
    broodFrom: number;
  };
  /** Capacité du poulailler agrandi (chantier `coop_extension`). */
  maxExtended: number;
  extensionImprovement: string;
  grain: {
    item: string;
    rations: number;
    perHen: number;
    /** Avant ce jour, le grain de la mangeoire est fourni (démo inchangée). */
    fromDay: number;
    /** Sans grain, en ces saisons, un œuf un jour sur deux (« elles picorent le pré »). */
    forageSeasons: readonly Season[];
    /** Article du catalogue qui nourrit à l'aube tant qu'il reste des rations. */
    hopper: string;
  };
  petRange: number;
  straw: { item: string; seconds: number };
  brood: {
    eggs: number;
    nights: number;
    hatchChance: number;
    roosterlingChance: number;
    seasons: readonly Season[];
    lastSeasonDay: number;
    growNights: number;
    colorMother: number;
    colorGolden: number;
  };
  /** Les six couleurs de la collection, dans l'ordre du carnet. */
  colors: readonly string[];
  goldenColor: string;
  roosterVariant: string;
  /** Noms proposés (trois tirés sans redite). */
  roosterNames: readonly string[];
  chickNames: readonly string[];
}

/** La chèvre (0.12, section 4.3), `reglages.goats`. */
export interface GoatSettings {
  happiness: HappinessSettings & {
    freshGraze: number;
    /** Une place est fraîche si elle n'a pas été broutée depuis tant de jours. */
    freshDays: number;
    water: number;
    brush: number;
    heldMilking: number;
    milkNoneBelow: number;
    milkTwoFrom: number;
  };
  max: number;
  shedImprovement: string;
  milkItem: string;
  /** Traite de `milkFrom` à `milkUntil` (minutes du jour). */
  milkFrom: number;
  milkUntil: number;
  milkSeconds: number;
  heldMilkSeconds: number;
  ropeLength: number;
  followDistance: number;
  followSpeedFactor: number;
  homeAt: number;
  outAt: number;
  speed: number;
  pailItem: string;
  /** Places de pâture (points de la carte). */
  spots: readonly string[];
  /** Distance minimale d'une place au rail le plus proche (m). */
  railClearance: number;
  names: readonly string[];
  /** Article du catalogue de la deuxième chèvre. */
  extraItem: string;
}

/** Chantier (`chantiers.json`, tour 9, table 2.6). */
export interface ImprovementDef {
  id: string;
  queue: ImprovementQueue;
  order: number;
  price: number;
  model: string;
  /** Cases occupées une fois bâti (vide: sans emprise au sol, l'auvent). */
  cells: readonly { cx: number; cy: number }[];
  /** Cap en degrés (convention de la conception: 0 nord, 90 est, 180 sud). */
  rotation: number;
  /** Drapeau posé à la construction (`<id>_built`). */
  flag: string;
  /** Point où le chantier se paie: le tableau du quai (bourg) ou l'établi de Basile (maisonnette, planches acceptées). */
  payAt: 'board' | 'basile';
}

/** Le catalogue de la semaine (`catalogue.json`, tour 9, section 2.3). */
export interface CatalogueDef {
  pages: readonly { season: Season; week: number; items: readonly string[] }[];
  gifts: readonly { item: string; villager: string; wish: string; thanks: string; quest: string }[];
  copies: Record<string, number>;
  seasonal: Record<string, Season>;
  /** Poules commandées (`hen_extra`...): nom, variante, réplique de Jeanne qui la nomme. */
  hens: Record<string, { name: string; variant: string; naming: string }>;
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
  /** Moments rares (`moments.json`), vide si le fichier manque. */
  moments: MomentDef[];
  /** Tour 9: gabarits d'annonces, chantiers, catalogue de la semaine (absents: rien de tout cela). */
  annonces: AnnonceDef[];
  improvements: ImprovementDef[];
  catalogue: CatalogueDef | null;
  /** Tour 10: pièces à bâtir et fenêtres de la maisonnette (`pieces.json`), vides si le fichier manque. */
  home: HomeContent;
  /** 0.12: le marché du dimanche (`marche.json`), `null` si le fichier manque. */
  market: MarketSettings | null;
  /** 0.12: vêtements (`vetements.json`) et réglages de la garde-robe (`reglages.json`: `wardrobe`). */
  clothes: ClothesContent;
}
