import { describe, expect, it } from 'vitest';
import { ManualClock } from '../src/clock.ts';
import { createConfig } from '../src/config.ts';
import { Link } from '../src/link.ts';
import type { LinkCallbacks, PeerInfo, ReliableMessage } from '../src/link.ts';
import type { Connection, ConnectionHandlers, Frame } from '../src/transport.ts';

/** Deux bouts de connexion reliés en mémoire, livrés après 1 ms simulée. */
function connectionPair(clock: ManualClock): [Connection, Connection] {
  const handlers: (ConnectionHandlers | null)[] = [null, null];
  const open = [true, true];
  const make = (side: 0 | 1): Connection => ({
    remote: { host: side === 0 ? '192.168.1.20' : '192.168.1.10', port: 39420 },
    direction: side === 0 ? 'outgoing' : 'incoming',
    bufferedAmount: 0,
    setHandlers: (next) => {
      handlers[side] = next;
    },
    send: (frame: Frame) => {
      if (!open[side]) return;
      clock.setTimeout(() => {
        if (open[1 - side]) handlers[1 - side]?.onFrame(frame);
      }, 1);
    },
    close: (code, reason) => {
      if (!open[side]) return;
      open[side] = false;
      clock.setTimeout(() => {
        open[1 - side] = false;
        handlers[1 - side]?.onClose({ code, reason });
      }, 1);
    },
  });
  return [make(0), make(1)];
}

const peer: PeerInfo = {
  machine: 'bbbbbbbb-0000-4000-8000-000000000002',
  instance: 'bbbbbbbb-0000-4000-8000-0000000000ff',
  appVersion: '0.1.0',
  protocol: 1,
  pseudo: 'Sacha',
  color: 'carre',
  computer: 'PC',
  games: [],
};

interface Probe {
  readonly link: Link;
  readonly messages: ReliableMessage[];
  readonly games: unknown[];
  readonly troubles: string[];
}

function createLink(clock: ManualClock, id: string): Probe {
  const messages: ReliableMessage[] = [];
  const games: unknown[] = [];
  const troubles: string[] = [];
  const callbacks: LinkCallbacks = {
    onMessage: (message) => messages.push(message),
    onGame: (_channel, payload) => games.push(payload),
    onHealth: () => undefined,
    onConnectionTrouble: (kind) => troubles.push(kind),
    onBye: () => undefined,
    onOverflow: () => undefined,
    onActivityChange: () => undefined,
    log: () => undefined,
  };
  return {
    link: new Link({ id, peer, config: createConfig(), clock, callbacks }),
    messages,
    games,
    troubles,
  };
}

describe('liaison logique', () => {
  it('réémet à la reprise ce que l’autre n’a pas reçu, sans doublon', () => {
    const clock = new ManualClock(0);
    const id = '0123456789abcdef0123456789abcdef';
    const a = createLink(clock, id);
    const b = createLink(clock, id);
    const [first, second] = connectionPair(clock);
    a.link.attach(first, 'caller', 0, null);
    b.link.attach(second, 'callee', 0, null);
    a.link.sendGame(1, { n: 1 }, 'reliable');
    a.link.sendGame(1, { n: 2 }, 'reliable');
    clock.advance(10);
    expect(b.games).toEqual([{ n: 1 }, { n: 2 }]);
    // La connexion se tait: ce qui part maintenant n'arrive pas.
    a.link.dropConnection();
    a.link.sendGame(1, { n: 3 }, 'reliable');
    a.link.sendReliable('salon.state', { state: 'x' });
    clock.advance(10);
    expect(b.games).toEqual([{ n: 1 }, { n: 2 }]);
    // Nouvelle connexion: chacun annonce ce qu'il a reçu, l'autre réémet la suite.
    const [third, fourth] = connectionPair(clock);
    a.link.attach(third, 'caller', b.link.received, null);
    b.link.attach(fourth, 'callee', a.link.received, null);
    clock.advance(10);
    expect(b.games).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    expect(b.messages.map((message) => message.type)).toEqual(['salon.state']);
    // Une reprise annoncée trop tôt (accusé plus ancien) ne double rien chez l'autre.
    const [fifth, sixth] = connectionPair(clock);
    a.link.attach(fifth, 'caller', 0, null);
    b.link.attach(sixth, 'callee', a.link.received, null);
    clock.advance(10);
    expect(b.games).toHaveLength(3);
    a.link.close('quit', false);
    b.link.close('quit', false);
  });

  it('dix messages invalides en une minute ferment la connexion (la liaison se reprendra)', () => {
    const clock = new ManualClock(0);
    const id = '0123456789abcdef0123456789abcdef';
    const a = createLink(clock, id);
    const [first, second] = connectionPair(clock);
    a.link.attach(first, 'callee', 0, null);
    second.setHandlers({ onFrame: () => undefined, onClose: () => undefined });
    for (let index = 0; index < 9; index += 1) second.send('{"pas":"duo"}');
    clock.advance(10);
    expect(a.link.hasConnection).toBe(true);
    second.send(new Uint8Array([7, 7, 7]));
    clock.advance(10);
    expect(a.link.hasConnection).toBe(false);
    expect(a.troubles).toContain('closed');
    a.link.close('quit', false);
  });
});
