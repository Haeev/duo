/**
 * Rendu encré: la passe de contour (ADR 0023). La scène est rendue une fois dans une cible à deux
 * sorties (couleur; normale, numéro de morceau et numéro de pièce) avec sa profondeur. Une passe
 * plein écran trace ensuite le trait: épais là où le numéro de pièce change ou la profondeur
 * saute (silhouettes), fin là où la normale tourne ou le morceau change (arêtes, joints).
 * L'épaisseur et la position du trait suivent un bruit ancré au monde: le trait est irrégulier,
 * mais ne grouille pas quand la caméra bouge. Le trait est hiérarchisé: chaque pièce et chaque
 * morceau porte une classe de taille, et un rang de trait n'est tracé que si ce qu'il cerne fait
 * assez de points à l'écran. La même passe pose la teinte dominante, la vignette et les fondus
 * au noir du moteur (sommeil, montée dans le train).
 */
import {
  BufferGeometry,
  Color,
  DepthTexture,
  Float32BufferAttribute,
  GLSL3,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  RawShaderMaterial,
  Scene,
  type Texture,
  UnsignedIntType,
  Vector2,
  Vector3,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type { Ambiance } from './ambiances';
import { INK_SETTINGS } from './reglages';

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

const FRAGMENT = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
layout(location = 0) out highp vec4 gColor;
in vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tAux;
uniform highp sampler2D tDepth;
uniform sampler2D uNoise;
uniform vec2 uTexel;
uniform float uRadius;
uniform float uWobble;
uniform float uDepthRange;
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
uniform float uUpscale;
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

// Pièce et morceau: un octet chacun, numéro sur 6 bits et classe de taille sur 2 bits.
float pieceOf(vec4 aux) {
  return floor(aux.a * 255.0 + 0.5);
}

float partOf(vec4 aux) {
  return floor(aux.b * 255.0 + 0.5);
}

int sizeOf(float code) {
  return int(floor(code / 64.0));
}

vec3 normalOf(vec4 aux) {
  vec2 e = aux.rg * 2.0 - 1.0;
  vec3 n = vec3(e, 1.0 - abs(e.x) - abs(e.y));
  float t = max(-n.z, 0.0);
  n.x += n.x >= 0.0 ? -t : t;
  n.y += n.y >= 0.0 ? -t : t;
  return normalize(n);
}

// Une direction de prise (k de 0 à 3: deux longues, droites, et deux courtes, diagonales): deux
// lectures de part et d'autre du point, morceau, pièce, normale et profondeur.
void probe(int k, vec2 uv, float radius, float depth0, float piece0, float part0, vec3 normal0,
    inout vec4 acc) {
  float angle = 0.4 + float(k) * 0.7853982;
  bool isShort = (k == 1 || k == 3);
  vec2 offset = vec2(cos(angle), sin(angle)) * uTexel * radius * (isShort ? 0.5 : 1.0);
  float depths[2];
  for (int s = 0; s < 2; s++) {
    vec2 at = uv + (s == 0 ? offset : -offset);
    vec4 aux = texture(tAux, at);
    float depth = texture(tDepth, at).r;
    depths[s] = depth;
    float piece = pieceOf(aux);
    float hit = 0.0;
    int rank = 4;
    if (abs(piece - piece0) > 0.5) {
      // Silhouette: le trait appartient à l'objet de devant, et prend son rang.
      rank = sizeOf(depth < depth0 ? piece : piece0);
      hit = 1.0;
    } else {
      float part = partOf(aux);
      float bend = dot(normalOf(aux), normal0);
      // Peau lisse (numéro 63, le visage): aucune arête tracée dedans, quel que soit son modelé.
      bool sleek = mod(part, 64.0) > 62.5 && mod(part0, 64.0) > 62.5;
      // Le sol (morceau 0) ne se cerne pas lui-même: son relief est dans sa texture.
      bool ground = part < 0.5 && part0 < 0.5;
      if (abs(part - part0) > 0.5 || (bend < 0.35 && !sleek && !ground)) {
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
  float leap = step(0.3, abs(depths[0] + depths[1] - 2.0 * depth0) * uDepthRange);
  float jump = leap * uRankWeight[sizeOf(piece0)];
  if (isShort) acc.y += jump;
  else acc.x += jump;
}

void main() {
  if (uUpscale > 0.5) {
    gColor = vec4(upscaled(), 1.0);
    return;
  }
  vec3 color = texture(tColor, vUv).rgb;
  if (uRadius > 0.0) {
    vec4 aux0 = texture(tAux, vUv);
    float depth0 = texture(tDepth, vUv).r;
    vec3 world = uCamOrigin + uCamRight * (vUv.x - 0.5) + uCamUp * (vUv.y - 0.5) + uCamForward * depth0;
    vec3 nz = texture(uNoise, world.xz * 0.21 + world.y * 0.16).rgb;
    vec3 nz2 = texture(uNoise, world.xz * 0.9 + world.y * 0.7 + 0.4).rgb;
    vec3 normal0 = normalOf(aux0);
    float piece0 = pieceOf(aux0);
    float part0 = partOf(aux0);
    // Le tremblé est gardé sur les grandes silhouettes et réduit sur les petits éléments, où il
    // doublerait les lignes.
    float calm = sizeOf(piece0) <= 1 ? 1.0 : 0.3;
    // Épaisseur de 55 à 145 % le long du trait, et un tremblement d'un demi-trait.
    float radius = uRadius * (0.55 + 0.9 * nz.r);
    vec2 uv = vUv + (nz2.gb - 0.5) * uTexel * uWobble * calm;
    // Accumulateurs: x épais, y fin. Les quatre directions sont toujours lues: sauter les
    // diagonales courtes quand les prises longues ne voient rien amincissait les joints fins
    // (rainure d'un plancher plus étroite que le rayon), essayé et écarté le 2026-11-11.
    vec4 acc = vec4(0.0);
    for (int k = 0; k < 4; k++) probe(k, uv, radius, depth0, piece0, part0, normal0, acc);
    float thick = acc.x;
    float thin = acc.y;
    float line = clamp(max(thin * 0.8, thick * 0.55), 0.0, 1.0);
    color = mix(color, uInk, line);
  }
  color *= uTint;
  float grey = dot(color, vec3(0.3, 0.59, 0.11));
  color = mix(vec3(grey), color, uGrade.x);
  color = (color - 0.5) * uGrade.y + 0.5;
  // Vignette: plus large que haute, au bord tremblé (bruit en coordonnées d'écran, immobile).
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.82);
  float away = length(q) + (texture(uNoise, vUv * 0.7).g - 0.5) * 0.06;
  float veil = smoothstep(uVignette.y, uVignette.y + uVignette.z, away) * uVignette.x;
  color = mix(color, uVignetteColor, veil);
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

export class InkPass {
  readonly target: WebGLRenderTarget;
  private readonly material: RawShaderMaterial;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly triangle = new BufferGeometry();
  private readonly weights: number[] = [1, 1, 1, 1, 1];
  /** Image finie à l'échelle interne, avant sa mise à l'échelle: créée à la première échelle sous 1. */
  private resolved: WebGLRenderTarget | null = null;

  constructor(width: number, height: number, noise: Texture) {
    this.target = new WebGLRenderTarget(width, height, {
      count: 2,
      depthTexture: new DepthTexture(width, height, UnsignedIntType),
    });
    for (const texture of this.target.textures) {
      texture.minFilter = NearestFilter;
      texture.magFilter = NearestFilter;
      texture.generateMipmaps = false;
    }
    this.material = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.target.textures[0] ?? null },
        tAux: { value: this.target.textures[1] ?? null },
        tDepth: { value: this.target.depthTexture },
        uNoise: { value: noise },
        uTexel: { value: new Vector2(1 / width, 1 / height) },
        uRadius: { value: 0 },
        uWobble: { value: 0 },
        uDepthRange: { value: 1 },
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
        uUpscale: { value: 0 },
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
  }

  setSize(width: number, height: number): void {
    this.target.setSize(width, height);
    this.resolved?.setSize(width, height);
    (this.material.uniforms.uTexel?.value as Vector2).set(1 / width, 1 / height);
    (this.material.uniforms.uSize?.value as Vector2).set(width, height);
  }

  /** L'image finie intermédiaire existe (une échelle sous 1 a servi): une texture de plus. */
  get scaled(): boolean {
    return this.resolved !== null;
  }

  /** Trace l'image finie: droit vers le canevas à l'échelle 1, sinon par la mise à l'échelle. */
  private present(renderer: WebGLRenderer, outWidth: number, outHeight: number): void {
    const { width, height } = this.target;
    if (width === outWidth && height === outHeight) {
      renderer.setRenderTarget(null);
      renderer.render(this.scene, this.camera);
      return;
    }
    if (this.resolved === null) {
      this.resolved = new WebGLRenderTarget(width, height, { depthBuffer: false });
      this.resolved.texture.minFilter = LinearFilter;
      this.resolved.texture.magFilter = LinearFilter;
      this.resolved.texture.generateMipmaps = false;
    }
    const u = this.material.uniforms;
    renderer.setRenderTarget(this.resolved);
    renderer.render(this.scene, this.camera);
    // Seconde passe du même programme: l'image finie, lue filtrée, vers le canevas.
    if (u.tColor) u.tColor.value = this.resolved.texture;
    if (u.uUpscale) u.uUpscale.value = 1;
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
    if (u.tColor) u.tColor.value = this.target.textures[0] ?? null;
    if (u.uUpscale) u.uUpscale.value = 0;
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
   * les rangs de trait tracés); `exposure`: 1 hors fondu, 0 au noir; `zoom`: facteur d'épaisseur;
   * `outWidth` et `outHeight`: taille du canevas (celle de la cible par défaut).
   */
  render(
    renderer: WebGLRenderer,
    camera: OrthographicCamera,
    pixelsPerMetre: number,
    exposure: number,
    zoom = 1,
    outWidth: number = this.target.width,
    outHeight: number = this.target.height,
  ): void {
    const s = INK_SETTINGS.outline;
    const u = this.material.uniforms;
    const radius = (s.radius * zoom * this.target.height) / s.referenceHeight;
    rankWeights(pixelsPerMetre, this.weights);
    if (u.uRadius) u.uRadius.value = radius;
    if (u.uWobble) u.uWobble.value = radius * s.wobble;
    if (u.uExposure) u.uExposure.value = exposure;
    if (u.uDepthRange) u.uDepthRange.value = camera.far - camera.near;
    camera.matrixWorld.extractBasis(right, up, back);
    const width = (camera.right - camera.left) / camera.zoom;
    const height = (camera.top - camera.bottom) / camera.zoom;
    (u.uCamRight?.value as Vector3).copy(right).multiplyScalar(width);
    (u.uCamUp?.value as Vector3).copy(up).multiplyScalar(height);
    (u.uCamForward?.value as Vector3).copy(back).multiplyScalar(-(camera.far - camera.near));
    (u.uCamOrigin?.value as Vector3).copy(camera.position).addScaledVector(back, -camera.near);
    this.present(renderer, outWidth, outHeight);
  }

  dispose(): void {
    this.target.depthTexture?.dispose();
    this.target.dispose();
    this.resolved?.dispose();
    this.material.dispose();
    this.triangle.dispose();
  }
}
