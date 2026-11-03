/**
 * La brume de l'Aubrune (moment `mist`, conception du tour 7, fiche 1.4.9): un banc de brume au
 * ras de l'eau, épais sur la rivière et léger sur les berges, qui dérive avec le courant; à
 * l'apogée, il se lève en un front qui part de l'aval vers le gué, avec des volutes qui montent.
 *
 * La nappe est faite de larges bouffées couchées à plat au ras de l'eau, étirées dans le sens du
 * courant (aucune ne montre son bord, aucun « coton »), sous quelques bouffées dressées qui
 * donnent son épaisseur et font les volutes du front. Elle est plus claire que ce qu'elle voile
 * (revue du directeur artistique, tour 7): une part de lumière propre, celle du ciel diffusé, qui
 * suit la teinte dorée de l'apogée.
 *
 * Coût: des bouffées douces du programme des particules (`particules.ts`, forme `puff`, sprites
 * posés du groupe 2), toutes dans un seul maillage instancié: un appel de dessin, aucun programme
 * de plus. Le processeur réécrit leurs positions à chaque image (au plus `puffs` instances, sans
 * allocation); en mode léger, `puffsLight` seulement.
 */
import { Color, DataTexture, RGBAFormat, Vector2, Vector4, type Mesh, type Vector3 } from 'three';
import type { MomentDef } from '../donnees/types';
import { type GameMap, inMap } from '../etat/carte';
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
  /** Opacité de la nappe au-dessus de l'eau (toutes bouffées couchées confondues). */
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
  /** Part de lumière propre de la nappe (0: éclairée comme un volume, 1: sa seule couleur claire). */
  selfLight: number;
  /** Éclat de cette lumière propre (multiplie la couleur, avant le tone mapping). */
  glow: number;
  /** La nappe prend la teinte dorée de l'apogée (`climax.lightGrade`) à tant de fois sa force. */
  gradeFollow: number;
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
  selfLight: 0.85,
  glow: 1.5,
  gradeFollow: 1.4,
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
    selfLight: num(r.selfLight, DEFAULTS.selfLight),
    glow: num(r.glow, DEFAULTS.glow),
    gradeFollow: num(r.gradeFollow, DEFAULTS.gradeFollow),
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

/** Nappe basse (couchée à plat, au ras de l'eau) ou haute (dressée, légère, jusqu'au sommet). */
interface Puff {
  x0: number;
  y: number;
  low: boolean;
  /** Demi-longueur (dans le sens du courant pour une nappe basse) et demi-largeur (m). */
  size: number;
  width: number;
  /** Hauteur de la nappe basse au-dessus de ce qu'elle couvre (m): plusieurs couches. */
  lift: number;
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
 * Nappes basses: couchées à plat, deux fois plus longues (sens du courant, x) que larges, de 2 à
 * 3,2 m de long. Elles flottent au-dessus du plus haut de l'eau et de la berge sous leur
 * centre et leurs quatre coins: le sol ne les coupe jamais d'un bord net.
 */
const LOW_LENGTH = 1;
const LOW_LENGTH_SPREAD = 0.6;
const LOW_ASPECT = 0.5;
const LOW_LIFT = 0.06;
const LOW_LIFT_SPREAD = 0.35;
/**
 * Rayon des bouffées hautes (m), dressées face à la caméra, et posées assez haut pour que leur bas
 * (`BILLBOARD_DROP` fois le rayon plus bas que le centre) ne rentre ni dans l'eau ni dans la berge.
 */
const HIGH_SIZE = 0.8;
/** Caméra inclinée de 35°: le bas d'un carré tourné vers elle est 0,82 rayon plus bas, 0,57 plus près. */
const BILLBOARD_DROP = 0.84;
const BILLBOARD_NEAR = 0.4;
/** Part des bouffées basses (le gros de l'opacité près de l'eau). */
const LOW_SHARE = 0.75;
const HIGH_ALPHA = 0.13;
/**
 * Opacité moyenne du profil d'une bouffée (`smoothstep(1, 0.25, r)` sur son carré): sert à régler
 * l'opacité d'une nappe pour que leur empilement donne `waterOpacity` en moyenne sur l'eau.
 */
const PROFILE_MEAN = 0.33;
const COVER_SAMPLES = 24;
/** Bord de l'eau cherché à ces parts de la demi-largeur d'une nappe; elle garde au moins `EDGE_MIN`. */
const EDGE_STEPS: readonly number[] = [0.4, 0.7, 1];
const EDGE_MIN = 0.4;
/** Tremblement des places sur la grille des nappes basses (part d'une maille). */
const GRID_JITTER = 0.5;
/**
 * Mode léger: les nappes grandissent comme la racine du rapport des nombres, un peu moins (part
 * ci-dessous). Avec 160 bouffées au lieu de 400, elles couvrent les trois quarts de la surface du
 * mode normal, donc à peu près les trois quarts de son remplissage.
 */
const LIGHT_SPREAD = 0.85;
/** Réglage par instance du mode sprites (`aAccel.x`): couché à plat, ou face à la caméra. */
const LYING = 1;
const STANDING = 0;
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
  private readonly selfColor = new Color();
  private level = 0;
  /** Opacité d'une nappe basse sur la berge, rapportée à celle sur l'eau. */
  private bankScale = 1;

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
    // Les nappes basses sur une grille tremblée (un banc continu, sans trous ni amas), les hautes
    // au hasard sur l'eau ou la berge (jamais au nord de `northLimitY`).
    const spots = this.lowSpots(Math.round(wanted * LOW_SHARE));
    // Moins de nappes (mode léger): plus grandes, sinon la grille se voit en taches régulières.
    const spread = Math.max(1, Math.sqrt(s.puffs / wanted) * LIGHT_SPREAD);
    for (let i = 0; i < wanted; i += 1) {
      const spot = spots[i];
      const low = spot !== undefined;
      let x = spot?.x ?? s.fromX;
      let y = spot?.y ?? s.northLimitY;
      for (let attempt = 0; !low && attempt < MAX_TRIES; attempt += 1) {
        x = s.fromX + unit(i, attempt * 2) * (s.toX - s.fromX);
        y = s.northLimitY + unit(i, attempt * 2 + 1) * (s.southLimitY - s.northLimitY);
        if (this.cover(x, y) > 0) break;
      }
      const size = low
        ? (LOW_LENGTH + LOW_LENGTH_SPREAD * unit(i, 101)) * spread
        : HIGH_SIZE * (0.8 + 0.4 * unit(i, 101));
      this.puffs.push({
        x0: x,
        y,
        low,
        size,
        width: low ? size * LOW_ASPECT : size,
        lift: LOW_LIFT + LOW_LIFT_SPREAD * unit(i, 105),
        alpha: HIGH_ALPHA,
        phase: unit(i, 103) * Math.PI * 2,
      });
    }
    // Opacité d'une nappe basse: leur empilement moyen au-dessus de l'eau donne `waterOpacity`.
    const layers = this.layers();
    const stacked = (opacity: number): number => 1 - Math.pow(1 - Math.min(0.95, opacity), 1 / Math.max(1, layers));
    const lowAlpha = stacked(s.waterOpacity);
    this.bankScale = stacked(s.bankOpacity) / Math.max(1e-3, lowAlpha);
    for (const p of this.puffs) if (p.low) p.alpha = lowAlpha;
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
      const lying = this.puffs[i]?.low === true ? LYING : STANDING;
      this.buffers.accel.setXYZW(i, lying, 0, 0, STILL_GROUP);
      this.buffers.velocity.setXYZW(i, 0, 0, 0, 0);
    }
    this.buffers.accel.needsUpdate = true;
    this.buffers.velocity.needsUpdate = true;
  }

  /** Surface (m²) où la brume se pose: l'eau et la berge basse entre ses limites. */
  private coveredArea(): number {
    const s = this.settings;
    let covered = 0;
    for (let i = 0; i < COVER_SAMPLES; i += 1) {
      for (let j = 0; j < COVER_SAMPLES; j += 1) {
        const x = s.fromX + ((i + 0.5) / COVER_SAMPLES) * (s.toX - s.fromX);
        const y = s.northLimitY + ((j + 0.5) / COVER_SAMPLES) * (s.southLimitY - s.northLimitY);
        covered += this.cover(x, y) > 0 ? 1 : 0;
      }
    }
    const box = (s.toX - s.fromX) * (s.southLimitY - s.northLimitY);
    return (covered / (COVER_SAMPLES * COVER_SAMPLES)) * box;
  }

  /**
   * Au plus `count` places des nappes basses: une grille tremblée sur la surface couverte, mailles
   * deux fois plus longues que larges comme les nappes, gardées si la brume s'y pose.
   */
  private lowSpots(count: number): { x: number; y: number }[] {
    const s = this.settings;
    const area = this.coveredArea();
    if (count <= 0 || area <= 0) return [];
    const cell = Math.sqrt(area / count);
    const stepX = cell * Math.SQRT2;
    const stepY = cell / Math.SQRT2;
    const found: { x: number; y: number }[] = [];
    let index = 0;
    for (let y = s.northLimitY + stepY / 2; y < s.southLimitY; y += stepY) {
      for (let x = s.fromX + stepX / 2; x < s.toX; x += stepX) {
        index += 1;
        const px = x + (unit(index, 211) - 0.5) * stepX * GRID_JITTER;
        const py = y + (unit(index, 223) - 0.5) * stepY * GRID_JITTER;
        if (this.cover(px, py) > 0) found.push({ x: px, y: py });
      }
    }
    if (found.length <= count) return found;
    // Trop de places: on en garde `count`, réparties sur toute la longueur.
    const kept: { x: number; y: number }[] = [];
    for (let k = 0; k < count; k += 1) {
      const spot = found[Math.floor((k * found.length) / count)];
      if (spot !== undefined) kept.push(spot);
    }
    return kept;
  }

  /** Nombre moyen de nappes basses (pondérées par leur profil) au-dessus d'un point couvert. */
  private layers(): number {
    const area = this.coveredArea();
    let footprint = 0;
    for (const p of this.puffs) if (p.low) footprint += 4 * p.size * p.width * PROFILE_MEAN;
    return area > 0 ? footprint / area : 1;
  }

  /** Part de l'opacité de la fiche à cet endroit: 1 sur l'eau, `bankOpacity / waterOpacity` sur la berge, 0 ailleurs. */
  private cover(x: number, y: number): number {
    const s = this.settings;
    if (y < s.northLimitY || y > s.southLimitY || x < s.fromX || x > s.toX) return 0;
    if (this.terrain.waterLevelAt(x, y) !== null) return 1;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (!inMap(this.map, cx, cy)) return 0;
    // Berge basse (sable et galets, au ras de l'eau): la brume y déborde, légère.
    return this.terrain.heightAt(x, y) < 0.05 ? s.bankOpacity / Math.max(0.01, s.waterOpacity) : 0;
  }

  /** Part de `toward` (décalage en y, m) qu'on parcourt depuis ce point avant de quitter l'eau. */
  private reach(x: number, y: number, toward: number): number {
    for (const k of EDGE_STEPS) {
      if (this.terrain.waterLevelAt(x, y + toward * k) === null) return Math.max(EDGE_MIN, k);
    }
    return 1;
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
    grade: Color,
    gradeAmount: number,
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
    // Lumière propre: blanche à l'aube, crème pêche quand la teinte dorée de l'apogée monte.
    const follow = Math.min(1, gradeAmount * s.gradeFollow);
    this.selfColor.setRGB(1, 1, 1).lerp(grade, follow).multiplyScalar(s.glow);
    u.uSelfLight.value.set(this.selfColor.r, this.selfColor.g, this.selfColor.b, s.selfLight);
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
      const cover = this.cover(x, p.y);
      const place = p.low && cover > 0 && cover < 1 ? this.bankScale : cover;
      let alpha = p.alpha * place * ends * this.level;
      const water = this.terrain.waterLevelAt(x, p.y) ?? this.terrain.heightAt(x, p.y);
      const breathe = 1 + 0.08 * Math.sin(time * 0.4 + p.phase);
      let size = p.size * breathe;
      let width = p.width * breathe;
      let z: number;
      if (p.low) {
        // Sur l'eau, la nappe ne déborde pas sur la berge (légère, elle): elle s'amincit vers le bord.
        if (this.terrain.waterLevelAt(x, p.y) !== null) width *= Math.min(this.reach(x, p.y, -width), this.reach(x, p.y, width));
        const w = width;
        // Le plus haut de l'eau et de la berge sous la nappe couchée (centre et coins).
        const under = Math.max(
          water,
          this.surface(x - size, p.y - w),
          this.surface(x + size, p.y - w),
          this.surface(x - size, p.y + w),
          this.surface(x + size, p.y + w),
        );
        z = under + p.lift;
      } else {
        // Le plus haut du sol sous la bouffée et sous son bas (côté caméra): elle flotte au-dessus.
        const under = Math.max(
          water,
          this.surface(x, p.y),
          this.surface(x + size * BILLBOARD_NEAR, p.y + size * BILLBOARD_NEAR),
        );
        z = Math.max(under + size * BILLBOARD_DROP, water + s.top - size * BILLBOARD_DROP);
      }
      let px = x;
      if (front !== Number.POSITIVE_INFINITY) {
        // À l'est du front, la brume s'est levée: elle monte en volutes, grandit et s'efface.
        const lift = smoothstep(0, s.frontWidth, x - front);
        alpha *= 1 - lift;
        z += lift * s.plumeHeight * (p.low ? 0.6 : 0.9);
        size *= 1 + lift * 0.8;
        width *= 1 + lift * 0.8;
        px += lift * 0.6;
      }
      b.origin.setXYZW(i, px, z, p.y, p.phase);
      b.size.setXYZW(i, size, width, PARTICLE_SHAPE.puff, p.phase);
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
