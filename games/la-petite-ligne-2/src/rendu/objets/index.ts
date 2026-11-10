/**
 * Objets en 3D dans les menus: point d'entrée pour l'interface.
 *
 *   const viewer = createGameObjectViewer(content.items, { reducedMotion });
 *   img.src = (await viewer.thumbnail('pomme')).url;      // vignette fixe, en cache
 *   const view = viewer.live(detailElement, 'pomme');      // objet qui tourne; view.stop()
 *   hydrateThumbnails(container, viewer);                  // remplace les [data-obj-item]
 *
 * Les GLB et l'index viennent de `assets/commun/objets/` (servis par Vite): un objet ajouté par
 * son gabarit s'affiche sans code.
 */
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { ItemDef } from '../../donnees/schemas/objets';
import rawIndex from '../../../assets/commun/objets/index.json';
import { parseObjectIndex, resolverFromItems } from './catalogue';
import { createObjectViewer, type ObjectViewer } from './visionneuse';

export { createObjectViewer, VIEWER_SETTINGS } from './visionneuse';
export type {
  LiveView,
  ObjectViewer,
  Thumbnail,
  ThumbnailKind,
  ViewerOptions,
} from './visionneuse';
export { GRIP_SUFFIX, modelOf, parseObjectIndex, resolverFromItems } from './catalogue';
export type { ModelResolver, ObjectIndex, ObjectModel } from './catalogue';
export { PROVISIONAL_LABEL } from './provisoire';

const URLS = import.meta.glob<string>('../../../assets/commun/objets/*.glb', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** Adresse servie d'un fichier d'objets (`fruit.glb`), `null` s'il n'est pas livré. */
export function objectAssetUrl(file: string): string | null {
  for (const [path, url] of Object.entries(URLS)) if (path.endsWith(`/${file}`)) return url;
  return null;
}

const loader = new GLTFLoader();

function loadFromAssets(file: string): Promise<GLTF> {
  const url = objectAssetUrl(file);
  if (url === null) return Promise.reject(new Error(`objets: ${file} absent des assets`));
  return loader.loadAsync(url);
}

/** La visionneuse du jeu, branchée sur les fiches d'objets et les assets livrés. */
export function createGameObjectViewer(
  items: Readonly<Record<string, ItemDef>>,
  options: { reducedMotion?: boolean } = {},
): ObjectViewer {
  return createObjectViewer({
    index: parseObjectIndex(rawIndex),
    resolve: resolverFromItems(items),
    load: loadFromAssets,
    ...(options.reducedMotion === undefined ? {} : { reducedMotion: options.reducedMotion }),
  });
}

/**
 * Remplace, sous `root`, chaque élément `[data-obj-item]` (vignette provisoire en SVG) par
 * l'image rendue de l'objet, dès qu'elle est prête. Taille lue dans `data-obj-size` (64 par défaut).
 */
export function hydrateThumbnails(root: ParentNode, viewer: ObjectViewer): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-obj-item]')) {
    const item = el.dataset.objItem;
    if (item === undefined || el.dataset.objDone === '1') continue;
    el.dataset.objDone = '1';
    const size = Number(el.dataset.objSize ?? '64') || 64;
    void viewer.thumbnail(item, size).then((t) => {
      const img = document.createElement('img');
      img.className = 'obj';
      img.alt = '';
      img.src = t.url;
      img.dataset.objKind = t.kind;
      img.width = img.height = size;
      el.replaceWith(img);
    });
  }
}
