/**
 * Essai « encre »: les nuanceurs maison et la lumière qu'ils partagent. Aucun matériau standard
 * de Three.js: pas d'éclairage physique, pas de brillance.
 *
 * Un seul nuanceur de volumes pour tout ce qui n'est pas le sol: décor, semis instancié,
 * végétation et personnages animés (variante `ATLAS`, squelette compris). Le sol a le sien, qui
 * partage la même lumière. Tout se calcule en couleurs d'écran (sRGB), sans conversion: un aplat
 * du nuancier ressort à l'écran tel qu'il est écrit, multiplié par un des trois tons de la
 * lumière. Chaque nuanceur écrit deux sorties: la couleur, et une seconde image (normale, numéro
 * de morceau, numéro de pièce) que la passe d'encrage lit ensuite pour tracer le contour.
 */
import * as THREE from 'three';

import { sunDirection, type Ambiance } from './ambiances';
import { LAYER, TILE_METRES } from './formes';

export const MAX_LAMPS = 4;
export const MAX_WINDOWS = 8;

export interface Lamp {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
  /**
   * Ouverture du cône d'ombre, en degrés: la lampe peut porter l'ombre locale (une seule à la
   * fois, la plus proche du joueur). Absente: elle éclaire sans ombre (lampe tenue à la main).
   */
  readonly shadowFov?: number;
}

/** Fenêtre éclairée de l'intérieur: elle pose son rectangle de lumière sur le sol dehors. */
export interface WindowLight {
  /** Milieu de l'appui, sur le nu extérieur du mur. */
  readonly x: number;
  readonly sill: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
  /** Normale du mur, vers le dehors. */
  readonly nx: number;
  readonly nz: number;
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
  /**
   * Détail selon le zoom (0 à 1): x = traits peints des textures d'objet, y = hachures et plis
   * des personnages, z = traits du visage.
   */
  uDetail: THREE.IUniform<THREE.Vector3>;
  /** Personnages: x = ombre relevée vers le clair (0 à 1), y = force du liseré clair. */
  uCharacter: THREE.IUniform<THREE.Vector2>;
  uViewDir: THREE.IUniform<THREE.Vector3>;
  uScreen: THREE.IUniform<THREE.Vector2>;
  uTime: THREE.IUniform<number>;
  /** Vent: x et y = direction au sol fois la force (0: air immobile). */
  uWind: THREE.IUniform<THREE.Vector2>;
  uLampPos: THREE.IUniform<THREE.Vector4[]>;
  uLampColor: THREE.IUniform<THREE.Vector3>;
  uKeyLamp: THREE.IUniform<number>;
  /** Numéro de la lampe qui porte l'ombre locale (-1: aucune). */
  uLampCaster: THREE.IUniform<number>;
  uLampShadowMap: THREE.IUniform<THREE.Texture | null>;
  uLampShadowMatrix: THREE.IUniform<THREE.Matrix4>;
  uLampShadowTexel: THREE.IUniform<number>;
  uWinA: THREE.IUniform<THREE.Vector4[]>;
  uWinB: THREE.IUniform<THREE.Vector4[]>;
  uWinColor: THREE.IUniform<THREE.Vector4>;
  uWindowGlow: THREE.IUniform<THREE.Vector4>;
  uGlint: THREE.IUniform<THREE.Vector4>;
  uFlameGlow: THREE.IUniform<THREE.Vector4>;
  /** Brume au sol: x = force, y = épaisseur en mètres. */
  uMist: THREE.IUniform<THREE.Vector2>;
  uMistColor: THREE.IUniform<THREE.Vector3>;
  uShadowMap: THREE.IUniform<THREE.Texture | null>;
  uShadowMatrix: THREE.IUniform<THREE.Matrix4>;
  uShadowTexel: THREE.IUniform<number>;
  uLayers: THREE.IUniform<THREE.Texture | null>;
  uNoise: THREE.IUniform<THREE.Texture | null>;
  uPainted: THREE.IUniform<number>;
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
  const four = (count: number): THREE.Vector4[] =>
    Array.from({ length: count }, () => new THREE.Vector4());
  return {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uLit: { value: new THREE.Vector3(1, 1, 1) },
    uHalf: { value: new THREE.Vector3(1, 1, 1) },
    uShade: { value: new THREE.Vector3(1, 1, 1) },
    uInk: { value: new THREE.Vector3() },
    uHatch: { value: new THREE.Vector4() },
    uRelief: { value: new THREE.Vector2(1.3, 1) },
    uDetail: { value: new THREE.Vector3(1, 1, 1) },
    uCharacter: { value: new THREE.Vector2(0.3, 0.2) },
    uViewDir: { value: new THREE.Vector3(0, 1, 0) },
    uScreen: { value: new THREE.Vector2(1366, 768) },
    uTime: { value: 0 },
    uWind: { value: new THREE.Vector2() },
    uLampPos: { value: four(MAX_LAMPS) },
    uLampColor: { value: new THREE.Vector3() },
    uKeyLamp: { value: 0 },
    uLampCaster: { value: -1 },
    uLampShadowMap: { value: null },
    uLampShadowMatrix: { value: new THREE.Matrix4() },
    uLampShadowTexel: { value: 1 / 512 },
    uWinA: { value: four(MAX_WINDOWS) },
    uWinB: { value: four(MAX_WINDOWS) },
    uWinColor: { value: new THREE.Vector4() },
    uWindowGlow: { value: new THREE.Vector4() },
    uGlint: { value: new THREE.Vector4() },
    uFlameGlow: { value: new THREE.Vector4() },
    uMist: { value: new THREE.Vector2() },
    uMistColor: { value: new THREE.Vector3() },
    uShadowMap: { value: null },
    uShadowMatrix: { value: new THREE.Matrix4() },
    uShadowTexel: { value: 1 / 2048 },
    uLayers: { value: null },
    uNoise: { value: null },
    uPainted: { value: 1 },
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
  windows: readonly WindowLight[],
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
  const spill = ambiance.windowAmount > 0 && ambiance.spill > 0;
  uniforms.uWinA.value.forEach((slot, i) => {
    const w = spill ? windows[i] : undefined;
    const other = uniforms.uWinB.value[i];
    if (w) {
      slot.set(w.x, w.sill, w.z, w.width / 2);
      other?.set(w.nx, w.nz, w.height, 1);
    } else {
      slot.set(0, 0, 0, 0);
      other?.set(0, 0, 0, 0);
    }
  });
  uniforms.uWinColor.value.set(...ambiance.lampColor, ambiance.spill);
  uniforms.uWindowGlow.value.set(...ambiance.windowGlow, ambiance.windowAmount);
  uniforms.uGlint.value.set(...ambiance.glint, ambiance.glintAmount);
  uniforms.uFlameGlow.value.set(1.0, 0.86, 0.5, ambiance.lamps > 0 ? 1 : 0);
  uniforms.uMist.value.set(ambiance.mist, ambiance.mistTop);
  uniforms.uMistColor.value.set(...ambiance.mistColor);
  const windAngle = (ambiance.windAzimuth * Math.PI) / 180;
  uniforms.uWind.value.set(Math.sin(windAngle), -Math.cos(windAngle)).multiplyScalar(ambiance.wind);
  ambiance.grass.forEach((tone, i) => uniforms.uGrass.value[i]?.set(...tone));
  ambiance.dirt.forEach((tone, i) => uniforms.uDirt.value[i]?.set(...tone));
  ambiance.ballast.forEach((tone, i) => uniforms.uBallast.value[i]?.set(...tone));
}

/**
 * Le vent, commun au rendu et à la passe d'ombre (sinon l'ombre d'un arbre ne suivrait pas son
 * feuillage). Tout ce qui est souple (nature 3: feuillage, 4: tige, tronc, brin d'herbe) plie
 * selon sa hauteur au-dessus de son pied; chaque pied a sa phase, tirée de sa place. Le feuillage
 * frémit en plus, sommet par sommet.
 */
const SWAY = /* glsl */ `
uniform float uTime;
uniform vec2 uWind;
vec3 sway(vec3 world, vec3 origin, float kind, float above, vec3 local) {
  if (kind < 2.5) return world;
  float phase = origin.x * 0.37 + origin.z * 0.53;
  float gust = sin(uTime * 1.1 + phase) * 0.6 + sin(uTime * 2.3 + phase * 1.7) * 0.4;
  float h = max(above, 0.0);
  float bend = min(h, 0.5) * 0.08 + h * h * 0.004;
  world.xz += uWind * gust * bend;
  if (kind < 3.5) {
    float flutter = sin(uTime * 3.7 + dot(local, vec3(2.1, 1.7, 2.9)) + phase);
    world.xz += uWind * flutter * 0.022;
    world.y += flutter * 0.012 * length(uWind);
  }
  return world;
}
`;

/**
 * La lumière encrée, commune aux volumes et au sol.
 *
 * 1. Relief: la pente lue dans la texture (canaux B et A) penche la normale avant tout calcul;
 *    c'est elle qui fait tomber un joint dans l'ombre et monter une arête dans le clair.
 * 2. Trois tons francs: clair, demi-teinte, ombre, selon l'angle au soleil. L'ombre est une
 *    couleur de l'ambiance (prune le soir, bleu la nuit), jamais un simple assombrissement.
 * 3. Ombre portée: carte de profondeur lue en cinq points filtrés, puis seuillée; le point lu
 *    se décale selon un bruit: bord net, sans escalier, pas tout à fait droit.
 * 4. Lampes: une flaque à deux anneaux nets par lampe, qui efface hachures et noirs. La lampe
 *    la plus proche du joueur porte une ombre (seconde carte de profondeur, en cône): la flaque
 *    est découpée par les objets.
 * 5. Fenêtres éclairées: chacune pose sur le sol dehors le rectangle de sa lumière, croisillon
 *    compris (calcul direct, sans texture ni passe).
 * 6. Encre de l'ombre: hachures à 45 degrés ancrées au monde (elles ne nagent pas quand la
 *    caméra bouge), serrées dans l'ombre propre, lâches dans l'ombre portée; aplats d'encre
 *    pleine la nuit; pied des objets noirci et hachuré (contact avec le sol, salissure).
 * 7. Brume au sol: deux voiles à bord net qui dérivent, plus denses au ras du sol.
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
uniform float uLampCaster;
uniform highp sampler2DShadow uLampShadowMap;
uniform mat4 uLampShadowMatrix;
uniform float uLampShadowTexel;
uniform vec4 uWinA[${MAX_WINDOWS}];
uniform vec4 uWinB[${MAX_WINDOWS}];
uniform vec4 uWinColor;
uniform vec2 uMist;
uniform vec3 uMistColor;
uniform float uTime;
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

// Ombre de la lampe locale: carte en cône sous la lampe; hors du cône, rien ne fait d'ombre.
float lampSeen(vec3 wp, vec3 N, vec2 tremble) {
  vec4 sc = uLampShadowMatrix * vec4(wp + N * 0.045 + vec3(tremble.x, 0.0, tremble.y), 1.0);
  if (sc.w <= 0.0) return 1.0;
  vec3 p = sc.xyz / sc.w;
  if (p.x < 0.01 || p.x > 0.99 || p.y < 0.01 || p.y > 0.99 || p.z > 1.0) return 1.0;
  float z = p.z - 0.0012;
  float t = uLampShadowTexel * 1.2;
  float seen = texture(uLampShadowMap, vec3(p.xy, z)) * 0.4
    + texture(uLampShadowMap, vec3(p.xy + vec2(t, t * 0.4), z)) * 0.15
    + texture(uLampShadowMap, vec3(p.xy + vec2(-t * 0.4, t), z)) * 0.15
    + texture(uLampShadowMap, vec3(p.xy + vec2(-t, -t * 0.4), z)) * 0.15
    + texture(uLampShadowMap, vec3(p.xy + vec2(t * 0.4, -t), z)) * 0.15;
  return smoothstep(0.42, 0.58, seen);
}

// Rectangles de lumière des fenêtres: le point est éclairé si le rayon qui le joint à la lampe
// de la pièce (1,2 m derrière la vitre, sous le plafond) passe par le vide de la fenêtre, entre
// les petits bois. Deux tons: plein près du mur, moitié au bout.
float windowSpill(vec3 wp, vec3 N, vec2 tremble) {
  float lit = 0.0;
  for (int i = 0; i < ${MAX_WINDOWS}; i++) {
    if (uWinB[i].w < 0.5) continue;
    vec2 n = uWinB[i].xy;
    vec3 c = uWinA[i].xyz;
    vec2 rel = wp.xz + tremble - c.xz;
    float outward = dot(rel, n);
    // Au-delà de 3,4 m, ou plus haut que l'appui, la lumière ne compte plus: elle ne va pas
    // se poser sur un arbre de l'autre côté de la cour.
    if (outward < 0.03 || outward > 3.4 || wp.y > c.y + 0.2) continue;
    float along = dot(rel, vec2(-n.y, n.x));
    float lampY = c.y + uWinB[i].z + 0.55;
    float t = 1.2 / (1.2 + outward);
    float hitY = mix(wp.y, lampY, t);
    float hitAlong = along * t;
    float h = hitY - c.y;
    float inside = step(abs(hitAlong), uWinA[i].w) * step(0.0, h) * step(h, uWinB[i].z);
    // Petits bois: un montant au milieu, une traverse à 55 % de la hauteur.
    float bars = step(0.045, abs(hitAlong)) * step(0.04, abs(h - uWinB[i].z * 0.55));
    vec3 toLamp = normalize(vec3(-n.x * (outward + 1.2), lampY - wp.y, -n.y * (outward + 1.2)));
    float facing = step(0.05, dot(N, toLamp));
    lit = max(lit, inside * bars * facing * mix(1.0, 0.55, step(0.62, 1.0 - t)));
  }
  return lit;
}

// foot: hauteur au-dessus du pied de l'objet (grande valeur: pas de pied, le sol par exemple).
// inkGain: part des hachures et des noirs gardée (0 sur les personnages et les petits objets).
// lift: part de l'ombre relevée vers le ton clair (les personnages restent lisibles à l'ombre).
vec3 inkLight(vec3 base, vec3 wp, vec3 flatN, vec3 N, float foot, float inkGain, float lift) {
  vec3 nz = texture(uNoise, wp.xz * 0.09 + wp.y * 0.071).rgb;
  vec3 fine = texture(uNoise, wp.xz * 0.47 + wp.y * 0.39 + 0.2).rgb;
  vec2 tremble = (fine.rg - 0.5) * 0.05 + (nz.rg - 0.5) * 0.07;
  float ndl = dot(N, uSunDir);
  float seen = sunSeen(wp, flatN, tremble);
  float facing = smoothstep(0.05, 0.09, ndl);
  float full = smoothstep(0.46, 0.5, ndl);
  // Ombre portée en hachures seules (réglage comparé): le ton reste celui de la lumière.
  float toneSeen = mix(seen, 1.0, uHatch.w);
  float sun = toneSeen * facing;
  vec3 light = mix(uShade, mix(uHalf, uLit, full), sun);
  // Au-delà de 0,95 (le masque du visage), c'est le ton clair lui-même qui est garanti.
  light = mix(light, max(light, mix(uHalf, uLit, 0.4 + 0.55 * step(0.95, lift))), min(lift, 1.0));

  float pool = 0.0;
  vec3 keyDir = uSunDir;
  float casterSeen = uLampCaster >= 0.0 ? lampSeen(wp, flatN, tremble * 0.6) : 1.0;
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    float radius = uLampPos[i].w;
    if (radius > 0.0) {
      vec3 d = uLampPos[i].xyz - wp;
      vec3 dn = normalize(d);
      float reach = length(d) / radius + (nz.g - 0.5) * 0.12 + (fine.g - 0.5) * 0.05;
      float lampFacing = smoothstep(0.0, 0.08, dot(N, dn));
      float ring = (1.0 - smoothstep(0.97, 1.0, reach)) * 0.45 + (1.0 - smoothstep(0.56, 0.59, reach)) * 0.55;
      float visible = abs(float(i) - uLampCaster) < 0.5 ? casterSeen : 1.0;
      pool = max(pool, ring * lampFacing * visible);
      if (i == 0) keyDir = mix(uSunDir, dn, uKeyLamp);
    }
  }
  float spill = uWinColor.a > 0.0 ? windowSpill(wp, N, tremble * 0.5) : 0.0;
  light += uLampColor * pool + uWinColor.rgb * uWinColor.a * spill;
  float glow = max(pool, spill);
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
  dark = max(dark, black) * (1.0 - glow) * inkGain;

  // Pied de l'objet: un liseré d'encre pleine au ras du sol, puis des hachures qui s'éclaircissent.
  float upright = 1.0 - smoothstep(0.45, 0.7, an.y);
  float base0 = upright * step(foot, 0.03 + fine.r * 0.06);
  float damp = upright * (1.0 - smoothstep(0.0, 0.2 + nz.g * 0.45, foot)) * hatch.g;
  dark = max(dark, max(base0, damp) * uRelief.y * inkGain);
  color = mix(color, uInk, dark * uPainted);

  // Brume: deux nappes qui dérivent en sens contraires; le seuil du bruit monte avec la hauteur,
  // donc la nappe s'effiloche vers le haut au lieu de s'arrêter à une ligne.
  if (uMist.x > 0.0) {
    float low = 1.0 - clamp(wp.y / uMist.y, 0.0, 1.0);
    float drift = texture(uNoise, wp.xz * 0.031 + uTime * vec2(0.006, 0.002)).r * 0.6
      + texture(uNoise, wp.xz * 0.083 - uTime * vec2(0.004, 0.007)).g * 0.4;
    float body = drift * low * (0.6 + 0.4 * low);
    float veil = smoothstep(0.50, 0.515, body) * 0.3 + smoothstep(0.6, 0.615, body) * 0.28;
    color = mix(color, uMistColor + uLampColor * pool * 0.35, veil * uMist.x);
  }
  return color;
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

/**
 * Sommets des volumes. `aMeta`: x = couche de trait (personnage: poussée du relief en mètres),
 * y = numéro de pièce, z = nature (0 rien, 1 vitre, 2 flamme, 3 feuillage, 4 tige; personnage:
 * 1 corps, 0 visage), w = numéro de morceau. Le squelette, l'instanciation et le vent passent
 * tous par ici: un personnage animé et un caillou semé sortent du même programme source.
 */
const OBJECT_VERTEX = /* glsl */ `
in vec3 aColor;
in vec4 aMeta;
in float aFoot;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vColor;
out vec2 vUv;
out float vFoot;
flat out vec4 vMeta;
#ifdef ATLAS
  in vec2 aFaceUv;
  out vec2 vFaceUv;
  flat out vec2 vAnchor;
  uniform sampler2D uAtlas;
  uniform vec2 uScreen;
#endif
${SWAY}
#include <skinning_pars_vertex>
void main() {
  vec3 transformed = position;
  vec3 objectNormal = normal;
  #ifdef ATLAS
    vFaceUv = aFaceUv;
    // Relief des vêtements: la hauteur peinte dans l'atlas (canal alpha) pousse les sommets.
    transformed += normalize(objectNormal) * (textureLod(uAtlas, uv, 0.0).a - 0.44) * aMeta.x;
  #endif
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  mat4 model = modelMatrix;
  vec4 meta = aMeta;
  #ifdef USE_INSTANCING
    // Semis: chaque exemplaire a sa place, et son propre numéro de pièce (donc son contour).
    model = modelMatrix * instanceMatrix;
    // Le numéro (6 bits) tourne d'un exemplaire à l'autre; la classe de taille (2 bits) reste.
    float sizeBits = floor(aMeta.y / 64.0) * 64.0;
    meta.y = sizeBits + mod(aMeta.y - sizeBits + float(gl_InstanceID) * 7.0, 63.0) + 1.0;
  #endif
  vec4 world = model * vec4(transformed, 1.0);
  vFoot = world.y - aFoot - model[3].y;
  #ifdef ATLAS
    // Ancre des hachures du personnage: elles le suivent sans glisser, à pas constant à l'écran.
    vec4 anchor = projectionMatrix * viewMatrix * vec4(model[3].xyz, 1.0);
    vAnchor = (anchor.xy / anchor.w * 0.5 + 0.5) * uScreen;
  #else
    world.xyz = sway(world.xyz, model[3].xyz, aMeta.z, vFoot, position);
  #endif
  vWorld = world.xyz;
  vNormal = normalize(mat3(model) * objectNormal);
  vColor = aColor;
  vUv = uv;
  vMeta = meta;
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
uniform vec4 uGlint;
uniform vec4 uFlameGlow;
uniform vec3 uViewDir;
#ifdef ATLAS
  in vec2 vFaceUv;
  flat in vec2 vAnchor;
  uniform sampler2D uAtlas;
  uniform sampler2D uTraits;
  uniform float uCell;
  uniform vec2 uTraitGrid;
  uniform vec2 uCharacter;
#endif
uniform vec3 uDetail;
${LIGHTING}
void main() {
  vec3 N = normalize(vNormal);
  #ifdef ATLAS
    // Personnage: couleur, plis et hauteur viennent de son atlas (les niveaux de loin de l'atlas
    // sont des aplats: le détail s'efface de lui-même quand la vue s'élargit).
    vec4 texel = texture(uAtlas, vUv, -1.0);
    vec3 skin = texel.rgb;
    float body = vMeta.z;
    bool onFace = vFaceUv.x > 0.0 && vFaceUv.x < 1.0 && vFaceUv.y > 0.0 && vFaceUv.y < 1.0;
    // Traits à la plume. Un trait de deux points de l'atlas ferait moins d'un demi-point sur un
    // visage de trente points: on le lit un niveau et demi plus fin, et on l'épaissit en prenant
    // le plus fort de cinq points voisins (un demi-point d'écran autour). Coût: sur le seul visage.
    vec2 cell = vec2(mod(uCell, uTraitGrid.x), floor(uCell / uTraitGrid.x));
    vec2 fuv = (vFaceUv + cell) / uTraitGrid;
    vec2 fdx = dFdx(fuv) * 0.6;
    vec2 fdy = dFdy(fuv) * 0.6;
    if (onFace) {
      vec4 face = texture(uTraits, fuv, -1.5);
      float around = max(
        max(texture(uTraits, fuv + fdx, -1.5).a, texture(uTraits, fuv - fdx, -1.5).a),
        max(texture(uTraits, fuv + fdy, -1.5).a, texture(uTraits, fuv - fdy, -1.5).a));
      float line = clamp(max(face.a, around * 0.9) * 1.6, 0.0, 1.0);
      vec3 pen = mix(uInk * 1.5, face.rgb, smoothstep(0.1, 0.6, face.a));
      skin = mix(skin, pen, line * uDetail.z);
    }
    // Relief: la carte de hauteur (1 = 2 cm) incline la normale, donc le choix du ton. Le visage
    // n'en reçoit pas: une ombre simple à deux tons, sans tache.
    vec3 sx = dFdx(vWorld);
    vec3 sy = dFdy(vWorld);
    vec3 r1 = cross(sy, N);
    vec3 r2 = cross(N, sx);
    float det = dot(sx, r1);
    vec3 grad = sign(det) * (dFdx(texel.a) * r1 + dFdy(texel.a) * r2);
    vec3 bent = normalize(abs(det) * N - 0.036 * uRelief.x * body * grad);
    vec3 lightN = body > 0.5 ? bent : N;
    // Ni noir plein ni hachure du décor sur un personnage: des aplats francs, une ombre relevée.
    // Le visage est presque toujours relevé vers le clair: l'ombre de la frange ne le mange pas.
    // Teintes un peu poussées: de haut et de loin, chaque personnage se lit à sa couleur.
    skin = clamp(mix(vec3(dot(skin, vec3(0.3, 0.59, 0.11))), skin, 1.18) * 1.08, 0.0, 1.0);
    vec3 color = inkLight(skin, vWorld, N, lightN, vFoot, 0.0, max(uCharacter.x, 1.0 - body));
    float ndl = dot(lightN, uSunDir);
    // Troisième ton dans les creux, et hachures de près seulement, ancrées au personnage.
    color *= mix(1.0, 0.82, smoothstep(-0.42, -0.5, ndl) * body);
    vec2 q = gl_FragCoord.xy - vAnchor;
    float stripe = fract((q.x - q.y * 0.85) / 5.5);
    float pen = smoothstep(-0.25, -0.8, ndl);
    color = mix(color, uInk, step(stripe, 0.3 * pen) * uDetail.y * body * 0.8 * uPainted);
    // Liseré clair du côté du soleil: il détache la silhouette du décor.
    float rim = smoothstep(0.56, 0.64, 1.0 - dot(N, uViewDir)) * smoothstep(0.0, 0.12, dot(N, uSunDir));
    color = mix(color, min(color * 1.35 + 0.08, vec3(1.0)), rim * uCharacter.y);
    gColor = vec4(color, 1.0);
    // Le visage porte le numéro de morceau « peau lisse »: l'encrage n'y trace aucune arête.
    gAux = vec4(packNormal(N), vMeta.w / 255.0, vMeta.y / 255.0);
  #else
    float kind = vMeta.z;
    float leafy = step(2.5, kind) * step(kind, 3.5);
    vec4 drawn = texture(uLayers, vec3(vUv, vMeta.x));
    // Feuillage: les accents de feuilles bousculent davantage la normale ronde, et le bord de
    // l'ombre devient dentelé.
    vec3 bent = reliefNormal(N, vWorld, vUv, (drawn.ba - 0.5) * (2.0 + leafy * 2.5));
    // Second ton peint: la tache de la texture fait passer du ton clair au ton de base.
    vec3 base = vColor * mix(1.0, 0.85, smoothstep(0.4, 0.6, drawn.g) * uPainted);
    // Hachures, noirs et pied encré: sur les grands objets et leurs grands morceaux seulement.
    float big = step(floor(vMeta.y / 64.0), 1.5) * step(floor(vMeta.w / 64.0), 1.5);
    vec3 color = inkLight(base, vWorld, N, bent, vFoot, big, 0.0);
    // Noir plein sous les touffes, du côté détourné du soleil: c'est lui qui détache une masse
    // de la suivante (la brume et les lampes restent par-dessus: il ne troue pas la nuit).
    float under = leafy * smoothstep(0.0, -0.16, N.y) * smoothstep(0.3, -0.05, dot(N, uSunDir));
    color = mix(color, uInk, under * 0.9 * uPainted);
    // Le trait peint des textures s'efface quand la vue s'élargit: de loin, un aplat propre.
    color = mix(color, uInk, drawn.r * uPainted * uDetail.x);
    float pane = step(0.5, kind) * step(kind, 1.5);
    float flame = step(1.5, kind) * step(kind, 2.5);
    if (pane > 0.5) {
      // Vitre. Éclairée de l'intérieur: un aplat chaud. De jour: le reflet du ciel dessiné en
      // deux bandes obliques nettes, qui glissent sur la vitre quand la caméra tourne.
      vec2 tangent = vec2(-N.z, N.x);
      float d = dot(vWorld.xz, tangent) + vWorld.y * 0.75 + dot(uViewDir.xz, tangent) * 0.9;
      float band = step(fract(d * 0.85), 0.2) + step(abs(fract(d * 0.85) - 0.34), 0.035);
      color = mix(color, uGlint.rgb, min(band, 1.0) * uGlint.a);
      color = mix(color, uWindowGlow.rgb, uWindowGlow.a);
    }
    color = mix(color, uFlameGlow.rgb, flame * uFlameGlow.a);
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
 * bruit, ce qui donne un bord franc et sinueux; le bord est cerné d'un trait interrompu. Le sol
 * est un vrai terrain: la carte porte aussi sa pente (canaux B et A). Les trois tons de l'herbe
 * suivent cette pente (le versant tourné vers le soleil s'éclaircit, l'autre fonce), les talus du
 * chemin et les ornières prennent le clair d'un côté et l'ombre de l'autre, les creux (fossé)
 * foncent. Cailloux et ballast gardent en plus leur petit relief de texture.
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
uniform vec3 uDetail;
${LIGHTING}
float edgeLine(float field, float width) {
  float w = fwidth(field) * width;
  return 1.0 - smoothstep(w * 0.6, w, abs(field));
}
void main() {
  vec2 g = vWorld.xz;
  vec4 mask = texture(uMask, (g - uMaskRect.xy) / uMaskRect.zw);
  vec2 terrain = (mask.ba - 128.0 / 255.0) * (255.0 / 127.0);
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
  // De près, la terre retrouve sa matière: un lit de gravillons (le carreau du ballast, trois
  // fois plus serré) dont le relief accroche la lumière, et dont le trait revient avec le zoom.
  vec4 grit = texture(uLayers, vec3(turn * g / 1.15 + 0.17, ${LAYER.ballast}.0));
  float near = uDetail.y;

  // Herbe: trois tons en grandes plages qui suivent le modelé du terrain. La pente vraie compte
  // le plus; un reste de bruit garde de la vie aux endroits plats. Les plages se déplacent avec
  // l'heure, comme sur un pré bosselé.
  vec2 sunFlat = normalize(uSunDir.xz + 1e-4);
  vec2 lay = vec2(big.r + mid.b * 0.7, big.g + mid.r * 0.7) - 0.85;
  float tilt = -dot(terrain, sunFlat);
  float toward = dot(lay, sunFlat) * 0.42 + tilt * 3.0;
  float lightPatch = step(0.13, toward);
  float darkPatch = step(toward, -0.15);
  float hollow = smoothstep(-0.07, -0.2, vWorld.y);
  vec3 grass = mix(uGrass[1], uGrass[0], lightPatch);
  grass = mix(grass, uGrass[2], max(darkPatch, step(0.5, tuftB.g) * 0.6));
  grass = mix(grass, uGrass[2] * 0.74, hollow);
  float thick = max(smoothstep(0.42, 0.5, mid.g), hollow);
  float grassInk = max(tuftA.r * thick, tuftB.r * (1.0 - thick * 0.6));

  vec3 earth = mix(uDirt[0], uDirt[1], step(0.5, soil.g));
  // Talus et ornières: le bord tourné vers le soleil prend le clair, l'autre un ton de plus.
  earth = mix(earth, uDirt[1] * 0.8, step(tilt * 3.0, -0.45));
  earth = mix(earth, min(uDirt[0] * 1.07, vec3(1.0)), step(0.5, tilt * 3.0));
  // Lisière: une bande plus sombre de terre sous le bord de l'herbe (bible 3.6), puis le trait.
  earth = mix(earth, uDirt[1] * 0.82, step(dirtField, 0.05 + small.g * 0.07) * dirt);
  vec3 rock = mix(uBallast[0], uBallast[1], step(0.5, stones.g));

  vec3 base = mix(grass, earth, dirt);
  base = mix(base, rock, ballast);
  float ink = mix(grassInk, max(soil.r, grit.r * near * step(0.42, small.b)), dirt);
  ink = mix(ink, stones.r, ballast);
  float border = edgeLine(dirtField, 2.2) * step(0.33, small.b) * (1.0 - ballast);
  border = max(border, edgeLine(ballastField, 2.4) * step(0.3, small.r));
  ink = max(ink, border) * uPainted;

  vec2 slope = mix(vec2(0.0), (soil.ba - 0.5) * 2.0 + (grit.ba - 0.5) * 1.6 * near, dirt);
  slope = mix(slope, (stones.ba - 0.5) * 2.0, ballast);
  vec3 ground = normalize(vec3(-terrain.x, 1.0, -terrain.y));
  vec3 bent = normalize(ground - vec3(slope.x, 0.0, slope.y) * uRelief.x * uPainted);
  vec3 color = inkLight(base, vWorld, ground, bent, 100.0, 1.0, 0.0);
  color = mix(color, uInk, ink);
  gColor = vec4(color, 1.0);
  gAux = vec4(packNormal(vec3(0.0, 1.0, 0.0)), 0.0, 0.0);
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
in vec4 aMeta;
in float aFoot;
${SWAY}
#include <skinning_pars_vertex>
void main() {
  vec3 transformed = position;
  #include <skinbase_vertex>
  #include <skinning_vertex>
  mat4 model = modelMatrix;
  #ifdef USE_INSTANCING
    model = modelMatrix * instanceMatrix;
  #endif
  vec4 world = model * vec4(transformed, 1.0);
  #ifndef USE_SKINNING
    world.xyz = sway(world.xyz, model[3].xyz, aMeta.z, world.y - aFoot - model[3].y, position);
  #endif
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export interface InkMaterials {
  readonly object: THREE.ShaderMaterial;
  readonly ground: THREE.ShaderMaterial;
  readonly contact: THREE.ShaderMaterial;
  /** Matière des passes d'ombre: profondeur seule. */
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
      ...common,
      vertexShader: DEPTH_VERTEX,
      fragmentShader: 'void main() {}',
      colorWrite: false,
      side: THREE.DoubleSide,
    }),
  };
}

/**
 * Matière d'un personnage animé: le nuanceur des volumes, variante `ATLAS`. Tous les
 * personnages partagent le même programme; seuls changent l'atlas, les traits et l'expression.
 */
export function createCharacterMaterial(
  uniforms: InkUniforms,
  atlas: THREE.Texture,
  traits: THREE.Texture,
  grid: readonly [number, number],
  expression: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...uniforms,
      uAtlas: { value: atlas },
      uTraits: { value: traits },
      uTraitGrid: { value: new THREE.Vector2(grid[0], grid[1]) },
      uCell: { value: expression },
    },
    glslVersion: THREE.GLSL3,
    defines: { ATLAS: 1 },
    vertexShader: OBJECT_VERTEX,
    fragmentShader: OBJECT_FRAGMENT,
  });
}

const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

function renderDepth(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  depthMaterial: THREE.Material,
  target: THREE.WebGLRenderTarget,
  camera: THREE.Camera,
): void {
  const previous = scene.overrideMaterial;
  scene.overrideMaterial = depthMaterial;
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  scene.overrideMaterial = previous;
}

function depthTarget(size: number): THREE.WebGLRenderTarget {
  const depth = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
  depth.compareFunction = THREE.LessEqualCompare;
  depth.minFilter = THREE.LinearFilter;
  depth.magFilter = THREE.LinearFilter;
  return new THREE.WebGLRenderTarget(size, size, { depthTexture: depth });
}

/** Passe d'ombre de l'essai: une carte de profondeur vue du soleil, cadrée sur la vue. */
export class SunShadow {
  readonly target: THREE.WebGLRenderTarget;
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
  private readonly size: number;

  constructor(size: number) {
    this.size = size;
    this.target = depthTarget(size);
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
    // Le centre du cadre avance par texels entiers: le bord des ombres ne scintille pas quand
    // la vue glisse.
    this.camera.updateMatrixWorld();
    const texel = (radius * 2) / this.size;
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const back = new THREE.Vector3();
    this.camera.matrixWorld.extractBasis(right, up, back);
    const alongRight = this.camera.position.dot(right);
    const alongUp = this.camera.position.dot(up);
    this.camera.position
      .addScaledVector(right, Math.round(alongRight / texel) * texel - alongRight)
      .addScaledVector(up, Math.round(alongUp / texel) * texel - alongUp);
    this.camera.left = -radius;
    this.camera.right = radius;
    this.camera.top = radius;
    this.camera.bottom = -radius;
    this.camera.near = 10;
    this.camera.far = 170;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    renderDepth(renderer, scene, depthMaterial, this.target, this.camera);
    uniforms.uShadowMap.value = this.target.depthTexture;
    uniforms.uShadowTexel.value = 1 / this.size;
    uniforms.uShadowMatrix.value
      .copy(BIAS)
      .multiply(this.camera.projectionMatrix)
      .multiply(this.camera.matrixWorldInverse);
  }
}

/**
 * Ombre locale: une seule lampe à la fois (la plus proche du joueur) porte une ombre, par une
 * petite carte de profondeur en cône sous la lampe. Coût: une passe de profondeur de plus sur
 * les seuls objets du cône, et cinq lectures par point éclairé.
 */
export class LampShadow {
  readonly target: THREE.WebGLRenderTarget;
  readonly camera = new THREE.PerspectiveCamera(120, 1, 0.3, 12);
  private readonly size: number;
  private ready = false;

  constructor(size: number) {
    this.size = size;
    this.target = depthTarget(size);
    // Calque 2: le décor bâti et les personnages. Le semis et les arbres n'y sont pas: leur
    // ombre de lampe ne se verrait pas, et la passe reste trois fois plus légère.
    this.camera.layers.set(2);
  }

  /** `index`: place de la lampe dans la liste des lampes de la scène; -1 éteint l'ombre locale. */
  update(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    depthMaterial: THREE.Material,
    uniforms: InkUniforms,
    lamp: Lamp | null,
    index: number,
  ): void {
    uniforms.uLampShadowMap.value = this.target.depthTexture;
    if (!lamp?.shadowFov || index < 0) {
      uniforms.uLampCaster.value = -1;
      if (!this.ready) {
        // La carte doit exister même éteinte: le nuanceur la déclare, WebGL veut une texture
        // de profondeur valide derrière.
        renderer.setRenderTarget(this.target);
        renderer.clear();
        renderer.setRenderTarget(null);
        this.ready = true;
      }
      return;
    }
    this.ready = true;
    this.camera.fov = lamp.shadowFov;
    // Le plan proche passe sous la lampe elle-même: sa cage ne fait pas d'ombre sur tout.
    this.camera.near = 0.28;
    this.camera.far = lamp.y + lamp.radius;
    this.camera.position.set(lamp.x, lamp.y, lamp.z);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(lamp.x, lamp.y - 1, lamp.z);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    renderDepth(renderer, scene, depthMaterial, this.target, this.camera);
    uniforms.uLampCaster.value = index;
    uniforms.uLampShadowTexel.value = 1 / this.size;
    uniforms.uLampShadowMatrix.value
      .copy(BIAS)
      .multiply(this.camera.projectionMatrix)
      .multiply(this.camera.matrixWorldInverse);
  }
}
