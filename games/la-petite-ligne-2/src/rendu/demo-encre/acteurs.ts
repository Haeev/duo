/**
 * Essai « encre »: les personnages animés. Ce sont les cinq corps de l'essai de style 4
 * (`docs/jeux/jeu-1/refonte/essai-style-4/`: squelette duo-24, atlas de 512 points avec hauteur
 * dans le canal alpha, niveaux de loin en aplats, traits du visage à la plume en grille), rendus
 * par le nuanceur des volumes (variante `ATLAS`) avec leur squelette: les clips `marche` et
 * `repos` sont joués, rien n'est figé.
 *
 * Corps, tête, coiffure et col sont fondus en un seul maillage par personnage (coiffure et col
 * sont liés à l'os de la tête et à celui de la poitrine): un appel de dessin par personnage, et
 * un seul programme pour tous. Les fichiers sont pris par leur nom: un GLB ou un atlas refait
 * sous le même nom est chargé sans changer une ligne ici.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

import { createCharacterMaterial, type InkUniforms } from './matiere';
import type { HeightAt } from './terrain';

const MODELS = import.meta.glob<string>(
  '../../../../../docs/jeux/jeu-1/refonte/essai-style-4/modeles/*.glb',
  { query: '?url', import: 'default', eager: true },
);
const ATLASES = import.meta.glob<string>(
  '../../../../../docs/jeux/jeu-1/refonte/essai-style-4/atlas/*.png',
  { query: '?url', import: 'default', eager: true },
);
const SHEETS = import.meta.glob<unknown>(
  '../../../../../docs/jeux/jeu-1/refonte/essai-style-4/atlas/*.json',
  { import: 'default', eager: true },
);

/** Numéro de morceau réservé à la peau lisse: la passe d'encrage n'y trace aucune arête. */
export const SLEEK_PART = 63;

export type ActorRole = 'repos' | 'marche' | 'assis' | 'parle';

export interface ActorSpec {
  /** Fiche du personnage (`atlas/index.json`): elle donne le corps, la coiffure et le col. */
  readonly who: string;
  /** Nom de l'expression dans `atlas/traits.json`. */
  readonly expression: string;
  readonly role: ActorRole;
  readonly x: number;
  readonly z: number;
  /** Cap en radians: 0, le personnage regarde vers le sud (+z). */
  readonly heading: number;
  /** Marche: le trajet, parcouru en boucle (aller, puis retour par les mêmes points). */
  readonly route?: readonly (readonly [number, number])[];
  /** Hauteur fixe du sol sous ses pieds (plancher); sinon il suit le terrain. */
  readonly floor?: number;
  /** Décalage dans le temps: deux personnages ne respirent pas ensemble. */
  readonly phase?: number;
}

export interface Actor {
  readonly spec: ActorSpec;
  readonly root: THREE.Group;
  readonly mesh: THREE.SkinnedMesh;
  readonly triangles: number;
  /** Rayon de sa tache de contact au sol. */
  readonly girth: number;
  /** Avance l'animation à l'instant `time` (secondes) et pose le personnage sur le terrain. */
  update(time: number, height: HeightAt): void;
}

interface Sheet {
  readonly body: string;
  readonly hair: string | null;
  readonly collar: boolean;
}

function find(record: Record<string, string>, name: string): string | undefined {
  return Object.entries(record).find(([path]) => path.endsWith(`/${name}`))?.[1];
}

function findSheet(name: string): unknown {
  return Object.entries(SHEETS).find(([path]) => path.endsWith(`/${name}`))?.[1];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sheetOf(who: string): Sheet | null {
  const index = findSheet('index.json');
  const entry = isRecord(index) ? index[who] : undefined;
  if (!isRecord(entry) || typeof entry.corps !== 'string') return null;
  return {
    body: entry.corps,
    hair: typeof entry.coiffure === 'string' ? entry.coiffure : null,
    collar: entry.col === true,
  };
}

interface TraitGrid {
  readonly columns: number;
  readonly rows: number;
  readonly names: readonly string[];
}

function traitGrid(): TraitGrid {
  const sheet = findSheet('traits.json');
  if (
    isRecord(sheet) &&
    typeof sheet.colonnes === 'number' &&
    typeof sheet.rangees === 'number' &&
    Array.isArray(sheet.expressions)
  ) {
    return {
      columns: sheet.colonnes,
      rows: sheet.rangees,
      names: sheet.expressions.filter((name): name is string => typeof name === 'string'),
    };
  }
  // Atlas de l'essai 4 d'origine: quatre cases en ligne.
  return { columns: 4, rows: 1, names: ['neutre', 'joie', 'surprise', 'souci'] };
}

const BITMAP: ImageBitmapOptions = { premultiplyAlpha: 'none', colorSpaceConversion: 'none' };

async function blobOf(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fichier illisible: ${url}`);
  return response.blob();
}

/**
 * Atlas d'un personnage, avec ses niveaux de loin (`<nom>.loin.png`): niveau 1 à mi-détail,
 * niveaux 2 et suivants en aplats sans trait. Le canal alpha porte une hauteur: aucune
 * prémultiplication. Couleurs lues telles quelles: l'essai peint en valeurs d'écran.
 */
async function loadAtlas(url: string, farUrl: string | undefined): Promise<THREE.Texture> {
  const full = await createImageBitmap(await blobOf(url), BITMAP);
  const texture = new THREE.Texture(full);
  texture.flipY = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  if (farUrl) {
    const far = await blobOf(farUrl);
    const half = full.width / 2;
    const quarter = full.width / 4;
    const levels: ImageBitmap[] = [
      full,
      await createImageBitmap(far, 0, 0, half, half, BITMAP),
      await createImageBitmap(far, half, 0, quarter, quarter, BITMAP),
    ];
    for (let size = quarter / 2; size >= 1; size /= 2) {
      levels.push(
        await createImageBitmap(far, half, 0, quarter, quarter, {
          ...BITMAP,
          resizeWidth: size,
          resizeHeight: size,
          resizeQuality: 'high',
        }),
      );
    }
    // Three.js type les niveaux en `ImageData`; WebGL accepte aussi les `ImageBitmap`.
    texture.mipmaps = levels as unknown as THREE.Texture['mipmaps'];
    texture.generateMipmaps = false;
  }
  texture.needsUpdate = true;
  return texture;
}

async function loadTraits(url: string): Promise<THREE.Texture> {
  const texture = await new THREE.TextureLoader().loadAsync(url);
  texture.flipY = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Poses du clip mises de côté avant qu'un geste ne tourne un os. Le mélangeur d'animation ne
 * réécrit un os que si sa valeur change: sans cette remise à zéro à chaque image, un geste posé
 * sur un clip immobile s'ajouterait à lui-même.
 */
type ClipPose = Map<THREE.Object3D, THREE.Quaternion>;

/** Tourne un os autour d'un axe du repère du personnage, quel que soit son repère local. */
function turnBone(
  root: THREE.Object3D,
  bone: THREE.Object3D | undefined,
  axis: THREE.Vector3,
  angle: number,
  pose: ClipPose,
): void {
  if (!bone?.parent) return;
  if (!pose.has(bone)) pose.set(bone, bone.quaternion.clone());
  const rootWorld = root.getWorldQuaternion(new THREE.Quaternion());
  const parentWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const world = bone.getWorldQuaternion(new THREE.Quaternion());
  const turn = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  // L'axe est donné dans le repère du personnage: on l'amène dans le monde avant de tourner.
  const turnWorld = rootWorld.clone().multiply(turn).multiply(rootWorld.clone().invert());
  bone.quaternion.copy(parentWorld.invert().multiply(turnWorld.multiply(world)));
  bone.updateMatrixWorld(true);
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/**
 * Gestes posés par-dessus le clip, à chaque image: s'asseoir, parler avec les mains, regarder
 * autour de soi, respirer. Ils sont écrits en angles (repère du personnage, face vers +z) et
 * varient avec le temps: aucune pose n'est figée.
 */
function gesture(
  root: THREE.Object3D,
  bones: Map<string, THREE.Object3D>,
  role: ActorRole,
  t: number,
  pose: ClipPose,
): void {
  const turn = (name: string, axis: THREE.Vector3, angle: number): void => {
    turnBone(root, bones.get(name), axis, angle, pose);
  };
  const breath = Math.sin(t * 1.7);
  if (role === 'assis') {
    for (const side of ['Left', 'Right']) {
      const out = side === 'Left' ? 1 : -1;
      turn(`${side}UpLeg`, X, -1.45);
      turn(`${side}UpLeg`, Y, out * 0.14);
      turn(`${side}Leg`, X, 1.5);
      turn(`${side}Arm`, X, -0.42);
      turn(`${side}ForeArm`, X, -0.8 + breath * 0.02);
    }
    turn('Spine01', X, 0.1 + breath * 0.012);
    turn('Head', Y, 0.3 + Math.sin(t * 0.33) * 0.3);
    turn('Head', X, Math.sin(t * 0.21 + 1) * 0.06);
  } else if (role === 'parle') {
    const beat = Math.sin(t * 2.6);
    turn('RightArm', X, -0.5 + beat * 0.08);
    turn('RightForeArm', X, -1.45 + beat * 0.22);
    turn('RightForeArm', Y, 0.4 + Math.sin(t * 1.3) * 0.2);
    turn('LeftForeArm', X, -0.35);
    turn('Head', Y, -0.25 + Math.sin(t * 0.7) * 0.1);
    turn('Head', X, -0.14 + Math.max(0, Math.sin(t * 2.6 + 0.6)) * 0.08);
    turn('Spine02', X, 0.06 + breath * 0.01);
  } else if (role === 'repos') {
    turn('Spine01', X, breath * 0.012);
    turn('Spine02', Z, Math.sin(t * 0.45) * 0.025);
    turn('Head', Y, Math.sin(t * 0.4) * 0.25);
    turn('Head', X, -0.1 + Math.sin(t * 0.31 + 2) * 0.04);
    turn('LeftForeArm', X, -0.12 + breath * 0.02);
    turn('RightForeArm', X, -0.1 - breath * 0.02);
  }
}

interface Walk {
  readonly points: readonly (readonly [number, number])[];
  readonly lengths: readonly number[];
  readonly total: number;
}

function walkOf(route: readonly (readonly [number, number])[]): Walk {
  // Aller et retour: le trajet se referme sur lui-même par les mêmes points.
  const points = [...route, ...route.slice(1, -1).reverse()];
  const lengths = points.map((p, i) => {
    const q = points[(i + 1) % points.length] ?? p;
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
  return { points, lengths, total: lengths.reduce((sum, value) => sum + value, 0) };
}

function along(walk: Walk, distance: number): [number, number] {
  let rest = ((distance % walk.total) + walk.total) % walk.total;
  for (let i = 0; i < walk.points.length; i += 1) {
    const length = walk.lengths[i] ?? 0;
    const p = walk.points[i];
    const q = walk.points[(i + 1) % walk.points.length];
    if (!p || !q) break;
    if (rest <= length) {
      const t = length > 0 ? rest / length : 0;
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    }
    rest -= length;
  }
  return [walk.points[0]?.[0] ?? 0, walk.points[0]?.[1] ?? 0];
}

interface Chunk {
  readonly geometry: THREE.BufferGeometry;
  /** Transformation à appliquer aux sommets (identité pour le corps). */
  readonly matrix: THREE.Matrix4;
  /** Os unique auquel la pièce est liée (coiffure, col); -1: les poids du maillage. */
  readonly bone: number;
  readonly part: number;
  readonly push: number;
  readonly body: number;
}

/** Fond les pièces d'un personnage en un seul maillage à squelette. */
function merge(chunks: readonly Chunk[], piece: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const faceUvs: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const metas: number[] = [];
  const indices: number[] = [];
  const v = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  for (const chunk of chunks) {
    const g = chunk.geometry;
    const position = g.getAttribute('position');
    const normal = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    const uv1 = g.hasAttribute('uv1') ? g.getAttribute('uv1') : null;
    const skinIndex = g.hasAttribute('skinIndex') ? g.getAttribute('skinIndex') : null;
    const skinWeight = g.hasAttribute('skinWeight') ? g.getAttribute('skinWeight') : null;
    const offset = positions.length / 3;
    normalMatrix.getNormalMatrix(chunk.matrix);
    for (let i = 0; i < position.count; i += 1) {
      v.fromBufferAttribute(position, i).applyMatrix4(chunk.matrix);
      positions.push(v.x, v.y, v.z);
      v.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
      normals.push(v.x, v.y, v.z);
      uvs.push(uv.getX(i), uv.getY(i));
      if (uv1) faceUvs.push(uv1.getX(i), uv1.getY(i));
      else faceUvs.push(-4, -4);
      if (chunk.bone >= 0 || !skinIndex || !skinWeight) {
        skinIndices.push(Math.max(0, chunk.bone), 0, 0, 0);
        skinWeights.push(1, 0, 0, 0);
      } else {
        skinIndices.push(
          skinIndex.getX(i),
          skinIndex.getY(i),
          skinIndex.getZ(i),
          skinIndex.getW(i),
        );
        skinWeights.push(
          skinWeight.getX(i),
          skinWeight.getY(i),
          skinWeight.getZ(i),
          skinWeight.getW(i),
        );
      }
      // Un personnage est un seul objet, de la plus grande classe (son contour ne s'efface
      // jamais); ses morceaux sont de la plus petite: leurs traits n'apparaissent que de près.
      metas.push(chunk.push, (piece % 63) + 1, chunk.body, chunk.part + 64 * 3);
    }
    const index = g.getIndex();
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i += 1) indices.push(offset + (index ? index.getX(i) : i));
  }
  const count = positions.length / 3;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aFaceUv', new THREE.Float32BufferAttribute(faceUvs, 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setAttribute('aMeta', new THREE.Float32BufferAttribute(metas, 4));
  geometry.setAttribute(
    'aColor',
    new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3),
  );
  geometry.setAttribute('aFoot', new THREE.Float32BufferAttribute(new Float32Array(count), 1));
  geometry.setIndex(indices);
  return geometry;
}

/** Poussée du relief des vêtements, en mètres pour la hauteur pleine de l'atlas. */
const RELIEF_PUSH = 0.026;
/** Vitesse de marche d'un adulte de 1,65 m, accordée au clip (deux pas par cycle). */
const WALK_SPEED = 1.08;

async function loadActor(
  spec: ActorSpec,
  piece: number,
  uniforms: InkUniforms,
  grid: TraitGrid,
): Promise<Actor | null> {
  const sheet = sheetOf(spec.who);
  if (!sheet) return null;
  const bodyUrl = find(MODELS, `${sheet.body}.glb`);
  const atlasUrl = find(ATLASES, `${spec.who}.png`);
  const traitsUrl = find(ATLASES, `traits-${spec.who}.png`) ?? find(ATLASES, 'traits.png');
  if (!bodyUrl || !atlasUrl || !traitsUrl) return null;
  const hairUrl = sheet.hair ? find(MODELS, `${sheet.body}-${sheet.hair}.glb`) : undefined;
  const collarUrl = sheet.collar ? find(MODELS, `${sheet.body}-col.glb`) : undefined;
  const loader = new GLTFLoader();
  const [body, hair, collar, atlas, traits] = await Promise.all([
    loader.loadAsync(bodyUrl),
    hairUrl ? loader.loadAsync(hairUrl) : null,
    collarUrl ? loader.loadAsync(collarUrl) : null,
    loadAtlas(atlasUrl, find(ATLASES, `${spec.who}.loin.png`)),
    loadTraits(traitsUrl),
  ]);

  const model = SkeletonUtils.clone(body.scene);
  model.updateMatrixWorld(true);
  const skinned: THREE.SkinnedMesh[] = [];
  const bones = new Map<string, THREE.Object3D>();
  model.traverse((object) => {
    if ('isSkinnedMesh' in object) skinned.push(object as THREE.SkinnedMesh);
    else if ('isBone' in object) bones.set(object.name, object);
  });
  const first = skinned[0];
  if (!first?.parent) return null;
  const skeleton = first.skeleton;
  const identity = new THREE.Matrix4();
  const chunks: Chunk[] = skinned.map((mesh) => {
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const head = material?.name === 'tete';
    return {
      geometry: mesh.geometry,
      matrix: identity,
      bone: -1,
      part: head ? SLEEK_PART : 1,
      push: head ? RELIEF_PUSH * 0.4 : RELIEF_PUSH,
      body: head ? 0 : 1,
    };
  });
  // Coiffure et col: modelés dans le repère du corps au repos. Liés à un seul os, ils doivent
  // être ramenés dans l'espace où le maillage du corps est décrit: l'inverse de la pose de
  // repos de cet os (os x inverse de liaison x matrice de liaison).
  const rigid = (source: THREE.Object3D | undefined, boneName: string, part: number): void => {
    const bone = bones.get(boneName);
    const index = skeleton.bones.findIndex((candidate) => candidate === bone);
    const inverse = skeleton.boneInverses[index];
    if (!source || !bone || index < 0 || !inverse) return;
    const rest = new THREE.Matrix4()
      .multiplyMatrices(bone.matrixWorld, inverse)
      .multiply(first.bindMatrix)
      .invert();
    source.updateMatrixWorld(true);
    source.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      chunks.push({
        geometry: object.geometry as THREE.BufferGeometry,
        matrix: rest.clone().multiply(object.matrixWorld),
        bone: index,
        part,
        push: 0,
        body: 1,
      });
    });
  };
  rigid(hair?.scene, 'Head', 2);
  rigid(collar?.scene, 'Spine', 3);

  const geometry = merge(chunks, piece);
  const expression = Math.max(0, grid.names.indexOf(spec.expression));
  const material = createCharacterMaterial(
    uniforms,
    atlas,
    traits,
    [grid.columns, grid.rows],
    expression,
  );
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.position.copy(first.position);
  mesh.quaternion.copy(first.quaternion);
  mesh.scale.copy(first.scale);
  first.parent.add(mesh);
  mesh.bind(skeleton, first.bindMatrix);
  for (const old of skinned) old.removeFromParent();
  mesh.frustumCulled = false;
  mesh.layers.enable(1);
  mesh.layers.enable(2);

  const root = new THREE.Group();
  root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const clipName = spec.role === 'marche' ? 'marche' : 'repos';
  const clip = body.animations.find((animation) => animation.name === clipName);
  if (clip) mixer.clipAction(clip).play();
  const walk = spec.route && spec.route.length > 1 ? walkOf(spec.route) : null;
  const phase = spec.phase ?? 0;
  const pose: ClipPose = new Map();
  const box = new THREE.Box3();
  let sink: number | null = null;
  let girth = 0.3;

  const actor: Actor = {
    spec,
    root,
    mesh,
    triangles: geometry.getIndex()?.count ?? 0,
    get girth(): number {
      return girth;
    },
    update(time, height) {
      const t = time + phase;
      let x = spec.x;
      let z = spec.z;
      let heading = spec.heading;
      if (walk) {
        const distance = t * WALK_SPEED;
        [x, z] = along(walk, distance);
        // Le cap suit la corde entre un peu avant et un peu après: il tourne sans à-coup.
        const before = along(walk, distance - 0.35);
        const after = along(walk, distance + 0.35);
        heading = Math.atan2(after[0] - before[0], after[1] - before[1]);
      }
      root.position.set(x, 0, z);
      root.rotation.y = heading;
      root.updateMatrixWorld(true);
      for (const [bone, quaternion] of pose) bone.quaternion.copy(quaternion);
      pose.clear();
      mixer.setTime(t);
      model.updateMatrixWorld(true);
      gesture(model, bones, spec.role, t, pose);
      if (sink === null) {
        // Une fois posé: les pieds (ou l'assise) trouvent le sol, la tache de contact sa taille.
        mesh.computeBoundingBox();
        box.copy(mesh.boundingBox).applyMatrix4(mesh.matrixWorld);
        sink = box.min.y;
        girth = Math.min(0.42, Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.36);
      }
      root.position.y = (spec.floor ?? height(x, z)) - sink;
      root.updateMatrixWorld(true);
    },
  };
  return actor;
}

/** Charge la distribution; `null` si les fichiers de l'essai 4 ne sont pas là. */
export async function loadActors(
  cast: readonly ActorSpec[],
  uniforms: InkUniforms,
): Promise<Actor[] | null> {
  try {
    const grid = traitGrid();
    const actors = await Promise.all(
      cast.map((spec, i) => loadActor(spec, 100 + i * 4, uniforms, grid)),
    );
    const ready = actors.filter((actor) => actor !== null);
    return ready.length === actors.length ? ready : null;
  } catch {
    return null;
  }
}
