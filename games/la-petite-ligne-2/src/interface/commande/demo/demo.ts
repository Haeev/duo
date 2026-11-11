/**
 * Démonstration de l'écran de livraison sur une vraie simulation d'Aubrune: après l'acte 2, le
 * premier samedi, train à quai, à côté de Rosalie. États par l'ancre: `#livraison` (une ligne
 * livrée, une autre en partie, le courrier qui attend), `#lettre` (courrier pris, la première
 * lettre ouverte), `#vide` (rien en main: Rosalie dit qu'on livrera plus tard). Thème sombre:
 * `data-lpl-style="encre"` sur la racine, comme `main.ts`. Sert aux captures.
 */
import { loadContent } from '../../../donnees/charger';
import { DATA_FILES } from '../../../donnees/fichiers';
import type { PlayerIndex } from '../../../donnees/schemas/communs';
import { obtainedKey, orderView } from '../../../simulation/commandes/lecture';
import { calendarOf } from '../../../simulation/monde/calendrier';
import { idleInput, type Intent } from '../../../simulation/noyau/entrees';
import type { GameEvent } from '../../../simulation/noyau/evenements';
import { createWorld } from '../../../simulation/noyau/monde';
import { createSim, step } from '../../../simulation/noyau/pas';
import { createInterface } from '../../index';
import { loadPortraits } from '../../portrait';

await loadPortraits();

const files: Record<string, unknown> = { ...DATA_FILES };
const settings = files['commun/reglages.json'] as { start: Record<string, unknown> };
settings.start = { ...settings.start, place: 'aubrune', minute: 600 };
const content = loadContent(files);
const world = createWorld(content, 7, [
  { id: 'a', name: 'Camille' },
  { id: 'b', name: 'Sacha' },
]);
const sim = createSim(content, world);
const state = location.hash.slice(1) || 'livraison';
const idle = (): Parameters<typeof step>[1] => [idleInput(world.tick), idleInput(world.tick)];
const fact = (key: string, v: string | number | boolean): void => {
  world.progress.memory[key] = { v, by: 'duo', day: 1 };
};

// L'histoire jusqu'à la fin de l'acte 2, et ce que le duo sait déjà produire.
for (const key of ['aubrune.acte1.fini', 'aubrune.acte2.train', 'aubrune.acte2.fini'])
  fact(key, true);
for (const item of ['radis', 'carotte', 'oeuf', 'buche', 'goujon', 'perche', 'omelette'])
  fact(obtainedKey(item), true);
step(sim, idle(), []);
let saturday = 2;
while (calendarOf(content, saturday).weekday !== 'saturday') saturday++;
world.common.day = saturday;
world.minutes = 10 * 60 + 20;
// Une seconde de simulation: la commande se tire, le train arrive, Rosalie descend.
for (let i = 0; i < 90; i++) step(sim, idle(), []);
if (world.common.story !== undefined) world.common.story.scene = null;

const me = world.players[0];
me.money = 2_140;
world.common.chest = 18_350;
me.toolbar = me.toolbar.map(() => null);
if (me.bag !== null) me.bag.slots = me.bag.slots.map(() => null);
const rosalie = world.places.aubrune?.villagers.rosalie?.body;
if (rosalie !== undefined) {
  me.body.x = rosalie.x + 0.8;
  me.body.y = rosalie.y;
}
const lines = orderView(content, world, 'aubrune')?.lines ?? [];
const queue: { player: PlayerIndex; intent: Intent }[] = [];
if (state !== 'vide') {
  // De quoi livrer: la première ligne en entier, la deuxième à moitié (une part dans la consigne),
  // la troisième en entier mais pas encore livrée.
  const [full, half, ready] = lines;
  const consigne = world.places.aubrune?.objects['halte-consigne']?.store;
  me.toolbar[0] = full === undefined ? null : { item: full.item, count: full.asked };
  me.toolbar[1] =
    half === undefined ? null : { item: half.item, count: Math.max(1, half.asked - 3) };
  me.toolbar[2] = ready === undefined ? null : { item: ready.item, count: ready.asked };
  if (consigne !== undefined && ready !== undefined) consigne[0] = { item: ready.item, count: 2 };
  if (full !== undefined)
    queue.push({ player: 0, intent: { type: 'order_deliver', line: full.id } });
  if (half !== undefined)
    queue.push({ player: 0, intent: { type: 'order_deliver', line: half.id } });
  if (state === 'lettre') queue.push({ player: 0, intent: { type: 'mail_take' } });
}

const listeners = new Set<(event: GameEvent) => void>();
const root = document.getElementById('ui');
if (!(root instanceof HTMLElement)) throw new Error('#ui absent');
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
    queue.push({ player: 0, intent });
  },
  cameraYaw: () => 0,
  editorAtStart: false,
});

// L'écran s'ouvre comme après « Livrer la commande », puis les livraisons de l'état partent.
const opened: GameEvent = { type: 'order_opened', player: 0, place: 'aubrune' };
for (const listener of listeners) listener(opened);

let last = performance.now();
function loop(t: number): void {
  step(sim, idle(), queue.splice(0));
  for (const event of sim.events) for (const listener of listeners) listener(event);
  ui.frame(Math.min(0.25, (t - last) / 1000));
  last = t;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
setTimeout(() => {
  document.body.dataset.ready = 'oui';
}, 1500);
