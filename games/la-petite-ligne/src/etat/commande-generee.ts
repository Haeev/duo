/**
 * Commande du samedi générée (tour 8, sections 4.2 à 4.7): composition, quantités, paiement et
 * progression du budget. Pure (aucun générateur de la partie: `unitDraw` par ligne), pour que la
 * simulation, les tests et le robot tirent la même commande.
 */
import { dayOfSeason, seasonOfDay } from '../donnees/calendrier';
import type { GeneratedOrderSettings, OrderProduct, Season, Settings } from '../donnees/types';
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
  /** Poules au tirage (tour 9: la capacité d'œufs suit leur nombre); absent: 3. */
  hens?: number;
}

type Rules = Pick<Settings, 'calendar' | 'forage'> & { feel?: Pick<Settings['feel'], 'fishWeights' | 'fishWeightsBySeason'> };

/**
 * Saison de référence d'une commande (section 2.11): celle des six jours de production, ou celle
 * qui en compte le plus (règle « 4 jours sur 6 »). Les saisons changent un samedi: les six jours de
 * production sont toujours dans la même.
 */
export function productionSeason(settings: Pick<Settings, 'calendar'>, train: number): Season {
  const counts = new Map<Season, number>();
  let best: Season = seasonOfDay(settings, train - 1);
  for (let d = train - 6; d < train; d++) {
    const s = seasonOfDay(settings, d);
    counts.set(s, (counts.get(s) ?? 0) + 1);
    if ((counts.get(s) ?? 0) > (counts.get(best) ?? 0)) best = s;
  }
  return best;
}

/** Part d'un poisson parmi les prises d'une saison (poids divisé par la somme des poids). */
function fishShare(feel: NonNullable<Rules['feel']>, season: Season, item: string): number {
  const weights = feel.fishWeightsBySeason[season] ?? feel.fishWeights;
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  return total <= 0 ? 0 : (weights[item] ?? 0) / total;
}

/**
 * Coût d'un poisson dans une commande (tour 9, section 2.11): le coût de la saison de référence
 * des réglages, ramené à la part du poisson dans la saison de la commande; `null` s'il ne mord pas
 * cette saison-là (jamais commandé). Sans `fishCostFromWeights`, le coût écrit.
 */
export function fishCost(settings: Rules & Pick<Settings, 'order'>, p: OrderProduct, train: number): number | null {
  const g = settings.order.generated;
  const feel = settings.feel;
  if (g !== null && g.riverUnitCost !== null && p.resource === 'river') {
    const share = g.fishShareBySeason[productionSeason(settings, train)]?.[p.item] ?? 0;
    return share > 0 ? g.riverUnitCost / share : null;
  }
  if (g === null || !g.fishCostFromWeights || p.resource !== 'river' || feel === undefined) return p.cost;
  const ref = fishShare(feel, g.fishCostReferenceSeason, p.item);
  const now = fishShare(feel, productionSeason(settings, train), p.item);
  if (now <= 0) return null;
  return (p.cost * ref) / now;
}

/**
 * Quantité rangée (tour 9, section 2.11): radis et carottes au rendement d'une case (3), chaque
 * ligne sous son plafond; la part suit une quantité ramenée sous le plafond (jamais au-dessus).
 */
export function tidyLine(g: GeneratedOrderSettings, line: GeneratedOrderLine, min: number): GeneratedOrderLine {
  const step = g.roundTo[line.item] ?? 1;
  let count = Math.max(min, step * Math.max(1, Math.round(line.count / step)));
  const cap = g.lineMax[line.item];
  if (cap !== undefined) count = Math.min(count, cap);
  const share = count < line.count && line.count > 0 ? (line.share * count) / line.count : line.share;
  return { item: line.item, count, share };
}

/** Lignes de la commande `number` (paliers de `linesByOrder`). */
export function linesFor(g: GeneratedOrderSettings, number: number): number {
  let n = g.linesByOrder[0]?.lines ?? g.minLines;
  for (const step of g.linesByOrder) if (number >= step.from) n = step.lines;
  return n;
}

/** « En saison »: au moins 4 des 6 jours de production (du lendemain du tirage au vendredi). */
export function inSeason(settings: Rules, p: OrderProduct, train: number): boolean {
  let days = 0;
  for (let d = train - 6; d < train; d++) if (p.seasons.includes(seasonOfDay(settings, d)) && forageOn(settings, p, d)) days++;
  return days >= 4;
}

/** Une cueillette avec une plage de jours (tour 9, le sureau) ne compte que ses jours. */
function forageOn(settings: Rules, p: OrderProduct, day: number): boolean {
  if (p.resource !== 'forage') return true;
  const def = settings.forage?.items.find((i) => i.item === p.item);
  if (def?.days === null || def === undefined) return true;
  const d = dayOfSeason(settings, day);
  return d >= def.days[0] && d <= def.days[1];
}

/** Unités qu'une cueillette donne en moyenne sur les 6 jours de production (section 5.2, sans coup de pouce). */
export function forageWeekly(settings: Rules, item: string, train: number): number {
  const f = settings.forage;
  if (f === null) return 0;
  const defs = new Map(f.items.map((i) => [i.item, i]));
  let total = 0;
  for (let d = train - 6; d < train; d++) {
    const season = seasonOfDay(settings, d);
    const sd = dayOfSeason(settings, d);
    const inWindow = (i: string): boolean => {
      const days = defs.get(i)?.days ?? null;
      return days === null || (sd >= days[0] && sd <= days[1]);
    };
    for (const point of f.points) {
      const here = point.items.filter((i) => defs.get(i)?.seasons.includes(season) === true && inWindow(i));
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

function capacity(g: GeneratedOrderSettings, p: OrderProduct, hens: number): number {
  switch (p.resource) {
    case 'garden':
      return g.resources.garden;
    case 'eggs': {
      // Tour 9: poules x œufs par semaine (5,4 x 3 = 16,2, comme avant); arrondi au millième.
      const per = g.eggsPerHenPerWeek;
      return per === null ? g.resources.eggs : Math.round(per * hens * 1000) / 1000;
    }
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
  const c = capacity(g, p, input.hens ?? 3);
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
  // Poissons au coût de la saison de la commande (tour 9); celui qui ne mord pas cette saison n'est pas commandé.
  const priced: OrderProduct[] = [];
  for (const p of g.products) {
    const cost = fishCost(settings, p, input.train);
    if (cost !== null) priced.push(cost === p.cost ? p : { ...p, cost });
  }
  const candidates = priced.filter(
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
  // Part perdue aux plafonds (tour 9): au-delà de `extraLineMinShare`, une ligne de plus la reprend.
  let lost = 0;
  let extra = false;
  let lineShare = share;
  for (;;) {
    if (chosen.length >= target) {
      const room = g.extraLineMinShare;
      if (room === null || lost < room - 1e-9 || chosen.length >= g.maxLines) break;
      extra = true;
      lineShare = lost;
    }
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
      line = quantity(settings, g, product, lineShare, used.get(product.resource) ?? 0, input);
      if (line !== null) {
        if (fromPrevious) repeats--;
        break;
      }
      rejected.add(product.item);
    }
    if (product === null || line === null) break;
    const tidy = tidyLine(g, line, product.min);
    if (!extra) lost += line.share - tidy.share;
    chosen.push(product);
    lines.push(tidy);
    used.set(product.resource, (used.get(product.resource) ?? 0) + tidy.share);
    if (extra) break;
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
