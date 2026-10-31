/**
 * Lecture de la carte du level designer (`donnees/cartes/`). Le format est
 * fixé par le level designer; ce lecteur le traduit en `GameMap`.
 */
import type { GameMap } from '../etat/carte';
import { ContentError } from './lecteur';

export function parseLevelMap(files: Record<string, unknown>): GameMap {
  throw new ContentError(`cartes: format pas encore pris en charge (${Object.keys(files).join(', ')})`);
}
