// Bâtiments livrés dans le rendu encré (ADR 0023): fusion d'un modèle en une géométrie, couche de
// traits d'après le nom du matériau, et gabarit: un bâtiment factice ajouté au manifeste arrive
// dans la source sans autre changement.
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { KIND, LAYER } from '../../src/rendu/encre/couches';
import { mergeBuilding, PlaceBuildings } from '../../src/rendu/lieu/batiments';

function part(name: string, hex: string, x: number): Mesh {
  const geometry: BufferGeometry = new BoxGeometry(2, 2, 2).translate(x, 1, 0);
  const color = new Color(hex);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const material = new MeshStandardMaterial();
  material.name = name;
  return new Mesh(geometry, material);
}

function house(): Group {
  const root = new Group();
  root.name = 'maison-factice';
  root.add(part('pierre', '#b0a590', 0), part('tuile', '#a0503c', 4), part('vitre', '#3c4a5a', 8));
  return root;
}

describe('bâtiments livrés', () => {
  it('fusionne les matériaux en une géométrie: couche par nom, une seule pièce de contour', () => {
    const merged = mergeBuilding(house(), 3);
    if (merged === null) throw new Error('fusion vide');
    const ink = merged.getAttribute('aInk');
    const each = ink.count / 3;
    expect(ink.getX(0)).toBe(LAYER.face);
    expect(ink.getX(each)).toBe(LAYER.roof);
    expect(ink.getX(each * 2)).toBe(LAYER.plain);
    expect(ink.getZ(each * 2)).toBe(KIND.window);
    expect(ink.getZ(0)).toBe(KIND.none);
    // Une pièce (grande: classe 0), trois morceaux.
    const piece = ink.getY(0);
    for (let i = 0; i < ink.count; i++) expect(ink.getY(i)).toBe(piece);
    expect(Math.floor(piece / 64)).toBe(0);
    expect(new Set([ink.getW(0), ink.getW(each), ink.getW(each * 2)]).size).toBe(3);
    expect(Object.keys(merged.attributes).sort()).toEqual(['aInk', 'color', 'normal', 'position']);
  });

  it('gabarit: un bâtiment factice du manifeste arrive dans la source, fenêtres comprises', async () => {
    const manifest = {
      format: 'duo-batiments/1',
      lieu: 'lieu-factice',
      materiaux: ['pierre', 'tuile', 'vitre'],
      batiments: {
        'maison-factice': {
          fichier: 'maison-factice.glb',
          noeud: 'maison-factice',
          nom: 'la maison factice',
          emprise: { largeur: 6, profondeur: 4 },
          triangles: 36,
          budget: 6000,
          octets: 1000,
          hauteur: 2,
          porte: null,
          fenetres: [{ x: 3, appui: 1, z: 0, largeur: 0.9, hauteur: 1.2, nx: 1, nz: 0 }],
        },
      },
    };
    const scene = new Group();
    scene.add(house());
    const source = new PlaceBuildings(
      { '/x/lieu-factice/batiments/batiments.json': manifest },
      () => Promise.resolve({ scene } as unknown as GLTF),
      { '/x/lieu-factice/batiments/maison-factice.glb': 'maison-factice.glb' },
    );
    await source.ready;
    expect(source.size).toBe(1);
    const model = source.model('lieu-factice', 'maison-factice');
    expect(model?.height).toBe(2);
    expect(model?.windows[0]).toEqual({
      x: 3,
      sill: 1,
      z: 0,
      width: 0.9,
      height: 1.2,
      nx: 1,
      nz: 0,
    });
    expect(source.model('lieu-factice', 'inconnu')).toBeNull();
    expect(source.model('ailleurs', 'maison-factice')).toBeNull();
  });

  it('un fichier manquant ou un manifeste faux laisse les volumes provisoires', async () => {
    const source = new PlaceBuildings(
      { '/x/a/batiments/batiments.json': { format: 'autre' } },
      () => Promise.reject(new Error('absent')),
      {},
    );
    await source.ready;
    expect(source.size).toBe(0);
  });
});
