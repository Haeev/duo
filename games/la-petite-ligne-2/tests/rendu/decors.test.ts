// Décors livrés: manifeste, GLB lus dans Node, fiches de meubles qui pointent vers leurs modèles.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Box3, Group, Mesh } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { DecorModels } from '../../src/rendu/lieu/decors';
import {
  DECOR_MANIFEST,
  type DecorManifest,
  decorFiles,
  decorSeats,
} from '../../src/rendu/lieu/decors-manifeste';
import { CHARACTER_SETTINGS } from '../../src/rendu/personnages/reglages';
import { gameContent } from '../aides';

const dir = fileURLToPath(new URL('../../assets/commun/decors/', import.meta.url));
const loader = new GLTFLoader();

function parse(file: string): Promise<GLTF> {
  const buffer = readFileSync(dir + file);
  const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return loader.parseAsync(data, '');
}

const PROPS_WITHOUT_MODEL = [
  'armoire',
  'branches',
  'caillou',
  'chene',
  'coffre',
  'comptoir-buvette',
  'coquelicots',
  'cuisiniere',
  'etal-de-haches',
  'etal-de-haches-forgees',
  'etal-de-soupe',
  'etal-de-tourte',
  'four',
  'fruitier',
  'gros-chene',
  'lit-double',
  'lit-simple',
  'plan-de-travail',
  'point-de-fouille',
  'poteau-de-quai',
  'poulailler',
  'poulailler-d-essai',
  'rechaud',
  'ronces',
  'table-a-manger',
  'terre-cultivable',
];

let models: DecorModels;
beforeAll(async () => {
  models = new DecorModels(DECOR_MANIFEST, parse);
  await models.ready;
});

describe('décors livrés', () => {
  it('charge chaque modèle du manifeste', () => {
    expect(models.size).toBe(Object.keys(DECOR_MANIFEST.models).length);
    expect(decorFiles()).toEqual(['furniture.glb', 'houses.glb', 'plants.glb', 'street.glb']);
  });

  it('donne son modèle à chaque meuble qui en a un livré, les autres gardent leur forme provisoire', () => {
    const content = gameContent();
    const without: string[] = [];
    for (const prop of Object.values(content.props)) {
      if (prop.model in DECOR_MANIFEST.models)
        expect(models.instantiate(prop.model), prop.id).not.toBeNull();
      else without.push(prop.id);
    }
    // Meubles des autres lots sans modèle livré: la liste rétrécit à chaque livraison de l'artiste.
    expect(without.sort()).toEqual(PROPS_WITHOUT_MODEL);
  });

  it('pose les modèles au sol, centrés sur leur emprise', () => {
    for (const id of Object.keys(DECOR_MANIFEST.models)) {
      const object = models.instantiate(id);
      if (object === null) throw new Error(id);
      const box = new Box3().setFromObject(object);
      expect(box.min.y, id).toBeGreaterThan(-0.003);
      expect(Math.abs((box.min.x + box.max.x) / 2), id).toBeLessThan(2.5);
    }
  });

  it('sépare murs et toit des maisons pour le fondu', () => {
    const house = models.instantiate('house-town');
    expect(house?.children.map((c) => c.name).sort()).toEqual([
      'house-town_roof',
      'house-town_walls',
    ]);
    const door = DECOR_MANIFEST.models['house-town']?.doors?.[0];
    expect(door?.height).toBeGreaterThanOrEqual(2);
  });

  it('partage géométrie et matériau entre deux copies', () => {
    const a = models.instantiate('chair-farm');
    const b = models.instantiate('chair-farm');
    const meshA = a?.children[0];
    const meshB = b?.children[0];
    expect(meshA instanceof Mesh && meshB instanceof Mesh).toBe(true);
    if (meshA instanceof Mesh && meshB instanceof Mesh) {
      expect(meshA.geometry).toBe(meshB.geometry);
      expect(meshA.material).toBe(meshB.material);
    }
  });

  it('donne aux personnages la hauteur des assises livrées', () => {
    expect(CHARACTER_SETTINGS.seat.byModel['chair-farm']?.height).toBeCloseTo(0.45, 2);
    expect(CHARACTER_SETTINGS.seat.byModel['bench-platform']?.height).toBeCloseTo(0.45, 2);
  });
});

describe('exemplaire factice', () => {
  it('un modèle ajouté au manifeste et au GLB se charge sans code', async () => {
    const manifest: DecorManifest = {
      format: 'duo-decors/1',
      models: {
        'stool-fake': {
          file: 'fake.glb',
          family: 'tabouret',
          triangles: 12,
          size: { w: 0.3, d: 0.3, h: 0.45 },
          seat: { height: 0.45, front: 0.15 },
        },
      },
    };
    const scene = new Group();
    const node = new Group();
    node.name = 'stool-fake';
    scene.add(node);
    const fake = new DecorModels(manifest, () => Promise.resolve({ scene } as unknown as GLTF));
    await fake.ready;
    expect(fake.instantiate('stool-fake')?.name).toBe('stool-fake');
    expect(fake.instantiate('inconnu')).toBeNull();
    expect(decorSeats(manifest)['stool-fake']).toEqual({ height: 0.45, front: 0.15 });
  });
});
