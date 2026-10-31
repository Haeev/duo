/**
 * Empreinte de l'état du monde (ADR 0005, point 5): tests, contrôles de
 * désynchronisation, détection d'un changement avant d'envoyer l'état.
 */
import { hashState } from '@duo/sdk/sim';
import type { ReadonlyWorld, WorldState } from '../etat/types';

export function hash(world: WorldState | ReadonlyWorld): string {
  return hashState(world);
}
