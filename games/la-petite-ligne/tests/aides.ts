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

/** Monde neuf; `content` remplace le contenu du jeu (variante d'un fichier pour un test). */
export function newSim(seed = SEED, content: Content = contentAndMap().content): Sim {
  const { map } = contentAndMap();
  return createWorld(content, map, seed, [
    { id: 'membre-a', name: 'Camille', color: '#e07a5f' },
    { id: 'membre-b', name: 'Sacha', color: '#3d85c6' },
  ]);
}

/** Buts d'après-midi des jours creux: un groupe de variantes par jour, une seule tirée par la graine (`quetes.json`). */
export const AFTERNOON_GROUPS: Readonly<Record<string, readonly [string, string]>> = {
  afternoon_d6: ['odette_dandelions', 'heron_watch'],
  afternoon_d10: ['odette_parcels', 'basile_lost'],
  afternoon_d11: ['firmin_chub', 'wild_geese'],
  afternoon_d13: ['jeanne_notebook', 'jeanne_challenge'],
};

/** Somme versée pour la commande `index` partie complète (prime de ligne et bonus, sans surplus). */
export function fullOrderAmount(content: Content, index: number): number {
  const o = content.settings.order.trains[index];
  if (o === undefined) return 0;
  const base = o.lines.reduce((sum, l) => sum + l.count * (content.items[l.item]?.sellPrice ?? 0) * o.linePremium, 0);
  return Math.round(base * (1 + o.fullBonus));
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
