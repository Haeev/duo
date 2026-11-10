/**
 * Point d'entrée: connexion à la plateforme (ou au faux hôte) par le SDK, contenu, séance (hôte
 * ou invité), entrées, boucle à pas fixe. Le rendu 3D (L4), l'interface (L7) et le son (L9) se
 * branchent ici. L'écran du socle et ses repères d'essai ne servent plus que de repli sans WebGL2.
 */
import { connect } from '@duo/sdk';
import manifest from '../duo-game.json';
import type { GameAction } from './actions';
import { loadContent } from './donnees/charger';
import { DATA_FILES } from './donnees/fichiers';
import { createControls } from './entrees/commandes';
import { drawTestMarkers } from './entrees/repere-essai';
import { drawBaseScreen } from './plateforme/ecran-socle';
import { createInterface } from './interface/index';
import { createRenderer } from './rendu/index';
import { createSession } from './session';
import { SIM_HZ } from './simulation/noyau/constantes';

/** Attente du premier état chez l'invité avant de se déclarer prêt (ms), et pas de l'attente. */
const GUEST_WORLD_WAIT_MS = 5000;
const POLL_MS = 50;

const canvas = document.getElementById('scene');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('canvas #scene absent');

const duo = await connect<GameAction>({ manifest });
duo.reportLoading(0.2);
const content = loadContent(DATA_FILES);
const session = createSession({ duo, content });
duo.reportLoading(0.9);

if (duo.role === 'guest') {
  const deadline = performance.now() + GUEST_WORLD_WAIT_MS;
  while (!session.ready() && performance.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
}
duo.reportLoading(1);
await duo.ready();
duo.input.attach(canvas);

const colors = [duo.host.colorHex, duo.guest.colorHex] as const;
// Rendu 3D; sans WebGL2, repli sur le plan 2D du socle et ses repères d'essai.
const renderer = createRenderer({ canvas, view: session.view, playerColors: colors });
if (renderer === null) duo.log.warn('WebGL2 indisponible: plan 2D de repli');
// L'interface HTML se pose sur le canevas; le repli sans WebGL2 n'en a pas besoin (plan d'essai).
const ui =
  renderer === null
    ? null
    : createInterface({
        root: document.body,
        view: session.view,
        send: (intent) => {
          session.view.send(intent);
        },
        cameraYaw: () => renderer.cameraYaw(),
        projectToScreen: (x, y, height) => renderer.projectToScreen(x, y, height),
        keyLabel: (code) => duo.input.keyLabel(code),
        reducedMotion: duo.ui.reducedMotion,
      });
// Sonde des parcours de recette, seulement sur demande de l'adresse (`?sonde=1`).
if (new URLSearchParams(location.search).get('sonde') === '1')
  void import('./plateforme/sonde-essai').then((m) => m.installTestProbe({ session, renderer }));
const controls = createControls({
  input: duo.input,
  view: session.view,
  camera: renderer,
  captured: () => ui?.capturing() ?? false,
});
/** La vue telle que la dessine l'écran de repli: son `world()` rend l'état à afficher de l'image. */
const shown = {
  ...session.view,
  alpha: 0,
  world() {
    return session.view.frame(this.alpha);
  },
};
/** Lieu d'arrivée déjà déclaré chargé pour le voyage en cours. */
let loadedFor: string | null = null;

duo.loop.start({
  hz: SIM_HZ,
  step: () => {
    session.step(controls.step());
    // Dans le wagon, chaque machine construit le lieu d'arrivée puis le dit à l'hôte. Le rendu
    // le construit dès que `common.place` change; sans rendu, les données suffisent.
    const common = session.view.world()?.common;
    if (common?.phase !== 'travel') loadedFor = null;
    else if (common.travel !== null && loadedFor !== common.travel.to) {
      const to = common.travel.to;
      if (renderer === null || renderer.placeId() === to) {
        loadedFor = to;
        session.view.send({ type: 'place_loaded', place: to });
      }
    }
  },
  render: (frame) => {
    if (renderer !== null) {
      renderer.frame(frame.dt, frame.alpha);
      // Après le rendu: la projection lit la caméra de l'image qui vient d'être dessinée.
      ui?.frame(frame.dt);
      return;
    }
    // L'image lit l'état à afficher (interpolé et prédit chez l'invité), pas l'état logique.
    shown.alpha = frame.alpha;
    drawBaseScreen(canvas, shown, colors);
    drawTestMarkers(canvas, shown, colors);
  },
});

duo.on('stop', () => {
  ui?.dispose();
  renderer?.dispose();
  session.dispose();
  duo.dispose();
});
