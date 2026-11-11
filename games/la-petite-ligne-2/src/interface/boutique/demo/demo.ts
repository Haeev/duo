/**
 * Démonstration de la boutique sur une vraie simulation (achats et ventes passent par le système
 * des commerces). États par l'ancre: `#acheter`, `#vendre`, `#refus` (objet refusé), `#achat`
 * (achat fait), `#vente` (vente faite), `#pauvre` (bourse insuffisante). Un second commerce et
 * son tenancier sont ajoutés ici seulement, pour montrer la mémoire des prix et sa couronne.
 * `#mercerie`: la vraie mercerie de Solange à Aubrune, ses pièces de tenue (vignettes 3D de
 * l'aperçu de l'éditeur), la casquette déjà à toi; `#mercerie-achat`: le gilet acheté;
 * `#mercerie-a-toi`: la casquette choisie (mention « À toi », sans bouton).
 */
import { loadContent } from '../../../donnees/charger';
import { DATA_FILES } from '../../../donnees/fichiers';
import type { PlayerIndex } from '../../../donnees/schemas/communs';
import { bondKey } from '../../../etat/progression';
import { idleInput, type Intent } from '../../../simulation/noyau/entrees';
import type { GameEvent } from '../../../simulation/noyau/evenements';
import { createWorld } from '../../../simulation/noyau/monde';
import { pieceKey } from '../../../simulation/regles/recompenses';
import { createCharacterPreview } from '../../../rendu/personnages/apercu';
import { createSim, step } from '../../../simulation/noyau/pas';
import { createInterface } from '../../index';
import { loadPortraits } from '../../portrait';

// Thème sombre validé par le client, posé comme dans `main.ts`; `?interface=ancien`: l'habillage clair.
if (new URLSearchParams(location.search).get('interface') !== 'ancien')
  document.documentElement.dataset.lplStyle = 'encre';

// Portraits dessinés: lot à part, attendu avant toute interface (comme `main.ts`).
await loadPortraits();

const files: Record<string, unknown> = { ...DATA_FILES };
files['lieux/essai-gare/habitants/boulanger-demo.json'] = {
  schema: 1,
  id: 'boulanger-demo',
  name: 'Le boulanger',
  temper: 'grumpy',
  look: null,
  stands: 'quai',
  voice: 'low',
};
files['lieux/essai-gare/commerces/fournil-demo.json'] = {
  schema: 1,
  id: 'fournil-demo',
  name: 'Fournil',
  keeper: 'boulanger-demo',
  hours: { from: 300, to: 1200 },
  sells: [],
  buys: [{ item: 'pomme', price: 90 }],
};
const state = location.hash.slice(1) || 'acheter';
/** La mercerie d'Aubrune: la partie part au bourg, à l'heure où Solange tient boutique. */
const mercerie = state.startsWith('mercerie');
if (mercerie) {
  const settings = files['commun/reglages.json'] as { start: Record<string, unknown> };
  settings.start = { ...settings.start, place: 'aubrune', minute: 640 };
}
const content = loadContent(files);
const world = createWorld(content, 7, [
  { id: 'a', name: 'Camille' },
  { id: 'b', name: 'Sacha' },
]);
const sim = createSim(content, world);
const me = world.players[0];
world.minutes = 10 * 60 + 40;
me.money = state === 'pauvre' ? 150 : 2140;
world.common.chest = 5000;
me.body.x = 21.8;
me.body.y = 15.2;
me.toolbar[0] = { item: 'pomme', count: 4 };
me.toolbar[1] = { item: 'buche', count: 5 };
me.toolbar[2] = { item: 'planche', count: 10 };
me.toolbar[3] = { item: 'hache', count: 1 };
world.progress.bonds[bondKey('cheffe-de-gare', 0)] = 120;
world.progress.prices.pomme = { 'fournil-demo': 90 };
world.progress.prices.planche = {};
const MERCERIE = 'mercerie-merigot';
if (mercerie) {
  // Au comptoir de Solange (sinon près d'elle): la portée des achats est celle du jeu.
  const counter = content.places.aubrune?.map.objects.find((o) => o.id === 'mercerie-comptoir');
  const keeper = world.places.aubrune?.villagers.solange?.body;
  me.body.x = counter?.x ?? keeper?.x ?? me.body.x;
  me.body.y = (counter?.y ?? keeper?.y ?? me.body.y) + 1;
  me.money = state === 'mercerie-achat' ? 4140 : 2140;
  world.progress.memory[pieceKey('hat-cap', 0)] = { v: true, by: 0, day: 1 };
}

const listeners = new Set<(event: GameEvent) => void>();
const root = document.getElementById('ui');
if (!(root instanceof HTMLElement)) throw new Error('#ui absent');
const sent = document.getElementById('envoi');
const queue: { player: PlayerIndex; intent: Intent }[] = [];

const ui = createInterface({
  root,
  view: {
    content,
    world: () => world,
    localIndex: (): PlayerIndex => 0,
    aim: () => null,
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  },
  send(intent) {
    if (sent !== null) sent.textContent = JSON.stringify(intent);
    queue.push({ player: 0, intent });
  },
  cameraYaw: () => 0,
  // Vignettes 3D des pièces de tenue, comme en jeu (`main.ts`).
  characterPreview: (canvas) => createCharacterPreview(canvas, content),
  // La photo d'identité est faite: la démonstration montre la boutique, pas l'éditeur.
  editorAtStart: false,
});

function press(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
}

let last = performance.now();
function loop(t: number): void {
  step(sim, [idleInput(world.tick), idleInput(world.tick)], queue.splice(0));
  for (const event of sim.events) for (const listener of listeners) listener(event);
  ui.frame((t - last) / 1000);
  last = t;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/** Ouvre la boutique comme la touche d'action sur le comptoir, puis joue les touches de l'état. */
if (mercerie)
  // Comptoir tenu: la touche d'action irait d'abord à une réplique d'histoire en attente de Solange.
  setTimeout(() => {
    const opened: GameEvent = { type: 'shop_opened', player: 0, shop: MERCERIE };
    for (const listener of listeners) listener(opened);
  }, 100);
else
  queue.push({
    player: 0,
    intent: { type: 'use_brick', target: 'comptoir-buvette', brick: 'shop' },
  });
const keys: Readonly<Record<string, readonly string[]>> = {
  acheter: ['ArrowRight', 'KeyD'],
  pauvre: ['ArrowRight', 'ArrowRight'],
  achat: ['KeyD', 'Enter'],
  vendre: ['KeyE', 'KeyD', 'KeyD'],
  vente: ['KeyE', 'KeyD', 'KeyD', 'Enter'],
  refus: ['KeyE', 'ArrowRight', 'ArrowRight', 'Enter'],
  mercerie: ['ArrowRight'],
  'mercerie-achat': ['ArrowRight', 'Enter'],
  'mercerie-a-toi': [
    'ArrowRight',
    'ArrowRight',
    'ArrowRight',
    'ArrowRight',
    'ArrowRight',
    'ArrowRight',
  ],
};
// La mercerie s'ouvre par son événement, puis la garde d'ouverture de l'écran passe.
let delay = mercerie ? 2000 : 500;
for (const code of keys[state] ?? []) {
  setTimeout(() => {
    press(code);
  }, delay);
  delay += 350;
}
setTimeout(() => {
  document.body.dataset.ready = 'oui';
}, delay + 300);
