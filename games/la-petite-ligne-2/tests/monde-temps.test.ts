// Temps du monde: calendrier, météo par lieu (répartition sur une année), conditions, événements.
import { describe, expect, it } from 'vitest';
import { WEATHERS } from '../src/etat/commun';
import { CATCH_WEATHERS, SEASONS } from '../src/donnees/schemas/prise';
import { WORLD_SEASONS, WORLD_WEATHERS, WORLD_WEEKDAYS } from '../src/donnees/schemas/regles';
import { WEEKDAYS } from '../src/donnees/schemas/temps';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import { step } from '../src/simulation/noyau/pas';
import { idleInput } from '../src/simulation/noyau/entrees';
import { calendarOf } from '../src/simulation/monde/calendrier';
import { eventVillagers } from '../src/simulation/monde/agenda';
import { morningWeather, weatherAt, wateredOn } from '../src/simulation/monde/meteo';
import { evaluate } from '../src/simulation/regles/conditions';
import { gameContent, newSim } from './aides';
import type { Sim } from '../src/simulation/noyau/pas';

const content = gameContent();

function tick(sim: Sim, n = 1): GameEvent[] {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) {
    step(sim, [idleInput(0), idleInput(0)], []);
    out.push(...sim.events);
  }
  return out;
}

describe('temps du monde', () => {
  it('garde les listes de météos, saisons et jours identiques partout', () => {
    expect([...WORLD_WEATHERS]).toEqual([...WEATHERS]);
    expect([...WORLD_WEATHERS]).toEqual([...CATCH_WEATHERS]);
    expect([...WORLD_SEASONS]).toEqual([...SEASONS]);
    expect([...WORLD_WEEKDAYS]).toEqual([...WEEKDAYS]);
  });

  it('compte des saisons de 14 jours, une année de 56 jours, des semaines de 7', () => {
    expect(calendarOf(content, 1)).toEqual({
      year: 1,
      season: 'spring',
      dayOfSeason: 1,
      weekday: 'monday',
    });
    expect(calendarOf(content, 6).weekday).toBe('saturday');
    expect(calendarOf(content, 14)).toMatchObject({ season: 'spring', dayOfSeason: 14 });
    expect(calendarOf(content, 15)).toMatchObject({ season: 'summer', dayOfSeason: 1 });
    expect(calendarOf(content, 43).season).toBe('winter');
    expect(calendarOf(content, 57)).toMatchObject({ year: 2, season: 'spring', dayOfSeason: 1 });
  });

  it('tire une météo déterministe, par lieu, conforme au climat sur une année (20 graines)', () => {
    const counts: Record<string, Record<string, Record<string, number>>> = {};
    for (const place of ['essai-gare', 'essai-halte']) {
      counts[place] = {};
      for (let seed = 1; seed <= 20; seed++)
        for (let day = 1; day <= 56; day++) {
          const season = calendarOf(content, day).season;
          const byWeather = (counts[place][season] ??= {});
          const w = morningWeather(content, seed, place, day);
          byWeather[w] = (byWeather[w] ?? 0) + 1;
          expect(weatherAt(content, seed, place, day, 400)).toBe(w);
        }
    }
    const gare = counts['essai-gare'] ?? {};
    // La neige ne tombe qu'en hiver; l'orage surtout l'été.
    for (const season of ['spring', 'summer', 'autumn'] as const)
      expect(gare[season]?.snow ?? 0, season).toBe(0);
    expect(gare.winter?.snow ?? 0).toBeGreaterThan(20);
    expect(gare.summer?.storm ?? 0).toBeGreaterThan(gare.spring?.storm ?? 0);
    // Fréquences proches des poids (280 tirages par saison): beau temps d'été 60 %.
    expect((gare.summer?.clear ?? 0) / 280).toBeGreaterThan(0.45);
    expect((gare.summer?.clear ?? 0) / 280).toBeLessThan(0.75);
    // La halte, plus brumeuse que la gare, en automne.
    expect(counts['essai-halte']?.autumn?.mist ?? 0).toBeGreaterThan(gare.autumn?.mist ?? 0);
    // Même graine, même météo; une autre graine change l'année.
    const year = (seed: number): string =>
      Array.from({ length: 56 }, (_, d) =>
        morningWeather(content, seed, 'essai-gare', d + 1),
      ).join();
    expect(year(3)).toBe(year(3));
    expect(year(3)).not.toBe(year(4));
  });

  it('suit la météo dans la journée, prévient la veille et arrose les cultures', () => {
    const sim = newSim(content);
    tick(sim);
    expect(sim.world.common.weather).toBe(
      weatherAt(content, sim.world.seed, 'essai-gare', 1, sim.world.minutes),
    );
    expect(sim.world.common.outlook?.weather).toBe(
      morningWeather(content, sim.world.seed, 'essai-gare', 2),
    );
    // Un jour de pluie: l'événement part une fois, au premier pas où il pleut.
    let rainy = 2;
    while (!wateredOn(content, sim.world.seed, 'essai-gare', rainy)) rainy++;
    const events: GameEvent[] = [];
    sim.world.common.day = rainy;
    for (const minute of content.time.file.weatherSlots) {
      sim.world.minutes = minute + 1;
      events.push(...tick(sim, 3));
    }
    const watered = events.filter((e) => e.type === 'rain_watered');
    expect(watered).toEqual([{ type: 'rain_watered', place: 'essai-gare', day: rainy }]);
    expect(events.some((e) => e.type === 'outlook_ready' && e.day === rainy + 1)).toBe(true);
  });

  it('évalue les conditions weather_is, season_is et weekday_is', () => {
    const sim = newSim(content);
    const ctx = { world: sim.world, content, actor: null };
    sim.world.common.weather = 'mist';
    sim.world.common.day = 20;
    expect(evaluate(ctx, { type: 'weather_is', weathers: ['mist', 'rain'] })).toBe(true);
    expect(evaluate(ctx, { type: 'weather_is', weathers: ['clear'] })).toBe(false);
    expect(evaluate(ctx, { type: 'season_is', seasons: ['summer'] })).toBe(true);
    expect(evaluate(ctx, { type: 'weekday_is', weekdays: ['saturday'] })).toBe(true);
    expect(evaluate(ctx, { type: 'weekday_is', weekdays: ['sunday'] })).toBe(false);
  });

  it('déroule une année d’événements en quelques secondes: date, règle, conditions, annonce', () => {
    const sim = newSim(content);
    tick(sim);
    const started: string[] = [];
    const announced: string[] = [];
    let villagersAtFete: string[] = [];
    for (let day = 2; day <= 56; day++) {
      sim.world.common.day = day;
      sim.world.minutes = 400;
      for (const e of tick(sim, 2))
        if (e.type === 'outlook_ready' && e.events.length > 0)
          announced.push(`${String(e.day)}:${e.events.join('+')}`);
      sim.world.minutes = 900;
      for (const e of tick(sim, 2))
        if (e.type === 'calendar_started') started.push(`${String(day)}:${e.event}`);
      if (day === 3) villagersAtFete = eventVillagers(sim);
      sim.world.minutes = 1400;
      tick(sim, 2);
    }
    // Fête le jour 3 du printemps; puis le visiteur chaque samedi, une fois la fête vue (fait écrit).
    expect(started).toEqual([
      '3:fete-d-essai',
      '6:visiteur-du-samedi',
      '13:visiteur-du-samedi',
      '20:visiteur-du-samedi',
      '27:visiteur-du-samedi',
      '34:visiteur-du-samedi',
      '41:visiteur-du-samedi',
      '48:visiteur-du-samedi',
      '55:visiteur-du-samedi',
    ]);
    expect(announced[0]).toBe('3:fete-d-essai');
    expect(announced).toContain('13:visiteur-du-samedi');
    expect(villagersAtFete).toEqual(['cheffe-de-gare']);
    expect(sim.world.progress.memory['essai-gare.fete.vue']?.v).toBe(true);
    // L'air de la fête est entendu par les deux joueurs.
    const tune = sim.world.progress.album?.f['air-de-la-fete'];
    expect(tune?.[5]).toBe(1);
    expect(tune?.[6]).toBe(1);
  });
});
