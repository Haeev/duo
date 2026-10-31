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
    notebookTabs: strings(['quests', 'mail', 'bag'] as const),
    questKinds: strings(['main', 'side'] as const),
    questDone: str,
    hud: strings(['purse', 'day', 'time', 'nextGoal'] as const),
    shop: strings(['title', 'buy', 'sell', 'price', 'close'] as const),
    catalogue: strings(['title', 'subtitle', 'order'] as const),
    crate: strings(['title', 'subtitle', 'deposit', 'takeBack'] as const),
    workbench: strings(['title', 'craft', 'missing'] as const),
    stove: strings(['title', 'cook', 'eat', 'eatTogether'] as const),
    give: str,
    proposal: strings(['accept', 'decline', 'withdraw'] as const),
    breakfast: strings(['title', 'envie', 'sharedEnvie', 'weather', 'start'] as const),
    creation: strings(['title', 'name', 'hair', 'outfit', 'ready', 'waiting'] as const),
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
    scene: str,
    carrying: str,
    building: str,
    crafting: str,
    cooking: str,
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
    keysActivate: str,
    gameGoesOn: str,
    categories: v.record(str, str),
    snack: str,
    furniture: str,
    tool: str,
    seed: str,
    inProgress: str,
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
    ] as const).entries,
    effects: v.record(str, str),
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
  workbench: strings(['makes', 'have', 'fromCellar', 'inProgress', 'lockedPlans', 'noRecipes', 'keysCraft'] as const),
  stove: strings(['cookSection', 'eatSection', 'nothingToEat', 'portions'] as const),
  chest: strings(['title', 'subtitle', 'inChest', 'inBag', 'take', 'takeAll', 'store', 'emptyChest', 'emptyBag'] as const),
  proposal: strings(['from', 'mine', 'received', 'sent', 'receivedNote', 'acceptedGrocery', 'acceptedCatalogue', 'enterHint', 'you'] as const),
  build: strings(['holding', 'canPlace', 'blocked', 'rotate', 'move', 'place', 'take', 'store'] as const),
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
  end: strings(['ticket', 'days', 'lines', 'linesOf', 'furniture', 'continue', 'after', 'chipContinue', 'bothReady'] as const),
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
    messages: content.texts.messages,
    orderFormat: content.texts.orderFormat,
    weekdays: content.texts.weekdays,
    weather: content.texts.weather,
  };
}
