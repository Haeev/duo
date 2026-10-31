/**
 * La vie de la ferme: les poules (animées par `AnimationMixer`, picorent,
 * marchent), les objets posés au sol (œufs, boîte en fer, piles tombées) et la
 * poutre portée à deux.
 */
import {
  AnimationMixer,
  Group,
  Matrix4,
  Quaternion,
  SkinnedMesh,
  Sphere,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from 'three';
import type { Content } from '../donnees/types';
import { smoothFactor } from './camera';
import {
  dampAngle,
  interpolate,
  setStandingBox,
  yawFromFacing,
  type FrameContext,
  type PickRegistry,
  type PickTarget,
} from './contexte';
import { InstancedBatches } from './lots';
import type { SharedMaterials } from './materiaux';
import { textHash, type ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

const FARM_FILE = 'ferme.glb';
const HEN_RIG = 'hen';
const HEN_MOVING = 0.02;
const HEN_PECK_EVERY = 5;
const HEN_PECK_SHARE = 0.45;
const HEN_TURN_HALF_LIFE = 0.12;
const GROUND_ITEM_CAPACITY = 24;
const ITEM_BOB = 0.03;
const ITEM_BOB_SPEED = 2.2;
const ITEM_PICK_RADIUS = 0.35;
const ITEM_PICK_HEIGHT = 0.5;
const BEAM_GROUND_HEIGHT = 0.12;
const DEFAULT_CARRY_HEIGHT = 1.6;
const HEN_RADIUS = 0.3;

interface HenView {
  root: Group;
  mixer: AnimationMixer | null;
  actions: Map<string, AnimationAction>;
  current: string;
  facing: number | null;
  phase: number;
}

export class FarmLifePart implements EventfulPart {
  readonly group = new Group();
  private readonly hens = new Map<string, HenView>();
  private readonly clips = new Map<string, AnimationClip>();
  private readonly items: InstancedBatches;
  private readonly itemPicks = new Map<string, PickTarget>();
  private beam: Object3D | null = null;
  private readonly matrix = new Matrix4();
  private readonly quaternion = new Quaternion();
  private readonly up = new Vector3(0, 1, 0);
  private readonly unit = new Vector3(1, 1, 1);
  private readonly position = new Vector3();
  private readonly point = { x: 0, y: 0 };

  constructor(
    private readonly library: ModelLibrary,
    materials: SharedMaterials,
    private readonly terrain: Terrain,
    resources: ResourceTracker,
    private readonly picks: PickRegistry,
    private readonly content: Content,
  ) {
    this.group.name = 'ferme';
    for (const clip of library.animations(FARM_FILE)) {
      this.clips.set(clip.name, clip);
    }
    this.items = new InstancedBatches(
      'objets au sol',
      library,
      materials,
      resources,
      GROUND_ITEM_CAPACITY,
    );
    this.group.add(this.items.group);
  }

  private createHen(id: string, variant: string): HenView {
    const root = new Group();
    const model = this.library.cloneRig(HEN_RIG, [variant]) ?? this.library.instantiate(variant);
    model.traverse((object) => {
      object.castShadow = true;
      if (object instanceof SkinnedMesh) {
        object.boundingSphere = new Sphere(new Vector3(0, HEN_RADIUS, 0), HEN_RADIUS * 2);
      }
    });
    root.add(model);
    this.group.add(root);
    const mixer = this.clips.size > 0 ? new AnimationMixer(model) : null;
    return {
      root,
      mixer,
      actions: new Map(),
      current: '',
      facing: null,
      phase: (textHash(id) % 100) / 100,
    };
  }

  private play(hen: HenView, name: string): void {
    const clip = this.clips.get(name);
    if (hen.mixer === null || clip === undefined || hen.current === name) {
      return;
    }
    let action = hen.actions.get(name);
    if (action === undefined) {
      action = hen.mixer.clipAction(clip);
      hen.actions.set(name, action);
    }
    action.reset().fadeIn(RENDER_SETTINGS.characters.crossFadeSeconds).play();
    hen.actions.get(hen.current)?.fadeOut(RENDER_SETTINGS.characters.crossFadeSeconds);
    hen.current = name;
  }

  update(context: FrameContext): void {
    const world = context.world;
    for (const hen of world.hens) {
      let view = this.hens.get(hen.id);
      if (view === undefined) {
        view = this.createHen(hen.id, hen.variant);
        this.hens.set(hen.id, view);
      }
      const at = interpolate(hen.prev, hen.pos, context.alpha, this.point);
      view.root.position.set(at.x, this.terrain.heightAt(at.x, at.y), at.y);
      const yaw = yawFromFacing(hen.facing);
      view.facing =
        view.facing === null
          ? yaw
          : dampAngle(view.facing, yaw, smoothFactor(context.dt, HEN_TURN_HALF_LIFE));
      view.root.rotation.y = view.facing;
      const moving =
        Math.hypot(hen.pos.x - hen.prev.x, hen.pos.y - hen.prev.y) > HEN_MOVING * context.dt;
      const cycle = (context.time / HEN_PECK_EVERY + view.phase) % 1;
      this.play(view, moving ? 'hen_walk' : cycle < HEN_PECK_SHARE ? 'hen_peck' : 'hen_idle');
      view.mixer?.update(context.dt);
    }

    this.items.begin();
    const seen = new Set<string>();
    for (const item of world.groundItems) {
      seen.add(item.id);
      const model = this.content.items[item.item]?.model ?? item.item;
      const ground = this.terrain.heightAt(item.pos.x, item.pos.y);
      const bob = context.reducedMotion
        ? 0
        : (Math.sin(context.time * ITEM_BOB_SPEED + textHash(item.id)) + 1) * ITEM_BOB;
      this.quaternion.setFromAxisAngle(this.up, textHash(item.id));
      this.position.set(item.pos.x, ground + bob, item.pos.y);
      this.items.add(model, this.matrix.compose(this.position, this.quaternion, this.unit));
      let pick = this.itemPicks.get(item.id);
      if (pick === undefined) {
        pick = this.picks.add({ kind: 'ground_item', groundItem: item.id });
        this.itemPicks.set(item.id, pick);
      }
      setStandingBox(pick.box, item.pos.x, ground, item.pos.y, ITEM_PICK_RADIUS, ITEM_PICK_HEIGHT);
      pick.enabled = true;
    }
    this.items.end();
    for (const [id, pick] of this.itemPicks) {
      if (!seen.has(id)) {
        this.picks.remove(pick);
        this.itemPicks.delete(id);
      }
    }

    const beam = world.beam;
    if (beam === null) {
      if (this.beam !== null) {
        this.beam.visible = false;
      }
      return;
    }
    if (this.beam === null) {
      this.beam = this.library.instantiate(this.content.items.beam?.model ?? 'beam');
      this.beam.traverse((object) => {
        object.castShadow = true;
      });
      this.group.add(this.beam);
    }
    const carryHeight = this.library.extras('beam').carry_height;
    const at = interpolate(beam.prev, beam.pos, context.alpha, this.point);
    const lift = beam.carried
      ? typeof carryHeight === 'number'
        ? carryHeight
        : DEFAULT_CARRY_HEIGHT
      : BEAM_GROUND_HEIGHT;
    this.beam.visible = true;
    this.beam.position.set(at.x, this.terrain.heightAt(at.x, at.y) + lift, at.y);
    this.beam.rotation.y = yawFromFacing(beam.facing);
  }

  dispose(): void {
    for (const hen of this.hens.values()) {
      hen.mixer?.stopAllAction();
    }
    this.hens.clear();
    for (const pick of this.itemPicks.values()) {
      this.picks.remove(pick);
    }
    this.itemPicks.clear();
    this.group.removeFromParent();
  }
}
