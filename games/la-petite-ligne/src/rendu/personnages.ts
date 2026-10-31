/**
 * Personnages: les deux joueurs (foulard à la couleur de leur profil, coiffure
 * et tenue choisies) et les habitants, sur le squelette commun de
 * `personnages.glb`. Animations par `AnimationMixer` avec fondus enchaînés,
 * positions interpolées (`prev` vers `pos`), orientation lissée, outil en
 * main, clignement des yeux et expression selon la forme.
 */
import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  CanvasTexture,
  Float32BufferAttribute,
  Group,
  Mesh,
  SkinnedMesh,
  Sphere,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
import type { Content } from '../donnees/types';
import {
  BODY_COLORS,
  HAIR_MESHES,
  OUTFITS,
  SCARF_MARK,
  SCARF_SYMBOLS,
  safeColor,
  scarfMeshFor,
} from './apparence';
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
import { preparePaletteTexture, type SharedMaterials } from './materiaux';
import { CHARACTERS_FILE, textHash, type ModelLibrary } from './modeles';
import { PALETTE_CELL_PIXELS, characterSlotColumn, type CharacterSlot } from './palette';
import { IDLE_POSES, RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';
import type { EventfulPart } from './monde';
import { ShapeBuilder } from './geometrie';

const SETTINGS = RENDER_SETTINGS.characters;
/** Nom du groupe animé (squelette et maillages) dans `personnages.glb`. */
const RIG_NODE = 'rig';
const HAND_SOCKET = 'socket_hand_r';
const PICK_RADIUS = 0.42;
const PICK_HEIGHT = 1.8;
const GROUND_HALF_LIFE = 0.06;
const WALK_SCALE_MIN = 0.55;
const WALK_SCALE_MAX = 1.7;
const PLAYER_ROW = 0;
const VECTOR_SIZE = 3;
/** Bout de la canne à pêche de l'artiste: nœud vide, et sa place dans le repère de la prise s'il manque. */
const ROD_TIP_NODE = 'fishing_rod_tip';
const ROD_TIP = new Vector3(0, 1.34, 1.49);
const ROD_ITEM = 'fishing_rod';
/** Animations de pêche et d'assise par terre de l'artiste (mêmes poses de départ et d'arrivée). */
const FISH_CAST = 'fish_cast';
const FISH_WAIT = 'fish_wait';
const FISH_STRIKE = 'fish_strike';
const SIT_CHAIR = 'sit';
const SIT_GROUND = 'sit_ground';
const SIT_EAT = 'sit_eat';
const GIVE = 'give';
const HIGH_FIVE = 'high_five';
const WAVE = 'wave';
const PET = 'pet';
const FISH_CLIPS: ReadonlySet<string> = new Set([FISH_CAST, FISH_STRIKE]);
const NO_VARIANTS: readonly string[] = [];
/** Attentes d'un joueur, et les mêmes avec la poule à caresser. */
const PLAYER_VARIANTS = SETTINGS.idleVariants.players ?? NO_VARIANTS;
const PLAYER_VARIANTS_HEN: readonly string[] = [...PLAYER_VARIANTS, PET];
const DEGREE = Math.PI / 180;
/** Fondu court entre les clips de pêche, qui partent et finissent sur la même pose. */
const FISH_FADE = 0.1;
/** Bornes du calage d'un geste: part de la durée prise par l'avance du contact, départ au plus tard dans le clip. */
const GESTURE_LEAD_SHARE_MAX = 0.5;
const GESTURE_START_MAX = 0.9;
const BODY_CENTER = 0.9;
const BODY_RADIUS = 1.3;

/** Animation jouée pour chaque action de la simulation. */
const CLIP_FOR_ACTION: Readonly<Record<ActionKind, string>> = {
  idle: 'idle',
  walk: 'walk',
  carry: 'carry_two',
  till: 'hoe',
  sow: 'sow',
  water: 'water',
  harvest: 'harvest',
  chop: 'chop',
  saw: 'saw',
  hammer: 'hammer',
  talk: 'talk',
  sit: 'sit',
  eat: 'eat',
  sleep: 'sleep',
  // Cuisiner: la main tendue au-dessus du réchaud, qui va et vient (remuer, servir).
  cook: 'give',
  feed: 'sow',
  pickup: 'harvest',
  refill: 'water',
};

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

/** Ce qu'un habitant fait selon son activité d'emploi du temps. */
function villagerClip(villager: DeepReadonly<VillagerState>): string {
  if (villager.speed > SETTINGS.walkThreshold) {
    return 'walk';
  }
  if (villager.talkingWith.length > 0) {
    return 'talk';
  }
  switch (villager.activity) {
    case 'work':
      return 'saw';
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
}

class CharacterFigure {
  readonly root = new Group();
  private readonly mixer: AnimationMixer | null;
  private readonly actions = new Map<string, AnimationAction>();
  private current: AnimationAction | null = null;
  private currentName = '';
  private readonly faces: Mesh[] = [];
  private readonly hand: Object3D | null;
  private tool: Object3D | null = null;
  private toolName = '';
  private facing: number | null = null;
  private ground: number | null = null;
  private readonly phase: number;
  readonly pick: PickTarget;
  private readonly position = { x: 0, y: 0 };
  /** Rotations d'os ajoutées au clip (attentes procédurales, regard). */
  private readonly offsets: BoneOffsets;
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

  constructor(
    readonly id: string,
    model: Object3D,
    private readonly clips: ReadonlyMap<string, AnimationClip>,
    pick: PickTarget,
    scale: number,
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
    this.offsets = new BoneOffsets(model);
    this.idleNextAt = this.idleDelay();
  }

  private idleDelay(): number {
    const range = SETTINGS.idleAfterSeconds;
    return range.min + (range.max - range.min) * stableUnit(this.id, this.idleRank, 'idle');
  }

  /** Regard vers ce point de la carte (habitant attentif), ou droit devant (`null`). */
  lookAt(target: DeepReadonly<{ x: number; y: number }> | null): void {
    if (target === null) {
      this.lookTarget = null;
      return;
    }
    this.lookPoint.x = target.x;
    this.lookPoint.y = target.y;
    this.lookTarget = this.lookPoint;
  }

  /** Joue `clip` une fois par-dessus l'attente (salut). Faux s'il n'existe pas ou si autre chose joue. */
  playOnce(clip: string, time: number): boolean {
    const duration = this.clips.get(clip)?.duration ?? 0;
    if (duration <= 0 || this.currentName !== 'idle') {
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
    if (request.name !== 'idle') {
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
      const name =
        variants[Math.floor(stableUnit(this.id, this.idleRank, 'pick') * variants.length)] ?? '';
      const pose = IDLE_POSES[name];
      const seconds = pose?.seconds ?? this.clips.get(name)?.duration ?? 0;
      if (seconds > 0) {
        this.variant = { name, start: time, seconds, procedural: pose !== undefined };
      } else {
        this.idleFor = 0;
      }
    }
    const variant = this.variant;
    if (variant !== null && time - variant.start >= variant.seconds) {
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
      this.offsets.add('chest', 'up', this.lookYaw * shares.chest);
      this.offsets.add('neck', 'up', this.lookYaw * shares.neck);
      this.offsets.add('head', 'up', this.lookYaw * shares.head);
    }
    this.offsets.apply(this.root);
  }

  private play(request: ClipRequest): void {
    if (this.mixer === null) {
      return;
    }
    const clip = this.clips.get(request.name) ?? this.clips.get('idle');
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
    const anchor = this.tool.getObjectByName(node);
    if (anchor !== undefined) {
      anchor.getWorldPosition(out);
      return true;
    }
    this.tool.updateWorldMatrix(true, false);
    out.copy(local);
    this.tool.localToWorld(out);
    return true;
  }

  setTool(library: ModelLibrary, model: string | null): void {
    const name = model ?? '';
    if (name === this.toolName || this.hand === null) {
      return;
    }
    this.tool?.removeFromParent();
    this.tool = model === null ? null : library.instantiate(model);
    this.tool?.traverse((object) => {
      object.castShadow = true;
    });
    if (this.tool !== null) {
      this.hand.add(this.tool);
    }
    this.toolName = name;
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
    const targetGround = terrain.heightAt(at.x, at.y);
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
    this.offsets.restore();
    this.mixer?.update(context.dt);
    if (this.mixer !== null) {
      this.applyOffsets(context.time, context.dt);
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

/** Texture d'un joueur: celle des personnages, rangée 0 réécrite à ses couleurs. */
class PlayerTexture {
  readonly canvas = document.createElement('canvas');
  readonly texture: CanvasTexture;
  private key = '';

  constructor(private readonly source: CanvasImageSource & { width: number; height: number }) {
    this.canvas.width = source.width;
    this.canvas.height = source.height;
    this.texture = new CanvasTexture(this.canvas);
    preparePaletteTexture(this.texture, true);
  }

  paint(id: CharacterId, outfit: number, scarf: string): void {
    const key = `${id}|${outfit}|${scarf}`;
    if (key === this.key) {
      return;
    }
    this.key = key;
    const context = this.canvas.getContext('2d');
    if (context === null) {
      return;
    }
    context.drawImage(this.source, 0, 0);
    const colors: Partial<Record<CharacterSlot, string>> = {
      ...BODY_COLORS[id],
      ...(OUTFITS[outfit]?.colors ?? OUTFITS[0]?.colors),
      scarf: safeColor(scarf),
      scarf_mark: SCARF_MARK,
    };
    for (const [slot, color] of Object.entries(colors) as [CharacterSlot, string][]) {
      context.fillStyle = color;
      context.fillRect(
        characterSlotColumn(slot) * PALETTE_CELL_PIXELS,
        PLAYER_ROW * PALETTE_CELL_PIXELS,
        PALETTE_CELL_PIXELS,
        PALETTE_CELL_PIXELS,
      );
    }
    this.texture.needsUpdate = true;
  }
}

interface PlayerEntry {
  figure: CharacterFigure;
  texture: PlayerTexture | null;
  meshes: Map<string, Object3D>;
  look: string;
  /** Géométrie d'origine du corps (partagée avec le GLB), et la fusion courante corps et vêtements. */
  baseGeometry: BufferGeometry | null;
  merged: BufferGeometry | null;
}

/**
 * Fusionne le corps et les vêtements choisis en une seule géométrie animée:
 * un appel de dessin par joueur et un seul programme de shader pour tous les
 * personnages. Les pièces sans cibles de morphose en reçoivent des nulles,
 * pour avoir les mêmes attributs que le corps. `null` si c'est impossible.
 */
function mergeOutfit(
  base: BufferGeometry,
  parts: readonly BufferGeometry[],
): BufferGeometry | null {
  const morphs = base.morphAttributes.position ?? [];
  const prepared = parts.map((part) => {
    const copy = part.clone();
    const count = copy.getAttribute('position').count;
    if (copy.morphAttributes.position === undefined && morphs.length > 0) {
      copy.morphAttributes.position = morphs.map(
        () => new Float32BufferAttribute(new Float32Array(count * VECTOR_SIZE), VECTOR_SIZE),
      );
    }
    copy.morphTargetsRelative = base.morphTargetsRelative;
    return copy;
  });
  const merged = mergeGeometries([base, ...prepared], false);
  for (const copy of prepared) {
    copy.dispose();
  }
  return merged;
}

const PLAYER_MESHES = [
  'player_base',
  ...HAIR_MESHES,
  ...new Set(OUTFITS.map((outfit) => outfit.mesh)),
  ...SCARF_SYMBOLS.map((symbol) => symbol.mesh),
];

export class CharactersPart implements EventfulPart {
  readonly group = new Group();
  private readonly clips = new Map<string, AnimationClip>();
  private readonly players = new Map<CharacterId, PlayerEntry>();
  private readonly villagers = new Map<string, CharacterFigure>();

  constructor(
    private readonly library: ModelLibrary,
    private readonly materials: SharedMaterials,
    private readonly terrain: Terrain,
    private readonly resources: ResourceTracker,
    private readonly picks: PickRegistry,
    private readonly content: Content,
  ) {
    this.group.name = 'personnages';
    for (const clip of library.animations(CHARACTERS_FILE)) {
      this.clips.set(clip.name, clip);
    }
  }

  /** Geste de pêche joué une fois par joueur (lancer, ferrer), avec son début. */
  private readonly oneShot = new Map<
    CharacterId,
    { clip: string; start: number; duration: number }
  >();
  private time = 0;

  handleEvent(event: WorldEvent): void {
    if (event.type === 'cast') {
      this.startOneShot(event.by, FISH_CAST);
    } else if (event.type === 'caught' || event.type === 'escaped') {
      this.startOneShot(event.by, FISH_STRIKE);
    } else if (event.type === 'gave') {
      this.startOneShot(event.by, GIVE);
    } else if (
      (event.type === 'envie_done' && event.by === 'both') ||
      event.type === 'quest_done'
    ) {
      // Réussite à deux: on se tape dans la main si l'on est côte à côte (vu à l'image suivante).
      this.highFivePending = true;
    }
  }

  private highFivePending = false;
  /** Habitants qui ont déjà salué un joueur ce jour-là (`habitant|joueur`). */
  private readonly greeted = new Set<string>();
  private greetedDay = -1;

  /** Tape dans la main si les deux joueurs, debout, sont assez près l'un de l'autre. */
  private resolveHighFive(world: ReadonlyWorld): void {
    this.highFivePending = false;
    const [a, b] = world.characters;
    if (a === undefined || b?.inHouse !== a.inHouse) {
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
    if (character.inHouse) {
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
    const model = this.library.cloneRig(RIG_NODE, PLAYER_MESHES);
    const pick = this.picks.add({ kind: 'character', character: character.id });
    const meshes = new Map<string, Object3D>();
    let texture: PlayerTexture | null = null;
    const shared = this.library.sharedCharacterMaterial();
    if (model !== null && shared?.map?.image !== undefined) {
      texture = new PlayerTexture(
        shared.map.image as CanvasImageSource & { width: number; height: number },
      );
      this.resources.track(texture.texture);
      const material = this.resources.trackMaterial(shared.clone());
      material.map = texture.texture;
      model.traverse((object) => {
        if (object instanceof SkinnedMesh) {
          object.material = material;
          meshes.set(object.name, object);
        }
      });
    }
    const figure = new CharacterFigure(
      character.id,
      model ?? this.substituteModel(character.appearance.scarf),
      this.clips,
      pick,
      1,
    );
    this.group.add(figure.root);
    const base = meshes.get('player_base');
    const baseGeometry = base instanceof SkinnedMesh ? (base.geometry as BufferGeometry) : null;
    if (baseGeometry !== null) {
      // Les vêtements sont fusionnés dans le corps: leurs maillages sortent de la scène (ni dessin ni programme).
      for (const [name, mesh] of meshes) {
        if (name !== 'player_base') {
          mesh.removeFromParent();
        }
      }
    }
    return { figure, texture, meshes, look: '', baseGeometry, merged: null };
  }

  private dress(entry: PlayerEntry, character: DeepReadonly<Character>): void {
    const { hair, outfit, scarf } = character.appearance;
    const look = `${hair}|${outfit}|${scarf}`;
    if (look === entry.look) {
      return;
    }
    entry.look = look;
    const wanted = new Set([
      'player_base',
      HAIR_MESHES[hair] ?? HAIR_MESHES[0],
      OUTFITS[outfit]?.mesh ?? OUTFITS[0]?.mesh ?? '',
      scarfMeshFor(scarf),
    ]);
    const base = entry.meshes.get('player_base');
    const parts = [...wanted]
      .filter((name) => name !== 'player_base')
      .map((name) => entry.meshes.get(name))
      .filter((mesh): mesh is SkinnedMesh => mesh instanceof SkinnedMesh)
      .map((mesh) => mesh.geometry);
    const merged =
      base instanceof SkinnedMesh && entry.baseGeometry !== null
        ? mergeOutfit(entry.baseGeometry, parts)
        : null;
    if (merged !== null && base instanceof SkinnedMesh) {
      entry.merged?.dispose();
      entry.merged = merged;
      base.geometry = merged;
      for (const [name, mesh] of entry.meshes) {
        mesh.visible = name === 'player_base';
      }
    } else {
      for (const [name, mesh] of entry.meshes) {
        if (mesh.parent === null && base?.parent !== null && base?.parent !== undefined) {
          base.parent.add(mesh);
        }
        mesh.visible = wanted.has(name);
      }
    }
    entry.texture?.paint(character.id, outfit, scarf);
  }

  private createVillager(villager: DeepReadonly<VillagerState>): CharacterFigure {
    const definition = this.content.villagers.find((candidate) => candidate.id === villager.id);
    const modelName = definition?.model ?? `villager_${villager.id}`;
    const node = this.library.source(modelName)?.node ?? modelName;
    const model = this.library.cloneRig(RIG_NODE, [node]) ?? this.library.instantiate(modelName);
    const pick = this.picks.add({ kind: 'villager', villager: villager.id });
    const figure = new CharacterFigure(
      villager.id,
      model,
      this.clips,
      pick,
      definition?.scale ?? 1,
    );
    this.group.add(figure.root);
    return figure;
  }

  update(context: FrameContext): void {
    this.time = context.time;
    const world: ReadonlyWorld = context.world;
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
      const shot = this.oneShot.get(character.id);
      const shotActive = shot !== undefined && context.time - shot.start < shot.duration;
      const fishing = character.fishing !== null || (shotActive && FISH_CLIPS.has(shot.clip));
      const seat = kind === 'sit' ? this.seatAt(world, character.pos.x, character.pos.y) : null;
      const walkScale = Math.min(
        WALK_SCALE_MAX,
        Math.max(WALK_SCALE_MIN, character.speed / SETTINGS.walkReferenceSpeed),
      );
      const gesture = this.gestureRequest(character, context);
      let request: ClipRequest;
      if (moving && kind !== 'carry') {
        request = { name: 'walk', timeScale: walkScale, fade: SETTINGS.walkFadeSeconds };
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
        request = { name, timeScale: kind === 'carry' ? (moving ? walkScale : 0) : 1 };
      }
      // Tape dans la main: face à l'autre le temps du geste (rendu seul).
      const partner =
        shotActive && shot.clip === HIGH_FIVE
          ? world.characters.find((other) => other.id !== character.id)
          : undefined;
      const facing =
        partner === undefined
          ? character.facing
          : Math.atan2(partner.pos.y - character.pos.y, partner.pos.x - character.pos.x);
      entry.figure.update(
        context,
        this.terrain,
        character.prev,
        character.pos,
        facing,
        request,
        seat?.lift ?? 0,
        this.henInFront(character, world) ? PLAYER_VARIANTS_HEN : PLAYER_VARIANTS,
      );
      entry.figure.updateFace(context.time, FORM_EXPRESSION[character.form]);
      entry.figure.pick.enabled = true;
      const held = character.bag[character.selected] ?? null;
      const definition = held === null ? undefined : this.content.items[held.item];
      const showTool =
        definition !== undefined &&
        !HANDS_FREE.has(kind) &&
        (definition.category === 'tool' || (definition.category === 'seed' && kind === 'sow'));
      const rod = this.content.items[ROD_ITEM]?.model ?? ROD_ITEM;
      entry.figure.setTool(
        this.library,
        fishing && !moving ? rod : showTool ? definition.model : null,
      );
    }
    for (const villager of world.villagers) {
      let figure = this.villagers.get(villager.id);
      if (figure === undefined) {
        figure = this.createVillager(villager);
        this.villagers.set(villager.id, figure);
      }
      figure.root.visible = villager.visible;
      figure.pick.enabled = villager.visible;
      if (!villager.visible) {
        continue;
      }
      const clip = villagerClip(villager);
      this.villagerAttention(figure, villager, world, context.time, clip);
      const timeScale =
        clip === 'walk'
          ? Math.min(
              WALK_SCALE_MAX,
              Math.max(WALK_SCALE_MIN, villager.speed / SETTINGS.walkReferenceSpeed),
            )
          : 1;
      figure.update(
        context,
        this.terrain,
        villager.prev,
        villager.pos,
        villager.facing,
        { name: clip, timeScale },
        0,
        SETTINGS.idleVariants[villager.id] ?? NO_VARIANTS,
      );
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
      if (character.inHouse || character.status === 'sleeping') {
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
      entry.merged?.dispose();
    }
    for (const figure of this.villagers.values()) {
      figure.dispose();
    }
    this.players.clear();
    this.villagers.clear();
  }
}
