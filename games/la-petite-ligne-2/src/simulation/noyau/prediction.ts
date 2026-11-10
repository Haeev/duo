/**
 * Ce que la simulation fournit au réseau (contrat `Predictor` du lot L1): les fonctions pures du
 * déplacement et du début de geste, les mêmes que celles du pas de l'hôte. L'invité s'en sert pour
 * répondre au pas même de l'appui; elles ne lisent que l'état qu'il connaît.
 */
import type { PredictorFactory } from '../../reseau/prediction';
import { predictedGesture } from '../briques/geste';
import { SIM_DT } from './constantes';
import { canWalk, speedFactorOf, walkStep } from './deplacement';
import { currentBlockers } from './obstacles';

export const createPredictor: PredictorFactory = (content) => ({
  canWalk,
  walk(world, player, body, input) {
    const blockers = currentBlockers(content, world);
    if (blockers === null) return;
    walkStep(
      blockers,
      body,
      input.moveX,
      input.moveY,
      input.run,
      content.settings.movement,
      SIM_DT,
      speedFactorOf(content, world, player),
    );
  },
  gesture(world, player, intent) {
    return predictedGesture({ content, world }, player, intent);
  },
});
