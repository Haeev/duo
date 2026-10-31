// Table des canaux de la vue plateforme (ADR 0003, point 4). Le preload n'expose
// que ces canaux; le principal valide chaque argument (schémas dans
// main/ipc-schemas.ts) et vérifie que l'émetteur est la vue plateforme.
// À la fusion, cette table rejoint @duo/protocol.
import type { PlayerColor } from './players';
import type { AppState, SaveChoice, Settings } from './state';

export interface IntentArgs {
  'profile:save': { pseudo: string; color: PlayerColor };
  'setup:network-accept': null;
  'setup:complete': null;
  'settings:update': { readonly [K in keyof Settings]?: Settings[K] | undefined };
  'salon:open': { gameId: string };
  'salon:close': null;
  'salon:save-choice': { choice: SaveChoice };
  'salon:join': null;
  'salon:leave': null;
  'salon:ready': { ready: boolean };
  'match:pause': null;
  'match:resume': null;
  'match:stop': null;
  'end:dismiss': null;
  'notice:dismiss': null;
  'app:quit-confirm': null;
  'app:quit-cancel': null;
  'window:toggle-fullscreen': null;
}

export type IntentChannel = keyof IntentArgs;

export const INTENT_CHANNELS = [
  'profile:save',
  'setup:network-accept',
  'setup:complete',
  'settings:update',
  'salon:open',
  'salon:close',
  'salon:save-choice',
  'salon:join',
  'salon:leave',
  'salon:ready',
  'match:pause',
  'match:resume',
  'match:stop',
  'end:dismiss',
  'notice:dismiss',
  'app:quit-confirm',
  'app:quit-cancel',
  'window:toggle-fullscreen',
] as const satisfies readonly IntentChannel[];

// Garde de compilation: chaque canal de IntentArgs figure dans la liste.
type MissingChannel = Exclude<IntentChannel, (typeof INTENT_CHANNELS)[number]>;
export const INTENT_CHANNELS_COMPLETE: [MissingChannel] extends [never] ? true : never = true;

export function isIntentChannel(value: unknown): value is IntentChannel {
  return typeof value === 'string' && (INTENT_CHANNELS as readonly string[]).includes(value);
}

/** Réponse d'une intention: acceptée, ou refusée avec une raison (journalisée). */
export type IntentResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

/** Canaux internes du preload. */
export const IPC_INTENT_PREFIX = 'duo:intent:';
export const IPC_GET_STATE = 'duo:state:get';
export const IPC_STATE = 'duo:state';

/** API exposée par `preload-platform` sous `window.duo`. */
export interface DuoApi {
  invoke<C extends IntentChannel>(channel: C, arg: IntentArgs[C]): Promise<IntentResult>;
  getState(): Promise<AppState>;
  onState(listener: (state: AppState) => void): () => void;
}
