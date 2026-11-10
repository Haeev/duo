/** Aides des tests du noyau (lot L2): faire tourner des pas, donner une commande, fabriquer un contenu d'essai. */
import { loadContent, type Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { SIM_HZ } from '../src/simulation/noyau/constantes';
import { idleInput, type Intent, type StepInput } from '../src/simulation/noyau/entrees';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import { step, type Sim } from '../src/simulation/noyau/pas';
import { dataFiles } from './aides';

export const NORTH = -Math.PI / 2;
export const SOUTH = Math.PI / 2;

type Move = Partial<Pick<StepInput, 'moveX' | 'moveY' | 'run'>>;

/** Fait tourner `seconds` secondes de jeu avec la commande tenue de chaque joueur; renvoie les événements. */
export function run(sim: Sim, seconds: number, a: Move = {}, b: Move = {}): GameEvent[] {
  const events: GameEvent[] = [];
  const steps = Math.round(seconds * SIM_HZ);
  for (let i = 0; i < steps; i++) {
    step(
      sim,
      [
        { ...idleInput(i), ...a },
        { ...idleInput(i), ...b },
      ],
      [],
    );
    events.push(...sim.events);
  }
  return events;
}

/** Un pas avec une intention de ce joueur; renvoie les événements du pas. */
export function send(sim: Sim, player: PlayerIndex, intent: Intent): GameEvent[] {
  step(sim, [idleInput(0), idleInput(0)], [{ player, intent }]);
  return [...sim.events];
}

/** Pose un joueur à un endroit, tourné dans une direction. */
export function put(sim: Sim, player: PlayerIndex, x: number, y: number, facing: number): void {
  sim.world.players[player].body = { x, y, facing, speed: 0 };
}

interface TestProp {
  readonly id: string;
  readonly size?: { w: number; h: number };
  readonly bricks: readonly unknown[];
}

interface TestObject {
  readonly id: string;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly rotation?: number;
}

/**
 * Le contenu du jeu, plus des meubles d'essai et des objets posés sur la carte du lieu de départ.
 * Montre au passage la règle du paquet: un contenu nouveau n'est que des données.
 */
export function contentWith(props: readonly TestProp[], objects: readonly TestObject[]): Content {
  const files = dataFiles();
  for (const prop of props) {
    files[`commun/meubles/${prop.id}.json`] = {
      schema: 1,
      id: prop.id,
      name: 'Meuble d’essai',
      model: 'essai',
      size: prop.size ?? { w: 1, h: 1 },
      solid: true,
      placeable: false,
      series: null,
      bricks: prop.bricks,
    };
  }
  const map = files['lieux/essai-gare/carte.json'] as { objects: unknown[] };
  for (const object of objects) map.objects.push({ rotation: 0, ...object });
  return loadContent(files);
}
