/**
 * Musique du jeu: table de données, régie à fondus, silences voulus, thème d'arrivée, couches,
 * jingles. Branchement dans `main.ts`: voir le README de ce dossier.
 */
import type { Audio } from '@duo/sdk';
import type { RandomSource } from '@duo/sdk/sim';
import type { GameView } from '../../session';
import { soundUrl } from '../fichiers';
import { createMusicDirector, type MusicDirector } from './regie';
import { loadMusicTable } from './table';

export interface GameMusicOptions {
  readonly audio: Audio;
  readonly view: GameView;
  readonly random: RandomSource;
  readonly zoneAt?: (x: number, y: number) => string | null;
  readonly activeEvents?: () => readonly string[];
  readonly warn?: (message: string, data?: unknown) => void;
}

/** Crée la musique du jeu avec la table et les fichiers du paquet. */
export function createGameMusic(options: GameMusicOptions): MusicDirector {
  return createMusicDirector({
    host: options.audio,
    view: options.view,
    table: loadMusicTable(),
    assetUrl: soundUrl,
    random: options.random,
    storage: typeof localStorage === 'undefined' ? null : localStorage,
    ...(options.zoneAt === undefined ? {} : { zoneAt: options.zoneAt }),
    ...(options.activeEvents === undefined ? {} : { activeEvents: options.activeEvents }),
    ...(options.warn === undefined ? {} : { warn: options.warn }),
  });
}

export type { MusicDirector, MusicState } from './regie';
export type { MusicSettings } from './reglages';
export { loadMusicTable, parseMusicTable } from './table';
