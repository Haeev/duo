/**
 * Interface imagée du patch 0.12.2 (`docs/jeux/jeu-1/interface-imagee-0-12-2.md`), modèles testés
 * dans Node: la collection des robes en noms français (R08: plus d'identifiant brut), la réserve de
 * grain en jours, les ingrédients en « possédés / requis », les pastilles d'un objet, les fiches des
 * poissons en icônes (saisons, moments, coins).
 */
import { describe, expect, it } from 'vitest';
import { farmBoard, farmModel } from '../modele-elevage';
import { firstSentence, fishBoard, itemFacts, recipeCards } from '../modele-vitrine';
import { character, started, uiContext } from './aides';

const plain = (s: string): string => s.replace(/[\u00a0\u202f]/g, ' ');

describe('basse-cour en icônes', () => {
  it('nomme les six robes en français, jamais par leur identifiant (R08)', () => {
    const sim = started();
    const ctx = uiContext();
    const m = farmModel(sim.world, ctx);
    const labels = m.collection.colors.map((c) => c.label);
    expect(labels).toEqual(['Blanche', 'Rousse', 'Noire', 'Dorée', 'Cendrée', 'Coucou']);
    expect(labels.join(' ')).not.toMatch(/hen_/);
    expect(farmBoard(sim.world, ctx).collection.robes.map((r) => r.name)).toEqual(labels);
  });

  it('dit la réserve de grain en jours, nourries ou pas, et la mangeoire à trémie', () => {
    const sim = started();
    const ctx = uiContext();
    const care = ctx.content.settings.hens.care;
    if (care === null) throw new Error('soins des poules absents');
    sim.world.clock.day = care.grain.fromDay + 1;
    const at = { x: 10, y: 10 };
    sim.world.hens = ['hen_white', 'hen_red', 'hen_black'].map((variant, i) => ({ id: `h${String(i)}`, name: `Poule ${String(i)}`, variant, pos: at, prev: at, facing: 0, wander: at, nameKnownBy: [], namedBy: null, happiness: 60 }));
    sim.world.breeding.grainRations = 28;
    sim.world.feederFilled = false;
    const hens = sim.world.hens.length;
    const board = farmBoard(sim.world, ctx);
    expect(board.grain).toMatchObject({ free: false, rations: 28, days: Math.floor(28 / hens), hopper: false });
    expect(board.fed).toBe(false);
    expect(plain(board.grain?.label ?? '')).toContain(`${String(Math.floor(28 / hens))} jours de réserve`);
    sim.world.catalogueBought[care.grain.hopper] = 1;
    sim.world.feederFilled = true;
    expect(farmBoard(sim.world, ctx)).toMatchObject({ fed: true, grain: { hopper: true } });
  });

  it('montre les conditions de la couvée, barrées tant qu’elles manquent', () => {
    const sim = started();
    const ctx = uiContext();
    const needs = farmBoard(sim.world, ctx).brood.needs;
    expect(needs.map((n) => n.key)).toEqual(['rooster', 'eggs', 'happy', 'place']);
    expect(needs.find((n) => n.key === 'rooster')).toMatchObject({ have: 0, need: 1 });
    expect(needs.find((n) => n.key === 'eggs')).toMatchObject({ need: 3 });
  });
});

describe('recettes en icônes', () => {
  it('compte les ingrédients « possédés / requis », sac et coffre ensemble', () => {
    const sim = started();
    const ctx = uiContext();
    const me = character(sim, 'p1');
    me.bag = me.bag.map(() => null);
    me.bag[0] = { item: 'egg', quality: 'ordinary', count: 2 };
    sim.world.cellar = [{ item: 'egg', quality: 'ordinary', count: 2 }];
    const { cards } = recipeCards(sim.world, ctx, 'stove');
    const omelette = cards.find((c) => c.id === 'cook_omelette');
    expect(omelette).toMatchObject({ ready: true, output: { item: 'omelette', count: 2 } });
    expect(omelette?.inputs).toMatchObject([{ item: 'egg', have: 4, need: 3 }]);
    const jam = cards.find((c) => c.id === 'cook_blackberry_jam');
    expect(jam?.ready).toBe(false);
    expect(jam?.missingKinds).toBe(3);
    expect(jam?.inputs.map((i) => [i.item, i.have, i.need])).toEqual([
      ['blackberry', 0, 8],
      ['sugar', 0, 1],
      ['jar', 0, 2],
    ]);
  });

  it('donne à un objet des pastilles plutôt qu’une phrase', () => {
    const ctx = uiContext();
    const seed = itemFacts(ctx, 'radish_seed').map((f) => plain(f.label));
    expect(seed).toEqual(['Pousse en 2 jours', '3 par case']);
    const sugar = itemFacts(ctx, 'sugar').map((f) => plain(f.label));
    expect(sugar[0]).toMatch(/^Sert à fabriquer : /);
  });
});

describe('carnet des poissons en icônes', () => {
  it('liste tous les poissons par rareté, silhouette et indice avant la prise', () => {
    const sim = started();
    const ctx = uiContext();
    sim.world.fishing.log.gudgeon = { count: 3, first: { day: 2, by: 'p1', zone: 'ford', together: false }, record: { cm: 12, by: 'p2', day: 3 } };
    const board = fishBoard(sim.world, ctx);
    expect(board.total).toBe(22);
    expect(board.caught).toBe(1);
    expect(board.cards[0]?.rarity).toBe('common');
    expect(board.cards.at(-1)?.rarity).toBe('mythic');
    const gudgeon = board.cards.find((c) => c.id === 'gudgeon');
    expect(gudgeon).toMatchObject({ name: 'Goujon', caught: true, price: 2, count: 3, record: { cm: 12, by: 'other', name: 'Sacha' } });
    expect(gudgeon?.seasons.every((s) => s.on)).toBe(true);
    expect(gudgeon?.moments.map((m) => m.on)).toEqual([true, true, true, true]);
    expect(gudgeon?.zones.filter((z) => z.on).map((z) => z.id).sort()).toEqual(['confluence', 'downstream', 'ford', 'sands', 'upstream']);
    const tench = board.cards.find((c) => c.id === 'tench');
    expect(tench).toMatchObject({ caught: false, name: 'Pas encore pris', count: 0, record: null });
    expect(tench?.moments.map((m) => m.on)).toEqual([true, false, true, true]);
  });

  it('garde une seule phrase de la description', () => {
    expect(firstSentence('Petit, moustachu, toujours au fond sur les galets: le premier poisson.')).toBe('Petit, moustachu, toujours au fond sur les galets.');
    expect(firstSentence('Grand comme un doigt. Au printemps, son ventre rougit.')).toBe('Grand comme un doigt.');
  });
});
