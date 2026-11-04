// Le SDK face à une plateforme minimale, sur un vrai MessageChannel (Node).
import type { GameMessage, InitMessage, PlatformMessage } from '@duo/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { connect, v, type DuoContext } from '../src/index';
import { utf8Length } from '../src/net';

const manifest = {
  schema: 1,
  id: 'essai-pont',
  name: 'Essai du pont',
  version: '1.2.3',
  sdk: '1.0',
  view: '3d',
  engine: 'three',
  mode: 'coop',
  play: 'session',
  durationMinutes: [10, 60],
  network: 'host-authority',
  entry: 'index.html',
  thumbnail: 'vignette.webp',
  description: 'Essai.',
  whatsNew: '',
  actions: [{ id: 'act', label: 'Agir', keys: ['Space'] }],
  saves: { slots: 1, maxBytes: 64, moments: ['exit', 'level-end'] },
  credits: null,
};

function initMessage(role: 'host' | 'guest', overrides: Partial<InitMessage> = {}): InitMessage {
  return {
    type: 'init',
    bridge: '1.3',
    matchId: 'partie-1',
    role,
    localPlayerId: role === 'host' ? 'a' : 'b',
    players: [
      { id: 'a', role: 'host', name: 'Alex', color: 'orb', colorHex: '#5CE1E6', local: false },
      { id: 'b', role: 'guest', name: 'Sacha', color: 'sun', colorHex: '#FC663F', local: false },
    ],
    seed: 123,
    game: { id: 'essai-pont', version: '1.2.3' },
    settings: {
      volumes: { master: 1, music: 1, effects: 1, interface: 1 },
      uiScale: 1,
      reducedMotion: false,
      bindings: {},
    },
    saveSlot: role === 'host' ? 1 : null,
    save: null,
    clockOffsetMs: 0,
    ...overrides,
  };
}

interface Platform {
  readonly received: GameMessage[];
  send(message: PlatformMessage | Record<string, unknown>, transfer?: Transferable[]): void;
  next(type: GameMessage['type']): Promise<GameMessage>;
  close(): void;
}

/** Plateforme minimale: répond à `hello` par `init`, garde tout ce que le jeu envoie. */
function platform(init: InitMessage): { port: MessagePort; platform: Platform } {
  const channel = new MessageChannel();
  const received: GameMessage[] = [];
  const waiters: { type: string; resolve: (m: GameMessage) => void }[] = [];
  channel.port1.onmessage = (event: MessageEvent<GameMessage>) => {
    const message = event.data;
    received.push(message);
    if (message.type === 'hello') channel.port1.postMessage(init);
    for (const waiter of waiters.splice(0)) {
      if (waiter.type === message.type) waiter.resolve(message);
      else waiters.push(waiter);
    }
  };
  return {
    port: channel.port2,
    platform: {
      received,
      send: (message, transfer) => {
        if (transfer === undefined) channel.port1.postMessage(message);
        else channel.port1.postMessage(message, transfer);
      },
      next: (type) => {
        const found = received.find((m) => m.type === type);
        if (found !== undefined) return Promise.resolve(found);
        return new Promise((resolve) => waiters.push({ type, resolve }));
      },
      close: () => {
        channel.port1.close();
      },
    },
  };
}

const opened: { duo?: DuoContext; platform: Platform }[] = [];
afterEach(() => {
  for (const { duo, platform: p } of opened.splice(0)) {
    duo?.dispose();
    p.close();
  }
});

async function open(init: InitMessage): Promise<{ duo: DuoContext; platform: Platform }> {
  const { port, platform: p } = platform(init);
  const duo = await connect({ manifest, port, timeoutMs: 2000 });
  opened.push({ duo, platform: p });
  return { duo, platform: p };
}

describe('pont du SDK', () => {
  it('se présente, reçoit init et expose rôle, joueurs et graine', async () => {
    const { duo, platform: p } = await open(initMessage('guest'));
    expect(p.received[0]).toEqual({ type: 'hello', bridge: '1.1', sdk: '1.1.0' });
    expect(duo.role).toBe('guest');
    expect(duo.localPlayer).toMatchObject({ id: 'b', name: 'Sacha', local: true });
    expect(duo.remotePlayer).toMatchObject({ id: 'a', local: false });
    expect(duo.seed).toBe(123);
    expect('saves' in duo).toBe(false);
  });

  it('refuse une plateforme dont la majeure du pont diffère', async () => {
    const { port, platform: p } = platform(initMessage('host', { bridge: '2.0' }));
    opened.push({ platform: p });
    await expect(connect({ manifest, port, timeoutMs: 2000 })).rejects.toThrow(/incompatible/);
    expect((await p.next('fatal')).type).toBe('fatal');
  });

  it('refuse un manifeste invalide avant tout échange', async () => {
    const { port, platform: p } = platform(initMessage('host'));
    opened.push({ platform: p });
    await expect(connect({ manifest: { ...manifest, id: 'X' }, port })).rejects.toThrow(
      /manifeste invalide/,
    );
  });

  it('passe par ready puis start, et suit pause et reprise', async () => {
    const { duo, platform: p } = await open(initMessage('host'));
    expect(duo.state).toBe('loading');
    const started = duo.ready();
    expect((await p.next('ready')).type).toBe('ready');
    p.send({ type: 'start', atSessionMs: 0 });
    await started;
    expect(duo.state).toBe('running');
    const paused = new Promise((resolve) => duo.on('pause', resolve));
    p.send({ type: 'pause', reason: 'request', by: 'b' });
    expect(await paused).toMatchObject({ reason: 'request', by: { name: 'Sacha' } });
    expect(duo.state).toBe('paused');
    p.send({ type: 'resume' });
    await new Promise((resolve) => duo.on('resume', resolve));
    expect(duo.state).toBe('running');
  });

  it('ignore un message non conforme de la plateforme et le journalise', async () => {
    const { platform: p } = await open(initMessage('host'));
    p.send({ type: 'pause', reason: 'au hasard' });
    const log = await p.next('log');
    expect(log).toMatchObject({ type: 'log', level: 'warn' });
  });

  it('envoie les messages réseau en JSON et valide ceux qui arrivent', async () => {
    const { duo, platform: p } = await open(initMessage('host'));
    const channel = duo.net.channel(3, {
      mode: 'reliable',
      schema: v.strictObject({ x: v.number() }),
    });
    channel.send({ x: 1 });
    expect(await p.next('net')).toEqual({
      type: 'net',
      channel: 3,
      mode: 'reliable',
      data: '{"x":1}',
    });

    const got: number[] = [];
    channel.onMessage((m) => got.push(m.x));
    p.send({ type: 'net', channel: 3, data: '{"x":"pas un nombre"}' });
    p.send({ type: 'net', channel: 3, data: '{"x":2}' });
    await expect.poll(() => got).toEqual([2]);
    expect(p.received.some((m) => m.type === 'log' && m.level === 'warn')).toBe(true);

    expect(() => duo.net.channel(3, { mode: 'latest', schema: v.unknown() })).toThrow(
      /déjà ouvert/,
    );
    expect(() => duo.net.channel(16, { mode: 'latest', schema: v.unknown() })).toThrow(RangeError);
    const big = duo.net.channel(4, { mode: 'reliable', schema: v.string() });
    expect(() => {
      big.send('é'.repeat(40_000));
    }).toThrow(/64 Kio/);
  });

  it('garde les messages arrivés avant l’ouverture du canal (le dernier seulement en mode latest)', async () => {
    const { duo, platform: p } = await open(initMessage('guest'));
    p.send({ type: 'net', channel: 0, data: '1' });
    p.send({ type: 'net', channel: 0, data: '2' });
    p.send({ type: 'net', channel: 1, data: '1' });
    p.send({ type: 'net', channel: 1, data: '2' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const reliable: number[] = [];
    const latest: number[] = [];
    duo.net.channel(0, { mode: 'reliable', schema: v.number() }).onMessage((n) => reliable.push(n));
    duo.net.channel(1, { mode: 'latest', schema: v.number() }).onMessage((n) => latest.push(n));
    await expect.poll(() => [reliable, latest]).toEqual([[1, 2], [2]]);
  });

  it("écrit une sauvegarde de l'hôte, contrôle moment et taille, et répond à stop", async () => {
    const save = {
      slot: 1,
      label: 'Jour 2',
      dataSchema: 1,
      gameVersion: '1.2.3',
      progress: 0.5,
      data: new TextEncoder().encode('{"jour":2}').buffer,
    };
    const { duo, platform: p } = await open(initMessage('host', { save }));
    if (duo.role !== 'host') throw new Error('rôle inattendu');
    expect(duo.saves.loaded).toMatchObject({ label: 'Jour 2', data: { jour: 2 } });

    expect(await duo.saves.write('manual', { label: 'x', dataSchema: 1, data: {} })).toBe(
      'moment-not-declared',
    );
    expect(
      await duo.saves.write('level-end', { label: 'x', dataSchema: 1, data: 'x'.repeat(100) }),
    ).toBe('too-large');
    const written = duo.saves.write('level-end', {
      label: 'Jour 3',
      dataSchema: 1,
      data: { jour: 3 },
    });
    const message = await p.next('saveWrite');
    if (message.type !== 'saveWrite') throw new Error('message inattendu');
    expect(new TextDecoder().decode(message.data)).toBe('{"jour":3}');
    p.send({ type: 'saveResult', requestId: message.requestId, status: 'ok' });
    expect(await written).toBe('ok');

    // Arrêt demandé avec sauvegarde de sortie: le fournisseur est appelé, puis sessionEnd, puis l'événement stop.
    duo.saves.provide(() => ({ label: 'Sortie', dataSchema: 1, data: { jour: 4 } }));
    const ready = duo.ready();
    p.send({ type: 'start', atSessionMs: 0 });
    await ready;
    const stopped = new Promise((resolve) => duo.on('stop', resolve));
    p.send({ type: 'stop', reason: 'quit', save: true });
    await expect.poll(() => p.received.filter((m) => m.type === 'saveWrite').length).toBe(2);
    const exit = p.received.filter((m) => m.type === 'saveWrite')[1];
    if (exit?.type !== 'saveWrite') throw new Error('sauvegarde de sortie absente');
    expect(exit.moment).toBe('exit');
    p.send({ type: 'saveResult', requestId: exit.requestId, status: 'ok' });
    expect(await stopped).toEqual({ reason: 'quit' });
    expect(await p.next('sessionEnd')).toMatchObject({
      type: 'sessionEnd',
      finished: false,
      progress: 0.5,
    });
  });

  it('mesure la taille UTF-8 sans allouer', () => {
    expect(utf8Length('abc')).toBe(3);
    expect(utf8Length('é')).toBe(2);
    expect(utf8Length('€')).toBe(3);
    expect(utf8Length('\u{1D11E}')).toBe(4);
    expect(utf8Length('Œuf, ça!')).toBe(new TextEncoder().encode('Œuf, ça!').byteLength);
  });
});
