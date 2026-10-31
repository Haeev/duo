/**
 * Bibliothèque des modèles: une seule table de correspondance entre un nom de
 * modèle (champ `model` des données, `model` des objets de la carte) et un
 * nœud d'un fichier GLB regroupé de l'artiste (`assets/modeles/*.glb`).
 *
 * - Les fichiers présents sont connus à la construction (`import.meta.glob`):
 *   aucun fichier manquant n'est demandé, donc aucune erreur 404 en console.
 * - Chaque nœud nommé d'un GLB devient un modèle de ce nom; `MODEL_ALIASES`
 *   couvre les noms qui diffèrent (habitants: `villager_firmin` vers le nœud
 *   `npc_firmin` de `personnages.glb`).
 * - Un nom absent donne un substitut visible (`substituts.ts`), jamais une
 *   erreur: on ne bloque jamais sur un asset.
 */
import {
  Bone,
  Group,
  Mesh,
  MeshStandardMaterial,
  SkinnedMesh,
  type AnimationClip,
  type BufferGeometry,
  type Material,
  type Matrix4,
  type Object3D,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { preparePaletteTexture, type SharedMaterials } from './materiaux';
import type { ResourceTracker } from './ressources';
import { buildSubstitute, type SubstituteHints } from './substituts';

const MODEL_URLS = import.meta.glob<string>('../../assets/modeles/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** Fichier des personnages (squelette commun, animations, habitants, pièces des joueurs). */
export const CHARACTERS_FILE = 'personnages.glb';

export interface ModelSource {
  file: string;
  node: string;
}

/**
 * Noms des données qui ne sont pas le nom exact du nœud. Tout autre nom est
 * cherché tel quel dans les GLB (convention fixée par le manager).
 */
export const MODEL_ALIASES: Readonly<Record<string, ModelSource>> = {
  villager_firmin: { file: CHARACTERS_FILE, node: 'npc_firmin' },
  villager_odette: { file: CHARACTERS_FILE, node: 'npc_odette' },
  villager_basile: { file: CHARACTERS_FILE, node: 'npc_basile' },
  villager_jeanne: { file: CHARACTERS_FILE, node: 'npc_jeanne' },
  villager_lucie: { file: CHARACTERS_FILE, node: 'npc_lucie' },
};

/**
 * Types de la carte rendus par plusieurs nœuds de l'artiste, pour varier le
 * décor (le premier présent sert si une seule variante existe). Le choix
 * dépend de l'identifiant de l'objet: le même chez les deux joueurs.
 */
export const MODEL_VARIANTS: Readonly<Record<string, readonly string[]>> = {
  tree_oak: ['tree_oak_large', 'tree_oak_large', 'tree_oak_small'],
  tree_fir: ['tree_fir_large', 'tree_fir_large', 'tree_fir_small'],
  bush: ['bush_round', 'bush_hazel', 'bush_bramble', 'bush_round'],
  rock: ['rock_medium', 'rock_small', 'rock_large', 'rock_small'],
  fence: ['fence_wood'],
  log_pile: ['woodpile'],
  level_crossing_gate: ['level_crossing'],
  stump: ['tree_stump'],
  locomotive: ['train_locomotive', 'locomotive'],
  coach: ['train_coach', 'coach'],
  van: ['train_van', 'van'],
};

const HASH_MULTIPLIER = 31;
const HASH_MODULO = 1_000_003;

/** Petit hachage stable d'un texte (choix d'une variante). */
export function textHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * HASH_MULTIPLIER + text.charCodeAt(i)) % HASH_MODULO;
  }
  return hash;
}

/** Une pièce de modèle prête à fusionner: géométrie, matériau, et sa place dans le modèle. */
export interface ModelPart {
  geometry: BufferGeometry;
  material: Material;
  /** Transformation de la pièce relative à l'origine du modèle. */
  matrix: Matrix4;
  name: string;
}

interface LoadedFile {
  file: string;
  gltf: GLTF;
  nodes: Map<string, Object3D>;
}

function fileNameOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash >= 0 ? path.slice(slash + 1) : path;
}

/** Fichiers GLB présents dans `assets/modeles/`, avec leur adresse. */
export function availableModelFiles(): Map<string, string> {
  const files = new Map<string, string>();
  for (const [path, url] of Object.entries(MODEL_URLS)) {
    files.set(fileNameOf(path), url);
  }
  return files;
}

export class ModelLibrary {
  private readonly files = new Map<string, LoadedFile>();
  /** Nom de modèle vers sa source: la table de correspondance unique, remplie au chargement. */
  private readonly table = new Map<string, ModelSource>();
  private readonly substitutes = new Map<string, Object3D>();
  private readonly missing = new Set<string>();
  private characterMaterial: MeshStandardMaterial | null = null;

  constructor(
    private readonly materials: SharedMaterials,
    private readonly resources: ResourceTracker,
  ) {}

  /** Charge tous les GLB présents. Un fichier illisible est ignoré (ses modèles auront un substitut). */
  async load(onProgress: (ratio: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const entries = [...availableModelFiles()].sort(([a], [b]) => a.localeCompare(b));
    let done = 0;
    await Promise.all(
      entries.map(async ([file, url]) => {
        try {
          const gltf = await loader.loadAsync(url);
          this.register(file, gltf);
        } catch {
          // Fichier en cours d'écriture ou corrompu: ses modèles prendront un substitut.
        } finally {
          done += 1;
          onProgress(entries.length === 0 ? 1 : done / entries.length);
        }
      }),
    );
    for (const [name, source] of Object.entries(MODEL_ALIASES)) {
      if (this.files.get(source.file)?.nodes.has(source.node) === true) {
        this.table.set(name, source);
      }
    }
    if (entries.length === 0) {
      onProgress(1);
    }
  }

  private register(file: string, gltf: GLTF): void {
    const nodes = new Map<string, Object3D>();
    gltf.scene.traverse((object) => {
      // Les os ne sont pas des modèles (un os « chest » ne doit pas masquer le coffre).
      if (object.name !== '' && !nodes.has(object.name) && !(object instanceof Bone)) {
        nodes.set(object.name, object);
      }
      if (object instanceof Mesh) {
        this.resources.track(object.geometry as BufferGeometry);
        object.material = this.adoptMaterial(object.material as Material);
      }
    });
    this.files.set(file, { file, gltf, nodes });
    for (const name of nodes.keys()) {
      if (!this.table.has(name)) {
        this.table.set(name, { file, node: name });
      }
    }
  }

  /**
   * Remplace le matériau palette de chaque GLB par le matériau partagé (une
   * seule texture en mémoire, un seul programme), et unifie celui des
   * personnages. Un autre matériau (verre, par exemple) est gardé tel quel.
   */
  private adoptMaterial(material: Material): Material {
    if (!(material instanceof MeshStandardMaterial)) {
      return this.resources.trackMaterial(material);
    }
    const textureName = material.map?.name ?? '';
    if (
      textureName.startsWith('palette') ||
      material.name.includes('palette') ||
      material.name.includes('world')
    ) {
      material.map?.dispose();
      material.dispose();
      return this.materials.palette;
    }
    if (textureName === 'personnages' || material.name.includes('character')) {
      if (this.characterMaterial === null) {
        if (material.map !== null) {
          preparePaletteTexture(material.map, true);
        }
        this.characterMaterial = this.resources.trackMaterial(material);
        return material;
      }
      material.map?.dispose();
      material.dispose();
      return this.characterMaterial;
    }
    return this.resources.trackMaterial(material);
  }

  /** Vrai si le modèle existe dans un GLB (sinon il sera remplacé par un substitut). */
  has(name: string): boolean {
    return this.table.has(name);
  }

  /**
   * Nom du nœud à utiliser pour un nom de modèle: lui-même s'il existe, sinon
   * une de ses variantes présentes (choisie par `key`), sinon lui-même (substitut).
   */
  resolve(name: string, key = ''): string {
    if (this.table.has(name)) {
      return name;
    }
    const present = (MODEL_VARIANTS[name] ?? []).filter((variant) => this.table.has(variant));
    if (present.length === 0) {
      return name;
    }
    return present[textHash(key) % present.length] ?? name;
  }

  /** Données de l'artiste attachées au nœud (`extras` du GLB: emprise, hauteur de marche...). */
  extras(name: string): Readonly<Record<string, unknown>> {
    return (this.node(this.resolve(name))?.userData ?? {}) as Record<string, unknown>;
  }

  /**
   * Copie d'un groupe animé (squelette et maillages liés), en ne gardant que
   * les maillages nommés. `null` si le groupe n'existe pas.
   */
  cloneRig(groupName: string, keep: readonly string[]): Object3D | null {
    const source = this.table.get(groupName);
    const file = source === undefined ? undefined : this.files.get(source.file);
    if (file === undefined) {
      return null;
    }
    // On copie toute la scène du fichier (squelette et maillages peuvent être frères), puis on
    // ne garde que le squelette et les maillages demandés. Les géométries restent partagées.
    const copy = cloneSkinned(file.gltf.scene);
    const drop: Object3D[] = [];
    copy.traverse((object) => {
      if (object instanceof Mesh && !keep.includes(object.name)) {
        drop.push(object);
      }
    });
    for (const object of drop) {
      object.removeFromParent();
    }
    const hasContent = (object: Object3D): boolean => {
      let found = false;
      object.traverse((child) => {
        found ||= child instanceof Bone || child instanceof Mesh;
      });
      return found;
    };
    for (const child of [...copy.children]) {
      if (!hasContent(child)) {
        child.removeFromParent();
      }
    }
    copy.position.set(0, 0, 0);
    return copy;
  }

  /** Source d'un modèle, pour le diagnostic. */
  source(name: string): ModelSource | null {
    return this.table.get(name) ?? null;
  }

  /** Noms demandés sans modèle, remplacés par un substitut (affichés en mode développement). */
  missingModels(): string[] {
    return [...this.missing].sort();
  }

  /** Nœud d'origine (sans copie), ou `null`. */
  node(name: string): Object3D | null {
    const source = this.table.get(name);
    if (source === undefined) {
      return null;
    }
    return this.files.get(source.file)?.nodes.get(source.node) ?? null;
  }

  /** Animations d'un fichier (celles du squelette commun pour `personnages.glb`). */
  animations(file: string): AnimationClip[] {
    return this.files.get(file)?.gltf.animations ?? [];
  }

  /** Matériau des personnages chargé (ou `null` si `personnages.glb` manque). */
  sharedCharacterMaterial(): MeshStandardMaterial | null {
    return this.characterMaterial;
  }

  /**
   * Copie d'un modèle, origine ramenée en (0, 0, 0). Les géométries et les
   * matériaux sont partagés avec l'original (rien à libérer par copie).
   */
  instantiate(name: string, hints: SubstituteHints = {}, key = ''): Object3D {
    const node = this.node(this.resolve(name, key));
    if (node !== null && !(node instanceof SkinnedMesh)) {
      const copy = node.clone(true);
      copy.position.set(0, 0, 0);
      copy.updateMatrix();
      return copy;
    }
    return this.substitute(name, hints).clone(true);
  }

  /** Substitut d'un modèle manquant, construit une fois par nom et par emprise. */
  substitute(name: string, hints: SubstituteHints = {}): Object3D {
    const key = `${name}|${hints.width ?? ''}x${hints.depth ?? ''}`;
    const cached = this.substitutes.get(key);
    if (cached !== undefined) {
      return cached;
    }
    this.missing.add(name);
    const group = new Group();
    group.name = name;
    for (const part of buildSubstitute(name, hints)) {
      const mesh = new Mesh(this.resources.track(part.geometry), this.materials.palette);
      mesh.name = part.name;
      mesh.castShadow = part.castShadow;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    this.substitutes.set(key, group);
    return group;
  }

  /**
   * Pièces d'un modèle (géométrie, matériau, place), pour fusionner le décor
   * statique ou remplir des maillages instanciés.
   */
  parts(name: string, hints: SubstituteHints = {}, key = ''): ModelPart[] {
    const root = this.instantiate(name, hints, key);
    root.updateMatrixWorld(true);
    const parts: ModelPart[] = [];
    root.traverse((object) => {
      if (object instanceof Mesh && !(object instanceof SkinnedMesh)) {
        parts.push({
          geometry: object.geometry as BufferGeometry,
          material: object.material as Material,
          matrix: object.matrixWorld.clone(),
          name: object.name,
        });
      }
    });
    return parts;
  }
}
