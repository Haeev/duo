/**
 * Démonstration de la basse-cour sur une vraie simulation (poulailler d'essai, trois poules),
 * selon l'ancre: `#normal` (grain et œufs, après deux jours), `#vide` (une semaine sans grain),
 * `#plein` (nid plein, une quatrième poule, caresse). Les touches marchent: Q et D, Espace, Retour.
 */
import { loadContent } from '../../../donnees/charger';
import { DATA_FILES } from '../../../donnees/fichiers';
import type { PlayerIndex } from '../../../donnees/schemas/communs';
import type { Intent } from '../../../simulation/noyau/entrees';
import type { GameEvent } from '../../../simulation/noyau/evenements';
import { createWorld } from '../../../simulation/noyau/monde';
import { createSim, step as stepSim } from '../../../simulation/noyau/pas';
import { idleInput } from '../../../simulation/noyau/entrees';
import { azertyLabel } from '../../index';
import { createCoopScreen } from '../ecran';
import '../../interface.css';

// Le poulailler d'essai vit à la halte d'essai: la démonstration le pose au lieu de départ.
const COOP = 'poulailler';
const gare = DATA_FILES['lieux/essai-gare/carte.json'] as { objects: unknown[] };
const content = loadContent({
  ...DATA_FILES,
  'lieux/essai-gare/carte.json': {
    ...gare,
    objects: [
      ...gare.objects,
      { id: COOP, type: 'poulailler-d-essai', x: 5.5, y: 24, rotation: 0 },
    ],
  },
});
const world = createWorld(content, 7, [
  { id: 'a', name: 'Camille' },
  { id: 'b', name: 'Sacha' },
]);
const sim = createSim(content, world);
const listeners: ((event: GameEvent) => void)[] = [];
const pending: Intent[] = [];
let seq = 0;

function step(): void {
  const intents = pending.splice(0);
  stepSim(
    sim,
    [idleInput(seq), idleInput(seq)],
    intents.map((intent) => ({ player: 0 as const, intent })),
  );
  seq += 1;
  for (const event of [...sim.events]) for (const listener of listeners) listener(event);
}

function nextDay(): void {
  world.common.day += 1;
  step();
}

const state = location.hash.slice(1) || 'normal';
step();
const shelter = world.places[world.common.place]?.objects[COOP]?.shelter;
world.players[0].toolbar[2] = { item: 'grain', count: 12 };
if (state === 'normal') {
  nextDay();
  nextDay();
  if (shelter !== undefined) shelter.nest = [{ item: 'oeuf', count: 4 }];
  const first = shelter?.animals[0];
  if (first !== undefined) first.love = 12;
} else if (state === 'vide') {
  world.players[0].toolbar[2] = null;
  if (shelter !== undefined) shelter.feed = 0;
  for (let i = 0; i < 7; i++) nextDay();
  if (shelter !== undefined) shelter.nest = [];
} else {
  world.players[0].money = 2000;
  pending.push({ type: 'animal_buy', target: COOP });
  step();
  for (let i = 0; i < 6; i++) nextDay();
  if (shelter !== undefined) {
    shelter.feed = 14;
    for (const animal of shelter.animals) animal.hungry = 0;
  }
}

const layer = document.createElement('div');
layer.className = 'lpl-ui';
document.body.append(layer);
const coop = createCoopScreen(
  layer,
  { content, world: () => world, localIndex: (): PlayerIndex => 0 },
  (intent) => {
    pending.push(intent);
    step();
  },
  azertyLabel,
  window,
  0,
);
listeners.push((event) => {
  coop.onEvent(event);
});
coop.onEvent({ type: 'shelter_opened', player: 0, target: COOP });
if (state === 'plein') {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
}

let last = performance.now();
function loop(time: number): void {
  coop.frame(time - last);
  last = time;
  requestAnimationFrame(loop);
}
coop.frame(700);
requestAnimationFrame(loop);
document.body.dataset.ready = 'oui';
