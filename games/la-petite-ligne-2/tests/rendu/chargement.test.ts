// Chargement et déchargement d'un lieu (lot L4): tout vient des données, tout est rendu au départ.
import { BufferGeometry, Color, Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { createPlaceState } from '../../src/simulation/noyau/monde';
import { Fadable } from '../../src/rendu/fondu';
import {
  boxOf,
  describeDynamic,
  describePlace,
  dynamicSignature,
  footprint,
} from '../../src/rendu/lieu/description';
import { groundGeometry, standInGeometry } from '../../src/rendu/lieu/formes';
import { PlaceScene } from '../../src/rendu/lieu/lieu';
import { RENDER_SETTINGS } from '../../src/rendu/reglages';
import { gameContent } from '../aides';

const content = gameContent();
const materials = (): { ground: MeshStandardMaterial; standIn: MeshStandardMaterial } => ({
  ground: new MeshStandardMaterial(),
  standIn: new MeshStandardMaterial(),
});

/** Compte les géométries créées et libérées pendant `run` (événement `dispose` de Three.js). */
function countDisposals(scene: PlaceScene): { live: () => number } {
  let live = 0;
  scene.root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry as BufferGeometry;
    live += 1;
    geometry.addEventListener('dispose', () => {
      live -= 1;
    });
  });
  return { live: () => live };
}

describe('description d’un lieu', () => {
  it('décrit chaque lieu des données: zones, meubles à la taille de leurs données', () => {
    for (const place of Object.values(content.places)) {
      const description = describePlace(content, place);
      expect(description.width).toBe(place.map.width);
      // Une porte de pièce ajoute son paillasson à son encadrement (`doorVolumes`).
      const mats = description.volumes.filter((v) => v.id.endsWith('-tapis')).length;
      expect(description.volumes).toHaveLength(
        place.map.blocked.length + place.map.objects.length + mats,
      );
      for (const object of place.map.objects) {
        const volume = description.volumes.find((v) => v.id === object.id);
        const prop = content.props[object.type];
        expect(volume, object.id).toBeDefined();
        if (volume === undefined || prop === undefined) continue;
        expect(volume.aimable).toBe(true);
        // L'objet visible d'une porte est dessiné sur son seuil, en porte: pas à la taille du meuble.
        if (volume.shape === 'door' || volume.shape === 'mat' || volume.shape === 'hatch') continue;
        expect(volume.model).toBe(prop.model);
        expect(volume.aimable).toBe(true);
        // L'emprise tournée est celle des données: un quart de tour échange largeur et profondeur.
        const size = footprint(volume);
        expect(size).toEqual(
          object.rotation % 2 === 0
            ? { w: prop.size.w, h: prop.size.h }
            : { w: prop.size.h, h: prop.size.w },
        );
        const box = boxOf(volume);
        expect(box.max.x - box.min.x).toBeCloseTo(size.w);
        expect((box.min.z + box.max.z) / 2).toBeCloseTo(object.y);
      }
    }
  });

  it('suit les meubles posés et les objets au sol', () => {
    const place = Object.values(content.places)[0];
    const type = Object.keys(content.props)[0];
    const item = Object.keys(content.items)[0];
    if (place === undefined || type === undefined || item === undefined)
      throw new Error('données d’essai absentes');
    const state = createPlaceState(content, place);
    const empty = dynamicSignature(state);
    expect(describeDynamic(content, state)).toEqual([]);
    state.placed.push({ id: 'pose-0', type, x: 6, y: 7, rotation: 1 });
    state.nextPlacedId = 1;
    state.ground.push({ id: 0, stack: { item, count: 1 }, x: 3, y: 3 });
    state.nextGroundId = 1;
    expect(dynamicSignature(state)).not.toBe(empty);
    const volumes = describeDynamic(content, state);
    expect(volumes.map((v) => v.id)).toEqual(['pose-0', 'sol-0']);
    const moved = dynamicSignature(state);
    const placed = state.placed[0];
    if (placed !== undefined) placed.x = 8;
    expect(dynamicSignature(state)).not.toBe(moved);
  });
});

describe('formes provisoires', () => {
  it('tiennent dans l’emprise et à la hauteur demandées', () => {
    const geometry = standInGeometry({
      id: 'essai',
      model: 'essai',
      x: 0,
      y: 0,
      w: 2,
      h: 1,
      rotation: 0,
      base: 0,
      height: 0.9,
      shape: 'box',
      occludes: true,
      aimable: true,
    });
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    expect(box).not.toBeNull();
    if (box === null) return;
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.y).toBeCloseTo(0.9);
    expect(box.max.x - box.min.x).toBeLessThanOrEqual(2);
    expect(box.max.x - box.min.x).toBeGreaterThan(1.8);
    // La bande de façade dépasse à peine, côté +Z (le sud à la rotation 0).
    expect(box.max.z).toBeGreaterThan(-box.min.z);
    expect(box.max.z).toBeLessThanOrEqual(0.5);
    expect(geometry.getAttribute('color')).toBeDefined();
    geometry.dispose();
  });

  it('font un sol d’une case par mètre, plus sa tranche', () => {
    const geometry = groundGeometry(8, 6);
    expect(geometry.getIndex()?.count).toBe((8 * 6 + 4) * 6);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.max.x).toBe(8);
    expect(geometry.boundingBox?.max.z).toBe(6);
    expect(geometry.boundingBox?.min.y).toBe(-RENDER_SETTINGS.ground.thickness);
    geometry.dispose();
  });
});

describe('scène d’un lieu', () => {
  it('se construit depuis les données et rend toutes ses géométries au départ', () => {
    for (const place of Object.values(content.places)) {
      const description = describePlace(content, place);
      const scene = new PlaceScene(description, materials(), null);
      const counts = scene.counts();
      expect(counts.volumes).toBe(description.volumes.length);
      // Aucun modèle livré: tout est provisoire, et le dit.
      expect(counts.standIns).toBe(counts.volumes);
      const tracked = countDisposals(scene);
      expect(tracked.live()).toBe(description.volumes.length + 1);
      scene.dispose();
      expect(tracked.live()).toBe(0);
      expect(scene.root.children).toHaveLength(0);
    }
  });

  it('prend le modèle livré quand il existe, la forme provisoire sinon', () => {
    const place = Object.values(content.places).find((p) => p.map.objects.length > 0);
    if (place === undefined) throw new Error('aucun lieu avec un meuble');
    const first = place.map.objects[0];
    const wanted = first === undefined ? undefined : content.props[first.type]?.model;
    const shared = new BufferGeometry();
    let sharedDisposed = false;
    shared.addEventListener('dispose', () => {
      sharedDisposed = true;
    });
    const material = new MeshStandardMaterial();
    const scene = new PlaceScene(describePlace(content, place), materials(), {
      instantiate: (model) => (model === wanted ? new Mesh(shared, material) : null),
    });
    const modelled = place.map.objects.filter((o) => content.props[o.type]?.model === wanted);
    expect(scene.counts().standIns).toBe(scene.counts().volumes - modelled.length);
    expect(first === undefined ? null : scene.aimable(first.id)).not.toBeNull();
    scene.dispose();
    // Le modèle appartient à sa source: le lieu ne le libère pas.
    expect(sharedDisposed).toBe(false);
  });

  it('refait ses volumes dynamiques sans rien laisser derrière', () => {
    const place = Object.values(content.places)[0];
    const type = Object.keys(content.props)[0];
    if (place === undefined || type === undefined) throw new Error('données d’essai absentes');
    const scene = new PlaceScene(describePlace(content, place), materials(), null);
    const fixed = scene.counts().volumes;
    // Les grands meubles livrés de la carte (plus de 1,10 m) cachent déjà: ils restent.
    const occluders = scene.occlusion.size;
    const state = createPlaceState(content, place);
    state.placed.push({ id: 'pose-0', type, x: 6, y: 7, rotation: 0 });
    const children = scene.root.children.length;
    for (let i = 0; i < 10; i += 1) scene.setDynamic(describeDynamic(content, state));
    expect(scene.counts().volumes).toBe(fixed + 1);
    expect(scene.root.children).toHaveLength(children + 1);
    expect(scene.aimable('pose-0')).not.toBeNull();
    scene.setDynamic([]);
    expect(scene.root.children).toHaveLength(children);
    expect(scene.occlusion.size).toBe(occluders);
    scene.dispose();
  });
});

describe('fondu', () => {
  it('ne copie le matériau que pendant le fondu ou la lueur, et le rend ensuite', () => {
    const original = new MeshStandardMaterial();
    const mesh = new Mesh(new BufferGeometry(), original);
    const fadable = new Fadable(mesh, new Color('#ffffff'));
    expect(fadable.copies).toBe(0);
    fadable.apply(0.4, 0);
    const copy = mesh.material;
    expect(copy).not.toBe(original);
    expect(copy.transparent).toBe(true);
    expect(copy.opacity).toBe(0.4);
    expect(copy.depthWrite).toBe(false);
    // Le matériau partagé n'est jamais touché.
    expect(original.transparent).toBe(false);
    expect(original.opacity).toBe(1);
    let disposed = false;
    copy.addEventListener('dispose', () => {
      disposed = true;
    });
    fadable.apply(1, 0.2);
    expect(mesh.material).toBe(copy);
    expect(copy.transparent).toBe(false);
    expect(copy.emissiveIntensity).toBe(0.2);
    fadable.apply(1, 0);
    expect(mesh.material).toBe(original);
    expect(disposed).toBe(true);
    expect(fadable.copies).toBe(0);
  });
});
