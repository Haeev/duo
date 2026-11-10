/**
 * Essai « encre »: les personnages riggés de l'essai de style 3 (corps commun Meshy conformé,
 * squelette duo-24, atlas de 512 points peint par fiche, coiffure en coque), rendus par le
 * nuanceur de l'essai. Chaque personnage est posé (clip `repos` ou `marche` à un instant donné,
 * plus quelques os tournés à la main pour s'asseoir ou parler), puis figé en géométrie: l'essai
 * juge le rendu, pas l'animation. En jeu, le même nuanceur recevra le skinning.
 *
 * Les fichiers sont lus dans `docs/jeux/jeu-1/refonte/essai-style-3/`. S'ils manquent, la page
 * retombe sur les personnages sculptés de `personnages.ts`.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const MODELS = import.meta.glob<string>(
  '../../../../../docs/jeux/jeu-1/refonte/essai-style-3/modeles/*.glb',
  { query: '?url', import: 'default', eager: true },
);
const ATLASES = import.meta.glob<string>(
  '../../../../../docs/jeux/jeu-1/refonte/essai-style-3/atlas/*.png',
  { query: '?url', import: 'default', eager: true },
);

export type FigurinePose = 'repos' | 'marche' | 'assis' | 'parle';

export interface FigurineSpec {
  readonly body: 'femme' | 'homme' | 'costaud';
  /** Nom de l'atlas (la fiche du personnage) et de la coiffure. */
  readonly atlas: string;
  readonly hair: 'carre' | 'court';
  /** Case de l'atlas des traits: 0 neutre, 1 joie, 2 surprise. */
  readonly expression: number;
  readonly pose: FigurinePose;
  /** Instant du clip, en secondes: deux personnages au repos ne sont pas figés pareil. */
  readonly time: number;
  readonly x: number;
  readonly z: number;
  /** Cap en radians: 0, le personnage regarde vers le sud (+z). */
  readonly heading: number;
  /** Hauteur du sol sous ses pieds (quai, plancher), et de l'assise s'il est assis. */
  readonly ground?: number;
  readonly seat?: number;
  /** Taille voulue en mètres (les corps de l'essai 3 font 1,66 à 1,80 m). */
  readonly height?: number;
}

export interface Figurine {
  readonly geometry: THREE.BufferGeometry;
  readonly atlas: THREE.Texture;
  readonly traits: THREE.Texture;
  readonly expression: number;
  readonly triangles: number;
}

function find(record: Record<string, string>, name: string): string | undefined {
  return Object.entries(record).find(([path]) => path.endsWith(`/${name}`))?.[1];
}

function loadTexture(url: string): Promise<THREE.Texture> {
  return new THREE.TextureLoader().loadAsync(url).then((texture) => {
    // Les couleurs de l'atlas sont lues telles quelles: l'essai peint en valeurs d'écran.
    texture.flipY = false;
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = 4;
    return texture;
  });
}

/** Tourne un os autour d'un axe du monde, quel que soit son repère local. */
function turnBone(root: THREE.Object3D, name: string, axis: THREE.Vector3, angle: number): void {
  const bone = root.getObjectByName(name);
  if (!bone?.parent) return;
  root.updateMatrixWorld(true);
  const parentWorld = new THREE.Quaternion();
  bone.parent.getWorldQuaternion(parentWorld);
  const world = new THREE.Quaternion();
  bone.getWorldQuaternion(world);
  world.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
  bone.quaternion.copy(parentWorld.invert().multiply(world));
}

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);

/** Poses faites à la main par-dessus le clip de repos (repère du modèle: face vers +z). */
function strike(root: THREE.Object3D, pose: FigurinePose): void {
  if (pose === 'assis') {
    for (const side of ['Left', 'Right']) {
      const out = side === 'Left' ? 1 : -1;
      turnBone(root, `${side}UpLeg`, X, -1.45);
      turnBone(root, `${side}UpLeg`, Y, out * 0.12);
      turnBone(root, `${side}Leg`, X, 1.5);
      turnBone(root, `${side}Arm`, X, -0.45);
      turnBone(root, `${side}ForeArm`, X, -0.75);
    }
    turnBone(root, 'Spine01', X, 0.1);
    turnBone(root, 'Head', Y, 0.3);
  } else if (pose === 'parle') {
    turnBone(root, 'RightArm', X, -0.5);
    turnBone(root, 'RightForeArm', X, -1.5);
    turnBone(root, 'RightForeArm', Y, 0.4);
    turnBone(root, 'LeftForeArm', X, -0.35);
    turnBone(root, 'Head', Y, -0.25);
    turnBone(root, 'Spine02', X, 0.06);
  } else if (pose === 'repos') {
    turnBone(root, 'Head', Y, 0.3);
  }
}

async function bake(
  spec: FigurineSpec,
  piece: number,
  traits: THREE.Texture,
): Promise<Figurine | null> {
  const bodyUrl = find(MODELS, `${spec.body}.glb`);
  const hairUrl = find(MODELS, `${spec.body}-${spec.hair}.glb`);
  const atlasUrl = find(ATLASES, `${spec.atlas}.png`);
  if (!bodyUrl || !hairUrl || !atlasUrl) return null;
  const loader = new GLTFLoader();
  const [body, hair, atlas] = await Promise.all([
    loader.loadAsync(bodyUrl),
    loader.loadAsync(hairUrl),
    loadTexture(atlasUrl),
  ]);
  const root = SkeletonUtils.clone(body.scene);
  root.updateMatrixWorld(true);
  const head = root.getObjectByName('Head');
  const wig = hair.scene.clone(true);
  if (head) head.attach(wig);

  const clip = body.animations.find(
    (a) => a.name === (spec.pose === 'marche' ? 'marche' : 'repos'),
  );
  if (clip) {
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play();
    mixer.setTime(spec.time);
  }
  strike(root, spec.pose);
  root.updateMatrixWorld(true);

  const positions: number[] = [];
  const uvs: number[] = [];
  const faceUvs: number[] = [];
  const metas: number[] = [];
  const indices: number[] = [];
  const v = new THREE.Vector3();
  let part = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    const position = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    const uv1 = geometry.getAttribute('uv1');
    const offset = positions.length / 3;
    part += 1;
    for (let i = 0; i < position.count; i += 1) {
      if (object instanceof THREE.SkinnedMesh) object.getVertexPosition(i, v);
      else v.fromBufferAttribute(position, i);
      v.applyMatrix4(object.matrixWorld);
      positions.push(v.x, v.y, v.z);
      uvs.push(uv.getX(i), uv.getY(i));
      if (geometry.hasAttribute('uv1')) faceUvs.push(uv1.getX(i), uv1.getY(i));
      else faceUvs.push(-4, -4);
      // Un personnage est un seul objet, de la plus grande classe (son contour ne s'efface
      // jamais); ses morceaux (corps, tête, cheveux) sont de la plus petite: leurs traits
      // intérieurs n'apparaissent que de près.
      metas.push(0, (piece % 63) + 1, 0, part + 1 + 64 * 3);
    }
    const index = geometry.getIndex();
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i += 1) indices.push(offset + (index ? index.getX(i) : i));
  });

  // Mise à l'échelle, pieds (ou bassin) à la bonne hauteur, puis cap et place.
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < positions.length; i += 3) {
    minY = Math.min(minY, positions[i] ?? 0);
    maxY = Math.max(maxY, positions[i] ?? 0);
  }
  const scale = spec.height && spec.pose !== 'assis' ? spec.height / (maxY - minY) : 1;
  const ground = spec.ground ?? 0;
  const place = new THREE.Matrix4()
    .makeTranslation(spec.x, ground, spec.z)
    .multiply(new THREE.Matrix4().makeRotationY(spec.heading))
    .multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
    .multiply(new THREE.Matrix4().makeTranslation(0, -minY, 0));
  for (let i = 0; i < positions.length; i += 3) {
    v.set(positions[i] ?? 0, positions[i + 1] ?? 0, positions[i + 2] ?? 0).applyMatrix4(place);
    positions[i] = v.x;
    positions[i + 1] = v.y;
    positions[i + 2] = v.z;
  }

  const count = positions.length / 3;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aFaceUv', new THREE.Float32BufferAttribute(faceUvs, 2));
  geometry.setAttribute('aMeta', new THREE.Float32BufferAttribute(metas, 4));
  geometry.setAttribute(
    'aColor',
    new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3),
  );
  geometry.setAttribute(
    'aFoot',
    new THREE.Float32BufferAttribute(new Float32Array(count).fill(ground), 1),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.setAttribute('aSmooth', geometry.getAttribute('normal').clone());
  geometry.computeBoundingSphere();
  return { geometry, atlas, traits, expression: spec.expression, triangles: indices.length / 3 };
}

/** Charge et pose la distribution; `null` si les fichiers de l'essai 3 ne sont pas là. */
export async function loadFigurines(cast: readonly FigurineSpec[]): Promise<Figurine[] | null> {
  const traitsUrl = find(ATLASES, 'traits.png');
  if (!traitsUrl) return null;
  try {
    const traits = await loadTexture(traitsUrl);
    const baked = await Promise.all(cast.map((spec, i) => bake(spec, 100 + i * 4, traits)));
    const ready = baked.filter((figurine) => figurine !== null);
    return ready.length === baked.length ? ready : null;
  } catch {
    return null;
  }
}
