import { describe, expect, it } from 'vitest';
import soundsFile from '../../assets/son/sons.json';
import { type AmbienceInput, ambienceLevels, inHours, riverSources } from './ambiances';
import { parseCatalogue } from './catalogue';
import { AUDIO_SETTINGS, dbToGain } from './reglages';

const catalogue = parseCatalogue(soundsFile);
const ZONES = { village: { x: 31, y: 23, w: 18, h: 11 }, wind: { x: 15, y: 3, w: 25, h: 8 } };
const H = 60;

function levels(over: Partial<AmbienceInput>): Map<string, number> {
  const input: AmbienceInput = {
    minutes: 9 * H,
    weather: 'sunny',
    season: 'spring',
    mist: 0,
    inHouse: false,
    at: { x: 38, y: 28 },
    ...over,
  };
  return ambienceLevels(catalogue.ambienceRules, input, ZONES, AUDIO_SETTINGS.ambience, new Map(), catalogue.morningMist);
}

describe('ambiances par heure, météo et lieu', () => {
  it('le matin: oiseaux, bourg, vent (-3 dB), rivière', () => {
    const l = levels({ minutes: 9 * H });
    expect(l.get('birds-morning')).toBeCloseTo(1);
    expect(l.get('village')).toBeCloseTo(1);
    expect(l.get('wind')).toBeLessThan(dbToGain(-3) + 1e-6);
    expect(l.get('river')).toBeCloseTo(1);
    expect(l.get('crickets')).toBe(0);
    expect(l.get('rain')).toBe(0);
  });

  it('l après-midi, les oiseaux se font plus rares (-6 dB); le soir, les grillons', () => {
    expect(levels({ minutes: 14 * H }).get('birds-morning')).toBeCloseTo(dbToGain(-6));
    const evening = levels({ minutes: 20 * H });
    expect(evening.get('birds-morning')).toBe(0);
    expect(evening.get('village')).toBe(0);
    expect(evening.get('crickets')).toBeCloseTo(1);
    // Après minuit, toujours la nuit (heures au-delà de 24).
    expect(levels({ minutes: 23 * H + 50 }).get('crickets')).toBeCloseTo(1);
  });

  it('jour 4: la pluie dehors, sur le toit dans la maisonnette, et les oiseaux se taisent', () => {
    const out = levels({ weather: 'rain' });
    expect(out.get('rain')).toBeCloseTo(1);
    expect(out.get('rain-roof')).toBe(0);
    expect(out.get('birds-morning')).toBe(0);
    const inside = levels({ weather: 'rain', inHouse: true, at: { x: 8, y: 24 } });
    expect(inside.get('rain')).toBe(0);
    expect(inside.get('rain-roof')).toBeCloseTo(1);
  });

  it('le bourg plus présent sur la place, plus loin à la maisonnette', () => {
    const square = levels({ at: { x: 38, y: 28 } }).get('village') ?? 0;
    const house = levels({ at: { x: 8, y: 27 } }).get('village') ?? 0;
    expect(square).toBeGreaterThan(house);
    expect(house).toBeGreaterThanOrEqual(dbToGain(AUDIO_SETTINGS.ambience.village.farDb) - 1e-6);
  });

  it('compte les heures au-delà de minuit', () => {
    expect(inHours(2, 19, 30)).toBe(true);
    expect(inHours(7, 19, 30)).toBe(false);
    expect(inHours(12, 6, 12)).toBe(false);
  });

  it('place les sources de la rivière tous les 15 m, la plus forte au gué', () => {
    const map = {
      zones: { river: { x: 0, y: 37, w: 64, h: 7 } },
      points: { river_ford: { x: 18.5, y: 40.5 } },
    } as unknown as Parameters<typeof riverSources>[0];
    const sources = riverSources(map, AUDIO_SETTINGS.ambience.river);
    expect(sources.map((s) => s.at.x)).toEqual([3.5, 18.5, 33.5, 48.5, 63.5]);
    expect(sources.find((s) => s.at.x === 18.5)?.gainDb).toBe(AUDIO_SETTINGS.ambience.river.fordBoostDb);
  });
});

describe('ambiances des saisons et brume du matin (tour 8, son.md 4.6)', () => {
  it("l'été: grillons d'été le soir à la place des grillons, martinets le jour, pas sous la pluie", () => {
    const evening = levels({ minutes: 20 * H, season: 'summer' });
    expect(evening.get('crickets')).toBe(0);
    expect(evening.get('crickets-summer')).toBeCloseTo(1);
    expect(levels({ minutes: 14 * H, season: 'summer' }).get('swifts')).toBeCloseTo(1);
    expect(levels({ minutes: 14 * H, season: 'summer', weather: 'rain' }).get('swifts')).toBe(0);
    // Au printemps, rien de l'été.
    expect(levels({ minutes: 20 * H }).get('crickets-summer')).toBe(0);
    expect(levels({ minutes: 14 * H }).get('swifts')).toBe(0);
  });

  it("l'automne: vent dans les feuilles à la place du vent, corneilles, moins d'oiseaux le matin; l'hiver, plus de grillons", () => {
    const autumn = levels({ minutes: 9 * H, season: 'autumn' });
    expect(autumn.get('wind')).toBe(0);
    expect(autumn.get('wind-leaves')).toBeCloseTo(dbToGain(-3), 2);
    expect(autumn.get('crows')).toBeCloseTo(1);
    expect(autumn.get('birds-morning')).toBeCloseTo(dbToGain(-6));
    expect(levels({ minutes: 20 * H, season: 'winter' }).get('crickets')).toBe(0);
    expect(levels({ minutes: 20 * H, season: 'winter' }).get('crickets-summer')).toBe(0);
  });

  it('un matin de brume: la nappe feutrée suit la brume, oiseaux et bourg plus bas, rien sans brume', () => {
    const full = levels({ minutes: 7 * H, mist: 1 });
    expect(full.get('mist-morning')).toBeCloseTo(1);
    expect(full.get('birds-morning')).toBeCloseTo(dbToGain(-4));
    const half = levels({ minutes: 9 * H + 45, mist: 0.5 });
    expect(half.get('mist-morning')).toBeCloseTo(0.5);
    expect(half.get('village')).toBeCloseTo(dbToGain(-1.5), 2);
    expect(levels({ minutes: 7 * H }).get('mist-morning')).toBe(0);
  });
});
