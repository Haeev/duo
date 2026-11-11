/**
 * Rendu encré: la passe de contour (ADR 0023). La scène est rendue une fois dans une cible à deux
 * sorties (couleur; image du contour) avec sa profondeur. Une passe plein écran trace ensuite le
 * trait: épais là où le numéro de pièce change ou la profondeur saute (silhouettes), fin là où la
 * normale tourne ou le morceau change (arêtes, joints). L'épaisseur et la position du trait
 * suivent un bruit ancré au monde: le trait est irrégulier, mais ne grouille pas quand la caméra
 * bouge. Le trait est hiérarchisé: chaque pièce et chaque morceau porte une classe de taille, et
 * un rang de trait n'est tracé que si ce qu'il cerne fait assez de points à l'écran. La même
 * passe pose la teinte dominante, la vignette et les fondus au noir du moteur (sommeil, montée
 * dans le train).
 *
 * Coût par point (ADR 0023, point 18). L'image du contour tient en un seul point de texture
 * (`AUX_PACKING`): morceau, normale, pièce et profondeur se lisent d'un coup, huit lectures pour
 * les huit prises au lieu de seize. Et le trait n'est cherché que là où il peut exister: un
 * masque au quart de la définition dit, pour chaque carré de quatre points de côté, si quelque
 * chose change (pièce, morceau, normale, saut de profondeur) à portée de prise. Ailleurs la passe ne lit
 * que la couleur et le masque. Le masque est prudent (il ne dit « rien » que s'il en est sûr):
 * l'image tracée est la même qu'en cherchant partout.
 */
import {
  BufferGeometry,
  Color,
  DepthTexture,
  Float32BufferAttribute,
  FloatType,
  GLSL3,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  RawShaderMaterial,
  RedFormat,
  RGFormat,
  Scene,
  type Texture,
  UnsignedByteType,
  UnsignedIntType,
  Vector2,
  Vector3,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type { Ambiance } from './ambiances';
import { INK_SETTINGS } from './reglages';

/**
 * L'image du contour: deux nombres à virgule de 32 bits par point, chacun porteur d'un entier de
 * 24 bits exact. Le premier: morceau (8 bits), puis la normale en deux octets (octaèdre). Le
 * second: pièce (8 bits), puis la profondeur sur 16 bits. Le morceau et la pièce sont en tête:
 * une moyenne de quatre points voisins s'écarte franchement de chacun dès que l'un d'eux diffère,
 * ce dont le masque se sert (quatre points lus d'un coup, en filtrage linéaire).
 *
 * La profondeur ne couvre pas toute l'étendue de la caméra (400 m: un pas y vaudrait 6 mm) mais
 * une fenêtre autour du point visé (`depthWindow`): ce qui se voit y tient, un pas vaut un
 * millimètre et demi.
 */
export const AUX_PACKING = {
  /** Poids du morceau et de la pièce dans leur nombre. */
  high: 65536,
  /** Dernier pas de la profondeur. */
  depthSteps: 65535,
  /** Normale d'un point sans morceau (sol, eau, fond): jamais lue, la même partout. */
  flatNormal: 128 * 256 + 128,
  /** Pièce du fond vide (la valeur que la cible prenait à son effacement). */
  backgroundPiece: 255,
} as const;

/**
 * Écriture de l'image du contour par un nuanceur de la scène: `packAux(octets de la normale,
 * morceau, pièce)`. La profondeur est celle du fragment.
 */
export const AUX_GLSL = /* glsl */ `
// Fenêtre de profondeur de l'image du contour: x son début, y l'inverse de sa part de l'étendue.
uniform vec2 uAuxDepth;
vec4 packAux(vec2 normalBytes, float part, float piece) {
  float code = part < 0.5 ? ${String(AUX_PACKING.flatNormal)}.0 : normalBytes.x * 256.0 + normalBytes.y;
  float depth = floor(clamp((gl_FragCoord.z - uAuxDepth.x) * uAuxDepth.y, 0.0, 1.0) * ${String(AUX_PACKING.depthSteps)}.0 + 0.5);
  return vec4(part * ${String(AUX_PACKING.high)}.0 + code, piece * ${String(AUX_PACKING.high)}.0 + depth, 0.0, 1.0);
}
`;

// Nuanceur brut (`RawShaderMaterial`): Three.js n'y ajoute rien et ne range pas son programme
// selon la cible. Un `ShaderMaterial` en compilait deux, l'un pour la cible de l'image finie
// (échelle interne sous 1), l'autre pour le canevas: un programme de trop au budget.
const VERTEX = /* glsl */ `
precision highp float;
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const OUTLINE = INK_SETTINGS.outline;

/** Ce que le programme dessine (`uMode`): un seul programme pour toutes les étapes de la passe. */
const MODE = { outline: 0, upscale: 1, edges: 2, spread: 3 } as const;

const FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
layout(location = 0) out highp vec4 gColor;
in vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tAux;
uniform highp sampler2D tDepth;
uniform sampler2D tMask;
uniform sampler2D uNoise;
uniform int uMode;
uniform int uReach;
uniform vec2 uMaskSize;
uniform vec3 uFlat;
uniform vec2 uTexel;
uniform float uRadius;
uniform float uWobble;
uniform float uDepthStep;
uniform vec3 uCamOrigin;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamForward;
uniform vec3 uInk;
uniform vec3 uTint;
uniform vec3 uVignetteColor;
uniform vec3 uVignette;
uniform vec2 uGrade;
uniform float uExposure;
uniform float uRankWeight[5];
uniform vec2 uSize;

// Mise à l'échelle de l'image finie vers le canevas quand l'échelle interne est sous 1 (ADR 0023,
// point 11): bicubique de Catmull-Rom en cinq lectures filtrées (les quatre coins, de poids
// infime, sont laissés), bornée par les tons lus pour ne poser aucun halo le long des traits
// d'encre. Elle vit dans ce nuanceur pour ne pas coûter un programme de plus.
vec3 upscaled() {
  vec2 at = vUv * uSize;
  vec2 centre = floor(at - 0.5) + 0.5;
  vec2 f = at - centre;
  vec2 f2 = f * f;
  vec2 f3 = f2 * f;
  vec2 w0 = -0.5 * f3 + f2 - 0.5 * f;
  vec2 w1 = 1.5 * f3 - 2.5 * f2 + 1.0;
  vec2 w2 = -1.5 * f3 + 2.0 * f2 + 0.5 * f;
  vec2 w3 = 0.5 * f3 - 0.5 * f2;
  vec2 w12 = w1 + w2;
  vec2 t0 = (centre - 1.0) / uSize;
  vec2 t12 = (centre + w2 / w12) / uSize;
  vec2 t3 = (centre + 2.0) / uSize;
  vec3 mid = textureLod(tColor, t12, 0.0).rgb;
  vec3 north = textureLod(tColor, vec2(t12.x, t0.y), 0.0).rgb;
  vec3 west = textureLod(tColor, vec2(t0.x, t12.y), 0.0).rgb;
  vec3 east = textureLod(tColor, vec2(t3.x, t12.y), 0.0).rgb;
  vec3 south = textureLod(tColor, vec2(t12.x, t3.y), 0.0).rgb;
  float wm = w12.x * w12.y;
  float wn = w12.x * w0.y;
  float ww = w0.x * w12.y;
  float we = w3.x * w12.y;
  float ws = w12.x * w3.y;
  vec3 color = (mid * wm + north * wn + west * ww + east * we + south * ws) / (wm + wn + ww + we + ws);
  vec3 low = min(mid, min(min(north, south), min(west, east)));
  vec3 high = max(mid, max(max(north, south), max(west, east)));
  return clamp(color, low, high);
}

// Masque, premier temps (au quart de la définition): le carré de quatre points de côté et
// l'anneau d'un point autour de lui sont-ils d'un seul tenant ? Neuf lectures filtrées, posées
// tous les deux points, moyennent chacune quatre points: trente-six points lus en neuf fois.
// Elles sont comparées au premier point du carré, lu tel quel. Morceau et normale: toute moyenne
// qui s'écarte du point trahit un voisin différent. Pièce et profondeur: sur un plan, les neuf
// moyennes sont alignées et le point lu est sur leur plan; une pièce différente, une marche de
// profondeur ou un pli rompent l'alignement.
float edges() {
  vec2 corner = floor(gl_FragCoord.xy) * 4.0;
  vec2 own = texelFetch(tAux, min(ivec2(corner), ivec2(uSize) - 1), 0).rg;
  // Un millième de point de biais: le coin reste le coin malgré l'arrondi des coordonnées.
  vec2 at = (corner + 0.001) * uTexel;
  float ids = 0.0;
  float t[9];
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 3; i++) {
      vec2 tap = textureLod(tAux, at + vec2(float(i), float(j)) * 2.0 * uTexel, 0.0).rg - own;
      ids = max(ids, abs(tap.r));
      t[j * 3 + i] = tap.g;
    }
  }
  float bend = abs(t[0] + t[8] - t[2] - t[6]);
  for (int k = 0; k < 3; k++) {
    bend = max(bend, abs(t[k * 3] + t[k * 3 + 2] - 2.0 * t[k * 3 + 1]));
    bend = max(bend, abs(t[k] + t[k + 6] - 2.0 * t[k + 3]));
  }
  float slopeX = (t[2] + t[5] + t[8] - t[0] - t[3] - t[6]) / 12.0;
  float slopeY = (t[6] + t[7] + t[8] - t[0] - t[1] - t[2]) / 12.0;
  float mean = (t[0] + t[1] + t[2] + t[3] + t[4] + t[5] + t[6] + t[7] + t[8]) / 9.0;
  // Valeur prévue au point lu, s'il est sur le plan des neuf moyennes (leur centre est à un
  // point et demi de lui): elle doit être nulle.
  float off = mean - 1.5 * (slopeX + slopeY);
  bool mixed = ids > uFlat.x || bend > uFlat.y || abs(off) > uFlat.y
    || abs(slopeX) + abs(slopeY) > uFlat.z;
  return mixed ? 1.0 : 0.0;
}

// Masque, second temps (au quart): étalé de uReach carrés, la portée des prises du trait. Une
// lecture filtrée entre deux carrés les voit tous les deux.
float spread() {
  vec2 centre = floor(gl_FragCoord.xy) + 0.5;
  float reach = float(uReach);
  float found = 0.0;
  for (int j = 0; j <= uReach; j++) {
    float y = min(0.5 - reach + 2.0 * float(j), reach);
    for (int i = 0; i <= uReach; i++) {
      float x = min(0.5 - reach + 2.0 * float(i), reach);
      found = max(found, textureLod(tMask, (centre + vec2(x, y)) / uMaskSize, 0.0).r);
    }
  }
  return found > 0.0 ? 1.0 : 0.0;
}

// Pièce et morceau: un octet chacun, numéro sur 6 bits et classe de taille sur 2 bits.
int sizeOf(float code) {
  return int(floor(code / 64.0));
}

// Normale rangée sur deux octets (octaèdre), l'un après l'autre dans un entier.
vec3 normalOf(float code) {
  float high = floor(code / 256.0);
  vec2 e = vec2(high, code - high * 256.0) / 255.0 * 2.0 - 1.0;
  vec3 n = vec3(e, 1.0 - abs(e.x) - abs(e.y));
  float t = max(-n.z, 0.0);
  n.x += n.x >= 0.0 ? -t : t;
  n.y += n.y >= 0.0 ? -t : t;
  return normalize(n);
}

// Une direction de prise (k de 0 à 3: deux longues, droites, et deux courtes, diagonales): deux
// lectures de part et d'autre du point, une par prise.
void probe(int k, vec2 uv, float radius, float depth0, float piece0, float part0, vec3 normal0,
    inout vec2 acc) {
  float angle = 0.4 + float(k) * 0.7853982;
  bool isShort = (k == 1 || k == 3);
  vec2 offset = vec2(cos(angle), sin(angle)) * uTexel * radius * (isShort ? 0.5 : 1.0);
  ivec2 last = ivec2(uSize) - 1;
  float depths = 0.0;
  for (int s = 0; s < 2; s++) {
    vec2 at = uv + (s == 0 ? offset : -offset);
    vec2 aux = texelFetch(tAux, clamp(ivec2(floor(at * uSize)), ivec2(0), last), 0).rg;
    float piece = floor(aux.g / ${String(AUX_PACKING.high)}.0);
    float depth = aux.g - piece * ${String(AUX_PACKING.high)}.0;
    depths += depth;
    float hit = 0.0;
    int rank = 4;
    if (abs(piece - piece0) > 0.5) {
      // Silhouette: le trait appartient à l'objet de devant, et prend son rang.
      rank = sizeOf(depth < depth0 ? piece : piece0);
      hit = 1.0;
    } else {
      float part = floor(aux.r / ${String(AUX_PACKING.high)}.0);
      bool differs = abs(part - part0) > 0.5;
      // Même morceau: une arête là où la normale tourne. Jamais dans une peau lisse (numéro 63,
      // le visage), quel que soit son modelé, ni dans le sol (morceau 0): son relief est dans
      // sa texture.
      if (!differs && part > 0.5 && mod(part, 64.0) < 62.5)
        differs = dot(normalOf(aux.r - part * ${String(AUX_PACKING.high)}.0), normal0) < 0.35;
      if (differs) {
        // Trait intérieur: un rang sous celui du plus petit des deux morceaux.
        rank = min(4, max(sizeOf(part), sizeOf(part0)) + 1);
        hit = 1.0;
      }
    }
    float weight = hit * uRankWeight[rank];
    // Les traits des deux premiers rangs sont épais (prises longues et courtes); les autres ne
    // comptent que sur les prises courtes: ils restent fins.
    if (isShort) acc.y += weight;
    else if (rank <= 1) acc.x += weight;
  }
  // Saut de profondeur dans un même objet (un toit devant son mur): dérivée seconde, donc nulle
  // sur un plan quelle que soit sa pente.
  float leap = step(${OUTLINE.leapMetres.toFixed(3)}, abs(depths - 2.0 * depth0) * uDepthStep);
  float jump = leap * uRankWeight[sizeOf(piece0)];
  if (isShort) acc.y += jump;
  else acc.x += jump;
}

// Part d'encre du point: cherchée seulement là où le masque dit qu'un trait est possible.
float stroke(ivec2 here) {
  vec2 aux0 = texelFetch(tAux, here, 0).rg;
  float depth = texelFetch(tDepth, here, 0).r;
  vec3 world = uCamOrigin + uCamRight * (vUv.x - 0.5) + uCamUp * (vUv.y - 0.5) + uCamForward * depth;
  vec3 nz = texture(uNoise, world.xz * 0.21 + world.y * 0.16).rgb;
  vec3 nz2 = texture(uNoise, world.xz * 0.9 + world.y * 0.7 + 0.4).rgb;
  float piece0 = floor(aux0.g / ${String(AUX_PACKING.high)}.0);
  float depth0 = aux0.g - piece0 * ${String(AUX_PACKING.high)}.0;
  float part0 = floor(aux0.r / ${String(AUX_PACKING.high)}.0);
  vec3 normal0 = normalOf(aux0.r - part0 * ${String(AUX_PACKING.high)}.0);
  // Le tremblé est gardé sur les grandes silhouettes et réduit sur les petits éléments, où il
  // doublerait les lignes.
  float calm = sizeOf(piece0) <= 1 ? 1.0 : 0.3;
  // Épaisseur de 55 à 145 % le long du trait, et un tremblement d'un demi-trait.
  float radius = uRadius * (${OUTLINE.widthRange[0].toFixed(3)} + ${(OUTLINE.widthRange[1] - OUTLINE.widthRange[0]).toFixed(3)} * nz.r);
  vec2 uv = vUv + (nz2.gb - 0.5) * uTexel * uWobble * calm;
  // Accumulateurs: x épais, y fin. Les quatre directions sont toujours lues: sauter les
  // diagonales courtes quand les prises longues ne voient rien amincissait les joints fins
  // (rainure d'un plancher plus étroite que le rayon), essayé et écarté le 2026-11-11.
  vec2 acc = vec2(0.0);
  for (int k = 0; k < 4; k++) probe(k, uv, radius, depth0, piece0, part0, normal0, acc);
  return clamp(max(acc.y * 0.8, acc.x * 0.55), 0.0, 1.0);
}

void main() {
  if (uMode == ${String(MODE.upscale)}) {
    gColor = vec4(upscaled(), 1.0);
    return;
  }
  if (uMode >= ${String(MODE.edges)}) {
    gColor = vec4(uMode == ${String(MODE.edges)} ? edges() : spread());
    return;
  }
  ivec2 here = ivec2(gl_FragCoord.xy);
  vec3 color = texelFetch(tColor, here, 0).rgb;
  if (uRadius > 0.0 && texelFetch(tMask, here >> 2, 0).r > 0.0) color = mix(color, uInk, stroke(here));
  color *= uTint;
  float grey = dot(color, vec3(0.3, 0.59, 0.11));
  color = mix(vec3(grey), color, uGrade.x);
  color = (color - 0.5) * uGrade.y + 0.5;
  // Vignette: plus large que haute, au bord tremblé (bruit en coordonnées d'écran, immobile). Le
  // bruit ne déplace le bord que de trois centièmes: en deçà, le voile est nul et rien n'est lu.
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.82);
  float away = length(q);
  if (uVignette.x > 0.0 && away + 0.03 > uVignette.y) {
    away += (texture(uNoise, vUv * 0.7).g - 0.5) * 0.06;
    float veil = smoothstep(uVignette.y, uVignette.y + uVignette.z, away) * uVignette.x;
    color = mix(color, uVignetteColor, veil);
  }
  gColor = vec4(color * uExposure, 1.0);
}
`;

/**
 * Hiérarchie du trait: un rang est tracé quand ce qu'il cerne fait assez de points à l'écran.
 * `pixelsPerMetre` vient du zoom; sous `fadeFrom` points le trait a disparu, au-dessus de
 * `fadeTo` il est plein. À la vue large, une fenêtre est un cadre et une couleur.
 */
export function rankWeights(
  pixelsPerMetre: number,
  out: number[] = [],
  settings: typeof INK_SETTINGS.outline = INK_SETTINGS.outline,
): number[] {
  settings.rankMetres.forEach((metres, i) => {
    const t = Math.min(
      1,
      Math.max(
        0,
        (metres * pixelsPerMetre - settings.fadeFrom) / (settings.fadeTo - settings.fadeFrom),
      ),
    );
    out[i] = t * t * (3 - 2 * t);
  });
  return out;
}

/** Présence d'un détail selon le zoom: nul sous `from` points par mètre, plein à `to`. */
export function detailShare(pixelsPerMetre: number, range: { from: number; to: number }): number {
  const t = Math.min(1, Math.max(0, (pixelsPerMetre - range.from) / (range.to - range.from)));
  return t * t * (3 - 2 * t);
}

/** Fenêtre de profondeur de l'image du contour: voir `depthWindow`. */
export interface DepthWindow {
  /** Début de la fenêtre, en part de l'étendue de la caméra (0: plan proche). */
  readonly from: number;
  /** Étendue de la caméra divisée par celle de la fenêtre. */
  readonly scale: number;
  /** Longueur de la fenêtre (m). */
  readonly span: number;
}

/**
 * Fenêtre de profondeur autour du point visé, à `focus` mètres de la caméra le long de son axe.
 * Elle s'élargit avec la hauteur de la vue (m): d'un bord à l'autre de l'écran, le sol s'éloigne
 * au plus d'une fois et demie cette hauteur (caméra à 35 degrés au plus bas).
 */
export function depthWindow(
  focus: number,
  near: number,
  far: number,
  viewHeight: number,
  settings: typeof INK_SETTINGS.outline = INK_SETTINGS.outline,
): DepthWindow {
  const range = Math.max(1e-6, far - near);
  const span = Math.min(range, settings.depthSpan + 2 * viewHeight);
  const start = Math.min(range - span, Math.max(0, focus - near - span / 2));
  return { from: start / range, scale: range / span, span };
}

/** Réglage du masque du trait pour une image: voir `maskSetup`. */
export interface MaskSetup {
  /** Portée en carrés de quatre points: aucune prise du trait ne lit plus loin. */
  readonly reach: number;
  /** Écart au plan admis, en pas de profondeur; négatif: masque retiré, tout est cherché. */
  readonly plane: number;
  /** Pente admise, en pas de profondeur par point. */
  readonly steep: number;
}

/**
 * Le masque du trait pour un rayon de trait (points de la cible) et une fenêtre de profondeur
 * de `depthRange` mètres. Une prise s'éloigne du point d'au plus le plus long rayon du trait, plus le tremblé (dont
 * la moitié de chaque côté), et lit le point de texture le plus proche: c'est la portée. Un pli
 * du sol ne trace un trait que si sa cassure, sur cette portée, atteint le saut de profondeur:
 * le seuil du masque est la part de cette cassure qu'il en voit dans le pire cas.
 */
export function maskSetup(
  radius: number,
  depthRange: number,
  settings: typeof INK_SETTINGS.outline = INK_SETTINGS.outline,
): MaskSetup {
  const wobble = radius * settings.wobble;
  const farthest = radius * settings.widthRange[1] + wobble / 2 + 0.5;
  const step = Math.max(1e-9, depthRange) / AUX_PACKING.depthSteps;
  const plane = (settings.mask.creaseShare * settings.leapMetres) / farthest / step;
  return {
    reach: Math.max(1, Math.ceil(Math.floor(farthest) / 4)),
    plane: plane < settings.mask.minSteps ? -1 : plane,
    steep: (settings.mask.steepShare * settings.leapMetres) / (wobble + 1) / step,
  };
}

/** Les deux nombres de l'image du contour pour le fond vide de teinte `background` (0 à 1). */
export function backgroundAux(
  background: readonly [number, number, number],
  out: Float32Array = new Float32Array(4),
): Float32Array {
  const byte = (value: number): number => Math.round(Math.min(1, Math.max(0, value)) * 255);
  // Ce que l'effacement de la cible y laissait: la teinte du fond lue comme normale et morceau,
  // la pièce au plus haut, la profondeur au plus loin.
  const part = byte(background[2]);
  const normal =
    part === 0 ? AUX_PACKING.flatNormal : byte(background[0]) * 256 + byte(background[1]);
  out[0] = part * AUX_PACKING.high + normal;
  out[1] = AUX_PACKING.backgroundPiece * AUX_PACKING.high + AUX_PACKING.depthSteps;
  out[2] = 0;
  out[3] = 1;
  return out;
}

const right = new Vector3();
const up = new Vector3();
const back = new Vector3();
const patch = new Color();

/** Mire de contrôle des couleurs: valeurs d'écran (sRGB, 0 à 255) qui doivent ressortir telles quelles. */
export const COLOR_CHART: readonly (readonly [number, number, number])[] = [
  [163, 182, 89],
  [200, 85, 61],
  [42, 48, 72],
  [128, 128, 128],
  [250, 240, 220],
];

function maskTarget(filter: typeof LinearFilter | typeof NearestFilter): WebGLRenderTarget {
  const target = new WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    format: RedFormat,
    type: UnsignedByteType,
  });
  target.texture.minFilter = filter;
  target.texture.magFilter = filter;
  target.texture.generateMipmaps = false;
  return target;
}

export class InkPass {
  readonly target: WebGLRenderTarget;
  private readonly material: RawShaderMaterial;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly triangle = new BufferGeometry();
  private readonly weights: number[] = [1, 1, 1, 1, 1];
  /** Image finie à l'échelle interne, avant sa mise à l'échelle: créée à la première échelle sous 1. */
  private resolved: WebGLRenderTarget | null = null;
  /** Masque du trait, au quart de la définition: brut, puis étalé (celui que le trait lit). */
  private readonly quarter = maskTarget(LinearFilter);
  private readonly mask = maskTarget(NearestFilter);
  private readonly background = new Float32Array(4);

  constructor(width: number, height: number, noise: Texture) {
    this.target = new WebGLRenderTarget(width, height, {
      count: 2,
      depthTexture: new DepthTexture(width, height, UnsignedIntType),
    });
    const [color, aux] = this.target.textures;
    if (color !== undefined) {
      color.minFilter = NearestFilter;
      color.magFilter = NearestFilter;
      color.generateMipmaps = false;
    }
    if (aux !== undefined) {
      // Deux nombres de 32 bits par point (`AUX_PACKING`); lus tels quels par le trait
      // (`texelFetch`), et en moyennes de quatre points par le masque (filtrage linéaire).
      aux.format = RGFormat;
      aux.type = FloatType;
      aux.minFilter = LinearFilter;
      aux.magFilter = LinearFilter;
      aux.generateMipmaps = false;
    }
    this.material = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: color ?? null },
        tAux: { value: aux ?? null },
        tDepth: { value: this.target.depthTexture },
        tMask: { value: this.mask.texture },
        uNoise: { value: noise },
        uMode: { value: MODE.outline },
        uReach: { value: 1 },
        uMaskSize: { value: new Vector2(1, 1) },
        uFlat: { value: new Vector3(OUTLINE.mask.sameTolerance, -1, 0) },
        uTexel: { value: new Vector2(1 / width, 1 / height) },
        uRadius: { value: 0 },
        uWobble: { value: 0 },
        uDepthStep: { value: 1 },
        uCamOrigin: { value: new Vector3() },
        uCamRight: { value: new Vector3() },
        uCamUp: { value: new Vector3() },
        uCamForward: { value: new Vector3() },
        uInk: { value: new Vector3() },
        uTint: { value: new Vector3(1, 1, 1) },
        uVignetteColor: { value: new Vector3() },
        uVignette: { value: new Vector3() },
        uGrade: { value: new Vector2(1, 1) },
        uExposure: { value: 1 },
        uRankWeight: { value: this.weights },
        uSize: { value: new Vector2(width, height) },
      },
    });
    this.triangle.setAttribute(
      'position',
      new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    );
    this.triangle.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const mesh = new Mesh(this.triangle, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.setSize(width, height);
  }

  setSize(width: number, height: number): void {
    this.target.setSize(width, height);
    this.resolved?.setSize(width, height);
    this.quarter.setSize(Math.ceil(width / 4), Math.ceil(height / 4));
    this.mask.setSize(Math.ceil(width / 4), Math.ceil(height / 4));
    (this.material.uniforms.uTexel?.value as Vector2).set(1 / width, 1 / height);
    (this.material.uniforms.uSize?.value as Vector2).set(width, height);
  }

  /** L'image finie intermédiaire existe (une échelle sous 1 a servi): une texture de plus. */
  get scaled(): boolean {
    return this.resolved !== null;
  }

  /** Points des deux étapes du masque (mesure: ils s'ajoutent à ceux du contour). */
  get maskPixels(): number {
    return 2 * this.mask.width * this.mask.height;
  }

  /**
   * Pose le fond vide dans l'image du contour, juste après l'effacement de la cible (elle doit
   * être la cible courante): l'effacement commun y écrirait la teinte du fond, qui n'est pas un
   * code.
   */
  clearAux(renderer: WebGLRenderer, background: readonly [number, number, number]): void {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    gl.clearBufferfv(gl.COLOR, 1, backgroundAux(background, this.background));
  }

  /** Dessine le triangle plein écran dans `to` (`null`: le canevas), à l'étape `mode`. */
  private draw(
    renderer: WebGLRenderer,
    to: WebGLRenderTarget | null,
    mode: (typeof MODE)[keyof typeof MODE],
  ): void {
    const u = this.material.uniforms;
    if (u.uMode) u.uMode.value = mode;
    renderer.setRenderTarget(to);
    renderer.render(this.scene, this.camera);
  }

  /**
   * Le masque du trait, en deux étapes (voir le nuanceur). Une étape ne lit jamais la cible où
   * elle écrit: pendant la première, `tMask` désigne le masque étalé de l'image d'avant.
   */
  private buildMask(renderer: WebGLRenderer, radius: number, depthRange: number): void {
    const u = this.material.uniforms;
    const setup = maskSetup(radius, depthRange);
    (u.uFlat?.value as Vector3).set(OUTLINE.mask.sameTolerance, setup.plane, setup.steep);
    if (u.uReach) u.uReach.value = setup.reach;
    this.draw(renderer, this.quarter, MODE.edges);
    if (u.tMask) u.tMask.value = this.quarter.texture;
    (u.uMaskSize?.value as Vector2).set(this.quarter.width, this.quarter.height);
    this.draw(renderer, this.mask, MODE.spread);
    if (u.tMask) u.tMask.value = this.mask.texture;
  }

  /** Trace l'image finie: droit vers le canevas à l'échelle 1, sinon par la mise à l'échelle. */
  private present(renderer: WebGLRenderer, outWidth: number, outHeight: number): void {
    const { width, height } = this.target;
    if (width === outWidth && height === outHeight) {
      this.draw(renderer, null, MODE.outline);
      return;
    }
    if (this.resolved === null) {
      this.resolved = new WebGLRenderTarget(width, height, { depthBuffer: false });
      this.resolved.texture.minFilter = LinearFilter;
      this.resolved.texture.magFilter = LinearFilter;
      this.resolved.texture.generateMipmaps = false;
    }
    const u = this.material.uniforms;
    this.draw(renderer, this.resolved, MODE.outline);
    // Seconde passe du même programme: l'image finie, lue filtrée, vers le canevas.
    if (u.tColor) u.tColor.value = this.resolved.texture;
    this.draw(renderer, null, MODE.upscale);
    if (u.tColor) u.tColor.value = this.target.textures[0] ?? null;
  }

  /**
   * Mire de contrôle (outil de mesure): chaque ton de `COLOR_CHART` est écrit dans la cible, passe
   * par la même chaîne que le jeu (contour sans trait ni teinte, mise à l'échelle s'il y en a une)
   * et est relu dans le canevas. `out` reçoit trois octets par ton. À appeler juste avant une
   * image normale, qui recouvre la mire: elle n'est jamais montrée.
   */
  probe(renderer: WebGLRenderer, outWidth: number, outHeight: number, out: Uint8Array): void {
    const u = this.material.uniforms;
    const kept = {
      radius: Number(u.uRadius?.value ?? 0),
      exposure: Number(u.uExposure?.value ?? 1),
      tint: (u.uTint?.value as Vector3).clone(),
      vignette: (u.uVignette?.value as Vector3).clone(),
      grade: (u.uGrade?.value as Vector2).clone(),
    };
    if (u.uRadius) u.uRadius.value = 0;
    if (u.uExposure) u.uExposure.value = 1;
    (u.uTint?.value as Vector3).set(1, 1, 1);
    (u.uVignette?.value as Vector3).set(0, 2, 1);
    (u.uGrade?.value as Vector2).set(1, 1);
    const gl = renderer.getContext();
    const pixel = new Uint8Array(4);
    COLOR_CHART.forEach((tone, i) => {
      renderer.setRenderTarget(this.target);
      // Sans espace de couleur: les trois nombres sont écrits tels quels dans la cible.
      renderer.setClearColor(patch.setRGB(tone[0] / 255, tone[1] / 255, tone[2] / 255), 1);
      renderer.clear();
      this.present(renderer, outWidth, outHeight);
      gl.readPixels(outWidth >> 1, outHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      out.set(pixel.subarray(0, 3), i * 3);
    });
    if (u.uRadius) u.uRadius.value = kept.radius;
    if (u.uExposure) u.uExposure.value = kept.exposure;
    (u.uTint?.value as Vector3).copy(kept.tint);
    (u.uVignette?.value as Vector3).copy(kept.vignette);
    (u.uGrade?.value as Vector2).copy(kept.grade);
  }

  setAmbiance(ambiance: Readonly<Ambiance>): void {
    const u = this.material.uniforms;
    (u.uInk?.value as Vector3).set(...ambiance.ink);
    (u.uTint?.value as Vector3).set(...ambiance.tint);
    (u.uVignetteColor?.value as Vector3).set(...ambiance.vignetteColor);
    (u.uVignette?.value as Vector3).set(ambiance.vignette, ambiance.vignetteStart, 0.42);
    const grade = INK_SETTINGS.grade;
    (u.uGrade?.value as Vector2).set(
      ambiance.saturation * grade.saturation,
      ambiance.contrast * grade.contrast,
    );
  }

  /**
   * Trace le contour de la cible vers le canevas. `pixelsPerMetre`: zoom de la vue (il choisit
   * les rangs de trait tracés); `exposure`: 1 hors fondu, 0 au noir; `depthSpan`: longueur (m) de
   * la fenêtre de profondeur dans laquelle la scène a écrit l'image du contour; `zoom`: facteur
   * d'épaisseur; `outWidth` et `outHeight`: taille du canevas (celle de la cible par défaut).
   */
  render(
    renderer: WebGLRenderer,
    camera: OrthographicCamera,
    pixelsPerMetre: number,
    exposure: number,
    depthSpan: number,
    zoom = 1,
    outWidth: number = this.target.width,
    outHeight: number = this.target.height,
  ): void {
    const s = OUTLINE;
    const u = this.material.uniforms;
    const radius = (s.radius * zoom * this.target.height) / s.referenceHeight;
    rankWeights(pixelsPerMetre, this.weights);
    if (u.uRadius) u.uRadius.value = radius;
    if (u.uWobble) u.uWobble.value = radius * s.wobble;
    if (u.uExposure) u.uExposure.value = exposure;
    if (u.uDepthStep) u.uDepthStep.value = depthSpan / AUX_PACKING.depthSteps;
    camera.matrixWorld.extractBasis(right, up, back);
    const width = (camera.right - camera.left) / camera.zoom;
    const height = (camera.top - camera.bottom) / camera.zoom;
    (u.uCamRight?.value as Vector3).copy(right).multiplyScalar(width);
    (u.uCamUp?.value as Vector3).copy(up).multiplyScalar(height);
    (u.uCamForward?.value as Vector3).copy(back).multiplyScalar(-(camera.far - camera.near));
    (u.uCamOrigin?.value as Vector3).copy(camera.position).addScaledVector(back, -camera.near);
    if (radius > 0) this.buildMask(renderer, radius, depthSpan);
    this.present(renderer, outWidth, outHeight);
  }

  dispose(): void {
    this.target.depthTexture?.dispose();
    this.target.dispose();
    this.resolved?.dispose();
    this.quarter.dispose();
    this.mask.dispose();
    this.material.dispose();
    this.triangle.dispose();
  }
}
