// Couleurs de sommets des pièces de secours (qualité visuelle, étape A): depuis que tous les
// maillages de `personnages.glb` portent COLOR_0, un substitut sans couleurs sortirait noir et sa
// fusion avec le corps échouerait; ses UV visent la rangée 1 d'une texture de 64 rangées.
import {
  Bone,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Uint8BufferAttribute,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../donnees/contenu';
import { CONTENT_FILES } from '../donnees/fichiers';
import type { Appearance } from '../etat/types';
import { PlayerDresser, whiteColorsLike, wearCellUv } from './habillage';
import { CHARACTER_GRID_ROWS, characterGridRows } from './palette';
import { ResourceTracker } from './ressources';

const RGBA = 4;

/** Corps minimal au format du GLB de l'artiste: couleurs en octets normalisés (VEC4), poids, os de tête. */
function body(): { model: Group; mesh: SkinnedMesh } {
  const hips = new Bone();
  hips.name = 'hips';
  const head = new Bone();
  head.name = 'head';
  head.position.y = 1.5;
  hips.add(head);
  const geometry = new CylinderGeometry(0.17, 0.17, 0.3, 8);
  geometry.translate(0, 1.6, 0);
  const count = geometry.getAttribute('position').count;
  geometry.setAttribute(
    'color',
    new Uint8BufferAttribute(new Uint8Array(count * RGBA).fill(200), RGBA, true),
  );
  const joints = new Uint8Array(count * RGBA);
  const weights = new Float32Array(count * RGBA);
  for (let i = 0; i < count; i += 1) {
    joints[i * RGBA] = 1;
    weights[i * RGBA] = 1;
  }
  geometry.setAttribute('skinIndex', new Uint8BufferAttribute(joints, RGBA));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, RGBA));
  const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial({ vertexColors: true }));
  mesh.name = 'player_base';
  mesh.add(hips);
  mesh.bind(new Skeleton([hips, head]));
  const model = new Group();
  model.add(mesh);
  return { model, mesh };
}

describe('pièces de secours des personnages', () => {
  it('reçoivent des couleurs blanches au format de celles du corps, et se fusionnent avec lui', () => {
    const { mesh } = body();
    const hat = new CylinderGeometry(0.2, 0.2, 0.1, 10);
    expect(mergeGeometries([mesh.geometry, hat], false)).toBeNull();
    whiteColorsLike(hat, mesh.geometry);
    const color = hat.getAttribute('color');
    expect(color.array).toBeInstanceOf(Uint8Array);
    expect(color.itemSize).toBe(RGBA);
    expect(color.normalized).toBe(true);
    expect([...(color.array as Uint8Array)].every((value) => value === 0xff)).toBe(true);
    // Sans les poids, le chapeau a les mêmes attributs que la géométrie du corps sans les siens.
    const plain = mesh.geometry.clone();
    plain.deleteAttribute('skinIndex');
    plain.deleteAttribute('skinWeight');
    expect(mergeGeometries([plain, hat], false)).not.toBeNull();
  });

  it('perdent leurs couleurs face à un corps qui n’en a pas (ancien modèle)', () => {
    const old = new CylinderGeometry(0.2, 0.2, 0.1, 6);
    const hat = new CylinderGeometry(0.2, 0.2, 0.1, 6);
    hat.setAttribute(
      'color',
      new Float32BufferAttribute(new Float32Array(hat.getAttribute('position').count * 3), 3),
    );
    whiteColorsLike(hat, old);
    expect(hat.hasAttribute('color')).toBe(false);
    expect(new BufferGeometry().hasAttribute('color')).toBe(false);
  });

  it('visent la rangée des vêtements d’une texture de 64 rangées (256 px de haut), pas de 16', () => {
    expect(CHARACTER_GRID_ROWS).toBe(64);
    expect(characterGridRows(256)).toBe(64);
    expect(characterGridRows(128)).toBe(32);
    expect(characterGridRows(undefined)).toBe(CHARACTER_GRID_ROWS);
    const cell = wearCellUv('hat', 'principale', 64);
    // Rangée 1 (de 4 à 8 px sur 256), colonne 11 du chapeau (de 44 à 48 px sur 64).
    expect(cell.v * 256).toBeCloseTo(6, 5);
    expect(cell.u * 64).toBeCloseTo(46, 5);
  });

  it('un chapeau absent du modèle donne un substitut fusionné au corps, blanc et sur la bonne case', () => {
    const content = loadContent(CONTENT_FILES);
    const clothes = content.clothes;
    const hat = clothes.list.find((def) => def.slot === 'hat');
    const pick = (slot: string): string => clothes.list.find((def) => def.slot === slot)?.id ?? '';
    expect(hat).toBeDefined();
    if (hat === undefined) return;
    const { model, mesh } = body();
    const plainCount = mesh.geometry.getAttribute('position').count;
    const dresser = new PlayerDresser(clothes, new ResourceTracker());
    const figure = dresser.prepare(model, null);
    const appearance: Pick<Appearance, 'hair' | 'hairColor' | 'beard' | 'wear' | 'scarf'> = {
      hair: 0,
      hairColor: 0,
      beard: 0,
      scarf: '#c0392b',
      wear: {
        top: pick('top'),
        bottom: pick('bottom'),
        shoes: pick('shoes'),
        outer: null,
        hat: hat.id,
      },
    };
    dresser.dress(figure, { id: 'p1', appearance, asleep: false });
    // Fusion réussie: le corps porte maintenant le chapeau de secours.
    expect(figure.merged).not.toBeNull();
    const merged = mesh.geometry;
    expect(merged).toBe(figure.merged);
    const color = merged.getAttribute('color');
    const uv = merged.getAttribute('uv');
    expect(color.count).toBeGreaterThan(plainCount);
    const expected = wearCellUv('hat', 'principale', CHARACTER_GRID_ROWS);
    let hatVertices = 0;
    for (let i = plainCount; i < color.count; i += 1) {
      // `getComponent` rend la valeur normalisée: 1 pour 255.
      for (let k = 0; k < RGBA; k += 1) expect(color.getComponent(i, k)).toBe(1);
      if (Math.abs(uv.getX(i) - expected.u) < 1e-6) {
        expect(uv.getY(i)).toBeCloseTo(expected.v, 6);
        hatVertices += 1;
      }
    }
    expect(hatVertices).toBeGreaterThan(0);
  });
});
