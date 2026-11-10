/**
 * Système « scènes »: joue la scène en cours, lance la suivante de la file, et regarde les
 * déclencheurs de monde (heure fixe, histoire, présence des deux). Placé après les quêtes: une
 * étape qui lance une scène la voit démarrer au même pas.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { HOOKS } from '../quetes/crochets';
import { STORY } from '../quetes/reglages';
import { sceneNext, stepScenes } from './lecteur';

function onIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  if (intent.type === 'scene_next') sceneNext(sim, player, HOOKS);
}

export const sceneSystem: GameSystem = {
  id: 'scenes',
  step(sim) {
    if (sim.world.common.phase !== 'day') return;
    stepScenes(sim, HOOKS, sim.world.tick % STORY.checkEveryTicks === 0);
  },
  intent: onIntent,
};
