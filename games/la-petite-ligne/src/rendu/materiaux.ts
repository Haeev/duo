/**
 * Matériaux partagés. Le décor, le terrain, les objets et les substituts
 * partagent un seul matériau (texture palette), ce qui garde peu de programmes
 * de shader (budget de 12) et permet de fusionner et d'instancier librement.
 */
import {
  Color,
  DataTexture,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  NoColorSpace,
  RGBAFormat,
  SRGBColorSpace,
  TextureLoader,
  Vector4,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { Season } from '../donnees/types';
import { paletteUv, type PaletteCell } from './palette';
import { RENDER_SETTINGS } from './reglages';
import { SEASON_RENDER_SETTINGS } from './reglages-saisons';
import type { ResourceTracker } from './ressources';

const TEXTURE_URLS = import.meta.glob<string>('../../assets/modeles/textures/*.png', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** Adresse d'une texture du dossier `assets/modeles/textures/`, ou `null` si elle manque. */
export function textureUrl(fileName: string): string | null {
  for (const [path, url] of Object.entries(TEXTURE_URLS)) {
    if (path.endsWith(`/${fileName}`)) {
      return url;
    }
  }
  return null;
}

/** Réglages communs des textures palette: cases nettes, pas de mipmaps (les UV visent le centre des cases). */
export function preparePaletteTexture(texture: Texture, color: boolean): Texture {
  texture.flipY = false;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = color ? SRGBColorSpace : NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function whiteTexture(): DataTexture {
  const texture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

function blackTexture(): DataTexture {
  const texture = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

async function loadTexture(
  loader: TextureLoader,
  fileName: string,
  fallback: () => Texture,
): Promise<Texture> {
  const url = textureUrl(fileName);
  if (url === null) {
    return fallback();
  }
  try {
    return await loader.loadAsync(url);
  } catch {
    return fallback();
  }
}

export interface SharedMaterials {
  /** Décor, terrain, objets, substituts: texture palette, rugosité et métal, lueur de nuit. */
  palette: MeshStandardMaterial;
  /**
   * Outils tenus en main (R08): la palette sans trou de visibilité. Un outil devant le corps de
   * son porteur était effacé comme un mur qui le cache (le manche et le fer de la hache pendant
   * le geste). Même code et même clé de programme que `palette`: aucun programme de plus.
   */
  held: MeshStandardMaterial;
  /** Fantômes (meuble en main, éléments à construire) et surbrillances: sans lumière, transparent. */
  ghost: MeshBasicMaterial;
  /** Eau animée de la rivière. */
  water: MeshStandardMaterial;
  /** Silhouette d'un joueur caché derrière un mur. */
  silhouette: MeshBasicMaterial;
  paletteTexture: Texture;
  /** Saison de la palette en vigueur. */
  readonly season: Season;
  /**
   * Palette de la saison (section 2.2): l'image de `paletteTexture` est remplacée, donc tout
   * matériau qui la lit (décor, terrain, fantômes, copies des personnages, effets) suit, sans
   * programme de plus. Vrai si la saison a changé.
   */
  setSeason(season: Season): boolean;
  /** Appelé après chaque changement de palette (couleurs lues une fois et gardées ailleurs). */
  onPaletteChange(listener: () => void): () => void;
  /** Temps des animations de shader (s). */
  setTime(seconds: number): void;
  /** Lueur des fenêtres et des lampes (0 le jour, 1 la nuit). */
  setNight(night: number): void;
  /** Couleur (linéaire) d'une case de la palette, lue dans la texture chargée. */
  paletteColor(cell: PaletteCell, out: Color): Color;
  /**
   * Trous de visibilité autour des personnages: ce qui cache vraiment leur
   * corps (plus près de la caméra que lui, au même endroit de l'écran)
   * s'efface dans une ellipse ajustée à leur silhouette, bord tramé régulier.
   */
  setSeeThrough(holes: readonly SeeThroughHole[]): void;
}

/**
 * Un trou de visibilité, en pixels du tampon: centre et demi-axes de
 * l'ellipse; profondeur du corps au centre, et sa variation par pixel vers le
 * haut de l'écran (la tête est plus près de la caméra que les pieds); sol du
 * personnage.
 */
export interface SeeThroughHole {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  depth: number;
  depthPerPixel: number;
  ground: number;
}

/**
 * Nombre de trous: les deux joueurs, le lieu d'un moment rare et l'habitant qu'il mène
 * (`RENDER_SETTINGS.momentSeeThrough`).
 */
export const SEE_THROUGH_SLOTS = 4;
/** Marge de profondeur: seul ce qui est nettement devant le corps du personnage s'efface. */
const SEE_THROUGH_DEPTH_MARGIN = 0.35;
/** Largeur relative du bord tramé de l'ellipse (le reste du trou est net). */
const SEE_THROUGH_EDGE = 0.8;
/** Ce qui est plus bas que cela au-dessus du sol du personnage ne s'efface jamais (le sol, les mottes). */
const SEE_THROUGH_MIN_HEIGHT = 0.45;

const BYTE = 255;
const RGBA = 4;

interface PalettePixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Lit les pixels de la texture palette (une fois, au chargement). */
function readPixels(
  texture: Texture,
): { data: Uint8ClampedArray; width: number; height: number } | null {
  const image = texture.image;
  if (!(
    image instanceof HTMLImageElement ||
    image instanceof ImageBitmap ||
    image instanceof HTMLCanvasElement
  )) {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (context === null) {
    return null;
  }
  context.drawImage(image, 0, 0);
  return {
    data: context.getImageData(0, 0, canvas.width, canvas.height).data,
    width: canvas.width,
    height: canvas.height,
  };
}

/** Charge les textures palette et crée les matériaux partagés. */
export async function createSharedMaterials(resources: ResourceTracker): Promise<SharedMaterials> {
  const loader = new TextureLoader();
  const looks = SEASON_RENDER_SETTINGS.seasons;
  const [base, roughMetal, emission, summer, autumn, winter] = await Promise.all([
    loadTexture(loader, looks.spring.palette, whiteTexture),
    loadTexture(loader, 'palette-mr.png', whiteTexture),
    loadTexture(loader, 'palette-emission.png', blackTexture),
    loadTexture(loader, looks.summer.palette, whiteTexture),
    loadTexture(loader, looks.autumn.palette, whiteTexture),
    loadTexture(loader, looks.winter.palette, whiteTexture),
  ]);
  resources.track(preparePaletteTexture(base, true));
  resources.track(preparePaletteTexture(roughMetal, false));
  resources.track(preparePaletteTexture(emission, true));

  const palette = resources.track(
    new MeshStandardMaterial({
      name: 'lpl_palette',
      map: base,
      // Rugosité dans le vert, métal dans le bleu: la convention de Three.js et de glTF.
      roughnessMap: roughMetal,
      metalnessMap: roughMetal,
      roughness: 1,
      metalness: 1,
      emissiveMap: emission,
      emissive: new Color(1, 1, 1),
      emissiveIntensity: 0,
    }),
  );

  const ghost = resources.track(
    new MeshBasicMaterial({
      name: 'lpl_ghost',
      map: base,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: DoubleSide,
    }),
  );

  const silhouette = resources.track(
    new MeshBasicMaterial({
      name: 'lpl_silhouette',
      transparent: true,
      opacity: RENDER_SETTINGS.characters.silhouetteOpacity,
      depthWrite: false,
    }),
  );

  const waterUniforms = { uTime: { value: 0 } };
  const terrain = RENDER_SETTINGS.terrain;
  const water = resources.track(
    new MeshStandardMaterial({
      name: 'lpl_water',
      color: new Color('#6caab9'),
      roughness: 0.18,
      metalness: 0,
      transparent: true,
      opacity: terrain.waterOpacity,
      depthWrite: false,
    }),
  );
  water.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms): void => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
varying vec2 vWaterXZ;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec4 waterWorld = modelMatrix * vec4(transformed, 1.0);
float waveK = 6.2831853 / ${terrain.waveLength.toFixed(3)};
float wave = sin(waterWorld.x * waveK + uTime * ${terrain.waveSpeed.toFixed(3)})
  + sin(waterWorld.z * waveK * 1.37 - uTime * ${(terrain.waveSpeed * 0.8).toFixed(3)});
transformed.y += wave * ${(terrain.waveAmplitude / 2).toFixed(4)};
vWaterXZ = waterWorld.xz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
varying vec2 vWaterXZ;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float ripple = sin(vWaterXZ.x * 1.7 + uTime * 0.9 + sin(vWaterXZ.y * 0.9 + uTime * 0.5) * 1.6)
  * sin(vWaterXZ.y * 2.3 - uTime * 0.7 + sin(vWaterXZ.x * 0.6) * 1.2);
float glint = smoothstep(0.78, 0.98, ripple);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.83, 0.93, 0.92), glint * 0.45);
diffuseColor.a = mix(diffuseColor.a, 1.0, glint * 0.5);`,
      );
  };
  water.customProgramCacheKey = (): string => 'lpl_water';

  // Images des quatre saisons (même disposition): seule l'image de `base` change, jamais l'objet.
  // Une texture de repli (fichier manquant) n'a pas d'image: la palette garde alors la sienne.
  const imageOf = (texture: Texture): unknown =>
    texture instanceof DataTexture || base instanceof DataTexture ? null : texture.image;
  const seasonImages: Record<Season, unknown> = {
    spring: imageOf(base),
    summer: imageOf(summer),
    autumn: imageOf(autumn),
    winter: imageOf(winter),
  };
  const seasonPixels: Record<Season, PalettePixels | null> = {
    spring: readPixels(base),
    summer: readPixels(summer),
    autumn: readPixels(autumn),
    winter: readPixels(winter),
  };
  // Les textures de saison ne servent qu'à charger leur image: jamais envoyées au GPU.
  for (const texture of [summer, autumn, winter]) resources.track(texture);
  let season: Season = 'spring';
  let pixels = seasonPixels.spring;
  const paletteListeners = new Set<() => void>();

  // Trous de visibilité: un personnage caché derrière un bâtiment ou un arbre reste visible.
  const cutUniforms = {
    uCutHoles: { value: Array.from({ length: SEE_THROUGH_SLOTS }, () => new Vector4(0, 0, 0, 0)) },
    uCutDepths: { value: Array.from({ length: SEE_THROUGH_SLOTS }, () => new Vector4(0, 0, 0, 0)) },
    uCutCount: { value: 0 },
  };
  palette.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms): void => {
    shader.uniforms.uCutHoles = cutUniforms.uCutHoles;
    shader.uniforms.uCutDepths = cutUniforms.uCutDepths;
    shader.uniforms.uCutCount = cutUniforms.uCutCount;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vCutY;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
vec4 cutWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
cutWorld = instanceMatrix * cutWorld;
#endif
vCutY = (modelMatrix * cutWorld).y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vCutY;
uniform vec4 uCutHoles[${SEE_THROUGH_SLOTS}];
uniform vec4 uCutDepths[${SEE_THROUGH_SLOTS}];
uniform int uCutCount;
// Trame ordonnée de Bayer 4x4 en coordonnées écran: un bord régulier, esprit imprimé.
float cutBayer(vec2 pixel) {
  int i = int(mod(pixel.x, 4.0)) + 4 * int(mod(pixel.y, 4.0));
  const float bayer[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (bayer[i] + 0.5) / 16.0;
}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
for (int i = 0; i < ${SEE_THROUGH_SLOTS}; i++) {
  if (i >= uCutCount) break;
  vec4 hole = uCutHoles[i];
  vec4 body = uCutDepths[i];
  vec2 offset = (gl_FragCoord.xy - hole.xy) / max(hole.zw, vec2(1.0));
  float reach = length(offset);
  // Profondeur du corps à cette hauteur de l'écran: on ne coupe que ce qui est devant lui.
  float bodyDepth = body.x - (gl_FragCoord.y - hole.y) * body.z;
  if (reach < 1.0 && vViewPosition.z < bodyDepth - ${SEE_THROUGH_DEPTH_MARGIN.toFixed(2)} && vCutY > body.y + ${SEE_THROUGH_MIN_HEIGHT.toFixed(2)}) {
    if (cutBayer(gl_FragCoord.xy) < smoothstep(1.0, ${SEE_THROUGH_EDGE.toFixed(2)}, reach)) discard;
  }
}`,
      );
  };
  palette.customProgramCacheKey = (): string => 'lpl_palette_cut';
  // Lu à la compilation: suit les ajouts faits plus tard au patron de la palette (ambiance).
  const held = resources.track(palette.clone());
  held.name = 'palette des outils tenus';
  held.onBeforeCompile = (shader, renderer): void => {
    palette.onBeforeCompile(shader, renderer);
    shader.uniforms.uCutCount = { value: 0 };
  };
  held.customProgramCacheKey = (): string => palette.customProgramCacheKey();

  return {
    palette,
    held,
    ghost,
    water,
    silhouette,
    paletteTexture: base,
    get season(): Season {
      return season;
    },
    setSeason(next: Season): boolean {
      if (next === season) return false;
      season = next;
      pixels = seasonPixels[next];
      const image = seasonImages[next];
      if (image !== null && image !== undefined) {
        base.image = image;
        base.needsUpdate = true;
      }
      for (const listener of paletteListeners) listener();
      return true;
    },
    onPaletteChange(listener: () => void): () => void {
      paletteListeners.add(listener);
      return () => paletteListeners.delete(listener);
    },
    setTime(seconds: number): void {
      waterUniforms.uTime.value = seconds;
    },
    setNight(night: number): void {
      palette.emissiveIntensity = night * RENDER_SETTINGS.nightGlow;
      held.emissiveIntensity = palette.emissiveIntensity;
    },
    setSeeThrough(holes: readonly SeeThroughHole[]): void {
      const count = Math.min(SEE_THROUGH_SLOTS, holes.length);
      for (let i = 0; i < count; i += 1) {
        const hole = holes[i];
        if (hole !== undefined) {
          cutUniforms.uCutHoles.value[i]?.set(hole.x, hole.y, hole.radiusX, hole.radiusY);
          cutUniforms.uCutDepths.value[i]?.set(hole.depth, hole.ground, hole.depthPerPixel, 0);
        }
      }
      cutUniforms.uCutCount.value = count;
    },
    paletteColor(cell: PaletteCell, out: Color): Color {
      if (pixels === null) {
        return out.setRGB(1, 1, 1);
      }
      const uv = paletteUv(cell);
      const x = Math.min(pixels.width - 1, Math.floor(uv.u * pixels.width));
      const y = Math.min(pixels.height - 1, Math.floor(uv.v * pixels.height));
      const offset = (y * pixels.width + x) * RGBA;
      return out.setRGB(
        (pixels.data[offset] ?? BYTE) / BYTE,
        (pixels.data[offset + 1] ?? BYTE) / BYTE,
        (pixels.data[offset + 2] ?? BYTE) / BYTE,
        SRGBColorSpace,
      );
    },
  };
}
