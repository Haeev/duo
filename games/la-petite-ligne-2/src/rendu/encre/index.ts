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
  type Texture,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { keySpan, lightDirection } from '../lumiere';
import { RENDER_SETTINGS } from '../reglages';
import { type Ambiance, ambianceAt, type AmbianceBook, gameAmbiances } from './ambiances';
import { COLOR_CHART, detailShare, InkPass } from './contour';
import { hex } from './couches';
import { InkScale, scaleFromAddress } from './echelle';
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
import type { RenderSnapshot } from './mesure';
import { InkMeter } from './panneau-mesure';
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
  /**
   * Fond uni imposé (`#rrggbb`): la pièce où est le joueur est un monde clos, rien autour.
   * Absent ou `null`: le fond de l'ambiance.
   */
  readonly backdrop?: string | null;
  /** Point de sol visé (m, repère Three.js) et rayon du cercle vu. */
  readonly focusX: number;
  readonly focusZ: number;
  readonly viewRadius: number;
  /** Direction du sol vers la caméra. */
  readonly toCamera: { readonly x: number; readonly y: number; readonly z: number };
  readonly lights: InkLights | null;
  /** 1 hors fondu, 0 au noir (sommeil, montée dans le train). */
  readonly exposure: number;
  /** Taille du tampon du canevas (points); la scène se calcule à l'échelle interne. */
  readonly width: number;
  readonly height: number;
}

const NO_LIGHTS: InkLights = { lamps: [], windows: [] };
const MINUTES_PER_DAY = 1440;
const BYTES_PER_MEGABYTE = 1024 * 1024;
/** Rendu logiciel (tests, banc): reconnu au nom du processeur graphique. */
const SOFTWARE = /swiftshader|llvmpipe|software|basic render/i;
const CHART_EXPECTED: readonly number[] = COLOR_CHART.flat();
/** Distances de `nearest`, réutilisées d'un appel à l'autre. */
const distances: number[] = [];

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
  distances.length = 0;
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
  /** Heure de la dernière image vraiment dessinée (les images sautées ne comptent pas). */
  private lastDrawnAt = 0;
  private toSkip = 0;
  /** L'image précédente a été sautée: on dessine celle-ci avant de juger à nouveau. */
  private resting = false;
  private current: Ambiance | null = null;
  private nextPiece = 0;
  /** Résolution interne adaptative et outil de mesure (ADR 0023, points 11 et 12). */
  private readonly scaler = new InkScale();
  private readonly meter = new InkMeter();
  private software: boolean | null = null;
  private renderer: WebGLRenderer | null = null;
  private canvasWidth = 1;
  private canvasHeight = 1;
  private innerWidth = 1;
  private innerHeight = 1;
  private lastMinutes = 0;
  private lastSheet: string | null = null;
  private lastIndoor = false;
  private chartWanted = false;
  private chartDone = false;
  private readonly chartRead = new Uint8Array(COLOR_CHART.length * 3);

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
    const asked =
      typeof window === 'undefined' ? undefined : scaleFromAddress(window.location.search);
    if (asked !== undefined) this.scaler.fix(asked === 'auto' ? null : asked);
  }

  /** Échelle interne en vigueur (1: pleine finesse) et son mode. */
  scale(): { readonly scale: number; readonly fixed: boolean } {
    return { scale: this.scaler.scale(), fixed: this.scaler.fixedScale() !== null };
  }

  /** Fige l'échelle interne (`null`: adaptative). */
  setScale(scale: number | null): void {
    this.scaler.fix(scale);
  }

  /** Le relevé de l'outil de mesure (`null` tant que son panneau n'a jamais été ouvert). */
  report(): string | null {
    return this.meter.report();
  }

  /** État du rendu à la dernière image, pour l'outil de mesure et le banc. */
  snapshot(): RenderSnapshot {
    const renderer = this.renderer;
    const canvas = renderer?.domElement;
    return {
      cssWidth: canvas?.clientWidth ?? 0,
      cssHeight: canvas?.clientHeight ?? 0,
      pixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
      innerWidth: this.innerWidth,
      innerHeight: this.innerHeight,
      scale: this.scaler.scale(),
      scaleMode: this.scaler.fixedScale() === null ? 'auto' : 'figée',
      scaleChanges: this.scaler.changeCount(),
      programs: renderer?.info.programs?.length ?? 0,
      textures: renderer?.info.memory.textures ?? 0,
      geometries: renderer?.info.memory.geometries ?? 0,
      textureMegabytes: this.textureBytes(this.canvasWidth, this.canvasHeight) / BYTES_PER_MEGABYTE,
      minutes: this.lastMinutes,
      sheet: this.lastSheet,
      indoor: this.lastIndoor,
      chart: this.chartDone ? { expected: CHART_EXPECTED, read: Array.from(this.chartRead) } : null,
    };
  }

  /** Bouton « Échelle » du panneau: adaptative, puis chaque palier figé, puis adaptative. */
  private cycleScale(): string {
    const steps = INK_SETTINGS.resolution.steps;
    const fixed = this.scaler.fixedScale();
    const at = fixed === null ? -1 : steps.indexOf(fixed);
    const next =
      fixed !== null && (at < 0 || at === steps.length - 1) ? null : (steps[at + 1] ?? 1);
    this.scaler.fix(next);
    return next === null ? 'adaptative' : `figée à ${String(Math.round(next * 100))} %`;
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

  /**
   * Mémoire vidéo que le rendu encré ajoute, en octets (couches, bruit, ombres, cibles), pour un
   * canevas de `width` x `height` à l'échelle interne en vigueur.
   */
  textureBytes(width: number, height: number): number {
    const image = this.layers.image as { width: number; height: number; depth: number };
    const layers = image.width * image.height * image.depth * 4 * (4 / 3);
    const s = INK_SETTINGS;
    const shadows = (s.sunShadow.size ** 2 + s.lampShadow.size ** 2) * 4;
    const scale = this.scaler.scale();
    // Deux sorties et la profondeur (12 octets par point), plus l'image finie avant sa mise à l'échelle.
    const inner = width * height * scale * scale * (this.pass.scaled ? 16 : 12);
    return Math.round(layers + 128 * 128 * 4 + shadows + inner);
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
    if (frame.backdrop !== undefined && frame.backdrop !== null)
      ambiance.background = hex(frame.backdrop);
    this.current = ambiance;
    const lights = frame.lights ?? NO_LIGHTS;
    nearest(lights.lamps, frame.focusX, frame.focusZ, MAX_LAMPS, s.lights.reach, this.lamps);
    nearest(lights.windows, frame.focusX, frame.focusZ, MAX_WINDOWS, s.lights.reach, this.windows);
    applyAmbiance(u, ambiance, this.lamps, this.windows);
    this.sunDirection(frame.minutes, ambiance);
    u.uTime.value += frame.dt;
    if (this.renderer !== renderer) {
      this.renderer = renderer;
      const gl = renderer.getContext();
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      this.software =
        info !== null && SOFTWARE.test(String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)));
      this.meter.attach(renderer, {
        snapshot: () => this.snapshot(),
        cycleScale: () => this.cycleScale(),
        requestChart: () => {
          this.chartWanted = true;
        },
        setScale: (scale) => {
          this.scaler.fix(scale);
          this.chartWanted = true;
        },
      });
    }
    this.lastMinutes = frame.minutes;
    this.lastSheet = frame.sheet;
    this.lastIndoor = closed;
    // Rendu saturé: on laisse la main au reste du jeu (voir `INK_SETTINGS.breath`).
    const now = performance.now();
    const gap = this.lastFrameAt === 0 ? 0 : now - this.lastFrameAt;
    const slow = gap > s.breath.slowMs;
    this.lastFrameAt = now;
    // Échelle interne: jugée sur l'écart entre deux images, jamais pendant la mise en route d'un
    // lieu; en rendu logiciel (tests, banc) elle ne bouge pas, les captures restent à pleine finesse.
    if (this.stages.pending) this.scaler.hold();
    if (this.software !== true || !s.resolution.softwareFixed) {
      if (this.scaler.sample(gap)) this.meter.log.noteScale(this.scaler.scale());
    }
    if (slow && this.toSkip === 0 && !this.resting)
      this.toSkip = Math.min(s.breath.maxSkip, Math.floor(gap / s.breath.slowMs));
    if (this.toSkip > 0) {
      this.toSkip -= 1;
      this.resting = true;
      return;
    }
    this.resting = false;
    u.uViewDir.value.set(frame.toCamera.x, frame.toCamera.y, frame.toCamera.z);
    const scale = this.scaler.scale();
    const innerWidth = scale >= 1 ? frame.width : Math.max(1, Math.round(frame.width * scale));
    const innerHeight = scale >= 1 ? frame.height : Math.max(1, Math.round(frame.height * scale));
    this.canvasWidth = frame.width;
    this.canvasHeight = frame.height;
    this.innerWidth = innerWidth;
    this.innerHeight = innerHeight;
    u.uScreen.value.set(innerWidth, innerHeight);
    // Les seuils de détail se comptent en points du canevas, pas de la cible interne: la
    // composition de l'image ne dépend pas de l'échelle interne, seule sa finesse varie.
    const reference = s.resolution.sameOnEveryScreen ? s.resolution.referenceWidth : frame.width;
    u.uPixel.value = innerWidth / reference;
    const pixelsPerMetre = reference / Math.max(1e-3, camera.right - camera.left);
    u.uDetail.value.set(
      detailShare(pixelsPerMetre, s.detail.painted),
      detailShare(pixelsPerMetre, s.detail.hatch),
      detailShare(pixelsPerMetre, s.detail.face),
    );
    this.motes.update(ambiance, frame.focusX, frame.focusZ);
    if (this.pass.target.width !== innerWidth || this.pass.target.height !== innerHeight)
      this.pass.setSize(innerWidth, innerHeight);
    if (this.chartWanted) {
      this.chartWanted = false;
      this.pass.probe(renderer, frame.width, frame.height, this.chartRead);
      this.chartDone = true;
    }
    this.pass.setAmbiance(ambiance);

    // Compteurs: le total de toutes les passes de l'image (ombres, scène, contour).
    const meter = this.meter;
    renderer.info.autoReset = false;
    renderer.info.reset();
    const background = scene.background;
    scene.background = null;
    camera.updateMatrixWorld();
    this.stages.sort(scene);
    this.focus.set(frame.focusX, 0, frame.focusZ);
    if (ambiance.sunShadow > 0) {
      meter.begin(0);
      this.sun.update(renderer, scene, this.depth, u, this.focus, frame.viewRadius);
      meter.end(0, this.sun.size * this.sun.size);
    } else {
      this.sun.idle(renderer, u);
      meter.skip(0);
    }
    // Ombre locale: la plus proche des lampes retenues qui peut en porter une, lampes allumées.
    let caster = -1;
    if (ambiance.lamps > 0)
      for (let i = 0; i < this.lamps.length && caster < 0; i += 1)
        if (this.lamps[i]?.shadow === true) caster = i;
    if (caster >= 0) meter.begin(1);
    this.lamp.update(renderer, scene, this.depth, u, this.lamps[caster] ?? null, caster);
    if (caster >= 0) meter.end(1, this.lamp.size * this.lamp.size);
    else meter.skip(1);

    meter.begin(2);
    renderer.setRenderTarget(this.pass.target);
    // La cible garde des valeurs d'écran (sRGB), comme tout ce que le matériau encré y écrit:
    // le fond s'y pose tel quel. Avec un espace de couleur, Three.js le convertirait en linéaire
    // pour une cible (le fond sortait bien plus sombre que la donnée).
    renderer.setClearColor(this.clear.setRGB(...ambiance.background), 1);
    renderer.clear();
    renderer.render(scene, camera);
    meter.end(2, innerWidth * innerHeight);
    const o = s.outline;
    const zoom = Math.min(
      o.zoomRange[1],
      Math.max(o.zoomRange[0], o.zoomWidth / Math.max(1e-3, camera.right - camera.left)),
    );
    meter.begin(3);
    this.pass.render(
      renderer,
      camera,
      pixelsPerMetre,
      frame.exposure,
      zoom,
      frame.width,
      frame.height,
    );
    // Contour à l'échelle interne, plus la mise à l'échelle vers le canevas quand il y en a une.
    meter.end(3, innerWidth * innerHeight + (scale >= 1 ? 0 : frame.width * frame.height));
    scene.background = background;
    meter.frame(this.lastDrawnAt === 0 ? 0 : now - this.lastDrawnAt, performance.now() - now, now);
    this.lastDrawnAt = now;
  }

  dispose(): void {
    this.volume.dispose();
    this.contact.dispose();
    this.depth.dispose();
    this.motes.dispose();
    this.pass.dispose();
    this.meter.dispose();
    this.sun.dispose();
    this.lamp.dispose();
    this.layers.dispose();
    this.noise.dispose();
  }
}
