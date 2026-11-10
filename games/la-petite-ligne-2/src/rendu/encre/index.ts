/**
 * Rendu encré de production (ADR 0023): ce que le moteur branche. `InkKit` tient les textures de
 * traits, les uniformes communs, les matériaux partagés, les deux cartes d'ombre, les particules
 * de l'air et la passe de contour; `frame()` dessine une image entière (ambiance de l'heure,
 * ombres, scène dans la cible à deux sorties, contour vers le canevas). Un seul niveau de rendu:
 * rien ici ne dépend des options graphiques.
 */
import {
  Color,
  type DataArrayTexture,
  type DataTexture,
  type Material,
  type OrthographicCamera,
  type Scene,
  type ShaderMaterial,
  SRGBColorSpace,
  type Texture,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { keySpan, lightDirection } from '../lumiere';
import { RENDER_SETTINGS } from '../reglages';
import { type Ambiance, ambianceAt, type AmbianceBook, gameAmbiances } from './ambiances';
import { detailShare, InkPass } from './contour';
import { hex } from './couches';
import {
  applyAmbiance,
  createContactMaterial,
  createDepthMaterial,
  createFlatMaterial,
  createInkUniforms,
  InkMaterial,
  type InkMaterialOptions,
  type InkUniforms,
  type Lamp,
  MAX_LAMPS,
  MAX_WINDOWS,
  type WindowLight,
} from './matiere';
import { createMotes, type Motes } from './particules';
import { LampShadow, StageSort, SunShadow } from './ombres';
import { INK_SETTINGS } from './reglages';
import { createInkLayers, createNoise } from './textures';

export { inkifyModel, inkTag, inkUnit } from './conversion';
export { KIND, LAYER, SWAP } from './couches';
export { InkMaterial, isInkMaterial, type Lamp, type WindowLight } from './matiere';
export { INK_SETTINGS, type RenderStyle } from './reglages';

/** Lampes et fenêtres d'un lieu: le rendu encré garde à chaque image les plus proches du point visé. */
export interface InkLights {
  readonly lamps: readonly Lamp[];
  readonly windows: readonly WindowLight[];
}

export interface InkFrame {
  readonly dt: number;
  /** Minutes depuis minuit, identifiant d'ambiance du climat du lieu, météo du moment. */
  readonly minutes: number;
  readonly sheet: string | null;
  readonly weather: string | null;
  /** Le joueur local est dans une pièce. */
  readonly indoor: boolean;
  /**
   * Ambiance déclarée par le lieu (`ambience` de `lieu.json`): lieu clos, teinte de ses lampes
   * et du dehors (`#rrggbb`); `null`: rien de plus que la fiche du climat.
   */
  readonly place: {
    readonly indoor: boolean;
    readonly lamps: string;
    readonly outside: string;
  } | null;
  /** Point de sol visé (m, repère Three.js) et rayon du cercle vu. */
  readonly focusX: number;
  readonly focusZ: number;
  readonly viewRadius: number;
  /** Direction du sol vers la caméra. */
  readonly toCamera: { readonly x: number; readonly y: number; readonly z: number };
  readonly lights: InkLights | null;
  /** 1 hors fondu, 0 au noir (sommeil, montée dans le train). */
  readonly exposure: number;
  /** Taille du tampon de rendu (points). */
  readonly width: number;
  readonly height: number;
}

const NO_LIGHTS: InkLights = { lamps: [], windows: [] };
const MINUTES_PER_DAY = 1440;

/** Garde dans `out` les `max` éléments de `all` les plus proches de (x, z), du plus proche au plus loin. */
export function nearest<T extends { readonly x: number; readonly z: number }>(
  all: readonly T[],
  x: number,
  z: number,
  max: number,
  reach: number,
  out: T[],
): T[] {
  out.length = 0;
  const distances: number[] = [];
  for (const item of all) {
    const d = Math.hypot(item.x - x, item.z - z);
    if (d > reach) continue;
    let at = distances.length;
    while (at > 0 && (distances[at - 1] ?? 0) > d) at -= 1;
    if (at >= max) continue;
    distances.splice(at, 0, d);
    out.splice(at, 0, item);
    if (out.length > max) {
      out.length = max;
      distances.length = max;
    }
  }
  return out;
}

export class InkKit {
  readonly uniforms: InkUniforms;
  /** Matériau commun des volumes: sol, décor fusionné, formes provisoires, modèles livrés. */
  readonly volume: InkMaterial;
  /** Ombre de contact sous les personnages. */
  readonly contact: ShaderMaterial;
  private readonly depth: ShaderMaterial;
  private readonly layers: DataArrayTexture;
  private readonly noise: DataTexture;
  private readonly pass: InkPass;
  private readonly sun = new SunShadow();
  private readonly lamp = new LampShadow();
  private readonly motes: Motes;
  private readonly book: AmbianceBook;
  private readonly focus = new Vector3();
  private readonly dirA = new Vector3();
  private readonly dirB = new Vector3();
  private readonly clear = new Color();
  private readonly lamps: Lamp[] = [];
  private readonly windows: WindowLight[] = [];
  private readonly stages = new StageSort();
  private indoorShare = 0;
  private lastFrameAt = 0;
  private toSkip = 0;
  /** L'image précédente a été sautée: on dessine celle-ci avant de juger à nouveau. */
  private resting = false;
  private current: Ambiance | null = null;
  private nextPiece = 0;

  constructor(book: AmbianceBook = gameAmbiances()) {
    this.book = book;
    this.uniforms = createInkUniforms();
    this.layers = createInkLayers();
    this.noise = createNoise();
    this.uniforms.uLayers.value = this.layers;
    this.uniforms.uNoise.value = this.noise;
    this.volume = new InkMaterial(this.uniforms);
    this.volume.name = 'encre';
    this.contact = createContactMaterial(this.uniforms);
    this.depth = createDepthMaterial(this.uniforms);
    this.pass = new InkPass(4, 4, this.noise);
    this.motes = createMotes(this.uniforms, INK_SETTINGS.motes);
  }

  /** Un matériau encré de plus (même programme, état propre): eau teintée, vitres, coupe en fondu. */
  material(options: InkMaterialOptions = {}): InkMaterial {
    return new InkMaterial(this.uniforms, options);
  }

  /**
   * Matériaux d'un personnage: un numéro de pièce à lui, stable où qu'il marche (son contour ne
   * clignote pas), et la zone « peau lisse » pour sa tête (ton clair garanti, aucune arête).
   */
  characterMaterials(): { body: InkMaterial; head: InkMaterial } {
    // Classe de taille 1 (de 1 à 2,5 m): trait épais de silhouette, comme un meuble.
    const piece = 64 + 1 + (this.nextPiece++ % 62);
    return {
      body: new InkMaterial(this.uniforms, { variant: 'character', piece }),
      head: new InkMaterial(this.uniforms, { variant: 'character', piece, sleek: true }),
    };
  }

  /** Aplat sans lumière (liseré de la cible), poussé le long des normales. */
  flatMaterial(color: string, push: number, side: Material['side']): ShaderMaterial {
    return createFlatMaterial(color, push, side);
  }

  /** Carte du sol du lieu courant (`null`: sol de repli des lieux sans terrain). */
  setGround(map: Texture | null, width: number, height: number): void {
    this.uniforms.uGroundMap.value = map ?? this.noise;
    this.uniforms.uGroundRect.value.set(0, 0, map === null ? 0 : 1 / width, 1 / height);
  }

  /** Particules de l'air, à mettre dans la scène une fois. */
  get air(): Motes['mesh'] {
    return this.motes.mesh;
  }

  /** La mise en route étalée des programmes est finie: tout ce qui est en scène se dessine. */
  warm(): boolean {
    return !this.stages.pending;
  }

  /** Ambiance de la dernière image (mesure, tests). */
  ambiance(): Readonly<Ambiance> | null {
    return this.current;
  }

  /** Mémoire vidéo que le rendu encré ajoute, en octets (couches, bruit, ombres, cibles). */
  textureBytes(width: number, height: number): number {
    const image = this.layers.image as { width: number; height: number; depth: number };
    const layers = image.width * image.height * image.depth * 4 * (4 / 3);
    const s = INK_SETTINGS;
    const shadows = (s.sunShadow.size ** 2 + s.lampShadow.size ** 2) * 4;
    return Math.round(layers + 128 * 128 * 4 + shadows + width * height * 12);
  }

  private sunDirection(minutes: number, ambiance: Readonly<Ambiance>): void {
    const out = this.uniforms.uSunDir.value;
    if (ambiance.sun !== null) {
      lightDirection(ambiance.sun[0], ambiance.sun[1], out);
      return;
    }
    const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const { from, to, t } = keySpan(m, RENDER_SETTINGS.lightKeys);
    lightDirection(from.azimuthDeg, from.elevationDeg, this.dirA);
    lightDirection(to.azimuthDeg, to.elevationDeg, this.dirB);
    out.copy(this.dirA).lerp(this.dirB, t).normalize();
  }

  /** Une image entière, du calcul de l'ambiance au contour sur le canevas. */
  frame(renderer: WebGLRenderer, scene: Scene, camera: OrthographicCamera, frame: InkFrame): void {
    const u = this.uniforms;
    const s = INK_SETTINGS;
    const step = frame.dt / Math.max(0.01, s.indoorFadeSeconds);
    const closed = frame.indoor || frame.place?.indoor === true;
    this.indoorShare = closed
      ? Math.min(1, this.indoorShare + step)
      : Math.max(0, this.indoorShare - step);
    const ambiance = ambianceAt(this.book, {
      sheet: frame.sheet,
      minutes: frame.minutes,
      indoor: this.indoorShare,
      weather: frame.weather,
    });
    if (frame.place !== null) {
      // Le lieu donne la teinte de ses lampes et celle du dehors (vitres, vide autour).
      const lamps = hex(frame.place.lamps);
      const gain = s.placeLamps.gain;
      ambiance.lampColor = [lamps[0] * gain, lamps[1] * gain, lamps[2] * gain];
      ambiance.lamps = Math.max(ambiance.lamps, s.placeLamps.minimum);
      ambiance.background = hex(frame.place.outside);
    }
    this.current = ambiance;
    const lights = frame.lights ?? NO_LIGHTS;
    nearest(lights.lamps, frame.focusX, frame.focusZ, MAX_LAMPS, s.lights.reach, this.lamps);
    nearest(lights.windows, frame.focusX, frame.focusZ, MAX_WINDOWS, s.lights.reach, this.windows);
    applyAmbiance(u, ambiance, this.lamps, this.windows);
    this.sunDirection(frame.minutes, ambiance);
    u.uTime.value += frame.dt;
    // Rendu saturé: on laisse la main au reste du jeu (voir `INK_SETTINGS.breath`).
    const now = performance.now();
    const gap = now - this.lastFrameAt;
    const slow = gap > s.breath.slowMs;
    this.lastFrameAt = now;
    if (slow && this.toSkip === 0 && !this.resting)
      this.toSkip = Math.min(s.breath.maxSkip, Math.floor(gap / s.breath.slowMs));
    if (this.toSkip > 0) {
      this.toSkip -= 1;
      this.resting = true;
      return;
    }
    this.resting = false;
    u.uViewDir.value.set(frame.toCamera.x, frame.toCamera.y, frame.toCamera.z);
    u.uScreen.value.set(frame.width, frame.height);
    const pixelsPerMetre = frame.height / Math.max(1e-3, camera.top - camera.bottom);
    u.uDetail.value.set(
      detailShare(pixelsPerMetre, s.detail.painted),
      detailShare(pixelsPerMetre, s.detail.hatch),
      detailShare(pixelsPerMetre, s.detail.face),
    );
    this.motes.update(ambiance, frame.focusX, frame.focusZ);
    if (this.pass.target.width !== frame.width || this.pass.target.height !== frame.height)
      this.pass.setSize(frame.width, frame.height);
    this.pass.setAmbiance(ambiance);

    // Compteurs: le total de toutes les passes de l'image (ombres, scène, contour).
    renderer.info.autoReset = false;
    renderer.info.reset();
    const background = scene.background;
    scene.background = null;
    camera.updateMatrixWorld();
    this.stages.sort(scene);
    this.focus.set(frame.focusX, 0, frame.focusZ);
    this.sun.update(renderer, scene, this.depth, u, this.focus, frame.viewRadius);
    // Ombre locale: la plus proche des lampes retenues qui peut en porter une, lampes allumées.
    const caster = ambiance.lamps > 0 ? this.lamps.findIndex((lamp) => lamp.shadow) : -1;
    this.lamp.update(renderer, scene, this.depth, u, this.lamps[caster] ?? null, caster);

    renderer.setRenderTarget(this.pass.target);
    renderer.setClearColor(this.clear.setRGB(...ambiance.background, SRGBColorSpace), 1);
    renderer.clear();
    renderer.render(scene, camera);
    const o = s.outline;
    const zoom = Math.min(
      o.zoomRange[1],
      Math.max(o.zoomRange[0], o.zoomWidth / Math.max(1e-3, camera.right - camera.left)),
    );
    this.pass.render(renderer, camera, pixelsPerMetre, frame.exposure, zoom);
    scene.background = background;
  }

  dispose(): void {
    this.volume.dispose();
    this.contact.dispose();
    this.depth.dispose();
    this.motes.dispose();
    this.pass.dispose();
    this.sun.dispose();
    this.lamp.dispose();
    this.layers.dispose();
    this.noise.dispose();
  }
}
