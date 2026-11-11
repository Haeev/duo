/**
 * Démonstration de l'atelier sur une vraie simulation (la fabrication passe par son système).
 * États par l'ancre: `#fabriquer`, `#couleur` (autre couleur), `#manque` (matériaux manquants),
 * `#inconnu` (plan à trouver), `#travail` (ouvrage en cours, à deux), `#fete` (première
 * fabrication), `#ameliorer`, `#demain` (amélioration prête demain), `#reparer`, `#affuter`.
 */
import { loadContent } from '../../../donnees/charger';
import { DATA_FILES } from '../../../donnees/fichiers';
import type { PlayerIndex } from '../../../donnees/schemas/communs';
import { stationOf } from '../../../simulation/fabrication/plans';
import { idleInput, type Intent } from '../../../simulation/noyau/entrees';
import type { GameEvent } from '../../../simulation/noyau/evenements';
import { createWorld } from '../../../simulation/noyau/monde';
import { createSim, step } from '../../../simulation/noyau/pas';
import { createInterface } from '../../index';
import { loadPortraits } from '../../portrait';

// Thème sombre validé par le client, posé comme dans `main.ts`; `?interface=ancien`: l'habillage clair.
if (new URLSearchParams(location.search).get('interface') !== 'ancien')
  document.documentElement.dataset.lplStyle = 'encre';

// Portraits dessinés: lot à part, attendu avant toute interface (comme `main.ts`).
await loadPortraits();

// La partie commence à la gare d'essai, où sont l'établi, la meule et la forge de la démonstration.
const settings = DATA_FILES['commun/reglages.json'] as { start: Record<string, unknown> };
const content = loadContent({
  ...DATA_FILES,
  'commun/reglages.json': { ...settings, start: { ...settings.start, place: 'essai-gare' } },
});
const world = createWorld(content, 7, [
  { id: 'a', name: 'Camille' },
  { id: 'b', name: 'Sacha' },
]);
const sim = createSim(content, world);
const state = location.hash.slice(1) || 'fabriquer';
const atForge = ['ameliorer', 'demain', 'reparer'].includes(state);
const target = atForge ? 'forge-d-essai' : state === 'affuter' ? 'meule-d-essai' : 'etabli-de-gare';
const station = stationOf({ content, world }, target);
if (station === null) throw new Error(`poste absent: ${target}`);
const me = world.players[0];
world.minutes = 10 * 60 + 40;
me.money = 4250;
for (const [i, p] of [me, world.players[1]].entries()) {
  p.body.x = station.x + (i === 0 ? -0.3 : 0.3);
  p.body.y = station.y + 1.1;
}
if (state === 'manque') me.toolbar[0] = { item: 'planche', count: 1 };
else me.toolbar[0] = { item: 'planche', count: 6 };
me.toolbar[1] = { item: 'pierre', count: 3 };
me.toolbar[2] = { item: 'buche', count: 2 };
if (atForge || state === 'affuter') {
  me.toolbar[0] = { item: 'hache', count: 1 };
  me.toolbar[1] = { item: 'beche', count: 1 };
  me.toolbar[3] = { item: 'hache-forgee', count: 1, wear: state === 'affuter' ? 10 : 30 };
  me.toolbar[4] = { item: 'arrosoir-cuivre', count: 1, wear: 0 };
}
world.players[1].toolbar[0] = { item: 'marteau', count: 1 };
world.players[1].selected = 0;
// Le coffre de la maison d'essai prête des planches à l'établi.
const chest = world.places[world.common.place]?.objects['coffre-de-gare']?.store;
if (chest !== undefined) chest[0] = { item: 'planche', count: 4 };

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

/** Ouvre l'atelier comme la touche d'action sur le poste, puis joue les touches de l'état. */
queue.push({ player: 0, intent: { type: 'use_brick', target, brick: 'craft' } });
/** Les coups de l'autre joueur (le marteau en main) arrivent comme ses intentions. */
function partnerStrike(): void {
  queue.push({ player: 1, intent: { type: 'craft_strike', target } });
}
const keys: Readonly<Record<string, readonly string[]>> = {
  fabriquer: ['ArrowRight'],
  couleur: ['ArrowRight', 'KeyD'],
  manque: ['ArrowRight', 'ArrowRight', 'ArrowRight'],
  inconnu: ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight'],
  travail: ['ArrowRight', 'KeyD', 'Enter', 'Space'],
  fete: ['Enter', 'Space', 'Space', 'Space'],
  ameliorer: [],
  demain: ['ArrowRight'],
  reparer: ['KeyE'],
  affuter: ['Enter'],
};
/** Les touches partent une fois l'atelier ouvert et sa garde d'ouverture passée. */
function play(): void {
  let delay = 400;
  for (const code of keys[state] ?? []) {
    setTimeout(() => {
      press(code);
      if (state === 'travail' && code === 'Space') partnerStrike();
    }, delay);
    delay += code === 'Space' || code === 'Enter' ? 1100 : 150;
  }
  setTimeout(() => {
    document.body.dataset.ready = 'oui';
  }, delay + 300);
}
const waitOpen = setInterval(() => {
  if (document.querySelector('.ws') === null) return;
  clearInterval(waitOpen);
  play();
}, 50);
