/**
 * Pluie (jour 4): des traits fins qui tombent en biais autour de la vue, fixes
 * dans le monde (ils ne glissent pas avec la caméra), qui s'arrêtent sous les
 * toits; des éclaboussures au sol et des ronds dans l'eau. Tout est calculé par
 * le GPU à partir du numéro de la goutte et du temps: un appel de dessin, rien
 * à écrire par le processeur à chaque image.
 */
import { Color, type InstancedBufferGeometry, type Mesh, type Vector3 } from 'three';
import type { TerrainField } from './champs';
import {
  PARTICLE_MODE,
  PARTICLE_SHAPE,
  createParticleMaterial,
  createParticleMesh,
  type ParticleUniforms,
} from './particules';
import { AMBIANCE_SETTINGS } from './reglages-ambiance';
import type { ResourceTracker } from './ressources';
import { hash2 } from './bruit';

const SALT_X = 1;
const SALT_Y = 2;
const SALT_Z = 3;
const SALT_KEEP = 4;

export class RainLayer {
  readonly mesh: Mesh;
  private readonly uniforms: ParticleUniforms;
  private readonly drops: number;
  private readonly geometry: InstancedBufferGeometry;

  constructor(field: TerrainField, resources: ResourceTracker) {
    const rain = AMBIANCE_SETTINGS.rain;
    this.drops = rain.drops;
    const material = createParticleMaterial(PARTICLE_MODE.rain, field, resources);
    this.uniforms = material.uniforms;
    const total = rain.drops + rain.splashes;
    const built = createParticleMesh('pluie', total, material, resources, false);
    this.mesh = built.mesh;
    this.geometry = built.geometry;
    const color = new Color(rain.color);
    const b = built.buffers;
    for (let i = 0; i < total; i += 1) {
      const splash = i >= rain.drops;
      b.origin.setXYZW(i, hash2(i, SALT_X), hash2(i, SALT_Y), hash2(i, SALT_Z), 0);
      b.size.setXYZW(
        i,
        rain.streakWidth,
        rain.streakWidth,
        splash ? PARTICLE_SHAPE.ring : PARTICLE_SHAPE.streak,
        // Graine: la densité garde les gouttes dont la graine est sous elle.
        hash2(i, SALT_KEEP),
      );
      b.color.setXYZW(i, color.r, color.g, color.b, splash ? rain.splashOpacity : rain.opacity);
    }
    const u = this.uniforms;
    u.uRainShape.value.set(
      rain.streakLength,
      rain.streakWidth,
      rain.splashRadius,
      rain.rippleRadius,
    );
    const fall = u.uFall.value;
    fall.set(rain.wind[0], -rain.speed, rain.wind[1]);
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
  }

  /**
   * `amount`: densité (0 sans pluie), `light`: version légère (moitié moins de
   * gouttes, pas d'éclaboussures).
   */
  update(
    time: number,
    focus: Vector3,
    viewRadius: number,
    amount: number,
    light: boolean,
    lit: Color,
    shade: Color,
  ): void {
    const rain = AMBIANCE_SETTINGS.rain;
    this.mesh.visible = amount > 0;
    if (!this.mesh.visible) {
      return;
    }
    const u = this.uniforms;
    u.uTime.value = time;
    u.uFocus.value.copy(focus);
    u.uRain.value.set(viewRadius + rain.padding, rain.height, amount, rain.splashSeconds);
    u.uLitColor.value.copy(lit);
    u.uShadeColor.value.copy(shade);
    this.geometry.instanceCount = light ? rain.dropsLight : this.drops + rain.splashes;
  }
}
