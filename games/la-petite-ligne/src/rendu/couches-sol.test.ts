// Couches de sol (retour R02 du 2026-11-03: sols qui scintillent, surtout dans les intérieurs) et
// pieds posés sur la voie (retour R05). Deux surfaces horizontales qui se recouvrent à la même
// hauteur se battent à chaque image: ce test lit les modèles de l'artiste tels que le rendu les
// pose, le terrain tel qu'il est dessiné, et refuse tout écart sous `terrain.minGap`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../donnees/contenu';
import { loadMap } from '../donnees/carte';
import { MAP_FILES } from '../donnees/cartes-fichiers';
import { CONTENT_FILES } from '../donnees/fichiers';
import type { GameMap, MapProp } from '../etat/carte';
import { inMap } from '../etat/carte';
import { crossingProps } from './decor';
import type { SharedMaterials } from './materiaux';
import { MODEL_VARIANTS } from './modeles';
import { RENDER_SETTINGS } from './reglages';
import { ResourceTracker } from './ressources';
import { Terrain, trackBedLift } from './terrain';

const map: GameMap = loadMap(MAP_FILES).map;
const SETTINGS = RENDER_SETTINGS.terrain;
const GAP = SETTINGS.minGap;
/** Une face regarde vers le haut (sol, dalle, plateau). */
const UP = 0.999;
/** Faces de sol: sous cette hauteur au-dessus du sol nu (m). */
const LOW = 0.6;

// ---------------------------------------------------------------------------
// Lecture des GLB (positions des faces, repère du nœud racine)

const GLB_HEADER = 12;
const CHUNK_HEADER = 8;
const JSON_CHUNK = 0x4e4f534a;
const FLOAT = 5126;
const SHORT = 5123;
const BYTE = 5121;

interface GltfNode {
  name?: string;
  mesh?: number;
  children?: number[];
  matrix?: number[];
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  extras?: Record<string, unknown>;
}
interface Gltf {
  scenes: { nodes: number[] }[];
  nodes: GltfNode[];
  meshes: { primitives: { attributes: { POSITION: number }; indices?: number }[] }[];
  accessors: { bufferView: number; byteOffset?: number; count: number; componentType: number; type: string }[];
  bufferViews: { byteOffset?: number; byteStride?: number }[];
}

/** Face horizontale tournée vers le haut: ses trois sommets (repère de la racine) et son nœud. */
interface Face {
  node: string;
  a: Vector3;
  b: Vector3;
  c: Vector3;
}

class GlbFile {
  private readonly gltf: Gltf;
  private readonly bin: Buffer;
  private readonly cache = new Map<string, Face[]>();

  constructor(file: string) {
    const data = readFileSync(fileURLToPath(new URL(`../../assets/modeles/${file}`, import.meta.url)));
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
    if (gltf === null || bin === null) throw new Error(`${file} illisible`);
    this.gltf = gltf;
    this.bin = bin;
  }

  roots(): string[] {
    return (this.gltf.scenes[0]?.nodes ?? []).map((i) => this.gltf.nodes[i]?.name ?? '');
  }

  extras(name: string): Record<string, unknown> {
    return this.gltf.nodes.find((n) => n.name === name)?.extras ?? {};
  }

  private read(index: number): number[] {
    const accessor = this.gltf.accessors[index];
    if (accessor === undefined) throw new Error('accesseur');
    const view = this.gltf.bufferViews[accessor.bufferView];
    const start = (view?.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const size = accessor.type === 'VEC3' ? 3 : 1;
    const bytes = accessor.componentType === FLOAT ? 4 : accessor.componentType === SHORT ? 2 : accessor.componentType === BYTE ? 1 : 4;
    const stride = view?.byteStride ?? size * bytes;
    const out: number[] = [];
    for (let i = 0; i < accessor.count; i += 1) {
      for (let k = 0; k < size; k += 1) {
        const at = start + i * stride + k * bytes;
        out.push(
          accessor.componentType === FLOAT
            ? this.bin.readFloatLE(at)
            : bytes === 2
              ? this.bin.readUInt16LE(at)
              : bytes === 1
                ? this.bin.readUInt8(at)
                : this.bin.readUInt32LE(at),
        );
      }
    }
    return out;
  }

  /** Faces tournées vers le haut d'une racine et de ses enfants (repère de la racine). */
  upFaces(name: string): Face[] {
    const known = this.cache.get(name);
    if (known !== undefined) return known;
    const g = this.gltf;
    const local = (node: GltfNode): Matrix4 => {
      if (node.matrix !== undefined) return new Matrix4().fromArray(node.matrix);
      return new Matrix4().compose(
        new Vector3(...(node.translation ?? [0, 0, 0])),
        new Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
        new Vector3(...(node.scale ?? [1, 1, 1])),
      );
    };
    const out: Face[] = [];
    const walk = (index: number, parent: Matrix4, root: boolean): void => {
      const node = g.nodes[index];
      if (node === undefined) return;
      const matrix = root ? new Matrix4() : parent.clone().multiply(local(node));
      for (const primitive of node.mesh === undefined ? [] : (g.meshes[node.mesh]?.primitives ?? [])) {
        const p = this.read(primitive.attributes.POSITION);
        const idx = primitive.indices === undefined ? p.map((_, i) => i).filter((i) => i < p.length / 3) : this.read(primitive.indices);
        const v = (i: number): Vector3 => new Vector3(p[i * 3] ?? 0, p[i * 3 + 1] ?? 0, p[i * 3 + 2] ?? 0).applyMatrix4(matrix);
        for (let t = 0; t + 2 < idx.length; t += 3) {
          const a = v(idx[t] ?? 0);
          const b = v(idx[t + 1] ?? 0);
          const c = v(idx[t + 2] ?? 0);
          const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
          const length = n.length();
          if (length < 1e-8 || n.y / length < UP) continue;
          out.push({ node: node.name ?? '', a, b, c });
        }
      }
      for (const child of node.children ?? []) walk(child, matrix, false);
    };
    const start = g.nodes.findIndex((node) => node.name === name);
    if (start >= 0) walk(start, new Matrix4(), true);
    this.cache.set(name, out);
    return out;
  }
}

/** Plusieurs GLB lus comme un seul: chaque racine est cherchée dans le premier fichier qui l'a. */
class GlbSet {
  private readonly files: GlbFile[];

  constructor(names: readonly string[]) {
    this.files = names.map((name) => new GlbFile(name));
  }

  private fileOf(name: string): GlbFile | undefined {
    return this.files.find((file) => file.roots().includes(name));
  }

  roots(): string[] {
    return this.files.flatMap((file) => file.roots());
  }

  extras(name: string): Record<string, unknown> {
    return this.fileOf(name)?.extras(name) ?? {};
  }

  upFaces(name: string): Face[] {
    return this.fileOf(name)?.upFaces(name) ?? [];
  }
}

// Décor du bourg, bâtiments neufs et forêt de la 0.13 (`village013.glb`, `foret013.glb`).
const bourg = new GlbSet(['bourg.glb', 'village013.glb', 'foret013.glb']);
const maison = new GlbFile('maison.glb');

/** Nœud de l'artiste qui dessine un objet de la carte (variante présente, comme `ModelLibrary.resolve`). */
function resolveModel(model: string): string | null {
  const roots = new Set(bourg.roots());
  const variant = (MODEL_VARIANTS[model] ?? []).find((name) => roots.has(name));
  if (variant !== undefined) return variant;
  return roots.has(model) ? model : null;
}

/** Points d'échantillon d'une face (sommets rapprochés du centre et centre), posés par `matrix`. */
function samples(face: Face, matrix: Matrix4): Vector3[] {
  const centre = new Vector3().add(face.a).add(face.b).add(face.c).divideScalar(3);
  const out = [centre.clone()];
  for (const corner of [face.a, face.b, face.c]) out.push(corner.clone().lerp(centre, 0.15));
  for (const [p, q] of [[face.a, face.b], [face.b, face.c], [face.c, face.a]] as const) {
    out.push(p.clone().lerp(q, 0.5).lerp(centre, 0.15));
  }
  return out.map((point) => point.applyMatrix4(matrix));
}

function placement(prop: MapProp, ground: number): Matrix4 {
  const offset = RENDER_SETTINGS.propOffsets[prop.model] ?? [0, 0];
  return new Matrix4().compose(
    new Vector3(prop.pos.x + offset[0], ground, prop.pos.y + offset[1]),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (prop.rotation * Math.PI) / 2),
    new Vector3(1, 1, 1),
  );
}

function terrain(): Terrain {
  // Le terrain ne lit que ces deux matériaux; hauteurs de marche du quai, du ponton et des
  // ouvrages du ru comme le moteur (extras `walk_height` de l'artiste).
  const materials = { palette: new MeshBasicMaterial(), water: new MeshBasicMaterial() } as unknown as SharedMaterials;
  const walk = (model: string): number | undefined => {
    const name = resolveModel(model);
    const value = name === null ? undefined : bourg.extras(name).walk_height;
    return typeof value === 'number' ? value : undefined;
  };
  return new Terrain(
    map,
    materials,
    new ResourceTracker(),
    (prop) => walk(prop.model) ?? (prop.category === 'sol' && prop.height > 0 ? prop.height : RENDER_SETTINGS.floorProps[prop.model]),
    (crossing) => walk(crossing.model),
  );
}

const ground = terrain();
/** Sols du terrain dont le dessus est plat à la hauteur de la case (le lit de la rivière et les platelages ont leur dessin). */
const FLAT_KINDS = new Set(['grass', 'path', 'dirt', 'stone', 'floor', 'rail']);

/** Objets de la carte dessinés au sol, et leur hauteur de pose (mêmes règles que `decor.ts`, `interieurs.ts`, `maison.ts`). */
function placedModels(): { label: string; model: string; matrix: Matrix4 }[] {
  const visitable = new Set(Object.values(map.buildings).map((building) => building.prop));
  const drawnElsewhere = new Set(RENDER_SETTINGS.propsDrawnElsewhere);
  const floorModels = new Set(Object.keys(RENDER_SETTINGS.floorProps));
  const out: { label: string; model: string; matrix: Matrix4 }[] = [];
  for (const prop of [...map.props, ...crossingProps(map)]) {
    if (drawnElsewhere.has(prop.model)) continue;
    const model = resolveModel(prop.model);
    if (model === null) continue;
    // Bâtiments visitables et maisonnette posés à 0; sols posés à 0; le reste sur le terrain.
    const atZero = visitable.has(prop.id) || prop.model === 'gatekeeper_house' || prop.category === 'sol' || floorModels.has(prop.model);
    const height = atZero ? 0 : ground.heightAt(prop.pos.x, prop.pos.y);
    const matrix = placement(prop, height);
    out.push({ label: prop.id, model, matrix });
    // Pièces à bâtir de la maisonnette, dans le repère de la maison.
    if (prop.model === 'gatekeeper_house') {
      for (const room of ['gatekeeper_bedroom', 'gatekeeper_cellar']) out.push({ label: room, model: room, matrix });
    }
  }
  return out;
}

describe('couches de sol (R02): jamais deux surfaces à la même hauteur', () => {
  it('l’ordre documenté des couches tient (de bas en haut, chacune à `minGap` au moins de la suivante)', () => {
    const order = [
      0,
      // Dalle de la chambre, cases de bâtiment, dalles des autres bâtiments (modèles).
      0.08,
      SETTINGS.heights.floor,
      0.1,
      Math.min(...Object.values(SETTINGS.roomFloors)),
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect((order[i] ?? 0) - (order[i - 1] ?? 0)).toBeGreaterThanOrEqual(GAP);
    }
    // Les sols nus de terrain: une case, un sol; même hauteur permise entre eux (aucun recouvrement).
    expect(SETTINGS.heights.grass).toBe(0);
  });

  it('aucune face de modèle posé (bâtiment, quai, pont, décor) au ras du terrain dessiné dessous', () => {
    const offenders = new Map<string, string>();
    for (const { label, model, matrix } of placedModels()) {
      for (const face of bourg.upFaces(model)) {
        for (const point of samples(face, matrix)) {
          const cx = Math.floor(point.x);
          const cy = Math.floor(point.z);
          if (!inMap(map, cx, cy)) continue;
          const look = ground.look(cx, cy);
          if (ground.coveredByFloorProp(cx, cy)) continue;
          if (!FLAT_KINDS.has(look.kind) || point.y - look.height > LOW) continue;
          if (Math.abs(point.y - look.height) < GAP) {
            const key = `${label}/${face.node}`;
            if (!offenders.has(key)) {
              offenders.set(key, `${key}: face à ${point.y.toFixed(3)} m sur ${look.kind} à ${look.height.toFixed(3)} m (${point.x.toFixed(1)}, ${point.z.toFixed(1)})`);
            }
          }
        }
      }
    }
    expect([...offenders.values()]).toEqual([]);
  });

  it('le plancher de chaque pièce visitable est celui du modèle (pieds et meubles posés dessus)', () => {
    const models = placedModels();
    for (const building of Object.values(map.buildings)) {
      for (const room of building.rooms) {
        const configured = SETTINGS.roomFloors[room.id];
        expect(configured, `plancher de ${room.id} dans roomFloors`).toBeDefined();
        const tops: number[] = [];
        for (let cy = room.rect.y; cy < room.rect.y + room.rect.h; cy += 1) {
          for (let cx = room.rect.x; cx < room.rect.x + room.rect.w; cx += 1) {
            let top = Number.NEGATIVE_INFINITY;
            for (const { model, matrix } of models) {
              for (const face of bourg.upFaces(model)) {
                if (!face.node.endsWith('_floor')) continue;
                const [a, b, c] = [face.a, face.b, face.c].map((p) => p.clone().applyMatrix4(matrix));
                if (a === undefined || b === undefined || c === undefined) continue;
                // Hors des joints des lames (tous les 50 cm, au milieu des cases de la maisonnette).
                if (insideTriangle(cx + 0.3, cy + 0.4, a, b, c) && a.y < LOW) top = Math.max(top, a.y);
              }
            }
            if (Number.isFinite(top)) tops.push(top);
          }
        }
        tops.sort((p, q) => p - q);
        const median = tops[Math.floor(tops.length / 2)] ?? Number.NaN;
        expect(median, room.id).toBeCloseTo(configured ?? 0, 3);
        // Et au-dessus de la case de bâtiment dessous: aucune lutte entre les deux.
        expect(median - SETTINGS.heights.floor, room.id).toBeGreaterThanOrEqual(GAP);
      }
    }
  });

  it('meubles et objets posés au sol: aucune face au ras du plancher (tapis compris)', () => {
    const content = loadContent(CONTENT_FILES);
    const offenders: string[] = [];
    const roots = new Set(maison.roots());
    for (const item of Object.values(content.items)) {
      if (item.footprint === null || item.wall || !(item.category === 'furniture' || item.category === 'decoration')) continue;
      if (!roots.has(item.model)) continue;
      for (const face of maison.upFaces(item.model)) {
        const h = Math.min(face.a.y, face.b.y, face.c.y);
        if (Math.abs(h) < GAP) offenders.push(`${item.id}/${face.node} à ${h.toFixed(4)} m`);
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  it('le terrain ne dessine rien sous un sol posé: le bout du quai pose ses rampes à 0, sans pavés dessous', () => {
    // Bout est du quai (x 50), case de pavés sous le pied de la rampe du modèle (posé à 0).
    expect(ground.coveredByFloorProp(50, 16)).toBe(true);
    const quay = map.props.find((prop) => prop.model === 'platform');
    expect(quay?.rect).not.toBeNull();
    // Le modèle couvre toute l'emprise de la carte: aucun trou là où le terrain ne dessine plus rien.
    const faces = bourg.upFaces('platform');
    const matrix = quay === undefined ? new Matrix4() : placement(quay, 0);
    const rect = quay?.rect ?? { x: 0, y: 0, w: 0, h: 0 };
    for (let y = rect.y + 0.1; y < rect.y + rect.h; y += 0.4) {
      for (let x = rect.x + 0.1; x < rect.x + rect.w; x += 0.4) {
        const covered = faces.some((face) => {
          const [a, b, c] = [face.a, face.b, face.c].map((p) => p.clone().applyMatrix4(matrix));
          return a !== undefined && b !== undefined && c !== undefined && insideTriangle(x, y, a, b, c);
        });
        expect(covered, `(${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(true);
      }
    }
    expect(ground.coveredByFloorProp(52, 21)).toBe(false);
    // On marche toujours sur le quai lui-même.
    expect(ground.heightAt(40.5, 16.5)).toBeCloseTo(0.4, 6);
  });
});

function insideTriangle(x: number, z: number, a: Vector3, b: Vector3, c: Vector3): boolean {
  const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
  if (Math.abs(d) < 1e-12) return false;
  const l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
  const l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
  return l1 >= -1e-9 && l2 >= -1e-9 && 1 - l1 - l2 >= -1e-9;
}

describe('pieds posés sur la voie (R05)', () => {
  const walk = RENDER_SETTINGS.railway.walk;
  const rail = bourg.upFaces('rail_straight');
  /** Dessus du module de voie au point (repère du module), ou `null` hors de ses faces. */
  const topAt = (x: number, z: number): number | null => {
    let best: number | null = null;
    for (const face of rail) {
      if (insideTriangle(x, z, face.a, face.b, face.c)) {
        const y = Math.max(face.a.y, face.b.y, face.c.y);
        best = best === null ? y : Math.max(best, y);
      }
    }
    return best;
  };

  it('les réglages suivent le modèle: dessus des traverses, leur bout, le pied du talus', () => {
    // Une traverse passe sous x 0 du module.
    expect(topAt(0, 0)).toBeCloseTo(walk.sleeperTop, 3);
    expect(topAt(0, walk.sleeperHalf - 0.02)).toBeCloseTo(walk.sleeperTop, 3);
    expect(topAt(0, walk.shoulderHalf + 0.02)).toBeNull();
  });

  it('sur la voie, les pieds sont sur les traverses, jamais dessous (seul le champignon du rail dépasse)', () => {
    const railHead = (z: number): boolean => Math.abs(Math.abs(z) - RENDER_SETTINGS.terrain.crossing.railOffset) < 0.1;
    for (let z = -walk.shoulderHalf; z <= walk.shoulderHalf; z += 0.02) {
      for (let x = -2; x <= 2; x += 0.05) {
        const top = topAt(x, z);
        if (top === null || railHead(z)) continue;
        // Talus du ballast: les pieds glissent du dessus des traverses au sol (tolérance: une semelle).
        const slack = Math.abs(z) > walk.sleeperHalf ? 0.06 : 1e-3;
        expect(trackBedLift(z), `x ${x.toFixed(2)}, z ${z.toFixed(2)}`).toBeGreaterThanOrEqual(top - slack);
      }
    }
  });

  it('un personnage sur la ligne se tient à la hauteur des traverses, le décor reste au sol', () => {
    const trackY = 13.5;
    const railGround = SETTINGS.heights.rail;
    expect(ground.standHeight(30.3, trackY)).toBeCloseTo(railGround + walk.sleeperTop, 6);
    expect(ground.heightAt(30.3, trackY)).toBeCloseTo(railGround, 6);
    // Hors de la voie, rien ne change.
    expect(ground.standHeight(30.3, 20.5)).toBe(ground.heightAt(30.3, 20.5));
  });
});
