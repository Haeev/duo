/**
 * Rendu encré: les deux cartes d'ombre (ADR 0023). Celle du soleil est cadrée sur le cercle vu et
 * calée sur ses texels (le bord des ombres ne scintille pas quand la vue glisse). Celle de la
 * lampe est une seule petite carte en cône, pour la lampe la plus proche du joueur local: chaque
 * machine choisit la sienne, rien à synchroniser. Les deux sont lues en `sampler2DShadow` filtré
 * puis seuillées dans le nuanceur: un bord net, sans escalier.
 */
import {
  type Camera,
  DepthTexture,
  Frustum,
  LessEqualCompare,
  LinearFilter,
  type Material,
  Matrix4,
  type Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  type Scene,
  Sphere,
  UnsignedIntType,
  Vector3,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type { InkUniforms, Lamp } from './matiere';
import { INK_SETTINGS } from './reglages';

/** Calque de ce qui porte une ombre au soleil, et de ce qui en porte une à la lampe. */
export const SUN_LAYER = 1;
export const LAMP_LAYER = 2;

/**
 * `userData` d'un maillage qui porte l'ombre du soleil sans jamais être dessiné (coque d'une
 * pièce: plafond et murs pleins, le soleil n'entre que par les fenêtres).
 */
export const SHADOW_ONLY = 'inkShadowOnly';

const BIAS = new Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
const right = new Vector3();
const up = new Vector3();
const back = new Vector3();
const frustum = new Frustum();
const viewProjection = new Matrix4();
const reach = new Sphere();

/**
 * Ce que les passes peuvent s'épargner: un personnage hors du champ, un volume dont l'ombre ne
 * tombe nulle part dans le champ. La caméra de la vue, la direction vers le soleil (unitaire),
 * et si la carte d'ombre du soleil est dessinée à cette image.
 */
export interface ViewCull {
  camera: Camera;
  readonly toSun: Vector3;
  sun: boolean;
}

interface Caster {
  userData: { [SHADOW_ONLY]?: unknown };
  isMesh?: boolean;
  isInstancedMesh?: boolean;
  isSkinnedMesh?: boolean;
  castShadow: boolean;
  frustumCulled: boolean;
  boundingSphere?: Sphere | null;
  instanceColor?: unknown;
  geometry?: { morphAttributes?: { position?: unknown }; boundingSphere?: Sphere | null };
  material?: unknown;
  skeleton?: { bones: readonly Object3D[] };
}

interface Keyed {
  type?: string;
  side?: number;
  vertexColors?: boolean;
  defines?: Record<string, unknown>;
  fragmentShader?: string;
}

/**
 * Tri des maillages avant chaque image, en un seul parcours de la scène.
 *
 * 1. Calques d'ombre d'après `castShadow` (le moteur le règle déjà partout: tuiles proches,
 *    meubles, personnages). Le semis instancié ne porte pas d'ombre de lampe: elle ne se verrait
 *    pas, et la passe reste trois fois plus légère.
 * 2. Mise en route étalée: Three.js compile un programme à la première image où il sert, d'un
 *    bloc. À l'arrivée dans un lieu, sol, semis instancié, personnages et passes d'ombre en
 *    demandent une dizaine à la fois: l'image se figerait plusieurs secondes (et le jeu passerait
 *    pour bloqué en rendu logiciel). Chaque famille de maillages n'entre donc en scène qu'une par
 *    image, la passe principale puis sa passe d'ombre: une courte montée au lieu d'un gel.
 */
export class StageSort {
  private readonly main = new Set<string>();
  private readonly depth = new Set<string>();
  /**
   * Clé de famille de chaque maillage, gardée tant que son matériau et sa géométrie restent les
   * mêmes: sans cela, le tri fabriquait une chaîne (et un `JSON.stringify`) par maillage et par image.
   */
  private readonly keys = new WeakMap<
    object,
    { material: unknown; geometry: unknown; instanceColor: boolean; key: string; shape: string }
  >();
  private started = false;
  /** Des maillages attendent encore leur tour (mesure, tests). */
  pending = false;

  sort(root: Object3D, view: ViewCull | null = null): void {
    // La toute première image ne compile que la passe de contour.
    let admitted = !this.started;
    if (view !== null) {
      // Matrices à jour avant d'en tirer les sphères (un volume posé à cette image compris).
      root.updateMatrixWorld();
      viewProjection.multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewProjection);
    }
    this.started = true;
    let pending = false;
    root.traverseVisible((object) => {
      const mesh = object as Object3D & Caster;
      if (mesh.isMesh !== true) return;
      const instanced = mesh.isInstancedMesh === true;
      const colored = (mesh.instanceColor ?? null) !== null;
      let entry = this.keys.get(mesh);
      if (
        entry === undefined ||
        entry.material !== mesh.material ||
        entry.geometry !== mesh.geometry ||
        entry.instanceColor !== colored
      ) {
        const shape = `${instanced ? 'i' : ''}${colored ? 'c' : ''}${
          mesh.isSkinnedMesh === true ? 's' : ''
        }${mesh.geometry?.morphAttributes?.position !== undefined ? 'm' : ''}`;
        const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
          Keyed | undefined;
        entry = {
          material: mesh.material,
          geometry: mesh.geometry,
          instanceColor: colored,
          shape,
          key: `${material?.type ?? ''}:${String(material?.fragmentShader?.length ?? 0)}:${JSON.stringify(
            material?.defines ?? {},
          )}:${String(material?.side ?? 0)}:${material?.vertexColors === true ? 'v' : ''}:${shape}`,
        };
        this.keys.set(mesh, entry);
      }
      const { key, shape } = entry;
      let shown = this.main.has(key);
      if (!shown && !admitted) {
        this.main.add(key);
        admitted = true;
        shown = true;
      }
      const unseen = mesh.userData[SHADOW_ONLY] === true;
      // Un personnage se dessine toujours pour Three.js (ses bornes au repos sont fausses une fois
      // animé): on l'écarte ici quand il est hors du champ, d'après la place de son squelette.
      const offscreen = view !== null && mesh.isSkinnedMesh === true && !inView(mesh, view, false);
      if (shown && !unseen && !offscreen) object.layers.enable(0);
      else {
        object.layers.disable(0);
        if (!shown) pending = true;
      }
      let casts = shown && mesh.castShadow;
      if (casts && !this.depth.has(shape)) {
        if (admitted) {
          casts = false;
          pending = true;
        } else {
          this.depth.add(shape);
          admitted = true;
        }
      }
      if (casts) {
        if (view?.sun === true && !inView(mesh, view, true)) object.layers.disable(SUN_LAYER);
        else object.layers.enable(SUN_LAYER);
        if (instanced || unseen) object.layers.disable(LAMP_LAYER);
        else object.layers.enable(LAMP_LAYER);
      } else {
        object.layers.disable(SUN_LAYER);
        object.layers.disable(LAMP_LAYER);
      }
    });
    this.pending = pending;
  }
}

/**
 * Sphère englobante d'un maillage dans le monde (dans `reach`), ou faux si on ne la connaît pas.
 * Un personnage: une sphère prudente autour de la racine de son squelette (le bassin), qui
 * contient tout le corps debout, assis ou couché.
 */
function worldBounds(mesh: Object3D & Caster): boolean {
  if (mesh.isSkinnedMesh === true) {
    const pelvis = mesh.skeleton?.bones[0];
    if (pelvis === undefined) return false;
    reach.center.setFromMatrixPosition(pelvis.matrixWorld);
    reach.radius = INK_SETTINGS.sunShadow.characterRadius;
    return true;
  }
  if (!mesh.frustumCulled) return false;
  const own =
    mesh.isInstancedMesh === true
      ? (mesh.boundingSphere ?? null)
      : (mesh.geometry?.boundingSphere ?? null);
  if (own === null) return false;
  reach.copy(own).applyMatrix4(mesh.matrixWorld);
  return true;
}

/**
 * Ce maillage (`shadow` faux) ou son ombre (`shadow` vrai) peut-il paraître dans le champ ? Pour
 * l'ombre, la sphère englobante est étirée le long des rayons du soleil jusque sous le sol (le
 * fond de l'eau): tout ce qui reçoit une ombre visible est dans le volume vu par la caméra, et
 * l'ombre d'un point est sur le segment qui le relie au sol à l'opposé du soleil. Prudent: une
 * sphère autour du segment entier. Sans bornes connues: oui.
 */
function inView(mesh: Object3D & Caster, view: ViewCull, shadow: boolean): boolean {
  if (!worldBounds(mesh)) return true;
  if (shadow) {
    const s = INK_SETTINGS.sunShadow;
    const rise = Math.max(0, reach.center.y + reach.radius - s.cullFloor);
    const length = Math.min(s.maxRadius * 2, rise / Math.max(view.toSun.y, s.cullMinSine));
    reach.center.addScaledVector(view.toSun, -length / 2);
    reach.radius += length / 2;
  }
  return frustum.intersectsSphere(reach);
}

function renderDepth(
  renderer: WebGLRenderer,
  scene: Scene,
  depthMaterial: Material,
  target: WebGLRenderTarget,
  camera: OrthographicCamera | PerspectiveCamera,
): void {
  const previous = scene.overrideMaterial;
  const background = scene.background;
  scene.overrideMaterial = depthMaterial;
  scene.background = null;
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  scene.overrideMaterial = previous;
  scene.background = background;
}

function depthTarget(size: number): WebGLRenderTarget {
  const depth = new DepthTexture(size, size, UnsignedIntType);
  depth.compareFunction = LessEqualCompare;
  depth.minFilter = LinearFilter;
  depth.magFilter = LinearFilter;
  return new WebGLRenderTarget(size, size, { depthTexture: depth });
}

export class SunShadow {
  readonly target: WebGLRenderTarget;
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 1, 200);
  readonly size: number;
  private ready = false;

  constructor(private readonly settings: typeof INK_SETTINGS.sunShadow = INK_SETTINGS.sunShadow) {
    this.size = settings.size;
    this.target = depthTarget(this.size);
    this.camera.layers.set(SUN_LAYER);
  }

  /**
   * Ambiance sans ombre du soleil (`sunShadow` nul: dedans): la carte n'est pas dessinée, le
   * nuanceur ne la lit pas. Elle doit seulement exister (vidée une fois), WebGL le veut.
   */
  idle(renderer: WebGLRenderer, uniforms: InkUniforms): void {
    uniforms.uShadowMap.value = this.target.depthTexture;
    if (this.ready) return;
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.setRenderTarget(null);
    this.ready = true;
  }

  /** Cadre la carte sur un disque de rayon `radius` autour de `center`, calé sur ses texels. */
  update(
    renderer: WebGLRenderer,
    scene: Scene,
    depthMaterial: Material,
    uniforms: InkUniforms,
    center: Vector3,
    viewRadius: number,
  ): void {
    const s = this.settings;
    const radius = Math.min(s.maxRadius, viewRadius + s.margin);
    const camera = this.camera;
    camera.position.copy(center).addScaledVector(uniforms.uSunDir.value, s.distance);
    camera.up.set(0, 1, 0);
    camera.lookAt(center);
    camera.updateMatrixWorld();
    const texel = (radius * 2) / this.size;
    camera.matrixWorld.extractBasis(right, up, back);
    const alongRight = camera.position.dot(right);
    const alongUp = camera.position.dot(up);
    camera.position
      .addScaledVector(right, Math.round(alongRight / texel) * texel - alongRight)
      .addScaledVector(up, Math.round(alongUp / texel) * texel - alongUp);
    camera.left = -radius;
    camera.right = radius;
    camera.top = radius;
    camera.bottom = -radius;
    camera.near = s.near;
    camera.far = s.far;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    this.ready = true;
    renderDepth(renderer, scene, depthMaterial, this.target, camera);
    uniforms.uShadowMap.value = this.target.depthTexture;
    uniforms.uShadowTexel.value = 1 / this.size;
    uniforms.uShadowMatrix.value
      .copy(BIAS)
      .multiply(camera.projectionMatrix)
      .multiply(camera.matrixWorldInverse);
  }

  dispose(): void {
    this.target.depthTexture?.dispose();
    this.target.dispose();
  }
}

export class LampShadow {
  readonly target: WebGLRenderTarget;
  readonly camera: PerspectiveCamera;
  readonly size: number;
  private ready = false;

  constructor(private readonly settings: typeof INK_SETTINGS.lampShadow = INK_SETTINGS.lampShadow) {
    this.size = settings.size;
    this.target = depthTarget(this.size);
    this.camera = new PerspectiveCamera(settings.fovDeg, 1, settings.near, 12);
    this.camera.layers.set(LAMP_LAYER);
  }

  /** `index`: place de la lampe dans la liste des lampes de l'image; -1 éteint l'ombre locale. */
  update(
    renderer: WebGLRenderer,
    scene: Scene,
    depthMaterial: Material,
    uniforms: InkUniforms,
    lamp: Lamp | null,
    index: number,
  ): void {
    uniforms.uLampShadowMap.value = this.target.depthTexture;
    if (lamp === null || !lamp.shadow || index < 0) {
      uniforms.uLampCaster.value = -1;
      if (!this.ready) {
        // La carte doit exister même éteinte: le nuanceur la déclare, WebGL veut une texture de
        // profondeur valide derrière.
        renderer.setRenderTarget(this.target);
        renderer.clear();
        renderer.setRenderTarget(null);
        this.ready = true;
      }
      return;
    }
    this.ready = true;
    const camera = this.camera;
    // Le plan proche passe sous la lampe elle-même: sa cage ne fait pas d'ombre sur tout.
    camera.near = this.settings.near;
    camera.far = lamp.y + lamp.radius;
    camera.position.set(lamp.x, lamp.y, lamp.z);
    camera.up.set(0, 0, -1);
    camera.lookAt(lamp.x, lamp.y - 1, lamp.z);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    renderDepth(renderer, scene, depthMaterial, this.target, camera);
    uniforms.uLampCaster.value = index;
    uniforms.uLampShadowTexel.value = 1 / this.size;
    uniforms.uLampShadowMatrix.value
      .copy(BIAS)
      .multiply(camera.projectionMatrix)
      .multiply(camera.matrixWorldInverse);
  }

  dispose(): void {
    this.target.depthTexture?.dispose();
    this.target.dispose();
  }
}
