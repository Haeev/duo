/**
 * Robot longue vie (tour 8, section 6): une année de 84 jours jouée par deux robots qui restent à
 * la Halte aux étapes `demo` et `summer_end`, avec sauvegarde et reprise à chaque aube, et toutes
 * les mesures L-01 à L-12 de la section 6.2. La limite du jour 43 n'est levée que dans le contenu
 * passé au test (`clock.lastDay`), jamais dans les réglages livrés.
 */
import { isHome } from '../../src/etat/interieurs';
import { hashState } from '@duo/sdk/sim';
import { seasonIndexOf, seasonOfDay } from '../../src/donnees/calendrier';
import type { Content } from '../../src/donnees/types';
import { clashes, inSeason } from '../../src/etat/commande-generee';
import { forageAvailableOn, postKindOn } from '../../src/etat/annonces';
import { letterText, letterTitle } from '../../src/etat/courrier';
import { dialogueDone } from '../../src/etat/dialogues-faits';
import { catalogueOffers } from '../../src/etat/catalogue';
import { improvementRemaining, openImprovements } from '../../src/simulation/chantiers';
import { weekdayOf } from '../../src/donnees/calendrier';
import { treeGrowth } from '../../src/etat/repousse';
import { hudSeason, questTitleOf, seasonCard, stageScreen, weatherLabel } from '../../src/etat/semaine';
import type { CharacterId, Weather, WorldState } from '../../src/etat/types';
import { restoreWorld, snapshotOf } from '../../src/sauvegarde/sauvegarde';
import { NO_CONTEXT, evaluateAll } from '../../src/simulation/conditions';
import type { Sim } from '../../src/simulation/contexte';
import { SIM_HZ } from '../../src/simulation/constantes';
import { step } from '../../src/simulation/pas';
import type { RobotProfile } from '../../src/simulation/robot';
import { contentAndMap, createRobot, newSim } from '../aides';
import { lasting } from '../ete/aides-ete';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const PLAYERS: readonly CharacterId[] = ['p1', 'p2'];
const HOUR = 60;
/** Blocage (L-01): l'heure de jeu n'avance plus pendant deux heures de simulation. */
const STALL_TICKS = SIM_HZ * 60 * 60 * 2;
/**
 * Jetons que l'interface remplace à l'affichage: touches et réglages dans les astuces
 * (`keyTokens`, `contentVars`), prénom de l'autre, couleurs des poules et secret dans les répliques
 * (`secretVars`, rempli selon celui qui lit).
 */
const UI_TOKENS = /\{(move|act|examine|notebook|startPurse|bigPurchase|order|linesDone|linesTotal|amount|partner|henColor\d|secret)\}/g;

/** Le contenu livré, avec la seule prolongation du robot longue vie (section 6.1). */
export function longContent(options: { lastDay?: number; slowFrom?: number | null } = {}): Content {
  const content = structuredClone(contentAndMap().content);
  content.settings.clock.lastDay = { day: options.lastDay ?? 84, end: 16 * HOUR };
  if (options.slowFrom !== undefined && options.slowFrom !== null) {
    content.settings.clock.schedule = [
      { fromDay: 1, secondsPerGameMinute: content.settings.clock.secondsPerGameMinute },
      { fromDay: options.slowFrom, secondsPerGameMinute: 0.8 },
    ];
  }
  return content;
}

export interface DrawnOrder {
  number: number;
  train: number;
  lines: { item: string; count: number; share: number; family: string }[];
  budget: number;
  /** Produits repris de la commande précédente. */
  repeated: number;
  /** I-04, problèmes constatés au tirage (vide: tenu). */
  problems: string[];
}

export interface PaidOrder {
  number: number;
  day: number;
  linesDone: number;
  linesTotal: number;
  complete: boolean;
  amount: number;
}

export interface DayRecord {
  day: number;
  /** Temps réel de la journée (de l'aube à l'aube suivante), en millisecondes (L-01). */
  ms: number;
  /** L-03: octets UTF-8 de `JSON.stringify(world)`, longueur en caractères, par clé, détail. */
  bytes: number;
  chars: number;
  keys: Record<string, number>;
  detail: Record<string, number>;
  memoriesBytes: number;
  /** L-04. */
  weather: Weather;
  mist: boolean;
  /** L-06. */
  trees: { adult: number; sapling: number; stump: number };
  /** L-07: coins garnis à l'aube, unités cueillies dans la journée par sorte. */
  forageAtDawn: number;
  picked: Record<string, number>;
  /** L-09: envie de chaque joueur, réalisée, jamais reçue avant; envie à deux; envies possibles. */
  envies: Record<CharacterId, { id: string; done: boolean; fresh: boolean } | null>;
  shared: { id: string; done: boolean } | null;
  possibleEnvies: Record<CharacterId, number>;
  /** L-10: moment du jour et s'il a été vu ensemble. */
  moment: { id: string; origin: string; seen: boolean } | null;
  /** L-11: premières fois de la journée, par joueur (section 6.3). */
  firsts: Record<CharacterId, string[]>;
  /** L-12: secondes de simulation dehors en journée, à arroser (et remplir l'arrosoir), à nourrir les poules. */
  care: Record<CharacterId, { outside: number; water: number; feed: number }>;
  /** L-13 (tour 9): bourse à l'aube; dépenses de la journée par usage; revenus de la journée. */
  purse: number;
  spent: Record<SpendKind, number>;
  income: number;
  /** L-14: buts ouverts à l'aube, buts nouveaux du jour; but d'épargne (un article ou chantier plus cher que la bourse moins 150). */
  goals: string[];
  newGoals: string[];
  savingGoal: boolean;
}

/** Usages de l'argent (section 2.12, L-13). */
export type SpendKind = 'outil' | 'poule' | 'maison' | 'cadeau' | 'chantier' | 'graines' | 'autre';

export interface LongRun {
  name: string;
  seed: number;
  profile: RobotProfile;
  slowFrom: number | null;
  lastDay: number;
  day: number;
  reachedEnd: boolean;
  stalled: string | null;
  realMs: number;
  /** Temps processeur du processus de la partie (une partie par fichier, un processus par fichier): la machine partagée fausse `realMs`. */
  cpuMs?: number;
  /** L-02: aubes où l'état relu diffère de l'état sauvegardé. */
  resumeMismatches: number[];
  stagesPassed: string[];
  days: DayRecord[];
  drawn: DrawnOrder[];
  paid: PaidOrder[];
  /** L-08: répliques quotidiennes dites, `[jour, habitant, identifiant]` par joueur. */
  dailyLines: Record<CharacterId, [number, string, string][]>;
  /** I-08: textes affichés avec une variable non remplie. */
  unfilled: string[];
  /** I-05: problèmes d'envies constatés. */
  envieProblems: string[];
  /** L-10: chaque passage d'un moment (historique complet, l'état n'en garde qu'une partie). */
  momentPasses: { id: string; day: number; origin: string; seen: boolean }[];
  /** L-15 (tour 9): annonces affichées, faites ou retirées. */
  annonces: { gabarit: string; kind: string; day: number; state: string; closedDay: number | null; reward: number }[];
  /** L-16: achats du catalogue de la semaine; versements et construction des chantiers. */
  purchases: { item: string; day: number; price: number; by: string }[];
  improvements: Record<string, { payments: { day: number; amount: number; planks: number }[]; builtDays: number[] }>;
  /** I-09 et I-10: problèmes constatés (vide: tenu). */
  boardProblems: string[];
  economyProblems: string[];
}

export interface LongOptions {
  name: string;
  seed: number;
  profile?: RobotProfile;
  slowFrom?: number | null;
  lastDay?: number;
}

function sizeDetail(w: WorldState): Record<string, number> {
  const out: Record<string, number> = {
    'heard.entries': PLAYERS.reduce((n, id) => n + Object.keys(w.heard[id]).length, 0),
    'heard.bytes': JSON.stringify(w.heard).length,
    'letters.count': w.letters.length,
    'letters.bytes': JSON.stringify(w.letters).length,
    'dialoguesDone.count': w.dialoguesDone.length,
    'dialoguesDone.bytes': JSON.stringify(w.dialoguesDone).length,
    'envieHistory.count': w.characters.reduce((n, c) => n + c.envieHistory.length, 0),
    'envieHistory.bytes': w.characters.reduce((n, c) => n + JSON.stringify(c.envieHistory).length, 0),
    'notifications.count': w.characters.reduce((n, c) => n + c.notifications.length, 0),
    'moments.history.count': w.moments.history.length,
    'counters.keys': Object.keys(w.counters.duo).length,
    'quests.count': w.quests.length,
    'groundItems.count': w.groundItems.length,
    'flags.count': w.flags.length,
  };
  for (const c of w.characters) out[`characters.${c.id}.bytes`] = JSON.stringify(c).length;
  // Objets au sol par sorte (piles), pour nommer ce qui s'accumule.
  for (const g of w.groundItems) out[`ground.${g.item}`] = (out[`ground.${g.item}`] ?? 0) + 1;
  return out;
}

/** `ui`: le texte passe encore par l'interface (astuce, réplique), qui remplit ses jetons. */
function checkText(run: LongRun, where: string, text: string | null | undefined, ui = false): void {
  if (text === null || text === undefined) return;
  if ((ui ? text.replace(UI_TOKENS, '') : text).includes('{') && run.unfilled.length < 50) run.unfilled.push(`${where}: ${text}`);
}

/** Textes de l'écran visibles à l'aube et sur l'écran d'étape (I-08, hors bulles et notifications). */
function checkScreens(run: LongRun, sim: Sim): void {
  const w = sim.world;
  const day = String(w.clock.day);
  for (const l of w.letters) {
    checkText(run, `lettre ${l.id} (jour ${day})`, letterTitle(sim.content, l));
    checkText(run, `lettre ${l.id} (jour ${day})`, letterText(sim.content, l));
  }
  for (const q of w.quests) if (q.status === 'active') checkText(run, `quête ${q.id} (jour ${day})`, questTitleOf(sim.content, q));
  checkText(run, `HUD saison (jour ${day})`, hudSeason(w, sim.content));
  checkText(run, `météo (jour ${day})`, weatherLabel(w, sim.content));
  const card = seasonCard(w, sim.content);
  if (card !== null) for (const line of [card.title, ...card.lines]) checkText(run, `carte de saison (jour ${day})`, line);
  const screen = stageScreen(w, sim.content);
  if (screen !== null) for (const t of [screen.title, screen.subtitle, screen.text, screen.next]) checkText(run, `écran d'étape (jour ${day})`, t);
}

function newDay(day: number): DayRecord {
  return {
    day,
    ms: 0,
    bytes: 0,
    chars: 0,
    keys: {},
    detail: {},
    memoriesBytes: 0,
    weather: 'sunny',
    mist: false,
    trees: { adult: 0, sapling: 0, stump: 0 },
    forageAtDawn: 0,
    picked: {},
    envies: { p1: null, p2: null },
    shared: null,
    possibleEnvies: { p1: 0, p2: 0 },
    moment: null,
    firsts: { p1: [], p2: [] },
    care: { p1: { outside: 0, water: 0, feed: 0 }, p2: { outside: 0, water: 0, feed: 0 } },
    purse: 0,
    spent: { outil: 0, poule: 0, maison: 0, cadeau: 0, chantier: 0, graines: 0, autre: 0 },
    income: 0,
    goals: [],
    newGoals: [],
    savingGoal: false,
  };
}

function spendKind(content: Content, item: string): SpendKind {
  const def = content.items[item];
  if (def === undefined) return 'autre';
  if (def.category === 'tool') return 'outil';
  if (def.category === 'animal_order') return 'poule';
  if (def.category === 'gift') return 'cadeau';
  if (def.category === 'seed') return 'graines';
  if (def.category === 'furniture' || def.category === 'decoration') return 'maison';
  return 'autre';
}

/** Buts ouverts à l'aube (L-14): envie, annonce, commande, chantier ouvert, cadeau en attente. */
function goalsOf(sim: Sim): string[] {
  const w = sim.world;
  const out: string[] = [];
  for (const c of w.characters) if (c.envie !== null && !c.envie.done) out.push(`envie:${c.envie.id}`);
  if (w.board.current?.state === 'open') out.push(`annonce:${w.board.current.gabarit}`);
  if (w.order.generated !== null) out.push(`commande:${String(w.order.generated.train)}`);
  for (const x of openImprovements(sim)) out.push(`chantier:${x.id}`);
  for (const g of sim.content.catalogue?.gifts ?? []) {
    if (dialogueDone(w.dialoguesDone, g.wish) && !(g.villager in w.giftsGiven)) out.push(`cadeau:${g.item}`);
  }
  for (const o of catalogueOffers(sim.content.settings, sim.content, w)) out.push(`article:${o.item}`);
  return out;
}

/** Un but d'épargne (O-12): un article en vente ou un chantier ouvert coûte plus que la bourse moins 150 sous. */
function savingGoalOf(sim: Sim): boolean {
  const room = sim.world.purse - 150;
  if (catalogueOffers(sim.content.settings, sim.content, sim.world).some((o) => o.price > room)) return true;
  return openImprovements(sim).some((x) => improvementRemaining(sim, x) > room);
}

export function playLong(options: LongOptions): LongRun {
  const profile = options.profile ?? 'median';
  const lastDay = options.lastDay ?? 84;
  const content = longContent({ lastDay, slowFrom: options.slowFrom ?? null });
  const g = content.settings.order.generated;
  const forageItems = new Set((content.settings.forage?.items ?? []).map((i) => i.item));
  const writtenOrdered = new Set(content.settings.order.trains.flatMap((t) => t.lines.map((l) => l.item)));
  const t0 = Date.now();
  const cpu0 = process.cpuUsage();
  let sim = newSim(options.seed, content);
  let robot = createRobot({ stages: 'stay', profile });
  const run: LongRun = {
    name: options.name,
    seed: options.seed,
    profile,
    slowFrom: options.slowFrom ?? null,
    lastDay,
    day: 0,
    reachedEnd: false,
    stalled: null,
    realMs: 0,
    resumeMismatches: [],
    stagesPassed: [],
    days: [],
    drawn: [],
    paid: [],
    dailyLines: { p1: [], p2: [] },
    unfilled: [],
    envieProblems: [],
    momentPasses: [],
    annonces: [],
    purchases: [],
    improvements: {},
    boardProblems: [],
    economyProblems: [],
  };
  const goalsEver = new Set<string>();
  const board = content.settings.board;
  const copies = content.catalogue?.copies ?? {};
  // Mémoires de la partie entière (l'état, borné, oublie).
  const heardEver: Record<CharacterId, Set<string>> = { p1: new Set(), p2: new Set() };
  const enviesEver: Record<CharacterId, Set<string>> = { p1: new Set(), p2: new Set() };
  const envieDays: Record<CharacterId, Map<string, number>> = { p1: new Map(), p2: new Map() };
  const pickedEver = new Set<string>();
  const momentsSeenEver = new Set<string>();
  const questsEver = new Set<string>();
  const orderedEver = new Set(writtenOrdered);
  const regrown = new Set<string>();
  const seasonsSeen = new Set<number>();
  const rainSeasons = new Set<number>();
  const passes = new Map<string, { id: string; day: number; origin: string; seen: boolean }>();
  // `orderHistory` ne garde que les dernières commandes: relevé à chaque aube.
  const paid = new Map<number, PaidOrder>();
  let mistSeen = false;
  let saplingSeen = false;
  let regrownFelled = false;
  let lastNotification = 0;
  let record: DayRecord | null = null;
  let dayStartMs = Date.now();
  let day = sim.world.clock.day;
  let ticks = 0;
  let lastTime = -1;
  let lastProgress = 0;
  const maxTicks = SIM_HZ * 60 * 60 * 80;
  const first = (who: CharacterId | 'both', what: string): void => {
    if (record === null) return;
    for (const id of who === 'both' ? PLAYERS : [who]) record.firsts[id].push(what);
  };
  const end = (s: Sim): boolean => s.world.clock.day >= lastDay && s.world.clock.stoppedBy === 'ended';

  while (!end(sim) && ticks < maxTicks) {
    step(sim, robot.decide(sim));
    ticks++;
    const w = sim.world;
    if (w.purse < 0 && run.economyProblems.length < 20) run.economyProblems.push(`jour ${String(w.clock.day)}: bourse ${String(w.purse)}`);
    for (const e of sim.events) {
      // Tour 9: L-13 à L-16, I-09 et I-10.
      if (e.type === 'bought' && record !== null) {
        const kind = spendKind(content, e.item);
        record.spent[kind] += e.price;
        if (content.items[e.item]?.shop === 'catalogue') run.purchases.push({ item: e.item, day: w.clock.day, price: e.price, by: e.by });
        const bought = w.catalogueBought[e.item] ?? 0;
        if (e.item in copies && bought > (copies[e.item] ?? 1)) run.economyProblems.push(`${e.item}: ${String(bought)} exemplaires achetés`);
        continue;
      }
      if (e.type === 'improvement_paid') {
        if (record !== null) record.spent.chantier += e.amount;
        (run.improvements[e.improvement] ??= { payments: [], builtDays: [] }).payments.push({ day: w.clock.day, amount: e.amount, planks: e.planks });
        continue;
      }
      if (e.type === 'improvement_built') {
        const entry = (run.improvements[e.improvement] ??= { payments: [], builtDays: [] });
        entry.builtDays.push(w.clock.day);
        const def = content.improvements.find((x) => x.id === e.improvement);
        const paid = entry.payments.reduce((n, x) => n + x.amount, 0);
        const planks = entry.payments.reduce((n, x) => n + x.planks, 0);
        const discount = content.settings.improvements?.plankDiscount ?? 0;
        if (entry.builtDays.length > 1) run.economyProblems.push(`${e.improvement} bâti deux fois`);
        if (def !== undefined && paid + planks * discount !== def.price) run.economyProblems.push(`${e.improvement}: ${String(paid)} sous et ${String(planks)} planches pour ${String(def.price)}`);
        continue;
      }
      if (e.type === 'money' || e.type === 'sold') {
        if (record !== null) record.income += e.type === 'money' ? e.amount : e.price;
        continue;
      }
      if (e.type === 'order_paid') {
        if (record !== null) record.income += e.amount;
        continue;
      }
      if (e.type === 'annonce_posted') {
        const a = w.board.current;
        const def = content.annonces.find((x) => x.id === e.gabarit);
        if (a === null || def === undefined) continue;
        const before = [...run.annonces].reverse().find((x) => x.gabarit === e.gabarit);
        if (before !== undefined && a.posted - before.day < (board?.noRepeatDays ?? 0)) run.boardProblems.push(`${e.gabarit} aux jours ${String(before.day)} et ${String(a.posted)}`);
        const open = run.annonces.find((x) => x.state === 'open');
        if (open !== undefined) run.boardProblems.push(`deux annonces en cours: ${open.gabarit} et ${e.gabarit} (jour ${String(a.posted)})`);
        if (board !== null && postKindOn(board, a.posted) !== def.kind) run.boardProblems.push(`${e.gabarit} un ${String(weekdayOf(a.posted))}e jour de semaine`);
        for (const line of def.variants[a.variant] ?? []) {
          for (let d = a.posted; d < a.posted + (board?.deadlineDays ?? 1); d++)
            if (!forageAvailableOn(content.settings, line.item, d)) run.boardProblems.push(`${e.gabarit}: ${line.item} hors saison le jour ${String(d)}`);
          const product = g?.products.find((x) => x.item === line.item);
          if (line.item !== 'plank' && product !== undefined && (w.counters.duo[product.obtained] ?? 0) <= 0) run.boardProblems.push(`${e.gabarit}: ${line.item} jamais obtenu (jour ${String(a.posted)})`);
        }
        run.annonces.push({ gabarit: e.gabarit, kind: def.kind, day: a.posted, state: 'open', closedDay: null, reward: a.reward });
        continue;
      }
      if (e.type === 'annonce_done' || e.type === 'annonce_expired') {
        const open = [...run.annonces].reverse().find((x) => x.gabarit === e.gabarit && x.state === 'open');
        if (open !== undefined) {
          open.state = e.type === 'annonce_done' ? 'done' : 'expired';
          open.closedDay = w.clock.day;
        }
        continue;
      }
      if (e.type === 'order_drawn') {
        const order = w.order.generated;
        if (order === null || g === null) continue;
        const previous = run.drawn.at(-1);
        const prevItems = new Set(previous?.lines.map((l) => l.item) ?? []);
        const family = (item: string): string => g.products.find((p) => p.item === item)?.family ?? '?';
        const problems: string[] = [];
        const items = order.lines.map((l) => l.item);
        if (order.lines.length < g.minLines) problems.push(`${String(order.lines.length)} lignes`);
        if (previous !== undefined && [...items].sort().join() === [...prevItems].sort().join()) problems.push('identique à la précédente');
        const perFamily = new Map<string, number>();
        for (const item of items) perFamily.set(family(item), (perFamily.get(family(item)) ?? 0) + 1);
        for (const [f, n] of perFamily) if (n > g.maxPerFamily) problems.push(`${String(n)} lignes de la famille ${f}`);
        for (let i = 0; i < items.length; i++)
          for (let j = i + 1; j < items.length; j++) {
            const a = items[i];
            const b = items[j];
            if (a !== undefined && b !== undefined && clashes(g, a, b)) problems.push(`${a} et ${b} puisent dans le même produit`);
          }
        for (const item of items) {
          const p = g.products.find((x) => x.item === item);
          if (p === undefined) {
            problems.push(`${item} hors de la table`);
            continue;
          }
          if (!inSeason(content.settings, p, order.train)) problems.push(`${item} hors saison`);
          if ((w.counters.duo[p.obtained] ?? 0) <= 0) problems.push(`${item} jamais obtenu`);
        }
        run.drawn.push({
          number: e.number,
          train: e.train,
          lines: order.lines.map((l) => ({ ...l, family: family(l.item) })),
          budget: w.order.budget,
          repeated: items.filter((i) => prevItems.has(i)).length,
          problems,
        });
        continue;
      }
      if (e.type === 'letter') {
        const letter = w.letters.find((l) => l.id === e.letter);
        if (letter !== undefined) {
          checkText(run, `lettre ${letter.id}`, letterTitle(sim.content, letter));
          checkText(run, `lettre ${letter.id}`, letterText(sim.content, letter));
        }
        if (e.letter.startsWith('coop_order_generated') && w.order.generated !== null) {
          const fresh = w.order.generated.lines.filter((l) => !orderedEver.has(l.item));
          if (fresh.length > 0) first('both', `commande: ${fresh.map((l) => l.item).join(', ')}`);
          for (const l of w.order.generated.lines) orderedEver.add(l.item);
        }
        continue;
      }
      if (e.type === 'talk') {
        const d = w.characters.find((c) => c.id === e.by)?.dialogue;
        if (d === null || d === undefined) continue;
        const def = sim.content.dialogues[d.dialogue];
        if (def === undefined) continue;
        if (def.kind === 'daily') run.dailyLines[e.by].push([w.clock.day, e.villager, def.id]);
        if (!heardEver[e.by].has(def.id)) {
          heardEver[e.by].add(def.id);
          first(e.by, `réplique ${def.id}`);
        }
        for (const line of def.lines) checkText(run, `réplique ${def.id}`, line.text, true);
        continue;
      }
      if (e.type === 'scene_started') {
        for (const id of PLAYERS)
          if (!heardEver[id].has(e.dialogue)) {
            heardEver[id].add(e.dialogue);
            first(id, `scène ${e.dialogue}`);
          }
        continue;
      }
      if (e.type === 'picked_up') {
        if (forageItems.has(e.item)) {
          if (record !== null) record.picked[e.item] = (record.picked[e.item] ?? 0) + e.count;
          if (!pickedEver.has(e.item)) {
            pickedEver.add(e.item);
            first(e.by, `cueillette ${e.item}`);
          }
        }
        continue;
      }
      if (e.type === 'tree_regrown') {
        regrown.add(e.tree);
        continue;
      }
      if (e.type === 'chop') {
        if (e.felled && regrown.has(e.tree) && !regrownFelled) {
          regrownFelled = true;
          first(e.by, 'premier arbre repoussé abattu');
        }
        continue;
      }
      if (e.type === 'quest_started') {
        if (!questsEver.has(e.quest)) {
          questsEver.add(e.quest);
          first('both', `quête ${e.quest}`);
        }
        continue;
      }
      if (e.type === 'envie_done') {
        if (record !== null) {
          if (e.by === 'both') {
            if (record.shared !== null) record.shared.done = true;
          } else {
            const mine = record.envies[e.by];
            if (mine !== null && mine.id === e.envie) mine.done = true;
            else if (record.shared !== null && record.shared.id === e.envie) record.shared.done = true;
          }
        }
        continue;
      }
      if (e.type === 'stage_continue') {
        run.stagesPassed.push(e.stage);
        continue;
      }
    }
    // I-08: chaque notification nouvelle (les astuces gardent leurs jetons de touches).
    for (const c of w.characters)
      for (const n of c.notifications)
        if (n.id > lastNotification) {
          checkText(run, `notification ${n.kind} (jour ${String(w.clock.day)})`, n.text, n.kind === 'hint');
          lastNotification = Math.max(lastNotification, n.id);
        }
    // L-12: soins quotidiens, en secondes de simulation, en journée.
    if (record !== null && w.phase === 'day' && w.clock.running)
      for (const c of w.characters) {
        const care = record.care[c.id];
        if (!isHome(c)) care.outside += 1 / SIM_HZ;
        if (c.action.kind === 'water' || c.action.kind === 'refill') care.water += 1 / SIM_HZ;
        if (c.action.kind === 'feed') care.feed += 1 / SIM_HZ;
      }
    // L-01: blocage.
    const now = w.clock.day * 1440 + w.clock.minutes;
    if (now !== lastTime) {
      lastTime = now;
      lastProgress = ticks;
    } else if (w.phase !== 'ended' && ticks - lastProgress > STALL_TICKS) {
      run.stalled = `jour ${String(w.clock.day)}, ${String(Math.floor(w.clock.minutes))} min, ${String(w.clock.stoppedBy)}: ${robot.job('p1')} / ${robot.job('p2')}`;
      break;
    }
    if (w.phase === 'ended' && w.stages.current === null) {
      run.stalled = `partie finie sans étape au jour ${String(w.clock.day)}`;
      break;
    }
    if (w.clock.day !== day && w.phase === 'breakfast') {
      day = w.clock.day;
      const nowMs = Date.now();
      if (record !== null) {
        record.ms = nowMs - dayStartMs;
        // Moment de la veille: vu ensemble ou non (historique de l'état, complété ici).
        run.days.push(record);
      }
      dayStartMs = nowMs;
      for (const o of w.orderHistory) paid.set(o.number, { ...o });
      for (const m of w.moments.history) {
        const key = `${m.id}@${String(m.day)}`;
        const known = passes.get(key);
        if (known === undefined) passes.set(key, { id: m.id, day: m.day, origin: m.origin, seen: m.seen });
        else known.seen = known.seen || m.seen;
        if (m.seen && !momentsSeenEver.has(m.id)) {
          momentsSeenEver.add(m.id);
          // Vu la veille: compté pour la journée qui vient de finir.
          const prev = run.days.find((d) => d.day === m.day);
          if (prev !== undefined) for (const id of PLAYERS) prev.firsts[id].push(`moment ${m.id}`);
        }
      }
      if (run.days.length > 0) {
        const prev = run.days[run.days.length - 1];
        if (prev !== undefined) {
          const pass = [...passes.values()].find((p) => p.day === prev.day);
          prev.moment = pass === undefined ? null : { id: pass.id, origin: pass.origin, seen: pass.seen };
        }
      }
      record = newDay(day);
      const json = JSON.stringify(w);
      record.chars = json.length;
      record.bytes = Buffer.byteLength(json, 'utf8');
      record.keys = Object.fromEntries(Object.entries(w).map(([k, v]) => [k, Buffer.byteLength(JSON.stringify(v), 'utf8')]));
      record.detail = sizeDetail(w);
      record.memoriesBytes = Buffer.byteLength(JSON.stringify(w.memories), 'utf8');
      record.weather = w.weather;
      record.mist = w.morningMist;
      for (const t of w.trees) record.trees[treeGrowth(content.settings.trees, t, day).stage]++;
      record.forageAtDawn = w.groundItems.filter((gi) => forageItems.has(gi.item)).length;
      // Envies du matin (tirées à l'aube) et réserve des possibles.
      for (const c of w.characters) {
        if (c.envie !== null) {
          const fresh = !enviesEver[c.id].has(c.envie.id);
          record.envies[c.id] = { id: c.envie.id, done: c.envie.done, fresh };
          const before = envieDays[c.id].get(c.envie.id);
          if (before !== undefined && day - before < 7) run.envieProblems.push(`${c.id}: ${c.envie.id} aux jours ${String(before)} et ${String(day)}`);
          envieDays[c.id].set(c.envie.id, day);
          if (fresh) {
            enviesEver[c.id].add(c.envie.id);
            first(c.id, `envie ${c.envie.id}`);
          }
        }
        const ctx = { ...NO_CONTEXT, actor: c.id };
        record.possibleEnvies[c.id] = sim.content.envies.filter((e) => e.kind === 'personal' && evaluateAll(sim, e.availableWhen, ctx)).length;
      }
      const shared = w.characters[0]?.sharedEnvie ?? null;
      record.shared = shared === null ? null : { id: shared.id, done: shared.done };
      if (shared !== null && w.characters.some((c) => c.sharedEnvie?.id !== shared.id)) run.envieProblems.push(`jour ${String(day)}: envie à deux différente chez les deux`);
      const sf = content.settings.envies;
      if (sf.sharedFromDay !== null && day >= sf.sharedFromDay && (day - sf.sharedFromDay) % sf.sharedEveryDays === 0 && shared === null)
        run.envieProblems.push(`jour ${String(day)}: pas d'envie à deux`);
      if (shared !== null)
        for (const id of PLAYERS)
          if (!enviesEver[id].has(shared.id)) {
            enviesEver[id].add(shared.id);
            first(id, `envie à deux ${shared.id}`);
          }
      // Premières fois du temps et de la saison.
      const season = seasonIndexOf(content.settings, day);
      if (!seasonsSeen.has(season)) {
        seasonsSeen.add(season);
        if (day > 1) first('both', `saison ${seasonOfDay(content.settings, day)}`);
      }
      if (w.weather === 'rain' && !rainSeasons.has(season) && day >= 16) {
        rainSeasons.add(season);
        first('both', 'première pluie de la saison');
      }
      if (w.morningMist && !mistSeen) {
        mistSeen = true;
        first('both', 'premier matin de brume');
      }
      if (!saplingSeen && record.trees.sapling > 0) {
        saplingSeen = true;
        first('both', 'premier rejet');
      }
      checkScreens(run, sim);
      // L-13 et L-14 (tour 9): bourse, buts ouverts et nouveaux, but d'épargne.
      record.purse = w.purse;
      record.goals = goalsOf(sim);
      record.newGoals = record.goals.filter((x) => !x.startsWith('envie:') && !x.startsWith('commande:') && !goalsEver.has(x));
      for (const x of record.goals) goalsEver.add(x);
      record.savingGoal = savingGoalOf(sim);
      // I-09: une affiche chaque dimanche et chaque mercredi dès l'ouverture du tableau (les saisons
      // qui ont des gabarits de cette sorte: aucun pour l'hiver, hors du contenu de cette version).
      const postKind = board === null ? null : postKindOn(board, day);
      const daySeason = seasonOfDay(content.settings, day);
      const possible = postKind !== null && content.annonces.some((a) => a.kind === postKind && a.seasons.includes(daySeason));
      if (board !== null && day >= board.fromDay && possible && w.board.current?.posted !== day) run.boardProblems.push(`jour ${String(day)}: pas d'annonce`);
      // Sauvegarde et reprise à chaque aube, en inversant hôte et invité (L-02).
      const snap = snapshotOf(sim);
      const before = hashState(lasting(snap.data));
      sim = restoreWorld(sim.content, sim.map, structuredClone(snap.data), snap.dataSchema, [B, A]);
      if (hashState(lasting(sim.world)) !== before) run.resumeMismatches.push(day);
      robot = createRobot({ stages: 'stay', profile });
    }
    if (sim.world.phase === 'ended' && sim.world.stages.current !== null) checkScreens(run, sim);
  }
  const w = sim.world;
  const last = record;
  if (last !== null) {
    last.ms = Date.now() - dayStartMs;
    const pass = [...passes.values()].find((p) => p.day === last.day);
    last.moment = pass === undefined ? null : { id: pass.id, origin: pass.origin, seen: pass.seen };
    run.days.push(last);
  }
  for (const m of w.moments.history) {
    const key = `${m.id}@${String(m.day)}`;
    if (!passes.has(key)) passes.set(key, { id: m.id, day: m.day, origin: m.origin, seen: m.seen });
  }
  run.momentPasses = [...passes.values()].sort((a, b) => a.day - b.day);
  for (const o of w.orderHistory) paid.set(o.number, { ...o });
  run.paid = [...paid.values()].sort((a, b) => a.number - b.number);
  run.day = w.clock.day;
  run.reachedEnd = end(sim);
  run.realMs = Date.now() - t0;
  const cpu = process.cpuUsage(cpu0);
  run.cpuMs = Math.round((cpu.user + cpu.system) / 1000);
  return run;
}
