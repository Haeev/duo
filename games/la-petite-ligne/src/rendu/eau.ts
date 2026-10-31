/**
 * L'Aubrune: un matériau standard (mêmes lumières, ombres et brume que le
 * reste) dont le shader ajoute, sans passe de rendu en plus:
 *
 * - la couleur du fond: claire près de la berge, profonde au large (distance à
 *   la berge lue dans le champ du terrain), plus transparente au bord;
 * - des rides qui suivent le courant (deux bruits qui défilent);
 * - le ciel reflété (sa couleur suit l'heure: aube rose, midi bleu, soir doré,
 *   nuit bleu sombre), plus ou moins fort selon les rides;
 * - l'écume qui bat le long des berges, et une lame d'eau vive sur le gué;
 * - des étincelles de soleil (et de lune, plus discrètes, la nuit);
 * - les ombres des nuages et les lumières de sol de `surfaces.ts`.
 */
import {
  Color,
  MeshStandardMaterial,
  Vector2,
  Vector3,
  Vector4,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { TerrainField } from './champs';
import { AMBIANCE_SETTINGS } from './reglages-ambiance';
import { SURFACE_FRAGMENT_PARS, injectAfter, type SurfaceUniforms } from './surfaces';

/** Uniformes propres à l'eau (les autres viennent des surfaces). */
export interface WaterUniforms {
  uField: { value: TerrainField['texture'] };
  uFieldRect: { value: TerrainField['rect'] };
  uShallow: { value: Color };
  uDeep: { value: Color };
  uFoam: { value: Color };
  uFlow: { value: Vector2 };
  uWaterParams: { value: Vector4 };
  uFoamParams: { value: Vector4 };
  uGlintColor: { value: Color };
  uGlintLevel: { value: number };
  uGlintParams: { value: Vector3 };
  uWave: { value: Vector3 };
}

const VERTEX_PARS = /* glsl */ `
uniform float uAmbTime;
uniform vec3 uWave;
varying vec3 vAmbWorld;
`;

const VERTEX_MAIN = /* glsl */ `
vec4 waterWorld = modelMatrix * vec4(transformed, 1.0);
float waveK = 6.2831853 / uWave.z;
float wave = sin(waterWorld.x * waveK + uAmbTime * uWave.y)
  + sin(waterWorld.z * waveK * 1.37 - uAmbTime * uWave.y * 0.8);
transformed.y += wave * uWave.x * 0.5;
vAmbWorld = waterWorld.xyz;
`;

const FRAGMENT_PARS = /* glsl */ `
uniform sampler2D uField;
uniform vec4 uFieldRect;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform vec2 uFlow;
uniform vec4 uWaterParams; // 1 / taille des rides, reflet, reflet selon les rides, opacité près du bord
uniform vec4 uFoamParams;  // largeur, vitesse, nombre de vaguelettes, force
uniform vec3 uGlintColor;
uniform float uGlintLevel;
uniform vec3 uGlintParams; // finesse, vitesse, seuil
`;

/** Après `color_fragment`: couleur de l'eau, reflet, écume, transparence. */
const FRAGMENT_COLOR = /* glsl */ `
vec4 waterField = texture(uField, (vAmbWorld.xz - uFieldRect.xy) * uFieldRect.zw);
float waterDepth = waterField.g;
vec2 rippleUv = vAmbWorld.xz * uWaterParams.x;
float ripple1 = texture(uAmbNoise, rippleUv - uFlow * uAmbTime).r;
float ripple2 = texture(uAmbNoise, rippleUv * 1.9 + vec2(0.37, 0.71) - uFlow.yx * 0.7 * uAmbTime).r;
float ripple = ripple1 * 0.6 + ripple2 * 0.4;
vec3 waterBase = mix(uShallow, uDeep, smoothstep(0.0, 1.0, waterDepth));
float mirror = clamp(uWaterParams.y + (ripple - 0.5) * uWaterParams.z * 2.0, 0.0, 1.0);
diffuseColor.rgb = mix(waterBase, uReflection, mirror);
// Écume: des vaguelettes qui battent la berge, déchirées par le bruit.
float nearBank = 1.0 - smoothstep(0.0, uFoamParams.x, waterDepth);
float beat = 0.5 + 0.5 * sin(waterDepth * uFoamParams.z * 6.2831853 - uAmbTime * uFoamParams.y * 6.2831853);
float foam = nearBank * smoothstep(0.35, 0.75, beat * 0.6 + ripple2 * 0.6) * uFoamParams.w;
diffuseColor.rgb = mix(diffuseColor.rgb, uFoam, foam);
diffuseColor.a = mix(uWaterParams.w, diffuseColor.a, smoothstep(0.0, 0.6, waterDepth));
diffuseColor.a = max(diffuseColor.a, foam);
// Étincelles: deux motifs fins qui se croisent vite; leur produit ne dépasse le seuil qu'en petits points fugaces.
vec2 glintUv = rippleUv * uGlintParams.x;
float glintA = texture(uAmbNoise, glintUv + uFlow * uAmbTime * uGlintParams.y).r;
float glintB = texture(uAmbNoise, glintUv.yx * 1.31 - uFlow * uAmbTime * uGlintParams.y + 0.53).r;
float waterGlint = smoothstep(uGlintParams.z, 1.0, glintA * glintB * 1.8) * uGlintLevel * (1.0 - foam);
`;

/** Après `lights_fragment_end`: ombres des nuages, lumières de sol, étincelles. */
const FRAGMENT_LIGHT = /* glsl */ `
float waterCloud = ambCloudLight(vAmbWorld);
reflectedLight.directDiffuse *= waterCloud;
reflectedLight.directSpecular *= waterCloud;
reflectedLight.directDiffuse += ambGlowLight(vAmbWorld, vec3(0.0, 1.0, 0.0)) * material.diffuseContribution;
totalEmissiveRadiance += uGlintColor * waterGlint * waterCloud;
`;

/** Matériau de la rivière (et de la lame d'eau du gué, avec `opacity` plus basse). */
export function createWaterMaterial(
  field: TerrainField,
  surfaces: SurfaceUniforms,
  opacity: number,
  foamAmount: number,
): { material: MeshStandardMaterial; uniforms: WaterUniforms } {
  const w = AMBIANCE_SETTINGS.water;
  // Transparence du bord à l'échelle de celle du large (lame d'eau du gué plus claire).
  const shallowOpacity = w.opacityShallow * (opacity / w.opacityDeep);
  const uniforms: WaterUniforms = {
    uField: { value: field.texture },
    uFieldRect: { value: field.rect },
    uShallow: { value: new Color(w.shallow) },
    uDeep: { value: new Color(w.deep) },
    uFoam: { value: new Color(w.foam) },
    uFlow: { value: new Vector2(w.flow[0] / w.rippleSize, w.flow[1] / w.rippleSize) },
    uWaterParams: {
      value: new Vector4(1 / w.rippleSize, w.reflection, w.reflectionRipple, shallowOpacity),
    },
    uFoamParams: { value: new Vector4(w.foamWidth, w.foamSpeed, w.foamBands, foamAmount) },
    uGlintColor: { value: new Color() },
    uGlintLevel: { value: 0 },
    uGlintParams: { value: new Vector3(w.glintScale, w.glintSpeed, w.glintThreshold) },
    uWave: { value: new Vector3(w.waveAmplitude, w.waveSpeed, w.waveLength) },
  };
  const material = new MeshStandardMaterial({
    name: 'lpl_water',
    color: new Color(w.deep),
    roughness: w.roughness,
    metalness: 0,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms): void => {
    Object.assign(shader.uniforms, surfaces, uniforms);
    const label = material.name;
    shader.vertexShader = injectAfter(shader.vertexShader, '#include <common>', VERTEX_PARS, label);
    shader.vertexShader = injectAfter(
      shader.vertexShader,
      '#include <begin_vertex>',
      VERTEX_MAIN,
      label,
    );
    shader.fragmentShader = injectAfter(
      shader.fragmentShader,
      '#include <common>',
      SURFACE_FRAGMENT_PARS + FRAGMENT_PARS,
      label,
    );
    shader.fragmentShader = injectAfter(
      shader.fragmentShader,
      '#include <color_fragment>',
      FRAGMENT_COLOR,
      label,
    );
    shader.fragmentShader = injectAfter(
      shader.fragmentShader,
      '#include <lights_fragment_end>',
      FRAGMENT_LIGHT,
      label,
    );
  };
  material.customProgramCacheKey = (): string => 'lpl_water_amb';
  return { material, uniforms };
}
