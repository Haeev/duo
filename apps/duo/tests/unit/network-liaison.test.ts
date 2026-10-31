// L'adaptateur de la plateforme sur `@duo/liaison`, en temps simulé: deux machines du
// réseau simulé, découverte, salon de la plateforme, partie, relais du jeu, heure de
// session, perte et retour du lien, départ de l'autre.
import { describe, expect, it } from 'vitest';
import { SimNetwork } from '@duo/liaison/sim';
import type { Journal } from '../../src/main/journal';
import type { LiaisonEvent, PeerInfo, SessionsView } from '../../src/main/liaison/liaison';
import { NetworkLiaison } from '../../src/main/liaison/network-liaison';
import type { SalonGame } from '../../src/main/liaison/session-machine';

const journal: Journal = { write: () => undefined, flush: () => Promise.resolve() };
const MAC = '192.168.1.10';
const PC = '192.168.1.20';
const GAME: SalonGame = { id: 'la-petite-ligne', version: '0.1.0', saveChoice: 'new', save: null };

interface Probe {
  readonly liaison: NetworkLiaison;
  peer: PeerInfo | null;
  sessions: SessionsView | null;
  readonly link: boolean[];
  readonly games: string[];
}

/**
 * `earlyMs`: les minuteurs sonnent un peu avant l'échéance, comme ceux de Node face à
 * `performance.now()` (vu dans Electron: le décompte du salon ne finissait jamais).
 */
function probe(net: SimNetwork, address: string, clockOffsetMs: number, earlyMs = 0): Probe {
  const base = net.addHost(address, { clockOffsetMs });
  const driver =
    earlyMs === 0
      ? base
      : {
          ...base,
          clock: {
            now: () => base.clock.now(),
            setTimeout: (callback: () => void, delayMs: number) =>
              base.clock.setTimeout(callback, delayMs > earlyMs ? delayMs - earlyMs : delayMs),
          },
        };
  const liaison = new NetworkLiaison({
    journal,
    network: { peers: [], allowLoopback: false },
    computerName: address,
    driver,
    displayNow: () => driver.clock.now(),
  });
  const state: Probe = { liaison, peer: null, sessions: null, link: [], games: [] };
  liaison.subscribe((event: LiaisonEvent) => {
    if (event.type === 'peer') state.peer = event.peer;
    if (event.type === 'sessions') state.sessions = event.sessions;
    if (event.type === 'link') state.link.push(event.up);
    if (event.type === 'game') state.games.push(event.message.data);
  });
  return state;
}

function until(net: SimNetwork, check: () => boolean, maxMs: number): void {
  const start = net.clock.now();
  while (!check()) {
    if (net.clock.now() - start > maxMs)
      throw new Error(`condition non atteinte en ${String(maxMs)} ms`);
    net.clock.advance(5);
  }
}

/** Fermeture propre en temps simulé: les adieux UDP partent à 50 ms d'écart. */
async function stopAll(net: SimNetwork, ...probes: Probe[]): Promise<void> {
  const stopping = Promise.all(probes.map((entry) => entry.liaison.stop()));
  net.clock.advance(300);
  await stopping;
}

async function startPair(earlyMs = 0): Promise<{ net: SimNetwork; mac: Probe; pc: Probe }> {
  const net = new SimNetwork({ seed: 9 });
  // Horloges d'origines très différentes: l'heure de session doit pourtant être commune.
  const mac = probe(net, MAC, 0, earlyMs);
  const pc = probe(net, PC, 5000);
  await Promise.all([
    mac.liaison.start({
      machineId: '1a2b3c4d-0000-4000-8000-000000000001',
      appVersion: '0.1.0',
      profile: { pseudo: 'Camille', color: 'orb' },
    }),
    pc.liaison.start({
      machineId: '5e6f7a8b-0000-4000-8000-000000000002',
      appVersion: '0.1.0',
      profile: { pseudo: 'Sacha', color: 'crescent' },
    }),
  ]);
  until(net, () => mac.peer !== null && pc.peer !== null, 2000);
  return { net, mac, pc };
}

describe('liaison réseau de la plateforme', () => {
  it('se trouve, tient le salon de la plateforme, lance la partie et relaie le jeu', async () => {
    const { net, mac, pc } = await startPair();
    expect(mac.peer?.profile).toEqual({ pseudo: 'Sacha', color: 'crescent' });
    expect(pc.peer?.machineId).toBe('1a2b3c4d-0000-4000-8000-000000000001');

    mac.liaison.openSalon(GAME);
    until(net, () => pc.sessions?.peer?.salon !== null && pc.sessions?.peer !== undefined, 500);
    pc.liaison.joinSalon();
    until(net, () => mac.sessions?.own.salon?.guestJoined === true, 500);
    mac.liaison.setReady(true);
    until(net, () => (pc.sessions?.peer?.salon?.countdownEndsAt ?? null) !== null, 500);
    // Le décompte finit au même instant sur les deux machines, malgré 5 s d'écart d'horloge.
    const macEnd = mac.sessions?.own.salon?.countdownEndsAt ?? 0;
    const pcEnd = (pc.sessions?.peer?.salon?.countdownEndsAt ?? 0) - 5000;
    expect(Math.abs(macEnd - pcEnd)).toBeLessThan(5);

    until(net, () => pc.sessions?.peer?.match?.phase === 'loading', 4000);
    expect(pc.liaison.sessionOffsetMs()).toBeCloseTo(-5000, -1);
    expect(mac.liaison.sessionOffsetMs()).toBe(0);
    mac.liaison.reportLoaded();
    pc.liaison.reportLoaded();
    until(net, () => pc.sessions?.peer?.match?.phase === 'playing', 1000);

    mac.liaison.sendGame({ channel: 2, mode: 'latest', data: '{"tick":1,"nom":"Hélène"}' });
    pc.liaison.sendGame({ channel: 1, mode: 'reliable', data: '{"n":1}' });
    net.clock.advance(20);
    expect(pc.games).toEqual(['{"tick":1,"nom":"Hélène"}']);
    expect(mac.games).toEqual(['{"n":1}']);
    expect(mac.liaison.stats()).toMatchObject({
      gameSent: 1,
      gameReceived: 1,
      partner: 'connected',
    });

    await stopAll(net, mac, pc);
  });

  it('le décompte finit même quand les minuteurs sonnent avant l’échéance', async () => {
    const { net, mac, pc } = await startPair(0.6);
    mac.liaison.openSalon(GAME);
    until(net, () => (pc.sessions?.peer?.salon ?? null) !== null, 500);
    pc.liaison.joinSalon();
    until(net, () => mac.sessions?.own.salon?.guestJoined === true, 500);
    mac.liaison.setReady(true);
    until(net, () => mac.sessions?.own.match?.phase === 'loading', 4000);
    await stopAll(net, mac, pc);
  });

  it('coupure en partie: pause des deux côtés vers 2 s, retour du lien, puis départ de l’autre', async () => {
    const { net, mac, pc } = await startPair();
    mac.liaison.openSalon(GAME);
    until(net, () => (pc.sessions?.peer?.salon ?? null) !== null, 500);
    pc.liaison.joinSalon();
    until(net, () => mac.sessions?.own.salon?.guestJoined === true, 500);
    mac.liaison.setReady(true);
    until(net, () => pc.sessions?.peer?.match?.phase === 'loading', 4000);
    mac.liaison.reportLoaded();
    pc.liaison.reportLoaded();
    until(net, () => pc.sessions?.peer?.match?.phase === 'playing', 1000);

    const cutAt = net.clock.now();
    net.cut(MAC, PC);
    until(net, () => mac.link.includes(false) && pc.link.includes(false), 3000);
    expect(net.clock.now() - cutAt).toBeLessThanOrEqual(2100);
    expect(mac.sessions?.own.match?.linkLost).toBe(true);
    expect(mac.sessions?.own.match?.phase).toBe('paused');
    net.restore(MAC, PC);
    until(net, () => mac.link.at(-1) === true && pc.link.at(-1) === true, 2000);
    until(net, () => pc.sessions?.peer?.match?.linkLost === false, 1000);

    // Fermeture propre de l'invité: l'hôte clôt la partie et l'apprend aussitôt.
    await stopAll(net, pc);
    until(net, () => mac.peer === null, 500);
    expect(mac.sessions?.own.match).toBeNull();
    expect(mac.sessions?.own.lastEnd?.reason).toBe('guest-gone');
    await stopAll(net, mac);
  });
});
