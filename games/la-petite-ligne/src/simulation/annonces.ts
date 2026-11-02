/**
 * Le tableau du quai (tour 9, section 1): Firmin y épingle les annonces des habitants le dimanche
 * et le mercredi à 6 h, elles se retirent seules à 20 h du troisième jour. Chaque annonce est une
 * quête du carnet (`annonce_<gabarit>`, écrite par `donnees/contenu.ts`); le tableau la démarre,
 * la paie une fois faite et la retire à l'échéance. Rien de tout cela avant `board.fromDay`: la
 * démo ne change pas.
 */
import { annonceQuestId, rawText } from '../donnees/contenu';
import type { AnnonceDef, AnnonceLine } from '../donnees/types';
import { annonceReward, drawAnnonce } from '../etat/annonces';
import { productPrice } from '../etat/commande-generee';
import type { BoardAnnonce, CharacterId, QuestState } from '../etat/types';
import { isSheltered } from '../etat/interieurs';
import { MINUTES_PER_DAY } from './constantes';
import { type Sim, character, distance, emit, format, notifyKey } from './contexte';
import { queueHint } from './astuces';
import { POINT } from './ids';
import { startQuest } from './quetes';
import { countInBag, countInStacks } from './sac';
import { storeAtHome } from './rangement';
import { runEffects } from './effets';

/** Gabarits gardés pour la règle des 10 jours (deux annonces par semaine: 4 couvrent 14 jours). */
export const BOARD_RECENT_KEPT = 4;

export function emptyBoard(): Sim['world']['board'] {
  return { current: null, previous: null, recent: [], posted: [], uniquesGiven: [] };
}

export function annonceDef(sim: Sim, gabarit: string): AnnonceDef | null {
  return sim.content.annonces.find((a) => a.id === gabarit) ?? null;
}

/** Lignes demandées par l'annonce (sa variante). */
export function annonceLines(sim: Sim, a: Pick<BoardAnnonce, 'gabarit' | 'variant'>): readonly AnnonceLine[] {
  return annonceDef(sim, a.gabarit)?.variants[a.variant] ?? [];
}

/** Clé du produit « déjà obtenu » (le même compteur que la commande, tour 8, section 4.2). */
function obtainedKey(sim: Sim, item: string): string {
  return sim.content.settings.order.generated?.products.find((p) => p.item === item)?.obtained ?? `picked:${item}`;
}

/** Le duo peut-il fournir cette ligne ? Planches: en stock, ou un arbre adulte; le reste: déjà obtenu. */
export function obtainable(sim: Sim, line: AnnonceLine): boolean {
  const { world } = sim;
  if (line.item === 'plank') {
    const stock = countInBag(character(sim, 'p1'), 'plank') + countInBag(character(sim, 'p2'), 'plank') + countInStacks(world.cellar, 'plank');
    return stock >= line.count || world.trees.some((t) => !t.felled);
  }
  return (world.counters.duo[obtainedKey(sim, line.item)] ?? 0) > 0;
}

/** Prix d'une unité (section 1.4, V): celui de la commande générée (la soupe: 60), sinon le prix de vente. */
function sellPrice(sim: Sim, item: string): number {
  const own = sim.content.items[item]?.sellPrice ?? null;
  const g = sim.content.settings.order.generated;
  return g === null ? (own ?? 0) : productPrice(g, item, own);
}

function absoluteMinutes(day: number, minutes: number): number {
  return day * MINUTES_PER_DAY + minutes;
}

function deadlinePassed(sim: Sim, a: BoardAnnonce): boolean {
  const { day, minutes } = sim.world.clock;
  return absoluteMinutes(day, minutes) >= absoluteMinutes(a.deadline.day, a.deadline.time);
}

function questOf(sim: Sim, a: BoardAnnonce): QuestState | undefined {
  return sim.world.quests.find((q) => q.id === a.quest);
}

/** Une annonce close quitte le carnet (l'état garde au plus une quête par gabarit et variante). */
function closeQuest(sim: Sim, a: BoardAnnonce): void {
  const index = sim.world.quests.findIndex((q) => q.id === a.quest);
  if (index >= 0) sim.world.quests.splice(index, 1);
}

function expire(sim: Sim, a: BoardAnnonce, silent: boolean): void {
  a.state = 'expired';
  a.closedDay = sim.world.clock.day;
  closeQuest(sim, a);
  sim.runtime.changed = true;
  emit(sim, { type: 'annonce_expired', gabarit: a.gabarit });
  if (!silent) {
    const def = annonceDef(sim, a.gabarit);
    const giver = sim.content.villagers.find((v) => v.id === def?.giver)?.label ?? '';
    notifyKey(sim, 'both', 'message', 'annonce_expired', { giver });
  }
}

/** Démarre (ou redémarre, la quête d'une annonce passée ayant quitté le carnet) la quête de l'annonce. */
function startAnnonceQuest(sim: Sim, id: string): void {
  const old = sim.world.quests.findIndex((q) => q.id === id);
  if (old >= 0) sim.world.quests.splice(old, 1);
  startQuest(sim, id);
}

/** Le matin (6 h), après le courrier: une annonce échue pendant l'absence se retire sans message, puis l'affiche du jour. */
export function morningBoard(sim: Sim): void {
  const board = sim.content.settings.board;
  const { world } = sim;
  if (board === null) return;
  const current = world.board.current;
  if (current?.state === 'open' && deadlinePassed(sim, current)) expire(sim, current, true);
  postAnnonce(sim);
}

/** L'affiche du jour, s'il y en a une (dimanche: un coup de main; mercredi: une annonce à deux). */
export function postAnnonce(sim: Sim): void {
  const settings = sim.content.settings;
  const board = settings.board;
  const { world } = sim;
  if (board === null || world.clock.day < board.fromDay) return;
  const state = world.board;
  // Jamais deux annonces en cours: celle d'avant est faite ou retirée avant l'affiche suivante.
  if (state.current?.state === 'open') return;
  const lastGiver = state.current === null ? null : (annonceDef(sim, state.current.gabarit)?.giver ?? null);
  const drawn = drawAnnonce(settings, sim.content.annonces, {
    seed: world.seed,
    day: world.clock.day,
    recent: state.recent,
    posted: state.posted,
    lastGiver,
    obtainable: (line) => obtainable(sim, line),
  });
  if (drawn === null) return;
  const { def, variant } = drawn;
  const rule = board.reward[def.kind];
  const lines = def.variants[variant] ?? [];
  const annonce: BoardAnnonce = {
    gabarit: def.id,
    variant,
    quest: annonceQuestId(def, variant),
    posted: world.clock.day,
    deadline: { day: world.clock.day + board.deadlineDays - 1, time: board.deadlineTime },
    reward: annonceReward(rule, lines, (item) => sellPrice(sim, item)),
    state: 'open',
    by: null,
    closedDay: null,
  };
  if (state.current !== null) state.previous = state.current;
  state.current = annonce;
  state.recent.push({ gabarit: def.id, day: world.clock.day });
  if (state.recent.length > BOARD_RECENT_KEPT) state.recent.splice(0, state.recent.length - BOARD_RECENT_KEPT);
  if (!state.posted.includes(def.id)) state.posted.push(def.id);
  startAnnonceQuest(sim, annonce.quest);
  sim.runtime.changed = true;
  emit(sim, { type: 'annonce_posted', gabarit: def.id, quest: annonce.quest });
  const title = rawText(sim.content.texts, 'annonces', def.id, 'title') ?? def.id;
  notifyKey(sim, 'both', 'message', 'annonce_posted', { title });
}

/** Une ligne de l'habitant: dans la conversation ouverte de ce joueur, sinon en notification. */
export function villagerSays(sim: Sim, who: CharacterId | null, villager: string, text: string): void {
  const c = who === null ? null : character(sim, who);
  const d = c?.dialogue ?? null;
  if (c !== null && d !== null && d.villager === villager) {
    d.lines.push({ speaker: villager, text });
    d.line = Math.max(0, d.lines.length - 1);
    sim.runtime.changed = true;
    return;
  }
  const label = sim.content.villagers.find((v) => v.id === villager)?.label ?? villager;
  notifyKey(sim, who ?? 'both', 'message', 'villager_says', { villager: label, text });
}

/** Qui a fait le dernier don à cet habitant pendant ce pas (le tampon « Fait » à sa couleur). */
export function lastGiverThisStep(sim: Sim, villager: string): CharacterId | null {
  for (let i = sim.events.length - 1; i >= 0; i--) {
    const e = sim.events[i];
    if (e?.type === 'gave' && e.to === villager) return e.by;
  }
  return null;
}

function complete(sim: Sim, a: BoardAnnonce): void {
  const { world } = sim;
  const def = annonceDef(sim, a.gabarit);
  const board = sim.content.settings.board;
  if (def === null || board === null) return;
  a.state = 'done';
  a.closedDay = world.clock.day;
  a.by = def.scene === null ? lastGiverThisStep(sim, def.giver) : null;
  closeQuest(sim, a);
  world.purse += a.reward;
  emit(sim, { type: 'money', amount: a.reward });
  emit(sim, { type: 'annonce_done', gabarit: a.gabarit, by: a.by, amount: a.reward });
  const rule = board.reward[def.kind];
  if (def.kind === 'together' && rule.heart > 0) {
    for (const c of world.characters) c.heartToday.gesture = true;
    world.session.togetherMoments += 1;
  }
  const first = def.unique !== null && !world.board.uniquesGiven.includes(def.unique);
  if (first && def.unique !== null) {
    world.board.uniquesGiven.push(def.unique);
    storeAtHome(sim, def.unique, 'ordinary', 1);
  }
  const thanks = rawText(sim.content.texts, 'annonces', def.id, first ? 'thanks' : 'thanksAgain') ?? rawText(sim.content.texts, 'annonces', def.id, 'thanks');
  if (def.scene === null && thanks !== null) villagerSays(sim, a.by, def.giver, thanks);
  notifyKey(sim, 'both', 'message', 'annonce_done', { amount: a.reward });
  if (first && def.uniqueScene !== null) runEffects(sim, [{ type: 'play_dialogue', dialogue: def.uniqueScene }], null);
  sim.runtime.changed = true;
}

/**
 * Chaque pas, après les quêtes: l'annonce faite est payée; l'annonce échue se retire, mais
 * jamais au milieu d'une scène ou d'une conversation avec son habitant (section 1.7).
 */
export function updateBoard(sim: Sim): void {
  const a = sim.world.board.current;
  if (a?.state !== 'open') return;
  const quest = questOf(sim, a);
  if (quest?.status === 'done') {
    complete(sim, a);
    return;
  }
  if (!deadlinePassed(sim, a)) return;
  const giver = annonceDef(sim, a.gabarit)?.giver;
  const busy = sim.world.scene !== null || sim.world.characters.some((c) => c.dialogue?.villager === giver || c.menu !== null);
  if (!busy) expire(sim, a, false);
}

/** Distance au tableau du quai à laquelle l'astuce `board_hint` se montre (m). */
const BOARD_HINT_RADIUS = 6;

/** L'astuce du tableau, la première fois qu'un joueur passe près du tableau pendant une annonce. */
export function boardHints(sim: Sim): void {
  const a = sim.world.board.current;
  const at = sim.map.points[POINT.noticeBoard];
  if (a?.state !== 'open' || at === undefined || sim.world.phase !== 'day') return;
  for (const c of sim.world.characters) {
    if (!isSheltered(c) && c.created && distance(c.pos, at) <= BOARD_HINT_RADIUS) queueHint(sim, c.id, { on: 'near_board_annonce' });
  }
}

/** Texte de l'annonce, variables remplies (`{count}`, `{item}` de la vitrine d'Odette). */
export function annonceText(sim: Sim, a: Pick<BoardAnnonce, 'gabarit' | 'variant'>): string {
  const text = rawText(sim.content.texts, 'annonces', a.gabarit, 'text') ?? '';
  const first = annonceLines(sim, a)[0];
  if (first === undefined) return text;
  const def = sim.content.items[first.item];
  return format(text, { count: first.count, item: first.count > 1 ? (def?.plural ?? first.item) : (def?.name ?? first.item) });
}
