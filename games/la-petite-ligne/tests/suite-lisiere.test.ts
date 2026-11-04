// Tour 8, section 5: repousse des arbres (T8-19), cueillette (T8-21), poissons (T8-22), répliques
// datées et bornées (T8-23), envies d'après la démo (T8-25).
import { describe, expect, it } from 'vitest';
import { seasonOfDay } from '../src/donnees/calendrier';
import type { Content } from '../src/donnees/types';
import { drawForage, forageCandidates } from '../src/etat/cueillette';
import { adultAgainOn, treeGrowth } from '../src/etat/repousse';
import type { Character, Tree } from '../src/etat/types';
import { restoreWorld } from '../src/sauvegarde/sauvegarde';
import { actFront } from '../src/simulation/agir';
import type { Sim } from '../src/simulation/contexte';
import { refreshBlockers } from '../src/simulation/deplacement';
import { eligibleDailies, pickDialogue } from '../src/simulation/dialogues';
import { isBlockedCell } from '../src/simulation/grille';
import { morning } from '../src/simulation/horloge';
import { FORAGE_CORNER_RADIUS, treeStage } from '../src/simulation/lisiere';
import { biteWaitFactor, fishWeightsOn } from '../src/simulation/peche';
import { evaluateAll, NO_CONTEXT } from '../src/simulation/conditions';
import { chop } from '../src/simulation/potager';
import { addToBag } from '../src/simulation/sac';
import { MINUTES_PER_DAY } from '../src/simulation/constantes';
import { contentAndMap, newSim, SEED } from './aides';
import summerSave from './donnees/sauvegardes/format-5-ete-jour-25.json';
import midWeekSave from './donnees/sauvegardes/format-13-milieu-semaine-2.json';

const { content, map } = contentAndMap();
const s = content.settings;
const HOUR = 60;
const PLAYERS = [
  { id: 'membre-a', name: 'Camille', color: '#e07a5f' },
  { id: 'membre-b', name: 'Sacha', color: '#3d85c6' },
] as const;

/** Va au matin du jour `day` (les matins s'enchaînent depuis la création, comme la partie). */
function dawnOf(sim: Sim, day: number): void {
  while (sim.world.clock.day < day) morning(sim);
}

/** Un personnage dehors, en journée, hache en main, juste au sud de l'arbre et tourné vers lui. */
function axeman(sim: Sim, tree: Tree): Character {
  const c = sim.world.characters[0];
  if (c === undefined) throw new Error('personnage attendu');
  sim.world.phase = 'day';
  c.created = true;
  c.status = 'active';
  c.inside = null;
  c.pos = { x: tree.pos.x, y: tree.pos.y + 1.2 };
  c.facing = -Math.PI / 2;
  addToBag(sim, c, 'axe', 'ordinary', 1);
  c.selected = c.bag.findIndex((slot) => slot?.item === 'axe');
  return c;
}

function firstTree(sim: Sim, kind: Tree['kind']): Tree {
  const tree = sim.world.trees.find((t) => t.kind === kind);
  if (tree === undefined) throw new Error(`un arbre ${kind} attendu`);
  return tree;
}

function fell(sim: Sim, c: Character, tree: Tree): void {
  for (let i = 0; i < s.trees.chopsPerTree; i++) chop(sim, c, tree);
  expect(tree.felled).toBe(true);
}

describe('repousse des arbres (T8-19, section 5.1)', () => {
  const at = (felledDay: number, day: number): string => {
    const g = treeGrowth(s.trees, { felled: true, felledDay }, day);
    return g.stage === 'sapling' ? `rejet ${g.scale.toFixed(2)}` : g.stage;
  };

  // R19 (0.12.2): souche 2 jours, rejet 4 jours, dès le jour 1 (avant: 4 et 6 jours, dès le jour 16).
  it('souche 2 jours, rejet 4 jours (0,3 puis +0,15 par jour, 0,8 au plus), adulte ensuite', () => {
    expect([20, 21].map((d) => at(20, d))).toEqual(['stump', 'stump']);
    expect([22, 23, 24, 25].map((d) => at(20, d))).toEqual([
      'rejet 0.30',
      'rejet 0.45',
      'rejet 0.60',
      'rejet 0.75',
    ]);
    expect(at(20, 26)).toBe('adult');
    expect(adultAgainOn(s.trees, 20)).toBe(26);
  });

  it('repousse dès le jour 1: un arbre abattu pendant la démo n’attend plus le jour 16', () => {
    expect(s.trees.regrowFromDay).toBe(1);
    // Abattu le 1: rejet le 3, adulte le 7. Abattu le 3: rejet le 5, adulte le 9. Abattu le 12: adulte le 18.
    expect([1, 2].map((d) => at(1, d))).toEqual(['stump', 'stump']);
    expect(at(1, 3)).toBe('rejet 0.30');
    expect(adultAgainOn(s.trees, 1)).toBe(7);
    expect(at(1, 7)).toBe('adult');
    expect(at(3, 5)).toBe('rejet 0.30');
    expect(adultAgainOn(s.trees, 3)).toBe(9);
    expect(at(3, 9)).toBe('adult');
    expect(at(12, 16)).toBe('rejet 0.60');
    expect(adultAgainOn(s.trees, 12)).toBe(18);
    // Aucun arbre abattu ne reste plus de 6 jours à terre, quel que soit le jour.
    for (let felled = 1; felled <= 80; felled++) {
      expect(adultAgainOn(s.trees, felled), `abattu le ${felled}`).toBe(felled + 6);
    }
  });

  it("dans la partie: l'arbre abattu le jour 20 redevient abattable le 26; la souche se traverse, le rejet garde sa case", () => {
    const sim = newSim(SEED);
    dawnOf(sim, 20);
    const tree = firstTree(sim, 'oak');
    const c = axeman(sim, tree);
    fell(sim, c, tree);
    expect(tree.felledDay).toBe(20);
    const cell = { cx: Math.floor(tree.pos.x), cy: Math.floor(tree.pos.y) };
    sim.runtime.dynamicDirty = true;
    expect(isBlockedCell(refreshBlockers(sim), cell.cx, cell.cy)).toBe(false);
    dawnOf(sim, 21);
    expect(treeStage(sim, tree)).toBe('stump');
    dawnOf(sim, 22);
    expect(treeStage(sim, tree)).toBe('sapling');
    expect(isBlockedCell(refreshBlockers(sim), cell.cx, cell.cy)).toBe(true);
    dawnOf(sim, 25);
    expect(tree.felled).toBe(true);
    morning(sim);
    expect(sim.world.clock.day).toBe(26);
    expect(tree.felled).toBe(false);
    expect(tree.hits).toBe(0);
    expect(tree.felledDay).toBeNull();
    expect(sim.events.some((e) => e.type === 'tree_regrown' && e.tree === tree.id)).toBe(true);
  });

  it('la hache sur une souche ou un rejet ne frappe pas et dit pourquoi', () => {
    const sim = newSim(SEED);
    dawnOf(sim, 20);
    const tree = firstTree(sim, 'oak');
    const c = axeman(sim, tree);
    fell(sim, c, tree);
    const hits = tree.hits;
    sim.events.length = 0;
    actFront(sim, c);
    expect(tree.hits).toBe(hits);
    expect(sim.events).toContainEqual({
      type: 'chop_refused',
      by: c.id,
      tree: tree.id,
      reason: 'stump',
    });
    expect(c.notifications.at(-1)?.text).toBe(content.texts.messages.stump_hint);
    // Le rejet le plus grand (dernier jour avant l'arbre adulte) reste trop jeune.
    dawnOf(sim, 25);
    expect(treeStage(sim, tree)).toBe('sapling');
    const d = axeman(sim, tree);
    sim.events.length = 0;
    actFront(sim, d);
    expect(tree.felled).toBe(true);
    expect(sim.events).toContainEqual({
      type: 'chop_refused',
      by: d.id,
      tree: tree.id,
      reason: 'young',
    });
    expect(d.notifications.at(-1)?.text).toBe(content.texts.messages.tree_too_young);
    expect(tree.lastHitTick).toBe(sim.world.tick);
  });

  it('une sauvegarde du format 5 sans jour d’abattage: les arbres abattus redeviennent des souches d’aujourd’hui', () => {
    const sim = restoreWorld(
      content,
      map,
      structuredClone(summerSave.data),
      summerSave.dataSchema,
      [
        { id: 'membre-a', name: 'Camille', color: '#e07a5f' },
        { id: 'membre-b', name: 'Sacha', color: '#3d85c6' },
      ],
    );
    const day = sim.world.clock.day;
    for (const t of sim.world.trees) expect(t.felledDay).toBe(t.felled ? day : null);
    expect(sim.world.sharedEnvieRecent).toEqual([]);
  });

  it('une sauvegarde de la 0.12.1 (jour 11): les souches des jours 2 et 3 se relèvent dès la reprise, la plus jeune repousse ensuite', () => {
    const before = midWeekSave.data.trees.filter((t) => t.felled);
    expect(before.map((t) => t.felledDay).sort((x, y) => (x ?? 0) - (y ?? 0))).toEqual([
      2, 2, 2, 2, 2, 3, 3, 3, 10,
    ]);
    const sim = restoreWorld(
      content,
      map,
      structuredClone(midWeekSave.data),
      midWeekSave.dataSchema,
      PLAYERS,
    );
    expect(sim.world.clock.day).toBe(11);
    const young = sim.world.trees.filter((t) => t.felled);
    expect(young.map((t) => t.felledDay)).toEqual([10]);
    const tree = young[0];
    if (tree === undefined) throw new Error('souche du jour 10 attendue');
    expect(treeStage(sim, tree)).toBe('stump');
    expect(sim.world.trees.filter((t) => !t.felled)).toHaveLength(sim.world.trees.length - 1);
    morning(sim);
    expect(treeStage(sim, tree)).toBe('sapling');
    dawnOf(sim, 16);
    expect(tree.felled).toBe(false);
  });

  it('la lisière ne se vide jamais pour de bon: abattue chaque jour pendant 20 jours, elle est entière 6 jours après', () => {
    const sim = newSim(SEED);
    dawnOf(sim, 1);
    const total = sim.world.trees.length;
    expect(total).toBe(12);
    const felledOn = new Map<string, number>();
    for (let day = 1; day <= 20; day++) {
      dawnOf(sim, day);
      for (const tree of sim.world.trees) {
        // Personne ne reste à terre plus longtemps que souche et rejet réunis.
        const since = felledOn.get(tree.id);
        if (tree.felled && since !== undefined) {
          expect(day - since, `${tree.id} abattu le ${since}`).toBeLessThan(
            s.trees.stumpDays + s.trees.saplingDays,
          );
        }
        if (tree.felled) continue;
        fell(sim, axeman(sim, tree), tree);
        felledOn.set(tree.id, day);
      }
      expect(sim.world.trees.every((t) => t.felled)).toBe(true);
    }
    dawnOf(sim, 20 + s.trees.stumpDays + s.trees.saplingDays);
    expect(sim.world.trees.filter((t) => !t.felled)).toHaveLength(total);
  });
});

describe('cueillette de la lisière (T8-21, section 5.2)', () => {
  const forage = s.forage;
  if (forage === null) throw new Error('réglages de cueillette attendus');
  const none = new Set<string>();

  it('aucun coin garni avant le jour 16; ensuite seulement des cueillettes de saison du coin, posées sur le coin', () => {
    const sim = newSim(SEED);
    const corners = forage.points.map((p) => p.point);
    const onCorner = (): { item: string; point: string }[] =>
      sim.world.groundItems.flatMap((g) => {
        const point = corners.find((id) => {
          const at = map.points[id];
          return (
            at !== undefined && Math.hypot(at.x - g.pos.x, at.y - g.pos.y) <= FORAGE_CORNER_RADIUS
          );
        });
        return point === undefined ? [] : [{ item: g.item, point }];
      });
    for (let day = 2; day <= 15; day++) {
      morning(sim);
      expect(onCorner(), `jour ${day}`).toEqual([]);
    }
    let seen = 0;
    for (let day = 16; day <= 60; day++) {
      morning(sim);
      const season = seasonOfDay(s, day);
      for (const { item, point } of onCorner()) {
        const allowed = forage.points.find((p) => p.point === point)?.items ?? [];
        expect(allowed, `${item} au jour ${day} en ${point}`).toContain(item);
        expect(
          forage.items.find((i) => i.item === item)?.seasons,
          `${item} au jour ${day}`,
        ).toContain(season);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('1 000 graines: un coin vide se garnit avec une chance de 0,6 (0,58 à 0,62), la quantité dans la fourchette', () => {
    let filled = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const draw = drawForage(s, 'forage_edge_03', {
        seed,
        day: 30,
        pickedBefore: none,
        yesterday: 'sunny',
      });
      if (draw === null) continue;
      filled++;
      expect(draw.item).toBe('blackberry');
      expect(draw.count).toBeGreaterThanOrEqual(2);
      expect(draw.count).toBeLessThanOrEqual(3);
    }
    expect(filled / 1000).toBeGreaterThanOrEqual(0.58);
    expect(filled / 1000).toBeLessThanOrEqual(0.62);
    // L'hiver, rien.
    expect(
      drawForage(s, 'forage_edge_01', { seed: 1, day: 70, pickedBefore: none, yesterday: 'rain' }),
    ).toBeNull();
  });

  it('girolles trois fois plus le lendemain d’une pluie; coup de pouce aux cueillettes jamais cueillies', () => {
    const weight = (yesterday: 'sunny' | 'rain', picked: Set<string>): number =>
      forageCandidates(forage, 'forage_edge_02', 'summer', {
        pickedBefore: picked,
        yesterday,
      }).find((c) => c.def.item === 'chanterelle')?.weight ?? 0;
    const known = new Set(['chanterelle']);
    expect(weight('rain', known)).toBe(3 * weight('sunny', known));
    expect(weight('sunny', none)).toBe(forage.unseenFactor * weight('sunny', known));
    let rainy = 0;
    let dry = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      const after = (y: 'sunny' | 'rain'): boolean =>
        drawForage(s, 'forage_edge_05', { seed, day: 30, pickedBefore: known, yesterday: y })
          ?.item === 'chanterelle';
      if (after('rain')) rainy++;
      if (after('sunny')) dry++;
    }
    expect(rainy).toBeGreaterThan(dry * 1.5);
  });

  it('une cueillette de l’été disparaît pendant la nuit du changement de saison; un coin occupé ne se garnit pas', () => {
    const sim = newSim(SEED);
    dawnOf(sim, 42);
    const at = map.points.forage_edge_03;
    if (at === undefined) throw new Error('point forage_edge_03 attendu');
    sim.world.groundItems = sim.world.groundItems.filter(
      (g) => Math.hypot(g.pos.x - at.x, g.pos.y - at.y) > FORAGE_CORNER_RADIUS,
    );
    sim.world.groundItems.push({
      id: 'g-test',
      item: 'blackberry',
      quality: 'ordinary',
      count: 2,
      pos: { ...at },
    });
    morning(sim);
    expect(seasonOfDay(s, sim.world.clock.day)).toBe('autumn');
    expect(sim.world.groundItems.some((g) => g.id === 'g-test')).toBe(false);
    // Un objet posé sur le coin (un pissenlit de la quête d'Odette): rien d'autre ne s'y ajoute.
    const sim2 = newSim(SEED);
    dawnOf(sim2, 16);
    sim2.world.groundItems = [
      { id: 'g-odette', item: 'dandelion', quality: 'ordinary', count: 1, pos: { ...at } },
    ];
    for (let day = 17; day <= 21; day++) morning(sim2);
    const there = sim2.world.groundItems.filter(
      (g) => Math.hypot(g.pos.x - at.x, g.pos.y - at.y) <= FORAGE_CORNER_RADIUS,
    );
    expect(there.map((g) => g.id)).toEqual(['g-odette']);
  });
});

describe('poissons par saison et attente selon le temps (T8-22, section 5.3)', () => {
  it('poids par saison, jamais de truite l’hiver; le printemps garde ceux de la démo', () => {
    const sim = newSim(SEED);
    expect(fishWeightsOn(sim, 5)).toEqual({ gudgeon: 6, chub: 3, trout: 2 });
    expect(fishWeightsOn(sim, 5)).toEqual(s.feel.fishWeights);
    expect(fishWeightsOn(sim, 30)).toEqual({ gudgeon: 6, chub: 4, trout: 1 });
    expect(fishWeightsOn(sim, 50)).toEqual({ gudgeon: 5, chub: 3, trout: 3 });
    expect(fishWeightsOn(sim, 70).trout).toBe(0);
  });

  it('attente x 0,8 sous la pluie, x 0,75 pendant la brume, à partir du jour 16 seulement', () => {
    const sim = newSim(SEED);
    const w = sim.world;
    w.clock.day = 12;
    w.weather = 'rain';
    expect(biteWaitFactor(sim)).toBe(1);
    w.clock.day = 20;
    expect(biteWaitFactor(sim)).toBeCloseTo(0.8);
    w.weather = 'sunny';
    expect(biteWaitFactor(sim)).toBe(1);
    w.morningMist = true;
    w.clock.minutes = 7 * HOUR;
    expect(biteWaitFactor(sim)).toBeCloseTo(0.75);
    w.clock.minutes = 11 * HOUR;
    expect(biteWaitFactor(sim)).toBe(1);
  });
});

describe('répliques du quotidien après la démo (T8-23, section 5.5)', () => {
  const BOUNDED_AFTER_DEMO = [
    'firmin_daily_week2',
    'odette_daily_week2',
    'basile_daily_week2',
    'firmin_crate_full',
  ];
  const MID_WEEK = ['firmin_mid_week2', 'odette_mid_week2', 'jeanne_mid_week2'];

  /** Une journée au jour `day`, à `minutes`, avec cette météo (sans jouer les matins). */
  function atDay(day: number, weather: 'sunny' | 'rain' = 'sunny', minutes = 10 * HOUR): Sim {
    const sim = newSim(SEED);
    sim.world.phase = 'day';
    sim.world.clock.day = day;
    sim.world.clock.minutes = minutes;
    sim.world.weather = weather;
    return sim;
  }

  const lines = (sim: Sim): string[] =>
    content.villagers.flatMap((v) => eligibleDailies(sim, v.id, 'p1').map((d) => d.id));

  it('les répliques bornées ne sont jamais dites après le jour 15, ou hors de leurs jours', () => {
    for (let day = 16; day <= 84; day++) {
      const sim = atDay(day, day % 2 === 0 ? 'rain' : 'sunny');
      const said = lines(sim);
      for (const id of BOUNDED_AFTER_DEMO) expect(said, `${id} au jour ${day}`).not.toContain(id);
      const weekday = (day - 1) % 7;
      // Mardi, mercredi, jeudi: 3, 4 et 5 (le jour 1 est un samedi).
      const midWeek = weekday >= 3 && weekday <= 5;
      for (const id of MID_WEEK) expect(said.includes(id), `${id} au jour ${day}`).toBe(midWeek);
      const season = seasonOfDay(s, day);
      expect(said.includes('jeanne_summer'), `jour ${day}`).toBe(
        season === 'spring' || season === 'summer',
      );
      if (day % 2 === 0)
        expect(said.includes('firmin_daily_rain'), `jour ${day}`).toBe(season !== 'winter');
    }
    // Pendant la démo, rien ne change.
    const demo = lines(atDay(12));
    for (const id of [...BOUNDED_AFTER_DEMO.slice(0, 3), ...MID_WEEK]) expect(demo).toContain(id);
  });

  it('une réplique de pluie n’est redite en priorité qu’après 28 jours sans l’avoir entendue', () => {
    const rain = ['firmin_daily_rain', 'firmin_rain2'];
    // Seulement le quotidien de Firmin: ses dialogues de quête et de rencontre sont déjà passés.
    const at = (day: number, weather: 'sunny' | 'rain', minutes: number): Sim => {
      const sim = atDay(day, weather, minutes);
      for (const d of Object.values(content.dialogues)) {
        if (d.villager === 'firmin' && d.kind !== 'daily')
          sim.world.dialoguesDone.push(d.id, `${d.id}@p1`);
      }
      return sim;
    };
    const first = at(30, 'rain', 11 * HOUR);
    expect(rain).toContain(pickDialogue(first, 'firmin', 'p1')?.id);
    // Entendues toutes deux au jour 20: le jour 30, elles rejoignent la réserve ordinaire.
    const heard = (sim: Sim, day: number): void => {
      for (const id of rain) sim.world.heard.p1[id] = day * MINUTES_PER_DAY + 9 * HOUR;
    };
    for (let i = 0; i < 20; i++) {
      const sim = at(30, 'rain', 11 * HOUR);
      heard(sim, 20);
      sim.rng.setState([i + 1, 2, 3, 4]);
      expect(rain, `tirage ${i}`).not.toContain(pickDialogue(sim, 'firmin', 'p1')?.id);
    }
    // 28 jours plus tard, de nouveau prioritaire.
    const later = at(48, 'rain', 11 * HOUR);
    heard(later, 20);
    // Tour 9: au jour 48 (automne), le lendemain de l'étape est déjà dit; la pluie d'automne s'ajoute aux répliques de pluie.
    later.world.dialoguesDone.push('firmin_autumn1@p1');
    expect([...rain, 'firmin_rain_au']).toContain(pickDialogue(later, 'firmin', 'p1')?.id);
    // La démo garde sa règle: la pluie du jour 12 reste prioritaire même entendue le jour 4.
    const demo = at(12, 'rain', 11 * HOUR);
    demo.world.heard.p1.firmin_daily_rain = 4 * MINUTES_PER_DAY + 9 * HOUR;
    expect(pickDialogue(demo, 'firmin', 'p1')?.priority).toBeGreaterThanOrEqual(5);
  });

  it('les 70 répliques nouvelles sont dans les données, avec leurs conditions', () => {
    const ids = Object.keys(content.dialogues);
    // Les répliques du tour 8, chez les habitants de la démo (les 15 de la 0.13 ont des identifiants du même genre).
    const demoVillagers = new Set(['firmin', 'odette', 'basile', 'jeanne', 'achille', 'solange']);
    const added = ids.filter((id) => /_(g\d|ls\d|su\d|rain2|day16)$/.test(id) && demoVillagers.has(content.dialogues[id]?.villager ?? ''));
    expect(added).toHaveLength(64 + 4);
    expect(ids).toContain('odette_rain_tomorrow');
    expect(ids).toContain('firmin_crate_full_week');
    expect(content.dialogues.basile_day16?.once).toBe('player');
    expect(content.dialogues.firmin_rain2?.priority).toBe(5);
    // Aucune pendant la démo.
    const demo = lines(atDay(14, 'rain'));
    expect(demo.filter((id) => added.includes(id))).toEqual([]);
  });
});

describe("envies d'après la démo (T8-25, section 5.4)", () => {
  function playMornings(
    sim: Sim,
    until: number,
  ): {
    day: number;
    p1: string | null;
    p2: string | null;
    shared: [string | null, string | null];
  }[] {
    const out = [];
    while (sim.world.clock.day < until) {
      morning(sim);
      const [a, b] = sim.world.characters;
      out.push({
        day: sim.world.clock.day,
        p1: a?.envie?.id ?? null,
        p2: b?.envie?.id ?? null,
        shared: [a?.sharedEnvie?.id ?? null, b?.sharedEnvie?.id ?? null] as [
          string | null,
          string | null,
        ],
      });
    }
    return out;
  }

  it('envie à deux les jours 16, 19, 22..., la même chez les deux, jamais la même en 14 jours; personnelles jamais deux fois en 7 jours', () => {
    for (const seed of [SEED, 1, 2, 3]) {
      const days = playMornings(newSim(seed), 60);
      const shared = days.filter((d) => d.day >= 16 && d.shared[0] !== null);
      for (const d of days.filter((x) => x.day >= 16)) {
        const due = (d.day - 16) % 3 === 0;
        expect(d.shared[0] !== null, `graine ${seed}, jour ${d.day}`).toBe(due);
        expect(d.shared[1]).toBe(d.shared[0]);
      }
      for (let i = 0; i < shared.length; i++) {
        for (let j = i + 1; j < shared.length; j++) {
          const a = shared[i];
          const b = shared[j];
          if (a === undefined || b === undefined || b.day - a.day >= 14) continue;
          expect(b.shared[0], `graine ${seed}: jours ${a.day} et ${b.day}`).not.toBe(a.shared[0]);
        }
      }
      for (const who of ['p1', 'p2'] as const) {
        for (let i = 0; i < days.length; i++) {
          const today = days[i]?.[who];
          if (today === null || today === undefined) continue;
          const week = days.slice(Math.max(0, i - 6), i).map((d) => d[who]);
          expect(week, `graine ${seed}, ${who}, jour ${days[i]?.day}`).not.toContain(today);
        }
      }
      expect(sharedBounded(newSim(seed))).toBe(true);
    }
  });

  /** `sharedEnvieRecent` reste borné à 14 jours. */
  function sharedBounded(sim: Sim): boolean {
    playMornings(sim, 50);
    return sim.world.sharedEnvieRecent.every((e) => 50 - e.day < s.envies.sharedNoRepeatDays);
  }

  it('coup de pouce aux envies jamais reçues: plus d’envies neuves après la démo qu’avec un tirage uniforme', () => {
    const fresh = (c: Content): number => {
      let count = 0;
      for (const seed of [11, 12, 13, 14, 15, 16]) {
        const sim = newSim(seed, c);
        playMornings(sim, 15);
        const before = new Set(sim.world.characters.flatMap((x) => x.envieHistory));
        playMornings(sim, 30);
        const after = sim.world.characters.flatMap((x) => x.envieHistory.slice(15));
        count += after.filter((id) => !before.has(id)).length;
      }
      return count;
    };
    const flat = structuredClone(content);
    flat.settings.envies.unseenFactor = 1;
    expect(fresh(content)).toBeGreaterThan(fresh(flat));
  });

  it('`real_bed` ne sort plus une fois le lit double posé (après la démo); `see_train` les samedis', () => {
    const sim = newSim(SEED);
    dawnOf(sim, 16);
    sim.world.quests.push({
      id: 'planks',
      status: 'done',
      step: 3,
      checklist: [],
      baselines: {},
      startedDay: 1,
    });
    const bed = content.envies.find((e) => e.id === 'real_bed');
    const train = content.envies.find((e) => e.id === 'see_train');
    if (bed === undefined || train === undefined)
      throw new Error('envies real_bed et see_train attendues');
    const ctx = { ...NO_CONTEXT, actor: 'p1' as const };
    expect(evaluateAll(sim, bed.availableWhen, ctx)).toBe(true);
    sim.world.counters.duo['placed:double_bed'] = 1;
    expect(evaluateAll(sim, bed.availableWhen, ctx)).toBe(false);
    for (let day = 17; day <= 40; day++) {
      morning(sim);
      for (const c of sim.world.characters) expect(c.envie?.id, `jour ${day}`).not.toBe('real_bed');
    }
    // Pendant la démo, rien ne change (la règle d'avant le tour 8).
    sim.world.clock.day = 12;
    expect(evaluateAll(sim, bed.availableWhen, ctx)).toBe(true);
    // Voir arriver le train: les jours 8 et 15, puis chaque samedi.
    const days = Array.from({ length: 50 }, (_, i) => i + 1).filter((day) => {
      sim.world.clock.day = day;
      return evaluateAll(sim, train.availableWhen, ctx);
    });
    expect(days).toEqual([8, 15, 22, 29, 36, 43, 50]);
  });
});
