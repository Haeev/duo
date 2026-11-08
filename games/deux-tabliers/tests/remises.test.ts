// Remises et marketing (démo v0.2, `remises-marketing-v0-2.md`, critères RM-xx): tests courts sur
// une maison neuve (graine fixe), sans service joué. RM-01 et RM-20: `recette-quinze-jours.test.ts`.
import { createRandom } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import { attraction, groupOrder, priceFactor } from '../src/clientele/attrait';
import { spawnGroup, takeOrder } from '../src/clientele/clients';
import { addLot, cents, requestPurchase, type Ctx } from '../src/clientele/economie';
import type { DiscountSettings, Group } from '../src/clientele/etat';
import { dawn, startHouse } from '../src/clientele/journee';
import {
  applyDiscountSettings,
  campaignFirstDay,
  campaignShares,
  campaignStatus,
  campaignWord,
  closeDiscounts,
  countServed,
  defaultDiscounts,
  discountedLine,
  hourlyAttraction,
  launchCampaign,
  marketingFactor,
  offerSuggestion,
  openDiscounts,
  startCampaign,
} from '../src/clientele/remises';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import { WORLD_FORMAT } from '../src/etat/monde';
import { restoreWorld } from '../src/session';
import { IDLE_INPUT } from '../src/simulation/entrees';
import type { GameEvent } from '../src/simulation/evenements';
import { createWorld } from '../src/simulation/monde';
import type { SimContext } from '../src/simulation/systemes';
import {
  discountsView,
  marketingView,
  receiptLines,
  slateDiscounts,
} from '../src/branchement/remises';

const content = loadContent(DATA_FILES);
const cc = content.clientele;

/** Maison au mardi 2, ardoise fixée, réglage de remises donné (ouvert: pris pour la journée). */
function house(patch: (d: DiscountSettings) => void = () => undefined): {
  ctx: Ctx;
  events: GameEvent[];
} {
  const world = createWorld(content, ['a', 'b']);
  const events: GameEvent[] = [];
  const sim: SimContext = {
    world,
    content,
    dt: 1 / 60,
    random: createRandom(7),
    inputs: [IDLE_INPUT, IDLE_INPUT],
    emit: (e) => events.push(e),
  };
  const ctx: Ctx = { sim, cc, s: world.clientele };
  startHouse(ctx);
  dawn(ctx, 2);
  ctx.s.slate = ['creme', 'espresso', 'noisette', 'croissant', 'tarte_fruits', 'jus_orange'].map(
    (id): [string, number] => [id, 0],
  );
  // Viennoiseries et tartes livrées ce matin (la commande habituelle suit l'ardoise d'avant).
  for (const ing of ['croissant_boulanger', 'tarte_boulanger', 'oranges'])
    if (cc.ingredients.has(ing)) addLot(ctx.s, ing, 20, 5);
  const d = defaultDiscounts(cc);
  patch(d);
  expect(applyDiscountSettings(ctx, d)).toBeNull();
  openDiscounts(ctx);
  ctx.s.phase = 'service';
  return { ctx, events };
}

/** Seconde de service d'une heure de jeu (15 h 30: 930). */
const at = (minute: number): number => (minute - cc.days.open) * cc.days.secondsPerGameMinute;

function order(
  ctx: Ctx,
  profile: string,
  items: string[],
  minute: number,
  regular?: string,
): Group {
  const g = spawnGroup(ctx, { profile, size: items.length, items, regular: regular ?? null });
  g.stage = 'register';
  g.arrivedAt = at(minute);
  ctx.s.serviceSec = at(minute) + 60;
  const r = takeOrder(ctx, null, g.id);
  if (typeof r === 'string') throw new Error(r);
  return r;
}

const happy = (d: DiscountSettings): void => {
  d.happyHour.on = true;
};

describe('Deux Tabliers, remises v0.2', () => {
  it('RM-02: heure douce 15 h-17 h à -20 %: boisson à 80 % arrondie, au prix plein à 17 h 10, mets jamais', () => {
    const { ctx } = house(happy);
    const g = order(ctx, 'voisins', ['creme', 'croissant'], 15 * 60 + 30);
    expect(g.paid).toBe(190 + 120);
    expect(g.receipt).toContainEqual(['happyHour', 50]);
    const late = order(ctx, 'voisins', ['creme'], 17 * 60 + 10);
    expect(late.paid).toBe(240);
    expect(ctx.s.today.discounts).toBe(50);
    expect(ctx.s.today.discountBy.happyHour).toBe(50);
  });

  it('RM-03: un prix remisé ne passe jamais sous le revient (croissant à -50 %: 0,70 €)', () => {
    const { ctx } = house();
    const d = defaultDiscounts(cc);
    d.dailyOffer = ['croissant', 0.5];
    const line = discountedLine(cc, ctx.s, 'croissant', null, d);
    expect(line.price).toBe(70);
    expect(line.floored).toBe(true);
    for (const r of cc.recipeList) {
      const l = discountedLine(cc, ctx.s, r.id, null, { ...d, dailyOffer: [r.id, 0.5] });
      expect(l.price, r.id).toBeGreaterThanOrEqual(Math.round(r.costMaterials * 100));
    }
  });

  it('RM-04: un promeneur pendant l’heure douce: une seule remise par ligne, la plus forte', () => {
    const { ctx } = house((d) => {
      happy(d);
      const r = d.profiles.randonneurs;
      if (r !== undefined) r.on = true;
    });
    const g = order(ctx, 'promeneurs', ['creme', 'croissant'], 15 * 60 + 30);
    // Crème: heure douce (-20 %) plutôt que tarif randonneur (-10 %); croissant: le tarif.
    expect(g.paid).toBe(190 + 100);
    expect(g.receipt).toContainEqual(['happyHour', 50]);
    expect(g.receipt).toContainEqual(['profile:randonneurs', 20]);
  });

  it('RM-05: pendant l’heure douce, l’attrait des pressés est multiplié par priceFactor à l’indice remisé', () => {
    const { ctx } = house(happy);
    const p = cc.profiles.get('presses');
    if (p === undefined) throw new Error('presses');
    const s = ctx.s;
    const a = {
      slate: s.slate,
      ambiance: s.ambiance[0],
      style: s.ambiance[1],
      coherence: s.ambiance[2],
      equipment: s.equipment,
      cups: s.cups,
      satYesterday: s.satYesterday,
      affluence: 1,
    };
    const k = hourlyAttraction(cc, s, p, a, attraction, 10);
    const normal = attraction(cc, p, a);
    expect(k[2]).toBeCloseTo(normal, 9);
    expect(k[7]).toBeCloseTo((normal * priceFactor(cc, p, 0.8)) / priceFactor(cc, p, 1), 9);
    expect(k[7] ?? 0).toBeGreaterThan(normal * 1.2);
  });

  it('RM-06: un habitué à 8 tampons a son café offert, ses tampons repartent à 0, le stock baisse', () => {
    const { ctx } = house();
    ctx.s.cash += 10_000;
    expect(requestPurchase(ctx, 0, 'cartes_fidelite')).toBeNull();
    const d = defaultDiscounts(cc);
    d.loyalty = true;
    expect(applyDiscountSettings(ctx, d)).toBeNull();
    openDiscounts(ctx);
    ctx.s.stamps.simone = 8;
    const before = ctx.s.stock.grains_maison ?? 0;
    const g = order(ctx, 'voisins', ['noisette'], 10 * 60, 'simone');
    expect(g.paid).toBe(0);
    expect(g.receipt[0]).toEqual(['freeCoffee', cents(cc.recipes.get('noisette')?.basePrice ?? 0)]);
    expect(ctx.s.stamps.simone).toBe(0);
    expect(ctx.s.stock.grains_maison ?? 0).toBeLessThan(before);
    const again = order(ctx, 'voisins', ['noisette'], 11 * 60, 'simone');
    expect(again.paid).toBeGreaterThan(0);
    expect(again.receipt).toContainEqual(['stamps', 1]);
  });

  it('RM-07: la carte de fidélité ne s’active pas sans l’achat « Cartes de fidélité »', () => {
    const { ctx } = house();
    const d = defaultDiscounts(cc);
    d.loyalty = true;
    expect(applyDiscountSettings(ctx, d)).toMatch(/catalogue/);
    expect(ctx.s.discounts?.loyalty).toBe(false);
  });

  it('RM-08: l’offre du jour se vend plus souvent, à son prix remisé, et s’efface le soir', () => {
    const { ctx } = house((d) => {
      d.dailyOffer = ['tarte_fruits', 0.3];
    });
    const p = cc.profiles.get('gourmands');
    if (p === undefined) throw new Error('gourmands');
    const menu = [...ctx.s.slate.map(([id]) => id), 'crepe']
      .map((id) => cc.recipes.get(id))
      .filter((r) => r !== undefined);
    const count = (featured: string | null): number => {
      const random = createRandom(42);
      let n = 0;
      for (let i = 0; i < 1000; i++)
        n += groupOrder(cc, random, p, 1, menu, featured).filter(
          (x) => x === 'tarte_fruits',
        ).length;
      return n;
    };
    expect(count('tarte_fruits')).toBeGreaterThan(count(null) * 1.25);
    expect(discountedLine(cc, ctx.s, 'tarte_fruits', null).price).toBe(220);
    expect(ctx.s.discounts?.dailyOffer).toBeNull();
    closeDiscounts(ctx);
    expect(discountedLine(cc, ctx.s, 'tarte_fruits', null).price).toBe(320);
  });

  it('RM-09: la tablette suggère l’offre seulement si le reste d’un lot qui finit demain dépasse les ventes', () => {
    const { ctx } = house();
    const s = ctx.s;
    s.lots.tarte_boulanger = [[6, s.day + 1]];
    s.stock.tarte_boulanger = 6;
    s.soldHistory = [{ tarte_fruits: 3 }, { tarte_fruits: 3 }, { tarte_fruits: 3 }];
    expect(offerSuggestion(cc, s)).toEqual({ recipe: 'tarte_fruits', left: 6, usual: 3 });
    s.soldHistory = [{ tarte_fruits: 7 }, { tarte_fruits: 6 }, { tarte_fruits: 8 }];
    expect(offerSuggestion(cc, s)?.recipe).not.toBe('tarte_fruits');
  });
});

describe('Deux Tabliers, marketing v0.2', () => {
  it('RM-10: une action lancée le soir est débitée le soir même, le bilan reste la somme de ses lignes', () => {
    const { ctx } = house();
    const s = ctx.s;
    s.phase = 'evening';
    s.report = {
      ...(s.report ?? ({} as never)),
      day: s.day,
      revenue: 5000,
      tips: 0,
      eventEuros: 0,
      goods: 0,
      shipping: 0,
      emergency: 0,
      rent: 1857,
      charges: 900,
      marketing: 0,
      result: 5000 - 1857 - 900,
      cash: s.cash,
    };
    const cash = s.cash;
    expect(launchCampaign(ctx, 0, 'affiche_boulangerie')).toBeNull();
    const r = s.report;
    expect(s.cash).toBe(cash - 800);
    expect(r.marketing).toBe(800);
    expect(r.result).toBe(
      r.revenue +
        r.tips +
        r.eventEuros -
        r.goods -
        r.shipping -
        r.emergency -
        r.rent -
        r.charges -
        r.marketing,
    );
    // Au-delà de 30 €, l'encart est proposé à l'autre, pas payé.
    expect(launchCampaign(ctx, 0, 'encart_echo')).toBeNull();
    expect(s.proposals).toContainEqual({ by: 0, item: 'encart_echo', price: 4500 });
    expect(s.cash).toBe(cash - 800);
  });

  it('RM-11: l’encart commandé mardi soir paraît jeudi; mercredi soir, le jeudi suivant', () => {
    const a = cc.actions.get('encart_echo');
    if (a === undefined) throw new Error('encart');
    expect(campaignFirstDay(cc, a, 2)).toBe(4);
    expect(campaignFirstDay(cc, a, 3)).toBe(11);
    expect(campaignFirstDay(cc, a, 9)).toBe(11);
    const p = cc.actions.get('prospectus_marche');
    if (p === undefined) throw new Error('prospectus');
    expect(campaignFirstDay(cc, p, 5)).toBe(6);
    expect(campaignFirstDay(cc, p, 2)).toBe(6);
  });

  it('RM-12: le facteur d’un profil suit la formule et ne dépasse jamais 1,35', () => {
    const { ctx } = house();
    const s = ctx.s;
    for (const a of cc.marketing.actions.filter((x) => x.tier === 'P0'))
      s.campaigns.push({ id: a.id, launchedDay: 1, firstDay: 2, factor: 1 });
    for (const p of cc.profileList) {
      const e = cc.marketing.actions
        .filter((x) => x.tier === 'P0')
        .reduce((sum, a) => sum + a.peak * (a.profiles[p.id] ?? 0), 0);
      const f = marketingFactor(cc, s, p.id);
      expect(f, p.id).toBeCloseTo(1 + 0.35 * (1 - Math.exp(-e / 0.35)), 9);
      expect(f).toBeLessThanOrEqual(1.35);
    }
  });

  it('RM-13: une action en cours ne se relance pas; relancée moins de 7 jours après sa fin, 60 %', () => {
    const { ctx } = house();
    const s = ctx.s;
    s.phase = 'evening';
    expect(launchCampaign(ctx, 0, 'affiche_boulangerie')).toBeNull();
    expect(campaignStatus(cc, s, 'affiche_boulangerie').kind).toBe('pending');
    expect(launchCampaign(ctx, 1, 'affiche_boulangerie')).toBe('Déjà en cours');
    s.day = 12;
    expect(campaignStatus(cc, s, 'affiche_boulangerie')).toMatchObject({
      kind: 'idle',
      tired: true,
    });
    expect(startCampaign(ctx, 'affiche_boulangerie', 0)).toBeNull();
    expect(s.campaigns.at(-1)?.factor).toBe(0.6);
    s.day = 30;
    expect(campaignStatus(cc, s, 'affiche_boulangerie')).toMatchObject({
      kind: 'idle',
      tired: false,
    });
  });

  it('RM-14 et RM-16: « Venus grâce à » est la somme des parts (F - 1) / F, sans les habitués', () => {
    const { ctx } = house();
    const s = ctx.s;
    s.campaigns.push({ id: 'affiche_boulangerie', launchedDay: 1, firstDay: 2, factor: 1 });
    s.campaigns.push({ id: 'encart_echo', launchedDay: 1, firstDay: 2, factor: 1 });
    let expected = 0;
    for (const profile of ['voisins', 'flaneurs', 'presses', 'gourmands']) {
      const g = spawnGroup(ctx, { profile, size: 1, items: ['creme'] });
      countServed(ctx, g);
      const f = marketingFactor(cc, s, profile);
      expected += (f - 1) / f;
    }
    const counted = (): number => Object.values(s.today.fromCampaigns).reduce((a, b) => a + b, 0);
    expect(counted()).toBeCloseTo(expected, 9);
    expect(s.today.fromCampaigns.affiche_boulangerie ?? 0).toBeGreaterThan(0);
    expect(s.today.fromCampaigns.encart_echo ?? 0).toBeGreaterThan(0);
    const regular = spawnGroup(ctx, {
      profile: 'voisins',
      size: 1,
      items: ['noisette'],
      regular: 'simone',
    });
    countServed(ctx, regular);
    expect(counted()).toBeCloseTo(expected, 9);
    expect(campaignShares(cc, s, 'connaisseurs').get('affiche_boulangerie')).toBeUndefined();
  });

  it('RM-15: un mot du livre d’or de l’action paraît, jamais deux fois la même action le même jour', () => {
    const { ctx } = house();
    const s = ctx.s;
    s.campaigns.push({ id: 'encart_echo', launchedDay: 1, firstDay: 2, factor: 1 });
    const words: string[] = [];
    for (let i = 0; i < 300; i++) {
      const g = spawnGroup(ctx, { profile: 'flaneurs', size: 1, items: ['creme'] });
      const w = campaignWord(ctx, g, 90);
      if (w !== null) words.push(w);
    }
    expect(words.length).toBe(1);
    expect(cc.actions.get('encart_echo')?.guestbook).toContain(words[0]);
    expect(s.today.campaignWords).toEqual(['encart_echo']);
  });

  it('RM-19: une partie v0.2 sauvegardée se reprend sans remise ni campagne', () => {
    const { ctx } = house();
    const old = JSON.parse(JSON.stringify(ctx.sim.world)) as { clientele: Record<string, unknown> };
    for (const k of [
      'discounts',
      'activeDiscounts',
      'stamps',
      'loyaltyDays',
      'soldHistory',
      'campaigns',
    ])
      old.clientele = Object.fromEntries(
        Object.entries(old.clientele).filter(([key]) => key !== k),
      );
    const today = Object.fromEntries(
      Object.entries(old.clientele.today as Record<string, unknown>).filter(
        ([key]) =>
          ![
            'discounts',
            'discountBy',
            'discountOrders',
            'marketing',
            'fromCampaigns',
            'fromWord',
            'campaignWords',
            'sold',
          ].includes(key),
      ),
    );
    old.clientele.today = today;
    const back = restoreWorld(old, WORLD_FORMAT, ['a', 'b']);
    expect(back).not.toBeNull();
    expect(back?.clientele.campaigns).toEqual([]);
    expect(back?.clientele.discounts).toBeNull();
    expect(back?.clientele.today.marketing).toBe(0);
  });
});

describe('Deux Tabliers, lecteurs des remises et du marketing', () => {
  it('RM-07, RM-13, RM-17 et RM-18: onglets, ardoise et ticket lus du monde', () => {
    const { ctx } = house(happy);
    const s = ctx.s;
    // RM-07: sans les cartes, l'interrupteur est grisé et l'onglet dit quoi acheter.
    expect(discountsView(cc, s).loyalty).toMatchObject({ owned: false });
    expect(discountsView(cc, s).loyalty.need).toMatch(/catalogue \(15/);
    expect(discountsView(cc, s).profileRates.find((r) => r.id === 'etudiants')?.absent).toMatch(
      /Mérelles/,
    );
    // RM-17: à 15 h 30, l'ardoise annonce l'heure douce et barre le prix des boissons.
    s.serviceSec = at(15 * 60 + 30);
    const slate = slateDiscounts(cc, s);
    expect(slate.lines).toContain('Heure douce 15\u00a0h-17\u00a0h : boissons -20 %');
    expect(slate.now).not.toBeNull();
    expect(slate.discounted('creme')).toBe(190);
    expect(slate.discounted('croissant')).toBeNull();
    // RM-18: le ticket nomme chaque remise et son montant.
    const g = order(ctx, 'voisins', ['creme'], 15 * 60 + 30);
    expect(receiptLines(cc, g)).toEqual(['Heure douce : -0,50\u00a0€']);
    // RM-13: une action en cours n'a plus de bouton « Lancer »; l'encart attend l'autre.
    s.phase = 'evening';
    expect(launchCampaign(ctx, 0, 'affiche_boulangerie')).toBeNull();
    expect(launchCampaign(ctx, 0, 'encart_echo')).toBeNull();
    const m = marketingView(cc, s, 0);
    expect(m.actions.find((a) => a.id === 'affiche_boulangerie')?.state.kind).toBe('pending');
    expect(m.actions.find((a) => a.id === 'encart_echo')?.state.kind).toBe('pending-mine');
    expect(marketingView(cc, s, 1).actions.find((a) => a.id === 'encart_echo')?.state.kind).toBe(
      'pending-theirs',
    );
    expect(m.actions.find((a) => a.id === 'affiche_mairie')?.state).toMatchObject({
      kind: 'launch',
      propose: false,
    });
  });
});
