import { createLiaison } from '../src/liaison.ts';
import type { Liaison, LiaisonEvents, LiaisonOptions } from '../src/liaison.ts';
import { PROFILE_R0, SimNetwork } from '../src/sim/network.ts';
import type { LinkProfile } from '../src/sim/network.ts';
import { createMemoryStore } from '../src/store.ts';
import type { LinkMemory } from '../src/store.ts';

export const MAC = '192.168.1.10';
export const PC = '192.168.1.20';
/** Le Mac a le plus petit identifiant: c'est lui qui gagne l'appel croisé. */
export const MAC_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
export const PC_ID = 'bbbbbbbb-0000-4000-8000-000000000002';

export interface Machine {
  readonly liaison: Liaison;
  readonly store: ReturnType<typeof createMemoryStore>;
  readonly logs: string[];
  readonly events: { [K in keyof LiaisonEvents]: LiaisonEvents[K][] };
}

export function createMachine(
  net: SimNetwork,
  address: string,
  machine: string,
  pseudo: string,
  overrides: Partial<LiaisonOptions> = {},
  memory?: LinkMemory,
): Machine {
  const store = createMemoryStore(memory);
  const logs: string[] = [];
  const liaison = createLiaison({
    identity: { machine, appVersion: '0.1.0', computer: `ORDI-${pseudo.toUpperCase()}` },
    profile: { pseudo, color: pseudo === 'Camille' ? 'rond' : 'carre' },
    driver: net.addHost(address),
    store,
    log: (event) => {
      logs.push(event);
    },
    ...overrides,
  });
  const events: Machine['events'] = {
    partner: [],
    session: [],
    game: [],
    notice: [],
    incompatible: [],
    others: [],
    interfaces: [],
  };
  liaison.on('partner', (payload) => events.partner.push(payload));
  liaison.on('session', (payload) => events.session.push(payload));
  liaison.on('game', (payload) => events.game.push(payload));
  liaison.on('notice', (payload) => events.notice.push(payload));
  liaison.on('incompatible', (payload) => events.incompatible.push(payload));
  return { liaison, store, logs, events };
}

export interface Pair {
  readonly net: SimNetwork;
  readonly mac: Machine;
  readonly pc: Machine;
}

export function createPair(profile: LinkProfile = PROFILE_R0, seed = 11): Pair {
  const net = new SimNetwork({ profile, seed });
  const mac = createMachine(net, MAC, MAC_ID, 'Camille');
  const pc = createMachine(net, PC, PC_ID, 'Sacha');
  return { net, mac, pc };
}

/** Démarre les deux machines et laisse la découverte et la poignée de main se faire. */
export async function startPair(pair: Pair, settleMs = 200): Promise<void> {
  await Promise.all([pair.mac.liaison.start(), pair.pc.liaison.start()]);
  pair.net.clock.advance(settleMs);
}

/** Fermeture propre en temps simulé: les adieux UDP partent à 50 ms d'écart. */
export async function stopMachine(net: SimNetwork, machine: Machine): Promise<void> {
  const stopping = machine.liaison.stop();
  net.clock.advance(200);
  await stopping;
}

export function isPresent(machine: Machine): boolean {
  return machine.liaison.partner().kind === 'present';
}

/** Avance le temps par petits pas jusqu'à ce que la condition tienne; rend le temps écoulé. */
export function advanceUntil(net: SimNetwork, condition: () => boolean, maxMs: number, stepMs = 5): number {
  const start = net.clock.now();
  while (!condition()) {
    if (net.clock.now() - start >= maxMs) {
      throw new Error(`condition non atteinte en ${String(maxMs)} ms`);
    }
    net.clock.advance(stepMs);
  }
  return net.clock.now() - start;
}

/** Ouvre un salon chez le Mac, le PC le rejoint, le Mac est prêt: la partie part et les deux chargent. */
export function playMatch(pair: Pair): void {
  const { net, mac, pc } = pair;
  mac.liaison.lobby.open({ id: 'la-petite-ligne', version: '0.1.0', save: null });
  advanceUntil(net, () => pc.liaison.session().invitation !== null, 1000);
  pc.liaison.lobby.join();
  advanceUntil(net, () => mac.liaison.session().lobby?.guestJoined === true, 1000);
  mac.liaison.lobby.setReady(true);
  advanceUntil(net, () => mac.liaison.session().lobby?.match?.phase === 'loading', 5000);
  advanceUntil(net, () => pc.liaison.session().lobby?.match?.phase === 'loading', 1000);
  mac.liaison.match.reportLoaded();
  pc.liaison.match.reportLoaded();
  advanceUntil(net, () => mac.liaison.session().lobby?.match?.phase === 'playing', 3000);
  advanceUntil(net, () => pc.liaison.session().lobby?.match?.phase === 'playing', 1000);
}
