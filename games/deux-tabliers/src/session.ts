/**
 * Une séance sur cette machine: hôte (simulation, sauvegardes) ou invité (état reçu, prédiction),
 * derrière la même `GameView`. Sans DOM ni Three.js: testable dans Node avec `startLocalDuo`.
 */
import { v, type DuoContext, type SaveSnapshot } from '@duo/sdk';
import type { GameAction } from './actions';
import { purgeOrphanTickets } from './branchement';
import type { Content } from './donnees/charger';
import { WORLD_FORMAT, WorldSchema, type World } from './etat/monde';
import { createGuest, type Guest } from './reseau/invite';
import { createHost, type Host } from './reseau/hote';
import type { GameView } from './reseau/vue';
import type { Intent, StepInput } from './simulation/entrees';
import { createWorld } from './simulation/monde';
import { WEEKDAYS } from './interface/textes';

/** Libellé de l'emplacement: « Jour 9 (mardi), Le café d'Ormeval », 40 caractères au plus. */
export function saveLabel(content: Content, world: World): string {
  const s = world.clientele;
  if (s.day === 0) return content.plan.title.slice(0, 40);
  const weekday = WEEKDAYS[(s.day - 1) % 7] ?? '';
  const address = s.houseName ?? 'Ormeval';
  return `Jour ${String(s.day)} (${weekday}), ${address}`.slice(0, 40);
}

/** Progression de la démo: jour atteint sur le nombre de journées prévues. */
export function saveProgress(content: Content, world: World): number {
  const days = content.clientele.days.days.length;
  return days === 0 ? 0 : Math.min(1, world.clientele.day / days);
}

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
  // Sauvegardes d'avant RN-02: les tickets des groupes partis gonflaient le domaine du service
  // au-delà des 64 Kio d'un message, et la partie s'arrêtait à chaque reprise.
  purgeOrphanTickets(world, null);
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
      label: saveLabel(content, world),
      dataSchema: WORLD_FORMAT,
      data: world,
      progress: saveProgress(content, world),
    });
    duo.saves.provide(snapshot);
    // Fin de journée (manifeste, moment `level-end`): écrite après le pas, sur un état complet.
    let dayEnded = false;
    const unsubscribe = host.view.onEvent((event) => {
      if (event.type === 'clientele-evening') dayEnded = true;
    });
    return {
      view: host.view,
      step: (input, intents, dt) => {
        host.step(input, intents, dt);
        if (!dayEnded) return;
        dayEnded = false;
        duo.saves.write('level-end', snapshot()).then(
          (status) => {
            if (status !== 'ok') duo.log.warn('sauvegarde du soir non écrite', { status });
          },
          (error: unknown) => {
            duo.log.warn('sauvegarde du soir non écrite', { error: String(error) });
          },
        );
      },
      beforeFrame: (alpha) => {
        host.beforeFrame(alpha);
      },
      ready: () => true,
      hostWorld: () => world,
      snapshot,
      dispose: () => {
        unsubscribe();
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
