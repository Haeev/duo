/** Aides des tests de l'interface: contenu, carte, monde neuf et contexte d'interface. */
import { withClockPace } from '../../donnees/calendrier';
import { loadContent } from '../../donnees/contenu';
import { CONTENT_FILES } from '../../donnees/fichiers';
import { loadMap } from '../../donnees/carte';
import { MAP_FILES } from '../../donnees/cartes-fichiers';
import type { Content } from '../../donnees/types';
import type { GameMap } from '../../etat/carte';
import type { Intent } from '../../etat/actions';
import type { CharacterId } from '../../etat/types';
import type { Sim } from '../../simulation/contexte';
import { createWorld } from '../../simulation/monde';
import { step } from '../../simulation/pas';
import { createRobot } from '../../simulation/robot';
import { type UiContext, createUiContext } from '../contexte';
import { loadUiTexts } from '../textes';

let cached: { content: Content; map: GameMap } | null = null;

export function contentAndMap(): { content: Content; map: GameMap } {
  // Au rythme vif, comme la page de démonstration (`demo/main.ts`): mêmes situations des deux côtés.
  cached ??= { content: withClockPace(loadContent(CONTENT_FILES), 'vif'), map: loadMap(MAP_FILES).map };
  return cached;
}

export function newSim(): Sim {
  const { content, map } = contentAndMap();
  return createWorld(content, map, 20261031, [
    { id: 'membre-a', name: 'Camille', color: '#5CE1E6' },
    { id: 'membre-b', name: 'Sacha', color: '#8D6CFF' },
  ]);
}

const AZERTY: Record<string, string> = { KeyW: 'Z', KeyA: 'Q', KeyQ: 'A', Space: 'Espace', Tab: 'Tab' };

export function uiContext(me: CharacterId = 'p1'): UiContext {
  const { content, map } = contentAndMap();
  return createUiContext(content, map, loadUiTexts(content), me, (code) => AZERTY[code] ?? code.replace(/^Key/, ''));
}

export function apply(sim: Sim, by: CharacterId, ...intents: Intent[]): void {
  step(sim, { controls: {}, intents: intents.map((intent) => ({ by, intent })) });
}

/** Les deux personnages créés: le jour 1 commence. */
export function started(): Sim {
  const sim = newSim();
  apply(sim, 'p1', { type: 'create_character', name: 'Camille', hair: 0, outfit: 0 });
  apply(sim, 'p2', { type: 'create_character', name: 'Sacha', hair: 2, outfit: 1 });
  return sim;
}

export function playUntil(sim: Sim, until: (s: Sim) => boolean, maxTicks = 300_000): void {
  const robot = createRobot();
  let ticks = 0;
  while (!until(sim) && ticks < maxTicks) {
    step(sim, robot.decide(sim));
    ticks++;
  }
}

export function character(sim: Sim, id: CharacterId): Sim['world']['characters'][number] {
  const c = sim.world.characters.find((x) => x.id === id);
  if (c === undefined) throw new Error(`personnage ${id}`);
  return c;
}
