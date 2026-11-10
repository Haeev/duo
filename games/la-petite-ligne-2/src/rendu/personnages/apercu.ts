/**
 * Aperçu d'un personnage en pied (éditeur de personnage, interface 5.8): une scène à lui, le même
 * assemblage que le jeu (`assemble`, `createRig`, clips et visage partagés), le personnage vivant
 * (repos qui respire, clignement, petite expression à chaque changement) et qui tourne. Fournit
 * aussi les vignettes des pièces, rendues une fois depuis leur maillage.
 */
import {
  AnimationMixer,
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  CircleGeometry,
  SRGBColorSpace,
  Scene,
  SkinnedMesh,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Content } from '../../donnees/charger';
import type { Look } from '../../donnees/schemas/personnage';
import { Face } from './animation';
import { resolveLook, type ResolvedLook } from './apparence';
import { assemble, type CharacterLibrary, createRig, headMorphs } from './assemblage';
import { loadCharacterLibrary } from './chargement';
import { CHARACTER_SETTINGS } from './reglages';

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
}

interface Built {
  readonly object: Group;
  readonly mixer: AnimationMixer;
  readonly head: SkinnedMesh | null;
  readonly morphs: Readonly<Record<string, number>>;
  readonly dispose: () => void;
}

const approach = (dt: number, halfLife: number): number => 1 - Math.pow(0.5, dt / halfLife);

/** Crée l'aperçu sur ce canevas; la bibliothèque est chargée ici (une fois par ouverture). */
export async function createCharacterPreview(
  canvas: HTMLCanvasElement,
  content: Pick<Content, 'catalogue' | 'morphologies'>,
  library?: CharacterLibrary,
): Promise<CharacterPreview> {
  const lib = library ?? (await loadCharacterLibrary(content.catalogue, content.morphologies));
  return new Preview(canvas, lib, library === undefined);
}

class Preview implements CharacterPreview {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly material: MeshStandardMaterial;
  private readonly pivot = new Group();
  private readonly floor: Mesh<CircleGeometry, MeshStandardMaterial>;
  private readonly blob: Mesh<CircleGeometry, MeshBasicMaterial>;
  private readonly visage = new Face(7);
  private built: Built | null = null;
  private yaw = 0.35;
  private shownYaw = 0.35;
  private pop = 0;
  private thumbRenderer: WebGLRenderer | null = null;
  private readonly thumbScene = new Scene();
  private readonly thumbCamera = new PerspectiveCamera(24, 1, 0.05, 20);
  private readonly settings = PREVIEW_SETTINGS;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly library: CharacterLibrary,
    private readonly ownsLibrary: boolean,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    const s = this.settings;
    this.scene.background = new Color(s.background);
    this.camera = new PerspectiveCamera(s.fov, 1, 0.1, 50);
    this.camera.position.set(0, s.cameraHeight, s.distance);
    this.camera.lookAt(0, s.lookAt, 0);
    this.material = new MeshStandardMaterial({
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
    this.scene.add(new HemisphereLight('#fff8ee', '#a7a08a', 1.5), sun, floor, blob, this.pivot);
    // Vignettes: lumière fixe à trois lampes, sans ombre (interface, section 8).
    const key = new DirectionalLight('#ffffff', 2.2);
    key.position.set(2, 3, 4);
    const rim = new DirectionalLight('#fff0e0', 0.8);
    rim.position.set(-3, 2, -2);
    this.thumbScene.add(new HemisphereLight('#ffffff', '#b9ad96', 1.6), key, rim);
  }

  private build(look: Look): Built {
    const lib = this.library;
    const resolved = resolveLook(look, lib.catalogue, lib.morphologies);
    const geometry = assemble(resolved, lib);
    const { root, skeletonOf } = createRig(lib, resolved.shape, look.height);
    const parent = skeletonOf.parent ?? root;
    const bind = (g: typeof geometry.body): SkinnedMesh => {
      const mesh = new SkinnedMesh(g, this.material);
      mesh.bind(skeletonOf.skeleton, skeletonOf.bindMatrix);
      mesh.frustumCulled = false;
      parent.add(mesh);
      return mesh;
    };
    bind(geometry.body);
    const head = geometry.head === null ? null : bind(geometry.head);
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
    this.pivot.rotation.y = this.shownYaw;
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
    this.renderer.render(this.scene, this.camera);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
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
    const mesh = new Mesh(geometry.whole, this.material);
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
    this.material.dispose();
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    this.blob.geometry.dispose();
    this.blob.material.dispose();
    this.thumbRenderer?.dispose();
    this.thumbRenderer?.forceContextLoss();
    this.renderer.dispose();
    if (this.ownsLibrary) this.library.dispose();
  }
}
