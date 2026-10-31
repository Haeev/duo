import { describe, expect, it } from 'vitest';
import {
  MAC,
  MAC_ID,
  PC,
  PC_ID,
  advanceUntil,
  createMachine,
  createPair,
  isPresent,
  startPair,
  stopMachine,
} from './helpers.ts';
import { SimNetwork } from '../src/sim/network.ts';

describe('découverte et présence', () => {
  it("les deux Duo se trouvent et se relient en quelques millisecondes (l'autre est là)", async () => {
    const pair = createPair();
    await Promise.all([pair.mac.liaison.start(), pair.pc.liaison.start()]);
    const elapsed = advanceUntil(
      pair.net,
      () => isPresent(pair.mac) && isPresent(pair.pc),
      3000,
      1,
    );
    expect(elapsed).toBeLessThan(50);
    const seenByMac = pair.mac.liaison.partner();
    expect(seenByMac.kind === 'present' && seenByMac.partner.pseudo).toBe('Sacha');
    const seenByPc = pair.pc.liaison.partner();
    expect(seenByPc.kind === 'present' && seenByPc.partner.machine).toBe(MAC_ID);
    // Une seule liaison: chaque machine a une seule connexion ouverte.
    pair.net.clock.advance(2000);
    expect(pair.net.openConnections(MAC)).toBe(1);
    expect(pair.net.openConnections(PC)).toBe(1);
  });

  it('forme un duo et retient la clé des deux côtés, puis la réutilise au redémarrage', async () => {
    const pair = createPair();
    await startPair(pair);
    const macMemory = pair.mac.store.current();
    const pcMemory = pair.pc.store.current();
    expect(macMemory.pairings).toHaveLength(1);
    expect(pcMemory.pairings).toHaveLength(1);
    expect(macMemory.pairings[0]?.key).toBe(pcMemory.pairings[0]?.key);
    expect(macMemory.pairings[0]?.partner).toBe(PC_ID);

    await stopMachine(pair.net, pair.pc);
    pair.net.clock.advance(500);
    expect(isPresent(pair.mac)).toBe(false);
    pair.net.crashHost(PC);
    const again = createMachine(pair.net, PC, PC_ID, 'Sacha', {}, pcMemory);
    await again.liaison.start();
    advanceUntil(pair.net, () => isPresent(pair.mac) && isPresent(again), 3000);
    // Même duo: aucune nouvelle clé.
    expect(again.store.current().pairings).toHaveLength(1);
    expect(pair.mac.store.current().pairings).toHaveLength(1);
  });

  it("une fermeture propre retire la présence chez l'autre aussitôt (l'autre est parti)", async () => {
    const pair = createPair();
    await startPair(pair);
    expect(isPresent(pair.mac)).toBe(true);
    await stopMachine(pair.net, pair.pc);
    advanceUntil(pair.net, () => !isPresent(pair.mac), 100, 1);
    expect(pair.mac.events.partner.at(-1)).toEqual({ kind: 'absent' });
  });

  it('un processus tué disparaît: refus de reconnexion au repos, présence retirée vite', async () => {
    const pair = createPair();
    await startPair(pair);
    pair.net.crashHost(PC);
    const elapsed = advanceUntil(pair.net, () => !isPresent(pair.mac), 10_000);
    expect(elapsed).toBeLessThan(1000);
  });

  it('les balises sont émises en diffusion dirigée sur chaque interface retenue', async () => {
    const net = new SimNetwork();
    const mac = createMachine(net, MAC, MAC_ID, 'Camille');
    await mac.liaison.start();
    expect(mac.liaison.interfaces()).toEqual([
      {
        name: 'en0',
        address: MAC,
        netmask: '255.255.255.0',
        prefix: 24,
        broadcast: '192.168.1.255',
        kind: 'physical',
      },
    ]);
    // Le PC démarre plus tard: les balises du Mac et les requêtes du PC le font apparaître.
    net.clock.advance(5000);
    const pc = createMachine(net, PC, PC_ID, 'Sacha');
    await pc.liaison.start();
    const elapsed = advanceUntil(net, () => isPresent(mac) && isPresent(pc), 3000, 1);
    expect(elapsed).toBeLessThan(50);
  });

  it('avec 30 % de datagrammes perdus, les deux se trouvent en moins de 3 s', async () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const net = new SimNetwork({ seed });
      net.datagramLoss = 0.3;
      const mac = createMachine(net, MAC, MAC_ID, 'Camille');
      const pc = createMachine(net, PC, PC_ID, 'Sacha');
      await mac.liaison.start();
      net.clock.advance(1500);
      await pc.liaison.start();
      const elapsed = advanceUntil(net, () => isPresent(mac) && isPresent(pc), 3000);
      expect(elapsed).toBeLessThan(3000);
    }
  });

  it("ignore un datagramme d'une autre application ou d'une adresse publique, sans effet visible", async () => {
    const net = new SimNetwork();
    const mac = createMachine(net, MAC, MAC_ID, 'Camille');
    await mac.liaison.start();
    const intrus = net.addHost('192.168.1.66');
    const socket = await intrus.bindDatagram({
      port: 39420,
      onMessage: () => undefined,
      onError: () => undefined,
    });
    const encoder = new TextEncoder();
    socket.send(encoder.encode('{"app":"autre","type":"announce"}'), { host: MAC, port: 39420 });
    socket.send(encoder.encode('pas du json'), { host: MAC, port: 39420 });
    socket.send(new Uint8Array(5000), { host: MAC, port: 39420 });
    net.clock.advance(1000);
    expect(mac.liaison.others()).toEqual([]);
    expect(isPresent(mac)).toBe(false);
  });

  it('signale un Duo de protocole différent et désigne la machine à mettre à jour', async () => {
    const net = new SimNetwork();
    const mac = createMachine(net, MAC, MAC_ID, 'Camille');
    const pc = createMachine(net, PC, PC_ID, 'Sacha', { config: { protocol: 2 } });
    // La version de Duo du PC est la plus récente: c'est le Mac qui doit se mettre à jour.
    await Promise.all([mac.liaison.start(), pc.liaison.start()]);
    net.clock.advance(2000);
    expect(mac.events.incompatible[0]).toMatchObject({
      machine: PC_ID,
      protocol: 2,
      update: 'both',
    });
    expect(pc.events.incompatible[0]).toMatchObject({ machine: MAC_ID, protocol: 1 });
    expect(isPresent(mac)).toBe(false);
    expect(isPresent(pc)).toBe(false);
  });
  it("un changement de pseudo ou de jeux arrive chez l'autre par la liaison établie", async () => {
    const pair = createPair();
    await startPair(pair);
    pair.pc.liaison.updateProfile({ pseudo: 'Sacha B.', color: 'triangle' });
    pair.pc.liaison.updateGames([{ id: 'la-petite-ligne', version: '0.2.0' }]);
    pair.net.clock.advance(20);
    const seen = pair.mac.liaison.partner();
    expect(seen.kind === 'present' && seen.partner.pseudo).toBe('Sacha B.');
    expect(seen.kind === 'present' && seen.partner.games).toEqual([
      { id: 'la-petite-ligne', version: '0.2.0' },
    ]);
  });
});
