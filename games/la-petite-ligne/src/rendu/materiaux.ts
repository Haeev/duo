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
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { paletteUv, type PaletteCell } from './palette';
import { RENDER_SETTINGS } from './reglages';
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

async function loadTexture(loader: TextureLoader, fileName: string, fallback: () => Texture): Promise<Texture> {
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
  /** Fantômes (meuble en main, éléments à construire) et surbrillances: sans lumière, transparent. */
  ghost: MeshBasicMaterial;
  /** Eau animée de la rivière. */
  water: MeshStandardMaterial;
  /** Silhouette d'un joueur caché derrière un mur. */
  silhouette: MeshBasicMaterial;
  paletteTexture: Texture;
  /** Temps des animations de shader (s). */
  setTime(seconds: number): void;
  /** Lueur des fenêtres et des lampes (0 le jour, 1 la nuit). */
  setNight(night: number): void;
  /** Couleur (linéaire) d'une case de la palette, lue dans la texture chargée. */
  paletteColor(cell: PaletteCell, out: Color): Color;
}

const BYTE = 255;
const RGBA = 4;

/** Lit les pixels de la texture palette (une fois, au chargement). */
function readPixels(texture: Texture): { data: Uint8ClampedArray; width: number; height: number } | null {
  const image = texture.image as unknown;
  if (!(image instanceof HTMLImageElement || image instanceof ImageBitmap || image instanceof HTMLCanvasElement)) {
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
  return { data: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
}

/** Charge les textures palette et crée les matériaux partagés. */
export async function createSharedMaterials(resources: ResourceTracker): Promise<SharedMaterials> {
  const loader = new TextureLoader();
  const [base, roughMetal, emission] = await Promise.all([
    loadTexture(loader, 'palette.png', whiteTexture),
    loadTexture(loader, 'palette-mr.png', whiteTexture),
    loadTexture(loader, 'palette-emission.png', blackTexture),
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

  const pixels = readPixels(base);

  return {
    palette,
    ghost,
    water,
    silhouette,
    paletteTexture: base,
    setTime(seconds: number): void {
      waterUniforms.uTime.value = seconds;
    },
    setNight(night: number): void {
      palette.emissiveIntensity = night * RENDER_SETTINGS.nightGlow;
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
