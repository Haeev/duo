// Objets en 3D (assets/commun/objets): index, GLB lus dans Node, règle des gabarits et repli.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import type { ItemDef } from '../../src/donnees/schemas/objets';
import { GRIP_SUFFIX, parseObjectIndex, resolverFromItems } from '../../src/rendu/objets/catalogue';
import { createObjectViewer } from '../../src/rendu/objets/visionneuse';
import { gameContent } from '../aides';

const dir = fileURLToPath(new URL('../../assets/commun/objets/', import.meta.url));
const index = parseObjectIndex(JSON.parse(readFileSync(dir + 'index.json', 'utf8')));
const content = gameContent();
const loader = new GLTFLoader();

function parse(file: string): Promise<GLTF> {
  const buffer = readFileSync(dir + file);
  const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return loader.parseAsync(data, '');
}

interface GltfJson {
  nodes: { name?: string; mesh?: number; children?: number[] }[];
  images?: unknown[];
}

/** Partie JSON d'un GLB: Node ne décode pas les images (atlas), on lit la hiérarchie à la main. */
function gltfJson(file: string): GltfJson {
  const buffer = readFileSync(dir + file);
  const length = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + length).toString('utf8')) as GltfJson;
}

describe('objets 3D', () => {
  it("chaque objet du jeu qui nomme un modèle le trouve dans l'index", () => {
    for (const item of Object.values(content.items)) {
      if (item.model !== undefined) expect(index.objects[item.model], item.id).toBeDefined();
    }
  });

  it('chaque modèle a son nœud, sa prise et son atlas dans son GLB, à une taille plausible', () => {
    const files = [...new Set(Object.values(index.objects).map((m) => m.file))];
    for (const file of files) expect(existsSync(dir + file), file).toBe(true);
    const gltfs = new Map(files.map((f) => [f, gltfJson(f)] as const));
    for (const [id, model] of Object.entries(index.objects)) {
      const gltf = gltfs.get(model.file);
      const node = gltf?.nodes.find((n) => n.name === model.node && n.mesh !== undefined);
      expect(node, id).toBeDefined();
      const kids = (node?.children ?? []).map((k) => gltf?.nodes[k]?.name);
      expect(kids, id).toContain(`${model.node}${GRIP_SUFFIX}`);
      expect(gltf?.images?.length, id).toBe(1);
      expect(Math.max(...model.size)).toBeGreaterThan(0.01);
      expect(Math.max(...model.size)).toBeLessThan(2);
      expect(model.triangles).toBeLessThanOrEqual(800);
    }
  });

  it('un objet factice sans modèle a une vignette provisoire, sans autre changement', async () => {
    const fake: ItemDef = {
      schema: 1,
      id: 'objet-factice',
      name: 'Objet factice',
      family: 'material',
      stack: 1,
      food: null,
      tool: null,
    };
    const items = { ...content.items, [fake.id]: fake };
    const viewer = createObjectViewer({
      index,
      resolve: resolverFromItems(items),
      load: parse,
      createRenderer: () => null,
    });
    const thumb = await viewer.thumbnail(fake.id);
    expect(thumb.kind).toBe('provisional');
    expect(thumb.url.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(thumb.url)).toContain('provisoire');
    // Sans WebGL, un objet modélisé tombe sur le secours (image fixe), jamais sur une erreur.
    expect((await viewer.thumbnail('pomme')).kind).toBe('fallback');
    expect(viewer.cachedThumbnail('pomme')?.kind).toBe('fallback');
    expect(viewer.hasWebGL).toBe(false);
  });
});
