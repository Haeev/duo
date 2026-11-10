/**
 * Son du jeu (lot L9): moteur Web Audio piloté par des tables de données.
 * Branchement dans `main.ts`: voir le README de ce dossier.
 */
import type { Audio } from '@duo/sdk';
import type { RandomSource } from '@duo/sdk/sim';
import type { GameView } from '../session';
import { soundUrl } from './fichiers';
import { createAudioEngine, type AudioEngine } from './moteur';
import { loadTables } from './table';

export interface GameAudioOptions {
  readonly audio: Audio;
  readonly view: GameView;
  readonly random: RandomSource;
  readonly cameraYaw: () => number;
  readonly surfaceAt?: (x: number, y: number) => string | null;
  readonly warn?: (message: string, data?: unknown) => void;
}

/** Crée le son du jeu avec les tables et les fichiers du paquet. */
export function createGameAudio(options: GameAudioOptions): AudioEngine {
  return createAudioEngine({
    host: options.audio,
    view: options.view,
    tables: loadTables(),
    assetUrl: soundUrl,
    random: options.random,
    cameraYaw: options.cameraYaw,
    storage: typeof localStorage === 'undefined' ? null : localStorage,
    ...(options.surfaceAt === undefined ? {} : { surfaceAt: options.surfaceAt }),
    ...(options.warn === undefined ? {} : { warn: options.warn }),
  });
}

export type { AudioEngine } from './moteur';
export type { AudioSettings } from './reglages';
export { loadTables, parseTables } from './table';
