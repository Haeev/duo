// Barrières de passage à niveau (brique `barrier`): deux lisses posées par le test en travers de
// la route du Gué, de part et d'autre de la voie, sur une copie d'Aubrune. Baissées tant que le
// passage sonne (train du samedi), elles barrent la route depuis la route seulement; levées, on
// passe. Rien n'est sauvegardé: la reprise retrouve le même état. Le rendu anime la lisse.
import { Group, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import { DATA_SCHEMA } from '../src/etat/monde';
import { BarrierLayer } from '../src/rendu/lieu/barrieres';
import { DECOR_MANIFEST } from '../src/rendu/lieu/decors-manifeste';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { barrierClosed, barriersOf, crossesClosedBarrier } from '../src/simulation/monde/barrieres';
import { calendarOf } from '../src/simulation/monde/calendrier';
import { idleInput, type StepInput } from '../src/simulation/noyau/entrees';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { remember } from '../src/simulation/regles/memoire';
import { contentWith, contextOf, wait } from './aides-l3';
import { MEMBERS, newSim } from './aides';

type Json = Record<string, unknown>;
const AUBRUNE = 'aubrune';

/** Aubrune avec deux lisses posées par le test; la sud est absente si `hidden` (comme à la fête). */
function withGates(hidden = false): Content {
  return contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Json };
    settings.start = { ...settings.start, place: AUBRUNE, minute: 600 };
    const map = files['lieux/aubrune/carte.json'] as { objects: Json[] };
    const gate = (id: string, y: number, rotation: number): Json => ({
      id,
      type: 'lisse-de-passage-a-niveau',
      x: 182.5,
      y,
      rotation,
      ...(hidden && id === 'essai-lisse-sud'
        ? { when: [{ type: 'remembered', key: 'essai.jamais', equals: true }] }
        : {}),
      pourquoi: 'lisse posée par le test, en travers de la route du Gué',
    });
    // Le plan pose désormais ses propres lisses au même passage: le test travaille sur les siennes.
    map.objects = map.objects.filter(
      (o) => (o as { type?: string }).type !== 'lisse-de-passage-a-niveau',
    );
    map.objects.push(gate('essai-lisse-nord', 95.5, 0), gate('essai-lisse-sud', 99.5, 2));
  });
}

const content = withGates();
const place = content.places[AUBRUNE] ?? fail('Aubrune absente');
const SATURDAY =
  Array.from({ length: 7 }, (_, i) => i + 1).find(
    (day) => calendarOf(content, day).weekday === 'saturday',
  ) ?? 6;

function fail(message: string): never {
  throw new Error(message);
}

/** Un samedi après l'acte 2 (le train vient), à l'heure dite; joueur 0 en (x, y), l'autre au quai. */
function saturday(minutes: number, x: number, y: number, world: Content = content): Sim {
  const sim = newSim(world);
  sim.world.common.day = SATURDAY;
  sim.world.minutes = minutes;
  remember(contextOf(sim), 'aubrune.acte2.fini', true, 'duo');
  Object.assign(sim.world.players[0].body, { x, y, speed: 0 });
  Object.assign(sim.world.players[1].body, { x: 200, y: 101.5, speed: 0 });
  return sim;
}

/** Le joueur 0 marche vers le sud (`dir` 1) ou le nord (-1) pendant `seconds`. */
function walk(sim: Sim, dir: 1 | -1, seconds: number): void {
  const input: StepInput = { ...idleInput(0), moveY: dir };
  wait(sim, seconds, [input, idleInput(0)]);
}

describe('barrières de passage à niveau', () => {
  it('se lient au passage de la route du Gué, la normale vers la voie', () => {
    const list = barriersOf({ content }, place);
    expect(list.map((b) => b.object.id)).toEqual(['essai-lisse-nord', 'essai-lisse-sud']);
    expect(list.map((b) => Math.round(b.crossing.x * 2) / 2)).toEqual([182.5, 182.5]);
    expect(list.map((b) => b.bar.ny)).toEqual([1, -1]);
    expect(list[0]?.bar.half).toBe(2.5);
  });

  it('levées hors sonnerie: on traverse la route', () => {
    const sim = saturday(590, 182.5, 93.5);
    expect(barrierClosed(sim, place, barriersOf(sim, place)[0] ?? fail('lisse'))).toBe(false);
    walk(sim, 1, 3);
    expect(sim.world.players[0].body.y).toBeGreaterThan(97);
  });

  it('baissées pendant la sonnerie: la route est barrée, qui est sur la voie en sort', () => {
    // 598: le train du samedi freine vers le quai, la sonnerie sonne (596 à 603,5).
    const sim = saturday(598, 182.5, 93.5);
    const [north] = barriersOf(sim, place);
    expect(barrierClosed(sim, place, north ?? fail('lisse'))).toBe(true);
    walk(sim, 1, 2);
    const body = sim.world.players[0].body;
    expect(body.y).toBeLessThanOrEqual(95.5 - 0.3 + 1e-6);
    expect(body.y).toBeGreaterThan(95);
    // Engagé sur la voie quand elles tombent: il sort par le nord sans être retenu.
    const engaged = saturday(598, 182.5, 97.5);
    walk(engaged, -1, 2);
    expect(engaged.world.players[0].body.y).toBeLessThan(94.5);
    // Les habitants: devant la lisse ils attendent, depuis la voie ils passent.
    expect(crossesClosedBarrier(sim, place, 182.5, 95.1, 182.5, 95.3, 0.3)).toBe(true);
    expect(crossesClosedBarrier(sim, place, 182.5, 96.2, 182.5, 95.4, 0.3)).toBe(false);
    // À l'accotement (case 179), hors de la lisse, on passe.
    expect(crossesClosedBarrier(sim, place, 179.5, 94.8, 179.5, 95.6, 0.3)).toBe(false);
  });

  it('reprise: la sauvegarde ne stocke rien, la lisse se retrouve baissée', () => {
    const sim = saturday(598, 182.5, 93.5);
    const saved = JSON.parse(JSON.stringify(snapshotOf(sim.world))) as { data: unknown };
    // L'objet de carte n'a aucune brique à mémoire: rien d'autre que sa place vide.
    expect(JSON.stringify(saved)).toContain('"essai-lisse-nord":{}');
    const restored = restoreWorld(content, { dataSchema: DATA_SCHEMA, data: saved.data }, MEMBERS);
    if (!restored.ok) throw new Error(restored.reason);
    const resumed = createSim(content, restored.world);
    const [north] = barriersOf(resumed, place);
    expect(barrierClosed(resumed, place, north ?? fail('lisse'))).toBe(true);
  });

  it('une lisse absente (meuble conditionné, la fête pose la sienne) ne barre rien', () => {
    const hidden = withGates(true);
    const other = hidden.places[AUBRUNE] ?? fail('Aubrune absente');
    const sim = saturday(598, 182.5, 101.5, hidden);
    const south = barriersOf(sim, other)[1] ?? fail('lisse sud');
    expect(barrierClosed(sim, other, south)).toBe(false);
    walk(sim, -1, 2);
    expect(sim.world.players[0].body.y).toBeLessThan(98.5);
  });

  it('à l’écran: posée d’un coup, puis se baisse et se relève à sa vitesse', () => {
    const node = DECOR_MANIFEST.models['crossing-gate']?.nodes?.lisse ?? fail('nœud lisse');
    const up = ((node.levee ?? 0) * Math.PI) / 180;
    const gate = new Group();
    const lisse = new Group();
    lisse.name = 'lisse';
    gate.add(lisse);
    const objects = {
      objectOf: (id: string): Object3D | null => (id === 'essai-lisse-nord' ? gate : null),
    };
    const layer = new BarrierLayer(content, place);
    expect(layer.size).toBe(2);
    const sim = saturday(590, 182.5, 93.5);
    layer.update(1 / 60, sim.world, objects);
    expect(lisse.rotation.z).toBeCloseTo(up, 5);
    // La sonnerie part: la lisse descend en 4 s (fiche), pas d'un coup.
    sim.world.minutes = 598;
    layer.update(1, sim.world, objects);
    expect(lisse.rotation.z).toBeCloseTo(up * 0.75, 5);
    for (let i = 0; i < 4; i++) layer.update(1, sim.world, objects);
    expect(lisse.rotation.z).toBeCloseTo((node.baissee ?? 0) * (Math.PI / 180), 5);
    sim.world.minutes = 610;
    layer.update(2, sim.world, objects);
    expect(lisse.rotation.z).toBeCloseTo(up / 2, 5);
  });
});
