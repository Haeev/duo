// Rendu des trains (`rendu/lieu/trains.ts`): un train factice ajouté par les données paraît à
// l'écran sans une ligne de code, un véhicule par entrée de la rame (modèle livré, ou caisse
// provisoire s'il manque), posé sur la voie; sa lampe suit sa caisse et s'éteint à son départ.
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { ModelSource } from '../../src/rendu/lieu/lieu';
import { TrainLayer } from '../../src/rendu/lieu/trains';
import { calendarOf } from '../../src/simulation/monde/calendrier';
import { contentWith } from '../aides-l3';
import { newSim } from '../aides';

type Json = Record<string, unknown>;

const content = contentWith((files) => {
  const settings = files['commun/reglages.json'] as { start: Json };
  settings.start = { ...settings.start, place: 'aubrune', minute: 600 };
  files['lieux/aubrune/evenements/train-factice.json'] = {
    schema: 1,
    id: 'train-factice',
    name: 'Train factice',
    kind: 'other',
    when: { type: 'weekly', weekday: 'monday', seasons: [] },
    days: 7,
    hours: { from: 720, to: 760 },
    conditions: [],
    announce: false,
    activates: { facts: [], villagers: [], shop: null, scene: null, tune: null },
    train: {
      pourquoi: 'Un train de test: un modèle livré qui éclaire et un modèle qui manque.',
      consist: [
        { model: 'railcar', front: 7.26, back: 7.26 },
        { model: 'modele-absent', front: 5, back: 5 },
      ],
      track: 'ligne',
      comesFrom: 'start',
      leavesTo: 'start',
      stop: { point: 'quai', vehicle: 0, shift: 0 },
      arrival: { minutes: 4, distance: 60 },
      departure: { minutes: 4, distance: 60 },
    },
  };
});

/** Source qui ne livre que l'autorail: une caisse nommée, comme un modèle du manifeste. */
const source: ModelSource = {
  instantiate(model: string): Object3D | null {
    if (model !== 'railcar') return null;
    const group = new Group();
    group.add(new Mesh(new BoxGeometry(2.9, 3.9, 14.5), new MeshStandardMaterial()));
    return group;
  },
};

describe('trains à l’écran', () => {
  it('pose un train ajouté par les données, éclaire et éteint sa lampe, se libère', () => {
    const place = content.places.aubrune;
    if (place === undefined) throw new Error('Aubrune absente');
    const standIn = new MeshStandardMaterial();
    const layer = new TrainLayer(place, content, source, { standIn, ink: null }, () => 0);
    const sim = newSim(content);
    sim.world.common.day = 2;
    expect(calendarOf(content, 2).weekday).not.toBe('saturday');
    sim.world.minutes = 730;
    layer.update(1 / 60, sim.world, [], { x: 0, y: 1, z: 0 });
    const shown = layer.root.children.filter((child) => child.visible);
    expect(shown.map((child) => child.name).sort()).toEqual([
      'train-train-factice#0',
      'train-train-factice#1',
    ]);
    const [railcar, missing] = ['#0', '#1'].map((end) =>
      layer.root.children.find((child) => child.name === `train-train-factice${end}`),
    );
    // L'autorail au droit du point `quai` (x 204), sur la voie; la caisse provisoire derrière lui.
    expect(railcar?.position.x).toBeCloseTo(204, 5);
    expect(railcar?.position.z).toBeCloseTo(97.5, 5);
    expect(missing?.position.x).toBeCloseTo(204 - 7.26 - 5, 5);
    expect(layer.stats.vehicles).toBe(2);
    // La lampe de l'autorail (manifeste: `light`) suit sa caisse; elle est allumée tant qu'il est là.
    const lamp = layer.lamps[layer.lamps.length - 1];
    expect(lamp?.share).toBe(1);
    expect(lamp?.x).toBeCloseTo(204, 5);
    sim.world.minutes = 800;
    layer.update(1 / 60, sim.world, [], { x: 0, y: 1, z: 0 });
    expect(layer.root.children.some((child) => child.visible)).toBe(false);
    expect(lamp?.share).toBe(0);
    layer.dispose();
    expect(layer.lamps).toHaveLength(0);
    expect(layer.root.parent).toBeNull();
  });
});
