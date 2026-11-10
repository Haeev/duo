/**
 * Démonstration du style encré: la vraie interface du jeu (HUD, dialogue, carnet, boutique) posée
 * sur une image de fond, et la planche des composants. Sert aux captures et à la revue.
 *
 * Paramètres de l'adresse:
 * - `ecran`: `hud` (défaut), `dialogue`, `dialogue-choix`, `carnet`, `boutique`,
 *   `boutique-refus`, `planche`;
 * - `fond`: `exterieur-jour` (défaut), `exterieur-nuit`, `interieur-jour`. La capture du moteur
 *   `docs/jeux/jeu-1/refonte/captures/encre-<fond>.png` est prise si elle existe, sinon le fond
 *   provisoire peint à la main;
 * - `style=ancien`: la même scène sans le thème, pour comparer;
 * - `mouvement=reduit`: animations réduites;
 * - `cible=x,y`: point de l'écran (fractions de 0 à 1) où s'accroche la bulle d'action.
 * `document.body.dataset.ready` passe à `oui` quand l'état demandé est installé.
 */
import { loadContent } from '../../../donnees/charger';
import { DATA_FILES } from '../../../donnees/fichiers';
import type { PlayerIndex } from '../../../donnees/schemas/communs';
import type { Aim } from '../../../simulation/briques/types';
import { idleInput, type Intent } from '../../../simulation/noyau/entrees';
import type { GameEvent } from '../../../simulation/noyau/evenements';
import { createWorld } from '../../../simulation/noyau/monde';
import { createSim, step } from '../../../simulation/noyau/pas';
import { dummySources } from '../../carnet/fictif';
import { parsePlan } from '../../carnet/plan';
import { memoryFollow } from '../../carnet/quetes';
import { createInterface } from '../../index';
import planAubrune from '../../../../donnees/lieux/aubrune/plan.json';
import { provisionalBackdrop } from './fond';
import { mountSheet } from './planche';

const SCREENS = [
  'hud',
  'dialogue',
  'dialogue-choix',
  'carnet',
  'boutique',
  'boutique-refus',
  'planche',
] as const;
type Screen = (typeof SCREENS)[number];
const BACKDROPS = ['exterieur-jour', 'exterieur-nuit', 'interieur-jour'] as const;
type Backdrop = (typeof BACKDROPS)[number];

const params = new URLSearchParams(location.search);
const pick = <T extends string>(list: readonly T[], value: string | null, fallback: T): T =>
  list.find((item) => item === value) ?? fallback;
const screen: Screen = pick(SCREENS, params.get('ecran'), 'hud');
const backdrop: Backdrop = pick(BACKDROPS, params.get('fond'), 'exterieur-jour');

// Captures du moteur déjà déposées: seules celles qui existent sont connues de Vite.
const captures: Record<string, string> = import.meta.glob(
  '../../../../../../docs/jeux/jeu-1/refonte/captures/encre-*.png',
  { eager: true, query: '?url', import: 'default' },
);
const fond = document.getElementById('fond');
const root = document.getElementById('ui');
if (!(fond instanceof HTMLElement) || !(root instanceof HTMLElement))
  throw new Error('#fond ou #ui absent');
const capture = Object.entries(captures).find(([path]) => path.endsWith(`encre-${backdrop}.png`));
fond.dataset.fond = backdrop;
if (capture !== undefined) fond.style.backgroundImage = `url("${capture[1]}")`;
else {
  fond.innerHTML = provisionalBackdrop(
    backdrop === 'interieur-jour' ? 'interieur' : 'exterieur',
    backdrop === 'exterieur-nuit' ? 'nuit' : 'crepuscule',
  );
  document.getElementById('monde')?.removeAttribute('hidden');
}
if (params.get('style') !== 'ancien') root.dataset.lplStyle = 'encre';

function ready(): void {
  document.body.dataset.ready = 'oui';
}

function press(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
}

/** Joue des touches l'une après l'autre, puis signale que l'état est installé. */
function play(codes: readonly string[], start: number, gap = 150): void {
  let delay = start;
  for (const code of codes) {
    setTimeout(() => {
      press(code);
    }, delay);
    delay += gap;
  }
  setTimeout(ready, delay + 300);
}

if (screen === 'planche') {
  mountSheet(root);
  document.getElementById('monde')?.setAttribute('hidden', '');
  ready();
} else {
  const content = loadContent(DATA_FILES);
  const world = createWorld(content, 7, [
    { id: 'a', name: 'Camille' },
    { id: 'b', name: 'Sacha' },
  ]);
  const me = world.players[0];
  const night = backdrop === 'exterieur-nuit';
  // Fond provisoire au crépuscule (thème sombre): l'horloge dit la même heure que le ciel.
  world.minutes = night ? 21 * 60 + 20 : 18 * 60 + 40;
  world.common.day = 3;
  world.common.weather = night ? 'clear' : 'overcast';
  world.common.chest = 5000;
  me.money = 21_450;
  me.toolbar[0] = { item: 'hache', count: 1, wear: 6 };
  me.toolbar[1] = { item: 'pomme', count: 4 };
  me.toolbar[2] = { item: 'pain', count: 2 };
  me.selected = 0;

  const shopping = screen === 'boutique' || screen === 'boutique-refus';
  let aim: Aim | null = null;
  if (screen === 'hud') {
    // Un besoin vient de passer bas: son médaillon apparaît à côté de l'horloge.
    me.needs.hunger = 22;
    me.tiers.hunger = 'low';
    aim = {
      kind: 'prop',
      id: 'pommier',
      action: 'gather',
      verb: 'Cueillir',
      refusal: null,
      x: 0,
      y: 0,
    };
  }
  if (screen === 'dialogue' || screen === 'dialogue-choix') {
    // De vraies répliques d'Aubrune: une page à lire, puis une question et ses réponses.
    world.common.place = 'aubrune';
    me.talk =
      screen === 'dialogue'
        ? { villager: 'firmin', dialogue: 'firmin-lettre', node: 'debut' }
        : { villager: 'firmin', dialogue: 'firmin-matin', node: 'debut' };
  }
  if (screen === 'carnet') {
    me.body.x = 140;
    me.body.y = 104;
  }
  if (shopping) {
    me.money = 2140;
    me.body.x = 21.8;
    me.body.y = 15.2;
    me.toolbar[0] = { item: 'pomme', count: 4 };
    me.toolbar[1] = { item: 'buche', count: 5 };
    me.toolbar[2] = { item: 'planche', count: 10 };
    me.toolbar[3] = { item: 'hache', count: 1 };
  }

  const sim = shopping ? createSim(content, world) : null;
  const queue: { player: PlayerIndex; intent: Intent }[] = [];
  const listeners = new Set<(event: GameEvent) => void>();
  const [tx, ty] = (params.get('cible') ?? '').split(',').map(Number);
  const target =
    tx !== undefined && ty !== undefined && Number.isFinite(tx) && Number.isFinite(ty)
      ? { x: tx, y: ty }
      : backdrop === 'exterieur-jour' && capture === undefined
        ? { x: 0.505, y: 0.2 }
        : null;

  const ui = createInterface({
    root,
    view: {
      content,
      world: () => world,
      localIndex: (): PlayerIndex => 0,
      aim: () => aim,
      onEvent(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    send(intent) {
      queue.push({ player: 0, intent });
    },
    cameraYaw: () => 0,
    ...(target === null
      ? {}
      : {
          projectToScreen: () => ({
            x: target.x * window.innerWidth,
            y: target.y * window.innerHeight,
          }),
        }),
    reducedMotion: params.get('mouvement') === 'reduit',
    notebook: {
      sources: dummySources(parsePlan(planAubrune), ['M', 'F', 'T', 'C']),
      follow: memoryFollow('histoire'),
    },
    editorAtStart: false,
  });

  let last = performance.now();
  const loop = (t: number): void => {
    if (sim !== null) {
      step(sim, [idleInput(world.tick), idleInput(world.tick)], queue.splice(0));
      for (const event of sim.events) for (const listener of listeners) listener(event);
    } else queue.length = 0;
    ui.frame((t - last) / 1000);
    last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  if (screen === 'hud') {
    // Changer d'objet en main fait paraître la barre, comme en jeu.
    setTimeout(() => {
      me.selected = 1;
    }, 200);
    play([], 300);
  }
  if (screen === 'dialogue') play(['Space'], 700);
  if (screen === 'dialogue-choix') {
    // La question reste à l'écran pendant qu'on choisit la réponse.
    setTimeout(() => {
      press('Space');
    }, 700);
    setTimeout(() => {
      if (me.talk !== null) me.talk = { ...me.talk, node: 'choix' };
    }, 900);
    play(['ArrowDown'], 1200);
  }
  if (screen === 'carnet') play(['KeyC', 'KeyE'], 300, 500);
  if (shopping) {
    queue.push({
      player: 0,
      intent: { type: 'use_brick', target: 'comptoir-buvette', brick: 'shop' },
    });
    play(
      screen === 'boutique'
        ? ['ArrowRight', 'KeyD']
        : ['KeyE', 'ArrowRight', 'ArrowRight', 'Enter'],
      900,
      250,
    );
  }
}
