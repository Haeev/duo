/**
 * Les étoiles de l'Aubrune (moment `falling_stars`, fiche 1.4.10 du tour 7, conception du tour 9
 * section 4.1): le ciel ne se voit pas en vue isométrique, on le voit dans l'eau calme au bout du
 * ponton. Quarante reflets d'étoiles (points de 2 à 4 pixels qui tremblent avec les rides), une
 * étoile filante toutes les 15 à 25 s pendant l'attente, puis les cinq traînées de l'apogée, la
 * grosse éclairant l'eau une seconde.
 *
 * Comme les vers luisants: des sprites additifs du programme des particules (forme `glow`), tous
 * dans un seul maillage instancié, donc un appel de dessin et aucun programme de plus. Les places
 * et les instants sont tirés de la graine de la partie: le même ciel chez les deux joueurs.
 */
import { Color, DataTexture, RGBAFormat, Vector2, Vector4, type Mesh } from 'three';
import type { MomentDef } from '../donnees/types';
import { PARTICLE_MODE, PARTICLE_SHAPE, createParticleMaterial, createParticleMesh, type ParticleBuffers, type ParticleUniforms } from './particules';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';
import { glowUnit } from './vers-luisants';

/** Une traînée: départ et arrivée sur l'eau (x, y), instants de début et de fin (s), la grosse. */
interface Streak {
  from: [number, number];
  to: [number, number];
  t: [number, number];
  big: boolean;
  glowSeconds: number;
  trailSeconds: number;
}

interface StarSettings {
  x: [number, number];
  y: [number, number];
  count: number;
  sizePx: [number, number];
  shootingEverySeconds: [number, number];
  streaks: Streak[];
}

/** Ce que le moment demande au ciel à cette image. */
export interface StarState {
  phase: 'waiting' | 'climax' | 'off';
  /** Temps de la phase (s): attente depuis son début, apogée depuis son début. */
  t: number;
}

/** Pixels par mètre au zoom de départ (57 px/m à 1366 px de large, conception 5.1). */
const PIXELS_PER_METER = 57;
/** Au-dessus de la surface (m): la surface de l'eau ne cache pas le reflet. */
const ABOVE_WATER = 0.02;
const STILL_GROUP = 2;
const STAR_COLOR = '#EEF3FF';
const STREAK_COLOR = '#FFF6D8';
/** Points le long d'une traînée, sa tête la plus vive, et la queue qui s'éteint. */
const TRAIL_POINTS = 8;
const STREAK_SIZE = 0.09;
const BIG_STREAK_SIZE = 0.16;
/** Grosse étoile: la lueur posée sur l'eau, sa taille (m) et son opacité au plus fort. */
const GLOW_SIZE = 4.5;
const GLOW_ALPHA = 0.35;
/** Étoile filante de l'attente: durée de la traînée (s) et longueur (m). */
const SHOOT_SECONDS = 0.6;
const SHOOT_LENGTH = 2.2;
/** Tremblement des reflets: vitesse et part de l'éclat. */
const TWINKLE_HZ = 1.3;
const TWINKLE_SHARE = 0.45;
const RIPPLE = 0.025;
const FADE_SECONDS = 1.5;
const HALO_SCALE = 4;
const HALO_ALPHA = 0.3;
const TWO_PI = Math.PI * 2;

function pair(value: unknown, fallback: [number, number]): [number, number] {
  return Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number' ? [value[0], value[1]] : fallback;
}

/** Réglages du moment (`render` de `moments.json`), contrôlés. */
export function starSettings(def: MomentDef): StarSettings {
  const r = def.render;
  const reflection = (typeof r.reflection === 'object' && r.reflection !== null ? r.reflection : {}) as Record<string, unknown>;
  const streaks: Streak[] = [];
  if (Array.isArray(r.streaks)) {
    for (const raw of r.streaks as unknown[]) {
      if (typeof raw !== 'object' || raw === null) continue;
      const s = raw as Record<string, unknown>;
      streaks.push({
        from: pair(s.from, [0, 0]),
        to: pair(s.to, [0, 0]),
        t: pair(s.t, [0, 0]),
        big: s.big === true,
        glowSeconds: typeof s.glowSeconds === 'number' ? s.glowSeconds : 0,
        trailSeconds: typeof s.trailSeconds === 'number' ? s.trailSeconds : 0.3,
      });
    }
  }
  return {
    x: pair(reflection.x, [41.5, 48.5]),
    y: pair(reflection.y, [40.5, 42.8]),
    count: typeof reflection.count === 'number' ? reflection.count : 40,
    sizePx: pair(reflection.sizePx, [2, 4]),
    shootingEverySeconds: pair(r.shootingEverySeconds, [15, 25]),
    streaks,
  };
}

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  phase: number;
}

export class StarReflections {
  readonly mesh: Mesh;
  private readonly buffers: ParticleBuffers;
  private readonly uniforms: ParticleUniforms;
  private readonly settings: StarSettings;
  private readonly stars: Star[] = [];
  private readonly starColor = new Color(STAR_COLOR);
  private readonly streakColor = new Color(STREAK_COLOR);
  private readonly capacity: number;
  private readonly seed: number;
  private readonly water: number;
  private level = 0;

  constructor(def: MomentDef, terrain: Terrain, seed: number, resources: ResourceTracker) {
    const s = starSettings(def);
    this.settings = s;
    this.seed = seed;
    const cx = (s.x[0] + s.x[1]) / 2;
    const cy = (s.y[0] + s.y[1]) / 2;
    this.water = terrain.waterLevelAt(cx, cy) ?? terrain.heightAt(cx, cy);
    for (let i = 0; i < s.count; i += 1) {
      const x = s.x[0] + glowUnit(seed, i, 61) * (s.x[1] - s.x[0]);
      const y = s.y[0] + glowUnit(seed, i, 67) * (s.y[1] - s.y[0]);
      const px = s.sizePx[0] + glowUnit(seed, i, 71) * (s.sizePx[1] - s.sizePx[0]);
      this.stars.push({ x, y, z: (terrain.waterLevelAt(x, y) ?? this.water) + ABOVE_WATER, size: px / PIXELS_PER_METER, phase: glowUnit(seed, i, 73) * TWO_PI });
    }
    // Les étoiles (un point et un halo chacune), une traînée de l'attente, les cinq de l'apogée et la lueur de la grosse.
    this.capacity = s.count * 2 + TRAIL_POINTS * (1 + s.streaks.length) + 1;
    const field = resources.track(new DataTexture(new Uint8Array(4), 1, 1, RGBAFormat));
    field.needsUpdate = true;
    const material = createParticleMaterial(PARTICLE_MODE.sprites, { texture: field, rect: new Vector4(), height: new Vector2() }, resources);
    this.uniforms = material.uniforms;
    const built = createParticleMesh('étoiles', this.capacity, material, resources, true);
    this.mesh = built.mesh;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
    this.buffers = built.buffers;
    this.uniforms.uGroupAlpha.value.set(0, 0, 1, 0);
    for (let i = 0; i < this.capacity; i += 1) {
      this.buffers.accel.setXYZW(i, 0, 0, 0, STILL_GROUP);
      this.buffers.velocity.setXYZW(i, 0, 0, 0, 0);
    }
    this.buffers.accel.needsUpdate = true;
    this.buffers.velocity.needsUpdate = true;
  }

  private write(index: number, x: number, y: number, z: number, size: number, color: Color, alpha: number): void {
    const b = this.buffers;
    b.origin.setXYZW(index, x, z, y, 0);
    b.size.setXYZW(index, size, size, PARTICLE_SHAPE.glow, 0);
    b.color.setXYZW(index, color.r, color.g, color.b, alpha);
  }

  /** Une traînée à l'instant `u` (0 au départ, 1 à l'arrivée), queue comprise, de `index` à `index + TRAIL_POINTS`. */
  private trail(index: number, from: [number, number], to: [number, number], u: number, tail: number, size: number, alpha: number): void {
    for (let k = 0; k < TRAIL_POINTS; k += 1) {
      const back = (k / (TRAIL_POINTS - 1)) * tail;
      const p = u - back;
      const on = p >= 0 && p <= 1 && u <= 1 + tail;
      const x = from[0] + (to[0] - from[0]) * Math.min(1, Math.max(0, p));
      const y = from[1] + (to[1] - from[1]) * Math.min(1, Math.max(0, p));
      const fade = 1 - k / TRAIL_POINTS;
      this.write(index + k, x, y, this.water + ABOVE_WATER, size * (0.6 + 0.4 * fade), this.streakColor, on ? alpha * fade : 0);
    }
  }

  update(state: StarState, time: number, dt: number, reducedMotion: boolean, night: number): void {
    const s = this.settings;
    const on = state.phase !== 'off';
    this.level = on ? Math.min(1, this.level + dt / FADE_SECONDS) : Math.max(0, this.level - dt / FADE_SECONDS);
    const shown = this.level * night;
    this.mesh.visible = shown > 0;
    if (!this.mesh.visible) return;
    this.uniforms.uTime.value = time;
    let index = 0;
    for (const star of this.stars) {
      const twinkle = reducedMotion ? 1 : 1 - TWINKLE_SHARE * (0.5 + 0.5 * Math.sin(time * TWINKLE_HZ * TWO_PI + star.phase));
      const wobble = reducedMotion ? 0 : Math.sin(time * 1.7 + star.phase * 3) * RIPPLE;
      this.write(index, star.x + wobble, star.y, star.z, star.size, this.starColor, twinkle * shown);
      // Un halo très doux: les reflets se distinguent des éclats de lune de la rivière.
      this.write(index + 1, star.x + wobble, star.y, star.z, star.size * HALO_SCALE, this.starColor, twinkle * shown * HALO_ALPHA);
      index += 2;
    }
    // Étoile filante de l'attente: une par période tirée de la graine, au même instant chez les deux.
    const [min, max] = s.shootingEverySeconds;
    const period = (min + max) / 2;
    const slot = Math.floor(state.t / period);
    const startAt = glowUnit(this.seed, slot, 79) * (period - SHOOT_SECONDS);
    const u = state.phase === 'waiting' ? (state.t - slot * period - startAt) / SHOOT_SECONDS : -1;
    const sx = s.x[0] + glowUnit(this.seed, slot, 83) * (s.x[1] - s.x[0] - SHOOT_LENGTH);
    const sy = s.y[0] + glowUnit(this.seed, slot, 89) * (s.y[1] - s.y[0]);
    this.trail(index, [sx, sy], [sx + SHOOT_LENGTH, Math.min(s.y[1], sy + SHOOT_LENGTH * 0.4)], u, 0.35, STREAK_SIZE, shown);
    index += TRAIL_POINTS;
    // Les traînées de l'apogée (table du tour 7), et la lueur de la grosse.
    let glow = 0;
    let glowX = 0;
    let glowY = 0;
    for (const streak of s.streaks) {
      const span = Math.max(0.05, streak.t[1] - streak.t[0]);
      const v = state.phase === 'climax' ? (state.t - streak.t[0]) / span : -1;
      const tail = Math.max(0.2, streak.trailSeconds / span);
      this.trail(index, streak.from, streak.to, v, tail, streak.big ? BIG_STREAK_SIZE : STREAK_SIZE, shown);
      index += TRAIL_POINTS;
      if (streak.big && state.phase === 'climax' && streak.glowSeconds > 0) {
        const since = state.t - streak.t[0];
        if (since >= 0 && since <= span + streak.glowSeconds) {
          glow = Math.sin(Math.min(1, since / (span + streak.glowSeconds)) * Math.PI);
          glowX = (streak.from[0] + streak.to[0]) / 2;
          glowY = (streak.from[1] + streak.to[1]) / 2;
        }
      }
    }
    this.write(index, glowX, glowY, this.water + ABOVE_WATER, GLOW_SIZE, this.streakColor, glow * GLOW_ALPHA * shown);
    this.buffers.origin.needsUpdate = true;
    this.buffers.size.needsUpdate = true;
    this.buffers.color.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
  }
}
