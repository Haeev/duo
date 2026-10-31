import { describe, expect, it } from 'vitest';
import {
  bagFull,
  catalogueOpen,
  catalogueProducts,
  foodEntries,
  grocerBudget,
  grocerPrice,
  indefiniteItem,
  itemDetail,
  missingText,
  proposalModels,
  recipeEntries,
  shopBuyEntries,
  shopSellEntries,
  stackEntries,
} from '../modele-panneaux';
import { character, started, uiContext } from './aides';

const plain = (s: string): string => s.replace(/[\u00a0\u202f]/g, ' ');

describe('catalogue', () => {
  it('dit ce qui est commandable, trop cher, en attente ou commandé', () => {
    const sim = started();
    const ctx = uiContext();
    sim.world.purse = 50;
    sim.world.catalogueOrders.push('oil_lamp');
    sim.world.proposals.push({ id: 'o1', by: 'p1', purchase: { source: 'catalogue', item: 'crystal_radio', count: 1 }, price: 120 });
    const byItem = Object.fromEntries(catalogueProducts(sim.world, ctx).map((p) => [p.item, p]));
    expect(byItem.oil_lamp?.state).toBe('ordered');
    expect(byItem.rug).toMatchObject({ state: 'too_expensive', missing: 10 });
    expect(byItem.curtains).toMatchObject({ state: 'orderable', available: true, big: false });
    expect(byItem.crystal_radio).toMatchObject({ state: 'waiting', big: true });
    expect(plain(byItem.curtains?.effect ?? '')).toBe('Beauté · « font fureur à la ville »');
  });

  it('se ferme le vendredi à minuit', () => {
    const sim = started();
    const ctx = uiContext();
    sim.world.clock.day = 7;
    sim.world.clock.minutes = 23 * 60;
    expect(catalogueOpen(sim.world, ctx)).toBe(true);
    sim.world.clock.day = 8;
    sim.world.clock.minutes = 7 * 60;
    expect(catalogueOpen(sim.world, ctx)).toBe(false);
    expect(catalogueProducts(sim.world, ctx).every((p) => p.state === 'closed')).toBe(true);
  });
});

describe('comptoir d’Odette', () => {
  it('vend les graines avec leur pousse, et le matelas demande l’accord de l’autre', () => {
    const sim = started();
    const ctx = uiContext();
    sim.world.purse = 200;
    const entries = Object.fromEntries(shopBuyEntries(sim.world, ctx).map((e) => [e.item, e]));
    expect(plain(entries.radish_seed?.info ?? '')).toBe('Pousse en 2 jours, 3 par case.');
    expect(entries.mattress).toMatchObject({ big: true, available: true, price: 120 });
    sim.world.purse = 100;
    expect(shopBuyEntries(sim.world, ctx).find((e) => e.item === 'mattress')).toMatchObject({ available: false, missing: 20 });
  });

  it('achète à 80 % du prix, la belle qualité une fois et demie', () => {
    const sim = started();
    const ctx = uiContext();
    const me = character(sim, 'p1');
    me.bag[4] = { item: 'radish', quality: 'ordinary', count: 9 };
    me.bag[5] = { item: 'radish', quality: 'fine', count: 2 };
    expect(grocerPrice(ctx, 'radish', 'ordinary', 9)).toBe(50);
    expect(grocerPrice(ctx, 'radish', 'fine', 1)).toBe(8);
    const sell = shopSellEntries(sim.world, ctx);
    expect(sell.map((e) => [e.item, e.quality, e.count, e.total])).toEqual([
      ['radish', 'ordinary', 9, 50],
      ['radish', 'fine', 2, 17],
    ]);
    expect(grocerBudget(sim.world, ctx)).toEqual({ buys: false, room: 300 });
  });
});

describe('établi, réchaud, coffre, sac', () => {
  it('dit ce qui manque pour fabriquer (le sac, puis le coffre)', () => {
    const sim = started();
    const ctx = uiContext();
    sim.world.unlockedRecipes.push('craft_table');
    sim.world.cellar = [{ item: 'plank', quality: 'ordinary', count: 5 }];
    const { entries, locked } = recipeEntries(sim.world, ctx, 'workbench');
    const table = entries.find((e) => e.id === 'craft_table');
    expect(table?.missing).toEqual([{ item: 'plank', count: 3 }]);
    expect(plain(missingText(ctx, table?.missing ?? []))).toBe('3 planches');
    expect(plain(table?.makes ?? '')).toBe('8 planches pour 1 table');
    expect(locked).toBe(3);
    character(sim, 'p1').bag[6] = { item: 'plank', quality: 'ordinary', count: 3 };
    expect(recipeEntries(sim.world, ctx, 'workbench').entries.find((e) => e.id === 'craft_table')?.available).toBe(true);
  });

  it('liste ce qui se mange, avec l’endurance rendue', () => {
    const sim = started();
    const ctx = uiContext();
    character(sim, 'p1').bag[3] = { item: 'bread', quality: 'ordinary', count: 1 };
    expect(foodEntries(sim.world, ctx)).toMatchObject([{ item: 'bread', count: 1, snack: 10 }]);
  });

  it('regroupe les piles et décrit un objet du sac', () => {
    const sim = started();
    const ctx = uiContext();
    expect(stackEntries(ctx, [{ item: 'egg', quality: 'ordinary', count: 2 }, null, { item: 'egg', quality: 'ordinary', count: 1 }])).toMatchObject([
      { item: 'egg', count: 3 },
    ]);
    const bread = itemDetail(ctx, { item: 'bread', quality: 'ordinary', count: 1 });
    expect(bread.actions).toEqual(['eat']);
    expect(bread.eatAmount).toBe(10);
    const fine = itemDetail(ctx, { item: 'radish', quality: 'fine', count: 9 });
    expect(plain(fine.text)).toBe('Vaut 1,5 fois le prix : 11 sous pièce à la coopérative.');
    expect(itemDetail(ctx, { item: 'riddle_card', quality: 'ordinary', count: 1 }).actions).toContain('read');
    expect(itemDetail(ctx, { item: 'table', quality: 'ordinary', count: 1 }).actions).toContain('hold');
    expect(bagFull(character(sim, 'p1'))).toBe(false);
  });

  it('écrit les propositions avec l’article (« un matelas »)', () => {
    const sim = started();
    const ctx = uiContext('p2');
    sim.world.proposals.push({ id: 'o1', by: 'p1', purchase: { source: 'grocery', item: 'mattress', count: 1 }, price: 120 });
    expect(proposalModels(sim.world, ctx)).toMatchObject([{ mine: false, itemText: 'un matelas', byName: 'Camille', price: 120 }]);
    expect(indefiniteItem(ctx, 'plank')).toBe('une planche');
  });

  it('prend l’article de objets.json quand il existe (demande 12), sinon celui de l’interface', () => {
    const ctx = uiContext();
    const mattress = ctx.content.items.mattress;
    if (mattress === undefined) throw new Error('matelas');
    const withArticle = { ...ctx, content: { ...ctx.content, items: { ...ctx.content.items, mattress: { ...mattress, indefinite: 'un matelas de laine' } } } };
    expect(indefiniteItem(withArticle, 'mattress')).toBe('un matelas de laine');
    const empty = { ...ctx, content: { ...ctx.content, items: { ...ctx.content.items, mattress: { ...mattress, indefinite: '' } } } };
    expect(indefiniteItem(empty, 'mattress')).toBe('un matelas');
  });
});
