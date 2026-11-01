/**
 * Petite faune d'ambiance (réglages dans `reglages-faune.ts`), côté rendu seulement:
 *
 * - des mésanges posées au sommet de buissons qui ont un arbre à moins de quelques mètres; un
 *   joueur qui approche les fait partir en arc vers le houppier, où elles disparaissent; elles
 *   reviennent quand personne n'est plus près;
 * - des papillons dans le pré fleuri, aux heures chaudes et par beau temps: deux ailes par
 *   papillon dans un seul maillage instancié (un appel de dessin, le programme des semis), qui
 *   volettent autour de leur fleur et se posent un moment.
 *
 * Positions tirées de la graine de la partie (mêmes buissons, même pré chez les deux joueurs).
 * Hors du cadre de la caméra, rien n'est animé ni dessiné: seules les minuteries avancent.
 */
import {
  AnimationMixer,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Frustum,
  Group,
  LoopOnce,
  LoopRepeat,
  Matrix4,
  Quaternion,
  Sphere,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Camera,
  type InstancedMesh,
} from 'three';
import type { GameMap, MapProp } from '../etat/carte';
import { cellIndex, inMap } from '../etat/carte';
import type { Vec2 } from '../etat/types';
import type { FrameContext } from './contexte';
import { yawFromFacing } from './contexte';
import { propHints, propMatrix } from './decor';
import { ShapeBuilder } from './geometrie';
import { createInstanced, finishInstances } from './instances';
import type { SharedMaterials } from './materiaux';
import type { ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import { AMBIENT_FAUNA, type AmbientFaunaSettings, type HourRange } from './reglages-faune';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

const FAUNA_FILE = 'faune.glb';
const PERCH_CLIP = 'tit_perch';
const FLY_CLIP = 'tit_fly';
const SING_CLIP = 'tit_sing';
const CLIP_FADE = 0.12;
/** Rayon de la sphère d'une mésange pour le test du cadre (m), et marge du pré au-dessus du sol. */
const BIRD_RADIUS = 0.4;
const MEADOW_TOP = 1.5;
/** Nouvelle tentative de retour quand un joueur est encore près du buisson (s). */
const RETRY_SECONDS = 3;
const TREE_MODELS: ReadonlySet<string> = new Set(['tree_oak', 'tree_fir']);
const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;
/** Angles des ailes: ouvertes en vol (bas et haut du battement), fermées et entrouvertes posé. */
const WING_LOW = 10 * DEG;
const WING_HIGH = 75 * DEG;
const WING_CLOSED = 85 * DEG;
const WING_RESTING_OPEN = 35 * DEG;
const REST_FLAP_HZ = 0.4;
/** Zigzag latéral et tangage du vol des papillons (m, Hz). */
const WOBBLE = 0.18;
const WOBBLE_HZ = 1.3;
const BOB = 0.04;
const MAX_TRIES = 400;

/** Hachage stable de trois entiers vers [0, 1[ (mêmes tirages sur les deux machines). */
export function faunaUnit(seed: number, index: number, salt: number): number {
  let h = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 11, 0x85ebca6b)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 2 ** 32;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Vrai si l'heure (minutes depuis minuit) est dans la plage et la météo permise. */
export function faunaActive(range: HourRange, weathers: readonly string[], minutes: number, weather: string): boolean {
  const m = ((minutes % 1440) + 1440) % 1440;
  return m >= range.from && m < range.to && weathers.includes(weather);
}

/** Un perchoir possible: sommet d'un buisson, et le houppier où l'oiseau se réfugie. */
export interface Perch {
  x: number;
  y: number;
  /** Hauteur des pattes dans le monde. */
  z: number;
  refuge: { x: number; y: number; z: number };
}

/** Arbres de la carte (lisière à couper et arbres posés), là où une mésange peut se cacher. */
export function treeSpots(map: GameMap): Vec2[] {
  return [...map.trees.map((t) => t.pos), ...map.props.filter((p) => TREE_MODELS.has(p.model)).map((p) => p.pos)];
}

/**
 * Buissons retenus pour les mésanges: un arbre proche pour refuge, loin des points à éviter,
 * espacés entre eux; ordre tiré par la graine. `top(prop)` donne la hauteur du sommet du feuillage.
 */
export function choosePerches(
  map: GameMap,
  seed: number,
  wanted: number,
  top: (prop: MapProp) => number,
  settings: AmbientFaunaSettings['birds'] = AMBIENT_FAUNA.birds,
): Perch[] {
  const trees = treeSpots(map);
  const avoid = settings.avoidPoints.map((id) => map.points[id]).filter((p): p is Vec2 => p !== undefined);
  const candidates = map.props
    .filter((p) => settings.perchModels.includes(p.model))
    .filter((p) => avoid.every((a) => Math.hypot(a.x - p.pos.x, a.y - p.pos.y) >= settings.avoidRadius))
    .map((p, index) => ({ p, order: faunaUnit(seed, index, 3) }))
    .sort((a, b) => a.order - b.order);
  const out: Perch[] = [];
  for (const { p } of candidates) {
    if (out.length >= wanted) break;
    if (out.some((o) => Math.hypot(o.x - p.pos.x, o.y - p.pos.y) < settings.minSpacing)) continue;
    let best: Vec2 | null = null;
    let bestDistance = settings.refugeMaxDistance;
    for (const t of trees) {
      const d = Math.hypot(t.x - p.pos.x, t.y - p.pos.y);
      if (d < bestDistance) {
        best = t;
        bestDistance = d;
      }
    }
    if (best === null) continue;
    const inset = bestDistance > 0 ? Math.min(settings.refugeInset, bestDistance) / bestDistance : 0;
    out.push({
      x: p.pos.x,
      y: p.pos.y,
      z: top(p) - settings.perchSink,
      refuge: {
        x: best.x + (p.pos.x - best.x) * inset,
        y: best.y + (p.pos.y - best.y) * inset,
        z: settings.refugeHeight,
      },
    });
  }
  return out;
}

/** Fleurs des papillons: points libres (ni bloqués ni dans l'eau) des zones, tirés par la graine. */
export function chooseButterflyHomes(map: GameMap, seed: number, wanted: number, zones: readonly string[]): Vec2[] {
  const rects = zones.map((id) => map.zones[id]).filter((r) => r !== undefined);
  const out: Vec2[] = [];
  if (rects.length === 0) return out;
  for (let i = 0; i < MAX_TRIES && out.length < wanted; i += 1) {
    const rect = rects[Math.floor(faunaUnit(seed, i, 21) * rects.length)] ?? rects[0];
    if (rect === undefined) break;
    const x = rect.x + faunaUnit(seed, i, 23) * rect.w;
    const y = rect.y + faunaUnit(seed, i, 29) * rect.h;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (!inMap(map, cx, cy) || map.blocked[cellIndex(map, cx, cy)] === true) continue;
    out.push({ x, y });
  }
  return out;
}

type BirdState = 'gone' | 'perched' | 'leaving' | 'away' | 'arriving';

interface Bird {
  root: Group;
  mixer: AnimationMixer | null;
  actions: Map<string, AnimationAction>;
  clip: string;
  /** Indices des perchoirs de cette mésange (le sien d'abord, puis un voisin). */
  perches: number[];
  perch: number;
  state: BirdState;
  since: number;
  duration: number;
  from: Vector3;
  control: Vector3;
  to: Vector3;
  yaw: number;
  nextIdle: number;
  singUntil: number;
  rank: number;
  /** Au chargement de la partie: déjà posée si personne n'est près (pas d'arrivée en vol). */
  settled: boolean;
}

interface Butterfly {
  home: Vec2;
  from: Vector3;
  to: Vector3;
  since: number;
  duration: number;
  resting: boolean;
  legsLeft: number;
  rank: number;
  flapHz: number;
  phase: number;
  yaw: number;
}

const tmpPosition = new Vector3();
const tmpTangent = new Vector3();
const tmpMatrix = new Matrix4();
const tmpScale = new Vector3();
const tmpYaw = new Quaternion();
const tmpRoll = new Quaternion();
const tmpRotation = new Quaternion();
const tmpSphere = new Sphere();
const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);

/** Point de la courbe de Bézier quadratique (départ, contrôle, arrivée) au temps `t`. */
function bezier(a: Vector3, c: Vector3, b: Vector3, t: number, out: Vector3): Vector3 {
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    u * u * a.z + 2 * u * t * c.z + t * t * b.z,
  );
}

/** Aile droite d'un papillon, charnière sur l'axe du corps (+Z vers l'avant), envergure d'une aile = 1. */
function wingGeometry(): BufferGeometry {
  const up: number[][] = [
    [0, 0.25, 0.95, 0.55, 0.85, -0.05],
    [0, 0.25, 0.85, -0.05, 0, -0.1],
    [0, -0.1, 0.75, -0.15, 0.45, -0.65],
    [0, -0.1, 0.45, -0.65, 0, -0.45],
  ];
  const positions: number[] = [];
  for (const [ax = 0, az = 0, bx = 0, bz = 0, cx = 0, cz = 0] of up) {
    positions.push(ax, 0, az, bx, 0, bz, cx, 0, cz);
    // Revers (le matériau ne dessine qu'une face).
    positions.push(ax, 0, az, cx, 0, cz, bx, 0, bz);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometry;
}

/** Personne à moins de `returnClear` du perchoir de cette mésange. */
function perchClear(part: AmbientFaunaPart, bird: Bird, context: FrameContext): boolean {
  const p = part.perchAt(bird.perch);
  return p !== undefined && part.nearestPlayer(context, p.x, p.y) >= AMBIENT_FAUNA.birds.returnClear;
}

export class AmbientFaunaPart implements EventfulPart {
  readonly group = new Group();
  private readonly settings = AMBIENT_FAUNA;
  private readonly clips = new Map<string, AnimationClip>();
  private readonly frustum = new Frustum();
  private readonly viewProjection = new Matrix4();
  private seed: number | null = null;
  private perches: Perch[] = [];
  private readonly birds: Bird[] = [];
  private readonly butterflies: Butterfly[] = [];
  private readonly wings: InstancedMesh;
  /** Sphère qui contient le vol de tous les papillons (test du cadre). */
  private readonly meadow = new Sphere();

  constructor(
    private readonly map: GameMap,
    private readonly library: ModelLibrary,
    private readonly materials: SharedMaterials,
    private readonly terrain: Terrain,
    resources: ResourceTracker,
    private readonly camera: Camera,
    private readonly light: boolean,
  ) {
    this.group.name = 'faune d’ambiance';
    for (const clip of library.animations(FAUNA_FILE)) this.clips.set(clip.name, clip);
    const b = this.settings.butterflies;
    const count = light ? b.countLight : b.count;
    const geometry = resources.track(new ShapeBuilder().add(wingGeometry(), 'white_paint', [0, 0, 0]).build());
    this.wings = createInstanced('papillons', geometry, materials.palette, count * 2);
    // Trop petits pour une ombre lisible; le cadre est testé ici sur le pré entier.
    this.wings.castShadow = false;
    this.wings.receiveShadow = false;
    this.wings.frustumCulled = false;
    this.group.add(this.wings);
    const rects = b.zones.map((id) => map.zones[id]).filter((r) => r !== undefined);
    const first = rects[0];
    if (first !== undefined) {
      let minX = first.x;
      let minY = first.y;
      let maxX = first.x + first.w;
      let maxY = first.y + first.h;
      for (const r of rects) {
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.w);
        maxY = Math.max(maxY, r.y + r.h);
      }
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      this.meadow.center.set(cx, terrain.heightAt(cx, cy) + MEADOW_TOP / 2, cy);
      this.meadow.radius = Math.hypot(maxX - minX + 2 * b.roam, maxY - minY + 2 * b.roam, MEADOW_TOP) / 2;
    }
  }

  /** Hauteur du sommet d'un objet de la carte (boîte de ses pièces posées). */
  private topOf(prop: MapProp): number {
    const ground = this.terrain.heightAt(prop.pos.x, prop.pos.y);
    const placement = propMatrix(prop, ground, new Matrix4());
    let top = ground;
    for (const part of this.library.parts(prop.model, propHints(prop), prop.id)) {
      part.geometry.computeBoundingBox();
      const box = part.geometry.boundingBox;
      if (box === null) continue;
      const world = box.clone().applyMatrix4(tmpMatrix.multiplyMatrices(placement, part.matrix));
      top = Math.max(top, world.max.y);
    }
    return top;
  }

  /** Tirages de la partie (au premier passage, et si la graine change: nouvelle partie). */
  private build(seed: number): void {
    this.seed = seed;
    for (const bird of this.birds) {
      bird.mixer?.stopAllAction();
      bird.root.removeFromParent();
    }
    this.birds.length = 0;
    this.butterflies.length = 0;
    const s = this.settings;
    const wanted = this.light ? s.birds.countLight : s.birds.count;
    this.perches = this.library.has(s.birds.model) ? choosePerches(this.map, seed, wanted, (p) => this.topOf(p), s.birds) : [];
    this.perches.forEach((_, index) => {
      const model = this.library.cloneAnimal(s.birds.model);
      if (model === null) return;
      const root = new Group();
      root.name = `mésange d’ambiance ${String(index)}`;
      root.add(model);
      root.visible = false;
      model.traverse((object) => {
        object.castShadow = true;
        object.frustumCulled = false;
      });
      this.group.add(root);
      const neighbour = (index + 1) % this.perches.length;
      this.birds.push({
        root,
        mixer: this.clips.size > 0 ? new AnimationMixer(model) : null,
        actions: new Map(),
        clip: '',
        perches: neighbour === index ? [index] : [index, neighbour],
        perch: index,
        state: 'gone',
        since: 0,
        duration: 0,
        from: new Vector3(),
        control: new Vector3(),
        to: new Vector3(),
        yaw: faunaUnit(seed, index, 5) * TWO_PI,
        nextIdle: 0,
        singUntil: 0,
        rank: 0,
        settled: true,
      });
    });
    const b = s.butterflies;
    const homes = chooseButterflyHomes(this.map, seed, this.light ? b.countLight : b.count, b.zones);
    const color = new Color();
    this.wings.count = 0;
    homes.forEach((home, i) => {
      const cell = b.colors[Math.floor(faunaUnit(seed, i, 31) * b.colors.length)] ?? 'flower_white';
      this.materials.paletteColor(cell, color);
      this.wings.setColorAt(i * 2, color);
      this.wings.setColorAt(i * 2 + 1, color);
      const z = this.terrain.heightAt(home.x, home.y) + b.restHeight;
      this.butterflies.push({
        home,
        from: new Vector3(home.x, z, home.y),
        to: new Vector3(home.x, z, home.y),
        since: 0,
        duration: 0,
        resting: true,
        legsLeft: 0,
        rank: 0,
        flapHz: lerp(b.flapHz[0], b.flapHz[1], faunaUnit(seed, i, 37)),
        phase: faunaUnit(seed, i, 41) * 10,
        yaw: faunaUnit(seed, i, 43) * TWO_PI,
      });
    });
    this.wings.count = homes.length * 2;
    finishInstances(this.wings);
    this.wings.frustumCulled = false;
  }

  update(context: FrameContext): void {
    const world = context.world;
    if (this.seed !== world.seed) this.build(world.seed);
    this.camera.updateMatrixWorld();
    this.viewProjection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProjection);
    const minutes = world.clock.minutes;
    const s = this.settings;
    const birdsOn = world.phase === 'day' && faunaActive(s.birds.hours, s.birds.weathers, minutes, world.weather);
    const butterfliesOn =
      world.phase === 'day' && faunaActive(s.butterflies.hours, s.butterflies.weathers, minutes, world.weather);
    for (let i = 0; i < this.birds.length; i += 1) {
      const bird = this.birds[i];
      if (bird !== undefined) this.updateBird(bird, i, birdsOn, context);
    }
    this.updateButterflies(butterfliesOn, context);
  }

  private random(index: number, rank: number, salt: number): number {
    return faunaUnit(this.seed ?? 0, index * 7919 + rank, salt);
  }

  /** Distance du joueur dehors le plus proche de ce point (m). */
  nearestPlayer(context: FrameContext, x: number, y: number): number {
    let best = Infinity;
    for (const c of context.world.characters) {
      if (c.inHouse) continue;
      best = Math.min(best, Math.hypot(c.pos.x - x, c.pos.y - y));
    }
    return best;
  }

  /** Perchoir (copie), ou `undefined`. */
  perchAt(index: number): Perch | undefined {
    return this.perches[index];
  }

  private perchPoint(index: number, out: Vector3): Vector3 {
    const p = this.perches[index];
    return p === undefined ? out.set(0, 0, 0) : out.set(p.x, p.z, p.y);
  }

  private refugePoint(index: number, out: Vector3): Vector3 {
    const p = this.perches[index];
    if (p === undefined) return out.set(0, 0, 0);
    return out.set(p.refuge.x, this.terrain.heightAt(p.refuge.x, p.refuge.y) + p.refuge.z, p.refuge.y);
  }

  /** Vol en arc de `from` à `to`, à la vitesse des réglages. */
  private fly(bird: Bird, state: 'leaving' | 'arriving', time: number): void {
    const s = this.settings.birds;
    bird.state = state;
    bird.since = time;
    bird.duration = Math.max(0.3, bird.from.distanceTo(bird.to) / s.flySpeed);
    bird.control.addVectors(bird.from, bird.to).multiplyScalar(0.5);
    bird.control.y = Math.max(bird.from.y, bird.to.y) + s.arcHeight;
  }

  private updateBird(bird: Bird, index: number, on: boolean, context: FrameContext): void {
    const s = this.settings.birds;
    const time = context.time;
    if (!on) {
      bird.state = 'gone';
      bird.root.visible = false;
      return;
    }
    if (bird.state === 'gone' && bird.settled && perchClear(this, bird, context)) {
      bird.state = 'perched';
      bird.nextIdle = time + lerp(s.idleEverySeconds[0], s.idleEverySeconds[1], this.random(index, bird.rank++, 17));
    }
    bird.settled = false;
    if (bird.state === 'gone') {
      // Arrivée échelonnée au matin, ou à la fin de la pluie.
      bird.state = 'away';
      bird.since = time;
      bird.duration = lerp(0, s.awaySeconds[1], this.random(index, bird.rank++, 7));
    }
    const perch = this.perches[bird.perch];
    if (bird.state === 'perched' && perch !== undefined) {
      if (this.nearestPlayer(context, perch.x, perch.y) < s.flushRadius) {
        this.perchPoint(bird.perch, bird.from);
        this.refugePoint(bird.perch, bird.to);
        this.fly(bird, 'leaving', time);
      } else if (time >= bird.nextIdle) {
        if (this.random(index, bird.rank++, 9) < s.singShare) {
          bird.singUntil = time + (this.clips.get(SING_CLIP)?.duration ?? 1);
        } else {
          bird.yaw += (this.random(index, bird.rank++, 13) - 0.5) * Math.PI;
        }
        bird.nextIdle = time + lerp(s.idleEverySeconds[0], s.idleEverySeconds[1], this.random(index, bird.rank++, 17));
      }
    } else if (bird.state === 'leaving' || bird.state === 'arriving') {
      if (time - bird.since >= bird.duration) {
        if (bird.state === 'leaving') {
          bird.state = 'away';
          bird.since = time;
          bird.duration = lerp(s.awaySeconds[0], s.awaySeconds[1], this.random(index, bird.rank++, 19));
        } else {
          bird.state = 'perched';
          bird.nextIdle = time + lerp(s.idleEverySeconds[0], s.idleEverySeconds[1], this.random(index, bird.rank++, 17));
        }
      }
    } else if (bird.state === 'away' && time - bird.since >= bird.duration) {
      const start = Math.floor(this.random(index, bird.rank++, 23) * bird.perches.length);
      let chosen: number | null = null;
      for (let k = 0; k < bird.perches.length && chosen === null; k += 1) {
        const candidate = bird.perches[(start + k) % bird.perches.length];
        const p = candidate === undefined ? undefined : this.perches[candidate];
        if (candidate !== undefined && p !== undefined && this.nearestPlayer(context, p.x, p.y) >= s.returnClear) chosen = candidate;
      }
      if (chosen === null) {
        bird.since = time;
        bird.duration = RETRY_SECONDS;
      } else {
        bird.perch = chosen;
        this.refugePoint(chosen, bird.from);
        this.perchPoint(chosen, bird.to);
        this.fly(bird, 'arriving', time);
      }
    }
    this.drawBird(bird, context);
  }

  private drawBird(bird: Bird, context: FrameContext): void {
    if (bird.state === 'away' || bird.state === 'gone') {
      bird.root.visible = false;
      return;
    }
    let clip = PERCH_CLIP;
    if (bird.state === 'perched') {
      this.perchPoint(bird.perch, tmpPosition);
      if (context.time < bird.singUntil) clip = SING_CLIP;
    } else {
      const t = Math.min(1, (context.time - bird.since) / bird.duration);
      bezier(bird.from, bird.control, bird.to, t, tmpPosition);
      // Cap: la tangente de l'arc.
      tmpTangent.set(
        2 * (1 - t) * (bird.control.x - bird.from.x) + 2 * t * (bird.to.x - bird.control.x),
        0,
        2 * (1 - t) * (bird.control.z - bird.from.z) + 2 * t * (bird.to.z - bird.control.z),
      );
      if (tmpTangent.lengthSq() > 1e-6) bird.yaw = yawFromFacing(Math.atan2(tmpTangent.z, tmpTangent.x));
      clip = FLY_CLIP;
    }
    tmpSphere.center.copy(tmpPosition);
    tmpSphere.radius = BIRD_RADIUS;
    if (!this.frustum.intersectsSphere(tmpSphere)) {
      bird.root.visible = false;
      return;
    }
    bird.root.visible = true;
    bird.root.position.copy(tmpPosition);
    bird.root.rotation.y = bird.yaw;
    this.play(bird, clip);
    bird.mixer?.update(context.dt);
  }

  private play(bird: Bird, name: string): void {
    if (bird.mixer === null || bird.clip === name) return;
    const clip = this.clips.get(name);
    if (clip === undefined) return;
    let action = bird.actions.get(name);
    if (action === undefined) {
      action = bird.mixer.clipAction(clip);
      bird.actions.set(name, action);
    }
    const once = name === SING_CLIP;
    action.reset();
    action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    const previous = bird.actions.get(bird.clip);
    if (previous === undefined) action.play();
    else {
      action.fadeIn(CLIP_FADE).play();
      previous.fadeOut(CLIP_FADE);
    }
    bird.clip = name;
  }

  /** Prochain bond d'un papillon: vers un point du pré autour de sa fleur, ou posé sur une tête d'herbe. */
  private nextLeg(fly: Butterfly, index: number, time: number): void {
    const b = this.settings.butterflies;
    fly.from.copy(fly.to);
    fly.since = time;
    const r = (k: number): number => this.random(index, fly.rank++, k);
    if (!fly.resting && fly.legsLeft <= 0) {
      // Se pose là où il est arrivé: descend sur l'herbe.
      fly.resting = true;
      fly.to.set(fly.from.x, this.terrain.heightAt(fly.from.x, fly.from.z) + b.restHeight, fly.from.z);
      fly.duration = lerp(b.restSeconds[0], b.restSeconds[1], r(47));
      return;
    }
    if (fly.resting) fly.legsLeft = Math.round(lerp(b.legsBeforeRest[0], b.legsBeforeRest[1], r(53)));
    fly.resting = false;
    fly.legsLeft -= 1;
    const angle = r(59) * TWO_PI;
    const distance = b.roam * Math.sqrt(r(61));
    const x = fly.home.x + Math.cos(angle) * distance;
    const y = fly.home.y + Math.sin(angle) * distance;
    fly.to.set(x, this.terrain.heightAt(x, y) + lerp(b.height[0], b.height[1], r(67)), y);
    fly.duration = Math.max(0.4, fly.from.distanceTo(fly.to) / lerp(b.speed[0], b.speed[1], r(71)));
  }

  private updateButterflies(on: boolean, context: FrameContext): void {
    const mesh = this.wings;
    if (!on || this.butterflies.length === 0 || !this.frustum.intersectsSphere(this.meadow)) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    const b = this.settings.butterflies;
    const time = context.time;
    const size = (b.wingspan / 2) * b.displayScale;
    for (let i = 0; i < this.butterflies.length; i += 1) {
      const fly = this.butterflies[i];
      if (fly === undefined) continue;
      // Rattrapage borné: un long passage hors du cadre ne rejoue qu'un bond.
      if (time - fly.since >= fly.duration) {
        if (time - fly.since > fly.duration + 1) fly.since = time - fly.duration;
        this.nextLeg(fly, i, time);
      }
      const t = Math.min(1, (time - fly.since) / fly.duration);
      let wing: number;
      if (fly.resting) {
        const settle = Math.min(1, (time - fly.since) / 0.6);
        const ease = settle * settle * (3 - 2 * settle);
        tmpPosition.lerpVectors(fly.from, fly.to, ease);
        const slow = 0.5 + 0.5 * Math.sin(TWO_PI * REST_FLAP_HZ * time + fly.phase);
        const flapping = 0.5 + 0.5 * Math.sin(TWO_PI * fly.flapHz * time + fly.phase);
        wing = lerp(lerp(WING_LOW, WING_HIGH, flapping), lerp(WING_CLOSED, WING_RESTING_OPEN, slow), ease);
      } else {
        const ease = t * t * (3 - 2 * t);
        tmpPosition.lerpVectors(fly.from, fly.to, ease);
        const dx = fly.to.x - fly.from.x;
        const dz = fly.to.z - fly.from.z;
        const length = Math.hypot(dx, dz);
        if (length > 1e-3) {
          // Zigzag de côté, nul aux deux bouts du bond.
          const side = Math.sin(TWO_PI * WOBBLE_HZ * (time + fly.phase)) * WOBBLE * Math.sin(Math.PI * t);
          tmpPosition.x += (-dz / length) * side;
          tmpPosition.z += (dx / length) * side;
          fly.yaw = yawFromFacing(Math.atan2(dz, dx));
        }
        const flap = 0.5 + 0.5 * Math.sin(TWO_PI * fly.flapHz * time + fly.phase);
        tmpPosition.y += (flap - 0.5) * BOB;
        wing = lerp(WING_LOW, WING_HIGH, flap);
      }
      tmpYaw.setFromAxisAngle(Y_AXIS, fly.yaw);
      for (let side = 0; side < 2; side += 1) {
        const mirror = side === 0 ? 1 : -1;
        tmpRoll.setFromAxisAngle(Z_AXIS, wing * mirror);
        tmpRotation.multiplyQuaternions(tmpYaw, tmpRoll);
        tmpScale.set(size * mirror, size, size);
        mesh.setMatrixAt(i * 2 + side, tmpMatrix.compose(tmpPosition, tmpRotation, tmpScale));
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const bird of this.birds) {
      bird.mixer?.stopAllAction();
      bird.root.removeFromParent();
    }
    this.birds.length = 0;
    this.group.removeFromParent();
  }
}
