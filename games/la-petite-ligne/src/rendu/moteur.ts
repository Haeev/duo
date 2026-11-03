/**
 * Moteur de rendu de La Petite Ligne: crée le `WebGLRenderer` (sRGB, tone
 * mapping, rapport de pixels plafonné), la scène, la caméra isométrique et la
 * lumière du jour, assemble les parties (terrain, décor, personnages...) et
 * dessine une image à chaque `frame`. Il lit l'état par la `GameView` et ne le
 * modifie jamais. `dispose` libère tout (géométries, matériaux, textures,
 * contexte WebGL).
 */
import { seasonOfDay } from '../donnees/calendrier';
import { benchesOf } from '../etat/bancs';
import { mistAmount } from '../etat/meteo';
import {
  ACESFilmicToneMapping,
  Color,
  InstancedMesh,
  Mesh,
  type BufferGeometry,
  AgXToneMapping,
  NeutralToneMapping,
  PCFShadowMap,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
  type ToneMapping,
} from 'three';
import type { Season } from '../donnees/types';
import type { CharacterId, ReadonlyWorld, WorldEvent } from '../etat/types';
import type { GameView, OutfitPreview, OutfitPreviewOptions, PickResult, Renderer, RendererOptions } from '../etat/vue';
import { createOutfitPreview } from './apercu-tenue';
import { IsoCameraRig, type CameraCommand } from './camera';
import { PickRegistry, yawFromQuarter, type FrameContext, type RenderPart } from './contexte';
import { StaticDecor } from './decor';
import { DaylightRig, stabilizeShadowFilter } from './lumiere';
import { createSharedMaterials, type SeeThroughHole, type SharedMaterials } from './materiaux';
import { ModelLibrary } from './modeles';
import { ShadowCasterCulling } from './ombre-tri';
import { InteriorsPart, readInteriorHooks } from './interieurs';
import { MAP_FILES } from '../donnees/cartes-fichiers';
import { PerfMonitor } from './perf';
import { AdaptiveQuality, renderPixelSize, type QualityChange } from './qualite';
import { RENDER_SETTINGS } from './reglages';
import { SEASON_RENDER_SETTINGS } from './reglages-saisons';
import { ResourceTracker } from './ressources';
import { Terrain } from './terrain';
import { Vegetation } from './vegetation';
import { WorldParts } from './monde';
import { CharactersPart } from './personnages';
import { HousePart } from './maison';
import { ImprovementsPart } from './chantiers';
import { LampBoard } from './lampes';
import { GardenPart } from './potager';
import { FarmLifePart } from './vie';
import { EffectsPart } from './effets';
import { RailwayPart } from './voie';
import { FishingPart } from './peche';
import { SignsPart } from './signes';
import { MomentsPart } from './moments';
import { AmbientFaunaPart } from './faune-ambiance';
import { CatPart, NO_CAT, type CatSource } from './chat';
import { HenLabels } from './etiquettes';
import { FishShadowsPart } from './ombres-poissons';
import { createStateFishingSource, type FishingSource } from './peche-vue';
import { MarketPart } from './marche';
import { BreedingPart } from './elevage';
import { RENDER_EXTENSIONS, type RenderHooks } from './extensions';

/**
 * Rend la main au navigateur entre deux étapes lourdes de la construction de
 * la scène: aucune tâche longue d'affilée (chien de garde de Duo, invité dont
 * la scène se construit après `ready`).
 */
function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Une image ne compte jamais plus que cela (onglet en arrière-plan, pause du débogueur). */
const MAX_FRAME_SECONDS = 0.1;
/** Parts du chargement: modèles d'abord, puis construction de la scène et compilation. */
const LOAD_MODELS_SHARE = 0.7;
const LOAD_BUILD_SHARE = 0.9;
/**
 * Trou de visibilité ajusté à la silhouette d'un personnage (m): demi-largeur,
 * demi-hauteur du corps (debout, 1,7 m) avec un peu de marge, hauteur du centre.
 */
const SEE_THROUGH_HALF_WIDTH = 0.55;
const SEE_THROUGH_HALF_HEIGHT = 1.05;
const SEE_THROUGH_CENTER = 0.9;
const HALF = 0.5;

function toneMapping(name: (typeof RENDER_SETTINGS.renderer)['toneMapping']): ToneMapping {
  switch (name) {
    case 'neutral':
      return NeutralToneMapping;
    case 'agx':
      return AgXToneMapping;
    case 'aces':
      return ACESFilmicToneMapping;
  }
}

export interface EngineOptions extends RendererOptions {
  /** Indicateur de performances (par défaut: en mode développement). */
  showStats?: boolean;
  /**
   * Résolution dynamique et repli automatique vers le mode léger (par défaut:
   * oui). Non pour des captures reproductibles en rendu logiciel.
   */
  adaptive?: boolean;
  /** Pêche de la 0.12 (ombres, coin qui frémit, guet): l'état, sauf la page de démonstration. */
  fishing?: FishingSource;
  /** Le chat du bourg (0.13, `chat.ts`): aucun tant que la simulation n'en a pas (lot H7). */
  cat?: CatSource;
}

export class RenderEngine implements Renderer {
  private readonly view: GameView;
  private readonly container: HTMLElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly rig: IsoCameraRig;
  private readonly daylight: DaylightRig;
  private readonly resources = new ResourceTracker();
  private readonly perf: PerfMonitor;
  private readonly picks = new PickRegistry();
  private readonly resizeObserver: ResizeObserver;
  /** Taille exacte du conteneur en pixels physiques, si le navigateur la donne. */
  private devicePixels: { width: number; height: number } | null = null;
  /** Rapport de pixels effectif du rendu (pixels du tampon par point CSS). */
  private effectiveRatio = 1;
  private readonly unsubscribe: () => void;
  private readonly pendingEvents: WorldEvent[] = [];
  private readonly parts: RenderPart[] = [];
  private materials: SharedMaterials | null = null;
  /** Modèles chargés (aperçu de la boutique), `null` avant `load`. */
  private library: ModelLibrary | null = null;
  private terrain: Terrain | null = null;
  private world: WorldParts | null = null;
  private reducedMotion: boolean;
  private time = 0;
  private loaded = false;
  private disposed = false;
  private readonly context: FrameContext;
  private readonly focus = new Vector3();
  private readonly gradeColor = new Color();
  private readonly probe = new Vector3();
  private readonly viewPoint = new Vector3();
  private readonly bufferSize = new Vector2();
  private readonly holes: SeeThroughHole[] = [];
  /** Mode léger demandé (`RendererOptions.quality`), pour toute la séance. */
  private readonly light: boolean;
  /** Qualité adaptative (`qualite.ts`); `null` en mode léger demandé ou sans adaptation. */
  private readonly quality: AdaptiveQuality | null;
  private readonly log: RendererOptions['log'];
  private vegetation: Vegetation | null = null;
  private moments: MomentsPart | null = null;
  private readonly shadowCulling = new ShadowCasterCulling();
  /** Allumage des lampadaires (tour 9), écrit par les chantiers, lu par l'ambiance. */
  private readonly lamps = new LampBoard();
  /** Saison montée (palette et lumière), `null` avant la première image. */
  private season: Season | null = null;
  private readonly fishingSource: FishingSource;
  private readonly catSource: CatSource;

  constructor(options: EngineOptions) {
    this.view = options.view;
    this.container = options.container;
    this.reducedMotion = options.reducedMotion;
    this.light = options.quality === 'light';
    this.quality = this.light || options.adaptive === false ? null : new AdaptiveQuality();
    this.log = options.log;
    this.fishingSource = options.fishing ?? createStateFishingSource();
    this.catSource = options.cat ?? NO_CAT;
    const settings = RENDER_SETTINGS.renderer;
    this.renderer = new WebGLRenderer({
      antialias: settings.antialias && !this.light,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = toneMapping(settings.toneMapping);
    this.renderer.toneMappingExposure = settings.exposure;
    // Mode léger: aucune carte d'ombre (ni passe d'ombre, ni échantillonnage dans les shaders).
    this.renderer.shadowMap.enabled = !this.light;
    this.renderer.shadowMap.type = PCFShadowMap;
    stabilizeShadowFilter();
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.setAttribute('data-testid', 'lpl-canvas');
    this.container.appendChild(canvas);

    this.rig = new IsoCameraRig(this.reducedMotion);
    this.daylight = new DaylightRig(this.scene);
    if (this.light) {
      this.daylight.sun.castShadow = false;
    }
    this.perf = new PerfMonitor(
      this.container,
      options.showStats ?? (import.meta.env.DEV && !this.light),
    );
    // Boîte en pixels physiques: taille exacte de l'écran sous le canevas, et
    // nouvel appel quand la mise à l'échelle change (fenêtre glissée sur un
    // autre écran, réglage de Windows modifié en cours de partie).
    this.resizeObserver = new ResizeObserver((entries) => {
      // Absent des navigateurs qui ne connaissent pas cette boîte (le type DOM le dit toujours là).
      const entry = entries[0];
      const box =
        entry !== undefined && 'devicePixelContentBoxSize' in entry
          ? entry.devicePixelContentBoxSize[0]
          : undefined;
      this.devicePixels = box === undefined ? null : { width: box.inlineSize, height: box.blockSize };
      this.resize();
    });
    try {
      this.resizeObserver.observe(this.container, { box: 'device-pixel-content-box' });
    } catch {
      this.resizeObserver.observe(this.container);
    }
    this.resize();
    this.unsubscribe = this.view.onEvent((event) => {
      this.pendingEvents.push(event);
    });
    this.context = {
      world: this.view.world(),
      alpha: 0,
      dt: 0,
      time: 0,
      local: this.view.localCharacter(),
      quarter: 0,
      shownYaw: this.rig.shownYaw(),
      night: 0,
      reducedMotion: this.reducedMotion,
    };
  }

  /**
   * Taille du tampon de rendu (`renderPixelSize` de `qualite.ts`): rapport
   * plafonné à 2 et à 1920x1080 pixels physiques, jamais sous le plancher de
   * netteté, pixels physiques exacts à pleine résolution. Le tampon est donné
   * en pixels (rapport 1 pour Three.js), le CSS l'étend au conteneur.
   */
  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const size = renderPixelSize(
      {
        cssWidth: width,
        cssHeight: height,
        devicePixelRatio: window.devicePixelRatio || 1,
        devicePixels: this.devicePixels,
      },
      this.resolutionScale(),
      this.light,
    );
    this.effectiveRatio = size.ratio;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size.width, size.height, false);
    this.rig.setAspect(width / height);
  }

  async load(onProgress: (ratio: number) => void): Promise<void> {
    const materials = await createSharedMaterials(this.resources);
    this.materials = materials;
    const library = new ModelLibrary(materials, this.resources);
    await library.load((ratio) => {
      onProgress(ratio * LOAD_MODELS_SHARE);
    });
    this.library = library;
    if (this.disposed) {
      return;
    }
    const map = this.view.map;
    // Sols posés (quai, ponton): la hauteur de marche du modèle de l'artiste, sinon celle de la carte.
    const terrain = new Terrain(map, materials, this.resources, (prop) => {
      const walk = library.extras(prop.model).walk_height;
      if (typeof walk === 'number') {
        return walk;
      }
      return prop.category === 'sol' && prop.height > 0
        ? prop.height
        : RENDER_SETTINGS.floorProps[prop.model];
    }, (crossing) => {
      // Ouvrages du ru: on marche sur le tablier, le platelage ou les pierres du modèle.
      const walk = library.extras(crossing.model).walk_height;
      return typeof walk === 'number' ? walk : undefined;
    });
    this.terrain = terrain;
    this.scene.add(terrain.group);
    const share = this.light ? RENDER_SETTINGS.light.vegetationShare : 1;
    if (await this.interrupted()) {
      return;
    }
    this.vegetation = new Vegetation(map, terrain, materials, this.resources, share);
    this.scene.add(this.vegetation.group);
    if (await this.interrupted()) {
      return;
    }
    const decor = new StaticDecor(map, library, terrain, this.resources);
    if (await this.interrupted()) {
      return;
    }
    this.scene.add(decor.group);
    const world = new WorldParts({
      scene: this.scene,
      view: this.view,
      library,
      materials,
      terrain,
      resources: this.resources,
      picks: this.picks,
      rig: this.rig,
    });
    this.world = world;
    this.parts.push(world);
    const content = this.view.content;
    const characters = new CharactersPart(
      library,
      materials,
      terrain,
      this.resources,
      this.picks,
      content,
      benchesOf(map),
      map.points,
      map,
    );
    const house = new HousePart(
      map,
      content,
      library,
      materials,
      terrain,
      this.resources,
      this.picks,
    );
    const garden = new GardenPart(
      library,
      materials,
      terrain,
      this.resources,
      this.picks,
      content.settings.trees,
    );
    const farm = new FarmLifePart(
      library,
      materials,
      terrain,
      this.resources,
      this.picks,
      content,
      map,
    );
    this.scene.add(
      characters.group,
      house.group,
      garden.batches.group,
      garden.trees.group,
      farm.group,
    );
    world.add(characters);
    world.add(house);
    // Tour 10: épicerie et mercerie (coupe, contenu, portes), la lampe unique déplacée (après la maisonnette).
    const interiors = new InteriorsPart(map, library, this.resources, house, readInteriorHooks(MAP_FILES));
    this.scene.add(interiors.group);
    world.add(interiors);
    characters.setInteriorProbe(() => interiors.localInside());
    world.add(garden);
    world.add(farm);
    // 0.12: coq, poussines, chèvres, piquets et cordes, litière, herbe rase.
    const breeding = new BreedingPart(map, content, library, materials, terrain, this.resources);
    this.scene.add(breeding.group);
    world.add(breeding);
    // Tour 9: chantiers bâtis, marelle, allumage des lampadaires (après la maisonnette: l'auvent suit sa coupe).
    const improvements = new ImprovementsPart(map, content, library, materials, terrain, this.resources, house, this.lamps);
    this.scene.add(improvements.group);
    world.add(improvements);
    // 0.12: l'étal du dimanche, ses cagettes et la sacoche de Lucie (lot L-économie).
    const market = new MarketPart(map, content, library, terrain);
    this.scene.add(market.group);
    world.add(market);
    // Moments rares (après les personnages: Basile y est mené par la chorégraphie de l'échelle).
    const moments = new MomentsPart(
      map,
      content,
      library,
      terrain,
      this.resources,
      characters,
      this.light,
      this.daylight,
      this.rig.camera,
    );
    const henLabels = new HenLabels(terrain, this.resources, this.rig.camera);
    this.scene.add(moments.group, henLabels.group);
    world.add(moments);
    world.add(henLabels);
    this.moments = moments;
    // Faune d'ambiance hors des moments: mésanges des buissons, papillons du pré.
    const fauna = new AmbientFaunaPart(map, library, materials, terrain, this.resources, this.rig.camera, this.light);
    this.scene.add(fauna.group);
    world.add(fauna);
    // 0.13: le chat du bourg (vue fournie par `EngineOptions.cat`).
    const cat = new CatPart(library, terrain, this.catSource);
    cat.setInteriorProbe(() => interiors.localInside());
    this.scene.add(cat.group);
    world.add(cat);
    if (await this.interrupted()) {
      return;
    }
    const effects = new EffectsPart(
      map,
      content,
      library,
      materials,
      terrain,
      this.resources,
      characters,
      house,
      this.rig,
      this.light ? RENDER_SETTINGS.light.effectsShare : 1,
    );
    this.scene.add(effects.group);
    world.add(effects);
    const fishing = new FishingPart(
      materials,
      terrain,
      this.resources,
      characters,
      effects,
      library,
      content,
    );
    const signs = new SignsPart(materials, terrain, this.resources);
    const fishShadows = new FishShadowsPart(
      map,
      content,
      materials,
      terrain,
      this.resources,
      this.fishingSource,
      this.daylight,
    );
    this.scene.add(fishing.group, signs.group, fishShadows.group);
    world.add(fishing);
    world.add(signs);
    world.add(fishShadows);
    const railway = new RailwayPart(
      map,
      library,
      materials,
      terrain,
      this.resources,
      decor.clockHands,
      content,
    );
    this.scene.add(railway.group);
    world.add(railway);
    // L'équipage du salut se tient dans la cabine du train, où qu'il soit.
    moments.setTrainProbe(() => railway.currentOffset());
    // Points d'accroche du technical artist (`extensions.ts`): eau, panache, ciel...
    const hooks: RenderHooks = {
      renderer: this.renderer,
      scene: this.scene,
      camera: this.rig.camera,
      map,
      materials,
      characterMaterial: library.sharedCharacterMaterial(),
      library,
      terrain,
      water: terrain.water,
      streamWater: terrain.streamWater,
      daylight: this.daylight,
      smokeEmitter: () => railway.smokeEmitter(),
      trainState: () => railway.trainState(),
      resources: this.resources,
      lamps: this.lamps,
    };
    for (const extension of RENDER_EXTENSIONS) {
      const part = extension(hooks);
      if (part !== null) {
        world.add(part);
      }
    }
    onProgress(LOAD_BUILD_SHARE);

    const local = this.localCharacter(this.view.world());
    if (local !== null) {
      this.rig.snapTo(local.pos.x, local.pos.y);
    } else {
      this.rig.snapTo(map.width / 2, map.height / 2);
    }
    this.perf.setMissingModels(library.missingModels());
    this.missing = library.missingModels();
    await this.warmUp();
    this.loaded = true;
    onProgress(1);
  }

  /** Rend la main au navigateur; vrai si le rendu a été libéré entre-temps (chargement abandonné). */
  private async interrupted(): Promise<boolean> {
    await nextTask();
    return this.disposed;
  }

  /** Compile tous les programmes pendant le chargement (aucun à-coup à la première apparition d'un objet). */
  private async warmUp(): Promise<void> {
    const hidden: { visible: boolean; object: Object3D }[] = [];
    this.scene.traverse((object) => {
      if (!object.visible) {
        hidden.push({ visible: false, object });
        object.visible = true;
      }
    });
    this.updateFrame(0);
    await this.renderer.compileAsync(this.scene, this.rig.camera);
    this.renderer.render(this.scene, this.rig.camera);
    if (this.quality !== null && !this.disposed) {
      // Repli automatique possible: ses variantes sans ombre se compilent aussi
      // maintenant. Three.js garde les deux programmes par matériau, la bascule
      // (dans un sens ou dans l'autre) n'en compile alors aucun en pleine partie.
      this.setShadows(false);
      await this.renderer.compileAsync(this.scene, this.rig.camera);
      this.renderer.render(this.scene, this.rig.camera);
      this.setShadows(true);
      this.renderer.render(this.scene, this.rig.camera);
    }
    for (const entry of hidden) {
      entry.object.visible = entry.visible;
    }
  }

  private localCharacter(world: ReadonlyWorld): ReadonlyWorld['characters'][number] | null {
    const id: CharacterId = this.view.localCharacter();
    return world.characters.find((character) => character.id === id) ?? null;
  }

  private updateFrame(dtSeconds: number): void {
    const dt = Math.min(MAX_FRAME_SECONDS, Math.max(0, dtSeconds));
    this.time += dt;
    const world = this.view.world();
    const alpha = this.view.alpha();
    const local = this.localCharacter(world);
    if (this.focusOverride !== null) {
      this.rig.update(dt, this.focusOverride.x, this.focusOverride.y, 0, 0, null);
    } else if (local !== null) {
      const x = local.prev.x + (local.pos.x - local.prev.x) * alpha;
      const y = local.prev.y + (local.pos.y - local.prev.y) * alpha;
      const vx = Math.cos(local.facing) * local.speed;
      const vy = Math.sin(local.facing) * local.speed;
      this.rig.update(dt, x, y, vx, vy, {
        minX: 0,
        minY: 0,
        maxX: this.view.map.width,
        maxY: this.view.map.height,
      });
    } else {
      this.rig.update(dt, this.rig.focus.x, this.rig.focus.z, 0, 0, null);
    }
    this.focus.copy(this.rig.focus);
    this.applySeason(world);
    this.daylight.setMorningMist(
      mistAmount(this.view.content.settings, world.morningMist, world.clock.minutes),
    );
    this.daylight.update(
      world.clock.minutes,
      world.weather,
      this.focus,
      this.rig.viewRadius(),
      RENDER_SETTINGS.camera.distance,
    );
    // Teinte voulue par le moment du jour (la brume dorée), après la lumière de l'heure.
    const grade = this.moments?.lightGrade(world, this.gradeColor) ?? 0;
    if (grade > 0) this.daylight.tint(this.gradeColor, grade);
    this.materials?.setNight(this.daylight.night);
    this.materials?.setTime(this.time);

    const context = this.context;
    context.world = world;
    context.alpha = alpha;
    context.dt = dt;
    context.time = this.time;
    context.local = this.view.localCharacter();
    context.quarter = this.rig.quarter();
    context.shownYaw = this.rig.shownYaw();
    const scatter = RENDER_SETTINGS.terrain;
    this.vegetation?.setDetail(
      this.rig.viewWidth() >= scatter.scatterFarViewWidth ? scatter.scatterFarShare : 1,
    );
    context.night = this.daylight.night;
    context.reducedMotion = this.reducedMotion;
    if (this.world !== null) {
      for (const event of this.pendingEvents) {
        this.world.handleEvent(event, context);
      }
    }
    this.pendingEvents.length = 0;
    for (const part of this.parts) {
      part.update(context);
    }
    // Après les parties: la pose de l'habitant mené par un moment est celle de cette image.
    this.updateSeeThrough(world, alpha);
  }

  /**
   * Saison du jour (palette et lumière, sections 2.2 et 2.5). Le jour change à 6 h, sur l'écran
   * du petit-déjeuner: c'est là que la palette bascule, jamais en pleine journée (sauf à la
   * première image, partie reprise comprise).
   */
  private applySeason(world: ReadonlyWorld): void {
    const materials = this.materials;
    if (materials === null) return;
    const season = seasonOfDay(this.view.content.settings, world.clock.day);
    if (season === this.season || (this.season !== null && world.phase === 'day')) return;
    this.season = season;
    materials.setSeason(season);
    this.daylight.setSeason(SEASON_RENDER_SETTINGS.seasons[season]);
  }

  /** Trous de visibilité autour des deux joueurs (ce qui les cache s'efface, voir `materiaux.ts`). */
  private updateSeeThrough(world: ReadonlyWorld, alpha: number): void {
    const materials = this.materials;
    const terrain = this.terrain;
    if (materials === null || terrain === null) {
      return;
    }
    this.renderer.getDrawingBufferSize(this.bufferSize);
    const camera = this.rig.camera;
    // Pixels par mètre à l'écran; une hauteur se voit raccourcie par l'inclinaison de la caméra.
    const pixelsPerMeter = this.bufferSize.x / this.rig.viewWidth();
    const elevation = (RENDER_SETTINGS.camera.elevationDeg * Math.PI) / 180;
    const radiusX = SEE_THROUGH_HALF_WIDTH * pixelsPerMeter;
    const radiusY = SEE_THROUGH_HALF_HEIGHT * Math.cos(elevation) * pixelsPerMeter;
    // Monter d'un pixel sur le corps, c'est monter de 1 / (cos e) pixel-mètres, donc se rapprocher de tan e.
    const depthPerPixel = Math.tan(elevation) / pixelsPerMeter;
    this.holes.length = 0;
    const localInside = world.characters.find((c) => c.id === this.view.localCharacter())?.inside ?? null;
    for (const character of world.characters) {
      // Dans un autre bâtiment que le joueur local: caché par les murs, pas de trou (ADR 0016).
      if (character.inside !== null && character.inside !== localInside) continue;
      const x = character.prev.x + (character.pos.x - character.prev.x) * alpha;
      const y = character.prev.y + (character.pos.y - character.prev.y) * alpha;
      const ground = terrain.heightAt(x, y);
      this.probe.set(x, ground + SEE_THROUGH_CENTER, y);
      this.viewPoint.copy(this.probe).applyMatrix4(camera.matrixWorldInverse);
      this.probe.project(camera);
      this.holes.push({
        x: (this.probe.x * HALF + HALF) * this.bufferSize.x,
        y: (this.probe.y * HALF + HALF) * this.bufferSize.y,
        radiusX,
        radiusY,
        depth: -this.viewPoint.z,
        depthPerPixel,
        ground,
        minHeight: RENDER_SETTINGS.characters.seeThroughMinHeight,
      });
    }
    this.pushMomentHole(world, terrain, pixelsPerMeter, elevation, depthPerPixel);
    this.pushActorHole(world, terrain, pixelsPerMeter, elevation, depthPerPixel);
    this.pushWaterHole(world, terrain, pixelsPerMeter, elevation, depthPerPixel);
    materials.setSeeThrough(this.holes);
  }

  /** Trou du lieu d'un moment (le nichoir sous le houppier), voir `RENDER_SETTINGS.momentSeeThrough`. */
  private pushMomentHole(
    world: ReadonlyWorld,
    terrain: Terrain,
    pixelsPerMeter: number,
    elevation: number,
    depthPerPixel: number,
  ): void {
    const settings = RENDER_SETTINGS.momentSeeThrough;
    const today = world.moments.today;
    if (
      today === null ||
      !(settings.moments as readonly string[]).includes(today.id) ||
      !(settings.phases as readonly string[]).includes(today.phase)
    ) {
      return;
    }
    const hook = this.view.map.hooks.find((h) => h.id === settings.hook);
    if (hook === undefined) {
      return;
    }
    const camera = this.rig.camera;
    const ground = terrain.heightAt(hook.pos.x, hook.pos.y);
    this.probe.set(hook.pos.x, ground + hook.pos.z - settings.drop, hook.pos.y);
    // Seulement quand la caméra voit la face de l'accroche: de l'autre côté, le tronc est devant
    // elle et le trou le couperait (un tronc scié net, sans rien derrière à montrer).
    const yaw = yawFromQuarter(hook.rotation);
    const towardCamera =
      Math.sin(yaw) * (camera.position.x - this.probe.x) +
      Math.cos(yaw) * (camera.position.z - this.probe.z);
    if (towardCamera <= 0) {
      return;
    }
    this.viewPoint.copy(this.probe).applyMatrix4(camera.matrixWorldInverse);
    this.probe.project(camera);
    this.holes.push({
      x: (this.probe.x * HALF + HALF) * this.bufferSize.x,
      y: (this.probe.y * HALF + HALF) * this.bufferSize.y,
      radiusX: settings.halfWidth * pixelsPerMeter,
      radiusY: settings.halfHeight * Math.cos(elevation) * pixelsPerMeter,
      depth: -this.viewPoint.z - settings.nearer,
      depthPerPixel,
      ground,
    });
  }

  /**
   * Trou sur l'eau d'un moment qui s'y joue (les étoiles de l'Aubrune, tour 9): les arbres de la
   * rive sud cachent l'eau au sud du ponton en orientation 0. Centre: le milieu des reflets, à la
   * surface; voir `momentSeeThrough.water`.
   */
  private pushWaterHole(
    world: ReadonlyWorld,
    terrain: Terrain,
    pixelsPerMeter: number,
    elevation: number,
    depthPerPixel: number,
  ): void {
    const settings = RENDER_SETTINGS.momentSeeThrough.water;
    const today = world.moments.today;
    if (
      today === null ||
      !(settings.moments as readonly string[]).includes(today.id) ||
      !(settings.phases as readonly string[]).includes(today.phase)
    ) {
      return;
    }
    const def = this.view.content.moments.find((m) => m.id === today.id);
    const reflection = def?.render.reflection as { x?: unknown; y?: unknown } | undefined;
    const xs = reflection?.x;
    const ys = reflection?.y;
    if (!Array.isArray(xs) || !Array.isArray(ys)) {
      return;
    }
    const [x0, x1] = xs as unknown[];
    const [y0, y1] = ys as unknown[];
    if (typeof x0 !== 'number' || typeof x1 !== 'number' || typeof y0 !== 'number' || typeof y1 !== 'number') {
      return;
    }
    const x = (x0 + x1) / 2;
    const y = (y0 + y1) / 2;
    const camera = this.rig.camera;
    const ground = terrain.waterLevelAt(x, y) ?? terrain.heightAt(x, y);
    this.probe.set(x, ground, y);
    this.viewPoint.copy(this.probe).applyMatrix4(camera.matrixWorldInverse);
    this.probe.project(camera);
    this.holes.push({
      x: (this.probe.x * HALF + HALF) * this.bufferSize.x,
      y: (this.probe.y * HALF + HALF) * this.bufferSize.y,
      radiusX: settings.halfWidth * pixelsPerMeter,
      radiusY: settings.halfHeight * Math.cos(elevation) * pixelsPerMeter,
      depth: -this.viewPoint.z - settings.nearer,
      depthPerPixel,
      ground,
    });
  }

  /** Trou sur l'habitant mené par un moment (Basile sur son échelle), voir `momentSeeThrough.actor`. */
  private pushActorHole(
    world: ReadonlyWorld,
    terrain: Terrain,
    pixelsPerMeter: number,
    elevation: number,
    depthPerPixel: number,
  ): void {
    const settings = RENDER_SETTINGS.momentSeeThrough.actor;
    const today = world.moments.today;
    if (
      this.moments === null ||
      today === null ||
      !(settings.moments as readonly string[]).includes(today.id) ||
      !(settings.phases as readonly string[]).includes(today.phase) ||
      !this.moments.directedPose(settings.villager, this.time, this.probe)
    ) {
      return;
    }
    const camera = this.rig.camera;
    const ground = terrain.heightAt(this.probe.x, this.probe.y);
    this.probe.set(this.probe.x, ground + this.probe.z + settings.lift, this.probe.y);
    this.viewPoint.copy(this.probe).applyMatrix4(camera.matrixWorldInverse);
    this.probe.project(camera);
    this.holes.push({
      x: (this.probe.x * HALF + HALF) * this.bufferSize.x,
      y: (this.probe.y * HALF + HALF) * this.bufferSize.y,
      radiusX: settings.halfWidth * pixelsPerMeter,
      radiusY: settings.halfHeight * Math.cos(elevation) * pixelsPerMeter,
      depth: -this.viewPoint.z - settings.nearer,
      depthPerPixel,
      ground,
    });
  }

  frame(dtSeconds: number): void {
    if (!this.loaded || this.disposed) {
      return;
    }
    this.updateFrame(dtSeconds);
    this.draw();
    this.perf.record(this.renderer, Math.min(MAX_FRAME_SECONDS, Math.max(0, dtSeconds)));
    const change = this.quality?.sample(dtSeconds) ?? null;
    if (change !== null) {
      this.applyQuality(change);
    }
  }

  /** Une image, passe d'ombre réduite à ce qui ombre la vue (`ombre-tri.ts`). */
  private draw(): void {
    const shadows = this.renderer.shadowMap.enabled && this.daylight.sun.castShadow;
    if (shadows) {
      this.shadowCulling.begin(this.scene, this.rig.camera, this.daylight.direction);
    }
    try {
      this.renderer.render(this.scene, this.rig.camera);
    } finally {
      this.shadowCulling.end();
    }
  }

  /**
   * Applique une décision de `qualite.ts`, à chaud: ni contexte recréé, ni page
   * rechargée, ni programme compilé: `warmUp()` a préparé les deux variantes
   * (22 programmes en cache dans `rendu.html?adaptatif=1`, 11 sans adaptation;
   * 6 ou 7 utilisés par les matériaux de la scène dans chaque état).
   */
  private applyQuality(change: QualityChange): void {
    if (change.kind !== 'step') {
      this.setShadows(change.kind === 'normal');
    }
    this.resize();
    this.perf.setResolutionScale(this.resolutionScale());
    if (change.kind === 'step') {
      return;
    }
    this.log?.info(
      change.kind === 'light'
        ? 'rendu: mode léger automatique'
        : 'rendu: retour à la qualité normale',
      {
        final: change.kind === 'light' && change.final,
        averageFrameMs: Math.round(this.quality?.averageFrameMs() ?? 0),
        refreshMs: Math.round(this.quality?.refreshMs() ?? 0),
        pixelRatio: this.effectiveRatio,
      },
    );
  }

  /** Repli automatique imposé (page de démonstration, `adaptatif=1&repli=1`). */
  forceQualityFallback(): void {
    if (this.quality !== null) {
      this.applyQuality(this.quality.forceFallback());
    }
  }

  /**
   * Ombres du soleil allumées ou coupées. Coupées, la carte d'ombre est libérée
   * (une texture de profondeur pleine taille de moins en mémoire graphique);
   * Three.js la recrée seul au rendu suivant quand elles reviennent.
   */
  private setShadows(enabled: boolean): void {
    this.renderer.shadowMap.enabled = enabled;
    const sun = this.daylight.sun;
    sun.castShadow = enabled;
    const map = sun.shadow.map;
    if (!enabled && map !== null) {
      map.depthTexture?.dispose();
      map.depthTexture = null;
      map.dispose();
      sun.shadow.map = null;
    }
  }

  /** Palier de résolution dynamique courant (1 = pleine résolution). */
  resolutionScale(): number {
    const step = this.quality?.resolutionStep() ?? 0;
    return RENDER_SETTINGS.dynamicResolution.steps[step] ?? 1;
  }

  /** Rapport de pixels du rendu (résolution interne), pour les tests. */
  pixelRatio(): number {
    return this.effectiveRatio;
  }

  /** Qualité en vigueur: mode léger demandé ou automatique, sinon normale. */
  renderQuality(): 'normal' | 'light' {
    return this.light || this.quality?.isLight() === true ? 'light' : 'normal';
  }

  /** Point de vue imposé (page de démonstration: gros plans des moments), ou `null`: le joueur local. */
  private focusOverride: { x: number; y: number } | null = null;

  setFocusOverride(point: { x: number; y: number } | null): void {
    this.focusOverride = point;
    if (point !== null) {
      this.rig.snapTo(point.x, point.y);
    }
  }

  cameraYaw(): number {
    return this.rig.yaw();
  }

  camera(command: CameraCommand): void {
    this.rig.command(command);
  }

  /** Modèles remplacés par un substitut (absents des GLB), lus après le chargement. */
  private missing: string[] = [];

  missingModels(): string[] {
    return this.missing;
  }

  /** Page de démonstration: gros plan (largeur de vue en mètres). */
  inspect(width: number): void {
    this.rig.inspect(width);
  }

  /** Réduction des animations (réglage de la plateforme, peut changer en cours de partie). */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.rig.setReducedMotion(reduced);
  }

  pick(clientX: number, clientY: number): PickResult | null {
    const ndc = this.toNdc(clientX, clientY);
    if (ndc === null) {
      return null;
    }
    const ray = this.rig.ray(ndc.x, ndc.y).ray;
    const entity = this.picks.nearest(ray);
    const ground = this.groundPoint(ndc.x, ndc.y);
    const groundDistance =
      ground === null ? Number.POSITIVE_INFINITY : ground.distanceTo(ray.origin);
    if (entity !== null && entity.distance <= groundDistance) {
      return entity.result;
    }
    if (ground === null || !this.onMap(ground.x, ground.z)) {
      return null;
    }
    return { kind: 'ground', x: ground.x, y: ground.z };
  }

  pickGround(clientX: number, clientY: number): { x: number; y: number } | null {
    const ndc = this.toNdc(clientX, clientY);
    const ground = ndc === null ? null : this.groundPoint(ndc.x, ndc.y);
    if (ground === null || !this.onMap(ground.x, ground.z)) {
      return null;
    }
    return { x: ground.x, y: ground.z };
  }

  /** Coordonnées normalisées du canevas, ou `null` avant le chargement. */
  private toNdc(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!this.loaded || this.terrain === null) {
      return null;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((clientY - rect.top) / rect.height) * 2 - 1),
    };
  }

  /** Le sol: deux passes pour tenir compte de la hauteur du terrain (quai, berges). */
  private groundPoint(ndcX: number, ndcY: number): Vector3 | null {
    const terrain = this.terrain;
    let ground = this.rig.groundAt(ndcX, ndcY, 0);
    if (ground !== null && terrain !== null) {
      ground = this.rig.groundAt(ndcX, ndcY, terrain.heightAt(ground.x, ground.z));
    }
    return ground;
  }

  private onMap(x: number, y: number): boolean {
    const map = this.view.map;
    return x >= 0 && y >= 0 && x < map.width && y < map.height;
  }

  stats(): { drawCalls: number; triangles: number } {
    return { drawCalls: this.perf.current.drawCalls, triangles: this.perf.current.triangles };
  }

  /** Statistiques complètes (programmes, textures, images par seconde), pour les tests et l'indicateur. */
  detailedStats(): Readonly<typeof this.perf.current> {
    return this.perf.current;
  }

  /** Programmes de shader compilés (nom et type de matériau), pour tenir le budget de 12. */
  programList(): string[] {
    return (this.renderer.info.programs ?? []).map(
      (program) => `${program.name} ${program.cacheKey.slice(0, 60)}`,
    );
  }

  /**
   * Programmes réellement utilisés par les matériaux de la scène dans l'état
   * courant (diagnostic du budget). `programList()` compte aussi les variantes
   * en cache, compilées d'avance mais inutilisées dans cet état; les passes
   * d'ombre (matériaux de profondeur internes) n'y figurent pas.
   */
  programsInUse(): number {
    const used = new Set<unknown>();
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }
      const materials: unknown[] = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        const properties = this.renderer.properties.get(material);
        if (
          typeof properties === 'object' &&
          properties !== null &&
          'currentProgram' in properties
        ) {
          used.add(properties.currentProgram);
        }
      }
    });
    used.delete(undefined);
    return used.size;
  }

  /**
   * Triangles d'une image, passe d'ombre à part (diagnostic des budgets): rend
   * une image en mesurant ce que dessine la carte d'ombre.
   */
  triangleSplit(): {
    total: number;
    shadow: number;
    drawCalls: number;
    /** Triangles dessinés par maillage, passe principale et passe d'ombre (`nom`, `nom (ombre)`). */
    meshes: Record<string, number>;
  } {
    const renderer = this.renderer;
    const shadowMap = renderer.shadowMap;
    const info = renderer.info.render;
    const original = shadowMap.render.bind(shadowMap);
    const draw = renderer.renderBufferDirect.bind(renderer);
    const meshes: Record<string, number> = {};
    let inShadow = false;
    let shadow = 0;
    shadowMap.render = (...args: Parameters<typeof original>): void => {
      const before = info.triangles;
      inShadow = true;
      original(...args);
      inShadow = false;
      shadow += info.triangles - before;
    };
    renderer.renderBufferDirect = (...args: Parameters<typeof draw>): void => {
      const before = info.triangles;
      draw(...args);
      const object = args[4];
      const key = `${object.parent?.name ?? ''}/${object.name}${inShadow ? ' (ombre)' : ''}`;
      meshes[key] = (meshes[key] ?? 0) + info.triangles - before;
    };
    try {
      this.draw();
    } finally {
      shadowMap.render = original;
      renderer.renderBufferDirect = draw;
    }
    return { total: info.triangles, shadow, drawCalls: info.calls, meshes };
  }

  /** Triangles par partie de la scène (diagnostic des budgets, page de démonstration). */
  breakdown(detail = false): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const child of this.scene.children) {
      let sum = 0;
      child.traverse((object) => {
        if (object instanceof Mesh && object.visible) {
          const geometry = object.geometry as BufferGeometry;
          const vertices = geometry.index?.count ?? geometry.getAttribute('position').count;
          const instances = object instanceof InstancedMesh ? object.count : 1;
          const triangles = (vertices / 3) * instances;
          sum += triangles;
          if (detail) {
            // Détail par maillage, `*` pour ceux de la passe d'ombre.
            const key = `${child.name || child.type}/${object.name}${object.castShadow ? ' *' : ''}`;
            totals[key] = Math.round((totals[key] ?? 0) + triangles);
          }
        }
      });
      if (!detail) {
        totals[child.name || child.type] = Math.round(sum);
      }
    }
    return totals;
  }

  /** Aperçu 3D d'une tenue (boutique de vêtements de la 0.12): sa propre petite scène. */
  createOutfitPreview(options: OutfitPreviewOptions): OutfitPreview | null {
    if (this.library === null || this.disposed) return null;
    const settings = RENDER_SETTINGS.renderer;
    return createOutfitPreview(
      { library: this.library, clothes: this.view.content.clothes, toneMapping: toneMapping(settings.toneMapping), exposure: settings.exposure },
      options,
    );
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unsubscribe();
    this.resizeObserver.disconnect();
    this.world?.dispose();
    this.daylight.dispose();
    this.scene.clear();
    this.resources.dispose();
    this.perf.dispose();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
