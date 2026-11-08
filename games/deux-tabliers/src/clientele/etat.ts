// Domaine « clientele » de l'état partagé: journée et semaine, ardoise, clients (état logique;
// les positions des clients debout passent à part, canal 7), économie, habitués, livre d'or,
// événements, bilan du soir. Sérialisé dans les sauvegardes et envoyé à l'invité quand il change.
// Toute évolution du format: monter WORLD_FORMAT (etat/monde.ts) et écrire la migration.
import { v } from '@duo/sdk';

const Nat = v.pipe(v.number(), v.integer(), v.minValue(0));
const Int = v.pipe(v.number(), v.integer());
const N = v.number();
const Str = v.string();
const Player = v.picklist([0, 1]);
/** Réponse à une question posée aux deux: 0 rien encore, 1 oui, 2 non. */
const Vote = v.picklist([0, 1, 2]);

export const PhaseSchema = v.picklist(['monday', 'prep', 'service', 'closing', 'evening', 'end']);
export type Phase = v.InferOutput<typeof PhaseSchema>;

/**
 * Étapes d'un groupe: `entering` (vers la file), `queue` (dans la file), `register` (en tête, à la
 * caisse, attend qu'on prenne sa commande), `waiting` (a payé, attend au passe), `toSeat` (servi,
 * va s'asseoir), `seated` (assis ou debout à sa place), `leaving` (vers la sortie).
 */
export const StageSchema = v.picklist([
  'entering',
  'queue',
  'register',
  'waiting',
  'toSeat',
  'seated',
  'leaving',
]);
export type Stage = v.InferOutput<typeof StageSchema>;

export const PlaceKindSchema = v.picklist([
  'counter',
  'table',
  'comfort',
  'terrace',
  'standing',
  'outside',
  'none',
]);
export type PlaceKind = v.InferOutput<typeof PlaceKindSchema>;

export const QualitySchema = v.picklist(['perfect', 'good', 'fine']);
export type Quality = v.InferOutput<typeof QualitySchema>;

export const GroupSchema = v.strictObject({
  id: Nat,
  profile: Str,
  size: Nat,
  /** Habitué (`habitues.json`) ou `null`. */
  regular: v.nullable(Str),
  /** Rôle dans un événement (`octave_brissac`, `jules`...) ou `null`. */
  role: v.nullable(Str),
  stage: StageSchema,
  /** Secondes de service au début de l'étape. */
  since: N,
  arrivedAt: N,
  /** Commande du groupe (identifiants de `carte.json`). */
  items: v.array(Str),
  /** Montant payé, en centimes (`null` tant que la commande n'est pas prise). */
  paid: v.nullable(Nat),
  /** Forfait d'un événement: aucune addition. */
  flatRate: v.boolean(),
  takeAway: v.boolean(),
  place: PlaceKindSchema,
  /** Assises occupées (identifiants de meubles posés) ou places debout (`standing-0`). */
  seats: v.array(Str),
  table: v.nullable(Str),
  servedAt: v.nullable(N),
  leaveAt: v.nullable(N),
  nextReorder: v.nullable(N),
  /** Commandes payées pas encore servies (la première et les recommandes). */
  open: Nat,
  orderedBy: v.nullable(Player),
  qualities: v.array(QualitySchema),
  latteArt: v.boolean(),
  homemade: v.boolean(),
  chat: v.boolean(),
  asUsual: v.boolean(),
  dirtySeat: v.boolean(),
  /**
   * Allure d'un client de passage (modèle de `regles.json`, `looks`), tirée à l'entrée sans
   * répéter les dernières; vide pour un habitué, un invité de scène ou une ancienne sauvegarde.
   */
  look: v.optional(Str, ''),
  /**
   * Remises v0.2: part du prix affiché remisée sur la commande (0 à 1, café offert à part), pour
   * la satisfaction; lignes du ticket (`happyHour`, `dailyOffer`, `profile:<tarif>` et le montant
   * en centimes, `freeCoffee` et le montant, `stamps` et le nombre de tampons, `stamped`).
   */
  off: v.optional(N, 0),
  receipt: v.optional(v.array(v.tuple([Str, Int])), () => []),
});
export type Group = v.InferOutput<typeof GroupSchema>;

/** Réglage des remises (onglet « Remises »): pris à l'ouverture suivante. */
export const DiscountSettingsSchema = v.strictObject({
  happyHour: v.strictObject({
    on: v.boolean(),
    start: Nat,
    length: Nat,
    rate: N,
    days: v.array(Str),
  }),
  loyalty: v.boolean(),
  profiles: v.record(Str, v.strictObject({ on: v.boolean(), rate: N, days: v.array(Str) })),
  /** Recette et taux de l'offre du jour, `null` sans offre (elle s'efface chaque jour). */
  dailyOffer: v.nullable(v.tuple([Str, N])),
});
export type DiscountSettings = v.InferOutput<typeof DiscountSettingsSchema>;

/** Action de marketing lancée: soir du lancement, premier jour d'effet, facteur (lassitude). */
export const CampaignSchema = v.strictObject({
  id: Str,
  launchedDay: Nat,
  firstDay: Nat,
  factor: N,
});
export type Campaign = v.InferOutput<typeof CampaignSchema>;

export const GuestbookEntrySchema = v.strictObject({
  day: Nat,
  text: Str,
  sign: Str,
  good: v.boolean(),
});
export type GuestbookEntry = v.InferOutput<typeof GuestbookEntrySchema>;

const DayStats = v.strictObject({
  revenue: Nat,
  tips: Nat,
  materials: Nat,
  served: Nat,
  people: Nat,
  left: Nat,
  satSum: N,
  satCount: Nat,
  points: N,
  basket: Nat,
  euros: Nat,
  /** Achats du jour (équipements, meubles, décoration, travaux), en centimes. */
  spent: v.optional(Nat, 0),
  /** Habitués servis: identifiant, minute de jeu, commande (pour le bilan, « Nos habitués »). */
  visits: v.optional(v.array(v.tuple([Str, N, v.array(Str)])), () => []),
  /** Ce qui a plu (`latteArt`, `quality`...) et ce qui a manqué (`noSeat`, `full`...): nombre. */
  liked: v.optional(v.record(Str, Nat), () => ({})),
  missed: v.optional(v.record(Str, Nat), () => ({})),
  /**
   * Réalisme v0.2 (centimes, 0 pour relire les sauvegardes v0.1): marchandise livrée ce matin,
   * port, dépannages, périmé jeté ce matin (et ses ingrédients), valeur du panier du soir.
   */
  goods: v.optional(Nat, 0),
  shipping: v.optional(Nat, 0),
  emergency: v.optional(Nat, 0),
  lost: v.optional(Nat, 0),
  lostItems: v.optional(v.array(Str), () => []),
  basketValue: v.optional(Nat, 0),
  /**
   * Remises et marketing v0.2 (0 et vides pour relire les sauvegardes v0.2): écart entre prix
   * affiché et prix payé (centimes), par sorte de remise, commandes remisées; publicité payée
   * aujourd'hui; clients venus grâce à chaque action (fractionnaire) et au bouche-à-oreille;
   * mots du livre d'or déjà écrits pour une action ou une remise; portions vendues par recette.
   */
  discounts: v.optional(Nat, 0),
  discountBy: v.optional(v.record(Str, Nat), () => ({})),
  discountOrders: v.optional(Nat, 0),
  marketing: v.optional(Nat, 0),
  fromCampaigns: v.optional(v.record(Str, N), () => ({})),
  fromWord: v.optional(N, 0),
  campaignWords: v.optional(v.array(Str), () => []),
  sold: v.optional(v.record(Str, Nat), () => ({})),
});
export type DayStatsState = v.InferOutput<typeof DayStats>;

/** Bilan du soir, lu par l'interface (chantier d): toutes les sommes en centimes. */
export const ReportSchema = v.strictObject({
  day: Nat,
  open: v.boolean(),
  revenue: Nat,
  tips: Nat,
  materials: Nat,
  rent: Nat,
  charges: Nat,
  /** Achats du jour (hors résultat: ils sortent de la caisse). */
  purchases: v.optional(Nat, 0),
  eventEuros: Nat,
  /** Réalisme v0.2: voir `DayStats` (`materials` y devient le coût des ventes, hors résultat). */
  goods: v.optional(Nat, 0),
  shipping: v.optional(Nat, 0),
  emergency: v.optional(Nat, 0),
  lost: v.optional(Nat, 0),
  lostItems: v.optional(v.array(Str), () => []),
  basketValue: v.optional(Nat, 0),
  /** Remises consenties (pour mémoire: la recette en est déjà nette), voir `DayStats`. */
  discounts: v.optional(Nat, 0),
  discountBy: v.optional(v.record(Str, Nat), () => ({})),
  discountOrders: v.optional(Nat, 0),
  /** Publicité payée ce jour-là (soir du lancement compris): une ligne du résultat. */
  marketing: v.optional(Nat, 0),
  fromCampaigns: v.optional(v.record(Str, N), () => ({})),
  fromWord: v.optional(N, 0),
  /**
   * Recette + pourboires + événement - marchandise - port - dépannages - loyer - charges -
   * publicité.
   */
  result: Int,
  served: Nat,
  left: Nat,
  satisfaction: N,
  cupsBefore: N,
  cupsAfter: N,
  renown: N,
  cash: Int,
  words: v.array(GuestbookEntrySchema),
  tomorrowWeather: Str,
  tomorrowAnnounce: v.nullable(Str),
  event: v.nullable(v.tuple([Str, v.picklist(['reussi', 'formidable'])])),
});
export type Report = v.InferOutput<typeof ReportSchema>;

export const ActiveEventSchema = v.strictObject({
  id: Str,
  startedAt: N,
  /** Étape libre propre à l'événement (`waiting`, `served`, `repairing`...). */
  stage: Str,
  /** Repères propres à l'événement (critères remplis, rallonge accordée...). */
  flags: v.array(Str),
  count: N,
  /** Joueur qui tient l'indice (commande prise, enfant écouté), `null` sinon. */
  holder: v.nullable(Player),
  /** Dernier geste de chaque joueur (secondes de service), pour les gestes à deux. */
  marks: v.tuple([N, N]),
});
export type ActiveEvent = v.InferOutput<typeof ActiveEventSchema>;

export const ClienteleStateSchema = v.strictObject({
  /** Jour de la maison, à partir de 1 (lundi du printemps). */
  day: Nat,
  phase: PhaseSchema,
  /** Secondes réelles de service depuis l'ouverture (l'horloge en découle). */
  serviceSec: N,
  /** Seconde de service où la pancarte s'est retournée sur « Fermé » (fermeture ou plus tôt). */
  closingAt: N,
  pace: v.picklist(['normal', 'peaceful']),
  weather: Str,
  tomorrowWeather: Str,
  houseName: v.nullable(Str),
  namePending: v.nullable(v.strictObject({ by: Player, name: Str })),
  /** Questions posées aux deux (`open`, `close`, `next-day`, `wedding`, `merelles`, `name`). */
  votes: v.record(Str, v.tuple([Vote, Vote])),
  /** Ardoise: recette et pas de prix (de -3 à +5, 0,10 € de plus ou de moins par pas de 10 %). */
  slate: v.array(v.tuple([Str, Int])),
  known: v.array(Str),
  equipment: v.array(Str),
  stations: v.record(Str, Nat),
  dishes: Nat,
  /** Caisse et dette (« à régler », EC-06), en centimes. */
  cash: Int,
  debt: Nat,
  points: N,
  cups: N,
  renown: N,
  openDays: Nat,
  satYesterday: N,
  tiers: v.array(Str),
  /** Achats faits: identifiant, jour, jour où c'est prêt (travaux). */
  purchases: v.array(v.tuple([Str, Nat, Nat])),
  /** Pièces uniques et objets offerts: identifiant, jour d'arrivée dans la remise. */
  gifts: v.array(v.tuple([Str, Nat])),
  unlocks: v.array(Str),
  flags: v.array(Str),
  brocante: v.array(Str),
  /** Achats importants proposés à l'autre (un par joueur, SI-10), prix en centimes. */
  proposals: v.array(v.strictObject({ by: Player, item: Str, price: Nat })),
  /** Somme des lots de chaque ingrédient (le service et l'ardoise le lisent). */
  stock: v.record(Str, N),
  /**
   * Lots datés (réalisme v0.2, P0-3): quantité et dernier jour de vente, du plus ancien au plus
   * récent. Absent des sauvegardes v0.1: `reconcileLots` les crée depuis `stock` à la reprise.
   */
  lots: v.optional(v.record(Str, v.array(v.tuple([N, Nat]))), () => ({})),
  /**
   * Commande du soir pour le prochain jour ouvert (cartons par ingrédient), `null`: commande
   * habituelle. Seuls les fournisseurs qui passent ce jour-là livrent; le lundi, elle attend.
   */
  order: v.nullable(v.record(Str, Nat)),
  usage: v.array(v.record(Str, N)),
  todayUse: v.record(Str, N),
  /** Cartons livrés, encore à ranger (chantier a): ingrédient, nombre, lourd. */
  cartons: v.array(v.tuple([Str, Nat, v.boolean()])),
  /** Dépannages en route: ingrédient, cartons, seconde de service d'arrivée. */
  emergencies: v.array(v.tuple([Str, Nat, N])),
  groups: v.array(GroupSchema),
  nextGroupId: Nat,
  /** Arrivées de la journée, triées: seconde, profil, taille, à emporter. */
  arrivals: v.array(v.tuple([N, Str, Nat, v.boolean()])),
  /** Habitués attendus: seconde, identifiant. */
  expected: v.array(v.tuple([N, Str])),
  /** Tables laissées sales: meuble, seconde de service depuis laquelle elle l'est. */
  dirty: v.array(v.tuple([Str, N])),
  regulars: v.record(
    Str,
    v.strictObject({ bond: N, steps: v.array(Str), lastDay: Nat, visits: Nat }),
  ),
  simoneTips: v.array(Str),
  today: DayStats,
  report: v.nullable(ReportSchema),
  history: v.array(v.tuple([Nat, Int, Nat, N, N])),
  guestbook: v.array(GuestbookEntrySchema),
  guestbookCount: Nat,
  event: v.nullable(ActiveEventSchema),
  /** Événements prévus aujourd'hui et leur minute de jeu (inspection: tirée à l'aube). */
  eventsToday: v.array(v.tuple([Str, Nat])),
  eventsDone: v.record(Str, v.picklist(['reussi', 'formidable'])),
  affluence: v.array(v.tuple([Nat, N])),
  /** Jour de la lettre de René, 0 tant qu'elle n'est pas arrivée. */
  letterDay: Nat,
  demoEnded: v.boolean(),
  servedTotal: Nat,
  /** Repères de l'événement en cours visibles des deux (machine en panne, averse...). */
  conditions: v.array(Str),
  /** Ambiance du jour: valeur (0 à 95), style dominant, cohérence (0 à 1). */
  ambiance: v.tuple([N, Str, N]),
  /**
   * Remises v0.2: réglage de l'onglet (`null`: jamais touché, les valeurs par défaut de
   * `remises.json`), copie prise à l'ouverture (`null` hors service), tampons des habitués, jours
   * ouverts avec la carte de fidélité, portions vendues des trois derniers jours.
   */
  discounts: v.optional(v.nullable(DiscountSettingsSchema), null),
  activeDiscounts: v.optional(v.nullable(DiscountSettingsSchema), null),
  stamps: v.optional(v.record(Str, Nat), () => ({})),
  loyaltyDays: v.optional(Nat, 0),
  soldHistory: v.optional(v.array(v.record(Str, Nat)), () => []),
  /** Actions de marketing lancées (marketing v0.2), les plus anciennes d'abord. */
  campaigns: v.optional(v.array(CampaignSchema), () => []),
  /** Où est chaque joueur dans l'interface (« Sur son téléphone : Catalogue »), `null`: en jeu. */
  uiPlaces: v.optional(v.tuple([v.nullable(Str), v.nullable(Str)]), () => [null, null]),
  /** Page du bilan que lit chaque joueur: jour du bilan, page (à partir de 1). */
  eveningPages: v.optional(v.tuple([v.tuple([Nat, Nat]), v.tuple([Nat, Nat])]), () => [
    [0, 1],
    [0, 1],
  ]),
  /**
   * Boîte de dépôt vers le service (chantier a), vidée par `takeServiceOutbox`: commandes à
   * mettre en tickets, vaisselle laissée sur les tables, cartons livrés à poser à la porte.
   */
  outbox: v.strictObject({
    orders: v.array(
      v.strictObject({
        group: Nat,
        items: v.array(Str),
        reorder: v.boolean(),
        player: v.nullable(Player),
      }),
    ),
    dishes: v.array(v.strictObject({ table: v.nullable(Str), seats: v.array(Str), pieces: Nat })),
    cartons: v.array(v.tuple([Str, Nat, v.boolean()])),
  }),
});
export type ClienteleState = v.InferOutput<typeof ClienteleStateSchema>;

export function emptyDayStats(): DayStatsState {
  return {
    revenue: 0,
    tips: 0,
    materials: 0,
    served: 0,
    people: 0,
    left: 0,
    satSum: 0,
    satCount: 0,
    points: 0,
    basket: 0,
    euros: 0,
    spent: 0,
    visits: [],
    liked: {},
    missed: {},
    goods: 0,
    shipping: 0,
    emergency: 0,
    lost: 0,
    lostItems: [],
    basketValue: 0,
    discounts: 0,
    discountBy: {},
    discountOrders: 0,
    marketing: 0,
    fromCampaigns: {},
    fromWord: 0,
    campaignWords: [],
    sold: {},
  };
}

/** État du jour 1 avant l'aube; `startHouse` (journee.ts) le remplit avec les données. */
export function createClienteleState(): ClienteleState {
  return {
    day: 0,
    phase: 'monday',
    serviceSec: 0,
    closingAt: 0,
    pace: 'normal',
    weather: 'couvert',
    tomorrowWeather: 'couvert',
    houseName: null,
    namePending: null,
    votes: {},
    slate: [],
    known: [],
    equipment: [],
    stations: {},
    dishes: 0,
    cash: 0,
    debt: 0,
    points: 0,
    cups: 0,
    renown: 0,
    openDays: 0,
    satYesterday: 70,
    tiers: [],
    purchases: [],
    gifts: [],
    unlocks: [],
    flags: [],
    brocante: [],
    proposals: [],
    stock: {},
    lots: {},
    order: null,
    usage: [],
    todayUse: {},
    cartons: [],
    emergencies: [],
    groups: [],
    nextGroupId: 1,
    arrivals: [],
    expected: [],
    dirty: [],
    regulars: {},
    simoneTips: [],
    today: emptyDayStats(),
    report: null,
    history: [],
    guestbook: [],
    guestbookCount: 0,
    event: null,
    eventsToday: [],
    eventsDone: {},
    affluence: [],
    letterDay: 0,
    demoEnded: false,
    servedTotal: 0,
    conditions: [],
    ambiance: [0, 'campagne', 0],
    discounts: null,
    activeDiscounts: null,
    stamps: {},
    loyaltyDays: 0,
    soldHistory: [],
    campaigns: [],
    uiPlaces: [null, null],
    eveningPages: [
      [0, 1],
      [0, 1],
    ],
    outbox: { orders: [], dishes: [], cartons: [] },
  };
}
