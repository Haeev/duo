/**
 * La semaine après la démo (tour 8): la commande du samedi tirée au départ de chaque train, la
 * lettre qui l'annonce, la mémoire du tirage, et le courrier hebdomadaire borné.
 */
import { nextTrainDay } from '../donnees/calendrier';
import { composeOrder, nextBudget } from '../etat/commande-generee';
import type { OrderBook, OrderResult } from '../etat/types';
import { type Sim, emit } from './contexte';

/** Commandes payées gardées dans `world.orderHistory` (les totaux comptent tout). */
export const ORDER_HISTORY_KEPT = 8;
/** Lettres lues gardées (les non lues restent toutes). */
export const LETTERS_READ_KEPT = 12;
/**
 * Âge (jours) au-delà duquel une lettre hebdomadaire part dès qu'un des deux l'a lue: trois
 * semaines, la commande en cours, la précédente et le récapitulatif restent (QA8-02).
 */
export const WEEKLY_LETTER_DAYS = 21;
/** Âge (jours) au-delà duquel une lettre hebdomadaire part, même jamais ouverte: six semaines. */
export const WEEKLY_LETTER_MAX_DAYS = 42;

export function emptyOrderBook(sim: Pick<Sim, 'content'>): OrderBook {
  const s = sim.content.settings.order;
  const written = s.trains.map((o) => o.lines.map((l) => l.item));
  return {
    generated: null,
    budget: s.generated?.budget.start ?? 0,
    misses: 0,
    recent: written.slice(-2),
    ordered: [...new Set(written.flat())],
  };
}

/** Arbres debout (abattables) en ce moment. */
function matureTrees(sim: Sim): number {
  return sim.world.trees.filter((t) => !t.felled).length;
}

/**
 * Tire la commande suivante (au départ du train, ou à la reprise d'une vieille sauvegarde) pour
 * le prochain train après `today`, si les commandes générées sont décrites. Ne fait rien si elle
 * existe déjà.
 */
export function drawNextOrder(sim: Sim, today: number): void {
  const { world } = sim;
  const s = sim.content.settings;
  const g = s.order.generated;
  if (g === null) return;
  const number = world.orderTotals.orders + 1;
  if (number < g.fromOrder || world.order.generated?.number === number) return;
  const train = nextTrainDay(s, today + 1);
  if (train === null) return;
  const buyable = new Set(
    Object.values(sim.content.items)
      .filter((i) => i.buyPrice !== null)
      .map((i) => i.id),
  );
  const { lines, budget } = composeOrder(s, {
    seed: world.seed,
    number,
    train,
    counters: world.counters.duo,
    buyable,
    matureTrees: matureTrees(sim),
    book: world.order,
  });
  world.order.generated = { number, train, drawnDay: today, lines, budget, lettersSent: [] };
  world.orderIndex = s.order.trains.length;
  sim.runtime.changed = true;
  emit(sim, { type: 'order_drawn', number, train });
}

/** Après un paiement: totaux, historique borné, mémoire du tirage et budget de la commande suivante. */
export function recordPaidOrder(
  sim: Sim,
  result: OrderResult,
  items: readonly string[],
  generated: boolean,
): void {
  const { world } = sim;
  const t = world.orderTotals;
  t.orders += 1;
  t.linesDone += result.linesDone;
  t.linesTotal += result.linesTotal;
  t.amount += result.amount;
  world.orderHistory.push({ ...result });
  if (world.orderHistory.length > ORDER_HISTORY_KEPT)
    world.orderHistory.splice(0, world.orderHistory.length - ORDER_HISTORY_KEPT);
  const g = sim.content.settings.order.generated;
  if (!generated || g === null) return;
  const book = world.order;
  book.recent.push([...items]);
  if (book.recent.length > 2) book.recent.splice(0, book.recent.length - 2);
  for (const item of items) if (!book.ordered.includes(item)) book.ordered.push(item);
  const next = nextBudget(g, book.budget, result.complete, book.misses);
  book.budget = next.budget;
  book.misses = next.misses;
}

/** Jour du train pour l'identifiant d'une lettre hebdomadaire (`coop_order_generated@22`). */
export function instanceId(id: string, train: number): string {
  return `${id}@${String(train)}`;
}

/**
 * Le courrier garde les `LETTERS_READ_KEPT` lettres lues par les deux les plus récentes. Les
 * lettres uniques (une par définition) restent: elles ne partent qu'une fois, et leur présence le
 * dit; seules les lettres hebdomadaires (`@`) s'en vont: lues par les deux et au-delà des
 * `LETTERS_READ_KEPT`, lues par l'un des deux et plus vieilles que `WEEKLY_LETTER_DAYS`, ou plus
 * vieilles que `WEEKLY_LETTER_MAX_DAYS` (une commande passée depuis longtemps). Une lettre récente
 * non lue reste toujours.
 */
export function pruneLetters(sim: Sim): void {
  const letters = sim.world.letters;
  const today = sim.world.clock.day;
  const weekly = (l: (typeof letters)[number]): boolean => l.id.includes('@');
  const read = letters.filter((l) => l.read.length >= 2);
  const old = new Set(read.slice(0, Math.max(0, read.length - LETTERS_READ_KEPT)).filter(weekly));
  for (const l of letters) {
    if (!weekly(l)) continue;
    const age = today - l.day;
    if ((age > WEEKLY_LETTER_DAYS && l.read.length >= 1) || age > WEEKLY_LETTER_MAX_DAYS) old.add(l);
  }
  if (old.size === 0) return;
  sim.world.letters = letters.filter((l) => !old.has(l));
  sim.runtime.changed = true;
}
