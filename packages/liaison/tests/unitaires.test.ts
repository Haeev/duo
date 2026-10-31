import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  directedBroadcast,
  isAcceptedSource,
  isPrivateIPv4,
  parseEndpoint,
  parseManualAddress,
  prefixLength,
  selectInterfaces,
} from '../src/addresses.ts';
import { ManualClock, every } from '../src/clock.ts';
import { parseNetworkCommandLine } from '../src/command-line.ts';
import {
  computeProof,
  deriveDuoKey,
  duoFingerprint,
  generatePairKey,
  verifyProof,
} from '../src/crypto.ts';
import {
  DatagramSchema,
  FrozenEnvelopeSchema,
  HelloSchema,
  decodeBinaryGameFrame,
  encodeBinaryGameFrame,
} from '../src/protocol.ts';
import { TokenBucket } from '../src/rate.ts';
import { createFileStore } from '../src/store.ts';

describe('adresses', () => {
  it('reconnaît les plages privées, écarte les publiques et celles des opérateurs', () => {
    for (const address of [
      '10.0.0.1',
      '172.16.5.4',
      '172.31.255.254',
      '192.168.1.23',
      '169.254.10.1',
    ]) {
      expect(isPrivateIPv4(address)).toBe(true);
    }
    for (const address of [
      '8.8.8.8',
      '172.32.0.1',
      '100.64.1.2',
      '127.0.0.1',
      '192.169.0.1',
      '300.1.1.1',
    ]) {
      expect(isPrivateIPv4(address)).toBe(false);
    }
    expect(isPrivateIPv4('::ffff:192.168.1.5')).toBe(true);
    expect(isAcceptedSource('127.0.0.1', false)).toBe(false);
    expect(isAcceptedSource('127.0.0.1', true)).toBe(true);
  });

  it('calcule la diffusion dirigée et la longueur du préfixe', () => {
    expect(directedBroadcast('192.168.1.23', '255.255.255.0')).toBe('192.168.1.255');
    expect(directedBroadcast('10.20.30.40', '255.255.0.0')).toBe('10.20.255.255');
    expect(directedBroadcast('172.16.5.9', '255.255.255.252')).toBe('172.16.5.11');
    expect(prefixLength('255.255.255.0')).toBe(24);
    expect(prefixLength('255.255.240.0')).toBe(20);
  });

  it('retient les interfaces privées, physiques d’abord, virtuelles et VPN en dernier', () => {
    const retained = selectInterfaces({
      lo0: [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', internal: true }],
      'vEthernet (WSL)': [
        { address: '172.28.16.1', netmask: '255.255.240.0', family: 'IPv4', internal: false },
      ],
      'Wi-Fi': [
        { address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', internal: false },
        { address: '192.168.1.23', netmask: '255.255.255.0', family: 'IPv4', internal: false },
      ],
      utun3: [
        { address: '100.101.102.103', netmask: '255.192.0.0', family: 'IPv4', internal: false },
      ],
      en5: [{ address: '169.254.7.8', netmask: '255.255.0.0', family: 4, internal: false }],
    });
    expect(retained.map((entry) => `${entry.name}:${entry.kind}`)).toEqual([
      'Wi-Fi:physical',
      'en5:physical',
      'vEthernet (WSL):virtual',
    ]);
    expect(retained[0]?.broadcast).toBe('192.168.1.255');
  });

  it('lit une adresse tapée à la main: virgules du pavé numérique, espaces, port ignoré', () => {
    expect(parseManualAddress('192,168,1,23')).toEqual({ ok: true, host: '192.168.1.23' });
    expect(parseManualAddress(' 192.168.001.023 ')).toEqual({ ok: true, host: '192.168.1.23' });
    expect(parseManualAddress('192.168.1.23:39420')).toEqual({ ok: true, host: '192.168.1.23' });
    for (const wrong of ['', 'pc-de-sacha', '192.168.1', '192.168.1.256', '1.2.3.4.5']) {
      expect(parseManualAddress(wrong)).toEqual({ ok: false });
    }
    expect(parseEndpoint('127.0.0.1:39430')).toEqual({ host: '127.0.0.1', port: 39430 });
    expect(parseEndpoint('127.0.0.1')).toBeNull();
  });
});

describe('sérialisation', () => {
  it('trame binaire de jeu: aller et retour, en-tête de 8 octets', () => {
    const payload = new Uint8Array([9, 8, 7, 6, 5]);
    const frame = encodeBinaryGameFrame(15, 0xfedc_ba98, payload);
    expect(frame.byteLength).toBe(13);
    expect([...frame.slice(0, 4)]).toEqual([1, 15, 0, 0]);
    expect(decodeBinaryGameFrame(frame)).toEqual({ channel: 15, seq: 0xfedc_ba98, payload });
    expect(decodeBinaryGameFrame(new Uint8Array([2, 0, 0, 0, 0, 0, 0, 1]))).toBeNull();
    expect(decodeBinaryGameFrame(new Uint8Array([1, 0, 0]))).toBeNull();
  });

  it("l'enveloppe figée se lit même quand le reste du message est inconnu", () => {
    const future = {
      app: 'duo',
      envelope: 1,
      type: 'hello',
      machine: 'aaaaaaaa-0000-4000-8000-000000000001',
      appVersion: '7.0.0',
      protocol: 9,
      champInvente: { profond: [1, 2, 3] },
    };
    const envelope = v.safeParse(FrozenEnvelopeSchema, future);
    expect(envelope.success && envelope.output.protocol).toBe(9);
    expect(v.safeParse(HelloSchema, future).success).toBe(false);
    expect(v.safeParse(FrozenEnvelopeSchema, { ...future, app: 'autre' }).success).toBe(false);
  });

  it('une balise valide passe, les champs inconnus sont retirés, les chaînes trop longues refusées', () => {
    const beacon = {
      app: 'duo',
      envelope: 1,
      type: 'announce',
      machine: 'aaaaaaaa-0000-4000-8000-000000000001',
      appVersion: '1.0.2',
      protocol: 1,
      instance: 'c3a9e0d4-1b7f-4f2a-8e55-90d2f1a6b7c8',
      seq: 1742,
      port: 39420,
      pseudo: 'Sacha',
      color: 'carre',
      computer: 'PC-SACHA',
      setup: 'done',
      duos: ['a1b2c3d4'],
      addresses: [{ ip: '192.168.1.23', prefix: 24 }],
      ajout: 'version suivante',
    };
    const parsed = v.safeParse(DatagramSchema, beacon);
    expect(parsed.success).toBe(true);
    expect(parsed.success && 'ajout' in parsed.output).toBe(false);
    expect(v.safeParse(DatagramSchema, { ...beacon, pseudo: 'x'.repeat(33) }).success).toBe(false);
    expect(v.safeParse(DatagramSchema, { ...beacon, port: 70_000 }).success).toBe(false);
  });
});

describe('clé du duo et preuves', () => {
  it('les deux côtés dérivent la même clé; une preuve ne vaut que pour son rôle et son contexte', () => {
    const a = generatePairKey();
    const b = generatePairKey();
    const duo = '0123456789abcdef0123456789abcdef';
    const keyA = deriveDuoKey(a.privateKey, b.publicKey, duo);
    const keyB = deriveDuoKey(b.privateKey, a.publicKey, duo);
    expect(keyA).not.toBeNull();
    expect(keyA).toEqual(keyB);
    if (keyA === null) return;
    const context = {
      callerNonce: 'AAAAAAAAAAAAAAAAAAAAAA',
      calleeNonce: 'BBBBBBBBBBBBBBBBBBBBBB',
      callerMachine: 'aaaaaaaa-0000-4000-8000-000000000001',
      calleeMachine: 'bbbbbbbb-0000-4000-8000-000000000002',
      link: 'ffffffffffffffffffffffffffffffff',
    };
    const proof = computeProof(keyA, 'appele', context);
    expect(verifyProof(keyA, 'appele', context, proof)).toBe(true);
    expect(verifyProof(keyA, 'appelant', context, proof)).toBe(false);
    expect(verifyProof(keyA, 'appele', { ...context, link: '0'.repeat(32) }, proof)).toBe(false);
    expect(deriveDuoKey(a.privateKey, b.publicKey, 'f'.repeat(32))).not.toEqual(keyA);
    expect(deriveDuoKey(a.privateKey, 'pas-une-cle', duo)).toBeNull();
    expect(duoFingerprint(duo)).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('mémoire de la liaison sur fichier', () => {
  it('écrit de façon atomique avec des droits restreints, relit, et vaut vide si le fichier est abîmé', async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'duo-liaison-'));
    try {
      const file = path.join(folder, 'Données de Camille', 'reseau.json');
      const store = createFileStore(file);
      expect(await store.load()).toEqual({ pairings: [], addresses: [] });
      const memory = {
        pairings: [
          {
            duo: '0123456789abcdef0123456789abcdef',
            partner: 'bbbbbbbb-0000-4000-8000-000000000002',
            key: 'K'.repeat(43),
            createdAt: '2026-10-30T23:00:00.000Z',
          },
        ],
        addresses: [
          {
            host: '192.168.1.23',
            port: 39420,
            partner: null,
            lastSuccessAt: '2026-10-30T23:00:00.000Z',
          },
        ],
      };
      await store.save(memory);
      expect(await createFileStore(file).load()).toEqual(memory);
      if (process.platform !== 'win32') {
        expect((await stat(file)).mode & 0o777).toBe(0o600);
      }
      expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ format: 1 });
      await writeFile(file, '{ abîmé', 'utf8');
      expect(await createFileStore(file).load()).toEqual({ pairings: [], addresses: [] });
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});

describe('outils', () => {
  it('lit les options réseau de la ligne de commande', () => {
    expect(
      parseNetworkCommandLine([
        '--duo-port=39430',
        '--duo-peer=127.0.0.1:39420',
        '--duo-peer=127.0.0.1:39440',
        '--duo-allow-loopback',
        '--autre',
        '--duo-peer=nimporte',
      ]),
    ).toEqual({
      port: 39430,
      peers: [
        { host: '127.0.0.1', port: 39420 },
        { host: '127.0.0.1', port: 39440 },
      ],
      allowLoopback: true,
      invalid: ['--duo-peer=nimporte'],
    });
    expect(parseNetworkCommandLine([])).toEqual({ peers: [], allowLoopback: false, invalid: [] });
  });

  it('seau à jetons: rafale permise, puis débit moyen', () => {
    const bucket = new TokenBucket(10, 20, 0);
    let taken = 0;
    for (let index = 0; index < 30; index += 1) if (bucket.take(1, 0)) taken += 1;
    expect(taken).toBe(20);
    expect(bucket.take(1, 50)).toBe(false);
    expect(bucket.take(1, 100)).toBe(true);
  });

  it("répétition: l'horloge manuelle fait sonner chaque tour à son heure, l'annulation tient", () => {
    const clock = new ManualClock(0);
    const times: number[] = [];
    const stop = every(
      clock,
      () => 100,
      () => {
        times.push(clock.now());
        if (times.length === 3) stop();
      },
    );
    clock.advance(1000);
    expect(times).toEqual([100, 200, 300]);
    expect(clock.pending()).toBe(0);
  });
});
