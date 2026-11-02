// Tour 10 (lot L6), le bourg vu par l'interface: portraits à 15 coupes, 8 couleurs et barbe; prix
// du fauteuil de Solange (coupe, couleur, les deux, première coupe offerte, « Garder ma coiffure »);
// guichet du fournil (pain chaud de 6 h à 9 h, pain jusqu'à midi, brioche le dimanche, plafonds);
// chocolat chaud d'Odette. Chez les deux joueurs.
import { describe, expect, it } from 'vitest';
import type { CharacterId } from '../../etat/types';
import { PLAYER_BEARDS, PLAYER_HAIR_COLORS, PLAYER_HAIRS } from '../config';
import {
  bakeryOffers,
  chocolateModel,
  salonOptions,
  salonPrice,
  salonProposalText,
  weekdayId,
} from '../modele-salon';
import { playerColors, portraitSvg } from '../portrait';
import { NBSP, NNBSP } from '../typographie';
import { started, uiContext } from './aides';

const plain = (s: string): string =>
  s.split(NBSP).join(' ').split(NNBSP).join(' ').split('’').join("'");
const PLAYERS: readonly CharacterId[] = ['p1', 'p2'];
const HOUR = 60;

describe('portraits du tour 10', () => {
  it('15 coupes distinctes, 8 couleurs, barbe et moustache', () => {
    expect(PLAYER_HAIRS).toHaveLength(15);
    expect(PLAYER_HAIR_COLORS).toHaveLength(8);
    expect(PLAYER_BEARDS).toEqual(['none', 'short', 'full', 'moustache']);
    const base = { outfit: 0, scarf: '#5CE1E6' };
    const svgs = PLAYER_HAIRS.map((_, hair) =>
      portraitSvg(playerColors('p1', { ...base, hair }), 'good', ''),
    );
    expect(new Set(svgs).size).toBe(15);
    for (const [i, color] of PLAYER_HAIR_COLORS.entries()) {
      expect(playerColors('p2', { ...base, hair: 0, hairColor: i }).hair).toBe(color);
    }
    // Sans couleur choisie (portraits d'avant le tour 10): celle du personnage.
    expect(playerColors('p1', { ...base, hair: 0 }).hair).toBe('#6B4A33');
    const beards = PLAYER_BEARDS.map((_, beard) =>
      portraitSvg(playerColors('p1', { ...base, hair: 0, beard }), 'good', ''),
    );
    expect(new Set(beards).size).toBe(4);
  });
});

describe('fauteuil de Solange', () => {
  it('15 coupes (3 au salon seulement), 8 couleurs, 4 barbes', () => {
    const o = salonOptions(uiContext('p1'));
    expect(o.cuts).toHaveLength(15);
    expect(o.cuts.filter((c) => c.salonOnly).map((c) => c.name)).toEqual([
      'Nuage de boucles',
      'Tresse couronne',
      'Carré plongeant',
    ]);
    expect(o.colors.map((c) => c.name)).toEqual([
      'Noir',
      'Brun',
      'Châtain',
      'Auburn',
      'Roux',
      'Blond paille',
      'Gris',
      'Blanc',
    ]);
    expect(o.beards.map((c) => c.name)).toEqual([
      'Aucune',
      'Barbe courte',
      'Barbe fournie',
      'Moustache',
    ]);
  });

  it('coupe 15, couleur 10, les deux 20; offert la première fois; rien ne change: « Garder ma coiffure »', () => {
    const sim = started();
    for (const me of PLAYERS) {
      const ctx = uiContext(me);
      const cur = { hair: 0, hairColor: 1, beard: 0 };
      sim.world.purse = 100;
      expect(salonPrice(sim.world, ctx, cur, { ...cur, hair: 4 }, false).price).toBe(15);
      expect(salonPrice(sim.world, ctx, cur, { ...cur, beard: 2 }, false).price).toBe(15);
      expect(salonPrice(sim.world, ctx, cur, { ...cur, hairColor: 4 }, false).price).toBe(10);
      const both = salonPrice(sim.world, ctx, cur, { hair: 12, hairColor: 4, beard: 0 }, false);
      expect(both.price).toBe(20);
      expect(plain(both.line)).toBe('Les deux : 20 sous');
      expect(plain(both.confirm)).toBe('Valider : 20 sous');
      const free = salonPrice(sim.world, ctx, cur, { hair: 12, hairColor: 4, beard: 0 }, true);
      expect(free.price).toBe(0);
      expect(plain(free.confirm)).toBe('Valider : offert');
      const same = salonPrice(sim.world, ctx, cur, cur, false);
      expect(same.price).toBe(0);
      expect(plain(same.confirm)).toBe('Garder ma coiffure');
      sim.world.purse = 12;
      expect(salonPrice(sim.world, ctx, cur, { ...cur, hair: 4 }, false).missing).toBe(3);
      expect(plain(salonProposalText(ctx, 'Sacha', { hair: 13, hairColor: 4, beard: 0 }))).toBe(
        'Sacha te propose : Tresse couronne, roux',
      );
    }
  });
});

describe('guichet du fournil et chocolat chaud', () => {
  /** Un jour donné à une heure donnée (jour 1: samedi). */
  function at(day: number, minutes: number): ReturnType<typeof started> {
    const sim = started();
    sim.world.clock.day = day;
    sim.world.clock.minutes = minutes;
    sim.world.purse = 100;
    return sim;
  }

  it('le jour de la semaine des réglages (jour 1: samedi, jour 3: lundi)', () => {
    expect(weekdayId(1)).toBe('saturday');
    expect(weekdayId(2)).toBe('sunday');
    expect(weekdayId(3)).toBe('monday');
  });

  it('pain chaud de 6 h à 9 h, pain jusqu’à midi, brioche le dimanche, fermé le lundi, plafonds', () => {
    for (const me of PLAYERS) {
      const ctx = uiContext(me);
      // Mardi 4, 7 h: pain chaud et pain; la brioche attend dimanche.
      let offers = bakeryOffers(at(4, 7 * HOUR).world, ctx, {});
      expect(offers?.map((o) => [o.item, o.state])).toEqual([
        ['warm_bread', 'buy'],
        ['bread', 'buy'],
        ['brioche', 'closed'],
      ]);
      expect(plain(offers?.[0]?.note ?? '')).toBe("Encore 4 aujourd'hui");
      // 10 h: plus de pain chaud.
      offers = bakeryOffers(at(4, 10 * HOUR).world, ctx, {});
      expect(offers?.[0]?.state).toBe('closed');
      expect(plain(offers?.[0]?.note ?? '')).toBe('Seulement de 6 h à 9 h');
      // Dimanche 9, 8 h: la brioche.
      expect(bakeryOffers(at(9, 8 * HOUR).world, ctx, {})?.[2]?.state).toBe('buy');
      // Lundi 10: fermé.
      expect(
        bakeryOffers(at(10, 8 * HOUR).world, ctx, {})?.every((o) => o.state === 'closed'),
      ).toBe(true);
      // Quatre pains (chauds compris): plus de pain aujourd'hui.
      offers = bakeryOffers(at(4, 7 * HOUR).world, ctx, { warm_bread: 2, bread: 2 });
      expect(offers?.slice(0, 2).map((o) => o.state)).toEqual(['cap', 'cap']);
    }
  });

  it('le chocolat chaud: automne, hiver ou pluie, jusqu’à 18 h, une tasse par jour', () => {
    const ctx = uiContext('p2');
    const sim = at(50, 10 * HOUR);
    sim.world.weather = 'sunny';
    expect(chocolateModel(sim.world, ctx, 'summer', 0)?.available).toBe(false);
    sim.world.weather = 'rain';
    expect(chocolateModel(sim.world, ctx, 'summer', 0)?.available).toBe(true);
    sim.world.weather = 'sunny';
    const autumn = chocolateModel(sim.world, ctx, 'autumn', 0);
    expect(autumn?.available).toBe(true);
    expect(plain(autumn?.action ?? '')).toBe('Boire : 5 sous');
    expect(chocolateModel(sim.world, ctx, 'autumn', 1)?.done).toBe(true);
    sim.world.clock.minutes = 18 * HOUR + 30;
    expect(chocolateModel(sim.world, ctx, 'autumn', 0)?.available).toBe(false);
  });
});
