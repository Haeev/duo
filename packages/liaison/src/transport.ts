import type { Endpoint, RawInterfaces } from './addresses.ts';
import type { Clock, CancelTimer } from './clock.ts';
import type { RandomSource } from './random.ts';

/** Trame d'une connexion: texte (JSON) ou binaire. */
export type Frame = string | Uint8Array;

export interface ConnectionHandlers {
  onFrame(frame: Frame): void;
  onClose(info: { readonly code: number; readonly reason: string }): void;
}

/**
 * Une connexion WebSocket établie (ou son équivalent simulé). Le cœur ne voit que
 * cette interface: `ws` en production, un lien simulé dans les tests.
 */
export interface Connection {
  readonly remote: Endpoint;
  readonly direction: 'outgoing' | 'incoming';
  /** Octets confiés et pas encore partis. */
  readonly bufferedAmount: number;
  setHandlers(handlers: ConnectionHandlers): void;
  send(frame: Frame): void;
  close(code: number, reason: string): void;
}

/** Cause d'un échec d'appel, telle que Node la voit (reseau.md, section 6.5). */
export type DialFailure = 'refused' | 'unreachable' | 'timeout' | 'not-duo' | 'error';

export interface DialCallbacks {
  onOpen(connection: Connection): void;
  onFail(failure: DialFailure): void;
}

export interface Dialer {
  /** Appelle une extrémité; un seul des deux rappels sera appelé, sauf annulation. */
  dial(endpoint: Endpoint, timeoutMs: number, callbacks: DialCallbacks): CancelTimer;
}

export interface StreamServer {
  readonly port: number;
  close(): Promise<void>;
}

export interface DatagramSocket {
  readonly port: number;
  send(data: Uint8Array, endpoint: Endpoint): void;
  close(): void;
}

export interface ListenOptions {
  readonly port: number;
  readonly onConnection: (connection: Connection) => void;
}

export interface BindOptions {
  readonly port: number;
  readonly onMessage: (data: Uint8Array, from: Endpoint) => void;
  readonly onError: (error: Error) => void;
}

/**
 * Tout ce que le réseau de Duo demande au système, injecté d'un bloc: Node (`ws`,
 * `dgram`, `os`) en production, le réseau simulé dans les tests.
 */
export interface NetworkDriver {
  readonly clock: Clock;
  readonly random: RandomSource;
  readonly dialer: Dialer;
  /** Écoute TCP (WebSocket) sur un port; échoue si le port est pris. */
  listen(options: ListenOptions): Promise<StreamServer>;
  /** Socket UDP sur un port, diffusion permise; échoue si le port est pris. */
  bindDatagram(options: BindOptions): Promise<DatagramSocket>;
  interfaces(): RawInterfaces;
}
