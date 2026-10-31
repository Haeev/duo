// Côté jeu du pont: obtention du MessagePort et échanges validés avec la plateforme.
import {
  BRIDGE_PORT_MESSAGE,
  BRIDGE_PORT_REQUEST,
  parsePlatformMessage,
  type GameMessage,
  type PlatformMessage,
} from '@duo/protocol';
import type { Unsubscribe } from './api';

let capturedPort: MessagePort | null = null;
const portWaiters = new Set<(port: MessagePort) => void>();

function isPortMessage(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === BRIDGE_PORT_MESSAGE
  );
}

function onWindowMessage(event: MessageEvent): void {
  const port = event.ports[0];
  if (capturedPort !== null || port === undefined || !isPortMessage(event.data)) {
    return;
  }
  capturedPort = port;
  for (const waiter of portWaiters) {
    waiter(port);
  }
  portWaiters.clear();
}

// Écoute posée dès le chargement du module: le port remis par `preload-game` ou par la page
// parente peut arriver avant que le jeu n'appelle `connect`.
if (typeof window !== 'undefined') {
  window.addEventListener('message', onWindowMessage);
}

/** Attend le port du pont remis à la page. Dans un cadre (faux hôte), le demande aussi au parent. */
export function waitForPort(timeoutMs: number): Promise<MessagePort> {
  if (capturedPort !== null) {
    return Promise.resolve(capturedPort);
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      portWaiters.delete(waiter);
      reject(
        new Error(
          `Duo: aucun pont reçu en ${timeoutMs} ms (le jeu doit être lancé par Duo ou par le faux hôte)`,
        ),
      );
    }, timeoutMs);
    const waiter = (port: MessagePort): void => {
      clearTimeout(timer);
      resolve(port);
    };
    portWaiters.add(waiter);
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: BRIDGE_PORT_REQUEST }, '*');
    }
  });
}

/** Extrémité du pont, côté jeu. */
export interface GameBridge {
  send(message: GameMessage, transfer?: Transferable[]): void;
  onMessage(listener: (message: PlatformMessage) => void): Unsubscribe;
  /** Messages reçus mais non conformes au protocole (journalisés par le contexte). */
  onInvalid(listener: (raw: unknown) => void): Unsubscribe;
  close(): void;
}

export function createGameBridge(port: MessagePort): GameBridge {
  const listeners = new Set<(message: PlatformMessage) => void>();
  const invalidListeners = new Set<(raw: unknown) => void>();
  let closed = false;

  port.onmessage = (event: MessageEvent): void => {
    const raw: unknown = event.data;
    const message = parsePlatformMessage(raw);
    if (message === null) {
      for (const listener of invalidListeners) listener(raw);
      return;
    }
    for (const listener of listeners) listener(message);
  };

  return {
    send(message, transfer) {
      if (closed) return;
      if (transfer === undefined) {
        port.postMessage(message);
      } else {
        port.postMessage(message, transfer);
      }
    },
    onMessage(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onInvalid(listener) {
      invalidListeners.add(listener);
      return () => invalidListeners.delete(listener);
    },
    close() {
      closed = true;
      listeners.clear();
      invalidListeners.clear();
      port.onmessage = null;
      port.close();
    },
  };
}
