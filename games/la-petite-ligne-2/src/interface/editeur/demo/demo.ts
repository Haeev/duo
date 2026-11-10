/**
 * Démonstration de l'éditeur de personnage: la vraie interface, l'aperçu 3D du rendu, une partie
 * neuve sans réseau. `pnpm dev`, puis `/src/interface/editeur/demo/index.html`; `#miroir`:
 * l'éditeur rouvert par la brique `mirror` avec l'apparence courante. `window.editeur` sert aux
 * captures.
 */
import { loadContent } from '../../../donnees/charger';
import { DATA_FILES } from '../../../donnees/fichiers';
import type { PlayerIndex } from '../../../donnees/schemas/communs';
import type { WorldState } from '../../../etat/monde';
import type { GameEvent } from '../../../simulation/noyau/evenements';
import { createWorld } from '../../../simulation/noyau/monde';
import { createCharacterPreview } from '../../../rendu/personnages/apercu';
import { composeLook } from '../../../rendu/personnages/apparence';
import { createInterface } from '../../index';

interface DemoApi {
  sent: unknown[];
  world: WorldState;
  mirror: () => void;
}
declare global {
  interface Window {
    editeur: DemoApi;
  }
}

const content = loadContent(DATA_FILES);
const world: WorldState = createWorld(content, 7, [
  { id: 'a', name: 'Camille' },
  { id: 'b', name: 'Sacha' },
]);
const mirror = location.hash === '#miroir';
if (mirror) {
  world.players[0].look = composeLook('demo-miroir', content.catalogue, {
    shapes: ['adult-m-round'],
  });
  world.players[0].gender = 'm';
}
const listeners = new Set<(event: GameEvent) => void>();
const root = document.getElementById('ui');
if (!(root instanceof HTMLElement)) throw new Error('#ui absent');
const out = document.getElementById('envoi');
const api: DemoApi = {
  sent: [],
  world,
  mirror: () => {
    for (const listener of listeners)
      listener({ type: 'mirror_opened', player: 0, target: 'miroir' });
  },
};
window.editeur = api;

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
    api.sent.push(intent);
    if (out !== null) out.textContent = JSON.stringify(intent);
    // Ce que ferait l'hôte: l'apparence validée entre dans l'état commun.
    if (intent.type === 'set_look') {
      const me = world.players[0];
      me.name = intent.name;
      me.look = intent.look;
      if (intent.gender !== undefined) me.gender = intent.gender;
    }
  },
  cameraYaw: () => 0,
  characterPreview: (canvas) => createCharacterPreview(canvas, content),
  editorAtStart: !mirror,
});

let last = performance.now();
function loop(t: number): void {
  ui.frame(Math.min(0.1, (t - last) / 1000));
  last = t;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
if (mirror) setTimeout(api.mirror, 100);
