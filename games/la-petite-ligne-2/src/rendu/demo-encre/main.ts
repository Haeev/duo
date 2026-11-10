/**
 * Page d'essai du rendu « bande dessinée encrée »: ni réseau, ni simulation, ni moteur du jeu.
 * Elle montre un coin de la halte d'Aubrune et la pièce d'une maison, rendus comme ils le
 * seraient en jeu, pour juger le style et mesurer son coût. `pnpm dev`, puis
 * `http://localhost:5173/src/rendu/demo-encre/index.html`.
 *
 * Souris: glisser pour tourner, molette pour zoomer. Touches (lues par `KeyboardEvent.code`):
 * 1, 2, 3 jour, crépuscule, nuit; I dedans ou dehors; C contour suivant; O ombre suivante;
 * N variante dense du jour; Z Q S D déplacer le point visé; P panneau.
 *
 * Paramètres d'URL: `scene` (exterieur, interieur), `ambiance` (jour, crepuscule, nuit),
 * `contour` (complet, post, coque, aucun), `ombre` (aplat-hachure, aplat, hachure), `x`, `z`,
 * `personnages=sculptes` (formes d'attente au lieu des personnages riggés), `largeur` (m),
 * `lacet` (degrés), `dense=1` (variante de jour plus sombre), `hierarchie=0` (tous les traits à tous les zooms), `panneau=0`.
 */
import * as THREE from 'three';

import { ambianceOf, type AmbianceId, type SceneId } from './ambiances';
import { InkPass, rankWeights } from './contours';
import { loadFigurines } from './figurines';
import {
  applyAmbiance,
  createFigurineMaterial,
  createInkMaterials,
  createInkUniforms,
  SunShadow,
  type ShadowStyle,
} from './matiere';
import { buildExterior, buildInterior, type SceneBuild, type View } from './scenes';
import { createGroundMask, createInkLayers, createNoise } from './textures';

type ContourMode = 'complet' | 'post' | 'coque' | 'aucun';

const SCENES: readonly SceneId[] = ['exterieur', 'interieur'];
const AMBIANCES: readonly AmbianceId[] = ['jour', 'crepuscule', 'nuit'];
const CONTOURS: readonly ContourMode[] = ['complet', 'post', 'coque', 'aucun'];
const SHADOWS: readonly ShadowStyle[] = ['aplat-hachure', 'aplat', 'hachure'];

/** Réglages de l'essai: tout ce qui se voit se règle ici, pas dans les nuanceurs. */
const SETTINGS = {
  /** Plongée de la caméra sous l'horizon (décision du client: 50 degrés). */
  pitchDeg: 50,
  minWidth: 6,
  maxWidth: 40,
  /** Demi-épaisseur du trait à 30 m de largeur de vue, en points d'un écran de 768 de haut. */
  lineRadius: 1.55,
  /** Épaisseur de la coque inversée, en points d'écran (contour comparé). */
  hullPixels: 2.6,
  shadowMapSize: 2048,
} as const;

interface State {
  scene: SceneId;
  ambiance: AmbianceId;
  contour: ContourMode;
  shadow: ShadowStyle;
  x: number;
  z: number;
  width: number;
  yaw: number;
  /** Variante de jour plus sombre et plus contrastée (à comparer). */
  dense: boolean;
  /** Hiérarchie du trait selon la taille à l'écran; `false` rejoue l'ancien rendu (comparaison). */
  hierarchy: boolean;
  panel: boolean;
}

export interface InkDemoApi {
  /** Images rendues depuis l'ouverture: une capture attend qu'il ait avancé. */
  frames: number;
  stats: {
    calls: number;
    triangles: number;
    milliseconds: number;
    /** Image la plus rapide de la série: la mesure la moins sensible à la charge de la machine. */
    fastest: number;
    programs: number;
  };
  set(change: Partial<State> & { view?: 'large' | 'proche' }): void;
}

declare global {
  interface Window {
    encre?: InkDemoApi;
  }
}

function pick<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return options.find((option) => option === value) ?? fallback;
}

function numberParam(params: URLSearchParams, name: string, fallback: number): number {
  const raw = params.get(name);
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

async function start(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene');
  const panel = document.querySelector<HTMLElement>('#panneau');
  if (!canvas || !panel) return;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    // Les captures lisent le canevas après coup.
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.autoClear = false;
  renderer.info.autoReset = false;

  const params = new URLSearchParams(window.location.search);
  const uniforms = createInkUniforms();
  // Personnages riggés de l'essai 3 s'ils sont dans le dépôt, sinon les formes sculptées.
  const wantSculpted = params.get('personnages') === 'sculptes';
  const probe = { exterieur: buildExterior(true), interieur: buildInterior(true) };
  const casts = wantSculpted
    ? null
    : await Promise.all([loadFigurines(probe.exterieur.cast), loadFigurines(probe.interieur.cast)]);
  const figurines = casts?.[0] && casts[1] ? { exterieur: casts[0], interieur: casts[1] } : null;
  const builds: Record<SceneId, SceneBuild> = figurines
    ? { exterieur: buildExterior(false), interieur: buildInterior(false) }
    : probe;
  const firstScene = pick(params.get('scene'), SCENES, 'exterieur');
  const firstView = builds[firstScene].view;
  const state: State = {
    scene: firstScene,
    ambiance: pick(params.get('ambiance'), AMBIANCES, 'jour'),
    contour: pick(params.get('contour'), CONTOURS, 'complet'),
    shadow: pick(params.get('ombre'), SHADOWS, 'aplat-hachure'),
    x: numberParam(params, 'x', firstView.x),
    z: numberParam(params, 'z', firstView.z),
    width: numberParam(params, 'largeur', firstView.width),
    yaw: numberParam(params, 'lacet', firstView.yaw),
    dense: params.get('dense') === '1',
    hierarchy: params.get('hierarchie') !== '0',
    panel: params.get('panneau') !== '0',
  };

  const noise = createNoise();
  uniforms.uLayers.value = createInkLayers();
  uniforms.uNoise.value = noise;
  const materials = createInkMaterials(uniforms);
  const shadow = new SunShadow(SETTINGS.shadowMapSize);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 220);
  const inkPass = new InkPass(2, 2, noise);

  interface Staged {
    readonly root: THREE.Scene;
    readonly walls: { mesh: THREE.Mesh; nx: number; nz: number; kind: 'full' | 'stub' }[];
    readonly hulls: THREE.Mesh[];
    readonly build: SceneBuild;
  }
  const stages = new Map<SceneId, Staged>();
  for (const id of SCENES) {
    const build = builds[id];
    const root = new THREE.Scene();
    const staged: Staged = { root, walls: [], hulls: [], build };
    for (const piece of build.pieces) {
      const mesh = new THREE.Mesh(piece.geometry, materials.object);
      mesh.frustumCulled = false;
      if (piece.hidden) mesh.layers.set(1);
      else if (piece.shadow) mesh.layers.enable(1);
      root.add(mesh);
      if (piece.wall) staged.walls.push({ mesh, ...piece.wall });
      if (!piece.hidden && !piece.wall) {
        const hull = new THREE.Mesh(piece.geometry, materials.hull);
        hull.frustumCulled = false;
        hull.visible = false;
        root.add(hull);
        staged.hulls.push(hull);
      }
    }
    if (build.ground) {
      const plane = new THREE.PlaneGeometry(build.ground.size[0], build.ground.size[1]);
      plane.rotateX(-Math.PI / 2);
      plane.translate(
        build.ground.origin[0] + build.ground.size[0] / 2,
        0,
        build.ground.origin[1] + build.ground.size[1] / 2,
      );
      const ground = new THREE.Mesh(plane, materials.ground);
      ground.renderOrder = -1;
      root.add(ground);
    }
    for (const figurine of figurines?.[id] ?? []) {
      const material = createFigurineMaterial(
        uniforms,
        figurine.atlas,
        figurine.traits,
        figurine.expression,
      );
      const mesh = new THREE.Mesh(figurine.geometry, material);
      mesh.frustumCulled = false;
      mesh.layers.enable(1);
      root.add(mesh);
      const hull = new THREE.Mesh(
        figurine.geometry,
        createFigurineMaterial(
          uniforms,
          figurine.atlas,
          figurine.traits,
          figurine.expression,
          true,
        ),
      );
      hull.frustumCulled = false;
      hull.visible = false;
      root.add(hull);
      staged.hulls.push(hull);
    }
    for (const batch of build.scatter) {
      const instanced = new THREE.InstancedMesh(
        batch.geometry,
        materials.object,
        batch.matrices.length,
      );
      batch.matrices.forEach((matrix, i) => instanced.setMatrixAt(i, matrix));
      instanced.frustumCulled = false;
      if (batch.shadow) instanced.layers.enable(1);
      root.add(instanced);
    }
    const contacts = new THREE.Mesh(build.contacts, materials.contact);
    contacts.renderOrder = 5;
    contacts.frustumCulled = false;
    root.add(contacts);
    stages.set(id, staged);
  }
  const masks = new Map<SceneId, THREE.Texture>();

  // Images encore à rendre: la page ne redessine que quand quelque chose a changé.
  let pending = 4;
  const api: InkDemoApi = {
    frames: 0,
    stats: { calls: 0, triangles: 0, milliseconds: 0, fastest: 0, programs: 0 },
    set(change) {
      const { view, ...rest } = change;
      Object.assign(state, rest);
      if (Object.keys(rest).length > 0) times.length = 0;
      if (view) {
        const preset = view === 'proche' ? builds[state.scene].close : builds[state.scene].view;
        applyView(preset);
      }
      pending = 2;
    },
  };
  window.encre = api;

  function applyView(view: View): void {
    state.x = view.x;
    state.z = view.z;
    state.width = view.width;
    state.yaw = view.yaw;
  }

  function resize(): void {
    const width = canvas?.clientWidth ?? 1366;
    const height = canvas?.clientHeight ?? 768;
    renderer.setSize(width, height, false);
    inkPass.setSize(width, height);
    pending = 2;
  }
  window.addEventListener('resize', resize);
  resize();

  const times: number[] = [];
  const probePixel = new Uint8Array(4);
  function frame(): void {
    requestAnimationFrame(frame);
    if (pending <= 0) return;
    pending -= 1;
    const stage = stages.get(state.scene);
    if (!stage) return;
    const started = performance.now();
    const build = stage.build;
    const ambiance = ambianceOf(state.scene, state.ambiance, state.dense);
    applyAmbiance(uniforms, ambiance, build.lamps, build.keyLamp, state.shadow);
    if (build.ground) {
      let mask = masks.get(state.scene);
      if (!mask) {
        mask = createGroundMask(build.ground);
        masks.set(state.scene, mask);
      }
      uniforms.uMask.value = mask;
      uniforms.uMaskRect.value.set(...build.ground.origin, ...build.ground.size);
    }

    const size = renderer.getSize(new THREE.Vector2());
    const aspect = size.x / size.y;
    const yaw = (state.yaw * Math.PI) / 180;
    const pitch = (SETTINGS.pitchDeg * Math.PI) / 180;
    const target = new THREE.Vector3(state.x, 0, state.z);
    const forward = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    camera.position
      .copy(target)
      .addScaledVector(forward, -Math.cos(pitch) * 90)
      .add(new THREE.Vector3(0, Math.sin(pitch) * 90, 0));
    camera.left = -state.width / 2;
    camera.right = state.width / 2;
    camera.top = state.width / aspect / 2;
    camera.bottom = -state.width / aspect / 2;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // Murs d'intérieur: celui dont le dehors regarde la caméra s'efface, son pied reste.
    for (const wall of stage.walls) {
      const facesCamera = -(wall.nx * forward.x + wall.nz * forward.z) > 0.2;
      const shown = wall.kind === 'full' ? !facesCamera : facesCamera;
      if (wall.kind === 'full') {
        wall.mesh.visible = true;
        if (shown) wall.mesh.layers.enable(0);
        else wall.mesh.layers.disable(0);
      } else {
        wall.mesh.visible = shown;
      }
    }

    const hull = state.contour === 'coque';
    for (const mesh of stage.hulls) mesh.visible = hull;
    uniforms.uHull.value = (SETTINGS.hullPixels * state.width) / size.x;
    const pixelsPerMetre = size.x / state.width;
    const weights = state.hierarchy ? rankWeights(pixelsPerMetre) : [1, 1, 1, 1, 1];
    // Le trait peint des textures d'objet suit la même règle: il s'efface à la vue large.
    const fade = Math.min(1, Math.max(0, (pixelsPerMetre - 45) / 40));
    uniforms.uDetail.value.set(state.hierarchy ? fade * fade * (3 - 2 * fade) : 1, 1);
    uniforms.uViewDir.value.copy(camera.position).sub(target).normalize();
    uniforms.uPainted.value = state.contour === 'complet' ? 1 : 0;

    renderer.info.reset();
    for (const mesh of stage.hulls) mesh.layers.set(0);
    shadow.update(renderer, stage.root, materials.depth, uniforms, target, state.width * 0.72 + 4);
    renderer.setRenderTarget(inkPass.target);
    renderer.setClearColor(
      new THREE.Color().setRGB(...ambiance.background, THREE.SRGBColorSpace),
      1,
    );
    renderer.clear();
    renderer.render(stage.root, camera);
    inkPass.setAmbiance(ambiance);
    const zoom = Math.min(1.7, Math.max(0.85, Math.sqrt(30 / state.width)));
    const radius = SETTINGS.lineRadius * zoom * (size.y / 768);
    const traced = state.contour === 'complet' || state.contour === 'post';
    inkPass.render(renderer, camera, traced ? radius : 0, weights);
    // Lire un point force la fin réelle du rendu: sans cela le temps mesuré ne veut rien dire.
    const gl = renderer.getContext();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, probePixel);

    times.push(performance.now() - started);
    if (times.length > 20) times.shift();
    api.stats = {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      milliseconds: times.reduce((sum, value) => sum + value, 0) / times.length,
      fastest: Math.min(...times),
      programs: renderer.info.programs?.length ?? 0,
    };
    api.frames += 1;
    if (panel) {
      panel.hidden = !state.panel;
      panel.textContent = [
        `${state.scene}, ${state.ambiance}, contour ${state.contour}, ombre ${state.shadow}`,
        `vue ${state.width.toFixed(1)} m, lacet ${state.yaw.toFixed(0)} degrés`,
        `${api.stats.calls} appels, ${api.stats.triangles} triangles, ${api.stats.programs} programmes`,
        `${api.stats.milliseconds.toFixed(1)} ms par image (rendu logiciel: indicatif)`,
        '1 2 3 ambiance, I dedans ou dehors, C contour, O ombre, glisser et molette',
      ].join('\n');
    }
  }

  function cycle<T>(options: readonly T[], current: T): T {
    return options[(options.indexOf(current) + 1) % options.length] ?? current;
  }

  window.addEventListener('keydown', (event) => {
    const yaw = (state.yaw * Math.PI) / 180;
    const step = state.width * 0.04;
    const move = (right: number, up: number): void => {
      state.x += (Math.cos(yaw) * right + Math.sin(yaw) * up) * step;
      state.z += (Math.sin(yaw) * right - Math.cos(yaw) * up) * step;
    };
    switch (event.code) {
      case 'Digit1':
        state.ambiance = 'jour';
        break;
      case 'Digit2':
        state.ambiance = 'crepuscule';
        break;
      case 'Digit3':
        state.ambiance = 'nuit';
        break;
      case 'KeyI':
        state.scene = cycle(SCENES, state.scene);
        applyView(builds[state.scene].view);
        break;
      case 'KeyC':
        state.contour = cycle(CONTOURS, state.contour);
        break;
      case 'KeyO':
        state.shadow = cycle(SHADOWS, state.shadow);
        break;
      case 'KeyN':
        state.dense = !state.dense;
        break;
      case 'KeyP':
        state.panel = !state.panel;
        break;
      case 'KeyW':
        move(0, 1);
        break;
      case 'KeyS':
        move(0, -1);
        break;
      case 'KeyA':
        move(-1, 0);
        break;
      case 'KeyD':
        move(1, 0);
        break;
      default:
        return;
    }
    pending = 2;
  });

  let dragging = false;
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerup', () => {
    dragging = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    state.yaw = (state.yaw - event.movementX * 0.35 + 360) % 360;
    pending = 2;
  });
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const next = state.width * Math.exp(event.deltaY * 0.0012);
      state.width = Math.min(SETTINGS.maxWidth, Math.max(SETTINGS.minWidth, next));
      pending = 2;
    },
    { passive: false },
  );

  requestAnimationFrame(frame);
}

void start();
