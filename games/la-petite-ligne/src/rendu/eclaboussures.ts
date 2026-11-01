/**
 * Gerbes et ronds dans l'eau des moments rares (le plongeon du martin-pêcheur, le poisson qui
 * saute dans la brume): bouffées émises du programme des particules (`PuffPool`, formes `ring`
 * et `droplet`), un appel de dessin quand une gerbe vit, aucun quand l'eau est calme, aucun
 * programme de plus. Le GPU calcule toute la vie d'une gouttelette: rien n'est écrit par image.
 */
import { Color, DataTexture, RGBAFormat, Vector2, Vector4, type Mesh, type Vector3 } from 'three';
import { PARTICLE_MODE, PARTICLE_SHAPE, PuffPool, createParticleMaterial } from './particules';
import type { ResourceTracker } from './ressources';

/** Réglages des gerbes (m, s): petites, à la taille d'un oiseau de 26 cm ou d'une ablette. */
const SPLASH = {
  capacity: 48,
  droplets: 9,
  dropletSize: 0.03,
  dropletSpeed: 0.9,
  dropletUp: 1.8,
  dropletSeconds: 0.55,
  ringRadius: 0.55,
  ringSeconds: 1.6,
  ringOpacity: 0.6,
  /** Deuxième rond, plus large et plus lent (les ronds qui s'élargissent). */
  outerRadius: 0.95,
  outerSeconds: 2.2,
  ringLift: 0.015,
  color: '#d8eef2',
} as const;

export class Splashes {
  private readonly pool: PuffPool;
  private readonly color = new Color(SPLASH.color);

  constructor(resources: ResourceTracker) {
    const field = resources.track(new DataTexture(new Uint8Array(4), 1, 1, RGBAFormat));
    field.needsUpdate = true;
    const material = createParticleMaterial(
      PARTICLE_MODE.puffs,
      { texture: field, rect: new Vector4(), height: new Vector2() },
      resources,
    );
    this.pool = new PuffPool(SPLASH.capacity, material, resources);
    this.pool.mesh.name = 'gerbes des moments';
    this.pool.mesh.renderOrder = 2;
  }

  get mesh(): Mesh {
    return this.pool.mesh;
  }

  /** Une gerbe à la surface (`level`, hauteur de l'eau), à l'instant `time` du rendu; `big`: avec gouttelettes. */
  emit(x: number, y: number, level: number, time: number, big: boolean): void {
    const p = this.pool;
    const base = {
      x,
      y: level + SPLASH.ringLift,
      z: y,
      vx: 0,
      vy: 0,
      vz: 0,
      ax: 0,
      ay: 0,
      az: 0,
      drag: 1,
      color: this.color,
    };
    p.emit(
      {
        ...base,
        life: SPLASH.ringSeconds,
        startSize: SPLASH.ringRadius,
        endSize: SPLASH.ringRadius,
        shape: PARTICLE_SHAPE.ring,
        opacity: SPLASH.ringOpacity,
      },
      time,
    );
    p.emit(
      {
        ...base,
        life: SPLASH.outerSeconds,
        startSize: SPLASH.outerRadius,
        endSize: SPLASH.outerRadius,
        shape: PARTICLE_SHAPE.ring,
        opacity: SPLASH.ringOpacity * 0.6,
      },
      time,
    );
    if (!big) return;
    for (let i = 0; i < SPLASH.droplets; i += 1) {
      const angle = (i / SPLASH.droplets) * Math.PI * 2 + p.random();
      const speed = SPLASH.dropletSpeed * (0.5 + p.random());
      p.emit(
        {
          ...base,
          y: level + 0.02,
          vx: Math.cos(angle) * speed,
          vy: SPLASH.dropletUp * (0.6 + 0.6 * p.random()),
          vz: Math.sin(angle) * speed,
          ay: -9.8,
          drag: 0.5,
          life: SPLASH.dropletSeconds,
          startSize: SPLASH.dropletSize,
          endSize: SPLASH.dropletSize * 0.6,
          shape: PARTICLE_SHAPE.droplet,
          opacity: 0.9,
        },
        time,
      );
    }
  }

  update(time: number, lit: Color, shade: Color, lightView: Vector3): void {
    const u = this.pool.material.uniforms;
    u.uLitColor.value.copy(lit);
    u.uShadeColor.value.copy(shade);
    u.uLightView.value.copy(lightView);
    this.pool.update(time);
  }

  dispose(): void {
    this.pool.mesh.removeFromParent();
  }
}
