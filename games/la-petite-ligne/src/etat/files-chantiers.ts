/**
 * Ouverture des files de chantiers (tour 9; 0.12: la file de l'élevage s'ouvre avec la quête de
 * la chèvre). Pure: lue par la simulation et par l'interface.
 */
import type { ImprovementQueue, ImprovementSettings } from '../donnees/types';
import type { ReadonlyWorld } from './types';

/** La file est ouverte: son jour est venu et, s'il y en a une, sa quête a commencé. */
export function queueOpen(
  s: ImprovementSettings,
  world: Pick<ReadonlyWorld, 'clock' | 'quests'>,
  queue: ImprovementQueue,
): boolean {
  const q = s.queues[queue];
  if (world.clock.day < q.opensFromDay) return false;
  return q.quest === undefined || world.quests.some((x) => x.id === q.quest);
}
