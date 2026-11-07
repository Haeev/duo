/**
 * Une séance sur cette machine: hôte (simulation, sauvegardes) ou invité (état reçu, prédiction),
 * derrière la même `GameView`. Sans DOM ni Three.js: testable dans Node avec `startLocalDuo`.
 */
import { v, type DuoContext, type SaveSnapshot } from '@duo/sdk';
import type { GameAction } from './actions';
import type { Content } from './donnees/charger';
import { WORLD_FORMAT, WorldSchema, type World } from './etat/monde';
import { createGuest, type Guest } from './reseau/invite';
import { createHost, type Host } from './reseau/hote';
import type { GameView } from './reseau/vue';
import type { Intent, StepInput } from './simulation/entrees';
import { createWorld } from './simulation/monde';

export interface SessionOptions {
  readonly duo: DuoContext<GameAction>;
  readonly content: Content;
  /** Horloge locale en millisecondes (interpolation chez l'invité). */
  readonly now: () => number;
}

export interface Session {
  readonly view: GameView;
  /** Un pas de la boucle du SDK, avec les entrées et les intentions du joueur local. */
  step(input: StepInput, intents: readonly Intent[], dt: number): void;
  /** Avant chaque image. */
  beforeFrame(alpha: number, frameDt: number): void;
  ready(): boolean;
  /** Monde de l'hôte (tests, outils), `null` chez l'invité. */
  hostWorld(): World | null;
  /** Ce que l'hôte enregistre. */
  snapshot(): SaveSnapshot | null;
  dispose(): void;
}

/** Reprise d'une sauvegarde: format validé, joueurs replacés par identifiant de membre. */
export function restoreWorld(
  data: unknown,
  dataSchema: number,
  memberIds: readonly [string, string],
): World | null {
  if (dataSchema !== WORLD_FORMAT) return null;
  const parsed = v.safeParse(WorldSchema, data);
  if (!parsed.success) return null;
  const world = parsed.output;
  const [a, b] = world.players;
  // Les rôles ont pu s'inverser d'une séance à l'autre: chacun retrouve son avatar.
  if (a.memberId === memberIds[1] && b.memberId === memberIds[0]) world.players = [b, a];
  world.players[0].memberId = memberIds[0];
  world.players[1].memberId = memberIds[1];
  world.players[0].use = null;
  world.players[1].use = null;
  return world;
}

export function createSession({ duo, content, now }: SessionOptions): Session {
  const memberIds = [duo.host.id, duo.guest.id] as const;
  if (duo.role === 'host') {
    const loaded = duo.saves.loaded;
    const restored =
      loaded === null ? null : restoreWorld(loaded.data, loaded.dataSchema, memberIds);
    if (loaded !== null && restored === null)
      duo.log.warn('sauvegarde illisible, nouvelle partie', { slot: loaded.slot });
    const world = restored ?? createWorld(content, memberIds);
    const host: Host = createHost(duo.net, content, world, duo.random('simulation'));
    const snapshot = (): SaveSnapshot => ({
      label: content.plan.title.slice(0, 40),
      dataSchema: WORLD_FORMAT,
      data: world,
      progress: 0,
    });
    duo.saves.provide(snapshot);
    return {
      view: host.view,
      step: (input, intents, dt) => {
        host.step(input, intents, dt);
      },
      beforeFrame: (alpha) => {
        host.beforeFrame(alpha);
      },
      ready: () => true,
      hostWorld: () => world,
      snapshot,
      dispose: () => {
        host.dispose();
      },
    };
  }
  const world = createWorld(content, memberIds);
  const guest: Guest = createGuest(duo.net, content, world, now);
  return {
    view: guest.view,
    step: (input, intents, dt) => {
      guest.step(input, intents, dt);
    },
    beforeFrame: (_alpha, frameDt) => {
      guest.beforeFrame(now(), frameDt);
    },
    ready: () => guest.ready(),
    hostWorld: () => null,
    snapshot: () => null,
    dispose: () => {
      guest.dispose();
    },
  };
}
