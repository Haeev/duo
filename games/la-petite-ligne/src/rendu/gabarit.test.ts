// Gabarits des personnages témoins (qualité visuelle, étape A): os de repos posés sur la copie du
// squelette (`bone_rest`), pose de repos propre (`idle_clip`), et clips qui restent justes sur les
// trois gabarits (pieds, foulée, mains), lus dans `personnages.glb` sans navigateur.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  AnimationClip,
  AnimationMixer,
  Bone,
  Group,
  InterpolateDiscrete,
  InterpolateLinear,
  Object3D,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
  type KeyframeTrack,
} from 'three';
import { describe, expect, it } from 'vitest';
import { plantedFootSpeed } from './foulee';
import { IDLE_CLIP, applyBoneRest, boneRestOf, idleClipOf } from './gabarit';
import { CLIP_FOR_ACTION } from './gestes';
import { RENDER_SETTINGS } from './reglages';

const GLB_HEADER = 12;
const CHUNK_HEADER = 8;
const FLOAT = 5126;
const SIZES: Readonly<Record<string, number>> = { SCALAR: 1, VEC3: 3, VEC4: 4 };
/** Personnages refaits sur un gabarit (nœud, gabarit), et le joueur moyen. */
const WITNESSES = ['villager_colette', 'villager_firmin', 'player_base'] as const;
/** Seuls os dont les clips animent la translation (le reste garde le repos du gabarit). */
const TRANSLATED = new Set(['root', 'hips']);
const FEET = ['foot_l', 'foot_r'];
const HANDS = ['socket_hand_r', 'socket_hand_l'];

interface GltfNode {
  name?: string;
  children?: number[];
  translation?: number[];
  rotation?: number[];
  extras?: Record<string, unknown>;
}
interface Gltf {
  nodes: GltfNode[];
  skins: { joints: number[] }[];
  accessors: {
    bufferView: number;
    byteOffset?: number;
    count: number;
    type: string;
    componentType: number;
  }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  animations: {
    name: string;
    channels: { sampler: number; target: { node: number; path: string } }[];
    samplers: { input: number; output: number; interpolation?: string }[];
  }[];
}

function readGlb(): { json: Gltf; bin: Buffer } {
  const path = fileURLToPath(new URL('../../assets/modeles/personnages.glb', import.meta.url));
  const data = readFileSync(path);
  const length = data.readUInt32LE(GLB_HEADER);
  const start = GLB_HEADER + CHUNK_HEADER;
  const json = JSON.parse(data.subarray(start, start + length).toString('utf8')) as Gltf;
  const binStart = start + length + CHUNK_HEADER;
  return { json, bin: data.subarray(binStart) };
}

const GLB = readGlb();

function floats(index: number): Float32Array {
  const accessor = GLB.json.accessors[index];
  const view = accessor === undefined ? undefined : GLB.json.bufferViews[accessor.bufferView];
  if (
    accessor === undefined ||
    view === undefined ||
    accessor.componentType !== FLOAT ||
    view.byteStride !== undefined
  ) {
    throw new Error(`accesseur ${index}: flottants serrés attendus`);
  }
  const size = SIZES[accessor.type] ?? 1;
  const offset = GLB.bin.byteOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return new Float32Array(GLB.bin.buffer.slice(offset, offset + accessor.count * size * 4));
}

/** Squelette commun de l'artiste (os, et accroches des mains), au repos du GLB. */
function buildRig(): Group {
  const rig = new Group();
  const skin = GLB.json.skins[0];
  const joints = new Set(skin?.joints ?? []);
  const made = new Map<number, Object3D>();
  const make = (index: number): Object3D => {
    const node = GLB.json.nodes[index];
    const object = joints.has(index) ? new Bone() : new Object3D();
    object.name = node?.name ?? '';
    if (node?.translation !== undefined) object.position.fromArray(node.translation);
    if (node?.rotation !== undefined) object.quaternion.fromArray(node.rotation);
    made.set(index, object);
    for (const child of node?.children ?? []) {
      const name = GLB.json.nodes[child]?.name ?? '';
      if (joints.has(child) || name.startsWith('socket_')) object.add(make(child));
    }
    return object;
  };
  const rootIndex = GLB.json.nodes.findIndex((node) => node.name === 'root');
  rig.add(make(rootIndex));
  return rig;
}

const CLIPS = new Map<string, AnimationClip>(
  GLB.json.animations.map((animation) => {
    const tracks: KeyframeTrack[] = [];
    for (const channel of animation.channels) {
      const sampler = animation.samplers[channel.sampler];
      const name = GLB.json.nodes[channel.target.node]?.name;
      if (sampler === undefined || name === undefined) continue;
      const times = floats(sampler.input);
      const values = floats(sampler.output);
      const interpolation =
        sampler.interpolation === 'STEP' ? InterpolateDiscrete : InterpolateLinear;
      if (channel.target.path === 'rotation')
        tracks.push(
          new QuaternionKeyframeTrack(`${name}.quaternion`, [...times], [...values], interpolation),
        );
      else if (channel.target.path === 'translation')
        tracks.push(
          new VectorKeyframeTrack(`${name}.position`, [...times], [...values], interpolation),
        );
    }
    return [animation.name, new AnimationClip(animation.name, -1, tracks)] as const;
  }),
);

function extrasOf(name: string): Record<string, unknown> {
  return GLB.json.nodes.find((node) => node.name === name)?.extras ?? {};
}

/** Squelette posé au gabarit du témoin. */
function witnessRig(name: string): Group {
  const rig = buildRig();
  applyBoneRest(rig, boneRestOf(extrasOf(name)));
  return rig;
}

const point = new Vector3();

/** Positions (monde) des objets `names` le long du clip, en `samples` instants. */
function sampleClip(
  rig: Group,
  clip: AnimationClip,
  names: readonly string[],
  samples = 24,
): Vector3[][] {
  const mixer = new AnimationMixer(rig);
  mixer.clipAction(clip).play();
  const objects = names.map((name) => rig.getObjectByName(name));
  const out: Vector3[][] = names.map(() => []);
  for (let i = 0; i <= samples; i += 1) {
    mixer.setTime((clip.duration * i) / samples);
    rig.updateMatrixWorld(true);
    objects.forEach((object, k) => {
      if (object === undefined) return;
      object.getWorldPosition(point);
      out[k]?.push(point.clone());
    });
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(rig);
  return out;
}

describe('os de repos et pose de repos (gabarit.ts)', () => {
  it('pose les translations valides sur les os de la copie, ignore le reste', () => {
    const model = new Group();
    const chest = new Bone();
    chest.name = 'chest';
    const socket = new Object3D();
    socket.name = 'neck';
    model.add(chest, socket);
    const rest = boneRestOf({
      bone_rest: { chest: [0, 0.15, 0], neck: [0, 0.2, 0], head: [0, 'x', 0], hand_l: [1, 2] },
    });
    expect([...rest.keys()]).toEqual(['chest', 'neck']);
    // `neck` n'est pas un os ici: seul `chest` est posé.
    expect(applyBoneRest(model, rest)).toBe(1);
    expect(chest.position.toArray()).toEqual([0, 0.15, 0]);
    expect(socket.position.toArray()).toEqual([0, 0, 0]);
    expect(boneRestOf({ bone_rest: [1, 2, 3] }).size).toBe(0);
    expect(boneRestOf({}).size).toBe(0);
  });

  it('joue `idle_clip` s’il existe, sinon `idle`', () => {
    const clips = new Set(['idle', 'idle_colette']);
    expect(idleClipOf({ idle_clip: 'idle_colette' }, clips)).toBe('idle_colette');
    expect(idleClipOf({ idle_clip: 'idle_absent' }, clips)).toBe(IDLE_CLIP);
    expect(idleClipOf({ idle_clip: 3 }, clips)).toBe(IDLE_CLIP);
    expect(idleClipOf({}, clips)).toBe(IDLE_CLIP);
  });
});

describe('témoins de personnages.glb', () => {
  it('chaque témoin nomme une pose de repos présente et des os du squelette commun', () => {
    const skin = GLB.json.skins[0];
    const joints = new Set((skin?.joints ?? []).map((index) => GLB.json.nodes[index]?.name));
    for (const name of WITNESSES) {
      const extras = extrasOf(name);
      expect(idleClipOf(extras, CLIPS), name).not.toBe(IDLE_CLIP);
      for (const bone of boneRestOf(extras).keys())
        expect(joints.has(bone), `${name}: ${bone}`).toBe(true);
    }
    expect(boneRestOf(extrasOf('villager_colette')).size).toBeGreaterThan(0);
    expect(boneRestOf(extrasOf('villager_firmin')).size).toBeGreaterThan(0);
  });

  it('aucun clip n’écrase les os de repos: seuls root et hips sont déplacés', () => {
    for (const clip of CLIPS.values()) {
      for (const track of clip.tracks) {
        const [bone, property] = track.name.split('.');
        if (property === 'position')
          expect(TRANSLATED.has(bone ?? ''), `${clip.name}: ${track.name}`).toBe(true);
      }
    }
    // Après une marche, le buste de Colette garde la translation de son gabarit.
    const rig = witnessRig('villager_colette');
    const walk = CLIPS.get('walk');
    expect(walk).toBeDefined();
    if (walk === undefined) return;
    const mixer = new AnimationMixer(rig);
    mixer.clipAction(walk).play();
    mixer.setTime(walk.duration * 0.37);
    const expected = boneRestOf(extrasOf('villager_colette')).get('chest');
    expect(rig.getObjectByName('chest')?.position.toArray()).toEqual(expected);
  });

  const walking = [
    'walk',
    RENDER_SETTINGS.characters.carryOne.walk,
    'carry_two',
    RENDER_SETTINGS.characters.bikes.walkClip,
  ];
  it.each(WITNESSES)(
    '%s: la foulée de chaque marche reste celle du squelette commun (pied posé immobile)',
    (name) => {
      for (const clipName of walking) {
        const clip = CLIPS.get(clipName);
        expect(clip, clipName).toBeDefined();
        if (clip === undefined) continue;
        const reference = plantedFootSpeed(buildRig(), clip, FEET);
        const speed = plantedFootSpeed(witnessRig(name), clip, FEET);
        expect(reference, clipName).not.toBeNull();
        expect(speed, clipName).not.toBeNull();
        // Le rythme du clip est réglé sur la foulée du squelette commun (`foulee.ts`): 2 % d'écart au plus.
        expect(Math.abs((speed ?? 0) / (reference ?? 1) - 1), `${name} ${clipName}`).toBeLessThan(
          0.02,
        );
      }
    },
  );

  const gestures = [
    ...new Set([
      ...Object.values(CLIP_FOR_ACTION),
      RENDER_SETTINGS.characters.posture.sitDown,
      RENDER_SETTINGS.characters.posture.standUp,
      RENDER_SETTINGS.characters.carryOne.idle,
      'sit',
      'sit_ground',
      'sit_edge',
    ]),
  ].filter((name) => CLIPS.has(name));
  it.each(WITNESSES)(
    '%s: assis, outils et portage gardent les pieds au sol et les mains à leur prise',
    (name) => {
      expect(gestures.length).toBeGreaterThan(10);
      for (const clipName of gestures) {
        const clip = CLIPS.get(clipName);
        if (clip === undefined) continue;
        const reference = sampleClip(buildRig(), clip, [...FEET, ...HANDS]);
        const witness = sampleClip(witnessRig(name), clip, [...FEET, ...HANDS]);
        reference.forEach((series, k) => {
          series.forEach((at, i) => {
            const moved = witness[k]?.[i]?.distanceTo(at) ?? Infinity;
            // Jambes du gabarit: hanches seules écartées (1 cm). Bras: épaules, avant-bras et mains
            // de 1 à 2 cm plus courts: la prise bouge de 5 cm au plus (mesuré: 3,8 cm, `hoe`, `chop`, `carry_two`).
            const limit = k < FEET.length ? 0.012 : 0.05;
            expect(
              moved,
              `${name} ${clipName} ${[...FEET, ...HANDS][k] ?? ''} instant ${i}`,
            ).toBeLessThan(limit);
          });
        });
      }
    },
  );
});
