/**
 * Moteur de rendu de La Petite Ligne: crée le `WebGLRenderer` (sRGB, tone
 * mapping, rapport de pixels plafonné), la scène, la caméra isométrique et la
 * lumière du jour, assemble les parties (terrain, décor, personnages...) et
 * dessine une image à chaque `frame`. Il lit l'état par la `GameView` et ne le
 * modifie jamais. `dispose` libère tout (géométries, matériaux, textures,
 * contexte WebGL).
 */
import {
  ACESFilmicToneMapping,
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
import type { CharacterId, ReadonlyWorld, WorldEvent } from '../etat/types';
import type { GameView, PickResult, Renderer, RendererOptions } from '../etat/vue';
import { IsoCameraRig, type CameraCommand } from './camera';
import { PickRegistry, type FrameContext, type RenderPart } from './contexte';
import { StaticDecor } from './decor';
import { DaylightRig } from './lumiere';
import { createSharedMaterials, type SeeThroughHole, type SharedMaterials } from './materiaux';
import { ModelLibrary } from './modeles';
import { PerfMonitor } from './perf';
import { RENDER_SETTINGS } from './reglages';
import { ResourceTracker } from './ressources';
import { Terrain } from './terrain';
import { Vegetation } from './vegetation';
import { WorldParts } from './monde';
import { CharactersPart } from './personnages';
import { HousePart } from './maison';
import { GardenPart } from './potager';
import { FarmLifePart } from './vie';
import { EffectsPart } from './effets';
import { RailwayPart } from './voie';

/** Une image ne compte jamais plus que cela (onglet en arrière-plan, pause du débogueur). */
const MAX_FRAME_SECONDS = 0.1;
/** Parts du chargement: modèles d'abord, puis construction de la scène et compilation. */
const LOAD_MODELS_SHARE = 0.7;
const LOAD_BUILD_SHARE = 0.9;
/** Rayon du trou de visibilité autour d'un personnage (m) et hauteur de son centre. */
const SEE_THROUGH_RADIUS = 1.7;
const SEE_THROUGH_CHEST = 1.0;
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
  private readonly unsubscribe: () => void;
  private readonly pendingEvents: WorldEvent[] = [];
  private readonly parts: RenderPart[] = [];
  private materials: SharedMaterials | null = null;
  private terrain: Terrain | null = null;
  private world: WorldParts | null = null;
  private reducedMotion: boolean;
  private time = 0;
  private loaded = false;
  private disposed = false;
  private readonly context: FrameContext;
  private readonly focus = new Vector3();
  private readonly probe = new Vector3();
  private readonly viewPoint = new Vector3();
  private readonly bufferSize = new Vector2();
  private readonly holes: SeeThroughHole[] = [];

  constructor(options: EngineOptions) {
    this.view = options.view;
    this.container = options.container;
    this.reducedMotion = options.reducedMotion;
    const settings = RENDER_SETTINGS.renderer;
    this.renderer = new WebGLRenderer({
      antialias: settings.antialias,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = toneMapping(settings.toneMapping);
    this.renderer.toneMappingExposure = settings.exposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.setAttribute('data-testid', 'lpl-canvas');
    this.container.appendChild(canvas);

    this.rig = new IsoCameraRig(this.reducedMotion);
    this.daylight = new DaylightRig(this.scene);
    this.perf = new PerfMonitor(this.container, options.showStats ?? import.meta.env.DEV);
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    this.resizeObserver.observe(this.container);
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

  /** Taille du canevas: rapport de pixels plafonné à 2, et à 1920x1080 pixels physiques. */
  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const settings = RENDER_SETTINGS.renderer;
    const budgetRatio = Math.sqrt(settings.maxPhysicalPixels / (width * height));
    const ratio = Math.min(window.devicePixelRatio || 1, settings.maxPixelRatio, budgetRatio);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.rig.setAspect(width / height);
  }

  async load(onProgress: (ratio: number) => void): Promise<void> {
    const materials = await createSharedMaterials(this.resources);
    this.materials = materials;
    const library = new ModelLibrary(materials, this.resources);
    await library.load((ratio) => {
      onProgress(ratio * LOAD_MODELS_SHARE);
    });
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
    });
    this.terrain = terrain;
    this.scene.add(terrain.group);
    this.scene.add(new Vegetation(map, terrain, materials, this.resources).group);
    const decor = new StaticDecor(map, library, terrain, this.resources);
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
    const garden = new GardenPart(library, materials, terrain, this.resources, this.picks);
    const farm = new FarmLifePart(library, materials, terrain, this.resources, this.picks, content);
    this.scene.add(
      characters.group,
      house.group,
      garden.batches.group,
      garden.trees.group,
      farm.group,
    );
    world.add(characters);
    world.add(house);
    world.add(garden);
    world.add(farm);
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
    );
    this.scene.add(effects.group);
    world.add(effects);
    const railway = new RailwayPart(
      map,
      library,
      materials,
      terrain,
      this.resources,
      effects,
      decor.clockHands,
    );
    this.scene.add(railway.group);
    world.add(railway);
    onProgress(LOAD_BUILD_SHARE);

    const local = this.localCharacter(this.view.world());
    if (local !== null) {
      this.rig.snapTo(local.pos.x, local.pos.y);
    } else {
      this.rig.snapTo(map.width / 2, map.height / 2);
    }
    this.perf.setMissingModels(library.missingModels());
    await this.warmUp();
    this.loaded = true;
    onProgress(1);
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
    if (local !== null) {
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
    this.updateSeeThrough(world, alpha);
    this.daylight.update(
      world.clock.minutes,
      world.weather,
      this.focus,
      this.rig.viewRadius(),
      RENDER_SETTINGS.camera.distance,
    );
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
    const radius = (SEE_THROUGH_RADIUS / this.rig.viewWidth()) * this.bufferSize.x;
    this.holes.length = 0;
    for (const character of world.characters) {
      const x = character.prev.x + (character.pos.x - character.prev.x) * alpha;
      const y = character.prev.y + (character.pos.y - character.prev.y) * alpha;
      const ground = terrain.heightAt(x, y);
      this.probe.set(x, ground + SEE_THROUGH_CHEST, y);
      this.viewPoint.copy(this.probe).applyMatrix4(camera.matrixWorldInverse);
      this.probe.project(camera);
      this.holes.push({
        x: (this.probe.x * HALF + HALF) * this.bufferSize.x,
        y: (this.probe.y * HALF + HALF) * this.bufferSize.y,
        radius,
        depth: -this.viewPoint.z,
        ground,
      });
    }
    materials.setSeeThrough(this.holes);
  }

  frame(dtSeconds: number): void {
    if (!this.loaded || this.disposed) {
      return;
    }
    this.updateFrame(dtSeconds);
    this.renderer.render(this.scene, this.rig.camera);
    this.perf.record(this.renderer, Math.min(MAX_FRAME_SECONDS, Math.max(0, dtSeconds)));
  }

  cameraYaw(): number {
    return this.rig.yaw();
  }

  camera(command: CameraCommand): void {
    this.rig.command(command);
  }

  /** Réduction des animations (réglage de la plateforme, peut changer en cours de partie). */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.rig.setReducedMotion(reduced);
  }

  pick(clientX: number, clientY: number): PickResult | null {
    if (!this.loaded || this.terrain === null) {
      return null;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    const ray = this.rig.ray(ndcX, ndcY).ray;
    const entity = this.picks.nearest(ray);
    // Le sol: deux passes pour tenir compte de la hauteur du terrain (quai, berges).
    let ground = this.rig.groundAt(ndcX, ndcY, 0);
    if (ground !== null) {
      ground = this.rig.groundAt(ndcX, ndcY, this.terrain.heightAt(ground.x, ground.z));
    }
    const groundDistance =
      ground === null ? Number.POSITIVE_INFINITY : ground.distanceTo(ray.origin);
    if (entity !== null && entity.distance <= groundDistance) {
      return entity.result;
    }
    if (ground === null) {
      return null;
    }
    const map = this.view.map;
    if (ground.x < 0 || ground.z < 0 || ground.x >= map.width || ground.z >= map.height) {
      return null;
    }
    return { kind: 'ground', x: ground.x, y: ground.z };
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

  /** Triangles par partie de la scène (diagnostic des budgets, page de démonstration). */
  breakdown(): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const child of this.scene.children) {
      let sum = 0;
      child.traverse((object) => {
        if (object instanceof Mesh && object.visible) {
          const geometry = object.geometry as BufferGeometry;
          const vertices = geometry.index?.count ?? geometry.getAttribute('position').count;
          const instances = object instanceof InstancedMesh ? object.count : 1;
          sum += (vertices / 3) * instances;
        }
      });
      totals[child.name || child.type] = Math.round(sum);
    }
    return totals;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unsubscribe();
    this.resizeObserver.disconnect();
    this.world?.dispose();
    this.scene.clear();
    this.resources.dispose();
    this.perf.dispose();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
