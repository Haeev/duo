/**
 * Ce qui flotte au-dessus du bourg, en sprites doux d'un même appel de dessin:
 * quelques nuages bas qui passent au bord de l'écran (jamais au centre: ils ne
 * cachent pas les joueurs), des bancs de brume au ras du sol le matin (rosée,
 * pluie), et les halos des lanternes et des fenêtres la nuit.
 */
import { Color, type Mesh, type Vector3 } from 'three';
import type { GameMap } from '../etat/carte';
import { hash2 } from './bruit';
import type { TerrainField } from './champs';
import type { GlowSource } from './lueurs';
import {
  PARTICLE_MODE,
  PARTICLE_SHAPE,
  createParticleMaterial,
  createParticleMesh,
  type ParticleBuffers,
  type ParticleUniforms,
} from './particules';
import { AMBIANCE_SETTINGS } from './reglages-ambiance';
import { SEASON_RENDER_SETTINGS } from './reglages-saisons';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

const GROUP_CLOUD = 0;
const GROUP_MIST = 1;
const GROUP_HALO = 2;
const GROUP_MORNING = 3;
/** Réglages par instance du mode sprites (`aAccel.x`, `aAccel.y`): couché à plat, fondu au sol. */
const LYING = 1;
const GROUND_FADE = 1;
/** Graines des tirages (bruit déterministe). */
const SEED_CLOUD = 11;
const SEED_MIST = 23;
const SEED_MORNING = 37;
/** Étalement des bouffées d'un nuage autour de son centre (part de la taille d'une bouffée). */
const CLOUD_SPREAD = 0.9;
const CLOUD_FLATTEN = 0.35;
const CLOUD_SIZE_JITTER = 0.5;
/** Un banc de brume se pose sur l'eau ou l'herbe basse, jamais sur un toit. */
const MIST_TRIES = 6;
const MIST_MAX_GROUND = 0.1;
const HALF = 0.5;

export class SkyLayer {
  readonly mesh: Mesh;
  private readonly uniforms: ParticleUniforms;
  private readonly clouds: number;
  private readonly mist: number;
  private readonly halos: number;
  private readonly morning: number;

  constructor(
    map: GameMap,
    terrain: Terrain,
    field: TerrainField,
    glows: readonly GlowSource[],
    resources: ResourceTracker,
  ) {
    const sky = AMBIANCE_SETTINGS.sky;
    this.clouds = sky.clouds * sky.cloudPuffs;
    this.mist = sky.mist;
    this.halos = glows.length;
    this.morning = SEASON_RENDER_SETTINGS.morningMist.banks;
    const total = this.clouds + this.mist + this.halos + this.morning;
    const material = createParticleMaterial(PARTICLE_MODE.sprites, field, resources);
    this.uniforms = material.uniforms;
    const built = createParticleMesh('ciel', Math.max(1, total), material, resources, false);
    this.mesh = built.mesh;
    const b = built.buffers;
    let index = 0;
    index = this.fillClouds(b, index);
    index = this.fillMist(b, index, map, terrain);
    index = this.fillHalos(b, index, glows);
    this.fillMorningMist(b, index, map, terrain);
    built.geometry.instanceCount = total;
    this.mesh.renderOrder = 2;
    const u = this.uniforms;
    u.uSpriteArea.value.set(sky.cloudArea, sky.mistArea, sky.cloudWind[0], sky.cloudWind[1]);
    u.uCloudFade.value.set(sky.cloudClearCenter, sky.cloudFullEdge);
    u.uGroundFade.value = sky.mistGroundFade;
  }

  private fillClouds(b: ParticleBuffers, start: number): number {
    const sky = AMBIANCE_SETTINGS.sky;
    const color = new Color(sky.cloudColor);
    let index = start;
    for (let cloud = 0; cloud < sky.clouds; cloud += 1) {
      const cx = (hash2(cloud, 0, SEED_CLOUD) * 2 - 1) * sky.cloudArea;
      const cz = (hash2(cloud, 1, SEED_CLOUD) * 2 - 1) * sky.cloudArea;
      for (let puff = 0; puff < sky.cloudPuffs; puff += 1) {
        const jitter = (salt: number): number =>
          hash2(cloud * sky.cloudPuffs + puff, salt, SEED_CLOUD) * 2 - 1;
        const size = sky.cloudPuffSize * (1 + jitter(2) * CLOUD_SIZE_JITTER);
        b.origin.setXYZW(
          index,
          cx + jitter(3) * sky.cloudPuffSize * CLOUD_SPREAD,
          sky.cloudHeight + jitter(4) * sky.cloudPuffSize * CLOUD_FLATTEN,
          cz + jitter(5) * sky.cloudPuffSize * CLOUD_SPREAD,
          hash2(cloud, puff, SEED_CLOUD),
        );
        b.accel.setXYZW(index, 0, 0, 0, GROUP_CLOUD);
        b.size.setXYZW(index, size, size, PARTICLE_SHAPE.puff, 0);
        b.color.setXYZW(index, color.r, color.g, color.b, sky.cloudOpacity);
        index += 1;
      }
    }
    return index;
  }

  /**
   * Bancs de brume semés sur l'eau et l'herbe basse de la carte (bande prolongée comprise),
   * couchés à plat au ras du sol: un carré tourné vers la caméra passait à moitié sous le sol, qui
   * le coupait d'un bord droit. Là où le sol remonte (berge, quai), le banc s'efface en douceur.
   */
  private fillMist(b: ParticleBuffers, start: number, map: GameMap, terrain: Terrain): number {
    const sky = AMBIANCE_SETTINGS.sky;
    const color = new Color(sky.mistColor);
    let index = start;
    for (let bank = 0; bank < sky.mist; bank += 1) {
      let x = map.width * HALF;
      let y = map.height * HALF;
      for (let attempt = 0; attempt < MIST_TRIES; attempt += 1) {
        x = hash2(bank, attempt * 2, SEED_MIST) * map.width;
        y = hash2(bank, attempt * 2 + 1, SEED_MIST) * map.height;
        if (terrain.heightAt(x, y) < MIST_MAX_GROUND) {
          break;
        }
      }
      const ground = terrain.heightAt(x, y);
      b.origin.setXYZW(index, x, ground + sky.mistHeight, y, hash2(bank, 0, SEED_MIST + 1));
      b.velocity.setXYZW(index, sky.mistDrift * sky.mistSize, 0, 0, 1);
      b.accel.setXYZW(index, LYING, GROUND_FADE, 0, GROUP_MIST);
      b.size.setXYZW(index, sky.mistSize, sky.mistSize, PARTICLE_SHAPE.puff, 0);
      b.color.setXYZW(index, color.r, color.g, color.b, sky.mistOpacity);
      index += 1;
    }
    return index;
  }

  /**
   * Nappe de la brume du matin (tour 8, section 3.4): bancs serrés sur l'eau et l'herbe basse de
   * l'Aubrune et du pré de l'est, là où l'air froid s'accumule; jamais sur le quai ni sur un toit.
   */
  private fillMorningMist(b: ParticleBuffers, start: number, map: GameMap, terrain: Terrain): void {
    const m = SEASON_RENDER_SETTINGS.morningMist;
    const rects = m.zones.map((id) => map.zones[id]).filter((rect) => rect !== undefined);
    const color = new Color(AMBIANCE_SETTINGS.sky.mistColor);
    for (let bank = 0; bank < this.morning; bank += 1) {
      const index = start + bank;
      const rect = rects[bank % Math.max(1, rects.length)];
      let x = rect === undefined ? map.width * HALF : rect.x + rect.w * HALF;
      let y = rect === undefined ? map.height * HALF : rect.y + rect.h * HALF;
      for (let attempt = 0; rect !== undefined && attempt < MIST_TRIES; attempt += 1) {
        x = rect.x + hash2(bank, attempt * 2, SEED_MORNING) * rect.w;
        y = rect.y + hash2(bank, attempt * 2 + 1, SEED_MORNING) * rect.h;
        if (terrain.heightAt(x, y) < MIST_MAX_GROUND) break;
      }
      const size = m.size * (0.8 + 0.4 * hash2(bank, 0, SEED_MORNING + 1));
      b.origin.setXYZW(index, x, terrain.heightAt(x, y) + m.height, y, hash2(bank, 1, SEED_MORNING + 1));
      b.velocity.setXYZW(index, AMBIANCE_SETTINGS.sky.mistDrift * size, 0, 0, 1);
      b.accel.setXYZW(index, LYING, GROUND_FADE, 0, GROUP_MORNING);
      b.size.setXYZW(index, size, size, PARTICLE_SHAPE.puff, 0);
      b.color.setXYZW(index, color.r, color.g, color.b, m.opacity);
    }
  }

  private fillHalos(b: ParticleBuffers, start: number, glows: readonly GlowSource[]): number {
    const kinds = AMBIANCE_SETTINGS.glow.kinds;
    let index = start;
    const color = new Color();
    for (const glow of glows) {
      const kind = kinds[glow.kind];
      color.set(kind.color);
      // Le halo d'une vitre sort un peu du mur, pour ne pas y être à moitié enfoui.
      const push = kind.halo * HALF;
      b.origin.setXYZW(
        index,
        glow.position.x + glow.normal.x * push,
        glow.position.y + glow.normal.y * push,
        glow.position.z + glow.normal.z * push,
        hash2(index, 0, SEED_MIST + 2),
      );
      b.accel.setXYZW(index, 0, 0, 0, GROUP_HALO);
      b.size.setXYZW(index, kind.halo, kind.halo, PARTICLE_SHAPE.glow, 0);
      b.color.setXYZW(index, color.r, color.g, color.b, kind.haloOpacity);
      index += 1;
    }
    return index;
  }

  /**
   * `cloudAmount`, `mistAmount`, `glowAmount`, `morningAmount` (nappe de la brume du matin): de 0
   * à 1. En version légère, ni nuages ni brume (les halos restent: ils disent la nuit).
   */
  update(
    time: number,
    focus: Vector3,
    cloudAmount: number,
    mistAmount: number,
    glowAmount: number,
    light: boolean,
    lit: Color,
    shade: Color,
    lightView: Vector3,
    morningAmount = 0,
  ): void {
    const u = this.uniforms;
    const clouds = light ? 0 : cloudAmount;
    const mist = light ? 0 : mistAmount;
    const morning = light ? 0 : morningAmount;
    u.uGroupAlpha.value.set(clouds, mist, glowAmount, morning);
    this.mesh.visible =
      clouds > 0 || mist > 0 || morning > 0 || (glowAmount > 0 && this.halos > 0);
    if (!this.mesh.visible) {
      return;
    }
    u.uTime.value = time;
    u.uFocus.value.copy(focus);
    u.uLitColor.value.copy(lit);
    u.uShadeColor.value.copy(shade);
    u.uLightView.value.copy(lightView);
  }
}
