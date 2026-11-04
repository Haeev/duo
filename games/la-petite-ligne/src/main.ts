/**
 * Point d'entrée de La Petite Ligne: connexion à la plateforme (ou au faux
 * hôte) par le SDK, contenu et carte, séance (hôte ou invité), rendu 3D,
 * interface, boucle à pas fixe.
 */
import { connect } from '@duo/sdk';
import manifest from '../duo-game.json';
import { loadContent } from './donnees/contenu';
import { loadMap } from './donnees/carte';
import { MAP_FILES } from './donnees/cartes-fichiers';
import { CONTENT_FILES } from './donnees/fichiers';
import type { AudioExtras } from './audio/index';
import type { AudioOptions, CreateInterface, GameAudio, GameInterface, Renderer, RenderQuality } from './etat/vue';
import {
  DEFAULT_GRAPHICS_OPTIONS,
  type GraphicsPort,
  type GraphicsStorage,
  loadGraphicsOptions,
  saveGraphicsOptions,
  sessionGraphicsStorage,
} from './etat/options-graphiques';
import { createControls } from './entrees/commandes';
import { createFallbackInterface } from './plateforme/interface-secours';
import { createRenderer } from './rendu/index';
import { createSession, type GameAction } from './session';
import { SIM_HZ } from './simulation/constantes';
import type { Robot } from './simulation/robot';

/** Attente maximale du premier état chez l'invité avant de se déclarer prêt (ms). */
const GUEST_WORLD_WAIT_MS = 5000;
const POLL_MS = 50;
/** Part du chargement réservée au rendu (le reste: contenu et séance). */
const RENDER_LOAD_SHARE = 0.9;

function byId(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`élément #${id} absent de index.html`);
  return node;
}

/** L'interface du jeu (`src/interface/`) si elle est livrée, sinon l'interface de secours. */
async function pickInterface(): Promise<CreateInterface> {
  const modules = import.meta.glob<Record<string, unknown>>('./interface/index.ts');
  const load = modules['./interface/index.ts'];
  if (load !== undefined) {
    const mod = await load();
    const create = mod.createInterface;
    if (typeof create === 'function') return create as CreateInterface;
  }
  return createFallbackInterface;
}

/**
 * Mode de rendu léger (`?rendu=leger`), pour jouer dans un Chromium en rendu
 * logiciel. Lu dans l'adresse du jeu, ou dans celle de la page du faux hôte
 * (`deux-vues.html?rendu=leger`) quand elle est de la même origine.
 */
function renderQuality(): RenderQuality {
  const light = (search: string): boolean => new URLSearchParams(search).get('rendu') === 'leger';
  if (light(window.location.search)) return 'light';
  try {
    if (window.top !== null && window.top !== window && light(window.top.location.search)) return 'light';
  } catch {
    // Page parente d'une autre origine (l'application Duo): pas de mode léger.
  }
  return 'normal';
}

/** Le son (`src/audio/`), avec ce qu'il accepte en plus du contrat (pause, oreilles, journal). */
type CreateAudioWithExtras = (options: AudioOptions & AudioExtras) => GameAudio;

async function pickAudio(): Promise<CreateAudioWithExtras | null> {
  const modules = import.meta.glob<Record<string, unknown>>('./audio/index.ts');
  const load = modules['./audio/index.ts'];
  if (load === undefined) return null;
  const mod = await load();
  const create = mod.createAudio;
  return typeof create === 'function' ? (create as CreateAudioWithExtras) : null;
}

/** Robot de test (`?robot=1`), seulement en développement: absent de la version livrée. */
async function pickRobot(): Promise<Robot | null> {
  if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get('robot') !== '1') return null;
  const { createRobot } = await import('./simulation/robot');
  return createRobot();
}

/**
 * Options graphiques de cette machine (0.13) entre le rendu et l'interface: appliquées à chaud par
 * le rendu, mémorisées à chaque choix et à chaque cran du filet. `null` si le rendu ne les connaît pas.
 */
function graphicsPort(r: Renderer, storage: GraphicsStorage, persistent: boolean): GraphicsPort | null {
  if (r.setGraphicsOptions === undefined || r.graphicsOptions === undefined || r.onGraphicsReduced === undefined) return null;
  r.onGraphicsReduced((options) => {
    saveGraphicsOptions(storage, options);
  });
  return {
    persistent,
    current: () => r.graphicsOptions?.() ?? DEFAULT_GRAPHICS_OPTIONS,
    set: (options) => {
      r.setGraphicsOptions?.(options);
      saveGraphicsOptions(storage, options);
    },
    onReduced: (listener) => r.onGraphicsReduced?.(listener) ?? ((): void => undefined),
  };
}

async function main(): Promise<void> {
  const duo = await connect<GameAction>({ manifest });
  const container = byId('jeu');
  const overlay = byId('interface');
  const status = byId('statut');
  const content = loadContent(CONTENT_FILES);
  const loadedMap = loadMap(MAP_FILES);
  if (loadedMap.warning !== null) duo.log.warn('carte du level designer illisible, carte de secours', { reason: loadedMap.warning });
  duo.reportLoading(1 - RENDER_LOAD_SHARE);

  const session = createSession({ duo, content, map: loadedMap.map, robot: await pickRobot(), now: () => performance.now() });
  const view = session.view;
  let renderer: Renderer | null = null;
  let ui: GameInterface | null = null;
  let sound: GameAudio | null = null;
  const controls = createControls({
    input: duo.input,
    renderer: () => renderer,
    ui: () => ui,
    canvasRect: () => container.getBoundingClientRect(),
  });

  const quality = renderQuality();
  // Le SDK n'offre pas encore de réglages par machine, et le stockage du navigateur est vidé à chaque
  // partie (ADR 0004): les options valent pour la partie.
  const graphicsStorage = sessionGraphicsStorage();

  const setup = async (): Promise<void> => {
    const r = createRenderer({
      view,
      container,
      reducedMotion: duo.ui.reducedMotion,
      quality,
      log: duo.log,
      graphics: loadGraphicsOptions(graphicsStorage),
    });
    await r.load((ratio) => {
      duo.reportLoading(1 - RENDER_LOAD_SHARE + ratio * RENDER_LOAD_SHARE);
    });
    renderer = r;
    const createInterface = await pickInterface();
    const graphics = quality === 'light' ? null : graphicsPort(r, graphicsStorage, false);
    ui = createInterface({
      ...(graphics === null ? {} : { graphics }),
      view,
      overlay,
      uiScale: duo.ui.scale,
      reducedMotion: duo.ui.reducedMotion,
      // Boutons de caméra du HUD (demande 9 de l'interface).
      camera: (command) => {
        r.camera(command);
      },
      // Sons des menus (demande 14 de l'interface): l'audio est créé juste après, `sound` le trouve alors.
      sound: (id) => {
        sound?.ui?.(id);
      },
      // 0.12: aperçu 3D de la boutique de vêtements (petite scène à part, rendue à la demande).
      outfitPreview: (options) => r.createOutfitPreview?.(options) ?? null,
    });
    const createAudio = await pickAudio();
    if (createAudio !== null) {
      const a = createAudio({
        view,
        audio: duo.audio,
        url: (path) => duo.assets.url(path),
        reducedMotion: duo.ui.reducedMotion,
        lifecycle: duo,
        cameraYaw: () => r.cameraYaw(),
        log: duo.log,
      });
      // Un son manquant ne doit jamais empêcher de jouer.
      await a.load(() => undefined).catch((error: unknown) => {
        duo.log.warn('sons non chargés', { message: error instanceof Error ? error.message : String(error) });
      });
      sound = a;
    }
    duo.input.attach(container);
    status.hidden = true;
  };

  // L'invité attend le premier état de l'hôte pour construire la scène.
  let waited = 0;
  while (!session.ready() && waited < GUEST_WORLD_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    waited += POLL_MS;
  }
  let setupStarted = false;
  if (session.ready()) {
    setupStarted = true;
    await setup();
  }
  await duo.ready();

  duo.loop.start({
    hz: SIM_HZ,
    step: () => {
      if (!session.ready()) {
        session.step({ seq: 0, moveX: 0, moveY: 0, actHeld: false });
        return;
      }
      session.step(controls.step(view));
    },
    render: ({ alpha, dt }) => {
      session.beforeFrame(alpha);
      if (!session.ready()) return;
      if (!setupStarted) {
        setupStarted = true;
        void setup();
        return;
      }
      renderer?.frame(dt);
      ui?.frame(dt);
      sound?.frame(dt);
    },
  });

  session.onFinished(() => {
    duo.log.info('séance finie');
  });
  duo.on('stop', () => {
    duo.loop.stop();
    sound?.dispose();
    ui?.dispose();
    renderer?.dispose();
    session.dispose();
    duo.dispose();
  });
}

void main();
