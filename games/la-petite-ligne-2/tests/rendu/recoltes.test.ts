// Récoltables à l'écran (`rendu/lieu/recoltes.ts`): états lus dans l'état transmis, cases du
// potager, repères, objets au sol, forme stable par exemplaire, effacement sur la largeur du
// houppier, et gabarits (culture, ressource et zone factices ajoutées par les seules données).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Group, InstancedMesh, MeshStandardMaterial, type Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { type Content, loadContent } from '../../src/donnees/charger';
import type { PlaceState } from '../../src/etat/lieu';
import type { WorldState } from '../../src/etat/monde';
import { DecorModels } from '../../src/rendu/lieu/decors';
import { DECOR_MANIFEST, type DecorManifest } from '../../src/rendu/lieu/decors-manifeste';
import { describeDynamic, describePlace } from '../../src/rendu/lieu/description';
import { type ModelSource, PlaceScene } from '../../src/rendu/lieu/lieu';
import {
  fieldVolumes,
  groundModelOf,
  harvestSignature,
  markerVolumes,
  objectState,
  placeStates,
} from '../../src/rendu/lieu/recoltes';
import { createPlaceState } from '../../src/simulation/noyau/monde';
import { dataFiles, newSim } from '../aides';

const files = dataFiles();
const content = loadContent(files);
const world = newSim(content).world;
const look = { content, world };

function bricksOf(type: string): Content['props'][string]['bricks'] {
  const prop = content.props[type];
  if (prop === undefined) throw new Error(type);
  return prop.bricks;
}

function place(id: string): Content['places'][string] {
  const found = content.places[id];
  if (found === undefined) throw new Error(id);
  return found;
}

function freshState(id: string, c: Content = content): PlaceState {
  const p = c.places[id];
  if (p === undefined) throw new Error(id);
  return createPlaceState(c, p);
}

describe('état montré d’un meuble', () => {
  const day = world.common.day;

  it('lit souche, buisson cueilli, rien, entamé et stock vide dans les briques', () => {
    const later = { work: 0, back: day + 2 };
    expect(objectState(look, bricksOf('chene'), { harvest: later })).toBe('stump');
    expect(objectState(look, bricksOf('ronces'), { harvest: later })).toBe('bare');
    expect(objectState(look, bricksOf('branches'), { harvest: later })).toBe('gone');
    expect(objectState(look, bricksOf('caillou'), { harvest: { work: 1, back: null } })).toBe(
      'chipped',
    );
    // Repoussé au jour dit: l'état de base, sans attendre un geste.
    expect(objectState(look, bricksOf('chene'), { harvest: { work: 0, back: day } })).toBeNull();
    expect(objectState(look, bricksOf('chene'), undefined)).toBeNull();
  });

  it('montre un pommier sans pommes tant que son stock n’est pas revenu', () => {
    const now = (day - 1) * 1440 + Math.floor(world.minutes);
    const empty = { gather: { left: 0, refillAt: now + 60 } };
    expect(objectState(look, bricksOf('pommier'), empty)).toBe('bare');
    expect(objectState(look, bricksOf('tas-de-bois'), empty)).toBe('bare');
    const back = { gather: { left: 0, refillAt: now } };
    expect(objectState(look, bricksOf('pommier'), back)).toBeNull();
  });

  it('change d’empreinte quand un arbre tombe, et seulement alors', () => {
    const aubrune = place('aubrune');
    const state = freshState('aubrune');
    const before = harvestSignature(look, aubrune, state);
    expect(harvestSignature(look, aubrune, state)).toBe(before);
    state.objects['chene-lisiere-1'] = { harvest: { work: 0, back: day + 3 } };
    expect(harvestSignature(look, aubrune, state)).not.toBe(before);
    expect(placeStates(look, aubrune, state).get('chene-lisiere-1')).toBe('stump');
  });
});

describe('potager', () => {
  it('pose chaque case à sa place: bêchée, arrosée, chaque culture à son stade, à arroser', () => {
    const aubrune = place('aubrune');
    const state = freshState('aubrune');
    const plot = { growth: 0, watered: false, days: 0, wet: 0, day: 1 };
    const cells: PlaceState['objects'][string]['field'] = {
      cells: [
        { ...plot, crop: null },
        { ...plot, crop: null, watered: true },
        { ...plot, crop: 'radis' },
        { ...plot, crop: 'radis', growth: 2, watered: true },
        { ...plot, crop: 'radis', growth: 4 },
        null,
        { ...plot, crop: 'tomate', growth: 5 },
      ],
      work: null,
    };
    state.objects.potager = { field: cells };
    const volumes = fieldVolumes(content, aubrune, state);
    const model = (id: string): string | null => volumes.find((v) => v.id === id)?.model ?? null;
    expect(model('potager-case-0')).toBe('garden-bed-tilled');
    expect(model('potager-case-1')).toBe('garden-bed-watered');
    expect(model('potager-plant-0')).toBeNull();
    expect(model('potager-plant-2')).toBe('crop-radis-0-thirsty');
    expect(model('potager-plant-3')).toBe('crop-radis-1');
    // Mûre: plus d'arrosoir à attendre.
    expect(model('potager-plant-4')).toBe('crop-radis-2');
    expect(model('potager-case-5')).toBeNull();
    expect(model('potager-plant-6')).toBe('crop-tomate-2-thirsty');
    // Grille de la simulation: 6 cases de large depuis le coin nord-ouest, centre de case.
    const bed = aubrune.map.objects.find((o) => o.id === 'potager');
    const sixth = volumes.find((v) => v.id === 'potager-case-6');
    if (bed === undefined || sixth === undefined) throw new Error('potager');
    expect(sixth.x).toBeCloseTo(bed.x - 3 + 0.5);
    expect(sixth.y).toBeCloseTo(bed.y - 2 + 1.5);
    // Toutes à la hauteur du potager (relief), dans son emprise.
    for (const volume of volumes) {
      expect(volume.foot).toEqual({ x: bed.x, y: bed.y });
      expect(Math.abs(volume.x - bed.x)).toBeLessThan(3);
      expect(Math.abs(volume.y - bed.y)).toBeLessThan(2);
    }
  });
});

describe('repères et objets au sol', () => {
  it('plante un repère de pêche sur la berge de chaque coin, tourné vers l’eau', () => {
    const aubrune = place('aubrune');
    const markers = markerVolumes(content, 'aubrune');
    const spots = aubrune.def.fishing ?? [];
    expect(spots.length).toBeGreaterThan(0);
    for (const spot of spots) {
      const marker = markers.find((m) => m.id === `peche-${spot.id}`);
      expect(marker, spot.id).toBeDefined();
      if (marker === undefined) continue;
      expect(marker.model).toBe('fishing-spot');
      const { x, y, w, h } = spot.area;
      // Sur la berge (trois cases au plus, un ponton s'enjambe), hors de toute zone bloquée.
      const dx = Math.max(x - marker.x, 0, marker.x - (x + w));
      const dy = Math.max(y - marker.y, 0, marker.y - (y + h));
      expect(Math.hypot(dx, dy), spot.id).toBeGreaterThan(0);
      expect(Math.hypot(dx, dy), spot.id).toBeLessThanOrEqual(3);
      const inBlocked = aubrune.map.blocked.some(
        (r) => marker.x >= r.x && marker.x < r.x + r.w && marker.y >= r.y && marker.y < r.y + r.h,
      );
      expect(inBlocked, spot.id).toBe(false);
    }
  });

  it('sème les touffes à insectes dans les zones de nature.json', () => {
    const markers = markerVolumes(content, 'essai-gare');
    const zone = content.book.nature['essai-gare']?.zones[0];
    const tufts = markers.filter((m) => m.model === 'insect-spot');
    expect(tufts.length).toBeGreaterThan(0);
    if (zone === undefined) throw new Error('zone');
    for (const tuft of tufts) {
      expect(tuft.x).toBeGreaterThanOrEqual(zone.area.x);
      expect(tuft.x).toBeLessThanOrEqual(zone.area.x + zone.area.w);
    }
  });

  it('montre ce qu’on a ramassé par le modèle de sa ressource, sinon un ballot', () => {
    expect(groundModelOf(content, 'pierre')).toBe('stone');
    expect(groundModelOf(content, 'buche')).toBe('dead-branches');
    expect(groundModelOf(content, 'pomme')).toBeNull();
    const state = freshState('essai-gare');
    state.ground.push(
      { id: 0, stack: { item: 'pierre', count: 1 }, x: 3, y: 3 },
      { id: 1, stack: { item: 'pomme', count: 2 }, x: 4, y: 3 },
    );
    const volumes = describeDynamic(content, state);
    expect(volumes.find((v) => v.id === 'sol-0')?.model).toBe('stone');
    const apples = volumes.find((v) => v.id === 'sol-1');
    expect(apples?.model).toBeNull();
    expect(apples?.standIn).toBe('bundle');
  });
});

/** Source factice: note chaque demande et rend un objet nommé « modèle|clé|état ». */
class Recorder implements ModelSource {
  readonly calls: string[] = [];
  instantiate(model: string, key?: string, state: string | null = null): Object3D {
    const name = `${model}|${key ?? ''}|${state ?? ''}`;
    this.calls.push(name);
    const group = new Group();
    group.name = name;
    return group;
  }
}

function materials(): { ground: MeshStandardMaterial; standIn: MeshStandardMaterial } {
  return { ground: new MeshStandardMaterial(), standIn: new MeshStandardMaterial() };
}

describe('scène du lieu', () => {
  it('demande chaque modèle avec l’identifiant de l’exemplaire, et ne refait que ce qui change', () => {
    const source = new Recorder();
    const scene = new PlaceScene(
      describePlace(content, place('aubrune'), [], undefined, false),
      materials(),
      source,
      false,
    );
    expect(source.calls).toContain('oak-tree|chene-lisiere-1|');
    const other = scene.root.getObjectByName('chene-lisiere-2');
    source.calls.length = 0;
    scene.setStates(
      new Map([
        ['chene-lisiere-1', 'stump'],
        ['branches-lisiere', 'gone'],
      ]),
    );
    expect(source.calls).toEqual(['oak-tree|chene-lisiere-1|stump']);
    // Le voisin n'est pas refait; les branches ramassées ne sont plus dessinées.
    expect(scene.root.getObjectByName('chene-lisiere-2')).toBe(other);
    expect(scene.root.getObjectByName('branches-lisiere')?.children).toHaveLength(0);
    source.calls.length = 0;
    scene.setStates(new Map());
    expect(source.calls.sort()).toEqual([
      'dead-branches|branches-lisiere|',
      'oak-tree|chene-lisiere-1|',
    ]);
    scene.dispose();
  });

  it('efface un arbre sur la largeur de son houppier, plus sur sa souche', async () => {
    const dir = fileURLToPath(new URL('../../assets/commun/decors/', import.meta.url));
    const loader = new GLTFLoader();
    const parse = (file: string): Promise<GLTF> => {
      const buffer = readFileSync(dir + file);
      return loader.parseAsync(
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
        '',
      );
    };
    const models = new DecorModels(DECOR_MANIFEST, parse);
    await models.ready;
    // Même forme, même cap, même taille pour le même exemplaire (hôte, invité, autre visite).
    const a = models.instantiate('oak-tree', 'chene-lisiere-1')?.children[0];
    const b = models.instantiate('oak-tree', 'chene-lisiere-1')?.children[0];
    expect(a?.name).toBe(b?.name);
    expect(a?.rotation.y).toBe(b?.rotation.y);
    expect(a?.scale.x).toBe(b?.scale.x);
    const stump = models.instantiate('oak-tree', 'chene-lisiere-1', 'stump')?.children[0];
    expect(stump?.name).toBe('oak-tree-stump');
    expect(stump?.rotation.y).toBe(a?.rotation.y);

    const scene = new PlaceScene(
      describePlace(content, place('aubrune'), [], undefined, false),
      materials(),
      models,
      false,
    );
    const tree = place('aubrune').map.objects.find((o) => o.id === 'chene-lisiere-1');
    if (tree === undefined) throw new Error('chene-lisiere-1');
    // Le joueur travaille sous le houppier, à 1,4 m du tronc, la caméra au sud-est.
    const feet = [{ x: tree.x - 1.4, y: 0, z: tree.y + 1.4 }];
    const toCamera = { x: 0.5, y: 0.75, z: 0.43 };
    scene.occlusion.update(1, feet, toCamera);
    expect(scene.occlusion.isHidden('chene-lisiere-1')).toBe(true);
    scene.setStates(new Map([['chene-lisiere-1', 'stump']]));
    scene.occlusion.update(1, feet, toCamera);
    expect(scene.occlusion.isHidden('chene-lisiere-1')).toBe(false);

    // Potager: un maillage instancié par modèle de case ou de plant, pas un objet par case.
    const state = freshState('aubrune');
    const plot = { growth: 0, watered: false, days: 0, wet: 0, day: 1 };
    state.objects.potager = {
      field: {
        cells: [
          { ...plot, crop: 'radis' },
          { ...plot, crop: 'radis' },
          { ...plot, crop: 'radis', watered: true },
          { ...plot, crop: null },
        ],
        work: null,
      },
    };
    scene.setDynamic(fieldVolumes(content, place('aubrune'), state));
    const batches = scene.root.children.filter((c) => c instanceof InstancedMesh);
    expect(batches.map((b) => `${b.name}:${String((b as InstancedMesh).count)}`).sort()).toEqual([
      'lot-crop-radis-0-thirsty:2',
      'lot-crop-radis-0:1',
      'lot-garden-bed-tilled:3',
      'lot-garden-bed-watered:1',
    ]);
    scene.setDynamic([]);
    expect(scene.root.children.some((c) => c instanceof InstancedMesh)).toBe(false);
    scene.dispose();
  });
});

describe('gabarits: ajoutés par les données, sans code', () => {
  it('une ressource, un meuble, une culture et une zone factices paraissent à l’écran', () => {
    const copy = JSON.parse(JSON.stringify(files)) as Record<string, unknown>;
    const resource = structuredClone(copy['commun/ressources/chene.json']) as Record<
      string,
      unknown
    >;
    copy['commun/ressources/souche-essai.json'] = { ...resource, id: 'souche-essai' };
    copy['commun/meubles/arbre-essai.json'] = {
      ...(copy['commun/meubles/chene.json'] as Record<string, unknown>),
      id: 'arbre-essai',
      model: 'fake-tree',
      bricks: [{ brick: 'harvest', resource: 'souche-essai' }],
    };
    copy['commun/cultures/culture-essai.json'] = {
      ...(copy['commun/cultures/radis.json'] as Record<string, unknown>),
      id: 'culture-essai',
      model: 'crop-fake',
      seed: 'graines-tomate',
    };
    delete copy['commun/cultures/tomate.json'];
    copy['lieux/aubrune/nature.json'] = {
      schema: 1,
      zones: [{ id: 'pre-essai', terrain: 'pre', area: { x: 150, y: 60, w: 8, h: 8 }, max: 2 }],
    };
    const fake = loadContent(copy);
    const sheet = { file: 'faux.glb', family: 'x', triangles: 1, size: { w: 1, d: 1, h: 1 } };
    const manifest: DecorManifest = {
      ...DECOR_MANIFEST,
      models: {
        ...DECOR_MANIFEST.models,
        'fake-tree': { ...sheet, states: { stump: 'fake-tree-stump' } },
        'fake-tree-stump': sheet,
        'crop-fake-0': sheet,
        'crop-fake-1': sheet,
      },
      crops: {
        ...DECOR_MANIFEST.crops,
        'crop-fake': { crop: 'culture-essai', stages: ['crop-fake-0', 'crop-fake-1'], thirsty: [] },
      },
    };
    const fakeWorld: WorldState = newSim(fake).world;
    const fakeLook = { content: fake, world: fakeWorld };
    const prop = fake.props['arbre-essai'];
    if (prop === undefined) throw new Error('arbre-essai');
    expect(
      objectState(fakeLook, prop.bricks, { harvest: { work: 0, back: fakeWorld.common.day + 1 } }),
    ).toBe('stump');
    const aubrune = fake.places.aubrune;
    if (aubrune === undefined) throw new Error('aubrune');
    const state = freshState('aubrune', fake);
    state.objects.potager = {
      field: {
        cells: [{ crop: 'culture-essai', growth: 4, watered: false, days: 1, wet: 0, day: 1 }],
        work: null,
      },
    };
    const volumes = fieldVolumes(fake, aubrune, state, manifest);
    expect(volumes.find((v) => v.id === 'potager-plant-0')?.model).toBe('crop-fake-1');
    const tufts = markerVolumes(fake, 'aubrune', manifest).filter((m) =>
      m.id.startsWith('insectes-pre-essai'),
    );
    expect(tufts).toHaveLength(4);
  });
});
