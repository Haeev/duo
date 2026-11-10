/**
 * Assemblage d'un personnage (ADR 0021): les pièces du look fusionnées en une géométrie skinnée
 * sur le squelette commun, couleurs des zones en couleurs de sommets, sections du corps couvertes
 * retirées, corpulence et silhouette cuites dans les positions. La tête reste à part pour ses
 * cibles d'expression (2 appels de dessin par personnage); `whole` la fond avec le reste, sans
 * morphoses, pour le niveau de détail lointain (1 appel). Conventions: `assets-src/personnages/README.md`.
 */
import {
  AnimationClip,
  AnimationMixer,
  BufferAttribute,
  BufferGeometry,
  Color,
  type KeyframeTrack,
  type Object3D,
  type SkinnedMesh,
  Vector3,
} from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { Catalogue, Morphologies } from '../../donnees/schemas/personnage';
import type { ResolvedLook } from './apparence';

/** Os dont la translation de repos suit chaque longueur d'une morphologie (âge). */
const LENGTHS = {
  legs: ['LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot'],
  arms: ['LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand'],
  torso: ['Spine02', 'Spine01', 'Spine', 'neck', 'Head'],
} as const;
const FEET = ['LeftFoot', 'RightFoot'] as const;

function isSkinned(object: Object3D): object is SkinnedMesh {
  return (object as Partial<SkinnedMesh>).isSkinnedMesh === true;
}

/** Fichiers du catalogue chargés une fois, partagés par tous les personnages. */
export class CharacterLibrary {
  private readonly nodes = new Map<string, SkinnedMesh>();
  private readonly clipsByShape = new Map<string, Map<string, AnimationClip>>();
  private readonly strides = new Map<string, number>();
  /** Squelette de référence (scène de `body.glb`), cloné pour chaque personnage. */
  readonly template: Object3D;
  readonly boneNames: readonly string[];
  readonly clips: readonly AnimationClip[];

  constructor(
    readonly catalogue: Catalogue,
    readonly morphologies: Morphologies,
    private readonly files: ReadonlyMap<string, GLTF>,
  ) {
    const bodyPiece = catalogue.pieces.find((piece) => piece.slot === 'body');
    const bodyFile = bodyPiece === undefined ? undefined : files.get(bodyPiece.file);
    if (bodyPiece === undefined || bodyFile === undefined)
      throw new Error('corps absent du catalogue');
    for (const [file, gltf] of files) {
      gltf.scene.traverse((object) => {
        if (!isSkinned(object)) return;
        // Le nœud nommé porte la primitive (un seul maillage); selon l'export, le nom est sur lui ou son parent.
        for (const name of [object.name, object.parent?.name ?? '']) {
          const key = `${file}#${name}`;
          if (name !== '' && !this.nodes.has(key)) this.nodes.set(key, object);
        }
      });
    }
    this.template = bodyFile.scene;
    const body = this.node(bodyPiece.file, bodyPiece.node);
    if (body === null) throw new Error(`nœud ${bodyPiece.node} absent de ${bodyPiece.file}`);
    this.boneNames = body.skeleton.bones.map((bone) => bone.name);
    this.clips = bodyFile.animations;
  }

  node(file: string, name: string): SkinnedMesh | null {
    return this.nodes.get(`${file}#${name}`) ?? null;
  }

  /** Échelle de la translation des hanches: les jambes plus courtes abaissent le bassin. */
  hipsScale(shape: string): number {
    const legs = this.morphologies.shapes[shape]?.legs ?? 1;
    return (0.1 + 0.8 * legs) / 0.9;
  }

  /** Clips d'une morphologie: rotations seules, plus la translation des hanches mise à l'échelle. */
  clipsFor(shape: string): ReadonlyMap<string, AnimationClip> {
    const cached = this.clipsByShape.get(shape);
    if (cached !== undefined) return cached;
    const scale = this.hipsScale(shape);
    const out = new Map<string, AnimationClip>();
    for (const clip of this.clips) {
      const tracks: KeyframeTrack[] = [];
      for (const track of clip.tracks) {
        if (track.name.endsWith('.quaternion')) tracks.push(track);
        else if (track.name === 'Hips.position') {
          const copy = track.clone();
          for (let i = 0; i < copy.values.length; i += 1)
            copy.values[i] = (copy.values[i] ?? 0) * scale;
          tracks.push(copy);
        }
      }
      out.set(clip.name, new AnimationClip(clip.name, clip.duration, tracks));
    }
    this.clipsByShape.set(shape, out);
    return out;
  }

  /**
   * Distance parcourue par un cycle du clip, au gabarit de référence (m): deux pas, chacun
   * de l'amplitude d'un pied d'avant en arrière. Sert à caler la cadence sur la vitesse réelle.
   */
  stride(clipName: string): number {
    const known = this.strides.get(clipName);
    if (known !== undefined) return known;
    const clip = this.clips.find((c) => c.name === clipName);
    let value = 1;
    if (clip !== undefined) {
      const root = cloneSkinned(this.template);
      const mixer = new AnimationMixer(root);
      mixer.clipAction(clip).play();
      const feet = FEET.map((name) => root.getObjectByName(name)).filter(
        (bone): bone is Object3D => bone !== undefined,
      );
      const point = new Vector3();
      let range = 0;
      for (const foot of feet) {
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i <= 32; i += 1) {
          mixer.setTime((clip.duration * i) / 32);
          root.updateMatrixWorld(true);
          foot.getWorldPosition(point);
          min = Math.min(min, point.z);
          max = Math.max(max, point.z);
        }
        range = Math.max(range, max - min);
      }
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      if (range > 0.05) value = range * 2;
    }
    this.strides.set(clipName, value);
    return value;
  }

  /** Taille debout de la morphologie (m), pour le niveau de détail. */
  height(shape: string): number {
    return this.catalogue.shapes.find((s) => s.id === shape)?.height ?? 1.7;
  }

  dispose(): void {
    for (const gltf of this.files.values()) {
      gltf.scene.traverse((object) => {
        if (isSkinned(object)) object.geometry.dispose();
      });
    }
  }
}

/** Les géométries d'un personnage assemblé. */
export interface AssembledGeometry {
  /** Tout sauf la tête: un maillage, un matériau. */
  readonly body: BufferGeometry;
  /** Tête et ses cibles d'expression, `null` si le look n'en a pas. */
  readonly head: BufferGeometry | null;
  /** Corps et tête fondus, sans morphoses (loin). */
  readonly whole: BufferGeometry;
  readonly triangles: number;
  /** Pièces introuvables dans leur fichier (catalogue et GLB désaccordés): ignorées. */
  readonly missing: readonly string[];
}

interface Part {
  readonly position: Float32Array;
  readonly normal: Float32Array;
  readonly color: Float32Array;
  readonly skinIndex: Uint16Array;
  readonly skinWeight: Float32Array;
  readonly index: Uint32Array;
  readonly morphs: BufferGeometry['morphAttributes']['position'] | undefined;
  readonly dictionary: Record<string, number>;
}

const color = new Color();

/**
 * Section du corps d'un sommet. Le générateur écrit `(section + 0,5) / 16` en V dans Blender;
 * l'export glTF retourne l'axe V (v' = 1 - v): on relit donc depuis le haut. Vérifié sur
 * `body.glb`: sans ce retournement, une jupe retirait les mollets et les mains.
 */
export function sectionOf(v: number): number {
  return 15 - Math.min(15, Math.max(0, Math.floor(v * 16)));
}

function readPart(
  source: SkinnedMesh,
  piece: ResolvedLook['pieces'][number],
  look: ResolvedLook,
  library: CharacterLibrary,
  boneIndex: ReadonlyMap<string, number>,
  covered: ReadonlySet<number>,
): Part {
  const geometry = source.geometry;
  const pos = geometry.getAttribute('position');
  const nor = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  const col = geometry.getAttribute('color');
  const si = geometry.getAttribute('skinIndex');
  const sw = geometry.getAttribute('skinWeight');
  const zones = library.morphologies.zones;
  const tints = piece.colors.map((hex) => new Color(hex));
  const skin = new Color(look.skin);
  const shape = library.morphologies.shapes[look.shape];
  const dictionary = source.morphTargetDictionary ?? {};
  const allMorphs = geometry.morphAttributes.position;
  const deltas = (shape?.morphs ?? [])
    .map((name) => dictionary[name])
    .filter((i): i is number => i !== undefined)
    .map((i) => allMorphs?.[i])
    .filter((attribute) => attribute !== undefined);
  const remap = source.skeleton.bones.map((bone) => boneIndex.get(bone.name) ?? 0);
  const count = pos.count;
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    for (const d of deltas) {
      x += d.getX(i);
      y += d.getY(i);
      z += d.getZ(i);
    }
    position[i * 3] = x;
    position[i * 3 + 1] = y;
    position[i * 3 + 2] = z;
    normal[i * 3] = nor.getX(i);
    normal[i * 3 + 1] = nor.getY(i);
    normal[i * 3 + 2] = nor.getZ(i);
    const zone = Math.floor(uv.getX(i) * 8);
    const tint = zones.teintables.indexOf(zone);
    if (zone === zones.peau) color.copy(skin);
    else if (tint >= 0 && tints[tint] !== undefined) color.copy(tints[tint]);
    else color.setRGB(col.getX(i), col.getY(i), col.getZ(i));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    for (let k = 0; k < 4; k += 1) {
      skinIndex[i * 4 + k] = remap[si.getComponent(i, k)] ?? 0;
      skinWeight[i * 4 + k] = sw.getComponent(i, k);
    }
  }
  const sourceIndex = geometry.getIndex();
  const kept: number[] = [];
  if (sourceIndex !== null) {
    for (let t = 0; t < sourceIndex.count; t += 3) {
      const a = sourceIndex.getX(t);
      // Sections du corps couvertes par un vêtement: retirées (rien ne traverse, moins de triangles).
      if (piece.slot === 'body' && covered.has(sectionOf(uv.getY(a)))) continue;
      kept.push(a, sourceIndex.getX(t + 1), sourceIndex.getX(t + 2));
    }
  } else for (let i = 0; i < count; i += 1) kept.push(i);
  return {
    position,
    normal,
    color: colors,
    skinIndex,
    skinWeight,
    index: Uint32Array.from(kept),
    morphs: piece.slot === 'head' ? allMorphs : undefined,
    dictionary: { ...dictionary },
  };
}

function merge(parts: readonly Part[]): BufferGeometry {
  let vertices = 0;
  let indices = 0;
  for (const part of parts) {
    vertices += part.position.length / 3;
    indices += part.index.length;
  }
  const position = new Float32Array(vertices * 3);
  const normal = new Float32Array(vertices * 3);
  const colors = new Float32Array(vertices * 3);
  const skinIndex = new Uint16Array(vertices * 4);
  const skinWeight = new Float32Array(vertices * 4);
  const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  let base = 0;
  let at = 0;
  for (const part of parts) {
    position.set(part.position, base * 3);
    normal.set(part.normal, base * 3);
    colors.set(part.color, base * 3);
    skinIndex.set(part.skinIndex, base * 4);
    skinWeight.set(part.skinWeight, base * 4);
    for (let i = 0; i < part.index.length; i += 1) index[at + i] = (part.index[i] ?? 0) + base;
    at += part.index.length;
    base += part.position.length / 3;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('normal', new BufferAttribute(normal, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setAttribute('skinIndex', new BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new BufferAttribute(skinWeight, 4));
  geometry.setIndex(new BufferAttribute(index, 1));
  return geometry;
}

/** Fusionne les pièces d'un look résolu. Hors de la boucle d'image (quelques millisecondes). */
export function assemble(look: ResolvedLook, library: CharacterLibrary): AssembledGeometry {
  const boneIndex = new Map(library.boneNames.map((name, i) => [name, i]));
  const covered = new Set(look.covered);
  const parts: Part[] = [];
  let head: Part | null = null;
  const missing: string[] = [];
  for (const piece of look.pieces) {
    const source = library.node(piece.file, piece.node);
    if (source === null) {
      missing.push(piece.id);
      continue;
    }
    const part = readPart(source, piece, look, library, boneIndex, covered);
    if (piece.slot === 'head' && head === null) head = part;
    else parts.push(part);
  }
  const body = merge(parts);
  const whole = merge(head === null ? parts : [...parts, head]);
  let headGeometry: BufferGeometry | null = null;
  if (head !== null) {
    headGeometry = merge([head]);
    if (head.morphs !== undefined) {
      headGeometry.morphAttributes.position = head.morphs;
      headGeometry.morphTargetsRelative = true;
    }
    headGeometry.userData.morphs = head.dictionary;
  }
  const triangles = (whole.getIndex()?.count ?? 0) / 3;
  return { body, head: headGeometry, whole, triangles, missing };
}

/** Le dictionnaire des cibles d'une tête assemblée. */
export function headMorphs(geometry: BufferGeometry): Readonly<Record<string, number>> {
  const value: unknown = geometry.userData.morphs;
  return typeof value === 'object' && value !== null ? (value as Record<string, number>) : {};
}

/**
 * Squelette d'un personnage: copie du gabarit, longueurs de l'âge appliquées. `height` (cm, choix
 * de l'éditeur) met l'ensemble à l'échelle par rapport à la taille de la morphologie.
 */
export function createRig(
  library: CharacterLibrary,
  shape: string,
  height?: number,
): {
  root: Object3D;
  skeletonOf: SkinnedMesh;
} {
  const root = cloneSkinned(library.template);
  const found: SkinnedMesh[] = [];
  root.traverse((object) => {
    if (isSkinned(object)) found.push(object);
  });
  const skinned = found[0];
  if (skinned === undefined) throw new Error('squelette absent du corps');
  // Le corps nu du gabarit ne se dessine jamais: on garde son squelette et sa matrice de liaison.
  skinned.visible = false;
  const lengths = library.morphologies.shapes[shape];
  if (lengths !== undefined) {
    for (const [part, names] of Object.entries(LENGTHS) as [
      keyof typeof LENGTHS,
      readonly string[],
    ][])
      for (const name of names) root.getObjectByName(name)?.position.multiplyScalar(lengths[part]);
    root.getObjectByName('Hips')?.position.multiplyScalar(library.hipsScale(shape));
    root.getObjectByName('Head')?.scale.setScalar(lengths.head);
    root.scale.setScalar(lengths.scale);
  }
  if (height !== undefined) root.scale.multiplyScalar(height / 100 / library.height(shape));
  return { root, skeletonOf: skinned };
}
