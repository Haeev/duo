/**
 * Personnages: les deux joueurs (coiffure et vêtements portés, `habillage.ts`;
 * plus de foulard depuis la 0.12) et les habitants, sur le squelette commun de
 * `personnages.glb`. Animations par `AnimationMixer` avec fondus enchaînés,
 * positions interpolées (`prev` vers `pos`), orientation lissée, outil en
 * main, clignement des yeux et expression selon la forme.
 */
import { isHome, isSheltered } from '../etat/interieurs';
import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  Group,
  Mesh,
  SkinnedMesh,
  Sphere,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import type {
  WorldEvent,
  ActionKind,
  Character,
  CharacterId,
  DeepReadonly,
  FormLevel,
  ReadonlyWorld,
  VillagerState,
} from '../etat/types';
import { SIM_HZ } from '../etat/types';
import { BoneOffsets, poseEnvelope, stableUnit, termAngle } from './attentes';
import { ArmReach } from './portee';
import type { Content } from '../donnees/types';
import { seasonOfDay } from '../donnees/calendrier';
import type { GameMap, MapProp } from '../etat/carte';
import {
  BenchSeating,
  FurnitureSeats,
  benchesWithBuilt,
  isFurnitureSeat,
  seatPlace,
  slotsOf,
  type BenchPlace,
  type BenchSeat,
  type SeatProp,
} from '../etat/bancs';
import { flagSeats, flaggedWorks } from '../etat/drapeaux';
import { safeColor } from './apparence';
import { type DressedFigure, PlayerDresser, PlayerTexture, mergeOutfit, playerMeshNames } from './habillage';
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
import type { SharedMaterials } from './materiaux';
import { CHARACTERS_FILE, textHash, type ModelLibrary } from './modeles';
import { IDLE_POSES, RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';
import type { EventfulPart } from './monde';
import { ShapeBuilder } from './geometrie';
import { sleepPose, type SleepPose } from './coucher';
import { holdSpecFor, ToolHolder } from './prise';
import { plantedFootSpeed } from './foulee';
import { IDLE_CLIP, applyBoneRest, boneRestOf, idleClipOf } from './gabarit';
import { CLIP_FOR_ACTION } from './gestes';
import { VillagerGestures, gestureClipAt } from '../etat/gestes-habitants';
import type { GestureDef } from '../donnees/gestes-0-13';
import {
  VillagerCarry,
  accessoryMaterial,
  chooseProp,
  villagerHabit,
  villagerScale,
  type MaterialSwap,
  type PropSituation,
  type VillagerPropRule,
} from './accessoires';
import { loadShape, type CarrierHands } from './portage-deux';

const SETTINGS = RENDER_SETTINGS.characters;
/** Nom du groupe animé (squelette et maillages) dans `personnages.glb`. */
const RIG_NODE = 'rig';
/** Corps des joueurs: ses extras disent leur gabarit et leur pose de repos. */
const PLAYER_BODY = 'player_base';
const HAND_SOCKET = 'socket_hand_r';
/** Porteur d'une charge courte qui recule: son pas va à plus de 100° de son regard (cosinus). */
const BACKWARD_COS = 0.17;
const PICK_RADIUS = 0.42;
const PICK_HEIGHT = 1.8;
const GROUND_HALF_LIFE = 0.06;
/** Chevilles du squelette commun, pour mesurer la foulée des clips de marche (`foulee.ts`). */
const FEET: readonly string[] = ['foot_l', 'foot_r'];
const WALK = 'walk';
const CARRY = 'carry_two';
/** Bout de la canne à pêche de l'artiste: nœud vide, et sa place dans le repère de la prise s'il manque. */
const ROD_TIP_NODE = 'fishing_rod_tip';
const ROD_TIP = new Vector3(0, 1.34, 1.49);
const ROD_ITEM = 'fishing_rod';
/** Animations de pêche et d'assise par terre de l'artiste (mêmes poses de départ et d'arrivée). */
const FISH_CAST = 'fish_cast';
const FISH_WAIT = 'fish_wait';
const FISH_STRIKE = 'fish_strike';
/** Montrer la prise à deux mains (2 s, R4 de la 0.12), joué après le ferrage s'il est livré. */
export const FISH_SHOW = 'fish_show';
const LEFT_HAND_SOCKET = 'socket_hand_l';
const SIT_CHAIR = 'sit';
const SIT_GROUND = 'sit_ground';
const SIT_EAT = 'sit_eat';
const GIVE = 'give';
const HIGH_FIVE = 'high_five';
const WAVE = 'wave';
const PET = 'pet';
/** Tenir l'échelle de Basile (geste « tenir » des moments rares). */
const HOLD_LADDER = 'hold_ladder';
const FISH_CLIPS: ReadonlySet<string> = new Set([FISH_CAST, FISH_STRIKE, FISH_SHOW]);
const NO_VARIANTS: readonly string[] = [];
/** Attentes d'un joueur, et les mêmes avec la poule à caresser. */
const PLAYER_VARIANTS = SETTINGS.idleVariants.players ?? NO_VARIANTS;
const PLAYER_VARIANTS_HEN: readonly string[] = [...PLAYER_VARIANTS, PET];
const DEGREE = Math.PI / 180;
/** Fondu court entre les clips de pêche, qui partent et finissent sur la même pose. */
const FISH_FADE = 0.1;
/** Un événement d'assise est suivi ce temps (s), le temps que l'état complet le rattrape (5 par seconde). */
const SEAT_EVENT_SECONDS = 0.6;
/** Boîte de clic d'une place de banc (m): une moitié d'assise et le dossier. */
const BENCH_PICK_RADIUS = 0.45;
const BENCH_PICK_HEIGHT = 0.9;
/** Bornes du calage d'un geste: part de la durée prise par l'avance du contact, départ au plus tard dans le clip. */
const GESTURE_LEAD_SHARE_MAX = 0.5;
const GESTURE_START_MAX = 0.9;
const BODY_CENTER = 0.9;
const BODY_RADIUS = 1.3;

/** Perche de l'allumeur, en main le temps d'allumer une lanterne (tour 9). */
const LAMP_POLE = 'lamp_pole';
const POLE_RAISE = 'pole_raise';
const POLE_LOWER = 'pole_lower';
/**
 * Tour 9 (section 2.7): ce qu'un habitant porte une fois son cadeau reçu. L'écharpe de Firmin,
 * dès le lendemain de la remise, en automne et en hiver.
 */
const VILLAGER_WORN: Readonly<Record<string, { model: string; when: (world: ReadonlyWorld, content: Content) => boolean }>> = {
  firmin: {
    model: 'villager_firmin_scarf',
    when: (world, content) => {
      const given = world.giftsGiven.firmin ?? null;
      const season = seasonOfDay(content.settings, world.clock.day);
      return given !== null && given < world.clock.day && (season === 'autumn' || season === 'winter');
    },
  },
};
const NO_PROPS: readonly VillagerPropRule[] = [];
const NO_CLIPS: ReadonlyMap<string, AnimationClip> = new Map();

/** Pièces portées d'un habitant, fusionnées au corps: celle de `VILLAGER_WORN`, puis les règles `worn`. */
function wornModels(id: string): string[] {
  const models: string[] = [];
  const scarf = VILLAGER_WORN[id]?.model;
  if (scarf !== undefined) models.push(scarf);
  for (const rule of SETTINGS.villagerProps[id] ?? NO_PROPS) {
    if (rule.mount === 'worn' && !models.includes(rule.model)) models.push(rule.model);
  }
  return models;
}

/** Ce que le rendu garde d'un habitant d'une image à l'autre pour ses accessoires (0.13). */
interface VillagerProps {
  carry: VillagerCarry;
  /** Positions des deux mains (objet tenu devant soi), fonction créée une fois. */
  hands: (left: Vector3, right: Vector3) => boolean;
  carried: VillagerPropRule | null;
  worn: VillagerPropRule | null;
  /** Habitude d'avant la marche en cours (`PropSituation.left`). */
  left: string | null;
  situation: PropSituation;
}

function isSkinned(object: Object3D | undefined): object is SkinnedMesh {
  return object instanceof SkinnedMesh;
}

/** Catégorie des sièges sans modèle de la carte (`sieges`: le bord du ponton). */
const EDGE_SEAT_CATEGORY = 'siege';
/** Sorte d'outil de la canne (`toolKind`): l'outil de départ ou la canne en bambou. */
const ROD_KIND = 'fishing_rod';

/** Actions pendant lesquelles l'outil reste rangé. */
const HANDS_FREE: ReadonlySet<ActionKind> = new Set([
  'cook',
  'sleep',
  'sit',
  'eat',
  'talk',
  'carry',
  'pickup',
]);

/** Expression du visage (cibles de morphose de l'artiste) selon la forme du joueur. */
const FORM_EXPRESSION: Readonly<Record<FormLevel, { target: string; weight: number } | null>> = {
  low: { target: 'tired', weight: 0.7 },
  okay: null,
  good: { target: 'happy', weight: 0.35 },
  great: { target: 'happy', weight: 0.75 },
  radiant: { target: 'delighted', weight: 0.8 },
};
const EXPRESSIONS = ['happy', 'tired', 'hungry', 'delighted'] as const;
const BLINK_TARGET = 'blink';
const TALK_EXPRESSION_WEIGHT = 0.4;

/** Ce qu'un habitant fait selon son activité d'emploi du temps (et son poste, pour le travail). */
function villagerClip(villager: DeepReadonly<VillagerState>): string {
  if (villager.speed > SETTINGS.walkThreshold) {
    return 'walk';
  }
  if (villager.talkingWith.length > 0) {
    return 'talk';
  }
  switch (villager.activity) {
    case 'work':
      return SETTINGS.villagerWork[villager.target] ?? SETTINGS.villagerWorkDefault;
    case 'play':
      return 'wave';
    default:
      return 'idle';
  }
}

/** Ce que le personnage doit jouer à cette image. */
interface ClipRequest {
  name: string;
  timeScale: number;
  /** Joué une fois, figé sur sa dernière pose. */
  once?: boolean;
  /** Change à chaque nouvelle demande d'un clip joué une fois (le relance même s'il joue déjà). */
  token?: number;
  /** Partir du début (pose commune des clips de pêche) plutôt que d'une phase propre au personnage. */
  fromStart?: boolean;
  /** Instant de départ dans le clip (s) pour un clip joué une fois. */
  startAt?: number;
  fade?: number;
  /**
   * Instant imposé dans le clip à chaque image (s), le mélangeur n'avance pas: une chorégraphie
   * cale l'animation sur son propre temps (Basile qui grimpe au rythme des barreaux).
   */
  exactTime?: number;
}

/** Main droite posée sur un point: x, y de la carte, z hauteur dans le monde, poids de 0 à 1 (`portee.ts`). */
export interface HandReach {
  x: number;
  y: number;
  z: number;
  weight: number;
}

/**
 * Habitant mené par une chorégraphie (moments rares, `moments.ts`): `pose` le place et l'anime
 * à la place de son emploi du temps (Basile sur l'échelle), `look` lui fait seulement tourner la
 * tête vers la cible (les `lookers` de l'apogée).
 */
export type VillagerDirection =
  | {
      kind: 'pose';
      x: number;
      y: number;
      /** Hauteur au-dessus du sol (m). */
      z: number;
      facing: number;
      clip: string;
      /** Instant imposé dans le clip, ou `null`: le clip joue à son rythme. */
      clipTime: number | null;
      timeScale: number;
      /** Outil en main (modèle), ou `null`. */
      tool: string | null;
      /** Regard (tête), ou `null`. */
      look: { x: number; y: number } | null;
      /** Main droite posée sur un point, ou `null`: le clip seul. */
      reach: HandReach | null;
    }
  | { kind: 'look'; x: number; y: number };

/** Qui mène les habitants à cette image (`null`: leur emploi du temps). */
export type VillagerDirector = (
  villager: DeepReadonly<VillagerState>,
  context: FrameContext,
) => VillagerDirection | null;

class CharacterFigure {
  readonly root = new Group();
  private readonly mixer: AnimationMixer | null;
  private readonly actions = new Map<string, AnimationAction>();
  private current: AnimationAction | null = null;
  private currentName = '';
  private readonly faces: Mesh[] = [];
  private readonly hand: Object3D | null;
  private readonly leftHand: Object3D | null;
  private tool: Object3D | null = null;
  private toolName = '';
  private facing: number | null = null;
  private ground: number | null = null;
  private readonly phase: number;
  readonly pick: PickTarget;
  private readonly position = { x: 0, y: 0 };
  /** Rotations d'os ajoutées au clip (attentes procédurales, regard). */
  private readonly offsets: BoneOffsets;
  /** Main droite amenée sur un point (habitant mené par une chorégraphie). */
  private readonly reach: ArmReach;
  private readonly reachTarget = new Vector3();
  /** Prise de l'outil tenu (R08): port hors geste, prise de l'artiste pendant le geste. */
  private readonly holder = new ToolHolder();
  private readonly carryTarget = new Vector3();
  private reachWeight = 0;
  private idleFor = 0;
  private idleRank = 0;
  private idleNextAt: number;
  /** Attente variée en cours (pose procédurale, ou clip joué une fois si `pose` est nul). */
  private variant: { name: string; start: number; seconds: number; procedural: boolean } | null =
    null;
  private variantWasClip = false;
  private readonly lookPoint = { x: 0, y: 0 };
  private lookTarget: { x: number; y: number } | null = null;
  private lookYaw = 0;
  /** Le buste tourne avec le regard (faux: la tête seule, mains posées sur un vélo ou un accordéon). */
  private lookBody = true;

  constructor(
    readonly id: string,
    model: Object3D,
    private readonly clips: ReadonlyMap<string, AnimationClip>,
    pick: PickTarget,
    scale: number,
    /** Clip joué quand le rendu demande `idle` (pose de repos propre d'un personnage refait, `gabarit.ts`). */
    private readonly idleClip: string = IDLE_CLIP,
  ) {
    this.root.name = `personnage ${id}`;
    this.root.add(model);
    this.root.scale.setScalar(scale);
    this.pick = pick;
    this.phase = (textHash(id) % 1000) / 1000;
    this.mixer = clips.size > 0 ? new AnimationMixer(model) : null;
    model.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if (object instanceof SkinnedMesh) {
          // Sphère fixe autour du corps: l'élimination hors champ reste juste quelle que soit l'animation.
          object.boundingSphere = new Sphere(new Vector3(0, BODY_CENTER, 0), BODY_RADIUS);
        }
        if (object.morphTargetInfluences !== undefined) {
          // Les poids par défaut du GLB valent 1: on part d'un visage neutre.
          object.morphTargetInfluences.fill(0);
          this.faces.push(object as Mesh);
        }
      }
    });
    this.hand = model.getObjectByName(HAND_SOCKET) ?? null;
    this.leftHand = model.getObjectByName(LEFT_HAND_SOCKET) ?? null;
    this.offsets = new BoneOffsets(model);
    this.reach = new ArmReach(model, 'chest', 'upper_arm_r', 'forearm_r', HAND_SOCKET);
    this.idleNextAt = this.idleDelay();
  }

  /** Mains (prises des outils) dans le repère du monde, après l'animation de cette image. Faux sans squelette. */
  handsWorld(left: Vector3, right: Vector3): boolean {
    if (this.hand === null || this.leftHand === null) return false;
    this.root.updateMatrixWorld(true);
    this.leftHand.getWorldPosition(left);
    this.hand.getWorldPosition(right);
    return true;
  }

  private idleDelay(): number {
    const range = SETTINGS.idleAfterSeconds;
    return range.min + (range.max - range.min) * stableUnit(this.id, this.idleRank, 'idle');
  }

  /** Regard vers ce point de la carte (habitant attentif), ou droit devant (`null`). */
  /** Regard du buste et du cou en plus de la tête (vrai), ou de la tête seule. */
  setLookBody(enabled: boolean): void {
    this.lookBody = enabled;
  }

  lookAt(target: DeepReadonly<{ x: number; y: number }> | null): void {
    if (target === null) {
      this.lookTarget = null;
      return;
    }
    this.lookPoint.x = target.x;
    this.lookPoint.y = target.y;
    this.lookTarget = this.lookPoint;
  }

  /** Main droite vers ce point de la carte (z: hauteur dans le monde), ou `null`. */
  setReach(target: HandReach | null): void {
    this.reachWeight = target === null ? 0 : target.weight;
    if (target !== null) {
      this.reachTarget.set(target.x, target.z, target.y);
    }
  }

  /** Joue `clip` une fois par-dessus l'attente (salut). Faux s'il n'existe pas ou si autre chose joue. */
  playOnce(clip: string, time: number): boolean {
    const duration = this.clips.get(clip)?.duration ?? 0;
    if (duration <= 0 || this.currentName !== this.idleClip) {
      return false;
    }
    this.variant = { name: clip, start: time, seconds: duration, procedural: false };
    return true;
  }

  /**
   * Attente variée: après `idleFor` d'immobilité, une attente tirée de
   * `variants` (stable par personnage), puis retour à `idle`. Renvoie la
   * demande à jouer à la place de `request`.
   */
  private idleRequest(
    request: ClipRequest,
    time: number,
    dt: number,
    variants: readonly string[],
  ): ClipRequest {
    if (request.name !== IDLE_CLIP) {
      this.idleFor = 0;
      this.variant = null;
      this.variantWasClip = false;
      return request;
    }
    this.idleFor += dt;
    if (
      this.variant === null &&
      variants.length > 0 &&
      this.lookTarget === null &&
      this.idleFor >= this.idleNextAt
    ) {
      const picked =
        variants[Math.floor(stableUnit(this.id, this.idleRank, 'pick') * variants.length)] ?? '';
      // Outil en main: pas d'attente qui lève les bras, on prend la suivante permise.
      const name = this.allowed(picked)
        ? picked
        : (variants.find((candidate) => this.allowed(candidate)) ?? '');
      const pose = IDLE_POSES[name];
      const seconds = pose?.seconds ?? this.clips.get(name)?.duration ?? 0;
      if (seconds > 0) {
        this.variant = { name, start: time, seconds, procedural: pose !== undefined };
      } else {
        this.idleFor = 0;
      }
    }
    const variant = this.variant;
    if (
      variant !== null &&
      (time - variant.start >= variant.seconds || !this.allowed(variant.name))
    ) {
      this.variant = null;
      this.idleFor = 0;
      this.idleRank += 1;
      this.idleNextAt = this.idleDelay();
    }
    if (this.variant !== null && !this.variant.procedural) {
      this.variantWasClip = true;
      return {
        name: this.variant.name,
        timeScale: 1,
        once: true,
        token: this.variant.start,
        fade: SETTINGS.idleFadeSeconds,
      };
    }
    if (this.variantWasClip) {
      this.variantWasClip = false;
      return { ...request, fade: SETTINGS.idleFadeSeconds };
    }
    return request;
  }

  /** Attente permise maintenant: celles qui lèvent les bras, seulement les mains vides. */
  private allowed(name: string): boolean {
    return this.tool === null || IDLE_POSES[name]?.raisesArms !== true;
  }

  /** Pose procédurale et regard, ajoutés aux os après le mélangeur. */
  private applyOffsets(time: number, dt: number): void {
    this.offsets.begin();
    const variant = this.variant;
    const pose = variant?.procedural === true ? IDLE_POSES[variant.name] : undefined;
    if (variant !== null && pose !== undefined) {
      const t = time - variant.start;
      const envelope = poseEnvelope(t, pose.seconds, SETTINGS.idleFadeSeconds);
      for (const term of pose.terms) {
        this.offsets.add(term.bone, term.axis, termAngle(term, t, pose.seconds, envelope));
      }
    }
    let wanted = 0;
    const target = this.lookTarget;
    if (target !== null && this.facing !== null) {
      // Direction de la cible dans le repère du personnage (devant: +Z).
      const dx = target.x - this.root.position.x;
      const dz = target.y - this.root.position.z;
      const cos = Math.cos(this.facing);
      const sin = Math.sin(this.facing);
      const limit = SETTINGS.lookMaxDegrees * DEGREE;
      wanted = Math.max(
        -limit,
        Math.min(limit, Math.atan2(cos * dx - sin * dz, sin * dx + cos * dz)),
      );
    }
    this.lookYaw += (wanted - this.lookYaw) * smoothFactor(dt, SETTINGS.lookHalfLife);
    if (Math.abs(this.lookYaw) > 1e-3) {
      const shares = SETTINGS.lookShares;
      if (this.lookBody) {
        this.offsets.add('chest', 'up', this.lookYaw * shares.chest);
        this.offsets.add('neck', 'up', this.lookYaw * shares.neck);
      }
      this.offsets.add('head', 'up', this.lookYaw * shares.head);
    }
    this.offsets.apply(this.root);
  }

  private play(request: ClipRequest): void {
    if (this.mixer === null) {
      return;
    }
    const wanted = request.name === IDLE_CLIP ? this.idleClip : request.name;
    const clip = this.clips.get(wanted) ?? this.clips.get(this.idleClip) ?? this.clips.get(IDLE_CLIP);
    if (clip === undefined) {
      return;
    }
    let action = this.actions.get(clip.name);
    if (action === undefined) {
      action = this.mixer.clipAction(clip);
      this.actions.set(clip.name, action);
    }
    action.timeScale = request.timeScale;
    const restart = request.token !== undefined && request.token !== this.currentToken;
    if (clip.name === this.currentName && !restart) {
      return;
    }
    const fade = request.fade ?? SETTINGS.crossFadeSeconds;
    const sameAction = action === this.current;
    action.reset();
    action.setLoop(
      request.once === true ? LoopOnce : LoopRepeat,
      request.once === true ? 1 : Infinity,
    );
    action.clampWhenFinished = request.once === true;
    action.time =
      request.once === true
        ? Math.min(request.startAt ?? 0, clip.duration)
        : request.fromStart === true
          ? 0
          : this.phase * clip.duration;
    if (sameAction) {
      // Le même geste relancé (deux lancers de suite): pas de fondu sur soi-même.
      action.play();
    } else {
      action.fadeIn(fade).play();
      this.current?.fadeOut(fade);
    }
    this.current = action;
    this.currentName = clip.name;
    this.currentToken = request.token;
  }

  private currentToken: number | undefined;

  /**
   * Position (monde) d'un point de l'outil tenu: le nœud `node` du modèle
   * s'il existe, sinon le point `local` du repère de l'outil; `false` sans outil.
   */
  toolPoint(node: string, local: Vector3, out: Vector3): boolean {
    if (this.tool === null) {
      return false;
    }
    // Le bout d'un outil de remplacement porte le nom de son modèle (`fishing_rod_bamboo_tip`).
    const anchor = this.tool.getObjectByName(node) ?? this.tool.getObjectByName(`${this.toolName}_tip`);
    if (anchor !== undefined) {
      anchor.getWorldPosition(out);
      return true;
    }
    this.tool.updateWorldMatrix(true, false);
    out.copy(local);
    this.tool.localToWorld(out);
    return true;
  }

  /** Position (monde) de la prise d'une main; `false` si le modèle n'a pas son accroche. */
  handPoint(side: 'left' | 'right', out: Vector3): boolean {
    const hand = side === 'left' ? this.leftHand : this.hand;
    if (hand === null) return false;
    hand.getWorldPosition(out);
    return true;
  }

  setTool(
    library: ModelLibrary,
    model: string | null,
    swap: { palette: Material; held: Material } | null = null,
  ): void {
    const name = model ?? '';
    if (name === this.toolName || this.hand === null) {
      return;
    }
    this.tool?.removeFromParent();
    this.tool = model === null ? null : library.instantiate(model);
    this.tool?.traverse((object) => {
      object.castShadow = true;
      // Copie propre à l'outil: le modèle partagé de la bibliothèque garde son matériau.
      if (swap !== null && object instanceof Mesh && object.material === swap.palette) {
        object.material = swap.held;
      }
    });
    if (this.tool !== null) {
      this.hand.add(this.tool);
    }
    this.toolName = name;
    this.holder.set(model === null ? null : holdSpecFor(model, library.extras(model)));
  }

  private setMorph(target: string, weight: number): void {
    for (const face of this.faces) {
      const index = face.morphTargetDictionary?.[target];
      if (index !== undefined && face.morphTargetInfluences !== undefined) {
        face.morphTargetInfluences[index] = weight;
      }
    }
  }

  /** Visage: expression et clignement (toutes les quelques secondes, décalé par personnage). */
  updateFace(time: number, expression: { target: string; weight: number } | null): void {
    for (const target of EXPRESSIONS) {
      this.setMorph(target, expression?.target === target ? expression.weight : 0);
    }
    const cycle = (time / SETTINGS.blinkEverySeconds + this.phase) % 1;
    const blinkShare = SETTINGS.blinkSeconds / SETTINGS.blinkEverySeconds;
    this.setMorph(BLINK_TARGET, cycle < blinkShare ? Math.sin((cycle / blinkShare) * Math.PI) : 0);
  }

  /** Place, oriente et anime le personnage pour cette image. */
  update(
    context: FrameContext,
    terrain: Terrain,
    prev: { x: number; y: number },
    pos: { x: number; y: number },
    facing: number,
    request: ClipRequest,
    lift = 0,
    variants: readonly string[] = NO_VARIANTS,
  ): void {
    const teleport = Math.hypot(pos.x - prev.x, pos.y - prev.y) > SETTINGS.teleportDistance;
    const at = teleport ? pos : interpolate(prev, pos, context.alpha, this.position);
    const targetGround = terrain.standHeight(at.x, at.y);
    this.ground =
      this.ground === null || teleport
        ? targetGround
        : this.ground + (targetGround - this.ground) * smoothFactor(context.dt, GROUND_HALF_LIFE);
    const yaw = yawFromFacing(facing);
    this.facing =
      this.facing === null || teleport
        ? yaw
        : dampAngle(this.facing, yaw, smoothFactor(context.dt, SETTINGS.turnHalfLife));
    this.root.position.set(at.x, this.ground + lift, at.y);
    this.root.rotation.y = this.facing;
    this.play(this.idleRequest(request, context.time, context.dt, variants));
    if (request.exactTime !== undefined && this.current !== null) {
      this.current.time = Math.max(0, request.exactTime);
    }
    this.reach.restore();
    this.offsets.restore();
    this.mixer?.update(context.dt);
    if (this.mixer !== null) {
      this.applyOffsets(context.time, context.dt);
      if (this.reachWeight > 0) {
        this.reach.apply(this.root, this.reachTarget, this.reachWeight);
      } else if (this.tool !== null) {
        // Port de l'outil hors geste: la main droite va à sa place (houe sur l'épaule).
        const carry = this.holder.handTarget(this.root, this.currentName, context.dt, this.carryTarget);
        if (carry > 0) {
          this.reach.apply(this.root, this.carryTarget, carry);
        }
      }
    }
    if (this.tool !== null && this.hand !== null) {
      this.holder.place(this.root, this.hand, this.tool);
    }
    setStandingBox(
      this.pick.box,
      at.x,
      this.ground,
      at.y,
      PICK_RADIUS * this.root.scale.x,
      PICK_HEIGHT * this.root.scale.y,
    );
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    this.root.removeFromParent();
  }
}

interface PlayerEntry {
  figure: CharacterFigure;
  /** Assis au dernier rendu (place affichée), pour le glissement d'entrée et de sortie. */
  seated: boolean;
  /** Écart restant à résorber entre la position affichée et la cible (m), et son départ. */
  glide: { x: number; y: number; start: number };
  /** Corps, coiffure et vêtements fusionnés (`habillage.ts`), `null` pour le substitut sans modèle. */
  dressed: DressedFigure | null;
}

export class CharactersPart implements EventfulPart {
  readonly group = new Group();
  private readonly clips = new Map<string, AnimationClip>();
  private readonly players = new Map<CharacterId, PlayerEntry>();
  private readonly villagers = new Map<string, CharacterFigure>();
  /** Habillage des joueurs (vêtements de la 0.12), partagé par les deux. */
  private readonly dresser: PlayerDresser;
  private readonly playerMeshes: string[];

  constructor(
    private readonly library: ModelLibrary,
    private readonly materials: SharedMaterials,
    private readonly terrain: Terrain,
    private readonly resources: ResourceTracker,
    private readonly picks: PickRegistry,
    private readonly content: Content,
    /** Bancs de la carte (places des joueurs assis par choix et des habitants arrêtés dessus). */
    private benches: readonly MapProp[] = [],
    /** Points de la carte: un habitant s'assoit sur le banc qui est le point de son emploi du temps. */
    private readonly points: Readonly<Record<string, { x: number; y: number }>> = {},
    /** Carte (tour 9: bancs des chantiers bâtis, `benchesWithBuilt`), `null` dans les essais. */
    private readonly map: GameMap | null = null,
  ) {
    this.group.name = 'personnages';
    this.dresser = new PlayerDresser(content.clothes, resources);
    this.playerMeshes = playerMeshNames(content.clothes);
    for (const clip of library.animations(CHARACTERS_FILE)) {
      this.clips.set(clip.name, clip);
    }
    this.addBenchPicks(benches);
    const rig = library.cloneRig(RIG_NODE, []);
    this.walkReference = this.footSpeed(rig, WALK) ?? SETTINGS.walkReferenceSpeed;
    this.carryReference = this.footSpeed(rig, CARRY) ?? SETTINGS.carryReferenceSpeed;
    this.carryOneReference = this.footSpeed(rig, SETTINGS.carryOne.walk) ?? this.walkReference;
    this.bikeReference = this.footSpeed(rig, SETTINGS.bikes.walkClip) ?? this.walkReference;
    const shared = library.sharedCharacterMaterial();
    this.propSwap = shared === null ? null : { palette: shared, held: accessoryMaterial(materials.held, shared, resources) };
    this.decorGestures = map === null ? null : new VillagerGestures(content, map);
  }

  /** 0.13 (lot H7): gestes des habitants avec le décor (`gestes-0-13.json`), `null` sans carte (essais). */
  private readonly decorGestures: VillagerGestures | null;

  /** Accessoires des habitants peints dans la texture des personnages, sans programme de plus (`accessoryMaterial`). */
  private readonly propSwap: MaterialSwap | null;

  private readonly carryOneReference: number;
  /** Vitesse du pied posé de `push_bike` (vélo poussé, 0.13). */
  private readonly bikeReference: number;
  /** Accessoires des habitants (0.13, `accessoires.ts`). */
  private readonly villagerProps = new Map<string, VillagerProps>();

  /** Assis ou debout à l'image d'avant, par personnage, et le clip de passage en cours. */
  private readonly postures = new Map<string, { seated: boolean; clip: string | null; start: number }>();

  /**
   * S'asseoir et se lever: au changement, `sit_down` ou `stand_up` joué une fois à la place de la
   * demande (pas de lever qui glisse: en marchant, on part tout de suite), puis la demande avec un
   * fondu court (les clips finissent sur la pose de `sit` ou debout).
   */
  private posture(key: string, seated: boolean, moving: boolean, request: ClipRequest): ClipRequest {
    const state = this.postures.get(key);
    if (state === undefined) {
      this.postures.set(key, { seated, clip: null, start: this.time });
      return request;
    }
    const settings = SETTINGS.posture;
    if (state.seated !== seated) {
      state.seated = seated;
      state.clip = seated ? settings.sitDown : moving ? null : settings.standUp;
      state.start = this.time;
    }
    if (state.clip === null) return request;
    const clip = this.clips.get(state.clip);
    if (clip !== undefined && this.time - state.start < clip.duration && (seated || !moving)) {
      return { name: clip.name, timeScale: 1, once: true, token: state.start, fade: settings.fadeSeconds };
    }
    state.clip = null;
    return { ...request, fade: settings.fadeSeconds };
  }

  /** Vitesse du pied posé (m/s) des clips de marche, mesurée au chargement (`foulee.ts`). */
  private readonly walkReference: number;
  private readonly carryReference: number;

  private footSpeed(rig: Object3D | null, name: string): number | null {
    const clip = this.clips.get(name);
    return rig === null || clip === undefined ? null : plantedFootSpeed(rig, clip, FEET);
  }

  /** Rythme d'un clip de marche pour que le pied posé ne glisse pas (`scale`: taille du personnage). */
  private strideScale(speed: number, reference: number, scale: number): number {
    return Math.min(SETTINGS.walkScaleMax, Math.max(SETTINGS.walkScaleMin, speed / (reference * scale)));
  }

  /** Ce joueur trait-il une chèvre, ou la tient-il pour l'autre ? */
  private milking(character: DeepReadonly<Character>, world: ReadonlyWorld): boolean {
    return world.breeding.goats.some(
      (goat) => goat.milking !== null && (goat.milking.by === character.id || goat.milking.holder === character.id),
    );
  }

  /** Main droite posée sur la draisine poussée, réutilisée d'une image à l'autre. */
  private readonly pushPoint: HandReach = { x: 0, y: 0, z: 0, weight: 0 };

  /** Où pose la main celui qui pousse la draisine en marchant, ou `null` si elle n'est pas devant lui. */
  private pushReach(character: DeepReadonly<Character>, world: ReadonlyWorld): HandReach | null {
    const beam = world.beam;
    if (beam === null) return null;
    const dx = beam.pos.x - character.pos.x;
    const dy = beam.pos.y - character.pos.y;
    const distance = Math.hypot(dx, dy);
    const ahead = dx * Math.cos(character.facing) + dy * Math.sin(character.facing);
    if (distance > SETTINGS.push.reach || ahead <= 0) return null;
    const point = this.pushPoint;
    point.x = beam.pos.x;
    point.y = beam.pos.y;
    point.z = this.terrain.heightAt(beam.pos.x, beam.pos.y) + SETTINGS.push.handHeight;
    point.weight = SETTINGS.push.weight;
    return point;
  }

  /**
   * Un clic sur une moitié de banc vise sa place (sol au milieu de l'assise): la simulation y
   * mène et y assoit. Sans cette boîte, le rayon touchait le sol derrière le banc.
   */
  private addBenchPicks(benches: readonly MapProp[]): void {
    const place: BenchPlace = { x: 0, y: 0, facing: 0 };
    for (const prop of benches) {
      for (let slot = 0; slot < slotsOf(prop, this.content.settings.benches).length; slot += 1) {
        seatPlace(prop, slot, this.content.settings.benches, place);
        const target = this.picks.add({ kind: 'ground', x: place.x, y: place.y });
        setStandingBox(
          target.box,
          place.x,
          this.terrain.heightAt(place.x, place.y),
          place.y,
          BENCH_PICK_RADIUS,
          BENCH_PICK_HEIGHT,
        );
        target.enabled = true;
      }
    }
  }

  /** Signature des chantiers bâtis vus à l'image d'avant (aucune allocation tant qu'elle ne change pas). */
  private builtSignature = 0;
  private readonly builtIds: string[] = [];

  /** Bancs des chantiers bâtis (banc du gué, banc du pignon), dans l'ordre de la simulation. */
  private refreshBenches(world: ReadonlyWorld): void {
    if (this.map === null) return;
    const effects = this.content.settings.flagEffects;
    const flagged = flaggedWorks(effects, world.flags);
    const chairs = flagSeats(effects, world.flags);
    let signature = (Math.imul(flagged.length, 31) + chairs.length) | 0;
    for (const def of this.content.improvements) {
      const day = world.improvements[def.id]?.builtDay ?? null;
      signature = (Math.imul(signature, 31) + (day === null ? 0 : day + 1)) | 0;
    }
    if (signature === this.builtSignature) return;
    this.builtSignature = signature;
    this.builtIds.length = 0;
    for (const def of this.content.improvements) {
      if ((world.improvements[def.id]?.builtDay ?? null) !== null) this.builtIds.push(def.id);
    }
    // Le banc d'Hortense et les chaises du café: les drapeaux de quête les rendent utilisables.
    for (const id of flagged) if (!this.builtIds.includes(id)) this.builtIds.push(id);
    const before = new Set(this.benches);
    const built = benchesWithBuilt(this.map, this.builtIds);
    this.benches = chairs.length === 0 ? built : [...built, ...chairs];
    this.addBenchPicks(this.benches.filter((bench) => !before.has(bench)));
  }

  /** Geste de pêche joué une fois par joueur (lancer, ferrer), avec son début. */
  private readonly oneShot = new Map<
    CharacterId,
    { clip: string; start: number; duration: number }
  >();
  /** Geste à jouer une fois le geste en cours fini (montrer la prise après le ferrage). */
  private readonly queuedShot = new Map<CharacterId, string>();
  private time = 0;

  /** Le clip existe-t-il dans les animations de l'artiste ? */
  hasClip(name: string): boolean {
    return this.clips.has(name);
  }

  /** Prise d'une main d'un joueur (monde), `false` sans personnage ou sans accroche. */
  handPoint(id: CharacterId, side: 'left' | 'right', out: Vector3): boolean {
    return this.players.get(id)?.figure.handPoint(side, out) ?? false;
  }

  handleEvent(event: WorldEvent): void {
    if (event.type === 'cast') {
      this.startOneShot(event.by, FISH_CAST);
    } else if (event.type === 'caught' || event.type === 'escaped') {
      this.startOneShot(event.by, FISH_STRIKE);
      if (event.type === 'caught' && this.clips.has(FISH_SHOW)) this.queuedShot.set(event.by, FISH_SHOW);
    } else if (event.type === 'gave') {
      this.startOneShot(event.by, GIVE);
    } else if (event.type === 'sat_down') {
      this.seatEvents.set(event.by, {
        seat: { bench: event.bench, slot: event.slot, since: 0 },
        at: this.time,
      });
    } else if (event.type === 'stood_up') {
      this.seatEvents.set(event.by, { seat: null, at: this.time });
    } else if (
      (event.type === 'envie_done' && event.by === 'both') ||
      event.type === 'quest_done'
    ) {
      // Réussite à deux: on se tape dans la main si l'on est côte à côte (vu à l'image suivante).
      this.highFivePending = true;
    }
  }

  private highFivePending = false;
  private director: VillagerDirector | null = null;
  /** Position imposée par une chorégraphie (réutilisée d'une image à l'autre). */
  private readonly directedPoint = { x: 0, y: 0 };

  /** Chorégraphies des moments rares qui mènent un habitant (Basile) ou tournent sa tête. */
  /** Bâtiment visitable où est le joueur local (`interieurs.ts`), lu à chaque image. */
  private interiorProbe: () => string | null = () => null;

  /** Tour 10 (ADR 0016): branche la lecture du bâtiment où est le joueur local. */
  /**
   * Mains des deux porteurs de la charge à cette image (R14), dans `out`; faux si la charge n'est pas
   * portée par deux personnages dessinés. À appeler après la mise à jour des personnages.
   */
  carrierHands(holders: readonly CharacterId[], out: CarrierHands): boolean {
    const [first, second] = holders;
    const a = first === undefined ? undefined : this.players.get(first);
    const b = second === undefined ? undefined : this.players.get(second);
    if (a === undefined || b === undefined) return false;
    if (!a.figure.handsWorld(this.handA.left, this.handA.right) || !b.figure.handsWorld(this.handB.left, this.handB.right)) return false;
    out.a.left = this.handA.left;
    out.a.right = this.handA.right;
    out.b.left = this.handB.left;
    out.b.right = this.handB.right;
    return true;
  }

  private readonly handA = { left: new Vector3(), right: new Vector3() };
  private readonly handB = { left: new Vector3(), right: new Vector3() };

  setInteriorProbe(probe: () => string | null): void {
    this.interiorProbe = probe;
  }

  /**
   * Un personnage dans un autre bâtiment visitable que celui du joueur local est caché par les murs
   * (le bâtiment reste entier chez moi, son contenu masqué): on ne le dessine pas.
   */
  private walledOff(inside: string | null): boolean {
    return inside !== null && inside !== this.interiorProbe();
  }

  setVillagerDirector(director: VillagerDirector | null): void {
    this.director = director;
  }

  /** Habitants qui ont déjà salué un joueur ce jour-là (`habitant|joueur`). */
  private readonly greeted = new Set<string>();
  private greetedDay = -1;

  /** Tape dans la main si les deux joueurs, debout, sont assez près l'un de l'autre. */
  private resolveHighFive(world: ReadonlyWorld): void {
    this.highFivePending = false;
    const [a, b] = world.characters;
    if (a === undefined || b?.inside !== a.inside) {
      return;
    }
    const near = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) <= SETTINGS.highFiveRange;
    if (near && a.speed <= SETTINGS.walkThreshold && b.speed <= SETTINGS.walkThreshold) {
      this.startOneShot(a.id, HIGH_FIVE);
      this.startOneShot(b.id, HIGH_FIVE);
    }
  }

  /** Une poule devant le joueur, à portée de main? */
  private henInFront(character: DeepReadonly<Character>, world: ReadonlyWorld): boolean {
    if (isSheltered(character)) {
      return false;
    }
    const fx = Math.cos(character.facing);
    const fy = Math.sin(character.facing);
    return world.hens.some((hen) => {
      const dx = hen.pos.x - character.pos.x;
      const dy = hen.pos.y - character.pos.y;
      const distance = Math.hypot(dx, dy);
      return distance <= SETTINGS.petRange && dx * fx + dy * fy >= distance * 0.5;
    });
  }

  /** Clip d'une action: manger sur une chaise se fait assis (`sit_eat`). */
  private clipFor(character: DeepReadonly<Character>, world: ReadonlyWorld): string {
    const kind = character.action.kind;
    if (kind === 'eat' && this.seatAt(world, character.pos.x, character.pos.y).clip === SIT_CHAIR) {
      return SIT_EAT;
    }
    // Le chocolat d'Odette se boit (l'action `eat` vise la petite table); un plat du sac se mange.
    if (kind === 'eat' && character.action.target !== null && this.clips.has(SETTINGS.drinkClip)) {
      return SETTINGS.drinkClip;
    }
    return CLIP_FOR_ACTION[kind];
  }

  private startOneShot(id: CharacterId, clip: string): void {
    const duration = this.clips.get(clip)?.duration ?? 0;
    if (duration > 0) {
      this.oneShot.set(id, { clip, start: this.time, duration });
    }
  }

  /** Gestes vus, par joueur: jeton (`since`), et instant local de leur fin prévue. */
  private readonly gestures = new Map<CharacterId, { token: number; endsAt: number }>();

  /**
   * Geste d'outil (action à durée): joué une fois, depuis juste avant le
   * contact, étiré pour finir avec le geste de la simulation, relancé à chaque
   * nouveau `since`. `null` pour une action sans durée, ou un geste fini.
   */
  private gestureRequest(
    character: DeepReadonly<Character>,
    context: FrameContext,
  ): ClipRequest | null {
    const action = character.action;
    if (action.duration <= 0 || character.status === 'sleeping') {
      return null;
    }
    const name = this.clipFor(character, context.world);
    const clip = this.clips.get(name);
    const seconds = action.duration / SIM_HZ;
    // Déjà joué jusqu'au bout: chez l'invité, « attente » arrive avec l'état complet suivant.
    const seen = this.gestures.get(character.id);
    if (seen?.token === action.since && context.time >= seen.endsAt) {
      return null;
    }
    if (clip === undefined || seconds > clip.duration * SETTINGS.gestureLoopAbove) {
      return null;
    }
    const elapsed = Math.min(seconds, Math.max(0, (context.world.tick - action.since) / SIM_HZ));
    if (seen?.token !== action.since) {
      this.gestures.set(character.id, {
        token: action.since,
        endsAt: context.time + seconds - elapsed,
      });
    }
    // Départ tel que le contact tombe `gestureImpactLead` après l'appui, et fin avec le geste.
    const impact = SETTINGS.gestureImpact[name] ?? 0;
    const share = Math.min(GESTURE_LEAD_SHARE_MAX, SETTINGS.gestureImpactLead / seconds);
    const startAt = Math.min(
      clip.duration * GESTURE_START_MAX,
      Math.max(0, (impact - share * clip.duration) / (1 - share)),
    );
    const timeScale = (clip.duration - startAt) / seconds;
    return {
      name,
      timeScale,
      once: true,
      token: action.since,
      startAt: startAt + elapsed * timeScale,
      fade: SETTINGS.gestureFadeSeconds,
    };
  }

  /** Le geste en cours est-il déjà fini (son clip joué en entier)? */
  private gestureOver(character: DeepReadonly<Character>): boolean {
    const seen = this.gestures.get(character.id);
    return (
      character.action.duration > 0 &&
      seen?.token === character.action.since &&
      this.time >= seen.endsAt
    );
  }

  /** Bout de la canne d'un joueur (nœud `fishing_rod_tip`, pour la ligne), `false` s'il ne tient rien. */
  rodTip(id: CharacterId, out: Vector3): boolean {
    return this.players.get(id)?.figure.toolPoint(ROD_TIP_NODE, ROD_TIP, out) ?? false;
  }

  /**
   * Assise: sur une chaise (`seat_height` dans les données de l'artiste),
   * l'animation `sit`; ailleurs, assis par terre, posé sur le dessus d'une
   * paillasse ou d'un lit (`sleep_height`) s'il y en a un sous le personnage.
   */
  /** Place assise lue par l'appelant tout de suite (réutilisée, aucune allocation). */
  private readonly benchPlace: BenchPlace = { x: 0, y: 0, facing: 0 };
  /** Places des habitants sur les bancs, d'après les joueurs assis (comme la simulation). */
  private readonly seating = new BenchSeating();
  /** Place affichée de chaque joueur (état, ou événement plus récent que lui), lue par `seating`. */
  private readonly shownSeats: { seat: BenchSeat | null }[] = [{ seat: null }, { seat: null }];
  /**
   * Dernier `sat_down` ou `stood_up` reçu, par joueur, et son instant: chez l'invité,
   * l'événement arrive avant l'état complet (au plus 5 par seconde); on le suit
   * `SEAT_EVENT_SECONDS`, le temps que l'état le rattrape.
   */
  private readonly seatEvents = new Map<CharacterId, { seat: BenchSeat | null; at: number }>();

  /** Place affichée d'un joueur: l'événement récent, sinon l'état. */
  private seatOf(character: DeepReadonly<Character>): DeepReadonly<BenchSeat> | null {
    const event = this.seatEvents.get(character.id);
    if (event !== undefined && this.time - event.at < SEAT_EVENT_SECONDS) {
      return event.seat;
    }
    return character.seat;
  }

  /** Sièges posés dans la maison (chaises, fauteuils: S07), refaits quand un siège bouge. */
  private readonly furnitureSeats = new FurnitureSeats();
  private homeSeats: readonly SeatProp[] = [];

  /**
   * Écrit dans `benchPlace` la place `slot` du banc `id` (ou du siège posé de ce nom) et dans
   * `seatLift` la hauteur où poser le corps; faux si le banc n'existe pas ou n'est pas atteint d'où
   * est le personnage (une chaise de la maison, de dedans; un banc du dehors, pas d'un abri).
   */
  private benchSeat(id: string, slot: number, character: Parameters<typeof isHome>[0]): boolean {
    const prop = this.benches.find((bench) => bench.id === id) ?? this.homeSeats.find((seat) => seat.id === id);
    if (prop === undefined) {
      return false;
    }
    const home = isFurnitureSeat(prop);
    if (home ? !isHome(character) : isSheltered(character)) {
      return false;
    }
    seatPlace(prop, slot, this.content.settings.benches, this.benchPlace);
    this.benchIsEdge = prop.category === EDGE_SEAT_CATEGORY;
    // Assise du modèle (`seat_height` de l'artiste: 0,47 m la chaise, 0,42 m le fauteuil), le clip
    // `sit` étant calé sur 0,47 m; un banc de la carte garde son réglage.
    const height = home ? this.library.extras(prop.model).seat_height : undefined;
    this.seatLift = (typeof height === 'number' ? height : SETTINGS.bench.seatHeight) - SETTINGS.sitClipSeatHeight;
    return true;
  }

  /** Hauteur où poser le corps assis, lue par l'appelant juste après `benchSeat`. */
  private seatLift = 0;

  /** Perche de chaque joueur: allumait-il à l'image d'avant, et quand il a commencé à la rabaisser. */
  private readonly poles = new Map<CharacterId, { lighting: boolean; lowerAt: number }>();

  /**
   * Allumer une lanterne (action `light`, tour 9): la perche levée au rythme de la simulation
   * (`pole_raise` calé sur `action.since`, donc le même instant chez les deux), puis rabaissée
   * (`pole_lower`) une fois l'action finie. `null` hors de ces deux gestes.
   */
  private poleRequest(character: DeepReadonly<Character>, kind: ActionKind, context: FrameContext): ClipRequest | null {
    let state = this.poles.get(character.id);
    if (state === undefined) {
      state = { lighting: false, lowerAt: Number.NEGATIVE_INFINITY };
      this.poles.set(character.id, state);
    }
    if (kind === 'light') {
      state.lighting = true;
      const raise = this.clips.get(POLE_RAISE);
      if (raise === undefined) return null;
      const t = (context.world.tick - character.action.since + context.alpha) / SIM_HZ;
      return { name: raise.name, timeScale: 0, exactTime: Math.min(raise.duration - 1e-3, Math.max(0, t)), fade: SETTINGS.crossFadeSeconds };
    }
    if (state.lighting) {
      state.lighting = false;
      state.lowerAt = context.time;
    }
    const lower = this.clips.get(POLE_LOWER);
    const since = context.time - state.lowerAt;
    if (lower === undefined || since < 0 || since >= lower.duration) return null;
    return { name: lower.name, timeScale: 0, exactTime: since, fade: SETTINGS.crossFadeSeconds };
  }

  /** Le dernier banc lu par `benchSeat` est-il un siège sans modèle (le bord du ponton) ? */
  private benchIsEdge = false;

  /**
   * Clip d'un joueur pendant un moment du tour 9, ou `null`: assis au bord du ponton (et le
   * regard levé vers la grande étoile filante), la manivelle du passage à niveau tenue puis
   * tournée pendant que les lisses descendent, la main levée au salut du mécanicien.
   */
  private momentRequest(character: DeepReadonly<Character>, world: ReadonlyWorld, onBench: boolean, alpha: number): ClipRequest | null {
    const today = world.moments.today;
    const def = today === null ? undefined : this.content.moments.find((m) => m.id === today.id);
    if (onBench && this.benchIsEdge) {
      const lookAt = def?.render.lookUpAt;
      const look = this.clips.get(SETTINGS.edge.lookClip);
      if (today?.phase === 'climax' && typeof lookAt === 'number' && look !== undefined) {
        const t = today.elapsed + (today.paused ? 0 : alpha / SIM_HZ) - lookAt;
        if (t >= 0 && t < look.duration) {
          return { name: look.name, timeScale: 0, exactTime: t, fade: SETTINGS.crossFadeSeconds };
        }
      }
      return { name: SETTINGS.edge.clip, timeScale: 1 };
    }
    const arm = def?.watch.arm ?? null;
    if (today === null || def === undefined || arm === null) return null;
    const cranks = def.watch.hold ?? [];
    const armedTick = today.armedTick ?? null;
    if (character.holding !== null && cranks.includes(character.holding)) {
      const since = armedTick === null ? -1 : (world.tick - armedTick + alpha) / SIM_HZ;
      if (since >= 0 && since < arm.seconds) {
        const turn = SETTINGS.crank.turnSeconds;
        return { name: SETTINGS.crank.turn, timeScale: 0, exactTime: since % turn, fade: SETTINGS.crossFadeSeconds };
      }
      return { name: SETTINGS.crank.hold, timeScale: 1 };
    }
    const waveAt = def.render.waveBackAt;
    const waveFor = def.render.waveBackSeconds;
    if (today.phase === 'climax' && typeof waveAt === 'number' && typeof waveFor === 'number' && character.speed <= SETTINGS.walkThreshold) {
      const t = today.elapsed - waveAt;
      if (t >= 0 && t < waveFor) return { name: SETTINGS.crank.wave, timeScale: 1, fade: SETTINGS.crossFadeSeconds };
    }
    return null;
  }

  private seatAt(world: ReadonlyWorld, x: number, y: number): { clip: string; lift: number } {
    for (const piece of world.furniture) {
      const size = this.content.items[piece.item]?.footprint ?? { w: 1, d: 1 };
      const w = piece.rotation % 2 === 0 ? size.w : size.d;
      const d = piece.rotation % 2 === 0 ? size.d : size.w;
      if (
        x < piece.cell.cx ||
        y < piece.cell.cy ||
        x >= piece.cell.cx + w ||
        y >= piece.cell.cy + d
      ) {
        continue;
      }
      const extras = this.library.extras(this.content.items[piece.item]?.model ?? piece.item);
      if (typeof extras.seat_height === 'number') {
        return { clip: SIT_CHAIR, lift: 0 };
      }
      if (typeof extras.sleep_height === 'number') {
        return { clip: SIT_GROUND, lift: extras.sleep_height };
      }
    }
    return { clip: SIT_GROUND, lift: 0 };
  }

  /** Pose couchée lue par l'appelant tout de suite (réutilisée, aucune allocation). */
  private readonly sleepPoint: SleepPose = { x: 0, y: 0, facing: 0, lift: 0 };

  /** Couché dans son lit (R05): pose tirée du lit (`coucher.ts`), ou `null` s'il ne dort pas. */
  private sleepingPose(character: DeepReadonly<Character>, world: ReadonlyWorld): SleepPose | null {
    if (character.status !== 'sleeping' || character.bedId === null) {
      return null;
    }
    const bed = world.furniture.find((piece) => piece.id === character.bedId);
    if (bed === undefined) {
      return null;
    }
    const definition = this.content.items[bed.item];
    return sleepPose(
      bed,
      definition?.footprint ?? { w: 1, d: 1 },
      this.library.extras(definition?.model ?? bed.item),
      character.pos,
      SETTINGS.sleepClipBackHeight,
      this.sleepPoint,
    );
  }

  /** Position affichée pendant le glissement vers l'assise ou depuis elle, ou `null` hors glissement. */
  private readonly glidePoint = { x: 0, y: 0 };

  private glide(
    entry: PlayerEntry,
    onBench: boolean,
    target: { x: number; y: number },
    context: FrameContext,
  ): { x: number; y: number } | null {
    if (onBench !== entry.seated) {
      // Écart entre ce qu'on voyait et la nouvelle cible, résorbé en `glideSeconds`.
      const root = entry.figure.root.position;
      entry.glide.x = root.x - target.x;
      entry.glide.y = root.z - target.y;
      entry.glide.start = context.time;
      entry.seated = onBench;
      if (Math.hypot(entry.glide.x, entry.glide.y) > SETTINGS.teleportDistance) {
        entry.glide.x = 0;
        entry.glide.y = 0;
      }
    }
    const t = (context.time - entry.glide.start) / SETTINGS.bench.glideSeconds;
    if (t >= 1 || (entry.glide.x === 0 && entry.glide.y === 0)) {
      return null;
    }
    // Départ vif, arrivée douce.
    const keep = (1 - t) * (1 - t);
    this.glidePoint.x = target.x + entry.glide.x * keep;
    this.glidePoint.y = target.y + entry.glide.y * keep;
    return this.glidePoint;
  }

  /** Position affichée d'un joueur (pour les effets: objet qui saute au sac). */
  playerPosition(id: CharacterId): Object3D | null {
    return this.players.get(id)?.figure.root ?? null;
  }

  private substituteModel(scarf: string): Object3D {
    const shapes = new ShapeBuilder()
      .cylinder(0.2, 0.24, 0.85, [0, 0, 0], 'fabric_blue', { base: true })
      .box([0.42, 0.55, 0.28], [0, 0.85, 0], 'fabric_cream', { base: true })
      .ball(0.17, [0, 1.55, 0], 'plaster_cream', { detail: 1 })
      .cylinder(0.17, 0.2, 0.1, [0, 1.36, 0], 'white_paint', { base: true });
    const mesh = new Mesh(this.resources.track(shapes.build()), this.materials.palette.clone());
    mesh.material.color.set(safeColor(scarf));
    this.resources.trackMaterial(mesh.material);
    const group = new Group();
    group.add(mesh);
    return group;
  }

  private createPlayer(character: DeepReadonly<Character>): PlayerEntry {
    const model = this.library.cloneRig(RIG_NODE, this.playerMeshes);
    const pick = this.picks.add({ kind: 'character', character: character.id });
    let dressed: DressedFigure | null = null;
    const shared = this.library.sharedCharacterMaterial();
    if (model !== null && shared?.map?.image !== undefined) {
      const texture = new PlayerTexture(shared.map.image as CanvasImageSource & { width: number; height: number });
      this.resources.track(texture.texture);
      const material = this.resources.trackMaterial(shared.clone());
      material.map = texture.texture;
      model.traverse((object) => {
        if (object instanceof SkinnedMesh) object.material = material;
      });
      dressed = this.dresser.prepare(model, texture);
    }
    // Gabarit du corps des joueurs (moyen) et sa pose de repos, avant que la figure ne lise ses os.
    const extras = this.library.extras(PLAYER_BODY);
    if (model !== null) applyBoneRest(model, boneRestOf(extras));
    const figure = new CharacterFigure(
      character.id,
      model ?? this.substituteModel(character.appearance.scarf),
      model === null ? NO_CLIPS : this.clips,
      pick,
      1,
      idleClipOf(extras, this.clips),
    );
    this.group.add(figure.root);
    return { figure, dressed, seated: false, glide: { x: 0, y: 0, start: 0 } };
  }

  private dress(entry: PlayerEntry, character: DeepReadonly<Character>): void {
    if (entry.dressed === null) return;
    this.dresser.dress(entry.dressed, { id: character.id, appearance: character.appearance, asleep: character.status === 'sleeping' });
  }

  private createVillager(villager: DeepReadonly<VillagerState>): CharacterFigure {
    const definition = this.content.villagers.find((candidate) => candidate.id === villager.id);
    const modelName = definition?.model ?? `villager_${villager.id}`;
    const node = this.library.source(modelName)?.node ?? modelName;
    // Pièces portées selon l'état (tour 9: l'écharpe de Firmin; 0.13: la loupe d'Ambroise), sur le même squelette.
    const worn = wornModels(villager.id).filter((name) => this.library.has(name));
    // Sans son nœud dans `personnages.glb`, le squelette seul serait invisible: substitut (`substituts.ts`).
    const rigged = this.library.has(node) ? this.library.cloneRig(RIG_NODE, [node, ...worn]) : null;
    const model = rigged ?? this.library.instantiate(modelName);
    const body = model.getObjectByName(node);
    if (rigged !== null && isSkinned(body)) {
      // Chaque pièce portée rejoint le corps (`mergeOutfit`, cibles de morphose nulles): ni appel
      // de dessin ni programme de plus. On échange la géométrie du corps selon la pièce portée.
      const plain = body.geometry;
      const dressed = new Map<string, BufferGeometry>();
      for (const name of worn) {
        const piece = model.getObjectByName(name);
        if (!isSkinned(piece)) continue;
        const merged = mergeOutfit(plain, [piece.geometry]);
        piece.removeFromParent();
        if (merged !== null) dressed.set(name, this.resources.track(merged));
      }
      if (dressed.size > 0) this.wornPieces.set(villager.id, { body, plain, dressed });
    }
    const pick = this.picks.add({ kind: 'villager', villager: villager.id });
    const extras = this.library.extras(modelName);
    // Habitant refait sur un gabarit (rond, trapu): ses os de repos, avant que la figure ne les lise.
    if (rigged !== null) applyBoneRest(rigged, boneRestOf(extras));
    const figure = new CharacterFigure(
      villager.id,
      model,
      // Un substitut n'a pas d'os: aucun clip (le mélangeur se plaindrait de pistes sans cible).
      rigged === null ? NO_CLIPS : this.clips,
      pick,
      villagerScale(definition?.scale, extras),
      idleClipOf(extras, this.clips),
    );
    this.group.add(figure.root);
    const carry = new VillagerCarry(figure.root, this.library, SETTINGS.bikes, this.propSwap);
    this.villagerProps.set(villager.id, {
      carry,
      hands: (left, right) => figure.handPoint('left', left) && figure.handPoint('right', right),
      carried: null,
      worn: null,
      left: null,
      situation: { moving: false, activity: '', habit: null, left: null, talking: false },
    });
    return figure;
  }

  /** Corps de chaque habitant qui porte une pièce: sa géométrie sans, et avec chacune des pièces. */
  private readonly wornPieces = new Map<
    string,
    { body: SkinnedMesh; plain: BufferGeometry; dressed: ReadonlyMap<string, BufferGeometry> }
  >();

  /**
   * Accessoires d'un habitant à cette image (0.13): pièce portée sur le corps, objet en main,
   * devant soi ou vélo poussé. Rend le clip à jouer à la place de `clip`.
   */
  private villagerAccessories(
    figure: CharacterFigure,
    villager: DeepReadonly<VillagerState>,
    world: ReadonlyWorld,
    onBench: boolean,
    clip: string,
    gesture: GestureDef | null = null,
  ): ClipRequest {
    const props = this.villagerProps.get(villager.id);
    const moving = villager.speed > SETTINGS.walkThreshold;
    const scale = figure.root.scale.x;
    const walk = { name: clip, timeScale: clip === WALK ? this.strideScale(villager.speed, this.walkReference, scale) : 1 };
    if (props === undefined) return walk;
    const rules = SETTINGS.villagerProps[villager.id] ?? NO_PROPS;
    const habit = villagerHabit(villager);
    const situation = props.situation;
    situation.moving = moving;
    situation.activity = villager.activity;
    situation.habit = habit;
    situation.left = props.left;
    situation.talking = villager.talkingWith.length > 0;
    // Assis sur un banc, rien en main ni vélo à côté.
    props.carried = onBench ? null : chooseProp(rules, situation, false, props.carried);
    props.worn = chooseProp(rules, situation, true, props.worn);
    if (!moving) props.left = habit;
    const worn = this.wornPieces.get(villager.id);
    if (worn !== undefined) {
      const scarf = VILLAGER_WORN[villager.id];
      const piece = scarf?.when(world, this.content) === true ? scarf.model : (props.worn?.model ?? null);
      worn.body.geometry = (piece === null ? undefined : worn.dressed.get(piece)) ?? worn.plain;
    }
    if (gesture !== null) return this.gestureAccessories(figure, props.carry, gesture, clip);
    const carried = props.carried;
    // Mains posées sur le guidon ou l'accordéon: il tourne la tête, pas le buste (la main resterait en l'air).
    figure.setLookBody(carried === null || carried.mount === 'hand');
    figure.setTool(this.library, carried?.mount === 'hand' ? carried.model : null, this.propSwap);
    props.carry.setBike(carried?.mount === 'bike' ? carried.model : null);
    props.carry.setChest(carried?.mount === 'chest' ? carried.model : null);
    if (carried === null || onBench) return walk;
    if (carried.mount === 'bike') {
      return moving
        ? { name: SETTINGS.bikes.walkClip, timeScale: this.strideScale(villager.speed, this.bikeReference, scale), fade: SETTINGS.walkFadeSeconds }
        : { name: carried.stillClip ?? SETTINGS.bikes.idleClip, timeScale: 1, fade: SETTINGS.walkFadeSeconds };
    }
    if (carried.mount === 'chest') {
      return moving
        ? { name: SETTINGS.carryOne.walk, timeScale: this.strideScale(villager.speed, this.carryOneReference, scale), fade: SETTINGS.walkFadeSeconds }
        : { name: carried.stillClip ?? SETTINGS.carryOne.idle, timeScale: 1, fade: SETTINGS.walkFadeSeconds };
    }
    return moving || situation.talking || carried.stillClip === null ? walk : { name: carried.stillClip, timeScale: 1 };
  }

  /**
   * Geste avec le décor (0.13, lot H7): son accessoire en main ou devant soi remplace ceux de
   * l'habitude (pas de vélo à côté de qui bêche), et le clip du geste se joue en fondu.
   */
  private gestureAccessories(figure: CharacterFigure, carry: VillagerCarry, gesture: GestureDef, clip: string): ClipRequest {
    const prop = gesture.prop;
    figure.setTool(this.library, prop?.mount === 'hand' ? prop.model : null, this.propSwap);
    carry.setChest(prop?.mount === 'chest' ? prop.model : null);
    carry.setBike(null);
    figure.setLookBody(prop?.mount !== 'chest');
    return { name: clip, timeScale: 1, fade: SETTINGS.crossFadeSeconds };
  }

  update(context: FrameContext): void {
    this.time = context.time;
    const world: ReadonlyWorld = context.world;
    this.homeSeats = this.furnitureSeats.update(world.furniture, this.content.items);
    this.refreshBenches(world);
    if (this.highFivePending) {
      this.resolveHighFive(world);
    }
    for (const character of world.characters) {
      let entry = this.players.get(character.id);
      if (entry === undefined) {
        entry = this.createPlayer(character);
        this.players.set(character.id, entry);
      }
      this.dress(entry, character);
      const moving = character.speed > SETTINGS.walkThreshold;
      const kind: ActionKind = character.status === 'sleeping' ? 'sleep' : character.action.kind;
      // Pêche: lancer et ferrer joués une fois, attente en boucle, enchaînés par des fondus courts.
      const queued = this.queuedShot.get(character.id);
      const before = this.oneShot.get(character.id);
      if (queued !== undefined && (before === undefined || context.time - before.start >= before.duration)) {
        this.queuedShot.delete(character.id);
        this.startOneShot(character.id, queued);
      }
      const shot = this.oneShot.get(character.id);
      const shotActive = shot !== undefined && context.time - shot.start < shot.duration;
      const fishing = character.fishing !== null || (shotActive && FISH_CLIPS.has(shot.clip));
      // Assis sur un banc par choix (place réservée par la simulation): posé à sa place, tourné
      // comme le banc, dos au dossier (`benchPlace`). Il y mange aussi (`sit_eat`).
      const benchSeat = this.seatOf(character);
      const onBench = benchSeat !== null && this.benchSeat(benchSeat.bench, benchSeat.slot, character);
      const shown = this.shownSeats[character.id === 'p1' ? 0 : 1];
      if (shown !== undefined) {
        shown.seat = onBench ? benchSeat : null;
      }
      // Assis au fauteuil du salon: la simulation donne le fauteuil (`target`) et l'y tourne.
      const chair = kind === 'sit' && !onBench ? character.action.target : null;
      const seat =
        chair !== null
          ? { clip: SIT_CHAIR, lift: SETTINGS.salonChairSeatHeight - SETTINGS.sitClipSeatHeight }
          : kind === 'sit' && !onBench
            ? this.seatAt(world, character.pos.x, character.pos.y)
            : null;
      const seatPlace = onBench ? this.benchPlace : chair;
      const benchLift = this.seatLift;
      const walkScale = this.strideScale(character.speed, this.walkReference, 1);
      const pushing = kind === 'carry' && world.beam?.purpose === 'handcar';
      // Charge courte portée à deux (R14): face à l'autre porteur, bras devant la poitrine.
      const load = kind === 'carry' && world.beam?.carried === true ? world.beam : null;
      const carryPartner =
        load !== null && load.holders.includes(character.id) && loadShape(this.content, this.library, load) === 'short'
          ? world.characters.find((other) => other.id !== character.id && load.holders.includes(other.id))
          : undefined;
      const gesture = this.gestureRequest(character, context);
      const edge = onBench && this.benchIsEdge;
      const pole = this.poleRequest(character, kind, context);
      const scripted = pole ?? this.momentRequest(character, world, onBench, context.alpha);
      let request: ClipRequest;
      if (scripted !== null && (onBench || !moving)) {
        request = scripted;
      } else if (onBench) {
        request = { name: kind === 'eat' ? SIT_EAT : SIT_CHAIR, timeScale: 1 };
      } else if (character.holding !== null && !moving) {
        // Tenir l'échelle: la simulation l'a posé à sa place, face au montant.
        request = { name: HOLD_LADDER, timeScale: 1 };
      } else if (!moving && this.milking(character, world)) {
        // Traire la chèvre ou la tenir (pas de clip de traite): accroupi près d'elle, tourné vers elle.
        request = { name: SETTINGS.milkClip, timeScale: 1 };
      } else if (pushing) {
        // La draisine reste au sol: on la pousse, bras en avant, au lieu de la porter bras levés.
        request = moving
          ? { name: WALK, timeScale: walkScale, fade: SETTINGS.walkFadeSeconds }
          : { name: SETTINGS.push.stillClip, timeScale: 1 };
      } else if (carryPartner !== undefined && this.clips.has(SETTINGS.carryOne.walk)) {
        // On avance face à l'autre: celui qui recule joue la marche à l'envers.
        const toward = Math.atan2(carryPartner.pos.y - character.pos.y, carryPartner.pos.x - character.pos.x);
        const backward = Math.cos(character.facing - toward) < -BACKWARD_COS;
        request = moving
          ? {
              name: SETTINGS.carryOne.walk,
              timeScale: this.strideScale(character.speed, this.carryOneReference, 1) * (backward ? -1 : 1),
              fade: SETTINGS.walkFadeSeconds,
            }
          : { name: SETTINGS.carryOne.idle, timeScale: 1, fade: SETTINGS.walkFadeSeconds };
      } else if (character.placement !== null && kind !== 'carry' && this.clips.has(SETTINGS.carryOne.walk)) {
        // Un meuble tenu pour l'aménagement: porté seul devant la poitrine.
        request = moving
          ? {
              name: SETTINGS.carryOne.walk,
              timeScale: this.strideScale(character.speed, this.carryOneReference, 1),
              fade: SETTINGS.walkFadeSeconds,
            }
          : { name: SETTINGS.carryOne.idle, timeScale: 1, fade: SETTINGS.walkFadeSeconds };
      } else if (moving && kind !== 'carry') {
        request = { name: WALK, timeScale: walkScale, fade: SETTINGS.walkFadeSeconds };
      } else if (shotActive) {
        request = { name: shot.clip, timeScale: 1, once: true, token: shot.start, fade: FISH_FADE };
      } else if (character.fishing !== null) {
        request = { name: FISH_WAIT, timeScale: 1, fromStart: true, fade: FISH_FADE };
      } else if (seat !== null) {
        request = { name: seat.clip, timeScale: 1 };
      } else if (gesture !== null) {
        request = gesture;
      } else if (kind === 'walk' || this.gestureOver(character)) {
        // Arrêté (la vitesse est tombée, l'état complet dit encore « marche » chez l'invité)
        // ou geste fini avant que l'état ne repasse à « attente »: on attend.
        request = { name: 'idle', timeScale: 1, fade: SETTINGS.walkFadeSeconds };
      } else {
        const name = kind === 'sleep' ? CLIP_FOR_ACTION.sleep : this.clipFor(character, world);
        const carryScale = this.strideScale(character.speed, this.carryReference, 1);
        request = { name, timeScale: kind === 'carry' ? (moving ? carryScale : 0) : 1 };
      }
      request = this.posture(character.id, (onBench && !edge) || seat?.clip === SIT_CHAIR, moving, request);
      // Tape dans la main: face à l'autre le temps du geste (rendu seul), jamais en marchant (en crabe).
      const partner =
        shotActive && shot.clip === HIGH_FIVE && !moving
          ? world.characters.find((other) => other.id !== character.id)
          : undefined;
      const facingTo = partner ?? carryPartner;
      const facing = onBench
        ? this.benchPlace.facing
        : facingTo === undefined
          ? character.facing
          : Math.atan2(facingTo.pos.y - character.pos.y, facingTo.pos.x - character.pos.x);
      const glided = this.glide(entry, seatPlace !== null, seatPlace ?? character.pos, context);
      const asleep = this.sleepingPose(character, world);
      entry.figure.setReach(pushing && moving ? this.pushReach(character, world) : null);
      entry.figure.update(
        context,
        this.terrain,
        asleep ?? glided ?? seatPlace ?? character.prev,
        asleep ?? glided ?? seatPlace ?? character.pos,
        asleep?.facing ?? facing,
        request,
        asleep?.lift ?? (edge ? SETTINGS.edge.lift : onBench ? benchLift : (seat?.lift ?? 0)),
        this.henInFront(character, world) ? PLAYER_VARIANTS_HEN : PLAYER_VARIANTS,
      );
      entry.figure.updateFace(context.time, FORM_EXPRESSION[character.form]);
      const walled = this.walledOff(character.inside);
      entry.figure.root.visible = !walled;
      entry.figure.pick.enabled = !walled;
      const held = character.bag[character.selected] ?? null;
      const definition = held === null ? undefined : this.content.items[held.item];
      const showTool =
        definition !== undefined &&
        !HANDS_FREE.has(kind) &&
        (definition.category === 'tool' || (definition.category === 'seed' && kind === 'sow'));
      // La canne en main est celle du sac (la canne en bambou du tour 9), sinon celle de départ.
      const heldRod = definition?.tool?.toolKind === ROD_KIND ? definition.model : null;
      const rod = heldRod ?? this.content.items[ROD_ITEM]?.model ?? ROD_ITEM;
      entry.figure.setTool(
        this.library,
        pole !== null
          ? LAMP_POLE
          : fishing && !moving
            ? rod
            : showTool
              ? definition.model
              : null,
        this.materials,
      );
    }
    // Habitants sur les bancs: la place libre la plus proche, après les joueurs assis.
    this.seating.update(
      this.benches,
      this.content.settings.benches,
      this.points,
      this.shownSeats,
      world.villagers,
    );
    for (let index = 0; index < world.villagers.length; index += 1) {
      const villager = world.villagers[index];
      if (villager === undefined) {
        continue;
      }
      let figure = this.villagers.get(villager.id);
      if (figure === undefined) {
        figure = this.createVillager(villager);
        this.villagers.set(villager.id, figure);
      }
      const direction = this.director?.(villager, context) ?? null;
      if (direction?.kind === 'pose') {
        // Mené par une chorégraphie: ni banc, ni salut, ni emploi du temps.
        figure.root.visible = true;
        figure.pick.enabled = villager.visible;
        figure.lookAt(direction.look);
        figure.setReach(direction.reach);
        const point = this.directedPoint;
        point.x = direction.x;
        point.y = direction.y;
        figure.update(
          context,
          this.terrain,
          point,
          point,
          direction.facing,
          direction.clipTime === null
            ? { name: direction.clip, timeScale: direction.timeScale }
            : { name: direction.clip, timeScale: 0, exactTime: direction.clipTime, fade: SETTINGS.crossFadeSeconds },
          direction.z,
        );
        figure.setTool(this.library, direction.tool);
        figure.updateFace(context.time, null);
        const props = this.villagerProps.get(villager.id);
        props?.carry.setBike(null);
        props?.carry.setChest(null);
        figure.setLookBody(true);
        continue;
      }
      figure.setReach(null);
      const shown = villager.visible && !this.walledOff(villager.inside);
      figure.root.visible = shown;
      figure.pick.enabled = shown;
      if (!shown) {
        // Il réapparaît déjà assis ou debout, sans se lever ni s'asseoir devant nous.
        this.postures.delete(`habitant ${villager.id}`);
        // Hors de vue (tournée, chez lui): l'habitude qu'il quittera en réapparaissant.
        const props = this.villagerProps.get(villager.id);
        if (props !== undefined) props.left = villagerHabit(villager);
        continue;
      }
      // Arrêté sur un banc (Jeanne au quai le matin): assis, à sa place, dos au dossier.
      const benchProp = this.seating.bench[index] ?? null;
      const onBench =
        benchProp !== null &&
        villager.talkingWith.length === 0 &&
        this.benchSeat(benchProp.id, this.seating.slot[index] ?? 0, villager);
      const gesture = onBench ? null : (this.decorGestures?.gestureOf(villager, world) ?? null);
      const clip = onBench ? SIT_CHAIR : gesture !== null ? gestureClipAt(gesture, context.time, villager.id) : villagerClip(villager);
      this.villagerAttention(figure, villager, world, context.time, clip);
      if (direction?.kind === 'look' && villager.talkingWith.length === 0) {
        figure.lookAt(direction);
      }
      const request = this.villagerAccessories(figure, villager, world, onBench, clip, gesture);
      const gestureFacing = gesture === null ? null : (this.decorGestures?.facingOf(gesture, villager) ?? null);
      figure.update(
        context,
        this.terrain,
        onBench ? this.benchPlace : villager.prev,
        onBench ? this.benchPlace : villager.pos,
        onBench ? this.benchPlace.facing : (gestureFacing ?? villager.facing),
        this.posture(`habitant ${villager.id}`, clip === SIT_CHAIR, villager.speed > SETTINGS.walkThreshold, request),
        onBench ? SETTINGS.bench.seatHeight - SETTINGS.sitClipSeatHeight : 0,
        SETTINGS.idleVariants[villager.id] ?? NO_VARIANTS,
      );
      const props = this.villagerProps.get(villager.id);
      props?.carry.update(SETTINGS.teleportDistance, props.hands);
      figure.updateFace(
        context.time,
        villager.talkingWith.length > 0
          ? { target: 'happy', weight: TALK_EXPRESSION_WEIGHT }
          : null,
      );
    }
  }

  /**
   * Habitant attentif (rendu seul, à partir des positions): il tourne la tête
   * vers le joueur le plus proche à portée, et le salue au premier croisement
   * de la journée s'il est arrêté.
   */
  private villagerAttention(
    figure: CharacterFigure,
    villager: DeepReadonly<VillagerState>,
    world: ReadonlyWorld,
    time: number,
    clip: string,
  ): void {
    if (world.clock.day !== this.greetedDay) {
      this.greetedDay = world.clock.day;
      this.greeted.clear();
    }
    let nearest: DeepReadonly<Character> | null = null;
    let best: number = SETTINGS.lookRange;
    for (const character of world.characters) {
      if (isSheltered(character) || character.status === 'sleeping') {
        continue;
      }
      const distance = Math.hypot(
        character.pos.x - villager.pos.x,
        character.pos.y - villager.pos.y,
      );
      if (distance <= best) {
        best = distance;
        nearest = character;
      }
    }
    // En conversation, la simulation l'oriente déjà vers son interlocuteur.
    if (nearest === null || villager.talkingWith.length > 0) {
      figure.lookAt(null);
      return;
    }
    figure.lookAt(nearest.pos);
    if (clip !== 'idle' || best > SETTINGS.greetRange) {
      return;
    }
    const key = `${villager.id}|${nearest.id}`;
    if (!this.greeted.has(key) && figure.playOnce(WAVE, time)) {
      this.greeted.add(key);
    }
  }

  dispose(): void {
    for (const entry of this.players.values()) {
      entry.figure.dispose();
      entry.dressed?.merged?.dispose();
    }
    for (const figure of this.villagers.values()) {
      figure.dispose();
    }
    for (const props of this.villagerProps.values()) props.carry.dispose();
    this.players.clear();
    this.villagers.clear();
    this.villagerProps.clear();
  }
}
