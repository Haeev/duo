/**
 * Musique du jeu: table de données, régie à fondus, silences voulus, thème d'arrivée, couches,
 * jingles. Branchement dans `main.ts`: voir le README de ce dossier.
 */
import type { Audio } from '@duo/sdk';
import type { RandomSource } from '@duo/sdk/sim';
import type { GameView } from '../../session';
import { soundUrl } from '../fichiers';
import { createMusicDirector, type MusicDirector } from './regie';
import { createStageAudio, type StageAudio } from './scene';
import { loadMusicTable } from './table';
import { loadTimbres } from './timbres';

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

export interface GameStageOptions {
  readonly audio: Audio;
  /** La régie: l'air joué sort à son niveau (volume de la musique) et la fait taire le temps de l'air. */
  readonly music: MusicDirector;
  /** Heure de session commune aux deux machines (`duo.net.sessionTimeMs`). */
  readonly sessionNow: () => number;
  readonly warn?: (message: string, data?: unknown) => void;
}

/** Le son de la musique jouée à l'instrument, avec la table, les timbres et les fichiers du paquet. */
export function createGameStage(options: GameStageOptions): StageAudio {
  return createStageAudio({
    context: options.audio.context,
    output: options.music.input(),
    table: loadMusicTable(),
    timbres: loadTimbres(),
    assetUrl: soundUrl,
    sessionNow: options.sessionNow,
    hush: (on) => {
      options.music.hush(on);
    },
    ...(options.warn === undefined ? {} : { warn: options.warn }),
  });
}

export type { StageAudio } from './scene';
export type { MusicDirector, MusicState } from './regie';
export type { MusicSettings } from './reglages';
export { loadMusicTable, parseMusicTable } from './table';
