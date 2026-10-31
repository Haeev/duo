// Lien entre les deux fausses plateformes par le serveur de relais (mode réseau local).
import * as v from 'valibot';
import type { LinkEvent, PeerLink } from '../coeur/lien';
import { parsePeerMessage, RelayControlSchema, type PeerMessage } from '../coeur/pair';

export function createWebSocketLink(url: string): PeerLink {
  const listeners = new Set<(event: LinkEvent) => void>();
  const emit = (event: LinkEvent): void => {
    for (const listener of listeners) listener(event);
  };
  const queue: string[] = [];
  const socket = new WebSocket(url);
  let closedByUs = false;

  socket.addEventListener('open', () => {
    for (const text of queue.splice(0)) socket.send(text);
  });
  socket.addEventListener('message', (event: MessageEvent) => {
    if (typeof event.data !== 'string') return;
    let raw: unknown;
    try {
      raw = JSON.parse(event.data);
    } catch {
      return;
    }
    const control = v.safeParse(RelayControlSchema, raw);
    if (control.success) {
      if (control.output.t === 'peer') emit({ kind: 'peer', present: control.output.present });
      else emit({ kind: 'closed', reason: control.output.message });
      return;
    }
    const message = parsePeerMessage(raw);
    if (message !== null) emit({ kind: 'message', message });
  });
  socket.addEventListener('close', () => {
    if (!closedByUs) emit({ kind: 'closed', reason: 'le serveur ne répond plus' });
  });

  return {
    send(message: PeerMessage) {
      const text = JSON.stringify(message);
      if (socket.readyState === WebSocket.OPEN) socket.send(text);
      else if (socket.readyState === WebSocket.CONNECTING) queue.push(text);
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      closedByUs = true;
      socket.close();
    },
  };
}
