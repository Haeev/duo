// Deux liaisons provisoires dans un même processus, sur la boucle locale: présence,
// salon, décompte, partie, relais des messages de jeu, pause, fermeture propre.
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import type { Journal } from '../../src/main/journal';
import type { LiaisonEvent, PeerInfo, SessionsView } from '../../src/main/liaison/liaison';
import { LocalLiaison } from '../../src/main/liaison/local/local-liaison';

/** Événements « listen-failed »: une liaison sans port d'écoute ne trouvera jamais l'autre. */
const listenFailures: unknown[] = [];

const journal: Journal = {
  write: (_level, _module, event, details) => {
    if (event === 'listen-failed') listenFailures.push(details);
  },
  flush: () => Promise.resolve(),
};

function canListen(port: number): Promise<net.Server | null> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(null);
    });
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

/**
 * Deux ports consécutifs libres. Sous Windows, des plages entières sont réservées
 * (Hyper-V, WinNAT) et refusent l'écoute: un port tiré au hasard peut y tomber.
 */
async function freePortPair(): Promise<number> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    // Sous 49152: hors de la plage des ports éphémères de Windows et de macOS.
    const port = 20_000 + Math.floor(Math.random() * 14_000) * 2;
    const first = await canListen(port);
    const second = first === null ? null : await canListen(port + 1);
    for (const server of [first, second]) {
      if (server !== null) await new Promise((resolve) => server.close(resolve));
    }
    if (first !== null && second !== null) return port;
  }
  throw new Error('aucune paire de ports libres sur la boucle locale');
}

// Les machines de CI (Windows surtout) sont lentes et partagées: chaque attente a une
// marge large, sans rien ralentir quand tout va bien, car elle se termine dès l'événement.
const CI_FACTOR = process.env.CI === undefined ? 1 : 3;
const WAIT_MS = 10_000 * CI_FACTOR;

/** Réveille les attentes à chaque événement de l'une ou l'autre liaison. */
const waiters = new Set<() => void>();

function notifyWaiters(): void {
  for (const wake of [...waiters]) wake();
}

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
      case 'quality':
        // La liaison provisoire ne mesure pas le lien.
        break;
    }
    notifyWaiters();
  });
  return state;
}

/** Attend qu'un événement rende `check` vrai; l'échec nomme l'étape attendue. */
function waitFor(step: string, check: () => boolean, timeoutMs = WAIT_MS): Promise<void> {
  if (check()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = (): void => {
      clearTimeout(timer);
      waiters.delete(wake);
    };
    const wake = (): void => {
      if (!check()) return;
      done();
      resolve();
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error(`délai dépassé (${timeoutMs} ms): ${step}`));
    }, timeoutMs);
    waiters.add(wake);
  });
}

const started: LocalLiaison[] = [];

afterEach(async () => {
  waiters.clear();
  await Promise.all(started.splice(0).map((liaison) => liaison.stop()));
});

describe('liaison provisoire entre deux instances', () => {
  it(
    'se trouve, ouvre un salon, lance la partie, relaie le jeu, met en pause, se quitte proprement',
    async () => {
      listenFailures.length = 0;
      const basePort = await freePortPair();
      const camille = probe(basePort);
      const sacha = probe(basePort);
      started.push(camille.liaison, sacha.liaison);
      await camille.liaison.start({
        machineId: randomUUID(),
        appVersion: '0.1.0',
        profile: { pseudo: 'Camille', color: 'orb' },
      });
      await sacha.liaison.start({
        machineId: randomUUID(),
        appVersion: '0.1.0',
        profile: { pseudo: 'Sacha', color: 'crescent' },
      });
      expect(listenFailures).toEqual([]);

      await waitFor('les deux se voient', () => camille.peer !== null && sacha.peer !== null);
      expect(camille.peer?.profile.pseudo).toBe('Sacha');
      expect(sacha.peer?.profile.pseudo).toBe('Camille');

      camille.liaison.openSalon({
        id: 'essai-pont',
        version: '1.0.0',
        saveChoice: 'new',
        save: null,
      });
      await waitFor(
        'Sacha voit le salon',
        () => sacha.sessions?.peer?.salon !== null && sacha.sessions?.peer?.salon !== undefined,
      );

      sacha.liaison.joinSalon();
      await waitFor('Sacha a rejoint', () => camille.sessions?.own.salon?.guestJoined === true);
      camille.liaison.setReady(true);
      await waitFor('décompte', () => {
        const countdown = sacha.sessions?.peer?.salon?.countdownEndsAt;
        return countdown !== null && countdown !== undefined;
      });

      // Le décompte dure COUNTDOWN_MS (3 s) avant le chargement: l'attente par défaut le couvre.
      await waitFor('chargement', () => sacha.sessions?.peer?.match?.phase === 'loading');
      sacha.liaison.reportLoaded();
      camille.liaison.reportLoaded();
      await waitFor('partie lancée', () => sacha.sessions?.peer?.match?.phase === 'playing');

      sacha.liaison.sendGame({ channel: 0, mode: 'reliable', data: '{"count":1}' });
      camille.liaison.sendGame({ channel: 1, mode: 'latest', data: '{"snapshot":7}' });
      await waitFor(
        'messages relayés',
        () => camille.games.length === 1 && sacha.games.length === 1,
      );
      expect(camille.games).toEqual(['{"count":1}']);
      expect(sacha.games).toEqual(['{"snapshot":7}']);

      sacha.liaison.requestPause();
      await waitFor('pause', () => camille.sessions?.own.match?.phase === 'paused');
      expect(camille.sessions?.own.match?.pausedBy).toEqual({ host: false, guest: true });

      await sacha.liaison.stop();
      started.splice(started.indexOf(sacha.liaison), 1);
      await waitFor('départ de Sacha', () => camille.peer === null);
      expect(camille.sessions?.own.match).toBeNull();
      expect(camille.sessions?.own.lastEnd?.reason).toBe('guest-gone');
    },
    60_000 * CI_FACTOR,
  );
});
