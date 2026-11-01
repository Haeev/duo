/**
 * Gerbes et ronds dans l'eau des moments rares (le plongeon du martin-pêcheur, le poisson qui
 * saute dans la brume), traînée bleue du martin-pêcheur qui file au ras de l'eau et éclat d'argent
 * de l'ablette à son bec: bouffées émises du programme des particules (`PuffPool`, formes `ring`,
 * `droplet` et `star`), un appel de dessin quand l'une vit, aucun quand l'eau est calme, aucun
 * programme de plus. Le GPU calcule toute la vie d'une particule: rien n'est écrit par image.
 */
import { Color, DataTexture, RGBAFormat, Vector2, Vector4, type Mesh, type Vector3 } from 'three';
import { PARTICLE_MODE, PARTICLE_SHAPE, PuffPool, createParticleMaterial } from './particules';
import type { ResourceTracker } from './ressources';

/** Réglages des gerbes (m, s): petites, à la taille d'un oiseau de 26 cm ou d'une ablette. */
const SPLASH = {
  capacity: 96,
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

/**
 * Traînée du martin-pêcheur (fiche 1.4.8, revue du directeur artistique): un trait `kingfisher_teal`
 * qui persiste 0,3 s derrière lui. Des tirets de 20 cm sur 10 cm (5 à 6 pixels de large au zoom 1)
 * qui se chevauchent, posés tous les 8 cm du trajet quel que soit le nombre d'images par seconde
 * (un trait continu, pas un pointillé): à 8 m/s, une quarantaine de petits carrés vivent ensemble.
 */
const TRAIL = {
  step: 0.08,
  size: 0.05,
  endSize: 0.04,
  /** Les bouffées s'effacent sur leur dernière moitié de vie: 0,4 s de vie, 0,3 s de trait lisible. */
  seconds: 0.4,
  opacity: 0.85,
  /** Vitesse résiduelle (m/s) et frein: elle oriente le tiret le long du vol, sans le déplacer. */
  drift: 0.05,
  drag: 12,
  color: '#2bb5c8',
} as const;

/**
 * Éclat de l'ablette: petite étoile blanche, trois images de 0,1 s. 0,16 m au lieu des 0,12 m de la
 * revue: à 0,12 m, ses branches font un pixel au zoom 1 et l'étoile se lit comme un point.
 */
const GLINT = {
  size: 0.08,
  endSize: 0.1,
  seconds: 0.3,
  opacity: 0.8,
  color: '#ffffff',
} as const;
/** Pulsation du scintillement de la forme `star` dans `particules.ts` (radians sur la vie). */
const STAR_TWINKLE = 40;

export class Splashes {
  private readonly pool: PuffPool;
  private readonly color = new Color(SPLASH.color);
  private readonly trailColor = new Color(TRAIL.color);
  private readonly glintColor = new Color(GLINT.color);

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

  /**
   * Traînée entre deux positions de l'oiseau (monde, `y` vers le haut) vues aux instants `fromTime`
   * et `toTime`: un tiret tous les `TRAIL.step` m, né à l'instant où l'oiseau y passait. Rend la
   * longueur du trajet non couverte, à reporter à l'appel suivant.
   */
  trail(from: Vector3, to: Vector3, fromTime: number, toTime: number, carried: number): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dy, dz);
    if (length <= 0) return carried;
    const p = this.pool;
    let at = TRAIL.step - carried;
    while (at <= length) {
      const k = at / length;
      p.emit(
        {
          x: from.x + dx * k,
          y: from.y + dy * k,
          z: from.z + dz * k,
          vx: (dx / length) * TRAIL.drift,
          vy: (dy / length) * TRAIL.drift,
          vz: (dz / length) * TRAIL.drift,
          ax: 0,
          ay: 0,
          az: 0,
          drag: TRAIL.drag,
          life: TRAIL.seconds,
          startSize: TRAIL.size,
          endSize: TRAIL.endSize,
          shape: PARTICLE_SHAPE.droplet,
          color: this.trailColor,
          opacity: TRAIL.opacity,
        },
        fromTime + (toTime - fromTime) * k,
      );
      at += TRAIL.step;
    }
    return length - (at - TRAIL.step);
  }

  /**
   * Éclat d'argent de l'ablette à cette place (monde, `y` vers le haut). L'étoile du programme
   * scintille (`sin(vAge * 40)`): sur une vie aussi courte, elle clignoterait et pourrait tomber au
   * plus bas à l'image près. Deux étoiles décalées d'une demi-période s'ajoutent en un éclat stable.
   */
  glint(x: number, y: number, z: number, time: number): void {
    this.star(x, y, z, time);
    this.star(x, y, z, time - (Math.PI / STAR_TWINKLE) * GLINT.seconds);
  }

  private star(x: number, y: number, z: number, time: number): void {
    this.pool.emit(
      {
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        ax: 0,
        ay: 0,
        az: 0,
        drag: 1,
        life: GLINT.seconds,
        startSize: GLINT.size,
        endSize: GLINT.endSize,
        shape: PARTICLE_SHAPE.star,
        color: this.glintColor,
        opacity: GLINT.opacity,
      },
      time,
    );
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
