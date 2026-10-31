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
import type { CreateInterface, GameInterface, Renderer } from './etat/vue';
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

/** Robot de test (`?robot=1`), seulement en développement: absent de la version livrée. */
async function pickRobot(): Promise<Robot | null> {
  if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get('robot') !== '1') return null;
  const { createRobot } = await import('./simulation/robot');
  return createRobot();
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
  const controls = createControls({
    input: duo.input,
    renderer: () => renderer,
    ui: () => ui,
    canvasRect: () => container.getBoundingClientRect(),
  });

  const setup = async (): Promise<void> => {
    const r = createRenderer({ view, container, reducedMotion: duo.ui.reducedMotion });
    await r.load((ratio) => {
      duo.reportLoading(1 - RENDER_LOAD_SHARE + ratio * RENDER_LOAD_SHARE);
    });
    renderer = r;
    const createInterface = await pickInterface();
    ui = createInterface({ view, overlay, uiScale: duo.ui.scale, reducedMotion: duo.ui.reducedMotion });
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
    },
  });

  session.onFinished(() => {
    duo.log.info('séance finie');
  });
  duo.on('stop', () => {
    duo.loop.stop();
    ui?.dispose();
    renderer?.dispose();
    session.dispose();
    duo.dispose();
  });
}

void main();
