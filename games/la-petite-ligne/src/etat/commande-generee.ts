/**
 * Commande du samedi générée (tour 8, sections 4.2 à 4.7): composition, quantités, paiement et
 * progression du budget. Pure (aucun générateur de la partie: `unitDraw` par ligne), pour que la
 * simulation, les tests et le robot tirent la même commande.
 */
import { seasonOfDay } from '../donnees/calendrier';
import type { GeneratedOrderSettings, OrderProduct, Settings } from '../donnees/types';
import { unitDraw } from './tirage';
import type { GeneratedOrderLine, OrderBook } from './types';

/** Ce que le tirage lit de la partie. */
export interface OrderDrawInput {
  seed: number;
  /** Rang de la commande (3 pour le samedi 22). */
  number: number;
  /** Jour du train qui l'emportera. */
  train: number;
  /** Compteurs du duo (`harvested:radish`...): un produit n'est commandé qu'une fois obtenu. */
  counters: Readonly<Record<string, number>>;
  /** Produits qui s'achètent tels quels (jamais commandés). */
  buyable: ReadonlySet<string>;
  /** Arbres debout au moment du tirage. */
  matureTrees: number;
  book: Readonly<Pick<OrderBook, 'budget' | 'recent' | 'ordered'>>;
}

type Rules = Pick<Settings, 'calendar' | 'forage'>;

/** Lignes de la commande `number` (paliers de `linesByOrder`). */
export function linesFor(g: GeneratedOrderSettings, number: number): number {
  let n = g.linesByOrder[0]?.lines ?? g.minLines;
  for (const step of g.linesByOrder) if (number >= step.from) n = step.lines;
  return n;
}

/** « En saison »: au moins 4 des 6 jours de production (du lendemain du tirage au vendredi). */
export function inSeason(settings: Rules, p: OrderProduct, train: number): boolean {
  let days = 0;
  for (let d = train - 6; d < train; d++) if (p.seasons.includes(seasonOfDay(settings, d))) days++;
  return days >= 4;
}

/** Unités qu'une cueillette donne en moyenne sur les 6 jours de production (section 5.2, sans coup de pouce). */
export function forageWeekly(settings: Rules, item: string, train: number): number {
  const f = settings.forage;
  if (f === null) return 0;
  const defs = new Map(f.items.map((i) => [i.item, i]));
  let total = 0;
  for (let d = train - 6; d < train; d++) {
    const season = seasonOfDay(settings, d);
    for (const point of f.points) {
      const here = point.items.filter((i) => defs.get(i)?.seasons.includes(season) === true);
      if (!here.includes(item)) continue;
      const weights = here.reduce((sum, i) => sum + (defs.get(i)?.weight ?? 0), 0);
      const def = defs.get(item);
      if (def === undefined || weights <= 0) continue;
      total += ((f.spawnChance * def.weight) / weights) * ((def.count[0] + def.count[1]) / 2);
    }
  }
  return total;
}

/** Deux lignes qui puisent dans le même produit de base (plat et ingrédient, deux plats du même légume). */
export function clashes(g: GeneratedOrderSettings, a: string, b: string): boolean {
  const base = (x: string): readonly string[] => g.noSharedBase[x] ?? [x];
  const ofB = base(b);
  return base(a).some((x) => ofB.includes(x));
}

function capacity(g: GeneratedOrderSettings, p: OrderProduct): number {
  switch (p.resource) {
    case 'garden':
      return g.resources.garden;
    case 'eggs':
      return g.resources.eggs;
    case 'river':
      return g.resources.river;
    case 'wood':
      return g.resources.wood;
    case 'forage':
      return 1;
  }
}

/** Quantité et part d'une ligne, ou `null` si son minimum ne tient plus dans la ressource (garde-fou L3). */
function quantity(
  settings: Rules,
  g: GeneratedOrderSettings,
  p: OrderProduct,
  share: number,
  used: number,
  input: OrderDrawInput,
): GeneratedOrderLine | null {
  const r = g.resources;
  const room = r.resourceCap - used;
  if (p.resource === 'forage') {
    const expected = forageWeekly(settings, p.item, input.train);
    const cap = r.forageCap * expected;
    if (expected <= 0 || p.min > cap) return null;
    const count = Math.max(
      p.min,
      Math.min(Math.floor(cap), Math.round(Math.min(cap, share * expected))),
    );
    const s = (count / expected) * r.forageShare;
    return s > room + 1e-9 ? null : { item: p.item, count, share: s };
  }
  if (p.resource === 'wood') {
    const cap = r.woodCap * r.woodPlanksPerTree * input.matureTrees;
    if (p.min > cap || p.min * p.cost > room + 1e-9) return null;
    const units = Math.min(cap, Math.min(share, room) / p.cost);
    let count = Math.max(p.min, Math.round(units));
    if (count > cap || count * p.cost > room + 1e-9) count = Math.max(p.min, Math.floor(units));
    return { item: p.item, count, share: count * p.cost };
  }
  const c = capacity(g, p);
  const minShare = (p.min * p.cost) / c;
  if (minShare > room + 1e-9) return null;
  const s = Math.min(share, room);
  const units = (s * c) / p.cost;
  let count = Math.max(p.min, Math.round(units));
  if ((count * p.cost) / c > room + 1e-9) count = Math.max(p.min, Math.floor(units));
  return { item: p.item, count, share: (count * p.cost) / c };
}

/** Tirage pondéré: le premier dont le cumul dépasse `u`. */
function weighted<T>(u: number, pool: readonly T[], weight: (x: T) => number): T | null {
  const total = pool.reduce((sum, x) => sum + weight(x), 0);
  if (pool.length === 0 || total <= 0) return null;
  let acc = 0;
  for (const x of pool) {
    acc += weight(x) / total;
    if (u < acc) return x;
  }
  return pool[pool.length - 1] ?? null;
}

/**
 * Compose la commande `input.number` (section 4.4): candidats obtenus et de saison, rien de la
 * commande précédente (sauf si les candidats manquent), deux lignes au plus par famille, au moins
 * trois familles, pas deux lignes sur le même produit de base, tirage pondéré ligne par ligne;
 * puis les quantités (section 4.5). Renvoie aussi le budget appliqué (taille du duo comprise).
 */
export function composeOrder(
  settings: Rules & Pick<Settings, 'order'>,
  input: OrderDrawInput,
): { lines: GeneratedOrderLine[]; budget: number } {
  const g = settings.order.generated;
  if (g === null) return { lines: [], budget: 0 };
  const previous = input.book.recent[input.book.recent.length - 1] ?? [];
  const twoAgo = input.book.recent[input.book.recent.length - 2] ?? [];
  const familyOf = new Map(g.products.map((p) => [p.item, p.family]));
  const previousFamilies = new Set(previous.map((i) => familyOf.get(i)));
  const candidates = g.products.filter(
    (p) =>
      (input.counters[p.obtained] ?? 0) > 0 &&
      !input.buyable.has(p.item) &&
      inSeason(settings, p, input.train) &&
      (p.resource !== 'wood' || input.matureTrees >= g.resources.woodMinTrees),
  );
  const target = linesFor(g, input.number);
  const fresh = candidates.filter((p) => !previous.includes(p.item));
  let repeats = fresh.length < target ? g.maxRepeatFromPrevious : 0;
  // Jamais moins de `minLines` lignes: au besoin, on reprend davantage de la commande précédente.
  if (fresh.length + repeats < g.minLines) repeats = g.minLines - fresh.length;
  const repeatable = candidates.filter((p) => previous.includes(p.item));
  const size = g.size.factors[g.size.current] ?? 1;
  const budget = input.book.budget * size;
  const share = budget / Math.max(1, target);
  const chosen: OrderProduct[] = [];
  const lines: GeneratedOrderLine[] = [];
  const rejected = new Set<string>();
  const used = new Map<string, number>();
  const weight = (p: OrderProduct): number => {
    let w = 1;
    if (!previousFamilies.has(p.family)) w *= g.weights.absentFamily;
    if (!input.book.ordered.includes(p.item)) w *= g.weights.neverOrdered;
    if (twoAgo.includes(p.item)) w *= g.weights.twoOrdersAgo;
    return w;
  };
  const families = (): Map<string, number> => {
    const out = new Map<string, number>();
    for (const p of chosen) out.set(p.family, (out.get(p.family) ?? 0) + 1);
    return out;
  };
  let draws = 0;
  const pick = (pool: readonly OrderProduct[]): OrderProduct | null => {
    const fams = families();
    let open = pool.filter(
      (p) =>
        !rejected.has(p.item) &&
        !chosen.includes(p) &&
        (fams.get(p.family) ?? 0) < g.maxPerFamily &&
        !chosen.some((c) => clashes(g, p.item, c.item)),
    );
    // Au moins `minFamilies` familles tant que c'est possible: les premières lignes en prennent de nouvelles.
    if (fams.size < g.minFamilies) {
      const fresher = open.filter((p) => !fams.has(p.family));
      if (fresher.length > 0) open = fresher;
    }
    const key =
      draws === 0
        ? `order:${String(input.number)}:${String(chosen.length)}`
        : `order:${String(input.number)}:${String(chosen.length)}:${String(draws)}`;
    draws++;
    return weighted(unitDraw(input.seed, key, input.train), open, weight);
  };
  while (chosen.length < target) {
    draws = 0;
    let line: GeneratedOrderLine | null = null;
    let product: OrderProduct | null;
    // Un candidat dont le minimum ne tient plus (garde-fou de faisabilité) cède sa place au suivant.
    for (;;) {
      product = pick(fresh);
      let fromPrevious = false;
      // Reprendre de la commande précédente: s'il manque des candidats, pour atteindre `minLines`
      // lignes, ou pour une famille de plus (au plus `maxRepeatFromPrevious` produits).
      const repeated = chosen.filter((p) => previous.includes(p.item)).length;
      const familyShort = families().size < g.minFamilies && repeated < g.maxRepeatFromPrevious;
      if (product === null && (repeats > 0 || chosen.length < g.minLines || familyShort)) {
        product = pick(repeatable);
        fromPrevious = product !== null;
      }
      if (product === null) break;
      line = quantity(settings, g, product, share, used.get(product.resource) ?? 0, input);
      if (line !== null) {
        if (fromPrevious) repeats--;
        break;
      }
      rejected.add(product.item);
    }
    if (product === null || line === null) break;
    chosen.push(product);
    lines.push(line);
    used.set(product.resource, (used.get(product.resource) ?? 0) + line.share);
  }
  return { lines, budget };
}

/** Prix d'une unité dans une commande générée (le prix de la table, sinon le prix de vente). */
export function productPrice(
  g: GeneratedOrderSettings,
  item: string,
  sellPrice: number | null,
): number {
  return g.products.find((p) => p.item === item)?.price ?? sellPrice ?? 0;
}

/** Une ligne remplie rapporte le plus grand du prix du marché avec prime, et de sa part de travail payée (section 4.7). */
export function linePay(
  g: GeneratedOrderSettings,
  line: GeneratedOrderLine,
  unitPrice: number,
  premium: number,
): number {
  return Math.max(unitPrice * line.count * premium, line.share * g.paymentPerWorkWeek);
}

/** Budget de la commande suivante (section 4.6): hausse sur une réussite, rien sur un échec, baisse après deux. */
export function nextBudget(
  g: GeneratedOrderSettings,
  budget: number,
  complete: boolean,
  misses: number,
): { budget: number; misses: number } {
  const b = g.budget;
  if (complete) return { budget: Math.min(b.max, budget + b.stepOnComplete), misses: 0 };
  const m = misses + 1;
  return {
    budget: Math.max(b.floor, budget + (m >= 2 ? b.afterTwoMisses : b.afterMiss)),
    misses: m,
  };
}
