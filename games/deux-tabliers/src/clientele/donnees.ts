// Données du chantier « clientele »: fichiers de `donnees/clientele/` (générés par
// `outils/importer-clientele.py` depuis la démo du game designer), décrits dans `donnees/SCHEMA.md`.
import { v } from '@duo/sdk';
import { readFile, type DataFiles } from '../donnees/charger';

const N = v.number();
const Pos = v.pipe(v.number(), v.minValue(0));
const Nat = v.pipe(v.number(), v.integer(), v.minValue(0));
const Str = v.string();
const Point = v.tuple([N, N]);

const SeatKind = v.picklist(['counter', 'table', 'comfort', 'terrace']);
export type SeatKind = v.InferOutput<typeof SeatKind>;

const ProfileSchema = v.object({
  id: Str,
  name: Str,
  seeks: Str,
  mainCraving: Str,
  secondaryCravings: v.array(Str),
  seat: SeatKind,
  priceSensitivity: Pos,
  patienceSeconds: Pos,
  waitWithoutPenaltySeconds: Pos,
  stayGameMinutes: Point,
  groupSizes: v.array(Point),
  eatsShare: Pos,
  takeAwayShare: Pos,
  reorder: v.nullable(Point),
  styles: v.array(Str),
  wantedEquipment: v.array(Str),
  tipFactor: Pos,
  groupsPerDay: Pos,
  hourWeights: v.array(Point),
  dayFactors: v.pipe(v.array(Pos), v.length(6)),
  weatherFactors: v.record(Str, Pos),
  seasonFactor: Pos,
  color: Str,
  models: v.array(Str),
});
export type Profile = v.InferOutput<typeof ProfileSchema>;

const RulesSchema = v.object({
  slateLines: Nat,
  presentMax: Nat,
  standingAtCounter: Nat,
  queuePlaces: Nat,
  /**
   * File à la caisse: écart entre deux personnes (m); secondes à la caisse sans être servi avant
   * de laisser passer les suivants (s'il y en a); secondes à l'écart avant de revenir juste
   * derrière le client en tête.
   */
  queue: v.object({
    spacing: Pos,
    stepAsideSeconds: Pos,
    asideReturnSeconds: Pos,
    /** Ce que dit un habitué qui laisse passer les suivants. */
    asideLine: Str,
  }),
  estimatedSecondsPerGroup: Pos,
  softClosingGameMinutes: Pos,
  servedAfterSoftCloseGameMinutes: Pos,
  standingStayFactor: Pos,
  drinks: v.array(Str),
  foods: v.array(Str),
  cravingWeights: v.object({ main: Pos, secondary: Pos }),
  slatePoints: v.object({ main: Nat, secondary: Nat, variety: Nat, varietyCount: Nat }),
  slateFactors: v.array(Pos),
  priceBounds: Point,
  place: v.object({
    base: N,
    ambiance: N,
    style50: N,
    style75: N,
    equipment: N,
    equipmentMax: Nat,
  }),
  cupFactors: v.array(Point),
  mood: v.object({ pivot: N, slope: N, bound: N }),
  satisfaction: v.object({
    base: N,
    perSecond: N,
    waitMax: N,
    perfect: N,
    good: N,
    fine: N,
    connoisseurQualityWeight: N,
    latteArt: N,
    homemade: N,
    priceSlope: N,
    priceBound: N,
    wantedSeat: N,
    standing: N,
    dirtyTable: N,
    ambianceDivisor: Pos,
    chat: N,
    asUsual: N,
    forgottenOption: N,
  }),
  tips: v.object({
    threshold: N,
    rate: N,
    delightedRate: N,
    delightedThreshold: N,
    probability: N,
  }),
  guestbook: v.object({
    delighted: N,
    delightedChance: N,
    disappointed: N,
    disappointedChance: N,
    regularChance: N,
    /** Un habitué n'écrit pas deux fois en moins de ce nombre de jours (RN-06). */
    regularGapDays: v.optional(Nat, 3),
    kept: Nat,
    /** Bilan du soir: un client à cette satisfaction ou moins compte dans « Ce qui a manqué ». */
    reportMissedBelow: N,
  }),
  seatFallbacks: v.record(Str, v.array(SeatKind)),
  counterSeatMaxGroup: Nat,
  weather: v.object({
    kinds: v.array(Str),
    chances: v.record(Str, Pos),
    terraceOpen: v.record(Str, v.boolean()),
    names: v.record(Str, Str),
    forced: v.array(v.tuple([Nat, Str])),
  }),
  talkReach: Pos,
  maxRegularsPerDay: Nat,
  walk: v.object({
    cell: Pos,
    speed: Pos,
    radius: Pos,
    searchNodes: Nat,
    blockedZones: v.array(Str),
    terraceZoneLabel: Str,
  }),
  /** Allures des clients de passage: modèle et profils qu'il peut représenter. */
  looks: v.array(v.object({ model: Str, profiles: v.array(Str) })),
  /** Pas deux fois la même allure parmi les `lookWindow` dernières entrées. */
  lookWindow: Nat,
  standingSpots: v.array(Point),
  seatKinds: v.record(Str, SeatKind),
  waitingSpots: v.array(Point),
  picnicSpots: v.array(Point),
  placeWalk: v.tuple([Point, Point]),
  windowWatch: v.object({ z: N, reach: Pos }),
  fallbackPrepSeconds: v.nullable(Pos),
  closingGraceGameMinutes: Pos,
  extensionZones: v.record(Str, Str),
});
export type Rules = v.InferOutput<typeof RulesSchema>;

const RecipeSchema = v.object({
  id: Str,
  name: Str,
  family: Str,
  basePrice: Pos,
  costMaterials: Pos,
  ingredients: v.array(v.tuple([Str, Pos])),
  stations: v.array(Str),
  dishes: Nat,
  unlock: v.object({
    kind: v.picklist(['start', 'purchase', 'regular']),
    item: v.optional(Str),
    regular: v.optional(Str),
    level: v.optional(Nat),
  }),
});
export type Recipe = v.InferOutput<typeof RecipeSchema>;

const IngredientSchema = v.object({
  id: Str,
  name: Str,
  /** Conditionnement d'un carton, pour la tablette (« caisse de 6 bouteilles d'1 L »). */
  pack: v.optional(Str, ''),
  unit: Str,
  unitCost: Pos,
  supplier: Str,
  storage: Str,
  shelfDays: Nat,
  cartonUnits: Pos,
  cartonHeavy: v.boolean(),
});
export type Ingredient = v.InferOutput<typeof IngredientSchema>;

const SuppliesSchema = v.object({
  suppliers: v.array(
    v.object({
      id: Str,
      name: Str,
      deliveryTime: Nat,
      line: Str,
      emergency: v.boolean(),
      /** Jours de passage (`tue`...), format de `journees.json`; personne ne livre un jour fermé. */
      days: v.array(Str),
      /** Port offert à partir de `franco` euros commandés; sinon `shipping` euros à la livraison. */
      franco: v.pipe(v.number(), v.minValue(0)),
      shipping: v.pipe(v.number(), v.minValue(0)),
    }),
  ),
  ingredients: v.array(IngredientSchema),
  ordering: v.object({
    emergencyGameMinutes: Pos,
    emergencySurcharge: Pos,
    basketReputationPerItem: Pos,
    basketMaxPerDay: Nat,
    baselineServingsPerRecipe: Pos,
    historyDays: Nat,
    margin: Pos,
    /** Marge de la commande habituelle pour ce qui se garde deux jours au plus. */
    freshMargin: Pos,
    /** Fournisseur dont les pièces invendues partent au panier du soir. */
    basketSupplier: v.optional(Str, 'lucas'),
  }),
});

const PurchaseSchema = v.object({
  id: Str,
  name: Str,
  price: Pos,
  tier: Str,
  effects: v.array(Str),
});
export type Purchase = v.InferOutput<typeof PurchaseSchema>;
const ExtensionSchema = v.object({
  id: Str,
  name: Str,
  price: Pos,
  tier: Str,
  nights: Nat,
  seats: v.tuple([Nat, Nat, Nat, Nat]),
  text: Str,
});
export type Extension = v.InferOutput<typeof ExtensionSchema>;
const CatalogItemSchema = v.object({
  id: Str,
  name: Str,
  category: Str,
  style: Str,
  price: Pos,
  charm: Pos,
  tier: v.nullable(Str),
  source: v.nullable(Str),
  ref: v.nullable(Str),
  comfort: v.boolean(),
});
export type CatalogItem = v.InferOutput<typeof CatalogItemSchema>;

const EconomySchema = v.object({
  startCash: Pos,
  rentPerMonth: Pos,
  rentDaysPerMonth: Pos,
  /** Charges d'un jour ouvert, détaillées au bilan (euros). */
  charges: v.array(v.object({ id: Str, name: Str, perOpenDay: Pos })),
  /** Réserve laissée par Simone: ingrédient, cartons (offerts, datés du premier jour ouvert). */
  startStock: v.array(v.tuple([Str, Nat])),
  reserveDaysOfCharges: Pos,
  priceSteps: v.object({ min: v.pipe(v.number(), v.integer()), max: Nat, step: Pos }),
  bigPurchase: v.object({ minimum: Pos, shareOfDailyRevenue: Pos }),
  reputation: v.object({
    startCups: Pos,
    stepPoints: Pos,
    pivot: N,
    divisor: Pos,
    catchUp: v.tuple([Nat, Pos, Pos]),
    maxCups: Pos,
  }),
  offer: v.object({ renown: Pos, fallbackEvent: Str }),
  challenge: v.object({
    event: Str,
    day: Nat,
    affluence: Pos,
    renown: Pos,
    groups: Nat,
    cups: Pos,
    trestleSeats: Nat,
  }),
  ambiance: v.object({
    surfaces: v.record(Str, Pos),
    decorMax: Pos,
    charmPerM2ForMax: Pos,
    coherenceMax: Pos,
    comfortFactor: Pos,
    comfortMax: Pos,
    lightPerM2: Pos,
    lightMax: Pos,
    musicMatching: Pos,
    musicOther: Pos,
    radioStyle: Str,
    cleanliness: Pos,
    wornCharmFactor: Pos,
    max: Pos,
    wheel: v.array(Str),
    extensionDecor: v.record(Str, v.array(v.tuple([Str, Pos, Str, Nat]))),
    coatMultiplier: v.record(Str, Pos),
  }),
  brocante: v.object({ pieces: Nat, discount: Pos, charmFactor: Pos }),
  flowerMarket: v.object({ day: Nat, discount: Pos, untilDay: Nat }),
  demoEndDay: Nat,
  demoMaxDay: Nat,
  tiers: v.array(v.object({ id: Str, name: Str, cups: Pos, orDay: Nat })),
  stationsAtStart: v.record(Str, Nat),
  dishesAtStart: Nat,
  purchases: v.array(PurchaseSchema),
  extensions: v.array(ExtensionSchema),
  catalogue: v.array(CatalogItemSchema),
  startDecor: v.array(v.object({ id: Str, count: Nat, worn: v.boolean() })),
});
export type Economy = v.InferOutput<typeof EconomySchema>;

const DaySchema = v.object({
  day: Nat,
  weekday: Str,
  open: v.boolean(),
  title: Str,
  new: v.array(Str),
  regulars: v.array(Str),
  event: v.nullable(Str),
  dayEvent: v.nullable(Str),
  projects: v.array(Str),
  simone: v.array(Str),
  endOfDemo: v.boolean(),
});
export type DayPlan = v.InferOutput<typeof DaySchema>;
const DaysSchema = v.object({
  open: Nat,
  close: Nat,
  secondsPerGameMinute: Pos,
  peacefulSecondsPerGameMinute: Pos,
  weekdays: v.pipe(v.array(Str), v.length(7)),
  days: v.array(DaySchema),
  projects: v.array(v.object({ id: Str, name: Str, condition: Str })),
});

const Lines = v.record(Str, v.array(Str));
const RegularSchema = v.object({
  id: Str,
  name: Str,
  profile: Str,
  size: Nat,
  favorite: v.array(Str),
  fallbackFavorite: v.array(Str),
  schedule: v.array(v.tuple([v.array(Str), v.array(Nat)])),
  firstDay: Nat,
  unlockedBy: v.nullable(Str),
  lines: Lines,
  tips: v.record(Str, Str),
  story: v.array(
    v.object({
      level: Nat,
      id: Str,
      scene: Str,
      reward: v.record(Str, v.unknown()),
      minCups: Pos,
    }),
  ),
  model: Str,
});
export type Regular = v.InferOutput<typeof RegularSchema>;
const RegularsSchema = v.object({
  bondLevels: v.array(v.object({ level: Nat, points: Pos, name: Str })),
  bondGains: v.object({ visitServed: Pos, favoriteServed: Pos, asUsual: Pos, chat: Pos }),
  regulars: v.array(RegularSchema),
});

const Reward = v.object({
  euros: Pos,
  points: Pos,
  renown: Pos,
  affluence: v.nullable(v.tuple([Pos, Nat])),
});
export type EventReward = v.InferOutput<typeof Reward>;
const EventSchema = v.object({
  id: Str,
  name: Str,
  kind: Str,
  day: v.nullable(Nat),
  fromDay: v.nullable(Nat),
  fallbackDay: v.nullable(Nat),
  time: v.nullable(Nat),
  announce: v.nullable(Str),
  cast: v.array(v.object({ id: Str, name: Str })),
  scene: v.array(v.object({ who: Str, text: Str })),
  goal: v.nullable(Str),
  timeLimit: v.nullable(Pos),
  helpAfter: v.nullable(Pos),
  help: v.nullable(Str),
  criteria: v.array(Str),
  outcomes: v.record(Str, Str),
  rewards: v.object({ reussi: v.optional(Reward), formidable: v.optional(Reward) }),
  items: v.array(Str),
  guestbook: v.nullable(Str),
  effects: v.nullable(
    v.object({
      profiles: v.record(Str, Pos),
      catalogPlantDiscount: Pos,
      discountUntilDay: Nat,
    }),
  ),
  staging: v.object({
    profile: v.optional(Str),
    groups: v.optional(v.array(Nat)),
    orders: v.optional(v.array(v.array(Str))),
    fallbackOrders: v.optional(v.array(v.array(Str))),
    families: v.optional(v.array(v.tuple([Str, Nat, v.nullable(Str)]))),
    milkFamilies: v.optional(v.array(Str)),
    seat: v.optional(v.picklist(['takeaway', 'outside'])),
    extension: v.optional(Pos),
    helpAfter: v.optional(Pos),
    itemDelayDays: v.optional(Nat),
    pairWindow: v.optional(Pos),
    reach: v.optional(Pos),
    formidableBefore: v.optional(Nat),
    station: v.optional(Str),
    minCups: v.optional(Pos),
    formidableCriteria: v.optional(Nat),
    advice: v.optional(v.array(Str)),
    clueCounter: v.optional(Str),
    clueBar: v.optional(Str),
    formidableWithin: v.optional(Pos),
    clues: v.optional(v.array(Str)),
    passersby: v.optional(v.array(Str)),
    correct: v.optional(Nat),
    returnGroup: v.optional(Nat),
    window: v.optional(Point),
    duration: v.optional(Pos),
    dirtyLimit: v.optional(Pos),
    from: v.optional(Nat),
    to: v.optional(Nat),
    goal: v.optional(Nat),
    durationGameMinutes: v.optional(Pos),
    standLimit: v.optional(Pos),
    lastDay: v.optional(Nat),
    writeGameMinutes: v.optional(Pos),
    /** Répliques des scènes: clé, [qui parle, texte] (`{list}`, `{text}` remplacés). */
    lines: v.optional(v.record(Str, v.tuple([Str, Str]))),
  }),
});
export type EventDef = v.InferOutput<typeof EventSchema>;

const TextsSchema = v.object({
  dialogues: v.record(Str, v.array(v.object({ who: Str, text: Str }))),
  guestbook: v.object({
    positive: v.record(Str, v.array(Str)),
    negative: v.record(Str, v.array(Str)),
    regulars: Lines,
    /** Mot qui parle d'un meuble: type de meuble (préfixe) ou équipement qu'il faut au café. */
    requires: v.optional(v.record(Str, Str), {}),
  }),
  ui: v.record(Str, v.unknown()),
});
export type Texts = v.InferOutput<typeof TextsSchema>;

// ---------------------------------------------------------------------------------------------
// Remises et marketing (v0.2, `remises-marketing-v0-2.md`, section 7)

const Weekday = v.picklist(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const Tier = v.picklist(['P0', 'P1']);
const Rate = v.pipe(v.number(), v.minValue(0), v.maxValue(0.9));

const DiscountsSchema = v.object({
  floorAtCost: v.boolean(),
  satisfactionWeight: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  happyHour: v.object({
    tier: Tier,
    starts: v.array(Nat),
    lengths: v.array(Nat),
    rates: v.array(Rate),
    default: v.object({ start: Nat, length: Nat, rate: Rate, days: v.array(Weekday) }),
    families: v.array(Str),
  }),
  dailyOffer: v.object({
    tier: Tier,
    rates: v.array(Rate),
    default: Rate,
    familyWeightBonus: Pos,
    pickWeight: Pos,
    maxRecipes: Nat,
    suggestWhenLeftOverUsual: Pos,
  }),
  profileRates: v.array(
    v.object({
      id: Str,
      tier: Tier,
      profile: Str,
      rates: v.array(Rate),
      default: Rate,
      defaultDays: v.array(Weekday),
    }),
  ),
  loyaltyCard: v.object({
    tier: Tier,
    price: Pos,
    purchase: Str,
    stamps: v.pipe(Nat, v.minValue(1)),
    families: v.array(Str),
    profiles: v.array(Str),
    holderShareStart: Pos,
    holderSharePerDay: Pos,
    holderShareMax: v.pipe(v.number(), v.minValue(0.01), v.maxValue(1)),
    attractionBonusMax: Pos,
    freeSatisfaction: N,
    guestbookChance: Pos,
  }),
  texts: v.object({
    names: v.record(Str, Str),
    profileLabels: v.record(Str, Str),
    absent: v.record(Str, Str),
    guestbook: v.record(Str, v.array(Str)),
  }),
});
export type Discounts = v.InferOutput<typeof DiscountsSchema>;

const MarketingActionSchema = v.object({
  id: Str,
  tier: Tier,
  name: Str,
  blurb: Str,
  cost: Pos,
  delayDays: v.optional(Nat),
  launchWeekdays: v.optional(v.array(Weekday)),
  publishWeekday: v.optional(Weekday),
  deadlineWeekday: v.optional(Weekday),
  durationDays: v.pipe(Nat, v.minValue(1)),
  peak: Pos,
  halfLifeDays: v.pipe(v.number(), v.minValue(0.1)),
  profiles: v.record(Str, Pos),
  guestbook: v.array(Str),
});
export type MarketingAction = v.InferOutput<typeof MarketingActionSchema>;

const MarketingSchema = v.object({
  maxBoost: v.pipe(v.number(), v.minValue(0.01)),
  repeatFactor: Pos,
  repeatCooldownDays: Nat,
  guestbookChance: Pos,
  guestbookMinSatisfaction: N,
  bigProposalEuros: Pos,
  actions: v.array(MarketingActionSchema),
});
export type Marketing = v.InferOutput<typeof MarketingSchema>;

export interface ClienteleContent {
  readonly profiles: ReadonlyMap<string, Profile>;
  readonly profileList: readonly Profile[];
  readonly rules: Rules;
  readonly recipes: ReadonlyMap<string, Recipe>;
  readonly recipeList: readonly Recipe[];
  readonly ingredients: ReadonlyMap<string, Ingredient>;
  readonly supplies: v.InferOutput<typeof SuppliesSchema>;
  readonly economy: Economy;
  readonly purchases: ReadonlyMap<string, Purchase>;
  readonly extensions: ReadonlyMap<string, Extension>;
  readonly catalogue: ReadonlyMap<string, CatalogItem>;
  readonly days: v.InferOutput<typeof DaysSchema>;
  readonly regulars: v.InferOutput<typeof RegularsSchema>;
  readonly regularById: ReadonlyMap<string, Regular>;
  readonly events: ReadonlyMap<string, EventDef>;
  readonly texts: Texts;
  readonly discounts: Discounts;
  readonly marketing: Marketing;
  readonly actions: ReadonlyMap<string, MarketingAction>;
}

const DIR = 'clientele/';

function mapOf<T extends { readonly id: string }>(list: readonly T[]): Map<string, T> {
  return new Map(list.map((x) => [x.id, x]));
}

export function loadClienteleContent(files: DataFiles, issues: string[]): ClienteleContent {
  if ('clientele.json' in files)
    issues.push('clientele.json: lecteur à écrire dans src/clientele/donnees.ts');
  const before = issues.length;
  const profiles = readFile(
    files,
    `${DIR}profils.json`,
    v.object({ profiles: v.array(ProfileSchema) }),
    issues,
  );
  const rules = readFile(files, `${DIR}regles.json`, RulesSchema, issues);
  const recipes = readFile(
    files,
    `${DIR}carte.json`,
    v.object({ recipes: v.array(RecipeSchema) }),
    issues,
  );
  const supplies = readFile(files, `${DIR}fournisseurs.json`, SuppliesSchema, issues);
  const economy = readFile(files, `${DIR}economie.json`, EconomySchema, issues);
  const days = readFile(files, `${DIR}journees.json`, DaysSchema, issues);
  const regulars = readFile(files, `${DIR}habitues.json`, RegularsSchema, issues);
  const events = readFile(
    files,
    `${DIR}evenements.json`,
    v.object({ events: v.array(EventSchema) }),
    issues,
  );
  const texts = readFile(files, `${DIR}textes.json`, TextsSchema, issues);
  const discounts = readFile(files, `${DIR}remises.json`, DiscountsSchema, issues);
  const marketing = readFile(files, `${DIR}marketing.json`, MarketingSchema, issues);
  if (
    profiles === null ||
    rules === null ||
    recipes === null ||
    supplies === null ||
    economy === null ||
    days === null ||
    regulars === null ||
    events === null ||
    texts === null ||
    discounts === null ||
    marketing === null
  ) {
    return EMPTY;
  }
  const content: ClienteleContent = {
    profiles: mapOf(profiles.profiles),
    profileList: profiles.profiles,
    rules,
    recipes: mapOf(recipes.recipes),
    recipeList: recipes.recipes,
    ingredients: mapOf(supplies.ingredients),
    supplies,
    economy,
    purchases: mapOf(economy.purchases),
    extensions: mapOf(economy.extensions),
    catalogue: mapOf(economy.catalogue),
    days,
    regulars,
    regularById: mapOf(regulars.regulars),
    events: mapOf(events.events),
    texts,
    discounts,
    marketing,
    actions: mapOf(marketing.actions),
  };
  // Références croisées: une donnée qui en cite une autre absente arrête le chargement.
  const p = (where: string, what: string): void => {
    issues.push(`${DIR}${where}: inconnu « ${what} »`);
  };
  for (const r of content.recipeList)
    for (const [ing] of r.ingredients)
      if (!content.ingredients.has(ing)) p(`carte.json (${r.id})`, ing);
  for (const [ing] of economy.startStock)
    if (!content.ingredients.has(ing)) p('economie.json (startStock)', ing);
  for (const i of supplies.ingredients)
    if (!supplies.suppliers.some((x) => x.id === i.supplier))
      p(`fournisseurs.json (${i.id})`, i.supplier);
  for (const r of content.regulars.regulars) {
    if (!content.profiles.has(r.profile)) p(`habitues.json (${r.id})`, r.profile);
    for (const f of [...r.favorite, ...r.fallbackFavorite])
      if (!content.recipes.has(f)) p(`habitues.json (${r.id})`, f);
  }
  for (const d of content.days.days) {
    for (const r of d.regulars)
      if (r !== 'rene' && !content.regularById.has(r))
        p(`journees.json (jour ${String(d.day)})`, r);
    if (d.event !== null && !content.events.has(d.event))
      p(`journees.json (jour ${String(d.day)})`, d.event);
  }
  for (const e of content.events.values()) {
    for (const item of e.items)
      if (!content.catalogue.has(item)) p(`evenements.json (${e.id})`, item);
    if (e.staging.profile !== undefined && !content.profiles.has(e.staging.profile))
      p(`evenements.json (${e.id})`, e.staging.profile);
  }
  for (const r of discounts.profileRates)
    if (!content.profiles.has(r.profile)) p(`remises.json (${r.id})`, r.profile);
  for (const id of discounts.loyaltyCard.profiles)
    if (!content.profiles.has(id)) p('remises.json (loyaltyCard)', id);
  if (!content.purchases.has(discounts.loyaltyCard.purchase))
    p('remises.json (loyaltyCard)', discounts.loyaltyCard.purchase);
  for (const a of marketing.actions)
    for (const id of Object.keys(a.profiles))
      if (!content.profiles.has(id)) p(`marketing.json (${a.id})`, id);
  if (issues.length > before) return EMPTY;
  return content;
}

// Jamais lu par le jeu: `loadContent` lève `ContentError` dès qu'un problème est noté.
const EMPTY: ClienteleContent = {
  profiles: new Map(),
  profileList: [],
  rules: undefined as unknown as Rules,
  recipes: new Map(),
  recipeList: [],
  ingredients: new Map(),
  supplies: undefined as unknown as v.InferOutput<typeof SuppliesSchema>,
  economy: undefined as unknown as Economy,
  purchases: new Map(),
  extensions: new Map(),
  catalogue: new Map(),
  days: undefined as unknown as v.InferOutput<typeof DaysSchema>,
  regulars: undefined as unknown as v.InferOutput<typeof RegularsSchema>,
  regularById: new Map(),
  events: new Map(),
  texts: undefined as unknown as Texts,
  discounts: undefined as unknown as Discounts,
  marketing: undefined as unknown as Marketing,
  actions: new Map(),
};
