/**
 * Point d'entrée: connexion à la plateforme (ou au faux hôte) par le SDK, contenu, séance (hôte
 * ou invité), entrées, boucle à pas fixe. Le rendu 3D (L4), l'interface (L7) et le son (L9) se
 * branchent ici, à la place de l'écran du socle et de ses repères d'essai.
 */
import { connect } from '@duo/sdk';
import manifest from '../duo-game.json';
import type { GameAction } from './actions';
import { loadContent } from './donnees/charger';
import { DATA_FILES } from './donnees/fichiers';
import { createControls } from './entrees/commandes';
import { drawTestMarkers } from './entrees/repere-essai';
import { drawBaseScreen } from './plateforme/ecran-socle';
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
// Le lacet de la caméra libre viendra du rendu (lot L4); le plan 2D du socle regarde le nord.
const controls = createControls({ input: duo.input, view: session.view, cameraYaw: () => 0 });
/** La vue telle que la dessine l'écran du socle: son `world()` rend l'état à afficher de l'image. */
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
    // Dans le wagon, chaque machine charge le lieu d'arrivée puis le dit à l'hôte. Les données
    // sont déjà là; le rendu (L4) enverra `place_loaded` quand ses modèles seront prêts.
    const common = session.view.world()?.common;
    if (common?.phase !== 'travel') loadedFor = null;
    else if (common.travel !== null && loadedFor !== common.travel.to) {
      loadedFor = common.travel.to;
      session.view.send({ type: 'place_loaded', place: loadedFor });
    }
  },
  render: (frame) => {
    // L'image lit l'état à afficher (interpolé et prédit chez l'invité), pas l'état logique.
    shown.alpha = frame.alpha;
    drawBaseScreen(canvas, shown, colors);
    drawTestMarkers(canvas, shown, colors);
  },
});

duo.on('stop', () => {
  session.dispose();
  duo.dispose();
});
