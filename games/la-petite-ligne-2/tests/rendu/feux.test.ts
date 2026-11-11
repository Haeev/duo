// Feux vivants du rendu encré: la conversion reconnaît `flamme` (langue en pointe, sinon verre) et
// `braise` par leur nom, la langue porte sa hauteur, et deux exemplaires n'ont pas la même phase.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { ambianceAt, gameAmbiances } from '../../src/rendu/encre/ambiances';
import { fireBeat, firePhase, KIND } from '../../src/rendu/encre/couches';
import { modelLamp } from '../../src/rendu/encre/lumieres';
import { applyAmbiance, createInkUniforms } from '../../src/rendu/encre/matiere';
import { DecorModels, mergeNamed } from '../../src/rendu/lieu/decors';
import { DECOR_MANIFEST, type DecorManifest } from '../../src/rendu/lieu/decors-manifeste';

const MATERIALS = DECOR_MANIFEST.materials ?? {};

function named(name: string, positions: number[]): Mesh {
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
  material.name = name;
  return new Mesh(geometry, material);
}

/** Pyramide de 30 cm à base carrée de 10 cm: une langue de feu. */
const TONGUE = [
  [-0.05, 0, -0.05],
  [0.05, 0, -0.05],
  [0, 0.3, 0],
  [0.05, 0, -0.05],
  [0.05, 0, 0.05],
  [0, 0.3, 0],
  [0.05, 0, 0.05],
  [-0.05, 0, 0.05],
  [0, 0.3, 0],
].flat();

/** Paroi droite de 20 cm sur 20 cm: un verre de lanterne (son haut est aussi large que son pied). */
const PANE = [
  [1, 0, 0],
  [1.2, 0, 0],
  [1.2, 0.2, 0],
  [1, 0, 0],
  [1.2, 0.2, 0],
  [1, 0.2, 0],
].flat();

const EMBER = [
  [2, 0, 0],
  [2.1, 0, 0],
  [2.05, 0.04, 0.05],
].flat();

describe('conversion des feux par le nom des matériaux', () => {
  it('reconnaît une langue de feu, un verre et une braise', () => {
    expect(MATERIALS.flamme?.kind).toBe('fire');
    expect(MATERIALS.braise?.kind).toBe('ember');
    const root = new Group();
    root.add(named('flamme', TONGUE), named('flamme', PANE), named('braise', EMBER));
    const mesh = mergeNamed(root, 0, MATERIALS);
    const ink = mesh?.geometry.getAttribute('aInk');
    expect(ink?.count).toBe(18);
    const kinds = Array.from({ length: 18 }, (_, i) => ink?.getZ(i));
    expect(kinds.slice(0, 9).every((k) => k === KIND.fire)).toBe(true);
    expect(kinds.slice(9, 15).every((k) => k === KIND.flame)).toBe(true);
    expect(kinds.slice(15).every((k) => k === KIND.ember)).toBe(true);
    // La langue porte sa hauteur (30 cm) et la place de chaque sommet, du pied (0) à la pointe.
    expect(Math.floor(ink?.getX(0) ?? 0)).toBe(30);
    expect((ink?.getX(0) ?? 0) % 1).toBeCloseTo(0, 5);
    expect((ink?.getX(2) ?? 0) % 1).toBeCloseTo(0.999, 3);
  });

  it('trouve des langues de feu dans les feux livrés, et aucune dans les lanternes', async () => {
    const dir = fileURLToPath(new URL('../../assets/commun/decors/', import.meta.url));
    const loader = new GLTFLoader();
    const parse = (file: string): Promise<GLTF> => {
      const buffer = readFileSync(dir + file);
      return loader.parseAsync(
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
        '',
      );
    };
    const pick = ['festival-cauldron', 'brazier', 'street-lantern', 'lampion-garland'];
    const manifest: DecorManifest = {
      ...DECOR_MANIFEST,
      models: Object.fromEntries(
        Object.entries(DECOR_MANIFEST.models).filter(([id]) => pick.includes(id)),
      ),
    };
    const models = new DecorModels(manifest, parse);
    await models.ready;
    const count = (id: string, kind: number): number => {
      const ink = models.geometryOf(id)?.getAttribute('aInk');
      let n = 0;
      for (let i = 0; i < (ink?.count ?? 0); i++) if (ink?.getZ(i) === kind) n += 1;
      return n;
    };
    expect(count('festival-cauldron', KIND.fire)).toBeGreaterThan(0);
    expect(count('brazier', KIND.fire)).toBeGreaterThan(0);
    expect(count('street-lantern', KIND.fire)).toBe(0);
    expect(count('street-lantern', KIND.flame)).toBeGreaterThan(0);
    expect(count('lampion-garland', KIND.fire)).toBe(0);
  });
});

describe('phase et vacillement', () => {
  it('deux exemplaires voisins ne battent pas ensemble', () => {
    const a = firePhase(4, 7);
    const b = firePhase(5, 7);
    expect(Math.abs(a - b)).toBeGreaterThan(1);
    const apart = Array.from({ length: 20 }, (_, i) =>
      Math.abs(fireBeat(i * 0.25, a) - fireBeat(i * 0.25, b)),
    );
    expect(Math.max(...apart)).toBeGreaterThan(0.5);
  });

  it('la lampe d’un feu de fête vacille avec lui, sans dépasser sa part', () => {
    const light = DECOR_MANIFEST.models.brazier?.light;
    if (light === undefined) throw new Error('brasero sans lumière');
    const lamp = modelLamp('b', light, { x: 3, z: 2, ground: 0, yaw: 0 }, {}, 'fete');
    expect(lamp.flickerPhase).toBe(firePhase(3, 2));
    expect(lamp.burnsByDay).toBe(true);
    expect(modelLamp('l', light, { x: 3, z: 2, ground: 0, yaw: 0 }, {}, 'luminaire').flicker).toBe(
      undefined,
    );
    const night = ambianceAt(gameAmbiances(), {
      sheet: null,
      minutes: 23 * 60,
      indoor: 0,
      weather: null,
    });
    const u = createInkUniforms();
    const tints = Array.from({ length: 12 }, (_, i) => {
      u.uTime.value = i * 0.25;
      applyAmbiance(u, night, [lamp], []);
      return u.uLampTint.value[0]?.x ?? 0;
    });
    const mean = tints.reduce((s, t) => s + t, 0) / tints.length;
    const spread = Math.max(...tints) - Math.min(...tints);
    expect(spread).toBeGreaterThan(0.02 * mean);
    expect(spread).toBeLessThanOrEqual(2 * (lamp.flicker ?? 0) * mean * 1.2);
    // Mouvement réduit: la lampe ne vacille plus.
    u.uFire.value.y = 0;
    const still = new Set(
      [0, 0.25, 0.5].map((t) => {
        u.uTime.value = t;
        applyAmbiance(u, night, [lamp], []);
        return u.uLampTint.value[0]?.x;
      }),
    );
    expect(still.size).toBe(1);
  });
});
