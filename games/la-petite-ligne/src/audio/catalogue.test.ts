import { describe, expect, it } from 'vitest';
import soundsFile from '../../assets/son/sons.json';
import { CatalogueError, parseCatalogue, sequenceOf, stepTime, stopTime } from './catalogue';

describe('catalogue (sons.json)', () => {
  const catalogue = parseCatalogue(soundsFile);

  it('lit les 84 sons et les 9 musiques du sound designer', () => {
    expect(catalogue.sounds.size).toBe(84);
    expect(catalogue.music.size).toBe(9);
    expect(catalogue.mix.maxEffectVoices).toBe(24);
    expect(catalogue.peerDb).toBe(-3);
  });

  it('garde les points de boucle et le départ de lecture (premier temps de la musique)', () => {
    const matin = catalogue.music.get('halte-matin');
    expect(matin?.loop).toEqual({ start: 1, end: 97 });
    expect(matin?.playFrom).toBeCloseTo(1.12);
    expect(matin?.duration).toBe(98);
    const fanfare = catalogue.music.get('fanfare-train');
    expect(fanfare?.loop).toBeNull();
    expect(fanfare?.duration).toBeCloseTo(13.217);
    const river = catalogue.sounds.get('river');
    expect(river?.loop).toEqual({ start: 0.5, end: 24.5 });
    expect(river?.durations[0]).toBeCloseTo(25, 1);
  });

  it('range les ambiances: heures, pluie dehors et dans la maisonnette', () => {
    const rain = catalogue.ambienceRules.find((r) => r.ambience === 'rain');
    const roof = catalogue.ambienceRules.find((r) => r.ambience === 'rain-roof');
    expect(rain?.rain).toBe('outdoor');
    expect(roof?.rain).toBe('indoor');
    const birds = catalogue.ambienceRules.filter((r) => r.ambience === 'birds-morning');
    expect(birds.every((r) => r.silentInRain)).toBe(true);
    expect(catalogue.restingMusic).toEqual(new Set(['halte-matin', 'halte-apres-midi', 'samedi']));
  });

  it('donne les instants des séquences du train', () => {
    const arrival = sequenceOf(catalogue, 'train-arrival');
    expect(stepTime(arrival, 'train-steam')).toBeCloseTo(18.3);
    expect(stepTime(arrival, 'fanfare-train')).toBeCloseTo(18.6);
    expect(stepTime(arrival, 'samedi')).toBe(32);
    const departure = sequenceOf(catalogue, 'train-departure');
    expect(stepTime(departure, 'train-depart')).toBeCloseTo(4.6);
    expect(stopTime(departure, 'samedi')).toEqual({ at: 6, fade: 4 });
    expect(stopTime(departure, 'train-idle-loop')).toEqual({ at: 4.6, fade: 0.8 });
  });

  it('refuse un fichier abîmé en citant le champ', () => {
    const broken = structuredClone(soundsFile) as { sounds: Record<string, { priority: number }> };
    const hoe = broken.sounds.hoe;
    if (hoe !== undefined) hoe.priority = 7;
    expect(() => parseCatalogue(broken)).toThrow(CatalogueError);
    expect(() => parseCatalogue(broken)).toThrow(/sounds\.hoe\.priority/);
    expect(() => parseCatalogue(null)).toThrow(CatalogueError);
  });
});
