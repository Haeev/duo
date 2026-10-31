import { describe, expect, it } from 'vitest';
import { MAC, PC, advanceUntil, createMachine, isPresent, linkStates } from './helpers.ts';
import type { Machine } from './helpers.ts';
import { SimNetwork } from '../src/sim/network.ts';

/** Salon tenu par l'application: messages `app`, relais sans partie intégrée, régime imposé. */
async function externalPair(): Promise<{ net: SimNetwork; mac: Machine; pc: Machine }> {
  const net = new SimNetwork({ seed: 3 });
  const mac = createMachine(net, MAC, 'aaaaaaaa-0000-4000-8000-000000000001', 'Camille', {
    externalSession: true,
  });
  const pc = createMachine(net, PC, 'bbbbbbbb-0000-4000-8000-000000000002', 'Sacha', {
    externalSession: true,
  });
  await Promise.all([mac.liaison.start(), pc.liaison.start()]);
  advanceUntil(net, () => isPresent(mac) && isPresent(pc), 1000);
  return { net, mac, pc };
}

describe('salon externe', () => {
  it("relaie les messages fiables de l'application et ceux du jeu, sans salon intégré", async () => {
    const { net, mac, pc } = await externalPair();
    const received: { type: string; body: unknown }[] = [];
    pc.liaison.on('app', (message) => received.push(message));
    expect(mac.liaison.sendApp('session', { rev: 3, salon: { ready: true } })).toBe(true);
    expect(mac.liaison.match.send(2, new TextEncoder().encode('{"tick":1}'), 'latest')).toEqual({
      ok: true,
    });
    net.clock.advance(20);
    expect(received).toEqual([{ type: 'session', body: { rev: 3, salon: { ready: true } } }]);
    expect(pc.events.game).toHaveLength(1);
    const payload = pc.events.game[0]?.payload;
    expect(payload instanceof Uint8Array ? new TextDecoder().decode(payload) : null).toBe(
      '{"tick":1}',
    );
    expect(pc.logs).not.toContain('message-inconnu');
  });

  it("le régime actif imposé par l'application déclare la perte à 2 s, et la reprise rend tout", async () => {
    const { net, mac, pc } = await externalPair();
    mac.liaison.setActive(true);
    net.clock.advance(100);
    const received: unknown[] = [];
    pc.liaison.on('app', ({ body }) => received.push(body));
    net.cut(MAC, PC);
    const cutAt = net.clock.now();
    mac.liaison.sendApp('intent', { n: 1 });
    advanceUntil(net, () => linkStates(mac).at(-1) === 'lost', 3000);
    expect(net.clock.now() - cutAt).toBeLessThanOrEqual(2100);
    expect(isPresent(mac)).toBe(true);
    net.restore(MAC, PC);
    advanceUntil(net, () => linkStates(mac).at(-1) === 'connected', 2000);
    net.clock.advance(50);
    expect(received).toEqual([{ n: 1 }]);
    // Au repos de nouveau: une coupure de 3 s ne déclare plus rien.
    mac.liaison.setActive(false);
    net.clock.advance(3000);
    net.cut(MAC, PC);
    net.clock.advance(3000);
    expect(linkStates(mac).at(-1)).not.toBe('lost');
    net.restore(MAC, PC);
  });

  it('sans liaison, `sendApp` ne promet rien', async () => {
    const net = new SimNetwork();
    const mac = createMachine(net, MAC, 'aaaaaaaa-0000-4000-8000-000000000001', 'Camille', {
      externalSession: true,
    });
    await mac.liaison.start();
    expect(mac.liaison.sendApp('session', {})).toBe(false);
  });
});
