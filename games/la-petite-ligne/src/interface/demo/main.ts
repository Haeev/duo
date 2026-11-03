/**
 * Page de démonstration de l'interface (`src/interface/demo/index.html`):
 * la vraie simulation, le vrai rendu et l'interface montée par-dessus, sans
 * réseau. L'autre joueur est joué par le robot (`?autre=robot`, par défaut)
 * ou figé (`?autre=fige`). Sert à travailler l'interface et aux captures de
 * Playwright, en attendant `src/main.ts`.
 *
 * Paramètres: `scenario` (voir `scenarios.ts`), `joueur` (p1 ou p2),
 * `taille` (100, 125, 150), `animations=reduites`, `rendu=0` (sans 3D), `temps=arrete`
 * (la simulation ne tourne plus: la situation posée par le scénario reste telle quelle),
 * `onglet=souvenirs` (le carnet s'ouvre sur les Souvenirs), `entrees=sdk` (clavier et souris par
 * l'entrée du SDK et `createControls`, comme dans le jeu: survol, clic, pose à la souris).
 */
import { parseManifest } from '@duo/sdk';
import { createInput } from '../../../../../packages/sdk/src/input';
import manifest from '../../../duo-game.json';
import { createControls } from '../../entrees/commandes';
import type { GameAction } from '../../session';
import type { Intent } from '../../etat/actions';
import type { CharacterId, WorldEvent } from '../../etat/types';
import type { GameInterface, GameView } from '../../etat/vue';
import { withClockPace } from '../../donnees/calendrier';
import { loadContent } from '../../donnees/contenu';
import { CONTENT_FILES } from '../../donnees/fichiers';
import { loadMap } from '../../donnees/carte';
import { MAP_FILES } from '../../donnees/cartes-fichiers';
import { createRenderer } from '../../rendu/index';
import { decodeSave, restoreWorld } from '../../sauvegarde/sauvegarde';
import { createWorld } from '../../simulation/monde';
import { step } from '../../simulation/pas';
import { createRobot } from '../../simulation/robot';
import { SIM_DT } from '../../simulation/constantes';
import { rememberNotebookTab } from '../carnet';
import { patch0122NotebookTab } from './scenarios-0-12-2';
import { createInterface } from '../index';
import { scenarioBoardTab, scenarioSave, setupScenario } from './scenarios';
import { rememberBoardTab } from '../tableau';

declare global {
  interface Window {
    lplInterface?: {
      ready: boolean;
      tick(): number;
      send(intent: Intent): void;
      partner(intent: Intent): void;
      /** Démonte et remonte l'interface `n` fois (contrôle des fuites). */
      remount(n: number): { nodes: number; layers: number; sprites: number };
      /** Durée moyenne de `frame()` de l'interface sur `n` appels (ms). */
      measure(n: number): Promise<number>;
      /** L'état de la simulation de la page (lecture par les tests). */
      world(): typeof sim.world;
      /** Ce que touche le rendu sous ce point de l'écran (coordonnées client), pour viser à la souris. */
      pick(clientX: number, clientY: number): ReturnType<NonNullable<typeof renderer>['pick']>;
      /** Journal de la page: commandes de caméra et sons reçus de l'interface, intentions du joueur local. */
      log: { camera: string[]; intents: string[]; sounds: string[] };
    };
  }
}

const params = new URLSearchParams(location.search);
const me: CharacterId = params.get('joueur') === 'p2' ? 'p2' : 'p1';
const partnerId: CharacterId = me === 'p1' ? 'p2' : 'p1';
// Rythme vif (R14): les situations préparées par les robots restent dans leurs budgets de pas.
const content = withClockPace(loadContent(CONTENT_FILES), 'vif');
const map = loadMap(MAP_FILES).map;
const players = [
  { id: 'membre-a', name: 'Camille', color: '#5CE1E6' },
  { id: 'membre-b', name: 'Sacha', color: '#8D6CFF' },
] as const;
const scenario = params.get('scenario') ?? 'titre';
// Les scénarios de la suite partent d'une sauvegarde de référence: format 5 (tour 8), format 6 (tour 9).
const SAVES = import.meta.glob<{ dataSchema: number; data: unknown }>(['../../../tests/donnees/sauvegardes/format-[567]-*.json', '../../../tests/donnees/sauvegardes/format-13-ete-jour-25.json'], {
  eager: true,
  import: 'default',
});
const saveName = scenarioSave(scenario);
const save = saveName === null ? undefined : SAVES[`../../../tests/donnees/sauvegardes/${saveName}`];
if (saveName !== null && save === undefined) throw new Error(`sauvegarde de référence absente: ${saveName}`);
const sim =
  save === undefined
    ? createWorld(content, map, 20261031, players)
    : restoreWorld(content, map, decodeSave(structuredClone(save.data)), save.dataSchema, players);
const afterMount = setupScenario(sim, scenario, me);
if (params.get('onglet') === 'souvenirs') rememberNotebookTab('memories');
const patchTab = patch0122NotebookTab(scenario);
if (patchTab !== null) rememberNotebookTab(patchTab);
if (params.get('onglet') === 'besoins' || scenario === 'besoins-carnet') rememberNotebookTab('needs');
const boardTab = scenarioBoardTab(scenario);
if (boardTab !== null) rememberBoardTab(boardTab);

const listeners = new Set<(event: WorldEvent) => void>();
const log: { camera: string[]; intents: string[]; sounds: string[] } = { camera: [], intents: [], sounds: [] };
const queue: { by: CharacterId; intent: Intent }[] = [];
const AZERTY: Record<string, string> = { KeyQ: 'A', KeyW: 'Z', KeyA: 'Q', KeyZ: 'W', Space: 'Espace', Enter: 'Entrée', Backspace: 'Retour arrière', Tab: 'Tab' };

const view: GameView = {
  content,
  map,
  role: 'host',
  localCharacter: () => me,
  world: () => sim.world,
  alpha: () => 1,
  send: (intent) => {
    log.intents.push(intent.type);
    queue.push({ by: me, intent });
  },
  onEvent: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  keyLabel: (code) => AZERTY[code] ?? (/^Digit(\d)$/.exec(code)?.[1] ?? code.replace(/^Key/, '')),
};

const scale = Number(params.get('taille') ?? '100') / 100;
const container = document.getElementById('scene');
const overlay = document.getElementById('interface');
if (container === null || overlay === null) throw new Error('page de démonstration incomplète');

const withRender = params.get('rendu') !== '0';
// `rendu=leger`: le mode léger du rendu (captures sous SwiftShader, aperçu 3D de la mercerie).
const renderer = withRender ? createRenderer({ view, container, reducedMotion: false, quality: params.get('rendu') === 'leger' ? 'light' : 'normal' }) : null;
const mountUi = (): GameInterface =>
  createInterface({
    view,
    overlay,
    uiScale: [1, 1.25, 1.5].includes(scale) ? scale : 1,
    reducedMotion: params.get('animations') === 'reduites',
    camera: (command) => {
      log.camera.push(command);
      renderer?.camera(command);
    },
    sound: (id) => {
      log.sounds.push(id);
    },
    outfitPreview: (options) => renderer?.createOutfitPreview?.(options) ?? null,
  });
let ui = mountUi();

// Entrées du jeu (`entrees=sdk`): l'entrée du SDK et les commandes de `src/entrees/`, à la place des écouteurs de la page.
const parsedManifest = parseManifest(manifest);
const sdkInput =
  params.get('entrees') === 'sdk' && parsedManifest.ok ? createInput<GameAction>(parsedManifest.manifest.actions, {}, { onEscape: () => undefined }) : null;
sdkInput?.attach(container);
const gameControls =
  sdkInput === null
    ? null
    : createControls({ input: sdkInput, renderer: () => renderer, ui: () => ui, canvasRect: () => container.getBoundingClientRect() });

const robot = params.get('autre') === 'fige' ? null : createRobot();
const frozen = params.get('temps') === 'arrete';
const held = new Set<string>();
let seq = 0;

window.addEventListener('keydown', (e) => {
  if (gameControls !== null) return;
  if (ui.handleKey(e.code)) {
    e.preventDefault();
    return;
  }
  held.add(e.code);
  if (e.repeat) return;
  const placing = sim.world.characters.find((c) => c.id === me)?.placement ?? null;
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      view.send(placing !== null ? { type: 'place_furniture', cell: placing.cell, rotation: placing.rotation } : { type: 'act' });
      break;
    case 'KeyX':
      view.send({ type: 'examine' });
      break;
    case 'KeyQ':
      renderer?.camera('rotate_left');
      break;
    case 'KeyE':
      renderer?.camera('rotate_right');
      break;
    case 'KeyR':
      renderer?.camera('zoom_in');
      break;
    case 'KeyF':
      renderer?.camera('zoom_out');
      break;
    default: {
      const digit = /^Digit(\d)$/.exec(e.code)?.[1];
      if (digit !== undefined) view.send({ type: 'select_slot', slot: digit === '0' ? 9 : Number(digit) - 1 });
    }
  }
});
window.addEventListener('keyup', (e) => {
  held.delete(e.code);
});
window.addEventListener(
  'wheel',
  (e) => {
    if (gameControls !== null) return;
    const placing = sim.world.characters.find((c) => c.id === me)?.placement ?? null;
    view.send(placing !== null ? { type: 'rotate_furniture', delta: Math.sign(e.deltaY) } : { type: 'cycle_slot', delta: Math.sign(e.deltaY) });
  },
  { passive: true },
);
container.addEventListener('pointerdown', (e) => {
  if (gameControls !== null) return;
  const hit = renderer?.pick(e.clientX, e.clientY) ?? null;
  if (hit !== null) view.send({ type: 'move_to', target: hit, act: e.button === 0 });
});

function controls(): { moveX: number; moveY: number } {
  if (ui.capturesMovement()) return { moveX: 0, moveY: 0 };
  const up = (held.has('KeyW') ? 1 : 0) - (held.has('KeyS') ? 1 : 0);
  const right = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
  const yaw = renderer?.cameraYaw() ?? -0.75 * Math.PI;
  const x = Math.cos(yaw) * up + Math.cos(yaw + Math.PI / 2) * right;
  const y = Math.sin(yaw) * up + Math.sin(yaw + Math.PI / 2) * right;
  const len = Math.hypot(x, y);
  return len > 0 ? { moveX: x / len, moveY: y / len } : { moveX: 0, moveY: 0 };
}

let acc = 0;
let last = performance.now();
function loop(now: number): void {
  acc = Math.min(acc + (now - last) / 1000, 0.25);
  last = now;
  while (!frozen && acc >= SIM_DT) {
    acc -= SIM_DT;
    seq++;
    const frame = gameControls?.step(view) ?? { seq, ...controls(), actHeld: held.has('Space') && !ui.capturesMovement() };
    const intents = queue.splice(0);
    const input = { controls: { [me]: frame }, intents };
    if (robot !== null) {
      const auto = robot.decide(sim);
      const partnerControl = auto.controls[partnerId];
      if (partnerControl !== undefined) input.controls[partnerId] = partnerControl;
      for (const i of auto.intents) if (i.by === partnerId) input.intents.push(i);
    }
    step(sim, input);
    sdkInput?.endStep();
    for (const event of sim.events) for (const l of listeners) l(event);
  }
  renderer?.frame(1 / 60);
  ui.frame(1 / 60);
  requestAnimationFrame(loop);
}

async function start(): Promise<void> {
  if (renderer !== null) await renderer.load(() => undefined);
  window.lplInterface = {
    ready: true,
    tick: () => sim.world.tick,
    send: (intent) => {
      queue.push({ by: me, intent });
    },
    partner: (intent) => {
      queue.push({ by: partnerId, intent });
    },
    world: () => sim.world,
    pick: (clientX, clientY) => renderer?.pick(clientX, clientY) ?? null,
    log,
    remount: (n) => {
      for (let i = 0; i < n; i++) {
        ui.dispose();
        ui = mountUi();
        ui.frame(1 / 60);
      }
      return {
        nodes: document.getElementsByTagName('*').length,
        layers: document.querySelectorAll('.lpl-ui').length,
        sprites: document.querySelectorAll('#lpl-icones').length,
      };
    },
    measure: async (n) => {
      // Rafraîchissement complet (révision changée, délai minimal écoulé): le pire cas d'une image.
      let total = 0;
      for (let i = 0; i < n; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        sim.world.revision += 1;
        const start = performance.now();
        ui.frame(1 / 60);
        total += performance.now() - start;
      }
      return total / n;
    },
  };
  requestAnimationFrame(loop);
  // La suite du scénario, une fois l'interface montée et ses notifications d'avant vues.
  if (afterMount !== undefined) {
    window.setTimeout(() => {
      afterMount();
      sim.world.revision += 1;
    }, 400);
  }
}

void start();
