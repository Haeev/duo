/**
 * Retours visuels immédiats (tableau 5.2 du cahier): particules (motte de
 * terre, graines, gouttes, copeaux, poussière de chantier, grain, étincelles
 * de la qualité « belle »), objet récolté qui saute au sac, case visée
 * surlignée (grisée si l'action est impossible), repère de destination d'un
 * clic, pluie, et le reflet discret au pied du banc quand l'ombre de la cloche
 * le touche (énigme d'Émile, de 17 h à 17 h 30 par soleil).
 */
import {
  Color,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
  type InstancedMesh,
  type Object3D,
} from 'three';
import type { GameMap } from '../etat/carte';
import type { CharacterId, WorldEvent } from '../etat/types';
import type { Content } from '../donnees/types';
import type { IsoCameraRig } from './camera';
import type { FrameContext } from './contexte';
import { ShapeBuilder, paintGeometry } from './geometrie';
import { createInstanced, finishInstances } from './instances';
import type { HousePart } from './maison';
import type { SharedMaterials } from './materiaux';
import type { ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import type { PaletteCell } from './palette';
import type { CharactersPart } from './personnages';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

const FX = RENDER_SETTINGS.effects;
const HALF_CELL = 0.5;
const HIGHLIGHT_LIFT = 0.04;
const HIGHLIGHT_GARDEN_LIFT = 0.14;
const HIGHLIGHT_INSET = 0.94;
const HIGHLIGHT_THICKNESS = 0.06;
const HIGHLIGHT_HEIGHT = 0.03;
const HIGHLIGHT_OPACITY = 0.75;
const HIGHLIGHT_PULSE = 0.2;
const HIGHLIGHT_READY = '#fff6dc';
const HIGHLIGHT_BLOCKED = '#8d929b';
const MARKER_INNER = 0.22;
const MARKER_OUTER = 0.34;
const MARKER_SEGMENTS = 24;
const MARKER_GROWTH = 1.6;
const MAX_JUMPS = 8;
const JUMP_START_SCALE = 1.25;
const JUMP_END_SCALE = 0.3;
const CHOP_TRAUMA = 0.18;
const FELL_TRAUMA = 0.5;
const RAIN_TILT = 0.12;
const RAIN_COLOR = '#c5d7e0';
const BELL_FIRST_MINUTE = 17 * 60;
const BELL_LAST_MINUTE = 17 * 60 + 30;
const BELL_SPARKLE_EVERY = 0.6;
const BELL_RING_OPACITY = 0.35;
/** Générateur de Park et Miller (décor seulement). */
const PM_MULTIPLIER = 16807;
const PM_MODULUS = 2147483647;
const HASH_X = 12.9898;
const HASH_SALT = 78.233;
const HASH_SCALE = 43758.5453;

/** Recette d'une gerbe de particules. */
interface Burst {
  cell: PaletteCell;
  count: number;
  speed: number;
  up: number;
  life: number;
  size: number;
  gravity: number;
  drag: number;
}

const BURSTS = {
  soil: {
    cell: 'soil_tilled',
    count: 10,
    speed: 1.6,
    up: 2.6,
    life: 0.6,
    size: 0.08,
    gravity: 1,
    drag: 0.5,
  },
  seed: {
    cell: 'seed',
    count: 8,
    speed: 0.6,
    up: 0.6,
    life: 0.5,
    size: 0.04,
    gravity: 1,
    drag: 0.5,
  },
  water: {
    cell: 'water_foam',
    count: 16,
    speed: 1.2,
    up: 1.8,
    life: 0.55,
    size: 0.05,
    gravity: 1,
    drag: 0.3,
  },
  leaf: {
    cell: 'leaf_crop_light',
    count: 8,
    speed: 1.4,
    up: 2.2,
    life: 0.6,
    size: 0.06,
    gravity: 0.6,
    drag: 1.2,
  },
  chips: {
    cell: 'wood_new',
    count: 9,
    speed: 2.4,
    up: 2.0,
    life: 0.6,
    size: 0.07,
    gravity: 1,
    drag: 0.6,
  },
  dust: {
    cell: 'stone_light',
    count: 26,
    speed: 1.3,
    up: 0.7,
    life: 1.1,
    size: 0.18,
    gravity: -0.05,
    drag: 2.2,
  },
  grain: {
    cell: 'grain',
    count: 14,
    speed: 1.0,
    up: 1.4,
    life: 0.7,
    size: 0.035,
    gravity: 1,
    drag: 0.4,
  },
  sparkle: {
    cell: 'flame',
    count: 10,
    speed: 1.1,
    up: 1.6,
    life: 0.8,
    size: 0.06,
    gravity: -0.15,
    drag: 1.5,
  },
  bell: {
    cell: 'flame',
    count: 2,
    speed: 0.15,
    up: 0.5,
    life: 1.2,
    size: 0.045,
    gravity: -0.1,
    drag: 0.8,
  },
  smoke: {
    cell: 'white_paint',
    count: 1,
    speed: 0.3,
    up: 1.2,
    life: FX.smokeSeconds,
    size: 0.5,
    gravity: -0.05,
    drag: 0.4,
  },
} satisfies Record<string, Burst>;

export type BurstKind = keyof typeof BURSTS;

/** Un nuage de particules préalloué: aucune allocation par image. */
class ParticlePool {
  readonly mesh: InstancedMesh;
  private readonly capacity: number;
  private readonly position: Float32Array;
  private readonly velocity: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly size: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;
  private readonly grows: Uint8Array;
  private next = 0;
  private readonly matrix = new Matrix4();
  private readonly at = new Vector3();
  private readonly scale = new Vector3();
  private readonly spin = new Quaternion();
  private readonly euler = new Euler();
  private readonly color = new Color();
  private seed = 1;

  constructor(
    materials: SharedMaterials,
    resources: ResourceTracker,
    private readonly paint: SharedMaterials['paletteColor'],
  ) {
    this.capacity = FX.maxParticles;
    const cube = new ShapeBuilder().box([1, 1, 1], [0, 0, 0], 'white_paint').build();
    this.mesh = createInstanced(
      'particules',
      resources.track(cube),
      materials.palette,
      this.capacity,
    );
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.position = new Float32Array(this.capacity * 3);
    this.velocity = new Float32Array(this.capacity * 3);
    this.life = new Float32Array(this.capacity);
    this.maxLife = new Float32Array(this.capacity);
    this.size = new Float32Array(this.capacity);
    this.gravity = new Float32Array(this.capacity);
    this.drag = new Float32Array(this.capacity);
    this.grows = new Uint8Array(this.capacity);
  }

  /** Suite pseudo-aléatoire locale (décor seulement, jamais dans la simulation). */
  private random(): number {
    this.seed = (this.seed * PM_MULTIPLIER) % PM_MODULUS;
    return (this.seed - 1) / (PM_MODULUS - 1);
  }

  emit(kind: BurstKind, x: number, y: number, z: number, countScale = 1): void {
    const burst: Burst = BURSTS[kind];
    this.paint(burst.cell, this.color);
    const count = Math.max(1, Math.round(burst.count * countScale));
    for (let n = 0; n < count; n += 1) {
      const i = this.next;
      this.next = (this.next + 1) % this.capacity;
      const angle = this.random() * Math.PI * 2;
      const speed = burst.speed * (HALF_CELL + this.random());
      this.position[i * 3] = x;
      this.position[i * 3 + 1] = y;
      this.position[i * 3 + 2] = z;
      this.velocity[i * 3] = Math.cos(angle) * speed;
      this.velocity[i * 3 + 1] = burst.up * (HALF_CELL + this.random() * HALF_CELL);
      this.velocity[i * 3 + 2] = Math.sin(angle) * speed;
      this.maxLife[i] = burst.life * (HALF_CELL + this.random());
      this.life[i] = this.maxLife[i] ?? 0;
      this.size[i] = burst.size * (HALF_CELL + this.random());
      this.gravity[i] = burst.gravity;
      this.drag[i] = burst.drag;
      this.grows[i] = kind === 'dust' || kind === 'smoke' ? 1 : 0;
      this.mesh.setColorAt(i, this.color);
    }
  }

  update(dt: number): void {
    let alive = 0;
    for (let i = 0; i < this.capacity; i += 1) {
      const life = this.life[i] ?? 0;
      if (life <= 0) {
        continue;
      }
      const remaining = life - dt;
      this.life[i] = remaining;
      const drag = Math.max(0, 1 - (this.drag[i] ?? 0) * dt);
      const vx = (this.velocity[i * 3] ?? 0) * drag;
      const vy =
        ((this.velocity[i * 3 + 1] ?? 0) - (this.gravity[i] ?? 0) * FX.gravity * dt) * drag;
      const vz = (this.velocity[i * 3 + 2] ?? 0) * drag;
      this.velocity[i * 3] = vx;
      this.velocity[i * 3 + 1] = vy;
      this.velocity[i * 3 + 2] = vz;
      const px = (this.position[i * 3] ?? 0) + vx * dt;
      const py = (this.position[i * 3 + 1] ?? 0) + vy * dt;
      const pz = (this.position[i * 3 + 2] ?? 0) + vz * dt;
      this.position[i * 3] = px;
      this.position[i * 3 + 1] = py;
      this.position[i * 3 + 2] = pz;
      if (remaining <= 0) {
        continue;
      }
      const t = remaining / (this.maxLife[i] ?? 1);
      const base = this.size[i] ?? 0;
      const size =
        this.grows[i] === 1
          ? base * (1 + (1 - t) * 2) * Math.min(1, t * 3)
          : base * Math.min(1, t * 2);
      this.at.set(px, py, pz);
      this.spin.setFromEuler(this.euler.set(t * 7 + i, t * 5, 0));
      this.scale.setScalar(size);
      this.mesh.setMatrixAt(alive, this.matrix.compose(this.at, this.spin, this.scale));
      if (alive !== i) {
        this.mesh.getColorAt(i, this.color);
        this.mesh.setColorAt(alive, this.color);
      }
      alive += 1;
    }
    this.mesh.count = alive;
    this.mesh.visible = alive > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor !== null) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }
}

interface Jump {
  object: Object3D;
  from: Vector3;
  to: CharacterId;
  start: number;
  sparkle: boolean;
}

export class EffectsPart implements EventfulPart {
  readonly group = new Group();
  readonly particles: ParticlePool;
  private readonly highlight: Mesh;
  private readonly highlightMaterial: MeshBasicMaterial;
  private readonly marker: Mesh;
  private readonly markerMaterial: MeshBasicMaterial;
  private markerStart = Number.NEGATIVE_INFINITY;
  private markerKey = '';
  private readonly bellRing: Mesh;
  private bellSparkle = 0;
  private readonly jumps: Jump[] = [];
  private readonly rain: InstancedMesh;
  private readonly rainOffsets: Float32Array;
  private readonly gardenCells: Set<string>;
  private readonly tmp = new Vector3();
  private readonly target = new Vector3();
  private readonly matrix = new Matrix4();
  private readonly rainTilt = new Quaternion().setFromEuler(new Euler(RAIN_TILT, 0, RAIN_TILT));
  private readonly rainScale = new Vector3(1, 1, 1);
  private time = 0;

  constructor(
    private readonly map: GameMap,
    private readonly content: Content,
    private readonly library: ModelLibrary,
    materials: SharedMaterials,
    private readonly terrain: Terrain,
    resources: ResourceTracker,
    private readonly characters: CharactersPart,
    private readonly house: HousePart,
    private readonly rig: IsoCameraRig,
  ) {
    this.group.name = 'effets';
    this.particles = new ParticlePool(materials, resources, materials.paletteColor.bind(materials));
    this.group.add(this.particles.mesh);
    this.gardenCells = new Set(map.garden.map((cell) => `${cell.cx}:${cell.cy}`));

    // Cadre de la case visée: quatre baguettes, sans lumière, au-dessus du sol.
    const frame = new ShapeBuilder();
    const half = HIGHLIGHT_INSET / 2;
    for (const [x, z, w, d] of [
      [0, -half, HIGHLIGHT_INSET, HIGHLIGHT_THICKNESS],
      [0, half, HIGHLIGHT_INSET, HIGHLIGHT_THICKNESS],
      [-half, 0, HIGHLIGHT_THICKNESS, HIGHLIGHT_INSET],
      [half, 0, HIGHLIGHT_THICKNESS, HIGHLIGHT_INSET],
    ] as const) {
      frame.box([w, HIGHLIGHT_HEIGHT, d], [x, 0, z], 'white_paint');
    }
    this.highlightMaterial = resources.track(
      new MeshBasicMaterial({
        map: materials.paletteTexture,
        transparent: true,
        opacity: HIGHLIGHT_OPACITY,
        depthWrite: false,
      }),
    );
    this.highlight = new Mesh(resources.track(frame.build()), this.highlightMaterial);
    this.highlight.name = 'case visee';
    this.highlight.renderOrder = 3;
    this.highlight.visible = false;

    // Anneau peint sur la case blanche de la palette: même programme que les fantômes.
    const ring = new RingGeometry(MARKER_INNER, MARKER_OUTER, MARKER_SEGMENTS).toNonIndexed();
    ring.rotateX(-Math.PI / 2);
    paintGeometry(ring, 'white_paint');
    resources.track(ring);
    this.markerMaterial = resources.track(
      new MeshBasicMaterial({
        map: materials.paletteTexture,
        color: new Color(HIGHLIGHT_READY),
        transparent: true,
        depthWrite: false,
      }),
    );
    this.marker = new Mesh(ring, this.markerMaterial);
    this.marker.name = 'destination';
    this.marker.renderOrder = 3;
    this.marker.visible = false;

    const bellMaterial = resources.track(
      new MeshBasicMaterial({
        map: materials.paletteTexture,
        color: materials.paletteColor('flame', new Color()),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.bellRing = new Mesh(ring, bellMaterial);
    this.bellRing.name = 'reflet de la cloche';
    this.bellRing.visible = false;

    const drop = new ShapeBuilder().box([0.02, 0.5, 0.02], [0, 0, 0], 'white_paint').build();
    this.rain = createInstanced('pluie', resources.track(drop), materials.palette, FX.rainDrops);
    this.rain.castShadow = false;
    this.rain.receiveShadow = false;
    this.rain.frustumCulled = false;
    const rainColor = new Color(RAIN_COLOR);
    this.rainOffsets = new Float32Array(FX.rainDrops * 3);
    for (let i = 0; i < FX.rainDrops; i += 1) {
      this.rainOffsets[i * 3] = hashUnit(i, 1);
      this.rainOffsets[i * 3 + 1] = hashUnit(i, 2);
      this.rainOffsets[i * 3 + 2] = hashUnit(i, 3);
      this.rain.setColorAt(i, rainColor);
    }
    this.rain.count = FX.rainDrops;
    finishInstances(this.rain);
    this.rain.visible = false;

    this.group.add(this.highlight, this.marker, this.bellRing, this.rain);
  }

  private cellCenter(cell: { cx: number; cy: number }, out: Vector3): Vector3 {
    const x = cell.cx + HALF_CELL;
    const y = cell.cy + HALF_CELL;
    return out.set(
      x,
      this.terrain.heightAt(x, y) +
        (this.gardenCells.has(`${cell.cx}:${cell.cy}`) ? RENDER_SETTINGS.garden.tilledHeight : 0),
      y,
    );
  }

  private jump(
    item: string,
    from: Vector3,
    to: CharacterId,
    sparkle: boolean,
    reducedMotion: boolean,
  ): void {
    if (reducedMotion) {
      return;
    }
    if (this.jumps.length >= MAX_JUMPS) {
      const oldest = this.jumps.shift();
      oldest?.object.removeFromParent();
    }
    const model = this.content.items[item]?.model ?? item;
    const object = this.library.instantiate(model);
    object.scale.setScalar(FX.itemScale);
    this.group.add(object);
    this.jumps.push({ object, from: from.clone(), to, start: this.time, sparkle });
  }

  handleEvent(event: WorldEvent, context: FrameContext): void {
    const p = this.particles;
    const at = this.tmp;
    // Une chaîne de tests plutôt qu'un aiguillage: les événements sans effet visuel (sons, interface) passent sans bruit.
    if (event.type === 'tilled') {
      this.cellCenter(event.cell, at);
      p.emit('soil', at.x, at.y + HIGHLIGHT_LIFT, at.z);
    } else if (event.type === 'dig') {
      this.cellCenter(event.cell, at);
      p.emit('soil', at.x, at.y, at.z);
      if (event.found) {
        p.emit('sparkle', at.x, at.y + HALF_CELL, at.z);
      }
    } else if (event.type === 'sowed') {
      this.cellCenter(event.cell, at);
      p.emit('seed', at.x, at.y + HALF_CELL, at.z);
    } else if (event.type === 'watered') {
      this.cellCenter(event.cell, at);
      p.emit('water', at.x, at.y + HALF_CELL, at.z);
    } else if (event.type === 'harvested') {
      this.cellCenter(event.cell, at);
      p.emit('leaf', at.x, at.y + HIGHLIGHT_GARDEN_LIFT, at.z);
      this.jump(event.item, at, event.by, event.quality === 'fine', context.reducedMotion);
    } else if (event.type === 'picked_up') {
      const who = this.characters.playerPosition(event.by);
      if (who !== null) {
        at.copy(who.position);
        this.jump(event.item, at, event.by, false, context.reducedMotion);
      }
    } else if (event.type === 'chop') {
      const tree = context.world.trees.find((candidate) => candidate.id === event.tree);
      if (tree !== undefined) {
        p.emit('chips', tree.pos.x, this.terrain.heightAt(tree.pos.x, tree.pos.y) + 1, tree.pos.y);
        if (event.felled) {
          p.emit(
            'leaf',
            tree.pos.x,
            this.terrain.heightAt(tree.pos.x, tree.pos.y) + 2,
            tree.pos.y,
            3,
          );
        }
      }
      if (event.by === context.local) {
        this.rig.addTrauma(event.felled ? FELL_TRAUMA : CHOP_TRAUMA);
      }
    } else if (event.type === 'element_built') {
      const centre = this.house.elementCenter(event.construction, event.element, at);
      if (centre !== null) {
        p.emit('dust', centre.x, centre.y, centre.z);
      }
    } else if (event.type === 'construction_done') {
      const centre = this.house.elementCenter(event.construction, '', at);
      if (centre !== null) {
        p.emit('dust', centre.x, centre.y, centre.z, 3);
      }
    } else if (event.type === 'beam_placed') {
      const spot = this.map.points.house_beam_spot;
      if (spot !== undefined) {
        p.emit('dust', spot.x, this.terrain.heightAt(spot.x, spot.y) + 1, spot.y, 2);
      }
    } else if (event.type === 'furniture_placed') {
      const piece = context.world.furniture.find((candidate) => candidate.id === event.furniture);
      if (piece !== undefined) {
        this.cellCenter(piece.cell, at);
        p.emit('dust', at.x, at.y, at.z);
      }
    } else if (event.type === 'fed_hens') {
      const feeder = this.map.points.hen_feeder ?? this.map.points.chicken_coop;
      if (feeder !== undefined) {
        p.emit('grain', feeder.x, this.terrain.heightAt(feeder.x, feeder.y) + HALF_CELL, feeder.y);
      }
    } else if (event.type === 'refilled') {
      const point = this.map.points[event.at];
      if (point !== undefined) {
        p.emit('water', point.x, this.terrain.heightAt(point.x, point.y) + 1, point.y);
      }
    }
  }

  update(context: FrameContext): void {
    this.time = context.time;
    this.updateJumps(context);
    this.updateHighlight(context);
    this.updateMarker(context);
    this.updateBell(context);
    this.updateRain(context);
    this.particles.update(context.dt);
  }

  private updateJumps(context: FrameContext): void {
    for (let i = this.jumps.length - 1; i >= 0; i -= 1) {
      const jump = this.jumps[i];
      if (jump === undefined) {
        continue;
      }
      const t = (context.time - jump.start) / FX.jumpSeconds;
      const holder = this.characters.playerPosition(jump.to);
      if (t >= 1 || holder === null) {
        if (jump.sparkle && holder !== null) {
          this.particles.emit(
            'sparkle',
            holder.position.x,
            holder.position.y + FX.bagHeight,
            holder.position.z,
          );
        }
        jump.object.removeFromParent();
        this.jumps.splice(i, 1);
        continue;
      }
      this.target.copy(holder.position);
      this.target.y += FX.bagHeight;
      jump.object.position.lerpVectors(jump.from, this.target, t);
      jump.object.position.y += Math.sin(t * Math.PI) * FX.jumpHeight;
      jump.object.rotation.y = t * Math.PI * 2;
      jump.object.scale.setScalar(
        FX.itemScale * (JUMP_START_SCALE + (JUMP_END_SCALE - JUMP_START_SCALE) * t),
      );
    }
  }

  private updateHighlight(context: FrameContext): void {
    const local = context.world.characters.find((character) => character.id === context.local);
    const aim = local?.aim ?? null;
    if (!aim?.verb) {
      this.highlight.visible = false;
      return;
    }
    const garden = this.gardenCells.has(`${aim.cell.cx}:${aim.cell.cy}`);
    this.cellCenter(aim.cell, this.tmp);
    this.highlight.position.set(
      this.tmp.x,
      this.tmp.y + (garden ? HIGHLIGHT_LIFT : HIGHLIGHT_LIFT / 2),
      this.tmp.z,
    );
    this.highlight.visible = true;
    const blocked = aim.blocked !== null;
    this.highlightMaterial.color.set(blocked ? HIGHLIGHT_BLOCKED : HIGHLIGHT_READY);
    const pulse = context.reducedMotion
      ? 0
      : Math.sin(context.time * Math.PI * 2 * FX.highlightPulseHz) * HIGHLIGHT_PULSE;
    this.highlightMaterial.opacity = HIGHLIGHT_OPACITY + (blocked ? 0 : pulse);
  }

  private updateMarker(context: FrameContext): void {
    const local = context.world.characters.find((character) => character.id === context.local);
    const destination = local?.destination ?? null;
    const key =
      destination === null ? '' : `${destination.x.toFixed(2)}:${destination.y.toFixed(2)}`;
    if (key !== this.markerKey) {
      this.markerKey = key;
      this.markerStart = destination === null ? Number.NEGATIVE_INFINITY : context.time;
      if (destination !== null) {
        this.marker.position.set(
          destination.x,
          this.terrain.heightAt(destination.x, destination.y) + HIGHLIGHT_LIFT,
          destination.y,
        );
      }
    }
    const t = (context.time - this.markerStart) / FX.destinationSeconds;
    this.marker.visible = t >= 0 && t < 1;
    if (this.marker.visible) {
      this.marker.scale.setScalar(context.reducedMotion ? 1 : 1 + t * MARKER_GROWTH);
      this.markerMaterial.opacity = 1 - t;
    }
  }

  private updateBell(context: FrameContext): void {
    const minutes = context.world.clock.minutes;
    const spot = this.map.points.bell_shadow_spot;
    const active =
      spot !== undefined &&
      context.world.weather === 'sunny' &&
      minutes >= BELL_FIRST_MINUTE &&
      minutes <= BELL_LAST_MINUTE;
    this.bellRing.visible = active;
    if (!active) {
      return;
    }
    const ground = this.terrain.heightAt(spot.x, spot.y);
    this.bellRing.position.set(spot.x, ground + HIGHLIGHT_LIFT, spot.y);
    const material = this.bellRing.material as MeshBasicMaterial;
    material.opacity = BELL_RING_OPACITY * (1 + Math.sin(context.time * Math.PI)) * HALF_CELL;
    this.bellSparkle -= context.dt;
    if (this.bellSparkle <= 0 && !context.reducedMotion) {
      this.bellSparkle = BELL_SPARKLE_EVERY;
      this.particles.emit('bell', spot.x, ground + HIGHLIGHT_LIFT, spot.y);
    }
  }

  private updateRain(context: FrameContext): void {
    const raining = context.world.weather === 'rain';
    this.rain.visible = raining;
    if (!raining) {
      return;
    }
    const focus = this.rig.focus;
    const radius = this.rig.viewRadius() + FX.rainAreaPadding;
    const fall = (context.time * FX.rainSpeed) / FX.rainHeight;
    const position = this.tmp;
    for (let i = 0; i < FX.rainDrops; i += 1) {
      const ox = this.rainOffsets[i * 3] ?? 0;
      const oy = this.rainOffsets[i * 3 + 1] ?? 0;
      const oz = this.rainOffsets[i * 3 + 2] ?? 0;
      const height = (((oy - fall) % 1) + 1) % 1;
      position.set(
        focus.x + (ox * 2 - 1) * radius,
        height * FX.rainHeight,
        focus.z + (oz * 2 - 1) * radius,
      );
      this.rain.setMatrixAt(i, this.matrix.compose(position, this.rainTilt, this.rainScale));
    }
    this.rain.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const jump of this.jumps) {
      jump.object.removeFromParent();
    }
    this.jumps.length = 0;
    this.group.removeFromParent();
  }
}

/** Valeur stable dans [0, 1[ pour l'index d'une goutte de pluie. */
function hashUnit(index: number, salt: number): number {
  const s = Math.sin(index * HASH_X + salt * HASH_SALT) * HASH_SCALE;
  return s - Math.floor(s);
}
