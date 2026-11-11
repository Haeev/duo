/**
 * Démonstration de la boutique sur une vraie simulation (achats et ventes passent par le système
 * des commerces). États par l'ancre: `#acheter`, `#vendre`, `#refus` (objet refusé), `#achat`
 * (achat fait), `#vente` (vente faite), `#pauvre` (bourse insuffisante). Un second commerce et
 * son tenancier sont ajoutés ici seulement, pour montrer la mémoire des prix et sa couronne.
 */
import { loadContent } from '../../../donnees/charger';
import { DATA_FILES } from '../../../donnees/fichiers';
import type { PlayerIndex } from '../../../donnees/schemas/communs';
import { bondKey } from '../../../etat/progression';
import { idleInput, type Intent } from '../../../simulation/noyau/entrees';
import type { GameEvent } from '../../../simulation/noyau/evenements';
import { createWorld } from '../../../simulation/noyau/monde';
import { createSim, step } from '../../../simulation/noyau/pas';
import { createInterface } from '../../index';
import { loadPortraits } from '../../portrait';

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
const content = loadContent(files);
const world = createWorld(content, 7, [
  { id: 'a', name: 'Camille' },
  { id: 'b', name: 'Sacha' },
]);
const sim = createSim(content, world);
const state = location.hash.slice(1) || 'acheter';
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
queue.push({ player: 0, intent: { type: 'use_brick', target: 'comptoir-buvette', brick: 'shop' } });
const keys: Readonly<Record<string, readonly string[]>> = {
  acheter: ['ArrowRight', 'KeyD'],
  pauvre: ['ArrowRight', 'ArrowRight'],
  achat: ['KeyD', 'Enter'],
  vendre: ['KeyE', 'KeyD', 'KeyD'],
  vente: ['KeyE', 'KeyD', 'KeyD', 'Enter'],
  refus: ['KeyE', 'ArrowRight', 'ArrowRight', 'Enter'],
};
let delay = 500;
for (const code of keys[state] ?? []) {
  setTimeout(() => {
    press(code);
  }, delay);
  delay += 150;
}
setTimeout(() => {
  document.body.dataset.ready = 'oui';
}, delay + 300);
