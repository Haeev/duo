/**
 * Moteur du rendu 3D (lot L4): il lit l'état par `GameView` et n'y écrit jamais. Un seul lieu est
 * affiché à la fois: quand `common.place` change, l'ancien lieu est libéré en entier et le nouveau
 * construit depuis ses données (ADR 0018). Le moteur ne nomme aucun contenu: tout vient des
 * données et des réglages.
 */
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  Color,
  Fog,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  OrthographicCamera,
  PCFShadowMap,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  type ToneMapping,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Body } from '../etat/joueur';
import type { PlaceState } from '../etat/lieu';
import type { DeepReadonly, ReadonlyWorld } from '../etat/monde';
import type { GameView } from '../session';
import { SIM_HZ } from '../simulation/noyau/constantes';
import { tripSeconds } from '../simulation/voyage/index';
import {
  type CharacterLayer,
  type CharacterLayerFactory,
  createStandInCharacters,
} from './bonshommes';
import {
  type CameraInput,
  type CameraPose,
  CameraRig,
  screenToWorld,
  towardCamera,
  viewRadius,
} from './camera';
import { type Aimable, TargetHighlight } from './cible';
import {
  describeDynamic,
  describePlace,
  dynamicSignature,
  type SceneVolume,
} from './lieu/description';
import { type TileStats, TiledPlace } from './lieu/grand-lieu';
import { type ModelSource, PlaceScene } from './lieu/lieu';
import { TILE_SETTINGS, type SurfaceKind } from './lieu/reglages-tuiles';
import { Daylight, nightShare } from './lumiere';
import { DEFAULT_GRAPHICS_OPTIONS, type GraphicsOptions } from './options';
import { QualityGovernor, sizeSettingsOf, type RenderProfile } from './options-graphiques';
import { type DisplaySurface, renderPixelSize, usefulResolutionSteps } from './qualite';
import { RENDER_SETTINGS } from './reglages';
import { TRIP_SETTINGS } from './voyage/reglages';
import { TripScene } from './voyage/scene';
import { createTripFrame, tripFrame, type TripActor } from './voyage/sequence';

export interface RenderOptions {
  readonly canvas: HTMLCanvasElement;
  readonly view: GameView;
  /** Couleurs des deux joueurs (profils Duo), dans l'ordre des personnages 0 et 1. */
  readonly playerColors: readonly [string, string];
  /** Options graphiques de la machine au départ (Auto par défaut). */
  readonly graphics?: GraphicsOptions;
  /** Animations réduites (réglage de Duo ou de l'ordinateur): ni rebond ni brillance qui passe. */
  readonly reducedMotion?: boolean;
  /** Modèles livrés; sans eux, tout s'affiche en formes provisoires. */
  readonly models?: ModelSource;
  /** Couche des personnages (lot L6); par défaut, les bonshommes provisoires. */
  readonly characters?: CharacterLayerFactory;
  /** Volumes ajoutés à un lieu par l'appelant (page de démonstration), par identifiant de lieu. */
  readonly extras?: (placeId: string) => readonly SceneVolume[];
  /** Prévenu quand le filet de sécurité baisse la qualité d'un cran. */
  readonly onReduced?: (options: GraphicsOptions) => void;
}

/** Compteurs d'une image, pour la mesure et le contrôle de fuite. */
export interface RenderStats {
  readonly place: string | null;
  /** Appels de dessin et triangles de la dernière image, passe d'ombre comprise. */
  readonly calls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
  readonly volumes: number;
  readonly standIns: number;
  readonly fading: number;
  /** Taille du tampon de rendu (pixels) et ombres actives. */
  readonly width: number;
  readonly height: number;
  readonly shadows: boolean;
  /** Moyenne glissante de la durée d'une image (ms). */
  readonly frameMs: number;
  /** Grand lieu rendu par tuiles (ADR 0022): compteurs par tuile et au total, `null` sinon. */
  readonly tiles: TileStats | null;
}

export interface GameRenderer {
  /**
   * Une image: `dt` secondes depuis la précédente, `alpha` l'avancement entre deux pas
   * (`FrameInfo` de la boucle du SDK). Le moteur dessine `view.frame(alpha)`.
   */
  frame(dt: number, alpha?: number): void;
  /** Lieu construit et affiché (`null`: aucun), pour annoncer `place_loaded` à l'hôte. */
  placeId(): string | null;
  /**
   * Commandes de caméra, à donner à chaque pas ou à chaque image: `turn` et `zoom` sont tenues
   * (la dernière valeur compte), `dragPixels` et `wheel` s'ajoutent jusqu'à la prochaine image.
   */
  pushCameraInput(input: CameraInput): void;
  /** Lacet affiché de la caméra (radians, 0: l'écran regarde au nord, sens horaire). */
  cameraYaw(): number;
  /**
   * Déplacement relatif à l'écran vers le repère de la carte: `right` et `up` de -1 à 1. Le
   * résultat se donne tel quel à `StepInput.moveX` et `moveY`.
   */
  moveToWorld(right: number, up: number): { x: number; y: number };
  /**
   * Position du monde (x vers l'est, y vers le sud, `height` en mètres au-dessus du sol) vers les
   * pixels CSS de la fenêtre, pour accrocher l'interface à un objet. `null` hors du champ. Valable
   * après `frame`. Le résultat est réutilisé d'un appel à l'autre: à lire tout de suite.
   */
  projectToScreen(x: number, y: number, height?: number): { x: number; y: number } | null;
  /** Cadrage imposé (démonstration, captures): lacet en degrés, largeur de vue en mètres. */
  setCamera(yawDeg: number, width: number): void;
  /**
   * Vue haute de contrôle (démonstration, mesure): largeur en mètres, vue plongeante; le
   * chargement des tuiles suit toujours la vue de jeu. `null`: retour à la vue de jeu.
   */
  setOverview(width: number | null): void;
  /** Ce qu'on entend sous ses pas en (x, y) dans un grand lieu (son des pas), `null` sinon. */
  surfaceAt(x: number, y: number): SurfaceKind | null;
  graphics(): GraphicsOptions;
  setGraphics(options: GraphicsOptions): void;
  stats(): RenderStats;
  dispose(): void;
}

function toneMappingOf(name: (typeof RENDER_SETTINGS.renderer)['toneMapping']): ToneMapping {
  switch (name) {
    case 'neutral':
      return NeutralToneMapping;
    case 'agx':
      return AgXToneMapping;
    case 'aces':
      return ACESFilmicToneMapping;
  }
}

/** WebGL2 disponible ? Essai sur un canevas à part: celui du jeu reste libre pour le repli en 2D. */
export function webglAvailable(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (gl === null) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

type Mutable<T> = { -readonly [K in keyof T]-?: T[K] };

/**
 * Le monde vu par la couche des personnages pendant le trajet: les deux joueurs aux places de la
 * scène du train (corps réécrits à chaque image), sans meuble ni habitant autour d'eux.
 */
interface TripCast {
  readonly world: ReadonlyWorld;
  readonly place: DeepReadonly<PlaceState>;
  readonly bodies: readonly [Body, Body];
  /** Où était chacun à l'image précédente: un changement le pose d'un coup (montée, descente). */
  readonly where: [TripActor['where'] | null, TripActor['where'] | null];
}

const PLAYER_INDICES = [0, 1] as const;

function tripCast(world: ReadonlyWorld, place: DeepReadonly<PlaceState>): TripCast {
  const bodies: [Body, Body] = [
    { x: 0, y: 0, facing: 0, speed: 0 },
    { x: 0, y: 0, facing: 0, speed: 0 },
  ];
  const [a, b] = world.players;
  return {
    world: {
      ...world,
      players: [
        { ...a, body: bodies[0], gesture: null, talk: null },
        { ...b, body: bodies[1], gesture: null, talk: null },
      ],
    },
    place: { ...place, objects: {}, villagers: {} },
    bodies,
    where: [null, null],
  };
}

class Engine implements GameRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera();
  private readonly rig = new CameraRig();
  private readonly daylight: Daylight;
  private readonly highlight: TargetHighlight;
  private readonly characters: CharacterLayer;
  private readonly governor: QualityGovernor;
  private readonly groundMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
  });
  private readonly standInMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
  });
  private readonly tableMaterial = new MeshStandardMaterial({ roughness: 1 });
  private readonly table: Mesh;
  private place: PlaceScene | null = null;
  private tiled: TiledPlace | null = null;
  private readonly fog = new Fog(0x000000, 1e4, 2e4);
  private overview: number | null = null;
  private signature = Number.NaN;
  private resolutionStep = 0;
  private adaptiveLight = false;
  private surface: DisplaySurface = {
    cssWidth: 1,
    cssHeight: 1,
    devicePixelRatio: 1,
    devicePixels: null,
  };
  private bufferWidth = 0;
  private bufferHeight = 0;
  private aspect = 1;
  /** Objets réutilisés d'une image à l'autre: aucune allocation dans `frame`. */
  private readonly input: Mutable<CameraInput> = { turn: 0, zoom: 0, dragPixels: 0, wheel: 0 };
  private readonly target = { x: 0, y: 0, speed: 0, facing: 0 };
  private readonly projected = new Vector3();
  private readonly screenPoint = { x: 0, y: 0 };
  private readonly resolveAim = (id: string): Aimable | null =>
    this.place?.aimable(id) ?? this.characters.aimable(id);
  private frameMs = 0;
  private readonly subjects: { x: number; y: number; z: number }[] = [{ x: 0, y: 0, z: 0 }];
  private readonly toCamera = { x: 0, y: 1, z: 0 };
  private readonly background = new Color();
  /** Temps restant du fondu de sommeil (s), 0: aucun. */
  private sleepFade = 0;
  /** Scène du trajet, construite à l'entrée dans le train et libérée à l'arrivée. */
  private trip: TripScene | null = null;
  private tripCast: TripCast | null = null;
  /** Temps de la scène affiché (s): suit celui de l'état, sans à-coups chez l'invité. */
  private tripClock = 0;
  private readonly tripFrame = createTripFrame();
  private readonly tripPose: Mutable<CameraPose> = { x: 0, y: 0, yaw: 0, pitch: 0, width: 1 };
  /** Temps restant du fondu d'entrée ou de sortie de la scène du trajet (s). */
  private cutFade = 0;
  private readonly offEvent: () => void;
  private disposed = false;

  constructor(private readonly options: RenderOptions) {
    const settings = RENDER_SETTINGS.renderer;
    this.renderer = new WebGLRenderer({
      canvas: options.canvas,
      antialias: settings.antialias,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = toneMappingOf(settings.toneMapping);
    this.renderer.toneMappingExposure = settings.exposure;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.scene.background = this.background;
    // Brume toujours présente (un seul jeu de programmes), sans effet hors des grands lieux.
    this.scene.fog = this.fog;

    const half = RENDER_SETTINGS.ground.tableHalfSize;
    this.table = new Mesh(
      new PlaneGeometry(half * 2, half * 2).rotateX(-Math.PI / 2),
      this.tableMaterial,
    );
    this.table.position.y = -RENDER_SETTINGS.ground.thickness;
    this.table.receiveShadow = true;
    this.scene.add(this.table);

    this.daylight = new Daylight(this.scene);
    this.highlight = new TargetHighlight(options.reducedMotion ?? false);
    this.characters = (options.characters ?? createStandInCharacters)({
      root: this.scene,
      playerColors: options.playerColors,
    });
    this.governor = new QualityGovernor(options.graphics ?? DEFAULT_GRAPHICS_OPTIONS, () =>
      usefulResolutionSteps(
        this.surface,
        RENDER_SETTINGS.dynamicResolution.steps,
        sizeSettingsOf(this.governor.currentProfile().resolution),
      ),
    );
    this.applyProfile(this.governor.currentProfile());
    this.offEvent = options.view.onEvent((event) => {
      if (event.type === 'unstuck') this.characters.snap(event.player);
      else if (event.type === 'day_started' && event.slept)
        this.sleepFade = RENDER_SETTINGS.sleepFade.seconds;
    });
  }

  /** Exposition du fondu de sommeil: 1 hors fondu, descend à 0, tient, puis remonte. */
  private fadeExposure(dt: number): number {
    if (this.sleepFade <= 0) return 1;
    this.sleepFade = Math.max(0, this.sleepFade - dt);
    const { seconds, holdPart } = RENDER_SETTINGS.sleepFade;
    const progress = 1 - this.sleepFade / seconds;
    const ramp = (1 - holdPart) / 2;
    if (progress < ramp) return 1 - progress / ramp;
    if (progress < ramp + holdPart) return 0;
    return (progress - ramp - holdPart) / ramp;
  }

  /** Exposition du fondu d'entrée et de sortie du train: remonte du noir en `fadeSeconds`. */
  private cutExposure(dt: number): number {
    if (this.cutFade <= 0) return 1;
    this.cutFade = Math.max(0, this.cutFade - dt);
    return 1 - this.cutFade / TRIP_SETTINGS.fadeSeconds;
  }

  /**
   * Une image du trajet: le lieu d'arrivée se construit derrière (il est caché), le train et les
   * deux personnages se dessinent à sa place. Tout se déduit du temps de la scène (`tripSeconds`):
   * l'hôte et l'invité voient la même chose.
   */
  private drawTrip(dt: number, alpha: number, world: ReadonlyWorld): boolean {
    const state = world.places[world.common.place];
    if (this.trip === null) {
      if (state === undefined) return false;
      this.trip = new TripScene(this.standInMaterial);
      this.scene.add(this.trip.root);
      this.tripCast = tripCast(world, state);
      this.tripClock = tripSeconds({ world });
      this.characters.reset();
      this.highlight.release();
      this.cutFade = TRIP_SETTINGS.fadeSeconds;
    }
    const cast = this.tripCast;
    if (cast === null) return false;
    if (this.place !== null) this.place.root.visible = false;
    this.table.visible = false;
    this.trip.root.visible = true;

    // Horloge de la scène: elle avance à l'image et se recale doucement sur celle de l'état.
    const wanted = tripSeconds({ world }) + alpha / SIM_HZ;
    this.tripClock += dt;
    const gap = wanted - this.tripClock;
    if (Math.abs(gap) > 0.3) this.tripClock = wanted;
    else this.tripClock += gap * 0.1;
    const frame = tripFrame(
      this.tripClock,
      this.options.view.content.settings.travel.minSeconds,
      this.tripFrame,
    );
    this.trip.apply(frame, this.tripClock);
    for (const index of PLAYER_INDICES) {
      const actor = frame.players[index];
      const body = cast.bodies[index];
      body.x = actor.x;
      body.y = actor.y;
      body.facing = actor.facing;
      body.speed = actor.speed;
      if (cast.where[index] !== actor.where) this.characters.snap(index);
      cast.where[index] = actor.where;
    }
    const c = TRIP_SETTINGS.camera;
    const pose = this.tripPose;
    pose.x = c.x;
    pose.y = c.y;
    pose.yaw = (c.yawDeg * Math.PI) / 180;
    pose.pitch = (c.pitchDeg * Math.PI) / 180;
    pose.width = frame.cameraWidth;
    this.characters.update({ dt, world: cast.world, place: cast.place, cameraYaw: pose.yaw });
    this.poseCamera(pose);
    this.highlight.update(dt, null, this.resolveAim);
    this.daylight.update(world.minutes, pose.x, pose.y, viewRadius(pose, this.aspect));
    this.background.copy(this.daylight.tableColor);
    this.renderer.render(this.scene, this.camera);
    this.measure(dt);
    return true;
  }

  /** Arrivée: le train disparaît, le lieu revient, les personnages se posent au quai d'arrivée. */
  private endTrip(): void {
    if (this.trip === null) return;
    this.trip.dispose();
    this.trip = null;
    this.tripCast = null;
    if (this.place !== null) this.place.root.visible = true;
    this.characters.reset();
    this.cutFade = TRIP_SETTINGS.fadeSeconds;
  }

  private applyProfile(profile: RenderProfile): void {
    const shadows = profile.shadows.enabled && !this.adaptiveLight;
    this.renderer.shadowMap.enabled = shadows;
    this.daylight.setShadows(shadows, profile.shadows.mapSize);
    // La taille du tampon est recalculée à la prochaine image.
    this.bufferWidth = 0;
  }

  private resize(): void {
    const canvas = this.options.canvas;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    const ratio = window.devicePixelRatio;
    if (
      this.bufferWidth !== 0 &&
      cssWidth === this.surface.cssWidth &&
      cssHeight === this.surface.cssHeight &&
      ratio === this.surface.devicePixelRatio
    )
      return;
    this.surface = { cssWidth, cssHeight, devicePixelRatio: ratio, devicePixels: null };
    const profile = this.governor.currentProfile();
    const steps = RENDER_SETTINGS.dynamicResolution.steps;
    const scale = profile.resolution.scale * (steps[this.resolutionStep] ?? 1);
    const size = renderPixelSize(this.surface, scale, false, sizeSettingsOf(profile.resolution));
    this.bufferWidth = size.width;
    this.bufferHeight = size.height;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size.width, size.height, false);
    this.aspect = Math.max(1, cssWidth) / Math.max(1, cssHeight);
  }

  private loadPlace(id: string): void {
    this.highlight.release();
    this.place?.dispose();
    this.place = null;
    this.tiled?.dispose();
    this.tiled = null;
    this.signature = Number.NaN;
    const content = this.options.view.content;
    const place = content.places[id];
    if (place === undefined) return;
    // Grand lieu (carte à terrain): sol, décor et bâtiments par tuiles; ses zones pleines ne
    // deviennent pas des dalles (haies, berges, murs les montrent déjà).
    const tiled = place.map.terrain !== undefined;
    const source = tiled ? { ...place, map: { ...place.map, blocked: [] } } : place;
    const description = describePlace(content, source, this.options.extras?.(id) ?? []);
    this.place = new PlaceScene(
      description,
      { ground: this.groundMaterial, standIn: this.standInMaterial },
      this.options.models ?? null,
      !tiled,
    );
    this.scene.add(this.place.root);
    if (tiled) {
      this.tiled = new TiledPlace(place.map);
      this.scene.add(this.tiled.root);
    }
    this.characters.reset();
    this.rig.detach();
  }

  private poseCamera(pose: CameraPose): void {
    const s = RENDER_SETTINGS.camera;
    const dir = towardCamera(pose);
    this.toCamera.x = dir.x;
    this.toCamera.y = dir.y;
    this.toCamera.z = dir.z;
    const halfWidth = pose.width / 2;
    const halfHeight = halfWidth / this.aspect;
    const camera = this.camera;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.near = s.near;
    camera.far = s.far;
    camera.position.set(
      pose.x + dir.x * s.distance,
      s.focusHeight + dir.y * s.distance,
      pose.y + dir.z * s.distance,
    );
    camera.lookAt(pose.x, s.focusHeight, pose.y);
    camera.updateProjectionMatrix();
  }

  frame(dt: number, alpha = 0): void {
    if (this.disposed) return;
    this.resize();
    const view = this.options.view;
    // L'état à dessiner (chez l'invité: les autres interpolés, soi-même prédit), pas l'état logique.
    const world = view.frame(alpha);
    this.renderer.toneMappingExposure =
      RENDER_SETTINGS.renderer.exposure * this.fadeExposure(dt) * this.cutExposure(dt);
    const placeId = world?.common.place ?? null;
    if (placeId !== (this.place?.description.id ?? null)) {
      if (placeId === null) {
        this.place?.dispose();
        this.place = null;
        this.tiled?.dispose();
        this.tiled = null;
      } else this.loadPlace(placeId);
    }
    // Dans le train: la scène du trajet à la place du lieu (qui se construit derrière).
    const travelling =
      world?.common.phase === 'travel' && (world.common.travel?.since ?? null) !== null;
    if (world !== null && travelling && this.drawTrip(dt, alpha, world)) return;
    this.endTrip();
    const place = this.place;
    const state = world === null || placeId === null ? undefined : world.places[placeId];
    if (world === null || place === null || state === undefined) {
      this.background.set(RENDER_SETTINGS.lightKeys[0]?.tableColor ?? '#000000');
      this.table.visible = false;
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.table.visible = true;

    const signature = dynamicSignature(state);
    if (signature !== this.signature) {
      this.signature = signature;
      this.highlight.release();
      place.setDynamic(describeDynamic(view.content, state));
    }

    this.characters.update({ dt, world, place: state, cameraYaw: this.rig.yawAngle() });

    const local = view.localIndex() ?? 0;
    const body = world.players[local].body;
    const shown = this.characters.playerPosition(local) ?? body;
    this.target.x = shown.x;
    this.target.y = shown.y;
    this.target.speed = body.speed;
    this.target.facing = body.facing;
    this.rig.update(dt, this.input, this.target, place.description);
    this.input.dragPixels = 0;
    this.input.wheel = 0;
    const pose = this.rig.pose();
    this.poseCamera(pose);

    const subject = this.subjects[0];
    if (subject !== undefined) {
      subject.x = shown.x;
      subject.y = 0;
      subject.z = shown.y;
    }
    place.applyOcclusion(place.occlusion.update(dt, this.subjects, this.toCamera));
    const radius = viewRadius(pose, this.aspect);
    this.tiled?.update(
      dt,
      shown.x,
      shown.y,
      radius,
      nightShare(world.minutes, RENDER_SETTINGS.lightKeys),
      this.subjects,
      this.toCamera,
    );
    this.updateFog(pose.width);
    if (this.overview !== null) this.poseOverview(pose.x, pose.y, this.overview);

    this.highlight.update(dt, view.aim(local)?.id ?? null, this.resolveAim);

    this.daylight.update(world.minutes, pose.x, pose.y, radius);
    this.background.copy(this.daylight.tableColor);
    this.fog.color.copy(this.daylight.tableColor);
    this.tableMaterial.color.copy(this.daylight.tableColor);

    this.renderer.render(this.scene, this.camera);
    this.measure(dt);
  }

  /**
   * Brume légère au bord du champ d'un grand lieu: elle commence un peu avant le haut de l'écran
   * (profondeur comptée le long de l'axe de vue de la caméra orthographique).
   */
  private poseOverview(x: number, y: number, width: number): void {
    const camera = this.camera;
    const half = width / 2;
    camera.left = -half;
    camera.right = half;
    camera.top = half / this.aspect;
    camera.bottom = -half / this.aspect;
    camera.far = 2000;
    camera.position.set(x, 300, y + 120);
    camera.lookAt(x, 0, y);
    camera.updateProjectionMatrix();
  }

  private updateFog(width: number): void {
    if (this.tiled === null || this.overview !== null) {
      this.fog.near = 1e4;
      this.fog.far = 2e4;
      return;
    }
    const s = RENDER_SETTINGS.camera;
    const halfHeight = width / 2 / this.aspect;
    // Le sol au bord haut de l'écran est plus loin que le point visé d'environ 1,4 demi-hauteur.
    const reach = halfHeight / Math.tan((s.pitchFarDeg * Math.PI) / 180);
    this.fog.near = s.distance + reach * TILE_SETTINGS.fog.start;
    this.fog.far = s.distance + reach * TILE_SETTINGS.fog.end;
  }

  private measure(dt: number): void {
    const ms = dt * 1000;
    this.frameMs = this.frameMs === 0 ? ms : this.frameMs + (ms - this.frameMs) * 0.05;
    const change = this.governor.sample(dt);
    if (change === null) return;
    if (change.kind === 'reduced') {
      this.applyProfile(this.governor.currentProfile());
      this.options.onReduced?.(change.options);
      return;
    }
    switch (change.change.kind) {
      case 'step':
        this.resolutionStep = change.change.step;
        break;
      case 'light':
        this.adaptiveLight = true;
        break;
      case 'normal':
        this.adaptiveLight = false;
        break;
    }
    this.applyProfile(this.governor.currentProfile());
  }

  pushCameraInput(input: CameraInput): void {
    this.input.turn = input.turn ?? 0;
    this.input.zoom = input.zoom ?? 0;
    this.input.dragPixels += input.dragPixels ?? 0;
    this.input.wheel += input.wheel ?? 0;
  }

  placeId(): string | null {
    return this.place?.description.id ?? null;
  }

  cameraYaw(): number {
    return this.rig.yawAngle();
  }

  projectToScreen(x: number, y: number, height = 0): { x: number; y: number } | null {
    const point = this.projected.set(x, height, y);
    this.camera.updateMatrixWorld();
    point.project(this.camera);
    if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || point.z > 1) return null;
    const canvas = this.options.canvas;
    const rect = canvas.getBoundingClientRect();
    this.screenPoint.x = rect.left + ((point.x + 1) / 2) * rect.width;
    this.screenPoint.y = rect.top + ((1 - point.y) / 2) * rect.height;
    return this.screenPoint;
  }

  moveToWorld(right: number, up: number): { x: number; y: number } {
    return screenToWorld(this.rig.yawAngle(), right, up);
  }

  setCamera(yawDeg: number, width: number): void {
    this.rig.set(yawDeg, width);
  }

  setOverview(width: number | null): void {
    this.overview = width;
  }

  surfaceAt(x: number, y: number): SurfaceKind | null {
    return this.tiled?.surfaceAt(x, y) ?? null;
  }

  graphics(): GraphicsOptions {
    return this.governor.current();
  }

  setGraphics(options: GraphicsOptions): void {
    this.resolutionStep = 0;
    this.adaptiveLight = false;
    this.applyProfile(this.governor.set(options));
  }

  stats(): RenderStats {
    const info = this.renderer.info;
    const counts = this.place?.counts() ?? { volumes: 0, standIns: 0, fading: 0 };
    return {
      place: this.place?.description.id ?? null,
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      ...counts,
      width: this.bufferWidth,
      height: this.bufferHeight,
      shadows: this.renderer.shadowMap.enabled,
      frameMs: this.frameMs,
      tiles: this.tiled?.stats() ?? null,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.offEvent();
    this.highlight.dispose();
    this.trip?.dispose();
    this.trip = null;
    this.place?.dispose();
    this.place = null;
    this.tiled?.dispose();
    this.tiled = null;
    this.characters.dispose();
    this.daylight.dispose();
    this.table.geometry.dispose();
    this.table.removeFromParent();
    this.groundMaterial.dispose();
    this.standInMaterial.dispose();
    this.tableMaterial.dispose();
    this.renderer.dispose();
  }
}

/**
 * Crée le rendu 3D sur le canevas du jeu. Rend `null` si WebGL2 manque: le canevas n'a pas été
 * touché, l'appelant peut y dessiner son écran de repli.
 */
export function createRenderer(options: RenderOptions): GameRenderer | null {
  if (!webglAvailable()) return null;
  try {
    return new Engine(options);
  } catch {
    return null;
  }
}
