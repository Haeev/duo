/**
 * Source des modèles de décor (`ModelSource`): les GLB de `assets/commun/decors/`, chargés une fois
 * pour la partie. Chaque modèle est un nœud racine nommé par son identifiant (champ `model` des
 * fiches de meubles); `instantiate` en rend une copie qui partage géométries et matériau.
 * Tant que les fichiers ne sont pas chargés, `instantiate` rend `null` (forme provisoire):
 * attendre `ready` avant d'entrer dans le premier lieu.
 */
import { BufferGeometry, Group, Mesh, type Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { inkTag } from '../encre/conversion';
import { inkCode, KIND, LAYER } from '../encre/couches';
import { gamePlaceBuildings } from './batiments';
import type { ModelSource } from './lieu';
import {
  DECOR_MANIFEST,
  type DecorManifest,
  type DecorMaterial,
  decorFiles,
  keyDraw,
  variantOf,
} from './decors-manifeste';

const URLS = import.meta.glob<string>('../../../assets/commun/decors/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

function urlOf(file: string): string | null {
  for (const [path, url] of Object.entries(URLS)) if (path.endsWith(`/${file}`)) return url;
  return null;
}

const loader = new GLTFLoader();

async function loadFromAssets(file: string): Promise<GLTF> {
  const url = urlOf(file);
  if (url === null) throw new Error(`décors: ${file} absent des assets`);
  return loader.loadAsync(url);
}

/**
 * Modèle aux matériaux nommés (`materials` du manifeste: feuillage, ecorce, pierre...): ses
 * primitives sont fusionnées en un seul maillage (un appel de dessin par exemplaire), la couche
 * de traits et la prise au vent de chaque morceau viennent du NOM de son matériau, la teinte
 * reste celle des sommets. Rend `null` si aucun matériau du modèle n'est nommé dans la table:
 * il garde alors la conversion par la teinte (`inkifyModel`).
 */
export function mergeNamed(
  root: Object3D,
  index: number,
  materials: Readonly<Record<string, DecorMaterial>>,
): Mesh | null {
  const meshes: Mesh[] = [];
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if ((object as Partial<Mesh>).isMesh === true) meshes.push(object as Mesh);
  });
  const nameOf = (mesh: Mesh): string =>
    (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)?.name ?? '';
  const first = meshes[0];
  // Aucun matériau nommé dans la table: le modèle garde la conversion par la teinte.
  if (first === undefined || !meshes.some((mesh) => materials[nameOf(mesh)] !== undefined))
    return null;
  const undo = root.matrixWorld.clone().invert();
  const parts = meshes.map((mesh, at) => {
    const rule = materials[nameOf(mesh)];
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(undo.clone().multiply(mesh.matrixWorld));
    // Chaque matériau commence ses numéros de morceau plus loin: le trait passe entre eux.
    const partStart = at * 17;
    inkTag(
      geometry,
      rule === undefined
        ? { partStart }
        : { partStart, layer: LAYER[rule.layer], kind: KIND[rule.kind ?? 'none'] },
    );
    for (const name of Object.keys(geometry.attributes))
      if (!['position', 'normal', 'color', 'aInk'].includes(name)) geometry.deleteAttribute(name);
    return geometry;
  });
  // `inkTag` retient les géométries qu'il a vues: celle-ci lui est montrée vide, puis remplie,
  // pour que la conversion par la teinte (`inkifyModel`, à la pose) ne repasse pas dessus.
  const merged = inkTag(new BufferGeometry());
  const joined = mergeGeometries(parts);
  merged.copy(joined);
  joined.dispose();
  for (const part of parts) part.dispose();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  const box = merged.boundingBox;
  const diagonal =
    box === null
      ? 1
      : Math.hypot(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
  // Une seule pièce de contour pour tout le modèle, ses morceaux gardent leur trait intérieur.
  const ink = merged.getAttribute('aInk');
  const code = inkCode(index, diagonal);
  for (let i = 0; i < ink.count; i++) ink.setY(i, code);
  const mesh = new Mesh(merged, first.material);
  mesh.name = root.name;
  return mesh;
}

export class DecorModels implements ModelSource {
  private readonly prototypes = new Map<string, Object3D>();
  /** Rang de pose par modèle: la clé de tirage quand l'appelant n'en donne pas. */
  private readonly drawn = new Map<string, number>();
  /** Résolue quand tous les fichiers du manifeste sont chargés (ou ont échoué: formes provisoires). */
  readonly ready: Promise<void>;

  constructor(
    private readonly manifest: DecorManifest = DECOR_MANIFEST,
    load: (file: string) => Promise<GLTF> = loadFromAssets,
    /** Autre chargement à attendre avec les décors (bâtiments des lieux). */
    also: Promise<void> = Promise.resolve(),
  ) {
    this.ready = Promise.all(
      decorFiles(manifest).map(async (file) => {
        const gltf = await load(file);
        for (const node of gltf.scene.children) {
          if (manifest.models[node.name] === undefined) continue;
          const merged =
            manifest.materials === undefined
              ? null
              : mergeNamed(node, this.prototypes.size, manifest.materials);
          this.prototypes.set(node.name, merged ?? node);
        }
      }),
    )
      .then(
        () => undefined,
        // Un fichier manquant ou abîmé: ses modèles restent en formes provisoires, la partie continue.
        () => undefined,
      )
      .then(() => also);
  }

  /**
   * Une copie du modèle. S'il a des variantes ou des écarts de pose (`variants`, `jitter` du
   * manifeste), l'exemplaire tire sa forme, son cap et son échelle de `key` (l'identifiant de
   * l'exemplaire posé: le même arbre garde sa forme d'une visite à l'autre); sans `key`, du rang
   * de pose de ce modèle.
   */
  instantiate(model: string, key?: string): Object3D | null {
    const sheet = this.manifest.models[model];
    if (sheet?.variants === undefined && sheet?.jitter === undefined)
      return this.prototypes.get(model)?.clone() ?? null;
    const rank = this.drawn.get(model) ?? 0;
    if (key === undefined) this.drawn.set(model, rank + 1);
    const draw = key ?? `${model}#${String(rank)}`;
    const copy = this.prototypes.get(variantOf(model, draw, this.manifest))?.clone() ?? null;
    if (copy === null || sheet.jitter === undefined) return copy;
    const [low, high] = sheet.jitter.scale;
    if (sheet.jitter.yaw) copy.rotation.y = keyDraw(draw, 2) * Math.PI * 2;
    copy.scale.setScalar(low + (high - low) * keyDraw(draw, 3));
    // L'appelant pose et tourne l'objet rendu: les écarts restent sur la copie, à l'intérieur.
    const holder = new Group();
    holder.name = model;
    holder.add(copy);
    return holder;
  }

  /** Modèles chargés (contrôle). */
  get size(): number {
    return this.prototypes.size;
  }
}

let shared: DecorModels | null = null;

/** La source du jeu, créée au premier appel et partagée par tous les lieux. */
export function gameDecorModels(): DecorModels {
  // Le jeu attend `ready` avant d'entrer dans le premier lieu: les bâtiments livrés des lieux
  // (rendu encré) se chargent dans la même attente, sinon ils resteraient en volumes provisoires.
  shared ??= new DecorModels(DECOR_MANIFEST, loadFromAssets, gamePlaceBuildings().ready);
  return shared;
}
