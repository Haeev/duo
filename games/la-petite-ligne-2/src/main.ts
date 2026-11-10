/**
 * Point d'entrée: connexion à la plateforme (ou au faux hôte) par le SDK, contenu, séance (hôte
 * ou invité), boucle à pas fixe. Le rendu 3D (L4), l'interface (L7), le son (L9) et les entrées
 * complètes (L2) se branchent ici, à la place de l'écran du socle.
 */
import { connect } from '@duo/sdk';
import manifest from '../duo-game.json';
import type { GameAction } from './actions';
import { loadContent } from './donnees/charger';
import { DATA_FILES } from './donnees/fichiers';
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

let seq = 0;
const colors = [duo.host.colorHex, duo.guest.colorHex] as const;

duo.loop.start({
  hz: SIM_HZ,
  step: () => {
    seq += 1;
    // Repère du monde: x vers l'est, y vers le sud. La caméra libre (L4) tournera ce vecteur.
    const moveX = (duo.input.isDown('right') ? 1 : 0) - (duo.input.isDown('left') ? 1 : 0);
    const moveY = (duo.input.isDown('down') ? 1 : 0) - (duo.input.isDown('up') ? 1 : 0);
    const norm = moveX !== 0 && moveY !== 0 ? Math.SQRT1_2 : 1;
    if (duo.input.wasPressed('act')) session.view.send({ type: 'act' });
    session.step({
      seq,
      moveX: moveX * norm,
      moveY: moveY * norm,
      run: duo.input.isDown('run'),
      act: duo.input.isDown('act'),
    });
  },
  render: () => {
    drawBaseScreen(canvas, session.view, colors);
  },
});

duo.on('stop', () => {
  session.dispose();
  duo.dispose();
});
