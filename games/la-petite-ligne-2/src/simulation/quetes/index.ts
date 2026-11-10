/**
 * Système « quêtes »: ouvre les suites, franchit les étapes faites (tous les `checkEveryTicks`
 * pas), et reçoit l'intention `quest_track`.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { HOOKS } from './crochets';
import { checkQuests, trackQuest } from './moteur';
import { STORY } from './reglages';

function onIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  if (intent.type === 'quest_track') trackQuest(sim, player, intent.quest);
  if (intent.type === 'chapter_end_close') closeChapterEnd(sim, player);
}

function closeChapterEnd(sim: SimContext, player: PlayerIndex): void {
  const story = sim.world.common.story;
  const ending = story?.ending;
  if (story === undefined || ending === undefined || ending.closed[player]) return;
  ending.closed[player] = true;
  if (ending.closed[0] && ending.closed[1]) delete story.ending;
  sim.touch('common');
}

export const questSystem: GameSystem = {
  id: 'quetes',
  step(sim) {
    if (sim.world.common.phase !== 'day') return;
    if (sim.world.tick % STORY.checkEveryTicks !== 0) return;
    checkQuests(sim, HOOKS);
  },
  intent: onIntent,
};
