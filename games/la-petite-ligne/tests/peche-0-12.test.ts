// Pêche 0.12 (`docs/jeux/jeu-1/peche-0-12-conception.md`, section 11): les critères chiffrés de la
// simulation. Ombres présentes et toujours dans l'eau (S2), plafonds de rareté et filet des communs
// (S3), coin qui frémit (S5), mythique jamais farmable et pris à deux seulement (S7), carnet et
// migration de sauvegarde (S8).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { groundAt } from '../src/etat/carte';
import type { FishShadow } from '../src/etat/peche';
import type { Character } from '../src/etat/types';
import { decodeSave, restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { type Sim, character } from '../src/simulation/contexte';
import {
  drawShadowFish,
  fishingDawn,
  fishingZoneAt,
  grandAllowed,
  hotSpotOn,
  tierShares,
  updateFishingWorld,
  zoneSpots,
} from '../src/simulation/ombres';
import { fishAct, landFish, tryNet, updateFishing } from '../src/simulation/peche';
import { addToBag } from '../src/simulation/sac';
import { SIM_HZ } from '../src/simulation/constantes';
import { contentAndMap, newSim, SEED } from './aides';
import { fishPageModel } from '../src/interface/modele-poissons';
import { uiContext } from '../src/interface/tests/aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const SUMMER_DAY = 25;
const AUTUMN_DAY = 50;

/** Une journée en cours, à l'heure dite, les deux dehors et loin de l'eau. */
function daySim(day: number, minutes: number, seed = SEED): Sim {
  const sim = newSim(seed);
  const w = sim.world;
  w.phase = 'day';
  w.clock.day = day;
  w.clock.minutes = minutes;
  w.clock.running = true;
  w.weather = 'sunny';
  w.morningMist = false;
  for (const c of w.characters) {
    c.created = true;
    c.status = 'active';
    c.inside = null;
    c.speed = 0;
    c.pos = { x: 30, y: 15 };
  }
  return sim;
}

function tick(sim: Sim, n = 1): void {
  for (let i = 0; i < n; i++) {
    sim.world.tick += 1;
    updateFishingWorld(sim);
    for (const c of sim.world.characters) updateFishing(sim, c);
  }
}

function rod(sim: Sim, c: Character): void {
  addToBag(sim, c, 'fishing_rod', 'ordinary', 1);
  c.selected = c.bag.findIndex((s) => s?.item === 'fishing_rod');
}

/** Carnet complet: aucun coup de pouce « jamais pris ». */
function fullLog(sim: Sim): void {
  for (const def of Object.values(sim.content.items)) {
    if (def.fish === null) continue;
    sim.world.fishing.log[def.id] = { count: 5, first: { day: 1, by: 'p1', zone: 'ford', together: false }, record: { cm: def.fish.lengthCm[1], by: 'p1', day: 1 } };
  }
}

/** Marge réelle autour d'un point: distance au plus proche carré qui n'est pas de l'eau libre. */
function clearance(sim: Sim, x: number, y: number): number {
  const { map } = sim;
  const covered = (cx: number, cy: number): boolean =>
    map.props.some((p) => p.rect !== null && cx >= p.rect.x && cy >= p.rect.y && cx < p.rect.x + p.rect.w && cy < p.rect.y + p.rect.h) ||
    map.crossings.some((k) => cx >= k.rect.x && cy >= k.rect.y && cx < k.rect.x + k.rect.w && cy < k.rect.y + k.rect.h);
  let best = 9;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const cx = Math.floor(x) + dx;
      const cy = Math.floor(y) + dy;
      if (groundAt(map, cx, cy) === 'water' && !covered(cx, cy)) continue;
      best = Math.min(best, Math.hypot(Math.max(cx - x, 0, x - cx - 1), Math.max(cy - y, 0, y - cy - 1)));
    }
  }
  return best;
}

describe('ombres (S2)', () => {
  it('au ponton pendant 10 minutes: 3 à 4 ombres, au plus une manquante pendant 10 s, toutes dans l’eau', () => {
    const sim = daySim(SUMMER_DAY, 13 * 60);
    const p1 = character(sim, 'p1');
    p1.pos = { x: 45, y: 39.5 };
    const want = sim.content.settings.fishing?.rules.shadows.perZone.pontoon ?? 0;
    expect(want).toBe(4);
    const seen = new Map<number, FishShadow>();
    let missingSince: number | null = null;
    let longestMissing = 0;
    let fewest = want;
    tick(sim, 1);
    for (let t = 0; t < 10 * 60 * SIM_HZ; t++) {
      tick(sim, 1);
      const live = sim.world.fishing.shadows.filter((s) => s.zone === 'pontoon' && s.state !== 'leaving' && s.state !== 'fleeing' && s.rarity !== 'legendary' && s.watchOnly !== true);
      fewest = Math.min(fewest, live.length);
      if (live.length < want) {
        missingSince ??= sim.world.tick;
        longestMissing = Math.max(longestMissing, sim.world.tick - missingSince);
      } else missingSince = null;
      for (const s of sim.world.fishing.shadows) seen.set(s.id * 1000 + Math.round(s.pos.x * 10 + s.pos.y), structuredClone(s));
    }
    expect(fewest).toBeGreaterThanOrEqual(want - 1);
    expect(longestMissing / SIM_HZ).toBeLessThanOrEqual(10 + 2);
    // Les départs ont bien eu lieu: la réapparition attend 6 s au moins après une fin de vie.
    expect(longestMissing / SIM_HZ).toBeGreaterThanOrEqual(6);
    const minShore = sim.content.settings.fishing?.rules.shadows.minShoreDistance ?? 0.4;
    expect(seen.size).toBeGreaterThan(8);
    for (const s of seen.values()) {
      if (s.state === 'fleeing' || s.state === 'approach' || s.state === 'under') continue;
      const zone = fishingZoneAt(sim, s.pos.x, s.pos.y);
      expect(zone?.id, `ombre ${String(s.id)}`).toBe(s.zone);
      // Tout le disque de nage est dans l'eau libre, à 0,4 m au moins de la berge, du ponton et des ouvrages.
      expect(clearance(sim, s.pos.x, s.pos.y) - s.roam, `ombre ${String(s.id)} en (${String(s.pos.x)}, ${String(s.pos.y)})`).toBeGreaterThanOrEqual(minShore - 1e-9);
    }
  });

  it('aucune place d’ombre hors de l’eau libre, dans aucun coin; le ru seulement au milieu du lit', () => {
    const sim = daySim(SUMMER_DAY, 13 * 60);
    for (const zone of sim.map.fishingZones ?? []) {
      const spots = zoneSpots(sim, zone.id);
      expect(spots.length, zone.id).toBeGreaterThan(0);
      for (const s of spots) expect(clearance(sim, s.x, s.y), `${zone.id} (${String(s.x)}, ${String(s.y)})`).toBeGreaterThanOrEqual(0.4 + 0.1 - 1e-9);
    }
    for (const s of zoneSpots(sim, 'ru')) expect(s.x).toBe(64);
  });

  it('aucune ombre au ponton 46 s après que plus personne n’est à moins de 16 m', () => {
    const sim = daySim(SUMMER_DAY, 13 * 60);
    const p1 = character(sim, 'p1');
    p1.pos = { x: 45, y: 39.5 };
    tick(sim, 5 * SIM_HZ);
    expect(sim.world.fishing.shadows.some((s) => s.zone === 'pontoon')).toBe(true);
    p1.pos = { x: 45, y: 15 };
    tick(sim, 46 * SIM_HZ);
    expect(sim.world.fishing.shadows.some((s) => s.zone === 'pontoon')).toBe(false);
  });
});

describe('tirage des raretés (S3)', () => {
  it('10 000 apparitions au ponton, été, 13 h, soleil, seul, carnet complet: 3 à 5 % d’épiques, 22 à 27 % de rares', () => {
    const sim = daySim(SUMMER_DAY, 13 * 60);
    fullLog(sim);
    sim.world.fishing.hotSpot = { day: SUMMER_DAY, zone: 'ford' };
    const count = { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 };
    for (let n = 0; n < 10000; n++) {
      const drawn = drawShadowFish(sim, 'pontoon', n);
      if (drawn !== null) count[drawn.rarity] += 1;
    }
    expect(count.epic / 10000).toBeGreaterThanOrEqual(0.03);
    expect(count.epic / 10000).toBeLessThanOrEqual(0.05);
    expect(count.rare / 10000).toBeGreaterThanOrEqual(0.22);
    expect(count.rare / 10000).toBeLessThanOrEqual(0.27);
    expect(count.legendary + count.mythic).toBe(0);
  });

  it('tous les bonus cumulés, partout, toute saison et toute heure: jamais plus de 15 % d’épiques ni 40 % de rares', () => {
    for (const day of [5, SUMMER_DAY, AUTUMN_DAY, 70]) {
      for (let minutes = 6 * 60; minutes < 24 * 60; minutes += 60) {
        for (const weather of ['sunny', 'cloudy', 'rain'] as const) {
          const sim = daySim(day, minutes);
          sim.world.weather = weather;
          sim.world.morningMist = true;
          for (const zone of sim.map.fishingZones ?? []) {
            sim.world.fishing.hotSpot = { day, zone: zone.id };
            const spot = zoneSpots(sim, zone.id)[0];
            if (spot === undefined) continue;
            for (const c of sim.world.characters) c.fishing = { phase: 'waiting', bobber: { x: spot.x, y: spot.y }, biteAt: 1e9, until: 0 };
            const shares = tierShares(sim, zone.id);
            const where = `${zone.id}, jour ${String(day)}, ${String(minutes / 60)} h, ${weather}`;
            expect(shares.epic, where).toBeLessThanOrEqual(0.15 + 1e-9);
            expect(shares.rare, where).toBeLessThanOrEqual(0.4 + 1e-9);
            expect(shares.common, where).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('après 10 communs de suite, l’ombre suivante du coin du dernier preneur est au moins rare', () => {
    const sim = daySim(SUMMER_DAY, 13 * 60);
    fullLog(sim);
    sim.world.fishing.commonsInRow = 10;
    sim.world.fishing.lastCatchZone = 'pontoon';
    for (let n = 0; n < 200; n++) expect(drawShadowFish(sim, 'pontoon', n)?.rarity).not.toBe('common');
  });
});

describe('coin qui frémit (S5)', () => {
  it('sur 200 jours et 3 graines, jamais le même coin deux jours de suite', () => {
    for (const seed of [1, 7, SEED]) {
      const sim = daySim(1, 8 * 60, seed);
      let previous: string | null = null;
      const used = new Set<string>();
      for (let day = 1; day <= 200; day++) {
        const zone = hotSpotOn(sim, day);
        expect(zone).not.toBeNull();
        expect(zone, `graine ${String(seed)}, jour ${String(day)}`).not.toBe(previous);
        if (zone !== null) used.add(zone);
        previous = zone;
      }
      expect(used.size).toBe(7);
    }
  });
});

describe('légendaires et mythiques (S7)', () => {
  /** Matin de brume d'automne au ru: la Dorée présente (truite déjà au carnet). */
  function goldenMorning(): Sim {
    for (let day = AUTUMN_DAY - 7; day < AUTUMN_DAY + 14; day++) {
      const sim = daySim(day, 7 * 60);
      sim.world.morningMist = true;
      fullLog(sim);
      delete sim.world.fishing.log.golden_trout;
      fishingDawn(sim);
      if (sim.world.fishing.grands.list.some((g) => g.fish === 'golden_trout')) return sim;
    }
    throw new Error('aucun matin avec la Dorée sur trois semaines');
  }

  it('jamais avant que le duo ait pris le poisson prérequis', () => {
    const sim = goldenMorning();
    delete sim.world.fishing.log.trout;
    const def = sim.content.items.golden_trout?.fish;
    if (def === null || def === undefined) throw new Error('la Dorée attendue');
    expect(grandAllowed(sim, 'golden_trout', def)).toBe(false);
  });

  it('pas de touche sans guetteur à moins de 6 m; prise à deux, rendue à l’eau, puis plus de l’année', () => {
    const sim = goldenMorning();
    const [p1, p2] = sim.world.characters;
    if (p1 === undefined || p2 === undefined) throw new Error('deux personnages');
    p1.pos = { x: 62, y: 26.5 };
    p1.facing = 0;
    rod(sim, p1);
    tick(sim, 3);
    const golden = sim.world.fishing.shadows.find((s) => s.fish === 'golden_trout');
    expect(golden?.watchOnly).toBe(true);
    if (golden === undefined) throw new Error('ombre de la Dorée attendue');
    // Le pêcheur vise l'ombre (invisible pour lui).
    p1.pos = { x: golden.pos.x - 2.5, y: golden.pos.y };
    p1.facing = 0;
    fishAct(sim, p1);
    expect(p1.fishing?.shadow).toBe(golden.id);
    tick(sim, 30 * SIM_HZ);
    expect(p1.fishing?.phase, 'sans guetteur, le mythique ne mord pas').toBe('waiting');
    // L'autre fait le guet à côté de l'ombre.
    p2.pos = { x: golden.pos.x - 2.5, y: golden.pos.y + 1.2 };
    let bit = false;
    for (let t = 0; t < 15 * SIM_HZ && !bit; t++) {
      tick(sim, 1);
      bit = p1.fishing?.phase === 'bite';
    }
    expect(bit).toBe(true);
    fishAct(sim, p1);
    expect(sim.world.fishing.landing?.fisher).toBe('p1');
    expect(tryNet(sim, p2)).toBe(true);
    expect(sim.world.fishing.log.golden_trout?.count).toBe(1);
    expect(p1.bag.some((s) => s?.item === 'golden_trout'), 'remis à l’eau, jamais au sac').toBe(false);
    // Plus aucun matin de l'année ne la remet à l'eau; l'année suivante, si.
    const year = sim.content.settings.calendar.seasonDays * sim.content.settings.calendar.seasonsPerYear;
    const def = sim.content.items.golden_trout?.fish;
    if (def === null || def === undefined) throw new Error('la Dorée attendue');
    for (let day = sim.world.clock.day; day <= year; day++) {
      sim.world.clock.day = day;
      expect(grandAllowed(sim, 'golden_trout', def), `jour ${String(day)}`).toBe(false);
    }
    sim.world.clock.day = year + AUTUMN_DAY;
    expect(grandAllowed(sim, 'golden_trout', def)).toBe(true);
  });

  it('un joueur qui s’absente pendant l’épuisette: pas de prise, pas d’erreur', () => {
    const sim = goldenMorning();
    const [p1, p2] = sim.world.characters;
    if (p1 === undefined || p2 === undefined) throw new Error('deux personnages');
    rod(sim, p1);
    p1.pos = { x: 62, y: 26.5 };
    tick(sim, 3);
    const golden = sim.world.fishing.shadows.find((s) => s.fish === 'golden_trout');
    if (golden === undefined) throw new Error('ombre de la Dorée attendue');
    p1.pos = { x: golden.pos.x - 2.5, y: golden.pos.y };
    p1.facing = 0;
    p2.pos = { x: golden.pos.x - 2.5, y: golden.pos.y + 1.2 };
    tick(sim, 2 * SIM_HZ);
    fishAct(sim, p1);
    for (let t = 0; t < 20 * SIM_HZ && p1.fishing?.phase !== 'bite'; t++) tick(sim, 1);
    fishAct(sim, p1);
    expect(sim.world.fishing.landing).not.toBeNull();
    p2.absent = true;
    tick(sim, 1);
    expect(sim.world.fishing.landing).toBeNull();
    expect(tryNet(sim, p2)).toBe(false);
    expect(sim.world.fishing.log.golden_trout).toBeUndefined();
    expect(sim.world.fishing.grands.list.find((g) => g.fish === 'golden_trout')?.gone).toBe(true);
  });

  it('un légendaire au plus par jour, le même au plus une fois par saison', () => {
    const sim = daySim(SUMMER_DAY, 7 * 60);
    const p1 = character(sim, 'p1');
    landFish(sim, p1, 'mirror_carp', 'pontoon', 70);
    const carp = sim.content.items.mirror_carp?.fish;
    if (carp === null || carp === undefined) throw new Error('carpe miroir attendue');
    for (let day = SUMMER_DAY; day <= 42; day++) {
      sim.world.clock.day = day;
      expect(grandAllowed(sim, 'mirror_carp', carp), `jour ${String(day)}`).toBe(false);
    }
    sim.world.clock.day = 84 + SUMMER_DAY;
    expect(grandAllowed(sim, 'mirror_carp', carp)).toBe(true);
  });
});

describe('carnet des poissons et sauvegarde (S8)', () => {
  it('sauvegarde puis chargement: compteurs, records et grands gardés, ombres jamais écrites', () => {
    const sim = daySim(SUMMER_DAY, 13 * 60);
    const [p1, p2] = sim.world.characters;
    if (p1 === undefined || p2 === undefined) throw new Error('deux personnages');
    p1.pos = { x: 45, y: 39.5 };
    p2.pos = { x: 47, y: 37.5 };
    tick(sim, 3 * SIM_HZ);
    landFish(sim, p1, 'chub', 'pontoon', 30);
    landFish(sim, p2, 'chub', 'pontoon', 41);
    landFish(sim, p1, 'mirror_carp', 'pontoon', 70);
    const log = sim.world.fishing.log;
    expect(log.chub).toMatchObject({ count: 2, first: { by: 'p1', zone: 'pontoon', together: true }, record: { cm: 41, by: 'p2' } });
    expect(sim.world.fishing.shadows.length).toBeGreaterThan(0);
    const snap = snapshotOf(sim);
    expect(snap.data.fishing.shadows).toEqual([]);
    const { content, map } = contentAndMap();
    const back = restoreWorld(content, map, decodeSave(JSON.parse(JSON.stringify(snap.data))), snap.dataSchema, [A, B]);
    expect(back.world.fishing.log).toEqual(log);
    expect(back.world.fishing.grandsCaught).toEqual({ mirror_carp: SUMMER_DAY });
  });

  it('migration du format 8: le carnet reprend les prises d’après les compteurs', () => {
    const { content, map } = contentAndMap();
    const file = new URL('./donnees/sauvegardes/format-8-milieu-semaine-2.json', import.meta.url);
    const raw = JSON.parse(readFileSync(fileURLToPath(file), 'utf8')) as { dataSchema: number; data: unknown };
    expect(raw.dataSchema).toBe(8);
    const sim = restoreWorld(content, map, decodeSave(raw.data), raw.dataSchema, [A, B]);
    expect(sim.world.fishing.log.gudgeon?.count).toBe(4);
    expect(sim.world.fishing.log.chub?.count).toBe(2);
    expect(sim.world.fishing.log.trout?.count).toBe(2);
    expect(sim.world.fishing.shadows).toEqual([]);
  });
});

describe('annonces de prise et onglet « Poissons » (U1, U2)', () => {
  const texts = (c: Character): string[] => c.notifications.map((n) => n.text);

  it('chaque rareté donne le bon texte chez le pêcheur et chez l’autre; rien chez l’autre pour un commun', () => {
    const sim = daySim(SUMMER_DAY, 13 * 60);
    const [p1, p2] = sim.world.characters;
    if (p1 === undefined || p2 === undefined) throw new Error('deux personnages');
    fullLog(sim);
    const cases: [string, number, RegExp, RegExp | null][] = [
      ['chub', 30, /^Un chevesne de 30 cm\.$/, null],
      ['perch', 28, /^Une perche de 28 cm\.$/, /^Camille: une perche de 28 cm\.$/],
      ['barbel', 61, /^Un barbeau de 61 cm ! Épique\.$/, /^Camille: un barbeau de 61 cm ! Épique\.$/],
      ['shad', 48, /^Prise légendaire: l'alose ! 48 cm\.$/, /^Prise légendaire pour Camille: l'alose ! 48 cm\.$/],
      ['brook_lamprey', 12, /^Une lamproie de Planer ! Tu la regardes un instant, puis tu la rends au ru\.$/, /^Camille rend une lamproie de Planer à l'eau\.$/],
    ];
    for (const [fish, cm, mine, other] of cases) {
      p1.notifications = [];
      p2.notifications = [];
      landFish(sim, p1, fish, fish === 'brook_lamprey' ? 'ru' : 'pontoon', cm);
      expect(texts(p1), fish).toEqual([expect.stringMatching(mine)]);
      expect(texts(p2), fish).toEqual(other === null ? [] : [expect.stringMatching(other)]);
    }
    expect(p1.bag.some((s) => s?.item === 'brook_lamprey'), 'remise à l’eau, jamais au sac').toBe(false);
  });

  it('première prise et record: dits aux deux; l’onglet compte, montre l’indice avant, la fiche après', () => {
    const sim = daySim(SUMMER_DAY, 13 * 60);
    const [p1, p2] = sim.world.characters;
    if (p1 === undefined || p2 === undefined) throw new Error('deux personnages');
    landFish(sim, p1, 'tench', 'pontoon', 30);
    expect(texts(p2)).toContain('Nouveau dans le carnet: la tanche.');
    landFish(sim, p2, 'tench', 'pontoon', 40);
    expect(texts(p1)).toContain('Nouveau record: tanche de 40 cm.');
    const page = fishPageModel(sim.world, uiContext('p1'));
    expect(page.rows.map((r) => r.entries.length)).toEqual([6, 5, 5, 4, 2]);
    expect(page.count).toMatch(/^Poissons au carnet.*1 sur 22$/);
    const tench = page.rows[1]?.entries.find((e) => e.id === 'tench');
    expect(tench?.caught).toBe(true);
    expect(tench?.facts.join(' | ')).toContain('Record');
    const perch = page.rows[1]?.entries.find((e) => e.id === 'perch');
    expect(perch).toMatchObject({ caught: false, text: 'Autour du ponton, en journée.' });
    // Un grand dont Achille n'a pas encore parlé: la silhouette sans indice.
    const shad = page.rows[3]?.entries.find((e) => e.id === 'shad');
    expect(shad?.text).not.toContain('gué');
  });
});
