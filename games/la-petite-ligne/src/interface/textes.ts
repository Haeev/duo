/**
 * Textes de l'interface. Deux sources, contrôlées au montage:
 * - `donnees/textes.json` (game designer): ce qu'il contient prime toujours;
 * - `textes-interface.json` (ici): les libellés des maquettes
 *   (`ui-maquettes/README.md`, section 8) que `textes.json` n'a pas encore.
 * Aucun texte affiché n'est écrit dans le code.
 */
import * as v from 'valibot';
import type { Content } from '../donnees/types';
import supplement from './textes-interface.json';

const str = v.string();
const strings = <K extends string>(keys: readonly K[]): v.ObjectSchema<Record<K, typeof str>, undefined> =>
  v.object(Object.fromEntries(keys.map((k) => [k, str])) as Record<K, typeof str>);

/** Parties de `textes.json` que l'interface lit (`Texts.raw`). */
const GameUiSchema = v.object({
  ui: v.object({
    notebookTabs: strings(['quests', 'mail', 'bag', 'memories'] as const),
    questKinds: strings(['main', 'side'] as const),
    questDone: str,
    /** En-tête de la fiche secrète (R16) au carnet. */
    secretCard: str,
    /** Ligne « Aujourd'hui » du carnet: la confidence du matin (moments rares). */
    momentHint: str,
    hud: v.object({
      ...strings(['purse', 'day', 'time', 'nextGoal', 'season'] as const).entries,
      seasonNames: strings(['spring', 'summer', 'autumn', 'winter'] as const),
    }),
    shop: strings(['title', 'buy', 'sell', 'price', 'close'] as const),
    catalogue: strings(['title', 'subtitle', 'order'] as const),
    crate: strings(['title', 'subtitle', 'deposit', 'takeBack'] as const),
    workbench: strings(['title', 'craft', 'missing'] as const),
    stove: strings(['title', 'cook', 'eat', 'eatTogether'] as const),
    give: str,
    /** Tour 9: tableau du quai (annonces, chantiers), établi de Basile, cadeau, écran d'étape. */
    offer: str,
    board: strings(['annonces', 'chantiers', 'chantiersTitle', 'progress', 'pay50', 'pay100', 'payRest', 'funded', 'until', 'reward', 'done', 'expired'] as const),
    basile: strings(['order', 'price', 'planks'] as const),
    stage: strings(['chantiers'] as const),
    proposal: strings(['accept', 'decline', 'withdraw'] as const),
    breakfast: strings(['title', 'envie', 'sharedEnvie', 'weather', 'start'] as const),
    creation: strings(['title', 'name', 'hair', 'outfit', 'ready', 'waiting'] as const),
  }),
  /** Onglet Souvenirs du carnet (tour 7, conception section 2.3). */
  souvenirs: v.object({
    ...strings(['empty', 'rumorLead', 'listLabel', 'date', 'divider', 'yearN', 'often', 'last', 'lastOtherYear', 'firstTry', 'vignetteGeneric', 'fresh'] as const).entries,
    seasons: v.pipe(v.array(str), v.minLength(1)),
    seasonTitles: v.pipe(v.array(str), v.minLength(1)),
    seasonsOf: v.pipe(v.array(str), v.minLength(1)),
    years: v.array(str),
    /** Par nombre de passages: 2 « Vu deux fois ensemble », 3...; au-delà, `often`. */
    times: v.array(str),
    self: strings(['hintVillager', 'hintVillagerPartner', 'hintEve', 'hintEvePartner', 'quest'] as const),
    /** Une entrée par quête à secret: texte de la vignette, ligne chez l'informé, chez l'autre. */
    secrets: v.record(v.string(), strings(['vignette', 'informed', 'doer'] as const)),
  }),
  nightScreen: strings(['title', 'text', 'continue', 'finish', 'partnerContinue', 'partnerFinish'] as const),
  endScreen: v.object({
    title: str,
    subtitle: str,
    text: str,
    stats: strings(['days', 'order', 'furniture'] as const),
  }),
});

const SupplementSchema = v.object({
  version: v.literal(1),
  common: v.object({
    you: str,
    notYet: str,
    ready: str,
    waitingFor: str,
    close: str,
    next: str,
    sous: str,
    countOf: str,
    outOf: str,
    itemCountOf: str,
    linesOf: str,
    lineOf: str,
    missingMoney: str,
    playersLabel: str,
    inBag: str,
    noneInBag: str,
    fine: str,
    fineQuality: str,
    emptySlot: str,
    orientation: v.tuple([str, str, str, str]),
  }),
  keys: v.object({ arrows: v.tuple([str, str, str, str]), escape: str, wheel: str, or: str, click: str, rightClick: str }),
  title: strings(['ticket', 'name', 'lead', 'start', 'resume', 'helpSynced', 'resumeHelp', 'pause'] as const),
  creation: v.object({
    overline: str,
    nameHelp: str,
    nameError: str,
    noName: str,
    hairs: v.tuple([str, str, str]),
    outfits: v.tuple([str, str, str, str]),
    scarf: str,
    edit: str,
    trainArriving: str,
    partnerChoosing: str,
    outfitTaken: str,
    together: str,
    letterWaiting: str,
    letterStamp: str,
    profiles: v.record(str, str),
  }),
  breakfast: strings([
    'overline',
    'secret',
    'secretHelp',
    'shared',
    'sharedHelp',
    'noEnvie',
    'mail',
    'mailNone',
    'mailNew',
    'eggs',
    'egg',
    'partnerEating',
    'partnerStarted',
    'clockHelp',
  ] as const),
  hud: v.object({
    clockLabel: str,
    purseLabel: str,
    reserved: str,
    selfLabel: str,
    stamina: str,
    tired: str,
    noEnergy: str,
    emptyHand: str,
    water: str,
    stack: str,
    toolbarLabel: str,
    toastsLabel: str,
    stopped: strings(['scene', 'veillee', 'both_busy', 'midnight', 'absence'] as const),
    trainArrives: str,
    trainLeaves: str,
    rotateLeft: str,
    rotateRight: str,
    openNotebook: str,
    noObjective: str,
  }),
  partner: v.object({
    away: str,
    asleep: str,
    breakfast: str,
    night: str,
    talking: str,
    /** Appel d'une poule (`hen_call`): la poule nommée comme ce joueur la connaît. */
    callingHen: str,
    /** Interlocuteur inconnu des données: jamais un identifiant à l'écran. */
    someone: str,
    scene: str,
    carrying: str,
    building: str,
    crafting: str,
    cooking: str,
    seated: str,
    /** L'autre remplit sa part d'un moment rare, par identifiant de moment. */
    watching: v.record(str, str),
    watchingAny: str,
    menus: v.record(str, str),
    actions: v.record(str, str),
    places: v.record(str, str),
    elsewhere: str,
  }),
  dialogue: strings([
    'sceneChip',
    'partnerChoice',
    'sceneHelp',
    'partnerChose',
    'partnerChoosing',
    'replies',
    'reply',
    'waitingNext',
    'playerLine',
    'villagerLine',
    'choicesLabel',
    'shopChoicesLabel',
    'shopBuy',
    'shopSell',
    'goodbye',
    'goodbyeKey',
    'readTitle',
  ] as const),
  notebook: v.object({
    title: str,
    tabsLabel: str,
    closeLabel: str,
    toolbar: str,
    bag: str,
    bagFull: str,
    bagEmpty: str,
    detailLabel: str,
    eat: str,
    move: str,
    moving: str,
    hold: str,
    read: str,
    fineMeta: str,
    fineText: str,
    sellText: str,
    unread: str,
    unreadMany: str,
    noLetters: str,
    noQuests: str,
    lettersLabel: str,
    letterOf: str,
    keysPages: str,
    keysChoose: str,
    keysClose: str,
    unstick: str,
    unstickHelp: str,
    keysActivate: str,
    gameGoesOn: str,
    categories: v.record(str, str),
    snack: str,
    furniture: str,
    tool: str,
    seed: str,
    inProgress: str,
    /** Tour 9: liste du courrier à titres (section 5.2), groupe Annonces, commandes faites. */
    letterMeta: str,
    letterLabel: str,
    letterUnread: str,
    annonces: str,
    orderResult: str,
    annonceExpired: str,
  }),
  crate: strings([
    'board',
    'daysLeft',
    'dayLeft',
    'today',
    'empty',
    'complete',
    'completeText',
    'gone',
    'shipped',
    'shippedResult',
    'nextOrder',
    'delivered',
    'deliveredLine',
    'missing',
    'depositCount',
    'nothing',
    'takeBack',
    'linesLabel',
    'canTakeBack',
    'keysDeposit',
    'lineDone',
    'lineTodo',
  ] as const),
  catalogue: v.object({
    ...strings([
      'ordered',
      'orderedNone',
      'bigPurchase',
      'closed',
      'closedText',
      'closedSubtitle',
      'delivered',
      'deliveredOne',
      'deliveredText',
      'deliveredSubtitle',
      'statusOrdered',
      'stampOrdered',
      'stampDelivered',
      'inChest',
      'enterToOrder',
      'askPartner',
      'reserved',
      'waitingPartner',
      'proposedBy',
      'withdraw',
      'closedStatus',
      'partnerSees',
      'keysOrder',
      'shelvesLabel',
      'forVillager',
      'copiesLeft',
      'orderedCount',
    ] as const).entries,
    effects: v.record(str, str),
    shelves: strings(['tools', 'hens', 'house', 'gifts'] as const),
  }),
  shop: strings([
    'closedNotice',
    'buyCount',
    'propose',
    'sellOne',
    'sellAll',
    'unitPrice',
    'room',
    'roomNone',
    'nothingToSell',
    'rate',
    'seedInfo',
    'keysBuy',
  ] as const),
  /** Tableau du quai (tour 9): onglets, annonces, chantiers du bourg. */
  board: v.object({
    ...strings([
      'title',
      'tabsLabel',
      'catalogueTab',
      'annoncesSubtitle',
      'chantiersSubtitle',
      'noAnnonce',
      'current',
      'previous',
      'linesLabel',
      'line',
      'lineGiven',
      'sceneLine',
      'sceneOnly',
      'lineDone',
      'lineTodo',
      'howTo',
      'doneBy',
      'doneTogether',
      'expiredText',
      'payAmount',
      'progressLabel',
      'planksPaid',
      'planksPaidOne',
      'allBuilt',
      'builtTitle',
      'builtOn',
      'home',
      'homeFrom',
      'keysPay',
      'bigPay',
      'nextTomorrow',
      'missingFor',
    ] as const).entries,
    kinds: strings(['help', 'together'] as const),
  }),
  /** Commande des chantiers de la maisonnette à l'établi de Basile (tour 9). */
  basile: strings(['subtitle', 'orderButton', 'bring', 'bringOne', 'noPlanks', 'planksFull', 'help', 'allBuilt'] as const),
  workbench: strings(['makes', 'have', 'fromCellar', 'inProgress', 'lockedPlans', 'noRecipes', 'keysCraft'] as const),
  stove: strings(['cookSection', 'eatSection', 'nothingToEat', 'portions'] as const),
  chest: strings(['title', 'subtitle', 'inChest', 'inBag', 'take', 'takeAll', 'store', 'emptyChest', 'emptyBag'] as const),
  proposal: strings([
    'from',
    'mine',
    'received',
    'sent',
    'receivedNote',
    'acceptedGrocery',
    'acceptedCatalogue',
    'enterHint',
    'you',
    'receivedImprovement',
    'sentImprovement',
    'acceptedImprovement',
  ] as const),
  build: strings(['holding', 'canPlace', 'blocked', 'rotate', 'move', 'place', 'take', 'store', 'corner'] as const),
  corner: strings(['designate', 'move'] as const),
  /** Moments rares (tour 6): ligne d'observation sous l'horloge, confidence du matin. */
  moments: v.object({
    ...strings(['watchLabel', 'partnerReady', 'partnerNotSettled', 'partnerLetGo', 'hintOverline', 'hintChip', 'hintHelp', 'memoryAdded'] as const).entries,
    pose: strings(['close', 'tooClose', 'still', 'facing', 'stillFacing', 'seated', 'hold'] as const),
  }),
  /** Informations propres (R16): fiches du carnet et appel des poules. */
  secrets: v.object({
    ...strings(['mineHelp', 'nudge', 'sharedChip', 'askChip', 'askTitle', 'askText', 'henCallTitle', 'henFound', 'henCallHelp'] as const).entries,
    henWrongAsides: v.pipe(v.array(str), v.minLength(1)),
  }),
  /** Messages de la simulation que `textes.json` n'a pas encore (clés de `messages`); ceux de `textes.json` priment. */
  messages: v.record(v.string(), str),
  night: strings([
    'overline',
    'sessionOver',
    'orderLine',
    'orderDays',
    'orderTomorrow',
    'tomorrowGoal',
    'chipContinue',
    'chipFinish',
    'help',
    'waiting',
    'disagree',
    'partnerContinueHelp',
    'over',
    'saved',
    'choicesLabel',
  ] as const),
  end: strings([
    'ticket',
    'days',
    'lines',
    'linesOf',
    'perOrder',
    'ordersCount',
    'ordersAllComplete',
    'ordersOneComplete',
    'ordersSomeComplete',
    'furniture',
    'chantiers',
    'chantiersStat',
    'stay',
    'finish',
    'chipStay',
    'chipFinish',
    'help',
    'helpLast',
    'partnerStay',
    'partnerFinish',
    'partnerStayHelp',
    'partnerFinishHelp',
    'disagree',
    'bothStay',
    'bothFinish',
    'after',
    'afterLast',
    'choicesLabel',
  ] as const),
});

export type GameUiTexts = v.InferOutput<typeof GameUiSchema>;
export type SupplementTexts = v.InferOutput<typeof SupplementSchema>;

/** Tous les textes de l'interface, contrôlés. */
export interface UiTexts {
  /** `textes.json`: `ui`, `nightScreen`, `endScreen`. */
  game: GameUiTexts;
  /** `textes-interface.json`. */
  extra: SupplementTexts;
  form: readonly { level: string; name: string; text: string }[];
  messages: Readonly<Record<string, string>>;
  orderFormat: { line: string; separator: string; lastSeparator: string };
  weekdays: readonly string[];
  weather: Readonly<Record<string, string>>;
}

export class UiTextsError extends Error {
  override readonly name = 'UiTextsError';
}

function describeIssues(file: string, issues: readonly v.BaseIssue<unknown>[]): string {
  const first = issues[0];
  const path = first?.path?.map((p) => String(p.key)).join('.') ?? '';
  return `${file}: ${path === '' ? 'racine' : path}: ${first?.message ?? 'invalide'}`;
}

/** Lit et contrôle les textes. Lève `UiTextsError` (fichier et champ) si une clé manque. */
export function loadUiTexts(content: Content): UiTexts {
  const game = v.safeParse(GameUiSchema, content.texts.raw);
  if (!game.success) throw new UiTextsError(describeIssues('donnees/textes.json', game.issues));
  const extra = v.safeParse(SupplementSchema, supplement);
  if (!extra.success) throw new UiTextsError(describeIssues('src/interface/textes-interface.json', extra.issues));
  return {
    game: game.output,
    extra: extra.output,
    form: content.texts.form,
    messages: { ...extra.output.messages, ...content.texts.messages },
    orderFormat: content.texts.orderFormat,
    weekdays: content.texts.weekdays,
    weather: content.texts.weather,
  };
}
