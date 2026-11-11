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
  type Material,
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
import type { Content, PlaceContent } from '../donnees/charger';
import type { Body } from '../etat/joueur';
import type { PlaceState } from '../etat/lieu';
import type { DeepReadonly, ReadonlyWorld } from '../etat/monde';
import type { GameView } from '../session';
import { SIM_HZ } from '../simulation/noyau/constantes';
import { seasonOf } from '../simulation/outils/saison';
import { tripSeconds } from '../simulation/voyage/index';
import {
  type CharacterLayer,
  type CharacterLayerFactory,
  createStandInCharacters,
} from './bonshommes';
import {
  type CameraInput,
  type CameraPose,
  type CameraSettings,
  type MapBounds,
  CameraRig,
  screenToWorld,
  towardCamera,
  viewRadius,
} from './camera';
import { type Aimable, TargetHighlight } from './cible';
import { jumped, PassageFade } from './passage';
import {
  INK_SETTINGS,
  InkKit,
  inkContext,
  type InkFrame,
  type InkLights,
  inkTag,
  KIND,
  LAYER,
  type RenderStyle,
} from './encre/index';
import { type LampHost, placeLights } from './encre/lumieres';
import {
  describeDynamic,
  describePlace,
  dynamicSignature,
  footprint,
  type SceneVolume,
} from './lieu/description';
import type { BuildingSource } from './lieu/batiments';
import { Spaces } from './lieu/espaces';
import {
  type BuildingLight,
  buildingFinder,
  buildingLights,
  gameLightSheets,
} from './lieu/eclairage';
import { type TileStats, TiledPlace } from './lieu/grand-lieu';
import { type ModelSource, PlaceScene } from './lieu/lieu';
import { mapSignature, mapStates } from './lieu/presents';
import {
  fenceVolumes,
  fieldVolumes,
  harvestSignature,
  markerVolumes,
  placeStates,
} from './lieu/recoltes';
import { fenceRuns, placeGroundField } from './lieu/terrain-rendu';
import { ROOM_SETTINGS } from './lieu/reglages-pieces';
import { RELIEF_SETTINGS } from './lieu/reglages-relief';
import { TrainLayer, type TrainStats } from './lieu/trains';
import type { TilePlants } from './lieu/tuile';
import { TILE_SETTINGS, type SurfaceKind } from './lieu/reglages-tuiles';
import { Daylight, nightShare } from './lumiere';
import { DEFAULT_GRAPHICS_OPTIONS, type GraphicsOptions } from './options';
import { QualityGovernor, sizeSettingsOf, type RenderProfile } from './options-graphiques';
import { type DisplaySurface, renderPixelSize, usefulResolutionSteps } from './qualite';
import { closedViewWidth, floorExtent } from './cadrage';
import { RENDER_SETTINGS } from './reglages';
import { TRIP_SETTINGS } from './voyage/reglages';
import { TripScene } from './voyage/scene';
import { createTripFrame, tripFrame, type TripActor } from './voyage/sequence';

export interface RenderOptions {
  readonly canvas: HTMLCanvasElement;
  readonly view: GameView;
  /** Couleurs des deux joueurs (profils Duo), dans l'ordre des personnages 0 et 1. */
  readonly playerColors: readonly [string, string];
  /**
   * Style du rendu (ADR 0023): `encre` par défaut; `aplats` garde l'ancien rendu le temps de la
   * transition.
   */
  readonly style?: RenderStyle;
  /** Options graphiques de la machine au départ (Auto par défaut). */
  readonly graphics?: GraphicsOptions;
  /** Animations réduites (réglage de Duo ou de l'ordinateur): ni rebond ni brillance qui passe. */
  readonly reducedMotion?: boolean;
  /** Modèles livrés; sans eux, tout s'affiche en formes provisoires. */
  readonly models?: ModelSource;
  /** Bâtiments livrés des lieux (rendu encré); sans eux, les volumes provisoires. */
  readonly buildings?: BuildingSource;
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
  readonly style: RenderStyle;
  /** Mémoire vidéo ajoutée par le rendu encré (octets): couches, ombres, cibles; 0 en aplats. */
  readonly inkTextureBytes: number;
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
  /** Trains des événements à l'écran (`lieu/trains.ts`), `null` dans un lieu sans train. */
  readonly trains: TrainStats | null;
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

/** Coordonnée d'écran (points CSS) de ce qui ne doit pas se voir pendant un passage. */
const OFF_SCREEN = -100_000;

interface LastBody {
  x: number;
  y: number;
  known: boolean;
}

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
  private readonly rig: CameraRig;
  private readonly cameraSettings: CameraSettings;
  /** Rendu encré (ADR 0023), `null` dans l'ancien rendu en aplats. */
  private readonly ink: InkKit | null;
  private lights: InkLights | null = null;
  /** La vue a été cadrée sur un petit lieu clos (`frameClosedPlace`). */
  private framed = false;
  /** Bâtiments éclairés de l'intérieur: recalculés quand la minute du jeu change. */
  private litBuildings: ReadonlyMap<string, BuildingLight> = new Map();
  private litMinute = Number.NaN;
  private litFinder: ((x: number, y: number) => string | null) | null = null;
  private lampHosts: readonly LampHost[] = [];
  private indoor = false;
  private readonly daylight: Daylight;
  private readonly highlight: TargetHighlight;
  private readonly characters: CharacterLayer;
  private readonly governor: QualityGovernor;
  private readonly groundMaterial: Material;
  private readonly standInMaterial: Material;
  private readonly tableMaterial: Material;
  private readonly tableColor: Color | null;
  private readonly table: Mesh;
  private place: PlaceScene | null = null;
  private tiled: TiledPlace | null = null;
  /** Trains des événements du lieu (grand lieu dont un événement amène un train), `null` sinon. */
  private trains: TrainLayer | null = null;
  private readonly fog = new Fog(0x000000, 1e4, 2e4);
  private overview: number | null = null;
  private signature = Number.NaN;
  /** Empreinte de ce que montrent les récoltables (`recoltes.ts`), lue à chaque image. */
  private harvested = Number.NaN;
  /** Empreinte des meubles absents et des portes fermées (`presents.ts`), lue à chaque image. */
  private mapped = Number.NaN;
  /** Contenu et monde de l'image, relus par les récoltables (gardé: aucune allocation par image). */
  private harvestLook: { content: Content; world: ReadonlyWorld } | null = null;
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
  /** Hauteur du sol affiché sous un point de la carte (relief d'un grand lieu), 0 ailleurs. */
  private readonly groundAt = (x: number, y: number): number => this.tiled?.heightAt(x, y) ?? 0;
  private readonly resolveAim = (id: string): Aimable | null =>
    this.place?.aimable(id) ?? this.characters.aimable(id);
  private frameMs = 0;
  private readonly subjects: { x: number; y: number; z: number }[] = [{ x: 0, y: 0, z: 0 }];
  private readonly toCamera = { x: 0, y: 1, z: 0 };
  private readonly background = new Color();
  /** Exposition des fondus au noir (sommeil, train), de 0 à 1. */
  private fade = 1;
  private readonly inkFrame: Mutable<InkFrame> = {
    dt: 0,
    minutes: 0,
    sheet: null,
    weather: null,
    indoor: false,
    place: null,
    focusX: 0,
    focusZ: 0,
    viewRadius: 1,
    toCamera: this.toCamera,
    lights: null,
    exposure: 1,
    width: 1,
    height: 1,
    backdrop: null,
    room: false,
    blind: false,
  };
  /** Temps restant du fondu de sommeil (s), 0: aucun. */
  private sleepFade = 0;
  /** Espaces du lieu (le dehors et ses pièces), `null` pour un lieu sans pièce. */
  private spaces: Spaces | null = null;
  /** Espace dessiné: la pièce du joueur local, `null` dehors; `undefined`: pas encore posé. */
  private room: string | null | undefined = undefined;
  private bounds: MapBounds = { width: 1, height: 1 };
  /** Fondu des passages de porte: le joueur local déplacé d'un coup. */
  private readonly passage = new PassageFade();
  /** Position de chaque joueur à l'image passée, pour reconnaître un déplacement d'un coup. */
  private readonly lastBodies: readonly [LastBody, LastBody] = [
    { x: 0, y: 0, known: false },
    { x: 0, y: 0, known: false },
  ];
  /** Joueur caché pour cette image: l'autre, en plein passage (ni à la porte ni arrivé). */
  private readonly hidden: [boolean, boolean] = [false, false];
  /** Ce que montrait la dernière image, redessiné tel quel pendant que le noir tombe. */
  private readonly held = { x: 0, y: 0, radius: 1, valid: false };
  /** Vrai pendant ces images retenues: l'état est déjà ailleurs, rien ne s'accroche à l'écran. */
  private holding = false;
  private readonly visibleAt = (x: number, y: number): boolean =>
    this.spaces === null || this.spaces.at(x, y) === (this.room ?? null);
  private readonly volumeShown = (volume: SceneVolume): boolean =>
    this.spaces === null || this.spaces.shows(this.room ?? null, volume.x, volume.y);
  /** Scène du trajet, construite à l'entrée dans le train et libérée à l'arrivée. */
  private trip: TripScene | null = null;
  private tripCast: TripCast | null = null;
  /** Temps de la scène affiché (s): suit celui de l'état, sans à-coups chez l'invité. */
  private tripClock = 0;
  private readonly tripFrame = createTripFrame();
  private readonly tripLights: { lamps: InkLights['lamps']; windows: InkLights['windows'] } = {
    lamps: [],
    windows: [],
  };
  private readonly tripPose: Mutable<CameraPose> = { x: 0, y: 0, yaw: 0, pitch: 0, width: 1 };
  /** Temps restant du fondu d'entrée ou de sortie de la scène du trajet (s). */
  private cutFade = 0;
  private readonly offEvent: () => void;
  private disposed = false;

  constructor(private readonly options: RenderOptions) {
    const settings = RENDER_SETTINGS.renderer;
    const style = options.style ?? INK_SETTINGS.style;
    this.renderer = new WebGLRenderer({
      canvas: options.canvas,
      ...(style === 'encre' ? { context: inkContext(options.canvas) } : {}),
      // En encre, seul un triangle plein écran atteint le canevas (ADR 0023): l'anticrénelage du
      // canevas n'y lisse rien et coûte sa mémoire et sa résolution à chaque image.
      antialias: settings.antialias && style !== 'encre',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = toneMappingOf(settings.toneMapping);
    this.renderer.toneMappingExposure = settings.exposure;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.ink =
      style === 'encre'
        ? new InkKit(undefined, { reducedMotion: options.reducedMotion ?? false })
        : null;
    this.cameraSettings =
      this.ink === null
        ? RENDER_SETTINGS.camera
        : { ...RENDER_SETTINGS.camera, ...INK_SETTINGS.camera };
    this.rig = new CameraRig(this.cameraSettings);
    if (this.ink === null) {
      this.groundMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
      this.standInMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
      const table = new MeshStandardMaterial({ roughness: 1 });
      this.tableMaterial = table;
      this.tableColor = table.color;
    } else {
      // Un seul matériau pour le sol, les formes provisoires et la table: un seul programme.
      this.groundMaterial = this.ink.volume;
      this.standInMaterial = this.ink.volume;
      this.tableMaterial = this.ink.volume;
      this.tableColor = null;
      this.scene.add(this.ink.air);
    }
    this.scene.background = this.background;
    // Brume toujours présente (un seul jeu de programmes), sans effet hors des grands lieux.
    this.scene.fog = this.fog;

    const half = RENDER_SETTINGS.ground.tableHalfSize;
    const tableGeometry = new PlaneGeometry(half * 2, half * 2).rotateX(-Math.PI / 2);
    // En encre, la table prolonge le sol du lieu (même carte du sol, même herbe).
    if (this.ink !== null) inkTag(tableGeometry, { layer: LAYER.grass, kind: KIND.ground });
    this.table = new Mesh(tableGeometry, this.tableMaterial);
    // En encre la table est le sol hors des tuiles (plancher des pièces compris): à fleur du sol.
    this.table.position.y =
      this.ink === null ? -RENDER_SETTINGS.ground.thickness : -INK_SETTINGS.ground.tableDrop;
    this.table.receiveShadow = true;
    this.scene.add(this.table);

    this.daylight = new Daylight(this.scene);
    this.highlight = new TargetHighlight(
      options.reducedMotion ?? false,
      RENDER_SETTINGS.target,
      this.ink,
    );
    this.characters = (options.characters ?? createStandInCharacters)({
      root: this.scene,
      playerColors: options.playerColors,
      ink: this.ink,
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
      this.trip = new TripScene(
        this.standInMaterial,
        TRIP_SETTINGS,
        this.ink !== null,
        this.options.models ?? null,
      );
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
    if (this.trains !== null) this.trains.root.visible = false;
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
    this.trip.apply(frame);
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
    this.trip.fade(dt, frame.players, this.toCamera);
    this.highlight.update(dt, null, this.resolveAim);
    this.daylight.update(world.minutes, pose.x, pose.y, viewRadius(pose, this.aspect));
    this.background.copy(this.daylight.tableColor);
    this.indoor = false;
    this.forgetPassage();
    // La lampe de l'autorail: ses vitres et sa flaque la nuit, rien d'autre n'éclaire la scène.
    this.tripLights.lamps = this.trip.lamps;
    this.draw(dt, world, pose.x, pose.y, viewRadius(pose, this.aspect), this.tripLights);
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

  /** Arrivée dans un lieu, scène du train: aucun saut à fondre, aucune image à retenir. */
  private forgetPassage(): void {
    this.passage.reset();
    this.held.valid = false;
    this.holding = false;
    for (const last of this.lastBodies) last.known = false;
    this.hidden[0] = false;
    this.hidden[1] = false;
  }

  /** Dessine le dehors ou la seule pièce `room`, et y borne la vue. */
  private showSpace(room: string | null, place: PlaceScene): void {
    this.room = room;
    this.bounds = this.spaces?.bounds(room) ?? place.description;
    place.showWhere(this.spaces === null ? null : this.volumeShown);
    this.tiled?.showRoom(room);
    this.refreshLights(place);
  }

  /**
   * Lampes de l'espace affiché (rendu encré): celles de ses meubles et, dans une pièce, ses
   * appliques. Rien n'éclaire à travers un mur, ni du dehors ni d'une pièce voisine.
   */
  private refreshLights(place: PlaceScene): void {
    if (this.ink === null) return;
    const volumes =
      this.spaces === null ? place.volumes() : [...place.volumes()].filter(this.volumeShown);
    const outdoor = this.tiled !== null && (this.room ?? null) === null;
    this.lights = placeLights(
      volumes,
      this.tiled?.lights(this.room ?? null) ?? null,
      undefined,
      undefined,
      {
        outdoor,
        heightAt: (this.tiled?.relief ?? null) === null ? null : this.groundAt,
        hosts: outdoor ? this.lampHosts : [],
        glassOf: (volume) => place.glassOf(volume),
      },
    );
    // Dehors, les lampes des trains (éteintes tant que leur véhicule n'est pas là) suivent leur caisse.
    if (outdoor && this.trains !== null && this.trains.lamps.length > 0)
      this.lights = {
        lamps: [...this.lights.lamps, ...this.trains.lamps],
        windows: this.lights.windows,
      };
  }

  /**
   * Fenêtres et lanternes de porte selon la vie du lieu (`lieu/eclairage.ts`): la table des
   * bâtiments éclairés est refaite quand la minute du jeu change, le fondu se fait à chaque image.
   */
  private lightBuildings(dt: number, world: ReadonlyWorld, place: PlaceContent | undefined): void {
    const tiled = this.tiled;
    if (tiled === null || this.ink === null || place === undefined) return;
    const minute = Math.floor(world.minutes) + world.common.day * 1440;
    if (minute !== this.litMinute) {
      this.litMinute = minute;
      this.litFinder ??= buildingFinder(place);
      this.litBuildings = buildingLights(
        { content: this.options.view.content, world },
        place,
        gameLightSheets(place.def.id),
        undefined,
        this.litFinder,
      );
    }
    tiled.lightBuildings(this.litBuildings, dt);
    for (const lamp of this.lights?.lamps ?? [])
      if (lamp.follows !== undefined) lamp.share = tiled.buildingShare(lamp.follows);
  }

  /**
   * Suit les déplacements d'un coup (porte, replacement). Rend vrai pour celui du joueur local:
   * le fondu s'en charge. L'autre joueur se pose sans glisser, caché le temps du saut: chez
   * l'invité, sa position est interpolée entre le départ et l'arrivée pendant une image ou deux.
   */
  private trackJumps(world: ReadonlyWorld, local: 0 | 1): boolean {
    let mine = false;
    for (const index of PLAYER_INDICES) {
      const body = world.players[index].body;
      const last = this.lastBodies[index];
      const jump = jumped(last.known ? last : null, body);
      last.x = body.x;
      last.y = body.y;
      last.known = true;
      if (index === local) mine = jump;
      else {
        this.hidden[index] = jump;
        if (jump) this.characters.snap(index);
      }
    }
    this.hidden[local] = false;
    return mine;
  }

  private applyProfile(profile: RenderProfile): void {
    // En encre, les ombres sont celles du rendu encré (un seul niveau): celles de Three.js dorment.
    const shadows = this.ink === null && profile.shadows.enabled && !this.adaptiveLight;
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

  /** La végétation semée des grands lieux en modèles livrés, si la source des décors les fournit. */
  private plants(): TilePlants | null {
    const models = this.options.models;
    if (models?.geometryOf === undefined) return null;
    return { geometryOf: (model) => models.geometryOf?.(model) ?? null };
  }

  private loadPlace(id: string): void {
    this.highlight.release();
    this.place?.dispose();
    this.place = null;
    this.tiled?.dispose();
    this.tiled = null;
    this.trains?.dispose();
    this.trains = null;
    this.signature = Number.NaN;
    this.harvested = Number.NaN;
    this.mapped = Number.NaN;
    this.lights = null;
    this.litMinute = Number.NaN;
    this.litFinder = null;
    this.litBuildings = new Map();
    this.lampHosts = Object.entries(this.options.view.content.places[id]?.map.buildings ?? {}).map(
      ([host, building]) => ({ id: host, ...building.rect }),
    );
    this.spaces = null;
    this.room = undefined;
    this.forgetPassage();
    this.ink?.setGround(null, 1, 1);
    const content = this.options.view.content;
    const place = content.places[id];
    if (place === undefined) return;
    if (place.interiors.length > 0) this.spaces = new Spaces(place.map, place.interiors);
    // Grand lieu (carte à terrain): sol, décor et bâtiments par tuiles; ses zones pleines ne
    // deviennent pas des dalles (haies, berges, murs les montrent déjà).
    const tiled = place.map.terrain !== undefined;
    // Clôtures de la voie en modèles livrés (rendu encré), si la source des décors en a le modèle.
    const fences =
      tiled &&
      this.ink !== null &&
      (this.options.models?.instantiate(TILE_SETTINGS.decor.fenceModel) ?? null) !== null
        ? fenceVolumes(fenceRuns(placeGroundField(place.map, TILE_SETTINGS)))
        : [];
    const description = describePlace(
      content,
      place,
      // Repères des coins de pêche et des zones à insectes: fixes, tirés des données du lieu.
      [...markerVolumes(content, id), ...fences, ...(this.options.extras?.(id) ?? [])],
      undefined,
      !tiled,
    );
    // Le grand lieu d'abord: son relief donne la hauteur du sol à ce qui se pose dessus.
    if (tiled) {
      const buildings = this.options.buildings;
      this.tiled = new TiledPlace(
        place.map,
        TILE_SETTINGS,
        this.ink,
        place.interiors,
        buildings === undefined ? null : { place: id, source: buildings },
        description.volumes
          .filter((volume) => volume.shape === 'box' && volume.model !== null)
          .map((volume) => {
            const size = footprint(volume);
            return {
              x0: volume.x - size.w / 2,
              z0: volume.y - size.h / 2,
              x1: volume.x + size.w / 2,
              z1: volume.y + size.h / 2,
              height: volume.base + volume.height,
            };
          }),
        this.plants(),
        fences.length > 0,
      );
      this.scene.add(this.tiled.root);
    }
    this.place = new PlaceScene(
      description,
      {
        ground: this.groundMaterial,
        standIn: this.standInMaterial,
        ink: this.ink?.volume ?? null,
        outside: place.def.ambience?.outside ?? null,
      },
      this.options.models ?? null,
      !tiled,
      // Meubles et objets se posent sur le sol tel qu'il est affiché (relief d'un grand lieu).
      (this.tiled?.relief ?? null) === null ? null : this.groundAt,
    );
    this.scene.add(this.place.root);
    if (tiled && TrainLayer.wanted(content, id)) {
      this.trains = new TrainLayer(
        place,
        content,
        this.options.models ?? null,
        { standIn: this.standInMaterial, ink: this.ink?.volume ?? null },
        this.groundAt,
      );
      this.scene.add(this.trains.root);
    }
    this.ink?.setGround(
      this.tiled?.groundMap ?? this.place.groundMap,
      place.map.width,
      place.map.height,
      this.tiled?.groundShift ?? null,
      this.tiled?.relief?.edges.steps ?? 1,
    );
    this.characters.reset();
    this.rig.detach();
    this.frameClosedPlace(place.def.ambience?.indoor === true ? place.map : null);
  }

  /**
   * Rendu encré: un petit lieu clos à sol déclaré (le wagon) se cadre à l'arrivée pour remplir
   * `INK_SETTINGS.camera.closedShare` de l'écran; en le quittant, la vue reprend sa largeur de
   * jeu. Le joueur garde le zoom libre ensuite.
   */
  private frameClosedPlace(map: PlaceContent['map'] | null): void {
    if (this.ink === null) return;
    const s = this.cameraSettings;
    const yawDeg = (this.rig.yawAngle() * 180) / Math.PI;
    const extent = map?.floor === undefined ? null : floorExtent(map.floor, map.width, map.height);
    if (extent !== null) {
      const share = INK_SETTINGS.camera.closedShare;
      this.rig.set(
        yawDeg,
        closedViewWidth(extent, this.rig.yawAngle(), share, s.minWidth, s.defaultWidth),
      );
      this.framed = true;
    } else if (this.framed) {
      this.rig.set(yawDeg, s.defaultWidth);
      this.framed = false;
    }
  }

  private poseCamera(pose: CameraPose): void {
    const s = this.cameraSettings;
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
    this.fade = this.fadeExposure(dt) * this.cutExposure(dt);
    this.renderer.toneMappingExposure = RENDER_SETTINGS.renderer.exposure * this.fade;
    const placeId = world?.common.place ?? null;
    if (placeId !== (this.place?.description.id ?? null)) {
      if (placeId === null) {
        this.place?.dispose();
        this.place = null;
        this.tiled?.dispose();
        this.tiled = null;
        this.trains?.dispose();
        this.trains = null;
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
      if (this.ink === null) this.renderer.render(this.scene, this.camera);
      else {
        // Rien à montrer (avant le premier état): le fond, sans la passe encrée.
        this.renderer.setRenderTarget(null);
        this.renderer.setClearColor(this.background, 1);
        this.renderer.clear();
      }
      return;
    }
    this.table.visible = true;

    const signature = dynamicSignature(state);
    const placeContent = view.content.places[place.description.id];
    const look = (this.harvestLook ??= { content: view.content, world });
    look.world = world;
    const harvested = placeContent === undefined ? 0 : harvestSignature(look, placeContent, state);
    const local = view.localIndex() ?? 0;
    const mapped = placeContent === undefined ? 0 : mapSignature(look, placeContent, local);
    if (signature !== this.signature || harvested !== this.harvested || mapped !== this.mapped) {
      this.signature = signature;
      this.harvested = harvested;
      this.mapped = mapped;
      // États des récoltables (souche, buisson cueilli...), cases du potager, meubles que
      // l'histoire n'a pas encore posés et portes qu'elle tient fermées: lus dans l'état déjà
      // transmis, les mêmes chez l'hôte et chez l'invité.
      if (placeContent !== undefined)
        place.setStates(
          mapStates(look, placeContent, local, placeStates(look, placeContent, state)),
        );
      place.setDynamic([
        ...describeDynamic(view.content, state, undefined, placeContent),
        ...(placeContent === undefined ? [] : fieldVolumes(view.content, placeContent, state)),
      ]);
      // Seuls les volumes qui changent sont refaits: la cible garde son liseré, sauf si c'est elle.
      this.highlight.releaseIfDetached();
      this.refreshLights(place);
    }

    const body = world.players[local].body;
    // Passage de porte: l'image d'avant reste et s'éteint, puis tout se pose d'un coup au noir.
    const step = this.passage.update(dt, this.trackJumps(world, local));
    this.fade *= step.exposure;
    this.renderer.toneMappingExposure = RENDER_SETTINGS.renderer.exposure * this.fade;
    this.holding = step.hold && this.held.valid;
    if (this.holding) {
      this.draw(dt, world, this.held.x, this.held.y, this.held.radius, this.lights);
      this.measure(dt);
      return;
    }
    if (step.cut) {
      for (const index of PLAYER_INDICES) this.characters.snap(index);
      this.rig.detach();
    }
    const room = this.spaces?.at(body.x, body.y) ?? null;
    if (room !== this.room) this.showSpace(room, place);
    // En encre la table est le sol du dehors: une pièce a son plancher, et rien autour.
    this.table.visible = room === null;

    this.characters.update({
      dt,
      world,
      place: state,
      cameraYaw: this.rig.yawAngle(),
      visibleAt: this.visibleAt,
      hidden: this.hidden,
      ground: (this.tiled?.relief ?? null) === null ? null : this.groundAt,
    });

    const shown = this.characters.playerPosition(local) ?? body;
    this.target.x = shown.x;
    this.target.y = shown.y;
    this.target.speed = body.speed;
    this.target.facing = body.facing;
    this.rig.update(dt, this.input, this.target, this.bounds);
    this.input.dragPixels = 0;
    this.input.wheel = 0;
    const pose = this.rig.pose();
    this.poseCamera(pose);

    // En encre la table suit la vue: elle lit le sol dans la carte du lieu, où qu'elle soit.
    if (this.ink !== null) {
      this.table.position.x = pose.x;
      this.table.position.z = pose.y;
    }
    const subject = this.subjects[0];
    if (subject !== undefined) {
      subject.x = shown.x;
      // Ses pieds sont sur le sol affiché: un meuble bas le reste aussi sur un sol en relief.
      subject.y = room === null ? this.groundAt(shown.x, shown.y) : 0;
      subject.z = shown.y;
    }
    place.applyOcclusion(place.occlusion.update(dt, this.subjects, this.toCamera));
    const radius = viewRadius(pose, this.aspect);
    this.held.x = pose.x;
    this.held.y = pose.y;
    this.held.radius = radius;
    this.held.valid = true;
    // Dans une pièce, le dehors n'est pas dessiné: ses tuiles restent telles quelles.
    if (room !== null) {
      this.tiled?.viewRoom(this.toCamera);
      if (this.tiled !== null) place.cutDoors(this.toCamera, ROOM_SETTINGS.frontDot);
    } else {
      this.tiled?.update(
        dt,
        shown.x,
        shown.y,
        radius,
        nightShare(world.minutes, RENDER_SETTINGS.lightKeys),
        this.subjects,
        this.toCamera,
      );
      this.lightBuildings(dt, world, placeContent);
    }
    if (this.trains !== null) {
      // Dehors seulement: dans une pièce, rien du dehors n'est dessiné.
      this.trains.root.visible = room === null;
      if (room === null) this.trains.update(dt, world, this.subjects, this.toCamera);
    }
    this.updateFog(pose.width);
    if (this.overview !== null) this.poseOverview(pose.x, pose.y, this.overview);

    this.highlight.update(dt, view.aim(local)?.id ?? null, this.resolveAim);

    this.daylight.update(world.minutes, pose.x, pose.y, radius);
    this.background.copy(this.daylight.tableColor);
    this.fog.color.copy(this.daylight.tableColor);
    this.tableColor?.copy(this.daylight.tableColor);
    const outdoor = this.options.view.content.places[placeId ?? '']?.map.outdoor;
    this.indoor =
      outdoor !== undefined &&
      (shown.x < outdoor.x ||
        shown.y < outdoor.y ||
        shown.x > outdoor.x + outdoor.w ||
        shown.y > outdoor.y + outdoor.h);

    // Sur un sol en relief, la table (le sol hors des tuiles) passe sous les creux: chemins,
    // berges, fond de l'eau. Dans une pièce elle est cachée.
    if (this.ink !== null)
      this.table.position.y =
        (this.tiled?.relief ?? null) === null
          ? -INK_SETTINGS.ground.tableDrop
          : -RELIEF_SETTINGS.tableDrop;

    this.draw(dt, world, pose.x, pose.y, radius, this.lights);
    this.measure(dt);
  }

  /** Dessine l'image: rendu encré (ambiance, ombres, scène, contour) ou ancien rendu direct. */
  private draw(
    dt: number,
    world: ReadonlyWorld,
    focusX: number,
    focusZ: number,
    radius: number,
    lights: InkLights | null,
  ): void {
    const ink = this.ink;
    if (ink === null) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const content = this.options.view.content;
    const season = seasonOf(content.settings.clock, world.common.day);
    const frame = this.inkFrame;
    frame.dt = dt;
    frame.minutes = world.minutes;
    frame.sheet = content.time.climates[world.common.place]?.seasons[season].ambience ?? null;
    frame.weather = world.common.weather;
    frame.indoor = this.indoor;
    frame.place = content.places[world.common.place]?.def.ambience ?? null;
    frame.focusX = focusX;
    frame.focusZ = focusZ;
    frame.viewRadius = radius;
    frame.lights = lights;
    frame.exposure = this.fade;
    frame.room = typeof this.room === 'string' && this.tiled !== null;
    frame.blind = frame.room && this.tiled?.roomIsBlind() === true;
    frame.backdrop = frame.room ? ROOM_SETTINGS.backdrop.color : null;
    frame.width = this.bufferWidth;
    frame.height = this.bufferHeight;
    ink.frame(this.renderer, this.scene, this.camera, frame);
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
    const s = this.cameraSettings;
    const halfHeight = width / 2 / this.aspect;
    // Le sol au bord haut de l'écran est plus loin que le point visé d'environ 1,4 demi-hauteur.
    const reach = halfHeight / Math.tan((s.pitchFarDeg * Math.PI) / 180);
    this.fog.near = s.distance + reach * TILE_SETTINGS.fog.start;
    this.fog.far = s.distance + reach * TILE_SETTINGS.fog.end;
  }

  private measure(dt: number): void {
    const ms = dt * 1000;
    this.frameMs = this.frameMs === 0 ? ms : this.frameMs + (ms - this.frameMs) * 0.05;
    // En encre, la finesse s'adapte dans le rendu encré lui-même (échelle interne, ADR 0023).
    if (this.ink !== null) return;
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
    // Passage en cours: l'image montre encore le lieu d'avant, où rien du nouvel état ne doit
    // s'accrocher. Un point loin hors de l'écran, et non `null`: l'interface remettrait sinon sa
    // bulle à sa place par défaut, bien visible sur le noir qui tombe.
    if (this.holding) {
      this.screenPoint.x = OFF_SCREEN;
      this.screenPoint.y = OFF_SCREEN;
      return this.screenPoint;
    }
    const point = this.projected.set(x, height + this.groundAt(x, y), y);
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
      style: this.ink === null ? 'aplats' : 'encre',
      inkTextureBytes: this.ink?.textureBytes(this.bufferWidth, this.bufferHeight) ?? 0,
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
      trains: this.trains?.stats ?? null,
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
    this.trains?.dispose();
    this.trains = null;
    this.characters.dispose();
    this.daylight.dispose();
    this.table.geometry.dispose();
    this.table.removeFromParent();
    this.groundMaterial.dispose();
    this.standInMaterial.dispose();
    this.tableMaterial.dispose();
    this.ink?.dispose();
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
