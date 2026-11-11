/**
 * Aperçu de l'éditeur de personnage: en encre, le personnage porte les matériaux encrés du jeu;
 * un changement de pièce se voit sans attendre et libère l'ancien assemblage; la fermeture libère
 * tout sans perdre le contexte du canevas (rouvert à l'ouverture suivante); `aplats` garde
 * l'ancien aperçu. Pas de WebGL dans Node: le rendu est un faux, les couches de traits (dessinées
 * sur un canevas 2D) sont remplacées par des textures d'un point.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type BufferGeometry,
  DataArrayTexture,
  DataTexture,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  SkinnedMesh,
  type WebGLRenderer,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type * as Textures from '../../src/rendu/encre/textures';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { isInkMaterial } from '../../src/rendu/encre/matiere';
import { createCharacterPreview, type PreviewOptions } from '../../src/rendu/personnages/apercu';
import { composeLook } from '../../src/rendu/personnages/apparence';
import type { CharacterLibrary } from '../../src/rendu/personnages/assemblage';
import { loadCharacterLibrary } from '../../src/rendu/personnages/chargement';
import { gameContent } from '../aides';

vi.mock('../../src/rendu/encre/textures', async (original) => ({
  ...(await original<typeof Textures>()),
  createInkLayers: () => new DataArrayTexture(new Uint8Array(4 * 14), 1, 1, 14),
  createNoise: () => new DataTexture(new Uint8Array(4), 1, 1),
}));

const content = gameContent();
const dir = fileURLToPath(new URL('../../assets/commun/personnages/', import.meta.url));
const loader = new GLTFLoader();
function parse(file: string): Promise<GLTF> {
  const buffer = readFileSync(dir + file);
  const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return loader.parseAsync(data, '');
}

let library: CharacterLibrary;
beforeAll(async () => {
  library = await loadCharacterLibrary(content.catalogue, content.morphologies, parse);
}, 20_000);

/** Faux rendu: ce que l'aperçu appelle hors image, et le compte de ses libérations. */
function fakeRenderer(): { renderer: WebGLRenderer; disposed: () => number; lost: () => number } {
  let disposed = 0;
  let lost = 0;
  const fake = {
    outputColorSpace: '',
    setPixelRatio: () => undefined,
    getPixelRatio: () => 1,
    setSize: () => undefined,
    dispose: () => {
      disposed += 1;
    },
    forceContextLoss: () => {
      lost += 1;
    },
  };
  return {
    renderer: fake as unknown as WebGLRenderer,
    disposed: () => disposed,
    lost: () => lost,
  };
}

const canvas = {} as HTMLCanvasElement;
const skinned = (root: Object3D): SkinnedMesh[] => {
  const found: SkinnedMesh[] = [];
  root.traverse((o) => {
    // Le corps nu du gabarit (caché) ne se dessine jamais.
    if (o instanceof SkinnedMesh && o.visible) found.push(o as SkinnedMesh);
  });
  return found;
};

/** Écoute la libération de toutes les géométries et matériaux de la scène. */
function watchDisposal(root: Object3D, mine: (mesh: Mesh) => boolean): () => number {
  const pending = new Set<BufferGeometry | Material>();
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const mesh = o as Mesh;
    if (!mine(mesh)) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const item of [mesh.geometry, ...materials]) {
      if (pending.has(item)) continue;
      pending.add(item);
      item.addEventListener('dispose', () => pending.delete(item));
    }
  });
  return () => pending.size;
}

async function open(style: NonNullable<PreviewOptions['style']>) {
  const fake = fakeRenderer();
  const preview = await createCharacterPreview(canvas, content, library, {
    style,
    renderer: () => fake.renderer,
  });
  return { preview, fake };
}

describe('aperçu de l’éditeur de personnage', () => {
  it('en encre: matériaux encrés du jeu, changement visible aussitôt, tout libéré à la fermeture', async () => {
    const a = composeLook('apercu-a', content.catalogue);
    const b = composeLook('apercu-b', content.catalogue);
    for (let round = 0; round < 10; round += 1) {
      const { preview, fake } = await open('encre');
      preview.setLook(a, false);
      const first = skinned(preview.scene);
      expect(first.length).toBeGreaterThan(0);
      for (const mesh of first) expect(isInkMaterial(mesh.material)).toBe(true);
      // Ombre de contact du jeu (matériau encré partagé), qui tourne avec le personnage.
      const kinds = new Set<string>();
      preview.scene.traverse((o) => kinds.add(o.type));
      expect(kinds.has('Mesh')).toBe(true);

      // Une pièce changée: le nouvel assemblage est en scène sans attendre d'image, l'ancien libéré.
      const old = watchDisposal(preview.scene, (m) => first.includes(m as SkinnedMesh));
      const oldGeometries = new Set(first.map((m) => m.geometry));
      preview.setLook(b, true);
      const second = skinned(preview.scene);
      expect(second.some((m) => oldGeometries.has(m.geometry))).toBe(false);
      for (const mesh of second) expect(isInkMaterial(mesh.material)).toBe(true);
      // Les matériaux du personnage restent (même programme): seules les géométries partent.
      expect(old()).toBe(2);

      const all = watchDisposal(preview.scene, (m) => m.visible);
      preview.dispose();
      expect(all()).toBe(0);
      expect(fake.disposed()).toBe(1);
      // Le canevas de l'éditeur sert à la prochaine ouverture: son contexte n'est pas perdu.
      expect(fake.lost()).toBe(0);
    }
  });

  it('en aplats: l’ancien aperçu, libéré de même', async () => {
    const { preview, fake } = await open('aplats');
    preview.setLook(composeLook('apercu-a', content.catalogue), false);
    const meshes = skinned(preview.scene);
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) expect(mesh.material).toBeInstanceOf(MeshStandardMaterial);
    const all = watchDisposal(preview.scene, (m) => m.visible);
    preview.dispose();
    expect(all()).toBe(0);
    expect(fake.disposed()).toBe(1);
  });
});
