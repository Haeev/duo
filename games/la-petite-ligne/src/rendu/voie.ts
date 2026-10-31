/**
 * La voie et ce qui vit autour: les rails (modules instanciés le long des
 * cases de ballast), le train du samedi (entrée et départ en glissement,
 * fumée), les barrières du passage à niveau qui se baissent à son passage, la
 * remise de la draisine (portes qui s'ouvrent à la fin) et l'horloge de la
 * halte, à l'heure du jeu.
 */
import { AnimationMixer, Group, Matrix4, Object3D, Vector3 } from 'three';
import type { GameMap, MapProp } from '../etat/carte';
import type { WorldEvent } from '../etat/types';
import { smoothFactor } from './camera';
import type { FrameContext } from './contexte';
import { propHints, propMatrix, type ClockHand } from './decor';
import type { EffectsPart } from './effets';
import { InstancedBatches } from './lots';
import type { SharedMaterials } from './materiaux';
import type { ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
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
/** Cheminée de la locomotive, dans son repère, si le modèle n'a pas de point `smoke_anchor`. */
const CHIMNEY = new Vector3(2.95, 3.4, 0);
const TRAIN_FILE = 'train.glb';
/** Rayon des roues des modèles de l'artiste (m): vitesse de rotation des roues. */
const WHEEL_RADIUS = 0.49;
const GATE_MODEL = 'level_crossing_gate';
const GATE_ARM = 'level_crossing_arm';
const GATE_HALF_LIFE = 0.35;
const GATE_CLOSED = 0;
const GATE_OPEN = Math.PI / 2;
const SHED_MODEL = 'handcar_shed';
const SHED_DOOR_ANGLE = (100 * Math.PI) / 180;
const SHED_HALF_LIFE = 0.5;
const HANDCAR_MODEL = 'handcar';
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DIAL = 12;
const MINUTES_PER_DIAL = 720;
const WHISTLE_PUFFS = 6;

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

function easeIn(t: number): number {
  return t * t * t;
}

export class RailwayPart implements EventfulPart {
  readonly group = new Group();
  private readonly rails: InstancedBatches;
  private readonly train = new Group();
  private readonly cars: Object3D[] = [];
  private readonly trackY: number;
  private readonly stopX: number;
  private readonly railTop: number;
  private readonly gates: { arm: Object3D | null; angle: number }[] = [];
  private shed: { left: Object3D | null; right: Object3D | null; handcar: Object3D | null; amount: number } | null = null;
  private smokeTimer = 0;
  private trainX = Number.NaN;
  private readonly chimney = new Vector3();
  private readonly mixers: { mixer: AnimationMixer; duration: number }[] = [];
  private smokeAnchor: Object3D | null = null;

  constructor(
    private readonly map: GameMap,
    private readonly library: ModelLibrary,
    materials: SharedMaterials,
    private readonly terrain: Terrain,
    resources: ResourceTracker,
    private readonly effects: EffectsPart,
    private readonly clockHands: readonly ClockHand[],
  ) {
    this.group.name = 'voie';
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
    this.trackY = (first + last + 1) / 2;
    this.stopX = map.points.train_stop?.x ?? map.width / 2;
    const top = library.extras(RAIL_MODEL).rail_top;
    this.railTop = typeof top === 'number' ? top : DEFAULT_RAIL_TOP;

    this.rails = new InstancedBatches('rails', library, materials, resources, RAIL_CAPACITY, false);
    this.group.add(this.rails.group);
    if (railRows.length > 0) {
      this.layRails();
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
      object.traverse((child) => {
        child.castShadow = true;
        child.receiveShadow = true;
      });
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
      this.gates.push(this.placeProp(prop, (object) => ({ arm: object.getObjectByName(GATE_ARM) ?? null, angle: GATE_OPEN })));
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

  private layRails(): void {
    const ext = RENDER_SETTINGS.terrain.extension;
    const matrix = new Matrix4();
    const ground = this.terrain.heightAt(this.map.width / 2, this.trackY);
    this.rails.begin();
    for (let x = -ext + RAIL_MODULE_LENGTH / 2; x < this.map.width + ext; x += RAIL_MODULE_LENGTH) {
      this.rails.add(RAIL_MODEL, matrix.makeTranslation(x, ground, this.trackY));
    }
    this.rails.end();
  }

  handleEvent(event: WorldEvent): void {
    if (event.type === 'train_whistle' && this.train.visible) {
      this.puff(WHISTLE_PUFFS);
    }
  }

  private puff(count: number): void {
    const locomotive = this.cars[this.cars.length - 1];
    if (locomotive === undefined) {
      return;
    }
    if (this.smokeAnchor !== null) {
      this.smokeAnchor.getWorldPosition(this.chimney);
    } else {
      this.chimney.copy(CHIMNEY);
      locomotive.localToWorld(this.chimney);
    }
    for (let i = 0; i < count; i += 1) {
      this.effects.particles.emit('smoke', this.chimney.x, this.chimney.y, this.chimney.z);
    }
  }

  update(context: FrameContext): void {
    const state = context.world.train;
    const progress = state.prevProgress + (state.progress - state.prevProgress) * context.alpha;
    let offset = 0;
    switch (state.phase) {
      case 'away':
        offset = Number.NaN;
        break;
      case 'arriving':
        offset = -TRAIN.slideDistance * (1 - easeOut(Math.min(1, Math.max(0, progress))));
        break;
      case 'stopped':
        offset = 0;
        break;
      case 'departing':
        offset = -TRAIN.slideDistance * easeIn(Math.min(1, Math.max(0, progress)));
        break;
    }
    const visible = !Number.isNaN(offset);
    this.train.visible = visible;
    const moving = visible && state.phase !== 'stopped';
    if (visible) {
      const x = this.stopX + offset;
      this.train.position.set(x, this.terrain.heightAt(this.stopX, this.trackY) + this.railTop - DEFAULT_RAIL_TOP, this.trackY);
      this.train.updateMatrixWorld(true);
      const speed = Number.isNaN(this.trainX) ? 0 : Math.abs(x - this.trainX) / Math.max(context.dt, Number.EPSILON);
      this.trainX = x;
      // Roues qui tournent au rythme du glissement (une révolution par clip).
      for (const entry of this.mixers) {
        entry.mixer.update((speed * context.dt * entry.duration) / (2 * Math.PI * WHEEL_RADIUS));
      }
      this.smokeTimer -= context.dt;
      if (moving && speed > 0 && this.smokeTimer <= 0 && !context.reducedMotion) {
        this.smokeTimer = 1 / RENDER_SETTINGS.effects.smokePuffsPerSecond;
        this.puff(1);
      }
    } else {
      this.trainX = Number.NaN;
    }

    const closed = moving;
    const gateFactor = smoothFactor(context.dt, context.reducedMotion ? 0 : GATE_HALF_LIFE);
    for (const gate of this.gates) {
      gate.angle += ((closed ? GATE_CLOSED : GATE_OPEN) - gate.angle) * gateFactor;
      if (gate.arm !== null) {
        gate.arm.rotation.z = gate.angle;
      }
    }

    if (this.shed !== null) {
      const open = context.world.worldStates.handcar_shed === 'open';
      this.shed.amount += ((open ? 1 : 0) - this.shed.amount) * smoothFactor(context.dt, context.reducedMotion ? 0 : SHED_HALF_LIFE);
      if (this.shed.left !== null) {
        this.shed.left.rotation.y = -SHED_DOOR_ANGLE * this.shed.amount;
      }
      if (this.shed.right !== null) {
        this.shed.right.rotation.y = SHED_DOOR_ANGLE * this.shed.amount;
      }
      if (this.shed.handcar !== null) {
        this.shed.handcar.visible = open;
      }
    }

    const minutes = context.world.clock.minutes;
    for (const hand of this.clockHands) {
      const turns = hand.kind === 'hour' ? (minutes % MINUTES_PER_DIAL) / MINUTES_PER_DIAL : (minutes % MINUTES_PER_HOUR) / MINUTES_PER_HOUR;
      hand.mesh.matrix.copy(hand.base).multiply(this.handRotation.makeRotationZ(-turns * Math.PI * 2));
    }
  }

  private readonly handRotation = new Matrix4();

  dispose(): void {
    this.group.removeFromParent();
  }
}

export { HOURS_PER_DIAL };
