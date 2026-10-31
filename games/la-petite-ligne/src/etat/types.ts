/**
 * État du monde de La Petite Ligne (démo).
 *
 * C'est le contrat entre la simulation (qui seule l'écrit) et le rendu et
 * l'interface (qui le lisent). Le rendu et l'interface reçoivent une
 * `ReadonlyWorld` et ne la modifient jamais: toute intention d'un joueur passe
 * par une `Intent` (voir `actions.ts`).
 *
 * Conventions:
 * - Unités: mètres, une case de la grille vaut 1 m. Repère du sol: x vers l'est,
 *   y vers le sud (comme le document de la démo). En Three.js: x du monde vers
 *   +X, y du monde vers +Z, la hauteur sur +Y.
 * - Une case (cx, cy) couvre [cx, cx + 1[ x [cy, cy + 1[ ; son centre est
 *   (cx + 0,5, cy + 0,5). Les positions des personnages sont des réels.
 * - Orientation (`facing`): angle en radians dans le plan du sol, 0 vers +x
 *   (est), PI/2 vers +y (sud). En Three.js: `rotation.y = -facing` pour un
 *   modèle qui regarde +X au repos.
 * - Interpolation: chaque objet mobile porte `pos` (après le dernier pas) et
 *   `prev` (avant ce pas). Position affichée = prev + (pos - prev) * alpha, avec
 *   `alpha` donné par `GameView.alpha()`.
 * - Temps: `tick` compte les pas de simulation (fréquence: `SIM_HZ` de
 *   `simulation/constantes.ts`). Les heures du jeu sont en minutes depuis
 *   minuit (0 à 1440).
 * - Tout l'état est du JSON pur (ni Map, ni Set, ni classe): il se sauvegarde
 *   et se transmet tel quel.
 */
import type { Effect } from '../donnees/types';

// ---------------------------------------------------------------------------
// Utilitaires de type

/** Version profonde en lecture seule, pour le rendu et l'interface. */
export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** Ce que lisent le rendu et l'interface. */
export type ReadonlyWorld = DeepReadonly<WorldState>;

export interface Vec2 {
  x: number;
  y: number;
}

/** Case de la grille (coordonnées entières). */
export interface Cell {
  cx: number;
  cy: number;
}

// ---------------------------------------------------------------------------
// Identifiants

/** Les deux personnages. `p1` est créé par le premier joueur lié, pas forcément l'hôte. */
export type CharacterId = 'p1' | 'p2';
export const CHARACTER_IDS: readonly CharacterId[] = ['p1', 'p2'];

/** Taille du sac (PE-10) et de la barre d'outils (ses premières cases). */
export const BAG_SLOTS = 24;
export const TOOLBAR_SLOTS = 10;

/** Identifiant stable du joueur fourni par la plateforme (membre du duo). */
export type PlayerId = string;

/** Identifiants de contenu (voir `donnees/*.json`). */
export type ItemId = string;
export type CropId = string;
export type VillagerId = string;
export type QuestId = string;
export type DialogueId = string;
export type LetterId = string;
export type RecipeId = string;
export type ConstructionId = string;
export type PointId = string;
export type EnvieId = string;
export type HintId = string;

export type Quality = 'ordinary' | 'fine';
export type Weather = 'sunny' | 'cloudy' | 'rain';

// ---------------------------------------------------------------------------
// Racine

export interface WorldState {
  /** Format de la sauvegarde (`dataSchema`). */
  schema: number;
  /** Pas de simulation écoulés depuis la création du monde. */
  tick: number;
  /** Augmente à chaque changement discret (hors déplacements): sert au réseau. */
  revision: number;
  /** Graine de la session et état du générateur (sfc32 du SDK, jamais `Math.random`). */
  seed: number;
  rng: [number, number, number, number];
  phase: Phase;
  clock: ClockState;
  weather: Weather;
  weatherTomorrow: Weather;
  characters: Character[];
  garden: GardenCell[];
  trees: Tree[];
  /** Poutre du toit (geste à deux « porter »). `null` une fois posée. */
  beam: Beam | null;
  constructions: ConstructionState[];
  /** Meubles posés dans la pièce de la maisonnette. */
  furniture: PlacedFurniture[];
  /** Objets posés au sol (boîte en fer, œufs, piles tombées d'un sac plein). */
  groundItems: GroundItem[];
  villagers: VillagerState[];
  hens: Hen[];
  /** La mangeoire a été remplie aujourd'hui (les œufs viennent le lendemain matin). */
  feederFilled: boolean;
  train: TrainState;
  /** Bourse commune, en sous, jamais négative. */
  purse: number;
  /** Coffre de la maisonnette (cellier commun). */
  cellar: ItemStack[];
  /** Caisse de la coopérative sur le quai. */
  crate: ItemStack[];
  /** Commandes au catalogue, livrées par le train du jour 8. */
  catalogueOrders: ItemId[];
  /** Ventes du jour à l'épicerie (plafond quotidien). */
  grocerSoldToday: number;
  proposals: Proposal[];
  quests: QuestState[];
  letters: Letter[];
  /** Drapeaux posés par les effets (`house_keys`, `grocer_buys`, `eggs_enabled`...). */
  flags: string[];
  /** États nommés du monde (`handcar_shed: open`). */
  worldStates: Record<string, string>;
  unlockedRecipes: RecipeId[];
  /** Dialogues déjà vus: `once: duo` (clé = id) et `once: player` (clé = `id@p1`). */
  dialoguesDone: string[];
  /** Scène à deux en cours (dialogue partagé), ou `null`. */
  scene: SceneState | null;
  /** Compteurs d'actions, par personnage et pour le duo (conditions des quêtes). */
  counters: Counters;
  /** Les mêmes compteurs au début de la journée (conditions « depuis ce matin » des envies). */
  countersAtDawn: Counters;
  /** Suites d'effets en cours (une scène les suspend jusqu'à sa fin). */
  scripts: ScriptState[];
  /** Prochain identifiant unique (meubles, objets au sol, propositions, notifications). */
  nextId: number;
  /** Résultat de la commande, une fois payée au départ du train. */
  orderResult: OrderResult | null;
  /** Récapitulatif de fin, une fois la démo finie. */
  ending: EndingSummary | null;
  /** Statistiques de la séance pour l'historique de la plateforme. */
  session: SessionStats;
}

/**
 * Phases de la démo.
 * - `creation`: écran titre (chacun indique qu'il est prêt: `titleReady`), puis chacun crée son personnage;
 * - `day`: la journée (l'horloge tourne, sauf arrêts de TE-03 et veillée);
 * - `night`: les deux sont couchés, écran de nuit (continuer ou finir);
 * - `breakfast`: 6 h, petit-déjeuner, l'horloge attend que l'un commence;
 * - `ended`: écran de fin de la démo; la séance se clôt quand les deux ont choisi « Continuer » (`endReady`).
 */
export type Phase = 'creation' | 'day' | 'night' | 'breakfast' | 'ended';

export interface ClockState {
  /** Jour de la démo, de 1 (samedi) à 8 (samedi suivant). */
  day: number;
  /** Minutes depuis minuit, réel (6 h = 360, 24 h = 1440). */
  minutes: number;
  /** L'horloge avance-t-elle à ce pas ? */
  running: boolean;
  /** Pourquoi elle est arrêtée (pour l'interface). */
  stoppedBy: ClockStop | null;
  /** La veillée a commencé ce soir (les deux dans la maison après 19 h). */
  veillee: boolean;
}

export type ClockStop =
  | 'creation'
  | 'scene'
  | 'both_busy'
  | 'veillee'
  | 'midnight'
  | 'night'
  | 'breakfast'
  | 'ended'
  | 'absence';

// ---------------------------------------------------------------------------
// Personnages

export interface Appearance {
  /** Coiffure, de 0 à 2. */
  hair: number;
  /** Couleur de la tenue, de 0 à 3. */
  outfit: number;
  /** Couleur du foulard: celle du profil Duo du joueur (CSS, `#rrggbb`). */
  scarf: string;
}

export interface Character {
  id: CharacterId;
  /** Joueur lié (identifiant stable de la plateforme, jamais le rôle hôte/invité). */
  playerId: PlayerId;
  name: string;
  appearance: Appearance;
  /** Création terminée. */
  created: boolean;
  /** Écran titre: ce joueur est prêt (remis à faux à chaque reprise de partie). */
  titleReady: boolean;
  /** Écran de fin: ce joueur a choisi « Continuer ». */
  endReady: boolean;
  pos: Vec2;
  prev: Vec2;
  facing: number;
  /** Vitesse au sol à ce pas (m/s), pour caler l'animation de marche. */
  speed: number;
  /** Dans la pièce de la maisonnette. */
  inHouse: boolean;
  /** Ce que fait le personnage (animation et barre de progression). */
  action: CharacterAction;
  /** Ce qui occupe son joueur (arrêt de l'horloge si les deux sont occupés). */
  status: CharacterStatus;
  /** Menu du jeu ouvert chez ce joueur (déclaré par l'interface). */
  menu: MenuKind | null;
  /** Conversation personnelle en cours (SI-06: chacun la sienne). */
  dialogue: DialogueState | null;
  /** Sac de `BAG_SLOTS` cases; les `TOOLBAR_SLOTS` premières forment la barre d'outils. */
  bag: (ItemStack | null)[];
  /** Case choisie de la barre d'outils (0 à `TOOLBAR_SLOTS` - 1). */
  selected: number;
  /** Eau dans l'arrosoir (0 à la capacité de `objets.json`). */
  water: number;
  /** Meuble tenu en main pour l'aménagement (aperçu fantôme), ou `null`. */
  placement: PlacementPreview | null;
  /** Case visée devant le personnage (surlignage), ou `null` hors de la grille. */
  aim: AimInfo | null;
  /** Destination d'un clic au sol (repère pendant la marche), ou `null`. */
  destination: Vec2 | null;
  endurance: number;
  enduranceMax: number;
  needs: Needs;
  form: FormLevel;
  /** Envie personnelle du jour. */
  envie: EnvieState | null;
  /** Envie à deux du jour (la même chez les deux). */
  sharedEnvie: EnvieState | null;
  /** Lit occupé (identifiant du meuble), quand il dort. */
  bedId: string | null;
  /** Au petit-déjeuner: a commencé sa journée. */
  breakfastDone: boolean;
  /** À l'écran de nuit: son choix. */
  nightChoice: 'continue' | 'finish' | null;
  /** Astuces déjà montrées à ce joueur (une fois chacune). */
  hintsShown: HintId[];
  /** Notifications de ce joueur (les plus récentes à la fin). */
  notifications: GameNotification[];
  /** Ce soir: repas pris pendant la veillée (pour le Ventre). */
  supper: SupperLog;
  /** Retour forcé de minuit ce soir (Sommeil -30). */
  midnightReturn: boolean;
  /** Dernière entrée de ce joueur (touche, clic, intention), pour l'absence (PA-04). */
  lastInputTick: number;
  /** Absent: aucune entrée depuis `reglages.absence.minutes`; l'horloge l'attend et son personnage s'assoit. */
  absent: boolean;
  /** Besoins fixés par un effet pour la prochaine nuit (souper d'Odette), ou `null`. */
  needsSet: { belly: number | null; sleep: number | null; heart: number | null };
  /** Ce qui compte au Cœur aujourd'hui. */
  heartToday: { envie: boolean; sharedEnvie: boolean; ateTogether: boolean; gesture: boolean };
  /** Astuces en attente (une seule à la fois à l'écran). */
  hintQueue: HintId[];
  /** Tick de la dernière astuce montrée. */
  lastHintTick: number;
  /** Secondes passées d'affilée près de chaque point suivi (envies « rester à »). */
  stays: Record<PointId, number>;
  /** Dernier plat mangé ce soir (repas pris ensemble). */
  lastMeal: { item: ItemId; tick: number } | null;
  /** Envies déjà tirées pour ce joueur (jamais deux fois la même). */
  envieHistory: EnvieId[];
  /** Fabrication en cours à l'établi ou au réchaud, ou `null`. */
  crafting: { recipe: RecipeId; endsAt: number } | null;
  /** Repère planté par ce joueur (GE-07), visible chez les deux jusqu'au tick `until`, ou `null`. */
  pin: { pos: Vec2; since: number; until: number } | null;
}

export type CharacterStatus =
  | 'active'
  | 'menu'
  | 'dialogue'
  | 'scene'
  | 'gesture'
  | 'sleeping'
  | 'breakfast'
  | 'night';

/** Menus du jeu que l'interface déclare ouverts (TE-03). */
export type MenuKind =
  | 'notebook'
  | 'shop'
  | 'catalogue'
  | 'crate'
  | 'workbench'
  | 'stove'
  | 'chest'
  | 'proposal'
  | 'letter';

export type ActionKind =
  | 'idle'
  | 'walk'
  | 'carry'
  | 'till'
  | 'sow'
  | 'water'
  | 'harvest'
  | 'chop'
  | 'saw'
  | 'hammer'
  | 'talk'
  | 'sit'
  | 'eat'
  | 'sleep'
  | 'cook'
  | 'feed'
  | 'pickup'
  | 'refill';

export interface CharacterAction {
  kind: ActionKind;
  /** Tick de début (pour caler l'animation). */
  since: number;
  /** Durée prévue en ticks (0 pour une action sans fin: marcher, porter, dormir). */
  duration: number;
  /** Case ou point visé, pour orienter l'outil et placer l'effet. */
  target: Vec2 | null;
}

export interface Needs {
  /** Ventre, fixé par le souper (0 à 100). */
  belly: number;
  /** Sommeil, fixé par le lit (0 à 100). */
  sleep: number;
  /** Cœur, recalculé chaque nuit (0 à 100). */
  heart: number;
}

export type FormLevel = 'low' | 'okay' | 'good' | 'great' | 'radiant';

export interface SupperLog {
  bread: number;
  simple: number;
  stew: number;
}

export interface EnvieState {
  id: EnvieId;
  done: boolean;
}

export interface AimInfo {
  cell: Cell;
  /** Ce que ferait Espace sur cette case, ou `null`. */
  verb: AimVerb | null;
  /** L'action est impossible: raison affichable (« Il faut de l'eau. »). */
  blocked: string | null;
}

export type AimVerb =
  | 'till'
  | 'sow'
  | 'water'
  | 'harvest'
  | 'chop'
  | 'refill'
  | 'talk'
  | 'pickup'
  | 'build'
  | 'carry'
  | 'open'
  | 'sleep'
  | 'feed'
  | 'place'
  | 'give'
  | 'dig';

export interface PlacementPreview {
  item: ItemId;
  /** Case du coin nord-ouest de l'empreinte, une fois tournée. */
  cell: Cell;
  /** Quarts de tour (0 à 3), convention de la carte: 0 face au sud, 1 à l'est, 2 au nord, 3 à l'ouest. */
  rotation: number;
  valid: boolean;
  /** Pourquoi ce n'est pas possible (texte de `textes.json`, clés `placement_*`), ou `null`. Toujours rempli par la simulation. */
  blocked?: string | null;
}

// ---------------------------------------------------------------------------
// Objets

export interface ItemStack {
  item: ItemId;
  quality: Quality;
  count: number;
}

export interface GroundItem {
  id: string;
  item: ItemId;
  quality: Quality;
  count: number;
  pos: Vec2;
}

export interface PlacedFurniture {
  /** Identifiant unique de l'exemplaire (`f1`, `f2`...). */
  id: string;
  item: ItemId;
  /** Coin nord-ouest de l'empreinte tournée, en cases du monde. */
  cell: Cell;
  /** Quarts de tour (0 à 3), convention de la carte: 0 face au sud, 1 à l'est, 2 au nord, 3 à l'ouest. */
  rotation: number;
  /** Qui l'a posé en dernier (`null` pour les meubles de départ). */
  placedBy: CharacterId | null;
}

// ---------------------------------------------------------------------------
// Potager, bois, bêtes

export type CellSoil = 'grass' | 'tilled';

export interface GardenCell {
  /** Index dans le potager (0 à 11). */
  index: number;
  cell: Cell;
  soil: CellSoil;
  /** Arrosée aujourd'hui (arrosoir ou pluie): la culture poussera demain matin. */
  wet: boolean;
  crop: CropState | null;
  /** Dernière récolte sur cette case, pour « Déjà pris par... » (SI-01). */
  lastHarvest: { by: CharacterId; tick: number } | null;
}

export type CropStage = 'seed' | 'sprout' | 'young' | 'ripe';

export interface CropState {
  crop: CropId;
  /** Jours de pousse acquis. */
  days: number;
  stage: CropStage;
  ripe: boolean;
  /** Arrosée chaque jour depuis le semis: récolte « belle ». */
  wateredEveryDay: boolean;
  sownDay: number;
  sownBy: CharacterId;
}

export interface Tree {
  id: string;
  kind: 'oak' | 'fir';
  pos: Vec2;
  /** Coups de hache reçus. */
  hits: number;
  felled: boolean;
  /** Tick du dernier coup (tremblement). */
  lastHitTick: number;
}

export interface Beam {
  pos: Vec2;
  prev: Vec2;
  /** Orientation de la poutre (radians). */
  facing: number;
  /** Portée en ce moment par les deux. */
  carried: boolean;
  /** Qui maintient l'action sur la poutre. */
  holders: CharacterId[];
}

export interface Hen {
  id: string;
  name: string;
  /** Variante de couleur (`hen_white`, `hen_red`, `hen_black`). */
  variant: string;
  pos: Vec2;
  prev: Vec2;
  facing: number;
  /** Vers où elle picore (marche lente). */
  wander: Vec2;
}

// ---------------------------------------------------------------------------
// Construction guidée

export interface ConstructionState {
  id: ConstructionId;
  /** `ghost`: fantômes visibles; `done`: tout est bâti. `locked`: pas encore proposé. */
  status: 'locked' | 'ghost' | 'done';
  elements: ElementState[];
}

export interface ElementState {
  id: string;
  /** 0 à 1. */
  progress: number;
  /** Matériaux déjà pris pour cet élément. */
  paid: boolean;
  done: boolean;
  /** Qui travaille dessus à ce pas (deux: deux fois plus vite). */
  workers: CharacterId[];
}

// ---------------------------------------------------------------------------
// Habitants et dialogues

export interface VillagerState {
  id: VillagerId;
  pos: Vec2;
  prev: Vec2;
  facing: number;
  speed: number;
  /** Visible dans le bourg (faux quand il est « offstage » ou chez lui). */
  visible: boolean;
  /** Point de l'emploi du temps visé et activité (`stand`, `serve`, `work`...). */
  target: PointId;
  activity: string;
  /** En conversation avec ces personnages. */
  talkingWith: CharacterId[];
  /** Le duo lui a parlé (rencontre faite par au moins un des deux). */
  met: boolean;
}

export interface DialogueLineView {
  /** Un habitant, un personnage (`p1`, `p2`) ou `narrator`. */
  speaker: string;
  text: string;
}

export interface DialogueChoiceView {
  id: string;
  text: string;
}

/** Conversation personnelle d'un joueur avec un habitant. */
export interface DialogueState {
  dialogue: DialogueId;
  villager: VillagerId;
  /** Répliques à afficher, dans l'ordre; `line` est l'index courant. */
  lines: DialogueLineView[];
  line: number;
  /** Choix proposés à la fin des répliques, ou vide. */
  choices: DialogueChoiceView[];
}

/** Scène à deux (HA-08): chacun choisit sa réplique et voit le choix de l'autre. */
export interface SceneState {
  dialogue: DialogueId;
  villager: VillagerId;
  lines: DialogueLineView[];
  /** Index courant, commun aux deux. */
  line: number;
  choices: DialogueChoiceView[];
  /** Choix de chacun (identifiant du choix). */
  picks: Partial<Record<CharacterId, string>>;
  /** Qui a demandé la suite de la réplique courante (on avance quand les deux l'ont fait). */
  ready: CharacterId[];
}

// ---------------------------------------------------------------------------
// Train

export type TrainPhase = 'away' | 'arriving' | 'stopped' | 'departing';

export interface TrainState {
  phase: TrainPhase;
  /** 0 à 1 pendant l'entrée ou le départ (glissement), 1 à quai. */
  progress: number;
  prevProgress: number;
}

// ---------------------------------------------------------------------------
// Économie

export interface Proposal {
  id: string;
  by: CharacterId;
  /** Ce qui sera acheté si l'autre accepte. */
  purchase: PurchaseRequest;
  /** Somme réservée pendant l'attente. */
  price: number;
}

export interface PurchaseRequest {
  source: 'grocery' | 'catalogue';
  item: ItemId;
  count: number;
}

export interface OrderResult {
  linesDone: number;
  linesTotal: number;
  complete: boolean;
  /** Somme versée à la bourse au départ du train. */
  amount: number;
}

// ---------------------------------------------------------------------------
// Quêtes, courrier, notifications

export interface QuestState {
  id: QuestId;
  status: 'active' | 'done';
  /** Étape en cours (index dans `quetes.json`); égal au nombre d'étapes une fois finie. */
  step: number;
  /** Sous-objectifs de l'étape en cours (conditions munies d'un `label`). */
  checklist: { label: string; done: boolean }[];
  /** Valeurs des compteurs au début de l'étape (conditions « depuis le début de l'étape »). */
  baselines: Record<string, number>;
  startedDay: number;
}

export interface Letter {
  id: LetterId;
  day: number;
  title: string;
  from: string;
  /** Texte final, variables remplacées. */
  text: string;
  read: CharacterId[];
}

export type NotificationKind = 'hint' | 'message' | 'quest' | 'letter' | 'proposal' | 'envie';

export interface GameNotification {
  /** Identifiant unique (ordre d'arrivée). */
  id: number;
  kind: NotificationKind;
  /**
   * Texte prêt à afficher. Les astuces gardent des jetons de touches
   * (`{move}`, `{act}`, `{examine}`, `{notebook}`) que l'interface remplace par
   * les libellés réels du clavier.
   */
  text: string;
  /** Astuce d'origine, pour les astuces. */
  hint: HintId | null;
  /** Proposition d'achat liée, pour les propositions. */
  proposal: string | null;
  /** Clé du message dans `textes.json` (`already_taken`...) ou identifiant de l'astuce; `null` pour un texte composé. */
  key: string | null;
  tick: number;
}

// ---------------------------------------------------------------------------
// Compteurs, fin, séance

/**
 * Compteurs d'actions. Clés: `sowed`, `watered`, `harvested`, `harvested:radish`,
 * `harvested:q:fine`, `chopped`, `crafted:saw_plank`, `given:odette:radish`,
 * `talked:jeanne`, `placed`, `placed:table`, `ate:omelette`, `nights`,
 * `bed:double_bed`, `caught:trout`, `stayed:riverbank` (secondes), `witnessed:train_arrival`.
 */
export interface Counters {
  duo: Record<string, number>;
  p1: Record<string, number>;
  p2: Record<string, number>;
}

export interface EndingSummary {
  days: number;
  linesDone: number;
  linesTotal: number;
  furniturePlaced: number;
  keyFound: boolean;
}

export interface SessionStats {
  /** Jour au début de la séance (historique: « du 3 au 5 »). */
  firstDay: number;
  /** Gestes à deux, envies à deux réalisées et soupers partagés. */
  togetherMoments: number;
  /** Faits marquants (60 caractères au plus), trois au plus. */
  highlights: string[];
}

/** Suite d'effets des données, exécutée dans l'ordre; `actor`: le joueur concerné. */
export interface ScriptState {
  effects: Effect[];
  actor: CharacterId | null;
}

// ---------------------------------------------------------------------------
// Événements ponctuels (sons, effets), hors de l'état

/**
 * Ce qui vient d'arriver à ce pas: le rendu et le son s'en servent pour les
 * retours immédiats (tableau 5.2 du cahier). Ils ne sont pas sauvegardés.
 */
export type WorldEvent =
  | { type: 'tilled'; by: CharacterId; cell: Cell }
  | { type: 'sowed'; by: CharacterId; cell: Cell; crop: CropId }
  | { type: 'watered'; by: CharacterId; cell: Cell }
  | { type: 'can_empty'; by: CharacterId }
  | { type: 'refilled'; by: CharacterId; at: PointId }
  | { type: 'harvested'; by: CharacterId; cell: Cell; item: ItemId; quality: Quality; count: number }
  | { type: 'already_taken'; by: CharacterId; other: CharacterId; cell: Cell }
  | { type: 'chop'; by: CharacterId; tree: string; felled: boolean }
  | { type: 'dig'; by: CharacterId; cell: Cell; found: boolean }
  | { type: 'crafted'; by: CharacterId; recipe: RecipeId; item: ItemId; count: number }
  | { type: 'build_progress'; by: CharacterId; construction: ConstructionId; element: string }
  | { type: 'element_built'; construction: ConstructionId; element: string }
  | { type: 'construction_done'; construction: ConstructionId }
  | { type: 'beam_lifted' }
  | { type: 'beam_dropped' }
  | { type: 'beam_placed' }
  | { type: 'furniture_placed'; by: CharacterId; furniture: string; item: ItemId }
  | { type: 'furniture_taken'; by: CharacterId; item: ItemId }
  | { type: 'picked_up'; by: CharacterId; item: ItemId; count: number }
  | { type: 'bag_full'; by: CharacterId }
  | { type: 'bought'; by: CharacterId; item: ItemId; count: number; price: number }
  | { type: 'sold'; by: CharacterId; item: ItemId; count: number; price: number }
  | { type: 'deposited'; by: CharacterId; item: ItemId; count: number }
  | { type: 'money'; amount: number }
  | { type: 'order_paid'; amount: number; linesDone: number }
  | { type: 'proposal'; by: CharacterId; proposal: string }
  | { type: 'proposal_resolved'; proposal: string; accepted: boolean }
  | { type: 'gave'; by: CharacterId; /** habitant ou personnage */ to: string; item: ItemId; count: number }
  | { type: 'talk'; by: CharacterId; villager: VillagerId }
  | { type: 'scene_started'; dialogue: DialogueId; villager: VillagerId }
  | { type: 'scene_ended'; dialogue: DialogueId }
  | { type: 'ate'; by: CharacterId; item: ItemId }
  | { type: 'cooked'; by: CharacterId; recipe: RecipeId }
  | { type: 'went_to_bed'; by: CharacterId }
  | { type: 'got_up'; by: CharacterId }
  | { type: 'door'; by: CharacterId; entering: boolean }
  | { type: 'fed_hens'; by: CharacterId }
  | { type: 'hens_arrived' }
  | { type: 'eggs_laid'; count: number }
  | { type: 'train_whistle' }
  | { type: 'train_arriving' }
  | { type: 'train_departing' }
  | { type: 'veillee_started' }
  | { type: 'midnight' }
  | { type: 'night' }
  | { type: 'morning'; day: number }
  | { type: 'letter'; letter: LetterId }
  | { type: 'quest_started'; quest: QuestId }
  | { type: 'quest_step'; quest: QuestId }
  | { type: 'quest_done'; quest: QuestId }
  | { type: 'envie_done'; by: CharacterId | 'both'; envie: EnvieId }
  | { type: 'unlocked'; recipe: RecipeId }
  | { type: 'shed_opened' }
  | { type: 'demo_ended' }
  | { type: 'save_point'; reason: 'dawn' | 'quest' }
  | { type: 'session_finish' }
  | { type: 'pin'; by: CharacterId; pos: Vec2 }
  | { type: 'absence'; who: CharacterId; absent: boolean };
