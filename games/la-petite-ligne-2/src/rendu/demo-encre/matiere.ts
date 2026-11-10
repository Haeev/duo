/**
 * Essai « encre »: les nuanceurs maison (volumes, sol, ombres de contact) et la lumière qu'ils
 * partagent. Aucun matériau standard de Three.js: pas d'éclairage physique, pas de brillance.
 *
 * Tout se calcule en couleurs d'écran (sRGB), sans conversion: un aplat du nuancier ressort à
 * l'écran tel qu'il est écrit, multiplié par un des trois tons de la lumière. Chaque nuanceur
 * écrit deux sorties: la couleur, et une seconde image (normale, numéro de morceau, numéro de
 * pièce) que la passe d'encrage lit ensuite pour tracer le contour.
 */
import * as THREE from 'three';

import { sunDirection, type Ambiance } from './ambiances';
import { LAYER, TILE_METRES } from './formes';

export const MAX_LAMPS = 4;

export interface Lamp {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
}

/** Manière de rendre l'ombre portée (comparée dans `encre-ombres-comparees.png`). */
export type ShadowStyle = 'aplat' | 'aplat-hachure' | 'hachure';

/** Uniformes communs: une seule instance, partagée par tous les nuanceurs de l'essai. */
export interface InkUniforms {
  [name: string]: THREE.IUniform;
  uSunDir: THREE.IUniform<THREE.Vector3>;
  uLit: THREE.IUniform<THREE.Vector3>;
  uHalf: THREE.IUniform<THREE.Vector3>;
  uShade: THREE.IUniform<THREE.Vector3>;
  uInk: THREE.IUniform<THREE.Vector3>;
  uHatch: THREE.IUniform<THREE.Vector4>;
  uRelief: THREE.IUniform<THREE.Vector2>;
  /** Détail selon le zoom: x = part des traits peints des textures d'objet gardée (0 à 1). */
  uDetail: THREE.IUniform<THREE.Vector2>;
  /** Personnages: x = ombre relevée vers le clair (0 à 1), y = force du liseré clair. */
  uCharacter: THREE.IUniform<THREE.Vector2>;
  uViewDir: THREE.IUniform<THREE.Vector3>;
  uLampPos: THREE.IUniform<THREE.Vector4[]>;
  uLampColor: THREE.IUniform<THREE.Vector3>;
  uKeyLamp: THREE.IUniform<number>;
  uWindowGlow: THREE.IUniform<THREE.Vector4>;
  uFlameGlow: THREE.IUniform<THREE.Vector4>;
  uShadowMap: THREE.IUniform<THREE.Texture | null>;
  uShadowMatrix: THREE.IUniform<THREE.Matrix4>;
  uShadowTexel: THREE.IUniform<number>;
  uLayers: THREE.IUniform<THREE.Texture | null>;
  uNoise: THREE.IUniform<THREE.Texture | null>;
  uPainted: THREE.IUniform<number>;
  uHull: THREE.IUniform<number>;
  uGrass: THREE.IUniform<THREE.Vector3[]>;
  uDirt: THREE.IUniform<THREE.Vector3[]>;
  uBallast: THREE.IUniform<THREE.Vector3[]>;
  uMask: THREE.IUniform<THREE.Texture | null>;
  uMaskRect: THREE.IUniform<THREE.Vector4>;
}

export function createInkUniforms(): InkUniforms {
  const three = (): THREE.Vector3[] => [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  return {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uLit: { value: new THREE.Vector3(1, 1, 1) },
    uHalf: { value: new THREE.Vector3(1, 1, 1) },
    uShade: { value: new THREE.Vector3(1, 1, 1) },
    uInk: { value: new THREE.Vector3() },
    uHatch: { value: new THREE.Vector4() },
    uRelief: { value: new THREE.Vector2(1.3, 1) },
    uDetail: { value: new THREE.Vector2(1, 1) },
    uCharacter: { value: new THREE.Vector2(0.3, 0.2) },
    uViewDir: { value: new THREE.Vector3(0, 1, 0) },
    uLampPos: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4()) },
    uLampColor: { value: new THREE.Vector3() },
    uKeyLamp: { value: 0 },
    uWindowGlow: { value: new THREE.Vector4() },
    uFlameGlow: { value: new THREE.Vector4() },
    uShadowMap: { value: null },
    uShadowMatrix: { value: new THREE.Matrix4() },
    uShadowTexel: { value: 1 / 2048 },
    uLayers: { value: null },
    uNoise: { value: null },
    uPainted: { value: 1 },
    uHull: { value: 0 },
    uGrass: { value: three() },
    uDirt: { value: three() },
    uBallast: { value: three() },
    uMask: { value: null },
    uMaskRect: { value: new THREE.Vector4(0, 0, 1, 1) },
  };
}

export function applyAmbiance(
  uniforms: InkUniforms,
  ambiance: Ambiance,
  lamps: readonly Lamp[],
  keyLamp: boolean,
  shadowStyle: ShadowStyle,
): void {
  uniforms.uSunDir.value.set(...sunDirection(ambiance));
  uniforms.uLit.value.set(...ambiance.lit);
  uniforms.uHalf.value.set(...ambiance.half);
  uniforms.uShade.value.set(...ambiance.shade);
  uniforms.uInk.value.set(...ambiance.ink);
  uniforms.uHatch.value.set(
    ambiance.hatchOwn,
    shadowStyle === 'aplat' ? 0 : shadowStyle === 'hachure' ? 1 : ambiance.hatchCast,
    ambiance.blackFill,
    shadowStyle === 'hachure' ? 1 : 0,
  );
  uniforms.uRelief.value.set(ambiance.relief, ambiance.grime);
  uniforms.uCharacter.value.set(ambiance.characterLift, ambiance.characterRim);
  uniforms.uLampPos.value.forEach((slot, i) => {
    const lamp = lamps[i];
    if (lamp && ambiance.lamps > 0) slot.set(lamp.x, lamp.y, lamp.z, lamp.radius);
    else slot.set(0, 0, 0, 0);
  });
  uniforms.uLampColor.value.set(...ambiance.lampColor).multiplyScalar(ambiance.lamps);
  uniforms.uKeyLamp.value = keyLamp ? 1 : 0;
  uniforms.uWindowGlow.value.set(...ambiance.windowGlow, ambiance.windowAmount);
  uniforms.uFlameGlow.value.set(1.0, 0.86, 0.5, ambiance.lamps > 0 ? 1 : 0);
  ambiance.grass.forEach((tone, i) => uniforms.uGrass.value[i]?.set(...tone));
  ambiance.dirt.forEach((tone, i) => uniforms.uDirt.value[i]?.set(...tone));
  ambiance.ballast.forEach((tone, i) => uniforms.uBallast.value[i]?.set(...tone));
}

/**
 * La lumière encrée, commune aux volumes et au sol.
 *
 * 1. Relief: la pente lue dans la texture (canaux B et A) penche la normale avant tout calcul;
 *    c'est elle qui fait tomber un joint dans l'ombre et monter une arête dans le clair.
 * 2. Trois tons francs: clair, demi-teinte, ombre, selon l'angle au soleil. L'ombre est une
 *    couleur de l'ambiance (prune le soir, bleu la nuit), jamais un simple assombrissement.
 * 3. Ombre portée: carte de profondeur lue en cinq points filtrés, puis seuillée avec un seuil
 *    que le bruit fait trembler: bord net, sans escalier, pas tout à fait droit.
 * 4. Lampes: une flaque à deux anneaux nets par lampe, qui efface hachures et noirs.
 * 5. Encre de l'ombre: hachures à 45 degrés ancrées au monde (elles ne nagent pas quand la
 *    caméra bouge), serrées dans l'ombre propre, lâches dans l'ombre portée; aplats d'encre
 *    pleine la nuit; pied des objets noirci et hachuré (contact avec le sol, salissure).
 */
const LIGHTING = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uLit;
uniform vec3 uHalf;
uniform vec3 uShade;
uniform vec3 uInk;
uniform vec4 uHatch;
uniform vec2 uRelief;
uniform vec4 uLampPos[${MAX_LAMPS}];
uniform vec3 uLampColor;
uniform float uKeyLamp;
uniform highp sampler2DShadow uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uShadowTexel;
uniform mediump sampler2DArray uLayers;
uniform sampler2D uNoise;
uniform float uPainted;

float sunSeen(vec3 wp, vec3 N, vec2 tremble) {
  // Le bord tremble parce que le point lu se décale de quelques centimètres, pas le seuil:
  // l'ombre garde un bord net d'un texel, mais ce bord ondule comme un trait de pinceau.
  vec4 sc = uShadowMatrix * vec4(wp + N * 0.03 + vec3(tremble.x, 0.0, tremble.y), 1.0);
  float z = sc.z - 0.0009;
  float t = uShadowTexel * 1.3;
  float seen = texture(uShadowMap, vec3(sc.xy, z)) * 0.4
    + texture(uShadowMap, vec3(sc.xy + vec2(t, t * 0.4), z)) * 0.15
    + texture(uShadowMap, vec3(sc.xy + vec2(-t * 0.4, t), z)) * 0.15
    + texture(uShadowMap, vec3(sc.xy + vec2(-t, -t * 0.4), z)) * 0.15
    + texture(uShadowMap, vec3(sc.xy + vec2(t * 0.4, -t), z)) * 0.15;
  return smoothstep(0.42, 0.58, seen);
}

// foot: hauteur au-dessus du pied de l'objet (grande valeur: pas de pied, le sol par exemple).
// inkGain: part des hachures et des noirs gardée (0 sur les personnages et les petits objets).
// lift: part de l'ombre relevée vers le ton clair (les personnages restent lisibles à l'ombre).
vec3 inkLight(vec3 base, vec3 wp, vec3 flatN, vec3 N, float foot, float inkGain, float lift) {
  vec3 nz = texture(uNoise, wp.xz * 0.09 + wp.y * 0.071).rgb;
  vec3 fine = texture(uNoise, wp.xz * 0.47 + wp.y * 0.39 + 0.2).rgb;
  float ndl = dot(N, uSunDir);
  float seen = sunSeen(wp, flatN, (fine.rg - 0.5) * 0.05 + (nz.rg - 0.5) * 0.07);
  float facing = smoothstep(0.05, 0.09, ndl);
  float full = smoothstep(0.46, 0.5, ndl);
  // Ombre portée en hachures seules (réglage comparé): le ton reste celui de la lumière.
  float toneSeen = mix(seen, 1.0, uHatch.w);
  float sun = toneSeen * facing;
  vec3 light = mix(uShade, mix(uHalf, uLit, full), sun);
  light = mix(light, max(light, uHalf), lift);

  float pool = 0.0;
  vec3 keyDir = uSunDir;
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    float radius = uLampPos[i].w;
    if (radius > 0.0) {
      vec3 d = uLampPos[i].xyz - wp;
      vec3 dn = normalize(d);
      float reach = length(d) / radius + (nz.g - 0.5) * 0.12 + (fine.g - 0.5) * 0.05;
      float lampFacing = smoothstep(0.0, 0.08, dot(N, dn));
      float ring = (1.0 - smoothstep(0.97, 1.0, reach)) * 0.45 + (1.0 - smoothstep(0.56, 0.59, reach)) * 0.55;
      pool = max(pool, ring * lampFacing);
      if (i == 0) keyDir = mix(uSunDir, dn, uKeyLamp);
    }
  }
  light += uLampColor * pool;
  vec3 color = base * light;

  // Plan de projection des hachures choisi par la normale: une seule lecture de texture.
  vec3 an = abs(flatN);
  vec2 huv = an.y > 0.7 ? wp.xz : (an.x > an.z ? wp.zy : wp.xy);
  vec2 hatch = texture(uLayers, vec3(huv / ${TILE_METRES.toFixed(1)}, ${LAYER.hatch}.0)).rg;
  float turned = dot(N, keyDir);
  float away = 1.0 - smoothstep(0.0, 0.08, turned);
  float own = away * (1.0 - sun * (1.0 - uKeyLamp));
  float thrown = (1.0 - seen) * facing * (1.0 - uKeyLamp);
  // La densité suit la lumière: hachures lâches à peine détourné, serrées franchement à l'ombre.
  float deep = smoothstep(-0.15, -0.45, turned);
  float ownHatch = mix(hatch.g, max(hatch.r, hatch.g), deep);
  float dark = max(own * ownHatch * uHatch.x, thrown * mix(hatch.g, hatch.r, uHatch.w) * uHatch.y);
  float black = own * step(1.0 - uHatch.z * 0.6, nz.b * 0.75 + fine.b * 0.25 + deep * 0.12);
  dark = max(dark, black) * (1.0 - pool) * inkGain;

  // Pied de l'objet: un liseré d'encre pleine au ras du sol, puis des hachures qui s'éclaircissent.
  float upright = 1.0 - smoothstep(0.45, 0.7, an.y);
  float base0 = upright * step(foot, 0.03 + fine.r * 0.06);
  float damp = upright * (1.0 - smoothstep(0.0, 0.2 + nz.g * 0.45, foot)) * hatch.g;
  dark = max(dark, max(base0, damp) * uRelief.y * inkGain);
  return mix(color, uInk, dark * uPainted);
}

// Normale penchée par la pente du relief (texture), dans le repère de la face.
vec3 reliefNormal(vec3 N, vec3 wp, vec2 uv, vec2 slope) {
  vec3 dpx = dFdx(wp);
  vec3 dpy = dFdy(wp);
  vec2 dux = dFdx(uv);
  vec2 duy = dFdy(uv);
  float det = dux.x * duy.y - dux.y * duy.x;
  if (abs(det) < 1e-12) return N;
  float s = sign(det);
  vec3 T = normalize((dpx * duy.y - dpy * dux.y) * s);
  vec3 B = normalize((dpy * dux.x - dpx * duy.x) * s);
  return normalize(N - (T * slope.x + B * slope.y) * uRelief.x * uPainted);
}

// Normale sur deux canaux (octaèdre): les deux autres portent les numéros de morceau et de pièce.
vec2 packNormal(vec3 n) {
  n /= abs(n.x) + abs(n.y) + abs(n.z);
  vec2 e = n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
  return e * 0.5 + 0.5;
}
`;

const OBJECT_VERTEX = /* glsl */ `
in vec3 aColor;
in vec4 aMeta;
in float aFoot;
in vec3 aSmooth;
uniform float uHull;
uniform sampler2D uNoise;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out vec2 vUv;
out float vFoot;
flat out vec4 vMeta;
#ifdef ATLAS
  in vec2 aFaceUv;
  out vec2 vFaceUv;
#endif
void main() {
  #ifdef ATLAS
    vFaceUv = aFaceUv;
  #endif
  mat4 model = modelMatrix;
  vec4 meta = aMeta;
  #ifdef USE_INSTANCING
    // Semis: chaque exemplaire a sa place, et son propre numéro de pièce (donc son contour).
    model = modelMatrix * instanceMatrix;
    // Le numéro (6 bits) tourne d'un exemplaire à l'autre; la classe de taille (2 bits) reste.
    float sizeBits = floor(aMeta.y / 64.0) * 64.0;
    meta.y = sizeBits + mod(aMeta.y - sizeBits + float(gl_InstanceID) * 7.0, 63.0) + 1.0;
  #endif
  vec4 world = model * vec4(position, 1.0);
  #ifdef HULL
    // Coque inversée (contour comparé): la pièce regonflée le long de sa normale lissée, d'une
    // épaisseur en mètres que le bruit fait varier de 50 à 150 %.
    float weight = 0.5 + texture(uNoise, world.xz * 0.23 + world.y * 0.17).r;
    world.xyz += normalize(mat3(model) * aSmooth) * uHull * weight;
  #endif
  vWorld = world.xyz;
  vNormal = normalize(mat3(model) * normal);
  vColor = aColor;
  vUv = uv;
  vMeta = meta;
  vFoot = world.y - aFoot - model[3].y;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const OBJECT_FRAGMENT = /* glsl */ `
layout(location = 0) out highp vec4 gColor;
layout(location = 1) out highp vec4 gAux;
in vec3 vWorld;
in vec3 vNormal;
in vec3 vColor;
in vec2 vUv;
in float vFoot;
flat in vec4 vMeta;
uniform vec4 uWindowGlow;
uniform vec4 uFlameGlow;
#ifdef ATLAS
  in vec2 vFaceUv;
  uniform sampler2D uAtlas;
  uniform sampler2D uTraits;
  uniform float uCell;
  uniform vec2 uCharacter;
  uniform vec3 uViewDir;
#endif
uniform vec2 uDetail;
${LIGHTING}
void main() {
  vec3 N = normalize(vNormal);
  #if defined(ATLAS) && !defined(HULL)
    // Personnage: la couleur et les traits viennent de son atlas peint; le visage reçoit en plus
    // la case d'expression de l'atlas commun des traits. Normales lissées: l'ombre suit le corps.
    vec3 skin = texture(uAtlas, vUv).rgb;
    if (vFaceUv.x > 0.0 && vFaceUv.x < 1.0 && vFaceUv.y > 0.0 && vFaceUv.y < 1.0) {
      vec4 face = texture(uTraits, vec2((vFaceUv.x + uCell) / 4.0, vFaceUv.y));
      skin = mix(skin, face.rgb, face.a);
    }
    // Ni hachure ni noir sur un personnage: des aplats francs, une ombre relevée, et un liseré
    // clair du côté du soleil qui le détache du décor.
    vec3 body = inkLight(skin * 1.12, vWorld, N, N, vFoot, 0.0, uCharacter.x);
    float rim = smoothstep(0.62, 0.7, 1.0 - dot(N, uViewDir)) * smoothstep(0.1, 0.2, dot(N, uSunDir));
    body = mix(body, min(body * 1.35 + 0.08, vec3(1.0)), rim * uCharacter.y);
    gColor = vec4(body, 1.0);
    gAux = vec4(packNormal(N), vMeta.w / 255.0, vMeta.y / 255.0);
    return;
  #endif
  #ifdef HULL
    gColor = vec4(uInk, 1.0);
    gAux = vec4(packNormal(N), 0.0, vMeta.y / 255.0);
  #else
    vec4 drawn = texture(uLayers, vec3(vUv, vMeta.x));
    vec3 bent = reliefNormal(N, vWorld, vUv, (drawn.ba - 0.5) * 2.0);
    // Second ton peint: la tache de la texture fait passer du ton clair au ton de base.
    vec3 base = vColor * mix(1.0, 0.85, smoothstep(0.4, 0.6, drawn.g) * uPainted);
    // Hachures, noirs et pied encré: sur les grands objets et leurs grands morceaux seulement.
    float big = step(floor(vMeta.y / 64.0), 1.5) * step(floor(vMeta.w / 64.0), 1.5);
    vec3 color = inkLight(base, vWorld, N, bent, vFoot, big, 0.0);
    // Le trait peint des textures s'efface quand la vue s'élargit: de loin, un aplat propre.
    color = mix(color, uInk, drawn.r * uPainted * uDetail.x);
    float window = step(0.5, vMeta.z) * step(vMeta.z, 1.5) * uWindowGlow.a;
    float flame = step(1.5, vMeta.z) * uFlameGlow.a;
    color = mix(color, uWindowGlow.rgb, window);
    color = mix(color, uFlameGlow.rgb, flame);
    gColor = vec4(color, 1.0);
    gAux = vec4(packNormal(N), vMeta.w / 255.0, vMeta.y / 255.0);
  #endif
}
`;

const GROUND_VERTEX = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * Le sol. Aucune grille: la carte des matières (floue, 8 points par mètre) est seuillée avec un
 * bruit, ce qui donne un bord franc et sinueux; le bord est cerné d'un trait interrompu. L'herbe
 * superpose deux fois le carreau de touffes, à deux échelles et deux angles, et un bruit large
 * éclaircit des plages entières: la répétition du carreau ne se lit plus vue de haut. Cailloux
 * et ballast ont leur relief: ils prennent la lumière d'un côté et l'ombre de l'autre.
 */
const GROUND_FRAGMENT = /* glsl */ `
layout(location = 0) out highp vec4 gColor;
layout(location = 1) out highp vec4 gAux;
in vec3 vWorld;
uniform vec3 uGrass[3];
uniform vec3 uDirt[3];
uniform vec3 uBallast[3];
uniform sampler2D uMask;
uniform vec4 uMaskRect;
${LIGHTING}
float edgeLine(float field, float width) {
  float w = fwidth(field) * width;
  return 1.0 - smoothstep(w * 0.6, w, abs(field));
}
void main() {
  vec2 g = vWorld.xz;
  vec2 mask = texture(uMask, (g - uMaskRect.xy) / uMaskRect.zw).rg;
  vec3 big = texture(uNoise, g * 0.021).rgb;
  vec3 mid = texture(uNoise, g * 0.085 + 0.37).rgb;
  vec3 small = texture(uNoise, g * 0.33 + 0.11).rgb;
  float wobble = (small.r - 0.5) * 0.34 + (mid.g - 0.5) * 0.3;
  float dirtField = mask.r + wobble - 0.5;
  float ballastField = mask.g + (small.g - 0.5) * 0.3 - 0.5;
  float aa = fwidth(dirtField) + 1e-4;
  float dirt = smoothstep(-aa, aa, dirtField);
  float ballast = smoothstep(-aa, aa, ballastField);

  const mat2 turn = mat2(0.7986, -0.6018, 0.6018, 0.7986);
  vec2 tuftA = texture(uLayers, vec3(g / ${TILE_METRES.toFixed(1)}, ${LAYER.grass}.0)).rg;
  vec2 tuftB = texture(uLayers, vec3(turn * g / 5.7 + 0.31, ${LAYER.grass}.0)).rg;
  vec4 soil = texture(uLayers, vec3(g / ${TILE_METRES.toFixed(1)} + 0.5, ${LAYER.dirt}.0));
  vec4 stones = texture(uLayers, vec3(g / 3.1, ${LAYER.ballast}.0));

  // Herbe: trois tons en grandes plages, touffes par endroits seulement. Les plages suivent un
  // modelé du terrain: deux bruits servent de pente, et c'est le côté tourné vers le soleil qui
  // s'éclaircit. Elles se déplacent donc avec l'heure, comme sur un pré bosselé.
  vec2 lay = vec2(big.r + mid.b * 0.7, big.g + mid.r * 0.7) - 0.85;
  float toward = dot(lay, normalize(uSunDir.xz + 1e-4));
  float lightPatch = step(0.13, toward);
  float darkPatch = step(toward, -0.15);
  vec3 grass = mix(uGrass[1], uGrass[0], lightPatch);
  grass = mix(grass, uGrass[2], max(darkPatch, step(0.5, tuftB.g) * 0.6));
  float thick = smoothstep(0.42, 0.5, mid.g);
  float grassInk = max(tuftA.r * thick, tuftB.r * (1.0 - thick * 0.6));

  vec3 earth = mix(uDirt[0], uDirt[1], step(0.5, soil.g));
  // Lisière: une bande plus sombre de terre sous le bord de l'herbe (bible 3.6), puis le trait.
  earth = mix(earth, uDirt[1] * 0.82, step(dirtField, 0.05 + small.g * 0.07) * dirt);
  vec3 rock = mix(uBallast[0], uBallast[1], step(0.5, stones.g));

  vec3 base = mix(grass, earth, dirt);
  base = mix(base, rock, ballast);
  float ink = mix(grassInk, soil.r, dirt);
  ink = mix(ink, stones.r, ballast);
  float border = edgeLine(dirtField, 2.2) * step(0.33, small.b) * (1.0 - ballast);
  border = max(border, edgeLine(ballastField, 2.4) * step(0.3, small.r));
  ink = max(ink, border) * uPainted;

  vec2 slope = mix(vec2(0.0), (soil.ba - 0.5) * 2.0, dirt);
  slope = mix(slope, (stones.ba - 0.5) * 2.0, ballast);
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 bent = normalize(up - vec3(slope.x, 0.0, slope.y) * uRelief.x * uPainted);
  vec3 color = inkLight(base, vWorld, up, bent, 100.0, 1.0, 0.0);
  color = mix(color, uInk, ink);
  gColor = vec4(color, 1.0);
  gAux = vec4(packNormal(up), 0.0, 0.0);
}
`;

/**
 * Ombre de contact: une tache anguleuse posée au sol sous les pieds et les meubles, qui multiplie
 * la couleur du dessous par le ton d'ombre de l'ambiance. La seconde sortie vaut 1 partout: la
 * multiplication la laisse intacte, donc aucun trait de contour autour de la tache.
 */
const CONTACT_FRAGMENT = /* glsl */ `
layout(location = 0) out highp vec4 gColor;
layout(location = 1) out highp vec4 gAux;
uniform vec3 uShade;
void main() {
  gColor = vec4(uShade * 0.92, 1.0);
  gAux = vec4(1.0);
}
`;

const DEPTH_VERTEX = /* glsl */ `
void main() {
  vec4 local = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    local = instanceMatrix * local;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * local;
}
`;

export interface InkMaterials {
  readonly object: THREE.ShaderMaterial;
  readonly hull: THREE.ShaderMaterial;
  readonly ground: THREE.ShaderMaterial;
  readonly contact: THREE.ShaderMaterial;
  /** Matière de la passe d'ombre: profondeur seule. */
  readonly depth: THREE.ShaderMaterial;
}

export function createInkMaterials(uniforms: InkUniforms): InkMaterials {
  const common = { uniforms, glslVersion: THREE.GLSL3 } as const;
  return {
    object: new THREE.ShaderMaterial({
      ...common,
      vertexShader: OBJECT_VERTEX,
      fragmentShader: OBJECT_FRAGMENT,
    }),
    hull: new THREE.ShaderMaterial({
      ...common,
      defines: { HULL: 1 },
      vertexShader: OBJECT_VERTEX,
      fragmentShader: OBJECT_FRAGMENT,
      side: THREE.BackSide,
    }),
    ground: new THREE.ShaderMaterial({
      ...common,
      vertexShader: GROUND_VERTEX,
      fragmentShader: GROUND_FRAGMENT,
    }),
    contact: new THREE.ShaderMaterial({
      ...common,
      vertexShader: GROUND_VERTEX,
      fragmentShader: CONTACT_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.ZeroFactor,
      blendSrcAlpha: THREE.DstAlphaFactor,
      blendDstAlpha: THREE.ZeroFactor,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    depth: new THREE.ShaderMaterial({
      vertexShader: DEPTH_VERTEX,
      fragmentShader: 'void main() {}',
      colorWrite: false,
      side: THREE.DoubleSide,
    }),
  };
}

/** Matière d'un personnage riggé: le nuanceur des volumes, avec la couleur lue dans son atlas. */
export function createFigurineMaterial(
  uniforms: InkUniforms,
  atlas: THREE.Texture,
  traits: THREE.Texture,
  expression: number,
  hull = false,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...uniforms,
      uAtlas: { value: atlas },
      uTraits: { value: traits },
      uCell: { value: expression },
    },
    glslVersion: THREE.GLSL3,
    defines: hull ? { ATLAS: 1, HULL: 1 } : { ATLAS: 1 },
    vertexShader: OBJECT_VERTEX,
    fragmentShader: OBJECT_FRAGMENT,
    side: hull ? THREE.BackSide : THREE.DoubleSide,
  });
}

/** Passe d'ombre de l'essai: une carte de profondeur vue du soleil, cadrée sur la vue. */
export class SunShadow {
  readonly target: THREE.WebGLRenderTarget;
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
  private readonly size: number;
  private readonly bias = new THREE.Matrix4().set(
    0.5,
    0,
    0,
    0.5,
    0,
    0.5,
    0,
    0.5,
    0,
    0,
    0.5,
    0.5,
    0,
    0,
    0,
    1,
  );

  constructor(size: number) {
    this.size = size;
    const depth = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
    depth.compareFunction = THREE.LessEqualCompare;
    depth.minFilter = THREE.LinearFilter;
    depth.magFilter = THREE.LinearFilter;
    this.target = new THREE.WebGLRenderTarget(size, size, { depthTexture: depth });
    // Calque 1: ce qui projette une ombre (dont le plafond et les murs effacés, invisibles à l'écran).
    this.camera.layers.set(1);
  }

  /** Cadre la carte sur un disque de rayon `radius` autour de `center`, calé sur ses texels. */
  update(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    depthMaterial: THREE.Material,
    uniforms: InkUniforms,
    center: THREE.Vector3,
    radius: number,
  ): void {
    const direction = uniforms.uSunDir.value;
    this.camera.position.copy(center).addScaledVector(direction, 90);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(center);
    this.camera.left = -radius;
    this.camera.right = radius;
    this.camera.top = radius;
    this.camera.bottom = -radius;
    this.camera.near = 10;
    this.camera.far = 170;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    const previous = scene.overrideMaterial;
    scene.overrideMaterial = depthMaterial;
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, this.camera);
    renderer.setRenderTarget(null);
    scene.overrideMaterial = previous;
    uniforms.uShadowMap.value = this.target.depthTexture;
    uniforms.uShadowTexel.value = 1 / this.size;
    uniforms.uShadowMatrix.value
      .copy(this.bias)
      .multiply(this.camera.projectionMatrix)
      .multiply(this.camera.matrixWorldInverse);
  }
}
