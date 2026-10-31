/**
 * L'ambiance du bourg (technical artist), branchée par `extensions.ts`: elle
 * lit l'heure et la météo dans la lumière du jour (`lumiere.ts`) et en tire
 * tout ce qui rend la scène vivante:
 *
 * - surfaces (`surfaces.ts`): ombres des nuages, sol mouillé et flaques sous la
 *   pluie, flaques de lumière chaude des lanternes et des fenêtres la nuit;
 * - rivière et gué (`eau.ts`): rides, ciel reflété, écume, étincelles;
 * - pluie et éclaboussures (`pluie.ts`);
 * - nuages bas, brume du matin, halos de nuit (`ciel.ts`);
 * - panache de la locomotive, gouttes d'arrosage, poussière de bêche, étoiles
 *   de la récolte « belle » (`particules.ts`).
 *
 * Coût: quatre appels de dessin au plus (pluie, ciel, bouffées, gué), un
 * programme de shader (les particules), aucune passe de rendu en plus. Chaque
 * effet a une version légère, prise d'elle-même si les images s'allongent.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Material,
} from 'three';
import type { WorldEvent } from '../etat/types';
import { createNoiseTexture, createTerrainField, type TerrainField } from './champs';
import { SkyLayer } from './ciel';
import type { FrameContext } from './contexte';
import { createWaterMaterial, type WaterUniforms } from './eau';
import type { ExtensionPart, RenderHooks } from './extensions';
import { collectGlowSources, groundLights, type GroundLight } from './lueurs';
import type { DaylightRig } from './lumiere';
import { PARTICLE_MODE, PARTICLE_SHAPE, PuffPool, createParticleMaterial } from './particules';
import { RainLayer } from './pluie';
import { RENDER_SETTINGS } from './reglages';
import { AMBIANCE_SETTINGS } from './reglages-ambiance';
import { createSurfaceUniforms, patchSurface, type SurfaceUniforms } from './surfaces';

const HALF_CELL = 0.5;
const MS_PER_SECOND = 1000;
/** Nouvelle recherche des matériaux de personnages (joueur arrivé en cours de partie), en secondes. */
const MATERIAL_SCAN_SECONDS = 1;
/** Nom des matériaux de personnages (habitants et copies des joueurs). */
const CHARACTER_MATERIAL = 'character';
const PALETTE_MATERIAL = 'lpl_palette';
/** Facteur des lumières de Three.js (irradiance / pi) pour éclairer les sprites comme le décor. */
const LAMBERT = 1 / Math.PI;
const FORD_STEPS = 2;
const STEAM_JITTER = 0.15;
const DUST_LIFT = 0.15;
const STAR_LIFT = 0.25;
const STAR_SPREAD = 0.35;
const WHISTLE_RISE = 1.6;

/** Lame d'eau posée sur les cases du gué. */
function buildFord(cells: readonly { cx: number; cy: number }[], height: number): BufferGeometry {
  const positions: number[] = [];
  const size = 1 / FORD_STEPS;
  for (const cell of cells) {
    for (let sy = 0; sy < FORD_STEPS; sy += 1) {
      for (let sx = 0; sx < FORD_STEPS; sx += 1) {
        const x = cell.cx + sx * size;
        const z = cell.cy + sy * size;
        positions.push(x, height, z, x, height, z + size, x + size, height, z + size);
        positions.push(x, height, z, x + size, height, z + size, x + size, height, z);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  const normals = new Float32Array(positions.length);
  for (let i = 1; i < normals.length; i += 3) {
    normals[i] = 1;
  }
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export class AmbiancePart implements ExtensionPart {
  private readonly daylight: DaylightRig;
  private readonly field: TerrainField;
  private readonly surfaces: SurfaceUniforms;
  private readonly water: WaterUniforms[] = [];
  private readonly rain: RainLayer;
  private readonly sky: SkyLayer;
  private readonly puffs: PuffPool;
  private readonly lights: GroundLight[];
  private readonly meshes: Mesh[] = [];
  private readonly lit = new Color();
  private readonly shade = new Color();
  private readonly lightView = new Vector3();
  private readonly lastSort = new Vector3(Number.NaN, 0, 0);
  private readonly chimney = new Vector3();
  private readonly lastChimney = new Vector3();
  private readonly trainVelocity = new Vector3();
  private readonly at = new Vector3();
  private readonly colors = {
    steam: new Color(AMBIANCE_SETTINGS.puffs.steam.color),
    water: new Color(AMBIANCE_SETTINGS.puffs.water.color),
    dust: new Color(AMBIANCE_SETTINGS.puffs.dust.color),
    stars: new Color(AMBIANCE_SETTINGS.puffs.stars.color),
  };
  private readonly order: number[] = [];
  private hadChimney = false;
  private steamClock = 0;
  private scanClock = 0;
  private frameAverageMs = 0;
  private slowFor = 0;
  private light: boolean;
  private time = 0;

  constructor(private readonly hooks: RenderHooks) {
    this.daylight = hooks.daylight;
    this.daylight.attachCamera(hooks.camera);
    // Mode léger du moteur (aucune carte d'ombre): les effets prennent leur version légère.
    this.light = !hooks.renderer.shadowMap.enabled;
    const resources = hooks.resources;
    const noise = resources.track(createNoiseTexture());
    this.field = createTerrainField(hooks.map, hooks.terrain);
    resources.track(this.field.texture);
    this.surfaces = createSurfaceUniforms(noise);

    patchSurface(hooks.materials.palette, this.surfaces, { puddles: true, key: 'decor' });
    this.patchCharacters();

    const waterSettings = AMBIANCE_SETTINGS.water;
    const river = createWaterMaterial(this.field, this.surfaces, waterSettings.opacityDeep);
    resources.track(river.material);
    hooks.water.material = river.material;
    this.water.push(river.uniforms);
    if (this.field.fordCells.length > 0) {
      const ford = createWaterMaterial(this.field, this.surfaces, waterSettings.fordOpacity);
      resources.track(ford.material);
      const gravel = RENDER_SETTINGS.terrain.heights.gravel;
      const mesh = new Mesh(
        resources.track(buildFord(this.field.fordCells, gravel + waterSettings.fordLift)),
        ford.material,
      );
      mesh.name = 'lame du gue';
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = 1;
      this.water.push(ford.uniforms);
      this.add(mesh);
    }

    const glows = collectGlowSources(hooks.map, hooks.library, hooks.terrain);
    this.lights = groundLights(glows);
    this.rain = new RainLayer(this.field, resources);
    this.sky = new SkyLayer(hooks.map, hooks.terrain, this.field, glows, resources);
    this.puffs = new PuffPool(
      AMBIANCE_SETTINGS.puffs.capacity,
      createParticleMaterial(PARTICLE_MODE.puffs, this.field, resources),
      resources,
    );
    this.add(this.rain.mesh);
    this.add(this.sky.mesh);
    this.add(this.puffs.mesh);
  }

  private add(mesh: Mesh): void {
    this.meshes.push(mesh);
    this.hooks.scene.add(mesh);
  }

  /** Les personnages reçoivent nuages, pluie et lumières de sol (pas de flaques sur eux). */
  private patchCharacters(): void {
    const shared = this.hooks.characterMaterial;
    if (shared !== null) {
      patchSurface(shared, this.surfaces, { puddles: false, key: 'characters' });
    }
    this.hooks.scene.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }
      const materials = Array.isArray(object.material)
        ? (object.material as Material[])
        : [object.material as Material];
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) {
          continue;
        }
        if (material.name.includes(CHARACTER_MATERIAL)) {
          patchSurface(material, this.surfaces, { puddles: false, key: 'characters' });
        } else if (material.name.startsWith(PALETTE_MATERIAL)) {
          // Copie de la palette (foulard, substitut): mêmes ajouts que le décor, sans flaques.
          patchSurface(material, this.surfaces, { puddles: false, key: 'decor_copy' });
        }
      }
    });
  }

  handleEvent(event: WorldEvent, context: FrameContext): void {
    if (context.reducedMotion && event.type !== 'train_whistle') {
      return;
    }
    if (event.type === 'train_whistle') {
      this.steamBurst(AMBIANCE_SETTINGS.puffs.steam.whistleBurst);
    } else if (event.type === 'watered') {
      this.cellCentre(event.cell);
      this.waterDrops();
    } else if (event.type === 'tilled' || event.type === 'dig') {
      this.cellCentre(event.cell);
      this.dust();
    } else if (event.type === 'harvested' && event.quality === 'fine') {
      this.cellCentre(event.cell);
      this.stars();
    }
  }

  private cellCentre(cell: { cx: number; cy: number }): void {
    const x = cell.cx + HALF_CELL;
    const y = cell.cy + HALF_CELL;
    this.at.set(x, this.hooks.terrain.heightAt(x, y) + RENDER_SETTINGS.garden.tilledHeight, y);
  }

  private waterDrops(): void {
    const s = AMBIANCE_SETTINGS.puffs;
    const p = this.puffs;
    for (let i = 0; i < s.water.count; i += 1) {
      const angle = p.random() * Math.PI * 2;
      const speed = s.water.speed * (HALF_CELL + p.random());
      p.emit(
        {
          x: this.at.x + (p.random() - HALF_CELL) * HALF_CELL,
          y: this.at.y + s.canHeight,
          z: this.at.z + (p.random() - HALF_CELL) * HALF_CELL,
          vx: Math.cos(angle) * speed * HALF_CELL,
          vy: s.water.up * p.random(),
          vz: Math.sin(angle) * speed * HALF_CELL,
          ax: 0,
          ay: -s.gravity,
          az: 0,
          drag: 0,
          life: s.water.seconds,
          startSize: s.water.size,
          endSize: s.water.size,
          shape: PARTICLE_SHAPE.droplet,
          color: this.colors.water,
          opacity: s.water.opacity,
        },
        this.time,
      );
    }
  }

  private dust(): void {
    const d = AMBIANCE_SETTINGS.puffs.dust;
    const p = this.puffs;
    for (let i = 0; i < d.count; i += 1) {
      const angle = p.random() * Math.PI * 2;
      p.emit(
        {
          x: this.at.x,
          y: this.at.y + DUST_LIFT,
          z: this.at.z,
          vx: Math.cos(angle) * d.speed,
          vy: d.speed * p.random(),
          vz: Math.sin(angle) * d.speed,
          ax: 0,
          ay: 0,
          az: 0,
          drag: 2,
          life: d.seconds * (HALF_CELL + p.random()),
          startSize: d.size,
          endSize: d.endSize,
          shape: PARTICLE_SHAPE.puff,
          color: this.colors.dust,
          opacity: d.opacity,
        },
        this.time,
      );
    }
  }

  private stars(): void {
    const s = AMBIANCE_SETTINGS.puffs.stars;
    const p = this.puffs;
    for (let i = 0; i < s.count; i += 1) {
      const angle = p.random() * Math.PI * 2;
      p.emit(
        {
          x: this.at.x + Math.cos(angle) * STAR_SPREAD * p.random(),
          y: this.at.y + STAR_LIFT,
          z: this.at.z + Math.sin(angle) * STAR_SPREAD * p.random(),
          vx: Math.cos(angle) * s.speed,
          vy: s.up * (HALF_CELL + p.random()),
          vz: Math.sin(angle) * s.speed,
          ax: 0,
          ay: 0,
          az: 0,
          drag: 1.5,
          life: s.seconds * (HALF_CELL + p.random()),
          startSize: s.size,
          endSize: s.size * HALF_CELL,
          shape: PARTICLE_SHAPE.star,
          color: this.colors.stars,
          opacity: s.opacity,
        },
        this.time,
      );
    }
  }

  private steamBurst(count: number, rise = WHISTLE_RISE): void {
    const emitter = this.hooks.smokeEmitter();
    if (emitter === null || !this.hooks.trainState().visible) {
      return;
    }
    emitter.getWorldPosition(this.chimney);
    for (let i = 0; i < count; i += 1) {
      this.steamPuff(rise);
    }
  }

  private steamPuff(rise = 1): void {
    const s = AMBIANCE_SETTINGS.puffs.steam;
    const p = this.puffs;
    const jitter = (): number => (p.random() - HALF_CELL) * 2;
    p.emit(
      {
        x: this.chimney.x + jitter() * STEAM_JITTER,
        y: this.chimney.y,
        z: this.chimney.z + jitter() * STEAM_JITTER,
        vx: this.trainVelocity.x * s.trail + jitter() * s.spread,
        vy: s.rise * rise * (HALF_CELL + p.random()),
        vz: this.trainVelocity.z * s.trail + jitter() * s.spread,
        ax: s.drift[0],
        ay: s.lift,
        az: s.drift[1],
        drag: s.drag,
        life: s.seconds * (HALF_CELL + p.random()),
        startSize: s.startSize,
        endSize: s.endSize * (HALF_CELL + p.random()),
        shape: PARTICLE_SHAPE.puff,
        color: this.colors.steam,
        opacity: s.opacity,
      },
      this.time,
    );
  }

  private updateSteam(context: FrameContext): void {
    const emitter = this.hooks.smokeEmitter();
    const state = this.hooks.trainState();
    if (emitter === null || !state.visible) {
      this.hadChimney = false;
      return;
    }
    emitter.getWorldPosition(this.chimney);
    if (this.hadChimney && context.dt > 0) {
      this.trainVelocity.subVectors(this.chimney, this.lastChimney).divideScalar(context.dt);
    } else {
      this.trainVelocity.set(0, 0, 0);
    }
    this.lastChimney.copy(this.chimney);
    this.hadChimney = true;
    const s = AMBIANCE_SETTINGS.puffs.steam;
    const rate = (state.moving ? s.movingRate : s.idleRate) * (this.light ? HALF_CELL : 1);
    this.steamClock += context.dt * rate;
    while (this.steamClock >= 1) {
      this.steamClock -= 1;
      this.steamPuff();
    }
  }

  /** Les lumières de sol les plus proches de la vue, triées quand le point suivi a bougé. */
  private updateLights(focus: Vector3, viewRadius: number, glow: number): void {
    const settings = AMBIANCE_SETTINGS.glow;
    const u = this.surfaces;
    u.uGlow.value = glow;
    if (glow <= 0) {
      u.uLampCount.value = 0;
      return;
    }
    if (Number.isNaN(this.lastSort.x) || this.lastSort.distanceTo(focus) > settings.resortDistance) {
      this.lastSort.copy(focus);
      this.order.length = 0;
      this.lights.forEach((_, index) => this.order.push(index));
      const distance = (index: number): number =>
        this.lights[index]?.position.distanceToSquared(focus) ?? Number.POSITIVE_INFINITY;
      this.order.sort((a, b) => distance(a) - distance(b));
    }
    const slots = this.light ? settings.slotsLight : settings.slots;
    const reach = viewRadius + settings.fadeBeyondView;
    let count = 0;
    for (const index of this.order) {
      if (count >= slots) {
        break;
      }
      const light = this.lights[index];
      if (light === undefined) {
        continue;
      }
      const distance = light.position.distanceTo(focus) - light.radius;
      const fade = 1 - Math.min(1, Math.max(0, (distance - viewRadius) / (reach - viewRadius)));
      if (fade <= 0) {
        continue;
      }
      const kind = settings.kinds[light.kind];
      const flicker =
        light.kind === 'flame'
          ? 1 + Math.sin(this.time * settings.flickerHz * Math.PI * 2 + light.phase) * settings.flicker
          : 1;
      u.uLamps.value[count]?.set(light.position.x, light.position.y, light.position.z, light.radius);
      u.uLampColors.value[count]?.set(kind.color).multiplyScalar(kind.intensity * fade * flicker);
      count += 1;
    }
    u.uLampCount.value = count;
  }

  /** Version légère si les images restent longues (mêmes seuils que la résolution dynamique). */
  private watchFrames(dt: number): void {
    const detail = AMBIANCE_SETTINGS.detail;
    if (this.light || dt <= 0) {
      return;
    }
    this.frameAverageMs +=
      (dt * MS_PER_SECOND - this.frameAverageMs) * Math.min(1, dt / detail.averageSeconds);
    if (this.time < detail.warmupSeconds) {
      return;
    }
    this.slowFor = this.frameAverageMs > detail.slowFrameMs ? this.slowFor + dt : 0;
    if (this.slowFor > detail.slowSeconds) {
      this.light = true;
    }
  }

  update(context: FrameContext): void {
    this.time = context.time;
    this.watchFrames(context.dt);
    this.scanClock -= context.dt;
    if (this.scanClock <= 0) {
      this.scanClock = MATERIAL_SCAN_SECONDS;
      this.patchCharacters();
    }
    const day = this.daylight;
    const sun = day.sun;
    const hemi = day.hemi;
    this.lit.copy(sun.color).multiplyScalar(sun.intensity * LAMBERT);
    this.shade.copy(hemi.color).multiplyScalar(hemi.intensity * LAMBERT);
    this.lightView.copy(day.direction).transformDirection(this.hooks.camera.matrixWorldInverse);

    const u = this.surfaces;
    u.uAmbTime.value = context.time;
    u.uCloudCover.value = context.reducedMotion ? 0 : day.cloudCover;
    u.uLightDir.value.copy(day.direction);
    u.uWet.value = day.wet;
    u.uReflection.value.copy(day.reflection);
    this.updateLights(day.focus, day.viewRadius, day.night);

    const w = AMBIANCE_SETTINGS.water;
    const glint = Math.max(day.sunLevel, day.night * w.moonGlint) * w.glintStrength;
    for (const water of this.water) {
      water.uGlintColor.value.copy(sun.color);
      water.uGlintLevel.value = glint;
    }

    this.rain.update(
      context.time,
      day.focus,
      day.viewRadius,
      day.rain,
      this.light,
      this.lit,
      this.shade,
    );
    this.sky.update(
      context.time,
      day.focus,
      day.cloudCover,
      day.mist,
      day.night,
      this.light,
      this.lit,
      this.shade,
      this.lightView,
    );
    if (!context.reducedMotion) {
      this.updateSteam(context);
    }
    this.puffs.material.uniforms.uLitColor.value.copy(this.lit);
    this.puffs.material.uniforms.uShadeColor.value.copy(this.shade);
    this.puffs.material.uniforms.uLightView.value.copy(this.lightView);
    this.puffs.update(context.time);
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
    }
    this.meshes.length = 0;
  }
}

/** Extension inscrite dans `RENDER_EXTENSIONS`. */
export function createAmbiance(hooks: RenderHooks): ExtensionPart {
  return new AmbiancePart(hooks);
}
