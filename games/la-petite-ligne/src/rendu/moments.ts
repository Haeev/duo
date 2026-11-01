/**
 * Moments rares à l'écran (conception du tour 6, section 1): les bêtes en attente (le héron qui
 * pêche, les oies qui flottent, le renard qui mulote, la mésange qui va et vient), le lecteur des
 * chorégraphies (images clés de `moments.json` échantillonnées par `etat/moments.ts`, clips calés
 * sur le temps de la chorégraphie, fondus entre clips), la formation en V des oies, l'échelle de
 * Basile, les petits objets accrochés de la carte (nichoir, chicot) et les vers luisants.
 *
 * Les deux machines lisent le même `world.moments.today` et les mêmes images clés: mêmes images au
 * même instant. Le rendu garde sa propre horloge, recalée sur le temps de la simulation, pour un
 * mouvement continu entre deux pas (et entre deux états reçus chez l'invité).
 */
import { AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Matrix4, Mesh, Vector3, type AnimationAction, type AnimationClip, type BufferGeometry, type Object3D } from 'three';
import type { Content, MomentActorDef, MomentChoreography, MomentDef, MomentKeyframe } from '../donnees/types';
import type { GameMap, MapHook } from '../etat/carte';
import {
  actorPose,
  choreographyFade,
  resolveTrack,
  restPosition,
  sampleResolved,
  afterPosition,
  type TrackSample,
  type Vec3,
} from '../etat/moments';
import { SIM_HZ, type DeepReadonly, type MomentToday, type ReadonlyWorld, type VillagerState } from '../etat/types';
import { smoothFactor } from './camera';
import { dampAngle, yawFromFacing, yawFromQuarter, type FrameContext } from './contexte';
import { textHash, type ModelLibrary } from './modeles';
import type { EventfulPart } from './monde';
import type { CharactersPart, HandReach, VillagerDirection } from './personnages';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';
import { GlowwormLights } from './vers-luisants';

const FAUNA_FILE = 'faune.glb';
/** Clips de `faune.glb` joués une fois (figés sur leur dernière pose), d'après la fiche de l'artiste. */
const ONCE_CLIPS: ReadonlySet<string> = new Set([
  'heron_strike',
  'heron_alert',
  'heron_shy_step',
  'heron_takeoff',
  'heron_land',
  'goose_alert',
  'tit_sing',
  'tit_enter',
  'tit_exit',
  'fox_listen',
  'fox_pounce',
  'fox_sniff',
  'fox_look',
  'fox_bark',
]);
/** Clips pendant lesquels la bête regarde le joueur le plus proche (« vous regarde »). */
const FACE_PLAYER_CLIPS: ReadonlySet<string> = new Set(['heron_alert', 'fox_look', 'fox_bark']);
/** Pseudo-clips des données: acteur non dessiné, ou porté par un autre (la mousse au bec). */
const HIDDEN = 'hidden';
const INSIDE = 'inside_nest_box';
const CARRIED_BY = 'carried_by_';
/** La mésange disparaît dans le nichoir à la fin de `tit_enter`. */
const ENTER_SECONDS = 0.3;
const TIT_ENTER = 'tit_enter';
const BEAK_SOCKET = 'socket_blue_tit_beak';
/** Nichoir (acteur de l'échelle et accroche de la carte): penché, puis redressé. */
const NEST_MODEL = 'nest_box';
const NEST_STRAIGHT_FLAG = 'nest_box_straight';
const NEST_TURN = 'nest_box_turn';
const NEST_STRAIGHT = 'nest_box_straight';
const NEST_TURN_SECONDS = 0.8;
/** Échelle et clips de Basile (fiche de l'artiste: 0,28 m et 0,6 s par barreau, boucle de deux barreaux). */
const LADDER_MODEL = 'ladder_wood';
const DEFAULT_RUNG = 0.28;
const SECONDS_PER_RUNG = 0.6;
const CLIMB = 'climb_ladder';
const REACH = 'reach_up';
const REACH_SECONDS = 0.8;
const HAMMER = 'hammer_tap';
const HAMMER_SECONDS = 0.6;
const HAMMER_MODEL = 'hammer';
const WALK = 'walk';
/** L'échelle vibre de 1 cm pendant que Basile grimpe. */
const LADDER_SHAKE = 0.01;
const LADDER_SHAKE_HZ = 9;
const GLOW_MODEL = 'glowworm_light';
const FADE_SECONDS = 0.2;
const TURN_HALF_LIFE = 0.15;
/** Lissage de la hauteur du sol sous une bête en vol (pas de saut au-dessus du bord du quai). */
const GROUND_HALF_LIFE = 0.3;
/** Une bête qui se déplace de moins que cela entre deux échantillons garde son cap. */
const MOVE_EPSILON = 0.02;
const LOOK_AHEAD = 0.12;
/** Horloge du rendu: avance au plus de tant devant la simulation, ou tant derrière (s). */
const CLOCK_AHEAD = 0.15;
const CLOCK_BEHIND = 0.3;
const CLOCK_SNAP = 1;
/** Le héron timide: se redresse 1 s, puis deux pas vers son pas de côté en 0,8 s. */
const SHY_ALERT_SECONDS = 1;
const SHY_STEP_SECONDS = 0.8;
/** Coups de bec du héron en attente: une fenêtre par période, à un instant tiré par la graine. */
const STRIKE_SECONDS = 0.8;
/** Va-et-vient de la mésange en attente (s): posée, vol, posée, vol (toutes les 2 s). */
const TIT_PERCH_SECONDS = 1.7;
const TIT_FLY_SECONDS = 0.3;
const TIT_HOP = 0.08;
/** Mulotage du renard: écoute, saut, flaire, quelques pas (s), rayon autour du point (m). */
const FOX_LISTEN = 2.5;
const FOX_POUNCE = 1.2;
const FOX_SNIFF = 2;
const FOX_WALK = 1;
/** Rayon de mulotage si la fiche ne donne pas `roam` (m); avec `roam`, il en garde la longueur d'un saut. */
const FOX_ROAM = 1.2;
const FOX_LEAP = 1;
const FOX_APEX = 0.9;
/** Part du clip de saut où les pattes quittent le sol. */
const FOX_LEAP_FROM = 0.25;
const FOX_LEAP_TO = 0.85;
/** Oies posées: elles dérivent un peu, chacune à son rythme. */
const GOOSE_DRIFT = 0.15;
const GOOSE_DRIFT_SPEED = 0.25;
const GOOSE_SPREAD = 1.2;
const DEGREE = Math.PI / 180;

/** Une piste d'images clés et ses positions résolues (calculées une fois). */
interface Track {
  frames: readonly MomentKeyframe[];
  points: Vec3[];
}

/** Ce que l'acteur fait à cette image. */
interface ActorFrame {
  x: number;
  y: number;
  z: number;
  /** Cap voulu (`facing` de la simulation), `null`: dans le sens du mouvement. */
  facing: number | null;
  clip: string | null;
  clipTime: number;
  visible: boolean;
}

/** Une bête, une échelle ou une mousse: modèle, mélangeur et clips. */
class ActorView {
  readonly root = new Group();
  private readonly mixer: AnimationMixer | null;
  private readonly actions = new Map<string, AnimationAction>();
  private current: AnimationAction | null = null;
  private currentName = '';
  private yaw: number | null = null;
  private ground: number | null = null;
  readonly socket: Object3D | null;
  /** Héron timide: début de la timidité et du retour (temps du rendu), ou `null`. */
  shySince: number | null = null;
  shyEnded: number | null = null;

  constructor(
    readonly actor: MomentActorDef,
    readonly member: number,
    model: Object3D,
    private readonly clips: ReadonlyMap<string, AnimationClip>,
    animated: boolean,
  ) {
    this.root.name = `moment ${actor.id} ${String(member)}`;
    this.root.add(model);
    this.root.visible = false;
    model.traverse((object) => {
      object.castShadow = true;
      object.frustumCulled = false;
    });
    this.mixer = animated && clips.size > 0 ? new AnimationMixer(model) : null;
    this.socket = model.getObjectByName(BEAK_SOCKET) ?? null;
  }

  /** Joue `name` à l'instant `time` du clip (boucle ou une fois), fondu depuis le précédent. */
  pose(name: string | null, time: number, dt: number): void {
    const mixer = this.mixer;
    const clip = name === null ? undefined : this.clips.get(name);
    if (mixer === null || clip === undefined) {
      return;
    }
    let action = this.actions.get(clip.name);
    if (action === undefined) {
      action = mixer.clipAction(clip);
      this.actions.set(clip.name, action);
    }
    if (clip.name !== this.currentName) {
      const once = ONCE_CLIPS.has(clip.name);
      action.reset();
      action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
      action.clampWhenFinished = once;
      action.fadeIn(FADE_SECONDS).play();
      this.current?.fadeOut(FADE_SECONDS);
      this.current = action;
      this.currentName = clip.name;
    }
    // Le temps vient de la chorégraphie: le mélangeur n'avance que les fondus.
    action.timeScale = 0;
    const duration = Math.max(1e-3, clip.duration);
    action.time = ONCE_CLIPS.has(clip.name)
      ? Math.min(Math.max(0, time), duration - 1e-3)
      : ((time % duration) + duration) % duration;
    mixer.update(dt);
  }

  /** Place la bête: hauteur du sol lissée, cap amorti. */
  place(x: number, y: number, z: number, groundAt: number, facing: number, dt: number, snap: boolean): void {
    this.ground = this.ground === null || snap ? groundAt : this.ground + (groundAt - this.ground) * smoothFactor(dt, GROUND_HALF_LIFE);
    const yaw = yawFromFacing(facing);
    this.yaw = this.yaw === null || snap ? yaw : dampAngle(this.yaw, yaw, smoothFactor(dt, TURN_HALF_LIFE));
    this.root.position.set(x, this.ground + z, y);
    this.root.rotation.y = this.yaw;
  }

  /** Cap actuel dans la convention de la simulation (`facing`). */
  facing(): number | null {
    return this.yaw === null ? null : Math.PI / 2 - this.yaw;
  }

  hide(): void {
    this.root.visible = false;
    this.ground = null;
    this.yaw = null;
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    this.root.removeFromParent();
  }
}

/** Les vues d'un moment: ses acteurs dessinés, ses pistes résolues, ses lanternes. */
interface MomentScene {
  def: MomentDef;
  group: Group;
  views: ActorView[];
  climax: Map<string, Track>;
  leave: Map<string, Track>;
  arrive: Map<string, Track>;
  glow: GlowwormLights | null;
}

/** Hachage stable vers [0, 1[ (attentes des bêtes, mêmes tirages d'une image à l'autre). */
function unit(key: number, index: number, salt: number): number {
  let h = (key ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 3, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 2 ** 32;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function tracksOf(choreo: MomentChoreography | null, from: (actorId: string) => Vec3): Map<string, Track> {
  const out = new Map<string, Track>();
  if (choreo === null) return out;
  for (const [id, frames] of Object.entries(choreo.keyframes)) {
    out.set(id, { frames, points: resolveTrack(frames, from(id)) });
  }
  return out;
}

export class MomentsPart implements EventfulPart {
  readonly group = new Group();
  private readonly clips = new Map<string, AnimationClip>();
  private readonly scenes = new Map<string, MomentScene>();
  private readonly hooks: { hook: MapHook; object: Object3D }[] = [];
  private nest: { hook: MapHook; object: Object3D } | null = null;
  private clockKey = '';
  private clockFrame = Number.NaN;
  private shown = 0;
  private readonly sample: TrackSample = { x: 0, y: 0, z: 0, clip: null, clipSince: 0 };
  private readonly ahead: TrackSample = { x: 0, y: 0, z: 0, clip: null, clipSince: 0 };
  private readonly frame: ActorFrame = { x: 0, y: 0, z: 0, facing: null, clip: null, clipTime: 0, visible: false };
  private readonly socketPoint = new Vector3();
  private readonly rung: number;
  /** Dessous de la caisse du nichoir, dans son repère (calculé au premier besoin). */
  private nestBottom: Vector3 | null = null;
  private readonly reachPoint = new Vector3();
  private readonly reachTarget: HandReach = { x: 0, y: 0, z: 0, weight: 0 };
  /** Dernière pose imposée par une chorégraphie (habitant, position, hauteur, image), lue par le moteur. */
  private readonly directed = { villager: '', x: 0, y: 0, z: 0, time: Number.NaN };

  constructor(
    private readonly map: GameMap,
    private readonly content: Content,
    private readonly library: ModelLibrary,
    private readonly terrain: Terrain,
    private readonly resources: ResourceTracker,
    characters: CharactersPart,
    private readonly light: boolean,
  ) {
    this.group.name = 'moments rares';
    for (const clip of library.animations(FAUNA_FILE)) {
      this.clips.set(clip.name, clip);
    }
    const rungExtra = library.extras(LADDER_MODEL).rung_step;
    this.rung = typeof rungExtra === 'number' && rungExtra > 0 ? rungExtra : DEFAULT_RUNG;
    for (const hook of map.hooks) {
      // Un petit objet accroché sans modèle (le pieu, P1) n'est pas dessiné: pas de substitut en l'air.
      if (!library.has(hook.model)) continue;
      const object = library.instantiate(hook.model);
      object.name = `accroche ${hook.id}`;
      object.traverse((child) => {
        child.castShadow = true;
      });
      object.position.set(hook.pos.x, terrain.heightAt(hook.pos.x, hook.pos.y) + hook.pos.z, hook.pos.y);
      object.rotation.set(0, yawFromQuarter(hook.rotation), hook.tiltDeg * DEGREE);
      this.group.add(object);
      const entry = { hook, object };
      this.hooks.push(entry);
      if (hook.model === NEST_MODEL) this.nest = entry;
    }
    characters.setVillagerDirector((villager, context) => this.direct(villager, context));
  }

  private currentMoment(world: ReadonlyWorld): { def: MomentDef; today: DeepReadonly<MomentToday> } | null {
    const today = world.moments.today;
    if (today === null) return null;
    const def = this.content.moments.find((m) => m.id === today.id);
    return def === undefined ? null : { def, today };
  }

  /**
   * Temps de la phase en cours (s): la chorégraphie (`elapsed`) pendant l'apogée et le départ,
   * le temps passé dans la phase sinon. Calculé une fois par image, avancé par le rendu et
   * recalé sur la simulation.
   */
  private phaseTime(today: DeepReadonly<MomentToday>, context: FrameContext): number {
    if (this.clockFrame === context.time) return this.shown;
    this.clockFrame = context.time;
    const choreography = today.phase === 'climax' || today.phase === 'left';
    const target = choreography
      ? today.elapsed + (today.paused ? 0 : context.alpha / SIM_HZ)
      : Math.max(0, (context.world.tick - today.phaseTick + context.alpha) / SIM_HZ);
    const key = `${today.id}|${String(today.day)}|${today.phase}|${String(today.phaseTick)}`;
    if (key !== this.clockKey) {
      this.clockKey = key;
      this.shown = target;
      return this.shown;
    }
    if (!today.paused) this.shown += context.dt;
    if (Math.abs(this.shown - target) > CLOCK_SNAP) this.shown = target;
    this.shown = Math.min(target + CLOCK_AHEAD, Math.max(target - CLOCK_BEHIND, this.shown));
    return this.shown;
  }

  private scene(def: MomentDef, world: ReadonlyWorld): MomentScene {
    const known = this.scenes.get(def.id);
    if (known !== undefined) return known;
    const group = new Group();
    group.name = `moment ${def.id}`;
    const views: ActorView[] = [];
    let glow: GlowwormLights | null = null;
    for (const actor of def.actors) {
      if (actor.villager !== null || actor.model === NEST_MODEL) continue;
      if (actor.model === GLOW_MODEL) {
        glow = new GlowwormLights(def, this.map, this.terrain, world.seed, this.light, this.resources);
        group.add(glow.mesh);
        continue;
      }
      for (let member = 0; member < Math.max(1, actor.count); member += 1) {
        const animal = this.library.cloneAnimal(actor.model);
        const model = animal ?? this.library.instantiate(actor.model);
        const view = new ActorView(actor, member, model, this.clips, animal !== null);
        views.push(view);
        group.add(view.root);
      }
    }
    const byId = (id: string): MomentActorDef | undefined => def.actors.find((a) => a.id === id);
    const rest = (id: string): Vec3 => {
      const actor = byId(id);
      return actor === undefined ? { x: 0, y: 0, z: 0 } : restPosition(this.map, actor);
    };
    const afterOrRest = (id: string): Vec3 => {
      const actor = byId(id);
      return actor === undefined ? { x: 0, y: 0, z: 0 } : afterPosition(this.map, def, actor);
    };
    const arrive = new Map<string, Track>();
    for (const actor of def.actors) {
      for (const [id, track] of tracksOf(actor.arrive, rest)) arrive.set(id, track);
    }
    const scene: MomentScene = {
      def,
      group,
      views,
      climax: tracksOf(def.climax, rest),
      // Le départ part de l'état d'après si l'apogée a eu lieu: piste résolue à la demande (`leaveTrack`).
      leave: tracksOf(def.leave, afterOrRest),
      arrive,
      glow,
    };
    this.scenes.set(def.id, scene);
    this.group.add(group);
    return scene;
  }

  /** Piste de départ, depuis l'attente (pas d'apogée) ou depuis l'état d'après. */
  private leaveTrack(scene: MomentScene, actor: MomentActorDef, today: DeepReadonly<MomentToday>): Track | null {
    const track = scene.leave.get(actor.id);
    if (track === undefined || scene.def.leave === null) return null;
    if (today.startTick !== null) return track;
    const frames = scene.def.leave.keyframes[actor.id];
    if (frames === undefined) return null;
    // Sans apogée, le départ part du point d'attente (rare: résolu une fois par départ).
    const key = `${actor.id}@rest`;
    const cached = scene.leave.get(key);
    if (cached !== undefined) return cached;
    const resolved = { frames, points: resolveTrack(frames, restPosition(this.map, actor)) };
    scene.leave.set(key, resolved);
    return resolved;
  }

  update(context: FrameContext): void {
    const world = context.world;
    const current = this.currentMoment(world);
    this.updateNest(world, current, context);
    for (const scene of this.scenes.values()) {
      if (current?.def.id === scene.def.id) continue;
      for (const view of scene.views) view.hide();
      scene.glow?.update({ phase: 'off', t: 0 }, context.time, context.dt, context.reducedMotion);
    }
    if (current === null) return;
    const { def, today } = current;
    const scene = this.scene(def, world);
    const t = this.phaseTime(today, context);
    if (scene.glow !== null) {
      const phase = today.phase === 'waiting' || today.phase === 'climax' || today.phase === 'after' ? today.phase : 'off';
      scene.glow.update({ phase, t }, context.time, context.dt, context.reducedMotion);
    }
    for (const view of scene.views) {
      this.updateView(scene, view, today, t, context);
    }
  }

  /** Le nichoir accroché: penché jusqu'au redressement (apogée de l'échelle), droit ensuite. */
  private updateNest(world: ReadonlyWorld, current: { def: MomentDef; today: DeepReadonly<MomentToday> } | null, context: FrameContext): void {
    const nest = this.nest;
    if (nest === null) return;
    let tilt = world.flags.includes(NEST_STRAIGHT_FLAG) ? 0 : nest.hook.tiltDeg;
    const track = current?.today.phase === 'climax' ? current.def.climax.keyframes[NEST_MODEL] : undefined;
    if (current !== null && track !== undefined) {
      const t = this.phaseTime(current.today, context);
      let clip: string | null = null;
      let since = 0;
      for (const f of track) {
        if (f[0] > t) break;
        if (f[4] !== null) {
          clip = f[4];
          since = f[0];
        }
      }
      if (clip === NEST_TURN) tilt = nest.hook.tiltDeg * (1 - smoothstep(0, NEST_TURN_SECONDS, t - since));
      else if (clip === NEST_STRAIGHT) tilt = 0;
      else tilt = nest.hook.tiltDeg;
    }
    nest.object.rotation.z = tilt * DEGREE;
  }

  private updateView(scene: MomentScene, view: ActorView, today: DeepReadonly<MomentToday>, t: number, context: FrameContext): void {
    const f = this.frame;
    const actor = view.actor;
    f.facing = null;
    f.visible = true;
    f.clipTime = context.time + unit(textHash(actor.id), view.member, 1) * 10;
    let snap = false;
    switch (today.phase) {
      case 'absent':
      case 'gone':
        view.hide();
        return;
      case 'waiting':
        this.waitingFrame(scene, view, today, t, context);
        break;
      case 'climax':
      case 'left': {
        const choreo = today.phase === 'climax' ? scene.def.climax : scene.def.leave;
        const track = today.phase === 'climax' ? (scene.climax.get(actor.id) ?? null) : this.leaveTrack(scene, actor, today);
        if (choreo === null || track === null) {
          if (today.phase === 'left') {
            view.hide();
            return;
          }
          this.waitingFrame(scene, view, today, t, context);
          break;
        }
        this.trackFrame(track, t, f);
        f.visible = choreographyFade(choreo, t) > 0.5;
        if (choreo.formation !== null && actor.count > 1) this.formation(view, choreo, track, t);
        break;
      }
      case 'after': {
        if (scene.def.after === null) {
          // Pas d'état d'après (les mésanges): l'attente reprend.
          this.waitingFrame(scene, view, today, t, context);
          break;
        }
        const pose = actorPose(this.map, scene.def, today, actor.id);
        if (pose === null) {
          view.hide();
          return;
        }
        f.x = pose.x;
        f.y = pose.y;
        f.z = pose.z;
        f.clip = pose.clip;
        f.facing = view.facing() ?? actor.facing;
        break;
      }
    }
    if (f.clip === HIDDEN || f.clip === INSIDE) f.visible = false;
    if (f.clip === TIT_ENTER && f.clipTime > ENTER_SECONDS) f.visible = false;
    if (!f.visible) {
      view.hide();
      return;
    }
    if (!view.root.visible) snap = true;
    view.root.visible = true;
    // Porté (la mousse au bec): à la place de la prise du porteur.
    if (f.clip?.startsWith(CARRIED_BY) === true) {
      const carrier = scene.views.find((v) => v.actor.id === f.clip?.slice(CARRIED_BY.length));
      const socket = carrier?.socket ?? null;
      if (carrier === undefined || socket === null || !carrier.root.visible) {
        view.hide();
        return;
      }
      socket.getWorldPosition(this.socketPoint);
      view.root.position.copy(this.socketPoint);
      view.root.rotation.y = carrier.root.rotation.y;
      return;
    }
    let facing = f.facing;
    if (facing === null) {
      if (f.clip !== null && FACE_PLAYER_CLIPS.has(f.clip)) facing = this.facePlayer(context.world, f.x, f.y);
      facing ??= view.facing() ?? actor.facing;
    }
    view.place(f.x, f.y, f.z, this.groundAt(f.x, f.y), facing, context.dt, snap);
    view.pose(f.clip, f.clipTime, context.dt);
    if (actor.model === LADDER_MODEL) this.shakeLadder(scene, view, today, t, context);
  }

  /** Échantillon d'une piste au temps `t`, clip et instant dans le clip compris. */
  private trackFrame(track: Track, t: number, f: ActorFrame): void {
    const s = sampleResolved(track.frames, track.points, t, this.sample);
    f.x = s.x;
    f.y = s.y;
    f.z = s.z;
    f.clip = s.clip;
    f.clipTime = t - s.clipSince;
    // Direction du mouvement à venir: plus stable que la différence d'une image à l'autre.
    const a = sampleResolved(track.frames, track.points, t + LOOK_AHEAD, this.ahead);
    if (Math.hypot(a.x - s.x, a.y - s.y) > MOVE_EPSILON) f.facing = Math.atan2(a.y - s.y, a.x - s.x);
  }

  /**
   * Formation en V des oies (section 1.4.2): chaque oie quitte sa place dans la grappe pour sa
   * place dans le V, en S, entre `fromSeconds` et `toSeconds`; le V suit le cap de l'oie de tête.
   */
  private formation(view: ActorView, choreo: MomentChoreography, track: Track, t: number): void {
    const formation = choreo.formation;
    if (formation === null) return;
    const f = this.frame;
    const offset = view.actor.offsets[view.member] ?? [0, 0];
    const s = sampleResolved(track.frames, track.points, t, this.sample);
    const a = sampleResolved(track.frames, track.points, t + LOOK_AHEAD, this.ahead);
    const heading = Math.hypot(a.x - s.x, a.y - s.y) > MOVE_EPSILON ? Math.atan2(a.y - s.y, a.x - s.x) : (view.facing() ?? view.actor.facing);
    const w = smoothstep(formation.fromSeconds, formation.toSeconds, t);
    let vx = 0;
    let vy = 0;
    if (view.member > 0) {
      const rank = Math.ceil(view.member / 2);
      const arm = (view.member % 2 === 1 ? -formation.armAngleDeg : formation.armAngleDeg) * DEGREE;
      vx = Math.cos(heading + arm) * rank * formation.spacing;
      vy = Math.sin(heading + arm) * rank * formation.spacing;
    }
    f.x = s.x + offset[0] * (1 - w) + vx * w;
    f.y = s.y + offset[1] * (1 - w) + vy * w;
    f.facing = heading;
    // Chacune son battement: les ailes ne bougent pas toutes ensemble.
    f.clipTime += unit(textHash(view.actor.id), view.member, 2) * 0.5;
  }

  /** Les bêtes en attente: chacune sa boucle, là où elle a une raison d'être. */
  private waitingFrame(scene: MomentScene, view: ActorView, today: DeepReadonly<MomentToday>, t: number, context: FrameContext): void {
    const f = this.frame;
    const actor = view.actor;
    const rest = restPosition(this.map, actor);
    f.x = rest.x;
    f.y = rest.y;
    f.z = 0;
    f.clip = actor.idle;
    f.facing = actor.facing;
    const time = context.time;
    const key = textHash(`${scene.def.id}:${actor.id}`);
    const climaxStart = scene.climax.get(actor.id);
    if (actor.idle === HIDDEN || actor.model === 'moss_tuft') {
      f.visible = false;
      return;
    }
    if (actor.shy !== null) {
      this.shyFrame(view, today, context);
      if (f.clip !== actor.idle) return;
    }
    if (actor.idleExtra !== null && actor.model !== 'blue_tit' && actor.model !== 'fox') {
      // Un geste de temps en temps (le coup de bec du héron), à un instant tiré par période.
      const [min, max] = actor.idleExtra.everySeconds;
      const period = (min + max) / 2;
      const window = Math.floor(time / period);
      const at = unit(key, window, 4) * Math.max(0, period - STRIKE_SECONDS);
      const inPeriod = time - window * period;
      if (inPeriod >= at && inPeriod < at + STRIKE_SECONDS && f.clip === actor.idle) {
        f.clip = actor.idleExtra.clip;
        f.clipTime = inPeriod - at;
      }
    }
    if (actor.count > 1) {
      // Les oies posées: la grappe dérive doucement, chacune tournée un peu autrement.
      const offset = actor.offsets[view.member] ?? [0, 0];
      const phase = unit(key, view.member, 5) * Math.PI * 2;
      f.x += offset[0] + Math.sin(time * GOOSE_DRIFT_SPEED + phase) * GOOSE_DRIFT;
      f.y += offset[1] + Math.cos(time * GOOSE_DRIFT_SPEED * 0.8 + phase) * GOOSE_DRIFT;
      f.facing = actor.facing + (unit(key, view.member, 6) - 0.5) * GOOSE_SPREAD + Math.sin(time * 0.1 + phase) * 0.2;
      return;
    }
    if (actor.model === 'blue_tit' && climaxStart !== undefined) {
      this.titWaiting(view, climaxStart, time);
      return;
    }
    if (actor.model === 'fox') {
      this.foxWaiting(scene, view, t, rest, key);
    }
  }

  /** Héron trop approché: il se redresse, deux pas de côté, puis revient 5 s après (simulation). */
  private shyFrame(view: ActorView, today: DeepReadonly<MomentToday>, context: FrameContext): void {
    const shy = view.actor.shy;
    if (shy === null) return;
    const f = this.frame;
    const active = today.shyUntil > context.world.tick;
    const time = context.time;
    if (active && view.shySince === null) {
      view.shySince = time;
      view.shyEnded = null;
    } else if (!active && view.shySince !== null) {
      view.shySince = null;
      view.shyEnded = time;
    }
    const stepTo = shy.stepTo;
    const rest = { x: f.x, y: f.y };
    const away = stepTo === null ? rest : { x: stepTo[0], y: stepTo[1] };
    if (view.shySince !== null) {
      const since = time - view.shySince;
      if (since < SHY_ALERT_SECONDS) {
        f.clip = shy.clip;
        f.clipTime = since;
        return;
      }
      const u = Math.min(1, (since - SHY_ALERT_SECONDS) / SHY_STEP_SECONDS);
      f.x = rest.x + (away.x - rest.x) * u;
      f.y = rest.y + (away.y - rest.y) * u;
      f.clip = u < 1 ? (shy.stepClip ?? shy.clip) : shy.clip;
      f.clipTime = u < 1 ? since - SHY_ALERT_SECONDS : SHY_ALERT_SECONDS;
      f.facing = null;
      return;
    }
    if (view.shyEnded !== null) {
      const since = time - view.shyEnded;
      const u = Math.min(1, since / SHY_STEP_SECONDS);
      if (u < 1) {
        f.x = away.x + (rest.x - away.x) * u;
        f.y = away.y + (rest.y - away.y) * u;
        f.clip = shy.stepClip ?? shy.clip;
        f.clipTime = since;
        f.facing = null;
      } else {
        view.shyEnded = null;
      }
    }
  }

  /** Mésanges en attente: l'une va et vient du chicot au toit du nichoir, l'autre reste au chicot. */
  private titWaiting(view: ActorView, track: Track, time: number): void {
    const f = this.frame;
    const start = sampleResolved(track.frames, track.points, 0, this.sample);
    f.x = start.x;
    f.y = start.y;
    f.z = start.z;
    f.clip = 'tit_perch';
    if (view.actor.idleExtra === null) return;
    // Le toit du nichoir: là où la mésange A se pose dans l'apogée.
    const roof = this.roofOf(track);
    const cycle = (TIT_PERCH_SECONDS + TIT_FLY_SECONDS) * 2;
    const phase = time % cycle;
    const first = { x: start.x, y: start.y, z: start.z };
    if (phase < TIT_PERCH_SECONDS) return;
    if (phase < TIT_PERCH_SECONDS + TIT_FLY_SECONDS) {
      this.titFly(first, roof, (phase - TIT_PERCH_SECONDS) / TIT_FLY_SECONDS);
      return;
    }
    if (phase < TIT_PERCH_SECONDS * 2 + TIT_FLY_SECONDS) {
      f.x = roof.x;
      f.y = roof.y;
      f.z = roof.z;
      return;
    }
    this.titFly(roof, first, (phase - TIT_PERCH_SECONDS * 2 - TIT_FLY_SECONDS) / TIT_FLY_SECONDS);
  }

  private readonly roofPoint: Vec3 = { x: 0, y: 0, z: 0 };

  /** Première image clé posée sur le nichoir (le toit), d'après la piste de l'apogée. */
  private roofOf(track: Track): Vec3 {
    const roof = track.frames.findIndex((frame, i) => i > 0 && frame[4] === 'tit_perch');
    const point = track.points[roof] ?? track.points[0] ?? this.roofPoint;
    this.roofPoint.x = point.x;
    this.roofPoint.y = point.y;
    this.roofPoint.z = point.z;
    return this.roofPoint;
  }

  private titFly(from: Vec3, to: Vec3, u: number): void {
    const f = this.frame;
    f.x = from.x + (to.x - from.x) * u;
    f.y = from.y + (to.y - from.y) * u;
    f.z = from.z + (to.z - from.z) * u + Math.sin(u * Math.PI) * TIT_HOP;
    f.clip = 'tit_fly';
    f.facing = Math.atan2(to.y - from.y, to.x - from.x);
  }

  /**
   * Le renard: il arrive au trot par le ballast (`arrive`), puis mulote: il écoute, saute à pieds
   * joints, flaire, et fait quelques pas vers un autre coin d'herbe, toujours près de son point.
   */
  private foxWaiting(scene: MomentScene, view: ActorView, t: number, rest: Vec3, key: number): void {
    const f = this.frame;
    const arrive = scene.arrive.get(view.actor.id);
    const arriveSeconds = view.actor.arrive?.seconds ?? 0;
    if (arrive !== undefined && t < arriveSeconds) {
      this.trackFrame(arrive, t, f);
      return;
    }
    const cycle = FOX_LISTEN + FOX_POUNCE + FOX_SNIFF + FOX_WALK;
    const since = Math.max(0, t - arriveSeconds);
    const k = Math.floor(since / cycle);
    const u = since - k * cycle;
    const spot = (n: number): { x: number; y: number } => {
      if (n === 0) return { x: rest.x, y: rest.y };
      const angle = unit(key, n, 7) * Math.PI * 2;
      const roam = view.actor.roam > FOX_LEAP ? view.actor.roam - FOX_LEAP : FOX_ROAM;
      const radius = roam * Math.sqrt(unit(key, n, 8));
      return { x: rest.x + Math.cos(angle) * radius, y: rest.y + Math.sin(angle) * radius };
    };
    const from = spot(k);
    // Il saute vers le centre de son coin d'herbe, pour rester près de son point.
    const toCenter = Math.atan2(rest.y - from.y, rest.x - from.x);
    const heading = Math.hypot(rest.x - from.x, rest.y - from.y) > 0.3 ? toCenter : unit(key, k, 9) * Math.PI * 2;
    const landed = { x: from.x + Math.cos(heading) * FOX_LEAP, y: from.y + Math.sin(heading) * FOX_LEAP };
    f.facing = heading;
    if (u < FOX_LISTEN) {
      f.x = from.x;
      f.y = from.y;
      f.clip = 'fox_listen';
      f.clipTime = u;
      return;
    }
    if (u < FOX_LISTEN + FOX_POUNCE) {
      const p = (u - FOX_LISTEN) / FOX_POUNCE;
      const leap = smoothstep(FOX_LEAP_FROM, FOX_LEAP_TO, p);
      const air = Math.min(1, Math.max(0, (p - FOX_LEAP_FROM) / (FOX_LEAP_TO - FOX_LEAP_FROM)));
      f.x = from.x + (landed.x - from.x) * leap;
      f.y = from.y + (landed.y - from.y) * leap;
      f.z = FOX_APEX * 4 * air * (1 - air);
      f.clip = 'fox_pounce';
      f.clipTime = u - FOX_LISTEN;
      return;
    }
    if (u < FOX_LISTEN + FOX_POUNCE + FOX_SNIFF) {
      f.x = landed.x;
      f.y = landed.y;
      f.clip = 'fox_sniff';
      f.clipTime = u - FOX_LISTEN - FOX_POUNCE;
      return;
    }
    const next = spot(k + 1);
    const w = (u - FOX_LISTEN - FOX_POUNCE - FOX_SNIFF) / FOX_WALK;
    f.x = landed.x + (next.x - landed.x) * w;
    f.y = landed.y + (next.y - landed.y) * w;
    f.clip = 'fox_trot';
    f.facing = Math.atan2(next.y - landed.y, next.x - landed.x);
  }

  /** Cap vers le joueur le plus proche, dehors (« il vous regarde »), ou `null`. */
  private facePlayer(world: ReadonlyWorld, x: number, y: number): number | null {
    let best: number | null = null;
    let distance = Number.POSITIVE_INFINITY;
    for (const c of world.characters) {
      if (c.inHouse) continue;
      const d = Math.hypot(c.pos.x - x, c.pos.y - y);
      if (d < distance && d > 0.1) {
        distance = d;
        best = Math.atan2(c.pos.y - y, c.pos.x - x);
      }
    }
    return best;
  }

  /** Hauteur du sol ou de l'eau sous une bête. */
  private groundAt(x: number, y: number): number {
    return this.terrain.heightAt(x, y);
  }

  /** L'échelle vibre de 1 cm pendant que Basile grimpe. */
  private shakeLadder(scene: MomentScene, view: ActorView, today: DeepReadonly<MomentToday>, t: number, context: FrameContext): void {
    if (today.phase !== 'climax' || today.paused || context.reducedMotion) return;
    const climber = scene.def.actors.find((a) => a.villager !== null);
    const track = climber === undefined ? undefined : scene.climax.get(climber.id);
    if (track === undefined) return;
    const s = sampleResolved(track.frames, track.points, t, this.sample);
    if (s.clip !== CLIMB || s.z <= 0) return;
    view.root.position.y += Math.sin(t * LADDER_SHAKE_HZ * Math.PI * 2) * LADDER_SHAKE;
  }

  /**
   * Habitants menés par le moment: Basile joue la chorégraphie de l'échelle (il grimpe au rythme
   * des barreaux, redresse le nichoir, cloue, redescend), et attend face à son échelle; les
   * `lookers` (Jeanne) tournent la tête vers la bête pendant l'apogée.
   */
  private direct(villager: DeepReadonly<VillagerState>, context: FrameContext): VillagerDirection | null {
    const current = this.currentMoment(context.world);
    if (current === null) return null;
    const { def, today } = current;
    const actor = def.actors.find((a) => a.villager === villager.id);
    if (actor === undefined) {
      if (today.phase !== 'climax' || !def.climax.lookers.includes(villager.id)) return null;
      const target = this.lookTarget(def);
      return target === null ? null : { kind: 'look', x: target.x, y: target.y };
    }
    if (today.phase === 'climax') {
      const scene = this.scene(def, context.world);
      const track = scene.climax.get(actor.id);
      if (track === undefined) return null;
      const t = this.phaseTime(today, context);
      const s = sampleResolved(track.frames, track.points, t, this.sample);
      const a = sampleResolved(track.frames, track.points, t + LOOK_AHEAD, this.ahead);
      const dx = a.x - s.x;
      const dy = a.y - s.y;
      const motion = Math.hypot(dx, dy);
      const facing = actor.keepFacing || motion <= MOVE_EPSILON ? actor.facing : Math.atan2(dy, dx);
      const clip = s.clip ?? 'idle';
      const since = t - s.clipSince;
      const nest = this.map.points[NEST_MODEL] ?? null;
      const reach = this.nestReach(clip, since, s.x, s.y);
      const base = { kind: 'pose' as const, x: s.x, y: s.y, z: s.z, facing, look: nest, tool: null, reach };
      this.directed.villager = villager.id;
      this.directed.x = s.x;
      this.directed.y = s.y;
      this.directed.z = s.z;
      this.directed.time = context.time;
      if (clip === CLIMB) {
        // Les pieds suivent les barreaux: l'instant du clip vient de la hauteur atteinte.
        const loop = SECONDS_PER_RUNG * 2;
        const time = (((s.z / this.rung) * SECONDS_PER_RUNG) % loop + loop) % loop;
        return { ...base, clip, clipTime: time, timeScale: 0 };
      }
      if (clip === REACH) return { ...base, clip, clipTime: Math.min(since, REACH_SECONDS - 1e-3), timeScale: 0 };
      if (clip === HAMMER) return { ...base, clip, clipTime: since % HAMMER_SECONDS, timeScale: 0, tool: HAMMER_MODEL };
      if (clip === WALK) {
        // Il recule sans se retourner: la marche jouée à l'envers.
        const speed = motion / LOOK_AHEAD;
        const forward = Math.cos(facing) * dx + Math.sin(facing) * dy >= 0 ? 1 : -1;
        const scale = (speed / RENDER_SETTINGS.characters.walkReferenceSpeed) * forward;
        return { ...base, clip, clipTime: null, timeScale: today.paused ? 0 : scale };
      }
      return { ...base, clip, clipTime: null, timeScale: 1 };
    }
    // En attente et après: à son point, face à son échelle et au nichoir (sauf s'il parle).
    if (today.phase !== 'waiting' && today.phase !== 'after') return null;
    const rest = restPosition(this.map, actor);
    const stopped = villager.speed <= RENDER_SETTINGS.characters.walkThreshold;
    if (!stopped || villager.talkingWith.length > 0 || Math.hypot(villager.pos.x - rest.x, villager.pos.y - rest.y) > 0.8) return null;
    const nest = this.map.points[NEST_MODEL] ?? null;
    return { kind: 'pose', x: villager.pos.x, y: villager.pos.y, z: 0, facing: actor.facing, clip: 'idle', clipTime: null, timeScale: 1, tool: null, look: nest, reach: null };
  }

  /**
   * Main droite de Basile au bas du nichoir pendant qu'il le redresse (`RENDER_SETTINGS.ladderReach`),
   * relâchée au début des coups de marteau; `null` hors de ces clips.
   */
  private nestReach(clip: string, since: number, x: number, y: number): HandReach | null {
    const settings = RENDER_SETTINGS.ladderReach;
    let weight = 0;
    if (clip === REACH) weight = smoothstep(settings.riseFrom, settings.riseTo, since);
    else if (clip === HAMMER) weight = 1 - smoothstep(0, settings.releaseSeconds, since);
    const nest = this.nest;
    if (weight <= 0 || nest === null) return null;
    if (this.nestBottom === null) {
      // Boîte du modèle dans son propre repère (une seule fois: la géométrie ne change pas).
      // Matrices locales seulement, du maillage jusqu'au nichoir (son pivot n'y entre pas).
      const box = new Box3();
      const chain = new Matrix4();
      nest.object.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const geometry = child.geometry as BufferGeometry;
        geometry.computeBoundingBox();
        const local = geometry.boundingBox;
        if (local === null) return;
        chain.identity();
        for (let node: Object3D | null = child; node !== null && node !== nest.object; node = node.parent) {
          node.updateMatrix();
          chain.premultiply(node.matrix);
        }
        box.union(local.clone().applyMatrix4(chain));
      });
      if (box.isEmpty()) return null;
      this.nestBottom = new Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
    }
    const p = this.reachPoint.copy(this.nestBottom).applyMatrix4(nest.object.matrixWorld);
    const dx = x - p.x;
    const dy = y - p.z;
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      p.x += (dx / length) * settings.inset;
      p.z += (dy / length) * settings.inset;
    }
    const target = this.reachTarget;
    target.x = p.x;
    target.y = p.z;
    target.z = p.y + settings.lift;
    target.weight = weight;
    return target;
  }

  /**
   * Pose de chorégraphie imposée à cet habitant pendant l'image `time` (x, y de la carte, z hauteur
   * au-dessus du sol dans `out`); faux s'il n'est pas mené par un moment à cette image.
   */
  directedPose(villagerId: string, time: number, out: Vector3): boolean {
    const d = this.directed;
    if (d.villager !== villagerId || d.time !== time) return false;
    out.set(d.x, d.y, d.z);
    return true;
  }

  /** Où regardent les habitants spectateurs: la première bête dessinée du moment. */
  private lookTarget(def: MomentDef): { x: number; y: number } | null {
    const scene = this.scenes.get(def.id);
    const view = scene?.views.find((v) => v.root.visible);
    if (view === undefined) return null;
    return { x: view.root.position.x, y: view.root.position.z };
  }

  dispose(): void {
    for (const scene of this.scenes.values()) {
      for (const view of scene.views) view.dispose();
      scene.glow?.dispose();
    }
    this.scenes.clear();
    this.hooks.length = 0;
    this.group.removeFromParent();
  }
}
