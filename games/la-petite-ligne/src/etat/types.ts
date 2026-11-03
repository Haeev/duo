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
import type { Effect, Season, StageId } from '../donnees/types';
import type { BenchSeat } from './bancs';
import type { BuildingId } from './carte';
import type { FishingState, FishRarity } from './peche';

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
/** Pas de simulation par seconde (cadence des ticks: `action.since`, `action.duration`, `pin.until`). */
export const SIM_HZ = 30;
export const BAG_SLOTS = 24;
export const TOOLBAR_SLOTS = 10;
/** Côté du coin à soi (MA-06 de la démo), en cases. */
export const CORNER_SIZE = 2;

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
  /** Prévision du soir: la météo du lendemain, déjà tirée (FE-09). */
  weatherTomorrow: Weather;
  /** Météo tirée des derniers jours (tour 8, à partir de `weather.fromDay`), la plus récente à la fin, `weather.logDays` au plus. */
  weatherLog: WeatherLogEntry[];
  /** Brume du matin aujourd'hui (tour 8): elle se lève de `weather.mist.fadeFrom` à `weather.mist.until`. */
  morningMist: boolean;
  /** Étapes de la partie (tour 8): franchies, en cours d'écran, choix des deux joueurs. */
  stages: StagesState;
  characters: Character[];
  garden: GardenCell[];
  trees: Tree[];
  /** Poutre du toit (geste à deux « porter »). `null` une fois posée. */
  beam: Beam | null;
  constructions: ConstructionState[];
  /** Meubles posés dans la pièce de la maisonnette. */
  furniture: PlacedFurniture[];
  /** Petits objets posés sur le dessus d'un meuble porteur (format 9, S03). */
  decor: PlacedDecor[];
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
  /** Qui a commandé chaque colis de `catalogueOrders` (même ordre; tour 9: l'outil, la poule, le cadeau vont à l'acheteur). */
  catalogueOrderBy: CharacterId[];
  /** Draisine sortie de la remise et posée au bout de la voie (position, orientation); `null`: dans la remise. */
  handcarAt: { pos: Vec2; facing: number } | null;
  /** Colis lourds livrés par le train, en attente d'être portés à deux (objets `carriedByTwo` du catalogue). */
  heavyDeliveries: ItemId[];
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
  /**
   * Ce que chaque joueur a entendu, et quand (heure de jeu absolue: jour x 1440 + minutes), pour
   * les répliques du quotidien et les rappels répétables (tirage « la moins récente », R4).
   * Absent des sauvegardes d'avant: rempli à vide à la reprise.
   */
  heard: Record<CharacterId, Record<string, number>>;
  /**
   * Tour 9 (section 3.8, recommandation retenue): les répliques entendues il y a plus de
   * `dialogues.datedRepeatDays` jours quittent `heard` pour un ensemble de bits par joueur (une
   * réplique par bit, dans l'ordre des identifiants du contenu, `key`: empreinte de cette liste),
   * toutes à égalité pour le tirage « la moins récente ». La taille ne dépend plus du temps de jeu.
   */
  heardOld: { key: string; p1: string; p2: string };
  /** Dialogues déjà vus: `once: duo` (clé = id) et `once: player` (clé = `id@p1`). */
  dialoguesDone: string[];
  /** Scène à deux en cours (dialogue partagé), ou `null`. */
  scene: SceneState | null;
  /** Compteurs d'actions, par personnage et pour le duo (conditions des quêtes). */
  counters: Counters;
  /**
   * Ce que les compteurs ont gagné depuis l'aube (conditions « depuis ce matin » des envies), clés
   * touchées aujourd'hui seulement. Tour 9 (section 3.8): remplace la copie complète des compteurs
   * prise à l'aube (`countersAtDawn`, 5 Ko), relue et convertie à la reprise.
   */
  countersToday: Counters;
  /** Suites d'effets en cours (une scène les suspend jusqu'à sa fin). */
  scripts: ScriptState[];
  /** Prochain identifiant unique (meubles, objets au sol, propositions, notifications). */
  nextId: number;
  /** Commande en cours: index dans `reglages.order.trains` (elle passe à la suivante dès le paiement, au départ du train; la caisse rouvre au matin suivant). */
  orderIndex: number;
  /** Résultat de la commande en cours, une fois payée au départ du train (jusqu'au matin suivant). */
  orderResult: OrderResult | null;
  /** Résultats des commandes payées, dans l'ordre des trains (les `ORDER_HISTORY_KEPT` dernières). */
  orderHistory: OrderResult[];
  /** Toutes les commandes payées depuis le début (compteurs de l'écran d'étape). */
  orderTotals: OrderTotals;
  /** Commande du samedi générée (tour 8, section 4): la commande tirée et la mémoire du tirage. */
  order: OrderBook;
  /** Dernière variante tirée par clé (salutation de la lettre de commande, variantes sans redite). */
  letterVariants: Record<string, number>;
  /** Premier jour joué avec chaque jalon de contenu (section 1.5), pour les contenus futurs. */
  content: { firstDayWith: Record<string, number> };
  /** Récapitulatif de fin, une fois la démo finie. */
  ending: EndingSummary | null;
  /** Statistiques de la séance pour l'historique de la plateforme. */
  session: SessionStats;
  /** Moments rares (tour 6): le moment du jour, l'historique, le tour des confidences. */
  moments: MomentsState;
  /** Informations propres à un seul joueur (R16): les secrets des quêtes et le tour de l'informé. */
  secrets: SecretsState;
  /** Souvenirs du duo (tour 7): une ligne par moment vu ensemble et par quête secrète finie, bornée. */
  memories: MemoriesState;
  /**
   * Envies à deux tirées (tour 8, section 5.4), les `envies.sharedNoRepeatDays` derniers jours.
   * Absent des sauvegardes d'avant: rempli à vide à la reprise.
   */
  sharedEnvieRecent: { id: EnvieId; day: number }[];
  /** Tableau des annonces (tour 9, section 1): l'annonce en cours, la précédente, la mémoire du tirage. */
  board: BoardState;
  /** Chantiers (tour 9, section 2.6), par identifiant de `chantiers.json`: versé, planches, jour bâti. */
  improvements: Record<string, ImprovementState>;
  /** Articles du catalogue de la semaine achetés (tour 9, section 2.3), par objet: exemplaires commandés. */
  catalogueBought: Record<ItemId, number>;
  /** Cadeaux offerts (tour 9, section 2.7), par habitant: jour de la remise. */
  giftsGiven: Record<VillagerId, number>;
  /**
   * Pièces de la maisonnette à bâtir (tour 10, section 4), par identifiant de `pieces.json`
   * (`room_cellar`, `room_bedroom`): une entrée dès la commande. Vide au départ et dans les
   * sauvegardes d'avant.
   */
  rooms: Record<string, RoomState>;
  /**
   * Le râtelier près de la porte (tour 10, section 5.3): les outils rangés, hors des cases du
   * rangement (`cellar` reste le contenu du rangement commun). Vide au départ.
   */
  rack: ItemStack[];
  /**
   * Premier jour joué avec la rue Haute (tour 10, section 1.7): 1 pour une partie commencée avec elle,
   * sinon la première aube de la partie reprise. Les départs du tour (panière, lettre de Solange,
   * souhaits) s'échelonnent à partir de là, un par journée (`simulation/bourg.ts`, `townDays`).
   */
  upperStreetSince: number;
  /** Pêche de la 0.12 (format 9): ombres, coin qui frémit, guet, grands, carnet des poissons (`etat/peche.ts`). */
  fishing: FishingState;
}

/** Une coupe proposée depuis le banc du salon: coiffure, couleur et barbe (bornes de `town.appearance`). */
export interface HairOffer {
  by: CharacterId;
  hair: number;
  hairColor: number;
  beard: number;
}

/** Une pièce commandée à Basile (tour 10, section 4.3). */
export interface RoomState {
  /** Jour de la commande (le site paraît au matin suivant), `null` si pas encore commandée. */
  ordered: number | null;
  /** Ce qui a été déposé à la caisse du chantier (rien ne se perd). */
  crate: ItemStack[];
  /** Éléments bâtis (identifiants des éléments de `pieces.json`). */
  elementsBuilt: string[];
  /** Panne faîtière portée à deux jusqu'au faîte (chambre). */
  beamPlaced: boolean;
  /** Jour où la pièce est à vous (tuiles posées, porte percée), `null` avant. */
  builtDay: number | null;
  /** Élément en cours de construction (l'invité suit la barre, une reprise la garde), `null` sinon. */
  work?: RoomWork | null;
}

/** Travail en cours sur un élément de pièce (tour 10, section 4.3). */
export interface RoomWork {
  element: string;
  /** 0 à 1. */
  progress: number;
  /** Planches et clous de l'élément déjà pris (caisse, puis sac de qui travaille). */
  paid: boolean;
  workers: CharacterId[];
}

/** Une annonce affichée au tableau du quai (tour 9, section 1). */
export interface BoardAnnonce {
  /** Gabarit (`annonces.json`). */
  gabarit: string;
  /** Variante tirée (index de `variants`: la ligne de la vitrine d'Odette). */
  variant: number;
  /** Quête du carnet qui la porte (`annonce_<gabarit>`). */
  quest: QuestId;
  /** Jour de l'affiche. */
  posted: number;
  /** Échéance: elle se retire à cette heure si elle n'est pas faite. */
  deadline: { day: number; time: number };
  /** Récompense en sous (section 1.4), fixée à l'affiche. */
  reward: number;
  state: 'open' | 'done' | 'expired';
  /** Qui l'a remise (dernier don ou scène à deux: `null`). */
  by: CharacterId | null;
  /** Jour où elle a été faite ou retirée. */
  closedDay: number | null;
}

export interface BoardState {
  current: BoardAnnonce | null;
  previous: BoardAnnonce | null;
  /** Les derniers gabarits affichés et leur jour (règle des 10 jours), 4 au plus. */
  recent: { gabarit: string; day: number }[];
  /** Gabarits déjà affichés une fois (poids x 2 aux jamais affichés). */
  posted: string[];
  /** Objets uniques déjà donnés (le dessin de Jeanne, la gelée de sureau). */
  uniquesGiven: ItemId[];
}

export interface ImprovementState {
  /** Sous versés (souscription du bourg, ou paiement à Basile). */
  paid: number;
  /** Planches apportées à Basile (chacune retire `plankDiscount` sous du prix). */
  planks: number;
  /** Payé en entier: Basile bâtit dans la nuit. */
  funded: boolean;
  /** Jour où il paraît bâti (le matin qui suit le paiement), `null` sinon. */
  builtDay: number | null;
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

/** Choix d'un joueur sur l'écran d'étape. */
export type StageChoice = 'stay' | 'finish';

export interface StagesState {
  /** Étapes franchies par « Rester à la Halte ». */
  passed: StageId[];
  /** Étape dont l'écran est ouvert (phase `ended`), ou `null`. */
  current: StageId | null;
  /** Choix de chacun sur l'écran (rien ne se passe tant qu'ils diffèrent). */
  choice: Record<CharacterId, StageChoice | null>;
}

export interface WeatherLogEntry {
  day: number;
  weather: Weather;
  mist: boolean;
}

export interface ClockState {
  /** Jour de la démo, de 1 (samedi) à `reglages.clock.lastDay.day` (15, le troisième samedi). */
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
  /**
   * Coiffure, de 0 à 14 (tour 10, section 2.1, dans l'ordre de la table: 0 à 2 les trois d'avant,
   * 3 à 11 les nouvelles de la création, 12 à 14 celles du salon seulement).
   */
  hair: number;
  /**
   * Couleur des cheveux, de 0 à 7 (section 2.2): noir, brun, châtain, auburn, roux, blond paille,
   * gris, blanc. Défaut: celle des portraits d'avant (p1 brun, p2 noir).
   */
  hairColor: number;
  /** Barbe ou moustache (réponse du client du 2026-11-01): 0 aucune, 1 barbe courte, 2 barbe fournie, 3 moustache. */
  beard: number;
  /** Vêtements portés (0.12, identifiants de `vetements.json`), un par emplacement. */
  wear: Wear;
  /**
   * Couleur du profil Duo du joueur (CSS, `#rrggbb`): badge brodé sur le haut depuis la 0.12 (les
   * foulards sont retirés), portraits de l'interface. Le nom reste celui du format de sauvegarde.
   */
  scarf: string;
}

/** Emplacements de vêtement (0.12): haut, par-dessus, bas, chaussures, tête. */
export type ClothingSlot = 'top' | 'outer' | 'bottom' | 'shoes' | 'hat';

/** Tenue portée: haut, bas et chaussures toujours; par-dessus et tête facultatifs. */
export interface Wear {
  top: string;
  bottom: string;
  shoes: string;
  outer: string | null;
  hat: string | null;
}

export interface Character {
  id: CharacterId;
  /** Joueur lié (identifiant stable de la plateforme, jamais le rôle hôte/invité). */
  playerId: PlayerId;
  name: string;
  appearance: Appearance;
  /** Vêtements possédés (0.12), ceux de départ compris, dans l'ordre d'arrivée. */
  wardrobe: string[];
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
  /**
   * Bâtiment visitable où il se trouve (ADR 0016), `null` dehors. Recalculé à chaque pas par
   * `updateInside` et à chaque `placeCharacter`. « À l'abri »: `isSheltered`; « chez soi »:
   * `isHome` (`etat/interieurs.ts`, qui remplacent l'ancien booléen `inHouse`).
   */
  inside: BuildingId | null;
  /** Jour du dernier changement de coiffure (salon, section 2.3), `null` si jamais. */
  hairChangedDay: number | null;
  /** Qui a remarqué ce changement (Cœur +10 une fois), `null` tant que personne. */
  hairNoticedBy: CharacterId | null;
  /**
   * Au fauteuil du salon (menu `salon`): la coupe que l'autre propose depuis le banc d'attente
   * (section 2.3), `null` sans proposition. Effacée en quittant le fauteuil.
   */
  hairOffer: HairOffer | null;
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
  heartToday: {
    envie: boolean;
    sharedEnvie: boolean;
    ateTogether: boolean;
    gesture: boolean;
    /** Apogée d'un moment rare vue aujourd'hui (une fois par jour). Absent des sauvegardes d'avant. */
    moment?: boolean;
    /** Quête secrète réussie du premier coup aujourd'hui. Absent des sauvegardes d'avant. */
    firstTry?: boolean;
  };
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
  /**
   * Coin à soi (MA-06, P1): case nord-ouest du carré de `CORNER_SIZE` cases
   * désigné dans la pièce; seul ce joueur y pose ou y reprend des meubles.
   * Absent des sauvegardes d'avant le coin: comme `null`.
   */
  corner?: Cell | null;
  /**
   * Assis sur un banc de la carte, par choix (Espace près d'une place libre): sa place,
   * réservée, et depuis quand. Toute direction le relève. `null` debout.
   */
  seat: BenchSeat | null;
  /** Ligne à l'eau (pêche, P1): le bouchon, l'attente (`waiting`) puis la touche (`bite`, à ferrer avant `until`). */
  fishing: {
    phase: 'waiting' | 'bite';
    bobber: Vec2;
    biteAt: number;
    until: number;
    /** Ombre réservée par cette ligne (`world.fishing.shadows[].id`), absente si aucune encore. */
    shadow?: number;
  } | null;
  /**
   * Confidence du matin (moments rares): où et quand voir le moment du jour, pour ce joueur seul.
   * Affichée au petit-déjeuner et au carnet jusqu'à l'apogée ou au départ du moment.
   */
  momentHint: { moment: string; text: string } | null;
  /** Geste « tenir » (l'échelle de Basile): la place tenue (point de la carte), ou `null`. Toute direction lâche. */
  holding: PointId | null;
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
  | 'letter'
  /** Le fauteuil de Solange (tour 10, section 2.3): coupe, couleur, barbe, proposition reçue. */
  | 'salon'
  /** Le guichet du fournil d'Achille (section 1.5): pain, pain chaud, brioche. */
  | 'bakery'
  /** 0.12: la boutique de vêtements, au comptoir de la mercerie de Solange (essayer, acheter, se changer en cabine). */
  | 'clothes_shop'
  /** 0.12: se changer chez soi, au coffre (vêtements de sa garde-robe). */
  | 'wardrobe';

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
  | 'refill'
  /** Lever la perche et allumer une lanterne (tour 9, `pole_raise`). */
  | 'light';

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
  /** Tour 10 (section 3.5): minutes de jeu de suite à plus de `needs.heart.reunion.apartRadius` de l'autre. */
  apartMinutes: number;
  /** Retrouvailles comptées aujourd'hui (`needs.heart.reunion.maxPerDay` au plus). */
  reunionsToday: number;
  /** Sieste faite aujourd'hui (une par jour, section 3.4). */
  nappedToday: boolean;
  /** Début de la sieste en cours (heure de jeu absolue: jour x 1440 + minutes), `null` hors sieste. */
  napStart: number | null;
  /** Premiers rideaux ouverts du matin déjà comptés aujourd'hui (Cœur +2, section 6.2). */
  curtainsMorningDone: boolean;
  /** Ligne `heart_missing` déjà montrée aujourd'hui (une fois par jour). */
  missingShown: boolean;
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
  /**
   * `pointer`: la cible survolée à la souris (R11), que le clic gauche et Espace prennent;
   * absent: la case devant le personnage. Recalculé à chaque pas, jamais relu d'une sauvegarde.
   */
  source?: 'pointer';
}

export type AimVerb =
  | 'fish'
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
  | 'dig'
  /** S'asseoir sur la place libre d'un banc. */
  | 'sit'
  /** Tenir l'échelle de Basile (geste « tenir », moment rare). */
  | 'hold'
  /** Appeler une poule par son nom (R16, « Les noms des poules »). */
  | 'call'
  /** Allumer une lanterne (tour 9, les lanternes du quai). */
  | 'light'
  /** Boire un chocolat chaud à la petite table d'Odette (tour 10, section 1.6). */
  | 'drink'
  /** Ouvrir ou fermer des rideaux accrochés à une fenêtre (tour 10, section 6.2). */
  | 'curtains';

export interface PlacementPreview {
  item: ItemId;
  /** Case du coin nord-ouest de l'empreinte, une fois tournée. */
  cell: Cell;
  /** Quarts de tour (0 à 3), convention de la carte: 0 face au sud, 1 à l'est, 2 au nord, 3 à l'ouest. */
  rotation: number;
  valid: boolean;
  /** Pourquoi ce n'est pas possible (texte de `textes.json`, clés `placement_*`), ou `null`. Toujours rempli par la simulation. */
  blocked?: string | null;
  /** Petit objet (S03): l'aperçu peut se poser sur un meuble porteur que vise la souris. */
  small?: boolean;
  /** Petit objet visé sur le dessus d'un meuble: le meuble porteur et la place (`cell` est alors celle du meuble). */
  on?: { furniture: string; place: number };
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
  /**
   * Rideaux seulement (tour 10, section 6): la fenêtre où ils pendent (nom du nœud `window_<n>` du
   * modèle). Absent pour les autres meubles et dans les sauvegardes d'avant (lot L4: migration).
   */
  window?: string;
  /** Rideaux seulement: fermés. Absent: ouverts. */
  closed?: boolean;
}

/**
 * Petit objet posé sur le dessus d'un meuble porteur (0.11.2, S03): il suit son meuble, et revient au
 * sac (ou au rangement) quand on reprend le meuble.
 */
export interface PlacedDecor {
  /** Identifiant unique (`d1`, `d2`...). */
  id: string;
  item: ItemId;
  /** Le meuble porteur (`PlacedFurniture.id`). */
  on: string;
  /** Rang de la place dans `surface` du meuble porteur. */
  place: number;
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
  /** Abattu: souche, puis rejet (ou jeune sapin), jusqu'à ce qu'il redevienne adulte (`etat/repousse.ts`). */
  felled: boolean;
  /** Jour de l'abattage (tour 8, repousse), `null` debout. Absent des sauvegardes d'avant: rempli à la reprise. */
  felledDay: number | null;
  /** Tick du dernier coup (tremblement). */
  lastHitTick: number;
}

/** Ce qu'on porte à deux: la poutre, la draisine poussée, le colis lourd du train. */
/** `quest` (0.12): une charge de quête (`reglages.carry.quests`), retrouvée par son objet. */
export type LoadPurpose = 'construction' | 'handcar' | 'parcel' | 'basket' | 'quest';

export interface Beam {
  /** Objet porté (modèle de `objets.json`): `beam`, `handcar`, `heavy_parcel`. */
  item: ItemId;
  purpose: LoadPurpose;
  /** Construction achevée à l'arrivée (`purpose: construction`). */
  construction: string | null;
  /** Objet contenu, rangé au cellier à l'arrivée (`purpose: parcel`). */
  contents: ItemId | null;
  /** Où le poser. */
  to: Vec2;
  /** Trajet imposé (la draisine sur ses rails): points de passage, le dernier vaut `to`; `null`: trajet libre. */
  route: Vec2[] | null;
  /** Segment en cours du trajet imposé (vers `route[leg]`). */
  leg: number;
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
  /** Ceux qui voient son nom au-dessus d'elle (R16, « Les noms des poules »). */
  nameKnownBy: CharacterId[];
  /** Qui l'a appelée par son bon nom, ou `null`. */
  namedBy: CharacterId | null;
  /** Poule commandée au catalogue (tour 9): jour d'arrivée; Jeanne la nomme à 10 h 30. Absent pour les trois premières. */
  arrivedDay?: number;
}

// ---------------------------------------------------------------------------
// Moments rares (tour 6, `moments.json`)

/**
 * Phases d'un moment: `absent` (rien à l'écran, avant `present.from`), `waiting` (l'animal joue
 * son attente), `climax` (la chorégraphie de l'apogée, identique chez les deux), `after` (l'état
 * d'après, jusqu'à `present.to`), `left` (départ discret sans apogée), puis `gone` (fini pour
 * aujourd'hui).
 */
export type MomentPhase = 'absent' | 'waiting' | 'climax' | 'after' | 'left' | 'gone';

export interface MomentToday {
  id: string;
  /** Vient d'une quête (il revient chaque jour tant qu'on ne l'a pas vu) ou du tirage du matin. */
  origin: 'quest' | 'ambient';
  day: number;
  phase: MomentPhase;
  /** Tick d'entrée dans la phase (arrivée, apogée, départ). */
  phaseTick: number;
  /** Tick de début de l'apogée (`moment_climax`), ou `null`. */
  startTick: number | null;
  /**
   * Secondes de simulation écoulées dans la chorégraphie en cours (apogée ou départ): le rendu
   * l'échantillonne avec `etat/moments.ts`. Figée pendant une pause (l'échelle lâchée).
   */
  elapsed: number;
  paused: boolean;
  /** Pas d'affilée où les conditions de l'apogée tiennent (anneau du HUD: `watchTicks / holdSeconds`). */
  watchTicks: number;
  /** Ce joueur remplit sa part (dans le rayon, dans la pose demandée): ligne `moment_watch_*` du HUD. */
  watching: { p1: boolean; p2: boolean };
  /** Les deux sont prêts, mais avant la fenêtre de l'apogée (les oies avant 16 h 30). */
  early: boolean;
  /** Joueurs qui ont déjà vu `moment_notice` pour ce moment. */
  noticed: CharacterId[];
  /** Destinataire de la confidence du matin, ou `null`. */
  hintTo: CharacterId | null;
  /** Timidité: l'animal se redresse jusqu'à ce tick (un joueur trop près), 0 au calme. */
  shyUntil: number;
  /**
   * Tour 9, le salut du mécanicien (`watch.arm`): tick où les deux ont armé les barrières, `null`
   * avant. Absent des sauvegardes d'avant: comme `null`.
   */
  armedTick?: number | null;
  /** Tour 9, les lanternes (`watch.syncPress`): dernier allumage de chacun (tick et place), `null` sans. */
  presses?: { p1: { tick: number; place: PointId } | null; p2: { tick: number; place: PointId } | null };
  /** Lignes d'aide déjà dites une fois pendant ce moment (`take:p1`, `where:p2`...). Absent: aucune. */
  told?: string[];
}

export interface MomentMemory {
  id: string;
  /** Jour de l'occurrence (dernier jour pour une occurrence de quête, jour de l'apogée). */
  day: number;
  /** Jour de la semaine (index de `textes.weekdays`), pour le souvenir. */
  weekday: number;
  origin: 'quest' | 'ambient';
  seen: boolean;
}

export interface MomentsState {
  today: MomentToday | null;
  history: MomentMemory[];
  /** Destinataire de la prochaine confidence du matin. */
  hintTurn: CharacterId;
}

// ---------------------------------------------------------------------------
// Informations propres (R16)

export interface SecretEntry {
  /** Identifiant du secret (`quetes.json`, `secret.id`). */
  id: string;
  quest: QuestId;
  /** Celui qui sait. */
  informed: CharacterId;
  /** Celui qui agit. */
  doer: CharacterId;
  /** Variante tirée par la graine (de 0 à `of` - 1). */
  variant: number;
  /** Mauvaises réponses de l'autre (jamais affichées, jamais punies). */
  errors: number;
  /** La fiche secrète est visible chez l'informé (après `revealOn`). */
  revealed: boolean;
  /** Le secret est visible des deux (`reveal_secret`, fin de la quête). */
  shared: boolean;
  /** Le coup de coude a été donné à l'informé. */
  nudged: boolean;
}

export interface SecretsState {
  /** Prochain informé. */
  turn: CharacterId;
  entries: SecretEntry[];
}

// ---------------------------------------------------------------------------
// Souvenirs du carnet (tour 7, conception section 2.4)

/**
 * Un moment vu ensemble, quel que soit le nombre de passages (la taille ne grandit pas avec le
 * temps de jeu). La semaine, la saison et l'année se déduisent des jours.
 */
export interface MomentMemoryEntry {
  id: string;
  /** Jour de la première fois. */
  first: number;
  /**
   * Destinataire de la confidence de la première fois. `null`: pas de confidence (moment de
   * quête, habitant pas encore rencontré) ou inconnu (sauvegarde du format 3).
   */
  hintTo: CharacterId | null;
  /**
   * Habitant de la première fois: celui de la confidence, ou celui qui a donné la quête quand
   * `hintTo` vaut `null`. `null` avec `hintTo`: indice sans habitant (le héron, les oies).
   */
  hintFrom: string | null;
  count: number;
  /** Jour de la dernière fois. */
  last: number;
}

/** Une quête à secret (R16) finie. */
export interface SecretMemoryEntry {
  quest: QuestId;
  day: number;
  informed: CharacterId;
  /** Aucune mauvaise réponse. */
  firstTry: boolean;
  /** Variante du secret (la réponse de Firmin, lisible chez les deux une fois la quête finie). */
  variant: number;
}

export interface MemoriesState {
  moments: MomentMemoryEntry[];
  secrets: SecretMemoryEntry[];
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
  /** Bâtiment visitable où il se trouve (ADR 0016, son et interface), `null` dehors ou hors de la carte. */
  inside: BuildingId | null;
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
  /** Départ au pas du salut du mécanicien (tour 9, `train.saluteSlowRoll`): absent ou faux sinon. */
  slow?: boolean;
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
  /** `improvement` (tour 9): un versement à un chantier; `item` est le chantier, `count` la somme en sous. */
  source: 'grocery' | 'catalogue' | 'haberdashery' | 'improvement';
  item: ItemId;
  count: number;
}

export interface OrderResult {
  /** Rang de la commande (1, 2, puis les commandes générées). */
  number: number;
  /** Jour du train qui l'a emportée. */
  day: number;
  linesDone: number;
  linesTotal: number;
  complete: boolean;
  /** Somme versée à la bourse au départ du train. */
  amount: number;
}

export interface OrderTotals {
  orders: number;
  linesDone: number;
  linesTotal: number;
  amount: number;
}

export interface GeneratedOrderLine {
  item: ItemId;
  count: number;
  /** Part de la semaine de travail (section 4.3). */
  share: number;
}

/** Une commande composée par la coopérative au départ du train précédent. */
export interface GeneratedOrder {
  /** Rang de la commande (3 pour le samedi 22). */
  number: number;
  /** Jour du train qui l'emportera. */
  train: number;
  /** Jour du tirage (départ du train précédent): la lettre arrive ce jour-là. */
  drawnDay: number;
  lines: GeneratedOrderLine[];
  /** Budget de la commande, taille du duo comprise (semaines de travail). */
  budget: number;
  /** Lettres de cette commande déjà envoyées (identifiants des définitions). */
  lettersSent: LetterId[];
}

export interface OrderBook {
  generated: GeneratedOrder | null;
  /** Budget de la prochaine commande (avant le facteur de taille). */
  budget: number;
  /** Commandes incomplètes d'affilée. */
  misses: number;
  /** Produits des deux dernières commandes, la plus récente à la fin. */
  recent: ItemId[][];
  /** Produits déjà commandés une fois. */
  ordered: ItemId[];
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
  /** Quête répétée à chaque train (`repeat: each_train`): jour du train de cette fois-ci. Absent sinon. */
  train?: number;
}

/**
 * Lettre reçue (format 8): titre, expéditeur et texte se reconstituent depuis les données
 * (`etat/courrier.ts`, `letterTitle`, `letterText`, `letterFrom`).
 */
export interface Letter {
  id: LetterId;
  day: number;
  /** Variante retenue (index dans `variants` de la définition); absente pour le texte de base. */
  variant?: number;
  /** Valeurs des variables citées par le titre et le texte, figées à l'envoi; absentes s'il n'y en a pas. */
  vars?: Record<string, string | number>;
  read: CharacterId[];
  /** Lettre migrée que les données ne redonnent plus à l'identique: titre, expéditeur et texte d'origine. */
  legacy?: { title: string; from: string; text: string };
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
  /** Lignes remplies et lignes demandées, toutes commandes confondues. */
  linesDone: number;
  linesTotal: number;
  /** Le détail, commande par commande. */
  orders: { linesDone: number; linesTotal: number }[];
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
  /** La hache refusée sur une souche (`stump`) ou un rejet trop jeune (`young`, il tremble un peu). */
  | { type: 'chop_refused'; by: CharacterId; tree: string; reason: 'stump' | 'young' }
  /** Un arbre abattu est redevenu adulte au matin. */
  | { type: 'tree_regrown'; tree: string }
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
  /** Assis sur un banc (place `slot`), ou relevé: le rendu et le son répondent tout de suite, avant l'état complet. */
  | { type: 'sat_down'; by: CharacterId; bench: string; slot: number }
  | { type: 'stood_up'; by: CharacterId; bench: string }
  /** Une porte passée (ADR 0016): celle de `building`, en entrant ou en sortant. */
  | { type: 'door'; by: CharacterId; entering: boolean; building: BuildingId }
  /** Porte fermée devant soi (hors des heures): le loquet (`door-locked`). */
  | { type: 'door_locked'; by: CharacterId; building: BuildingId }
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
  /** L'écran d'étape s'ouvre (l'écran de fin de la démo pour l'étape `demo`). */
  | { type: 'demo_ended'; stage: StageId }
  /** Un joueur a choisi sur l'écran d'étape. */
  | { type: 'stage_choice'; by: CharacterId; choice: StageChoice | null }
  /** « Rester à la Halte » choisi par les deux: la partie reprend. */
  | { type: 'stage_continue'; stage: StageId }
  /** Premier matin d'une saison (carte de saison du petit-déjeuner). */
  | { type: 'season_started'; season: Season; day: number }
  /** La coopérative a composé la commande suivante (au départ du train). */
  | { type: 'order_drawn'; number: number; train: number }
  | { type: 'save_point'; reason: 'dawn' | 'quest' }
  | { type: 'session_finish' }
  | { type: 'pin'; by: CharacterId; pos: Vec2 }
  | { type: 'cast'; by: CharacterId; at: Vec2 }
  | { type: 'bite'; by: CharacterId }
  /**
   * Prise (0.12): longueur tirée, rareté, remis à l'eau, première prise de l'espèce, record battu.
   * Le son d'une prise ne joue que chez le pêcheur, sauf celui d'un mythique (section 7.1).
   */
  | { type: 'caught'; by: CharacterId; item: ItemId; cm?: number; rarity?: FishRarity; released?: boolean; first?: boolean; record?: boolean; zone?: string }
  | { type: 'escaped'; by: CharacterId }
  | { type: 'absence'; who: CharacterId; absent: boolean }
  // Moments rares (tour 6)
  | { type: 'moment_waiting'; moment: string }
  /** Apogée: chaque machine joue la chorégraphie depuis `startTick`, dans son temps de simulation. */
  | { type: 'moment_climax'; moment: string; startTick: number }
  | { type: 'moment_paused'; moment: string }
  | { type: 'moment_resumed'; moment: string }
  | { type: 'moment_left'; moment: string }
  | { type: 'hold_started'; by: CharacterId; point: PointId }
  | { type: 'hold_released'; by: CharacterId; point: PointId }
  // Informations propres (R16)
  | { type: 'hen_called'; hen: string; name: string; correct: boolean; by: CharacterId }
  | { type: 'dialogue_choice'; dialogue: DialogueId; choice: string; correct: boolean | null; by: CharacterId }
  | { type: 'secret_revealed'; quest: QuestId; to: CharacterId | 'both' }
  // Tour 9: tableau des annonces
  | { type: 'annonce_posted'; gabarit: string; quest: QuestId }
  | { type: 'annonce_done'; gabarit: string; by: CharacterId | null; amount: number }
  | { type: 'annonce_expired'; gabarit: string }
  // Tour 9: chantiers (versement au tableau ou à Basile, payé en entier, bâti au matin)
  | { type: 'improvement_paid'; by: CharacterId; improvement: string; amount: number; planks: number }
  | { type: 'improvement_funded'; improvement: string }
  | { type: 'improvement_built'; improvement: string }
  // Tour 9: catalogue de la semaine, outils, poules, cadeaux
  | { type: 'catalogue_page'; season: Season; week: number; items: ItemId[] }
  | { type: 'tool_upgraded'; by: CharacterId; item: ItemId; previous: ItemId | null }
  | { type: 'hen_delivered'; hen: string; item: ItemId; by: CharacterId | null }
  | { type: 'hen_named'; hen: string; name: string; by: CharacterId | null }
  | { type: 'gift_given'; by: CharacterId; villager: VillagerId; item: ItemId }
  // Tour 9: moments (barrières armées, lanternes)
  | { type: 'moment_armed'; moment: string }
  | { type: 'lantern_lit'; by: CharacterId; place: PointId }
  | { type: 'lantern_out'; by: CharacterId; place: PointId }
  // Tour 10: rue Haute (guichet du fournil, chocolat chaud, salon de Solange)
  /** Coupe validée au fauteuil (`changed`: coiffure, couleur ou barbe autre qu'avant; sinon « Garder ma coiffure »). */
  | { type: 'haircut'; by: CharacterId; changed: boolean; price: number }
  /** Proposition envoyée depuis le banc d'attente à celui qui est au fauteuil. */
  | { type: 'hair_offer'; by: CharacterId; to: CharacterId }
  /** L'autre a remarqué la coupe (« {name} a changé de coiffure. »): tête penchée chez `by`. */
  | { type: 'hair_noticed'; by: CharacterId; of: CharacterId }
  /** La panière d'Achille posée devant la porte d'Odette (quête `achille_basket`). */
  | { type: 'basket_delivered' }
  // Tour 10: la maison (lot L4), pour le son
  /** Une sieste commence (`together`: l'autre dort déjà, l'horloge file). */
  | { type: 'nap_started'; by: CharacterId; together: boolean }
  /** Retrouvailles comptées (Cœur des deux). */
  | { type: 'reunion'; by: CharacterId }
  /** Rideaux ouverts ou fermés (`curtain-draw`). */
  | { type: 'curtains'; by: CharacterId; furniture: string; closed: boolean }
  /** Une pièce bâtie au matin (`room-built`). */
  | { type: 'room_built'; room: string }
  /** Assis au fauteuil du salon (`chair-creak`). */
  | { type: 'salon_seated'; by: CharacterId }
  /** Un repas pris ensemble (`eat-together`, besoins du tour 10). */
  | { type: 'ate_together' }
  /** Le rangement est plein: le couvercle bute (`chest-full`). */
  | { type: 'storage_full'; by: CharacterId }
