/**
 * Ce que l'ambiance ajoute au shader des surfaces (palette du décor, terrain,
 * personnages, eau), par `onBeforeCompile` sans nouveau programme:
 *
 * - ombres des nuages qui passent (bruit qui défile, projeté selon le soleil);
 * - sol mouillé sous la pluie: plus sombre, plus brillant, flaques sur la terre
 *   et les pavés (pas sur l'herbe ni les toits) qui reflètent le ciel;
 * - flaques de lumière chaude des lanternes et des fenêtres la nuit, sur le sol
 *   et sur les personnages qui passent dessous (lumières de sol bon marché:
 *   une atténuation et un Lambert, sans ombre, au plus `glow.slots` à la fois).
 *
 * Le patron s'ajoute à celui du dev rendu (trous de visibilité): on garde son
 * `onBeforeCompile` et sa clé de programme, on y ajoute les nôtres.
 */
import {
  Color,
  Vector2,
  Vector3,
  Vector4,
  type Material,
  type Texture,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';
import { PALETTE_CELLS, PALETTE_GRID, type PaletteCell } from './palette';
import { AMBIANCE_SETTINGS } from './reglages-ambiance';

/**
 * Cases du sol dont la teinte devient continue, dans l'ordre des couleurs de
 * `uGroundColors`: trois verts, puis pavés (clair, sombre) et chemins (clair, sombre).
 */
export const GROUND_CELLS = [
  'grass_dark',
  'grass',
  'grass_light',
  'cobble',
  'cobble_dark',
  'path',
  'path_dark',
] as const satisfies readonly PaletteCell[];

/** Nombre de lumières de sol que le shader sait lire (le plus grand des deux niveaux de détail). */
export const GLOW_SLOTS = AMBIANCE_SETTINGS.glow.slots;

/** Uniformes partagés par toutes les surfaces patchées (une seule mise à jour par image). */
export interface SurfaceUniforms {
  uAmbTime: { value: number };
  uAmbNoise: { value: Texture | null };
  uCloudCover: { value: number };
  uCloudScale: { value: number };
  uCloudWind: { value: Vector2 };
  uCloudShadow: { value: number };
  uCloudSoft: { value: number };
  uLightDir: { value: Vector3 };
  uWet: { value: number };
  uWetParams: { value: Vector4 };
  uWetSheen: { value: number };
  uPuddleParams: { value: Vector4 };
  uReflection: { value: Color };
  uGlow: { value: number };
  uLamps: { value: Vector4[] };
  uLampColors: { value: Color[] };
  uLampCount: { value: number };
  /** Vent: carte des cases qui bougent, direction, force (0: arrêté), réglages. */
  uWindMask: { value: Texture | null };
  uWindDir: { value: Vector2 };
  uWindStrength: { value: number };
  uWindParams: { value: Vector4 };
  uWindCloth: { value: Vector3 };
  /** Sol continu: couleurs (linéaires) des verts, des pavés et des chemins, et réglages. */
  uGroundColors: { value: Color[] };
  uGroundParams: { value: Vector4 };
}

export function createSurfaceUniforms(noise: Texture, windMask: Texture): SurfaceUniforms {
  const s = AMBIANCE_SETTINGS.surfaces;
  const w = AMBIANCE_SETTINGS.wind;
  return {
    uAmbTime: { value: 0 },
    uAmbNoise: { value: noise },
    uCloudCover: { value: 0 },
    uCloudScale: { value: 1 / s.cloudSize },
    uCloudWind: { value: new Vector2(s.cloudWind[0] / s.cloudSize, s.cloudWind[1] / s.cloudSize) },
    uCloudShadow: { value: s.cloudShadow },
    uCloudSoft: { value: s.cloudSoftness },
    uLightDir: { value: new Vector3(0, 1, 0) },
    uWet: { value: 0 },
    uWetParams: { value: new Vector4(s.wetDarken, s.wetRoughness, s.wetWalls, s.puddleReflection) },
    uWetSheen: { value: s.wetSheen },
    uPuddleParams: {
      value: new Vector4(1 / s.puddleSize, s.puddleThreshold, s.puddleDarken, s.puddleMaxHeight),
    },
    uReflection: { value: new Color() },
    uGlow: { value: 0 },
    uLamps: { value: Array.from({ length: GLOW_SLOTS }, () => new Vector4()) },
    uLampColors: { value: Array.from({ length: GLOW_SLOTS }, () => new Color()) },
    uLampCount: { value: 0 },
    uWindMask: { value: windMask },
    uWindDir: {
      value: new Vector2(w.direction[0], w.direction[1]).normalize(),
    },
    uWindStrength: { value: 0 },
    uWindParams: { value: new Vector4(w.swaySpeed, w.gustSpeed, 1 / w.gustSize, w.phaseScale) },
    uWindCloth: { value: new Vector3(w.cloth, w.clothSpeed, w.maxHeight) },
    uGroundColors: { value: GROUND_CELLS.map(() => new Color()) },
    uGroundParams: {
      value: new Vector4(1 / s.groundPatch, s.groundDetail, s.stoneVariation, s.groundMaxHeight),
    },
  };
}

/** Déclarations communes (vertex): position dans le monde, vent. */
const VERTEX_PARS = /* glsl */ `
varying vec3 vAmbWorld;
varying float vAmbNormalY;
#ifdef AMB_WIND
uniform float uAmbTime;
uniform sampler2D uWindMask;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform vec4 uWindParams; // balancement (rad/s), rafales (rad/s), 1 / taille des rafales, déphasage par mètre
uniform vec3 uWindCloth;  // frisson des tissus (m), sa vitesse (rad/s), hauteur plafond (m)
#endif
`;

/**
 * Après `begin_vertex`: le vent pousse les sommets du feuillage et des herbes
 * (case de palette lue par l'UV) d'autant plus qu'ils sont haut au-dessus du
 * pied de l'objet (origine de l'instance; sol pour le décor fusionné), et fait
 * frissonner les tissus. Le déplacement est calculé dans le monde puis ramené
 * dans le repère de l'objet.
 */
const VERTEX_WIND = /* glsl */ `
#ifdef AMB_WIND
if (uWindStrength > 0.0) {
  float windKind = texelFetch(uWindMask, ivec2(clamp(floor(uv * 16.0), 0.0, 15.0)), 0).r;
  if (windKind > 0.0) {
    mat4 windModel = modelMatrix;
    #ifdef USE_INSTANCING
    windModel = modelMatrix * instanceMatrix;
    #endif
    vec3 windWorld = (windModel * vec4(transformed, 1.0)).xyz;
    float windFoot = 0.0;
    #ifdef USE_INSTANCING
    windFoot = (windModel * vec4(0.0, 0.0, 0.0, 1.0)).y;
    #endif
    float windPhase = dot(windWorld.xz, vec2(uWindParams.w, uWindParams.w * 0.77));
    float gust = 0.55 + 0.45 * sin(uAmbTime * uWindParams.y + dot(windWorld.xz, uWindDir) * uWindParams.z * 6.2831853);
    vec3 windPush = vec3(0.0);
    if (windKind > 0.75) {
      float sway = sin(uAmbTime * uWindParams.x + windPhase) + 0.35 * sin(uAmbTime * uWindParams.x * 2.3 + windPhase * 1.7);
      float height = clamp(windWorld.y - windFoot, 0.0, uWindCloth.z);
      // Les petites plantes (herbes, fleurs, buissons bas) plient plus que les arbres.
      float bend = 1.0 + ${AMBIANCE_SETTINGS.wind.smallPlants.toFixed(2)} * (1.0 - smoothstep(0.4, 1.6, height));
      vec2 push = uWindDir * (0.6 + 0.4 * sway) * gust * height * bend * uWindStrength;
      windPush = vec3(push.x, 0.0, push.y);
    } else {
      float flutter = sin(uAmbTime * uWindCloth.y + windWorld.x * 3.1 + windWorld.z * 2.3);
      windPush = vec3(0.0, flutter * uWindCloth.x * gust * uWindStrength / ${AMBIANCE_SETTINGS.wind.strength.toFixed(4)}, 0.0);
    }
    transformed += inverse(mat3(windModel)) * windPush;
  }
}
#endif
`;

/** Après `project_vertex`: `transformed` porte déjà peau, formes et instance. */
const VERTEX_MAIN = /* glsl */ `
vec4 ambWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
ambWorld = instanceMatrix * ambWorld;
#endif
vAmbWorld = (modelMatrix * ambWorld).xyz;
vec3 ambNormalLocal = objectNormal;
#ifdef USE_INSTANCING
ambNormalLocal = mat3(instanceMatrix) * ambNormalLocal;
#endif
vAmbNormalY = normalize(mat3(modelMatrix) * ambNormalLocal).y;
`;

/** Déclarations communes (fragment). */
export const SURFACE_FRAGMENT_PARS = /* glsl */ `
varying vec3 vAmbWorld;
varying float vAmbNormalY;
uniform vec3 uGroundColors[${GROUND_CELLS.length}];
uniform vec4 uGroundParams; // 1 / taille des taches, part du bruit fin, variation des pavés, hauteur max du sol
uniform float uAmbTime;
uniform sampler2D uAmbNoise;
uniform float uCloudCover;
uniform float uCloudScale;
uniform vec2 uCloudWind;
uniform float uCloudShadow;
uniform float uCloudSoft;
uniform vec3 uLightDir;
uniform float uWet;
uniform vec4 uWetParams;   // assombrissement, rugosité, part des murs, reflet des flaques
uniform float uWetSheen;
uniform vec4 uPuddleParams;
uniform vec3 uReflection;
uniform float uGlow;
uniform vec4 uLamps[${GLOW_SLOTS}];
uniform vec3 uLampColors[${GLOW_SLOTS}];
uniform int uLampCount;

/** Ombre des nuages au point du monde p (1: plein soleil). */
float ambCloudLight(vec3 p) {
  if (uCloudCover <= 0.0) return 1.0;
  // Le nuage qui fait de l'ombre ici est dans la direction du soleil.
  vec2 q = p.xz - uLightDir.xz / max(uLightDir.y, 0.2) * p.y;
  vec2 uv = q * uCloudScale - uCloudWind * uAmbTime;
  float n = texture(uAmbNoise, uv).r * 0.7 + texture(uAmbNoise, uv * 2.3 + 0.37).r * 0.3;
  float edge = 1.0 - uCloudCover;
  float shade = smoothstep(edge - uCloudSoft, edge + uCloudSoft, n);
  return 1.0 - uCloudShadow * shade;
}

/** Lumières de sol (lanternes, fenêtres): éclairement diffus au point p de normale n (monde). */
vec3 ambGlowLight(vec3 p, vec3 n) {
  vec3 sum = vec3(0.0);
  if (uGlow <= 0.0) return sum;
  for (int i = 0; i < ${GLOW_SLOTS}; i++) {
    if (i >= uLampCount) break;
    vec4 lamp = uLamps[i];
    vec3 toLamp = lamp.xyz - p;
    float d2 = dot(toLamp, toLamp);
    if (d2 >= lamp.w * lamp.w) continue;
    float d = sqrt(d2);
    float fall = 1.0 - d / lamp.w;
    float facing = max(dot(n, toLamp / max(d, 0.001)), 0.0) * 0.7 + 0.3;
    sum += uLampColors[i] * (fall * fall * facing);
  }
  return sum * uGlow;
}
`;

const cellIndex = (cell: PaletteCell): number => PALETTE_CELLS.indexOf(cell);

/**
 * Après `color_fragment` (décor et terrain): l'herbe, les pavés et les chemins
 * du sol prennent une teinte continue en coordonnées du monde. Chaque face
 * garde sa couleur unie à l'échelle d'un mètre près (style en aplats), mais
 * les grandes cases d'un mètre à bords francs disparaissent.
 */
const FRAGMENT_GROUND = /* glsl */ `
#if defined(AMB_GROUND) && defined(USE_MAP)
{
  ivec2 groundCell = ivec2(clamp(floor(vMapUv * ${PALETTE_GRID}.0), 0.0, ${PALETTE_GRID - 1}.0));
  int groundIndex = groundCell.y * ${PALETTE_GRID} + groundCell.x;
  bool groundFace = vAmbWorld.y < uGroundParams.w && abs(vAmbNormalY) > 0.9;
  if (groundFace) {
    vec2 groundUv = vAmbWorld.xz * uGroundParams.x;
    float patchNoise = texture(uAmbNoise, groundUv).r * (1.0 - uGroundParams.y)
      + texture(uAmbNoise, groundUv * 3.7 + 0.21).r * uGroundParams.y;
    if (groundIndex == ${cellIndex('grass_dark')} || groundIndex == ${cellIndex('grass')} || groundIndex == ${cellIndex('grass_light')}) {
      float g = smoothstep(0.25, 0.75, patchNoise);
      vec3 lowGreen = mix(uGroundColors[0], uGroundColors[1], smoothstep(0.0, 0.5, g));
      diffuseColor.rgb = mix(lowGreen, uGroundColors[2], smoothstep(0.5, 1.0, g));
    } else if (groundIndex == ${cellIndex('cobble')} || groundIndex == ${cellIndex('cobble_dark')}) {
      diffuseColor.rgb = mix(uGroundColors[3], uGroundColors[4], patchNoise * uGroundParams.z);
    } else if (groundIndex == ${cellIndex('path')} || groundIndex == ${cellIndex('path_dark')}) {
      diffuseColor.rgb = mix(uGroundColors[5], uGroundColors[6], smoothstep(0.3, 0.8, patchNoise) * uGroundParams.z * 2.0);
    }
  }
}
#endif
`;

/** Après `normal_fragment_maps`: sol mouillé et flaques (couleur et rugosité, avant l'éclairage). */
const FRAGMENT_WET = /* glsl */ `
vec3 ambNormal = transformNormalByInverseViewMatrix(normal, viewMatrix);
float ambUp = smoothstep(0.55, 0.9, ambNormal.y);
float ambWet = uWet * mix(uWetParams.z, 1.0, ambUp);
float ambPuddle = 0.0;
#ifdef AMB_PUDDLES
if (uWet > 0.0) {
  float puddleNoise = texture(uAmbNoise, vAmbWorld.xz * uPuddleParams.x).r;
  // Terre, chemins et pavés (le rouge l'emporte sur le vert), pas l'herbe; seulement au sol.
  float bare = step(diffuseColor.g, diffuseColor.r * 1.04);
  float low = 1.0 - smoothstep(uPuddleParams.w * 0.5, uPuddleParams.w, vAmbWorld.y);
  ambPuddle = uWet * ambUp * low * bare * smoothstep(uPuddleParams.y, uPuddleParams.y + 0.05, puddleNoise);
}
#endif
diffuseColor.rgb *= mix(1.0, uWetParams.x, ambWet);
diffuseColor.rgb *= mix(1.0, uPuddleParams.z, ambPuddle);
roughnessFactor = mix(roughnessFactor, roughnessFactor * uWetParams.y, ambWet);
roughnessFactor = mix(roughnessFactor, 0.05, ambPuddle);
`;

/** Après `lights_fragment_end`: nuages, reflet du ciel dans les flaques, lumières de sol. */
const FRAGMENT_LIGHT = /* glsl */ `
float ambCloud = ambCloudLight(vAmbWorld);
reflectedLight.directDiffuse *= ambCloud;
reflectedLight.directSpecular *= ambCloud;
reflectedLight.indirectSpecular += uReflection * (ambPuddle * uWetParams.w + ambWet * uWetSheen);
reflectedLight.directDiffuse += ambGlowLight(vAmbWorld, ambNormal) * material.diffuseContribution;
`;

export interface SurfacePatchOptions {
  /** Flaques au sol (décor et terrain), pas sur les personnages. */
  puddles: boolean;
  /** Vent sur le feuillage, les herbes et les tissus (décor seulement). */
  wind: boolean;
  /** Teinte continue du sol (décor et terrain seulement). */
  ground: boolean;
  /** Suffixe de la clé de programme (un programme par variante). */
  key: string;
}

type CompileHook = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => void;

/**
 * Matériaux déjà patchés. Pas de drapeau dans `userData`: une copie
 * (`material.clone()`, matériau d'un joueur) l'hériterait sans le patron.
 */
const PATCHED = new WeakSet<Material>();

/** Vrai si le matériau porte déjà les ajouts de l'ambiance. */
export function isSurfacePatched(material: Material): boolean {
  return PATCHED.has(material);
}

/** Remplace un repère du shader; signale s'il manque (changement de version de Three.js). */
export function injectAfter(source: string, anchor: string, code: string, label: string): string {
  if (!source.includes(anchor)) {
    throw new Error(`Ambiance: repère « ${anchor} » absent du shader (${label}).`);
  }
  return source.replace(anchor, `${anchor}\n${code}`);
}

/** Ajoute nuages, sol mouillé et lumières de sol au shader d'un matériau standard (sans changer le nombre de programmes). */
export function patchSurface(
  material: Material,
  uniforms: SurfaceUniforms,
  options: SurfacePatchOptions,
): void {
  if (PATCHED.has(material)) {
    return;
  }
  PATCHED.add(material);
  const previous: CompileHook = material.onBeforeCompile.bind(material);
  const previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer): void => {
    previous(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    const label = material.name || material.type;
    const windDefine = options.wind ? '#define AMB_WIND\n' : '';
    shader.vertexShader = injectAfter(
      shader.vertexShader,
      '#include <common>',
      windDefine + VERTEX_PARS,
      label,
    );
    shader.vertexShader = injectAfter(
      shader.vertexShader,
      '#include <begin_vertex>',
      VERTEX_WIND,
      label,
    );
    shader.vertexShader = injectAfter(
      shader.vertexShader,
      '#include <project_vertex>',
      VERTEX_MAIN,
      label,
    );
    const defines =
      (options.puddles ? '#define AMB_PUDDLES\n' : '') +
      (options.ground ? '#define AMB_GROUND\n' : '');
    shader.fragmentShader = injectAfter(
      shader.fragmentShader,
      '#include <common>',
      defines + SURFACE_FRAGMENT_PARS,
      label,
    );
    shader.fragmentShader = injectAfter(
      shader.fragmentShader,
      '#include <color_fragment>',
      FRAGMENT_GROUND,
      label,
    );
    shader.fragmentShader = injectAfter(
      shader.fragmentShader,
      '#include <normal_fragment_maps>',
      FRAGMENT_WET,
      label,
    );
    shader.fragmentShader = injectAfter(
      shader.fragmentShader,
      '#include <lights_fragment_end>',
      FRAGMENT_LIGHT,
      label,
    );
  };
  material.customProgramCacheKey = (): string => `${previousKey()}|amb_${options.key}`;
  material.needsUpdate = true;
}
