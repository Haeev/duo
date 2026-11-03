/**
 * L'eau qui se lit (pêche de la 0.12, tâches R1 à R3 de `peche-0-12-conception.md`):
 *
 * - les ombres des poissons, posées par la simulation (`FishingView.shadows`): un seul maillage
 *   instancié du programme des particules (forme `fish`, carrés couchés et tournés), donc un appel
 *   de dessin et aucun programme de plus. Taille selon l'espèce, nage selon la rareté (5.2) autour
 *   du point de la simulation, approche et attente sous le bouchon, fuite, fondus; la nuit, un
 *   sillage clair les dessine; sous la pluie, elles se floutent;
 * - le guet (7.2), chez le seul guetteur: éclats des rares et des épiques, reflet bronze des
 *   légendaires, mythiques visibles avec leur lueur;
 * - les signes du coin qui frémit (6.2), sans icône: ronds de gobage, bulles des eaux calmes,
 *   hirondelles au ras de l'eau ou bergeronnette sur la berge. Ronds, bulles et éclats sont des
 *   bouffées du même programme (un appel quand l'une vit); les oiseaux, un petit maillage
 *   instancié du programme des semis.
 *
 * Décor seulement: le hasard des signes vient d'une suite locale, jamais de la simulation.
 */
import {
  Color,
  DataTexture,
  Euler,
  Group,
  Matrix4,
  Quaternion,
  RGBAFormat,
  Vector2,
  Vector3,
  Vector4,
  type InstancedBufferAttribute,
  type InstancedBufferGeometry,
  type InstancedMesh,
  type Mesh,
} from 'three';
import { seasonOfDay } from '../donnees/calendrier';
import type { Content } from '../donnees/types';
import type { GameMap } from '../etat/carte';
import type { ReadonlyWorld, WorldEvent } from '../etat/types';
import type { FrameContext } from './contexte';
import { dampAngle, yawFromFacing } from './contexte';
import { ShapeBuilder } from './geometrie';
import { createInstanced, finishInstances } from './instances';
import type { DaylightRig } from './lumiere';
import type { SharedMaterials } from './materiaux';
import type { EventfulPart } from './monde';
import {
  PARTICLE_MODE,
  PARTICLE_SHAPE,
  PuffPool,
  createParticleMaterial,
  createParticleMesh,
  type ParticleBuffers,
  type ParticleUniforms,
} from './particules';
import type {
  FishRarity,
  FishShadowView,
  FishingSource,
  FishingView,
  ShadowPhase,
} from './peche-vue';
import { FISHING_RENDER as R } from './reglages-peche';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

const SHADOW_CAPACITY = 48;
/** Une ombre et, chez le guetteur, une lueur couchée sous elle. */
const SPRITE_CAPACITY = SHADOW_CAPACITY * 2;
const NO_SHADOWS: readonly FishShadowView[] = [];
/** Une ombre qui disparaît de sous un bouchon peu après un ferrage manqué a filé (s). */
const ESCAPE_WINDOW = 0.5;
/** Vers le bouchon, l'ombre rattrape l'ancre un peu plus vite qu'elle (pas de 30 par seconde). */
const CATCH_UP = 1.5;
const SIGN_CAPACITY = 128;
/** Groupe des sprites sans mouvement propre (celui des halos), couché, tourné. */
const GROUP_STILL = 2;
const LYING = 1;
const TURNED = 1;
const LAMBERT = Math.PI;
const TWO_PI = Math.PI * 2;
const CAUGHT_FADE = 0.25;
const WATCH_FADE_RATE = 4;
const HEAD_SHARE = 0.3;
const GLINT_LIFT = 0.04;
const SIGN_LIFT = 0.015;
const PICK_TRIES = 8;
const CELL_INSET = 0.4;
const MIN_DEPTH = 0.05;
const SHORE_PROBE = 0.35;
const SWALLOW_GAP_SECONDS = 0.35;
const SWALLOW_GAP_SIDE = 0.6;
const WAGTAIL_ARRIVE = 4;

/** Une ombre suivie par le rendu: sa place montrée, sa nage, ses fondus. */
interface Track {
  readonly id: number;
  species: string;
  rarity: FishRarity;
  length: number;
  /** Rayon de nage autour de l'ancre (le plus petit de la simulation et de la rareté). */
  roam: number;
  watchOnly: boolean;
  x: number;
  y: number;
  heading: number;
  speed: number;
  anchorX: number;
  anchorY: number;
  phase: ShadowPhase;
  phaseSince: number;
  targetX: number;
  targetY: number;
  hasTarget: boolean;
  goalX: number;
  goalY: number;
  moving: boolean;
  pauseUntil: number;
  born: number;
  /** Instant où la simulation l'a retirée, et pourquoi: prise, fuite ou fin de vie. */
  gone: number | null;
  goneAs: 'caught' | 'flee' | 'leave';
  seed: number;
  nextGlint: number;
  glintFlip: boolean;
  stamp: number;
}

/** Un coin de pêche préparé pour les signes: ses points d'eau, sa berge, son étendue. */
interface ZoneSigns {
  readonly id: string;
  readonly water: readonly Vector2[];
  readonly bank: readonly Vector3[];
  readonly calm: boolean;
  /** Le coin s'étire le long de x (rivière) ou de y (ru): sens de vol des hirondelles. */
  readonly alongX: boolean;
  readonly min: Vector2;
  readonly max: Vector2;
  nextBubbles: number;
  nextBird: number;
}

interface Swallow {
  start: number;
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  seed: number;
  dipped: boolean;
}

interface Wagtail {
  start: number;
  ends: number;
  x: number;
  y: number;
  facing: number;
  nextHop: number;
  hopFrom: Vector2;
  hopTo: Vector2;
  hopStart: number;
  fromX: number;
  fromY: number;
}

function rangeOf(range: readonly [number, number], t: number): number {
  return range[0] + (range[1] - range[0]) * t;
}

function smooth(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Hirondelle rustique vue d'en haut: dos bleu nuit, ailes en faux, queue fourchue (avant +Z). */
function swallowGeometry(): ShapeBuilder {
  return new ShapeBuilder()
    .ball(
      0.035,
      [0, 0, 0.02],
      { top: 'tit_blue', side: 'tit_blue', bottom: 'feather_white' },
      { scale: [0.8, 0.7, 1.9] },
    )
    .ball(0.022, [0, 0.005, 0.075], { top: 'tit_blue', side: 'goose_bill', bottom: 'goose_bill' })
    .box([0.17, 0.006, 0.04], [0.085, 0, 0.0], 'black', { rotation: [0, -18, 0] })
    .box([0.17, 0.006, 0.04], [-0.085, 0, 0.0], 'black', { rotation: [0, 18, 0] })
    .box([0.012, 0.004, 0.09], [0.02, 0, -0.08], 'black', { rotation: [0, -10, 0] })
    .box([0.012, 0.004, 0.09], [-0.02, 0, -0.08], 'black', { rotation: [0, 10, 0] });
}

/** Bergeronnette grise: dos gris, bavette noire, face blanche, longue queue noire (avant +Z). */
function wagtailGeometry(): ShapeBuilder {
  return new ShapeBuilder()
    .ball(
      0.035,
      [0, 0.07, 0],
      { top: 'heron_grey', side: 'heron_grey', bottom: 'feather_white' },
      { scale: [0.85, 0.85, 1.5] },
    )
    .ball(0.024, [0, 0.1, 0.05], { top: 'black', side: 'feather_white', bottom: 'black' })
    .box([0.006, 0.004, 0.012], [0, 0.098, 0.075], 'black')
    .box([0.02, 0.006, 0.1], [0, 0.075, -0.085], 'black', { rotation: [-12, 0, 0] })
    .box([0.004, 0.06, 0.004], [0.012, 0.03, 0], 'heron_leg')
    .box([0.004, 0.06, 0.004], [-0.012, 0.03, 0], 'heron_leg');
}

export class FishShadowsPart implements EventfulPart {
  readonly group = new Group();
  private readonly sprites: Mesh;
  private readonly spriteGeometry: InstancedBufferGeometry;
  private readonly buffers: ParticleBuffers;
  private readonly material: ReturnType<typeof createParticleMaterial>;
  private readonly signs: PuffPool;
  private readonly swallowMesh: InstancedMesh;
  private readonly wagtailMesh: InstancedMesh;
  private readonly tracks = new Map<number, Track>();
  private readonly zones: ZoneSigns[];
  private readonly shadowColor = new Color(R.shadowColor);
  private readonly ringColor = new Color(R.rings.color);
  private readonly bubbleColor = new Color(R.bubbles.color);
  private readonly rareColor = new Color(R.glint.rare.color);
  private readonly epicColor = new Color(R.glint.epic.color);
  private readonly epicAltColor = new Color(R.glint.epic.altColor);
  private readonly bronzeColor = new Color(R.bronze.color);
  private readonly mythicColors = new Map<string, Color>();
  private readonly mythicFallback = new Color(R.mythicGlow.fallback);
  private readonly lit = new Color();
  private readonly shade = new Color();
  private readonly swallows: Swallow[] = [];
  private wagtail: Wagtail | null = null;
  private readonly matrix = new Matrix4();
  private readonly quat = new Quaternion();
  private readonly euler = new Euler();
  private readonly pos = new Vector3();
  private readonly scale = new Vector3();
  private readonly spot = new Vector2();
  private stamp = 0;
  private time = 0;
  private seed = 0x9e3779b9;
  private watchFade = 0;
  private nextElsewhereRing = 0;
  private hotRingAt = 0;
  private lastHot: string | null = null;
  private escapedAt = Number.NEGATIVE_INFINITY;

  constructor(
    map: GameMap,
    private readonly content: Content,
    materials: SharedMaterials,
    private readonly terrain: Terrain,
    resources: ResourceTracker,
    private readonly source: FishingSource,
    private readonly daylight: DaylightRig | null,
  ) {
    this.group.name = 'ombres des poissons';
    const field = resources.track(new DataTexture(new Uint8Array(4), 1, 1, RGBAFormat));
    field.needsUpdate = true;
    const dummy = { texture: field, rect: new Vector4(), height: new Vector2() };
    this.material = createParticleMaterial(PARTICLE_MODE.sprites, dummy, resources);
    this.material.uniforms.uGroupAlpha.value.set(1, 1, 1, 1);
    const built = createParticleMesh(
      'ombres des poissons',
      SPRITE_CAPACITY,
      this.material,
      resources,
      true,
    );
    this.sprites = built.mesh;
    this.spriteGeometry = built.geometry;
    this.buffers = built.buffers;
    built.geometry.instanceCount = 0;
    // Après l'eau (ordre 1), avant la ligne et les ronds.
    this.sprites.renderOrder = 2;
    this.sprites.visible = false;
    this.signs = new PuffPool(
      SIGN_CAPACITY,
      createParticleMaterial(PARTICLE_MODE.puffs, dummy, resources),
      resources,
    );
    this.signs.mesh.name = 'signes de l’eau';
    this.signs.mesh.renderOrder = 3;
    this.swallowMesh = createInstanced(
      'hirondelles',
      resources.track(swallowGeometry().build()),
      materials.palette,
      R.birds.swallow.count,
    );
    this.wagtailMesh = createInstanced(
      'bergeronnette',
      resources.track(wagtailGeometry().build()),
      materials.palette,
      1,
    );
    for (const mesh of [this.swallowMesh, this.wagtailMesh]) {
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.visible = false;
    }
    // Une hirondelle à 1 m au-dessus de l'eau n'a pas d'ombre lisible; la bergeronnette, posée, si.
    this.swallowMesh.castShadow = false;
    this.group.add(this.sprites, this.signs.mesh, this.swallowMesh, this.wagtailMesh);
    for (const [species, color] of Object.entries(R.mythicGlow)) {
      if (typeof color === 'string') this.mythicColors.set(species, new Color(color));
    }
    this.zones = source.zones(map).map((zone) => this.prepareZone(zone.id, zone.rects));
  }

  private random(): number {
    // Suite xorshift locale (décor seulement).
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 4294967296;
  }

  private prepareZone(id: string, rects: FishZoneRects): ZoneSigns {
    const water: Vector2[] = [];
    const bank: Vector3[] = [];
    const seen = new Set<string>();
    const min = new Vector2(Infinity, Infinity);
    const max = new Vector2(-Infinity, -Infinity);
    for (const r of rects) {
      for (let cy = r.y0; cy <= r.y1; cy += 1) {
        for (let cx = r.x0; cx <= r.x1; cx += 1) {
          const x = cx + 0.5;
          const y = cy + 0.5;
          if (this.terrain.waterLevelAt(x, y) === null) continue;
          water.push(new Vector2(x, y));
          min.min(this.spot.set(cx, cy));
          max.max(this.spot.set(cx + 1, cy + 1));
          for (const [nx, ny] of [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1],
          ] as const) {
            const key = `${nx}:${ny}`;
            if (seen.has(key) || this.terrain.waterLevelAt(nx + 0.5, ny + 0.5) !== null) continue;
            seen.add(key);
            // Sur la berge, à 30 cm de l'eau: là où une bergeronnette guette les insectes.
            const bx = nx + 0.5 + (cx - nx) * 0.2;
            const by = ny + 0.5 + (cy - ny) * 0.2;
            bank.push(new Vector3(bx, by, this.terrain.heightAt(bx, by)));
          }
        }
      }
    }
    return {
      id,
      water,
      bank,
      calm: (R.bubbles.zones as readonly string[]).includes(id),
      alongX: max.x - min.x >= max.y - min.y,
      min,
      max,
      nextBubbles: 0,
      nextBird: 0,
    };
  }

  /** Profondeur d'eau sous un point (m), `null` hors de l'eau; le ru n'a pas de lit dessiné. */
  private depthAt(x: number, y: number): number | null {
    const level = this.terrain.waterLevelAt(x, y);
    if (level === null) return null;
    const bed = this.terrain.river.bedAt(x, y);
    return bed === null ? 1 : level - bed;
  }

  /** Une ombre peut-elle passer là: de l'eau assez profonde, et pas contre la berge. */
  private swimmable(x: number, y: number): boolean {
    const depth = this.depthAt(x, y);
    if (depth === null || depth < MIN_DEPTH) return false;
    return (
      this.terrain.waterLevelAt(x + SHORE_PROBE, y) !== null &&
      this.terrain.waterLevelAt(x - SHORE_PROBE, y) !== null &&
      this.terrain.waterLevelAt(x, y + SHORE_PROBE) !== null &&
      this.terrain.waterLevelAt(x, y - SHORE_PROBE) !== null
    );
  }

  update(context: FrameContext): void {
    this.time = context.time;
    const view = this.source.view(context.world);
    this.updateLighting();
    const watching = view?.watchers.includes(context.local) === true;
    const k = 1 - Math.exp(-WATCH_FADE_RATE * context.dt);
    this.watchFade += ((watching ? 1 : 0) - this.watchFade) * k;
    if (this.watchFade < 1e-3) this.watchFade = 0;
    this.syncTracks(view);
    const local = context.world.characters.find((c) => c.id === context.local) ?? null;
    let count = 0;
    for (const track of this.tracks.values()) {
      if (!this.move(track, context.dt)) {
        this.tracks.delete(track.id);
        continue;
      }
      count = this.writeTrack(track, count, context, local === null ? null : local.pos);
    }
    this.spriteGeometry.instanceCount = count;
    this.sprites.visible = count > 0;
    if (count > 0) {
      for (const buffer of Object.values(this.buffers) as InstancedBufferAttribute[])
        buffer.needsUpdate = true;
    }
    this.material.uniforms.uTime.value = context.time;
    if (view !== null) this.updateSigns(view, context);
    this.updateBirds(context);
    this.signs.update(context.time);
  }

  private updateLighting(): void {
    const day = this.daylight;
    if (day === null) {
      this.lit.setRGB(1, 1, 1);
      this.shade.setRGB(0.6, 0.6, 0.6);
    } else {
      this.lit.copy(day.sun.color).multiplyScalar(day.sun.intensity * LAMBERT);
      this.shade.copy(day.hemi.color).multiplyScalar(day.hemi.intensity * LAMBERT);
    }
    this.shareLight(this.material.uniforms);
    this.shareLight(this.signs.material.uniforms);
  }

  private shareLight(u: ParticleUniforms): void {
    u.uLitColor.value.copy(this.lit);
    u.uShadeColor.value.copy(this.shade);
  }

  /** Un ferrage manqué: l'ombre qui attendait sous ce bouchon file au lieu de sortir de l'eau. */
  handleEvent(event: WorldEvent): void {
    if (event.type === 'escaped') this.escapedAt = this.time;
  }

  /** Relie les ombres de la simulation aux ombres suivies (nouvelles, changées, parties). */
  private syncTracks(view: FishingView | null): void {
    this.stamp += 1;
    for (const shadow of view?.shadows ?? NO_SHADOWS) {
      const track = this.tracks.get(shadow.id) ?? this.createTrack(shadow);
      this.follow(track, shadow);
      track.stamp = this.stamp;
    }
    for (const track of this.tracks.values()) {
      if (track.stamp === this.stamp || track.gone !== null) continue;
      track.gone = this.time;
      track.goneAs =
        track.phase === 'flee' ||
        (track.phase === 'under' && this.time - this.escapedAt < ESCAPE_WINDOW)
          ? 'flee'
          : track.phase === 'under'
            ? 'caught'
            : 'leave';
    }
  }

  private createTrack(shadow: FishShadowView): Track {
    const seed = ((Math.imul(shadow.id + 1, 2654435761) >>> 0) % 10007) / 10007;
    const track: Track = {
      id: shadow.id,
      species: shadow.species,
      rarity: shadow.rarity,
      length: R.sizes[shadow.size],
      roam: Math.min(R.swim[shadow.rarity].radius, shadow.roam),
      watchOnly: shadow.watchOnly,
      x: shadow.pos.x,
      y: shadow.pos.y,
      heading: shadow.heading,
      speed: 0,
      anchorX: shadow.pos.x,
      anchorY: shadow.pos.y,
      phase: shadow.phase,
      phaseSince: this.time,
      targetX: 0,
      targetY: 0,
      hasTarget: false,
      goalX: shadow.pos.x,
      goalY: shadow.pos.y,
      moving: false,
      pauseUntil: this.time + seed * 2,
      born: this.time,
      gone: null,
      goneAs: 'leave',
      seed,
      nextGlint: this.time + seed * 2,
      glintFlip: false,
      stamp: this.stamp,
    };
    this.tracks.set(shadow.id, track);
    return track;
  }

  private follow(track: Track, shadow: FishShadowView): void {
    // La simulation déplace son point: l'ombre montrée et son but suivent du même écart.
    const dx = shadow.pos.x - track.anchorX;
    const dy = shadow.pos.y - track.anchorY;
    track.anchorX = shadow.pos.x;
    track.anchorY = shadow.pos.y;
    // Vers un bouchon, l'ombre rejoint l'ancre à sa vitesse (cap vers le bouchon): pas d'écart à reporter.
    if (shadow.phase !== 'approach' && shadow.phase !== 'under') {
      track.x += dx;
      track.y += dy;
    }
    track.goalX += dx;
    track.goalY += dy;
    if (track.phase !== shadow.phase) {
      track.phase = shadow.phase;
      track.phaseSince = this.time;
      track.moving = false;
    }
    track.species = shadow.species;
    track.rarity = shadow.rarity;
    track.length = R.sizes[shadow.size];
    track.roam = Math.min(R.swim[shadow.rarity].radius, shadow.roam);
    track.watchOnly = shadow.watchOnly;
    track.hasTarget = shadow.target !== null;
    if (shadow.target !== null) {
      track.targetX = shadow.target.x;
      track.targetY = shadow.target.y;
    }
    track.gone = null;
  }

  /** Avance la nage d'une ombre; `false` quand elle a fini de s'effacer. */
  private move(track: Track, dt: number): boolean {
    const style = R.swim[track.rarity];
    const prevX = track.x;
    const prevY = track.y;
    if (track.gone !== null) {
      const t = this.time - track.gone;
      if (track.goneAs === 'caught') return t < CAUGHT_FADE;
      if (track.goneAs === 'flee') {
        this.dart(track, dt);
        this.turnToMotion(track, prevX, prevY, dt);
        return t < R.fleeSeconds;
      }
      return t < R.fadeSeconds;
    }
    if (track.phase === 'approach' || track.phase === 'under') {
      // L'ancre de la simulation va sous le bouchon; l'ombre la suit, la tête vers le bouchon, et
      // grignote une fois dessous. Sans bouchon connu, elle suit l'ancre.
      const nibble =
        track.phase === 'under' ? Math.sin(this.time * 5 + track.seed * 9) * R.underNibble : 0;
      let gx = track.anchorX;
      let gy = track.anchorY;
      if (track.hasTarget) {
        const back = track.length * HEAD_SHARE - nibble;
        const near =
          Math.hypot(track.targetX - track.anchorX, track.targetY - track.anchorY) < back * 1.5;
        if (near) {
          gx = track.targetX - Math.cos(track.heading) * back;
          gy = track.targetY - Math.sin(track.heading) * back;
        }
        const toward = Math.atan2(track.targetY - track.y, track.targetX - track.x);
        if (Math.hypot(track.targetX - track.x, track.targetY - track.y) > 0.05) {
          track.heading = dampAngle(track.heading, toward, 1 - Math.exp(-R.headingRate * dt));
        }
      }
      this.stepToward(track, gx, gy, R.approachSpeed * CATCH_UP, dt);
    } else if (track.phase === 'flee') {
      this.dart(track, dt);
    } else if (track.phase === 'free') {
      this.wander(track, style, dt);
    }
    if (track.phase !== 'approach' && track.phase !== 'under') {
      this.turnToMotion(track, prevX, prevY, dt);
    }
    track.speed = Math.hypot(track.x - prevX, track.y - prevY) / Math.max(dt, 1e-4);
    return true;
  }

  private dart(track: Track, dt: number): void {
    // Loin du bouchon, ou droit devant s'il n'y en a pas.
    const away = track.hasTarget
      ? Math.atan2(track.y - track.targetY, track.x - track.targetX)
      : track.heading;
    const nx = track.x + Math.cos(away) * R.fleeSpeed * dt;
    const ny = track.y + Math.sin(away) * R.fleeSpeed * dt;
    if (this.terrain.waterLevelAt(nx, ny) !== null) {
      track.x = nx;
      track.y = ny;
    }
  }

  private wander(track: Track, style: (typeof R.swim)[FishRarity], dt: number): void {
    if (!track.moving) {
      if (style.turnInPlace > 0) {
        track.heading += style.turnInPlace * dt * (track.seed > 0.5 ? 1 : -1);
      }
      if (this.time < track.pauseUntil) return;
      this.pickGoal(track, style);
      track.moving = true;
    }
    const remaining = Math.hypot(track.goalX - track.x, track.goalY - track.y);
    // Les communs partent d'un élan et freinent; les autres glissent.
    const ease = track.rarity === 'common' ? Math.min(1, 0.25 + remaining / style.reach[1]) : 1;
    if (this.stepToward(track, track.goalX, track.goalY, style.speed * ease, dt)) {
      track.moving = false;
      track.pauseUntil = this.time + rangeOf(style.pause, this.random());
    }
  }

  private pickGoal(track: Track, style: (typeof R.swim)[FishRarity]): void {
    for (let attempt = 0; attempt < PICK_TRIES; attempt += 1) {
      const turn =
        track.rarity === 'common'
          ? this.random() * TWO_PI
          : this.random() < style.uTurn
            ? track.heading + Math.PI + (this.random() - 0.5)
            : track.heading + (this.random() - 0.5) * 1.6;
      const reach = rangeOf(style.reach, this.random());
      let gx = track.x + Math.cos(turn) * reach;
      let gy = track.y + Math.sin(turn) * reach;
      const ox = gx - track.anchorX;
      const oy = gy - track.anchorY;
      const off = Math.hypot(ox, oy);
      if (off > track.roam) {
        gx = track.anchorX + (ox / Math.max(off, 1e-6)) * track.roam;
        gy = track.anchorY + (oy / Math.max(off, 1e-6)) * track.roam;
      }
      if (this.swimmable(gx, gy)) {
        track.goalX = gx;
        track.goalY = gy;
        return;
      }
    }
    track.goalX = track.anchorX;
    track.goalY = track.anchorY;
  }

  /** Avance vers un point sans dépasser `speed`; vrai une fois arrivé. */
  private stepToward(track: Track, gx: number, gy: number, speed: number, dt: number): boolean {
    const dx = gx - track.x;
    const dy = gy - track.y;
    const d = Math.hypot(dx, dy);
    const step = speed * dt;
    if (d <= step || d < 1e-3) {
      track.x = gx;
      track.y = gy;
      return true;
    }
    track.x += (dx / d) * step;
    track.y += (dy / d) * step;
    return false;
  }

  private turnToMotion(track: Track, prevX: number, prevY: number, dt: number): void {
    const dx = track.x - prevX;
    const dy = track.y - prevY;
    if (Math.hypot(dx, dy) / Math.max(dt, 1e-4) < R.stillSpeed) return;
    track.heading = dampAngle(track.heading, Math.atan2(dy, dx), 1 - Math.exp(-R.headingRate * dt));
  }

  /** Écrit l'ombre (et chez le guetteur sa lueur) dans les sprites; rend le nombre écrit. */
  private writeTrack(
    track: Track,
    index: number,
    context: FrameContext,
    local: { readonly x: number; readonly y: number } | null,
  ): number {
    if (index >= SPRITE_CAPACITY - 1) return index;
    const style = R.swim[track.rarity];
    const level = this.terrain.waterLevelAt(track.x, track.y);
    if (level === null) return index;
    let alpha = style.opacity;
    if (style.breathe !== null) {
      const [low, high, period] = style.breathe;
      alpha =
        low +
        (high - low) * (0.5 + 0.5 * Math.sin((this.time / period) * TWO_PI + track.seed * TWO_PI));
    }
    alpha *= smooth(0, R.fadeSeconds, this.time - track.born);
    let shrink = 1;
    if (track.gone !== null) {
      const t = this.time - track.gone;
      const span =
        track.goneAs === 'caught'
          ? CAUGHT_FADE
          : track.goneAs === 'flee'
            ? R.fleeSeconds
            : R.fadeSeconds;
      alpha *= 1 - smooth(0, span, t);
      if (track.goneAs === 'leave') shrink = 1 - R.leaveShrink * smooth(0, span, t);
    } else if (track.phase === 'leave') {
      const t = this.time - track.phaseSince;
      alpha *= 1 - smooth(0, R.fadeSeconds, t);
      shrink = 1 - R.leaveShrink * smooth(0, R.fadeSeconds, t);
    } else if (track.phase === 'flee') {
      alpha *= 1 - smooth(0, R.fleeSeconds, this.time - track.phaseSince);
    }
    const depth = this.depthAt(track.x, track.y) ?? 0;
    alpha *= smooth(R.shallowFade[0], R.shallowFade[1], depth);
    const watchedHere =
      this.watchFade > 0 &&
      local !== null &&
      Math.hypot(local.x - track.x, local.y - track.y) <= R.glintRadius;
    if (track.watchOnly) {
      // Invisible sauf pour le guetteur (7.2), où qu'elle soit.
      alpha *= this.watchFade;
    }
    const night = context.night;
    const rain = context.world.weather === 'rain';
    alpha *= 1 + (R.nightBodyOpacity - 1) * night;
    if (rain) alpha *= R.rainOpacity;
    if (alpha < 0.004) return index;
    const moving = Math.min(1, track.speed / R.approachSpeed);
    const wake =
      night * (R.wakeStill + (R.wakeMoving - R.wakeStill) * moving) * Math.min(1, alpha * 2);
    const length = track.length * shrink;
    const b = this.buffers;
    const c = this.shadowColor;
    b.origin.setXYZW(index, track.x, level + R.surfaceLift, track.y, track.seed);
    b.velocity.setXYZW(index, style.wiggle, track.heading, wake, rain ? R.rainBlur : 0);
    b.accel.setXYZW(index, LYING, 0, TURNED, GROUP_STILL);
    b.size.setXYZW(index, length, length * 0.5, PARTICLE_SHAPE.fish, 0);
    b.color.setXYZW(index, c.r, c.g, c.b, alpha);
    let count = index + 1;
    if (watchedHere || (track.watchOnly && this.watchFade > 0)) {
      count = this.writeGlow(track, count, level, alpha);
      this.glint(track, level);
    }
    return count;
  }

  /** Lueur couchée sous l'ombre, chez le guetteur: bronze des légendaires, lueur des mythiques. */
  private writeGlow(track: Track, index: number, level: number, alpha: number): number {
    let color: Color;
    let opacity: number;
    let pulse: number;
    if (track.rarity === 'legendary') {
      color = this.bronzeColor;
      opacity = R.bronze.opacity;
      pulse = R.bronze.pulse;
    } else if (track.rarity === 'mythic') {
      color = this.mythicColors.get(track.species) ?? this.mythicFallback;
      opacity = R.mythicGlow.opacity;
      pulse = R.mythicGlow.pulse;
    } else {
      return index;
    }
    const breathe = 0.75 + 0.25 * Math.sin((this.time / pulse) * TWO_PI + track.seed * TWO_PI);
    const strength = opacity * breathe * this.watchFade * Math.min(1, alpha * 2);
    const b = this.buffers;
    const length = track.length * (track.rarity === 'mythic' ? 0.8 : 0.5);
    b.origin.setXYZW(index, track.x, level + R.surfaceLift * 1.5, track.y, track.seed);
    b.velocity.setXYZW(index, 0, track.heading, 0, 0);
    b.accel.setXYZW(index, LYING, 0, TURNED, GROUP_STILL);
    b.size.setXYZW(
      index,
      length,
      length * (track.rarity === 'mythic' ? 0.45 : 0.22),
      PARTICLE_SHAPE.glow,
      0,
    );
    b.color.setXYZW(index, color.r, color.g, color.b, strength);
    return index + 1;
  }

  /** Éclats du guet: argent pour un rare, irisé vert-bleu pour un épique, à leur rythme. */
  private glint(track: Track, level: number): void {
    if (track.rarity !== 'rare' && track.rarity !== 'epic') return;
    if (this.time < track.nextGlint || track.gone !== null) return;
    const spec = track.rarity === 'rare' ? R.glint.rare : R.glint.epic;
    track.nextGlint = this.time + rangeOf(spec.every, this.random());
    const color =
      track.rarity === 'rare'
        ? this.rareColor
        : track.glintFlip
          ? this.epicAltColor
          : this.epicColor;
    track.glintFlip = !track.glintFlip;
    // Sur le flanc, un peu en avant du milieu: là où l'écaille attrape la lumière.
    const along = track.length * 0.1;
    const x = track.x + Math.cos(track.heading) * along;
    const y = track.y + Math.sin(track.heading) * along;
    for (const delay of [0, 0.12]) {
      this.signs.emit(
        {
          x,
          y: level + GLINT_LIFT,
          z: y,
          vx: 0,
          vy: 0,
          vz: 0,
          ax: 0,
          ay: 0,
          az: 0,
          drag: 1,
          life: spec.seconds,
          startSize: spec.size,
          endSize: spec.size * 1.2,
          shape: PARTICLE_SHAPE.star,
          color,
          opacity: spec.opacity,
        },
        this.time + delay,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Coin qui frémit

  private near(zone: ZoneSigns, world: ReadonlyWorld, radius: number): boolean {
    for (const c of world.characters) {
      const dx = Math.max(zone.min.x - c.pos.x, 0, c.pos.x - zone.max.x);
      const dy = Math.max(zone.min.y - c.pos.y, 0, c.pos.y - zone.max.y);
      if (Math.hypot(dx, dy) <= radius) return true;
    }
    return false;
  }

  /** Un point d'eau du coin à moins de `signsRadius` d'un joueur, assez loin des berges. */
  private pickWater(zone: ZoneSigns, world: ReadonlyWorld): Vector2 | null {
    if (zone.water.length === 0) return null;
    for (let attempt = 0; attempt < PICK_TRIES * 2; attempt += 1) {
      const cell = zone.water[Math.floor(this.random() * zone.water.length)];
      if (cell === undefined) continue;
      const x = cell.x + (this.random() * 2 - 1) * CELL_INSET;
      const y = cell.y + (this.random() * 2 - 1) * CELL_INSET;
      if (!this.swimmable(x, y)) continue;
      if (!world.characters.some((c) => Math.hypot(c.pos.x - x, c.pos.y - y) <= R.signsRadius))
        continue;
      return this.spot.set(x, y);
    }
    return null;
  }

  private updateSigns(view: FishingView, context: FrameContext): void {
    const world = context.world;
    const hot = view.hotSpot;
    if (hot !== this.lastHot) {
      this.lastHot = hot;
      this.hotRingAt = this.time + this.random() * 2;
      for (const zone of this.zones) {
        zone.nextBubbles = this.time + this.random() * R.bubbles.every[0];
        zone.nextBird = this.time + rangeOf(R.birds.first, this.random());
      }
    }
    if (this.nextElsewhereRing === 0) {
      this.nextElsewhereRing = this.time + rangeOf(R.rings.elsewhereEvery, this.random());
    }
    const rings = R.rings;
    if (this.time >= this.nextElsewhereRing) {
      // Ailleurs, un rond de temps en temps, dans un coin proche qui n'est pas celui du jour.
      this.nextElsewhereRing = this.time + rangeOf(rings.elsewhereEvery, this.random());
      const others = this.zones.filter((z) => z.id !== hot && this.near(z, world, R.signsRadius));
      const zone = others[Math.floor(this.random() * others.length)];
      if (zone !== undefined) this.ring(zone, world, false);
    }
    const zone = this.zones.find((z) => z.id === hot);
    if (zone === undefined || !this.near(zone, world, R.signsRadius)) return;
    if (this.time >= this.hotRingAt) {
      this.hotRingAt = this.time + rangeOf(rings.hotEvery, this.random());
      this.ring(zone, world, this.random() < rings.pairChance);
    }
    if (zone.calm && this.time >= zone.nextBubbles) {
      zone.nextBubbles = this.time + rangeOf(R.bubbles.every, this.random());
      this.bubbles(zone, world);
    }
    if (this.time >= zone.nextBird) {
      zone.nextBird = this.time + rangeOf(R.birds.every, this.random());
      this.birds(zone, context);
    }
  }

  private ring(zone: ZoneSigns, world: ReadonlyWorld, pair: boolean): void {
    const at = this.pickWater(zone, world);
    if (at === null) return;
    const level = this.terrain.waterLevelAt(at.x, at.y) ?? 0;
    this.emitRing(at.x, at.y, level, R.rings.radius, R.rings.seconds, R.rings.opacity, this.time);
    if (pair) {
      const a = this.random() * TWO_PI;
      const x = at.x + Math.cos(a) * 0.8;
      const y = at.y + Math.sin(a) * 0.8;
      if (this.swimmable(x, y)) {
        this.emitRing(
          x,
          y,
          level,
          R.rings.radius * 0.8,
          R.rings.seconds,
          R.rings.opacity,
          this.time + 0.6,
        );
      }
    }
  }

  private emitRing(
    x: number,
    y: number,
    level: number,
    size: number,
    life: number,
    opacity: number,
    time: number,
  ): void {
    this.signs.emit(
      {
        x,
        y: level + SIGN_LIFT,
        z: y,
        vx: 0,
        vy: 0,
        vz: 0,
        ax: 0,
        ay: 0,
        az: 0,
        drag: 1,
        life,
        startSize: size,
        endSize: size,
        shape: PARTICLE_SHAPE.ring,
        color: this.ringColor,
        opacity,
      },
      time,
    );
  }

  private bubbles(zone: ZoneSigns, world: ReadonlyWorld): void {
    const at = this.pickWater(zone, world);
    if (at === null) return;
    const b = R.bubbles;
    const level = this.terrain.waterLevelAt(at.x, at.y) ?? 0;
    const count = Math.round(rangeOf(b.count, this.random()));
    const cx = at.x;
    const cy = at.y;
    for (let i = 0; i < count; i += 1) {
      const a = this.random() * TWO_PI;
      const r = Math.sqrt(this.random()) * b.spread;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const time = this.time + this.random() * b.stagger;
      const size = rangeOf(b.size, this.random());
      // La bulle (point clair) puis le petit rond qu'elle laisse en crevant.
      this.signs.emit(
        {
          x,
          y: level + SIGN_LIFT,
          z: y,
          vx: 0,
          vy: 0,
          vz: 0,
          ax: 0,
          ay: 0,
          az: 0,
          drag: 1,
          life: b.seconds * 0.5,
          startSize: size * 0.5,
          endSize: size * 0.35,
          shape: PARTICLE_SHAPE.droplet,
          color: this.bubbleColor,
          opacity: b.opacity,
        },
        time,
      );
      this.emitRing(x, y, level, size * 2.2, b.seconds, b.opacity * 0.7, time + b.seconds * 0.35);
    }
  }

  // -------------------------------------------------------------------------
  // Hirondelles et bergeronnette

  private birds(zone: ZoneSigns, context: FrameContext): void {
    const world = context.world;
    const minutes = world.clock.minutes;
    if (world.weather === 'rain' || minutes < R.birds.from || minutes > R.birds.to) return;
    const season = seasonOfDay(this.content.settings, world.clock.day);
    if (season === 'spring' || season === 'summer') {
      const at = this.pickWater(zone, world);
      if (at === null) return;
      const s = R.birds.swallow;
      const sign = this.random() < 0.5 ? -1 : 1;
      const angle = (zone.alongX ? 0 : Math.PI / 2) + (this.random() - 0.5) * 0.3;
      const dx = Math.cos(angle) * sign;
      const dy = Math.sin(angle) * sign;
      this.swallows.length = 0;
      for (let i = 0; i < s.count; i += 1) {
        const side = (i - (s.count - 1) / 2) * SWALLOW_GAP_SIDE;
        this.swallows.push({
          start: this.time + i * SWALLOW_GAP_SECONDS,
          ox: at.x - dx * (s.length / 2) - dy * side,
          oy: at.y - dy * (s.length / 2) + dx * side,
          dx,
          dy,
          seed: this.random(),
          dipped: false,
        });
      }
    } else if (zone.bank.length > 0 && this.wagtail === null) {
      const near = zone.bank.filter((p) =>
        world.characters.some((c) => {
          const d = Math.hypot(c.pos.x - p.x, c.pos.y - p.y);
          return d <= R.signsRadius && d >= 2.5;
        }),
      );
      const perch = near[Math.floor(this.random() * near.length)];
      if (perch === undefined) return;
      const w = R.birds.wagtail;
      const from = this.random() * TWO_PI;
      this.wagtail = {
        start: this.time,
        ends: this.time + w.flySeconds + rangeOf(w.stay, this.random()),
        x: perch.x,
        y: perch.y,
        facing: this.random() * TWO_PI,
        nextHop: this.time + w.flySeconds + rangeOf(w.hopEvery, this.random()),
        hopFrom: new Vector2(perch.x, perch.y),
        hopTo: new Vector2(perch.x, perch.y),
        hopStart: Number.NEGATIVE_INFINITY,
        fromX: perch.x + Math.cos(from) * WAGTAIL_ARRIVE,
        fromY: perch.y + Math.sin(from) * WAGTAIL_ARRIVE,
      };
    }
  }

  private updateBirds(context: FrameContext): void {
    this.updateSwallows(context);
    this.updateWagtail(context);
  }

  private updateSwallows(context: FrameContext): void {
    const s = R.birds.swallow;
    const scale = R.birds.displayScale;
    let count = 0;
    for (const bird of this.swallows) {
      const t = this.time - bird.start;
      if (t < 0 || t > s.seconds) continue;
      const along = (t / s.seconds) * s.length;
      const weave = Math.sin(t * 2.1 + bird.seed * 6) * s.weave;
      const x = bird.ox + bird.dx * along - bird.dy * weave;
      const y = bird.oy + bird.dy * along + bird.dx * weave;
      const level = this.terrain.waterLevelAt(x, y) ?? this.terrain.heightAt(x, y);
      // Vol en vagues: elle descend frôler l'eau, puis remonte.
      const wave = 0.5 + 0.5 * Math.cos(t * 2.6 + bird.seed * 4);
      const height = rangeOf(s.height, wave);
      if (height < s.dipBelow && !bird.dipped && this.terrain.waterLevelAt(x, y) !== null) {
        bird.dipped = true;
        this.emitRing(x, y, level, 0.25, 0.9, 0.5, this.time);
      }
      if (height > s.dipBelow * 2) bird.dipped = false;
      const heading = Math.atan2(
        bird.dy + bird.dx * Math.cos(t * 2.1 + bird.seed * 6) * 0.3,
        bird.dx - bird.dy * Math.cos(t * 2.1 + bird.seed * 6) * 0.3,
      );
      const flapping = Math.sin(t * 1.7 + bird.seed * 5) > -0.2;
      const flap =
        flapping && !context.reducedMotion
          ? 0.45 + 0.55 * Math.abs(Math.cos(t * s.flapHz * Math.PI))
          : 1;
      const bank = Math.sin(t * 2.1 + bird.seed * 6 + Math.PI / 2) * 0.5;
      this.euler.set(0, yawFromFacing(heading), bank, 'YXZ');
      this.quat.setFromEuler(this.euler);
      this.pos.set(x, level + height, y);
      this.scale.set(scale * flap, scale, scale);
      this.swallowMesh.setMatrixAt(count, this.matrix.compose(this.pos, this.quat, this.scale));
      count += 1;
    }
    this.swallowMesh.count = count;
    finishInstances(this.swallowMesh);
  }

  private updateWagtail(context: FrameContext): void {
    const bird = this.wagtail;
    const mesh = this.wagtailMesh;
    if (bird === null) {
      mesh.count = 0;
      mesh.visible = false;
      return;
    }
    const w = R.birds.wagtail;
    const t = this.time - bird.start;
    const leaving = this.time > bird.ends;
    if (leaving && this.time > bird.ends + w.flySeconds) {
      this.wagtail = null;
      mesh.count = 0;
      mesh.visible = false;
      return;
    }
    let x = bird.x;
    let y = bird.y;
    let lift = 0;
    let facing = bird.facing;
    if (t < w.flySeconds) {
      // Arrivée en vol, en arc, jusqu'à la berge.
      const k = smooth(0, 1, t / w.flySeconds);
      x = bird.fromX + (bird.x - bird.fromX) * k;
      y = bird.fromY + (bird.y - bird.fromY) * k;
      lift = Math.sin(k * Math.PI) * 0.8 + (1 - k) * 0.4;
      facing = Math.atan2(bird.y - bird.fromY, bird.x - bird.fromX);
    } else if (leaving) {
      const k = (this.time - bird.ends) / w.flySeconds;
      x = bird.x + Math.cos(bird.facing) * w.flySpeed * k * w.flySeconds;
      y = bird.y + Math.sin(bird.facing) * w.flySpeed * k * w.flySeconds;
      lift = k * 2.2;
    } else {
      if (this.time >= bird.nextHop) {
        bird.nextHop = this.time + rangeOf(w.hopEvery, this.random());
        const a = this.random() * TWO_PI;
        const nx = bird.x + Math.cos(a) * w.hop;
        const ny = bird.y + Math.sin(a) * w.hop;
        // Un pas de côté seulement sur la terre ferme (jamais dans l'eau).
        if (this.terrain.waterLevelAt(nx, ny) === null) {
          bird.hopFrom.set(bird.x, bird.y);
          bird.hopTo.set(nx, ny);
          bird.hopStart = this.time;
          bird.facing = a;
        }
      }
      const hop = (this.time - bird.hopStart) / 0.18;
      if (hop >= 0 && hop < 1) {
        x = bird.hopFrom.x + (bird.hopTo.x - bird.hopFrom.x) * hop;
        y = bird.hopFrom.y + (bird.hopTo.y - bird.hopFrom.y) * hop;
        lift = Math.sin(hop * Math.PI) * w.hopHeight;
      } else if (hop >= 1) {
        bird.x = bird.hopTo.x;
        bird.y = bird.hopTo.y;
        x = bird.x;
        y = bird.y;
      }
      facing = bird.facing;
    }
    const ground = this.terrain.heightAt(x, y);
    // La queue qui bat de haut en bas: tout le corps bascule un peu autour des pattes.
    const bob = context.reducedMotion
      ? 0
      : Math.max(0, Math.sin(this.time * w.tailBobHz * TWO_PI)) * 0.25;
    this.euler.set(-bob, yawFromFacing(facing), 0, 'YXZ');
    this.quat.setFromEuler(this.euler);
    this.pos.set(x, ground + lift, y);
    this.scale.setScalar(R.birds.displayScale);
    mesh.setMatrixAt(0, this.matrix.compose(this.pos, this.quat, this.scale));
    mesh.count = 1;
    finishInstances(mesh);
  }

  dispose(): void {
    this.tracks.clear();
    this.swallows.length = 0;
    this.wagtail = null;
    this.group.removeFromParent();
  }
}

type FishZoneRects = ReturnType<FishingSource['zones']>[number]['rects'];
