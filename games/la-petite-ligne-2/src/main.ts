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
import { showNetAlert } from './plateforme/alerte-reseau';
import { drawBaseScreen } from './plateforme/ecran-socle';
import { createInterface } from './interface/index';
import { createRenderer, gameDecorModels } from './rendu/index';
import { createCharacterPreview } from './rendu/personnages/apercu';
import { createGameObjectViewer } from './rendu/objets/index';
import { createSession } from './session';
import { createGameAudio } from './audio/index';
import { createSurfaceLookup } from './audio/sol';
import { createGameMusic } from './audio/musique/index';
import { DEFAULT_UI_SETTINGS } from './interface/carnet/lectures';
import { memorySettings } from './interface/carnet/options';
import { parsePlan } from './interface/carnet/plan';
import { DEFAULT_GRAPHICS_OPTIONS } from './rendu/options';
import planAubrune from '../donnees/lieux/aubrune/plan.json';
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
// Jeux incompatibles ou message refusé: dit au joueur, au-dessus de tout (ADR 0006).
const offNetAlert = session.onAlert((alert) => {
  showNetAlert(document.body, alert);
});
duo.reportLoading(0.9);

if (duo.role === 'guest') {
  const deadline = performance.now() + GUEST_WORLD_WAIT_MS;
  while (!session.ready() && !session.blocked() && performance.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
}
duo.reportLoading(1);
await duo.ready();
duo.input.attach(canvas);

const colors = [duo.host.colorHex, duo.guest.colorHex] as const;
/** Parcours de recette (`?sonde=1`): sonde installée, pas d'éditeur de personnage au départ. */
const probed = new URLSearchParams(location.search).get('sonde') === '1';
// Rendu 3D; sans WebGL2, repli sur le plan 2D du socle et ses repères d'essai.
// Décors chargés avant le premier lieu: sinon il garderait ses formes provisoires.
await gameDecorModels().ready;
const renderer = createRenderer({ canvas, view: session.view, playerColors: colors });
if (renderer === null) duo.log.warn('WebGL2 indisponible: plan 2D de repli');
// Son et musique: nés des événements de l'hôte et de l'état, entendus chez les deux joueurs.
const sound = createGameAudio({
  audio: duo.audio,
  view: session.view,
  random: duo.random('son'),
  cameraYaw: () => renderer?.cameraYaw() ?? 0,
  surfaceAt: createSurfaceLookup(session.view, (x, y) => renderer?.surfaceAt(x, y) ?? null),
  warn: (message, data) => {
    duo.log.warn(message, data);
  },
});
const music = createGameMusic({
  audio: duo.audio,
  view: session.view,
  random: duo.random('musique'),
  warn: (message, data) => {
    duo.log.warn(message, data);
  },
});
// Réglages du carnet: volume par le son, qualité par le rendu. Le plan n'existe que pour Aubrune
// (les lieux d'essai n'en ont pas: l'onglet Carte le dit).
// Vignettes 3D des objets dans les menus (sac, barre, boutique).
const objectViewer = createGameObjectViewer(content.items, { reducedMotion: duo.ui.reducedMotion });
const aubrunePlan = parsePlan(planAubrune);
if (aubrunePlan === null) duo.log.warn('plan d’Aubrune illisible: onglet Carte vide');
const plans = aubrunePlan === null ? {} : { aubrune: aubrunePlan };
const settings = memorySettings(
  {
    get: () => renderer?.graphics() ?? DEFAULT_GRAPHICS_OPTIONS,
    set: (options) => {
      renderer?.setGraphics(options);
    },
  },
  { ...DEFAULT_UI_SETTINGS, volume: Math.round(sound.settings().master * 100) },
  (next) => {
    sound.setSettings({ master: next.volume / 100 });
  },
);
// Thème sombre de l'interface (validé par le client le 10 novembre): `?interface=ancien` rend
// l'habillage clair d'avant, pour comparer.
if (new URLSearchParams(location.search).get('interface') !== 'ancien')
  document.documentElement.dataset.lplStyle = 'encre';
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
        playerColors: colors,
        characterPreview: (surface) => createCharacterPreview(surface, content),
        onBabble: (info) => {
          sound.onBabble(info);
        },
        onCue: (cue) => {
          sound.cue(cue);
        },
        notebook: {
          settings,
          sourcesExtras: { plans },
          // Bouton « Écouter » des airs du carnet: local à ce joueur, par la régie de musique.
          listen: {
            can: (id) => music.listenable(id),
            play: (id) => {
              music.listen(id);
            },
            stop: () => {
              music.stopListening();
            },
            current: () => music.listening(),
          },
        },
        objectViewer,
        editorAtStart: !probed,
      });
// Reprise de partie: ce que la sauvegarde a donné à dire (partie neuve, invité remplacé).
if (session.notice !== null) ui?.notice(session.notice.message);
// Pause de la plateforme: on enregistre (l'hôte seul écrit; chez l'invité, refus silencieux).
duo.on('pause', () => {
  void session.saveNow();
});
// Sonde des parcours de recette, seulement sur demande de l'adresse (`?sonde=1`).
if (probed)
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
      sound.frame(frame.dt);
      music.frame(frame.dt);
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
  offNetAlert();
  ui?.dispose();
  music.dispose();
  sound.dispose();
  objectViewer.dispose();
  renderer?.dispose();
  session.dispose();
  duo.dispose();
});
