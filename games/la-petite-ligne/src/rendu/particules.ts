/**
 * Particules sur le GPU: un seul programme de shader pour toute l'ambiance
 * (panache, potager, pluie, éclaboussures, nuages, brume, halos). Chaque
 * particule est une instance d'un carré tourné vers la caméra; sa trajectoire
 * est calculée dans le shader à partir de sa naissance, donc le processeur
 * n'écrit rien à chaque image (il n'écrit qu'à l'émission).
 *
 * Trois modes (uniforme `uMode`, même programme): bouffées émises
 * (`PuffPool`), pluie déterministe autour de la vue (`pluie.ts`), sprites posés
 * qui dérivent (`ciel.ts`). Le mélange est en alpha prémultiplié: une même
 * passe fait les fumées (alpha) et les halos (addition).
 *
 * En mode sprites, deux réglages par instance (`aAccel.x` et `aAccel.y`, inutilisés sinon):
 * carré couché à plat au lieu de tourné vers la caméra (bancs et nappes de brume), et fondu du
 * bas selon la hauteur au-dessus du sol lue dans le champ du terrain (aucun bord net là où le sol
 * coupe le carré). `aSize.y` y donne la demi-longueur du second axe (bouffée étirée).
 * Carré couché tourné (`aAccel.z` à 1, groupe 2): cap `aVelocity.y` (radians, sens du sol); la
 * forme `fish` lit en plus l'ondulation (`aVelocity.x`), le sillage (`aVelocity.z`), le flou
 * (`aVelocity.w`) et la phase (`aOrigin.w`).
 */
import {
  BufferAttribute,
  Color,
  CustomBlending,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  Vector3,
  Vector4,
  type IUniform,
  type Texture,
} from 'three';
import type { ResourceTracker } from './ressources';

/** Formes dessinées par le shader de fragment. */
export const PARTICLE_SHAPE = {
  /** Bouffée douce, éclairée comme un petit volume (vapeur, poussière, nuage, brume). */
  puff: 0,
  /** Trait fin le long de la vitesse (goutte de pluie). */
  streak: 1,
  /** Rond qui s'élargit, posé au sol (éclaboussure, rond dans l'eau). */
  ring: 2,
  /** Étoile à quatre branches qui scintille (récolte « belle »). */
  star: 3,
  /** Halo lumineux, ajouté à l'image (lanterne, fenêtre). */
  glow: 4,
  /** Gouttelette ronde et nette (arrosage). */
  droplet: 5,
  /**
   * Ombre de poisson vue d'en haut (pêche de la 0.12), tête vers +x du carré tourné: corps en
   * fuseau, queue qui ondule, sillage clair la nuit. Sprites couchés et tournés seulement.
   */
  fish: 6,
} as const;

export const PARTICLE_MODE = { puffs: 0, rain: 1, sprites: 2 } as const;

const QUAD_CORNERS = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
const QUAD_INDEX = [0, 1, 2, 0, 2, 3];
const VEC4 = 4;
/** Les instances qui ne doivent pas paraître sont envoyées hors du volume de vue. */
const VERTEX_SHADER = /* glsl */ `
#include <common>
#include <fog_pars_vertex>

uniform float uTime;
uniform int uMode;
uniform vec3 uFocus;
uniform vec4 uRain;       // demi-côté de la zone, hauteur de la colonne, densité (0 à 1), durée d'une éclaboussure
uniform vec3 uFall;       // vitesse de chute (m/s), vent compris
uniform vec4 uRainShape;  // longueur du trait, largeur, rayon d'éclaboussure au sol, rayon dans l'eau
uniform sampler2D uField;
uniform vec4 uFieldRect;
uniform vec2 uFieldHeight;
uniform vec4 uSpriteArea; // demi-côté de la zone des nuages, de la brume, vent des nuages (x, z)
uniform vec4 uGroupAlpha; // nuages, brume, halos, nappe de la brume du matin
uniform vec2 uCloudFade;  // rayon (écran) où les nuages sont invisibles, puis pleins
uniform vec3 uLightView;  // direction de la lumière dans le repère de la caméra
uniform float uGroundFade; // hauteur (m) au-dessus du sol sur laquelle un sprite fondu apparaît

attribute vec4 aOrigin;   // position, naissance (bouffées) ou phase
attribute vec4 aVelocity; // vitesse, durée de vie
attribute vec4 aAccel;    // accélération, frein (bouffées) ou couché, fondu au sol, groupe (sprites)
attribute vec4 aSize;     // taille au départ, à la fin (sprites: second axe), forme, graine
attribute vec4 aColor;    // couleur (linéaire), opacité

varying vec2 vCorner;
varying vec4 vColor;
flat varying int vShape;
varying float vAge;
varying float vLight;
varying vec3 vWorld;
flat varying int vGroundFade;
varying vec4 vFish;

uint ambHash(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u;
  return x;
}
float ambRandom(uint a, uint b) {
  return float(ambHash(a * 1664525u + ambHash(b))) / 4294967295.0;
}
vec4 ambField(vec2 xz) {
  return textureLod(uField, (xz - uFieldRect.xy) * uFieldRect.zw, 0.0);
}
float ambGround(vec4 field) {
  return uFieldHeight.x + field.r * uFieldHeight.y;
}
/** Enroule x autour de c dans une fenêtre de demi-côté h (la pluie reste fixe dans le monde). */
float ambWrap(float x, float c, float h) {
  return c - h + mod(x - (c - h), 2.0 * h);
}

void hideInstance() {
  gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}

void main() {
  vCorner = position.xy;
  int shape = int(aSize.z + 0.5);
  vShape = shape;
  vColor = aColor;
  vAge = 0.0;
  vLight = 1.0;
  vGroundFade = 0;
  vFish = vec4(0.0);
  float turn = 0.0;
  vec3 centre = aOrigin.xyz;
  float size = aSize.x;
  vec2 stretch = vec2(1.0);
  vec3 axis = vec3(0.0);
  bool onGround = false;

  if (uMode == 0) {
    float age = uTime - aOrigin.w;
    float t = age / aVelocity.w;
    if (t < 0.0 || t > 1.0) { hideInstance(); return; }
    float drag = max(aAccel.w, 0.001);
    centre = aOrigin.xyz + aVelocity.xyz * ((1.0 - exp(-drag * age)) / drag) + 0.5 * aAccel.xyz * age * age;
    size = mix(aSize.x, aSize.y, sqrt(t));
    // Les bouffées naissent transparentes, sont les plus denses vers le milieu de leur vie, puis s'effacent.
    float fadeIn = shape == 0 ? 0.4 : 0.08;
    vColor.a *= smoothstep(0.0, fadeIn, t) * (1.0 - smoothstep(0.55, 1.0, t));
    if (shape == 0) {
      // Et s'éclaircissent en montant.
      vColor.rgb = mix(vColor.rgb, vec3(1.0), t * 0.35);
    }
    vAge = t;
    onGround = shape == 2;
    if (shape == 5) {
      // Gouttelette: étirée le long de sa vitesse du moment.
      axis = normalize(aVelocity.xyz * exp(-drag * age) + aAccel.xyz * age + vec3(0.0, 0.0001, 0.0));
    }
  } else if (uMode == 1) {
    if (aSize.w > uRain.z) { hideInstance(); return; }
    float h = uRain.x;
    if (shape == 1) {
      // Goutte: fixe dans le monde, enroulée autour de la vue, tombe en boucle.
      float fallTime = uRain.y / length(uFall);
      float phase = fract(aOrigin.y + uTime / fallTime);
      float drop = (1.0 - phase) * uRain.y;
      // Le vent pousse la goutte: plus haut, elle est encore en amont de son point de chute.
      vec2 xz = aOrigin.xz * 2.0 * h + uFall.xz / uFall.y * drop;
      xz = vec2(ambWrap(xz.x, uFocus.x, h), ambWrap(xz.y, uFocus.z, h));
      vec4 field = ambField(xz);
      if (field.b > 0.5) { hideInstance(); return; }
      centre = vec3(xz.x, ambGround(field) + drop, xz.y);
      axis = normalize(uFall);
      size = uRainShape.y;
      vAge = phase;
    } else {
      // Éclaboussure: un endroit tiré au hasard à chaque cycle, au sol ou dans l'eau.
      float cycle = (uTime + aSize.w * uRain.w) / uRain.w;
      uint n = uint(floor(cycle));
      uint id = uint(gl_InstanceID);
      vec2 xz = uFocus.xz + (vec2(ambRandom(n, id), ambRandom(n, id + 7919u)) * 2.0 - 1.0) * h;
      vec4 field = ambField(xz);
      if (field.b > 0.5) { hideInstance(); return; }
      float t = fract(cycle);
      bool water = field.a > 0.5;
      centre = vec3(xz.x, ambGround(field) + 0.03, xz.y);
      size = water ? uRainShape.w : uRainShape.z;
      vAge = t;
      vColor.a *= 1.0 - t;
      onGround = true;
    }
  } else {
    int group = int(aAccel.w + 0.5);
    if (group == 0) {
      vec2 xz = aOrigin.xz + uSpriteArea.zw * uTime;
      xz = vec2(ambWrap(xz.x, uFocus.x, uSpriteArea.x), ambWrap(xz.y, uFocus.z, uSpriteArea.x));
      centre = vec3(xz.x, aOrigin.y, xz.y);
    } else if (group == 1 || group == 3) {
      vec2 drift = vec2(sin(uTime * 0.11 + aOrigin.w * 6.0), cos(uTime * 0.09 + aOrigin.w * 4.0));
      vec2 xz = aOrigin.xz + drift * aVelocity.x;
      centre = vec3(xz.x, aOrigin.y, xz.y);
    }
    float groupAlpha = group == 0 ? uGroupAlpha.x : (group == 1 ? uGroupAlpha.y : (group == 2 ? uGroupAlpha.z : uGroupAlpha.w));
    if (groupAlpha <= 0.0) { hideInstance(); return; }
    vColor.a *= groupAlpha;
    onGround = aAccel.x > 0.5;
    if (aAccel.z > 0.5) {
      turn = aVelocity.y;
      vFish = vec4(aVelocity.x, uTime * 6.0 + aOrigin.w * 6.2831853, aVelocity.z, aVelocity.w);
    }
    vGroundFade = aAccel.y > 0.5 ? 1 : 0;
    stretch.y = aSize.y / max(aSize.x, 0.0001);
    if (shape == 4) {
      // Flamme: léger scintillement.
      vColor.a *= 0.88 + 0.12 * sin(uTime * 7.0 + aOrigin.w * 40.0);
    }
  }

  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 forward = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  vec3 world;
  if (onGround) {
    vec2 flat2 = position.xy * stretch;
    float ct = cos(turn);
    float st = sin(turn);
    flat2 = vec2(flat2.x * ct - flat2.y * st, flat2.x * st + flat2.y * ct);
    world = centre + vec3(flat2.x, 0.0, flat2.y) * size;
  } else if (dot(axis, axis) > 0.0) {
    vec3 side = normalize(cross(axis, forward));
    // Trait de pluie à sa longueur réglée; gouttelette d'arrosage quatre fois plus longue que large.
    float streak = shape == 1 ? uRainShape.x : size * 4.0;
    world = centre + side * position.x * size + axis * position.y * streak * 0.5;
  } else {
    world = centre + (right * position.x * stretch.x + up * position.y * stretch.y) * size;
  }
  vWorld = world;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  if (uMode == 2 && int(aAccel.w + 0.5) == 0) {
    // Nuages: invisibles au centre de l'écran (on ne cache jamais les joueurs).
    float r = length(gl_Position.xy / gl_Position.w);
    vColor.a *= smoothstep(uCloudFade.x, uCloudFade.y, r);
  }
  // Volume des bouffées: le côté tourné vers la lumière est plus clair.
  vLight = dot(normalize(vec3(position.xy, 0.8)), uLightView) * 0.5 + 0.5;
  #include <fog_vertex>
}
`;

const FRAGMENT_SHADER = /* glsl */ `
#include <common>
#include <fog_pars_fragment>

uniform vec3 uLitColor;   // lumière directe (soleil ou lune), intensité comprise
uniform vec3 uShadeColor; // lumière du ciel (hémisphérique)
uniform vec4 uSelfLight;  // lumière propre des bouffées (brume claire): couleur, part (0: aucune)
uniform sampler2D uField;
uniform vec4 uFieldRect;
uniform vec2 uFieldHeight;
uniform float uGroundFade;

varying vec2 vCorner;
varying vec4 vColor;
flat varying int vShape;
varying float vAge;
varying float vLight;
varying vec3 vWorld;
flat varying int vGroundFade;
varying vec4 vFish;

void main() {
  float r = length(vCorner);
  float alpha = 0.0;
  float additive = 0.0;
  vec3 color = vColor.rgb;
  if (vShape == 0) {
    alpha = smoothstep(1.0, 0.25, r);
    // Une brume de petit jour est plus claire que ce qu'elle voile: elle tient une part de sa
    // lumière du ciel diffusé, pas seulement du soleil et de l'hémisphère.
    color = mix(color * (uShadeColor + uLitColor * vLight), color * uSelfLight.rgb, uSelfLight.w);
  } else if (vShape == 1) {
    alpha = (1.0 - abs(vCorner.x)) * smoothstep(1.0, 0.3, abs(vCorner.y)) * (0.6 + 0.4 * vCorner.y);
    color *= uShadeColor + uLitColor * 0.5;
  } else if (vShape == 2) {
    float ring = vAge * 0.85 + 0.1;
    alpha = 1.0 - smoothstep(0.0, 0.16, abs(r - ring));
    color *= uShadeColor + uLitColor * 0.6;
  } else if (vShape == 3) {
    float arms = max(0.0, 1.0 - abs(vCorner.x) * 7.0) * (1.0 - abs(vCorner.y))
      + max(0.0, 1.0 - abs(vCorner.y) * 7.0) * (1.0 - abs(vCorner.x));
    float core = smoothstep(0.45, 0.0, r);
    alpha = clamp(arms + core, 0.0, 1.0) * (0.65 + 0.35 * sin(vAge * 40.0));
    additive = 1.0;
  } else if (vShape == 4) {
    alpha = exp(-r * r * 4.0) * (1.0 - smoothstep(0.7, 1.0, r));
    additive = 1.0;
  } else if (vShape == 6) {
    // Longueur du poisson = 1 (carré de deux longueurs sur une), tête vers +x.
    vec2 q = vec2(vCorner.x, vCorner.y * 0.5);
    q.y -= sin(vFish.y - q.x * 8.0) * vFish.x * (0.5 - q.x) * 0.1;
    float soft = 0.025 + vFish.w * 0.07;
    vec2 radii = vec2(0.4, 0.11);
    float body = (length((q - vec2(0.06, 0.0)) / radii) - 1.0) * radii.y;
    float tailWidth = mix(0.02, 0.1, clamp((-0.28 - q.x) / 0.22, 0.0, 1.0));
    float tail = max(abs(q.y) - tailWidth, max(q.x + 0.28, -0.5 - q.x));
    float fishD = min(body, tail);
    float bodyA = (1.0 - smoothstep(-soft, soft, fishD)) * mix(0.7, 1.0, smoothstep(0.0, -0.06, fishD));
    // Sillage: deux traits fins qui partent de la tête et s'écartent derrière elle.
    float behind = 0.44 - q.x;
    float wakeD = abs(abs(q.y) - behind * 0.3);
    // Assez large pour deux pixels au zoom 1 (ombre de 0,5 m), plus un liseré clair autour du corps.
    float wakeA = (1.0 - smoothstep(0.02, 0.05 + soft * 0.3, wakeD)) * step(0.0, behind)
      * (1.0 - smoothstep(0.0, 1.5, behind)) * vFish.z;
    wakeA = max(wakeA, (1.0 - smoothstep(0.0, 0.03 + soft, abs(fishD))) * vFish.z * 0.6);
    vec3 wakeColor = vec3(0.8, 0.88, 0.95) * max(uShadeColor + uLitColor * 0.6, vec3(0.7));
    alpha = bodyA + wakeA * (1.0 - bodyA);
    color = (vColor.rgb * bodyA + wakeColor * wakeA * (1.0 - bodyA)) / max(alpha, 0.0001);
  } else {
    alpha = smoothstep(1.0, 0.7, r);
    color *= uShadeColor + uLitColor * 0.8;
  }
  alpha *= vColor.a;
  if (vGroundFade == 1) {
    vec4 field = textureLod(uField, (vWorld.xz - uFieldRect.xy) * uFieldRect.zw, 0.0);
    alpha *= smoothstep(0.0, uGroundFade, vWorld.y - (uFieldHeight.x + field.r * uFieldHeight.y));
  }
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
  // Alpha prémultiplié: les halos s'ajoutent à l'image, les fumées la recouvrent.
  gl_FragColor.rgb *= gl_FragColor.a;
  gl_FragColor.a *= 1.0 - additive;
}
`;

/** Uniformes du programme des particules (une copie par matériau, même programme). */
export interface ParticleUniforms {
  [name: string]: IUniform;
  uTime: IUniform<number>;
  uMode: IUniform<number>;
  uFocus: IUniform<Vector3>;
  uRain: IUniform<Vector4>;
  uFall: IUniform<Vector3>;
  uRainShape: IUniform<Vector4>;
  uField: IUniform<Texture | null>;
  uFieldRect: IUniform<Vector4>;
  uFieldHeight: IUniform<Vector2>;
  uSpriteArea: IUniform<Vector4>;
  uGroupAlpha: IUniform<Vector4>;
  uCloudFade: IUniform<Vector2>;
  uLightView: IUniform<Vector3>;
  uLitColor: IUniform<Color>;
  uShadeColor: IUniform<Color>;
  uSelfLight: IUniform<Vector4>;
  uGroundFade: IUniform<number>;
}

/** Matériau des particules dans un mode donné. Tous partagent le même programme. */
export function createParticleMaterial(
  mode: number,
  field: { texture: Texture; rect: Vector4; height: Vector2 },
  resources: ResourceTracker,
): ShaderMaterial & { uniforms: ParticleUniforms } {
  const uniforms: ParticleUniforms = {
    ...UniformsUtils.clone(UniformsLib.fog),
    uTime: { value: 0 },
    uMode: { value: mode },
    uFocus: { value: new Vector3() },
    uRain: { value: new Vector4(1, 1, 0, 1) },
    uFall: { value: new Vector3(0, -1, 0) },
    uRainShape: { value: new Vector4(0.5, 0.03, 0.15, 0.4) },
    uField: { value: field.texture },
    uFieldRect: { value: field.rect },
    uFieldHeight: { value: field.height },
    uSpriteArea: { value: new Vector4(1, 1, 0, 0) },
    uGroupAlpha: { value: new Vector4(0, 0, 0, 0) },
    uCloudFade: { value: new Vector2(0, 1) },
    uLightView: { value: new Vector3(0, 0, 1) },
    uLitColor: { value: new Color(1, 1, 1) },
    uShadeColor: { value: new Color(1, 1, 1) },
    uSelfLight: { value: new Vector4(1, 1, 1, 0) },
    uGroundFade: { value: 0.25 },
  };
  const material = new ShaderMaterial({
    name: 'lpl_ambiance',
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    fog: true,
    // Les ronds posés au sol et les gouttelettes qui remontent montrent leur dos à la caméra.
    side: DoubleSide,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
  });
  resources.track(material);
  return material as ShaderMaterial & { uniforms: ParticleUniforms };
}

/** Attributs d'instance des particules, à remplir par l'appelant. */
export interface ParticleBuffers {
  origin: InstancedBufferAttribute;
  velocity: InstancedBufferAttribute;
  accel: InstancedBufferAttribute;
  size: InstancedBufferAttribute;
  color: InstancedBufferAttribute;
}

/** Carré instancié `capacity` fois, avec ses attributs d'instance (vides). */
export function createParticleMesh(
  name: string,
  capacity: number,
  material: ShaderMaterial,
  resources: ResourceTracker,
  dynamic: boolean,
): { mesh: Mesh; buffers: ParticleBuffers; geometry: InstancedBufferGeometry } {
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(QUAD_CORNERS, 3));
  geometry.setIndex(QUAD_INDEX);
  const attribute = (): InstancedBufferAttribute => {
    const buffer = new InstancedBufferAttribute(new Float32Array(capacity * VEC4), VEC4);
    if (dynamic) {
      buffer.setUsage(DynamicDrawUsage);
    }
    return buffer;
  };
  const buffers: ParticleBuffers = {
    origin: attribute(),
    velocity: attribute(),
    accel: attribute(),
    size: attribute(),
    color: attribute(),
  };
  geometry.setAttribute('aOrigin', buffers.origin);
  geometry.setAttribute('aVelocity', buffers.velocity);
  geometry.setAttribute('aAccel', buffers.accel);
  geometry.setAttribute('aSize', buffers.size);
  geometry.setAttribute('aColor', buffers.color);
  geometry.instanceCount = capacity;
  resources.track(geometry);
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  return { mesh, buffers, geometry };
}

/** Une bouffée à émettre (unités du monde, couleur linéaire). */
export interface PuffSpec {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ax: number;
  ay: number;
  az: number;
  drag: number;
  life: number;
  startSize: number;
  endSize: number;
  shape: number;
  color: Color;
  opacity: number;
}

/**
 * Bouffées émises par le processeur (anneau de `capacity` places, la plus
 * ancienne cède sa place): le GPU calcule ensuite toute leur vie.
 */
export class PuffPool {
  readonly mesh: Mesh;
  private readonly buffers: ParticleBuffers;
  private readonly capacity: number;
  private next = 0;
  private dirty = false;
  private seed = 1;
  private lastBirth = Number.NEGATIVE_INFINITY;
  private longestLife = 0;

  constructor(
    capacity: number,
    readonly material: ShaderMaterial & { uniforms: ParticleUniforms },
    resources: ResourceTracker,
  ) {
    this.capacity = capacity;
    const built = createParticleMesh('panache et potager', capacity, material, resources, true);
    this.mesh = built.mesh;
    this.buffers = built.buffers;
    // Toutes les places commencent mortes (nées il y a longtemps).
    for (let i = 0; i < capacity; i += 1) {
      this.buffers.origin.setW(i, Number.NEGATIVE_INFINITY);
      this.buffers.velocity.setW(i, 1);
    }
    this.mesh.visible = false;
  }

  /** Suite pseudo-aléatoire locale (décor seulement, jamais dans la simulation). */
  random(): number {
    const PM_MULTIPLIER = 16807;
    const PM_MODULUS = 2147483647;
    this.seed = (this.seed * PM_MULTIPLIER) % PM_MODULUS;
    return (this.seed - 1) / (PM_MODULUS - 1);
  }

  emit(spec: PuffSpec, time: number): void {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    const b = this.buffers;
    b.origin.setXYZW(i, spec.x, spec.y, spec.z, time);
    b.velocity.setXYZW(i, spec.vx, spec.vy, spec.vz, spec.life);
    b.accel.setXYZW(i, spec.ax, spec.ay, spec.az, spec.drag);
    b.size.setXYZW(i, spec.startSize, spec.endSize, spec.shape, this.random());
    b.color.setXYZW(i, spec.color.r, spec.color.g, spec.color.b, spec.opacity);
    this.dirty = true;
    this.lastBirth = time;
    this.longestLife = Math.max(this.longestLife, spec.life);
  }

  /** Envoie les nouvelles bouffées au GPU; cache le maillage quand plus rien ne vit. */
  update(time: number): void {
    this.material.uniforms.uTime.value = time;
    if (this.dirty) {
      for (const buffer of Object.values(this.buffers) as InstancedBufferAttribute[]) {
        buffer.needsUpdate = true;
      }
      this.dirty = false;
    }
    this.mesh.visible = time - this.lastBirth <= this.longestLife;
  }
}
