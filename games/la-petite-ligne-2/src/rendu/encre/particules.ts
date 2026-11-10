/**
 * Rendu encré: les particules de l'air, sobres. De jour, de la poussière claire qui dérive au
 * vent à hauteur de genou; au crépuscule et la nuit, quelques lucioles qui errent et clignotent.
 * Un seul appel de dessin instancié, tout le mouvement dans le nuanceur de sommets (rien à mettre
 * à jour par image), dessin à bord net: pas de flou, on reste dans l'encre. Le semis suit le
 * point visé en se repliant sur lui-même: il y en a partout, sans rien créer en marchant. Les
 * particules s'ajoutent à la couleur sans toucher à l'image du contour: aucun trait autour.
 */
import {
  CustomBlending,
  Float32BufferAttribute,
  GLSL3,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  OneFactor,
  ShaderMaterial,
  Vector4,
  ZeroFactor,
} from 'three';
import type { Ambiance } from './ambiances';
import type { InkUniforms } from './matiere';

const VERTEX = /* glsl */ `
in vec4 aSeed;
uniform float uTime;
uniform vec2 uWind;
uniform vec2 uScreen;
uniform float uPixel;
uniform vec4 uMote;
uniform vec4 uMoteArea;
out vec2 vCorner;
out float vLife;
void main() {
  float phase = aSeed.w * 6.2832;
  // Repli autour du point visé: la particule garde sa place dans le monde tant qu'elle est en vue.
  vec3 centre = aSeed.xyz;
  centre.xz = uMoteArea.xy + mod(aSeed.xz - uMoteArea.xy + uMoteArea.z * 0.5, uMoteArea.z) - uMoteArea.z * 0.5;
  float life;
  float size;
  if (uMote.x > 0.5) {
    // Luciole: une errance lente autour de sa place, un clignotement long.
    centre.x += sin(uTime * 0.31 + phase) * 1.3 + sin(uTime * 0.83 + phase * 2.1) * 0.35;
    centre.z += cos(uTime * 0.27 + phase * 1.3) * 1.3 + sin(uTime * 0.71 + phase) * 0.35;
    centre.y += sin(uTime * 0.6 + phase * 1.7) * 0.3;
    life = smoothstep(0.1, 0.75, sin(uTime * 1.25 + phase * 5.0));
    size = uMote.y;
  } else {
    // Poussière: elle dérive avec le vent sur 6 m puis renaît, en montant un peu.
    float span = fract(uTime * 0.045 * (0.6 + aSeed.w) + aSeed.w);
    centre.xz += uWind * (span - 0.5) * 6.0;
    centre.y += span * 0.5 + sin(uTime * 0.9 + phase) * 0.08;
    life = smoothstep(0.0, 0.2, span) * (1.0 - smoothstep(0.75, 1.0, span));
    size = uMote.y * (0.6 + fract(aSeed.w * 7.3) * 0.8);
  }
  vCorner = position.xy;
  vLife = life;
  vec4 clip = projectionMatrix * viewMatrix * vec4(centre, 1.0);
  clip.xy += position.xy * size * uPixel * 2.0 / uScreen * clip.w;
  gl_Position = life > 0.01 ? clip : vec4(0.0, 0.0, 2.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
layout(location = 0) out highp vec4 gColor;
layout(location = 1) out highp vec4 gAux;
in vec2 vCorner;
in float vLife;
uniform vec4 uMoteColor;
uniform vec4 uMote;
void main() {
  // Losange à bord net; la luciole a un halo d'un seul ton autour de son coeur.
  float d = abs(vCorner.x) + abs(vCorner.y);
  float core = step(d, uMote.x > 0.5 ? 0.3 : 0.85);
  float halo = step(d, 1.0) * uMote.z;
  float amount = max(core, halo) * vLife * uMoteColor.a;
  if (amount <= 0.0) discard;
  gColor = vec4(uMoteColor.rgb * amount, 1.0);
  gAux = vec4(0.0);
}
`;

export interface Motes {
  readonly mesh: Mesh;
  /** Règle le genre de particule sur l'ambiance et recentre le semis sur le point visé. */
  update(ambiance: Readonly<Ambiance>, x: number, z: number): void;
  dispose(): void;
}

export function createMotes(
  uniforms: InkUniforms,
  settings: { readonly count: number; readonly span: number },
): Motes {
  const quad = new InstancedBufferGeometry();
  quad.setAttribute(
    'position',
    new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3),
  );
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  const seeds = new Float32Array(settings.count * 4);
  const rnd = (n: number): number => {
    const s = Math.sin(n * 91.7 + 13.1) * 43758.5453;
    return s - Math.floor(s);
  };
  for (let i = 0; i < settings.count; i += 1) {
    seeds[i * 4] = rnd(i * 3 + 1) * settings.span;
    seeds[i * 4 + 1] = 0.35 + rnd(i * 3 + 3) * 0.9;
    seeds[i * 4 + 2] = rnd(i * 3 + 2) * settings.span;
    seeds[i * 4 + 3] = rnd(i * 7 + 5);
  }
  quad.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4));
  quad.instanceCount = settings.count;
  const own = {
    uMote: { value: new Vector4() },
    uMoteColor: { value: new Vector4() },
    uMoteArea: { value: new Vector4(0, 0, settings.span, 0) },
  };
  const material = new ShaderMaterial({
    uniforms: { ...uniforms, ...own },
    glslVersion: GLSL3,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
  });
  const mesh = new Mesh(quad, material);
  mesh.name = 'air';
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  return {
    mesh,
    update(ambiance, x, z) {
      if (ambiance.particles === 'lucioles') {
        // x: genre (1 luciole), y: demi-taille en points d'écran, z: force du halo.
        own.uMote.value.set(1, 6.5, 0.3, 0);
        own.uMoteColor.value.set(0.95, 0.9, 0.42, 1);
      } else if (ambiance.particles === 'poussiere') {
        own.uMote.value.set(0, 1.6, 0, 0);
        own.uMoteColor.value.set(0.22, 0.2, 0.14, 1);
      }
      own.uMoteArea.value.x = x;
      own.uMoteArea.value.y = z;
      mesh.visible = ambiance.particles !== 'aucune';
    },
    dispose() {
      quad.dispose();
      material.dispose();
    },
  };
}
