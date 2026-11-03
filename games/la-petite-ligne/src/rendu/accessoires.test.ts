// Habitants de la 0.13 (lot H6): échelles, accessoires, roues des vélos et substituts, contrôlés
// contre les fichiers de l'artiste (bloc JSON des GLB) et les données.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Group, Mesh, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import {
  VillagerCarry,
  chooseProp,
  villagerScale,
  wheelTurn,
  type PropSituation,
} from './accessoires';
import { CAT_SETTINGS } from './reglages-faune';
import type { ModelLibrary } from './modeles';
import { RENDER_SETTINGS } from './reglages';
import { buildSubstitute, hasDedicatedSubstitute } from './substituts';
import { VILLAGERS_013 } from './demo/habitants13-exemple';

const GLB_HEADER = 12;
const CHUNK_HEADER = 8;
const SETTINGS = RENDER_SETTINGS.characters;

interface GlbNode {
  name?: string;
  children?: number[];
  translation?: number[];
  extras?: Record<string, unknown>;
}

function glb(file: string): { nodes: GlbNode[]; animations: { name?: string }[] } {
  const path = fileURLToPath(new URL(`../../assets/modeles/${file}`, import.meta.url));
  const data = readFileSync(path);
  const length = data.readUInt32LE(GLB_HEADER);
  const json = JSON.parse(
    data.subarray(GLB_HEADER + CHUNK_HEADER, GLB_HEADER + CHUNK_HEADER + length).toString('utf8'),
  ) as { nodes?: GlbNode[]; animations?: { name?: string }[] };
  return { nodes: json.nodes ?? [], animations: json.animations ?? [] };
}

const CHARACTERS = glb('personnages.glb');
const byName = new Map(CHARACTERS.nodes.map((node) => [node.name ?? '', node]));

/** Échelles de pose de la fiche de l'artiste (README des modèles, « Habitants de la 0.13 »). */
const SCALES: Readonly<Record<string, number>> = {
  armand: 1.035,
  berthe: 1,
  martial: 1,
  marthe: 0.92,
  honorine: 0.86,
  ines: 1.03,
  barnabe: 1.1,
  mado: 1,
  paulin: 0.97,
  margot: 0.97,
  leon: 0.78,
  ambroise: 0.94,
  nour: 1,
  colette: 1,
};

const BIKES = ['bicycle_lucie', 'bicycle_martial', 'bicycle_nour'] as const;

function situation(fields: Partial<PropSituation>): PropSituation {
  return { moving: false, activity: 'stand', habit: null, left: null, talking: false, ...fields };
}

describe('échelle des habitants de la 0.13', () => {
  it('chaque nœud porte l’échelle de la fiche, et les données transcrites la reprennent', () => {
    for (const [id, scale] of Object.entries(SCALES)) {
      const node = byName.get(`villager_${id}`);
      expect(node, id).toBeDefined();
      expect(node?.extras?.scale, id).toBeCloseTo(scale, 6);
    }
    // Les données passent avant l'extra; sans elles, l'extra; sans rien, 1.
    expect(villagerScale(0.75, { scale: 1.1 })).toBe(0.75);
    expect(villagerScale(undefined, { scale: 1.1 })).toBe(1.1);
    expect(villagerScale(undefined, {})).toBe(1);
    // Les six de la démo, puis les quinze de la 0.13 (lot H4, fichier à part tant qu'il n'est pas chargé).
    let checked = 0;
    for (const file of ['habitants.json', 'habitants-0-13.json']) {
      const url = new URL(`../../donnees/${file}`, import.meta.url);
      if (!existsSync(url)) continue;
      const data = JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as {
        villagers: { id: string; model: string; scale: number }[];
      };
      for (const villager of data.villagers) {
        const extra = byName.get(villager.model)?.extras?.scale;
        if (typeof extra !== 'number') continue;
        expect(villager.scale, villager.id).toBeCloseTo(extra, 6);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('accessoires des habitants', () => {
  it('chaque modèle des règles et chaque clip demandé existent chez l’artiste', () => {
    const clips = new Set(CHARACTERS.animations.map((clip) => clip.name ?? ''));
    for (const [id, rules] of Object.entries(SETTINGS.villagerProps)) {
      for (const rule of rules) {
        expect(byName.has(rule.model), `${id}: ${rule.model}`).toBe(true);
        if (rule.stillClip !== null)
          expect(clips.has(rule.stillClip), `${id}: ${rule.stillClip}`).toBe(true);
      }
    }
    for (const clip of [SETTINGS.bikes.walkClip, SETTINGS.bikes.idleClip, SETTINGS.carryOne.idle]) {
      expect(clips.has(clip), clip).toBe(true);
    }
    const fauna = glb('faune.glb');
    const catClips = new Set(fauna.animations.map((clip) => clip.name ?? ''));
    expect(fauna.nodes.some((node) => node.name === CAT_SETTINGS.model)).toBe(true);
    for (const clip of Object.values(CAT_SETTINGS.clips))
      expect(catClips.has(clip), clip).toBe(true);
  });

  it('le vélo suit la tournée, à l’aller comme au retour, et reste quand un joueur arrête l’habitant', () => {
    const lucie = SETTINGS.villagerProps.lucie ?? [];
    const martial = SETTINGS.villagerProps.martial ?? [];
    // Avant le lot H1 (pas d'habitude dans l'état): le vélo en marchant, rien arrêté.
    expect(chooseProp(lucie, situation({ moving: true }), false, null)?.model).toBe(
      'bicycle_lucie',
    );
    expect(chooseProp(lucie, situation({}), false, null)).toBeNull();
    // Avec les habitudes: vers la tournée, au retour (habitude quittée), pas vers le déjeuner depuis chez elle.
    expect(
      chooseProp(martial, situation({ moving: true, habit: 'rounds' }), false, null)?.mount,
    ).toBe('bike');
    expect(
      chooseProp(martial, situation({ moving: true, habit: 'garden', left: 'rounds' }), false, null)
        ?.mount,
    ).toBe('bike');
    expect(
      chooseProp(lucie, situation({ moving: true, habit: 'lunch', left: 'home' }), false, null),
    ).toBeNull();
    const bike = chooseProp(lucie, situation({ moving: true }), false, null);
    expect(chooseProp(lucie, situation({ talking: true }), false, bike)).toBe(bike);
    // L'accordéon ne sort qu'aux habitudes qui le disent; la loupe d'Ambroise à l'établi, relevée ailleurs.
    const colette = SETTINGS.villagerProps.colette ?? [];
    expect(chooseProp(colette, situation({}), false, null)).toBeNull();
    expect(chooseProp(colette, situation({ habit: 'tuesday_accordion' }), false, null)?.model).toBe(
      'accordion',
    );
    const ambroise = SETTINGS.villagerProps.ambroise ?? [];
    expect(
      chooseProp(ambroise, situation({ activity: 'work', habit: 'shop' }), true, null)?.model,
    ).toBe('villager_ambroise_loupe');
    expect(
      chooseProp(ambroise, situation({ moving: true, habit: 'shop' }), true, null)?.model,
    ).toBe('villager_ambroise_loupe_up');
    expect(
      chooseProp(ambroise, situation({ activity: 'stand', habit: 'mass' }), true, null)?.model,
    ).toBe('villager_ambroise_loupe_up');
  });
});

describe('roues des vélos poussés', () => {
  it('les roues sont à leur axe, au rayon de l’extra', () => {
    for (const bike of BIKES) {
      const node = byName.get(bike);
      const radius = node?.extras?.wheel_radius;
      expect(radius, bike).toBeCloseTo(SETTINGS.bikes.wheelRadius, 6);
      const children = (node?.children ?? []).map((index) => CHARACTERS.nodes[index]?.name);
      for (const suffix of SETTINGS.bikes.wheels) {
        expect(children, bike).toContain(`${bike}${suffix}`);
        expect(byName.get(`${bike}${suffix}`)?.translation?.[1], `${bike}${suffix}`).toBeCloseTo(
          SETTINGS.bikes.wheelRadius,
          3,
        );
      }
    }
  });

  it('tournent de la distance parcourue vers l’avant divisée par le rayon', () => {
    const r = 0.335;
    expect(wheelTurn(0, 1, 0, r)).toBeCloseTo(1 / r, 9);
    expect(wheelTurn(0, -1, 0, r)).toBeCloseTo(-1 / r, 9);
    // Tourné vers +X (yaw = PI / 2): avancer de 1 m en x; un pas de côté ne fait pas tourner.
    expect(wheelTurn(1, 0, Math.PI / 2, r)).toBeCloseTo(1 / r, 9);
    expect(wheelTurn(0, 1, Math.PI / 2, r)).toBeCloseTo(0, 9);
    expect(wheelTurn(1, 0, 0, 0)).toBe(0);
  });

  it('le vélo du substitut tourne ses roues quand le pousseur avance (2 m: 2 / 0,335 rad)', () => {
    const library = {
      instantiate: (name: string): Object3D => {
        const group = new Group();
        for (const part of buildSubstitute(name)) {
          const mesh = new Mesh(part.geometry);
          mesh.name = part.name;
          if (part.position !== undefined) mesh.position.set(...part.position);
          group.add(mesh);
        }
        return group;
      },
      extras: (): Record<string, unknown> => ({}),
    };
    const root = new Group();
    // Bibliothèque réduite aux deux méthodes que lit `VillagerCarry` (le reste demande un GPU).
    const carry = new VillagerCarry(root, library as unknown as ModelLibrary, SETTINGS.bikes);
    carry.setBike('bicycle_nour');
    const front = root.getObjectByName('bicycle_nour_wheel_front');
    expect(front).toBeDefined();
    const noHands = (): boolean => false;
    carry.update(SETTINGS.teleportDistance, noHands);
    for (let i = 1; i <= 20; i += 1) {
      root.position.z = i * 0.1;
      carry.update(SETTINGS.teleportDistance, noHands);
    }
    expect(front?.rotation.x).toBeCloseTo((2 / 0.335) % (2 * Math.PI), 6);
    // Un saut (réapparition) ne compte pas.
    root.position.z = 50;
    carry.update(SETTINGS.teleportDistance, noHands);
    expect(front?.rotation.x).toBeCloseTo((2 / 0.335) % (2 * Math.PI), 6);
    carry.dispose();
    expect(root.children).toHaveLength(0);
  });
});

describe('substituts de la 0.13', () => {
  it('chaque habitant, accessoire, vélo et le chat a son substitut', () => {
    const names = [
      ...VILLAGERS_013.map((id) => `villager_${id}`),
      ...BIKES,
      'school_satchel',
      'milk_can',
      'felling_axe',
      'accordion',
      'cat',
    ];
    for (const name of names) {
      expect(hasDedicatedSubstitute(name), name).toBe(true);
      const parts = buildSubstitute(name);
      expect(parts[0]?.geometry.getAttribute('position').count ?? 0, name).toBeGreaterThan(0);
      for (const part of parts) part.geometry.dispose();
    }
    // Un habitant de substitut mesure 1,75 m (l'échelle de chacun vient du rendu).
    const [figure] = buildSubstitute('villager_honorine');
    figure?.geometry.computeBoundingBox();
    expect(figure?.geometry.boundingBox?.max.y ?? 0).toBeGreaterThan(1.7);
    expect(figure?.geometry.boundingBox?.max.y ?? 0).toBeLessThan(1.85);
    // Les roues sont des pièces à part, posées à leur axe (x 0,56 m, rayon 0,335 m).
    for (const bike of BIKES) {
      const parts = buildSubstitute(bike);
      expect(parts.map((part) => part.name)).toEqual([
        bike,
        ...SETTINGS.bikes.wheels.map((suffix) => `${bike}${suffix}`),
      ]);
      for (const wheel of parts.slice(1))
        expect(wheel.position?.[1]).toBeCloseTo(SETTINGS.bikes.wheelRadius, 6);
    }
  });
});
