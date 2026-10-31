// Deux liaisons provisoires dans un même processus, sur la boucle locale: présence,
// salon, décompte, partie, relais des messages de jeu, pause, fermeture propre.
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { Journal } from '../../src/main/journal';
import type { LiaisonEvent, PeerInfo, SessionsView } from '../../src/main/liaison/liaison';
import { LocalLiaison } from '../../src/main/liaison/local/local-liaison';

const journal: Journal = {
  write: () => undefined,
  flush: () => Promise.resolve(),
};

interface Probe {
  readonly liaison: LocalLiaison;
  peer: PeerInfo | null;
  sessions: SessionsView | null;
  link: boolean[];
  games: unknown[];
}

function probe(basePort: number): Probe {
  const liaison = new LocalLiaison({ basePort, peerAddress: null, journal });
  const state: Probe = { liaison, peer: null, sessions: null, link: [], games: [] };
  liaison.subscribe((event: LiaisonEvent) => {
    switch (event.type) {
      case 'peer':
        state.peer = event.peer;
        break;
      case 'sessions':
        state.sessions = event.sessions;
        break;
      case 'link':
        state.link.push(event.up);
        break;
      case 'game':
        state.games.push(event.message.data);
        break;
    }
  });
  return state;
}

async function waitFor(check: () => boolean, timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('délai dépassé');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

const started: LocalLiaison[] = [];

afterEach(async () => {
  await Promise.all(started.splice(0).map((liaison) => liaison.stop()));
});

describe('liaison provisoire entre deux instances', () => {
  it('se trouve, ouvre un salon, lance la partie, relaie le jeu, met en pause, se quitte proprement', async () => {
    const basePort = 42000 + Math.floor(Math.random() * 1000) * 2;
    const camille = probe(basePort);
    const sacha = probe(basePort);
    started.push(camille.liaison, sacha.liaison);
    await camille.liaison.start({ machineId: randomUUID(), appVersion: '0.1.0', profile: { pseudo: 'Camille', color: 'orb' } });
    await sacha.liaison.start({ machineId: randomUUID(), appVersion: '0.1.0', profile: { pseudo: 'Sacha', color: 'crescent' } });

    await waitFor(() => camille.peer !== null && sacha.peer !== null);
    expect(camille.peer?.profile.pseudo).toBe('Sacha');
    expect(sacha.peer?.profile.pseudo).toBe('Camille');

    camille.liaison.openSalon({ id: 'essai-pont', version: '1.0.0', saveChoice: 'new', save: null });
    await waitFor(() => sacha.sessions?.peer?.salon !== null && sacha.sessions?.peer?.salon !== undefined);

    sacha.liaison.joinSalon();
    await waitFor(() => camille.sessions?.own.salon?.guestJoined === true);
    camille.liaison.setReady(true);
    await waitFor(() => sacha.sessions?.peer?.salon?.countdownEndsAt !== null);

    await waitFor(() => sacha.sessions?.peer?.match?.phase === 'loading', 6000);
    sacha.liaison.reportLoaded();
    camille.liaison.reportLoaded();
    await waitFor(() => sacha.sessions?.peer?.match?.phase === 'playing');

    sacha.liaison.sendGame({ channel: 0, mode: 'reliable', data: '{"count":1}' });
    camille.liaison.sendGame({ channel: 1, mode: 'latest', data: '{"snapshot":7}' });
    await waitFor(() => camille.games.length === 1 && sacha.games.length === 1);
    expect(camille.games).toEqual(['{"count":1}']);
    expect(sacha.games).toEqual(['{"snapshot":7}']);

    sacha.liaison.requestPause();
    await waitFor(() => camille.sessions?.own.match?.phase === 'paused');
    expect(camille.sessions?.own.match?.pausedBy).toEqual({ host: false, guest: true });

    await sacha.liaison.stop();
    started.splice(started.indexOf(sacha.liaison), 1);
    await waitFor(() => camille.peer === null);
    expect(camille.sessions?.own.match).toBeNull();
    expect(camille.sessions?.own.lastEnd?.reason).toBe('guest-gone');
  }, 20_000);
});
