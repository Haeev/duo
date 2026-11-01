/**
 * La brume de l'Aubrune (moment `mist`, conception du tour 7, fiche 1.4.9): un banc de brume au
 * ras de l'eau, épais sur la rivière et léger sur les berges, qui dérive avec le courant; à
 * l'apogée, il se lève en un front qui part de l'aval vers le gué, avec des volutes qui montent.
 *
 * Coût: des bouffées douces du programme des particules (`particules.ts`, forme `puff`, sprites
 * posés du groupe 2), toutes dans un seul maillage instancié: un appel de dessin, aucun programme
 * de plus. Le processeur réécrit leurs positions à chaque image (au plus `puffs` instances, sans
 * allocation); en mode léger, `puffsLight` seulement.
 */
import { Color, DataTexture, RGBAFormat, Vector2, Vector4, type Mesh, type Vector3 } from 'three';
import type { MomentDef } from '../donnees/types';
import type { GameMap } from '../etat/carte';
import {
  PARTICLE_MODE,
  PARTICLE_SHAPE,
  createParticleMaterial,
  createParticleMesh,
  type ParticleBuffers,
  type ParticleUniforms,
} from './particules';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

/** Réglages lus dans `moments.json` (`render` du moment), avec leurs valeurs par défaut. */
interface MistSettings {
  fromX: number;
  toX: number;
  /** Longueur (m) sur laquelle la brume s'effiloche à ses deux bouts (avant le ponton, au gué). */
  fadeEnd: number;
  /** Rien au nord de cette ligne (le banc de la berge, les toits). */
  northLimitY: number;
  southLimitY: number;
  drift: number;
  waterOpacity: number;
  bankOpacity: number;
  /** Sommet de la nappe au-dessus de l'eau (m): sous les épaules, on se reconnaît. */
  top: number;
  puffs: number;
  puffsLight: number;
  frontFrom: number;
  frontSpeed: number;
  frontStart: number;
  frontWidth: number;
  plumeHeight: number;
  leaveSeconds: number;
  color: string;
}

const DEFAULTS: MistSettings = {
  fromX: 14,
  toX: 44,
  fadeEnd: 2.5,
  northLimitY: 37,
  southLimitY: 44,
  drift: 0.35,
  waterOpacity: 0.7,
  bankOpacity: 0.3,
  top: 1.2,
  puffs: 150,
  puffsLight: 60,
  frontFrom: 44,
  frontSpeed: 4,
  frontStart: 1.5,
  frontWidth: 2.5,
  plumeHeight: 2.5,
  leaveSeconds: 20,
  color: '#E6ECEE',
};

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function mistSettings(def: MomentDef): MistSettings {
  const r = def.render;
  return {
    fromX: num(r.fromX, DEFAULTS.fromX),
    toX: num(r.toX, DEFAULTS.toX),
    fadeEnd: num(r.fadeEnd, DEFAULTS.fadeEnd),
    northLimitY: num(r.northLimitY, DEFAULTS.northLimitY),
    southLimitY: num(r.southLimitY, DEFAULTS.southLimitY),
    drift: num(r.drift, DEFAULTS.drift),
    waterOpacity: num(r.waterOpacity, DEFAULTS.waterOpacity),
    bankOpacity: num(r.bankOpacity, DEFAULTS.bankOpacity),
    top: num(r.top, DEFAULTS.top),
    puffs: num(r.puffs, DEFAULTS.puffs),
    puffsLight: num(r.puffsLight, DEFAULTS.puffsLight),
    frontFrom: num(r.frontFrom, DEFAULTS.frontFrom),
    frontSpeed: num(r.frontSpeed, DEFAULTS.frontSpeed),
    frontStart: num(r.frontStart, DEFAULTS.frontStart),
    frontWidth: num(r.frontWidth, DEFAULTS.frontWidth),
    plumeHeight: num(r.plumeHeight, DEFAULTS.plumeHeight),
    leaveSeconds: num(r.leaveSeconds, DEFAULTS.leaveSeconds),
    color: typeof r.color === 'string' ? r.color : DEFAULTS.color,
  };
}

/** Hachage stable de deux entiers vers [0, 1[ (même brume chez les deux joueurs). */
function unit(index: number, salt: number): number {
  let h = (Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 11, 0x85ebca6b)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 2 ** 32;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Nappe basse (dense, au ras de l'eau) ou haute (légère, jusqu'au sommet). */
interface Puff {
  x0: number;
  y: number;
  low: boolean;
  size: number;
  alpha: number;
  phase: number;
}

/** Ce que le moment demande à la brume à cette image. */
export interface MistState {
  /** `waiting`, `climax` (front qui se lève), `left` (dissipée sur place), ou éteinte (`off`). */
  phase: 'waiting' | 'climax' | 'left' | 'off';
  /** Secondes depuis le début de l'apogée ou du départ. */
  t: number;
}

/**
 * Rayon des bouffées basses et hautes (m). Petites, et posées assez haut pour que leur bas (tourné
 * vers la caméra, `BILLBOARD_DROP` fois le rayon plus bas que le centre) ne rentre ni dans l'eau ni
 * dans la berge: sans tampon de profondeur, une bouffée coupée par le sol montre un bord net.
 */
const LOW_SIZE = 0.55;
const HIGH_SIZE = 0.8;
/** Caméra inclinée de 35°: le bas d'un carré tourné vers elle est 0,82 rayon plus bas, 0,57 plus près. */
const BILLBOARD_DROP = 0.84;
const BILLBOARD_NEAR = 0.4;
/** Part des bouffées basses (le gros de l'opacité près de l'eau). */
const LOW_SHARE = 0.75;
/** Opacité d'une bouffée: plusieurs se recouvrent pour atteindre l'opacité de la fiche. */
const LOW_ALPHA = 0.34;
const HIGH_ALPHA = 0.13;
/** Montée des fondus d'apparition (s). */
const APPEAR_SECONDS = 3;
const STILL_GROUP = 2;
const MAX_TRIES = 40;

export class MistBank {
  readonly mesh: Mesh;
  private readonly buffers: ParticleBuffers;
  private readonly uniforms: ParticleUniforms;
  private readonly settings: MistSettings;
  private readonly puffs: Puff[] = [];
  private readonly color: Color;
  private level = 0;

  constructor(
    def: MomentDef,
    private readonly map: GameMap,
    private readonly terrain: Terrain,
    light: boolean,
    resources: ResourceTracker,
  ) {
    const s = mistSettings(def);
    this.settings = s;
    this.color = new Color(s.color);
    const wanted = Math.max(1, Math.round(light ? s.puffsLight : s.puffs));
    for (let i = 0; i < wanted; i += 1) {
      // Une place sur l'eau ou la berge (jamais au nord de `northLimitY`), tirée jusqu'à trouver.
      let x = s.fromX;
      let y = s.northLimitY;
      for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
        x = s.fromX + unit(i, attempt * 2) * (s.toX - s.fromX);
        y = s.northLimitY + unit(i, attempt * 2 + 1) * (s.southLimitY - s.northLimitY);
        if (this.cover(x, y) > 0) break;
      }
      const low = unit(i, 97) < LOW_SHARE;
      this.puffs.push({
        x0: x,
        y,
        low,
        size: (low ? LOW_SIZE : HIGH_SIZE) * (0.8 + 0.4 * unit(i, 101)),
        alpha: low ? LOW_ALPHA : HIGH_ALPHA,
        phase: unit(i, 103) * Math.PI * 2,
      });
    }
    // Le programme des particules lit un champ du terrain; les sprites posés ne s'en servent pas.
    const field = resources.track(new DataTexture(new Uint8Array(4), 1, 1, RGBAFormat));
    field.needsUpdate = true;
    const material = createParticleMaterial(
      PARTICLE_MODE.sprites,
      { texture: field, rect: new Vector4(), height: new Vector2() },
      resources,
    );
    this.uniforms = material.uniforms;
    const built = createParticleMesh(
      'brume de l’Aubrune',
      this.puffs.length,
      material,
      resources,
      true,
    );
    this.mesh = built.mesh;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
    this.buffers = built.buffers;
    this.uniforms.uGroupAlpha.value.set(0, 0, 1, 0);
    for (let i = 0; i < this.puffs.length; i += 1) {
      this.buffers.accel.setXYZW(i, 0, 0, 0, STILL_GROUP);
      this.buffers.velocity.setXYZW(i, 0, 0, 0, 0);
    }
    this.buffers.accel.needsUpdate = true;
    this.buffers.velocity.needsUpdate = true;
  }

  /** Part de l'opacité de la fiche à cet endroit: 1 sur l'eau, `bankOpacity / waterOpacity` sur la berge, 0 ailleurs. */
  private cover(x: number, y: number): number {
    const s = this.settings;
    if (y < s.northLimitY || y > s.southLimitY || x < s.fromX || x > s.toX) return 0;
    if (this.terrain.waterLevelAt(x, y) !== null) return 1;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= this.map.width || cy >= this.map.height) return 0;
    // Berge basse (sable et galets, au ras de l'eau): la brume y déborde, légère.
    return this.terrain.heightAt(x, y) < 0.05 ? s.bankOpacity / Math.max(0.01, s.waterOpacity) : 0;
  }

  /** Surface sous un point: l'eau dessinée, sinon le sol. */
  private surface(x: number, y: number): number {
    return this.terrain.waterLevelAt(x, y) ?? this.terrain.heightAt(x, y);
  }

  update(
    state: MistState,
    time: number,
    reducedMotion: boolean,
    lit: Color,
    shade: Color,
    lightView: Vector3,
  ): void {
    const s = this.settings;
    // Elle apparaît doucement quand le moment s'installe, se dissipe au rythme du départ, et
    // s'éteint d'un coup quand le moment n'est plus là (`off`, rien à l'écran).
    let target = 0;
    if (state.phase === 'waiting') target = Math.min(1, state.t / APPEAR_SECONDS);
    else if (state.phase === 'climax') target = 1;
    else if (state.phase === 'left')
      target = Math.max(0, 1 - state.t / Math.max(0.1, s.leaveSeconds));
    this.level = target;
    this.mesh.visible = this.level > 0.001;
    if (!this.mesh.visible) return;
    const u = this.uniforms;
    u.uTime.value = time;
    u.uLitColor.value.copy(lit);
    u.uShadeColor.value.copy(shade);
    u.uLightView.value.copy(lightView);
    const span = s.toX - s.fromX;
    const front =
      state.phase === 'climax'
        ? s.frontFrom - s.frontSpeed * Math.max(0, state.t - s.frontStart)
        : Number.POSITIVE_INFINITY;
    const drift = reducedMotion ? 0 : s.drift * time;
    const b = this.buffers;
    for (let i = 0; i < this.puffs.length; i += 1) {
      const p = this.puffs[i];
      if (p === undefined) continue;
      // Dérive vers l'aval (+x), comme le courant, enroulée sur la longueur du banc.
      const x = s.fromX + ((((p.x0 - s.fromX + drift) % span) + span) % span);
      const ends =
        smoothstep(s.fromX, s.fromX + s.fadeEnd, x) * (1 - smoothstep(s.toX - s.fadeEnd, s.toX, x));
      let alpha = p.alpha * this.cover(x, p.y) * ends * this.level;
      const water = this.terrain.waterLevelAt(x, p.y) ?? this.terrain.heightAt(x, p.y);
      const breathe = 1 + 0.08 * Math.sin(time * 0.4 + p.phase);
      let size = p.size * breathe;
      // Le plus haut du sol sous la bouffée et sous son bas (côté caméra): elle flotte au-dessus.
      const under = Math.max(
        water,
        this.surface(x, p.y),
        this.surface(x + size * BILLBOARD_NEAR, p.y + size * BILLBOARD_NEAR),
      );
      let z = p.low
        ? under + size * BILLBOARD_DROP
        : Math.max(under + size * BILLBOARD_DROP, water + s.top - size * BILLBOARD_DROP);
      let px = x;
      if (front !== Number.POSITIVE_INFINITY) {
        // À l'est du front, la brume s'est levée: elle monte en volutes, grandit et s'efface.
        const lift = smoothstep(0, s.frontWidth, x - front);
        alpha *= 1 - lift;
        z += lift * s.plumeHeight * (p.low ? 0.6 : 0.9);
        size *= 1 + lift * 0.8;
        px += lift * 0.6;
      }
      b.origin.setXYZW(i, px, z, p.y, p.phase);
      b.size.setXYZW(i, size, size, PARTICLE_SHAPE.puff, p.phase);
      b.color.setXYZW(i, this.color.r, this.color.g, this.color.b, alpha);
    }
    b.origin.needsUpdate = true;
    b.size.needsUpdate = true;
    b.color.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
  }
}
