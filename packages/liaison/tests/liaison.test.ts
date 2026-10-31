import { describe, expect, it } from 'vitest';
import {
  MAC,
  MAC_ID,
  PC,
  PC_ID,
  advanceUntil,
  createMachine,
  createPair,
  isExactSequence,
  isPresent,
  isStrictlyIncreasing,
  linkStates,
  playMatch,
  startPair,
  startTraffic,
  stopMachine,
} from './helpers.ts';
import { PROFILE_R1, SimNetwork } from '../src/sim/network.ts';

describe('poignée de main et identification', () => {
  it("appel croisé: les deux s'appellent en même temps, une seule liaison reste", async () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const pair = createPair(undefined, seed);
      await startPair(pair, 3000);
      expect(isPresent(pair.mac) && isPresent(pair.pc)).toBe(true);
      expect(pair.net.openConnections(MAC)).toBe(1);
      expect(pair.net.openConnections(PC)).toBe(1);
      // Aucune liaison remplacée après coup.
      expect(pair.mac.logs.filter((event) => event === 'liaison-etablie')).toHaveLength(1);
      expect(pair.pc.logs.filter((event) => event === 'liaison-etablie')).toHaveLength(1);
      expect(pair.mac.logs).not.toContain('liaison-fermee');
    }
  });

  it("une preuve fausse (clé différente pour le même duo) n'établit rien", async () => {
    const net = new SimNetwork();
    const duo = 'c0ffee00c0ffee00c0ffee00c0ffee00';
    const createdAt = '2026-10-30T22:00:00.000Z';
    const mac = createMachine(net, MAC, MAC_ID, 'Camille', {}, {
      pairings: [{ duo, partner: PC_ID, key: 'A'.repeat(43), createdAt }],
      addresses: [],
    });
    const pc = createMachine(net, PC, PC_ID, 'Sacha', {}, {
      pairings: [{ duo, partner: MAC_ID, key: 'B'.repeat(43), createdAt }],
      addresses: [],
    });
    await Promise.all([mac.liaison.start(), pc.liaison.start()]);
    net.clock.advance(5000);
    expect(isPresent(mac)).toBe(false);
    expect(isPresent(pc)).toBe(false);
    expect([...mac.logs, ...pc.logs]).toContain('appel-sortant-echoue');
  });

  it("refuse de former un duo avec une inconnue quand la politique l'interdit et qu'un duo existe", async () => {
    const net = new SimNetwork();
    const mac = createMachine(net, MAC, MAC_ID, 'Camille', { pairingPolicy: 'first-partner-only' }, {
      pairings: [
        {
          duo: 'c0ffee00c0ffee00c0ffee00c0ffee00',
          partner: 'cccccccc-0000-4000-8000-000000000003',
          key: 'A'.repeat(43),
          createdAt: '2026-10-30T22:00:00.000Z',
        },
      ],
      addresses: [],
    });
    const pc = createMachine(net, PC, PC_ID, 'Sacha', { pairingPolicy: 'first-partner-only' });
    await Promise.all([mac.liaison.start(), pc.liaison.start()]);
    net.clock.advance(5000);
    expect(isPresent(mac)).toBe(false);
    expect(isPresent(pc)).toBe(false);
  });

  it("l'heure de session de l'invité suit l'horloge de l'hôte malgré des origines différentes", async () => {
    const pair = createPair(PROFILE_R1, 3, { mac: 1_000_000, pc: -5_000 });
    await startPair(pair, 4000);
    pair.mac.liaison.lobby.open({ id: 'la-petite-ligne', version: '0.1.0', save: null });
    advanceUntil(pair.net, () => pair.pc.liaison.session().invitation !== null, 2000);
    pair.pc.liaison.lobby.join();
    advanceUntil(pair.net, () => pair.pc.liaison.session().role === 'guest', 2000);
    pair.net.clock.advance(5000);
    const hostTime = pair.mac.liaison.sessionTime();
    const guestTime = pair.pc.liaison.sessionTime();
    // L'erreur est bornée par la moitié de l'aller-retour (100 ms avec R1).
    expect(Math.abs(hostTime - guestTime)).toBeLessThan(50);
  });
});

describe('vivacité, coupures et reprise', () => {
  it('vingt micro-coupures de 500 ms en partie: aucune perte déclarée, rien de perdu ni de doublé', async () => {
    const pair = createPair();
    await startPair(pair);
    playMatch(pair);
    const traffic = startTraffic(pair);
    pair.net.clock.advance(1000);
    for (let index = 0; index < 20; index += 1) {
      pair.net.cut(MAC, PC);
      pair.net.clock.advance(500);
      pair.net.restore(MAC, PC);
      pair.net.clock.advance(1500);
    }
    traffic.stop();
    pair.net.clock.advance(1000);
    expect(linkStates(pair.mac)).not.toContain('lost');
    expect(linkStates(pair.pc)).not.toContain('lost');
    expect(pair.mac.liaison.session().lobby?.match?.phase).toBe('playing');
    expect(isExactSequence(traffic.inputsAtHost, traffic.sentInputs())).toBe(true);
    expect(isStrictlyIncreasing(traffic.snapshotsAtGuest)).toBe(true);
    expect(traffic.snapshotsAtGuest.at(-1)).toBe(traffic.sentSnapshots());
  });

  it("coupure d'1 s en partie: aucune pause grâce à la reconnexion anticipée", async () => {
    const pair = createPair();
    await startPair(pair);
    playMatch(pair);
    const traffic = startTraffic(pair);
    pair.net.clock.advance(1000);
    for (let index = 0; index < 5; index += 1) {
      pair.net.cut(MAC, PC);
      pair.net.clock.advance(1000);
      pair.net.restore(MAC, PC);
      pair.net.clock.advance(3000);
    }
    traffic.stop();
    pair.net.clock.advance(1000);
    expect(linkStates(pair.mac)).not.toContain('lost');
    expect(linkStates(pair.pc)).not.toContain('lost');
    expect(isExactSequence(traffic.inputsAtHost, traffic.sentInputs())).toBe(true);
  });

  it('coupure franche de 3 s: pause des deux côtés vers 2 s, reprise logique au retour, rien de perdu', async () => {
    const pair = createPair();
    await startPair(pair);
    playMatch(pair);
    const traffic = startTraffic(pair);
    pair.net.clock.advance(1000);
    const cutAt = pair.net.clock.now();
    pair.net.cut(MAC, PC);
    advanceUntil(
      pair.net,
      () =>
        pair.mac.liaison.session().lobby?.match?.phase === 'paused' &&
        pair.pc.liaison.session().pausedByConnection,
      3000,
      1,
    );
    const pausedAfter = pair.net.clock.now() - cutAt;
    expect(pausedAfter).toBeGreaterThanOrEqual(2000);
    expect(pausedAfter).toBeLessThanOrEqual(2100);
    expect(pair.mac.liaison.session().lobby?.match?.pause?.reason).toBe('connection');
    pair.net.clock.advance(3000 - pausedAfter);
    pair.net.restore(MAC, PC);
    const back = advanceUntil(
      pair.net,
      () => linkStates(pair.mac).at(-1) === 'connected' && linkStates(pair.pc).at(-1) === 'connected',
      5000,
      1,
    );
    expect(back).toBeLessThan(500);
    // Après la coupure, pause ordinaire des deux côtés: chacun choisit « Reprendre ».
    advanceUntil(pair.net, () => pair.pc.liaison.session().lobby?.match?.phase === 'paused', 1000);
    expect(pair.pc.liaison.session().pausedByConnection).toBe(false);
    pair.mac.liaison.match.resume();
    pair.pc.liaison.match.resume();
    advanceUntil(pair.net, () => pair.pc.liaison.session().lobby?.match?.phase === 'resuming', 1000);
    const resumeAt = pair.pc.liaison.session().localTimes.resumeAt ?? 0;
    expect(resumeAt - pair.net.clock.now()).toBeGreaterThan(2500);
    advanceUntil(pair.net, () => pair.pc.liaison.session().lobby?.match?.phase === 'playing', 4000);
    traffic.stop();
    pair.net.clock.advance(1000);
    expect(isExactSequence(traffic.inputsAtHost, traffic.sentInputs())).toBe(true);
    expect(isStrictlyIncreasing(traffic.snapshotsAtGuest)).toBe(true);
  });

  it('connexion fermée par le système sans coupure: rappel immédiat, reprise, ni pause ni perte', async () => {
    const pair = createPair();
    await startPair(pair);
    playMatch(pair);
    const traffic = startTraffic(pair);
    pair.net.clock.advance(1000);
    for (let index = 0; index < 5; index += 1) {
      pair.net.breakConnections(MAC, PC);
      pair.net.clock.advance(2000);
    }
    traffic.stop();
    pair.net.clock.advance(1000);
    expect(linkStates(pair.mac)).not.toContain('lost');
    expect(pair.mac.logs.filter((event) => event === 'liaison-reprise').length).toBeGreaterThanOrEqual(5);
    expect(isExactSequence(traffic.inputsAtHost, traffic.sentInputs())).toBe(true);
    expect(pair.net.openConnections(MAC)).toBe(1);
  });

  it("canal `latest`: à la reprise, seul le dernier instantané est réémis; les messages fiables, tous", async () => {
    const pair = createPair();
    await startPair(pair);
    playMatch(pair);
    const received: { channel: number; payload: unknown }[] = [];
    pair.pc.liaison.on('game', (message) => received.push(message));
    pair.net.cut(MAC, PC);
    for (let tick = 1; tick <= 10; tick += 1) pair.mac.liaison.match.send(0, { tick }, 'latest');
    for (let n = 1; n <= 5; n += 1) pair.mac.liaison.match.send(1, { n }, 'reliable');
    pair.net.breakConnections(MAC, PC);
    pair.net.clock.advance(500);
    pair.net.restore(MAC, PC);
    advanceUntil(pair.net, () => received.length >= 6, 3000);
    pair.net.clock.advance(500);
    expect(received).toEqual([
      { channel: 0, payload: { tick: 10 } },
      { channel: 1, payload: { n: 1 } },
      { channel: 1, payload: { n: 2 } },
      { channel: 1, payload: { n: 3 } },
      { channel: 1, payload: { n: 4 } },
      { channel: 1, payload: { n: 5 } },
    ]);
  });

  it('profil R1 (100 ms, 20 ms de gigue, 2 % de pertes) pendant 2 min de partie: aucune pause', async () => {
    const pair = createPair(PROFILE_R1, 21);
    await startPair(pair, 3000);
    playMatch(pair);
    const traffic = startTraffic(pair);
    pair.net.clock.advance(120_000);
    traffic.stop();
    pair.net.clock.advance(2000);
    expect(linkStates(pair.mac)).not.toContain('lost');
    expect(linkStates(pair.pc)).not.toContain('lost');
    expect(isExactSequence(traffic.inputsAtHost, traffic.sentInputs())).toBe(true);
    expect(isStrictlyIncreasing(traffic.snapshotsAtGuest)).toBe(true);
  });

  it('au repos, une coupure longue retire la présence à 6 s, puis la liaison revient seule', async () => {
    const pair = createPair();
    await startPair(pair);
    const cutAt = pair.net.clock.now();
    pair.net.cut(MAC, PC);
    advanceUntil(pair.net, () => !isPresent(pair.mac), 8000, 10);
    // Le silence se compte depuis la dernière trame reçue (battement de 2 s au repos).
    const gone = pair.net.clock.now() - cutAt;
    expect(gone).toBeGreaterThanOrEqual(4000);
    expect(gone).toBeLessThan(6100);
    pair.net.clock.advance(10_000);
    pair.net.restore(MAC, PC);
    const back = advanceUntil(pair.net, () => isPresent(pair.mac) && isPresent(pair.pc), 5000);
    expect(back).toBeLessThan(2000);
  });

  it("l'invité redémarre pendant la partie: nouvelle liaison, l'hôte clôt la partie (pas de reprise possible)", async () => {
    const pair = createPair();
    await startPair(pair);
    playMatch(pair);
    const pcMemory = pair.pc.store.current();
    pair.net.crashHost(PC);
    pair.net.clock.advance(1000);
    const again = createMachine(pair.net, PC, PC_ID, 'Sacha', {}, pcMemory);
    await again.liaison.start();
    advanceUntil(pair.net, () => isPresent(again), 5000);
    pair.net.clock.advance(500);
    expect(pair.mac.events.notice).toContainEqual({ kind: 'match-ended', reason: 'peer-restarted', result: null });
    expect(pair.mac.liaison.session().lobby?.guestJoined).toBe(false);
    // Le salon de l'hôte reste ouvert: l'invité relancé le voit comme une invitation.
    advanceUntil(pair.net, () => again.liaison.session().invitation !== null, 1000);
  });

  it("l'hôte ferme Duo pendant la partie: l'invité l'apprend aussitôt et revient à l'accueil", async () => {
    const pair = createPair();
    await startPair(pair);
    playMatch(pair);
    await stopMachine(pair.net, pair.mac);
    advanceUntil(pair.net, () => !isPresent(pair.pc), 200, 1);
    expect(pair.pc.events.notice).toContainEqual({ kind: 'peer-left', reason: 'bye' });
    expect(pair.pc.liaison.session().lobby).toBeNull();
  });
});
