/**
 * Personnages lus une seule fois (GLB et clips), partagés entre les clients (`clientele/rendu3d.ts`)
 * et les passants de la place (`rendu/passants3d.ts`): mêmes géométries, mêmes matériaux, mêmes
 * textures en mémoire et un seul programme par variante (budget de 12 programmes).
 */
import type { AnimationClip, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface LoadedCharacter {
  readonly scene: Object3D;
  readonly clips: readonly AnimationClip[];
}

const loader = new GLTFLoader();
const cache = new Map<string, Promise<LoadedCharacter | null>>();

/** GLB d'un personnage par son adresse (une lecture par adresse), `null` s'il est illisible. */
export function loadCharacterGltf(url: string): Promise<LoadedCharacter | null> {
  let p = cache.get(url);
  if (p === undefined) {
    p = loader.loadAsync(url).then(
      (gltf) => ({ scene: gltf.scene, clips: gltf.animations }),
      () => null,
    );
    cache.set(url, p);
  }
  return p;
}
