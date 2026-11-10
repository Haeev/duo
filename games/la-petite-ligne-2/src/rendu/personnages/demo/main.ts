/**
 * Page d'essai des personnages assemblés (lot L6), sans réseau ni simulation: six personnages
 * variés (deux joueurs, quatre habitants composés) menés par la vraie couche, sur le banc de la
 * halte d'essai. `pnpm dev`, puis `/src/rendu/personnages/demo/index.html?vue=<vue>`:
 * `pres` (repos, de près), `marche`, `assis`, `expressions`, `distance` (vue de jeu, 1366 x 768).
 */
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';
import { loadContent } from '../../../donnees/charger';
import { DATA_FILES } from '../../../donnees/fichiers';
import { createPlaceState, createWorld } from '../../../simulation/noyau/monde';
import { RENDER_SETTINGS } from '../../reglages';
import { AssembledCharacters } from '../couche';
import { loadCharacterLibrary } from '../chargement';

interface DemoApi {
  ready: boolean;
  stats: Record<string, number>;
}
declare global {
  interface Window {
    personnages: DemoApi;
  }
}
const api: DemoApi = { ready: false, stats: {} };
window.personnages = api;

const view = new URLSearchParams(window.location.search).get('vue') ?? 'pres';
const content = loadContent(DATA_FILES);
const library = await loadCharacterLibrary(content.catalogue, content.morphologies);

const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
renderer.info.autoReset = false;
document.body.appendChild(renderer.domElement);

const scene = new Scene();
scene.background = new Color('#e9e2d2');
scene.add(new HemisphereLight('#fff8ee', '#a7b48a', 1.4), new AmbientLight('#ffffff', 0.2));
const sun = new DirectionalLight('#ffe9cc', 2.4);
sun.position.set(13, 10, 20);
sun.target.position.set(16, 0, 12.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const ground = new Mesh(
  new PlaneGeometry(60, 60),
  new MeshStandardMaterial({ color: RENDER_SETTINGS.ground.color, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(16, 0, 12.5);
ground.receiveShadow = true;
scene.add(ground);

// Le banc de la halte, à la taille de sa forme provisoire (2 m x 1 m, 0,9 m de haut).
const halte = content.places['essai-halte'];
const benchDef = content.props.banc;
if (halte === undefined || benchDef === undefined) throw new Error('halte ou banc absents');
const s = RENDER_SETTINGS.standIn;
const bench = new Mesh(
  new BoxGeometry(benchDef.size.w - s.inset * 2, s.propHeight, benchDef.size.h - s.inset * 2),
  new MeshStandardMaterial({ color: '#b39a7a', roughness: 0.9 }),
);
bench.position.set(16, s.propHeight / 2, 12.5);
bench.castShadow = true;
bench.receiveShadow = true;
scene.add(bench);

const world = createWorld(content, 5, [
  { id: 'demo-a', name: 'Joueur 1' },
  { id: 'demo-b', name: 'Joueur 2' },
]);
const place = createPlaceState(content, halte);
world.places['essai-halte'] = place;
world.common.place = 'essai-halte';
const walking = view === 'marche' || view === 'distance';
const extras = ['facteur', 'meuniere', 'garde-barriere', 'petite-fille'];
const row = (i: number): { x: number; y: number } => ({ x: 12 + i * 1.6, y: 15.5 });
world.players[0].body = { ...row(0), facing: Math.PI / 2, speed: walking ? 1.6 : 0 };
world.players[1].body = { ...row(1), facing: Math.PI / 2, speed: walking ? 4.6 : 0 };
extras.forEach((id, i) => {
  place.villagers[id] = {
    met: [false, false],
    talkingWith: null,
    body: { ...row(i + 2), facing: Math.PI / 2, speed: walking && i % 2 === 0 ? 3 : 0 },
  };
});
if (view === 'assis') {
  const seats = place.objects.banc?.sit;
  if (seats !== undefined) {
    seats[0] = 0;
    seats[1] = 1;
  }
  world.players[0].body = { x: 15.5, y: 12.5, facing: Math.PI / 2, speed: 0 };
  world.players[1].body = { x: 16.5, y: 12.5, facing: Math.PI / 2, speed: 0 };
}

const root = scene;
const layer = new AssembledCharacters(
  { root, playerColors: ['#d9654f', '#4f8fd9'] },
  { content, onEvent: () => () => undefined },
  library,
);
const aspect = window.innerWidth / window.innerHeight;
const perspective = new PerspectiveCamera(view === 'expressions' ? 16 : 30, aspect, 0.1, 100);
const ortho = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
let camera: PerspectiveCamera | OrthographicCamera = perspective;
if (view === 'distance') {
  // Vue de jeu: 1366 x 768, plongée de 35 degrés, environ 14 m de large.
  const half = 7;
  Object.assign(ortho, { left: -half, right: half, top: half / aspect, bottom: -half / aspect });
  ortho.updateProjectionMatrix();
  const pitch = (35 * Math.PI) / 180;
  ortho.position.set(16, 30 * Math.sin(pitch), 15 + 30 * Math.cos(pitch));
  ortho.lookAt(16, 0, 15);
  camera = ortho;
} else if (view === 'assis') {
  perspective.position.set(13.2, 2.2, 18.5);
  perspective.lookAt(16, 0.9, 12.7);
} else if (view === 'expressions') {
  perspective.position.set(12.8, 1.6, 19.5);
  perspective.lookAt(12.8, 1.4, 15.5);
} else {
  perspective.fov = 38;
  perspective.updateProjectionMatrix();
  perspective.position.set(16, 2.1, 24.5);
  perspective.lookAt(16, 0.85, 15.5);
}

// Une seconde d'animation menée par la couche, puis l'image.
for (let i = 0; i < 70; i += 1) {
  layer.update({ dt: 1 / 60, world, place, cameraYaw: 0 });
  if (i === 0 && view === 'expressions') {
    layer.express('player-0', 'joy', 99);
    layer.express('player-1', 'surprise', 99);
    layer.express('facteur', 'angry', 99);
    layer.express('meuniere', 'sad', 99);
    layer.express('garde-barriere', 'thinking', 99);
  }
  if (i === 2) renderer.render(scene, camera);
}
renderer.info.reset();
renderer.render(scene, camera);
const stats = layer.stats();
api.stats = {
  calls: renderer.info.render.calls,
  triangles: renderer.info.render.triangles,
  programs: renderer.info.programs?.length ?? 0,
  figures: stats.figures,
  geometries: stats.geometries,
  assembledTriangles: stats.triangles,
  far: stats.far,
};
api.ready = true;
