import { describe, expect, it } from 'vitest';
import soundsFile from '../../assets/son/sons.json';
import { CatalogueError, parseCatalogue, sequenceOf, stepTime, stopTime } from './catalogue';

describe('catalogue (sons.json)', () => {
  const catalogue = parseCatalogue(soundsFile);

  it('lit les 225 sons et les 11 musiques du sound designer', () => {
    expect(catalogue.sounds.size).toBe(225);
    expect(catalogue.music.size).toBe(11);
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
    expect(catalogue.restingMusic).toEqual(new Set(['halte-matin', 'halte-apres-midi', 'halte-ete', 'samedi']));
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

  it('place les sons des moments rares avec les distances d audition des fiches (tour 6)', () => {
    const audible: Record<string, number> = {
      'heron-wade': 15,
      'geese-rest': 20,
      'tit-song': 12,
      'fox-bark': 25,
      'crickets-night': 20,
    };
    for (const [id, metres] of Object.entries(audible)) {
      expect(catalogue.sounds.get(id)?.spatial?.cullBeyond, id).toBe(metres);
    }
    expect(catalogue.sounds.get('geese-rest')?.loop).not.toBeNull();
    expect(catalogue.sounds.get('crickets-night')?.loop).not.toBeNull();
    expect(catalogue.sounds.get('ladder-step')?.files).toHaveLength(4);
    // Le scintillement des vers luisants reste juste: aucune variation de hauteur.
    expect(catalogue.sounds.get('glow-shimmer')?.pitchVariation).toBe(0);
    // Tour 7: chevrette, martin-pêcheur et brume.
    const audible7: Record<string, number> = {
      'roe-call': 15,
      'roe-bark': 30,
      'kf-whistle': 25,
      'mist-ambience': 20,
    };
    for (const [id, metres] of Object.entries(audible7)) {
      expect(catalogue.sounds.get(id)?.spatial?.cullBeyond, id).toBe(metres);
    }
    expect(catalogue.sounds.get('kf-whistle')?.files).toHaveLength(3);
    expect(catalogue.sounds.get('mist-ambience')?.loop).not.toBeNull();
    expect(catalogue.sounds.get('mist-ambience')?.moment).toMatchObject({ id: 'mist', sound: 'mist_ambience', waitingDb: -6 });
    expect(catalogue.sounds.get('mist-lift')?.pitchVariation).toBe(0);
    // Le merle n'est pas localisé (fiche 1.4.9).
    expect(catalogue.sounds.get('blackbird-wake')?.spatial).toBeNull();
    const sit = catalogue.sounds.get('bench-sit');
    expect(sit?.files).toHaveLength(3);
    expect(sit?.spatial).not.toBeNull();
  });

  it('déclare les sons des saisons et de la cueillette (tour 8)', () => {
    // Un motif par saison, juste (aucune variation de hauteur), non placé.
    for (const season of ['spring', 'summer', 'autumn', 'winter']) {
      const turn = catalogue.sounds.get(`season-turn-${season}`);
      expect(turn?.pitchVariation, season).toBe(0);
      expect(turn?.spatial, season).toBeNull();
      expect(turn?.files, season).toHaveLength(1);
    }
    for (const id of ['mist-morning', 'crickets-summer', 'swifts', 'wind-leaves', 'crows']) {
      const bed = catalogue.sounds.get(id);
      expect(bed?.bus, id).toBe('ambience');
      expect(bed?.loop, id).not.toBeNull();
    }
    for (const id of ['pick-herb', 'pick-mushroom', 'pick-berries', 'pick-nuts']) {
      expect(catalogue.sounds.get(id)?.files, id).toHaveLength(3);
      expect(catalogue.sounds.get(id)?.spatial, id).not.toBeNull();
    }
    expect(catalogue.sounds.get('axe-thud-soft')?.files).toHaveLength(2);
    // La variation d'été du thème garde la boucle du matin: même position de lecture.
    expect(catalogue.music.get('halte-ete')?.loop).toEqual(catalogue.music.get('halte-matin')?.loop);
  });

  it('déclare les sons des moments, des chantiers et du catalogue (tour 9)', () => {
    // Cinq notes d'étoiles, une par étoile filante, dans l'ordre de la fiche.
    for (let k = 1; k <= 5; k += 1) {
      const chime = catalogue.sounds.get(`star-chime-${String(k)}`);
      expect(chime?.moment, String(k)).toEqual({ id: 'falling_stars', sound: `star_chime_${String(k)}`, waitingDb: 0, climaxRampSeconds: 0 });
      expect(chime?.pitchVariation, String(k)).toBe(0);
    }
    const moments: Record<string, string> = {
      'night-water': 'falling_stars',
      'gate-crank': 'train_salute',
      'gate-lock': 'train_salute',
      'train-slow-roll': 'train_salute',
      'train-whistle-salute': 'train_salute',
      'cylinder-cocks': 'train_salute',
      'owl-screech': 'barn_owl',
      'grass-strike': 'barn_owl',
      'lantern-light': 'quay_lanterns',
      'lantern-out': 'quay_lanterns',
      'quay-bell-once': 'quay_lanterns',
    };
    for (const [id, moment] of Object.entries(moments)) {
      const def = catalogue.sounds.get(id);
      expect(def?.moment?.id, id).toBe(moment);
      expect(def?.moment?.sound, id).toBe(id.replaceAll('-', '_'));
      expect(def?.files.every((f) => f.startsWith('moments/')), id).toBe(true);
    }
    // Fiches: audible à 12 m (eau du ponton), 25 m (effraie); boucles qui suivent la source.
    expect(catalogue.sounds.get('night-water')?.spatial?.cullBeyond).toBe(12);
    expect(catalogue.sounds.get('owl-screech')?.spatial?.cullBeyond).toBe(25);
    expect(catalogue.sounds.get('train-slow-roll')?.loop).not.toBeNull();
    expect(catalogue.sounds.get('owl-screech')?.files).toHaveLength(3);
    expect(catalogue.sounds.get('gate-crank')?.files).toHaveLength(2);
    // Les deux lanternes s'allument au même instant: deux voix, aucun intervalle minimal.
    expect(catalogue.sounds.get('lantern-light')?.minIntervalSeconds).toBe(0);
    expect(catalogue.sounds.get('lantern-light')?.maxVoices).toBe(2);
    // L'effraie lointaine: ambiance des soirs sans le moment, non placée.
    expect(catalogue.sounds.get('owl-far')?.moment).toBeNull();
    expect(catalogue.sounds.get('owl-far')?.spatial).toBeNull();
    // L'horloge ne s'entend qu'à moins de 3 m.
    expect(catalogue.sounds.get('clock-tick')?.spatial?.cullBeyond).toBe(3);
    for (const id of ['coins-drop', 'chantier-built', 'gift-give', 'coffee-grind', 'water-pour-copper']) {
      expect(catalogue.sounds.has(id), id).toBe(true);
    }
    expect(catalogue.music.get('halte-evening')?.loop).toBeNull();
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
