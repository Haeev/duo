// État transmis sans les positions des habitants (0.13, mission 0.13 de dev-reseau): le canal
// rapide les porte, l'invité les reprend de la dernière valeur rapide connue, sinon de son planning.
// Connexion tardive, reprise d'une sauvegarde en pleine marche, état arrivé avant tout instantané:
// aucun habitant à l'origine, aucun saut, chacun là où l'hôte le voit dès la première image.
import type { NetChannel } from '@duo/sdk';
import { startLocalDuo } from '@duo/sdk-dev';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import type { VillagerState, WorldState } from '../src/etat/types';
import { createHost, openHostChannels, type HostChannels } from '../src/reseau/hote';
import { createGuest, openGuestChannels, type Guest, type GuestChannels } from '../src/reseau/invite';
import { sentWorld, worldFromSent, type SentWorld } from '../src/reseau/etat-transmis';
import { CHANNEL, EventsMessageSchema, FastSnapshotSchema, GuestInputSchema, ShadowsMessageSchema, WorldMessageSchema, type FastSnapshot } from '../src/reseau/schemas';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { createSession, type GameAction } from '../src/session';
import { SIM_DT, SIM_HZ } from '../src/simulation/constantes';
import type { Sim } from '../src/simulation/contexte';
import { step } from '../src/simulation/pas';
import { createRobot } from '../src/simulation/robot';
import { contentAndMap, newSim, play } from './aides';

const FRAME_MS = 1000 / 60;
const STILL: { seq: number; moveX: number; moveY: number; actHeld: boolean } = { seq: 0, moveX: 0, moveY: 0, actHeld: false };
const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };

/**
 * Canaux en mémoire, dans l'ordre d'envoi, remis à la demande (`deliver`). Chaque message passe par
 * JSON et par le schéma de son canal, comme sur le fil. Les messages arrivés avant un écouteur
 * attendent, comme dans le SDK.
 */
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

/** En pleine journée, au moins un habitant en marche et un autre caché (chez lui ou hors du bourg). */
function busyDay(): Sim {
  const sim = newSim();
  const robot = createRobot();
  play(sim, robot, (s) => s.world.phase === 'day' && s.world.clock.running && s.world.clock.minutes > 10 * 60, SIM_HZ * 900);
  play(
    sim,
    robot,
    (s) => s.world.villagers.filter((x) => x.speed > 0).length >= 2 && s.world.villagers.some((x) => !x.visible),
    SIM_HZ * 600,
  );
  expect(sim.world.villagers.filter((x) => x.speed > 0).length, 'au moins deux habitants en marche').toBeGreaterThanOrEqual(2);
  expect(sim.world.villagers.some((x) => !x.visible), 'au moins un habitant caché').toBe(true);
  return sim;
}

function expectSamePlaces(shown: WorldState, truth: readonly VillagerState[], label: string, facing = true): void {
  expect(shown.villagers.map((x) => x.id), `${label}: mêmes habitants`).toEqual(truth.map((x) => x.id));
  for (const t of truth) {
    const g = shown.villagers.find((x) => x.id === t.id);
    if (g === undefined) continue;
    expect(g.pos.x === 0 && g.pos.y === 0, `${label}: ${t.id} à l'origine`).toBe(false);
    expect(Math.hypot(g.pos.x - t.pos.x, g.pos.y - t.pos.y), `${label}: ${t.id} à sa place`).toBeLessThan(1e-9);
    if (facing) expect(g.facing, `${label}: cap de ${t.id}`).toBeCloseTo(t.facing, 9);
    expect(g.visible, `${label}: ${t.id} visible ou non`).toBe(t.visible);
  }
}

function copyVillagers(world: WorldState): VillagerState[] {
  return world.villagers.map((x) => ({ ...x, pos: { ...x.pos }, prev: { ...x.prev } }));
}

/**
 * Suite de l'arrivée: `seconds` secondes à 60 images, hôte et invité au pas. Rend le plus grand
 * déplacement affiché d'une image à l'autre pour un habitant que l'hôte n'a pas téléporté.
 */
function followUp(sim: Sim, guest: Guest, link: ReturnType<typeof memoryLink>, clock: { now: number }, seconds: number): number {
  const { content } = contentAndMap();
  const host = createHost(sim, link.host, 'p1', 'p2');
  let previous = new Map<string, { x: number; y: number }>();
  let hostPrevious = new Map(sim.world.villagers.map((x) => [x.id, { ...x.pos }]));
  const teleported = new Set<string>();
  let worst = 0;
  let accumulator = 0;
  let seq = 0;
  for (let f = 0; f < seconds * 60; f++) {
    clock.now += FRAME_MS;
    accumulator += FRAME_MS;
    while (accumulator >= SIM_DT * 1000) {
      accumulator -= SIM_DT * 1000;
      host.step(STILL);
      for (const x of sim.world.villagers) {
        const before = hostPrevious.get(x.id);
        if (before !== undefined && Math.hypot(x.pos.x - before.x, x.pos.y - before.y) > 0.5) teleported.add(x.id);
      }
      hostPrevious = new Map(sim.world.villagers.map((x) => [x.id, { ...x.pos }]));
      guest.step({ ...STILL, seq: (seq += 1) });
    }
    link.deliver();
    const shown = guest.render(clock.now, 1);
    if (shown === null) throw new Error('invité sans état');
    for (const x of shown.villagers) {
      const before = previous.get(x.id);
      if (before !== undefined && !teleported.has(x.id)) worst = Math.max(worst, Math.hypot(x.pos.x - before.x, x.pos.y - before.y));
    }
    previous = new Map(shown.villagers.map((x) => [x.id, { ...x.pos }]));
  }
  host.dispose();
  // Un habitant marche à `villagerSpeed`: une image à 60 Hz en fait au plus le soixantième.
  expect(content.settings.feel.villagerSpeed).toBeGreaterThan(0);
  return worst / (content.settings.feel.villagerSpeed / 60);
}

describe('état transmis sans les positions des habitants', () => {
  it('le message d’état n’a plus ni pos, ni prev, ni facing, ni speed; la sauvegarde les garde', () => {
    const sim = busyDay();
    const sent = sentWorld(sim.world);
    for (const x of sent.villagers) {
      for (const key of ['pos', 'prev', 'facing', 'speed']) expect(key in x, `${x.id}.${key}`).toBe(false);
    }
    const saved = JSON.parse(JSON.stringify(snapshotOf(sim).data)) as { villagers: Record<string, unknown>[] };
    for (const x of saved.villagers) expect('pos' in x && 'facing' in x, `sauvegarde de ${String(x.id)}`).toBe(true);
  });

  it('le canal rapide porte les 21 habitants, visibles ou cachés, à la même précision que l’état', () => {
    const sim = busyDay();
    const link = memoryLink();
    const snaps: FastSnapshot[] = [];
    link.guest.fast.onMessage((s) => snaps.push(s));
    const host = createHost(sim, link.host, 'p1', 'p2');
    host.step(STILL);
    link.deliver();
    const last = snaps[snaps.length - 1];
    expect(last).toBeDefined();
    expect(sim.world.villagers).toHaveLength(21);
    expect(last?.villagers.map((x) => x.id)).toEqual(sim.world.villagers.map((x) => x.id));
    for (const x of sim.world.villagers) {
      const f = last?.villagers.find((y) => y.id === x.id);
      // Égalité stricte: les deux passent par JSON sans arrondi.
      expect(f, x.id).toEqual({ id: x.id, x: x.pos.x, y: x.pos.y, f: x.facing, s: x.speed });
    }
    host.dispose();
  });

  it('connexion tardive en pleine journée: chacun à sa place dès la première image, puis sans saut', () => {
    const { content, map } = contentAndMap();
    const sim = busyDay();
    const link = memoryLink();
    const clock = { now: 1000 };
    const host = createHost(sim, link.host, 'p1', 'p2');
    host.sendWorld();
    host.dispose();
    expect(link.sent.get(CHANNEL.fast), 'un instantané part avec l’état').toBe(1);
    const truth = copyVillagers(sim.world);
    const guest = createGuest(content, map, link.guest, B.id, () => clock.now);
    link.deliver();
    const first = guest.render(clock.now, 1);
    if (first === null) throw new Error('aucun état reçu');
    expectSamePlaces(first, truth, 'première image');
    const ratio = followUp(sim, guest, link, clock, 3);
    expect(ratio, 'plus grand pas affiché, en pas d’une image de marche').toBeLessThan(1.6);
    guest.dispose();
  });

  it('reprise d’une sauvegarde prise en pleine marche: même chose chez l’invité', () => {
    const { content, map } = contentAndMap();
    const before = busyDay();
    const data = JSON.parse(JSON.stringify(snapshotOf(before).data)) as unknown;
    const sim = restoreWorld(content, map, data, snapshotOf(before).dataSchema, [A, B]);
    expect(sim.world.villagers.some((x) => Math.hypot(x.pos.x - x.prev.x, x.pos.y - x.prev.y) > 0 || x.speed > 0), 'reprise en pleine marche').toBe(true);
    const link = memoryLink();
    const clock = { now: 1000 };
    createHost(sim, link.host, 'p1', 'p2').sendWorld();
    const truth = copyVillagers(sim.world);
    const guest = createGuest(content, map, link.guest, B.id, () => clock.now);
    link.deliver();
    const first = guest.render(clock.now, 1);
    if (first === null) throw new Error('aucun état reçu');
    expectSamePlaces(first, truth, 'reprise');
    expect(followUp(sim, guest, link, clock, 2), 'plus grand pas affiché après la reprise').toBeLessThan(1.6);
    guest.dispose();
  });

  it('état arrivé avant tout instantané (au matin): chacun posé à sa place du planning, comme chez l’hôte', () => {
    const { content, map } = contentAndMap();
    const sim = newSim();
    const robot = createRobot();
    play(sim, robot, (s) => s.world.clock.day === 2 && s.world.phase === 'breakfast', SIM_HZ * 3600);
    for (let i = 0; i < 3; i++) step(sim, { controls: {}, intents: [] });
    expect(sim.world.phase).toBe('breakfast');
    const link = memoryLink();
    const guest = createGuest(content, map, link.guest, B.id, () => 0);
    // L'état seul, sans l'instantané que `sendWorld` envoie d'habitude avant lui.
    link.host.world.send({ ack: -1, world: sentWorld(sim.world) });
    link.deliver();
    const first = guest.render(0, 1);
    if (first === null) throw new Error('aucun état reçu');
    // Le cap, lui, est celui du poste: l'hôte ne s'y tourne qu'au premier pas de la journée.
    expectSamePlaces(first, sim.world.villagers, 'au matin, sans instantané', false);
    guest.dispose();
  });

  it('relecture: la valeur rapide connue d’abord, le planning seulement à défaut', () => {
    const sim = busyDay();
    const sent = JSON.parse(JSON.stringify(sentWorld(sim.world))) as SentWorld;
    const [known, ...others] = sim.world.villagers;
    if (known === undefined) throw new Error('aucun habitant');
    const { world, unplaced } = worldFromSent(
      sent,
      (id) => (id === known.id ? { x: known.pos.x, y: known.pos.y, f: known.facing, s: known.speed } : null),
      () => ({ x: -3, y: -4, f: 1, s: 0 }),
      [],
    );
    expect(unplaced).toEqual(others.map((x) => x.id));
    const relu = world.villagers.find((x) => x.id === known.id);
    expect(relu).toEqual({ ...known, prev: { ...known.pos } });
    for (const x of world.villagers.filter((y) => y.id !== known.id)) {
      expect(x.pos, x.id).toEqual({ x: -3, y: -4 });
      expect(x.speed, x.id).toBe(0);
    }
  });
});

describe('connexion par le SDK: l’instantané passe avant l’état', () => {
  it('session de l’invité ouverte après l’envoi de l’hôte: habitants à leur place à la première image', async () => {
    const duo = await startLocalDuo<GameAction>({ manifest, conditions: { latencyMs: 0, jitterMs: 0, spikeProbability: 0 }, seed: 3 });
    await duo.start();
    const { content, map } = contentAndMap();
    const now = (): number => 0;
    const hostSession = createSession({ duo: duo.hostGame, content, map, robot: null, now });
    const hostSim = hostSession.hostSim();
    if (hostSim === null) throw new Error('hôte sans monde');
    // L'hôte a envoyé instantané et état à sa création; l'invité s'abonne ensuite (messages en attente).
    await new Promise((resolve) => setTimeout(resolve, 20));
    const guestSession = createSession({ duo: duo.guestGame, content, map, robot: null, now });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(guestSession.ready()).toBe(true);
    expectSamePlaces(guestSession.view.world() as WorldState, hostSim.world.villagers, 'session');
    guestSession.dispose();
    hostSession.dispose();
    duo.dispose();
  });

  it('en pleine journée, invité abonné après coup: l’instantané en attente est remis avant l’état', async () => {
    const duo = await startLocalDuo<GameAction>({ manifest, conditions: { latencyMs: 0, jitterMs: 0, spikeProbability: 0 }, seed: 3 });
    await duo.start();
    const { content, map } = contentAndMap();
    const sim = busyDay();
    const host = createHost(sim, openHostChannels(duo.hostGame.net), 'p1', 'p2');
    host.sendWorld();
    const truth = copyVillagers(sim.world);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const guest = createGuest(content, map, openGuestChannels(duo.guestGame.net), B.id, () => 0);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const first = guest.render(0, 1);
    if (first === null) throw new Error('aucun état reçu');
    expectSamePlaces(first, truth, 'SDK, pleine journée');
    host.dispose();
    guest.dispose();
    duo.dispose();
  });
});
