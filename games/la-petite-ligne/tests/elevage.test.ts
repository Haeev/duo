// Élevage de la 0.12 (conception section 4, critères CA-L1 à CA-L8 du lot L-élevage): bonheur des
// poules avec plancher, grain, couvée de sept nuits, chèvre au piquet loin de la voie, traite seul ou
// à deux, noms à tour de rôle, migration des formats 8 et 11 vers le format courant, contrat des quêtes.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ControlFrame } from '../src/etat/actions';
import { railDistance } from '../src/etat/elevage';
import type { CharacterId } from '../src/etat/types';
import { decodeSave, restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { goatAct, morningGoats, plantStake, spawnGoat, leadGoat } from '../src/simulation/chevres';
import { DATA_SCHEMA, SIM_HZ } from '../src/simulation/constantes';
import type { Sim } from '../src/simulation/contexte';
import {
  feedHens,
  morningEggs,
  nameAnimal,
  petAnimal,
  requestName,
  spawnHens,
  startBrood,
} from '../src/simulation/poules';
import { step } from '../src/simulation/pas';
import { addToBag, countInBag } from '../src/simulation/sac';
import { contentAndMap } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const REFERENCE = 'format-8-ete-jour-25.json';

function reference(file = REFERENCE): { dataSchema: number; data: unknown } {
  const url = new URL(`./donnees/sauvegardes/${file}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as {
    dataSchema: number;
    data: unknown;
  };
}

function load(): Sim {
  const { content, map } = contentAndMap();
  const ref = reference();
  return restoreWorld(content, map, decodeSave(ref.data), ref.dataSchema, [A, B]);
}

/** Une aube à la main: le jour suivant, puis les règles du matin de l'élevage. */
function dawn(sim: Sim): void {
  sim.world.clock.day += 1;
  morningEggs(sim);
  morningGoats(sim);
}

function frame(actHeld: boolean): ControlFrame {
  return { seq: 0, moveX: 0, moveY: 0, actHeld };
}

describe('élevage de la 0.12', () => {
  // Le format 11 précède l'élevage (format 12); le format 8 prouve la chaîne entière des migrations.
  it.each([
    [REFERENCE, 8],
    ['format-11-ete-jour-25.json', 11],
  ])(
    'CA-L8: %s (format %i) passe au format courant sans perte, poules à 60, un sac de grain au cellier',
    (file, schema) => {
      const ref = reference(file);
      expect(ref.dataSchema).toBe(schema);
      const before = ref.data as {
        hens: { id: string; name: string; happiness?: number }[];
        purse: number;
        cellar: { item: string }[];
      };
      expect('breeding' in (ref.data as Record<string, unknown>)).toBe(false);
      expect(before.hens.length).toBeGreaterThan(0);
      expect(before.hens.every((h) => h.happiness === undefined)).toBe(true);
      const { content, map } = contentAndMap();
      const sim = restoreWorld(content, map, decodeSave(ref.data), ref.dataSchema, [A, B]);
      expect(DATA_SCHEMA).toBeGreaterThanOrEqual(12);
      expect(sim.world.hens.map((h) => [h.id, h.name])).toEqual(
        before.hens.map((h) => [h.id, h.name]),
      );
      expect(sim.world.hens.every((h) => h.happiness === 60)).toBe(true);
      expect(sim.world.purse).toBe(before.purse);
      expect(sim.world.breeding.goats).toEqual([]);
      expect(sim.world.breeding.rooster).toBeNull();
      expect(sim.world.cellar.some((s) => s.item === 'grain_sack')).toBe(true);
      expect(sim.world.unlockedRecipes).toContain('cook_fresh_cheese');
      // Écrite au format courant et relue à ce format, elle redonne le même élevage.
      const snap = snapshotOf(sim);
      expect(snap.dataSchema).toBe(DATA_SCHEMA);
      const again = restoreWorld(
        sim.content,
        sim.map,
        JSON.parse(JSON.stringify(snap.data)) as unknown,
        snap.dataSchema,
        [A, B],
      );
      expect(again.world.hens.map((h) => h.happiness)).toEqual(
        sim.world.hens.map((h) => h.happiness),
      );
    },
  );

  it('CA-L1 et CA-L2: nourrie seulement, une poule garde son bonheur; sans aucun soin, ni poule ni chèvre ne descend sous 30', () => {
    const sim = load();
    for (let d = 0; d < 10; d++) {
      sim.world.feederFilled = true;
      dawn(sim);
    }
    expect(sim.world.hens.map((h) => h.happiness)).toEqual([60, 60, 60]);
    spawnGoat(sim);
    for (let d = 0; d < 30; d++) dawn(sim);
    expect(sim.world.hens.every((h) => h.happiness === 30)).toBe(true);
    expect(sim.world.breeding.goats[0]?.happiness).toBe(30);
    // Aucune bête ne disparaît (CA-L3, ici sur 40 aubes).
    expect(sim.world.hens).toHaveLength(3);
    expect(sim.world.breeding.goats).toHaveLength(1);
  });

  it('le grain se compte après la démo: le premier sac est offert, puis il faut un sac dans le sac', () => {
    const sim = load();
    const p1 = sim.world.characters[0];
    if (p1 === undefined) throw new Error('p1');
    sim.world.feederFilled = false;
    feedHens(sim, p1);
    expect(sim.world.feederFilled).toBe(true);
    expect(sim.world.breeding.grainRations).toBe(27);
    sim.world.breeding.grainRations = 1;
    sim.world.feederFilled = false;
    feedHens(sim, p1);
    expect(sim.world.feederFilled).toBe(false);
    addToBag(sim, p1, 'grain_sack', 'ordinary', 1);
    feedHens(sim, p1);
    expect(sim.world.feederFilled).toBe(true);
    expect(sim.world.breeding.grainRations).toBe(28);
    expect(countInBag(p1, 'grain_sack')).toBe(0);
  });

  it("caresser: +3 une fois par joueur et par jour, +2 la première fois qu'on l'appelle par son nom", () => {
    const sim = load();
    const [p1, p2] = sim.world.characters;
    const hen = sim.world.hens[0];
    if (p1 === undefined || p2 === undefined || hen === undefined) throw new Error('état');
    petAnimal(sim, p1, hen.id);
    petAnimal(sim, p1, hen.id);
    petAnimal(sim, p2, hen.id);
    expect(hen.happiness).toBe(60 + 3 + 2 + 3);
  });

  it('CA-L4: trois œufs, sept nuits, 0 à 3 poussins, en moyenne 2,25 éclos et 1,7 poussine sur 1 000 graines', () => {
    const sim = load();
    const p1 = sim.world.characters[0];
    const hen = sim.world.hens[0];
    if (p1 === undefined || hen === undefined) throw new Error('état');
    spawnHens(sim, 'rooster', 1, [], 'chicken_coop');
    sim.world.flags.push('brood_enabled');
    expect(sim.world.breeding.rooster).not.toBeNull();
    // Trois poules et trois œufs: il faut les neuf places du poulailler agrandi.
    sim.world.improvements.coop_extension = {
      paid: 800,
      planks: 0,
      funded: true,
      builtDay: sim.world.clock.day,
    };
    hen.happiness = 75;
    addToBag(sim, p1, 'egg', 'ordinary', 3);
    const eggsBefore = countInBag(p1, 'egg');
    startBrood(sim, p1, hen.id);
    const brood = sim.world.breeding.brood;
    expect(brood?.eggs).toBe(3);
    if (brood === null) throw new Error('couvée');
    expect(countInBag(p1, 'egg')).toBe(eggsBefore - 3);
    // Six nuits: rien n'éclot encore, et la couveuse ne pond pas.
    for (let d = 0; d < 6; d++) {
      sim.world.feederFilled = true;
      dawn(sim);
    }
    expect(sim.world.breeding.chicks).toHaveLength(0);
    expect(hen.lastEggDay ?? 0).toBeLessThan(brood.startDay);
    let hatched = 0;
    let pullets = 0;
    const startDay = brood.startDay;
    for (let seed = 1; seed <= 1000; seed++) {
      sim.world.seed = seed;
      sim.world.breeding.chicks = [];
      sim.world.breeding.naming = [];
      sim.world.breeding.brood = { ...brood };
      sim.world.clock.day = startDay + 6;
      dawn(sim);
      const n = sim.world.breeding.chicks.length;
      expect(n).toBeLessThanOrEqual(3);
      hatched += n;
      pullets += sim.world.breeding.chicks.filter((c) => c.roosterling !== true).length;
    }
    expect(hatched / 1000).toBeGreaterThan(2.15);
    expect(hatched / 1000).toBeLessThan(2.35);
    expect(pullets / 1000).toBeGreaterThan(1.6);
    expect(pullets / 1000).toBeLessThan(1.8);
  });

  it('CA-L4 (capacité): jamais plus de poules et poussines que de places', () => {
    const sim = load();
    const p1 = sim.world.characters[0];
    if (p1 === undefined) throw new Error('p1');
    spawnHens(sim, 'rooster', 1, [], 'chicken_coop');
    sim.world.flags.push('brood_enabled');
    for (const h of sim.world.hens) h.happiness = 90;
    // Cinq places: trois poules et trois œufs ne tiennent pas sans l'appentis.
    addToBag(sim, p1, 'egg', 'ordinary', 3);
    const hen = sim.world.hens[0];
    if (hen === undefined) throw new Error('poule');
    startBrood(sim, p1, hen.id);
    expect(sim.world.breeding.brood).toBeNull();
    sim.world.improvements.coop_extension = {
      paid: 800,
      planks: 0,
      funded: true,
      builtDay: sim.world.clock.day,
    };
    startBrood(sim, p1, hen.id);
    expect(sim.world.breeding.brood?.hen).toBe(hen.id);
  });

  it("CA-L5: chaque place de pâture est à 3,5 m au moins de la voie, et la corde de 2,5 m garde la chèvre à plus d'un mètre", () => {
    const { content, map } = contentAndMap();
    const goats = content.settings.goats;
    if (goats === null) throw new Error('réglages');
    expect(goats.spots).toHaveLength(5);
    for (const id of goats.spots) {
      const at = map.points[id];
      expect(at, id).toBeDefined();
      if (at === undefined) continue;
      expect(railDistance(map, at), id).toBeGreaterThanOrEqual(goats.railClearance);
      for (let k = 0; k < 64; k++) {
        const a = (k / 64) * Math.PI * 2;
        const p = {
          x: at.x + Math.cos(a) * goats.ropeLength,
          y: at.y + Math.sin(a) * goats.ropeLength,
        };
        expect(railDistance(map, p), id).toBeGreaterThan(1);
      }
    }
  });

  it('la chèvre se mène et se plante sur une place; hors des places, le piquet est refusé', () => {
    const sim = load();
    const p1 = sim.world.characters[0];
    if (p1 === undefined) throw new Error('p1');
    sim.world.clock.minutes = 8 * 60;
    spawnGoat(sim);
    const goat = sim.world.breeding.goats[0];
    if (goat === undefined) throw new Error('chèvre');
    leadGoat(sim, p1, goat);
    expect(goat.led).toBe('p1');
    p1.pos = { x: 15.5, y: 15.6 };
    plantStake(sim, p1);
    expect(goat.led).toBe('p1');
    expect(p1.notifications.at(-1)?.key).toBe('goat_stake_rail');
    p1.pos = { x: 8.5, y: 33.4 };
    plantStake(sim, p1);
    expect(goat.led).toBeNull();
    expect(goat.stake).toBe('goat_graze_04');
    expect(goat.freshToday).toBe(true);
  });

  it("CA-L6: traire seul prend 6 s, tenue par l'autre 3 s (et un bidon à 55 de bonheur)", () => {
    const ticksToMilk = (together: boolean): number => {
      const sim = load();
      const [p1, p2] = sim.world.characters;
      if (p1 === undefined || p2 === undefined) throw new Error('état');
      sim.world.clock.minutes = 8 * 60;
      sim.world.clock.running = false;
      spawnGoat(sim);
      const goat = sim.world.breeding.goats[0];
      if (goat === undefined) throw new Error('chèvre');
      const spot = sim.map.points[goat.stake];
      if (spot === undefined) throw new Error('place');
      goat.pos = { ...spot };
      goat.wander = { ...spot };
      p1.pos = { x: spot.x - 0.8, y: spot.y };
      p2.pos = { x: spot.x + 0.8, y: spot.y };
      goatAct(sim, p1, goat, 'milk');
      if (together) goatAct(sim, p2, goat, 'goat_hold');
      const controls: Partial<Record<CharacterId, ControlFrame>> = {
        p1: frame(true),
        p2: frame(together),
      };
      let ticks = 0;
      while (goat.milkedDay === null && ticks < SIM_HZ * 20) {
        step(sim, { controls, intents: [] });
        ticks += 1;
      }
      expect(countInBag(p1, 'milk_can')).toBe(1);
      return ticks;
    };
    expect(Math.abs(ticksToMilk(false) - 6 * SIM_HZ)).toBeLessThanOrEqual(2);
    expect(Math.abs(ticksToMilk(true) - 3 * SIM_HZ)).toBeLessThanOrEqual(2);
  });

  it("les noms se choisissent à tour de rôle, parmi trois, et seul celui dont c'est le tour choisit", () => {
    const sim = load();
    const [p1, p2] = sim.world.characters;
    if (p1 === undefined || p2 === undefined) throw new Error('état');
    spawnHens(sim, 'rooster', 1, [], 'chicken_coop');
    const rooster = sim.world.breeding.rooster;
    const first = sim.world.breeding.naming[0];
    if (rooster === null || first === undefined) throw new Error('coq');
    expect(first.options).toHaveLength(3);
    const other = first.by === 'p1' ? p2 : p1;
    const chooser = first.by === 'p1' ? p1 : p2;
    nameAnimal(sim, other, rooster.id, first.options[0] ?? '');
    expect(rooster.name).toBe('');
    nameAnimal(sim, chooser, rooster.id, first.options[1] ?? '');
    expect(rooster.name).toBe(first.options[1]);
    requestName(sim, 'x', 'chick', sim.content.settings.hens.care?.chickNames ?? []);
    expect(sim.world.breeding.naming[0]?.by).toBe(other.id);
    expect(sim.world.breeding.naming[0]?.options).not.toContain(rooster.name);
  });
});

describe('contrat des quêtes de la 0.12 (README des données, section 3.1)', () => {
  it('les drapeaux des quêtes amènent le coq et la chevrette; noms, couvée et piquet posent leurs compteurs', () => {
    const sim = load();
    sim.world.flags.push('rooster_arrived', 'goat_arrived');
    sim.world.clock.minutes = 8 * 60;
    step(sim, { controls: {}, intents: [] });
    const rooster = sim.world.breeding.rooster;
    const goat = sim.world.breeding.goats[0];
    if (rooster === null || goat === undefined) throw new Error('bêtes');
    expect(sim.world.breeding.goats).toHaveLength(1);
    for (const id of [rooster.id, goat.id]) {
      const req = sim.world.breeding.naming[0];
      const who = sim.world.characters.find((c) => c.id === req?.by);
      if (req === undefined || who === undefined) throw new Error('nom');
      nameAnimal(sim, who, id, req.options[0] ?? '');
    }
    expect(sim.world.counters.duo['animal_named:rooster']).toBe(1);
    expect(sim.world.counters.duo['animal_named:goat']).toBe(1);
    // Sans `brood_enabled`, pas de couvée, même avec le coq.
    const p1 = sim.world.characters[0];
    const hen = sim.world.hens[0];
    if (p1 === undefined || hen === undefined) throw new Error('état');
    sim.world.improvements.coop_extension = {
      paid: 800,
      planks: 0,
      funded: true,
      builtDay: sim.world.clock.day,
    };
    hen.happiness = 90;
    addToBag(sim, p1, 'egg', 'ordinary', 3);
    startBrood(sim, p1, hen.id);
    expect(sim.world.breeding.brood).toBeNull();
    sim.world.flags.push('brood_enabled');
    startBrood(sim, p1, hen.id);
    expect(sim.world.counters.duo.brood_started).toBe(1);
    // Le piquet planté à une place non broutée la veille: `goat_grazed_spot`, une fois par jour.
    leadGoat(sim, p1, goat);
    p1.pos = { x: 8.5, y: 33.4 };
    plantStake(sim, p1);
    expect(sim.world.counters.duo.goat_grazed_spot).toBe(1);
    leadGoat(sim, p1, goat);
    p1.pos = { x: 4.5, y: 31.4 };
    plantStake(sim, p1);
    expect(sim.world.counters.duo.goat_grazed_spot).toBe(1);
  });
});
