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
  ShaderChunk,
  Vector2,
  Vector3,
  Vector4,
  type Material,
  type Texture,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';
import { CHARACTER_SLOTS, PALETTE_CELLS, PALETTE_CELL_PIXELS, PALETTE_GRID, characterSlotColumn, type PaletteCell } from './palette';
import { RENDER_SETTINGS } from './reglages';
import { AMBIANCE_SETTINGS } from './reglages-ambiance';
import { RIVER_BED_MIN, RIVER_BED_RANGE, RIVER_SAND_RANGE } from './riviere';
import { SHELTER_SLOTS } from './abri';

/**
 * Cases du sol dont la teinte devient continue, dans l'ordre des couleurs de
 * `uGroundColors`: trois verts, pavés (clair, sombre), chemins (clair,
 * sombre), puis le lit de la rivière: sable, berge (fond), galets (trois tons).
 */
export const GROUND_CELLS = [
  'grass_dark',
  'grass',
  'grass_light',
  'cobble',
  'cobble_dark',
  'path',
  'path_dark',
  'sand',
  'bank',
  'rock',
  'rock_light',
  'rock_dark',
] as const satisfies readonly PaletteCell[];

/** Texture des personnages: 16 cases par rangée; ses rangées (`CHAR_GRID_H` de `palette.py`) se lisent sur sa taille. */
const CHARACTER_SLOT_COUNT = CHARACTER_SLOTS.length;
/** Rangée des vêtements dans la copie de la texture de chaque joueur (`habillage.ts`). */
const PLAYER_WEAR_ROW = 1;
const MOUTH_COLUMN = characterSlotColumn('mouth');
const CHEEK_COLUMN = characterSlotColumn('cheek');

/** Coefficients de luminance (Rec. 709, linéaire). */
const LUMA = [0.2126, 0.7152, 0.0722] as const;

/** Bandes pavées de la place que le shader sait lire (au moins une, pour la taille des tableaux). */
export const PAVE_BANDS = Math.max(
  1,
  RENDER_SETTINGS.terrain.square.paved.filter((shape) => shape.kind === 'band').length,
);

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
  /** Abri du joueur local (`abri.ts`): sol sec sous le toit; x, z minimaux puis maximaux. */
  uShelters: { value: Vector4[] };
  uShelterCount: { value: number };
  /** Hauteur (m, monde) sous laquelle l'abri est sec: le plafond de la pièce. */
  uShelterTop: { value: number };
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
  /**
   * Lit de la rivière (`riviere.ts`, tour 8): texture (R: hauteur du lit et des
   * pierres, G: courant vif, B: distance signée au sable), son rectangle, et
   * surface de l'eau, minimum et étendue des hauteurs codées, étendue du sable (m).
   */
  uRiverField: { value: Texture | null };
  uRiverRect: { value: Vector4 };
  uRiverParams: { value: Vector4 };
  /**
   * Pavés de la place (tour 8): pas d'un rang, longueur d'un pavé, largeur des
   * joints (m), écart de teinte entre pavés; anneau du puits: centre (x, z), rayon (m), présent (1).
   * Où sont les pavés: canaux B (cases de pavés) et A (pavées ou terre battue) de `uLookField`.
   */
  uPaving: { value: Vector4 };
  uPavingRing: { value: Vector4 };
  /**
   * Bord des zones pavées de la place (revue du tour 8), calculé dans le shader:
   * bandes pavées (a, b en x, z) et leur demi-largeur, rectangle de la place
   * (x0, z0, x1, z1), puis largeur du rang de boutisses, largeur d'une
   * boutisse, rayon des raccords (m), présent (1); joint du rang (m), part
   * vers le ton sombre, facteur de teinte; ondulation de la limite sud de la
   * terre battue: amplitude, 1 / longueur d'onde, fondu aux bouts (m).
   */
  uPaveBands: { value: Vector4[] };
  uPaveHalf: { value: number[] };
  uPaveArea: { value: Vector4 };
  uPaveEdge: { value: Vector4 };
  uPaveBorderLook: { value: Vector3 };
  uPaveEarthEdge: { value: Vector3 };
  /** Passe « maquette » (tour 8, réglages `look`): occlusion cuite, ombres teintées, bord, étalonnage. */
  uLookField: { value: Texture | null };
  uLookRect: { value: Vector4 };
  /** Hauteur codée dans la carte d'occlusion: minimum et étendue (m). */
  uLookHeight: { value: Vector2 };
  /** Occlusion: force au sol (0: coupée), part sur la lumière directe, hauteur et force du pied des murs. */
  uLookOcc: { value: Vector4 };
  uLookOccTint: { value: Color };
  /** Soleil (couleur fois intensité, linéaire): ce que reçoit une face en plein soleil. */
  uSunRadiance: { value: Color };
  uShadeTint: { value: Color };
  /** Ombres teintées: part (0: coupées), éclaircissement. */
  uShadeParams: { value: Vector2 };
  /** Bord des personnages: force (0: coupé), exposant, part du côté opposé au soleil. */
  uRim: { value: Vector3 };
  uRimColor: { value: Color };
  /**
   * Style `lisse` des personnages (`characters.smooth`): rampe de la lumière directe (seuil
   * ombre, seuil lumière, demi-teinte, douceur), teinte chaude des ombres de la peau, parts de la
   * teinte sur la peau et les tissus, liseré (largeur, douceur, force).
   */
  uRamp: { value: Vector4 };
  uRampSkinTint: { value: Color };
  uRampShade: { value: Vector2 };
  uRampRim: { value: Vector3 };
  /** Étalonnage: saturation, contraste, relevé des noirs, allumé (1) ou non (0). */
  uGrade: { value: Vector4 };
  uGradeBalance: { value: Vector3 };
  /** Vignettage: force, début, 1 / largeur et 1 / hauteur du tampon (pixels). */
  uVignette: { value: Vector4 };
  uVignetteColor: { value: Color };
}

/** Une teinte ramenée à une clarté de 1 (elle change la couleur, pas la lumière). */
export function unitLuminance(color: Color): Color {
  const luma = color.r * LUMA[0] + color.g * LUMA[1] + color.b * LUMA[2];
  return luma > 0 ? color.multiplyScalar(1 / luma) : color.setRGB(1, 1, 1);
}

export function createSurfaceUniforms(noise: Texture, windMask: Texture): SurfaceUniforms {
  const s = AMBIANCE_SETTINGS.surfaces;
  const w = AMBIANCE_SETTINGS.wind;
  const look = AMBIANCE_SETTINGS.look;
  const square = RENDER_SETTINGS.terrain.square;
  const smooth = RENDER_SETTINGS.characters.smooth;
  const ramp = smooth.ramp;
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
    uShelters: { value: Array.from({ length: SHELTER_SLOTS }, () => new Vector4()) },
    uShelterCount: { value: 0 },
    uShelterTop: { value: 0 },
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
    uRiverField: { value: null },
    uRiverRect: { value: new Vector4(0, 0, 0, 0) },
    uRiverParams: {
      value: new Vector4(
        RENDER_SETTINGS.terrain.waterSurface,
        RIVER_BED_MIN,
        RIVER_BED_RANGE,
        RIVER_SAND_RANGE,
      ),
    },
    uPaving: {
      value: new Vector4(
        RENDER_SETTINGS.terrain.square.rowPitch,
        RENDER_SETTINGS.terrain.square.stoneLength,
        s.pavingJoint,
        s.pavingTint,
      ),
    },
    uPavingRing: { value: new Vector4(0, 0, 0, 0) },
    uPaveBands: { value: Array.from({ length: PAVE_BANDS }, () => new Vector4()) },
    uPaveHalf: { value: Array.from({ length: PAVE_BANDS }, () => -1e3) },
    uPaveArea: { value: new Vector4(0, 0, 0, 0) },
    uPaveEdge: {
      value: new Vector4(square.border.width, square.border.stoneWidth, square.border.fillet, 0),
    },
    uPaveBorderLook: {
      value: new Vector3(s.pavingBorderJoint, s.pavingBorderDark, s.pavingBorderShade),
    },
    uPaveEarthEdge: {
      value: new Vector3(
        square.earthEdge.amplitude,
        1 / square.earthEdge.wavelength,
        square.earthEdge.fade,
      ),
    },
    uLookField: { value: null },
    uLookRect: { value: new Vector4(0, 0, 1, 1) },
    uLookHeight: { value: new Vector2(0, 1) },
    uLookOcc: { value: new Vector4(0, look.occlusionDirect, look.wallHeight, look.wallStrength) },
    uLookOccTint: { value: unitLuminance(new Color(look.occlusionTint)) },
    uSunRadiance: { value: new Color() },
    uShadeTint: { value: unitLuminance(new Color(look.shadeTint)) },
    uShadeParams: { value: new Vector2(0, look.shadeLift) },
    uRim: { value: new Vector3(0, look.rimPower, look.rimBackSide) },
    uRimColor: { value: new Color() },
    uRamp: { value: new Vector4(ramp.shadowEdge, ramp.lightEdge, ramp.halftone, ramp.softness) },
    uRampSkinTint: { value: unitLuminance(new Color(smooth.skinShadeTint)) },
    uRampShade: { value: new Vector2(smooth.skinShadeAmount, smooth.clothShadeAmount) },
    uRampRim: { value: new Vector3(smooth.rim.width, smooth.rim.softness, smooth.rim.strength) },
    uGrade: { value: new Vector4(look.saturation, look.contrast, look.lift, 0) },
    uGradeBalance: {
      value: new Vector3(look.gradeBalance[0], look.gradeBalance[1], look.gradeBalance[2]),
    },
    uVignette: { value: new Vector4(look.vignette, look.vignetteStart, 1, 1) },
    uVignetteColor: { value: new Color(look.vignetteColor) },
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
uniform vec4 uShelters[${SHELTER_SLOTS}];
uniform int uShelterCount;
uniform float uShelterTop;
uniform vec3 uReflection;
uniform float uGlow;
uniform vec4 uLamps[${GLOW_SLOTS}];
uniform vec3 uLampColors[${GLOW_SLOTS}];
uniform int uLampCount;
uniform sampler2D uLookField;
uniform vec4 uLookRect;
uniform vec2 uLookHeight;
uniform vec4 uLookOcc;     // force au sol, part directe, hauteur et force du pied des murs
uniform vec3 uLookOccTint;
uniform vec3 uSunRadiance;
uniform vec3 uShadeTint;
uniform vec2 uShadeParams; // part, éclaircissement
uniform vec3 uRim;         // force, exposant, part du côté opposé au soleil
uniform vec3 uRimColor;
#ifdef LPL_RAMP
uniform vec4 uRamp;        // seuil ombre, seuil lumière, demi-teinte, douceur (en N.L)
uniform vec3 uRampSkinTint;
uniform vec2 uRampShade;   // part de la teinte à l'ombre: peau, tissus
uniform vec3 uRampRim;     // largeur du liseré, douceur, force
// Rampe à trois tons de la lumière directe: ombre, demi-teinte, lumière (style lisse, D1).
float lplRamp(float nDotL) {
  return uRamp.z * smoothstep(uRamp.x - uRamp.w, uRamp.x + uRamp.w, nDotL)
    + (1.0 - uRamp.z) * smoothstep(uRamp.y - uRamp.w, uRamp.y + uRamp.w, nDotL);
}
#endif
uniform vec4 uGrade;       // saturation, contraste, relevé des noirs, allumé
uniform vec3 uGradeBalance;
uniform vec4 uVignette;    // force, début, 1 / largeur, 1 / hauteur
uniform vec3 uVignetteColor;
uniform sampler2D uRiverField;
uniform vec4 uRiverRect;
uniform vec4 uRiverParams; // surface de l'eau, hauteur min et étendue codées, étendue du sable
uniform vec4 uPaving;      // pas d'un rang, longueur d'un pavé, joint, écart de teinte
uniform vec4 uPavingRing;  // centre (x, z), rayon, présent
uniform vec4 uPaveBands[${PAVE_BANDS}];  // a (x, z), b (x, z)
uniform float uPaveHalf[${PAVE_BANDS}];
uniform vec4 uPaveArea;    // x0, z0, x1, z1 de la place
uniform vec4 uPaveEdge;    // largeur du rang de bordure, largeur d'une boutisse, rayon des raccords, présent
uniform vec3 uPaveBorderLook; // joint du rang, part vers le ton sombre, facteur
uniform vec3 uPaveEarthEdge;  // ondulation de la limite sud: amplitude, 1 / longueur d'onde, fondu aux bouts

float ambHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

/** Champ du lit de la rivière au point (R: lit, G: courant vif, B: sable); tout à zéro hors de lui. */
vec4 ambRiver(vec2 xz) {
  vec2 uv = (xz - uRiverRect.xy) * uRiverRect.zw;
  if (uRiverRect.z <= 0.0 || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
  return texture(uRiverField, uv);
}

/** Herbe continue: les trois verts mêlés par le bruit des taches. */
vec3 ambGreen(float patchNoise) {
  float g = smoothstep(0.25, 0.75, patchNoise);
  vec3 lowGreen = mix(uGroundColors[0], uGroundColors[1], smoothstep(0.0, 0.5, g));
  return mix(lowGreen, uGroundColors[2], smoothstep(0.5, 1.0, g));
}

/** Part de sable au point (bord qui ondule entre le sable des rives et l'herbe). */
float ambSand(vec4 river, vec2 xz, float pixel) {
  if (river.a <= 0.0) return 0.0;
  float side = (river.b - 0.5) * 2.0 * uRiverParams.w;
  float grain = texture(uAmbNoise, xz * 0.7 + 0.13).r - 0.5;
  float soft = max(0.03, pixel);
  return smoothstep(-soft, soft, side + grain * 0.06);
}

/**
 * Galets: au plus un par maille de \`size\` m, entier dans sa maille (un seul
 * tirage, pas de voisins à lire). Renvoie la part de galet (bord adouci) et sa teinte.
 */
float ambPebble(vec2 xz, float size, float density, float pixel, float seed, out vec3 tone) {
  vec2 q = xz / size;
  vec2 id = floor(q) + seed;
  vec2 f = fract(q);
  float h1 = ambHash(id);
  float h2 = ambHash(id + 17.3);
  float h3 = ambHash(id + 41.7);
  float radius = 0.26 + 0.17 * h2;
  vec2 centre = vec2(radius) + (1.0 - 2.0 * radius) * vec2(h1, h3);
  float r = length((f - centre) * vec2(1.0, 1.0 + 0.6 * h1)) / radius;
  float soft = max(0.08, pixel / (size * radius));
  float present = step(ambHash(id + 5.1), density);
  tone = h3 < 0.4 ? uGroundColors[9] : (h3 < 0.75 ? uGroundColors[10] : uGroundColors[11]);
  // Dessus bombé: le galet s'éclaire en son milieu.
  tone *= 1.06 - 0.16 * r * r;
  return present * (1.0 - smoothstep(1.0 - soft, 1.0, r));
}

/**
 * Lit de la rivière: sable sec, sable mouillé au ras de l'eau, galets sur la
 * ligne d'eau et sur le gué, fond brun-vert qui s'assombrit avec la profondeur.
 */
vec3 ambBed(vec3 p, vec4 river, float patchNoise, float pixel) {
  float above = p.y - uRiverParams.x;
  vec3 sand = mix(uGroundColors[7], mix(uGroundColors[7], uGroundColors[6], 0.35), patchNoise);
  float wet = 1.0 - smoothstep(0.0, 0.07, above);
  vec3 c = mix(sand, sand * vec3(0.8, 0.78, 0.74), wet);
  float under = smoothstep(0.0, 0.22, -above);
  c = mix(c, uGroundColors[8] * vec3(0.9, 0.95, 0.85), under);
  // Galets: serrés au ras de l'eau et sur le gué, épars plus haut sur la grève.
  float band = 1.0 - smoothstep(0.03, 0.14, abs(above + 0.02));
  float density = max(max(band * 0.6, river.g * 0.7 * under), 0.07 * (1.0 - smoothstep(0.0, 0.25, above)));
  vec3 tone;
  float pebble = ambPebble(p.xz, 0.17, density, pixel, 0.0, tone);
  vec3 small;
  float grit = ambPebble(p.xz, 0.09, density * 0.35, pixel, 7.0, small);
  float detail = 1.0 - smoothstep(0.03, 0.08, pixel);
  c = mix(c, mix(small, c, 0.55), grit * detail);
  c = mix(c, mix(mix(tone, c, 0.3), tone * 0.8, wet), pebble * detail);
  // De loin, les galets se fondent en une teinte de grève.
  c = mix(c, mix(c, uGroundColors[9], density * 0.35), 1.0 - detail);
  return c;
}

/**
 * Pavés de la place, en rangs décalés (ou en anneaux autour du puits). Renvoie
 * la teinte du pavé (joint compris), et dans \`centre\` le milieu du pavé dans
 * le monde (le shader y lit s'il est posé: le bord de la zone suit les joints).
 */
vec3 ambPaving(vec2 xz, float patchNoise, float pixel, out vec2 centre, out float stoneHash) {
  float pitch = uPaving.x;
  float len = uPaving.y;
  float along;
  float across;
  float alongLen;
  vec2 id;
  vec2 toRing = xz - uPavingRing.xy;
  float ringR = length(toRing);
  if (uPavingRing.w > 0.0 && ringR < uPavingRing.z) {
    // Anneaux autour du puits: chaque rang compte un nombre entier de pavés.
    float row = floor(ringR / pitch);
    float mid = (row + 0.5) * pitch;
    float count = max(6.0, floor(6.2831853 * mid / len + 0.5));
    float angle = atan(toRing.y, toRing.x) / 6.2831853 + 0.5;
    float offset = ambHash(vec2(row, 3.7));
    float s = angle * count + offset;
    float stone = floor(s);
    along = fract(s);
    across = fract(ringR / pitch);
    alongLen = 6.2831853 * ringR / count;
    id = vec2(stone, row + 101.0);
    float a = ((stone + 0.5 - offset) / count - 0.5) * 6.2831853;
    centre = uPavingRing.xy + vec2(cos(a), sin(a)) * mid;
  } else {
    // Rangs d'est en ouest, décalés d'un demi-pavé, longueur un peu différente d'un rang à l'autre.
    float row = floor(xz.y / pitch);
    float rowLen = len * (0.88 + 0.24 * ambHash(vec2(row, 9.1)));
    float s = xz.x / rowLen + 0.5 * mod(row, 2.0) + ambHash(vec2(row, 1.3)) * 0.2;
    float stone = floor(s);
    along = fract(s);
    across = fract(xz.y / pitch);
    alongLen = rowLen;
    id = vec2(stone, row);
    centre = vec2((stone + 0.5 - 0.5 * mod(row, 2.0) - ambHash(vec2(row, 1.3)) * 0.2) * rowLen, (row + 0.5) * pitch);
  }
  stoneHash = ambHash(id);
  float edge = min(min(along, 1.0 - along) * alongLen, min(across, 1.0 - across) * pitch);
  vec3 stoneColor = mix(uGroundColors[3], uGroundColors[4], stoneHash * uPaving.w + patchNoise * 0.08);
  // Dessus arrondi: le pavé fonce un peu vers ses bords.
  stoneColor *= mix(0.9, 1.0, smoothstep(0.0, 0.05, edge));
  vec3 jointColor = mix(uGroundColors[4], uGroundColors[6], 0.4) * 0.72;
  float joint = 1.0 - smoothstep(uPaving.z * 0.5 - pixel * 0.5, uPaving.z * 0.5 + pixel * 0.5, edge);
  vec3 c = mix(stoneColor, jointColor, joint);
  // De loin, joints et pavés se fondent en une teinte moyenne.
  float far = smoothstep(0.05, 0.1, pixel);
  return mix(c, mix(uGroundColors[3], jointColor, 0.18), far);
}

/** Terre des chemins: teinte claire et sombre mêlées par le bruit des taches. */
vec3 ambPathColor(float patchNoise) {
  return mix(uGroundColors[5], uGroundColors[6], smoothstep(0.3, 0.8, patchNoise) * uGroundParams.z * 2.0);
}

/** Union lisse de deux distances signées (raccord arrondi de rayon k). */
float ambSmoothMax(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0);
  return max(a, b) + h * h / (4.0 * k);
}

/**
 * Distance signée au bord des pavés de la place (m, positive dans les pavés): anneau du
 * puits, bandes pavées et rue de la Gare au nord, unies en douceur; coupées net au sud
 * par le chemin si \`south\`. \`border\`: coordonnée des boutisses le long du bord (une
 * unité par boutisse) et numéro de la forme qui porte le bord.
 */
float ambPaveField(vec2 p, bool south, out vec2 border) {
  float k = uPaveEdge.z;
  float w = uPaveEdge.y;
  float d = uPaveArea.y - p.y;
  float best = d;
  border = vec2(p.x / w, 0.0);
  if (uPavingRing.w > 0.0) {
    vec2 v = p - uPavingRing.xy;
    float di = uPavingRing.z - length(v);
    if (di > best) {
      // Autour du puits: un nombre entier de boutisses sur le cercle.
      float count = floor(6.2831853 * uPavingRing.z / w + 0.5);
      border = vec2((atan(v.y, v.x) / 6.2831853 + 0.5) * count, 1.0);
      best = di;
    }
    d = ambSmoothMax(d, di, k);
  }
  for (int i = 0; i < ${PAVE_BANDS}; i++) {
    vec2 a = uPaveBands[i].xy;
    vec2 ab = uPaveBands[i].zw - a;
    float len = length(ab);
    vec2 u = ab / max(len, 1e-4);
    vec2 v = p - a;
    float t = dot(v, u);
    float bandHalf = uPaveHalf[i];
    float di = bandHalf - length(v - u * clamp(t, 0.0, len));
    if (di > best) {
      // Le long des côtés, puis autour des bouts arrondis (continu jusqu'à la pointe).
      float side = abs(u.x * v.y - u.y * v.x);
      float along = t < 0.0 ? -bandHalf * atan(-t, side) : (t > len ? len + bandHalf * atan(t - len, side) : t);
      border = vec2(along / w, float(i) + 2.0);
      best = di;
    }
    d = ambSmoothMax(d, di, k);
  }
  if (south && uPaveArea.w - p.y < d) {
    d = uPaveArea.w - p.y;
    border = vec2(p.x / w, 9.0);
  }
  return d;
}

/** Rang de bordure: boutisses posées en travers, un ton plus foncées, joints plus larges. */
vec3 ambPaveBorder(vec2 border, float d, float patchNoise, float pixel) {
  float stone = floor(border.x);
  float along = fract(border.x);
  float hash = ambHash(vec2(stone, border.y + 57.0));
  float joint = uPaveBorderLook.x;
  float edge = min(min(along, 1.0 - along) * uPaveEdge.y, uPaveEdge.x - d);
  vec3 stoneColor = mix(uGroundColors[3], uGroundColors[4], uPaveBorderLook.y + (hash - 0.5) * uPaving.w + patchNoise * 0.08)
    * uPaveBorderLook.z;
  stoneColor *= mix(0.88, 1.0, smoothstep(0.0, 0.05, min(edge, d)));
  vec3 jointColor = mix(uGroundColors[4], uGroundColors[6], 0.4) * 0.72;
  float jointPart = 1.0 - smoothstep(joint * 0.5 - pixel * 0.5, joint * 0.5 + pixel * 0.5, edge);
  vec3 c = mix(stoneColor, jointColor, jointPart);
  float far = smoothstep(0.05, 0.1, pixel);
  return mix(c, mix(uGroundColors[4], jointColor, 0.2) * uPaveBorderLook.z, far);
}

/** Ondulation de la limite sud de la terre battue (m, vers le sud), éteinte aux deux bouts de la place. */
float ambEarthEdge(float x) {
  float n = texture(uAmbNoise, vec2(x * uPaveEarthEdge.y * 0.125, 0.31)).r;
  float fade = smoothstep(uPaveArea.x, uPaveArea.x + uPaveEarthEdge.z, x)
    * (1.0 - smoothstep(uPaveArea.z - uPaveEarthEdge.z, uPaveArea.z, x));
  // Le bruit tient surtout entre 0,4 et 0,6: on l'étire, en arrondissant les crêtes.
  return tanh((n - 0.5) * 7.0) * uPaveEarthEdge.x * fade;
}

/** Terre battue de la place: chemin tassé, plus gris, piqué de petits cailloux. */
vec3 ambBeatenEarth(vec2 xz, float patchNoise, float pixel) {
  vec3 c = mix(uGroundColors[6], uGroundColors[5], 0.45 + 0.4 * smoothstep(0.25, 0.85, patchNoise));
  // Tassée par les pas et les charrettes: plus grise et plus sombre que la terre des chemins.
  c = mix(c, uGroundColors[3], 0.34) * 0.94;
  float grain = texture(uAmbNoise, xz * 2.7 + 0.47).r;
  c *= 0.95 + 0.1 * grain;
  vec3 tone;
  float stone = ambPebble(xz, 0.21, 0.12, pixel, 13.0, tone);
  return mix(c, mix(c, tone, 0.45), stone * (1.0 - smoothstep(0.03, 0.08, pixel)));
}

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
  bool bedFace = groundIndex == ${cellIndex('sand')} && vAmbWorld.y < 0.1;
  // Taille d'un pixel au sol (m): les motifs fins s'effacent avant de scintiller (hors des branches).
  float groundPixel = length(fwidth(vAmbWorld.xz));
  if (groundFace || bedFace) {
    vec2 groundUv = vAmbWorld.xz * uGroundParams.x;
    float patchNoise = texture(uAmbNoise, groundUv).r * (1.0 - uGroundParams.y)
      + texture(uAmbNoise, groundUv * 3.7 + 0.21).r * uGroundParams.y;
    vec4 river = ambRiver(vAmbWorld.xz);
    bool grassFace = groundIndex == ${cellIndex('grass_dark')} || groundIndex == ${cellIndex('grass')} || groundIndex == ${cellIndex('grass_light')};
    bool pathFace = groundIndex == ${cellIndex('path')} || groundIndex == ${cellIndex('path_dark')};
    if (bedFace && river.a > 0.0) {
      // Lit de la rivière; l'herbe y avance là où le bord du sable recule, ou le chemin le long
      // d'une promenade (canal A à moitié, \`riviere.ts\`): un coin de chemin arrondi reste en terre.
      vec3 bed = ambBed(vAmbWorld, river, patchNoise, groundPixel);
      vec3 under = mix(ambPathColor(patchNoise), ambGreen(patchNoise), smoothstep(0.6, 0.9, river.a));
      diffuseColor.rgb = mix(under, bed, ambSand(river, vAmbWorld.xz, groundPixel));
    } else if (groundFace && grassFace) {
      vec3 green = ambGreen(patchNoise);
      float sand = ambSand(river, vAmbWorld.xz, groundPixel);
      diffuseColor.rgb = sand > 0.0 ? mix(green, ambBed(vAmbWorld, river, patchNoise, groundPixel), sand) : green;
    } else if (groundFace && (groundIndex == ${cellIndex('cobble')} || groundIndex == ${cellIndex('cobble_dark')})) {
      vec4 lookAt = texture(uLookField, (vAmbWorld.xz - uLookRect.xy) * uLookRect.zw);
      vec2 placeAt = vAmbWorld.xz;
      bool inPlace = uPaveEdge.w > 0.0 && placeAt.x > uPaveArea.x && placeAt.x < uPaveArea.z
        && placeAt.y > uPaveArea.y - uPaveEdge.x - 0.1 && placeAt.y < uPaveArea.w;
      if (lookAt.b > 0.05 && inPlace) {
        // Place: pavés dans les zones pavées, rang de boutisses sur leur bord courbe, terre battue
        // ailleurs, qui rejoint le chemin du sud sur une limite ondulée.
        vec2 border;
        float paveD = ambPaveField(placeAt, true, border);
        vec2 stoneCentre;
        float stoneHash;
        vec3 paved = paveD >= uPaveEdge.x
          ? ambPaving(placeAt, patchNoise, groundPixel, stoneCentre, stoneHash)
          : ambPaveBorder(border, paveD, patchNoise, groundPixel);
        vec3 earth = ambBeatenEarth(placeAt, patchNoise, groundPixel);
        float edgeZ = uPaveArea.w + ambEarthEdge(placeAt.x);
        earth = mix(earth, ambPathColor(patchNoise), smoothstep(edgeZ - 0.04, edgeZ + 0.04, placeAt.y));
        diffuseColor.rgb = mix(earth, paved, smoothstep(-0.5 * groundPixel, 0.5 * groundPixel, paveD));
      } else if (lookAt.b > 0.05) {
        // Place, rue et quai: pavés posés entiers là où le champ les veut (lu au milieu du pavé), terre battue ailleurs.
        vec2 stoneCentre;
        float stoneHash;
        vec3 paving = ambPaving(vAmbWorld.xz, patchNoise, groundPixel, stoneCentre, stoneHash);
        vec4 lookStone = texture(uLookField, (stoneCentre - uLookRect.xy) * uLookRect.zw);
        float laid = lookStone.a / max(lookStone.b, 0.05);
        bool stoneLaid = lookStone.b > 0.05 && laid > 0.35 + 0.3 * stoneHash;
        diffuseColor.rgb = stoneLaid ? paving : ambBeatenEarth(vAmbWorld.xz, patchNoise, groundPixel);
      } else {
        diffuseColor.rgb = mix(uGroundColors[3], uGroundColors[4], patchNoise * uGroundParams.z);
      }
    } else if (groundFace && pathFace) {
      vec3 path = ambPathColor(patchNoise);
      if (uPaveEdge.w > 0.0 && vAmbWorld.x > uPaveArea.x && vAmbWorld.x < uPaveArea.z
        && vAmbWorld.z >= uPaveArea.w && vAmbWorld.z < uPaveArea.w + uPaveEarthEdge.x + 0.05) {
        // Au sud de la place: la terre battue déborde par endroits sur le chemin (pas devant les pavés).
        vec2 border;
        if (ambPaveField(vec2(vAmbWorld.x, uPaveArea.w - 0.02), false, border) < 0.0) {
          float edgeZ = uPaveArea.w + ambEarthEdge(vAmbWorld.x);
          path = mix(ambBeatenEarth(vAmbWorld.xz, patchNoise, groundPixel), path,
            smoothstep(edgeZ - 0.04, edgeZ + 0.04, vAmbWorld.z));
        }
      }
      float sand = ambSand(river, vAmbWorld.xz, groundPixel);
      diffuseColor.rgb = sand > 0.0 ? mix(path, ambBed(vAmbWorld, river, patchNoise, groundPixel), sand) : path;
    }
  }
}
#endif
`;

/** Après `normal_fragment_maps`: sol mouillé et flaques (couleur et rugosité, avant l'éclairage). */
const FRAGMENT_WET = /* glsl */ `
vec3 ambNormal = transformNormalByInverseViewMatrix(normal, viewMatrix);
float ambUp = smoothstep(0.55, 0.9, ambNormal.y);
float ambDry = 0.0;
for (int i = 0; i < ${SHELTER_SLOTS}; i++) {
  if (i >= uShelterCount) break;
  vec4 r = uShelters[i];
  if (vAmbWorld.y < uShelterTop && vAmbWorld.x > r.x && vAmbWorld.z > r.y && vAmbWorld.x < r.z && vAmbWorld.z < r.w) ambDry = 1.0;
}
// Sous le toit de l'abri (vu de dedans): ni sol mouillé ni flaques sur le plancher.
float ambWet = uWet * mix(uWetParams.z, 1.0, ambUp) * (1.0 - ambDry);
float ambPuddle = 0.0;
#ifdef AMB_PUDDLES
if (uWet > 0.0 && ambDry < 0.5) {
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
#ifdef AMB_LOOK_OCC
// Occlusion cuite (occlusion.ts): pénombre au sol près de ce qui se dresse, pied des faces verticales.
float lookOcc = 1.0;
if (uLookOcc.x > 0.0) {
  vec4 lookField = texture(uLookField, (vAmbWorld.xz - uLookRect.xy) * uLookRect.zw);
  float lookAbove = vAmbWorld.y - (uLookHeight.x + lookField.g * uLookHeight.y);
  float lookUp = smoothstep(0.6, 0.9, ambNormal.y);
  float lookGround = lookField.r * lookUp * (1.0 - smoothstep(0.04, 0.2, lookAbove)) * uLookOcc.x;
  float lookWall = (1.0 - lookUp) * (1.0 - smoothstep(0.0, uLookOcc.z, max(lookAbove, 0.0))) * uLookOcc.w;
  lookOcc = 1.0 - max(lookGround, lookWall);
  // L'herbe et la terre à l'ombre des arbres et des murs tirent vers un vert plus profond.
  diffuseColor.rgb *= mix(vec3(1.0), uLookOccTint, lookGround);
}
#endif
`;

/** Test GLSL « la case `lookIndex` est une case froide » (`look.coldCells`). */
const COLD_CELL_TEST = AMBIANCE_SETTINGS.look.coldCells
  .map((cell) => `lookIndex == ${cellIndex(cell)}`)
  .join(' || ');

/** Après `lights_fragment_end`: nuages, reflet du ciel dans les flaques, lumières de sol. */
const FRAGMENT_LIGHT = /* glsl */ `
float ambCloud = ambCloudLight(vAmbWorld);
reflectedLight.directDiffuse *= ambCloud;
reflectedLight.directSpecular *= ambCloud;
reflectedLight.indirectSpecular += uReflection * (ambPuddle * uWetParams.w + ambWet * uWetSheen);
if (uShadeParams.x > 0.0) {
  // À l'ombre: ombre portée ou nuage (soleil reçu comparé à celui qu'attend la face), ou face
  // tournée vers l'ombre. Un sol éclairé par un soleil rasant reste au soleil (chaud).
  // L'ombre prend alors la teinte froide du ciel (ombres colorées), à clarté égale.
  const vec3 lookLuma = vec3(0.2126, 0.7152, 0.0722);
  float lookNdotL = dot(ambNormal, uLightDir);
  #ifdef LPL_RAMP
  // Style lisse: le soleil attendu suit la rampe, l'ombre gagne avec elle (demi-teinte à moitié teintée).
  float lookSunShape = lplRamp(lookNdotL);
  #else
  float lookSunShape = max(lookNdotL, 0.0);
  #endif
  float lookSunWanted = dot(uSunRadiance * material.diffuseContribution, lookLuma) * RECIPROCAL_PI * lookSunShape;
  float lookSunGot = dot(reflectedLight.directDiffuse, lookLuma);
  float lookCast = 1.0 - clamp(lookSunGot / max(lookSunWanted, 1e-5), 0.0, 1.0);
  #ifdef LPL_RAMP
  float lookShade = max(lookCast * step(1e-3, lookSunShape), 1.0 - lookSunShape);
  #else
  float lookShade = max(lookCast * smoothstep(0.0, 0.08, lookNdotL), 1.0 - smoothstep(0.0, 0.2, lookNdotL));
  #endif
  float lookLift = 1.0 + lookShade * uShadeParams.y;
  vec3 lookTint = uShadeTint;
  float lookTintPart = uShadeParams.x;
  #if defined(LPL_RAMP) && defined(USE_MAP)
  {
    // Peau (cases peau, ombre de peau, bouche, joue des rangées de personnage; la rangée 1 des
    // joueurs porte leurs vêtements): ombre brique. Tissus: la teinte froide du décor, plus franche.
    // Rangées comptées sur la texture (64 pour personnages.png de 256 px): elle a grandi avec les vignettes des yeux.
    ivec2 rampCell = ivec2(floor(vMapUv * vec2(${CHARACTER_SLOT_COUNT}.0, float(textureSize(map, 0).y) / ${PALETTE_CELL_PIXELS}.0)));
    bool rampSkin = rampCell.y != ${PLAYER_WEAR_ROW} && (rampCell.x <= 1 || rampCell.x == ${MOUTH_COLUMN} || rampCell.x == ${CHEEK_COLUMN});
    lookTint = rampSkin ? uRampSkinTint : uShadeTint;
    lookTintPart = (rampSkin ? uRampShade.x : uRampShade.y) * step(1e-4, uShadeParams.x);
  }
  #endif
  vec3 lookSky = reflectedLight.indirectDiffuse * mix(vec3(1.0), lookTint, lookShade * lookTintPart) * lookLift;
  #if defined(AMB_GROUND) && defined(USE_MAP)
  {
    // Cases déjà froides (lauzes): le bleu du ciel et de la teinte s'ajouterait au leur.
    // Moins de teinte, lumière du ciel en partie neutre, clarté de la teinte entière un peu relevée.
    ivec2 lookCell = ivec2(clamp(floor(vMapUv * ${PALETTE_GRID}.0), 0.0, ${PALETTE_GRID - 1}.0));
    int lookIndex = lookCell.y * ${PALETTE_GRID} + lookCell.x;
    if (${COLD_CELL_TEST}) {
      vec3 lookCold = reflectedLight.indirectDiffuse * lookLift
        * mix(vec3(1.0), uShadeTint, lookShade * uShadeParams.x * ${AMBIANCE_SETTINGS.look.coldShadeKeep.toFixed(3)});
      float lookColdLuma = dot(lookCold, lookLuma);
      lookCold = mix(lookCold, vec3(lookColdLuma), lookShade * ${AMBIANCE_SETTINGS.look.coldSkyNeutral.toFixed(3)});
      lookSky = lookCold * (dot(lookSky, lookLuma) / max(lookColdLuma, 1e-6))
        * (1.0 + lookShade * ${AMBIANCE_SETTINGS.look.coldShadeLift.toFixed(3)});
    }
  }
  #endif
  reflectedLight.indirectDiffuse = lookSky;
}
#ifdef AMB_LOOK_OCC
reflectedLight.indirectDiffuse *= lookOcc;
reflectedLight.directDiffuse *= mix(1.0, lookOcc, uLookOcc.y);
#endif
#ifdef AMB_RIM
if (uRim.x > 0.0) {
  // Lumière de bord: les faces presque de profil s'éclairent, surtout côté soleil (silhouette détachée du sol).
  float lookFacing = clamp(dot(normal, geometryViewDir), 0.0, 1.0);
  #ifdef LPL_RAMP
  // Style lisse: un liseré net au bord, de largeur fixe, au lieu d'un dégradé.
  // Côté soleil seulement: à l'ombre, un bord clair ferait un halo autour des mains et des bras.
  float lookRim = smoothstep(1.0 - uRampRim.x - uRampRim.y, 1.0 - uRampRim.x + uRampRim.y, 1.0 - lookFacing)
    * uRampRim.z / max(uRim.x, 1e-3);
  float lookSide = smoothstep(0.05, 0.45, dot(ambNormal, uLightDir));
  #else
  float lookRim = pow(1.0 - lookFacing, uRim.y);
  float lookSide = mix(uRim.z, 1.0, clamp(dot(ambNormal, uLightDir) * 0.5 + 0.5, 0.0, 1.0));
  #endif
  reflectedLight.directDiffuse += uRimColor * (lookRim * lookSide * uRim.x) * material.diffuseContribution;
}
#endif
reflectedLight.directDiffuse += ambGlowLight(vAmbWorld, ambNormal) * material.diffuseContribution;
`;

/**
 * Après `tonemapping_fragment`: étalonnage (chaleur, saturation, courbe en S
 * douce, relevé des noirs) et vignettage très doux, dans chaque programme qui
 * dessine le décor, les personnages et l'eau. Pas de cible intermédiaire ni de
 * passe plein écran: le coût est celui de quelques opérations par pixel.
 */
export const FRAGMENT_GRADE = /* glsl */ `
if (uGrade.w > 0.0) {
  vec3 gradeColor = max(gl_FragColor.rgb * uGradeBalance, 0.0);
  float gradeLuma = dot(gradeColor, vec3(0.2126, 0.7152, 0.0722));
  // Saturation « douce » (vibrance): les teintes ternes gagnent, les teintes déjà vives presque pas.
  float gradeMax = max(max(gradeColor.r, gradeColor.g), gradeColor.b);
  float gradeSat = (gradeMax - min(min(gradeColor.r, gradeColor.g), gradeColor.b)) / max(gradeMax, 1e-4);
  gradeColor = max(mix(vec3(gradeLuma), gradeColor, mix(uGrade.x, 1.0, gradeSat)), 0.0);
  // Courbe en S dans un espace proche de la perception (racine carrée), puis retour au linéaire.
  vec3 gradeP = sqrt(gradeColor);
  gradeP = mix(gradeP, gradeP * gradeP * (3.0 - 2.0 * gradeP), uGrade.y);
  gradeP = gradeP * (1.0 - uGrade.z) + uGrade.z;
  gradeColor = gradeP * gradeP;
  vec2 vignetteAt = gl_FragCoord.xy * uVignette.zw - 0.5;
  float vignette = smoothstep(uVignette.y, 1.0, length(vignetteAt) * 1.41421) * uVignette.x;
  gl_FragColor.rgb = mix(gradeColor, gradeColor * uVignetteColor, vignette);
}
`;

export interface SurfacePatchOptions {
  /** Flaques au sol (décor et terrain), pas sur les personnages. */
  puddles: boolean;
  /** Vent sur le feuillage, les herbes et les tissus (décor seulement). */
  wind: boolean;
  /** Teinte continue du sol et occlusion cuite (décor et terrain seulement). */
  ground: boolean;
  /** Lumière de bord (personnages). */
  rim?: boolean;
  /**
   * Style `lisse` des personnages: rampe à trois tons de la lumière directe, ombres teintées
   * selon la matière, liseré net (même programme que sans: seule sa clé change).
   */
  ramp?: boolean;
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

/** Ligne de la lumière directe de Three.js (0.187) que la rampe remplace. */
const DIRECT_IRRADIANCE = 'vec3 irradiance = dotNL * directLight.color;';
const PHYSICAL_LIGHTS = '#include <lights_physical_pars_fragment>';

/** Déplie le morceau des lumières physiques et y met la rampe à la place de N.L. */
function injectRamp(source: string, label: string): string {
  const chunk = ShaderChunk.lights_physical_pars_fragment;
  if (!source.includes(PHYSICAL_LIGHTS) || chunk.split(DIRECT_IRRADIANCE).length !== 2) {
    throw new Error(`Style lisse: repère de la lumière directe absent du shader (${label}).`);
  }
  return source.replace(
    PHYSICAL_LIGHTS,
    chunk.replace(DIRECT_IRRADIANCE, 'vec3 irradiance = lplRamp( dot( geometryNormal, directLight.direction ) ) * directLight.color;'),
  );
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
      (options.ground ? '#define AMB_GROUND\n#define AMB_LOOK_OCC\n' : '') +
      (options.rim === true ? '#define AMB_RIM\n' : '') +
      (options.ramp === true ? '#define LPL_RAMP\n' : '');
    if (options.ramp === true) {
      // La rampe remplace N.L dans la lumière directe de chaque source (soleil, lampe): le
      // morceau de Three.js est déplié ici pour y changer une ligne.
      shader.fragmentShader = injectRamp(shader.fragmentShader, label);
    }
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
    shader.fragmentShader = injectAfter(
      shader.fragmentShader,
      '#include <tonemapping_fragment>',
      FRAGMENT_GRADE,
      label,
    );
  };
  material.customProgramCacheKey = (): string => `${previousKey()}|amb_${options.key}`;
  material.needsUpdate = true;
}
