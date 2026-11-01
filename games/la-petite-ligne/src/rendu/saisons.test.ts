import { Scene, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Season } from '../donnees/types';
import { mistAmount } from '../etat/meteo';
import { contentAndMap } from '../../tests/aides';
import { DaylightRig } from './lumiere';
import { SEASON_RENDER_SETTINGS } from './reglages-saisons';
import { morningMistLevel, seasonalMinutes } from './saisons';

const MINUTES_PER_DAY = 1440;
const HOUR = 60;
const FOCUS = new Vector3(38, 0, 20);
const VIEW_RADIUS = 17;
const CAMERA_DISTANCE = 80;
const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
const looks = SEASON_RENDER_SETTINGS.seasons;

function rigFor(season: Season): DaylightRig {
  const rig = new DaylightRig(new Scene());
  rig.setSeason(looks[season]);
  return rig;
}

/** Hauteur du soleil (degrés) à cette heure de jeu, par soleil. */
function elevationAt(rig: DaylightRig, minutes: number): number {
  rig.update(minutes, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
  return (Math.asin(rig.direction.y) * 180) / Math.PI;
}

describe('déformation de l’heure par saison (section 2.5)', () => {
  it('laisse le printemps tel quel: les jours 1 à 21 gardent leur lumière', () => {
    for (let m = 0; m < MINUTES_PER_DAY; m += 7) {
      expect(seasonalMinutes(m, looks.spring)).toBeCloseTo(m, 9);
    }
  });

  it('passe par les ancres de la table 2.2 et ne recule jamais', () => {
    const a = SEASON_RENDER_SETTINGS.anchors;
    for (const season of SEASONS) {
      const look = looks[season];
      expect(seasonalMinutes(0, look)).toBe(0);
      expect(seasonalMinutes(look.sunrise, look)).toBeCloseTo(a.sunrise, 9);
      expect(seasonalMinutes(a.noon, look)).toBeCloseTo(a.noon, 9);
      expect(seasonalMinutes(look.dayEnd, look)).toBeCloseTo(a.dayEnd, 9);
      let previous = -1;
      for (let m = 0; m < MINUTES_PER_DAY; m += 1) {
        const f = seasonalMinutes(m, look);
        expect(f).toBeGreaterThan(previous);
        previous = f;
      }
      expect(seasonalMinutes(MINUTES_PER_DAY - 0.001, look)).toBeCloseTo(MINUTES_PER_DAY, 2);
    }
  });

  it('allonge les soirées d’été et raccourcit celles d’hiver (lueurs plus tard l’été)', () => {
    const at = (season: Season, minutes: number): number => {
      const rig = rigFor(season);
      rig.update(minutes, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
      return rig.night;
    };
    // 19 h 30: déjà la nuit en hiver, le soir au printemps, encore le jour l'été.
    const evening = 19.5 * HOUR;
    expect(at('summer', evening)).toBeLessThan(at('spring', evening));
    expect(at('spring', evening)).toBeLessThan(at('autumn', evening));
    expect(at('autumn', evening)).toBeLessThan(at('winter', evening));
    expect(at('winter', 19 * HOUR)).toBeGreaterThan(0.95);
    expect(at('summer', 20 * HOUR + 30)).toBeLessThan(at('spring', 20 * HOUR + 30));
  });

  it('monte le soleil plus haut l’été et plus bas l’hiver, à midi comme le soir', () => {
    const noon = (season: Season): number => elevationAt(rigFor(season), 13 * HOUR);
    expect(noon('summer')).toBeGreaterThan(noon('spring'));
    expect(noon('spring')).toBeGreaterThan(noon('autumn'));
    expect(noon('autumn')).toBeGreaterThan(noon('winter'));
    expect(noon('winter')).toBeCloseTo(noon('spring') * looks.winter.sunElevationScale, 0);
    // Ombre plus longue en hiver à 15 h: soleil plus bas.
    expect(elevationAt(rigFor('winter'), 15 * HOUR)).toBeLessThan(
      elevationAt(rigFor('spring'), 15 * HOUR),
    );
  });

  it('garde une lumière continue dans chaque saison: aucun saut d’une minute à la suivante', () => {
    for (const season of SEASONS) {
      const rig = rigFor(season);
      // La déformation accélère la journée du printemps (au plus x 1,5, le soir d'hiver): le pas
      // permis grandit d'autant, la courbe reste la même.
      let slope = 1;
      for (let m = 0; m < MINUTES_PER_DAY; m += 1) {
        slope = Math.max(slope, seasonalMinutes(m + 1, looks[season]) - seasonalMinutes(m, looks[season]));
      }
      const step = 0.05 * slope;
      let previous: { x: number; y: number; z: number; sun: number; night: number } | null = null;
      for (let m = 0; m <= MINUTES_PER_DAY; m += 1) {
        rig.update(m, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
        const now = {
          x: rig.direction.x,
          y: rig.direction.y,
          z: rig.direction.z,
          sun: rig.sun.intensity,
          night: rig.night,
        };
        if (previous !== null) {
          expect(Math.abs(now.x - previous.x)).toBeLessThan(step);
          expect(Math.abs(now.y - previous.y)).toBeLessThan(step);
          expect(Math.abs(now.z - previous.z)).toBeLessThan(step);
          expect(Math.abs(now.sun - previous.sun)).toBeLessThan(step);
          expect(Math.abs(now.night - previous.night)).toBeLessThan(step);
        }
        previous = now;
      }
    }
  });
});

describe('brume du matin (section 3.4)', () => {
  const { content } = contentAndMap();
  const settings = content.settings;
  const level = SEASON_RENDER_SETTINGS.morningMist.level;

  it('porte la brume au sol à 0,6 jusqu’à 9 h, puis la lève jusqu’à 10 h 30', () => {
    const at = (minutes: number, mist: boolean): number => {
      const rig = new DaylightRig(new Scene());
      rig.setMorningMist(mistAmount(settings, mist, minutes));
      rig.update(minutes, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
      return rig.mist;
    };
    expect(at(8 * HOUR, true)).toBeGreaterThanOrEqual(level);
    expect(at(9 * HOUR, true)).toBeGreaterThanOrEqual(level);
    const mid = at(9.75 * HOUR, true);
    expect(mid).toBeLessThan(level);
    expect(mid).toBeGreaterThan(at(9.75 * HOUR, false));
    expect(at(10.5 * HOUR, true)).toBeCloseTo(at(10.5 * HOUR, false), 6);
    expect(at(14 * HOUR, true)).toBe(at(14 * HOUR, false));
  });

  it('ne baisse jamais la brume de l’heure (rosée de l’aube)', () => {
    expect(morningMistLevel(1, 0.2)).toBe(1);
    expect(morningMistLevel(0.1, 1)).toBe(level);
    expect(morningMistLevel(0.1, 0)).toBe(0.1);
  });
});
