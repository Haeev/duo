// Tour 8, section 4: commande du samedi générée, paiement, progression, lettres (T8-14, T8-15, T8-17, T8-18).
import { describe, expect, it } from 'vitest';
import { seasonOfDay } from '../src/donnees/calendrier';
import { currentOrder } from '../src/donnees/commandes';
import type { GeneratedOrderSettings } from '../src/donnees/types';
import { clashes, composeOrder, fishCost, inSeason, linePay, nextBudget } from '../src/etat/commande-generee';
import { unitDraw } from '../src/etat/tirage';
import type { OrderBook } from '../src/etat/types';
import type { Sim } from '../src/simulation/contexte';
import { sendLetter } from '../src/simulation/courrier';
import { payOrder } from '../src/simulation/economie';
import { addStack } from '../src/simulation/sac';
import { drawNextOrder, emptyOrderBook } from '../src/simulation/semaine';
import { contentAndMap, newSim } from './aides';

const { content } = contentAndMap();
const s = content.settings;
const g: GeneratedOrderSettings = (() => {
  if (s.order.generated === null) throw new Error('reglages.json: order.generated attendu');
  return s.order.generated;
})();
const allObtained = Object.fromEntries(g.products.map((p) => [p.obtained, 1]));
const buyable = new Set(
  Object.values(content.items)
    .filter((i) => i.buyPrice !== null)
    .map((i) => i.id),
);
const capacityOf = (resource: string): number =>
  resource === 'eggs' ? g.resources.eggs : resource === 'garden' ? g.resources.garden : 1;

describe('composition (T8-14, sections 4.4 et 4.5)', () => {
  it('1 000 graines, commandes 3 à 11: jamais la même que la précédente, 3 lignes au moins, familles, bases, saisons, minimums, parts', () => {
    let orders = 0;
    let freshOnly = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const book: OrderBook = emptyOrderBook({ content });
      for (let n = 3; n <= 11; n++) {
        const train = 22 + 7 * (n - 3);
        const { lines, budget } = composeOrder(s, {
          seed,
          number: n,
          train,
          counters: allObtained,
          buyable,
          matureTrees: 6,
          book,
        });
        const ids = lines.map((l) => l.item);
        const previous = book.recent[book.recent.length - 1] ?? [];
        const where = `graine ${String(seed)}, commande ${String(n)}`;
        expect(lines.length, where).toBeGreaterThanOrEqual(3);
        expect([...ids].sort().join(), where).not.toBe([...previous].sort().join());
        if (seasonOfDay(s, train - 1) !== 'winter') {
          expect(ids.filter((i) => previous.includes(i)).length, where).toBeLessThanOrEqual(
            g.maxRepeatFromPrevious,
          );
        }
        const families = new Map<string, number>();
        const shares = new Map<string, number>();
        for (const line of lines) {
          const p = g.products.find((x) => x.item === line.item);
          expect(p, where).toBeDefined();
          if (p === undefined) continue;
          families.set(p.family, (families.get(p.family) ?? 0) + 1);
          shares.set(p.resource, (shares.get(p.resource) ?? 0) + line.share);
          expect(inSeason(s, p, train), `${where}: ${p.item} de saison`).toBe(true);
          expect(buyable.has(p.item), where).toBe(false);
          expect(line.count, `${where}: ${p.item}`).toBeGreaterThanOrEqual(p.min);
          // Tour 9 (section 2.11): poissons au coût de la saison, quantités arrondies et plafonnées
          // (la part suit une quantité ramenée sous le plafond, jamais au-dessus).
          expect(line.count, `${where}: ${p.item} plafond`).toBeLessThanOrEqual(g.lineMax[p.item] ?? Infinity);
          if ((g.roundTo[p.item] ?? 1) > 1 && line.count < (g.lineMax[p.item] ?? Infinity)) expect(line.count % (g.roundTo[p.item] ?? 1), where).toBe(0);
          if (p.resource !== 'forage' && p.resource !== 'wood') {
            const cost = fishCost(s, p, train) ?? Infinity;
            expect(line.share, where).toBeLessThanOrEqual((line.count * cost) / capacityOf(p.resource) + 1e-9);
          }
        }
        for (const [family, count] of families)
          expect(count, `${where}: ${family}`).toBeLessThanOrEqual(g.maxPerFamily);
        if (seasonOfDay(s, train - 1) !== 'winter')
          expect(families.size, where).toBeGreaterThanOrEqual(g.minFamilies);
        for (const [resource, share] of shares)
          expect(share, `${where}: ${resource}`).toBeLessThanOrEqual(
            g.resources.resourceCap + 1e-9,
          );
        for (const a of ids)
          for (const b of ids)
            if (a !== b) expect(clashes(g, a, b), `${where}: ${a} et ${b}`).toBe(false);
        expect(budget).toBeCloseTo(book.budget * (g.size.factors[g.size.current] ?? 1), 9);
        if (ids.every((i) => !previous.includes(i))) freshOnly++;
        orders++;
        // Le duo réussit une commande sur deux à trois, tirée par la graine: le budget monte et descend.
        const complete = unitDraw(seed, 'test-complete', n) < 0.7;
        const next = nextBudget(g, book.budget, complete, book.misses);
        book.budget = next.budget;
        book.misses = next.misses;
        book.recent = [...book.recent, ids].slice(-2);
        book.ordered = [...new Set([...book.ordered, ...ids])];
      }
    }
    expect(orders).toBe(9000);
    // La plupart des commandes ne reprennent rien de la précédente (78 % dans la simulation).
    expect(freshOnly / orders).toBeGreaterThan(0.6);
  });

  it('seulement des produits obtenus; pas de planches sans au moins deux arbres debout', () => {
    const book = emptyOrderBook({ content });
    const counters = {
      'harvested:radish': 3,
      'picked:egg': 2,
      'caught:gudgeon': 1,
      'crafted:saw_plank': 1,
    };
    for (let seed = 1; seed <= 200; seed++) {
      const few = composeOrder(s, {
        seed,
        number: 3,
        train: 22,
        counters,
        buyable,
        matureTrees: 1,
        book,
      });
      expect(
        few.lines.map((l) => l.item).every((i) => ['radish', 'egg', 'gudgeon'].includes(i)),
        `graine ${String(seed)}`,
      ).toBe(true);
      const all = composeOrder(s, {
        seed,
        number: 3,
        train: 22,
        counters,
        buyable,
        matureTrees: 6,
        book,
      });
      expect(all.lines.every((l) => ['radish', 'egg', 'gudgeon', 'plank'].includes(l.item))).toBe(
        true,
      );
    }
  });
});

describe('progression (T8-17, section 4.6)', () => {
  it('monte après une réussite, rien après un échec, baisse après deux, jamais sous le plancher ni au-dessus du plafond', () => {
    const check = (r: { budget: number; misses: number }, budget: number, misses: number): void => {
      expect(r.budget).toBeCloseTo(budget, 9);
      expect(r.misses).toBe(misses);
    };
    check(nextBudget(g, 1.9, true, 0), 2.05, 0);
    check(nextBudget(g, 3.05, true, 0), 3.1, 0);
    check(nextBudget(g, 2.2, false, 0), 2.2, 1);
    check(nextBudget(g, 2.2, false, 1), 1.95, 2);
    check(nextBudget(g, 1.95, false, 2), 1.7, 3);
    check(nextBudget(g, 1.6, false, 1), 1.52, 2);
    check(nextBudget(g, 1.52, false, 5), 1.52, 6);
    check(nextBudget(g, 1.52, true, 3), 1.67, 0);
  });
});

/** Partie au soir du jour 15: les deux commandes écrites payées, tout déjà produit une fois. */
function afterDemo(seed: number): Sim {
  const sim = newSim(seed);
  const w = sim.world;
  w.phase = 'day';
  w.clock = { day: 15, minutes: 16 * 60, running: true, stoppedBy: null, veillee: false };
  Object.assign(w.counters.duo, allObtained);
  w.orderIndex = s.order.trains.length - 1;
  w.orderTotals = { orders: s.order.trains.length, linesDone: 9, linesTotal: 9, amount: 1530 };
  drawNextOrder(sim, 15);
  return sim;
}

describe('paiement et lettres (T8-15, T8-18, sections 4.7 et 4.8)', () => {
  it('une ligne remplie rapporte au moins sa part x 380 sous, prime de 25 % à la commande complète; la lettre dit le même montant', () => {
    for (const seed of [1, 2, 3, 20261030]) {
      const sim = afterDemo(seed);
      const order = sim.world.order.generated;
      expect(order?.train).toBe(22);
      if (order === null) continue;
      for (const line of order.lines) addStack(sim.world.crate, line.item, 'ordinary', line.count);
      sim.world.clock = {
        day: 22,
        minutes: 16 * 60,
        running: true,
        stoppedBy: null,
        veillee: false,
      };
      const premium = currentOrder(s, sim.world).linePremium;
      const expected = order.lines.reduce((sum, l) => {
        const price =
          g.products.find((p) => p.item === l.item)?.price ?? content.items[l.item]?.sellPrice ?? 0;
        const pay = linePay(g, l, price, premium);
        expect(pay).toBeGreaterThanOrEqual(l.share * g.paymentPerWorkWeek);
        return sum + pay;
      }, 0);
      payOrder(sim);
      const result = sim.world.orderResult;
      expect(result?.complete).toBe(true);
      expect(result?.amount).toBe(Math.round(expected * 1.25));
      sendLetter(sim, 'coop_recap_generated');
      const letter = sim.world.letters.find((l) => l.id === 'coop_recap_generated@22');
      expect(letter?.title).toBe('Bilan du samedi 22');
      expect(letter?.text).toContain(`${String(result?.amount)} sous`);
      expect(letter?.text).not.toContain('{');
      // La commande suivante est tirée au départ du train, pour samedi 29, avec un budget plus grand.
      expect(sim.world.order.generated?.train).toBe(29);
      expect(sim.world.order.budget).toBeCloseTo(g.budget.start + g.budget.stepOnComplete, 9);
      expect(sim.world.orderTotals.orders).toBe(3);
    }
  });

  it('« une ligne », jamais « 1 lignes »; une commande incomplète paie ses lignes sans prime et garde le budget', () => {
    const sim = afterDemo(7);
    const order = sim.world.order.generated;
    const first = order?.lines[0];
    if (order === null || first === undefined) throw new Error('commande attendue');
    addStack(sim.world.crate, first.item, 'ordinary', first.count);
    sim.world.clock.day = 22;
    payOrder(sim);
    expect(sim.world.orderResult?.linesDone).toBe(1);
    expect(sim.world.order.budget).toBe(g.budget.start);
    expect(sim.world.order.misses).toBe(1);
    sendLetter(sim, 'coop_recap_generated');
    const text = sim.world.letters.find((l) => l.id === 'coop_recap_generated@22')?.text ?? '';
    expect(text).not.toMatch(/\b1 lignes\b/);
    expect(text).not.toContain('{');
  });

  it('lettre de commande: commande listée, conseil du produit le plus en avance, salutation jamais la même deux semaines de suite', () => {
    let pairs = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const sim = afterDemo(seed);
      let previous: string | null = null;
      for (let week = 0; week < 4; week++) {
        const order = sim.world.order.generated;
        if (order === null) throw new Error('commande attendue');
        sendLetter(sim, 'coop_order_generated');
        const letter = sim.world.letters.find(
          (l) => l.id === `coop_order_generated@${String(order.train)}`,
        );
        expect(letter, `graine ${String(seed)}, semaine ${String(week)}`).toBeDefined();
        const text = letter?.text ?? '';
        expect(letter?.title).toBe(`Commande pour samedi ${String(order.train)}`);
        expect(text).not.toContain('{');
        expect(text).toContain(`samedi ${String(order.train)}`);
        for (const line of order.lines) expect(text).toContain(String(line.count));
        const lead = Math.max(
          ...order.lines.map((l) => g.products.find((p) => p.item === l.item)?.leadDays ?? 0),
        );
        const first = order.lines.find(
          (l) => (g.products.find((p) => p.item === l.item)?.leadDays ?? 0) === lead,
        );
        const tips = content.texts.raw.orderTips as Record<string, string>;
        expect(text.endsWith(tips[first?.item ?? ''] ?? '?'), text).toBe(true);
        const greeting = text.slice(0, text.indexOf(' La coopérative passe commande'));
        if (previous !== null) {
          expect(greeting, `graine ${String(seed)}`).not.toBe(previous);
          pairs++;
        }
        previous = greeting;
        // Une seule lettre par train, même si on la renvoie.
        sendLetter(sim, 'coop_order_generated');
        expect(sim.world.letters.filter((l) => l.id === letter?.id).length).toBe(1);
        // Le train part: commande payée vide, la suivante est tirée.
        sim.world.clock.day = order.train;
        payOrder(sim);
        sim.world.orderResult = null;
      }
    }
    expect(pairs).toBe(180);
  });
});
