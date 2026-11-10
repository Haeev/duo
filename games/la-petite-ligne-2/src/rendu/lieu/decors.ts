/**
 * Source des modèles de décor (`ModelSource`): les GLB de `assets/commun/decors/`, chargés une fois
 * pour la partie. Chaque modèle est un nœud racine nommé par son identifiant (champ `model` des
 * fiches de meubles); `instantiate` en rend une copie qui partage géométries et matériau.
 * Tant que les fichiers ne sont pas chargés, `instantiate` rend `null` (forme provisoire):
 * attendre `ready` avant d'entrer dans le premier lieu.
 */
import type { Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { ModelSource } from './lieu';
import { DECOR_MANIFEST, type DecorManifest, decorFiles } from './decors-manifeste';

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

export class DecorModels implements ModelSource {
  private readonly prototypes = new Map<string, Object3D>();
  /** Résolue quand tous les fichiers du manifeste sont chargés (ou ont échoué: formes provisoires). */
  readonly ready: Promise<void>;

  constructor(
    manifest: DecorManifest = DECOR_MANIFEST,
    load: (file: string) => Promise<GLTF> = loadFromAssets,
  ) {
    this.ready = Promise.all(
      decorFiles(manifest).map(async (file) => {
        const gltf = await load(file);
        for (const node of gltf.scene.children)
          if (manifest.models[node.name] !== undefined) this.prototypes.set(node.name, node);
      }),
    ).then(
      () => undefined,
      // Un fichier manquant ou abîmé: ses modèles restent en formes provisoires, la partie continue.
      () => undefined,
    );
  }

  instantiate(model: string): Object3D | null {
    return this.prototypes.get(model)?.clone() ?? null;
  }

  /** Modèles chargés (contrôle). */
  get size(): number {
    return this.prototypes.size;
  }
}

let shared: DecorModels | null = null;

/** La source du jeu, créée au premier appel et partagée par tous les lieux. */
export function gameDecorModels(): DecorModels {
  shared ??= new DecorModels();
  return shared;
}
