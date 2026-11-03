// 0.12, garde-robe et mercerie vues par l'interface (contrat `docs/jeux/jeu-1/garde-robe-0-12.md`):
// rayons dans l'ordre des onglets, vignettes (à toi, portée, trop chère, nouveautés, saison),
// essayage, garde-robe, tenue de départ, portrait sans foulard aux couleurs du haut porté.
// Chez les deux joueurs.
import { describe, expect, it } from 'vitest';
import type { CharacterId } from '../../etat/types';
import { figureSvg } from '../apercu';
import {
  type ClothesView,
  type Wear,
  CLOTHING_SLOTS,
  catalogueOf,
  clothesShopModel,
  defaultStarterWear,
  starterOutfit,
  wardrobeModel,
  wearIntents,
  withWear,
  wornColors,
} from '../modele-garde-robe';
import { playerColors, portraitSvg } from '../portrait';
import { uiContext } from './aides';

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

const CATALOGUE = catalogueOf([
  item('tshirt_lin', 'top', 'T-shirt lin', 8),
  item('pull_moutarde', 'top', 'Pull moutarde', 30),
  item('mariniere_bleue', 'top', 'Marinière bleue', 24, {
    couleurs: { principale: '#F2EBDD', secondaire: '#2F3F5C', motif: '#2F3F5C' },
  }),
  item('pantalon_toile', 'bottom', 'Pantalon de toile', 10),
  item('salopette_bleue', 'bottom', 'Salopette bleue', 40, {
    couvre: ['top'],
    couleurs: { principale: '#3F5F8A', secondaire: '#E8C77A' },
  }),
  item('bottines_cuir', 'shoes', 'Bottines de cuir', 12),
  item('ciré_jaune', 'outer', 'Ciré jaune', 35, { saison: 'autumn' }),
  item('gilet_sauge', 'outer', 'Gilet sauge', 28, {
    couleurs: { principale: '#8BA37B', secondaire: '#5F4B3A' },
  }),
  item('chapeau_paille', 'hat', 'Chapeau de paille', 18, { saison: 'summer' }),
  {
    id: 'casse',
    slot: 'gants',
    nom: 'Gants',
    prix: 3,
    couleurs: { principale: '#000', secondaire: '#000' },
  },
]);

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
    purse: 25,
    stock: [...CATALOGUE.keys()],
    fresh: ['mariniere_bleue'],
    season: 'summer',
    ...over,
  };
}

describe('mercerie et confection', () => {
  it('contrôle les données: une pièce sans emplacement connu est écartée', () => {
    expect(CATALOGUE.has('casse')).toBe(false);
    expect(CATALOGUE.get('salopette_bleue')?.couvre).toEqual(['top']);
  });

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
        ['pull_moutarde', 'too_expensive', 5, false],
      ]);
      // Hors saison, le ciré n'est pas en vente; en été, le chapeau de paille l'est.
      const outer = clothesShopModel(ctx, view(), 'outer', WEAR);
      expect(outer.cards.map((c) => [c.id, c.state])).toEqual([['gilet_sauge', 'owned']]);
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
      expect(wearIntents(WEAR, { ...jacket, hat: 'chapeau_paille' })).toEqual([
        { type: 'wear', slot: 'outer', item: 'gilet_sauge' },
        { type: 'wear', slot: 'hat', item: 'chapeau_paille' },
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
  }

  it('aucun montant écrit en dur: les prix passent par le texte commun de la monnaie', () => {
    const ctx = uiContext('p1');
    const texts = JSON.stringify(ctx.texts.extra.clothes);
    expect(texts).not.toMatch(/\bsous\b/);
    expect(ctx.texts.game.ui.shop.price).toContain('{price}');
  });
});

describe('tenue de départ et portrait', () => {
  it('propose haut, bas et chaussures sans pièce de saison ni salopette, une tenue différente par joueur', () => {
    const s = starterOutfit(CATALOGUE);
    expect(s.top.map((d) => d.id)).toEqual(['tshirt_lin', 'mariniere_bleue', 'pull_moutarde']);
    expect(s.bottom.map((d) => d.id)).toEqual(['pantalon_toile']);
    expect(s.shoes.map((d) => d.id)).toEqual(['bottines_cuir']);
    expect(defaultStarterWear(s, 'p1', null)?.top).toBe('tshirt_lin');
    expect(defaultStarterWear(s, 'p2', null)?.top).toBe('mariniere_bleue');
    // La tenue déjà choisie (reprise) est gardée.
    expect(defaultStarterWear(s, 'p2', { ...WEAR, top: 'pull_moutarde' })?.top).toBe(
      'pull_moutarde',
    );
  });

  for (const me of PLAYERS) {
    it(`chez ${me}: plus de foulard; le haut porté colore le portrait, le badge garde la couleur du profil`, () => {
      const salopette = { ...WEAR, bottom: 'salopette_bleue', outer: 'gilet_sauge' };
      const clothes = wornColors(salopette, CATALOGUE);
      expect(clothes?.top.principale).toBe('#3F5F8A');
      const colors = playerColors(me, { hair: 2, scarf: '#8D6CFF' }, clothes);
      expect(colors).toMatchObject({
        top: '#3f5f8a',
        trim: '#e8c77a',
        scarf: '',
        badge: '#8d6cff',
      });
      const svg = portraitSvg(colors, 'good', '');
      expect(svg).not.toContain('M33 79c5 4');
      expect(svg).toContain('fill="#8ba37b"');
      const figure = figureSvg(colors, { ...salopette, hat: 'chapeau_paille' }, CATALOGUE, 0);
      for (const c of ['#3f5f8a', '#8ba37b', '#d4a746']) expect(figure).toContain(c);
      expect(CLOTHING_SLOTS).toHaveLength(5);
    });
  }
});
