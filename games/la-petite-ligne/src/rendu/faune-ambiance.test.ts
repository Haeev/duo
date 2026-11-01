import { describe, expect, it } from 'vitest';
import { loadMap } from '../donnees/carte';
import { MAP_FILES } from '../donnees/cartes-fichiers';
import { cellIndex } from '../etat/carte';
import { chooseButterflyHomes, choosePerches, faunaActive, faunaUnit, nextPresence, perchTaken, treeSpots } from './faune-ambiance';
import { AMBIENT_FAUNA } from './reglages-faune';

const map = loadMap(MAP_FILES).map;
/** Sommet de buisson fictif (le rendu le mesure sur le modèle). */
const top = (): number => 0.7;

describe('faune d’ambiance: tirages et règles', () => {
  it('tire dans [0, 1[, le même nombre pour la même graine', () => {
    for (let i = 0; i < 2000; i += 1) {
      const u = faunaUnit(7, i, 3);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
    expect(faunaUnit(42, 5, 9)).toBe(faunaUnit(42, 5, 9));
  });

  it('rien la nuit ni sous la pluie; les papillons seulement au soleil des heures chaudes', () => {
    const b = AMBIENT_FAUNA.butterflies;
    const t = AMBIENT_FAUNA.birds;
    expect(faunaActive(b.hours, b.weathers, 12 * 60, 'sunny')).toBe(true);
    expect(faunaActive(b.hours, b.weathers, 12 * 60, 'cloudy')).toBe(false);
    expect(faunaActive(b.hours, b.weathers, 12 * 60, 'rain')).toBe(false);
    expect(faunaActive(b.hours, b.weathers, 21 * 60, 'sunny')).toBe(false);
    expect(faunaActive(t.hours, t.weathers, 12 * 60, 'cloudy')).toBe(true);
    expect(faunaActive(t.hours, t.weathers, 12 * 60, 'rain')).toBe(false);
    expect(faunaActive(t.hours, t.weathers, 23 * 60, 'sunny')).toBe(false);
    expect(faunaActive(t.hours, t.weathers, 3 * 60, 'sunny')).toBe(false);
  });

  it('pose les mésanges sur des buissons espacés, chacun avec un arbre proche, loin du nichoir', () => {
    const s = AMBIENT_FAUNA.birds;
    const perches = choosePerches(map, 7, s.count, top);
    expect(perches.length).toBe(s.count);
    const bushes = map.props.filter((p) => s.perchModels.includes(p.model));
    const trees = treeSpots(map);
    const nest = map.points.nest_box;
    expect(nest).toBeDefined();
    for (const [i, p] of perches.entries()) {
      expect(bushes.some((b) => b.pos.x === p.x && b.pos.y === p.y)).toBe(true);
      expect(p.z).toBeCloseTo(0.7 - s.perchSink, 6);
      const tree = Math.min(...trees.map((t) => Math.hypot(t.x - p.x, t.y - p.y)));
      expect(tree).toBeLessThanOrEqual(s.refugeMaxDistance);
      // Le refuge est dans le houppier, entre le tronc et le buisson.
      expect(Math.hypot(p.refuge.x - p.x, p.refuge.y - p.y)).toBeLessThanOrEqual(tree + 1e-9);
      if (nest !== undefined) expect(Math.hypot(nest.x - p.x, nest.y - p.y)).toBeGreaterThanOrEqual(s.avoidRadius);
      for (const q of perches.slice(i + 1)) expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeGreaterThanOrEqual(s.minSpacing);
    }
    // Autre graine, autres buissons (au moins un).
    const other = choosePerches(map, 8, s.count, top);
    expect(other.some((o) => !perches.some((p) => p.x === o.x && p.y === o.y))).toBe(true);
  });

  it('met les papillons dans le pré fleuri, sur des cases libres, mêmes places pour la même graine', () => {
    const s = AMBIENT_FAUNA.butterflies;
    const homes = chooseButterflyHomes(map, 7, s.count, s.zones);
    expect(homes.length).toBe(s.count);
    const meadow = map.zones.meadow;
    expect(meadow).toBeDefined();
    if (meadow === undefined) return;
    for (const h of homes) {
      expect(h.x).toBeGreaterThanOrEqual(meadow.x);
      expect(h.x).toBeLessThan(meadow.x + meadow.w);
      expect(h.y).toBeGreaterThanOrEqual(meadow.y);
      expect(h.y).toBeLessThan(meadow.y + meadow.h);
      expect(map.blocked[cellIndex(map, Math.floor(h.x), Math.floor(h.y))]).toBe(false);
    }
    expect(chooseButterflyHomes(map, 7, s.count, s.zones)).toEqual(homes);
  });

  it('QA7-06: un buisson ne porte qu’une mésange (posée ou en approche), libéré quand elle s’en va', () => {
    const birds = [
      { perch: 2, state: 'perched' as const },
      { perch: 3, state: 'arriving' as const },
      { perch: 4, state: 'leaving' as const },
      { perch: 5, state: 'away' as const },
    ];
    expect(perchTaken(birds, 2, 9)).toBe(true);
    expect(perchTaken(birds, 3, 9)).toBe(true);
    expect(perchTaken(birds, 4, 9)).toBe(false);
    expect(perchTaken(birds, 5, 9)).toBe(false);
    // La mésange posée ne se gêne pas elle-même.
    expect(perchTaken(birds, 2, 0)).toBe(false);
  });

  it('QA7-07: à la fin de leurs heures, les papillons rentrent dans l’herbe posés, jamais en vol', () => {
    const s = AMBIENT_FAUNA.butterflies;
    expect(nextPresence(1, false, false, 0.5, s.hideSeconds)).toBe(1);
    let p = 1;
    let frames = 0;
    while (p > 0 && frames < 1000) {
      p = nextPresence(p, false, true, 1 / 60, s.hideSeconds);
      frames += 1;
    }
    expect(p).toBe(0);
    expect(frames / 60).toBeCloseTo(s.hideSeconds, 1);
    expect(nextPresence(0, true, true, s.hideSeconds, s.hideSeconds)).toBe(1);
  });
});
