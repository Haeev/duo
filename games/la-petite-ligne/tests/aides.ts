/** Aides des tests: monde neuf avec le contenu et la carte du jeu, robot, boucle. */
import { loadContent } from '../src/donnees/contenu';
import { CONTENT_FILES } from '../src/donnees/fichiers';
import { loadMap } from '../src/donnees/carte';
import { MAP_FILES } from '../src/donnees/cartes-fichiers';
import type { Content } from '../src/donnees/types';
import type { GameMap } from '../src/etat/carte';
import type { Sim } from '../src/simulation/contexte';
import { createWorld } from '../src/simulation/monde';
import { step } from '../src/simulation/pas';
import { createRobot, type Robot } from '../src/simulation/robot';

export const SEED = 20261030;

let cached: { content: Content; map: GameMap } | null = null;

export function contentAndMap(): { content: Content; map: GameMap } {
  cached ??= { content: loadContent(CONTENT_FILES), map: loadMap(MAP_FILES).map };
  return cached;
}

export function newSim(seed = SEED): Sim {
  const { content, map } = contentAndMap();
  return createWorld(content, map, seed, [
    { id: 'membre-a', name: 'Camille', color: '#e07a5f' },
    { id: 'membre-b', name: 'Sacha', color: '#3d85c6' },
  ]);
}

/** Fait jouer le robot jusqu'à ce que `until` soit vrai ou que `maxTicks` soit atteint. */
export function play(sim: Sim, robot: Robot, until: (s: Sim) => boolean, maxTicks: number): number {
  let ticks = 0;
  while (!until(sim) && ticks < maxTicks) {
    step(sim, robot.decide(sim));
    ticks++;
  }
  return ticks;
}

export { createRobot };
