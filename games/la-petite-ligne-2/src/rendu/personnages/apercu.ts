/**
 * Aperçu d'un personnage en pied (éditeur de personnage, interface 5.8): une scène à lui, le même
 * assemblage que le jeu (`assemble`, `createRig`, clips et visage partagés), le personnage vivant
 * (repos qui respire, clignement, petite expression à chaque changement) et qui tourne. Fournit
 * aussi les vignettes des pièces, rendues une fois depuis leur maillage.
 *
 * Deux plateaux, selon le style du jeu (`?rendu=aplats` ou non): en encre, le rendu du jeu tel
 * quel (matériaux des personnages, contour, ombres et lumière de midi, caméra orthographique sous
 * le même angle de soleil), devant un fond uni de photo d'identité; en aplats, l'ancien aperçu.
 */
import {
  AnimationMixer,
  Box3,
  CircleGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  SkinnedMesh,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Content } from '../../donnees/charger';
import type { Look } from '../../donnees/schemas/personnage';
import { towardCamera } from '../camera';
import { InkKit, type InkFrame } from '../encre/index';
import { addressStyle, type RenderStyle } from '../encre/reglages';
import { Face } from './animation';
import { resolveLook, type ResolvedLook } from './apparence';
import { assemble, type CharacterLibrary, createRig, headMorphs } from './assemblage';
import { loadCharacterLibrary } from './chargement';
import { CHARACTER_SETTINGS } from './reglages';

const DEG = Math.PI / 180;

/** Réglages de l'aperçu: cadrage, lumière, réaction. */
export const PREVIEW_SETTINGS = {
  background: '#efe6d2',
  floor: '#cfc3ab',
  fov: 26,
  /** Cadrage: hauteur visée (m) et marge autour du personnage. */
  lookAt: 0.92,
  distance: 5.6,
  cameraHeight: 1.25,
  /** Rotation au clavier (rad/s) et demi-vie du rattrapage de l'angle affiché (s). */
  turnSpeed: 2.6,
  turnHalfLife: 0.09,
  /** Réaction à un changement: expression, durée (s), « pop » d'échelle et sa durée (s). */
  reaction: { expression: 'joy', seconds: 0.9, pop: 0.04, popSeconds: 0.22 },
  /** Ombre de contact: rayon (m) et opacité. */
  contact: { radius: 0.36, opacity: 0.22 },
  /** Vignettes: taille (px) et angle trois quarts (rad). */
  thumbnail: { size: 128, yaw: -0.5, pitch: 0.18 },
  /**
   * Plateau encré: le personnage tel qu'en jeu, vu de près à midi. `yawDeg` est le lacet de la
   * caméra du jeu au départ: le soleil de midi tombe sur le personnage de face comme en jeu.
   * `pitchDeg`: plongée (photo d'identité: presque de face; le jeu descend à 35 degrés de près).
   * `viewHeight`: hauteur vue (m), centrée sur `lookAt`. `backdrop`: fond uni de la photo, un gris
   * bleuté éteint qui tient sur le thème sombre sans rien voler au trait noir ni aux teintes.
   */
  ink: {
    minutes: 12 * 60,
    yawDeg: 45,
    pitchDeg: 14,
    viewHeight: 2.3,
    lookAt: 0.95,
    distance: 12,
    backdrop: '#8b8f8c',
  },
} as const;

/** Ce que l'éditeur demande au rendu. */
export interface CharacterPreview {
  /** Assemble ce look (quelques millisecondes); `react` fait sourire et sautiller. */
  setLook(look: Look, react: boolean): void;
  /** Tourne le personnage de `radians` (glissé, touches). */
  turn(radians: number): void;
  /** Tourne seul vers cet angle (rad; 0: de face), au changement de rayon. */
  face(yaw: number): void;
  frame(dt: number): void;
  resize(width: number, height: number): void;
  /** Vignette (adresse d'image) d'un look partiel: une pièce seule, ou un personnage entier. */
  thumbnail(look: Look, mode: 'piece' | 'figure'): string;
  dispose(): void;
  /** Scène de l'aperçu (tests: matériaux posés, ressources libérées). */
  readonly scene: Scene;
}

/** Options de l'aperçu (tests): style imposé, fabrique du rendu. */
export interface PreviewOptions {
  /** Absent: le style de l'adresse du jeu (`?rendu=aplats`), comme le moteur. */
  readonly style?: RenderStyle;
  /** Absent: un `WebGLRenderer` sur le canevas. `ink`: réglages du rendu encré (pas d'anticrénelage). */
  readonly renderer?: (canvas: HTMLCanvasElement, ink: boolean) => WebGLRenderer;
}

interface Built {
  readonly object: Group;
  readonly mixer: AnimationMixer;
  readonly head: SkinnedMesh | null;
  readonly morphs: Readonly<Record<string, number>>;
  readonly dispose: () => void;
}

/** Ce qui change d'un style à l'autre: scène, matériaux du personnage, image. */
interface Stage {
  readonly scene: Scene;
  /** Angle ajouté à celui du personnage pour qu'à 0 il regarde la caméra. */
  readonly facing: number;
  readonly body: Material;
  readonly head: Material;
  /** Le personnage porte et reçoit des ombres (cartes d'ombre du rendu encré). */
  readonly shadows: boolean;
  /** Ce qui tourne avec le personnage (ombre de contact en ellipse, comme en jeu). */
  readonly turning: readonly Object3D[];
  render(dt: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const approach = (dt: number, halfLife: number): number => 1 - Math.pow(0.5, dt / halfLife);

function defaultRenderer(canvas: HTMLCanvasElement, ink: boolean): WebGLRenderer {
  return new WebGLRenderer(
    ink
      ? // Comme le jeu: seul un triangle plein écran atteint le canevas, l'anticrénelage n'y lisse rien.
        { canvas, antialias: false }
      : { canvas, antialias: true, preserveDrawingBuffer: true },
  );
}

const pixelRatio = (): number =>
  Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio, 2);

/** Crée l'aperçu sur ce canevas; la bibliothèque est chargée ici (une fois par ouverture). */
export async function createCharacterPreview(
  canvas: HTMLCanvasElement,
  content: Pick<Content, 'catalogue' | 'morphologies'>,
  library?: CharacterLibrary,
  options: PreviewOptions = {},
): Promise<CharacterPreview> {
  const lib = library ?? (await loadCharacterLibrary(content.catalogue, content.morphologies));
  const style =
    options.style ?? (typeof location === 'undefined' ? 'encre' : addressStyle(location.search));
  const renderer = (options.renderer ?? defaultRenderer)(canvas, style === 'encre');
  const stage = style === 'encre' ? new InkStage(renderer) : new SmoothStage(renderer);
  return new Preview(stage, renderer, lib, library === undefined);
}

/** L'ancien aperçu: lumière à deux lampes, sol rond, pastille d'ombre, perspective. */
class SmoothStage implements Stage {
  readonly scene = new Scene();
  readonly facing = 0;
  readonly body: MeshStandardMaterial;
  readonly head: MeshStandardMaterial;
  readonly shadows = false;
  readonly turning: readonly Object3D[] = [];
  private readonly camera: PerspectiveCamera;
  private readonly floor: Mesh<CircleGeometry, MeshStandardMaterial>;
  private readonly blob: Mesh<CircleGeometry, MeshBasicMaterial>;

  constructor(private readonly renderer: WebGLRenderer) {
    const s = PREVIEW_SETTINGS;
    renderer.setPixelRatio(pixelRatio());
    renderer.outputColorSpace = SRGBColorSpace;
    this.scene.background = new Color(s.background);
    this.camera = new PerspectiveCamera(s.fov, 1, 0.1, 50);
    this.camera.position.set(0, s.cameraHeight, s.distance);
    this.camera.lookAt(0, s.lookAt, 0);
    this.body = this.head = new MeshStandardMaterial({
      vertexColors: true,
      roughness: CHARACTER_SETTINGS.roughness,
      metalness: 0,
    });
    const sun = new DirectionalLight('#fff1dc', 2.2);
    sun.position.set(2.5, 4, 3);
    const floor = (this.floor = new Mesh(
      new CircleGeometry(1.1, 48),
      new MeshStandardMaterial({ color: s.floor, roughness: 1 }),
    ));
    floor.rotation.x = -Math.PI / 2;
    // Ombre de contact en pastille plutôt qu'une carte d'ombres (PC de référence, une seule figure).
    const blob = (this.blob = new Mesh(
      new CircleGeometry(s.contact.radius, 32),
      new MeshBasicMaterial({ color: '#3a2f28', transparent: true, opacity: s.contact.opacity }),
    ));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.003;
    this.scene.add(new HemisphereLight('#fff8ee', '#a7a08a', 1.5), sun, floor, blob);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.body.dispose();
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    this.blob.geometry.dispose();
    this.blob.material.dispose();
  }
}

/**
 * Le rendu du jeu: un `InkKit` à lui (son contexte WebGL est celui du canevas de l'éditeur, les
 * textures du jeu n'y sont pas), mêmes matériaux de personnage, même ombre de contact, même
 * ambiance de midi, même contour, épaisseur du trait comptée sur la hauteur de la fenêtre.
 */
class InkStage implements Stage {
  readonly scene = new Scene();
  readonly facing: number;
  readonly body: Material;
  readonly head: Material;
  readonly shadows = true;
  readonly turning: readonly Object3D[];
  readonly ink = new InkKit(undefined, { meter: false });
  private readonly camera = new OrthographicCamera();
  private readonly blobGeometry: PlaneGeometry;
  private readonly size = new Vector2();
  private readonly inkFrame: { -readonly [K in keyof InkFrame]: InkFrame[K] };

  constructor(private readonly renderer: WebGLRenderer) {
    const s = PREVIEW_SETTINGS.ink;
    renderer.setPixelRatio(pixelRatio());
    renderer.outputColorSpace = SRGBColorSpace;
    const pose = { yaw: s.yawDeg * DEG, pitch: s.pitchDeg * DEG };
    const toward = towardCamera(pose);
    // Personnage de face: son avant (+z) tourné vers la caméra.
    this.facing = -pose.yaw;
    this.camera.position.set(
      toward.x * s.distance,
      s.lookAt + toward.y * s.distance,
      toward.z * s.distance,
    );
    this.camera.near = 0.5;
    this.camera.far = s.distance * 2;
    this.camera.lookAt(0, s.lookAt, 0);
    const materials = this.ink.characterMaterials();
    this.body = materials.body;
    this.head = materials.head;
    const contact = CHARACTER_SETTINGS.contact;
    this.blobGeometry = new PlaneGeometry(contact.width, contact.depth).rotateX(-Math.PI / 2);
    const blob = new Mesh(this.blobGeometry, this.ink.contact);
    blob.position.y = contact.lift;
    blob.renderOrder = 1;
    this.turning = [blob];
    this.inkFrame = {
      dt: 0,
      minutes: s.minutes,
      sheet: null,
      weather: null,
      indoor: false,
      place: null,
      backdrop: s.backdrop,
      focusX: 0,
      focusZ: 0,
      viewRadius: s.viewHeight,
      toCamera: toward,
      lights: null,
      exposure: 1,
      width: 1,
      height: 1,
    };
  }

  render(dt: number): void {
    const frame = this.inkFrame;
    this.renderer.getDrawingBufferSize(this.size);
    frame.dt = dt;
    frame.width = this.size.x;
    frame.height = this.size.y;
    // Trait du jeu: compté sur la hauteur de la fenêtre (le canevas du jeu), pas sur l'aperçu.
    this.ink.strokeHeight =
      typeof window === 'undefined' ? null : window.innerHeight * this.renderer.getPixelRatio();
    this.ink.frame(this.renderer, this.scene, this.camera, frame);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    const half = PREVIEW_SETTINGS.ink.viewHeight / 2;
    const aspect = width / Math.max(1, height);
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.body.dispose();
    this.head.dispose();
    this.blobGeometry.dispose();
    this.ink.dispose();
  }
}

class Preview implements CharacterPreview {
  private readonly pivot = new Group();
  private readonly visage = new Face(7);
  /** Matériau des vignettes (lisse, lumière fixe à trois lampes, interface section 8). */
  private readonly thumbMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: CHARACTER_SETTINGS.roughness,
    metalness: 0,
  });
  private built: Built | null = null;
  private yaw = 0.35;
  private shownYaw = 0.35;
  private pop = 0;
  private thumbRenderer: WebGLRenderer | null = null;
  private readonly thumbScene = new Scene();
  private readonly thumbCamera = new PerspectiveCamera(24, 1, 0.05, 20);
  private readonly settings = PREVIEW_SETTINGS;

  constructor(
    private readonly stage: Stage,
    private readonly renderer: WebGLRenderer,
    private readonly library: CharacterLibrary,
    private readonly ownsLibrary: boolean,
  ) {
    stage.scene.add(this.pivot);
    if (stage.turning.length > 0) this.pivot.add(...stage.turning);
    const key = new DirectionalLight('#ffffff', 2.2);
    key.position.set(2, 3, 4);
    const rim = new DirectionalLight('#fff0e0', 0.8);
    rim.position.set(-3, 2, -2);
    this.thumbScene.add(new HemisphereLight('#ffffff', '#b9ad96', 1.6), key, rim);
  }

  get scene(): Scene {
    return this.stage.scene;
  }

  private build(look: Look): Built {
    const lib = this.library;
    const stage = this.stage;
    const resolved = resolveLook(look, lib.catalogue, lib.morphologies);
    const geometry = assemble(resolved, lib);
    const { root, skeletonOf } = createRig(lib, resolved.shape, look.height);
    const parent = skeletonOf.parent ?? root;
    const bind = (g: typeof geometry.body, material: Material): SkinnedMesh => {
      const mesh = new SkinnedMesh(g, material);
      mesh.bind(skeletonOf.skeleton, skeletonOf.bindMatrix);
      mesh.frustumCulled = false;
      mesh.castShadow = stage.shadows;
      mesh.receiveShadow = stage.shadows;
      parent.add(mesh);
      return mesh;
    };
    bind(geometry.body, stage.body);
    const head = geometry.head === null ? null : bind(geometry.head, stage.head);
    head?.updateMorphTargets();
    const object = new Group();
    object.add(root);
    const mixer = new AnimationMixer(root);
    const idle = lib.clipsFor(resolved.shape).get(CHARACTER_SETTINGS.clips.idle);
    if (idle !== undefined) mixer.clipAction(idle).play();
    return {
      object,
      mixer,
      head,
      morphs: geometry.head === null ? {} : headMorphs(geometry.head),
      dispose: () => {
        mixer.stopAllAction();
        mixer.uncacheRoot(root);
        // Chaque squelette cloné garde sa texture d'os: la libérer à chaque changement de pièce.
        skeletonOf.skeleton.dispose();
        geometry.body.dispose();
        geometry.head?.dispose();
        geometry.whole.dispose();
      },
    };
  }

  setLook(look: Look, react: boolean): void {
    const next = this.build(look);
    // Même instant de la respiration: le changement de pièce ne fait pas sursauter le corps.
    const time = this.built?.mixer.time ?? 0;
    next.mixer.setTime(time);
    if (this.built !== null) {
      this.pivot.remove(this.built.object);
      this.built.dispose();
    }
    this.built = next;
    this.pivot.add(next.object);
    if (react) {
      const r = this.settings.reaction;
      this.visage.show(r.expression, r.seconds);
      this.pop = r.popSeconds;
    }
  }

  turn(radians: number): void {
    this.yaw += radians;
  }

  face(yaw: number): void {
    // L'angle équivalent le plus proche: le personnage tourne au plus court.
    const turns = Math.round((this.yaw - yaw) / (Math.PI * 2));
    this.yaw = yaw + turns * Math.PI * 2;
  }

  frame(dt: number): void {
    const built = this.built;
    this.shownYaw += (this.yaw - this.shownYaw) * approach(dt, this.settings.turnHalfLife);
    this.pivot.rotation.y = this.shownYaw + this.stage.facing;
    const r = this.settings.reaction;
    this.pop = Math.max(0, this.pop - dt);
    const t = this.pop / r.popSeconds;
    this.pivot.scale.setScalar(1 + r.pop * Math.sin(Math.PI * t));
    if (built !== null) {
      built.mixer.update(dt);
      const influences = this.visage.update(dt);
      const infl = built.head?.morphTargetInfluences;
      if (infl !== undefined) {
        infl.fill(0);
        for (const [name, weight] of influences) {
          const index = built.morphs[name];
          if (index !== undefined) infl[index] = weight;
        }
      }
    }
    this.stage.render(dt);
  }

  resize(width: number, height: number): void {
    this.stage.resize(width, height);
  }

  thumbnail(look: Look, mode: 'piece' | 'figure'): string {
    const size = this.settings.thumbnail.size;
    if (this.thumbRenderer === null) {
      this.thumbRenderer = new WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      this.thumbRenderer.outputColorSpace = SRGBColorSpace;
      this.thumbRenderer.setPixelRatio(1);
      this.thumbRenderer.setSize(size, size, false);
      this.thumbRenderer.setClearColor(0x000000, 0);
    }
    const lib = this.library;
    const resolved = resolveLook(look, lib.catalogue, lib.morphologies);
    // Une pièce seule: le corps (toujours en tête du look résolu) est retiré.
    const partial: ResolvedLook =
      mode === 'piece'
        ? { ...resolved, pieces: resolved.pieces.filter((p) => p.slot !== 'body'), covered: [] }
        : resolved;
    const geometry = assemble(partial, lib);
    const mesh = new Mesh(geometry.whole, this.thumbMaterial);
    if (mode === 'figure' && look.height !== undefined) {
      mesh.scale.setScalar(look.height / 100 / lib.height(resolved.shape));
    }
    this.thumbScene.add(mesh);
    const box = new Box3().setFromObject(mesh);
    const center = box.getCenter(new Vector3());
    const extent = box.getSize(new Vector3());
    const radius = Math.max(0.08, Math.max(extent.x, extent.y, extent.z) * 0.62);
    const th = this.settings.thumbnail;
    const fov = (this.thumbCamera.fov * Math.PI) / 180;
    const distance = radius / Math.sin(fov / 2);
    this.thumbCamera.position.set(
      center.x + Math.sin(th.yaw) * Math.cos(th.pitch) * distance,
      center.y + Math.sin(th.pitch) * distance,
      center.z + Math.cos(th.yaw) * Math.cos(th.pitch) * distance,
    );
    this.thumbCamera.lookAt(center);
    this.thumbCamera.updateProjectionMatrix();
    this.thumbRenderer.render(this.thumbScene, this.thumbCamera);
    const url = this.thumbRenderer.domElement.toDataURL('image/png');
    this.thumbScene.remove(mesh);
    geometry.body.dispose();
    geometry.head?.dispose();
    geometry.whole.dispose();
    return url;
  }

  dispose(): void {
    if (this.built !== null) {
      this.pivot.remove(this.built.object);
      this.built.dispose();
      this.built = null;
    }
    this.stage.dispose();
    this.thumbMaterial.dispose();
    this.thumbRenderer?.dispose();
    this.thumbRenderer?.forceContextLoss();
    // Pas de perte forcée ici: l'éditeur garde son canevas et le rouvre sur le même contexte.
    this.renderer.dispose();
    if (this.ownsLibrary) this.library.dispose();
  }
}
