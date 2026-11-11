/**
 * Planche des tenues dans le vrai aperçu encré des personnages (`src/rendu/personnages/apercu.ts`,
 * celui de l'éditeur): même assemblage, mêmes matériaux, même lumière de midi, même trait.
 * La page n'ajoute qu'une chose: une pose de clip figée (`walk`, `run`, `sit`) ou couchée, posée
 * juste avant chaque dessin (le clip de repos de l'aperçu tourne dessous et cède la place).
 * Servie par Vite depuis la racine du paquet; pilotée par `capturer.cjs` (`window.planche.vue`).
 */
import { AnimationMixer, WebGLRenderer } from 'three';
import { loadContent } from '../../../src/donnees/charger';
import { DATA_FILES } from '../../../src/donnees/fichiers';
import { createCharacterPreview } from '../../../src/rendu/personnages/apercu';
import { loadCharacterLibrary } from '../../../src/rendu/personnages/chargement';

const DEG = Math.PI / 180;
const canvas = document.getElementById('scene');
const content = loadContent(DATA_FILES);
const library = await loadCharacterLibrary(content.catalogue, content.morphologies);
let renderer = null;
const preview = await createCharacterPreview(canvas, content, library, {
  style: 'encre',
  renderer: (c) => {
    renderer = new WebGLRenderer({ canvas: c, antialias: false, preserveDrawingBuffer: true });
    renderer.info.autoReset = false;
    return renderer;
  },
});
const nuancier = await (await fetch('../nuancier.json')).json();
// Un nom peut servir dans plusieurs familles (« noisette »: peau, tissu, iris): on garde toutes ses teintes.
const named = {};
for (const family of Object.values(nuancier))
  for (const [name, hex] of family) (named[name] ??= []).push(hex.toLowerCase());

/** Pièce de vue: [emplacement, id, [noms du nuancier par zone]] vers la pièce d'un `Look`. */
function piece([slot, id, colors = []]) {
  const def = content.catalogue.pieces.find((p) => p.id === id);
  if (def === undefined) throw new Error(`pièce inconnue: ${id}`);
  const indices = colors.map((name, zone) => {
    const colors = def.zones[zone]?.colors ?? [];
    const index = colors.findIndex((hex) => (named[name] ?? [name]).includes(hex));
    if (index < 0) throw new Error(`${id}: couleur ${name} hors de la zone ${zone}`);
    return index;
  });
  return { slot, id, colors: indices };
}

let pose = null;
preview.scene.onBeforeRender = () => {
  if (pose === null) return;
  pose.apply();
  preview.scene.updateMatrixWorld(true);
};

function rootOf() {
  let found = null;
  preview.scene.traverse((o) => {
    if (found === null && o.isSkinnedMesh) found = o;
  });
  let o = found;
  while (o?.parent?.parent?.parent && o.parent.parent.parent !== preview.scene) o = o.parent;
  return o;
}

/**
 * Gros plan: la caméra de l'aperçu (orthographique) ne montre que `hauteur` mètres autour de la
 * hauteur `centre`. Le trait garde son épaisseur à l'écran: on voit la pièce comme à la loupe.
 */
function cadrer({ centre, hauteur }, aspect) {
  const camera = preview.stage.camera;
  const pitch = Math.atan2(
    camera.position.y - 0.95,
    Math.hypot(camera.position.x, camera.position.z),
  );
  const mid = (centre - 0.95) * Math.cos(pitch);
  camera.left = (-hauteur / 2) * aspect;
  camera.right = (hauteur / 2) * aspect;
  camera.top = mid + hauteur / 2;
  camera.bottom = mid - hauteur / 2;
  camera.updateProjectionMatrix();
}

/**
 * Une vue: `look` (`shape`, `skin`, `pieces`), `lacet` en degrés (0 de face, 180 de dos),
 * `clip` et `instant` (fraction du clip), `couche` (sur le dos), `largeur` et `hauteur` en points,
 * `cadre` (`centre` et `hauteur` en mètres) pour un gros plan.
 */
async function vue(v) {
  canvas.width = v.largeur;
  canvas.height = v.hauteur;
  canvas.style.width = `${v.largeur}px`;
  canvas.style.height = `${v.hauteur}px`;
  preview.resize(v.largeur, v.hauteur);
  if (v.cadre !== undefined) cadrer(v.cadre, v.largeur / v.hauteur);
  const look = { shape: v.look.shape, skin: v.look.skin ?? 2, pieces: v.look.pieces.map(piece) };
  pose = null;
  preview.setLook(look, false);
  const root = rootOf();
  const group = root.parent;
  group.rotation.set(0, 0, 0);
  group.position.set(0, 0, 0);
  if (v.clip !== undefined && v.clip !== 'idle') {
    const clip = library.clipsFor(look.shape).get(v.clip);
    if (clip === undefined) throw new Error(`clip absent: ${v.clip}`);
    const mixer = new AnimationMixer(root);
    mixer.clipAction(clip).play();
    const time = (v.instant ?? 0) * clip.duration;
    pose = { apply: () => mixer.setTime(time) };
  }
  if (v.couche) {
    group.rotation.set(-90 * DEG, 0, 0);
    group.position.set(0, 0.18, 0.85);
  }
  preview.face((v.lacet ?? 0) * DEG);
  for (let i = 0; i < 5; i += 1) preview.frame(0.5);
  // L'encre saute des images en rendu logiciel: on redessine jusqu'à un vrai dessin de la pose finale.
  for (let i = 0; i < 40; i += 1) {
    renderer.info.reset();
    preview.frame(0.001);
    if (renderer.info.render.calls > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return canvas.toDataURL('image/png');
}

window.planche = { vue, pret: true };
