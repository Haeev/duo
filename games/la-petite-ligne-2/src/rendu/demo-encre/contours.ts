/**
 * Essai « encre »: la passe d'encrage. La scène est rendue une fois dans une cible à deux sorties
 * (couleur; normale, numéro de morceau et numéro de pièce) avec sa profondeur. Une passe plein
 * écran trace ensuite le trait: épais là où le numéro de pièce change ou la profondeur saute
 * (silhouettes), fin là où la normale tourne ou le morceau change (arêtes, joints de planches). L'épaisseur et la position du trait suivent un bruit ancré au
 * monde: le trait est irrégulier, mais ne grouille pas quand la caméra bouge. La même passe pose
 * la teinte dominante et la vignette.
 */
import * as THREE from 'three';

import type { Ambiance } from './ambiances';

const VERTEX = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
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
uniform float uRankWeight[5];

// Objet et morceau: un octet chacun, numéro sur 6 bits et classe de taille sur 2 bits.
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

void main() {
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
    float thick = 0.0;
    float thin = 0.0;
    for (int k = 0; k < 4; k++) {
      // Quatre directions: deux longues (droites) et deux courtes (diagonales).
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
          if (abs(part - part0) > 0.5 || (bend < 0.35 && !sleek)) {
            // Trait intérieur: un rang sous celui du plus petit des deux morceaux.
            rank = min(4, max(sizeOf(part), sizeOf(part0)) + 1);
            hit = 1.0;
          }
        }
        float weight = hit * uRankWeight[rank];
        // Les traits des deux premiers rangs sont épais (prises longues et courtes); les autres
        // ne comptent que sur les prises courtes: ils restent fins.
        if (isShort) thin += weight;
        else if (rank <= 1) thick += weight;
      }
      // Saut de profondeur dans un même objet (un toit devant son mur): dérivée seconde, donc
      // nulle sur un plan quelle que soit sa pente.
      float jump = step(0.3, abs(depths[0] + depths[1] - 2.0 * depth0) * uDepthRange) * uRankWeight[sizeOf(piece0)];
      if (isShort) thin += jump;
      else thick += jump;
    }
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
  gColor = vec4(color, 1.0);
}
`;

/** Taille représentative de chaque rang de trait, en mètres: de la maison au bouton de porte. */
const RANK_METRES = [4, 1.6, 0.6, 0.25, 0.14] as const;

/**
 * Hiérarchie du trait: un rang est tracé quand ce qu'il cerne fait assez de points à l'écran.
 * `pixelsPerMetre` vient du zoom; sous `fadeFrom` points le trait a disparu, au-dessus de
 * `fadeTo` il est plein. À la vue large, une fenêtre est un cadre et une couleur.
 */
export function rankWeights(pixelsPerMetre: number, fadeFrom = 12, fadeTo = 28): number[] {
  return RANK_METRES.map((metres) => {
    const t = Math.min(1, Math.max(0, (metres * pixelsPerMetre - fadeFrom) / (fadeTo - fadeFrom)));
    return t * t * (3 - 2 * t);
  });
}

export class InkPass {
  readonly target: THREE.WebGLRenderTarget;
  private readonly material: THREE.ShaderMaterial;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(width: number, height: number, noise: THREE.Texture) {
    this.target = new THREE.WebGLRenderTarget(width, height, {
      count: 2,
      depthTexture: new THREE.DepthTexture(width, height, THREE.UnsignedIntType),
    });
    for (const texture of this.target.textures) {
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
    }
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.target.textures[0] ?? null },
        tAux: { value: this.target.textures[1] ?? null },
        tDepth: { value: this.target.depthTexture },
        uNoise: { value: noise },
        uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
        uRadius: { value: 0 },
        uWobble: { value: 0 },
        uDepthRange: { value: 1 },
        uCamOrigin: { value: new THREE.Vector3() },
        uCamRight: { value: new THREE.Vector3() },
        uCamUp: { value: new THREE.Vector3() },
        uCamForward: { value: new THREE.Vector3() },
        uInk: { value: new THREE.Vector3() },
        uTint: { value: new THREE.Vector3(1, 1, 1) },
        uVignetteColor: { value: new THREE.Vector3() },
        uVignette: { value: new THREE.Vector3() },
        uGrade: { value: new THREE.Vector2(1, 1) },
        uRankWeight: { value: [1, 1, 1, 1, 1] },
      },
    });
    const triangle = new THREE.BufferGeometry();
    triangle.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    );
    triangle.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const mesh = new THREE.Mesh(triangle, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  setSize(width: number, height: number): void {
    this.target.setSize(width, height);
    const texel = this.material.uniforms.uTexel?.value as THREE.Vector2;
    texel.set(1 / width, 1 / height);
  }

  setAmbiance(ambiance: Ambiance): void {
    const u = this.material.uniforms;
    (u.uInk?.value as THREE.Vector3).set(...ambiance.ink);
    (u.uTint?.value as THREE.Vector3).set(...ambiance.tint);
    (u.uVignetteColor?.value as THREE.Vector3).set(...ambiance.vignetteColor);
    (u.uVignette?.value as THREE.Vector3).set(ambiance.vignette, ambiance.vignetteStart, 0.42);
    (u.uGrade?.value as THREE.Vector2).set(ambiance.saturation, ambiance.contrast);
  }

  /**
   * `radius`: demi-épaisseur du trait en points d'écran; 0 coupe le contour (teinte et vignette
   * restent). `rankWeights`: présence de chacun des cinq rangs de trait, de la grande silhouette
   * au plus petit détail (voir `rankWeights`).
   */
  render(
    renderer: THREE.WebGLRenderer,
    camera: THREE.OrthographicCamera,
    radius: number,
    weights: readonly number[],
  ): void {
    const u = this.material.uniforms;
    if (u.uRankWeight) u.uRankWeight.value = weights;
    if (u.uRadius) u.uRadius.value = radius;
    if (u.uWobble) u.uWobble.value = radius * 0.7;
    if (u.uDepthRange) u.uDepthRange.value = camera.far - camera.near;
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const back = new THREE.Vector3();
    camera.matrixWorld.extractBasis(right, up, back);
    const width = (camera.right - camera.left) / camera.zoom;
    const height = (camera.top - camera.bottom) / camera.zoom;
    (u.uCamRight?.value as THREE.Vector3).copy(right).multiplyScalar(width);
    (u.uCamUp?.value as THREE.Vector3).copy(up).multiplyScalar(height);
    (u.uCamForward?.value as THREE.Vector3).copy(back).multiplyScalar(-(camera.far - camera.near));
    (u.uCamOrigin?.value as THREE.Vector3)
      .copy(camera.position)
      .addScaledVector(back, -camera.near);
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }
}
