/**
 * Aperçu 3D d'une tenue (boutique de vêtements de la 0.12, contrat `garde-robe-0-12.md`, section 5):
 * une petite scène à part (fond uni, lumière douce, personnage seul) dans son propre canevas, rendue
 * à la demande. Le personnage est habillé comme dans le jeu (`habillage.ts`): un appel de dessin.
 *
 * Un second contexte WebGL plutôt qu'une lecture de pixels du rendu principal: couleurs et tons
 * identiques à la scène (sRGB, même tone mapping), sans attendre le processeur graphique; il ne vit
 * que le temps du panneau.
 */
import {
  AnimationMixer,
  CircleGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SkinnedMesh,
  SRGBColorSpace,
  WebGLRenderer,
  type Material,
  type Object3D,
  type ToneMapping,
} from 'three';
import type { ClothesContent } from '../donnees/vetements';
import type { OutfitPreview, OutfitPreviewLook, OutfitPreviewOptions } from '../etat/vue';
import { applyBoneRest, boneRestOf, idleClipOf } from './gabarit';
import { type DressedFigure, PlayerDresser, PlayerTexture, playerMeshNames } from './habillage';
import { CHARACTERS_FILE, type ModelLibrary } from './modeles';
import { ResourceTracker } from './ressources';

const RIG_NODE = 'rig';
const PLAYER_BODY = 'player_base';
/** Papier des panneaux de l'interface (`--lpl-color-paper`). */
const DEFAULT_BACKGROUND = '#f3ebd4';
const MAX_PIXEL_RATIO = 2;
/** Cadrage: tout le personnage (1,8 m) avec un peu d'air, vu d'un peu au-dessus de la taille. */
const CAMERA = { fov: 28, distance: 4.4, height: 1.15, target: 0.88 };
/** Légère vue de trois quarts au départ, plus vivante que de face. */
const START_ANGLE = -0.35;
/** Instant de l'attente où le personnage est posé (s). */
const POSE_TIME = 0.4;

export interface PreviewSources {
  library: ModelLibrary;
  clothes: ClothesContent;
  toneMapping: ToneMapping;
  exposure: number;
}

class OutfitPreviewScene implements OutfitPreview {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(CAMERA.fov, 1, 0.1, 20);
  private readonly resources = new ResourceTracker();
  private readonly dresser: PlayerDresser;
  private readonly root: Object3D;
  private readonly figure: DressedFigure;
  private readonly mixer: AnimationMixer;
  private pending = 0;
  private disposed = false;

  constructor(
    sources: PreviewSources,
    model: Object3D,
    texture: PlayerTexture,
    material: Material,
    options: OutfitPreviewOptions,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, stencil: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = sources.toneMapping;
    this.renderer.toneMappingExposure = sources.exposure;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute('data-testid', 'lpl-outfit-preview');
    this.scene.background = new Color(options.background ?? DEFAULT_BACKGROUND);
    // Lumière douce: ciel chaud, sol plus sombre, une clé de trois quarts sans ombre portée.
    this.scene.add(new HemisphereLight(0xfff4e0, 0x8a7a66, 1.6));
    const key = new DirectionalLight(0xfff1dc, 1.6);
    key.position.set(2, 4, 3);
    this.scene.add(key);
    const disc = new Mesh(
      this.resources.track(new CircleGeometry(0.55, 24)),
      this.resources.trackMaterial(new MeshBasicMaterial({ color: new Color(this.scene.background).multiplyScalar(0.86) })),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.002;
    this.scene.add(disc);
    this.dresser = new PlayerDresser(sources.clothes, this.resources);
    this.root = model;
    this.root.rotation.y = START_ANGLE;
    this.scene.add(this.root);
    this.resources.track(texture.texture);
    this.resources.trackMaterial(material);
    this.figure = this.dresser.prepare(model, texture);
    this.mixer = new AnimationMixer(model);
    // Gabarit du corps et pose de repos propre (`gabarit.ts`), comme en jeu.
    const extras = sources.library.extras(PLAYER_BODY);
    applyBoneRest(model, boneRestOf(extras));
    const clips = sources.library.animations(CHARACTERS_FILE);
    const idleName = idleClipOf(extras, new Set(clips.map((clip) => clip.name)));
    const idle = clips.find((clip) => clip.name === idleName);
    if (idle !== undefined) {
      this.mixer.clipAction(idle).play();
      this.mixer.setTime(POSE_TIME);
    }
    this.camera.position.set(0, CAMERA.height, CAMERA.distance);
    this.camera.lookAt(0, CAMERA.target, 0);
    this.resize(options.width, options.height);
  }

  show(look: OutfitPreviewLook): void {
    if (this.disposed) return;
    const before = this.figure.look;
    this.dresser.dress(this.figure, { id: look.character, appearance: look.appearance, asleep: false });
    if (this.figure.look !== before) this.request();
  }

  rotate(radians: number): void {
    this.setAngle(this.root.rotation.y + radians);
  }

  setAngle(radians: number): void {
    if (this.disposed || !Number.isFinite(radians)) return;
    this.root.rotation.y = radians;
    this.request();
  }

  resize(width: number, height: number): void {
    if (this.disposed) return;
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.request();
  }

  /** Une image au prochain rafraîchissement, quel que soit le nombre de changements d'ici là. */
  private request(): void {
    if (this.pending !== 0) return;
    this.pending = requestAnimationFrame(() => {
      this.pending = 0;
      if (this.disposed) return;
      this.renderer.render(this.scene, this.camera);
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.pending !== 0) cancelAnimationFrame(this.pending);
    this.mixer.stopAllAction();
    this.figure.merged?.dispose();
    // Les géométries du modèle restent celles du jeu: seules les copies de l'aperçu sont libérées.
    this.root.traverse((object) => {
      if (object instanceof SkinnedMesh) object.skeleton.dispose();
    });
    this.scene.clear();
    this.resources.dispose();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}

/** Crée l'aperçu, ou `null` sans modèle des personnages chargé. */
export function createOutfitPreview(sources: PreviewSources, options: OutfitPreviewOptions): OutfitPreview | null {
  const shared = sources.library.sharedCharacterMaterial();
  const model = sources.library.cloneRig(RIG_NODE, playerMeshNames(sources.clothes));
  if (shared?.map?.image === undefined || model === null) return null;
  const texture = new PlayerTexture(shared.map.image as CanvasImageSource & { width: number; height: number });
  const material = shared.clone();
  material.map = texture.texture;
  model.traverse((object) => {
    if (object instanceof SkinnedMesh) {
      object.material = material;
      // Le personnage reste dans le cadre quelle que soit sa pose: pas d'élimination hors champ.
      object.frustumCulled = false;
    }
  });
  return new OutfitPreviewScene(sources, model, texture, material, options);
}
