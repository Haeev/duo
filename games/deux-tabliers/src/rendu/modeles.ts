/**
 * Modèles par nom: `assets/modeles/<nom>.glb`, connus à la construction (`import.meta.glob`),
 * donc aucun fichier absent n'est jamais demandé. Un nom sans fichier, ou un fichier illisible,
 * donne un substitut (bloc aux dimensions et à la couleur des données): on ne bloque jamais.
 *
 * Conventions pour les artistes: mètres, origine au centre de l'empreinte au sol, `y` vers le
 * haut. L'avant de chaque modèle est déclaré dans `assets/modeles/modeles.json`
 * (`{ "<nom>": { "avant": "+z" } }`, valeurs `+z`, `-z`, `+x`, `-x`; `+z` par défaut):
 * le jeu le tourne pour que son avant suive l'avant du meuble posé (sud à 0°).
 */
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  type AnimationClip,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { v } from '@duo/sdk';

const MODEL_URLS = import.meta.glob<string>('../../assets/modeles/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});
// Textures des GLB (`textures/<nom>` relatif au modèle): à la construction, Vite renomme chaque
// fichier; le chargeur demande l'URL construite, sinon le modèle s'affiche sans texture (noir).
const TEXTURE_URLS = import.meta.glob<string>('../../assets/modeles/textures/*', {
  query: '?url',
  import: 'default',
  eager: true,
});
const TEXTURE_BY_NAME = new Map(
  Object.entries(TEXTURE_URLS).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
);

const MODEL_INFO = import.meta.glob<unknown>('../../assets/modeles/modeles.json', {
  eager: true,
  import: 'default',
});

const InfoSchema = v.record(
  v.string(),
  v.looseObject({ avant: v.optional(v.picklist(['+z', '-z', '+x', '-x']), '+z') }),
);
const FRONT_TURN: Readonly<Record<'+z' | '-z' | '+x' | '-x', number>> = {
  '+z': 0,
  '-z': Math.PI,
  '+x': -Math.PI / 2,
  '-x': Math.PI / 2,
};

function urlOf(name: string): string | undefined {
  return MODEL_URLS[`../../assets/modeles/${name}.glb`];
}

function frontTurn(name: string): number {
  const raw = Object.values(MODEL_INFO)[0];
  if (raw === undefined) return 0;
  const parsed = v.safeParse(InfoSchema, raw);
  if (!parsed.success) return 0;
  const avant = parsed.output[name]?.avant ?? '+z';
  return FRONT_TURN[avant];
}

export interface SubstituteHint {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly color: string;
}

export interface ModelLibrary {
  /** Un exemplaire du modèle (substitut tout de suite, remplacé par le GLB dès qu'il est chargé). */
  instance(name: string | undefined, hint: SubstituteHint): Group;
  /** Le GLB complet (scène et clips), chargé une fois, `null` s'il manque ou se lit mal. */
  gltf(name: string): Promise<{ scene: Object3D; clips: AnimationClip[] } | null>;
  dispose(): void;
}

export function createModelLibrary(
  onError: (message: string, data: unknown) => void,
): ModelLibrary {
  const loader = new GLTFLoader();
  loader.manager.setURLModifier((url) => {
    const match = /textures\/([^/?#]+)$/.exec(url);
    return (
      (match === null ? undefined : TEXTURE_BY_NAME.get(decodeURIComponent(match[1] ?? ''))) ?? url
    );
  });
  const loaded = new Map<string, Promise<Object3D | null>>();
  const owned: { dispose(): void }[] = [];
  const box = new BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  owned.push(box);
  const materials = new Map<string, Material>();

  const material = (color: string): Material => {
    let m = materials.get(color);
    if (m === undefined) {
      m = new MeshLambertMaterial({ color });
      materials.set(color, m);
      owned.push(m);
    }
    return m;
  };

  const full = new Map<string, Promise<{ scene: Object3D; clips: AnimationClip[] } | null>>();
  const gltf = (name: string): Promise<{ scene: Object3D; clips: AnimationClip[] } | null> => {
    let p = full.get(name);
    if (p !== undefined) return p;
    const url = urlOf(name);
    p =
      url === undefined
        ? Promise.resolve(null)
        : loader.loadAsync(url).then(
            (g) => ({ scene: g.scene, clips: g.animations }),
            (error: unknown) => {
              onError('modèle illisible, substitut affiché', { name, error: String(error) });
              return null;
            },
          );
    full.set(name, p);
    return p;
  };
  const load = (name: string): Promise<Object3D | null> => {
    let p = loaded.get(name);
    if (p !== undefined) return p;
    p = gltf(name).then((g) => g?.scene ?? null);
    loaded.set(name, p);
    return p;
  };

  return {
    gltf,
    instance(name, hint) {
      const group = new Group();
      const substitute = new Mesh(box, material(hint.color));
      substitute.scale.set(hint.width, hint.height, hint.depth);
      group.add(substitute);
      if (name !== undefined && urlOf(name) !== undefined) {
        void load(name).then((source) => {
          if (source === null) return;
          const copy = source.clone(true);
          copy.rotation.y = frontTurn(name);
          group.remove(substitute);
          group.add(copy);
        });
      }
      return group;
    },
    dispose() {
      for (const d of owned) d.dispose();
      for (const p of full.values()) {
        void p.then((g) => {
          g?.scene.traverse((child) => {
            if (child instanceof Mesh) {
              (child.geometry as { dispose(): void }).dispose();
              const mats: Material[] = Array.isArray(child.material)
                ? (child.material as Material[])
                : [child.material as Material];
              for (const m of mats) m.dispose();
            }
          });
        });
      }
    },
  };
}
