/** Les effets de l'histoire reliés aux deux moteurs (quêtes et scènes), sans import croisé. */
import { queueScene } from '../scenes/lecteur';
import type { StoryHooks } from './effets';
import { openQuest } from './moteur';

export const HOOKS: StoryHooks = {
  openQuest(sim, quest) {
    openQuest(sim, quest, HOOKS);
  },
  playScene(sim, scene, by) {
    queueScene(sim, scene, by, HOOKS);
  },
};
