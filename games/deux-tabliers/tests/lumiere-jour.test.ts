// Lumière du jour et horloge du décor (retour de séance du 2026-11-09: « la luminosité n'évolue
// pas de la journée »). Tests courts: la lumière suit l'heure, l'horloge du décor avance en douceur
// chez l'invité (seconde entière de l'état) et continue le soir.
import { describe, expect, it } from 'vitest';
import { createDecorClock } from '../src/decor/horloge';
import { createDaylight, daylightAt, type Daylight } from '../src/decor/lumiere';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import { createWorld } from '../src/simulation/monde';

describe('lumière du jour', () => {
  // Un objet neuf par appel (tableaux à soi): on peut comparer deux heures.
  const at = (minute: number, weather = 'soleil'): Daylight =>
    daylightAt(minute, weather, createDaylight());

  it('matin rasant à l’est, midi haut au sud, fin d’après-midi dorée à l’ouest, soir bleu', () => {
    const morning = at(480);
    const noon = at(720);
    const golden = at(990);
    const dusk = at(1110);
    // Hauteur du soleil (y de la direction) et côté (x: est positif).
    expect(morning.sunDir[1]).toBeLessThan(0.3);
    expect(morning.sunDir[0]).toBeGreaterThan(0.9);
    expect(noon.sunDir[1]).toBeGreaterThan(0.8);
    expect(golden.sunDir[0]).toBeLessThan(-0.4);
    // Midi plus blanc et plus fort; 16 h 30 plus chaud (rouge sur bleu de la place); soir bleu.
    expect(noon.sunIntensity).toBeGreaterThan(morning.sunIntensity);
    expect(golden.outdoor[0] / golden.outdoor[2]).toBeGreaterThan(1.2);
    expect(dusk.outdoor[2]).toBeGreaterThan(dusk.outdoor[0]);
    expect(dusk.outdoor[1]).toBeLessThan(0.7);
    // Lampes: éteintes en journée, allumées vers 18 h 30.
    expect(noon.lamps).toBe(0);
    expect(golden.lamps).toBe(0);
    expect(dusk.lamps).toBe(1);
  });

  it('continue d’une minute à l’autre (aucun saut visible)', () => {
    let prev = at(420);
    for (let m = 421; m <= 1155; m++) {
      const d = at(m);
      expect(Math.abs(d.sunIntensity - prev.sunIntensity)).toBeLessThan(0.05);
      expect(Math.abs(d.outdoor[1] - prev.outdoor[1])).toBeLessThan(0.05);
      prev = d;
    }
  });

  it('par temps de pluie, soleil voilé et lampes plus tôt', () => {
    expect(at(720, 'pluie').sunIntensity).toBeLessThan(at(720).sunIntensity / 3);
    expect(at(1050, 'pluie').lamps).toBeGreaterThan(at(1050).lamps);
  });
});

describe('horloge du décor', () => {
  const content = loadContent(DATA_FILES);
  const settings = {
    openMinute: 480,
    secondsPerGameMinute: 1,
    peacefulSecondsPerGameMinute: 1.25,
    eveningCapMinute: 1155,
  };

  it('chez l’invité, la seconde entière de l’état donne une heure lisse et croissante', () => {
    const world = createWorld(content, ['a', 'b']);
    world.clientele.phase = 'service';
    world.clientele.day = 3;
    const clock = createDecorClock(settings);
    let last = -Infinity;
    for (let t = 0; t < 10; t += 1 / 60) {
      world.clientele.serviceSec = 240 + Math.floor(t);
      clock.update(world, 1 / 60);
      expect(clock.minute()).toBeGreaterThanOrEqual(last);
      if (last > 0) expect(clock.minute() - last).toBeLessThan(0.1);
      last = clock.minute();
      expect(clock.shared()).toBe(true);
    }
    expect(last).toBeGreaterThan(729);
  });

  it('le soir, l’heure part de la fermeture et avance jusqu’au plafond', () => {
    const world = createWorld(content, ['a', 'b']);
    world.clientele.phase = 'evening';
    world.clientele.serviceSec = 620;
    const clock = createDecorClock(settings);
    clock.update(world, 0);
    expect(clock.minute()).toBeCloseTo(1100, 0);
    for (let i = 0; i < 2000; i++) clock.update(world, 0.1);
    expect(clock.minute()).toBe(1155);
    expect(clock.shared()).toBe(false);
  });
});
