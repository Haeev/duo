/**
 * Rendu encré: le matériau partagé et la lumière qu'il porte (ADR 0023). Aucun matériau standard
 * de Three.js: pas d'éclairage physique, pas de brillance. Tout se calcule en couleurs d'écran
 * (sRGB): un aplat ressort tel qu'il est écrit, multiplié par un des trois tons de la lumière.
 *
 * Un seul nuanceur de volumes pour le sol, le décor, le semis instancié, la végétation et les
 * personnages (variantes `CHARACTER` et `ATLAS`, squelette et morphoses compris). Il écrit deux
 * sorties: la couleur, et une seconde image (normale, numéro de morceau, numéro de pièce) que la
 * passe de contour lit ensuite pour tracer le trait.
 *
 * Ce que le nuanceur attend d'une géométrie: `position`, `normal`, une couleur de sommet
 * (`color`, linéaire, comme partout dans le moteur) et, s'il existe, `aInk` (x couche de traits,
 * y code de pièce, z nature, w code de morceau; voir `couches.ts` et `conversion.ts`). Sans
 * `aInk`, la pièce est rangée d'après sa place et la taille de son instance: une forme unité
 * instanciée n'a rien à déclarer.
 */
import {
  Color,
  CustomBlending,
  type DataArrayTexture,
  DoubleSide,
  DstAlphaFactor,
  DstColorFactor,
  GLSL3,
  type IUniform,
  Matrix4,
  ShaderMaterial,
  type ShaderMaterialParameters,
  type Texture,
  Vector2,
  Vector3,
  Vector4,
  ZeroFactor,
} from 'three';
import type { Ambiance } from './ambiances';
import { LAYER, SLEEK_PART, TILE_METRES } from './couches';
import { INK_SETTINGS } from './reglages';

export const MAX_LAMPS = 4;
export const MAX_WINDOWS = 8;

export interface Lamp {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
  /** La lampe peut porter l'ombre locale (une seule à la fois, la plus proche du joueur). */
  readonly shadow: boolean;
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

/** Uniformes communs: une seule instance, partagée par tous les matériaux encrés. */
export interface InkUniforms {
  [name: string]: IUniform;
  uSunDir: IUniform<Vector3>;
  uLit: IUniform<Vector3>;
  uHalf: IUniform<Vector3>;
  uShade: IUniform<Vector3>;
  uInk: IUniform<Vector3>;
  /** x hachures de l'ombre propre, y de l'ombre portée, z noirs pleins, w part de l'ombre du soleil. */
  uHatch: IUniform<Vector4>;
  uRelief: IUniform<Vector2>;
  /** Détail selon le zoom (0 à 1): x trait peint des textures, y hachures, z traits du visage. */
  uDetail: IUniform<Vector3>;
  /** Personnages: x ombre relevée, y liseré clair, z saturation, w gain. */
  uCharacter: IUniform<Vector4>;
  uViewDir: IUniform<Vector3>;
  /** Taille de la cible de la scène (points): elle suit l'échelle interne. */
  uScreen: IUniform<Vector2>;
  /** Points de la cible par point de l'écran de référence: tout ce qui se compte en points le suit. */
  uPixel: IUniform<number>;
  uTime: IUniform<number>;
  /** Vent: direction au sol fois la force (0: air immobile). */
  uWind: IUniform<Vector2>;
  uLampPos: IUniform<Vector4[]>;
  uLampColor: IUniform<Vector3>;
  /** Numéro de la lampe qui porte l'ombre locale (-1: aucune). */
  uLampCaster: IUniform<number>;
  uLampShadowMap: IUniform<Texture | null>;
  uLampShadowMatrix: IUniform<Matrix4>;
  uLampShadowTexel: IUniform<number>;
  uWinA: IUniform<Vector4[]>;
  uWinB: IUniform<Vector4[]>;
  uWinColor: IUniform<Vector4>;
  uWindowGlow: IUniform<Vector4>;
  uGlint: IUniform<Vector4>;
  uFlameGlow: IUniform<Vector4>;
  /** Brume au sol: x force, y épaisseur en mètres. */
  uMist: IUniform<Vector2>;
  uMistColor: IUniform<Vector3>;
  uShadowMap: IUniform<Texture | null>;
  uShadowMatrix: IUniform<Matrix4>;
  uShadowTexel: IUniform<number>;
  uLayers: IUniform<DataArrayTexture | null>;
  uNoise: IUniform<Texture | null>;
  /** Carte du sol du lieu: teinte de chaque case, couche de traits et dureté dans l'alpha. */
  uGroundMap: IUniform<Texture | null>;
  /** xy décalage, zw échelle (mètres vers la carte); z nul: pas de carte, teinte de repli. */
  uGroundRect: IUniform<Vector4>;
  /** Sol sans carte: teinte (sRGB) et code de couche. */
  uGroundFallback: IUniform<Vector4>;
  /** x ton clair de l'herbe, y ton sombre, z ondulation des bords (m), w échelle des motifs serrés. */
  uGroundTones: IUniform<Vector4>;
  /** Eau: x ton clair, y ton sombre, z vitesse. */
  uWater: IUniform<Vector3>;
}

export function createInkUniforms(): InkUniforms {
  const four = (count: number): Vector4[] => Array.from({ length: count }, () => new Vector4());
  const g = INK_SETTINGS.ground;
  const fallback = new Color(g.fallback.color);
  return {
    uSunDir: { value: new Vector3(0, 1, 0) },
    uLit: { value: new Vector3(1, 1, 1) },
    uHalf: { value: new Vector3(1, 1, 1) },
    uShade: { value: new Vector3(1, 1, 1) },
    uInk: { value: new Vector3() },
    uHatch: { value: new Vector4() },
    uRelief: { value: new Vector2(1.3, 1) },
    uDetail: { value: new Vector3(1, 1, 1) },
    uCharacter: {
      value: new Vector4(0.3, 0.2, INK_SETTINGS.character.saturation, INK_SETTINGS.character.gain),
    },
    uViewDir: { value: new Vector3(0, 1, 0) },
    uScreen: { value: new Vector2(1366, 768) },
    uPixel: { value: 1 },
    uTime: { value: 0 },
    uWind: { value: new Vector2() },
    uLampPos: { value: four(MAX_LAMPS) },
    uLampColor: { value: new Vector3() },
    uLampCaster: { value: -1 },
    uLampShadowMap: { value: null },
    uLampShadowMatrix: { value: new Matrix4() },
    uLampShadowTexel: { value: 1 / INK_SETTINGS.lampShadow.size },
    uWinA: { value: four(MAX_WINDOWS) },
    uWinB: { value: four(MAX_WINDOWS) },
    uWinColor: { value: new Vector4() },
    uWindowGlow: { value: new Vector4() },
    uGlint: { value: new Vector4() },
    uFlameGlow: { value: new Vector4() },
    uMist: { value: new Vector2() },
    uMistColor: { value: new Vector3() },
    uShadowMap: { value: null },
    uShadowMatrix: { value: new Matrix4() },
    uShadowTexel: { value: 1 / INK_SETTINGS.sunShadow.size },
    uLayers: { value: null },
    uNoise: { value: null },
    uGroundMap: { value: null },
    uGroundRect: { value: new Vector4(0, 0, 0, 0) },
    uGroundFallback: {
      // Teinte d'écran telle qu'écrite (sRGB): `getHexString` la rend sans conversion.
      value: new Vector4(
        Number.parseInt(fallback.getHexString().slice(0, 2), 16) / 255,
        Number.parseInt(fallback.getHexString().slice(2, 4), 16) / 255,
        Number.parseInt(fallback.getHexString().slice(4, 6), 16) / 255,
        LAYER[g.fallback.layer] + 16,
      ),
    },
    uGroundTones: { value: new Vector4(g.grassTones[0], g.grassTones[1], g.warp, g.fineScale) },
    uWater: {
      value: new Vector3(
        INK_SETTINGS.water.light,
        INK_SETTINGS.water.dark,
        INK_SETTINGS.water.speed,
      ),
    },
  };
}

/** Pose une ambiance, les lampes et les fenêtres proches dans les uniformes communs. */
export function applyAmbiance(
  uniforms: InkUniforms,
  ambiance: Readonly<Ambiance>,
  lamps: readonly Lamp[],
  windows: readonly WindowLight[],
): void {
  uniforms.uLit.value.set(...ambiance.lit);
  uniforms.uHalf.value.set(...ambiance.half);
  uniforms.uShade.value.set(...ambiance.shade);
  uniforms.uInk.value.set(...ambiance.ink);
  uniforms.uHatch.value.set(
    ambiance.hatchOwn,
    ambiance.hatchCast,
    ambiance.blackFill,
    ambiance.sunShadow,
  );
  uniforms.uRelief.value.set(ambiance.relief, ambiance.grime);
  uniforms.uCharacter.value.x = ambiance.characterLift;
  uniforms.uCharacter.value.y = ambiance.characterRim;
  const lit = ambiance.lamps > 0;
  uniforms.uLampPos.value.forEach((slot, i) => {
    const lamp = lamps[i];
    if (lamp !== undefined && lit) slot.set(lamp.x, lamp.y, lamp.z, lamp.radius);
    else slot.set(0, 0, 0, 0);
  });
  uniforms.uLampColor.value.set(...ambiance.lampColor).multiplyScalar(ambiance.lamps);
  const spill = ambiance.windowAmount > 0 && ambiance.spill > 0;
  uniforms.uWinA.value.forEach((slot, i) => {
    const w = spill ? windows[i] : undefined;
    const other = uniforms.uWinB.value[i];
    if (w !== undefined) {
      slot.set(w.x, w.sill, w.z, w.width / 2);
      other?.set(w.nx, w.nz, w.height, 1);
    } else {
      slot.set(0, 0, 0, 0);
      other?.set(0, 0, 0, 0);
    }
  });
  uniforms.uWinColor.value.set(...ambiance.lampColor, spill ? ambiance.spill : 0);
  uniforms.uWindowGlow.value.set(...ambiance.windowGlow, ambiance.windowAmount);
  uniforms.uGlint.value.set(...ambiance.glint, ambiance.glintAmount);
  uniforms.uFlameGlow.value.set(1.0, 0.86, 0.5, lit ? 1 : 0);
  uniforms.uMist.value.set(ambiance.mist, ambiance.mistTop);
  uniforms.uMistColor.value.set(...ambiance.mistColor);
  const windAngle = (ambiance.windAzimuth * Math.PI) / 180;
  uniforms.uWind.value.set(Math.sin(windAngle), -Math.cos(windAngle)).multiplyScalar(ambiance.wind);
}

/**
 * Le vent, commun au rendu et à la passe d'ombre (sinon l'ombre d'un arbre ne suivrait pas son
 * feuillage). Tout ce qui est souple (nature 3: feuillage, 4: tige) plie selon sa hauteur
 * au-dessus de son pied; chaque pied a sa phase, tirée de sa place.
 */
const SWAY = /* glsl */ `
uniform float uTime;
uniform vec2 uWind;
vec3 sway(vec3 world, vec3 origin, float kind, float above, vec3 local) {
  if (kind < 2.5 || kind > 4.5) return world;
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
 * La lumière encrée.
 *
 * 1. Relief: la pente lue dans la texture (canaux B et A) penche la normale avant tout calcul.
 * 2. Trois tons francs (clair, demi-teinte, ombre) selon l'angle au soleil. L'ombre est une
 *    couleur de l'ambiance (prune le soir, bleu la nuit), jamais un simple assombrissement.
 * 3. Ombre portée: carte de profondeur lue en cinq points filtrés, puis seuillée; le point lu se
 *    décale selon un bruit: bord net, sans escalier, pas tout à fait droit.
 * 4. Lampes: une flaque à deux anneaux nets par lampe, qui efface hachures et noirs. La lampe la
 *    plus proche du joueur porte une ombre (seconde carte de profondeur, en cône).
 * 5. Fenêtres éclairées: chacune pose sur le sol dehors le rectangle de sa lumière, croisillon
 *    compris (calcul direct, sans texture ni passe).
 * 6. Encre de l'ombre: hachures ancrées au monde, serrées dans l'ombre propre, lâches dans
 *    l'ombre portée; aplats d'encre pleine la nuit; pied des objets noirci et hachuré.
 * 7. Brume au sol: deux voiles à bord net qui dérivent.
 */
const LIGHTING = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uLit;
uniform vec3 uHalf;
uniform vec3 uShade;
uniform vec3 uInk;
uniform vec4 uHatch;
uniform vec2 uRelief;
uniform vec4 uLampPos[${String(MAX_LAMPS)}];
uniform vec3 uLampColor;
uniform float uLampCaster;
uniform highp sampler2DShadow uLampShadowMap;
uniform mat4 uLampShadowMatrix;
uniform float uLampShadowTexel;
uniform vec4 uWinA[${String(MAX_WINDOWS)}];
uniform vec4 uWinB[${String(MAX_WINDOWS)}];
uniform vec4 uWinColor;
uniform vec2 uMist;
uniform vec3 uMistColor;
uniform float uTime;
uniform highp sampler2DShadow uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uShadowTexel;
uniform mediump sampler2DArray uLayers;
uniform sampler2D uNoise;

float sunSeen(vec3 wp, vec3 N, vec2 tremble) {
  // Ambiance sans ombre du soleil (dedans): cinq lectures de moins, la carte n'est pas dessinée.
  if (uHatch.w <= 0.0) return 1.0;
  // Le bord tremble parce que le point lu se décale de quelques centimètres, pas le seuil.
  vec4 sc = uShadowMatrix * vec4(wp + N * 0.03 + vec3(tremble.x, 0.0, tremble.y), 1.0);
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0) return 1.0;
  float z = sc.z - 0.0009;
  float t = uShadowTexel * 1.3;
  // Lecture au niveau 0 (la carte n'a pas d'autres niveaux): permise dans une branche.
  float seen = textureLod(uShadowMap, vec3(sc.xy, z), 0.0) * 0.4
    + textureLod(uShadowMap, vec3(sc.xy + vec2(t, t * 0.4), z), 0.0) * 0.15
    + textureLod(uShadowMap, vec3(sc.xy + vec2(-t * 0.4, t), z), 0.0) * 0.15
    + textureLod(uShadowMap, vec3(sc.xy + vec2(-t, -t * 0.4), z), 0.0) * 0.15
    + textureLod(uShadowMap, vec3(sc.xy + vec2(t * 0.4, -t), z), 0.0) * 0.15;
  return mix(1.0, smoothstep(0.42, 0.58, seen), uHatch.w);
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
  for (int i = 0; i < ${String(MAX_WINDOWS)}; i++) {
    if (uWinB[i].w < 0.5) continue;
    vec2 n = uWinB[i].xy;
    vec3 c = uWinA[i].xyz;
    vec2 rel = wp.xz + tremble - c.xz;
    float outward = dot(rel, n);
    if (outward < 0.03 || outward > ${INK_SETTINGS.lights.windowReach.toFixed(2)} || wp.y > c.y + 0.2) continue;
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
  float facing = smoothstep(0.05, 0.09, ndl);
  // Une face détournée du soleil est à l'ombre quoi que dise la carte (la valeur lue n'y sert à rien:
  // elle n'est prise que multipliée par facing): ses cinq lectures sont épargnées.
  float seen = facing > 0.0 ? sunSeen(wp, flatN, tremble) : 1.0;
  float full = smoothstep(0.46, 0.5, ndl);
  float sun = seen * facing;
  vec3 light = mix(uShade, mix(uHalf, uLit, full), sun);
  // Au-delà de 0,95 (le masque du visage), c'est le ton clair lui-même qui est garanti.
  light = mix(light, max(light, mix(uHalf, uLit, 0.4 + 0.55 * step(0.95, lift))), min(lift, 1.0));

  float pool = 0.0;
  float casterSeen = uLampCaster >= 0.0 ? lampSeen(wp, flatN, tremble * 0.6) : 1.0;
  for (int i = 0; i < ${String(MAX_LAMPS)}; i++) {
    float radius = uLampPos[i].w;
    if (radius > 0.0) {
      vec3 d = uLampPos[i].xyz - wp;
      vec3 dn = normalize(d);
      float reach = length(d) / radius + (nz.g - 0.5) * 0.12 + (fine.g - 0.5) * 0.05;
      float lampFacing = smoothstep(0.0, 0.08, dot(N, dn));
      float ring = (1.0 - smoothstep(0.97, 1.0, reach)) * 0.45 + (1.0 - smoothstep(0.56, 0.59, reach)) * 0.55;
      float visible = abs(float(i) - uLampCaster) < 0.5 ? casterSeen : 1.0;
      pool = max(pool, ring * lampFacing * visible);
    }
  }
  float spill = uWinColor.a > 0.0 ? windowSpill(wp, N, tremble * 0.5) : 0.0;
  light += uLampColor * pool + uWinColor.rgb * uWinColor.a * spill;
  float glow = max(pool, spill);
  vec3 color = base * light;

  // Plan de projection des hachures choisi par la normale: une seule lecture de texture.
  vec3 an = abs(flatN);
  vec2 huv = an.y > 0.7 ? wp.xz : (an.x > an.z ? wp.zy : wp.xy);
  vec2 hatch = texture(uLayers, vec3(huv / ${TILE_METRES.toFixed(1)}, ${String(LAYER.hatch)}.0)).rg;
  float away = 1.0 - smoothstep(0.0, 0.08, ndl);
  float own = away * (1.0 - sun);
  float thrown = (1.0 - seen) * facing;
  // La densité suit la lumière: hachures lâches à peine détourné, serrées franchement à l'ombre.
  float deep = smoothstep(-0.15, -0.45, ndl);
  float ownHatch = mix(hatch.g, max(hatch.r, hatch.g), deep);
  float dark = max(own * ownHatch * uHatch.x, thrown * hatch.g * uHatch.y) * uDetail.y;
  float black = own * step(1.0 - uHatch.z * 0.6, nz.b * 0.75 + fine.b * 0.25 + deep * 0.12);
  dark = max(dark, black) * (1.0 - glow) * inkGain;

  // Pied de l'objet: un liseré d'encre pleine au ras du sol, puis des hachures qui s'éclaircissent.
  float upright = (1.0 - smoothstep(0.45, 0.7, an.y)) * step(-0.02, foot);
  float base0 = upright * step(foot, 0.03 + fine.r * 0.06);
  float damp = upright * (1.0 - smoothstep(0.0, 0.2 + nz.g * 0.45, foot)) * hatch.g * uDetail.y;
  dark = max(dark, max(base0, damp) * uRelief.y * inkGain);
  color = mix(color, uInk, dark);

  // Brume: deux nappes qui dérivent en sens contraires; le seuil du bruit monte avec la hauteur.
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
  return normalize(N - (T * slope.x + B * slope.y) * uRelief.x);
}

// Normale sur deux canaux (octaèdre): les deux autres portent les numéros de morceau et de pièce.
vec2 packNormal(vec3 n) {
  n /= abs(n.x) + abs(n.y) + abs(n.z);
  vec2 e = n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
  return e * 0.5 + 0.5;
}
`;

/**
 * Sommets. Le squelette, les morphoses, l'instanciation et le vent passent tous par ici: un
 * personnage animé, une façade fusionnée et un houppier instancié sortent du même source.
 */
const VOLUME_VERTEX = /* glsl */ `
in vec4 aInk;
uniform vec3 uTint;
uniform vec4 uOwn;
out vec3 vWorld;
out vec3 vLocal;
out vec3 vNormal;
out vec3 vColor;
out float vFoot;
flat out vec4 vMeta;
flat out float vSwap;
#if defined(CHARACTER) || defined(ATLAS)
  flat out vec2 vAnchor;
  uniform vec2 uScreen;
#endif
#ifdef ATLAS
  in vec2 aFaceUv;
  out vec2 vUv;
  out vec2 vFaceUv;
  uniform sampler2D uAtlas;
#endif
${SWAY}
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
vec3 toScreen(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
void main() {
  vec3 transformed = position;
  vec3 objectNormal = normal;
  #ifdef ATLAS
    vUv = uv;
    vFaceUv = aFaceUv;
    // Relief des vêtements: la hauteur peinte dans l'atlas (canal alpha) pousse les sommets.
    transformed += normalize(objectNormal) * (textureLod(uAtlas, uv, 0.0).a - 0.44) * aInk.x;
  #endif
  #include <morphinstance_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <morphtarget_vertex>
  #include <skinning_vertex>
  mat4 model = modelMatrix;
  #ifdef USE_INSTANCING
    model = modelMatrix * instanceMatrix;
  #endif
  vec4 world = model * vec4(transformed, 1.0);
  vec3 origin = model[3].xyz;
  vec3 scale2 = vec3(dot(model[0].xyz, model[0].xyz), dot(model[1].xyz, model[1].xyz), dot(model[2].xyz, model[2].xyz));

  float swap = step(7.5, aInk.z);
  float kind = aInk.z - swap * 8.0;
  float code = aInk.y;
  float sizeBits = floor(code / 64.0);
  float number = code - sizeBits * 64.0;
  float part = aInk.w;
  if (code < 0.5) {
    // Forme unité instanciée: sa classe de taille se lit dans l'échelle de l'instance.
    float diagonal = sqrt(scale2.x + scale2.y + scale2.z);
    sizeBits = diagonal >= 2.5 ? 0.0 : (diagonal >= 1.0 ? 1.0 : (diagonal >= 0.4 ? 2.0 : 3.0));
    part = sizeBits * 64.0 + 1.0;
  }
  // Le numéro tourne d'une place à l'autre: deux exemplaires voisins du même modèle ont chacun
  // leur contour.
  float turn = fract(sin(dot(origin.xz, vec2(12.9898, 78.233)) + origin.y * 37.719) * 43758.5453);
  number = mod(number + floor(turn * 61.0), 62.0) + 1.0;
  float piece = uOwn.x > 0.5 ? uOwn.x : sizeBits * 64.0 + number;
  if (uOwn.y > 0.5) part = ${String(SLEEK_PART + 64)}.0;
  if (kind > 4.5) {
    // Sol et eau: ni pièce ni morceau, le contour ne les cerne pas.
    piece = 0.0;
    part = 0.0;
  }
  vFoot = world.y - origin.y;
  vLocal = world.xyz - origin;
  #if defined(CHARACTER) || defined(ATLAS)
    // Ancre des hachures du personnage: elles le suivent sans glisser, à pas constant à l'écran.
    vec4 anchor = projectionMatrix * viewMatrix * vec4(origin, 1.0);
    vAnchor = (anchor.xy / anchor.w * 0.5 + 0.5) * uScreen;
  #else
    world.xyz = sway(world.xyz, origin, kind, vFoot, position);
  #endif
  vWorld = world.xyz;
  vNormal = normalize(mat3(model) * (objectNormal / max(scale2, vec3(1e-8))));
  vec3 tint = uTint;
  #ifdef USE_COLOR
    tint *= color;
  #endif
  #ifdef USE_INSTANCING_COLOR
    tint *= instanceColor;
  #endif
  vColor = toScreen(tint);
  vMeta = vec4(aInk.x, piece, kind, part);
  vSwap = swap;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const VOLUME_FRAGMENT = /* glsl */ `
layout(location = 0) out highp vec4 gColor;
layout(location = 1) out highp vec4 gAux;
in vec3 vWorld;
in vec3 vLocal;
in vec3 vNormal;
in vec3 vColor;
in float vFoot;
flat in vec4 vMeta;
flat in float vSwap;
uniform vec4 uWindowGlow;
uniform vec4 uGlint;
uniform vec4 uFlameGlow;
uniform vec3 uViewDir;
uniform vec3 uDetail;
uniform vec4 uCharacter;
uniform float uOpacity;
uniform float uFaded;
uniform float uPixel;
uniform vec4 uGlow;
uniform vec4 uOwn;
#if defined(CHARACTER) || defined(ATLAS)
  flat in vec2 vAnchor;
#endif
#ifdef ATLAS
  in vec2 vUv;
  in vec2 vFaceUv;
  uniform sampler2D uAtlas;
  uniform sampler2D uTraits;
  uniform float uCell;
  uniform vec2 uTraitGrid;
#else
  uniform sampler2D uGroundMap;
  uniform vec4 uGroundRect;
  uniform vec4 uGroundFallback;
  uniform vec4 uGroundTones;
  uniform vec3 uWater;
#endif
${LIGHTING}
// Teintes un peu poussées: de haut et de loin, chaque personnage se lit à sa couleur.
vec3 pushed(vec3 c) {
  return clamp(mix(vec3(dot(c, vec3(0.3, 0.59, 0.11))), c, uCharacter.z) * uCharacter.w, 0.0, 1.0);
}
#if defined(CHARACTER) || defined(ATLAS)
// Personnage: ni noir plein ni hachure du décor, des aplats francs et une ombre relevée; un
// troisième ton dans les creux, des hachures de près seulement, ancrées à lui, et un liseré
// clair du côté du soleil qui détache sa silhouette du décor.
vec3 figure(vec3 skin, vec3 N, vec3 lightN, float body) {
  vec3 color = inkLight(pushed(skin), vWorld, N, lightN, vFoot, 0.0, max(uCharacter.x, 1.0 - body));
  float ndl = dot(lightN, uSunDir);
  color *= mix(1.0, 0.82, smoothstep(-0.42, -0.5, ndl) * body);
  vec2 q = gl_FragCoord.xy - vAnchor;
  float stripe = fract((q.x - q.y * 0.85) / (5.5 * uPixel));
  float pen = smoothstep(-0.25, -0.8, ndl);
  color = mix(color, uInk, step(stripe, 0.3 * pen) * uDetail.z * body * 0.8);
  float rim = smoothstep(0.56, 0.64, 1.0 - dot(N, uViewDir)) * smoothstep(0.0, 0.12, dot(N, uSunDir));
  return mix(color, min(color * 1.35 + 0.08, vec3(1.0)), rim * uCharacter.y);
}
#endif
void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 color;
  #if defined(ATLAS)
    // Personnage à atlas: couleur, plis et hauteur viennent de son atlas (les niveaux de loin
    // sont des aplats: le détail s'efface de lui-même quand la vue s'élargit).
    vec4 texel = texture(uAtlas, vUv, -1.0);
    vec3 skin = texel.rgb;
    float body = vMeta.z;
    bool onFace = vFaceUv.x > 0.0 && vFaceUv.x < 1.0 && vFaceUv.y > 0.0 && vFaceUv.y < 1.0;
    // Traits à la plume du visage: lus un niveau et demi plus fin, épaissis en prenant le plus
    // fort de cinq points voisins (un demi-point d'écran autour).
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
    // Relief: la carte de hauteur (1 = 2 cm) incline la normale; le visage n'en reçoit pas.
    vec3 sx = dFdx(vWorld);
    vec3 sy = dFdy(vWorld);
    vec3 r1 = cross(sy, N);
    vec3 r2 = cross(N, sx);
    float det = dot(sx, r1);
    vec3 grad = sign(det) * (dFdx(texel.a) * r1 + dFdy(texel.a) * r2);
    vec3 bent = normalize(abs(det) * N - 0.036 * uRelief.x * body * grad);
    color = figure(skin, N, body > 0.5 ? bent : N, body);
  #elif defined(CHARACTER)
    // Personnage à couleurs de sommets: la tête (visage) est la zone au ton clair garanti.
    color = figure(vColor, N, N, 1.0 - step(0.5, uOwn.y));
  #else
    float kind = vMeta.z;
    float layer = vMeta.x;
    vec3 base = vColor;
    vec3 an = abs(N);
    vec2 tuv = an.y > 0.7 ? vLocal.xz : (an.x > an.z ? vLocal.zy : vLocal.xy);
    if (vSwap > 0.5) tuv = tuv.yx;
    float inkGain = step(floor(vMeta.y / 64.0), 1.5) * step(floor(vMeta.w / 64.0), 1.5);
    float border = 0.0;
    float flatGround = step(4.5, kind) * step(kind, 5.5);
    float water = step(5.5, kind);
    if (flatGround > 0.5) {
      // Sol: teinte et matière de la case lues dans la carte du lieu. Le point lu ondule selon
      // un bruit: le bord entre deux natures est sinueux, jamais la grille; le bord d'un sol
      // posé par l'homme (quai, rue pavée) reste droit.
      vec2 g = vWorld.xz;
      vec3 nA = texture(uNoise, g * 0.33 + 0.11).rgb;
      vec3 nB = texture(uNoise, g * 0.085 + 0.37).rgb;
      vec4 cell = uGroundFallback;
      float code = uGroundFallback.a;
      if (uGroundRect.z > 0.0) {
        vec2 warp = ((nA.rg - 0.5) * 0.9 + (nB.gb - 0.5) * 1.1) * uGroundTones.z;
        vec4 straight = texture(uGroundMap, g * uGroundRect.zw + uGroundRect.xy);
        vec4 bent = texture(uGroundMap, (g + warp) * uGroundRect.zw + uGroundRect.xy);
        float hard = max(step(127.5, straight.a * 255.0), step(127.5, bent.a * 255.0));
        cell = mix(bent, straight, hard);
        vec2 probe = mix(g + warp, g, hard) + vec2(0.07, 0.05);
        vec4 next = texture(uGroundMap, probe * uGroundRect.zw + uGroundRect.xy);
        // Trait interrompu le long du bord, de près seulement.
        border = step(0.012, distance(next.rgb, cell.rgb)) * step(0.3, nA.b) * uDetail.y;
        code = floor(cell.a * 255.0 + 0.5);
      }
      code = mod(code, 128.0);
      float fine = step(63.5, code);
      code = mod(code, 64.0);
      float grassy = step(15.5, code);
      layer = mod(code, 16.0);
      base = cell.rgb;
      // Herbe: trois tons en grandes plages, qui se déplacent avec l'heure comme sur un pré bosselé.
      vec3 big = texture(uNoise, g * 0.021).rgb;
      vec2 lay = vec2(big.r + nB.b * 0.7, big.g + nB.r * 0.7) - 0.85;
      float toward = dot(lay, normalize(uSunDir.xz + 1e-4)) * 0.42;
      base *= mix(1.0, mix(1.0, uGroundTones.x, step(0.13, toward)) * mix(1.0, uGroundTones.y, step(toward, -0.15)), grassy);
      tuv = g * mix(1.0, uGroundTones.w, fine);
      N = vec3(0.0, 1.0, 0.0);
      inkGain = 1.0;
    }
    // Dalles posées en volume (dessus du quai): même motif serré que le sol dallé.
    if (flatGround < 0.5 && abs(layer - ${String(LAYER.slab)}.0) < 0.5) tuv *= uGroundTones.w;
    tuv /= ${TILE_METRES.toFixed(1)};
    float leafy = step(2.5, kind) * step(kind, 3.5);
    vec4 drawn = texture(uLayers, vec3(tuv, layer));
    // Feuillage: les accents de feuilles bousculent davantage la normale ronde, et le bord de
    // l'ombre devient dentelé.
    vec3 bent = reliefNormal(N, vWorld, tuv, (drawn.ba - 0.5) * (2.0 + leafy * 2.5));
    // Second ton peint: la tache de la texture fait passer du ton clair au ton de base.
    base *= mix(1.0, 0.85, smoothstep(0.4, 0.6, drawn.g));
    if (water > 0.5) {
      // Eau: deux bandes de ton qui glissent, ni hachure ni relief; l'ombre y reste un aplat.
      vec2 g = vWorld.xz;
      float t = uTime * uWater.z;
      float wave = texture(uNoise, g * 0.12 + vec2(t * 0.05, t * 0.02)).r
        + texture(uNoise, g * 0.31 - vec2(t * 0.03, t * 0.06)).g;
      base = vColor * mix(1.0, uWater.x, step(1.14, wave)) * mix(1.0, uWater.y, step(wave, 0.84));
      bent = N;
      inkGain = 0.0;
      drawn = vec4(0.0, 0.0, 0.5, 0.5);
    }
    color = inkLight(base, vWorld, N, bent, flatGround > 0.5 ? 100.0 : vFoot, inkGain, 0.0);
    // Noir plein sous les touffes, du côté détourné du soleil: il détache une masse de la suivante.
    float under = leafy * smoothstep(0.0, -0.16, N.y) * smoothstep(0.3, -0.05, dot(N, uSunDir));
    color = mix(color, uInk, under * 0.9);
    // Le trait peint des textures s'efface quand la vue s'élargit: de loin, un aplat propre.
    color = mix(color, uInk, max(drawn.r * uDetail.x, border));
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
  #endif
  // Lueur de l'objet visé (liseré et brillance qui passe), ajoutée telle quelle.
  color += uGlow.rgb * uGlow.a;
  gColor = vec4(color, uOpacity);
  // Un volume effacé (mur coupé, toit en fondu) ne laisse aucune trace dans l'image du contour:
  // avec le mélange alpha, une sortie nulle garde ce qui était dessous.
  gAux = uFaded > 0.5 ? vec4(0.0) : vec4(packNormal(N), vMeta.w / 255.0, vMeta.y / 255.0);
}
`;

const CONTACT_VERTEX = /* glsl */ `
out vec2 vUv;
out vec3 vWorld;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

/**
 * Ombre de contact: une tache anguleuse posée au sol sous les pieds, qui multiplie la couleur du
 * dessous par le ton d'ombre de l'ambiance. La seconde sortie vaut 1 partout: la multiplication
 * la laisse intacte, donc aucun trait de contour autour de la tache.
 */
const CONTACT_FRAGMENT = /* glsl */ `
layout(location = 0) out highp vec4 gColor;
layout(location = 1) out highp vec4 gAux;
in vec2 vUv;
in vec3 vWorld;
uniform vec3 uShade;
uniform sampler2D uNoise;
void main() {
  vec2 q = (vUv - 0.5) * 2.0;
  // Bord net et un peu cabossé, ancré au monde: la tache ne tremble pas sous un personnage immobile.
  float wobble = (texture(uNoise, vWorld.xz * 1.7).r - 0.5) * 0.35;
  float inside = 1.0 - step(0.82, length(q) + wobble);
  gColor = vec4(mix(vec3(1.0), mix(uShade, vec3(1.0), 0.3), inside), 1.0);
  gAux = vec4(1.0);
}
`;

/**
 * Nappe du fond d'une pièce: la teinte d'écran de ses sommets, assombrie avec l'heure comme le
 * reste (ton d'ombre de l'ambiance), sans lumière, sans trait ni contour (ni pièce ni morceau).
 */
const BACKDROP_VERTEX = /* glsl */ `
out vec3 vColor;
void main() {
  vColor = color;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

const BACKDROP_FRAGMENT = /* glsl */ `
layout(location = 0) out highp vec4 gColor;
layout(location = 1) out highp vec4 gAux;
in vec3 vColor;
uniform vec3 uShade;
void main() {
  gColor = vec4(vColor * mix(vec3(1.0), uShade, 0.8), 1.0);
  gAux = vec4(0.5, 1.0, 0.0, 0.0);
}
`;

/** Aplat sans lumière (liseré de l'objet visé): une couleur d'écran, sa propre pièce de contour. */
const FLAT_FRAGMENT = /* glsl */ `
layout(location = 0) out highp vec4 gColor;
layout(location = 1) out highp vec4 gAux;
uniform vec3 uFlat;
void main() {
  gColor = vec4(uFlat, 1.0);
  gAux = vec4(0.5, 0.5, 0.0, 62.0 / 255.0);
}
`;

const FLAT_VERTEX = /* glsl */ `
#include <skinning_pars_vertex>
uniform float uPush;
void main() {
  vec3 transformed = position + normalize(normal) * uPush;
  #include <skinbase_vertex>
  #include <skinning_vertex>
  mat4 model = modelMatrix;
  #ifdef USE_INSTANCING
    model = modelMatrix * instanceMatrix;
  #endif
  gl_Position = projectionMatrix * viewMatrix * model * vec4(transformed, 1.0);
}
`;

const DEPTH_VERTEX = /* glsl */ `
in vec4 aInk;
${SWAY}
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
void main() {
  vec3 transformed = position;
  #include <morphinstance_vertex>
  #include <skinbase_vertex>
  #include <morphtarget_vertex>
  #include <skinning_vertex>
  mat4 model = modelMatrix;
  #ifdef USE_INSTANCING
    model = modelMatrix * instanceMatrix;
  #endif
  vec4 world = model * vec4(transformed, 1.0);
  #ifndef USE_SKINNING
    float kind = aInk.z - step(7.5, aInk.z) * 8.0;
    world.xyz = sway(world.xyz, model[3].xyz, kind, world.y - model[3].y, position);
  #endif
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

interface OwnUniforms {
  uTint: IUniform<Color>;
  uOpacity: IUniform<number>;
  uFaded: IUniform<number>;
  uGlow: IUniform<Vector4>;
  uOwn: IUniform<Vector4>;
}

export type InkVariant = 'volume' | 'character' | 'atlas';

export interface InkMaterialOptions {
  readonly variant?: InkVariant;
  /** Code de pièce imposé (personnage: un numéro stable, quel que soit l'endroit où il marche). */
  readonly piece?: number;
  /** Zone « peau lisse »: ton clair garanti et aucune arête tracée dedans (tête d'un personnage). */
  readonly sleek?: boolean;
  readonly side?: ShaderMaterialParameters['side'];
}

/**
 * Le matériau encré. Tous ses exemplaires partagent les uniformes communs (lumière, ombres,
 * textures) et un même programme par variante; chacun garde en propre sa teinte, son opacité, sa
 * lueur et son numéro de pièce. Il parle comme un matériau standard là où le moteur en a besoin
 * (`color`, `opacity`, `transparent`, `emissive`, `emissiveIntensity`, `clone()`): le fondu des
 * murs et des toits et la lueur de la cible marchent sans le connaître.
 */
export class InkMaterial extends ShaderMaterial {
  readonly isInkMaterial = true;
  /** Teinte multipliée à la couleur des sommets (linéaire, comme `MeshStandardMaterial.color`). */
  readonly color: Color;
  readonly emissive = new Color(0, 0, 0);
  emissiveIntensity = 0;
  private readonly own: OwnUniforms;

  constructor(
    private readonly shared: InkUniforms,
    private readonly inkOptions: InkMaterialOptions = {},
    extra: Record<string, IUniform> = {},
  ) {
    const own: OwnUniforms = {
      uTint: { value: new Color(1, 1, 1) },
      uOpacity: { value: 1 },
      uFaded: { value: 0 },
      uGlow: { value: new Vector4() },
      uOwn: { value: new Vector4(inkOptions.piece ?? 0, inkOptions.sleek === true ? 1 : 0, 0, 0) },
    };
    const variant = inkOptions.variant ?? 'volume';
    super({
      uniforms: { ...shared, ...extra, ...own },
      glslVersion: GLSL3,
      defines: variant === 'atlas' ? { ATLAS: 1 } : variant === 'character' ? { CHARACTER: 1 } : {},
      vertexShader: VOLUME_VERTEX,
      fragmentShader: VOLUME_FRAGMENT,
      vertexColors: variant !== 'atlas',
      ...(inkOptions.side === undefined ? {} : { side: inkOptions.side }),
    });
    this.own = own;
    this.color = own.uTint.value;
    this.extra = extra;
  }

  private readonly extra: Record<string, IUniform>;

  /** Appelé par Three.js avant chaque dessin: l'état « standard » passe dans les uniformes. */
  override onBeforeRender(): void {
    const own = this.own;
    own.uOpacity.value = this.opacity;
    own.uFaded.value = this.transparent ? 1 : 0;
    own.uGlow.value.set(this.emissive.r, this.emissive.g, this.emissive.b, this.emissiveIntensity);
    this.uniformsNeedUpdate = true;
  }

  /** Copie qui partage la lumière commune et le programme, avec son état propre. */
  override clone(): this {
    const copy = new InkMaterial(this.shared, this.inkOptions, this.extra);
    copy.color.copy(this.color);
    copy.opacity = this.opacity;
    copy.transparent = this.transparent;
    copy.depthWrite = this.depthWrite;
    copy.side = this.side;
    copy.emissive.copy(this.emissive);
    copy.emissiveIntensity = this.emissiveIntensity;
    copy.name = this.name;
    return copy as this;
  }
}

export function isInkMaterial(material: unknown): material is InkMaterial {
  return (material as Partial<InkMaterial> | null)?.isInkMaterial === true;
}

/** Matériau d'un personnage à atlas (corps de l'essai 4): atlas, traits du visage, expression. */
export function createAtlasMaterial(
  uniforms: InkUniforms,
  atlas: Texture,
  traits: Texture,
  grid: readonly [number, number],
  expression: number,
  piece: number,
): InkMaterial {
  return new InkMaterial(
    uniforms,
    { variant: 'atlas', piece },
    {
      uAtlas: { value: atlas },
      uTraits: { value: traits },
      uTraitGrid: { value: new Vector2(grid[0], grid[1]) },
      uCell: { value: expression },
    },
  );
}

export function createContactMaterial(uniforms: InkUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms,
    glslVersion: GLSL3,
    vertexShader: CONTACT_VERTEX,
    fragmentShader: CONTACT_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: DstColorFactor,
    blendDst: ZeroFactor,
    blendSrcAlpha: DstAlphaFactor,
    blendDstAlpha: ZeroFactor,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/** Matériau de la nappe du fond d'une pièce (couleurs de sommets en teintes d'écran). */
export function createBackdropMaterial(uniforms: InkUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms,
    glslVersion: GLSL3,
    vertexShader: BACKDROP_VERTEX,
    fragmentShader: BACKDROP_FRAGMENT,
    vertexColors: true,
  });
}

/** Aplat d'une couleur d'écran, poussé de `push` mètres le long des normales (liseré). */
export function createFlatMaterial(
  color: string,
  push: number,
  side: ShaderMaterialParameters['side'],
): ShaderMaterial {
  const value = Number.parseInt(color.slice(1), 16);
  return new ShaderMaterial({
    uniforms: {
      uFlat: {
        value: new Vector3(
          ((value >> 16) & 255) / 255,
          ((value >> 8) & 255) / 255,
          (value & 255) / 255,
        ),
      },
      uPush: { value: push },
    },
    glslVersion: GLSL3,
    vertexShader: FLAT_VERTEX,
    fragmentShader: FLAT_FRAGMENT,
    ...(side === undefined ? {} : { side }),
  });
}

/** Matériau des passes d'ombre: profondeur seule, vent, squelette et morphoses compris. */
export function createDepthMaterial(uniforms: InkUniforms): ShaderMaterial {
  return new ShaderMaterial({
    uniforms,
    glslVersion: GLSL3,
    vertexShader: DEPTH_VERTEX,
    fragmentShader: 'void main() {}',
    colorWrite: false,
    side: DoubleSide,
  });
}
