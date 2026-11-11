/**
 * Rendu encré: le matériau partagé et la lumière qu'il porte (ADR 0023). Aucun matériau standard
 * de Three.js: pas d'éclairage physique, pas de brillance. Tout se calcule en couleurs d'écran
 * (sRGB): un aplat ressort tel qu'il est écrit, multiplié par un des trois tons de la lumière.
 *
 * Un seul nuanceur de volumes pour le sol, le décor, le semis instancié, la végétation et les
 * personnages (variantes `CHARACTER` et `ATLAS`, squelette et morphoses compris). Il écrit deux
 * sorties: la couleur, et l'image du contour (morceau, normale, pièce et profondeur rangés dans
 * deux nombres, `AUX_PACKING` de `contour.ts`) que la passe de contour lit ensuite pour tracer le
 * trait.
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
import { AUX_GLSL } from './contour';
import { EDGE_SETTINGS } from '../lieu/reglages-lisieres';
import { RELIEF_SETTINGS } from '../lieu/reglages-relief';
import { fireBeat, hex, KEEP_INK, KIND, LAYER, type Rgb, SLEEK_PART, TILE_METRES } from './couches';
import { INK_SETTINGS } from './reglages';

/**
 * Bornes du nuanceur: lampes et fenêtres éclairées prises en compte à la fois, les plus proches
 * du point visé (`INK_SETTINGS.lights.reach`). Au-delà, une lampe garde son verre allumé mais ne
 * pose plus de flaque.
 */
export const MAX_LAMPS = 6;
export const MAX_WINDOWS = 8;

/** État de lumière propre d'un objet (`userData.inkInner` d'un maillage), lu à chaque dessin. */
export const INK_INNER = 'inkInner';

/**
 * Lumière propre d'un objet: x mode (0 celle de l'ambiance, 1 part de la lueur des vitres de
 * l'ambiance, 2 part absolue: une lampe), y part du rez-de-chaussée, z part de l'étage, w hauteur
 * (m, monde) où l'étage commence.
 */
export type InkInner = Vector4;

export interface Lamp {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
  /** La lampe peut porter l'ombre locale (une seule à la fois, la plus proche du joueur). */
  readonly shadow: boolean;
  /** Couleur ajoutée dans sa flaque, à la place de la teinte des lampes de l'ambiance. */
  readonly color?: Rgb;
  /** Force propre (1 par défaut). */
  readonly gain?: number;
  /**
   * Lampe du dehors: son rang d'allumage de 0 à 1 (elle s'allume à la tombée du jour, les
   * premières d'abord, `INK_SETTINGS.lamps`). Absent: allumée dès que l'ambiance a des lampes.
   */
  readonly phase?: number;
  /** Bâtiment qui la porte (lanterne de porte): elle suit son éclairage (`share`). */
  readonly follows?: string;
  /** Part d'allumage imposée de 0 à 1 (le bâtiment qui la porte); absente: 1. */
  share?: number;
  /** Verre de son modèle: le rendu y écrit son état à chaque image. */
  readonly glass?: InkInner;
  /**
   * Lampe d'un objet à flamme (`INK_SETTINGS.fire.families`): part de son intensité qui vacille,
   * au rythme du feu de l'objet (même phase que ses langues, tirée de la place de l'objet).
   */
  readonly flicker?: number;
  readonly flickerPhase?: number;
  /** Son feu brûle aussi le jour (feux de fête); sinon il suit l'allumage de la lampe. */
  readonly burnsByDay?: boolean;
}

/**
 * Part d'allumage d'une lampe pour une force de lampes d'ambiance: les lampes du dehors
 * s'allument l'une après l'autre entre `from` et `from + spread + ramp`, les autres suivent
 * l'ambiance telle quelle.
 */
export function lampPower(
  amount: number,
  lamp: Pick<Lamp, 'phase' | 'share'>,
  settings: typeof INK_SETTINGS.lamps = INK_SETTINGS.lamps,
): number {
  const share = lamp.share ?? 1;
  if (amount <= 0) return 0;
  if (lamp.phase === undefined) return share;
  const start = settings.from + lamp.phase * settings.spread;
  return Math.min(1, Math.max(0, (amount - start) / settings.ramp)) * share;
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
  /** Bâtiment éclairé de l'intérieur (0: éteint, 1: plein); absent: 1. */
  power?: number;
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
  /** Liseré des personnages: teinte, et part de cette teinte dans le liseré (0: leur couleur éclaircie). */
  uRim: IUniform<Vector4>;
  uViewDir: IUniform<Vector3>;
  /** Taille de la cible de la scène (points): elle suit l'échelle interne. */
  uScreen: IUniform<Vector2>;
  /** Points de la cible par point de l'écran de référence: tout ce qui se compte en points le suit. */
  uPixel: IUniform<number>;
  uTime: IUniform<number>;
  /** Vent: direction au sol fois la force (0: air immobile). */
  uWind: IUniform<Vector2>;
  uLampPos: IUniform<Vector4[]>;
  /** Couleur ajoutée par chaque lampe dans sa flaque (sa force comprise); w: sa part d'allumage. */
  uLampTint: IUniform<Vector4[]>;
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
  /** Feux: x part du mouvement des langues (mouvement réduit), y part du vacillement des lampes. */
  uFire: IUniform<Vector4>;
  /** Brume au sol: x force, y épaisseur en mètres. */
  uMist: IUniform<Vector2>;
  uMistColor: IUniform<Vector3>;
  uShadowMap: IUniform<Texture | null>;
  uShadowMatrix: IUniform<Matrix4>;
  uShadowTexel: IUniform<number>;
  uLayers: IUniform<DataArrayTexture | null>;
  uNoise: IUniform<Texture | null>;
  /** Fenêtre de profondeur de l'image du contour (`depthWindow` de `contour.ts`). */
  uAuxDepth: IUniform<Vector2>;
  /** Carte du sol du lieu: teinte de chaque case, couche de traits et dureté dans l'alpha. */
  uGroundMap: IUniform<Texture | null>;
  /** xy décalage, zw échelle (mètres vers la carte); z nul: pas de carte, teinte de repli. */
  uGroundRect: IUniform<Vector4>;
  /** Limites de sol adoucies: décalage du point lu, un vecteur par sommet de la grille des cases. */
  uGroundShiftMap: IUniform<Texture | null>;
  /** xy échelle (mètres vers la carte des décalages), zw demi-point; x nul: pas de décalage. */
  uGroundShift: IUniform<Vector4>;
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
    uRim: { value: new Vector4(1, 1, 1, 0) },
    uViewDir: { value: new Vector3(0, 1, 0) },
    uScreen: { value: new Vector2(1366, 768) },
    uPixel: { value: 1 },
    uTime: { value: 0 },
    uWind: { value: new Vector2() },
    uLampPos: { value: four(MAX_LAMPS) },
    uLampTint: { value: four(MAX_LAMPS) },
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
    uFire: { value: new Vector4(1, 1, 0, 0) },
    uMist: { value: new Vector2() },
    uMistColor: { value: new Vector3() },
    uShadowMap: { value: null },
    uShadowMatrix: { value: new Matrix4() },
    uShadowTexel: { value: 1 / INK_SETTINGS.sunShadow.size },
    uLayers: { value: null },
    uNoise: { value: null },
    uAuxDepth: { value: new Vector2(0, 1) },
    uGroundMap: { value: null },
    uGroundRect: { value: new Vector4(0, 0, 0, 0) },
    uGroundShiftMap: { value: null },
    uGroundShift: { value: new Vector4(0, 0, 0, 0) },
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
  uniforms.uRim.value.set(...ambiance.characterRimColor, ambiance.characterRimTint);
  const lit = ambiance.lamps > 0;
  uniforms.uLampPos.value.forEach((slot, i) => {
    const lamp = lamps[i];
    const tint = uniforms.uLampTint.value[i];
    const power = lamp === undefined || !lit ? 0 : lampPower(ambiance.lamps, lamp);
    if (lamp === undefined || power <= 0) {
      slot.set(0, 0, 0, 0);
      tint?.set(0, 0, 0, 0);
      return;
    }
    // Lampe d'un objet à flamme: elle vacille avec son feu (intensité, et un peu le rayon).
    const wave =
      (lamp.flicker ?? 0) *
      uniforms.uFire.value.y *
      fireBeat(uniforms.uTime.value, lamp.flickerPhase ?? 0);
    slot.set(lamp.x, lamp.y, lamp.z, lamp.radius * (1 + wave * 0.4));
    const color = lamp.color ?? ambiance.lampColor;
    const force = ambiance.lamps * power * (lamp.gain ?? 1) * (1 + wave);
    tint?.set(color[0] * force, color[1] * force, color[2] * force, power);
  });
  const spill = ambiance.windowAmount > 0 && ambiance.spill > 0;
  uniforms.uWinA.value.forEach((slot, i) => {
    const w = spill ? windows[i] : undefined;
    const other = uniforms.uWinB.value[i];
    const power = w === undefined ? 0 : (w.power ?? 1);
    if (w !== undefined && power > 0) {
      slot.set(w.x, w.sill, w.z, w.width / 2);
      other?.set(w.nx, w.nz, w.height, power);
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
 * Feux vivants: le battement d'un feu (même somme que `fireBeat` côté processeur), après la
 * déclaration de `uTime` du nuanceur qui l'inclut.
 */
const FIRE = /* glsl */ `
uniform vec4 uFire;
float fireBeat(float phase) {
  return sin(uTime * 7.3 + phase) * 0.5 + sin(uTime * 12.7 + phase * 1.7) * 0.3
    + sin(uTime * 3.1 + phase * 0.6) * 0.2;
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
uniform vec4 uLampTint[${String(MAX_LAMPS)}];
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
    + textureLod(uShadowMap, vec3(sc.xy + vec2(-t * 0.4, t), z), 0.0) * 0.15;
  // Les deux dernières lectures pèsent 0,3 à elles deux: loin d'un bord d'ombre, les trois
  // premières ont déjà passé le seuil (0,58) ou ne peuvent plus l'atteindre (0,42), et le
  // résultat est le même sans elles.
  if (seen < 0.58 && seen > 0.1199)
    seen = seen
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
  float seen = textureLod(uLampShadowMap, vec3(p.xy, z), 0.0) * 0.4
    + textureLod(uLampShadowMap, vec3(p.xy + vec2(t, t * 0.4), z), 0.0) * 0.15
    + textureLod(uLampShadowMap, vec3(p.xy + vec2(-t * 0.4, t), z), 0.0) * 0.15;
  // Comme pour le soleil: les deux dernières lectures seulement près d'un bord d'ombre.
  if (seen < 0.58 && seen > 0.1199)
    seen = seen
      + textureLod(uLampShadowMap, vec3(p.xy + vec2(-t, -t * 0.4), z), 0.0) * 0.15
      + textureLod(uLampShadowMap, vec3(p.xy + vec2(t * 0.4, -t), z), 0.0) * 0.15;
  return smoothstep(0.42, 0.58, seen);
}

// Rectangles de lumière des fenêtres: le point est éclairé si le rayon qui le joint à la lampe
// de la pièce (1,2 m derrière la vitre, sous le plafond) passe par le vide de la fenêtre, entre
// les petits bois. Deux tons: plein près du mur, moitié au bout.
float windowSpill(vec3 wp, vec3 N, vec2 tremble) {
  float lit = 0.0;
  for (int i = 0; i < ${String(MAX_WINDOWS)}; i++) {
    if (uWinB[i].w <= 0.0) continue;
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
    lit = max(lit, inside * bars * facing * mix(1.0, 0.55, step(0.62, 1.0 - t)) * uWinB[i].w);
  }
  return lit;
}

// Part de hachures courtes permise sur ce point (le sol et les dalles), et taille d'un point
// d'écran au sol (m): posées par main(), hors de toute branche (dérivées).
float gTicks = 0.0;
float gTickPx = 0.01;

float tickHash(vec2 c, float salt) {
  return fract(sin(dot(c, vec2(12.9898, 78.233)) + salt) * 43758.5453);
}

// Hachures courtes du sol à l'ombre: dans une case sur deux d'une grille ancrée au monde, une
// touffe de deux ou trois traits parallèles de 25 à 40 cm, tournés à peu près comme les
// hachures de l'encre. Trait d'un point et demi à l'écran quelle que soit la vue.
float groundTicks(vec2 p) {
  const float cellSize = ${INK_SETTINGS.ground.ticks.cell.toFixed(3)};
  const float gap = ${INK_SETTINGS.ground.ticks.gap.toFixed(3)};
  const float len = ${INK_SETTINGS.ground.ticks.length.toFixed(3)};
  float px = gTickPx;
  vec2 cell = floor(p / cellSize);
  float h1 = tickHash(cell, 0.0);
  float h2 = tickHash(cell, 1.7);
  float h3 = tickHash(cell, 3.1);
  float present = step(h1, ${INK_SETTINGS.ground.ticks.share.toFixed(3)});
  vec2 centre = (cell + 0.3 + vec2(h2, h3) * 0.4) * cellSize;
  float a = 1.15 + (h2 - 0.5) * 0.45;
  vec2 u = vec2(cos(a), sin(a));
  vec2 d = p - centre;
  float along = dot(d, u);
  float count = 2.0 + step(0.5, h3);
  float across = dot(d, vec2(-u.y, u.x)) + (count - 1.0) * gap * 0.5;
  float k = clamp(floor(across / gap + 0.5), 0.0, count - 1.0);
  float off = across - k * gap;
  // Chaque trait a sa longueur et son décalage le long de la touffe.
  float hk = tickHash(cell + k * 7.31, 5.3);
  float reach = len * (0.6 + 0.4 * hk) * 0.5;
  float shift = (hk - 0.5) * len * 0.3;
  float w = px * 0.9;
  float line = 1.0 - smoothstep(w * 0.5, w * 1.5, abs(off));
  float ends = 1.0 - smoothstep(reach - px * 1.5, reach, abs(along - shift));
  return present * line * ends;
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

  // Chaque lampe ajoute sa couleur dans sa flaque; la plus forte l'emporte là où deux se croisent.
  float pool = 0.0;
  vec3 lampLight = vec3(0.0);
  float casterSeen = uLampCaster >= 0.0 ? lampSeen(wp, flatN, tremble * 0.6) : 1.0;
  for (int i = 0; i < ${String(MAX_LAMPS)}; i++) {
    float radius = uLampPos[i].w;
    if (radius > 0.0) {
      vec3 d = uLampPos[i].xyz - wp;
      vec3 dn = normalize(d);
      // Portée comptée à plat, sur le cercle que la sphère de la lampe découpe à cette hauteur:
      // le cœur de la flaque couvre le pied de la lampe, pas seulement le dessus de sa cage.
      float disc = sqrt(max(radius * radius - d.y * d.y, 1e-4));
      float reach = length(d.xz) / disc + (nz.g - 0.5) * 0.12 + (fine.g - 0.5) * 0.05;
      float lampFacing = smoothstep(0.0, 0.08, dot(N, dn));
      float ring = (1.0 - smoothstep(0.97, 1.0, reach)) * 0.45 + (1.0 - smoothstep(0.56, 0.59, reach)) * 0.55;
      float visible = abs(float(i) - uLampCaster) < 0.5 ? casterSeen : 1.0;
      float amount = ring * lampFacing * visible;
      pool = max(pool, amount * uLampTint[i].w);
      lampLight = max(lampLight, uLampTint[i].rgb * amount);
    }
  }
  float spill = uWinColor.a > 0.0 ? windowSpill(wp, N, tremble * 0.5) : 0.0;
  light += lampLight + uWinColor.rgb * uWinColor.a * spill;
  float glow = max(pool, spill);
  vec3 color = base * light;

  // Plan de projection des hachures choisi par la normale: une seule lecture de texture, et
  // seulement là où elles se voient (ombre propre ou portée hachurée, pied d'un objet). Ailleurs
  // tout ce qu'elles pèsent est nul: un sol au soleil, un personnage, ne les lisent pas.
  vec3 an = abs(flatN);
  vec2 huv = (an.y > 0.7 ? wp.xz : (an.x > an.z ? wp.zy : wp.xy)) / ${TILE_METRES.toFixed(1)};
  vec2 hatchDx = dFdx(huv);
  vec2 hatchDy = dFdy(huv);
  float away = 1.0 - smoothstep(0.0, 0.08, ndl);
  float own = away * (1.0 - sun);
  float thrown = (1.0 - seen) * facing;
  float upright = (1.0 - smoothstep(0.45, 0.7, an.y)) * step(-0.02, foot);
  float dampTop = 0.2 + nz.g * 0.45;
  vec2 hatch = vec2(0.0);
  if (inkGain > 0.0 && uDetail.y > 0.0
      && (own * uHatch.x > 0.0 || thrown * uHatch.y > 0.0 || (upright > 0.0 && foot < dampTop)))
    hatch = textureGrad(uLayers, vec3(huv, ${String(LAYER.hatch)}.0), hatchDx, hatchDy).rg;
  // La densité suit la lumière: hachures lâches à peine détourné, serrées franchement à l'ombre.
  float deep = smoothstep(-0.15, -0.45, ndl);
  float ownHatch = mix(hatch.g, max(hatch.r, hatch.g), deep);
  float dark = max(own * ownHatch * uHatch.x, thrown * hatch.g * uHatch.y) * uDetail.y;
  float black = own * step(1.0 - uHatch.z * 0.6, nz.b * 0.75 + fine.b * 0.25 + deep * 0.12);
  // Sol à l'ombre: quelques touffes de hachures courtes (jamais dedans, où l'ombre portée n'a
  // pas de hachures: uHatch.y nul).
  if (gTicks > 0.0 && sun < 0.99) {
    float tick = groundTicks(wp.xz) * gTicks * (1.0 - sun) * smoothstep(0.0, 0.15, uHatch.y);
    dark = max(dark, tick * ${INK_SETTINGS.ground.ticks.strength.toFixed(2)} * uDetail.y);
  }
  dark = max(dark, black) * (1.0 - glow) * inkGain;

  // Pied de l'objet: un liseré d'encre pleine au ras du sol, puis des hachures qui s'éclaircissent.
  float base0 = upright * step(foot, 0.03 + fine.r * 0.06);
  float damp = upright * (1.0 - smoothstep(0.0, dampTop, foot)) * hatch.g * uDetail.y;
  dark = max(dark, max(base0, damp) * uRelief.y * inkGain);
  color = mix(color, uInk, dark);

  // Brume: deux nappes qui dérivent en sens contraires; le seuil du bruit monte avec la hauteur.
  if (uMist.x > 0.0) {
    float low = 1.0 - clamp(wp.y / uMist.y, 0.0, 1.0);
    float drift = texture(uNoise, wp.xz * 0.031 + uTime * vec2(0.006, 0.002)).r * 0.6
      + texture(uNoise, wp.xz * 0.083 - uTime * vec2(0.004, 0.007)).g * 0.4;
    float body = drift * low * (0.6 + 0.4 * low);
    float veil = smoothstep(0.50, 0.515, body) * 0.3 + smoothstep(0.6, 0.615, body) * 0.28;
    color = mix(color, uMistColor + lampLight * 0.35, veil * uMist.x);
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

// Normale sur deux octets (octaèdre), arrondis comme le ferait une texture de huit bits.
vec2 packNormal(vec3 n) {
  n /= abs(n.x) + abs(n.y) + abs(n.z);
  vec2 e = n.z >= 0.0 ? n.xy : (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
  return floor((e * 0.5 + 0.5) * 255.0 + 0.5);
}
${AUX_GLSL}
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
// Sol en relief: 1 + la distance à l'eau (m, bornée à 2) du point affiché; 0: sol sans berge.
out float vShore;
// Feux: x place du sommet du pied à la pointe d'une langue, y battement (braise: sa phase).
out vec2 vFire;
uniform vec4 uInner;
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
${FIRE}
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
  // Langue de feu: plus elle monte, plus elle ondule et s'étire; son pied ne bouge pas (il tient
  // aux bûches). Phase tirée de la place de l'objet (deux marmites ne dansent pas ensemble) et du
  // numéro de la langue. Éteinte (lampe éteinte), elle se couche à son pied et n'est plus dessinée.
  float fireOn = uInner.x > 1.5 ? uInner.w : 1.0;
  bool tongue = aInk.z > ${String(KIND.fire - 0.5)} && aInk.z < ${String(KIND.fire + 0.5)};
  float seat = model[3].x * 2.37 + model[3].z * 3.53;
  vFire = vec2(0.0, seat + aInk.w * 2.399);
  if (tongue) {
    float tall = floor(aInk.x) * 0.01;
    float along = fract(aInk.x);
    float own = seat + aInk.w * 2.399;
    float beat = fireBeat(seat) * 0.6 + fireBeat(own) * 0.4;
    float lift = along * tall;
    transformed.y += lift * (${INK_SETTINGS.fire.stretch.toFixed(3)} * beat * uFire.x - (1.0 - fireOn));
    float lean = along * along * tall * ${INK_SETTINGS.fire.sway.toFixed(3)} * uFire.x;
    transformed.x += lean * sin(uTime * 6.1 + own * 1.3 - along * 2.2);
    transformed.z += lean * cos(uTime * 4.7 + own * 0.8 - along * 1.9);
    vFire = vec2(along, beat);
  }
  vec4 world = model * vec4(transformed, 1.0);
  vec3 origin = model[3].xyz;
  vec3 scale2 = vec3(dot(model[0].xyz, model[0].xyz), dot(model[1].xyz, model[1].xyz), dot(model[2].xyz, model[2].xyz));

  // Au-delà de 15 (feu, braise), la nature n'a pas de bascule des traits.
  float swap = step(7.5, aInk.z) * step(aInk.z, 15.5);
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
  vShore = 0.0;
  if (kind > 4.5 && kind < 6.5) {
    // Sol et eau: ni pièce ni morceau, le contour ne les cerne pas. Le quatrième nombre du sol
    // porte sa distance à l'eau.
    vShore = aInk.w;
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
  // Le premier nombre d'une langue de feu porte sa hauteur, pas une couche de traits.
  if (tongue) vMeta.x = 0.0;
  vSwap = swap;
  gl_Position = projectionMatrix * viewMatrix * world;
  if (tongue && fireOn < 0.02) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
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
in float vShore;
in vec2 vFire;
uniform vec4 uWindowGlow;
uniform vec4 uGlint;
uniform vec4 uFlameGlow;
uniform vec3 uViewDir;
uniform vec3 uDetail;
uniform vec4 uCharacter;
uniform vec4 uRim;
uniform vec4 uInner;
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
  uniform sampler2D uGroundShiftMap;
  uniform vec4 uGroundShift;
  uniform vec4 uGroundFallback;
  uniform vec4 uGroundTones;
  uniform vec3 uWater;
  // Limites de sol adoucies: le sol affiché en g est celui de la grille en g + décalage(g). Le
  // décalage est rangé par noeud d'un treillis (octet 128: nul), lu en filtrage linéaire.
  vec2 groundPoint(vec2 g) {
    if (uGroundShift.x <= 0.0) return g;
    vec2 d = texture(uGroundShiftMap, g * uGroundShift.xy + uGroundShift.zw).rg * 255.0 - 128.0;
    return g + d * ${(EDGE_SETTINGS.span / 127).toFixed(6)};
  }
  // Deux points (m) tombent-ils dans la même case de la carte du sol ? La carte se lit au plus
  // proche: une seule lecture vaut alors pour les deux. À moins d'un centième de case d'un bord,
  // on ne se prononce pas (le choix de la case y dépend de l'arrondi du processeur graphique).
  bool sameGroundCell(vec2 a, vec2 b) {
    vec2 size = vec2(textureSize(uGroundMap, 0));
    vec2 ta = (a * uGroundRect.zw + uGroundRect.xy) * size;
    vec2 tb = (b * uGroundRect.zw + uGroundRect.xy) * size;
    vec2 edge = min(min(fract(ta), 1.0 - fract(ta)), min(fract(tb), 1.0 - fract(tb)));
    return floor(ta) == floor(tb) && min(edge.x, edge.y) > 0.01;
  }
  // La case lue est-elle de l'eau ? (bit 5 de l'alpha de la carte du sol)
  float waterCell(vec2 p) {
    float code = floor(texture(uGroundMap, p * uGroundRect.zw + uGroundRect.xy).a * 255.0 + 0.5);
    return step(31.5, mod(code, 64.0));
  }
#endif
${LIGHTING}
${FIRE}
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
  // Le liseré clair est sa couleur éclaircie le jour; la nuit il prend la teinte froide de
  // l'ambiance, qui détache la silhouette hors des flaques de lumière.
  vec3 edge = mix(min(color * 1.35 + 0.08, vec3(1.0)), uRim.rgb, uRim.a);
  return mix(color, edge, rim * uCharacter.y);
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
    float keepInk = step(${String(KEEP_INK - 0.5)}, vMeta.x);
    float layer = vMeta.x - keepInk * ${String(KEEP_INK)}.0;
    vec3 base = vColor;
    vec3 an = abs(N);
    vec2 tuv = an.y > 0.7 ? vLocal.xz : (an.x > an.z ? vLocal.zy : vLocal.xy);
    if (vSwap > 0.5) tuv = tuv.yx;
    float inkGain = max(step(floor(vMeta.y / 64.0), 1.5) * step(floor(vMeta.w / 64.0), 1.5), keepInk);
    gTickPx = length(fwidth(vWorld.xz));
    // Hachures courtes à l'ombre: le sol, et le dessus des dalles et pavés qui gardent l'encre.
    gTicks = max(step(4.5, kind) * step(kind, 5.5), max(keepInk, step(6.5, kind) * step(kind, 7.5)) * step(0.7, an.y));
    float border = 0.0;
    // Liseré d'eau claire au pied d'une berge: ni hachure ni trait dessus.
    float foam = 0.0;
    float flatGround = step(4.5, kind) * step(kind, 5.5);
    float water = step(5.5, kind) * step(kind, 6.5);
    // Fond des joints d'un dallage: relevé à l'ombre (les hachures courtes s'y lisent encore).
    float joint = step(6.5, kind) * step(kind, 7.5);
    if (flatGround > 0.5) {
      // Sol: teinte et matière de la case lues dans la carte du lieu, au point décalé par les
      // limites adoucies (la frontière entre deux natures ne suit pas la grille); un léger
      // tremblé s'y ajoute. Le bord d'un sol posé par l'homme (quai, rue pavée) reste droit.
      vec2 g = vWorld.xz;
      vec3 nA = texture(uNoise, g * 0.33 + 0.11).rgb;
      vec3 nB = texture(uNoise, g * 0.085 + 0.37).rgb;
      vec4 cell = uGroundFallback;
      float code = uGroundFallback.a;
      if (uGroundRect.z > 0.0) {
        vec2 gs = groundPoint(g);
        // Tremblé du trait: un bruit serré, écrêté (il passe l'essentiel du temps près de son
        // maximum: le bord tremble franchement sans jamais dépasser l'écart permis).
        vec2 warp = clamp((nA.rg - 0.5) * 2.6 + (nB.gb - 0.5) * 0.8, -1.0, 1.0) * uGroundTones.z;
        // Loin d'une limite, le point tremblé et son voisin retombent dans la même case: la
        // carte n'est lue qu'une fois (trois près d'une limite).
        vec4 straight = textureLod(uGroundMap, gs * uGroundRect.zw + uGroundRect.xy, 0.0);
        vec4 bent = straight;
        if (!sameGroundCell(gs, gs + warp))
          bent = textureLod(uGroundMap, (gs + warp) * uGroundRect.zw + uGroundRect.xy, 0.0);
        float hard = max(step(127.5, straight.a * 255.0), step(127.5, bent.a * 255.0));
        cell = mix(bent, straight, hard);
        // Trait interrompu le long du bord, de près seulement.
        float dashed = step(0.3, nA.b) * uDetail.y;
        vec2 from = mix(gs + warp, gs, hard);
        vec2 probe = from + vec2(0.07, 0.05);
        if (dashed > 0.0 && !sameGroundCell(from, probe)) {
          vec4 next = textureLod(uGroundMap, probe * uGroundRect.zw + uGroundRect.xy, 0.0);
          border = step(0.012, distance(next.rgb, cell.rgb)) * dashed;
        }
        code = floor(cell.a * 255.0 + 0.5);
      }
      code = mod(code, 128.0);
      float fine = step(63.5, code);
      code = mod(code, 64.0);
      float wet = step(31.5, code);
      code = mod(code, 32.0);
      float grassy = step(15.5, code);
      layer = mod(code, 16.0);
      base = cell.rgb;
      // Berge: à moins de 80 cm environ de l'eau, l'herbe laisse voir la terre (bord tremblé, l'ourlet
      // d'herbe reste en haut de la pente); plus bas la terre est mouillée, et au ras de l'eau un
      // liseré clair bat lentement.
      float above = vWorld.y - (${RELIEF_SETTINGS.water.level.toFixed(3)});
      float bankEdge = ${RELIEF_SETTINGS.bank.earth.toFixed(3)} + (nA.b + nB.g - 1.0) * ${RELIEF_SETTINGS.bank.earthNoise.toFixed(3)};
      float bank = step(0.5, vShore) * max(grassy, wet) * step(vShore - 1.0, bankEdge);
      if (bank > 0.5) {
        base = vec3(${hex(RELIEF_SETTINGS.bank.color)
          .map((c) => c.toFixed(4))
          .join(', ')});
        base *= mix(1.0, ${RELIEF_SETTINGS.bank.wetShade.toFixed(2)}, step(above, ${RELIEF_SETTINGS.bank.wet.toFixed(3)} + (nA.r - 0.5) * 0.04));
        layer = ${String(LAYER.dirt)}.0;
        grassy = 0.0;
        border = 0.0;
        float lap = ${RELIEF_SETTINGS.bank.foam.toFixed(3)} + ${RELIEF_SETTINGS.bank.lap.toFixed(3)} * sin(uTime * 0.8 + nB.r * 19.0 + nA.g * 5.0);
        foam = step(above, lap);
      }
      // Herbe: trois tons en grandes plages, qui se déplacent avec l'heure comme sur un pré
      // bosselé. Les plages ne pèsent que sur l'herbe: leur bruit n'est pas lu ailleurs.
      vec3 big = grassy > 0.5 ? textureLod(uNoise, g * 0.021, 0.0).rgb : vec3(0.0);
      vec2 lay = vec2(big.r + nB.b * 0.7, big.g + nB.r * 0.7) - 0.85;
      vec2 sunward = normalize(uSunDir.xz + 1e-4);
      // Sol en relief: la pente vraie s'ajoute aux plages de l'herbe et vaut pour toute nature de
      // sol (un talus tourné vers le soleil prend le ton clair, son vis-à-vis le ton sombre). La
      // tranche d'un sol déclaré (face debout) garde la normale du dessus.
      N = N.y > 0.7 ? N : vec3(0.0, 1.0, 0.0);
      float toward = dot(lay, sunward) * 0.42 * grassy + dot(N.xz, sunward) * ${INK_SETTINGS.ground.slopeTone.toFixed(2)};
      base *= mix(1.0, uGroundTones.x, step(0.13, toward)) * mix(1.0, uGroundTones.y, step(toward, -0.15));
      base = mix(base, vec3(${hex(INK_SETTINGS.water.rim)
        .map((c) => c.toFixed(4))
        .join(', ')}), foam);
      tuv = g * mix(1.0, uGroundTones.w, fine);
      inkGain = 1.0 - foam;
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
      // Eau: trois tons en plages qui glissent lentement, un fil clair au bord des plages
      // claires, et une frange plus claire le long des berges (la carte du sol dit où est la
      // terre); ni hachure ni relief, l'ombre y reste un aplat.
      vec2 g = vWorld.xz;
      float t = uTime * uWater.z;
      float wave = texture(uNoise, g * 0.12 + vec2(t * 0.05, t * 0.02)).r
        + texture(uNoise, g * 0.31 - vec2(t * 0.03, t * 0.06)).g;
      float tone = mix(1.0, uWater.x, step(1.14, wave)) * mix(1.0, uWater.y, step(wave, 0.84));
      float glint = step(abs(wave - 1.17), 0.012) * step(0.62, texture(uNoise, g * 0.07 + 0.5).b);
      float shallow = 0.0;
      float shore = 0.0;
      if (uGroundRect.z > 0.0) {
        vec2 gs = groundPoint(g);
        float wob = texture(uNoise, g * 0.21 + vec2(t * 0.02, 0.0)).b;
        float r1 = ${INK_SETTINGS.water.shore[0].toFixed(2)} * (0.75 + wob * 0.5);
        float r2 = ${INK_SETTINGS.water.shore[1].toFixed(2)} * (0.75 + wob * 0.5);
        shore = 1.0 - min(
          min(waterCell(gs + vec2(r1, 0.0)), waterCell(gs - vec2(r1, 0.0))),
          min(waterCell(gs + vec2(0.0, r1)), waterCell(gs - vec2(0.0, r1))));
        shallow = 1.0 - min(
          min(waterCell(gs + vec2(r2, r2) * 0.707), waterCell(gs - vec2(r2, r2) * 0.707)),
          min(waterCell(gs + vec2(r2, -r2) * 0.707), waterCell(gs - vec2(r2, -r2) * 0.707)));
      }
      shallow = max(shallow, shore);
      base = vColor * tone * mix(1.0, ${INK_SETTINGS.water.shallow.toFixed(2)}, shallow);
      vec3 rim = vec3(${hex(INK_SETTINGS.water.rim)
        .map((c) => c.toFixed(4))
        .join(', ')});
      base = mix(base, rim, max(shore * ${INK_SETTINGS.water.rimShare.toFixed(2)}, glint * 0.55));
      bent = N;
      inkGain = 0.0;
      drawn = vec4(0.0, 0.0, 0.5, 0.5);
    }
    color = inkLight(base, vWorld, N, bent, flatGround > 0.5 ? 100.0 : vFoot, inkGain, joint * ${INK_SETTINGS.ground.jointLift.toFixed(2)});
    // Noir plein sous les touffes, du côté détourné du soleil: il détache une masse de la suivante.
    float under = leafy * smoothstep(0.0, -0.16, N.y) * smoothstep(0.3, -0.05, dot(N, uSunDir));
    color = mix(color, uInk, under * 0.9);
    // Le trait peint des textures s'efface quand la vue s'élargit: de loin, un aplat propre.
    color = mix(color, uInk, max(drawn.r * uDetail.x, border) * (1.0 - foam));
    float pane = step(0.5, kind) * step(kind, 1.5);
    float flame = step(1.5, kind) * step(kind, 2.5);
    if (pane > 0.5) {
      // Vitre. Éclairée de l'intérieur: un aplat chaud. De jour: le reflet du ciel dessiné en
      // deux bandes obliques nettes, qui glissent sur la vitre quand la caméra tourne.
      vec2 tangent = vec2(-N.z, N.x);
      float d = dot(vWorld.xz, tangent) + vWorld.y * 0.75 + dot(uViewDir.xz, tangent) * 0.9;
      float band = step(fract(d * 0.85), 0.2) + step(abs(fract(d * 0.85) - 0.34), 0.035);
      color = mix(color, uGlint.rgb, min(band, 1.0) * uGlint.a);
      // Éclairée ou non: l'objet le dit (bâtiment: rez-de-chaussée et étage), sinon l'ambiance.
      float inner = uInner.x > 0.5 ? (vWorld.y > uInner.w ? uInner.z : uInner.y) : 1.0;
      color = mix(color, uWindowGlow.rgb, uWindowGlow.a * inner);
    }
    if (flame > 0.5) {
      // Verre d'une lampe: allumé, il prend la teinte chaude des flammes, ou la sienne s'il est
      // franchement coloré (feu rouge d'un signal).
      float top = max(max(base.r, base.g), max(base.b, 0.001));
      vec3 hue = base / top;
      float vivid = smoothstep(0.5, 0.75, 1.0 - min(hue.r, min(hue.g, hue.b)));
      float on = uInner.x > 1.5 ? uInner.y : uFlameGlow.a;
      color = mix(color, mix(uFlameGlow.rgb, hue, vivid), on);
    }
    if (kind > ${String(KIND.fire - 0.5)} && kind < ${String(KIND.fire + 0.5)}) {
      // Langue de feu: trois aplats sans lumière ni encre (elle éclaire, elle ne reçoit pas
      // d'ombre), jaune au cœur, orangé en pointe et sur les faces de biais; la limite entre deux
      // tons monte et descend avec le battement. Lisible le jour, lumineuse la nuit.
      float heat = vFire.x + (1.0 - max(dot(N, uViewDir), 0.0)) * 0.35 - vFire.y * 0.07;
      color = heat < ${INK_SETTINGS.fire.bands[0].toFixed(3)}
        ? vec3(${hex(INK_SETTINGS.fire.core)
          .map((c) => c.toFixed(4))
          .join(', ')})
        : (heat < ${INK_SETTINGS.fire.bands[1].toFixed(3)}
          ? vec3(${hex(INK_SETTINGS.fire.middle)
            .map((c) => c.toFixed(4))
            .join(', ')})
          : vec3(${hex(INK_SETTINGS.fire.tip)
            .map((c) => c.toFixed(4))
            .join(', ')}));
    }
    if (kind > ${String(KIND.ember - 0.5)} && kind < ${String(KIND.ember + 0.5)}) {
      // Braise: elle rougeoie lentement, chacune à sa phase, tant que son objet est allumé.
      float on = uInner.x > 1.5 ? uInner.w : 1.0;
      float wave = sin(uTime * ${((Math.PI * 2) / INK_SETTINGS.fire.emberPeriod).toFixed(4)} + vFire.y);
      vec3 hot = mix(base, vec3(${hex(INK_SETTINGS.fire.ember)
        .map((c) => c.toFixed(4))
        .join(', ')}), 0.5) * (1.0 + ${INK_SETTINGS.fire.emberPulse.toFixed(3)} * wave);
      color = mix(color, clamp(hot, 0.0, 1.0), on);
    }
  #endif
  // Lueur de l'objet visé (liseré et brillance qui passe), ajoutée telle quelle.
  color += uGlow.rgb * uGlow.a;
  gColor = vec4(color, uOpacity);
  // Un volume effacé (mur coupé, toit en fondu) ne laisse aucune trace dans l'image du contour:
  // avec le mélange alpha, une sortie nulle garde ce qui était dessous.
  gAux = uFaded > 0.5 ? vec4(0.0) : packAux(packNormal(N), vMeta.w, vMeta.y);
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
 * la laisse intacte (au bit près, ses nombres sont à virgule), donc aucun trait de contour autour
 * de la tache.
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
${AUX_GLSL}
void main() {
  gColor = vec4(vColor * mix(vec3(1.0), uShade, 0.8), 1.0);
  gAux = packAux(vec2(0.0), 0.0, 0.0);
}
`;

/** Pièce de l'aplat sans lumière: un numéro à lui, de la plus grande classe de taille. */
const FLAT_PIECE = 62;

/** Aplat sans lumière (liseré de l'objet visé): une couleur d'écran, sa propre pièce de contour. */
const FLAT_FRAGMENT = /* glsl */ `
layout(location = 0) out highp vec4 gColor;
layout(location = 1) out highp vec4 gAux;
uniform vec3 uFlat;
${AUX_GLSL}
void main() {
  gColor = vec4(uFlat, 1.0);
  gAux = packAux(vec2(0.0), 0.0, ${String(FLAT_PIECE)}.0);
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
  // Une langue de feu ne porte pas d'ombre (elle éclaire).
  if (aInk.z > ${String(KIND.fire - 0.5)} && aInk.z < ${String(KIND.fire + 0.5)}) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}
`;

interface OwnUniforms {
  uTint: IUniform<Color>;
  uOpacity: IUniform<number>;
  uFaded: IUniform<number>;
  uGlow: IUniform<Vector4>;
  uOwn: IUniform<Vector4>;
  uInner: IUniform<Vector4>;
}

const NO_INNER = new Vector4(0, 0, 0, 0);

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
      uInner: { value: NO_INNER },
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

  /**
   * Appelé par Three.js avant chaque dessin: l'état « standard » passe dans les uniformes, et la
   * lumière propre de l'objet dessiné (`userData.inkInner`: bâtiment éclairé, verre d'une lampe).
   * Un matériau partagé sert ainsi à des objets allumés et éteints, sans copie ni programme de plus.
   */
  override onBeforeRender(
    _renderer?: unknown,
    _scene?: unknown,
    _camera?: unknown,
    _geometry?: unknown,
    object?: { readonly userData: Record<string, unknown> },
  ): void {
    const own = this.own;
    const inner = object?.userData[INK_INNER];
    own.uInner.value = inner instanceof Vector4 ? inner : NO_INNER;
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
  shared: Pick<InkUniforms, 'uAuxDepth'>,
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
      uAuxDepth: shared.uAuxDepth,
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
