/**
 * Démonstration du mode déco à deux: une seule simulation (l'hôte), deux écrans côte à côte qui
 * envoient leurs intentions. Ancre: `#deux` (des meubles posés, Sacha déplace la table, Camille
 * tient le lit devant la porte), `#vide` (maison restaurée, inventaire plein), `#ruine`.
 */
import { loadContent } from '../../../donnees/charger';
import { DATA_FILES } from '../../../donnees/fichiers';
import type { PlayerIndex } from '../../../donnees/schemas/communs';
import { idleInput, type Intent } from '../../../simulation/noyau/entrees';
import { createWorld } from '../../../simulation/noyau/monde';
import { createSim, step } from '../../../simulation/noyau/pas';
import { azertyLabel } from '../../index';
import { createDecoMode } from '../deco';

// Thème sombre validé par le client, posé comme dans `main.ts`; `?interface=ancien`: l'habillage clair.
if (new URLSearchParams(location.search).get('interface') !== 'ancien')
  document.documentElement.dataset.lplStyle = 'encre';

const HOUSE = 'maison-essai';
// La maison d'essai est à la gare d'essai: la partie y commence (le jeu, lui, part du wagon).
const settings = DATA_FILES['commun/reglages.json'] as { start: Record<string, unknown> };
const content = loadContent({
  ...DATA_FILES,
  'commun/reglages.json': { ...settings, start: { ...settings.start, place: 'essai-gare' } },
});
const sim = createSim(
  content,
  createWorld(content, 7, [
    { id: 'a', name: 'Camille' },
    { id: 'b', name: 'Sacha' },
  ]),
);
const queue: { player: PlayerIndex; intent: Intent }[] = [];
function tick(): void {
  step(sim, [idleInput(sim.world.tick), idleInput(sim.world.tick)], queue.splice(0));
}
function now(player: PlayerIndex, intent: Intent): void {
  queue.push({ player, intent });
  tick();
}

tick();
const scene = location.hash.slice(1) || 'deux';
const state = sim.world.places[sim.world.common.place]?.housing?.[HOUSE];
if (state !== undefined && scene !== 'ruine')
  for (const room of Object.values(state.rooms)) room.state = 'restored';
sim.world.players[0].body = { x: 29.5, y: 11, facing: 0, speed: 0 };
sim.world.players[1].body = { x: 30.5, y: 11, facing: 0, speed: 0 };
for (const p of [0, 1] as const) now(p, { type: 'deco_mode', housing: HOUSE, on: true });

function place(
  player: PlayerIndex,
  prop: string,
  x: number,
  y: number,
  rotation: 0 | 1 | 2 | 3,
): void {
  now(player, { type: 'deco_take', housing: HOUSE, prop, x, y, rotation });
  now(player, { type: 'deco_drop', housing: HOUSE });
}

if (scene === 'deux') {
  place(0, 'tapis-essai', 30, 8, 0);
  place(0, 'table-essai', 30, 7.5, 0);
  place(0, 'lampe-essai', 30.5, 7.5, 0);
  place(1, 'cadre-essai', 28.5, 5.5, 0);
  place(1, 'chaise-essai', 28.5, 7.5, 1);
  place(1, 'buffet-essai', 36, 12.5, 0);
  place(1, 'pot-de-fleurs-essai', 25.5, 15.5, 0);
  place(0, 'pot-de-fleurs-essai', 33.5, 15.5, 0);
  place(0, 'baquet-essai', 37.5, 5.5, 0);
  const table = sim.world.places[sim.world.common.place]?.placed.find(
    (p) => p.type === 'table-essai',
  );
  if (table !== undefined) {
    now(1, { type: 'deco_grab', housing: HOUSE, prop: table.id });
    now(1, { type: 'deco_move', housing: HOUSE, x: 29.5, y: 10, rotation: 1 });
  }
  now(0, {
    type: 'deco_take',
    housing: HOUSE,
    prop: 'lit-double-essai',
    x: 29.5,
    y: 12,
    rotation: 0,
  });
}

for (const player of [0, 1] as const) {
  const host = document.getElementById(`vue-${String(player)}`);
  if (host === null) continue;
  // Comme en jeu, le mode déco se pose dans la couche d'interface (ses couleurs, son thème).
  const layer = document.createElement('div');
  layer.className = 'lpl-ui';
  host.append(layer);
  const mode = createDecoMode({
    layer,
    content,
    world: () => sim.world,
    localIndex: () => player,
    send: (intent) => queue.push({ player, intent }),
    keyLabel: azertyLabel,
  });
  // L'ouverture renvoie `deco_mode`: sans effet, le joueur y est déjà.
  mode.open(HOUSE);
  const loop = (): void => {
    if (player === 0) tick();
    mode.frame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
