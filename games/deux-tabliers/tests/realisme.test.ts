// Réalisme de la gestion (démo v0.2, `realisme-v0-2.md`, critères R2-xx): tests courts, sans
// service joué, en appelant l'aube et le soir de la clientèle sur une maison neuve (graine fixe).
import { createRandom } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import {
  addLot,
  consume,
  emergencyCents,
  orderCost,
  reconcileLots,
  supplierPasses,
  type Ctx,
} from '../src/clientele/economie';
import { dawn, startHouse, stepDay } from '../src/clientele/journee';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import { restoreWorld } from '../src/session';
import { IDLE_INPUT } from '../src/simulation/entrees';
import type { GameEvent } from '../src/simulation/evenements';
import { createWorld } from '../src/simulation/monde';
import type { SimContext } from '../src/simulation/systemes';

// Sans la prise en main des premiers jours (`warmup`, testée par `premier-jour.test.ts`): ce
// fichier vérifie d'autres règles sur des chiffres relevés avec l'affluence pleine dès le mardi.
const content = loadContent({
  ...DATA_FILES,
  'clientele/regles.json': {
    ...(DATA_FILES['clientele/regles.json'] as Record<string, unknown>),
    warmup: [],
  },
});
const cc = content.clientele;

function house(): { ctx: Ctx; events: GameEvent[] } {
  const world = createWorld(content, ['a', 'b']);
  const events: GameEvent[] = [];
  const sim: SimContext = {
    world,
    content,
    dt: 1 / 60,
    random: createRandom(11),
    inputs: [IDLE_INPUT, IDLE_INPUT],
    emit: (e) => events.push(e),
  };
  const ctx: Ctx = { sim, cc, s: world.clientele };
  startHouse(ctx);
  return { ctx, events };
}

const carton = (id: string): number => {
  const ing = cc.ingredients.get(id);
  if (ing === undefined) throw new Error(id);
  return Math.round(ing.cartonUnits * ing.unitCost * 100);
};

describe('Deux Tabliers, réalisme v0.2', () => {
  it('R2-10: la réserve de Simone est en stock au jour 2 et ne coûte rien', () => {
    const { ctx } = house();
    const s = ctx.s;
    expect(s.cash).toBe(30_000 - 1857);
    for (const [id, n] of cc.economy.startStock)
      expect(s.stock[id], id).toBe(n * (cc.ingredients.get(id)?.cartonUnits ?? 0));
    expect(s.lots.grains_maison).toEqual([[2000, 2 + 30 - 1]]);
    s.order = {};
    dawn(ctx, 2);
    expect(s.cash).toBe(30_000 - 2 * 1857);
    expect(s.today.goods).toBe(0);
    expect(s.stock.grains_maison).toBe(2000);
  });

  it('R2-01 et R2-06: la caisse paie à la livraison ce qui était affiché, port une fois par fournisseur', () => {
    const { ctx } = house();
    const s = ctx.s;
    // Lait et beurre chez Armelle (11,80 €, sous le franco de 15 €), un sac chez Joseph (20 € < 30 €).
    s.order = { lait_entier: 1, beurre: 1, grains_maison: 1, croissant_boulanger: 2 };
    const shown = orderCost(cc, s.order, 2);
    expect(shown.suppliers.armelle).toEqual({
      goods: carton('lait_entier') + carton('beurre'),
      shipping: 300,
      toFranco: 1500 - carton('lait_entier') - carton('beurre'),
    });
    expect(shown.suppliers.joseph?.shipping).toBe(500);
    expect(shown.suppliers.lucas?.shipping).toBe(0);
    const before = s.cash;
    dawn(ctx, 2);
    expect(before - s.cash).toBe(1857 + shown.goods + shown.shipping);
    expect(s.today.goods).toBe(shown.goods);
    expect(s.today.shipping).toBe(800);
    // Au-dessus du franco: « Port offert. »
    expect(orderCost(cc, { lait_entier: 2 }, 4).suppliers.armelle?.shipping).toBe(0);
  });

  it('R2-04 et R2-05: personne ne livre le lundi; Armelle mardi, jeudi, samedi; Joseph mardi, vendredi', () => {
    const passes = (sup: string): number[] =>
      [2, 3, 4, 5, 6, 7, 8].filter((d) => supplierPasses(cc, sup, d));
    expect(passes('armelle')).toEqual([2, 4, 6]);
    expect(passes('joseph')).toEqual([2, 5]);
    expect(passes('lucas')).toEqual([2, 3, 4, 5, 6, 7]);
    expect(orderCost(cc, { lait_entier: 1 }, 3).goods).toBe(0);
    const { ctx, events } = house();
    const s = ctx.s;
    for (let d = 2; d <= 7; d++) {
      s.order = {};
      dawn(ctx, d);
    }
    s.order = { croissant_boulanger: 1 };
    const before = s.cash;
    const deliveries = (): number => events.filter((e) => e.type === 'clientele-delivery').length;
    const n = deliveries();
    dawn(ctx, 8);
    expect(s.phase).toBe('monday');
    expect(deliveries()).toBe(n);
    expect(before - s.cash).toBe(1857);
    expect(s.order).toEqual({ croissant_boulanger: 1 });
    dawn(ctx, 9);
    expect(deliveries()).toBe(n + 1);
    expect(s.today.goods).toBe(carton('croissant_boulanger'));
    expect(s.order).toBeNull();
  });

  it('R2-07: le lait livré le jour 2 sert jusqu’au jour 8 et part au matin du jour 9, en « Perdu »', () => {
    const { ctx } = house();
    const s = ctx.s;
    s.order = { lait_entier: 1 };
    dawn(ctx, 2);
    expect(s.lots.lait_entier).toEqual([[6000, 8]]);
    for (let d = 3; d <= 8; d++) {
      s.order = {};
      dawn(ctx, d);
    }
    expect(s.today.lost).toBe(0);
    expect(s.stock.lait_entier).toBe(6000);
    s.order = {};
    dawn(ctx, 9);
    expect(s.stock.lait_entier).toBe(0);
    expect(s.today.lost).toBe(780);
    expect(s.today.lostItems).toEqual(['lait_entier']);
    expect(s.flags).toContain('first-loss');
  });

  it('R2-08: la vente prend le lot le plus ancien', () => {
    const { ctx } = house();
    const s = ctx.s;
    addLot(s, 'lait_entier', 1000, 8);
    addLot(s, 'lait_entier', 1000, 5);
    expect(s.lots.lait_entier?.map((l) => l[1])).toEqual([5, 8]);
    const milk = cc.recipes.get('creme')?.ingredients.find(([i]) => i === 'lait_entier')?.[1] ?? 0;
    expect(milk).toBeGreaterThan(0);
    consume(cc, s, 'creme');
    expect(s.lots.lait_entier).toEqual([
      [1000 - milk, 5],
      [1000, 8],
    ]);
    expect(s.stock.lait_entier).toBe(2000 - milk);
  });

  it('R2-09 et R2-03: le panier du soir rapporte 6 points au plus; le résultat se recompte', () => {
    const { ctx } = house();
    const s = ctx.s;
    s.order = { croissant_boulanger: 2 };
    dawn(ctx, 2);
    expect(s.stock.croissant_boulanger).toBe(20);
    s.phase = 'closing';
    s.groups = [];
    s.arrivals = [];
    const points = s.points;
    stepDay(ctx);
    expect(s.phase).toBe('evening');
    expect(s.points - points).toBe(6);
    expect(s.today.basket).toBe(20);
    expect(s.stock.croissant_boulanger).toBe(0);
    const r = s.report;
    if (r === null) throw new Error('pas de bilan');
    expect(r.basketValue).toBe(2 * carton('croissant_boulanger'));
    expect(r.charges).toBe(900);
    expect(r.result).toBe(
      r.revenue + r.tips + r.eventEuros - r.goods - r.shipping - r.emergency - r.rent - r.charges,
    );
    expect(r.result).toBe(-r.goods - 1857 - 900);
  });

  it('dépannage: le carton entier, payé 30 % plus cher, livré en lot daté', () => {
    const lait = cc.ingredients.get('lait_entier');
    if (lait === undefined) throw new Error('lait');
    expect(emergencyCents(cc, lait)).toBe(Math.round(780 * 1.3));
    expect(cc.supplies.suppliers.every((x) => x.emergency)).toBe(true);
  });

  it('R2-11: une partie v0.1 (format 2, sans lots) se reprend, stock intact, lots créés', () => {
    const { ctx } = house();
    dawn(ctx, 2);
    const old = JSON.parse(JSON.stringify(ctx.sim.world)) as Record<string, unknown> & {
      clientele: Record<string, unknown> & { today: Record<string, unknown> };
    };
    delete old.clientele.lots;
    for (const k of ['goods', 'shipping', 'emergency', 'lost', 'lostItems', 'basketValue'])
      Reflect.deleteProperty(old.clientele.today, k);
    const stock = { ...ctx.s.stock };
    const back = restoreWorld(old, 2, ['a', 'b']);
    if (back === null) throw new Error('reprise refusée');
    expect(back.clientele.lots).toEqual({});
    reconcileLots(cc, back.clientele);
    expect(back.clientele.stock).toEqual(stock);
    expect(back.clientele.lots.lait_entier?.[0]?.[1]).toBe(2 + 7 - 1);
    expect(back.clientele.today.goods).toBe(0);
  });
});
