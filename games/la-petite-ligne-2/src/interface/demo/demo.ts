/**
 * Démonstration de l'interface seule, sur une vraie partie neuve et un état factice choisi par
 * l'ancre de l'adresse (`#repos`, `#bulle`, `#coup-d-oeil`, `#dialogue-ecriture`,
 * `#dialogue-choix`, `#carnet-sans-sac`, `#carnet-sac`, `#rangement`). Sert aux captures.
 */
import { loadContent } from '../../donnees/charger';
import { DATA_FILES } from '../../donnees/fichiers';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { WorldState } from '../../etat/monde';
import type { Aim } from '../../simulation/briques/types';
import type { GameEvent } from '../../simulation/noyau/evenements';
import { createWorld } from '../../simulation/noyau/monde';
import { createInterface } from '../index';

const content = loadContent(DATA_FILES);
const world: WorldState = createWorld(content, 7, [
  { id: 'a', name: 'Camille' },
  { id: 'b', name: 'Sacha' },
]);
const state = location.hash.slice(1) || 'repos';
const me = world.players[0];
const other = world.players[1];
world.minutes = 10 * 60 + 40;
me.money = 21_450;
world.common.chest = 5_000;
me.toolbar[0] = { item: 'hache-forgee', count: 1, wear: 6 };
me.toolbar[1] = { item: 'hache', count: 1 };
me.toolbar[2] = { item: 'pain', count: 2 };
me.selected = 0;
me.body.x = 10;
me.body.y = 10;
other.body.x = 22;
other.body.y = 4;

let aim: Aim | null = null;
if (state === 'bulle') {
  me.needs.hunger = 12;
  me.tiers.hunger = 'low';
  aim = { kind: 'ground', id: 'sol-1', action: 'pickup', verb: 'Ramasser', refusal: 'pockets-full', x: 0, y: 0 };
} else if (state !== 'repos') {
  aim = { kind: 'prop', id: 'pommier', action: 'gather', verb: 'Cueillir', refusal: null, x: 0, y: 0 };
}
if (state === 'coup-d-oeil') {
  me.needs.sleep = 82;
  me.tiers.sleep = 'bonus';
  me.needs.hygiene = 44;
}
if (state === 'dialogue-ecriture')
  me.talk = { villager: 'cheffe-de-gare', dialogue: 'accueil', node: 'bonjour' };
if (state === 'dialogue-choix') {
  me.talk = { villager: 'cheffe-de-gare', dialogue: 'accueil', node: 'choix' };
  me.needs.hygiene = 8;
  me.tiers.hygiene = 'low';
}
if (state === 'carnet-sac' || state === 'rangement') {
  me.bag = {
    id: 'sac-a-dos',
    slots: [
      { item: 'pomme', count: 4 },
      { item: 'buche', count: 5 },
      { item: 'planche', count: 3 },
      null, null, null, null, null, null, null,
    ],
  };
}
const place = world.places[world.common.place];
if (state === 'rangement' && place !== undefined)
  place.objects['demo-coffre'] = { store: [{ item: 'planche', count: 8 }, { item: 'pain', count: 1 }, null, null, null, null, null, null, null, null] };

const listeners = new Set<(event: GameEvent) => void>();
const root = document.getElementById('ui');
if (!(root instanceof HTMLElement)) throw new Error('#ui absent');
const sent = document.getElementById('envoi');

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
    if (sent !== null) sent.textContent = JSON.stringify(intent);
  },
  cameraYaw: () => 0,
});

function emit(event: GameEvent): void {
  for (const listener of listeners) listener(event);
}

function press(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
}

let last = performance.now();
function loop(t: number): void {
  ui.frame((t - last) / 1000);
  last = t;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Gestes qui amènent l'état voulu, une fois l'interface posée.
setTimeout(() => {
  if (state === 'bulle') {
    me.selected = 2;
    emit({ type: 'money_changed', who: 0, delta: 120 });
  }
  if (state === 'coup-d-oeil') press('KeyG');
  if (state === 'carnet-sans-sac' || state === 'carnet-sac') press('KeyC');
  if (state === 'carnet-sac') setTimeout(() => {
      press('KeyD');
    }, 400);
  if (state === 'rangement') emit({ type: 'store_opened', player: 0, target: 'demo-coffre' });
  if (state === 'dialogue-choix') setTimeout(() => {
      press('ArrowDown');
    }, 400);
}, 150);
