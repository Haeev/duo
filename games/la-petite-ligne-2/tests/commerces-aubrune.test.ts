// Commerces d'Aubrune et maison du garde (docs/jeux/jeu-1/refonte/economie-aubrune.md): chaque
// commerce s'ouvre, vend chaque article et rachète chaque objet de sa liste; aucune boucle
// d'argent (acheter puis revendre, cuisiner puis revendre, fabriquer puis revendre), au pire des
// bonus (besoin du jour, amitié, repas); la maison se paie aux prix du cahier.
import { describe, expect, it } from 'vitest';
import type { Content, PlaceContent } from '../src/donnees/charger';
import type { ShopDef } from '../src/donnees/schemas/commerce';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { nearShop } from '../src/simulation/commerces';
import { basePrice, isOpen, offerFor } from '../src/simulation/commerces/prix';
import { SHOP_TUNING } from '../src/simulation/commerces/reglages';
import type { Sim } from '../src/simulation/noyau/pas';
import { applyEffect } from '../src/simulation/regles/effets';
import { remember } from '../src/simulation/regles/memoire';
import { RULES } from '../src/simulation/regles/reglages';
import { addItem, countItem } from '../src/simulation/sac/inventaire';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { visit, visitObject } from './aides-visite';
import { newSim } from './aides';

type Json = Record<string, unknown>;

const AUBRUNE = 'aubrune';
const HOUSE = 'maison-du-garde';
/** Commerces livrés, et le meuble comptoir de ceux qui en ont un dans leur boutique. */
const SHOPS: Readonly<Record<string, string | null>> = {
  'epicerie-ferrand': 'comptoir-epicerie',
  'fournil-pradel': 'comptoir-fournil',
  'cafe-de-la-halte': 'comptoir-cafe',
  'mercerie-merigot': 'comptoir-mercerie',
  'forge-cazals': 'ratelier-de-la-forge',
  'menuiserie-cornu': null,
  'cour-des-delmas': null,
};
/** Faits d'histoire qui font venir les commerçants et ouvrent les articles verrouillés. */
const STORY: readonly (readonly [string, string | boolean])[] = [
  ['aubrune.acte1.besaces', 'fait'],
  ['aubrune.acte2.train', true],
  ['aubrune.maison.rechaud', true],
  ['aubrune.acte3.train2', true],
  ['aubrune.acte3.repas', 'ouvert'],
  ['aubrune.verrou.v3', true],
];

const content: Content = contentWith((files) => {
  const settings = files['commun/reglages.json'] as { start: Json };
  settings.start = { ...settings.start, place: AUBRUNE, minute: 600 };
});

function aubrune(): PlaceContent {
  const place = content.places[AUBRUNE];
  if (place === undefined) throw new Error('Aubrune absent');
  return place;
}

function refusals(events: Sim['events']): string[] {
  return events.flatMap((e) => (e.type === 'refused' ? [`${e.reason} (${String(e.target)})`] : []));
}

/** Une partie à Aubrune à 10 h, l'histoire assez avancée pour que tout le monde soit là. */
function lateGame(): Sim {
  const sim = newSim(content);
  wait(sim, 0.2);
  for (const [key, value] of STORY) remember(contextOf(sim), key, value, 'duo');
  wait(sim, 1);
  sim.world.minutes = 600;
  return sim;
}

/** Pose le joueur devant le comptoir du commerce, ou à côté du commerçant s'il vend dehors. */
function goTo(sim: Sim, player: PlayerIndex, shop: ShopDef): void {
  const counter = SHOPS[shop.id];
  if (counter === null || counter === undefined) {
    const keeper = sim.world.places[AUBRUNE]?.villagers[shop.keeper];
    if (keeper === undefined) throw new Error(`commerçant ${shop.keeper} absent`);
    visit(sim, player, shop.keeper);
    return;
  }
  const prop = aubrune().map.objects.find((o) => o.type === counter);
  if (prop === undefined) throw new Error(`comptoir ${counter} absent de la carte`);
  // Comme un joueur: par la porte de la boutique, puis devant le comptoir, qui est sa cible.
  visitObject(sim, player, prop.id);
}

function emptyPockets(sim: Sim, player: PlayerIndex): void {
  const state = sim.world.players[player];
  state.toolbar = state.toolbar.map(() => null);
  state.selected = null;
}

/** Le plus qu'un commerçant puisse payer une unité: besoin du jour, amitié au plus haut, repas. */
function bestResale(item: string): number {
  let best = 0;
  for (const shop of Object.values(aubrune().shops)) {
    const base = basePrice(content, shop, item);
    if (base === null) continue;
    const needs =
      shop.dailyNeeds ?? shop.buys.flatMap((line) => ('item' in line ? [line.item] : []));
    const need = needs.includes(item) ? SHOP_TUNING.dailyNeedFactor : 1;
    const friend = Math.max(1, ...(shop.friendship ?? []).map((tier) => tier.factor));
    const cents = base * need * friend * RULES.needs.betterPrices;
    const step = SHOP_TUNING.priceStep;
    best = Math.max(best, Math.max(step, Math.round(cents / step) * step));
  }
  return best;
}

/** Le moins cher où l'objet s'achète, ou `null` s'il ne s'achète nulle part (récolte, pêche). */
function cheapest(item: string): number | null {
  let best: number | null = null;
  for (const shop of Object.values(aubrune().shops))
    for (const line of shop.sells)
      if (line.item === item) best = best === null ? line.price : Math.min(best, line.price);
  return best;
}

/** Coût d'achat d'une liste d'objets, ou `null` si l'un d'eux ne s'achète pas. */
function purchaseCost(parts: readonly { item: string; count: number }[]): number | null {
  let total = 0;
  for (const part of parts) {
    const unit = cheapest(part.item);
    if (unit === null) return null;
    total += unit * part.count;
  }
  return total;
}

describe('commerces d’Aubrune', () => {
  it('les sept commerces sont là, chacun tenu sur une ligne de planning à ses heures', () => {
    const place = aubrune();
    expect(Object.keys(place.shops).sort()).toEqual(Object.keys(SHOPS).sort());
    for (const shop of Object.values(place.shops)) {
      const keeper = place.villagers.find((v) => v.id === shop.keeper);
      const line = keeper?.life?.schedule.find((entry) => entry.shop === shop.id);
      expect(line, shop.id).toBeDefined();
      // Ouvert exactement quand le commerçant est à son poste.
      expect({ from: line?.from, to: line?.to }, shop.id).toEqual(shop.hours);
      expect(shop.sells.length, shop.id).toBeGreaterThan(0);
      expect(shop.buys.length, shop.id).toBeGreaterThan(0);
      expect(shop.refusal, shop.id).toBeDefined();
      expect(shop.talk, shop.id).toBeDefined();
    }
  });

  it('chaque commerce s’ouvre, vend chaque article et rachète chaque objet de sa liste', () => {
    const sim = lateGame();
    const me = sim.world.players[0];
    let sold = 0;
    let bought = 0;
    for (const shop of Object.values(aubrune().shops)) {
      goTo(sim, 0, shop);
      expect(nearShop(sim.content, sim.world, shop, 0), `à portée de ${shop.id}`).toBe(true);
      expect(isOpen(shop, sim.world.minutes), shop.id).toBe(true);
      applyEffect(contextOf(sim), 0, { type: 'open_shop', shop: shop.id });
      expect(sim.events, shop.id).toContainEqual({ type: 'shop_opened', player: 0, shop: shop.id });

      for (const line of shop.sells) {
        emptyPockets(sim, 0);
        me.money = 100_000;
        const events = act(sim, 0, {
          type: 'shop_buy',
          shop: shop.id,
          item: line.item,
          count: 1,
          chest: false,
        });
        expect(refusals(events), `${shop.id} vend ${line.item}`).toEqual([]);
        expect(me.money, `${shop.id} vend ${line.item}`).toBe(100_000 - line.price);
        expect(countItem(me, line.item)).toBe(1);
        bought += 1;
      }

      for (const line of shop.buys) {
        if (!('item' in line)) throw new Error(`${shop.id}: rachat par famille, hors du contrôle`);
        emptyPockets(sim, 0);
        addItem(sim.content, me, line.item, 1);
        me.money = 0;
        // Un jour neuf par vente: le plafond du jour ne masque aucune ligne.
        sim.world.common.day += 1;
        const unit = offerFor(sim, shop, line.item, 0)?.unit;
        const events = act(sim, 0, { type: 'shop_sell', shop: shop.id, item: line.item, count: 1 });
        expect(refusals(events), `${shop.id} rachète ${line.item}`).toEqual([]);
        expect(me.money, `${shop.id} rachète ${line.item}`).toBe(unit);
        sold += 1;
      }

      // Fermé la nuit, et ce qui n'est pas de son métier est refusé.
      emptyPockets(sim, 0);
      addItem(sim.content, me, 'billet-poinconne', 1);
      expect(
        refusals(
          act(sim, 0, { type: 'shop_sell', shop: shop.id, item: 'billet-poinconne', count: 1 }),
        ),
      ).toEqual([`not-wanted (${shop.id})`]);
      sim.world.minutes = 180;
      expect(
        refusals(
          act(sim, 0, { type: 'shop_sell', shop: shop.id, item: 'billet-poinconne', count: 1 }),
        ),
      ).toEqual([`shop-closed (${shop.id})`]);
      sim.world.minutes = 600;
    }
    expect(bought).toBeGreaterThanOrEqual(20);
    expect(sold).toBeGreaterThanOrEqual(40);
  });

  it('pas assez d’argent, article verrouillé par l’histoire, plafond du jour', () => {
    const sim = newSim(content);
    wait(sim, 0.2);
    const place = aubrune();
    const odette = place.shops['epicerie-ferrand'];
    const basile = place.shops['menuiserie-cornu'];
    if (odette === undefined || basile === undefined) throw new Error('commerces absents');
    const me = sim.world.players[0];
    goTo(sim, 0, odette);
    me.money = 50;
    const buy = (item: string): string[] =>
      refusals(act(sim, 0, { type: 'shop_buy', shop: odette.id, item, count: 1, chest: false }));
    expect(buy('pomme')).toEqual([`not-enough-money (${odette.id})`]);
    me.money = 10_000;
    // Le bœuf n'arrive en rayon qu'avec le repas de l'acte 3.
    expect(buy('boeuf')).toEqual([`locked (${odette.id})`]);
    remember(contextOf(sim), 'aubrune.acte3.repas', 'ouvert', 'duo');
    expect(buy('boeuf')).toEqual([]);

    // Basile ne dépense pas plus que son plafond du jour en bûches.
    goTo(sim, 0, basile);
    emptyPockets(sim, 0);
    me.toolbar = me.toolbar.map(() => ({ item: 'buche', count: 5 }));
    me.money = 0;
    const cap = basile.dailyBuyCap ?? 0;
    for (let i = 0; i < 25; i++)
      act(sim, 0, { type: 'shop_sell', shop: basile.id, item: 'buche', count: 1 });
    expect(me.money).toBeGreaterThan(0);
    expect(me.money).toBeLessThanOrEqual(cap);
    expect(
      refusals(act(sim, 0, { type: 'shop_sell', shop: basile.id, item: 'buche', count: 1 })),
    ).toEqual([`shop-cap-reached (${basile.id})`]);
  });
});

describe('économie d’Aubrune: aucune boucle d’argent', () => {
  const shops = Object.values(aubrune().shops);

  it('les prix restent lisibles: objets précis seulement, besoins du jour jamais en rayon', () => {
    for (const shop of shops) {
      for (const line of shop.buys)
        expect('item' in line, `${shop.id}: rachat par famille`).toBe(true);
      expect(shop.dailyNeeds, shop.id).toBeDefined();
      for (const need of shop.dailyNeeds ?? [])
        expect(
          cheapest(need),
          `${shop.id}: besoin du jour « ${need} » en vente ailleurs`,
        ).toBeNull();
    }
  });

  it('acheter puis revendre ne rapporte jamais, même au besoin du jour, entre amis et après un repas', () => {
    let checked = 0;
    for (const item of Object.keys(content.items)) {
      const price = cheapest(item);
      if (price === null) continue;
      expect(bestResale(item), `${item}: revente au-dessus du prix d'achat`).toBeLessThanOrEqual(
        price,
      );
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(15);
  });

  it('cuisiner puis revendre: toutes les recettes, au meilleur résultat', () => {
    const recipes = Object.values(content.recipes);
    expect(recipes.length).toBeGreaterThanOrEqual(8);
    for (const recipe of recipes) {
      const inputs = [...recipe.inputs, ...(recipe.second?.inputs ?? [])];
      const outcomes = [recipe.output, recipe.quality?.good, recipe.quality?.perfect].flatMap(
        (o) => (o === undefined ? [] : [o]),
      );
      const revenue = Math.max(...outcomes.map((o) => bestResale(o.item) * o.count));
      const cost = purchaseCost(inputs);
      // Un ingrédient qui ne s'achète nulle part (œuf, poisson) borne la recette par la récolte.
      if (cost === null) continue;
      expect(
        revenue,
        `${recipe.id}: ${String(revenue)} pour ${String(cost)} d'achats`,
      ).toBeLessThanOrEqual(cost);
    }
  });

  it('fabriquer puis revendre: tous les plans', () => {
    const plans = Object.values(content.plans);
    expect(plans.length).toBeGreaterThanOrEqual(10);
    for (const plan of plans) {
      const made =
        plan.makes.kind === 'item'
          ? [{ item: plan.makes.item, count: plan.makes.count }]
          : plan.makes.kind === 'furniture'
            ? plan.makes.variants.map((variant) => ({ item: variant.item, count: 1 }))
            : [];
      let cost = purchaseCost(plan.materials);
      if (plan.makes.kind === 'upgrade') {
        const upgrade = content.items[plan.makes.from]?.tool?.work?.upgrade;
        if (upgrade === undefined || upgrade === null) throw new Error(`${plan.id}: amélioration`);
        made.push({ item: upgrade.to, count: 1 });
        const items = purchaseCost(upgrade.cost.items);
        cost = items === null ? null : upgrade.cost.cents + items;
      }
      const revenue = Math.max(0, ...made.map((m) => bestResale(m.item) * m.count));
      if (cost === null) {
        // Un matériau de récolte (pierre, bûche): l'objet fabriqué ne doit pas valoir un rachat.
        expect(revenue, `${plan.id}: objet fabriqué racheté`).toBe(0);
        continue;
      }
      expect(revenue, plan.id).toBeLessThanOrEqual(cost);
    }
  });

  it('rien de gratuit ne se revend: étals du décor, achats faits en dialogue', () => {
    const place = aubrune();
    // Un meuble de la carte qui donne un objet sans fin (prêt d'outils) n'alimente aucun rachat.
    for (const object of place.map.objects)
      for (const brick of content.props[object.type]?.bricks ?? [])
        if (brick.brick === 'gather' && brick.stock === null)
          expect(bestResale(brick.gives.item), `${object.id} donne ${brick.gives.item}`).toBe(0);
    // Un dialogue qui vend un objet ne le vend pas moins cher que sa meilleure revente.
    let offers = 0;
    for (const dialogue of place.dialogues)
      for (const node of Object.values(dialogue.nodes)) {
        const effects =
          node.kind === 'effects'
            ? node.effects
            : node.kind === 'choice'
              ? node.options.flatMap((o) => o.effects)
              : [];
        const paid = effects.reduce((sum, e) => sum + (e.type === 'take_money' ? e.amount : 0), 0);
        if (paid === 0) continue;
        const given = effects.reduce(
          (sum, e) => sum + (e.type === 'give_item' ? bestResale(e.item) * e.count : 0),
          0,
        );
        expect(given, `${dialogue.id}: vendu sous le prix de revente`).toBeLessThanOrEqual(paid);
        offers += 1;
      }
    expect(offers).toBeGreaterThanOrEqual(7);
  });
});

describe('maison du garde-barrière', () => {
  const def = aubrune().housings[HOUSE];

  it('les quatre achats du cahier: 150, 300, 450 et 800 €, dans l’ordre de la maison', () => {
    if (def === undefined) throw new Error('logement absent');
    const cost = (room: string): number =>
      (def.rooms.find((r) => r.id === room)?.stages ?? []).reduce((sum, s) => sum + s.cost, 0);
    expect(cost('cuisine')).toBe(15_000);
    expect(cost('chambre')).toBe(30_000);
    expect(cost('troisieme-piece')).toBe(45_000);
    expect(cost('etage')).toBe(80_000);
    // La salle et la cave viennent de l'histoire: du travail, pas d'argent.
    expect(cost('salle') + cost('cave')).toBe(0);
    // Chaque matériau demandé se trouve à Aubrune: récolte, ou rayon d'un commerce.
    const harvested = new Set(['buche', 'pierre']);
    for (const room of def.rooms)
      for (const stage of room.stages)
        for (const m of stage.materials)
          expect(harvested.has(m.item) || cheapest(m.item) !== null, `${room.id}: ${m.item}`).toBe(
            true,
          );
  });

  it('la cuisine attend l’histoire, puis se paie au coffre commun et se monte à deux', () => {
    const sim = newSim(content);
    wait(sim, 0.2);
    const state = (): NonNullable<
      NonNullable<Sim['world']['places'][string]>['housing']
    >[string] => {
      const housing = sim.world.places[AUBRUNE]?.housing?.[HOUSE];
      if (housing === undefined) throw new Error('logement sans état');
      return housing;
    };
    const [a, b] = sim.world.players;
    // Dans la salle, à deux pas du coin cuisine (annexe de la carte: intérieur du rez-de-chaussée).
    a.body = { x: 22, y: 213.5, facing: 0, speed: 0 };
    b.body = { x: 23, y: 213.5, facing: 0, speed: 0 };
    const work = (player: PlayerIndex, room: string): string[] =>
      refusals(act(sim, player, { type: 'housing_work', housing: HOUSE, room, on: true }));

    // Avant le toit de l'acte 1, rien ne commence.
    expect(work(0, 'salle')).toEqual(['room-story-not-yet (salle)']);
    remember(contextOf(sim), 'aubrune.maison.premiere-piece', true, 'duo');
    expect(work(0, 'salle')).toEqual([]);
    expect(work(1, 'salle')).toEqual([]);
    wait(sim, 8 / 2.5 + 0.2);
    expect(state().rooms.salle?.state).toBe('restored');

    // La cuisine: l'histoire d'abord (acte 2), puis planches, pierres, 150 € et le travail.
    expect(work(0, 'cuisine')).toEqual(['room-story-not-yet (cuisine)']);
    remember(contextOf(sim), 'aubrune.maison.cuisine', true, 'duo');
    emptyPockets(sim, 0);
    emptyPockets(sim, 1);
    addItem(sim.content, a, 'planche', 4);
    addItem(sim.content, b, 'pierre', 4);
    act(sim, 0, { type: 'housing_supply', housing: HOUSE, room: 'cuisine' });
    act(sim, 1, { type: 'housing_supply', housing: HOUSE, room: 'cuisine' });
    expect(state().rooms.cuisine?.delivered).toEqual({ planche: 4, pierre: 4 });
    sim.world.common.chest = 12_000;
    a.money = 2_000;
    expect(refusals(act(sim, 0, { type: 'housing_pay', housing: HOUSE, room: 'cuisine' }))).toEqual(
      ['not-enough-money (cuisine)'],
    );
    a.money = 3_500;
    act(sim, 0, { type: 'housing_pay', housing: HOUSE, room: 'cuisine' });
    expect(sim.world.common.chest).toBe(0);
    expect(a.money).toBe(500);
    expect(work(0, 'cuisine')).toEqual([]);
    expect(work(1, 'cuisine')).toEqual([]);
    wait(sim, 20 / 2.5 + 0.2);
    expect(state().rooms.cuisine?.state).toBe('restored');
    expect(sim.world.progress.memory[`aubrune.${HOUSE}.cuisine`]?.v).toBe('restored');
    // L'étage attend la troisième pièce, qui attend la chambre.
    expect(work(0, 'etage')).toEqual(['room-needs-other (etage)']);
  });
});
