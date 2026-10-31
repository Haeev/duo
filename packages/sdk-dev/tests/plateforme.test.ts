// Deux fausses plateformes reliées par le relais local, chacune avec une instance du vrai SDK.
import { connect, v, type DuoContext } from '@duo/sdk';
import { afterEach, describe, expect, it } from 'vitest';
import { createLocalLinkPair } from '../src/coeur/lien';
import {
  createFakePlatform,
  resolveGuestColor,
  type FakePlatform,
  type PlatformStatus,
} from '../src/coeur/plateforme';
import { createMemoryStore } from '../src/coeur/stockage';

const manifest = {
  schema: 1,
  id: 'essai-echo',
  name: 'Essai écho',
  version: '0.1.0',
  sdk: '1.0',
  view: '2d',
  engine: 'none',
  mode: 'coop',
  play: 'session',
  durationMinutes: [1, 5],
  network: 'host-authority',
  entry: 'index.html',
  thumbnail: 'vignette.png',
  description: 'Jeu d’essai du faux hôte.',
  whatsNew: '',
  actions: [{ id: 'act', label: 'Agir', keys: ['Space'] }],
  saves: { slots: 1, maxBytes: 4096, moments: ['level-end', 'exit'] },
  credits: null,
};

const Ping = v.strictObject({ n: v.number() });

interface Duo {
  readonly host: FakePlatform;
  readonly guest: FakePlatform;
  readonly hostGame: DuoContext;
  readonly guestGame: DuoContext;
  readonly store: ReturnType<typeof createMemoryStore>;
  readonly statuses: { host: PlatformStatus[]; guest: PlatformStatus[] };
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

async function startDuo(latencyMs = 5): Promise<Duo> {
  const pair = createLocalLinkPair({ latencyMs, jitterMs: 2 });
  const store = createMemoryStore();
  const statuses = { host: [] as PlatformStatus[], guest: [] as PlatformStatus[] };
  const host = createFakePlatform({
    role: 'host',
    manifest: manifest as never,
    profile: { id: 'membre-a', name: 'Alex', color: 'orb' },
    link: pair.host,
    store,
    seed: 42,
    onStatus: (s) => statuses.host.push(s),
  });
  const guest = createFakePlatform({
    role: 'guest',
    manifest: manifest as never,
    profile: { id: 'membre-b', name: 'Sacha', color: 'orb' },
    link: pair.guest,
    onStatus: (s) => statuses.guest.push(s),
  });
  const hostChannel = new MessageChannel();
  const guestChannel = new MessageChannel();
  host.attachGame(hostChannel.port1);
  guest.attachGame(guestChannel.port1);
  const [hostGame, guestGame] = await Promise.all([
    connect({ manifest, port: hostChannel.port2, timeoutMs: 3000 }),
    connect({ manifest, port: guestChannel.port2, timeoutMs: 3000 }),
  ]);
  cleanups.push(() => {
    hostGame.dispose();
    guestGame.dispose();
    host.dispose();
    guest.dispose();
    pair.host.close();
  });
  return { host, guest, hostGame, guestGame, store, statuses };
}

describe('faux hôte, deux plateformes et deux SDK', () => {
  it('remet à chaque jeu son rôle, les deux joueurs et la même graine', async () => {
    const duo = await startDuo();
    expect(duo.hostGame.role).toBe('host');
    expect(duo.guestGame.role).toBe('guest');
    expect(duo.hostGame.seed).toBe(42);
    expect(duo.guestGame.seed).toBe(42);
    expect(duo.hostGame.localPlayer.name).toBe('Alex');
    expect(duo.guestGame.localPlayer.name).toBe('Sacha');
    expect(duo.guestGame.remotePlayer.id).toBe('membre-a');
    // Même couleur demandée: l'invité prend la suivante de la palette.
    expect(duo.guestGame.localPlayer.color).toBe('crescent');
    expect(duo.hostGame.random('meteo').next()).toBe(duo.guestGame.random('meteo').next());
  });

  it("fait passer un message de l'invité à l'hôte et la réponse en retour", async () => {
    const duo = await startDuo();
    await Promise.all([duo.hostGame.ready(), duo.guestGame.ready()]);
    expect(duo.hostGame.state).toBe('running');
    expect(duo.guestGame.state).toBe('running');

    const hostIn = duo.hostGame.net.channel(0, { mode: 'reliable', schema: Ping });
    const hostOut = duo.hostGame.net.channel(1, { mode: 'reliable', schema: Ping });
    hostIn.onMessage((message) => {
      hostOut.send({ n: message.n + 1 });
    });
    const guestOut = duo.guestGame.net.channel(0, { mode: 'reliable', schema: Ping });
    const guestIn = duo.guestGame.net.channel(1, { mode: 'reliable', schema: Ping });
    const reply = new Promise<number>((resolve) =>
      guestIn.onMessage((m) => {
        resolve(m.n);
      }),
    );
    guestOut.send({ n: 1 });
    expect(await reply).toBe(2);
  });

  it("met les deux en pause quand l'un la demande, puis reprend", async () => {
    const duo = await startDuo();
    await Promise.all([duo.hostGame.ready(), duo.guestGame.ready()]);
    const paused = new Promise<string | null>((resolve) =>
      duo.hostGame.on('pause', (p) => {
        resolve(p.by?.name ?? null);
      }),
    );
    duo.guest.pause();
    expect(await paused).toBe('Sacha');
    expect(duo.guestGame.state).toBe('paused');
    const resumed = new Promise<void>((resolve) =>
      duo.hostGame.on('resume', () => {
        resolve();
      }),
    );
    duo.host.resume();
    await resumed;
    expect(duo.hostGame.state).toBe('running');
  });

  it("écrit la sauvegarde de l'hôte, puis la sauvegarde de sortie et l'historique quand l'invité quitte", async () => {
    const duo = await startDuo();
    await Promise.all([duo.hostGame.ready(), duo.guestGame.ready()]);
    if (duo.hostGame.role !== 'host') throw new Error('rôle inattendu');
    const status = await duo.hostGame.saves.write('level-end', {
      label: 'Jour 2',
      dataSchema: 1,
      data: { jour: 2 },
      progress: 0.25,
    });
    expect(status).toBe('ok');
    expect(await duo.store.read('essai-echo', 1)).toMatchObject({
      label: 'Jour 2',
      data: '{"jour":2}',
    });

    duo.hostGame.saves.provide(() => ({ label: 'Jour 3', dataSchema: 1, data: { jour: 3 } }));
    const hostStopped = new Promise<string>((resolve) =>
      duo.hostGame.on('stop', (s) => {
        resolve(s.reason);
      }),
    );
    const guestStopped = new Promise<string>((resolve) =>
      duo.guestGame.on('stop', (s) => {
        resolve(s.reason);
      }),
    );
    duo.guest.quit();
    expect(await hostStopped).toBe('quit');
    expect(await guestStopped).toBe('quit');
    expect(await duo.store.read('essai-echo', 1)).toMatchObject({
      label: 'Jour 3',
      moment: 'exit',
    });
    await expect.poll(() => duo.store.history.length).toBe(1);
    expect(duo.store.history[0]).toMatchObject({
      gameId: 'essai-echo',
      outcome: 'session',
      progress: 0.25,
    });
  });

  it('reprend la sauvegarde chez l’hôte seulement', async () => {
    const first = await startDuo();
    await Promise.all([first.hostGame.ready(), first.guestGame.ready()]);
    if (first.hostGame.role !== 'host') throw new Error('rôle inattendu');
    await first.hostGame.saves.write('level-end', {
      label: 'Jour 5',
      dataSchema: 2,
      data: { jour: 5 },
    });

    const pair = createLocalLinkPair();
    const host = createFakePlatform({
      role: 'host',
      manifest: manifest as never,
      profile: { id: 'membre-a', name: 'Alex', color: 'orb' },
      link: pair.host,
      store: first.store,
    });
    const guest = createFakePlatform({
      role: 'guest',
      manifest: manifest as never,
      profile: { id: 'membre-b', name: 'Sacha', color: 'sun' },
      link: pair.guest,
    });
    const a = new MessageChannel();
    const b = new MessageChannel();
    host.attachGame(a.port1);
    guest.attachGame(b.port1);
    const [hostGame, guestGame] = await Promise.all([
      connect({ manifest, port: a.port2 }),
      connect({ manifest, port: b.port2 }),
    ]);
    cleanups.push(() => {
      hostGame.dispose();
      guestGame.dispose();
      host.dispose();
      guest.dispose();
    });
    if (hostGame.role !== 'host') throw new Error('rôle inattendu');
    expect(hostGame.saves.loaded).toMatchObject({
      label: 'Jour 5',
      dataSchema: 2,
      data: { jour: 5 },
    });
    expect('saves' in guestGame).toBe(false);
  });

  it('choisit pour l’invité la couleur suivante libre', () => {
    expect(resolveGuestColor('orb', 'sun')).toBe('sun');
    expect(resolveGuestColor('comet', 'comet')).toBe('orb');
  });
});
