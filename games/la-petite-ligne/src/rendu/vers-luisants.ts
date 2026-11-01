/**
 * Les vers luisants du pré (moment `glowworms`, conception du tour 6, section 1.4.6): de petites
 * lanternes vert-jaune posées sur les herbes hautes, et quelques-unes qui volent. Aucune lumière
 * ponctuelle: chaque lanterne est un halo additif du programme des particules (`particules.ts`,
 * forme `glow`), un cœur net et un halo doux, toutes dans un seul maillage instancié, donc un seul
 * appel de dessin et aucun programme de plus.
 *
 * Les positions sont tirées de la graine de la partie (même pré chez les deux joueurs); l'allumage
 * suit le temps de la chorégraphie (`etat/moments.ts`).
 */
import { Color, DataTexture, RGBAFormat, Vector2, Vector4, type Mesh } from 'three';
import type { MomentDef } from '../donnees/types';
import type { GameMap } from '../etat/carte';
import { cellIndex, inMap } from '../etat/carte';
import { PARTICLE_MODE, PARTICLE_SHAPE, createParticleMaterial, createParticleMesh, type ParticleBuffers, type ParticleUniforms } from './particules';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

/** Réglages lus dans `moments.json` (`render` du moment), avec leurs valeurs par défaut. */
interface GlowSettings {
  groundLights: number;
  groundLightsLight: number;
  flyingLights: number;
  ellipse: [number, number];
  minSpacing: number;
  groundZ: [number, number];
  flyZ: [number, number];
  flySpeed: [number, number];
  flashEverySeconds: [number, number];
  flashSeconds: number;
  litWhileWaiting: number;
  frontSpeed: number;
  breatheSeconds: [number, number];
  breatheRange: [number, number];
  fadeOutSeconds: number;
  color: string;
  avoid: [number, number][];
}

const DEFAULTS: GlowSettings = {
  groundLights: 25,
  groundLightsLight: 12,
  flyingLights: 6,
  ellipse: [4.5, 3.5],
  minSpacing: 0.8,
  groundZ: [0.05, 0.3],
  flyZ: [0.4, 1.6],
  flySpeed: [0.3, 0.5],
  flashEverySeconds: [1.2, 2.0],
  flashSeconds: 0.15,
  litWhileWaiting: 5,
  frontSpeed: 1.2,
  breatheSeconds: [3, 5],
  breatheRange: [0.6, 1.0],
  fadeOutSeconds: 10,
  color: '#B8F05A',
  avoid: [],
};

/** Taille (m) et opacité du cœur et du halo d'une lanterne: petite et douce. */
const CORE_SIZE = 0.045;
const CORE_ALPHA = 1.0;
const HALO_SIZE = 0.26;
const HALO_ALPHA = 0.42;
/** Une lanterne qui s'allume met ce temps à atteindre son éclat (s). */
const LIGHT_UP_SECONDS = 0.6;
/** Écart aux rochers et au buisson du pré (m). */
const AVOID_RADIUS = 0.9;
const MAX_TRIES = 600;
/** Groupe des sprites posés (`particules.ts`, mode `sprites`): le groupe 2 ne dérive pas. */
const STILL_GROUP = 2;
const INSTANCES_PER_LIGHT = 2;
/** Les lanternes volantes changent de cap à cet intervalle (s). */
const FLY_LEG_SECONDS = 2.5;
const TWO_PI = Math.PI * 2;

function pair(value: unknown, fallback: [number, number]): [number, number] {
  if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') {
    return [value[0], value[1]];
  }
  return fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Réglages du moment, contrôlés (les valeurs de `render` sont lues telles quelles, non typées). */
export function glowSettings(def: MomentDef): GlowSettings {
  const r = def.render;
  const avoid = Array.isArray(r.avoid) ? r.avoid.map((p) => pair(p, [Number.NaN, Number.NaN])).filter((p) => Number.isFinite(p[0])) : [];
  return {
    groundLights: num(r.groundLights, DEFAULTS.groundLights),
    groundLightsLight: num(r.groundLightsLight, DEFAULTS.groundLightsLight),
    flyingLights: num(r.flyingLights, DEFAULTS.flyingLights),
    ellipse: pair(r.ellipse, DEFAULTS.ellipse),
    minSpacing: num(r.minSpacing, DEFAULTS.minSpacing),
    groundZ: pair(r.groundZ, DEFAULTS.groundZ),
    flyZ: pair(r.flyZ, DEFAULTS.flyZ),
    flySpeed: pair(r.flySpeed, DEFAULTS.flySpeed),
    flashEverySeconds: pair(r.flashEverySeconds, DEFAULTS.flashEverySeconds),
    flashSeconds: num(r.flashSeconds, DEFAULTS.flashSeconds),
    litWhileWaiting: num(r.litWhileWaiting, DEFAULTS.litWhileWaiting),
    frontSpeed: num(r.frontSpeed, DEFAULTS.frontSpeed),
    breatheSeconds: pair(r.breatheSeconds, DEFAULTS.breatheSeconds),
    breatheRange: pair(r.breatheRange, DEFAULTS.breatheRange),
    fadeOutSeconds: num(r.fadeOutSeconds, DEFAULTS.fadeOutSeconds),
    color: typeof r.color === 'string' ? r.color : DEFAULTS.color,
    avoid,
  };
}

/** Hachage stable de trois entiers vers [0, 1[ (même tirage sur les deux machines). */
export function glowUnit(seed: number, index: number, salt: number): number {
  let h = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  // `>>> 0`: le dernier XOR rend un entier signé; sans lui, un tirage sur deux environ est négatif
  // (rayon impossible, lanterne sous l'herbe, vitesse et cadence hors de leurs plages).
  return (h >>> 0) / 2 ** 32;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

interface GroundLight {
  x: number;
  y: number;
  z: number;
  /** Distance au centre (allumage en front qui avance). */
  distance: number;
  breathe: number;
  phase: number;
  /** Allumée pendant l'attente. */
  early: boolean;
}

interface Flyer {
  phase: number;
  speed: number;
  flashEvery: number;
}

/** Ce que le moment demande aux lanternes à cette image. */
export interface GlowState {
  /** `waiting`, `climax` (avec le temps de la chorégraphie), `after`, ou éteint (`off`). */
  phase: 'waiting' | 'climax' | 'after' | 'off';
  /** Secondes depuis le début de l'apogée (climax). */
  t: number;
}

export class GlowwormLights {
  readonly mesh: Mesh;
  private readonly buffers: ParticleBuffers;
  private readonly uniforms: ParticleUniforms;
  private readonly settings: GlowSettings;
  private readonly lights: GroundLight[] = [];
  private readonly flyers: Flyer[] = [];
  private readonly color: Color;
  private readonly center: { x: number; y: number; ground: number };
  /** Éclat global: monte à l'allumage, descend en `fadeOutSeconds` une fois le moment parti. */
  private level = 0;
  /** Le moment est parti sans apogée: seules les lanternes de l'attente s'éteignent. */
  private wasWaiting = true;

  constructor(
    def: MomentDef,
    map: GameMap,
    terrain: Terrain,
    seed: number,
    light: boolean,
    resources: ResourceTracker,
  ) {
    const s = glowSettings(def);
    this.settings = s;
    const anchor = map.points[def.anchor] ?? { x: 0, y: 0 };
    this.center = { x: anchor.x, y: anchor.y, ground: terrain.heightAt(anchor.x, anchor.y) };
    this.color = new Color(s.color);
    // Mode léger: moins de lanternes posées, jamais moins de `groundLightsLight` (12).
    const wanted = light ? s.groundLightsLight : s.groundLights;
    this.placeGround(map, terrain, seed, wanted);
    for (let i = 0; i < s.flyingLights; i += 1) {
      this.flyers.push({
        phase: glowUnit(seed, i, 41) * 100,
        speed: lerp(s.flySpeed[0], s.flySpeed[1], glowUnit(seed, i, 43)),
        flashEvery: lerp(s.flashEverySeconds[0], s.flashEverySeconds[1], glowUnit(seed, i, 47)),
      });
    }
    // Le programme des particules lit un champ du terrain; les sprites posés ne s'en servent pas.
    const field = resources.track(new DataTexture(new Uint8Array(4), 1, 1, RGBAFormat));
    field.needsUpdate = true;
    const material = createParticleMaterial(PARTICLE_MODE.sprites, { texture: field, rect: new Vector4(), height: new Vector2() }, resources);
    this.uniforms = material.uniforms;
    const capacity = Math.max(1, (this.lights.length + this.flyers.length) * INSTANCES_PER_LIGHT);
    const built = createParticleMesh('vers luisants', capacity, material, resources, true);
    this.mesh = built.mesh;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
    this.buffers = built.buffers;
    // Seuls les sprites immobiles (groupe 2) s'affichent, à pleine opacité de groupe.
    this.uniforms.uGroupAlpha.value.set(0, 0, 1, 0);
    for (let i = 0; i < capacity; i += 1) {
      this.buffers.accel.setXYZW(i, 0, 0, 0, STILL_GROUP);
      this.buffers.velocity.setXYZW(i, 0, 0, 0, 0);
    }
    this.buffers.accel.needsUpdate = true;
    this.buffers.velocity.needsUpdate = true;
  }

  /** Tirage de Poisson par fléchettes sur l'herbe de l'ellipse, hors du buisson et des rochers. */
  private placeGround(map: GameMap, terrain: Terrain, seed: number, wanted: number): void {
    const s = this.settings;
    const [ax, ay] = s.ellipse;
    for (let attempt = 0; attempt < MAX_TRIES && this.lights.length < wanted; attempt += 1) {
      const angle = glowUnit(seed, attempt, 3) * TWO_PI;
      const radius = Math.sqrt(glowUnit(seed, attempt, 5));
      const x = this.center.x + Math.cos(angle) * radius * ax;
      const y = this.center.y + Math.sin(angle) * radius * ay;
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      if (!inMap(map, cx, cy)) continue;
      const index = cellIndex(map, cx, cy);
      if (map.ground[index] !== 'grass' || map.blocked[index] === true) continue;
      if (s.avoid.some(([px, py]) => Math.hypot(px - x, py - y) < AVOID_RADIUS)) continue;
      if (this.lights.some((l) => Math.hypot(l.x - x, l.y - y) < s.minSpacing)) continue;
      const i = this.lights.length;
      this.lights.push({
        x,
        y,
        z: terrain.heightAt(x, y) + lerp(s.groundZ[0], s.groundZ[1], glowUnit(seed, i, 7)),
        distance: Math.hypot(x - this.center.x, y - this.center.y),
        breathe: lerp(s.breatheSeconds[0], s.breatheSeconds[1], glowUnit(seed, i, 11)),
        phase: glowUnit(seed, i, 13) * TWO_PI,
        early: false,
      });
    }
    // Pendant l'attente: les plus proches du centre brillent déjà.
    const order = [...this.lights].sort((a, b) => a.distance - b.distance);
    for (let i = 0; i < Math.min(s.litWhileWaiting, order.length); i += 1) {
      const lightAt = order[i];
      if (lightAt !== undefined) lightAt.early = true;
    }
  }

  /** Nombre de lanternes posées (essais, budget du mode léger). */
  groundCount(): number {
    return this.lights.length;
  }

  private write(index: number, x: number, y: number, z: number, size: number, alpha: number, seed: number): void {
    const b = this.buffers;
    b.origin.setXYZW(index, x, z, y, seed);
    b.size.setXYZW(index, size, size, PARTICLE_SHAPE.glow, seed);
    b.color.setXYZW(index, this.color.r, this.color.g, this.color.b, alpha);
  }

  update(state: GlowState, time: number, dt: number, reducedMotion: boolean): void {
    const s = this.settings;
    const on = state.phase !== 'off';
    // Allumé: tout de suite; éteint: en `fadeOutSeconds` (la nuit reprend doucement le pré).
    this.level = on ? 1 : Math.max(0, this.level - dt / Math.max(0.01, s.fadeOutSeconds));
    if (on) this.wasWaiting = state.phase === 'waiting';
    this.mesh.visible = this.level > 0;
    if (!this.mesh.visible) return;
    this.uniforms.uTime.value = time;
    let index = 0;
    const front = state.phase === 'climax' ? state.t * s.frontSpeed : state.phase === 'waiting' ? -1 : Number.POSITIVE_INFINITY;
    for (const l of this.lights) {
      let lit: number;
      if (l.early) lit = 1;
      else if (state.phase === 'off') lit = this.wasWaiting ? 0 : 1;
      else if (front === Number.POSITIVE_INFINITY) lit = 1;
      else lit = Math.max(0, Math.min(1, (front - l.distance) / (s.frontSpeed * LIGHT_UP_SECONDS)));
      const breathe = reducedMotion ? 1 : lerp(s.breatheRange[0], s.breatheRange[1], 0.5 + 0.5 * Math.sin((time / l.breathe) * TWO_PI + l.phase));
      const a = lit * breathe * this.level;
      this.write(index, l.x, l.y, l.z, CORE_SIZE, a * CORE_ALPHA, l.phase);
      this.write(index + 1, l.x, l.y, l.z, HALO_SIZE, a * HALO_ALPHA, l.phase);
      index += INSTANCES_PER_LIGHT;
    }
    const [ax, ay] = s.ellipse;
    for (let i = 0; i < this.flyers.length; i += 1) {
      const f = this.flyers[i];
      if (f === undefined) continue;
      // Marche lente au hasard dans l'ellipse: une courbe de Lissajous propre à chaque lanterne.
      const u = f.phase + (time * f.speed) / FLY_LEG_SECONDS;
      let x = this.center.x + Math.sin(u * 0.71 + i) * ax * 0.8;
      let y = this.center.y + Math.sin(u * 0.53 + i * 2.1) * ay * 0.8;
      let z = this.center.ground + lerp(s.flyZ[0], s.flyZ[1], 0.5 + 0.5 * Math.sin(u * 0.37 + i * 1.3));
      if (state.phase === 'climax') {
        // Pendant l'allumage, elles descendent vers la lanterne posée la plus proche, puis repartent.
        const target = this.nearest(x, y);
        const dip = Math.sin(Math.min(1, state.t / 8) * Math.PI);
        if (target !== null) {
          x = lerp(x, target.x, dip * 0.6);
          y = lerp(y, target.y, dip * 0.6);
          z = lerp(z, target.z + 0.2, dip * 0.8);
        }
      }
      const cycle = (time + f.phase) % f.flashEvery;
      const flash = cycle < s.flashSeconds ? 1 : 0.12;
      const visible = state.phase === 'waiting' || (state.phase === 'off' && this.wasWaiting) ? 0.6 : 1;
      const a = flash * visible * this.level;
      this.write(index, x, y, z, CORE_SIZE, a * CORE_ALPHA, f.phase);
      this.write(index + 1, x, y, z, HALO_SIZE, a * HALO_ALPHA, f.phase);
      index += INSTANCES_PER_LIGHT;
    }
    this.buffers.origin.needsUpdate = true;
    this.buffers.size.needsUpdate = true;
    this.buffers.color.needsUpdate = true;
  }

  private nearest(x: number, y: number): GroundLight | null {
    let best: GroundLight | null = null;
    let distance = Number.POSITIVE_INFINITY;
    for (const l of this.lights) {
      const d = Math.hypot(l.x - x, l.y - y);
      if (d < distance) {
        distance = d;
        best = l;
      }
    }
    return best;
  }

  dispose(): void {
    this.mesh.removeFromParent();
  }
}
