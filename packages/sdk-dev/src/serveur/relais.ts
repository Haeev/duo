// Relais du mode réseau local: un hôte et un invité au plus; chaque trame de l'un part chez l'autre, sans être décodée.

/** Taille maximale d'une trame relayée (message de jeu de 64 Kio et son enveloppe). */
export const MAX_RELAY_FRAME_BYTES = 131_072;

export type RelayRole = 'host' | 'guest';

export interface RelaySocket {
  send(text: string): void;
  close(code: number, reason: string): void;
}

export interface RelayMember {
  onText(text: string): void;
  onClose(): void;
}

export type JoinResult =
  | { readonly ok: true; readonly member: RelayMember }
  | { readonly ok: false; readonly message: string };

export interface Relay {
  join(role: RelayRole, socket: RelaySocket): JoinResult;
  hostPresent(): boolean;
}

export function createRelay(): Relay {
  const members: Record<RelayRole, RelaySocket | null> = { host: null, guest: null };
  const other = (role: RelayRole): RelayRole => (role === 'host' ? 'guest' : 'host');
  const presence = (present: boolean): string => JSON.stringify({ t: 'peer', present });

  return {
    hostPresent: () => members.host !== null,
    join(role, socket) {
      if (members[role] !== null) {
        return {
          ok: false,
          message:
            role === 'host'
              ? 'Une partie est déjà hébergée sur ce serveur: rejoins-la.'
              : 'Deux joueurs sont déjà là.',
        };
      }
      members[role] = socket;
      const peer = members[other(role)];
      socket.send(presence(peer !== null));
      peer?.send(presence(true));
      return {
        ok: true,
        member: {
          onText(text) {
            if (members[role] !== socket) return;
            if (Buffer.byteLength(text, 'utf8') > MAX_RELAY_FRAME_BYTES) return;
            members[other(role)]?.send(text);
          },
          onClose() {
            if (members[role] !== socket) return;
            members[role] = null;
            members[other(role)]?.send(presence(false));
          },
        },
      };
    },
  };
}
