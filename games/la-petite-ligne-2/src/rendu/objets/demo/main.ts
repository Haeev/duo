// Démonstration de la visionneuse: `pnpm dev`, puis /src/rendu/objets/demo/index.html.
// Paramètres: `?grandes=0` cache la grille de 128 px; `?vivante=<id>` choisit l'objet de gauche.
// Un objet factice sans modèle (`objet-factice`) montre la vignette provisoire.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import rawIndex from '../../../../assets/commun/objets/index.json';
import { createObjectViewer, objectAssetUrl, parseObjectIndex, type LiveView } from '../index';

const index = parseObjectIndex(rawIndex);
const loader = new GLTFLoader();
const viewer = createObjectViewer({
  index,
  resolve: (id) => (id in index.objects ? id : undefined),
  load: (file) => {
    const url = objectAssetUrl(file);
    return url === null ? Promise.reject(new Error(file)) : loader.loadAsync(url);
  },
});
const params = new URLSearchParams(location.search);
const ids = [...Object.keys(index.objects), 'objet-factice'];

function el(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (found === null) throw new Error(id);
  return found;
}

let left: LiveView = viewer.live(el('vivante-a'), params.get('vivante') ?? 'truite');
viewer.live(el('vivante-b'), 'hache-forgee');

async function fill(container: HTMLElement, size: number): Promise<void> {
  for (const id of ids) {
    const cell = document.createElement('div');
    cell.className = size > 64 ? 'case grande' : 'case';
    cell.title = id;
    const img = document.createElement('img');
    img.src = (await viewer.thumbnail(id, size)).url;
    img.alt = id;
    cell.append(img);
    if (size > 64) {
      const label = document.createElement('span');
      label.textContent = id;
      cell.append(label);
    }
    cell.addEventListener('pointerenter', () => {
      left.stop();
      left = viewer.live(el('vivante-a'), id);
    });
    container.append(cell);
  }
}

await fill(el('petites'), 64);
if (params.get('grandes') !== '0') await fill(el('grandes'), 128);
document.body.dataset.pret = '1';
