/**
 * Une séance de jeu sur cette machine: hôte (simulation, sauvegardes) ou invité (état reçu),
 * derrière la même `GameView`. Sans DOM: testable dans Node avec `startLocalDuo` du faux hôte.
 */
import type { DuoContext, SaveStatus } from '@duo/sdk';
import type { GameAction } from './actions';
import type { Content } from './donnees/charger';
import type { PlayerIndex } from './donnees/schemas/communs';
import type { ReadonlyWorld, WorldState } from './etat/monde';
import { createGuest, type Guest } from './reseau/invite';
import { createHost, type Host } from './reseau/hote';
import { createSaveTrigger, type SaveTrigger } from './sauvegarde/declencheur';
import { restoreWorld, snapshotOf, type ResumeNotice } from './sauvegarde/sauvegarde';
import type { Aim } from './simulation/briques/types';
import { aimOf } from './simulation/briques/visee';
import type { Intent, StepInput } from './simulation/noyau/entrees';
import type { GameEvent } from './simulation/noyau/evenements';
import { createWorld, type Member } from './simulation/noyau/monde';
import { createSim, step, type Sim } from './simulation/noyau/pas';
import { createPredictor } from './simulation/noyau/prediction';

/** Ce que le rendu, l'interface, le son et les entrées voient du jeu, sur les deux machines. */
export interface GameView {
  readonly content: Content;
  readonly role: 'host' | 'guest';
  /** L'état à afficher, `null` chez l'invité avant le premier état complet. */
  world(): ReadonlyWorld | null;
  /**
   * L'état à dessiner pour cette image: chez l'invité, les autres interpolés derrière le coussin
   * de gigue, soi-même et son geste prédits. `alpha`: avancement entre deux pas (`FrameInfo`).
   * Le rendu lit ceci, jamais `world()` (qui reste l'état logique, pour les règles et la visée).
   */
  frame(alpha: number): ReadonlyWorld | null;
  /** Personnage du joueur de cette machine. */
  localIndex(): PlayerIndex | null;
  /**
   * La cible de la touche d'action d'un joueur et son verbe, à montrer avant l'appui (`null`:
   * aucune). Calculée sur l'état connu de cette machine, la même chez l'hôte et chez l'invité.
   */
  aim(player: PlayerIndex): Aim | null;
  /** Demande ponctuelle du joueur local (validée et appliquée par l'hôte). */
  send(intent: Intent): void;
  onEvent(listener: (event: GameEvent) => void): () => void;
}

export interface SessionOptions {
  readonly duo: DuoContext<GameAction>;
  readonly content: Content;
  /** Horloge locale en millisecondes (`performance.now` par défaut; les tests donnent la leur). */
  readonly now?: () => number;
}

export interface Session {
  readonly view: GameView;
  /** Un pas de la boucle à pas fixe, avec les commandes tenues du joueur local. */
  step(input: StepInput): void;
  ready(): boolean;
  /** Remarque de la reprise à montrer aux joueurs (partie neuve après refus, remplaçant), `null` sinon. */
  readonly notice: ResumeNotice | null;
  /** Sauvegarde sur demande (hôte); chez l'invité: `refused`. */
  saveNow(): Promise<SaveStatus>;
  /** Simulation de l'hôte (tests et outils), `null` chez l'invité. */
  hostSim(): Sim | null;
  dispose(): void;
}

export function createSession(options: SessionOptions): Session {
  const { duo, content } = options;
  const listeners = new Set<(event: GameEvent) => void>();
  /** Horloge locale: la même pour l'arrivée des instantanés et pour l'image affichée. */
  const now = options.now ?? ((): number => performance.now());
  let host: Host | null = null;
  let guest: Guest | null = null;
  let sim: Sim | null = null;
  let local: PlayerIndex = 0;
  let notice: ResumeNotice | null = null;
  let saves: SaveTrigger | null = null;

  if (duo.role === 'host') {
    const members: [Member, Member] = [
      { id: duo.host.id, name: duo.host.name },
      { id: duo.guest.id, name: duo.guest.name },
    ];
    let world: WorldState | null = null;
    const loaded = duo.saves.loaded;
    if (loaded !== null) {
      const restored = restoreWorld(content, loaded, members);
      notice = restored.notice;
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
    host = createHost(hostSim, duo.net, duo.log, local, { advance: step });
    duo.saves.provide(() => snapshotOf(hostSim.world, content));
    saves = createSaveTrigger({
      target: duo.saves,
      snapshot: () => snapshotOf(hostSim.world, content),
      warn: (message, details) => {
        duo.log.warn(message, details);
      },
    });
    host.sendAll();
  } else {
    const g = createGuest(content, duo.net, duo.localPlayer.id, {
      predictor: createPredictor(content),
      now,
    });
    guest = g;
    g.onEvent((event) => {
      for (const listener of listeners) listener(event);
    });
  }

  /** Cibles déjà calculées pour le pas affiché: le rendu et l'interface les lisent à chaque image. */
  const aims: { tick: number; value: [Aim | null, Aim | null] } = { tick: -1, value: [null, null] };

  const view: GameView = {
    content,
    role: duo.role,
    world() {
      return sim !== null ? sim.world : (guest?.world() ?? null);
    },
    frame(alpha) {
      return sim !== null ? sim.world : (guest?.render(now(), alpha) ?? null);
    },
    aim(player) {
      const world = view.world();
      if (world === null) return null;
      if (aims.tick !== world.tick) {
        const look = { content, world };
        aims.value = [aimOf(look, 0), aimOf(look, 1)];
        aims.tick = world.tick;
      }
      return aims.value[player];
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

  // Reprise après une pause ou une coupure: commandes en attente, instantanés et prédiction oubliés.
  // Départ commun des deux machines: l'invité écoute enfin; tout repart complet (le lieu compris,
  // dont la première complète, envoyée avant que l'invité ne soit prêt, s'est perdue).
  const offStart = duo.on('start', () => {
    host?.resume();
  });
  const offResume = duo.on('resume', () => {
    host?.resume();
    guest?.resume();
  });

  return {
    view,
    step(input) {
      if (host !== null) {
        const events = host.step(input);
        saves?.notify(events);
        for (const event of events) for (const listener of listeners) listener(event);
      } else guest?.step(input);
    },
    ready() {
      return guest === null ? true : guest.ready();
    },
    notice,
    saveNow() {
      return saves?.saveNow() ?? Promise.resolve('refused');
    },
    hostSim() {
      return sim;
    },
    dispose() {
      offResume();
      offStart();
      saves?.dispose();
      host?.dispose();
      guest?.dispose();
      listeners.clear();
    },
  };
}
