// Parties mobiles des modèles livrés: le chargeur des décors fusionne à part chaque nœud que le
// manifeste liste (`nodes`), le garde comme enfant nommé posé à son pivot, avec le même contour.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { isMesh } from '../../src/rendu/fondu';
import { DecorModels, mergeNamed } from '../../src/rendu/lieu/decors';
import { DECOR_MANIFEST } from '../../src/rendu/lieu/decors-manifeste';

const MATERIALS = DECOR_MANIFEST.materials ?? {};
const dir = fileURLToPath(new URL('../../assets/commun/decors/', import.meta.url));
const loader = new GLTFLoader();

function parse(file: string): Promise<GLTF> {
  const buffer = readFileSync(dir + file);
  const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return loader.parseAsync(data, '');
}

/** Un cube de 20 cm en bois, centré en (x, y, z) de son nœud. */
function cube(x: number, y: number, z: number): Mesh {
  const positions: number[] = [];
  for (const [a, b, c] of [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, 1],
    [1, 1, 1],
    [-1, -1, 1],
  ])
    positions.push(x + (a ?? 0) * 0.1, y + (b ?? 0) * 0.1, z + (c ?? 0) * 0.1);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    'normal',
    new Float32BufferAttribute(
      positions.map(() => 0),
      3,
    ),
  );
  geometry.setAttribute(
    'color',
    new Float32BufferAttribute(
      positions.map(() => 1),
      3,
    ),
  );
  const material = new MeshBasicMaterial();
  material.name = 'bois';
  return new Mesh(geometry, material);
}

/** Un modèle factice: un socle, et un bras dans un nœud posé à son pivot (1; 2; 0). */
function factice(): Object3D {
  const root = new Group();
  root.name = 'factice';
  root.add(cube(0, 0, 0));
  const arm = new Group();
  arm.name = 'bras';
  arm.position.set(1, 2, 0);
  arm.add(cube(0.5, 0, 0));
  root.add(arm);
  return root;
}

function meshesOf(object: Object3D): Mesh[] {
  const out: Mesh[] = [];
  object.traverse((child) => {
    if (isMesh(child)) out.push(child);
  });
  return out;
}

describe('parties mobiles des décors', () => {
  it('garde un nœud listé comme enfant nommé, posé à son pivot, avec le même contour', () => {
    const merged = mergeNamed(factice(), 3, MATERIALS, ['bras']);
    if (merged === null || !isMesh(merged)) throw new Error('corps non fusionné');
    expect(merged.name).toBe('factice');
    const arm = merged.getObjectByName('bras');
    if (arm === undefined || !isMesh(arm)) throw new Error('bras absent');
    expect(arm.parent).toBe(merged);
    expect(arm.position.toArray()).toEqual([1, 2, 0]);
    // Ses sommets restent autour de son pivot: il tourne sur lui-même, pas autour du socle.
    arm.geometry.computeBoundingBox();
    expect(arm.geometry.boundingBox?.min.x).toBeCloseTo(0.4, 5);
    expect(arm.geometry.boundingBox?.max.y).toBeCloseTo(0.1, 5);
    // Même pièce de contour (aInk.y) et même matériau que le corps.
    expect(arm.geometry.getAttribute('aInk').getY(0)).toBe(
      merged.geometry.getAttribute('aInk').getY(0),
    );
    expect(arm.material).toBe(merged.material);
    // Il tourne: le bout du bras suit.
    arm.rotation.z = Math.PI / 2;
    merged.updateMatrixWorld(true);
    expect(arm.localToWorld(arm.position.clone().set(0.5, 0, 0)).y).toBeCloseTo(2.5, 5);
  });

  it('sans nœud listé: un seul maillage, aucun appel de dessin de plus', () => {
    const merged = mergeNamed(factice(), 0, MATERIALS);
    expect(merged).toBeInstanceOf(Mesh);
    expect(merged === null ? 0 : meshesOf(merged).length).toBe(1);
  });

  it('charge la draisine et la lisse livrées avec leurs nœuds, et les copies les gardent', async () => {
    const models = new DecorModels(DECOR_MANIFEST, parse);
    await models.ready;
    const draisine = models.instantiate('draisine') ?? fail('draisine absente');
    expect(meshesOf(draisine)).toHaveLength(4);
    for (const [name, node] of Object.entries(DECOR_MANIFEST.models.draisine?.nodes ?? {})) {
      const part = draisine.getObjectByName(name) ?? fail(`${name} absent`);
      expect(part.position.toArray().map((v) => Math.round(v * 100) / 100)).toEqual(node.pivot);
    }
    const gate = models.instantiate('crossing-gate') ?? fail('lisse absente');
    expect(gate.getObjectByName('lisse')?.position.x).toBeCloseTo(-1.95, 5);
    // Un modèle sans nœud reste un maillage seul, posable en instances.
    expect(models.geometryOf('draisine')).toBeNull();
    expect(models.geometryOf('barrel')).not.toBeNull();
    // Deux copies partagent les géométries, mais chacune tourne ses parties.
    const other = models.instantiate('draisine') ?? fail('draisine absente');
    const a = draisine.getObjectByName('balancier') as Mesh;
    const b = other.getObjectByName('balancier') as Mesh;
    expect(a.geometry).toBe(b.geometry);
    a.rotation.x = 0.2;
    expect(b.rotation.x).toBeCloseTo(0, 9);
  });
});

function fail(message: string): never {
  throw new Error(message);
}
