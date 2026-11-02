/**
 * La voie et ce qui vit autour: les rails (modules instanciés le long des
 * cases de ballast), le train du samedi (entrée et départ en glissement,
 * fumée), les barrières du passage à niveau qui se baissent à son passage, la
 * remise de la draisine (portes qui s'ouvrent à la fin) et l'horloge de la
 * halte, à l'heure du jeu.
 */
import type { Object3D } from 'three';
import { AnimationMixer, Group, Matrix4, Mesh } from 'three';
import type { GameMap, MapProp } from '../etat/carte';
import type { TrainPhase } from '../etat/types';
import { smoothFactor } from './camera';
import { yawFromFacing, type FrameContext } from './contexte';
import { propHints, propMatrix, type ClockHand } from './decor';
import { ShapeBuilder } from './geometrie';
import { InstancedBatches } from './lots';
import type { SharedMaterials } from './materiaux';
import type { ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import { applyShadows } from './ombre-tri';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

const TRAIN = RENDER_SETTINGS.train;
const RAIL_MODEL = 'rail_straight';
const RAIL_MODULE_LENGTH = 4;
const DEFAULT_RAIL_TOP = 0.32;
const RAIL_CAPACITY = 64;
/** Voitures du train, de l'arrière (ouest) à la locomotive (est), avec leur longueur par défaut (m). */
const CARS = [
  { model: 'van', length: 7 },
  { model: 'coach', length: 9 },
  { model: 'locomotive', length: 7.4 },
] as const;
const TRAIN_FILE = 'train.glb';
/** Rayon des roues des modèles de l'artiste (m): vitesse de rotation des roues. */
const WHEEL_RADIUS = 0.49;
const GATE_MODEL = 'level_crossing_gate';
/** Nœud du bras dans `bourg.glb` (enfant de `level_crossing_gate`), tourné autour de Z. */
export const GATE_ARM = 'level_crossing_gate_arm';
const GATE_HALF_LIFE = 0.35;
/** Bras baissé (en travers de la route) et levé, en radians autour de Z. */
export const GATE_CLOSED = 0;
export const GATE_OPEN = Math.PI / 2;
const SHED_MODEL = 'handcar_shed';
const SHED_DOOR_ANGLE = (100 * Math.PI) / 180;
const SHED_HALF_LIFE = 0.5;
const HANDCAR_MODEL = 'handcar';
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DIAL = 12;
const MINUTES_PER_DIAL = 720;

/**
 * Décalage du train le long de la voie (m) depuis son arrêt au quai, selon la
 * phase et `progress` de la simulation: à l'arrivée `progress` va de 0 à 1
 * (le train ralentit jusqu'au quai), au départ il va de 1 à 0 (le train
 * accélère en s'éloignant du même côté, sans saut). `NaN` quand il est parti.
 */
/** Les lisses barrent la route pendant que le train roule (arrivée et départ), pas à quai ni absent. */
/** Rangées de la ligne (plus de la moitié de la largeur en voie) et axe de la voie (y, m). */
export function mainLine(map: GameMap): { rows: Set<number>; trackY: number } {
  const railRows: number[] = [];
  for (let cy = 0; cy < map.height; cy += 1) {
    let rails = 0;
    for (let cx = 0; cx < map.width; cx += 1) {
      if (map.ground[cy * map.width + cx] === 'rail') {
        rails += 1;
      }
    }
    if (rails > map.width / 2) {
      railRows.push(cy);
    }
  }
  const first = railRows[0] ?? 0;
  const last = railRows[railRows.length - 1] ?? first;
  return { rows: new Set(railRows), trackY: (first + last + 1) / 2 };
}

/** Plaque tournante au pied d'une voie de garage (centre sur l'axe de la ligne, m). */
export interface Turntable {
  x: number;
  y: number;
  radius: number;
  /** Côté de la voie de garage: -1 au nord de la ligne, 1 au sud. */
  side: -1 | 1;
}

/**
 * Retour R20 (2026-11-01): la voie de garage de la remise, perpendiculaire à la ligne, semblait
 * filer sous la halte (vue orientée 1, sa jonction tombe derrière le toit). Une voie de garage
 * à angle droit se raccorde à la ligne par une plaque tournante: la draisine y sort de la
 * remise vers le sud, y pivote, et repart vers l'ouest sur la ligne (trajet de la simulation,
 * `carry.handcar.path`). Une plaque par colonne de voie de garage qui touche la ligne.
 */
export function sidingTurntables(map: GameMap): Turntable[] {
  const { rows, trackY } = mainLine(map);
  if (rows.size === 0) return [];
  const isRail = (cx: number, cy: number): boolean =>
    cx >= 0 &&
    cy >= 0 &&
    cx < map.width &&
    cy < map.height &&
    map.ground[cy * map.width + cx] === 'rail';
  const first = Math.min(...rows);
  const last = Math.max(...rows);
  const plates: Turntable[] = [];
  for (let cx = 0; cx < map.width; cx += 1) {
    for (const [row, side] of [
      [first - 1, -1],
      [last + 1, 1],
    ] as const) {
      // Colonne de voie hors de la ligne, sans voisine de voie à l'ouest ni à l'est.
      if (isRail(cx, row) && !isRail(cx - 1, row) && !isRail(cx + 1, row)) {
        plates.push({
          x: cx + 0.5,
          y: trackY,
          radius: RENDER_SETTINGS.railway.turntableRadius,
          side,
        });
      }
    }
  }
  return plates;
}

export function gateClosed(phase: TrainPhase): boolean {
  return phase === 'arriving' || phase === 'departing';
}

/** Angle du bras après une image: il rejoint sa cible selon la demi-vie (immédiat si mouvement réduit). */
export function gateAngleStep(
  angle: number,
  phase: TrainPhase,
  dt: number,
  reducedMotion: boolean,
): number {
  const target = gateClosed(phase) ? GATE_CLOSED : GATE_OPEN;
  return angle + (target - angle) * smoothFactor(dt, reducedMotion ? 0 : GATE_HALF_LIFE);
}

export function trainOffset(phase: TrainPhase, progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  const away = TRAIN.slideDistance * TRAIN.sideDirection;
  switch (phase) {
    case 'away':
      return Number.NaN;
    case 'arriving':
      return away * (1 - easeOut(p));
    case 'stopped':
      return 0;
    case 'departing':
      return away * easeIn(1 - p);
  }
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

function easeIn(t: number): number {
  return t * t * t;
}

export class RailwayPart implements EventfulPart {
  readonly group = new Group();
  /** Rails par tronçons de `chunkSize`: ceux hors du cadre sont éliminés. */
  private readonly rails: InstancedBatches[] = [];
  private readonly train = new Group();
  private readonly cars: Object3D[] = [];
  private readonly trackY: number;
  private readonly stopX: number;
  private readonly railTop: number;
  private readonly gates: { arm: Object3D | null; angle: number }[] = [];
  private shed: {
    left: Object3D | null;
    right: Object3D | null;
    handcar: Object3D | null;
    amount: number;
  } | null = null;
  /** Draisine poussée au bout de la voie (`world.handcarAt`), créée à sa première sortie. */
  private parked: Object3D | null = null;
  private trainX = Number.NaN;
  private readonly mixers: { mixer: AnimationMixer; duration: number }[] = [];
  private smokeAnchor: Object3D | null = null;

  /** Point d'émission du panache de la locomotive (nœud `locomotive_smoke`), ou `null`. */
  smokeEmitter(): Object3D | null {
    return this.smokeAnchor;
  }

  /** Le train est-il visible (et en mouvement) à cette image ? */
  trainState(): { visible: boolean; moving: boolean } {
    return { visible: this.train.visible, moving: this.moving };
  }

  private moving = false;

  constructor(
    private readonly map: GameMap,
    private readonly library: ModelLibrary,
    materials: SharedMaterials,
    private readonly terrain: Terrain,
    resources: ResourceTracker,
    private readonly clockHands: readonly ClockHand[],
  ) {
    this.group.name = 'voie';
    const line = mainLine(map);
    this.trackY = line.trackY;
    this.stopX = map.points.train_stop?.x ?? map.width / 2;
    const top = library.extras(RAIL_MODEL).rail_top;
    this.railTop = typeof top === 'number' ? top : DEFAULT_RAIL_TOP;

    if (line.rows.size > 0) {
      this.layRails(materials, resources);
    }

    this.train.name = 'train';
    let x = 0;
    const clips = library.animations(TRAIN_FILE);
    for (const car of CARS) {
      const name = library.resolve(car.model);
      const declared = library.extras(name).length_over_buffers;
      const length = typeof declared === 'number' ? declared : car.length;
      // Les voitures de l'artiste sont dans l'axe X (avant vers +X): la voie va d'ouest en est.
      const object = library.instantiate(name);
      object.position.set(x + length / 2, 0, 0);
      applyShadows(object);
      this.train.add(object);
      this.cars.push(object);
      const roll = clips.find((clip) => clip.name === `${name}_roll`);
      if (roll !== undefined) {
        const mixer = new AnimationMixer(object);
        mixer.clipAction(roll).play();
        this.mixers.push({ mixer, duration: roll.duration });
      }
      const anchor = library.extras(name).smoke_anchor;
      if (typeof anchor === 'string') {
        this.smokeAnchor = object.getObjectByName(anchor) ?? null;
      }
      x += length + TRAIN.carSpacing;
    }
    // La porte de la voiture des voyageurs s'arrête devant `train_stop`.
    const coach = this.cars[1];
    const coachOffset = coach === undefined ? 0 : coach.position.x;
    for (const car of this.cars) {
      car.position.x -= coachOffset;
    }
    this.train.visible = false;
    this.group.add(this.train);

    for (const prop of map.props.filter((candidate) => candidate.model === GATE_MODEL)) {
      this.gates.push(
        this.placeProp(prop, (object) => ({
          arm: object.getObjectByName(GATE_ARM) ?? null,
          angle: GATE_OPEN,
        })),
      );
    }
    const shedProp = map.props.find((candidate) => candidate.model === SHED_MODEL);
    if (shedProp !== undefined) {
      this.shed = this.placeProp(shedProp, (object) => {
        const handcar = library.has(HANDCAR_MODEL) ? library.instantiate(HANDCAR_MODEL) : null;
        if (handcar !== null) {
          handcar.visible = false;
          object.add(handcar);
        }
        return {
          left: object.getObjectByName(`${SHED_MODEL}_door_l`) ?? null,
          right: object.getObjectByName(`${SHED_MODEL}_door_r`) ?? null,
          handcar,
          amount: 0,
        };
      });
    }
  }

  /** Draisine posée au bout de la voie: lue dans l'état (donc aussi après une sauvegarde rechargée). */
  private updateParked(context: FrameContext): void {
    const at = context.world.handcarAt;
    if (at === null || context.world.beam?.purpose === 'handcar') {
      if (this.parked !== null) {
        this.parked.visible = false;
      }
      return;
    }
    if (this.parked === null) {
      this.parked = this.library.instantiate(HANDCAR_MODEL);
      this.parked.traverse((object) => {
        object.castShadow = true;
      });
      this.group.add(this.parked);
    }
    this.parked.visible = true;
    this.parked.position.set(at.pos.x, this.terrain.heightAt(at.pos.x, at.pos.y), at.pos.y);
    this.parked.rotation.y = yawFromFacing(at.facing);
  }

  private placeProp<T>(prop: MapProp, bind: (object: Object3D) => T): T {
    const object = this.library.instantiate(prop.model, propHints(prop), prop.id);
    const matrix = propMatrix(prop, this.terrain.heightAt(prop.pos.x, prop.pos.y), new Matrix4());
    matrix.decompose(object.position, object.quaternion, object.scale);
    object.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
    this.group.add(object);
    return bind(object);
  }

  private layRails(materials: SharedMaterials, resources: ResourceTracker): void {
    const ext = RENDER_SETTINGS.terrain.extension;
    const chunk = RENDER_SETTINGS.terrain.stripSegment;
    const matrix = new Matrix4();
    const ground = this.terrain.heightAt(this.map.width / 2, this.trackY);
    let segment: InstancedBatches | null = null;
    let segmentIndex = -1;
    for (let x = -ext + RAIL_MODULE_LENGTH / 2; x < this.map.width + ext; x += RAIL_MODULE_LENGTH) {
      const index = Math.floor((x + ext) / chunk);
      if (segment === null || index !== segmentIndex) {
        segment?.end();
        segment = new InstancedBatches(
          'rails',
          this.library,
          materials,
          resources,
          RAIL_CAPACITY,
          false,
        );
        segmentIndex = index;
        this.rails.push(segment);
        this.group.add(segment.group);
        segment.begin();
      }
      segment.add(RAIL_MODEL, matrix.makeTranslation(x, ground, this.trackY));
    }
    segment?.end();
    this.laySidings(materials, resources, ground);
  }

  /**
   * Voies de garage (remise de la draisine): colonnes de cases de voie au
   * nord ou au sud de la ligne, rails posés dans l'axe nord-sud jusqu'à elle.
   * Les bouts de rails du modèle de la remise restent sous ses portes.
   */
  private laySidings(materials: SharedMaterials, resources: ResourceTracker, ground: number): void {
    const map = this.map;
    const rows = new Set<number>();
    for (let cy = Math.floor(this.trackY - 1.5); cy <= Math.ceil(this.trackY + 0.5); cy += 1) {
      rows.add(cy);
    }
    const isRail = (cx: number, cy: number): boolean =>
      cx >= 0 &&
      cy >= 0 &&
      cx < map.width &&
      cy < map.height &&
      map.ground[cy * map.width + cx] === 'rail';
    const batch = new InstancedBatches(
      'voies de garage',
      this.library,
      materials,
      resources,
      RAIL_CAPACITY,
      false,
    );
    const matrix = new Matrix4();
    const turn = new Matrix4().makeRotationY(Math.PI / 2);
    const plates = sidingTurntables(map);
    this.layTurntables(plates, materials, resources, ground);
    let any = false;
    batch.begin();
    for (let cx = 0; cx < map.width; cx += 1) {
      for (let cy = 0; cy < map.height; cy += 1) {
        // Début d'une colonne de voie hors de la ligne (ni case voisine de voie à l'ouest ni à l'est).
        if (
          rows.has(cy) ||
          !isRail(cx, cy) ||
          isRail(cx, cy - 1) ||
          isRail(cx - 1, cy) ||
          isRail(cx + 1, cy)
        ) {
          continue;
        }
        let end = cy;
        while (isRail(cx, end + 1) && !rows.has(end + 1)) {
          end += 1;
        }
        // Jusqu'au bord de la ligne, ou de sa plaque tournante; un module plus long que la colonne
        // déborde sous la remise.
        const plate = plates.find((candidate) => candidate.x === cx + 0.5 && candidate.side < 0);
        const from = cy;
        const to = plate === undefined ? end + 1 : plate.y - plate.radius;
        for (
          let z = from + RAIL_MODULE_LENGTH / 2;
          z - RAIL_MODULE_LENGTH / 2 < to - 1e-3;
          z += RAIL_MODULE_LENGTH
        ) {
          const centre = Math.min(z, to - RAIL_MODULE_LENGTH / 2);
          matrix.makeTranslation(cx + 0.5, ground, centre).multiply(turn);
          batch.add(RAIL_MODEL, matrix);
          any = true;
        }
        cy = end;
      }
    }
    batch.end();
    if (any) {
      this.rails.push(batch);
      this.group.add(batch.group);
    }
  }

  /**
   * Plaques tournantes (R20): fosse cerclée de pierre au ras du ballast, tablier de planches
   * (posées nord-sud, comme la voie de garage) sous les traverses de la ligne, pivot de fonte.
   * Un seul maillage pour toutes, matériau palette (aucun programme de plus).
   */
  private layTurntables(
    plates: readonly Turntable[],
    materials: SharedMaterials,
    resources: ResourceTracker,
    ground: number,
  ): void {
    if (plates.length === 0) return;
    const look = RENDER_SETTINGS.railway;
    const shape = new ShapeBuilder();
    for (const plate of plates) {
      const r = plate.radius;
      const deck = r - look.turntableRim;
      shape.cylinder(r, r, look.rimTop, [plate.x, ground, plate.y], 'stone_dark', {
        base: true,
        segments: look.turntableSegments,
      });
      shape.cylinder(deck, deck, look.deckTop, [plate.x, ground, plate.y], 'wood_dark', {
        base: true,
        segments: look.turntableSegments,
      });
      const count = Math.floor((2 * deck) / look.plankWidth);
      for (let i = 0; i < count; i += 1) {
        const x = -deck + (i + 0.5) * ((2 * deck) / count);
        const length = 2 * Math.sqrt(Math.max(0, deck * deck - x * x)) - look.plankWidth * 0.5;
        if (length <= 0) continue;
        shape.box(
          [((2 * deck) / count) * 0.9, look.plankHeight, length],
          [plate.x + x, ground + look.deckTop, plate.y],
          i % 3 === 1 ? 'wood_old' : 'wood',
          { base: true },
        );
      }
      shape.cylinder(
        0.12,
        0.12,
        look.deckTop + look.plankHeight + 0.015,
        [plate.x, ground, plate.y],
        'iron',
        {
          base: true,
        },
      );
    }
    const mesh = new Mesh(resources.track(shape.build()), materials.palette);
    mesh.name = 'plaques tournantes';
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  update(context: FrameContext): void {
    const state = context.world.train;
    const progress = state.prevProgress + (state.progress - state.prevProgress) * context.alpha;
    const offset = trainOffset(state.phase, progress);
    const visible = !Number.isNaN(offset);
    this.train.visible = visible;
    const moving = visible && state.phase !== 'stopped';
    this.moving = moving;
    if (visible) {
      const x = this.stopX + offset;
      this.train.position.set(
        x,
        this.terrain.heightAt(this.stopX, this.trackY) + this.railTop - DEFAULT_RAIL_TOP,
        this.trackY,
      );
      this.train.updateMatrixWorld(true);
      const speed = Number.isNaN(this.trainX)
        ? 0
        : Math.abs(x - this.trainX) / Math.max(context.dt, Number.EPSILON);
      this.trainX = x;
      // Roues qui tournent au rythme du glissement (une révolution par clip).
      for (const entry of this.mixers) {
        entry.mixer.update((speed * context.dt * entry.duration) / (2 * Math.PI * WHEEL_RADIUS));
      }
    } else {
      this.trainX = Number.NaN;
    }

    for (const gate of this.gates) {
      gate.angle = gateAngleStep(gate.angle, state.phase, context.dt, context.reducedMotion);
      if (gate.arm !== null) {
        gate.arm.rotation.z = gate.angle;
      }
    }

    if (this.shed !== null) {
      const open = context.world.worldStates.handcar_shed === 'open';
      this.shed.amount +=
        ((open ? 1 : 0) - this.shed.amount) *
        smoothFactor(context.dt, context.reducedMotion ? 0 : SHED_HALF_LIFE);
      if (this.shed.left !== null) {
        this.shed.left.rotation.y = -SHED_DOOR_ANGLE * this.shed.amount;
      }
      if (this.shed.right !== null) {
        this.shed.right.rotation.y = SHED_DOOR_ANGLE * this.shed.amount;
      }
      if (this.shed.handcar !== null) {
        // Sortie de la remise, la draisine est une charge à deux (`vie.ts`), puis posée au bout de la voie.
        this.shed.handcar.visible =
          open && context.world.beam?.purpose !== 'handcar' && context.world.handcarAt === null;
      }
    }

    this.updateParked(context);

    const minutes = context.world.clock.minutes;
    for (const hand of this.clockHands) {
      const turns =
        hand.kind === 'hour'
          ? (minutes % MINUTES_PER_DIAL) / MINUTES_PER_DIAL
          : (minutes % MINUTES_PER_HOUR) / MINUTES_PER_HOUR;
      hand.mesh.matrix
        .copy(hand.base)
        .multiply(this.handRotation.makeRotationZ(-turns * Math.PI * 2));
    }
  }

  private readonly handRotation = new Matrix4();

  dispose(): void {
    this.group.removeFromParent();
  }
}

export { HOURS_PER_DIAL };
