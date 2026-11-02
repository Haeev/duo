// Cohérence du monde (règle du studio, retours R20 à R22 du 2026-11-01): chaque élément posé
// est à un endroit où il servirait. Contrôles sur toute la carte, avec ce que dessine le rendu.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BufferAttribute, BufferGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { loadMap } from '../donnees/carte';
import { MAP_FILES } from '../donnees/cartes-fichiers';
import type { GameMap } from '../etat/carte';
import { pavedNear } from './paves';
import { RENDER_SETTINGS } from './reglages';
import { trimGeometry } from './retouches';
import { sidingTurntables } from './voie';

const map: GameMap = loadMap(MAP_FILES).map;

/** Rayon du pied d'un buisson ou d'un arbre (m): ses tiges, pas son houppier qui peut déborder. */
const PLANT_FOOT = 0.4;
const PLANT = /^(bush|tree|bramble|flower|reeds|hedge)/;

describe('végétation (R22)', () => {
  it('aucun buisson, arbre ni massif posé sur des pavés (place, rue, cour, quai)', () => {
    const offenders = map.props
      .filter((prop) => PLANT.test(prop.model))
      .filter((prop) => pavedNear(map, prop.pos.x, prop.pos.y, PLANT_FOOT))
      .map((prop) => `${prop.model} (${String(prop.pos.x)}, ${String(prop.pos.y)})`);
    expect(offenders).toEqual([]);
  });

  it('la berge est continue: pas de bande d’herbe entre la promenade et la grève', () => {
    const at = (x: number, y: number): string => map.ground[y * map.width + x] ?? '';
    const strips: string[] = [];
    for (let x = 0; x < map.width; x += 1) {
      for (let y = 1; y < map.height - 1; y += 1) {
        // Une seule case d'herbe entre un chemin (au nord) et la berge (au sud).
        if (at(x, y) === 'grass' && at(x, y - 1) === 'path' && at(x, y + 1) === 'gravel') {
          strips.push(`(${String(x)}, ${String(y)})`);
        }
      }
    }
    expect(strips).toEqual([]);
  });
});

describe('voie (R20)', () => {
  const buildings = map.props.filter((prop) => prop.category === 'batiment' && prop.rect !== null);
  const isRail = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < map.width && y < map.height && map.ground[y * map.width + x] === 'rail';
  const inside = (x: number, y: number): string | null => {
    for (const b of buildings) {
      const r = b.rect;
      if (r !== null && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return b.id;
    }
    return null;
  };

  it('aucune case de voie sous un bâtiment', () => {
    const under: string[] = [];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const id = isRail(x, y) ? inside(x, y) : null;
        if (id !== null) under.push(`${id} (${String(x)}, ${String(y)})`);
      }
    }
    expect(under).toEqual([]);
  });

  it('la voie de garage finit sur la ligne, à une plaque tournante qui la dessert, hors de tout bâtiment', () => {
    const plates = sidingTurntables(map);
    expect(plates.length).toBeGreaterThan(0);
    for (const plate of plates) {
      // Au milieu de la ligne (entre ses rails) et au pied d'une colonne de voie de garage.
      expect(isRail(Math.floor(plate.x), Math.floor(plate.y))).toBe(true);
      expect(isRail(Math.floor(plate.x), Math.floor(plate.y - plate.radius - 0.6))).toBe(true);
      for (let a = 0; a < 16; a += 1) {
        const angle = (a / 16) * Math.PI * 2;
        const x = plate.x + Math.cos(angle) * plate.radius;
        const y = plate.y + Math.sin(angle) * plate.radius;
        expect(
          inside(Math.floor(x), Math.floor(y)),
          `bord de la plaque (${x.toFixed(1)}, ${y.toFixed(1)})`,
        ).toBeNull();
      }
    }
  });
});

const GLB_HEADER = 12;
const CHUNK_HEADER = 8;
const JSON_CHUNK = 0x4e4f534a;
const FLOAT = 5126;
const SHORT = 5123;

interface GltfNode {
  name?: string;
  mesh?: number;
  children?: number[];
  matrix?: number[];
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
}
interface Gltf {
  nodes: GltfNode[];
  meshes: { primitives: { attributes: { POSITION: number }; indices?: number }[] }[];
  accessors: {
    bufferView: number;
    byteOffset?: number;
    count: number;
    componentType: number;
    type: string;
  }[];
  bufferViews: { byteOffset?: number; byteStride?: number }[];
}

/** Triangles (repère du nœud) d'un nœud de `bourg.glb` et de ses enfants, retouches appliquées. */
function nodeTriangles(name: string): Vector3[] {
  const path = fileURLToPath(new URL('../../assets/modeles/bourg.glb', import.meta.url));
  const data = readFileSync(path);
  let offset = GLB_HEADER;
  let gltf: Gltf | null = null;
  let bin: Buffer | null = null;
  while (offset < data.length) {
    const length = data.readUInt32LE(offset);
    const type = data.readUInt32LE(offset + 4);
    const chunk = data.subarray(offset + CHUNK_HEADER, offset + CHUNK_HEADER + length);
    if (type === JSON_CHUNK) gltf = JSON.parse(chunk.toString('utf8')) as Gltf;
    else bin = chunk;
    offset += CHUNK_HEADER + length;
  }
  if (gltf === null || bin === null) throw new Error('GLB illisible');
  const g = gltf;
  const b = bin;
  const read = (index: number): number[] => {
    const accessor = g.accessors[index];
    if (accessor === undefined) throw new Error('accesseur');
    const view = g.bufferViews[accessor.bufferView];
    const start = (view?.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const size = accessor.type === 'VEC3' ? 3 : 1;
    const bytes = accessor.componentType === FLOAT ? 4 : accessor.componentType === SHORT ? 2 : 4;
    const stride = view?.byteStride ?? size * bytes;
    const out: number[] = [];
    for (let i = 0; i < accessor.count; i += 1) {
      for (let k = 0; k < size; k += 1) {
        const at = start + i * stride + k * bytes;
        out.push(
          accessor.componentType === FLOAT
            ? b.readFloatLE(at)
            : bytes === 2
              ? b.readUInt16LE(at)
              : b.readUInt32LE(at),
        );
      }
    }
    return out;
  };
  const local = (node: GltfNode): Matrix4 => {
    if (node.matrix !== undefined) return new Matrix4().fromArray(node.matrix);
    const t = node.translation ?? [0, 0, 0];
    const r = node.rotation ?? [0, 0, 0, 1];
    const s = node.scale ?? [1, 1, 1];
    return new Matrix4().compose(new Vector3(...t), new Quaternion(...r), new Vector3(...s));
  };
  const out: Vector3[] = [];
  const walk = (index: number, parent: Matrix4, root: boolean): void => {
    const node = g.nodes[index];
    if (node === undefined) return;
    const matrix = root ? new Matrix4() : parent.clone().multiply(local(node));
    for (const primitive of node.mesh === undefined
      ? []
      : (g.meshes[node.mesh]?.primitives ?? [])) {
      let geometry = new BufferGeometry();
      geometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array(read(primitive.attributes.POSITION)), 3),
      );
      if (primitive.indices !== undefined) geometry.setIndex(read(primitive.indices));
      const trim = RENDER_SETTINGS.modelTrims.find((candidate) => candidate.node === node.name);
      if (trim !== undefined) geometry = trimGeometry(geometry, trim);
      const position = geometry.getAttribute('position');
      const indices = geometry.index;
      const count = indices === null ? position.count : indices.count;
      for (let i = 0; i < count; i += 1) {
        out.push(
          new Vector3()
            .fromBufferAttribute(position, indices === null ? i : indices.getX(i))
            .applyMatrix4(matrix),
        );
      }
    }
    for (const child of node.children ?? []) walk(child, matrix, false);
  };
  const start = g.nodes.findIndex((node) => node.name === name);
  if (start < 0) throw new Error(`${name} absent de bourg.glb`);
  walk(start, new Matrix4(), true);
  return out;
}

describe('sols posés (R21)', () => {
  /** Débord toléré hors de l'emprise (m): bordures, corde d'amarrage. */
  const TOLERANCE = 0.2;
  const floors = [
    ...new Set(map.props.filter((prop) => prop.category === 'sol').map((prop) => prop.model)),
  ];

  it('la carte a des sols posés à contrôler (quai, ponton)', () => {
    expect(floors).toContain('pontoon');
  });

  for (const model of floors) {
    it(`${model}: rien ne déborde de l’emprise (escalier ou passerelle qui ne mène nulle part)`, () => {
      const prop = map.props.find((candidate) => candidate.model === model);
      const rect = prop?.rect ?? null;
      expect(rect).not.toBeNull();
      if (prop === undefined || rect === null) return;
      // Emprise dans le repère du modèle (rotation 0: largeur le long de X, profondeur le long de Z).
      const turned = prop.rotation % 2 !== 0;
      const halfX = (turned ? rect.h : rect.w) / 2 + TOLERANCE;
      const halfZ = (turned ? rect.w : rect.h) / 2 + TOLERANCE;
      const outside = nodeTriangles(model).filter(
        (p) => Math.abs(p.x) > halfX || Math.abs(p.z) > halfZ,
      );
      expect(outside.length, `${String(outside.length)} sommets hors de l'emprise`).toBe(0);
    });
  }
});
