// Liens entre les deux fausses plateformes: relais local en mémoire (deux vues) ou WebSocket (réseau local).
import type { Unsubscribe } from '@duo/sdk';
import { parsePeerMessage, type PeerMessage } from './pair';

export type LinkEvent =
  | { readonly kind: 'message'; readonly message: PeerMessage }
  | { readonly kind: 'peer'; readonly present: boolean }
  | { readonly kind: 'closed'; readonly reason: string };

export interface PeerLink {
  send(message: PeerMessage): void;
  on(listener: (event: LinkEvent) => void): Unsubscribe;
  close(): void;
}

/** Conditions du relais local, réglables pendant la partie. */
export interface LinkConditions {
  /** Latence d'un trajet, en millisecondes. */
  latencyMs: number;
  /** Gigue: retard supplémentaire tiré entre 0 et cette valeur. */
  jitterMs: number;
  /** Probabilité qu'un message subisse une réémission TCP (retard de 200 ms, l'ordre est gardé). */
  spikeProbability: number;
}

export interface LocalLinkPair {
  readonly host: PeerLink;
  readonly guest: PeerLink;
  readonly conditions: LinkConditions;
  /** Messages en transit, pour les tests. */
  pending(): number;
}

const SPIKE_MS = 200;

/**
 * Deux extrémités reliées en mémoire. Chaque message passe par JSON (comme sur le fil), arrive
 * dans l'ordre d'envoi (comme sur TCP), après la latence et la gigue choisies.
 * `random` est injectable pour des tests reproductibles.
 */
export function createLocalLinkPair(
  initial: Partial<LinkConditions> = {},
  random: () => number = Math.random,
): LocalLinkPair {
  const conditions: LinkConditions = {
    latencyMs: initial.latencyMs ?? 0,
    jitterMs: initial.jitterMs ?? 0,
    spikeProbability: initial.spikeProbability ?? 0,
  };
  let inFlight = 0;
  let closed = false;

  const makeSide = (): {
    link: PeerLink;
    deliver: (json: string) => void;
    emit: (event: LinkEvent) => void;
  } => {
    const listeners = new Set<(event: LinkEvent) => void>();
    const emit = (event: LinkEvent): void => {
      for (const listener of listeners) listener(event);
    };
    return {
      emit,
      deliver: (json) => {
        const message = parsePeerMessage(JSON.parse(json));
        if (message !== null) emit({ kind: 'message', message });
      },
      link: {
        send: () => undefined,
        on(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        close: () => undefined,
      },
    };
  };

  const a = makeSide();
  const b = makeSide();
  // Heure d'arrivée du dernier message dans chaque sens: un message ne double jamais le précédent.
  const lastArrival = { ab: 0, ba: 0 };

  const sendFrom = (direction: 'ab' | 'ba', message: PeerMessage): void => {
    if (closed) return;
    const target = direction === 'ab' ? b : a;
    const json = JSON.stringify(message);
    const now = performance.now();
    let delay = conditions.latencyMs + random() * conditions.jitterMs;
    if (random() < conditions.spikeProbability) delay += SPIKE_MS;
    const arrival = Math.max(now + delay, lastArrival[direction]);
    lastArrival[direction] = arrival;
    inFlight++;
    const wait = arrival - now;
    const run = (): void => {
      inFlight--;
      if (!closed) target.deliver(json);
    };
    if (wait <= 0) queueMicrotask(run);
    else setTimeout(run, wait);
  };

  const closeAll = (): void => {
    if (closed) return;
    closed = true;
    a.emit({ kind: 'closed', reason: 'fermé' });
    b.emit({ kind: 'closed', reason: 'fermé' });
  };

  const host: PeerLink = {
    ...a.link,
    send: (m) => {
      sendFrom('ab', m);
    },
    close: closeAll,
  };
  const guest: PeerLink = {
    ...b.link,
    send: (m) => {
      sendFrom('ba', m);
    },
    close: closeAll,
  };
  queueMicrotask(() => {
    a.emit({ kind: 'peer', present: true });
    b.emit({ kind: 'peer', present: true });
  });
  return { host, guest, conditions, pending: () => inFlight };
}
