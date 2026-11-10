/**
 * Page d'essai du rendu « bande dessinée encrée »: ni réseau, ni simulation, ni moteur du jeu.
 * Elle montre un coin de la halte d'Aubrune et la pièce d'une maison, rendus comme ils le
 * seraient en jeu, pour juger le style et mesurer son coût. `pnpm dev`, puis
 * `http://localhost:5173/src/rendu/demo-encre/index.html`.
 *
 * Souris: glisser pour tourner, molette pour zoomer. Touches (lues par `KeyboardEvent.code`):
 * 1, 2, 3, 4 jour, crépuscule, nuit, aube; I dedans ou dehors; C contour suivant; O ombre
 * suivante; N variante dense du jour; Z Q S D déplacer le point visé; Espace met le temps en
 * pause; L ombre de la lampe; E effets (brume, particules, lumière des fenêtres); P panneau.
 *
 * Paramètres d'URL: `scene` (exterieur, interieur), `ambiance` (jour, crepuscule, nuit, aube),
 * `contour` (complet, post, aucun), `ombre` (aplat-hachure, aplat, hachure), `x`, `z`,
 * `largeur` (m), `lacet` (degrés), `dense=1` (variante de jour plus sombre), `hierarchie=0`
 * (tous les traits à tous les zooms), `joue=0` et `t` (temps figé, en secondes: captures
 * reproductibles), `lampe=0` (sans ombre de lampe), `effets=0`, `panneau=0`.
 */
import * as THREE from 'three';

import { loadActors, type Actor } from './acteurs';
import { ambianceOf, type Ambiance, type AmbianceId, type SceneId } from './ambiances';
import { InkPass, rankWeights } from './contours';
import { createMotes, type Motes } from './effets';
import {
  applyAmbiance,
  createInkMaterials,
  createInkUniforms,
  LampShadow,
  MAX_WINDOWS,
  SunShadow,
  type ShadowStyle,
} from './matiere';
import {
  buildExterior,
  buildInterior,
  contactGeometry,
  contactPositions,
  type ContactSpot,
  type SceneBuild,
  type View,
} from './scenes';
import { createGroundMap, terrainGeometry, type HeightAt } from './terrain';
import { createInkLayers, createNoise } from '../encre/textures';

type ContourMode = 'complet' | 'post' | 'aucun';
type ViewName = 'large' | 'jeu' | 'proche';

const SCENES: readonly SceneId[] = ['exterieur', 'interieur'];
const AMBIANCES: readonly AmbianceId[] = ['jour', 'crepuscule', 'nuit', 'aube'];
const CONTOURS: readonly ContourMode[] = ['complet', 'post', 'aucun'];
const SHADOWS: readonly ShadowStyle[] = ['aplat-hachure', 'aplat', 'hachure'];

/** Réglages de l'essai: tout ce qui se voit se règle ici, pas dans les nuanceurs. */
const SETTINGS = {
  /**
   * Plongée de la caméra sous l'horizon: 50 degrés au zoom de jeu et au-delà (décision du
   * client); en zoomant plus près elle s'abaisse jusqu'à 35 degrés, pour que les visages se voient.
   */
  pitchDeg: 50,
  closePitchDeg: 35,
  gameWidth: 18,
  minWidth: 6,
  maxWidth: 40,
  /** Demi-épaisseur du trait à 30 m de largeur de vue, en points d'un écran de 768 de haut. */
  lineRadius: 1.55,
  shadowMapSize: 2048,
  /** Carte d'ombre de la lampe locale: une seule, petite. */
  lampShadowSize: 512,
  /** Particules de l'air sur toute la zone. */
  motes: 90,
  /** Zoom (points par mètre) où le détail commence à paraître, et où il est plein. */
  paintedDetail: [45, 85],
  characterHatch: [80, 150],
  faceDetail: [34, 80],
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
  /** Le temps avance (marche, vent, brume); `false` le fige à `time`. */
  play: boolean;
  time: number;
  /** Ombre portée par la lampe la plus proche du joueur. */
  lampShadow: boolean;
  /** Brume, particules et lumière des fenêtres (coupés pour mesurer leur coût). */
  effects: boolean;
  panel: boolean;
}

export interface InkDemoApi {
  /** Images rendues depuis l'ouverture: une capture attend qu'il ait avancé. */
  frames: number;
  /** Personnages chargés (faux: les fichiers de l'essai 4 manquent). */
  cast: boolean;
  stats: {
    calls: number;
    triangles: number;
    milliseconds: number;
    /** Image la plus rapide de la série: la mesure la moins sensible à la charge de la machine. */
    fastest: number;
    programs: number;
    textures: number;
  };
  set(change: Partial<State> & { view?: ViewName }): void;
  /** Recensement de la scène affichée: triangles par maillage (une passe, sans les ombres). */
  census(): { name: string; triangles: number; instances: number }[];
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

function fade(value: number, range: readonly [number, number]): number {
  const t = Math.min(1, Math.max(0, (value - range[0]) / (range[1] - range[0])));
  return t * t * (3 - 2 * t);
}

const FLAT: HeightAt = () => 0;

interface Staged {
  readonly root: THREE.Scene;
  readonly walls: { mesh: THREE.Mesh; nx: number; nz: number; kind: 'full' | 'stub' }[];
  readonly build: SceneBuild;
  readonly height: HeightAt;
  readonly mask: THREE.Texture | null;
  readonly motes: Motes | null;
  actors: Actor[];
  /** Taches de contact des personnages: une géométrie réécrite à chaque image. */
  feet: THREE.Mesh | null;
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
  const builds: Record<SceneId, SceneBuild> = {
    exterieur: buildExterior(),
    interieur: buildInterior(),
  };
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
    play: params.get('joue') !== '0',
    time: numberParam(params, 't', 0),
    lampShadow: params.get('lampe') !== '0',
    effects: params.get('effets') !== '0',
    panel: params.get('panneau') !== '0',
  };

  const noise = createNoise();
  uniforms.uLayers.value = createInkLayers();
  uniforms.uNoise.value = noise;
  const materials = createInkMaterials(uniforms);
  const shadow = new SunShadow(SETTINGS.shadowMapSize);
  const lampShadow = new LampShadow(SETTINGS.lampShadowSize);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 220);
  const inkPass = new InkPass(2, 2, noise);

  const stages = new Map<SceneId, Staged>();
  for (const id of SCENES) {
    const build = builds[id];
    const root = new THREE.Scene();
    const height = build.terrain?.height ?? FLAT;
    const walls: Staged['walls'] = [];
    for (const piece of build.pieces) {
      const mesh = new THREE.Mesh(piece.geometry, materials.object);
      mesh.name = piece.wall ? `mur ${piece.wall.kind}` : 'décor';
      mesh.frustumCulled = false;
      if (piece.hidden) mesh.layers.set(1);
      else if (piece.shadow) mesh.layers.enable(1);
      if (piece.shadow) mesh.layers.enable(2);
      root.add(mesh);
      if (piece.wall) walls.push({ mesh, ...piece.wall });
    }
    let mask: THREE.Texture | null = null;
    if (build.terrain) {
      const ground = new THREE.Mesh(terrainGeometry(build.terrain.spec, height), materials.ground);
      ground.name = 'terrain';
      ground.renderOrder = -1;
      ground.frustumCulled = false;
      root.add(ground);
      mask = createGroundMap(build.terrain.spec, height);
    }
    for (const batch of [...build.scatter, ...build.plants]) {
      const instanced = new THREE.InstancedMesh(
        batch.geometry,
        materials.object,
        batch.matrices.length,
      );
      instanced.name = 'species' in batch ? batch.species : batch.shape;
      batch.matrices.forEach((matrix, i) => instanced.setMatrixAt(i, matrix));
      instanced.frustumCulled = false;
      if (!('shadow' in batch) || batch.shadow) instanced.layers.enable(1);
      root.add(instanced);
    }
    const contacts = new THREE.Mesh(contactGeometry(build.contacts, height), materials.contact);
    contacts.renderOrder = 5;
    contacts.frustumCulled = false;
    root.add(contacts);
    const motes = build.air ? createMotes(uniforms, build.air, height, SETTINGS.motes) : null;
    if (motes) root.add(motes.mesh);
    stages.set(id, { root, walls, build, height, mask, motes, actors: [], feet: null });
  }

  // Images encore à rendre: la page ne redessine que si quelque chose a changé ou si le temps court.
  let pending = 4;
  const times: number[] = [];
  const api: InkDemoApi = {
    frames: 0,
    cast: false,
    stats: { calls: 0, triangles: 0, milliseconds: 0, fastest: 0, programs: 0, textures: 0 },
    set(change) {
      const { view, ...rest } = change;
      Object.assign(state, rest);
      if (Object.keys(rest).length > 0) times.length = 0;
      if (view) applyView(viewOf(builds[state.scene], view));
      pending = 2;
    },
    census() {
      const list: { name: string; triangles: number; instances: number }[] = [];
      stages.get(state.scene)?.root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const geometry = object.geometry as THREE.BufferGeometry;
        const count = geometry.getIndex()?.count ?? geometry.getAttribute('position').count;
        const instances = object instanceof THREE.InstancedMesh ? object.count : 1;
        list.push({ name: object.name, triangles: (count / 3) * instances, instances });
      });
      return list;
    },
  };
  window.encre = api;

  function viewOf(build: SceneBuild, name: ViewName): View {
    return name === 'proche' ? build.close : name === 'jeu' ? build.game : build.view;
  }

  function applyView(view: View): void {
    state.x = view.x;
    state.z = view.z;
    state.width = view.width;
    state.yaw = view.yaw;
  }

  // Les personnages: fichiers de l'essai 4, chargés avant la première image.
  const casts = await Promise.all(SCENES.map((id) => loadActors(builds[id].cast, uniforms)));
  SCENES.forEach((id, index) => {
    const stage = stages.get(id);
    const actors = casts[index];
    if (!stage || !actors) return;
    stage.actors = actors;
    for (const actor of actors) {
      actor.mesh.name = actor.spec.who;
      stage.root.add(actor.root);
    }
    const spots: ContactSpot[] = actors.map(() => [0, 0, 0, 0.3, 0.2]);
    const feet = new THREE.Mesh(contactGeometry(spots, FLAT), materials.contact);
    feet.renderOrder = 5;
    feet.frustumCulled = false;
    stage.root.add(feet);
    stage.feet = feet;
  });
  api.cast = casts.every((cast) => cast !== null);

  function resize(): void {
    const width = canvas?.clientWidth ?? 1366;
    const height = canvas?.clientHeight ?? 768;
    renderer.setSize(width, height, false);
    inkPass.setSize(width, height);
    uniforms.uScreen.value.set(width, height);
    pending = 2;
  }
  window.addEventListener('resize', resize);
  resize();

  /** Lampe qui porte l'ombre locale: la plus proche du joueur parmi celles qui le peuvent. */
  function casterOf(build: SceneBuild, ambiance: Ambiance, player: Actor | undefined): number {
    if (!state.lampShadow || ambiance.lamps <= 0) return -1;
    const px = player?.root.position.x ?? state.x;
    const pz = player?.root.position.z ?? state.z;
    let best = -1;
    let bestDistance = Infinity;
    build.lamps.forEach((lamp, index) => {
      if (!lamp.shadowFov) return;
      const distance = Math.hypot(lamp.x - px, lamp.z - pz);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  }

  const probePixel = new Uint8Array(4);
  let last = performance.now();
  function frame(): void {
    requestAnimationFrame(frame);
    const now = performance.now();
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (state.play) {
      state.time += elapsed;
      pending = Math.max(pending, 1);
    }
    if (pending <= 0) return;
    pending -= 1;
    const stage = stages.get(state.scene);
    if (!stage) return;
    const started = performance.now();
    const build = stage.build;
    const full = ambianceOf(state.scene, state.ambiance, state.dense);
    const ambiance: Ambiance = state.effects
      ? full
      : { ...full, mist: 0, spill: 0, particles: 'aucune' };

    const size = renderer.getSize(new THREE.Vector2());
    const aspect = size.x / size.y;
    const yaw = (state.yaw * Math.PI) / 180;
    const closeness = fade(state.width, [SETTINGS.gameWidth, SETTINGS.minWidth]);
    const pitchDeg = SETTINGS.pitchDeg + (SETTINGS.closePitchDeg - SETTINGS.pitchDeg) * closeness;
    const pitch = (pitchDeg * Math.PI) / 180;
    const target = new THREE.Vector3(state.x, 0, state.z);
    const forward = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));

    // Les fenêtres les plus proches du point visé jettent leur lumière; les autres attendent.
    const windows = [...build.windows]
      .sort(
        (a, b) =>
          Math.hypot(a.x - state.x, a.z - state.z) - Math.hypot(b.x - state.x, b.z - state.z),
      )
      .slice(0, MAX_WINDOWS);
    applyAmbiance(uniforms, ambiance, build.lamps, build.keyLamp, state.shadow, windows);
    uniforms.uTime.value = state.time;
    if (stage.mask && build.terrain) {
      const plan = build.terrain.spec.plan;
      uniforms.uMask.value = stage.mask;
      uniforms.uMaskRect.value.set(...plan.origin, ...plan.size);
    }
    stage.motes?.setAmbiance(ambiance);

    // Personnages: animation, place sur le terrain, taches de contact sous leurs pieds.
    for (const actor of stage.actors) actor.update(state.time, stage.height);
    if (stage.feet) {
      const spots: ContactSpot[] = stage.actors.map((actor) => {
        const { x, z } = actor.root.position;
        const floor = actor.spec.floor;
        // Sur un plancher ou un quai, la tache se pose à sa hauteur, pas à celle du terrain dessous.
        const lift = floor === undefined ? 0 : floor - stage.height(x, z);
        return [x, lift, z, actor.girth, actor.girth * 0.72];
      });
      const attribute = stage.feet.geometry.getAttribute('position');
      attribute.array.set(contactPositions(spots, stage.height));
      attribute.needsUpdate = true;
    }

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

    const pixelsPerMetre = size.x / state.width;
    const weights = state.hierarchy ? rankWeights(pixelsPerMetre) : [1, 1, 1, 1, 1];
    // Le détail suit la même règle que le trait: il s'efface quand la vue s'élargit.
    uniforms.uDetail.value.set(
      state.hierarchy ? fade(pixelsPerMetre, SETTINGS.paintedDetail) : 1,
      fade(pixelsPerMetre, SETTINGS.characterHatch),
      fade(pixelsPerMetre, SETTINGS.faceDetail),
    );
    uniforms.uViewDir.value.copy(camera.position).sub(target).normalize();
    uniforms.uPainted.value = state.contour === 'complet' ? 1 : 0;

    renderer.info.reset();
    shadow.update(renderer, stage.root, materials.depth, uniforms, target, state.width * 0.72 + 4);
    const caster = casterOf(build, ambiance, stage.actors[build.player]);
    lampShadow.update(
      renderer,
      stage.root,
      materials.depth,
      uniforms,
      build.lamps[caster] ?? null,
      caster,
    );
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
    inkPass.render(renderer, camera, state.contour === 'aucun' ? 0 : radius, weights);
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
      textures: renderer.info.memory.textures,
    };
    api.frames += 1;
    if (panel) panel.hidden = !state.panel;
    if (panel && state.panel) {
      panel.textContent = [
        `${state.scene}, ${state.ambiance}, contour ${state.contour}, ombre ${state.shadow}`,
        `vue ${state.width.toFixed(1)} m, lacet ${state.yaw.toFixed(0)} degrés, t ${state.time.toFixed(1)} s`,
        `${api.stats.calls} appels, ${api.stats.triangles} triangles, ${api.stats.programs} programmes`,
        `${api.stats.milliseconds.toFixed(1)} ms par image (rendu logiciel: indicatif)`,
        api.cast ? '' : "personnages absents (fichiers de l'essai 4 introuvables)",
        '1 2 3 4 ambiance, I lieu, C contour, O ombre, L lampe, E effets, Espace pause',
      ]
        .filter((line) => line !== '')
        .join('\n');
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
      case 'Digit4':
        state.ambiance = 'aube';
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
      case 'KeyL':
        state.lampShadow = !state.lampShadow;
        break;
      case 'KeyE':
        state.effects = !state.effects;
        break;
      case 'Space':
        state.play = !state.play;
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
