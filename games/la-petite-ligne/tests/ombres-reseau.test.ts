// Ombres des poissons sur leur canal (mission 0.13 de dev-gameplay-3d): le message d'état ne les
// porte plus, l'hôte les envoie à part et seulement quand elles changent. L'invité voit les mêmes
// ombres au même endroit que l'hôte, pêche à deux comprise, et dès sa première image s'il arrive tard.
import type { NetChannel } from '@duo/sdk';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { shadowPosAt, type FishShadow } from '../src/etat/peche';
import type { CharacterId, Vec2, WorldState } from '../src/etat/types';
import { createHost, type HostChannels } from '../src/reseau/hote';
import { createGuest, type GuestChannels } from '../src/reseau/invite';
import { sentWorld } from '../src/reseau/etat-transmis';
import {
  CHANNEL,
  EventsMessageSchema,
  FastSnapshotSchema,
  GuestInputSchema,
  ShadowsMessageSchema,
  WorldMessageSchema,
} from '../src/reseau/schemas';
import { SIM_HZ } from '../src/simulation/constantes';
import { type Sim, character } from '../src/simulation/contexte';
import { placeCharacter } from '../src/simulation/deplacement';
import { waterAhead } from '../src/simulation/peche';
import { createRobot } from '../src/simulation/robot';
import { addToBag } from '../src/simulation/sac';
import { contentAndMap, newSim, play } from './aides';

const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };

/** Canaux en mémoire, dans l'ordre d'envoi (comme la liaison du SDK), par JSON et par les schémas. */
function memoryLink(): { host: HostChannels; guest: GuestChannels; deliver(): void; sent: Map<number, number> } {
  const queue: (() => void)[] = [];
  const sent = new Map<number, number>();
  const pair = <T>(id: number, schema: v.GenericSchema<unknown, T>): { sender: NetChannel<T>; receiver: NetChannel<T> } => {
    const listeners = new Set<(message: T) => void>();
    return {
      sender: {
        id,
        send(message) {
          const json = JSON.stringify(message);
          sent.set(id, (sent.get(id) ?? 0) + 1);
          queue.push(() => {
            const value = v.parse(schema, JSON.parse(json));
            for (const l of listeners) l(value);
          });
        },
        onMessage: () => () => undefined,
      },
      receiver: {
        id,
        send: () => undefined,
        onMessage(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
    };
  };
  const input = pair(CHANNEL.guestInput, GuestInputSchema);
  const world = pair(CHANNEL.world, WorldMessageSchema);
  const fast = pair(CHANNEL.fast, FastSnapshotSchema);
  const events = pair(CHANNEL.events, EventsMessageSchema);
  const shadows = pair(CHANNEL.shadows, ShadowsMessageSchema);
  return {
    host: { input: input.receiver, world: world.sender, fast: fast.sender, events: events.sender, shadows: shadows.sender },
    guest: { input: input.sender, world: world.receiver, fast: fast.receiver, events: events.receiver, shadows: shadows.receiver },
    deliver() {
      while (queue.length > 0) queue.shift()?.();
    },
    sent,
  };
}

/** Jour 1 en pleine journée, puis les deux libres au ponton, canne en main, face à l'eau. */
function duoAtPontoon(): Sim {
  const sim = newSim();
  play(sim, createRobot(), (s) => s.world.phase === 'day' && s.world.clock.running && s.world.clock.minutes > 10 * 60 && s.world.scene === null && s.world.scripts.length === 0, SIM_HZ * 900);
  const pontoon = sim.map.points.fishing_pontoon;
  if (pontoon === undefined) throw new Error('ponton absent');
  const spots: Record<CharacterId, Vec2> = { p1: pontoon, p2: { x: pontoon.x - 1.5, y: pontoon.y } };
  for (const c of sim.world.characters) {
    c.status = 'active';
    c.menu = null;
    c.dialogue = null;
    c.seat = null;
    c.inside = null;
    c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
    placeCharacter(sim, c, spots[c.id]);
    c.facing = Math.PI / 2;
    c.speed = 0;
    addToBag(sim, c, 'fishing_rod', 'ordinary', 1);
    c.selected = c.bag.findIndex((s) => s?.item === 'fishing_rod');
    expect(waterAhead(sim, c), `${c.id} face à l'eau`).not.toBeNull();
  }
  return sim;
}

const still = (seq: number): { seq: number; moveX: number; moveY: number; actHeld: boolean } => ({ seq, moveX: 0, moveY: 0, actHeld: false });

/** Les ombres que chacun dessine au pas `tick`: identité, poisson, état, ligne et position de l'ancre. */
function drawn(shadows: readonly FishShadow[], tick: number): string[] {
  return shadows.map((s) => {
    const p = shadowPosAt(s, tick);
    return `${String(s.id)} ${s.fish} ${s.state} ${s.line ?? '-'} ${String(s.roam)} ${String(s.heading)} ${String(p.x)},${String(p.y)}`;
  });
}

describe('ombres des poissons sur leur canal', () => {
  it('le message d’état ne porte plus les ombres', () => {
    const sim = duoAtPontoon();
    const sent = sentWorld(sim.world);
    expect('shadows' in sent.fishing).toBe(false);
    expect(Object.keys(sent.fishing).sort()).toEqual(Object.keys(sim.world.fishing).filter((k) => k !== 'shadows').sort());
  });

  it('pêche à deux au ponton: l’invité voit les mêmes ombres au même endroit à chaque état reçu; elles partent seulement quand elles changent', () => {
    const { content, map } = contentAndMap();
    const sim = duoAtPontoon();
    const link = memoryLink();
    const host = createHost(sim, link.host, 'p1', 'p2');
    const guest = createGuest(content, map, link.guest, B.id, () => 0);
    host.sendWorld();
    link.deliver();
    let compared = 0;
    let withShadows = 0;
    const lines = new Set<string>();
    const changes = new Set<string>();
    let previous = '';
    for (let i = 1; i <= SIM_HZ * 120; i++) {
      // Chacun lance quand sa ligne est rentrée, et ferre à la touche: l'un par l'hôte, l'autre par l'invité.
      for (const id of ['p1', 'p2'] as const) {
        const line = character(sim, id).fishing;
        const due = line === null ? i % SIM_HZ === (id === 'p1' ? 0 : 15) : line.phase === 'bite';
        if (!due) continue;
        if (id === 'p1') host.queueLocal({ type: 'act' });
        else guest.queueIntent({ type: 'act' });
      }
      guest.step(still(i));
      link.deliver();
      host.step(still(i));
      link.deliver();
      const json = JSON.stringify(sim.world.fishing.shadows);
      if (json !== previous) changes.add(json);
      previous = json;
      for (const s of sim.world.fishing.shadows) if (s.line !== undefined) lines.add(`${s.line} ${s.state}`);
      const shown: WorldState | null = guest.render(0, 1);
      if (shown === null) throw new Error('aucun état reçu');
      if (shown.tick !== sim.world.tick) continue;
      compared += 1;
      if (sim.world.fishing.shadows.length > 0) withShadows += 1;
      expect(drawn(shown.fishing.shadows, shown.tick + 0.5), `pas ${String(sim.world.tick)}`).toEqual(drawn(sim.world.fishing.shadows, sim.world.tick + 0.5));
      expect(shown.fishing.shadows).toEqual(sim.world.fishing.shadows);
    }
    host.dispose();
    guest.dispose();
    expect(compared, 'états comparés').toBeGreaterThan(100);
    expect(withShadows, 'états comparés avec des ombres').toBeGreaterThan(100);
    // Pêche à deux: chacun a eu une ombre sous son bouchon.
    expect([...lines]).toEqual(expect.arrayContaining(['p1 under', 'p2 under']));
    const shadowMessages = link.sent.get(CHANNEL.shadows) ?? 0;
    const worldMessages = link.sent.get(CHANNEL.world) ?? 0;
    // Une liste par changement des ombres (plus celle du départ), bien moins que d'états.
    expect(shadowMessages).toBeLessThanOrEqual(changes.size + 1);
    expect(shadowMessages).toBeLessThan(worldMessages);
  }, 300_000);

  it('connexion tardive: les ombres de l’hôte dès la première image, même sans changement depuis le dernier envoi', () => {
    const { content, map } = contentAndMap();
    const sim = duoAtPontoon();
    const link = memoryLink();
    const host = createHost(sim, link.host, 'p1', 'p2');
    for (let i = 0; i < SIM_HZ * 20; i++) host.step(still(i));
    expect(sim.world.fishing.shadows.length, 'des ombres au ponton').toBeGreaterThan(0);
    // Un invité qui arrive maintenant n'a rien reçu de ce qui précède.
    const late = memoryLink();
    const host2 = createHost(sim, late.host, 'p1', 'p2');
    host2.sendWorld();
    expect(late.sent.get(CHANNEL.shadows), 'les ombres partent avec l’état').toBe(1);
    const guest = createGuest(content, map, late.guest, B.id, () => 0);
    late.deliver();
    const first = guest.render(0, 1);
    if (first === null) throw new Error('aucun état reçu');
    expect(drawn(first.fishing.shadows, sim.world.tick)).toEqual(drawn(sim.world.fishing.shadows, sim.world.tick));
    host.dispose();
    host2.dispose();
    guest.dispose();
  });
});
