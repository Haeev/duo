/**
 * Sauvegarde du monde (SV-02, SV-04, SV-06 réduits à la démo): l'état complet
 * en JSON, contrôlé et migré à la lecture, personnages liés à l'identifiant
 * stable des joueurs (jamais au rôle d'hôte ou d'invité).
 */
import type { GameMap } from '../etat/carte';
import type { CharacterId, Tree, WorldState } from '../etat/types';
import type { Content } from '../donnees/types';
import { sanitizeCorner } from '../simulation/amenagement';
import { sanitizeSeat } from '../simulation/bancs';
import { DATA_SCHEMA, MINUTES_PER_HOUR } from '../simulation/constantes';
import { stageCanContinue } from '../donnees/calendrier';
import { type Sim, format, wrapWorld } from '../simulation/contexte';
import { startScene } from '../simulation/dialogues';
import { runEffects } from '../simulation/effets';
import { variantOf } from '../simulation/conditions';
import type { PlayerInfo } from '../simulation/monde';
import { type StepInput, step } from '../simulation/pas';
import { settleSavedClimax } from '../simulation/moments';
import { memoriesFromSave } from '../simulation/souvenirs';
import { drawNextOrder, emptyOrderBook } from '../simulation/semaine';
import { startQuest } from '../simulation/quetes';

/** Ce que le SDK enregistre (`SaveSnapshot`). */
export interface WorldSnapshot {
  label: string;
  progress: number;
  dataSchema: number;
  data: WorldState;
}

const LABEL_MAX = 40;
/**
 * Pas joués sur une copie avant d'accepter une sauvegarde (un peu plus de 3 s
 * de jeu, quelques millisecondes): garde-fou contre une sauvegarde abîmée en
 * profondeur, en attendant un schéma complet de l'état (risque 3 du gauntlet).
 */
export const TRIAL_STEPS = 100;
const IDLE: StepInput = { controls: {}, intents: [] };

/** « samedi, jour 1, 14 h 20 » (libellé de la fiche du jeu, 40 caractères au plus). */
export function saveLabel(sim: Sim): string {
  const { day, minutes } = sim.world.clock;
  const texts = sim.content.texts;
  const weekday = texts.weekdays[(day - 1) % texts.weekdays.length] ?? '';
  const raw = texts.raw.ui;
  const hud = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).hud : undefined;
  const pick = (key: string, fallback: string): string => {
    const value = typeof hud === 'object' && hud !== null ? (hud as Record<string, unknown>)[key] : undefined;
    return typeof value === 'string' ? value : fallback;
  };
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = Math.floor(minutes % MINUTES_PER_HOUR);
  const dayText = format(pick('day', '{weekday}, jour {day}'), { weekday, day });
  const timeText = format(pick('time', '{hours} h {minutes}'), { hours: h, minutes: String(m).padStart(2, '0') });
  const label = `${dayText}, ${timeText}`;
  return label.length > LABEL_MAX ? label.slice(0, LABEL_MAX) : label;
}

/**
 * Avancement jusqu'à la limite de la partie (`clock.lastDay`), de 0 à 1: une partie arrêtée sur
 * l'écran d'étape du jour 15 en est au tiers (tour 8, section 1.6).
 */
export function progressOf(sim: Sim): number {
  const s = sim.content.settings.clock;
  const days = s.lastDay.day - s.firstDay.day;
  const stage = sim.world.stages.current;
  if (days <= 0 || (sim.world.phase === 'ended' && (stage === null || !stageCanContinue(sim.content.settings, stage)))) return 1;
  const elapsed = sim.world.clock.day - s.firstDay.day + sim.world.clock.minutes / (MINUTES_PER_HOUR * 24);
  return Math.max(0, Math.min(1, elapsed / days));
}

/** Instantané à enregistrer. L'état est copié: il continue de vivre pendant l'écriture. */
export function snapshotOf(sim: Sim): WorldSnapshot {
  return {
    label: saveLabel(sim),
    progress: progressOf(sim),
    dataSchema: DATA_SCHEMA,
    data: structuredClone(sim.world),
  };
}

export class SaveError extends Error {
  override readonly name = 'SaveError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Contrôle de forme d'une sauvegarde relue (données venues du disque). */
function checkWorld(data: unknown): WorldState {
  if (!isRecord(data)) throw new SaveError('sauvegarde: objet attendu');
  const required: [string, string][] = [
    ['tick', 'number'],
    ['revision', 'number'],
    ['seed', 'number'],
    ['phase', 'string'],
    ['purse', 'number'],
    ['nextId', 'number'],
  ];
  for (const [key, type] of required) {
    if (typeof data[key] !== type) throw new SaveError(`sauvegarde: champ « ${key} » invalide`);
  }
  const arrays = ['characters', 'garden', 'trees', 'constructions', 'furniture', 'groundItems', 'villagers', 'hens', 'quests', 'letters', 'flags', 'scripts'];
  for (const key of arrays) {
    if (!Array.isArray(data[key])) throw new SaveError(`sauvegarde: liste « ${key} » attendue`);
  }
  const characters = data.characters as unknown[];
  if (characters.length !== 2 || !characters.every((c) => isRecord(c) && typeof c.playerId === 'string' && isRecord(c.pos))) {
    throw new SaveError('sauvegarde: deux personnages attendus');
  }
  if (!isRecord(data.clock) || typeof data.clock.day !== 'number' || typeof data.clock.minutes !== 'number') {
    throw new SaveError('sauvegarde: horloge invalide');
  }
  const rng = data.rng;
  if (!Array.isArray(rng) || rng.length !== 4 || !rng.every((n) => typeof n === 'number')) {
    throw new SaveError('sauvegarde: état du générateur invalide');
  }
  checkMemories(data.memories);
  checkWeekly(data);
  return data as unknown as WorldState;
}

/** Champs du format 5 (tour 8): étapes, commande générée, totaux, journal de la météo. */
function checkWeekly(data: Record<string, unknown>): void {
  const num = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);
  const stageId = (v: unknown): boolean => v === 'demo' || v === 'summer_end';
  const choice = (v: unknown): boolean => v === null || v === 'stay' || v === 'finish';
  const stages = data.stages;
  const okStages =
    isRecord(stages) &&
    Array.isArray(stages.passed) &&
    stages.passed.every(stageId) &&
    (stages.current === null || stageId(stages.current)) &&
    isRecord(stages.choice) &&
    choice(stages.choice.p1) &&
    choice(stages.choice.p2);
  if (!okStages) throw new SaveError('sauvegarde: étapes invalides');
  const totals = data.orderTotals;
  if (!isRecord(totals) || !['orders', 'linesDone', 'linesTotal', 'amount'].every((k) => num(totals[k]))) {
    throw new SaveError('sauvegarde: totaux des commandes invalides');
  }
  const line = (l: unknown): boolean => isRecord(l) && typeof l.item === 'string' && num(l.count) && num(l.share);
  const order = data.order;
  const generated = isRecord(order) ? order.generated : undefined;
  const okGenerated =
    generated === null ||
    (isRecord(generated) &&
      num(generated.number) &&
      num(generated.train) &&
      num(generated.drawnDay) &&
      num(generated.budget) &&
      Array.isArray(generated.lines) &&
      generated.lines.every(line) &&
      Array.isArray(generated.lettersSent));
  const okOrder =
    isRecord(order) &&
    okGenerated &&
    num(order.budget) &&
    num(order.misses) &&
    Array.isArray(order.recent) &&
    order.recent.every((r) => Array.isArray(r) && r.every((i) => typeof i === 'string')) &&
    Array.isArray(order.ordered);
  if (!okOrder) throw new SaveError('sauvegarde: commande de la semaine invalide');
  const log = data.weatherLog;
  const weather = (w: unknown): boolean => w === 'sunny' || w === 'cloudy' || w === 'rain';
  if (!Array.isArray(log) || !log.every((e) => isRecord(e) && num(e.day) && weather(e.weather) && typeof e.mist === 'boolean')) {
    throw new SaveError('sauvegarde: journal de la météo invalide');
  }
  if (typeof data.morningMist !== 'boolean' || !isRecord(data.letterVariants) || !isRecord(data.content)) {
    throw new SaveError('sauvegarde: champs du tour 8 invalides');
  }
  // Seconde vague du tour 8: champs facultatifs (remplis à la reprise s'ils manquent).
  const recent = data.sharedEnvieRecent;
  if (recent !== undefined && !(Array.isArray(recent) && recent.every((e) => isRecord(e) && typeof e.id === 'string' && num(e.day)))) {
    throw new SaveError('sauvegarde: envies à deux tirées invalides');
  }
  const trees = Array.isArray(data.trees) ? (data.trees as unknown[]) : [];
  if (!trees.every((t) => isRecord(t) && (t.felledDay === undefined || t.felledDay === null || num(t.felledDay)))) {
    throw new SaveError('sauvegarde: arbres invalides');
  }
}

/** Souvenirs (format 4): l'onglet du carnet les lit tels quels, chez les deux. */
function checkMemories(memories: unknown): void {
  const who = (v: unknown): boolean => v === 'p1' || v === 'p2';
  const num = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);
  const moment = (m: unknown): boolean =>
    isRecord(m) &&
    typeof m.id === 'string' &&
    num(m.first) &&
    num(m.count) &&
    num(m.last) &&
    (m.hintTo === null || who(m.hintTo)) &&
    (m.hintFrom === null || typeof m.hintFrom === 'string');
  const secret = (s: unknown): boolean =>
    isRecord(s) && typeof s.quest === 'string' && num(s.day) && who(s.informed) && typeof s.firstTry === 'boolean' && num(s.variant);
  const ok =
    isRecord(memories) &&
    Array.isArray(memories.moments) &&
    Array.isArray(memories.secrets) &&
    memories.moments.every(moment) &&
    memories.secrets.every(secret);
  if (!ok) throw new SaveError('sauvegarde: souvenirs invalides');
}

/**
 * Format 1 vers 2 (la démo passe à deux semaines): la commande payée au jour 8
 * entre dans l'historique et la suivante devient la commande en cours; une fin
 * de démo au jour 8 n'en est plus une, la partie reprend le soir du jour 8.
 */
function migrateToTwoWeeks(world: Record<string, unknown>, content: Content): void {
  const result = world.orderResult;
  const paid = isRecord(result);
  world.orderIndex = paid ? Math.min(1, content.settings.order.trains.length - 1) : 0;
  world.orderHistory = paid ? [structuredClone(result)] : [];
  const clock = world.clock;
  if (world.phase === 'ended' && isRecord(clock) && typeof clock.day === 'number' && clock.day < content.settings.clock.lastDay.day) {
    world.phase = 'day';
    world.ending = null;
    clock.running = true;
    clock.stoppedBy = null;
  }
}

/** Quête refaite au tour 6 (R16): `receive` a été ajoutée devant `give` et `tell_jeanne`. */
const LUCIE_QUEST = 'lucie_note';
const LUCIE_LETTER = 'lucie_letter';

function holdsItem(c: unknown, item: string): boolean {
  if (!isRecord(c) || !Array.isArray(c.bag)) return false;
  return c.bag.some((s) => isRecord(s) && s.item === item);
}

/**
 * Format 2 vers 3 (tour 6: moments rares et informations propres). Aucun moment n'a encore eu
 * lieu; les poules déjà là gardent leurs noms visibles chez les deux (la quête des noms ne
 * démarre pas pour elles); « Le mot de Lucie » en cours garde son avancement (l'étape gagne un
 * cran) et son informé est celui qui a la lettre, sinon le premier joueur.
 */
function migrateToMoments(world: Record<string, unknown>, content: Content): void {
  const s = content.settings;
  world.moments = { today: null, history: [], hintTurn: s.moments.firstHint };
  const secrets: { turn: CharacterId; entries: unknown[] } = { turn: s.secrets.firstInformed, entries: [] };
  world.secrets = secrets;
  const hens = Array.isArray(world.hens) ? world.hens : [];
  for (const hen of hens) {
    if (!isRecord(hen)) continue;
    hen.nameKnownBy = ['p1', 'p2'];
    hen.namedBy = null;
  }
  const flags = Array.isArray(world.flags) ? (world.flags as unknown[]) : [];
  if (hens.length > 0 && !flags.includes(s.secrets.knownHensFlag)) flags.push(s.secrets.knownHensFlag);
  const characters = Array.isArray(world.characters) ? world.characters : [];
  for (const c of characters) {
    if (!isRecord(c)) continue;
    c.momentHint = null;
    c.holding = null;
  }
  const quests = Array.isArray(world.quests) ? world.quests : [];
  const lucie = quests.find((q): q is Record<string, unknown> => isRecord(q) && q.id === LUCIE_QUEST);
  const def = content.quests.find((q) => q.id === LUCIE_QUEST);
  if (lucie === undefined || def === undefined || def.secret === null || typeof lucie.step !== 'number') return;
  lucie.step = lucie.status === 'done' ? def.steps.length : Math.min(lucie.step + 1, def.steps.length - 1);
  const holder: unknown = characters.find((c) => holdsItem(c, LUCIE_LETTER));
  const informed: CharacterId = isRecord(holder) && (holder.id === 'p1' || holder.id === 'p2') ? holder.id : secrets.turn;
  const doer: CharacterId = informed === 'p1' ? 'p2' : 'p1';
  secrets.entries.push({
    id: def.secret.id,
    quest: LUCIE_QUEST,
    informed,
    doer,
    variant: variantOf(typeof world.seed === 'number' ? world.seed : 0, def.secret.variantGroup, def.secret.of),
    errors: 0,
    revealed: false,
    shared: false,
    nudged: false,
  });
  secrets.turn = doer;
}

/**
 * Format 4 vers 5 (tour 8): aucune étape franchie (une partie finie au jour 15 rouvre l'écran
 * d'étape, avec « Rester à la Halte »), commandes payées numérotées et datées, totaux recalculés,
 * aucune météo tirée encore. La commande générée est tirée à la reprise (`resume`).
 */
function migrateToStages(world: Record<string, unknown>, content: Content): void {
  const trains = content.settings.order.trains;
  world.stages = { passed: [], current: world.phase === 'ended' ? 'demo' : null, choice: { p1: null, p2: null } };
  world.weatherLog = [];
  world.morningMist = false;
  const history = Array.isArray(world.orderHistory) ? world.orderHistory : [];
  const totals = { orders: 0, linesDone: 0, linesTotal: 0, amount: 0 };
  history.forEach((h, i) => {
    if (!isRecord(h)) return;
    h.number = i + 1;
    h.day = trains[i]?.day ?? 0;
    totals.orders += 1;
    totals.linesDone += typeof h.linesDone === 'number' ? h.linesDone : 0;
    totals.linesTotal += typeof h.linesTotal === 'number' ? h.linesTotal : 0;
    totals.amount += typeof h.amount === 'number' ? h.amount : 0;
  });
  const result = world.orderResult;
  if (isRecord(result)) {
    const last: unknown = history[history.length - 1];
    result.number = isRecord(last) ? last.number : history.length;
    result.day = isRecord(last) ? last.day : (trains[history.length - 1]?.day ?? 0);
  }
  world.orderTotals = totals;
  world.order = emptyOrderBook({ content });
  world.letterVariants = {};
  world.content = { firstDayWith: {} };
}

/**
 * Reprise d'une sauvegarde d'avant le format 5: si toutes les commandes écrites sont payées, la
 * commande suivante est tirée maintenant (déterministe par la graine, pour le train qui suit le
 * dernier payé), et les quêtes que les données démarrent depuis à l'échéance d'une quête finie
 * démarrent (la quête de la semaine).
 */
function catchUpWeekly(sim: Sim): void {
  const { world } = sim;
  const trains = sim.content.settings.order.trains;
  const lastPaid = world.orderHistory[world.orderHistory.length - 1];
  if (world.orderTotals.orders >= trains.length && lastPaid !== undefined) drawNextOrder(sim, lastPaid.day);
  for (const quest of sim.content.quests) {
    if (!world.quests.some((q) => q.id === quest.id && q.status === 'done')) continue;
    for (const step of quest.steps) {
      if (step.resolve !== 'at_deadline') continue;
      for (const e of step.onDeadline) if (e.type === 'start_quest') startQuest(sim, e.quest);
    }
  }
}

/** Migrations d'un format au suivant. */
function migrate(data: unknown, dataSchema: number, content: Content): unknown {
  if (dataSchema > DATA_SCHEMA) throw new SaveError(`sauvegarde d'une version plus récente (format ${dataSchema})`);
  if (dataSchema < 2 && isRecord(data)) migrateToTwoWeeks(data, content);
  if (dataSchema < 3 && isRecord(data)) migrateToMoments(data, content);
  if (dataSchema < 4 && isRecord(data)) data.memories = memoriesFromSave(data, content, dataSchema);
  if (dataSchema < 5 && isRecord(data)) migrateToStages(data, content);
  return data;
}

/**
 * Une sauvegarde du format 1 dont la commande du jour 8 est payée n'a pas joué
 * les effets durables que les données ajoutent depuis à cette échéance
 * (drapeaux, lettres, quête suivante): on les joue, sans les scènes.
 */
function catchUpFirstDeadline(sim: Sim): void {
  const first = sim.content.settings.order.trains[0];
  if (first === undefined || sim.world.orderHistory.length === 0) return;
  const durable = new Set(['set_flag', 'start_quest', 'send_letter']);
  for (const quest of sim.content.quests) {
    for (const step of quest.steps) {
      if (step.resolve !== 'at_deadline' || step.deadline?.day !== first.day) continue;
      runEffects(
        sim,
        step.onDeadline.filter((e) => durable.has(e.type)),
        null,
      );
    }
  }
}

/**
 * Lie chaque personnage à l'identifiant stable d'un joueur (SV-04): chacun
 * retrouve le sien quelle que soit la machine qui héberge. Un identifiant
 * inconnu (machine réinstallée) prend le personnage qui reste.
 */
export function bindPlayers(world: WorldState, players: readonly [PlayerInfo, PlayerInfo]): void {
  const known = new Map<string, CharacterId>();
  for (const c of world.characters) known.set(c.playerId, c.id);
  const free = world.characters.filter((c) => !players.some((p) => p.id === c.playerId));
  for (const player of players) {
    if (known.has(player.id)) continue;
    const take = free.shift();
    if (take !== undefined) take.playerId = player.id;
  }
  for (const c of world.characters) {
    const player = players.find((p) => p.id === c.playerId);
    if (player !== undefined) c.appearance.scarf = player.color;
  }
}

/**
 * Reprend un monde sauvegardé. Ce qui ne se sauvegarde pas (SV-02) est remis
 * à zéro: menus fermés, conversations closes, scène reprise à son début.
 * Avant d'être acceptée, la sauvegarde est rejouée `TRIAL_STEPS` pas sur une
 * copie: une erreur devient une `SaveError`, jamais un plantage au premier pas
 * de la partie, chez les deux joueurs et à chaque relance.
 */
export function restoreWorld(
  content: Content,
  map: GameMap,
  data: unknown,
  dataSchema: number,
  players: readonly [PlayerInfo, PlayerInfo],
): Sim {
  const world = checkWorld(migrate(data, dataSchema, content));
  trialRun(content, map, structuredClone(world), dataSchema, players);
  return resume(content, map, world, dataSchema, players);
}

function trialRun(
  content: Content,
  map: GameMap,
  world: WorldState,
  dataSchema: number,
  players: readonly [PlayerInfo, PlayerInfo],
): void {
  try {
    const trial = resume(content, map, world, dataSchema, players);
    for (let i = 0; i < TRIAL_STEPS; i++) step(trial, IDLE);
  } catch (error) {
    if (error instanceof SaveError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new SaveError(`sauvegarde: la partie ne se rejoue pas (${reason})`, { cause: error });
  }
}

function resume(
  content: Content,
  map: GameMap,
  world: WorldState,
  dataSchema: number,
  players: readonly [PlayerInfo, PlayerInfo],
): Sim {
  bindPlayers(world, players);
  // Champ facultatif (mémoire des répliques entendues), absent des sauvegardes plus anciennes.
  const heard = (world as Partial<WorldState>).heard;
  world.heard = { p1: heard?.p1 ?? {}, p2: heard?.p2 ?? {} };
  // Gestes à deux (tour 4): colis en attente et charge décrite, absents des sauvegardes plus anciennes.
  world.heavyDeliveries = (world as Partial<WorldState>).heavyDeliveries ?? [];
  world.handcarAt = (world as Partial<WorldState>).handcarAt ?? null;
  // Lue telle qu'écrite: une sauvegarde d'avant n'a pas `purpose`.
  const beam: (Omit<NonNullable<WorldState['beam']>, 'purpose'> & { purpose?: string }) | null = world.beam;
  if (beam !== null && beam.purpose === undefined) {
    const def = content.constructions.find((k) => k.kind === 'carry');
    const to = map.points[def?.point ?? ''] ?? beam.pos;
    world.beam = { ...beam, item: def?.carry?.item ?? 'beam', purpose: 'construction', construction: def?.id ?? null, contents: null, to: { x: to.x, y: to.y } };
  }
  // Trajet sur rails (après le tour 5): une charge écrite avant n'en a pas. La draisine reprend
  // alors le trajet du réglage depuis son point de départ.
  const current: (Omit<NonNullable<WorldState['beam']>, 'route'> & { route?: NonNullable<WorldState['beam']>['route'] }) | null = world.beam;
  if (current !== null && current.route === undefined) {
    const handcar = content.settings.carry.handcar;
    const from = handcar === null ? undefined : map.points[handcar.from];
    const route = current.purpose === 'handcar' && handcar !== null && from !== undefined ? handcar.path.map(([dx, dy]) => ({ x: from.x + dx, y: from.y + dy })) : null;
    world.beam = { ...current, route, leg: 0, ...(route !== null && from !== undefined ? { pos: { ...from }, prev: { ...from }, to: route[route.length - 1] ?? current.to } : {}) };
  }
  for (const c of world.characters) {
    // Nouvelle séance: l'écran titre se repasse à deux; l'écran d'étape se choisit de nouveau.
    c.titleReady = false;
    c.endReady = false;
    // Personne n'est absent au début d'une séance.
    c.lastInputTick = world.tick;
    c.absent = false;
    c.menu = null;
    c.dialogue = null;
    c.destination = null;
    c.placement = null;
    c.aim = null;
    c.corner = sanitizeCorner(map, c.corner);
    // L'échelle se reprend à la main; la confidence du matin reste.
    c.holding = null;
    // Assis sur un banc (après le tour 5): absent des sauvegardes d'avant, comme debout.
    c.seat = sanitizeSeat(map, content.settings.benches, c);
    if (c.seat === null && c.action.kind === 'sit') c.action = { kind: 'idle', since: world.tick, duration: 0, target: null };
    if (c.status === 'menu' || c.status === 'dialogue') c.status = 'active';
  }
  for (const v of world.villagers) v.talkingWith = [];
  world.stages.choice = { p1: null, p2: null };
  fillRegrowth(content, world);
  const scene = world.scene;
  world.scene = null;
  const sim = wrapWorld(content, map, world);
  // Une sortie pendant l'apogée la compte comme vue (la récompense est donnée au début): l'état
  // d'après, avec le texte d'apogée et la fin de l'étape de quête (QA6-08).
  settleSavedClimax(sim);
  if (dataSchema < 2) catchUpFirstDeadline(sim);
  if (dataSchema < 5) catchUpWeekly(sim);
  if (scene !== null) startScene(sim, scene.dialogue);
  return sim;
}

/**
 * Tour 8, seconde vague (même format 5): le jour d'abattage des arbres et les envies à deux tirées,
 * absents des sauvegardes écrites avant. Un arbre abattu pendant la démo prend tout le rattrapage
 * du jour 16 (`trees.catchUpDays`, comme un arbre abattu tôt); abattu après, il redevient une
 * souche d'aujourd'hui (son jour est perdu).
 */
function fillRegrowth(content: Content, world: WorldState): void {
  const trees = content.settings.trees;
  const day = world.clock.day;
  const unknown = day < trees.regrowFromDay ? trees.regrowFromDay - trees.catchUpDays : day;
  for (const t of world.trees) {
    const known: number | null | undefined = (t as Partial<Tree>).felledDay;
    if (known === undefined) t.felledDay = t.felled ? Math.min(unknown, day) : null;
  }
  world.sharedEnvieRecent = (world as Partial<WorldState>).sharedEnvieRecent ?? [];
}

/** Lit le JSON d'une sauvegarde (texte UTF-8 ou valeur déjà décodée par le SDK). */
export function decodeSave(data: unknown): unknown {
  if (typeof data === 'string') return JSON.parse(data) as unknown;
  return data;
}
