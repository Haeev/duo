/**
 * Personnages: les deux joueurs (foulard à la couleur de leur profil, coiffure
 * et tenue choisies) et les habitants, sur le squelette commun de
 * `personnages.glb`. Animations par `AnimationMixer` avec fondus enchaînés,
 * positions interpolées (`prev` vers `pos`), orientation lissée, outil en
 * main, clignement des yeux et expression selon la forme.
 */
import {
  AnimationMixer,
  CanvasTexture,
  Float32BufferAttribute,
  Group,
  Mesh,
  Quaternion,
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
import { RENDER_SETTINGS } from './reglages';
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
/** Bout de la canne à pêche de l'artiste, dans le repère de la prise (main droite). */
const ROD_TIP = new Vector3(0.01, 1.34, 1.51);
/** Le lancer reprend le geste de la hache (bras au-dessus de la tête), le temps d'un geste. */
const CAST_CLIP = 'chop';
const CAST_SECONDS = 0.9;
/** Touche: le bras tendu de l'arrosage, comme une canne qui tire. */
const BITE_CLIP = 'water';
const ROD_ITEM = 'fishing_rod';
/** Axe de la canne (de la prise au bout), et sa pente au-dessus de l'eau pendant la pêche. */
const ROD_AXIS = ROD_TIP.clone().normalize();
const ROD_TILT = (35 * Math.PI) / 180;
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
  cook: 'saw',
  feed: 'sow',
  pickup: 'harvest',
  refill: 'water',
};

/** Actions pendant lesquelles l'outil reste rangé. */
const HANDS_FREE: ReadonlySet<ActionKind> = new Set([
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
  }

  private play(name: string, timeScale: number): void {
    if (this.mixer === null) {
      return;
    }
    const clip = this.clips.get(name) ?? this.clips.get('idle');
    if (clip === undefined) {
      return;
    }
    let action = this.actions.get(clip.name);
    if (action === undefined) {
      action = this.mixer.clipAction(clip);
      this.actions.set(clip.name, action);
    }
    action.timeScale = timeScale;
    if (clip.name === this.currentName) {
      return;
    }
    action.reset();
    action.time = this.phase * clip.duration;
    action.fadeIn(SETTINGS.crossFadeSeconds).play();
    this.current?.fadeOut(SETTINGS.crossFadeSeconds);
    this.current = action;
    this.currentName = clip.name;
  }

  /** Position (monde) d'un point de l'outil tenu, dans le repère de l'outil; `false` sans outil. */
  toolPoint(local: Vector3, out: Vector3): boolean {
    if (this.tool === null) {
      return false;
    }
    this.tool.updateWorldMatrix(true, false);
    out.copy(local);
    this.tool.localToWorld(out);
    return true;
  }

  /**
   * Oriente l'outil tenu dans une direction du monde (la canne vers le
   * bouchon), quelle que soit la pose de la main; `null` rend la tenue de
   * l'artiste. À appeler après l'animation de l'image.
   */
  aimTool(axis: Vector3, direction: Vector3 | null): void {
    if (this.tool === null || this.hand === null) {
      return;
    }
    if (direction === null) {
      this.tool.quaternion.identity();
      return;
    }
    this.hand.getWorldQuaternion(this.handQuaternion);
    this.aimQuaternion.setFromUnitVectors(axis, direction);
    this.tool.quaternion.copy(this.handQuaternion.invert().multiply(this.aimQuaternion));
  }

  private readonly handQuaternion = new Quaternion();
  private readonly aimQuaternion = new Quaternion();

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
    clip: string,
    timeScale: number,
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
    this.root.position.set(at.x, this.ground, at.y);
    this.root.rotation.y = this.facing;
    this.play(clip, timeScale);
    this.mixer?.update(context.dt);
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

  /** Moment du dernier lancer de chaque joueur (pose de pêche composée avec les animations existantes). */
  private readonly castAt = new Map<CharacterId, number>();
  private readonly aim = new Vector3();
  private time = 0;

  handleEvent(event: WorldEvent): void {
    if (event.type === 'cast') {
      this.castAt.set(event.by, this.time);
    }
  }

  /** Bout de la canne d'un joueur (pour la ligne), `false` s'il ne tient rien. */
  rodTip(id: CharacterId, out: Vector3): boolean {
    return this.players.get(id)?.figure.toolPoint(ROD_TIP, out) ?? false;
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
    for (const character of world.characters) {
      let entry = this.players.get(character.id);
      if (entry === undefined) {
        entry = this.createPlayer(character);
        this.players.set(character.id, entry);
      }
      this.dress(entry, character);
      const moving = character.speed > SETTINGS.walkThreshold;
      const kind: ActionKind = character.status === 'sleeping' ? 'sleep' : character.action.kind;
      // Pêche: pas d'animation dédiée chez l'artiste, on compose (lancer, attente, touche).
      const castAt = this.castAt.get(character.id);
      const casting = castAt !== undefined && context.time - castAt < CAST_SECONDS;
      const fishing = character.fishing !== null || casting;
      const fishingClip = casting
        ? CAST_CLIP
        : character.fishing?.phase === 'bite'
          ? BITE_CLIP
          : 'idle';
      const clip =
        moving && kind !== 'carry' ? 'walk' : fishing ? fishingClip : CLIP_FOR_ACTION[kind];
      const timeScale =
        clip === 'walk' || clip === 'carry_two'
          ? Math.min(
              WALK_SCALE_MAX,
              Math.max(WALK_SCALE_MIN, character.speed / SETTINGS.walkReferenceSpeed),
            )
          : 1;
      entry.figure.update(
        context,
        this.terrain,
        character.prev,
        character.pos,
        character.facing,
        clip,
        kind === 'carry' && !moving ? 0 : timeScale,
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
      const line = character.fishing;
      if (line !== null && !moving) {
        const dx = line.bobber.x - character.pos.x;
        const dy = line.bobber.y - character.pos.y;
        const reach = Math.hypot(dx, dy) || 1;
        this.aim.set(
          (dx / reach) * Math.cos(ROD_TILT),
          Math.sin(ROD_TILT),
          (dy / reach) * Math.cos(ROD_TILT),
        );
        entry.figure.aimTool(ROD_AXIS, this.aim);
      } else {
        entry.figure.aimTool(ROD_AXIS, null);
      }
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
        clip,
        timeScale,
      );
      figure.updateFace(
        context.time,
        villager.talkingWith.length > 0
          ? { target: 'happy', weight: TALK_EXPRESSION_WEIGHT }
          : null,
      );
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
