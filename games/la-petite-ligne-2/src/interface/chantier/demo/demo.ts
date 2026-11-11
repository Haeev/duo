/**
 * Démonstration du chantier et de la boucle des meubles sur une vraie simulation, dans la maison
 * du garde d'Aubrune (données livrées), sans rendu 3D. États par l'ancre: `#devis` (l'écran
 * s'ouvre devant l'ardoise de la cuisine), `#refus` (travailler sans matériaux), `#travail` (tout
 * apporté, payé, les deux joueurs au marteau), `#fini` (pièce finie, son indice), `#verrou` (la
 * chambre avant son devis), `#sac` (un tabouret fabriqué dans le sac, bouton « Ranger à la
 * maison »), `#deco` (le même tabouret dans la liste du mode déco), `#deco-pose` (posé).
 * `?joueur=1` montre l'écran de l'invité; `?interface=ancien` le thème clair.
 */
import { loadContent } from '../../../donnees/charger';
import { DATA_FILES } from '../../../donnees/fichiers';
import type { PlayerIndex } from '../../../donnees/schemas/communs';
import { aimOf } from '../../../simulation/briques/visee';
import { idleInput, type Intent } from '../../../simulation/noyau/entrees';
import type { GameEvent } from '../../../simulation/noyau/evenements';
import { createWorld } from '../../../simulation/noyau/monde';
import { createSim, step } from '../../../simulation/noyau/pas';
import { addItem } from '../../../simulation/sac/inventaire';
import { createInterface } from '../../index';
import { loadPortraits } from '../../portrait';

await loadPortraits();

const params = new URLSearchParams(location.search);
if (params.get('interface') !== 'ancien') document.documentElement.dataset.lplStyle = 'encre';
const local: PlayerIndex = params.get('joueur') === '1' ? 1 : 0;
const state = location.hash.slice(1) || 'devis';

const HOUSE = 'maison-du-garde';
const files: Record<string, unknown> = { ...DATA_FILES };
const settings = files['commun/reglages.json'] as { start: Record<string, unknown> };
files['commun/reglages.json'] = {
  ...settings,
  start: { ...settings.start, place: 'aubrune', minute: 600 },
};
const content = loadContent(files);
const world = createWorld(content, 7, [
  { id: 'a', name: 'Camille' },
  { id: 'b', name: 'Sacha' },
]);
const sim = createSim(content, world);
const queue: { player: PlayerIndex; intent: Intent }[] = [];
const listeners = new Set<(event: GameEvent) => void>();

function tick(): void {
  step(sim, [idleInput(world.tick), idleInput(world.tick)], queue.splice(0));
  for (const event of sim.events) for (const listener of listeners) listener(event);
}
function now(player: PlayerIndex, intent: Intent): void {
  queue.push({ player, intent });
  tick();
}
function fact(key: string, value: string | boolean): void {
  world.progress.memory[key] = { v: value, by: 'duo', day: 1 };
}

// L'histoire est derrière nous: sans cela, la scène d'arrivée à Aubrune prendrait l'écran.
for (const [id, line] of Object.entries(content.places.aubrune?.quests ?? {})) {
  const steps = line.chapters.flatMap((c) => c.steps.map((s) => ({ chapter: c.id, id: s.id })));
  const last = steps[steps.length - 1];
  world.progress.quests[id] = {
    chapter: last?.chapter ?? '',
    step: last?.id ?? '',
    done: true,
    passed: steps.map((s) => s.id),
  };
}
// La salle est restaurée (acte 1), la scène du règlement a ouvert le devis de la cuisine.
tick();
if (world.common.story !== undefined) world.common.story.scene = null;
const house = world.places.aubrune?.housing?.[HOUSE];
if (house?.rooms.salle !== undefined) house.rooms.salle.state = 'restored';
fact('aubrune.maison.premiere-piece', true);
fact('aubrune.maison-du-garde.salle', 'restored');
fact('aubrune.maison.cuisine', true);
world.common.chest = 15_000;
const [host, guest] = world.players;
host.money = 2000;
guest.money = 800;
addItem(content, host, 'planche', 4);
addItem(content, host, 'pierre', 3);
addItem(content, guest, 'pierre', 1);
// Devant l'ardoise de la cuisine (21,5; 216,5), tournés vers elle (le sud).
const facing = Math.PI / 2;
host.body = { x: 21.4, y: 215.4, facing, speed: 0 };
guest.body = { x: 22.3, y: 215.4, facing, speed: 0 };
if (state === 'verrou') {
  // La chambre: son ardoise est contre le mur nord (15,5; 210,5), le devis n'est pas fait.
  const at = { x: 15.5, y: 211.6, facing: -Math.PI / 2, speed: 0 };
  if (local === 0) host.body = at;
  else guest.body = at;
}
if (state === 'sac' || state === 'range' || state.startsWith('deco')) {
  // Un tabouret fabriqué à l'établi attend dans le sac; on se tient dans la salle.
  addItem(content, world.players[local], 'tabouret-miel', 1);
  world.players[local].body = { x: 22.5, y: 212.5, facing: 0, speed: 0 };
}
tick();

const root = document.getElementById('ui');
if (!(root instanceof HTMLElement)) throw new Error('#ui absent');
const ui = createInterface({
  root,
  view: {
    content,
    world: () => world,
    localIndex: (): PlayerIndex => local,
    aim: (player) => aimOf({ content, world }, player),
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  },
  send(intent) {
    queue.push({ player: local, intent });
  },
  cameraYaw: () => 0,
  editorAtStart: false,
});

function press(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
}

let last = performance.now();
function loop(t: number): void {
  tick();
  ui.frame((t - last) / 1000);
  last = t;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

const other: PlayerIndex = local === 0 ? 1 : 0;
const room = { housing: HOUSE, room: 'cuisine' } as const;
/** Ce que joue chaque état: des touches du joueur local, des intentions de l'autre joueur. */
type Beat = string | (() => void);
const open: Beat = () => {
  queue.push({ player: local, intent: { type: 'act' } });
};
const everything: readonly Beat[] = [
  () => {
    now(0, { type: 'housing_supply', ...room });
    now(1, { type: 'housing_supply', ...room });
    now(other, { type: 'housing_pay', ...room });
  },
];
const scripts: Readonly<Record<string, readonly Beat[]>> = {
  devis: [open],
  refus: [open, 'KeyD', 'KeyD', 'Space'],
  travail: [
    ...everything,
    open,
    'Space',
    () => {
      now(other, { type: 'housing_work', ...room, on: true });
    },
  ],
  fini: [
    ...everything,
    open,
    'Space',
    () => {
      now(other, { type: 'housing_work', ...room, on: true });
      for (let i = 0; i < 30 * 9; i++) tick();
    },
  ],
  verrou: [open, 'Space'],
  sac: ['KeyC', 'ArrowRight', 'ArrowRight'],
  range: ['KeyC', 'ArrowRight', 'ArrowRight', 'Enter'],
  deco: ['KeyB'],
  // E cinq fois: le tabouret, sixième de la liste; Entrée le sort, les flèches le glissent.
  'deco-pose': [
    'KeyB',
    ...Array<string>(5).fill('KeyE'),
    'Enter',
    'ArrowLeft',
    'ArrowDown',
    'ArrowDown',
    'Space',
  ],
};
let delay = 600;
for (const beat of scripts[state] ?? []) {
  setTimeout(() => {
    if (typeof beat === 'string') press(beat);
    else beat();
  }, delay);
  delay += 450;
}
setTimeout(() => {
  document.body.dataset.ready = 'oui';
}, delay + 400);
