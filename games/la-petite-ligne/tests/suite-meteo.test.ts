// Tour 8, section 3: météo tirée, garde-fous, brume du matin, calendrier (T8-07, T8-11 à T8-13).
import { describe, expect, it } from 'vitest';
import { catalogueWindow } from '../src/donnees/commandes';
import {
  dayOfSeason,
  isTrainDay,
  nextTrainDay,
  seasonOfDay,
  seasonStartingOn,
  secondsPerGameMinuteOn,
} from '../src/donnees/calendrier';
import { mistAmount, weatherSeries } from '../src/etat/meteo';
import { evaluate, NO_CONTEXT } from '../src/simulation/conditions';
import { morning } from '../src/simulation/horloge';
import { weatherOf } from '../src/simulation/meteo';
import { contentAndMap, newSim, SEED, withPace } from './aides';

const { content } = contentAndMap();
const s = content.settings;

describe('calendrier (T8-07, section 2.1)', () => {
  it('saisons de 21 jours, chacune commence un samedi', () => {
    expect(seasonOfDay(s, 1)).toBe('spring');
    expect(seasonOfDay(s, 21)).toBe('spring');
    expect(seasonOfDay(s, 22)).toBe('summer');
    expect(seasonOfDay(s, 42)).toBe('summer');
    expect(seasonOfDay(s, 43)).toBe('autumn');
    expect(seasonOfDay(s, 64)).toBe('winter');
    expect(seasonOfDay(s, 85)).toBe('spring');
    expect(dayOfSeason(s, 24)).toBe(3);
    for (const day of [22, 43, 64, 85]) {
      expect(seasonStartingOn(s, day), `jour ${day}`).not.toBeNull();
      expect((day - 1) % 7, `jour ${day} est un samedi`).toBe(0);
    }
    expect(seasonStartingOn(s, 1)).toBeNull();
    expect(seasonStartingOn(s, 23)).toBeNull();
    // Le calendrier des souvenirs est celui-là (une seule source).
    expect(s.memories.seasonDays).toBe(s.calendar.seasonDays);
  });

  it('un train chaque samedi, le catalogue livre chaque samedi', () => {
    expect([1, 8, 15, 22, 29, 36, 43].every((d) => isTrainDay(s, d))).toBe(true);
    expect([16, 21, 23, 42].some((d) => isTrainDay(s, d))).toBe(false);
    expect(nextTrainDay(s, 16)).toBe(22);
    expect(nextTrainDay(s, 22)).toBe(22);
    expect(nextTrainDay(s, 23)).toBe(29);
    // Les deux fenêtres écrites, puis une par semaine: commande jusqu'au vendredi minuit, livraison samedi 10 h.
    expect(catalogueWindow(s, 10).delivery).toEqual({ day: 15, time: 600 });
    expect(catalogueWindow(s, 15).delivery.day).toBe(15);
    expect(catalogueWindow(s, 16)).toEqual({
      orderDeadline: { day: 21, time: 1440 },
      delivery: { day: 22, time: 600 },
    });
    expect(catalogueWindow(s, 22).delivery.day).toBe(22);
    expect(catalogueWindow(s, 23).delivery.day).toBe(29);
  });

  it("rythme de l'horloge par jour (D1): 0,7 s partout (R14, journées deux fois plus longues); un pas au jour 24 ne change que les jours suivants", () => {
    // Les aides des tests jouent au rythme vif (l'ancienne journée); le rythme livré est normal.
    const shipped = withPace(content, 'normal').settings;
    expect(secondsPerGameMinuteOn(shipped, 1)).toBe(0.7);
    expect(secondsPerGameMinuteOn(shipped, 40)).toBe(0.7);
    expect(secondsPerGameMinuteOn(s, 1)).toBe(0.35);
    const slow = {
      clock: {
        ...shipped.clock,
        schedule: [
          { fromDay: 1, secondsPerGameMinute: 0.35 },
          { fromDay: 24, secondsPerGameMinute: 0.8 },
        ],
      },
    };
    expect(secondsPerGameMinuteOn(slow, 23)).toBe(0.35);
    expect(secondsPerGameMinuteOn(slow, 24)).toBe(0.8);
  });
});

describe('météo tirée (section 3)', () => {
  it('T8-12: la graine du robot donne la météo épinglée des jours 16 à 43 (même calcul que le script)', () => {
    const series = weatherSeries(s, 20261030, 43);
    const want: Record<number, string> = {};
    const set = (days: number[], w: string): void => {
      for (const d of days) want[d] = w;
    };
    set([16, 17, 20, 21, 22, 23, 25, 26, 27, 28, 29, 30, 32, 33, 34, 40, 41, 43], 'sunny');
    set([18, 19, 35, 36, 37], 'rain');
    set([24, 31, 38, 39, 42], 'cloudy');
    for (let d = 16; d <= 43; d++) expect(series[d - 1]?.weather, `jour ${d}`).toBe(want[d]);
    const mist = series.slice(15).filter((x) => x.mist);
    expect(
      series
        .slice(15)
        .map((x, i) => (x.mist ? i + 16 : 0))
        .filter((d) => d > 0),
    ).toEqual([20, 38]);
    expect(mist.length).toBe(2);
    // Les jours de la démo restent ceux de `weatherByDay`.
    expect(series.slice(0, 15).map((x) => x.weather)).toEqual(s.weatherByDay);
  });

  it('T8-11: 1 000 graines, jours 16 à 372: fréquences à 2 points de la table, garde-fous tenus', () => {
    const counts: Record<string, [number, number, number]> = {
      spring: [0, 0, 0],
      summer: [0, 0, 0],
      autumn: [0, 0, 0],
      winter: [0, 0, 0],
    };
    const index = { sunny: 0, cloudy: 1, rain: 2 } as const;
    let longestRain = 0;
    let longestNoSun = 0;
    let differ = 0;
    let previous: string[] | null = null;
    for (let seed = 1; seed <= 1000; seed++) {
      const series = weatherSeries(s, seed, 372);
      expect(series[15]?.weather).toBe('sunny');
      let rain = 0;
      let noSun = 0;
      for (let d = 16; d <= 372; d++) {
        const w = series[d - 1]?.weather ?? 'sunny';
        const c = counts[seasonOfDay(s, d)];
        if (c !== undefined) c[index[w]] += 1;
        rain = w === 'rain' ? rain + 1 : 0;
        noSun = w === 'sunny' ? 0 : noSun + 1;
        longestRain = Math.max(longestRain, rain);
        longestNoSun = Math.max(longestNoSun, noSun);
        if (w === 'rain') expect(series[d - 1]?.mist).toBe(false);
      }
      const days = series.slice(15, 43).map((x) => x.weather);
      if (previous !== null && days.some((w, i) => w !== previous?.[i])) differ++;
      previous = days;
    }
    expect(longestRain).toBeLessThanOrEqual(3);
    expect(longestNoSun).toBeLessThanOrEqual(6);
    expect(differ).toBeGreaterThan(990);
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
      const c = counts[season] ?? [0, 0, 0];
      const total = c[0] + c[1] + c[2];
      s.weather.target[season].forEach((target, i) => {
        expect(
          Math.abs((100 * (c[i] ?? 0)) / total - target),
          `${season}[${String(i)}]`,
        ).toBeLessThanOrEqual(2);
      });
    }
  });

  it('T8-13: au fil des matins, la prévision du soir est la météo du lendemain; brume après la pluie, jamais sous la pluie', () => {
    const sim = newSim(SEED);
    const expected = weatherSeries(s, SEED, 60);
    let forecast = sim.world.weatherTomorrow;
    for (let day = 2; day <= 60; day++) {
      morning(sim);
      const w = sim.world;
      expect(w.clock.day).toBe(day);
      expect(w.weather, `jour ${day}`).toBe(forecast);
      expect(w.weather, `jour ${day}`).toBe(expected[day - 1]?.weather);
      expect(w.morningMist, `brume du jour ${day}`).toBe(
        day >= 16 ? expected[day - 1]?.mist : false,
      );
      const yesterday = expected[day - 2]?.weather;
      if (day >= 16 && yesterday === 'rain' && w.weather !== 'rain')
        expect(w.morningMist).toBe(true);
      if (w.weather === 'rain') expect(w.morningMist).toBe(false);
      // `weather_was` lit la météo tirée de la veille (le journal), `weather_tomorrow_is` la prévision.
      expect(weatherOf(sim, day - 1)).toBe(yesterday);
      expect(
        evaluate(sim, { type: 'weather_was', weather: yesterday ?? 'sunny' }, NO_CONTEXT),
      ).toBe(true);
      expect(
        evaluate(sim, { type: 'weather_tomorrow_is', weather: w.weatherTomorrow }, NO_CONTEXT),
      ).toBe(true);
      expect(evaluate(sim, { type: 'morning_mist' }, NO_CONTEXT)).toBe(w.morningMist);
      expect(w.weatherLog.length).toBeLessThanOrEqual(s.weather.logDays);
      forecast = w.weatherTomorrow;
    }
    expect(sim.world.weatherLog.map((e) => e.day)).toEqual([54, 55, 56, 57, 58, 59, 60]);
  });

  it('la brume se lève de 9 h à 10 h 30', () => {
    expect(mistAmount(s, true, 8 * 60)).toBe(1);
    expect(mistAmount(s, true, 9 * 60 + 45)).toBeCloseTo(0.5);
    expect(mistAmount(s, true, 10 * 60 + 30)).toBe(0);
    expect(mistAmount(s, false, 7 * 60)).toBe(0);
  });
});
