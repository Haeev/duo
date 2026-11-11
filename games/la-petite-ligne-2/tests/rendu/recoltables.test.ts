// Récoltables: aucune ressource des données sans modèle, états et stades, conversion par le nom
// des matériaux, variantes tirées par exemplaire, exemplaire factice sans code.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { inkifyModel } from '../../src/rendu/encre/conversion';
import { KIND, LAYER } from '../../src/rendu/encre/couches';
import { DecorModels, mergeNamed } from '../../src/rendu/lieu/decors';
import {
  cropModel,
  DECOR_MANIFEST,
  type DecorManifest,
  stateModel,
  variantOf,
} from '../../src/rendu/lieu/decors-manifeste';
import { gameContent } from '../aides';

const dir = fileURLToPath(new URL('../../assets/commun/decors/', import.meta.url));
const loader = new GLTFLoader();

function parse(file: string): Promise<GLTF> {
  const buffer = readFileSync(dir + file);
  const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return loader.parseAsync(data, '');
}

/**
 * Meubles laissés hors du contrôle, chacun avec sa raison. Aucune ressource du dehors n'y figure.
 * Les étals à stock (haches forgées, soupe, tourte) ont leur modèle et leur état vide depuis les
 * aménagements d'Aubrune: ils sont contrôlés comme les autres.
 */
const EXCEPTIONS: Readonly<Record<string, string>> = {};

let models: DecorModels;
beforeAll(async () => {
  models = new DecorModels(DECOR_MANIFEST, parse);
  await models.ready;
});

describe('récoltables des données', () => {
  it('donne un modèle livré à tout meuble qui se récolte, se cueille ou se cultive, et à ce qu’il laisse', () => {
    const content = gameContent();
    const missing: string[] = [];
    let checked = 0;
    for (const prop of Object.values(content.props)) {
      const harvest = prop.bricks.find((brick) => brick.brick === 'harvest');
      const field = prop.bricks.find((brick) => brick.brick === 'field');
      // Un stock qui se vide et revient (pommes du pommier, bûches du tas): il se voit vide.
      const stock = prop.bricks.find((brick) => brick.brick === 'gather' && brick.stock !== null);
      if (harvest === undefined && field === undefined && stock === undefined) continue;
      if (prop.id in EXCEPTIONS) continue;
      checked += 1;
      if (stock !== undefined && stateModel(prop.model, 'bare') === null)
        missing.push(`${prop.id}: état bare`);
      if (models.instantiate(prop.model, prop.id) === null) missing.push(`${prop.id}: modèle`);
      if (harvest?.brick === 'harvest') {
        const after = content.resources[harvest.resource]?.after ?? 'gone';
        if (after !== 'gone' && stateModel(prop.model, after) === null)
          missing.push(`${prop.id}: état ${after}`);
      }
      if (field !== undefined)
        for (const state of ['tilled', 'watered'])
          if (stateModel(prop.model, state) === null) missing.push(`${prop.id}: état ${state}`);
    }
    expect(missing).toEqual([]);
    expect(checked).toBeGreaterThanOrEqual(10);
    // Une exception qui ne sert plus (meuble disparu ou modèle livré) se retire.
    for (const id of Object.keys(EXCEPTIONS)) expect(content.props[id], id).toBeDefined();
  });

  it('donne un modèle à chaque stade de chaque culture, mûre et à arroser', () => {
    const content = gameContent();
    const missing: string[] = [];
    for (const crop of Object.values(content.crops)) {
      if (crop.model === undefined) {
        missing.push(`${crop.id}: champ model`);
        continue;
      }
      const seen = new Set<string>();
      for (let stage = 0; stage <= crop.stages.length; stage++) {
        const model = cropModel(crop.model, stage, false);
        if (model === null || models.instantiate(model) === null)
          missing.push(`${crop.id}: stade ${String(stage)}`);
        else seen.add(model);
        const thirsty = cropModel(crop.model, stage, true);
        if (thirsty === null || models.instantiate(thirsty) === null)
          missing.push(`${crop.id}: stade ${String(stage)} à arroser`);
        // Mûre, elle n'attend plus l'arrosoir: le modèle mûr sert dans les deux cas.
        else if (stage < crop.stages.length) expect(thirsty, crop.id).not.toBe(model);
      }
      // Chaque stade se distingue du précédent.
      expect(seen.size, crop.id).toBe(crop.stages.length + 1);
    }
    expect(missing).toEqual([]);
  });

  it('garde chaque modèle sous son budget de triangles et au-dessus du sol', () => {
    const raw = JSON.parse(readFileSync(`${dir}decors.json`, 'utf8')) as {
      models: Record<
        string,
        { source?: string; triangles: number; budget: number; plants?: number }
      >;
    };
    let count = 0;
    for (const [id, sheet] of Object.entries(raw.models)) {
      if (sheet.source !== 'recoltables-aubrune') continue;
      count += 1;
      expect(sheet.triangles / (sheet.plants ?? 1), id).toBeLessThanOrEqual(sheet.budget);
      const object = models.instantiate(id, 'essai');
      if (object === null) throw new Error(id);
      expect(new Box3().setFromObject(object).min.y, id).toBeGreaterThan(-0.003);
    }
    expect(count).toBeGreaterThan(50);
  });
});

describe('conversion par le nom des matériaux', () => {
  it('fusionne un arbre en un seul maillage: feuillage au vent, écorce, sans repasser par la teinte', () => {
    const tree = models.instantiate('oak-tree', 'a');
    if (tree === null) throw new Error('oak-tree');
    // Comme à la pose dans un lieu: la conversion par la teinte ne doit rien changer.
    inkifyModel(tree, new MeshBasicMaterial());
    const meshes: Mesh[] = [];
    tree.traverse((object) => {
      if ((object as Partial<Mesh>).isMesh === true) meshes.push(object as Mesh);
    });
    expect(meshes).toHaveLength(1);
    const ink = meshes[0]?.geometry.getAttribute('aInk');
    if (ink === undefined) throw new Error('aInk');
    const pairs = new Set<string>();
    for (let i = 0; i < ink.count; i++) pairs.add(`${String(ink.getX(i))}:${String(ink.getZ(i))}`);
    expect([...pairs].sort()).toEqual(
      [
        `${String(LAYER.leaf)}:${String(KIND.leaf)}`,
        `${String(LAYER.bark)}:${String(KIND.stem)}`,
      ].sort(),
    );
    // Une seule pièce de contour pour tout l'arbre.
    const pieces = new Set<number>();
    for (let i = 0; i < ink.count; i++) pieces.add(ink.getY(i));
    expect(pieces.size).toBe(1);
  });

  it('laisse à la conversion par la teinte un modèle sans matériau nommé', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    const material = new MeshBasicMaterial();
    material.name = 'decor';
    const root = new Group();
    root.add(new Mesh(geometry, material));
    expect(mergeNamed(root, 0, { feuillage: { layer: 'leaf', kind: 'leaf' } })).toBeNull();
  });
});

describe('variantes et écarts de pose', () => {
  it('tire la même forme pour le même exemplaire, et plusieurs formes sur un bois', () => {
    const keys = Array.from({ length: 40 }, (_, i) => `arbre-${String(i)}`);
    const drawn = new Set(keys.map((key) => variantOf('oak-tree', key)));
    expect([...drawn].sort()).toEqual(['oak-tree', 'oak-tree-b']);
    expect(variantOf('oak-tree', 'arbre-7')).toBe(variantOf('oak-tree', 'arbre-7'));
    const a = models.instantiate('oak-tree', 'arbre-7')?.children[0];
    const b = models.instantiate('oak-tree', 'arbre-7')?.children[0];
    expect(a?.rotation.y).toBe(b?.rotation.y);
    expect(a?.scale.x).toBeGreaterThanOrEqual(0.94);
    expect(a?.scale.x).toBeLessThanOrEqual(1.06);
    // Sans clé (pose actuelle des lieux): le rang de pose fait la clé, les exemplaires diffèrent.
    const yaws = new Set(
      Array.from({ length: 6 }, () => models.instantiate('oak-tree')?.children[0]?.rotation.y),
    );
    expect(yaws.size).toBeGreaterThan(3);
  });
});

describe('exemplaire factice', () => {
  it('une essence, son état et une culture ajoutés au manifeste se résolvent sans code', async () => {
    const sheet = { file: 'faux.glb', family: 'arbre', triangles: 1, size: { w: 1, d: 1, h: 1 } };
    const manifest: DecorManifest = {
      format: 'duo-decors/1',
      models: {
        'fake-tree': { ...sheet, variants: ['fake-tree-b'], states: { stump: 'fake-tree-stump' } },
        'fake-tree-b': { ...sheet, states: { stump: 'fake-tree-stump' } },
        'fake-tree-stump': sheet,
        'crop-fake-0': sheet,
        'crop-fake-0-thirsty': sheet,
        'crop-fake-1': sheet,
      },
      materials: { feuillage: { layer: 'leaf', kind: 'leaf' } },
      crops: {
        'crop-fake': {
          crop: 'fake',
          stages: ['crop-fake-0', 'crop-fake-1'],
          thirsty: ['crop-fake-0-thirsty'],
        },
      },
    };
    const scene = new Group();
    for (const id of Object.keys(manifest.models)) {
      const node = new Group();
      node.name = id;
      scene.add(node);
    }
    const fake = new DecorModels(manifest, () => Promise.resolve({ scene } as unknown as GLTF));
    await fake.ready;
    expect(stateModel('fake-tree', 'stump', manifest)).toBe('fake-tree-stump');
    expect(stateModel('fake-tree', 'bare', manifest)).toBeNull();
    expect(['fake-tree', 'fake-tree-b']).toContain(variantOf('fake-tree', 'x', manifest));
    expect(fake.instantiate('fake-tree', 'x')).not.toBeNull();
    expect(cropModel('crop-fake', 0, true, manifest)).toBe('crop-fake-0-thirsty');
    expect(cropModel('crop-fake', 1, true, manifest)).toBe('crop-fake-1');
    expect(cropModel('crop-fake', 9, false, manifest)).toBe('crop-fake-1');
    expect(cropModel('inconnue', 0, false, manifest)).toBeNull();
  });
});
