/**
 * Une séance de jeu sur cette machine: hôte (simulation, sauvegardes) ou invité (état reçu),
 * derrière la même `GameView`. Sans DOM: testable dans Node avec `startLocalDuo` du faux hôte.
 */
import type { DuoContext } from '@duo/sdk';
import type { GameAction } from './actions';
import type { Content } from './donnees/charger';
import type { PlayerIndex } from './donnees/schemas/communs';
import type { ReadonlyWorld, WorldState } from './etat/monde';
import { createGuest, type Guest } from './reseau/invite';
import { createHost, type Host } from './reseau/hote';
import { restoreWorld, snapshotOf } from './sauvegarde/sauvegarde';
import type { Intent, StepInput } from './simulation/noyau/entrees';
import type { GameEvent } from './simulation/noyau/evenements';
import { createWorld, type Member } from './simulation/noyau/monde';
import { createSim, type Sim } from './simulation/noyau/pas';

/** Ce que le rendu, l'interface, le son et les entrées voient du jeu, sur les deux machines. */
export interface GameView {
  readonly content: Content;
  readonly role: 'host' | 'guest';
  /** L'état à afficher, `null` chez l'invité avant le premier état complet. */
  world(): ReadonlyWorld | null;
  /** Personnage du joueur de cette machine. */
  localIndex(): PlayerIndex | null;
  /** Demande ponctuelle du joueur local (validée et appliquée par l'hôte). */
  send(intent: Intent): void;
  onEvent(listener: (event: GameEvent) => void): () => void;
}

export interface SessionOptions {
  readonly duo: DuoContext<GameAction>;
  readonly content: Content;
}

export interface Session {
  readonly view: GameView;
  /** Un pas de la boucle à pas fixe, avec les commandes tenues du joueur local. */
  step(input: StepInput): void;
  ready(): boolean;
  /** Simulation de l'hôte (tests et outils), `null` chez l'invité. */
  hostSim(): Sim | null;
  dispose(): void;
}

export function createSession(options: SessionOptions): Session {
  const { duo, content } = options;
  const listeners = new Set<(event: GameEvent) => void>();
  let host: Host | null = null;
  let guest: Guest | null = null;
  let sim: Sim | null = null;
  let local: PlayerIndex = 0;

  if (duo.role === 'host') {
    const members: [Member, Member] = [
      { id: duo.host.id, name: duo.host.name },
      { id: duo.guest.id, name: duo.guest.name },
    ];
    let world: WorldState | null = null;
    const loaded = duo.saves.loaded;
    if (loaded !== null) {
      const restored = restoreWorld(content, loaded, members);
      if (restored.ok) world = restored.world;
      else
        duo.log.warn('sauvegarde non reprise, partie neuve', {
          reason: restored.reason,
          dataSchema: loaded.dataSchema,
        });
    }
    const hostSim = createSim(content, world ?? createWorld(content, duo.seed, members));
    sim = hostSim;
    local = hostSim.world.players[0].member === duo.localPlayer.id ? 0 : 1;
    host = createHost(hostSim, duo.net, duo.log, local);
    duo.saves.provide(() => snapshotOf(hostSim.world));
    host.sendAll();
  } else {
    const g = createGuest(content, duo.net, duo.localPlayer.id);
    guest = g;
    g.onEvent((event) => {
      for (const listener of listeners) listener(event);
    });
  }

  const view: GameView = {
    content,
    role: duo.role,
    world() {
      return sim !== null ? sim.world : (guest?.world() ?? null);
    },
    localIndex() {
      return guest === null ? local : guest.localIndex();
    },
    send(intent) {
      if (host !== null) host.queueLocal(intent);
      else guest?.queueIntent(intent);
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    view,
    step(input) {
      if (host !== null) {
        for (const event of host.step(input)) for (const listener of listeners) listener(event);
      } else guest?.step(input);
    },
    ready() {
      return guest === null ? true : guest.ready();
    },
    hostSim() {
      return sim;
    },
    dispose() {
      host?.dispose();
      guest?.dispose();
      listeners.clear();
    },
  };
}
