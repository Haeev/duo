import http from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { parseNetworkCommandLine } from '../src/command-line.ts';
import { createLiaison } from '../src/liaison.ts';
import type { Liaison } from '../src/liaison.ts';

/**
 * Le même code avec les vrais sockets (`ws`, `dgram`) sur la boucle locale: deux
 * instances aux ports différents, qui se trouvent par `--duo-peer`.
 */

const BASE = 40_000 + Math.floor(Math.random() * 2000) * 10;
const running: Liaison[] = [];

function create(port: number, peerPort: number, machine: string, pseudo: string): Liaison {
  const options = parseNetworkCommandLine([
    `--duo-port=${String(port)}`,
    `--duo-peer=127.0.0.1:${String(peerPort)}`,
    '--duo-allow-loopback',
  ]);
  const liaison = createLiaison({
    identity: { machine, appVersion: '0.1.0', computer: pseudo.toUpperCase() },
    profile: { pseudo, color: 'rond' },
    ...options,
    listenHost: '127.0.0.1',
    config: { countdownMs: 300 },
  });
  running.push(liaison);
  return liaison;
}

async function waitFor(condition: () => boolean, maxMs: number): Promise<number> {
  const start = performance.now();
  while (!condition()) {
    if (performance.now() - start > maxMs) throw new Error(`condition non atteinte en ${String(maxMs)} ms`);
    await sleep(5);
  }
  return performance.now() - start;
}

function request(port: number, path: string, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const outgoing = http.request({ host: '127.0.0.1', port, path, headers });
    outgoing.on('response', (response) => {
      resolve(response.statusCode ?? 0);
      response.resume();
    });
    outgoing.on('upgrade', (_response, socket) => {
      socket.destroy();
      resolve(101);
    });
    outgoing.on('error', reject);
    outgoing.end();
  });
}

afterEach(async () => {
  await Promise.all(running.splice(0).map((liaison) => liaison.stop()));
});

describe('vrais sockets sur la boucle locale', () => {
  it('deux instances se trouvent, se relient, jouent une partie et échangent des messages', async () => {
    const a = create(BASE, BASE + 5, 'aaaaaaaa-1111-4000-8000-000000000001', 'Camille');
    const b = create(BASE + 5, BASE, 'bbbbbbbb-1111-4000-8000-000000000002', 'Sacha');
    const [reportA, reportB] = await Promise.all([a.start(), b.start()]);
    expect(reportA.tcpPort).toBe(BASE);
    expect(reportB.udpPort).toBe(BASE + 5);
    const found = await waitFor(() => a.partner().kind === 'present' && b.partner().kind === 'present', 3000);
    expect(found).toBeLessThan(3000);

    a.lobby.open({ id: 'la-petite-ligne', version: '0.1.0', save: null });
    await waitFor(() => b.session().invitation !== null, 1000);
    b.lobby.join();
    await waitFor(() => a.session().lobby?.guestJoined === true, 1000);
    a.lobby.setReady(true);
    await waitFor(() => b.session().lobby?.match?.phase === 'loading', 3000);
    a.match.reportLoaded();
    b.match.reportLoaded();
    await waitFor(() => b.session().lobby?.match?.phase === 'playing', 3000);

    const atHost: unknown[] = [];
    const atGuest: unknown[] = [];
    a.on('game', ({ payload }) => atHost.push(payload));
    b.on('game', ({ payload }) => atGuest.push(payload));
    for (let index = 1; index <= 50; index += 1) {
      a.match.send(0, { tick: index }, 'latest');
      b.match.send(1, { n: index }, 'reliable');
    }
    await waitFor(() => atHost.length === 50 && atGuest.length === 50, 2000);
    expect(atHost.at(-1)).toEqual({ n: 50 });
    expect(atGuest.at(-1)).toEqual({ tick: 50 });
    await sleep(600);
    expect(a.quality()?.rttMs).not.toBeNull();

    await b.stop();
    await waitFor(() => a.partner().kind === 'absent', 1000);
  }, 20_000);

  it('le serveur refuse une page web (Origin), un autre chemin, un autre sous-protocole', async () => {
    const a = create(BASE + 20, BASE + 25, 'aaaaaaaa-2222-4000-8000-000000000001', 'Camille');
    await a.start();
    const upgrade = { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' };
    expect(await request(BASE + 20, '/duo/liaison', { ...upgrade, 'Sec-WebSocket-Protocol': 'duo', Origin: 'http://192.168.1.50' })).toBe(403);
    expect(await request(BASE + 20, '/autre', { ...upgrade, 'Sec-WebSocket-Protocol': 'duo' })).toBe(404);
    expect(await request(BASE + 20, '/duo/liaison', { ...upgrade, 'Sec-WebSocket-Protocol': 'chat' })).toBe(404);
    expect(await request(BASE + 20, '/', {})).toBe(404);
    // Un client WebSocket qui n'est pas Duo: accepté au niveau HTTP, puis fermé faute de `hello`.
    const stranger = new WebSocket(`ws://127.0.0.1:${String(BASE + 20)}/duo/liaison`, 'duo');
    const closed = new Promise<number>((resolve) => {
      stranger.on('close', (code) => {
        resolve(code);
      });
    });
    stranger.on('open', () => {
      stranger.send('{"bonjour":true}');
    });
    expect(await closed).toBeGreaterThanOrEqual(1000);
    expect(a.partner().kind).toBe('absent');
  }, 20_000);

  it('connexion par adresse: adresse mal écrite, Duo absent, soi-même', async () => {
    const a = create(BASE + 40, BASE + 45, 'aaaaaaaa-3333-4000-8000-000000000001', 'Camille');
    await a.start();
    expect(await a.connectTo('192.168.1')).toEqual({ ok: false, failure: 'invalid-address' });
    expect(await a.connectTo('127,0,0,2')).toEqual({ ok: false, failure: 'refused' });
    expect(await a.connectTo(' 127.0.0.1 ')).toMatchObject({ ok: false, failure: 'self' });
  }, 20_000);
});
