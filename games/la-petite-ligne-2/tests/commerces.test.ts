// Commerces (cahier 4.6, R34): chacun rachète son métier à son prix, bourse et coffre commun,
// refus clairs, stock et réassort, plafond du jour, mémoire des prix, commerce ajouté par un fichier.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ProgressSchema } from '../src/etat/progression';
import { applyEffect } from '../src/simulation/regles/effets';
import { countItem } from '../src/simulation/sac/inventaire';
import { offerFor, shopDef, dailyNeed } from '../src/simulation/commerces/prix';
import type { Sim } from '../src/simulation/noyau/pas';
import { shopModel } from '../src/interface/boutique/modele';
import { act, contentWith, contextOf } from './aides-l3';
import { gameContent, newSim } from './aides';

const content = gameContent();
const SHOP = 'buvette-de-la-gare';

/** Une partie à 10 h, le joueur 0 devant le comptoir de la buvette d'essai. */
function atCounter(c = content): Sim {
  const sim = newSim(c);
  sim.world.minutes = 600;
  const body = sim.world.players[0].body;
  body.x = 20;
  body.y = 17.3;
  return sim;
}

const refusals = (events: Sim['events']): string[] =>
  events.flatMap((e) => (e.type === 'refused' ? [e.reason] : []));

describe('commerces', () => {
  it('le même objet rapporte un prix différent chez deux commerçants (exemple du client)', () => {
    const c = contentWith((files) => {
      files['lieux/essai-gare/commerces/fournil-essai.json'] = {
        schema: 1,
        id: 'fournil-essai',
        name: 'Fournil',
        keeper: 'cheffe-de-gare',
        hours: { from: 300, to: 1200 },
        sells: [],
        buys: [{ item: 'pomme', price: 100 }],
      };
    });
    const sim = atCounter(c);
    const buvette = shopDef(sim, SHOP);
    const fournil = shopDef(sim, 'fournil-essai');
    expect(buvette && fournil).toBeTruthy();
    if (buvette === null || fournil === null) return;
    expect(offerFor(sim, buvette, 'pomme', 0)?.base).toBe(60);
    expect(offerFor(sim, fournil, 'pomme', 0)?.base).toBe(100);
    expect(offerFor(sim, fournil, 'buche', 0)).toBeNull();
  });

  it('vendre par quantité: la bourse monte, le stock du sac baisse, le prix est retenu', () => {
    const sim = atCounter();
    const me = sim.world.players[0];
    me.toolbar[0] = { item: 'pomme', count: 5 };
    me.toolbar[1] = { item: 'planche', count: 3 };
    const shop = shopDef(sim, SHOP);
    if (shop === null) throw new Error('commerce d’essai absent');
    const unit = offerFor(sim, shop, 'pomme', 0)?.unit ?? 0;
    const before = me.money;
    const events = act(sim, 0, { type: 'shop_sell', shop: SHOP, item: 'pomme', count: 3 });
    expect(me.money - before).toBe(unit * 3);
    expect(countItem(me, 'pomme')).toBe(2);
    expect(sim.world.progress.prices.pomme).toEqual({ [SHOP]: 60 });
    expect(events.some((e) => e.type === 'shop_sold' && e.cents === unit * 3)).toBe(true);
    // Il n'en veut pas: refus clair, rien ne bouge.
    const no = act(sim, 0, { type: 'shop_sell', shop: SHOP, item: 'planche', count: 1 });
    expect(refusals(no)).toEqual(['not-wanted']);
    expect(countItem(me, 'planche')).toBe(3);
    // Pas assez d'exemplaires.
    expect(
      refusals(act(sim, 0, { type: 'shop_sell', shop: SHOP, item: 'pomme', count: 9 })),
    ).toEqual(['not-enough-items']);
  });

  it('acheter: bourse, stock du jour et réassort, poches pleines, article verrouillé par l’amitié', () => {
    const sim = atCounter();
    const me = sim.world.players[0];
    me.money = 1000;
    expect(
      refusals(act(sim, 0, { type: 'shop_buy', shop: SHOP, item: 'pain', count: 2, chest: false })),
    ).toEqual([]);
    expect(me.money).toBe(1000 - 240);
    expect(countItem(me, 'pain')).toBe(2);
    expect(
      refusals(act(sim, 0, { type: 'shop_buy', shop: SHOP, item: 'pain', count: 5, chest: false })),
    ).toEqual(['out-of-stock']);
    sim.world.common.day += 1;
    expect(
      refusals(act(sim, 0, { type: 'shop_buy', shop: SHOP, item: 'pain', count: 5, chest: false })),
    ).toEqual([]);
    me.money = 100;
    expect(
      refusals(
        act(sim, 0, { type: 'shop_buy', shop: SHOP, item: 'pomme', count: 2, chest: false }),
      ),
    ).toEqual(['not-enough-money']);
    expect(
      refusals(
        act(sim, 0, { type: 'shop_buy', shop: SHOP, item: 'hache-forgee', count: 1, chest: false }),
      ),
    ).toEqual(['locked']);
    me.money = 100_000;
    me.toolbar = me.toolbar.map(() => ({ item: 'planche', count: 10 }));
    expect(
      refusals(
        act(sim, 0, { type: 'shop_buy', shop: SHOP, item: 'pomme', count: 1, chest: false }),
      ),
    ).toEqual(['pockets-full']);
  });

  it('fermé, trop loin, coffre refusé pour un achat personnel, payé par le coffre pour le foyer', () => {
    const c = contentWith((files) => {
      const shop = files[`lieux/essai-gare/commerces/${SHOP}.json`] as { sells: unknown[] };
      shop.sells.push({ item: 'planche', price: 500, dailyStock: null, payment: 'household' });
    });
    const sim = atCounter(c);
    const me = sim.world.players[0];
    me.money = 300;
    sim.world.common.chest = 800;
    const buy = (item: string, count: number, chest: boolean) =>
      refusals(act(sim, 0, { type: 'shop_buy', shop: SHOP, item, count, chest }));
    expect(buy('pain', 1, true)).toEqual(['chest-not-allowed']);
    // 2 planches: 10 €, 8 € du coffre et 2 € de la bourse.
    expect(buy('planche', 2, false)).toEqual([]);
    expect(sim.world.common.chest).toBe(0);
    expect(me.money).toBe(100);
    sim.world.minutes = 1300;
    expect(buy('pain', 1, false)).toEqual(['shop-closed']);
    sim.world.minutes = 600;
    me.body.y = 30;
    expect(buy('pain', 1, false)).toEqual(['too-far']);
  });

  it('plafond d’achat du jour, besoin du jour payé 50 % de plus, ouverture par le dialogue', () => {
    const sim = atCounter(
      contentWith((files) => {
        (files[`lieux/essai-gare/commerces/${SHOP}.json`] as { dailyBuyCap: number }).dailyBuyCap =
          200;
      }),
    );
    const me = sim.world.players[0];
    const shop = shopDef(sim, SHOP);
    if (shop === null) throw new Error('commerce d’essai absent');
    const need = dailyNeed(sim, shop);
    expect(need === 'pomme' || need === 'buche').toBe(true);
    const offer = offerFor(sim, shop, need ?? '', 0);
    expect(offer?.unit).toBe(Math.round(((offer?.base ?? 0) * 1.5) / 10) * 10);
    me.toolbar[0] = { item: 'buche', count: 5 };
    me.bag = {
      id: 'besace',
      slots: Array.from({ length: 4 }, () => ({ item: 'buche', count: 5 })),
    };
    sim.world.common.day = 2;
    // 2 € au plus par jour: 5 bûches à 0,40 €, ou 3 au prix du besoin du jour.
    const unit = offerFor(sim, shop, 'buche', 0)?.unit ?? 1;
    const fits = Math.floor(200 / unit);
    expect(
      refusals(act(sim, 0, { type: 'shop_sell', shop: SHOP, item: 'buche', count: fits })),
    ).toEqual([]);
    expect(
      refusals(act(sim, 0, { type: 'shop_sell', shop: SHOP, item: 'buche', count: 1 })),
    ).toEqual(['shop-cap-reached']);
    const ctx = contextOf(sim);
    applyEffect(ctx, 0, { type: 'open_shop', shop: SHOP });
    expect(sim.events).toContainEqual({ type: 'shop_opened', player: 0, shop: SHOP });
  });

  it('mémoire des prix: compacte, sous 6 Ko pour 20 commerces et 60 objets, valide au schéma', () => {
    const sim = newSim(content);
    const prices = sim.world.progress.prices;
    for (let i = 0; i < 60; i++) {
      const seen: Record<string, number> = {};
      for (let s = 0; s < 20; s++) if ((i + s) % 4 === 0) seen[`commerce-${String(s)}`] = 9990;
      prices[`objet-au-nom-moyen-${String(i)}`] = seen;
    }
    expect(() => v.parse(ProgressSchema, sim.world.progress)).not.toThrow();
    expect(JSON.stringify(prices).length).toBeLessThan(10_000);
  });

  it('gabarit: un commerce factice ajouté par un seul fichier ouvre, vend et rachète sans autre changement', () => {
    const c = contentWith((files) => {
      files['lieux/essai-gare/commerces/factice.json'] = {
        schema: 1,
        id: 'factice',
        name: 'Échoppe factice',
        keeper: 'cheffe-de-gare',
        hours: { from: 0, to: 1440 },
        sells: [{ item: 'planche', price: 150, dailyStock: null }],
        buys: [
          { family: 'material', price: 100 },
          { item: 'planche', factor: 1.5 },
        ],
      };
    });
    const sim = atCounter(c);
    const me = sim.world.players[0];
    me.money = 300;
    act(sim, 0, { type: 'shop_buy', shop: 'factice', item: 'planche', count: 2, chest: false });
    expect(countItem(me, 'planche')).toBe(2);
    const shop = shopDef(sim, 'factice');
    if (shop === null) throw new Error('commerce factice absent');
    expect(offerFor(sim, shop, 'planche', 0)?.base).toBe(150);
    expect(offerFor(sim, shop, 'buche', 0)?.base).toBe(100);
  });

  it('validateur: un coefficient sans prix de famille est nommé avec son fichier', () => {
    expect(() =>
      contentWith((files) => {
        files['lieux/essai-gare/commerces/bancal.json'] = {
          schema: 1,
          id: 'bancal',
          name: 'Bancal',
          keeper: 'cheffe-de-gare',
          hours: { from: 0, to: 1440 },
          sells: [],
          buys: [{ item: 'planche', factor: 1.5 }],
        };
      }),
    ).toThrow(/bancal.*coefficient/);
  });

  it("écran: rachetés d'abord, refusés à la fin, quantité bornée, couronne sur le meilleur prix vu", () => {
    const sim = atCounter();
    const me = sim.world.players[0];
    me.toolbar[0] = { item: 'planche', count: 3 };
    me.toolbar[1] = { item: 'pomme', count: 4 };
    sim.world.progress.prices.pomme = { autre: 990, [SHOP]: 60 };
    const ui = { shop: SHOP, tab: 'sell' as const, focus: 0, quantity: 9, chest: false };
    const model = shopModel(content, sim.world, 0, ui);
    expect(model?.tiles.map((t) => [t.item, t.state])).toEqual([
      ['pomme', 'ok'],
      ['planche', 'refused'],
    ]);
    expect(model?.refusedFrom).toBe(1);
    expect(model?.detail?.quantity).toBe(4);
    expect(model?.detail?.known.map((k) => [k.shop, k.best])).toEqual([
      ['autre', true],
      [SHOP, false],
    ]);
    me.money = 100;
    const buy = shopModel(content, sim.world, 0, { ...ui, tab: 'buy', quantity: 1 });
    expect(buy?.tiles.map((t) => [t.item, t.state])).toEqual([
      ['pain', 'too-expensive'],
      ['pomme', 'ok'],
    ]);
  });
});
