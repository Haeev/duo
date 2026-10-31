import { describe, expect, it } from 'vitest';
import { MAC, PC, advanceUntil, createPair, playMatch, startPair } from './helpers.ts';
import { PROFILE_R1 } from '../src/sim/network.ts';
import type { Pair } from './helpers.ts';

const GAME = { id: 'la-petite-ligne', version: '0.1.0', save: null };

function openAndJoin(pair: Pair): void {
  pair.mac.liaison.lobby.open(GAME);
  advanceUntil(pair.net, () => pair.pc.liaison.session().invitation !== null, 1000);
  pair.pc.liaison.lobby.join();
  advanceUntil(pair.net, () => pair.pc.liaison.session().role === 'guest', 1000);
}

describe('salon', () => {
  it("l'invitation apparaît chez l'autre en quelques millisecondes, Rejoindre vaut « C'est parti »", async () => {
    const pair = createPair();
    await startPair(pair);
    pair.mac.liaison.lobby.open(GAME);
    const shown = advanceUntil(
      pair.net,
      () => pair.pc.liaison.session().invitation !== null,
      1000,
      1,
    );
    expect(shown).toBeLessThan(10);
    expect(pair.pc.liaison.session().invitation?.game.id).toBe('la-petite-ligne');
    pair.pc.liaison.lobby.join();
    advanceUntil(pair.net, () => pair.mac.liaison.session().lobby?.guestJoined === true, 1000, 1);
    expect(pair.mac.liaison.session().lobby?.ready).toEqual({ host: false, guest: true });
    expect(pair.pc.liaison.session().role).toBe('guest');
  });

  it('les deux prêts: décompte de 3 s à la même heure sur les deux écrans, chargement, départ commun', async () => {
    const pair = createPair(undefined, 5, { mac: 123_456, pc: -9_999 });
    await startPair(pair, 3000);
    openAndJoin(pair);
    pair.mac.liaison.lobby.setReady(true);
    advanceUntil(pair.net, () => pair.pc.liaison.session().lobby?.phase === 'countdown', 1000, 1);
    // Heures locales des deux machines ramenées à l'horloge commune du banc.
    const macEnd = (pair.mac.liaison.session().localTimes.countdownEndsAt ?? 0) - 123_456;
    const pcEnd = (pair.pc.liaison.session().localTimes.countdownEndsAt ?? 0) + 9_999;
    expect(Math.abs(macEnd - pcEnd)).toBeLessThan(5);
    advanceUntil(pair.net, () => pair.pc.liaison.session().lobby?.match?.phase === 'loading', 4000);
    pair.pc.liaison.match.reportLoaded();
    pair.net.clock.advance(500);
    expect(pair.mac.liaison.session().lobby?.match?.phase).toBe('loading');
    pair.mac.liaison.match.reportLoaded();
    advanceUntil(
      pair.net,
      () => pair.pc.liaison.session().lobby?.match?.phase === 'starting',
      1000,
    );
    const macStart = (pair.mac.liaison.session().localTimes.startsAt ?? 0) - 123_456;
    const pcStart = (pair.pc.liaison.session().localTimes.startsAt ?? 0) + 9_999;
    expect(Math.abs(macStart - pcStart)).toBeLessThan(5);
    expect(macStart - (pair.net.clock.now() - 1)).toBeGreaterThanOrEqual(290);
    advanceUntil(pair.net, () => pair.pc.liaison.session().lobby?.match?.phase === 'playing', 1000);
    const match = pair.pc.liaison.session().lobby?.match;
    expect(match?.seed).toBe(pair.mac.liaison.session().lobby?.match?.seed);
  });

  it('annulation tardive: un « Pas encore » appuyé avant la fin du décompte est honoré, même reçu après', async () => {
    const pair = createPair({ latencyMs: 50, jitterMs: 0, loss: 0, retransmitMs: 200 });
    await startPair(pair, 3000);
    openAndJoin(pair);
    pair.mac.liaison.lobby.setReady(true);
    advanceUntil(pair.net, () => pair.pc.liaison.session().lobby?.phase === 'countdown', 1000, 1);
    const endsAt = pair.pc.liaison.session().localTimes.countdownEndsAt ?? 0;
    pair.net.clock.advance(endsAt - pair.net.clock.now() - 40);
    pair.pc.liaison.lobby.setReady(false);
    pair.net.clock.advance(1000);
    expect(pair.mac.liaison.session().lobby?.phase).toBe('open');
    expect(pair.mac.liaison.session().lobby?.match).toBeNull();
    expect(pair.mac.liaison.session().lobby?.ready.guest).toBe(false);
  });

  it('un « Pas encore » appuyé après la fin du décompte ne retient pas la partie', async () => {
    const pair = createPair({ latencyMs: 50, jitterMs: 0, loss: 0, retransmitMs: 200 });
    await startPair(pair, 3000);
    openAndJoin(pair);
    pair.mac.liaison.lobby.setReady(true);
    advanceUntil(pair.net, () => pair.pc.liaison.session().lobby?.phase === 'countdown', 1000, 1);
    const endsAt = pair.pc.liaison.session().localTimes.countdownEndsAt ?? 0;
    pair.net.clock.advance(endsAt - pair.net.clock.now() + 5);
    pair.pc.liaison.lobby.setReady(false);
    pair.net.clock.advance(1000);
    expect(pair.mac.liaison.session().lobby?.match?.phase).toBe('loading');
  });

  it("changer de jeu remet les deux joueurs à « Pas encore » et prévient l'autre", async () => {
    const pair = createPair();
    await startPair(pair);
    openAndJoin(pair);
    pair.mac.liaison.lobby.select({ id: 'autre-jeu', version: '1.0.0', save: null });
    advanceUntil(pair.net, () => pair.pc.liaison.session().lobby?.game.id === 'autre-jeu', 1000);
    expect(pair.pc.liaison.session().lobby?.ready).toEqual({ host: false, guest: false });
  });

  it('deux salons rejoints en même temps: celui de la machine au plus petit identifiant reste', async () => {
    const pair = createPair();
    await startPair(pair);
    pair.mac.liaison.lobby.open(GAME);
    pair.pc.liaison.lobby.open(GAME);
    advanceUntil(
      pair.net,
      () =>
        pair.pc.liaison.session().invitation !== null &&
        pair.mac.liaison.session().invitation !== null,
      1000,
    );
    pair.mac.liaison.lobby.join();
    pair.pc.liaison.lobby.join();
    pair.net.clock.advance(500);
    const mac = pair.mac.liaison.session();
    const pc = pair.pc.liaison.session();
    expect(mac.role).toBe('host');
    expect(pc.role).toBe('guest');
    expect(mac.lobby?.guestJoined).toBe(true);
    expect(mac.invitation).toBeNull();
    expect(pc.lobby?.id).toBe(mac.lobby?.id);
  });

  it('la perte de la liaison annule le décompte et remet les deux à « Pas encore »', async () => {
    const pair = createPair();
    await startPair(pair);
    openAndJoin(pair);
    pair.mac.liaison.lobby.setReady(true);
    advanceUntil(pair.net, () => pair.mac.liaison.session().lobby?.phase === 'countdown', 1000);
    pair.net.cut(MAC, PC);
    pair.net.clock.advance(2500);
    expect(pair.mac.liaison.session().lobby?.phase).toBe('open');
    expect(pair.mac.liaison.session().lobby?.ready).toEqual({ host: false, guest: false });
    pair.net.restore(MAC, PC);
    advanceUntil(pair.net, () => pair.pc.liaison.session().lobby?.phase === 'open', 2000);
    expect(pair.mac.liaison.session().lobby?.match).toBeNull();
  });
});

describe('partie: pause, reprise, fin', () => {
  it("Échap chez l'invité: l'hôte fige la partie, puis la reprise part quand les deux l'ont demandée", async () => {
    const pair = createPair();
    await startPair(pair);
    playMatch(pair);
    pair.pc.liaison.match.pause();
    advanceUntil(
      pair.net,
      () => pair.mac.liaison.session().lobby?.match?.phase === 'paused',
      500,
      1,
    );
    pair.mac.liaison.match.pause();
    pair.net.clock.advance(50);
    expect(pair.pc.liaison.session().lobby?.match?.pause).toEqual({
      reason: 'player',
      by: ['guest', 'host'],
    });
    pair.mac.liaison.match.resume();
    pair.net.clock.advance(100);
    expect(pair.mac.liaison.session().lobby?.match?.phase).toBe('paused');
    pair.pc.liaison.match.resume();
    advanceUntil(pair.net, () => pair.pc.liaison.session().lobby?.match?.phase === 'resuming', 500);
    pair.net.clock.advance(2900);
    expect(pair.mac.liaison.session().lobby?.match?.phase).toBe('resuming');
    advanceUntil(pair.net, () => pair.pc.liaison.session().lobby?.match?.phase === 'playing', 500);
  });

  it('profil R1: la pause demandée par l’invité s’affiche chez l’hôte en moins de 500 ms (CA-PF-035)', async () => {
    const pair = createPair(PROFILE_R1, 31);
    await startPair(pair, 3000);
    playMatch(pair);
    const delays: number[] = [];
    for (let trial = 0; trial < 40; trial += 1) {
      pair.pc.liaison.match.pause();
      delays.push(
        advanceUntil(
          pair.net,
          () => pair.mac.liaison.session().lobby?.match?.phase === 'paused',
          2000,
          1,
        ),
      );
      pair.mac.liaison.match.resume();
      pair.pc.liaison.match.resume();
      advanceUntil(
        pair.net,
        () => pair.mac.liaison.session().lobby?.match?.phase === 'playing',
        5000,
      );
      pair.net.clock.advance(300);
    }
    expect(Math.max(...delays)).toBeLessThan(500);
  });

  it("fin de partie: l'hôte envoie le résultat, les deux reviennent au salon", async () => {
    const pair = createPair();
    await startPair(pair);
    playMatch(pair);
    pair.mac.liaison.match.end({ train: 'parti', caisse: 42 });
    advanceUntil(pair.net, () => pair.pc.liaison.session().lobby?.match === null, 500);
    expect(pair.pc.events.notice).toContainEqual({
      kind: 'match-ended',
      reason: 'finished',
      result: { train: 'parti', caisse: 42 },
    });
    expect(pair.pc.liaison.session().lobby?.phase).toBe('open');
    expect(pair.pc.liaison.session().lobby?.ready).toEqual({ host: false, guest: false });
  });

  it("l'invité quitte pendant la partie: l'hôte clôt la partie et garde son salon", async () => {
    const pair = createPair();
    await startPair(pair);
    playMatch(pair);
    pair.pc.liaison.lobby.leave();
    advanceUntil(pair.net, () => pair.mac.liaison.session().lobby?.match === null, 500);
    expect(pair.mac.events.notice).toContainEqual({
      kind: 'match-ended',
      reason: 'peer-left',
      result: null,
    });
    expect(pair.mac.liaison.session().lobby?.guestJoined).toBe(false);
    expect(pair.pc.liaison.session().invitation?.id).toBe(pair.mac.liaison.session().lobby?.id);
  });
});

describe('relais des messages de jeu', () => {
  it('relaie JSON et binaire dans les deux sens, sur le bon canal', async () => {
    const pair = createPair();
    await startPair(pair);
    playMatch(pair);
    expect(pair.mac.liaison.match.send(3, { action: 'porter-la-poutre' }, 'reliable')).toEqual({
      ok: true,
    });
    expect(pair.pc.liaison.match.send(4, new Uint8Array([1, 2, 3, 250]), 'reliable')).toEqual({
      ok: true,
    });
    pair.net.clock.advance(20);
    expect(pair.pc.events.game).toEqual([{ channel: 3, payload: { action: 'porter-la-poutre' } }]);
    expect(pair.mac.events.game).toEqual([{ channel: 4, payload: new Uint8Array([1, 2, 3, 250]) }]);
  });

  it('refuse un envoi hors partie, sur un canal invalide, trop gros, ou au-delà du débit permis', async () => {
    const pair = createPair();
    await startPair(pair);
    expect(pair.mac.liaison.match.send(0, { a: 1 }, 'reliable')).toEqual({
      ok: false,
      reason: 'no-match',
    });
    playMatch(pair);
    expect(pair.mac.liaison.match.send(16, { a: 1 }, 'reliable')).toEqual({
      ok: false,
      reason: 'bad-channel',
    });
    expect(pair.mac.liaison.match.send(0, { a: 'x'.repeat(70_000) }, 'reliable')).toEqual({
      ok: false,
      reason: 'too-big',
    });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(pair.mac.liaison.match.send(0, circular, 'reliable')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    const results = Array.from({ length: 400 }, (_, index) =>
      pair.mac.liaison.match.send(0, { index }, 'latest'),
    );
    expect(results.filter((result) => !result.ok)).not.toHaveLength(0);
  });
});
