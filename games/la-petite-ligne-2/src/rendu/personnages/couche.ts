/**
 * Couche des personnages assemblés (lot L6, interface `CharacterLayer`): les deux joueurs et les
 * habitants du lieu, chacun assemblé depuis son look, animé par l'état (vitesse, assise, geste),
 * avec visage, ombre de contact, liseré de visée et niveau de détail. Tant que les GLB ne sont pas
 * chargés (ou s'ils manquent), les bonshommes provisoires tiennent la place.
 */
import {
  type AnimationAction,
  AnimationMixer,
  BackSide,
  type Camera,
  DataTexture,
  Group,
  LinearFilter,
  type Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Mesh,
  type Object3D,
  type OrthographicCamera,
  type PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  SkinnedMesh,
  Color,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { DECOR_MANIFEST } from '../lieu/decors-manifeste';
import { clampAlongSeat, type Leg, LegPose, solveLeg } from './assise';
import type { Look } from '../../donnees/schemas/personnage';
import type { DeepReadonly } from '../../etat/monde';
import type { Body, PlayerState } from '../../etat/joueur';
import type { GameEvent } from '../../simulation/noyau/evenements';
import type { GameView } from '../../session';
import {
  type CharacterFrame,
  type CharacterLayer,
  type CharacterLayerDeps,
  type CharacterLayerFactory,
  createStandInCharacters,
} from '../bonshommes';
import { approach } from '../camera';
import type { Aimable } from '../cible';
import { Fadable } from '../fondu';
import { RENDER_SETTINGS } from '../reglages';
import { type LyingPose, lyingPose } from './allonge';
import {
  Face,
  blendWeights,
  leanAngle,
  type Posture,
  strideRate,
  targetWeights,
  standingPosture,
} from './animation';
import { composeLook, defaultPlayerLook, hashString, lookKey, resolveLook } from './apparence';
import {
  type AssembledGeometry,
  assemble,
  type CharacterLibrary,
  createRig,
  headMorphs,
} from './assemblage';
import { CHARACTER_SETTINGS, type CharacterSettings } from './reglages';
import { villagerView } from '../../simulation/habitants/lecture';

interface Shared {
  readonly geometry: AssembledGeometry;
  users: number;
}

interface Figure extends Aimable {
  readonly id: string;
  readonly object: Group;
  readonly key: string;
  readonly shape: string;
  /** Taille choisie dans l'éditeur (cm), cuite dans l'échelle du squelette. */
  readonly chosenHeight: number | undefined;
  readonly height: number;
  readonly legScale: number;
  readonly root: Object3D;
  /** Entre le personnage et son squelette: bascule le corps sur le dos quand il est couché. */
  readonly tilt: Group;
  readonly skinned: SkinnedMesh;
  /** Matériaux propres à ce personnage (rendu encré: son numéro de pièce), libérés avec lui. */
  readonly owned: readonly Material[];
  /** Jambes posées au sol quand le personnage est assis, et la pose du clip gardée de côté. */
  readonly legs: readonly Leg[];
  readonly legPose: LegPose;
  readonly body: SkinnedMesh;
  readonly head: SkinnedMesh | null;
  readonly whole: SkinnedMesh;
  readonly rim: SkinnedMesh;
  readonly blob: Mesh;
  readonly morphs: Readonly<Record<string, number>>;
  readonly mixer: AnimationMixer;
  readonly actions: ReadonlyMap<string, AnimationAction>;
  readonly weights: Map<string, number>;
  readonly face: Face;
  readonly fadable: Fadable;
  lookRef: unknown;
  placed: boolean;
  x: number;
  y: number;
  lift: number;
  facing: number;
  /** Inclinaison dans les virages (rad, `leanAngle`). */
  lean: number;
  phase: number;
  far: boolean;
  /** Pixels par mètre à l'écran, relevés au dernier rendu de son ombre de contact. */
  pixelsPerMeter: number;
}

const target = new Map<string, number>();
/** Taille du gabarit adulte (m), à laquelle sont mesurées les longueurs des réglages. */
const ADULT_HEIGHT = 1.7;
const STILL: Posture = { kind: 'stand', speed: 0 };
const size = new Vector2();
const cameraPoint = new Vector3();
const blobPoint = new Vector3();
const lying: LyingPose = { x: 0, y: 0, facing: 0, height: 0 };

/** Pastille dégradée de l'ombre de contact (texture calculée, sans canevas). */
function contactTexture(opacity: number): DataTexture {
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j += 1)
    for (let i = 0; i < n; i += 1) {
      const dx = (i + 0.5) / n - 0.5;
      const dy = (j + 0.5) / n - 0.5;
      const r = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      const a = (1 - r * r) * (1 - r) * opacity;
      const o = (j * n + i) * 4;
      data[o] = 40;
      data[o + 1] = 32;
      data[o + 2] = 28;
      data[o + 3] = Math.round(Math.max(0, a) * 255);
    }
  const texture = new DataTexture(data, n, n, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Hauteur d'un personnage à l'écran (pixels CSS) par mètre, selon la caméra du rendu. */
function pixelsPerMeter(renderer: WebGLRenderer, camera: Camera, at: Vector3): number {
  renderer.getSize(size);
  const ortho = camera as Partial<OrthographicCamera>;
  if (ortho.isOrthographicCamera === true) {
    const c = camera as OrthographicCamera;
    return (size.y * c.zoom) / Math.max(1e-6, c.top - c.bottom);
  }
  const p = camera as PerspectiveCamera;
  camera.getWorldPosition(cameraPoint);
  const distance = Math.max(0.1, cameraPoint.distanceTo(at));
  return size.y / (2 * distance * Math.tan(((p.fov || 50) * Math.PI) / 360));
}

/** Assise tenue: dessus et bord avant, et, pour un meuble à accoudoirs, de quoi rester entre eux. */
interface Seat {
  readonly height: number;
  readonly front: number;
  readonly side?: {
    readonly x: number;
    readonly y: number;
    readonly halfWidth: number;
    readonly clear: number;
  };
}

const legTarget = new Vector3();

export class AssembledCharacters implements CharacterLayer {
  private readonly material: MeshStandardMaterial;
  private readonly rimMaterial: Material;
  private readonly blobGeometry: PlaneGeometry;
  private readonly blobMaterial: Material;
  private readonly blobTexture: DataTexture;
  private readonly glowColor = new Color(RENDER_SETTINGS.target.rimColor);
  private readonly geometries = new Map<string, Shared>();
  private readonly composed = new Map<string, Look>();
  private readonly players: [Figure | null, Figure | null] = [null, null];
  private readonly villagers = new Map<string, Figure>();
  private readonly unsubscribe: () => void;
  private library: CharacterLibrary | null = null;
  private fallback: CharacterLayer | null;
  private disposed = false;
  /** Assemblages faits depuis la création (mesure et tests). */
  assemblies = 0;

  constructor(
    private readonly deps: CharacterLayerDeps,
    private readonly view: Pick<GameView, 'content' | 'onEvent'>,
    library: Promise<CharacterLibrary> | CharacterLibrary,
    private readonly settings: CharacterSettings = CHARACTER_SETTINGS,
  ) {
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      roughness: settings.roughness,
      metalness: 0,
    });
    this.material.name = 'figurine';
    const ink = deps.ink ?? null;
    const width = settings.rim.width;
    const rim = new MeshBasicMaterial({ color: settings.rim.color, side: BackSide });
    this.rimMaterial = ink === null ? rim : ink.flatMaterial(settings.rim.color, width, BackSide);
    // Liseré: la coque gonfle le long des normales avant le skinning, elle suit donc la pose.
    rim.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed += normalize( normal ) * ${width.toFixed(4)};`,
      );
    };
    this.blobGeometry = new PlaneGeometry(settings.contact.width, settings.contact.depth).rotateX(
      -Math.PI / 2,
    );
    this.blobTexture = contactTexture(settings.contact.opacity);
    this.blobMaterial =
      ink?.contact ??
      new MeshBasicMaterial({
        map: this.blobTexture,
        transparent: true,
        depthWrite: false,
      });
    if (ink !== null) rim.dispose();
    this.unsubscribe = view.onEvent((event) => {
      this.onEvent(event);
    });
    if (library instanceof Promise) {
      this.fallback = createStandInCharacters(deps);
      library.then(
        (ready) => {
          if (this.disposed) {
            ready.dispose();
            return;
          }
          this.library = ready;
          this.fallback?.dispose();
          this.fallback = null;
        },
        () => {
          // GLB absents ou illisibles: les bonshommes provisoires restent, le jeu continue.
        },
      );
    } else {
      this.fallback = null;
      this.library = library;
    }
  }

  /** Bibliothèque chargée (les bonshommes provisoires ont cédé la place). */
  ready(): boolean {
    return this.library !== null;
  }

  private onEvent(event: GameEvent): void {
    if (this.library === null) return;
    if (event.type === 'talk_page') {
      const figure =
        event.speaker === 'player' ? this.players[event.player] : this.villagers.get(event.speaker);
      figure?.face.talk();
      return;
    }
    const rule = this.settings.eventExpressions[event.type];
    if (rule === undefined) return;
    let figure: Figure | null | undefined = null;
    if (rule.who === 'villager' && 'villager' in event) figure = this.villagers.get(event.villager);
    if (rule.who === 'player' && 'player' in event) figure = this.players[event.player];
    figure?.face.show(rule.expression, rule.seconds);
  }

  /** Fait prendre une expression à un personnage (`player-0`, `player-1` ou un habitant). */
  express(id: string, expression: string, seconds: number): void {
    const figure =
      id === 'player-0'
        ? this.players[0]
        : id === 'player-1'
          ? this.players[1]
          : this.villagers.get(id);
    figure?.face.show(expression, seconds);
  }

  private acquire(
    look: Look,
    library: CharacterLibrary,
  ): { key: string; shared: Shared; shape: string } {
    const resolved = resolveLook(look, library.catalogue, library.morphologies);
    const key = lookKey(resolved);
    let shared = this.geometries.get(key);
    if (shared === undefined) {
      shared = { geometry: assemble(resolved, library), users: 0 };
      this.assemblies += 1;
      this.geometries.set(key, shared);
    }
    shared.users += 1;
    return { key, shared, shape: resolved.shape };
  }

  private release(key: string): void {
    const shared = this.geometries.get(key);
    if (shared === undefined) return;
    shared.users -= 1;
    if (shared.users > 0) return;
    shared.geometry.body.dispose();
    shared.geometry.head?.dispose();
    shared.geometry.whole.dispose();
    this.geometries.delete(key);
  }

  private create(id: string, look: Look, library: CharacterLibrary): Figure {
    const { key, shared, shape } = this.acquire(look, library);
    const { root, skeletonOf } = createRig(library, shape, look.height);
    const parent = skeletonOf.parent ?? root;
    // Encre: chaque personnage a ses deux matériaux (même programme), donc son numéro de pièce.
    const inked = this.deps.ink?.characterMaterials() ?? null;
    const bind = (geometry: AssembledGeometry['body'], face = false): SkinnedMesh => {
      const material = inked === null ? this.material : face ? inked.head : inked.body;
      const mesh = new SkinnedMesh(geometry, material);
      mesh.bind(skeletonOf.skeleton, skeletonOf.bindMatrix);
      // Bornes du maillage au repos fausses une fois animé: on dessine toujours (14 personnages au plus).
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const body = bind(shared.geometry.body);
    const head = shared.geometry.head === null ? null : bind(shared.geometry.head, true);
    if (head !== null) head.updateMorphTargets();
    const whole = bind(shared.geometry.whole);
    whole.visible = false;
    const object = new Group();
    object.name = `personnage-${id}`;
    const tilt = new Group();
    tilt.add(root);
    object.add(tilt);
    const fadable = new Fadable(root, this.glowColor);
    // Liseré ajouté après le relevé du fondu: il garde son matériau propre.
    const rim = new SkinnedMesh(shared.geometry.whole, this.rimMaterial);
    rim.bind(skeletonOf.skeleton, skeletonOf.bindMatrix);
    rim.frustumCulled = false;
    rim.visible = false;
    parent.add(rim);
    const blob = new Mesh(this.blobGeometry, this.blobMaterial);
    blob.renderOrder = 1;
    object.add(blob);
    const mixer = new AnimationMixer(root);
    const actions = new Map<string, AnimationAction>();
    for (const [name, clip] of library.clipsFor(shape)) {
      const action = mixer.clipAction(clip);
      action.setEffectiveWeight(0);
      action.play();
      actions.set(name, action);
    }
    const legs: Leg[] = [];
    for (const [upperName, lowerName, footName] of this.settings.seat.legs) {
      const upper = root.getObjectByName(upperName);
      const lower = root.getObjectByName(lowerName);
      const foot = root.getObjectByName(footName);
      if (upper !== undefined && lower !== undefined && foot !== undefined)
        legs.push({ upper, lower, foot });
    }
    const lengths = library.morphologies.shapes[shape];
    const figure: Figure = {
      id,
      object,
      key,
      shape,
      chosenHeight: look.height,
      height: library.height(shape),
      legScale: (lengths?.legs ?? 1) * (lengths?.scale ?? 1),
      root,
      tilt,
      skinned: skeletonOf,
      owned: inked === null ? [] : [inked.body, inked.head],
      legs,
      legPose: new LegPose(legs),
      body,
      head,
      whole,
      rim,
      blob,
      morphs: shared.geometry.head === null ? {} : headMorphs(shared.geometry.head),
      mixer,
      actions,
      weights: new Map(),
      face: new Face(hashString(id)),
      fadable,
      lookRef: null,
      placed: false,
      x: 0,
      y: 0,
      lift: 0,
      facing: 0,
      lean: 0,
      phase: 0,
      far: false,
      pixelsPerMeter: 0,
      setGlow: (glow) => {
        fadable.apply(1, glow);
        rim.visible = glow > 0;
      },
    };
    blob.onBeforeRender = (renderer, _scene, camera) => {
      blob.getWorldPosition(blobPoint);
      figure.pixelsPerMeter = pixelsPerMeter(renderer, camera, blobPoint);
    };
    this.deps.root.add(object);
    return figure;
  }

  private remove(figure: Figure): void {
    figure.fadable.dispose();
    figure.mixer.stopAllAction();
    figure.mixer.uncacheRoot(figure.root);
    figure.skinned.skeleton.dispose();
    for (const material of figure.owned) material.dispose();
    figure.object.removeFromParent();
    this.release(figure.key);
  }

  /** Le personnage de ce look, refait si le look a changé (éditeur, sauvegarde relue). */
  private ensure(
    current: Figure | null,
    id: string,
    lookRef: unknown,
    lookOf: () => Look,
    library: CharacterLibrary,
  ): Figure {
    if (current !== null && current.lookRef === lookRef) return current;
    const look = lookOf();
    const key = lookKey(resolveLook(look, library.catalogue, library.morphologies));
    if (current !== null && current.key === key && current.chosenHeight === look.height) {
      current.lookRef = lookRef;
      return current;
    }
    const next = this.create(id, look, library);
    next.lookRef = lookRef;
    if (current !== null) {
      next.x = current.x;
      next.y = current.y;
      next.facing = current.facing;
      next.placed = current.placed;
      this.remove(current);
    }
    return next;
  }

  private playerLook(
    index: 0 | 1,
    player: DeepReadonly<PlayerState>,
    library: CharacterLibrary,
  ): Look {
    if (player.look !== null) return player.look as Look;
    const key = `player-${String(index)}-${player.gender ?? ''}`;
    let look = this.composed.get(key);
    if (look === undefined) {
      look = defaultPlayerLook(
        index,
        player.gender,
        this.view.content.settings.start.shapes,
        this.deps.playerColors[index],
        library.catalogue,
        this.settings,
      );
      this.composed.set(key, look);
    }
    return look;
  }

  private villagerLook(
    placeId: string,
    id: string,
    library: CharacterLibrary,
  ): { ref: unknown; look: () => Look } {
    const def = this.view.content.places[placeId]?.villagers.find((v) => v.id === id);
    if (def?.look !== null && def?.look !== undefined) {
      const look = def.look;
      return { ref: look, look: () => look };
    }
    return {
      ref: id,
      look: () => {
        let look = this.composed.get(id);
        if (look === undefined) {
          look = composeLook(id, library.catalogue, {}, this.settings);
          this.composed.set(id, look);
        }
        return look;
      },
    };
  }

  /** Dessus de l'assise que tient ce joueur dans le lieu, `null` s'il n'est pas assis. */
  private seatOf(frame: CharacterFrame, index: 0 | 1): Seat | null {
    const objects = frame.place.objects;
    for (const object in objects) {
      const seats = objects[object]?.sit;
      if (!(seats?.includes(index) ?? false)) continue;
      return this.seatOfObject(frame, object);
    }
    return null;
  }

  /** Assise d'un meuble du lieu (modèle livré, sinon forme provisoire). */
  private seatOfObject(frame: CharacterFrame, object: string): Seat {
    const placeId = frame.world.common.place;
    const placed =
      this.view.content.places[placeId]?.map.objects.find((o) => o.id === object) ??
      frame.place.placed.find((p) => p.id === object);
    const model = placed === undefined ? undefined : this.view.content.props[placed.type]?.model;
    const seat =
      (model === undefined ? undefined : this.settings.seat.byModel[model]) ??
      this.settings.seat.standIn;
    const shape = model === undefined ? undefined : DECOR_MANIFEST.models[model];
    const clear = shape === undefined ? undefined : this.settings.seat.sideClear[shape.family];
    if (placed === undefined || shape === undefined || clear === undefined) return seat;
    return { ...seat, side: { x: placed.x, y: placed.y, halfWidth: shape.size.w / 2, clear } };
  }

  private follow(
    figure: Figure,
    body: DeepReadonly<Body>,
    posture: Posture,
    seat: Seat | null,
    dt: number,
  ): void {
    let x = body.x;
    let y = body.y;
    if (seat?.side !== undefined) {
      // Le long de l'assise: jamais dans l'accoudoir, quel que soit le gabarit.
      const lx = -Math.sin(body.facing);
      const ly = Math.cos(body.facing);
      const along = (x - seat.side.x) * lx + (y - seat.side.y) * ly;
      const kept = clampAlongSeat(along, seat.side.halfWidth, seat.side.clear);
      x += (kept - along) * lx;
      y += (kept - along) * ly;
    }
    if (seat !== null) {
      const s = this.settings.seat;
      const forward = Math.max(0, seat.front - s.clipKnee * figure.legScale + s.kneeMargin);
      x += Math.cos(body.facing) * forward;
      y += Math.sin(body.facing) * forward;
    }
    // Le bassin pose sur l'assise à sa vraie hauteur, quelle que soit celle du clip (0,50 m pour
    // le gabarit adulte): les jambes sont ensuite ramenées au sol une à une (`groundLegs`).
    const lift = seat === null ? 0 : seat.height - this.settings.seat.clipSeat * figure.legScale;
    if (!figure.placed) {
      figure.x = x;
      figure.y = y;
      figure.lift = lift;
      figure.facing = body.facing;
      figure.lean = 0;
      figure.placed = true;
    } else {
      const k = approach(dt, this.settings.smoothHalfLife);
      figure.x += (x - figure.x) * k;
      figure.y += (y - figure.y) * k;
      figure.lift += (lift - figure.lift) * approach(dt, this.settings.locomotion.fadeHalfLife);
      const turn = Math.atan2(
        Math.sin(body.facing - figure.facing),
        Math.cos(body.facing - figure.facing),
      );
      const turned = turn * approach(dt, this.settings.turnHalfLife);
      figure.facing += turned;
      const speed = posture.kind === 'stand' ? posture.speed : 0;
      figure.lean = leanAngle(figure.lean, speed, dt > 0 ? turned / dt : 0, dt, this.settings);
    }
    figure.object.position.set(figure.x, figure.lift, figure.y);
    // Cap de l'état: 0 vers l'est, PI/2 vers le sud. Le personnage regarde vers +Z au repos.
    figure.object.rotation.y = Math.PI / 2 - figure.facing;
    figure.tilt.rotation.x = 0;
    // Autour de l'axe de la marche (+Z du personnage), pivot aux pieds: vers l'intérieur du virage.
    figure.tilt.rotation.z = figure.lean;
    figure.blob.visible = true;
    figure.blob.position.y = this.settings.contact.lift - figure.lift;
    this.animate(figure, posture, dt);
    if (seat !== null) this.groundLegs(figure);
  }

  /**
   * Assis: chaque cheville revient à la hauteur qu'elle a dans le clip au-dessus du sol (le clip
   * est fait pieds au sol), donc au sol quelle que soit la hauteur de l'assise. Jambe trop
   * courte: elle garde la pose du clip, le pied pend.
   */
  private groundLegs(figure: Figure): void {
    if (figure.lift === 0 || figure.legs.length === 0) return;
    figure.object.updateMatrixWorld(true);
    figure.legPose.keep();
    for (const leg of figure.legs) {
      leg.foot.getWorldPosition(legTarget);
      legTarget.y -= figure.lift;
      solveLeg(leg, legTarget, this.settings.seat.legSlack);
    }
  }

  /** Taille affichée du personnage (m): celle de l'éditeur, sinon celle de sa silhouette. */
  private tallness(figure: Figure): number {
    return figure.chosenHeight === undefined ? figure.height : figure.chosenHeight / 100;
  }

  /**
   * Couché sur le dos: pieds vers la façade du lit, tête sur l'oreiller, dos sur le couchage. Le
   * corps garde sa pose de repos (bras le long du corps); il se pose d'un coup, comme la simulation.
   */
  private lie(figure: Figure, pose: LyingPose, dt: number): void {
    const scale = this.tallness(figure) / ADULT_HEIGHT;
    figure.x = pose.x;
    figure.y = pose.y;
    figure.facing = pose.facing;
    figure.lift = pose.height + this.settings.lie.back * scale;
    figure.placed = true;
    figure.object.position.set(figure.x, figure.lift, figure.y);
    figure.object.rotation.y = Math.PI / 2 - figure.facing;
    // Rotation de -90 degrés autour de l'axe gauche-droite: la tête part vers -Z (le dos du lit),
    // le visage vers le haut.
    figure.tilt.rotation.x = -Math.PI / 2;
    figure.tilt.rotation.z = 0;
    figure.lean = 0;
    figure.blob.visible = false;
    this.animate(figure, STILL, dt);
  }

  private animate(figure: Figure, posture: Posture, dt: number): void {
    const library = this.library;
    if (library === null) return;
    const c = this.settings.clips;
    // Les jambes posées à l'image passée reviennent à la pose du clip avant le mélange.
    figure.legPose.restore();
    const names = new Set(figure.actions.keys());
    targetWeights(posture, names, target, this.settings);
    blendWeights(figure.weights, target, dt, this.settings.locomotion.fadeHalfLife);
    const walk = figure.actions.get(c.walk);
    const run = figure.actions.get(c.run);
    if (posture.kind === 'stand' && walk !== undefined && run !== undefined) {
      const runWeight =
        (figure.weights.get(c.run) ?? 0) /
        Math.max(1e-3, (figure.weights.get(c.walk) ?? 0) + (figure.weights.get(c.run) ?? 0));
      const rate = strideRate(
        posture.speed,
        library.stride(c.walk) * figure.legScale,
        library.stride(c.run) * figure.legScale,
        Number.isFinite(runWeight) ? runWeight : 0,
        walk.getClip().duration,
        run.getClip().duration,
        this.settings,
      );
      // Marche et course partagent la phase: le fondu de l'une à l'autre ne fait pas trébucher.
      figure.phase = (figure.phase + rate * dt) % 1;
    }
    for (const [name, action] of figure.actions) {
      const weight = figure.weights.get(name) ?? 0;
      action.setEffectiveWeight(weight);
      if (action === walk || action === run) {
        action.timeScale = 0;
        action.time = figure.phase * action.getClip().duration;
      }
    }
    figure.mixer.update(dt);
    // Niveau de détail: loin, un seul maillage sans visage; une marge évite le va-et-vient.
    const pixels = figure.height * figure.pixelsPerMeter;
    const lod = this.settings.lod;
    if (figure.pixelsPerMeter > 0) {
      if (figure.far && pixels > lod.farPixels + lod.hysteresis) figure.far = false;
      else if (!figure.far && pixels < lod.farPixels - lod.hysteresis) figure.far = true;
    }
    figure.body.visible = !figure.far;
    if (figure.head !== null) figure.head.visible = !figure.far;
    figure.whole.visible = figure.far;
    const influences = figure.face.update(dt);
    const head = figure.head;
    if (head !== null && !figure.far && head.morphTargetInfluences !== undefined) {
      head.morphTargetInfluences.fill(0);
      for (const [name, weight] of influences) {
        const index = figure.morphs[name];
        if (index !== undefined) head.morphTargetInfluences[index] = weight;
      }
    }
  }

  private playerPosture(player: DeepReadonly<PlayerState>, seated: boolean): Posture {
    if (seated) return { kind: 'sit' };
    return standingPosture(player.body.speed, player.gesture?.clip ?? null, this.settings);
  }

  reset(): void {
    if (this.fallback !== null) {
      this.fallback.reset();
      return;
    }
    for (const figure of this.players) if (figure !== null) figure.placed = false;
    for (const figure of this.villagers.values()) this.remove(figure);
    this.villagers.clear();
  }

  snap(index: 0 | 1): void {
    if (this.fallback !== null) this.fallback.snap(index);
    const figure = this.players[index];
    if (figure !== null) figure.placed = false;
  }

  update(frame: CharacterFrame): void {
    if (this.fallback !== null) {
      this.fallback.update(frame);
      return;
    }
    const library = this.library;
    if (library === null) return;
    for (const index of [0, 1] as const) {
      const player = frame.world.players[index];
      const figure = this.ensure(
        this.players[index],
        `player-${String(index)}`,
        player.look ?? `default-${player.gender ?? ''}`,
        () => this.playerLook(index, player, library),
        library,
      );
      this.players[index] = figure;
      const seat = this.seatOf(frame, index);
      let held: string | null = null;
      for (const need in this.settings.needExpressions) {
        const tier = player.tiers[need as keyof typeof player.tiers] as string | undefined;
        const expression =
          tier === undefined ? undefined : this.settings.needExpressions[need]?.[tier];
        if (expression !== undefined) held = expression;
      }
      const headHeight =
        this.tallness(figure) * (1 - this.settings.lie.headBelowTop / ADULT_HEIGHT);
      const lies = lyingPose(
        this.view.content,
        frame.world,
        frame.place,
        index,
        headHeight,
        this.settings.lie.fallback,
        lying,
      );
      figure.face.hold(lies === null ? held : this.settings.lie.expression);
      if (lies !== null) this.lie(figure, lies, frame.dt);
      else
        this.follow(figure, player.body, this.playerPosture(player, seat !== null), seat, frame.dt);
      figure.object.visible =
        frame.hidden?.[index] !== true && (frame.visibleAt?.(player.body.x, player.body.y) ?? true);
    }
    const placeId = frame.world.common.place;
    for (const id in frame.place.villagers) {
      const state = frame.place.villagers[id];
      if (state === undefined) continue;
      const { ref, look } = this.villagerLook(placeId, id, library);
      const figure = this.ensure(this.villagers.get(id) ?? null, id, ref, look, library);
      this.villagers.set(id, figure);
      // La vie de l'habitant (planning): absent, assis sur une vraie place, ou en plein geste.
      const life = villagerView({ content: this.view.content, world: frame.world }, id);
      figure.object.visible =
        (life?.visible ?? true) && (frame.visibleAt?.(state.body.x, state.body.y) ?? true);
      const seatId = state.life?.seat?.[0] ?? null;
      const seated = life?.pose === 'sit' && seatId !== null;
      const posture: Posture = seated
        ? { kind: 'sit' }
        : standingPosture(state.body.speed, life?.gesture ?? null, this.settings);
      const seat = seated ? this.seatOfObject(frame, seatId) : null;
      this.follow(figure, state.body, posture, seat, frame.dt);
    }
    if (this.villagers.size > Object.keys(frame.place.villagers).length) {
      for (const [id, figure] of this.villagers) {
        if (id in frame.place.villagers) continue;
        this.remove(figure);
        this.villagers.delete(id);
      }
    }
  }

  playerPosition(index: 0 | 1): { readonly x: number; readonly y: number } | null {
    if (this.fallback !== null) return this.fallback.playerPosition(index);
    const figure = this.players[index];
    return figure?.placed === true ? figure : null;
  }

  aimable(id: string): Aimable | null {
    if (this.fallback !== null) return this.fallback.aimable(id);
    return this.villagers.get(id) ?? null;
  }

  /** Compteurs (mesure, contrôle de fuite). */
  stats(): { figures: number; geometries: number; triangles: number; far: number } {
    let triangles = 0;
    let far = 0;
    const all = [...this.players, ...this.villagers.values()];
    let figures = 0;
    for (const figure of all) {
      if (figure === null) continue;
      figures += 1;
      if (figure.far) far += 1;
      const shared = this.geometries.get(figure.key);
      triangles += shared?.geometry.triangles ?? 0;
    }
    return { figures, geometries: this.geometries.size, triangles, far };
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    this.fallback?.dispose();
    this.fallback = null;
    for (const figure of this.players) if (figure !== null) this.remove(figure);
    this.players[0] = null;
    this.players[1] = null;
    for (const figure of this.villagers.values()) this.remove(figure);
    this.villagers.clear();
    for (const shared of this.geometries.values()) {
      shared.geometry.body.dispose();
      shared.geometry.head?.dispose();
      shared.geometry.whole.dispose();
    }
    this.geometries.clear();
    this.material.dispose();
    this.rimMaterial.dispose();
    this.blobGeometry.dispose();
    // L'ombre de contact encrée appartient au rendu encré, qui la libère.
    if ((this.deps.ink ?? null) === null) this.blobMaterial.dispose();
    this.blobTexture.dispose();
    this.library?.dispose();
    this.library = null;
  }
}

export interface AssembledCharactersOptions {
  readonly view: Pick<GameView, 'content' | 'onEvent'>;
  /** Bibliothèque, ou sa promesse (chargement des GLB en cours). */
  readonly library: () => Promise<CharacterLibrary> | CharacterLibrary;
}

/** Fabrique de la couche, à donner au moteur par `RenderOptions.characters`. */
export function assembledCharacters(options: AssembledCharactersOptions): CharacterLayerFactory {
  return (deps) => new AssembledCharacters(deps, options.view, options.library());
}
