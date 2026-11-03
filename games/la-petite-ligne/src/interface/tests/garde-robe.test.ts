// 0.12, garde-robe et mercerie vues par l'interface (contrat `docs/jeux/jeu-1/garde-robe-0-12.md`):
// rayons dans l'ordre des onglets, vignettes (à toi, portée, trop chère, nouveautés, saison),
// essayage, garde-robe, portrait sans foulard aux couleurs du haut porté, stock et nouveautés lus
// comme la simulation. Chez les deux joueurs.
import { describe, expect, it } from 'vitest';
import { DEFAULT_WARDROBE, parseClothes } from '../../donnees/vetements';
import { clothesStock, starterWear } from '../../etat/garde-robe';
import type { CharacterId, Wear } from '../../etat/types';
import { figureSvg } from '../apercu';
import {
  type ClothesView,
  CLOTHING_SLOTS,
  catalogueOf,
  clothesShopModel,
  clothesViewOf,
  stockOfDay,
  wardrobeModel,
  wearIntents,
  withWear,
} from '../modele-garde-robe';
import { playerColors, portraitSvg } from '../portrait';
import { newSim, uiContext } from './aides';

const PLAYERS: readonly CharacterId[] = ['p1', 'p2'];

const item = (
  id: string,
  slot: string,
  nom: string,
  prix: number,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id,
  slot,
  style: id.split('_')[0],
  nom,
  modele: `wear_${slot}_${id.split('_')[0] ?? ''}`,
  couleurs: { principale: '#D4A746', secondaire: '#F3ECDA' },
  prix,
  ...extra,
});

const CLOTHES = parseClothes(
  {
    vetements: [
      item('tshirt_lin', 'top', 'T-shirt lin', 70),
      item('pull_moutarde', 'top', 'Pull moutarde', 150),
      item('mariniere_bleue', 'top', 'Marinière bleue', 130, {
        couleurs: { principale: '#F2EBDD', secondaire: '#2F3F5C', motif: '#2F3F5C' },
      }),
      item('pantalon_toile', 'bottom', 'Pantalon de toile', 140),
      item('salopette_bleue', 'bottom', 'Salopette bleue', 220, {
        couvre: ['top'],
        couleurs: { principale: '#3F5F8A', secondaire: '#E8C77A' },
      }),
      item('bottines_cuir', 'shoes', 'Bottines de cuir', 160),
      item('cire_jaune', 'outer', 'Ciré jaune', 380, { saison: 'autumn' }),
      item('gilet_sauge', 'outer', 'Gilet sauge', 240, {
        couleurs: { principale: '#8BA37B', secondaire: '#5F4B3A' },
      }),
      item('paille_naturel', 'hat', 'Chapeau de paille', 110, { saison: 'summer' }),
    ],
  },
  DEFAULT_WARDROBE,
);
const CATALOGUE = catalogueOf(CLOTHES);

const WEAR: Wear = {
  top: 'tshirt_lin',
  bottom: 'pantalon_toile',
  shoes: 'bottines_cuir',
  outer: null,
  hat: null,
};

function view(over: Partial<ClothesView> = {}): ClothesView {
  return {
    catalogue: CATALOGUE,
    wardrobe: ['tshirt_lin', 'pantalon_toile', 'bottines_cuir', 'gilet_sauge'],
    wear: WEAR,
    purse: 140,
    stock: [...CATALOGUE.keys()],
    fresh: ['mariniere_bleue'],
    season: 'summer',
    ...over,
  };
}

describe('mercerie et confection', () => {
  for (const me of PLAYERS) {
    it(`chez ${me}: cinq onglets dans l'ordre, nouveautés d'abord, prix et pastilles`, () => {
      const ctx = uiContext(me);
      const m = clothesShopModel(ctx, view(), 'top', WEAR);
      expect(m.tabs.map((t) => t.label)).toEqual([
        'Hauts',
        'Vestes',
        'Bas',
        'Chaussures',
        'Chapeaux',
      ]);
      expect(m.tabs.find((t) => t.slot === 'top')?.fresh).toBe(true);
      expect(m.cards.map((c) => [c.id, c.state, c.missing, c.fresh])).toEqual([
        ['mariniere_bleue', 'buy', 0, true],
        ['tshirt_lin', 'worn', 0, false],
        ['pull_moutarde', 'too_expensive', 10, false],
      ]);
      // Hors saison, le ciré n'est pas en vente; en été, le chapeau de paille l'est.
      expect(
        clothesShopModel(ctx, view(), 'outer', WEAR).cards.map((c) => [c.id, c.state]),
      ).toEqual([['gilet_sauge', 'owned']]);
      expect(clothesShopModel(ctx, view(), 'hat', WEAR).cards.map((c) => c.seasonal)).toEqual([
        true,
      ]);
      expect(clothesShopModel(ctx, view({ season: 'winter' }), 'hat', WEAR).cards).toEqual([]);
    });

    it(`chez ${me}: essayer change l'aperçu, pas la tenue; porter envoie une intention par emplacement`, () => {
      const ctx = uiContext(me);
      const tried = withWear(WEAR, 'top', 'pull_moutarde');
      const m = clothesShopModel(ctx, view(), 'top', tried);
      expect(m.trying).toBe(true);
      expect(m.cards.find((c) => c.id === 'pull_moutarde')?.trying).toBe(true);
      expect(m.cards.find((c) => c.id === 'tshirt_lin')?.state).toBe('worn');
      // Un haut ne se retire pas; une veste, si.
      expect(withWear(WEAR, 'top', null)).toBe(WEAR);
      const jacket = withWear(WEAR, 'outer', 'gilet_sauge');
      expect(withWear(jacket, 'outer', null).outer).toBeNull();
      expect(wearIntents(WEAR, { ...jacket, hat: 'paille_naturel' })).toEqual([
        { type: 'wear', slot: 'outer', item: 'gilet_sauge' },
        { type: 'wear', slot: 'hat', item: 'paille_naturel' },
      ]);
    });

    it(`chez ${me}: la garde-robe montre ce qu'on possède, la pièce portée en tête`, () => {
      const ctx = uiContext(me);
      const v = view({
        wardrobe: ['pull_moutarde', 'tshirt_lin', 'pantalon_toile', 'bottines_cuir', 'gilet_sauge'],
      });
      const m = wardrobeModel(ctx, v, 'top', WEAR);
      expect(m.cards.map((c) => [c.id, c.state])).toEqual([
        ['tshirt_lin', 'worn'],
        ['pull_moutarde', 'owned'],
      ]);
      expect(m.tabs.map((t) => t.count)).toEqual([2, 1, 1, 1, 0]);
      expect(m.canRemove).toBe(false);
      expect(
        wardrobeModel(ctx, { ...v, wear: { ...WEAR, outer: 'gilet_sauge' } }, 'outer', WEAR)
          .canRemove,
      ).toBe(true);
    });

    it(`chez ${me}: l'état réel donne la tenue, la garde-robe et le stock du jour de la simulation`, () => {
      const ctx = uiContext(me);
      const sim = newSim();
      const c = sim.world.characters.find((x) => x.id === me) ?? null;
      const v = clothesViewOf(ctx, sim.world, c);
      const day = sim.world.clock.day;
      expect(v?.stock).toEqual(
        clothesStock(ctx.content.clothes, ctx.content.settings, sim.world.seed, day),
      );
      expect(v?.wear).toEqual(c?.appearance.wear);
      // Le fonds permanent revient chaque semaine: il n'est jamais « nouveau ».
      const { stock, fresh } = stockOfDay(
        ctx.content.clothes,
        ctx.content.settings,
        sim.world.seed,
        day + 14,
      );
      const lastWeek = clothesStock(
        ctx.content.clothes,
        ctx.content.settings,
        sim.world.seed,
        day + 7,
      );
      expect(fresh.every((id) => stock.includes(id) && !lastWeek.includes(id))).toBe(true);
      expect(fresh.length).toBeLessThan(stock.length);
    });
  }

  it('aucun montant écrit en dur: les prix passent par le texte commun de la monnaie', () => {
    const ctx = uiContext('p1');
    const texts = JSON.stringify(ctx.texts.extra.clothes);
    expect(texts).not.toMatch(/\bsous\b|aubrin/);
    expect(ctx.texts.game.ui.shop.price).toContain('{price}');
  });
});

describe('portrait et silhouette', () => {
  for (const me of PLAYERS) {
    it(`chez ${me}: plus de foulard; le haut porté colore le portrait, le badge garde la couleur du profil`, () => {
      const salopette: Wear = { ...WEAR, bottom: 'salopette_bleue', outer: 'gilet_sauge' };
      const colors = playerColors(me, { hair: 2, scarf: '#8D6CFF', wear: salopette }, CLOTHES);
      expect(colors).toMatchObject({
        top: '#3f5f8a',
        trim: '#e8c77a',
        scarf: '',
        badge: '#8d6cff',
        outer: { main: '#8ba37b' },
      });
      const svg = portraitSvg(colors, 'good', '');
      expect(svg).not.toContain('M33 79c5 4');
      expect(svg).toContain('fill="#8ba37b"');
      const figure = figureSvg(colors, { ...salopette, hat: 'paille_naturel' }, CATALOGUE, 0);
      for (const c of ['#3f5f8a', '#8ba37b', '#d4a746']) expect(figure).toContain(c);
    });
  }

  it('chaque tenue de départ du jeu se dessine avec ses vrais vêtements', () => {
    const { clothes } = uiContext('p1').content;
    for (let i = 0; i < clothes.settings.starters.length; i++) {
      const wear = starterWear(clothes, i);
      for (const slot of CLOTHING_SLOTS)
        if (wear[slot] !== null) expect(clothes.byId[wear[slot] ?? '']).toBeDefined();
    }
  });
});
