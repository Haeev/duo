/**
 * Une séance de jeu sur cette machine: hôte (simulation, sauvegardes,
 * historique) ou invité (état reçu, prédiction), derrière la même `GameView`.
 * Sans DOM: testable dans Node avec `startLocalDuo` du faux hôte.
 */
import type { DuoContext, SaveSnapshot } from '@duo/sdk';
import type { ControlFrame, Intent } from './etat/actions';
import type { GameMap } from './etat/carte';
import type { CharacterId, ReadonlyWorld, WorldEvent, WorldState } from './etat/types';
import type { GameView } from './etat/vue';
import type { Content } from './donnees/types';
import { createHost, openHostChannels, type Host } from './reseau/hote';
import { createGuest, openGuestChannels, type Guest } from './reseau/invite';
import { decodeSave, progressOf, restoreWorld, snapshotOf } from './sauvegarde/sauvegarde';
import { type Sim, format, wrapWorld } from './simulation/contexte';
import { createWorld, type PlayerInfo } from './simulation/monde';
import type { Robot } from './simulation/robot';

/** Actions du manifeste (`duo-game.json`). */
export type GameAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'act'
  | 'examine'
  | 'notebook'
  | 'back'
  | 'confirm'
  | 'camera-left'
  | 'camera-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'tool-next'
  | 'tool-previous'
  | 'rotate'
  | `slot-${number}`;

export interface SessionOptions {
  duo: DuoContext<GameAction>;
  content: Content;
  map: GameMap;
  /** Robot de test: il joue le personnage de cette machine. */
  robot?: Robot | null;
  /** Horloge en millisecondes (interpolation chez l'invité). */
  now: () => number;
}

export interface Session {
  readonly view: GameView;
  /** Pas de simulation (boucle du SDK), avec les commandes du joueur local. */
  step(frame: ControlFrame): void;
  /** Avant chaque image: prépare l'état à afficher. */
  beforeFrame(alpha: number): void;
  /** L'état est là (toujours vrai chez l'hôte). */
  ready(): boolean;
  /** Monde de l'hôte (tests et outils), `null` chez l'invité. */
  hostSim(): Sim | null;
  /** La séance est finie (fin de la démo ou « Finir la séance » des deux). */
  onFinished(listener: () => void): () => void;
  dispose(): void;
}

const STAT_SEPARATOR = ': ';
const STAT_LABEL_MAX = 32;
const STAT_VALUE_MAX = 16;

function playerInfos(duo: DuoContext<GameAction>): [PlayerInfo, PlayerInfo] {
  const info = (p: DuoContext<GameAction>['host']): PlayerInfo => ({ id: p.id, name: p.name, color: p.colorHex });
  return [info(duo.host), info(duo.guest)];
}

/** Les trois chiffres de l'écran de fin (`textes.endScreen.stats`), pour l'historique. */
function endStats(sim: Sim): { label: string; value: string }[] {
  const raw = sim.content.texts.raw.endScreen;
  const stats = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).stats : undefined;
  if (typeof stats !== 'object' || stats === null) return [];
  const w = sim.world;
  const ending = w.ending;
  const vars = {
    days: ending?.days ?? w.clock.day - w.session.firstDay + 1,
    linesDone: ending?.linesDone ?? w.orderResult?.linesDone ?? 0,
    linesTotal: ending?.linesTotal ?? sim.content.settings.order.lines.length,
    furniture: ending?.furniturePlaced ?? w.furniture.filter((f) => f.placedBy !== null).length,
  };
  const out: { label: string; value: string }[] = [];
  for (const template of Object.values(stats as Record<string, unknown>)) {
    if (typeof template !== 'string') continue;
    const [label, value] = format(template, vars).split(STAT_SEPARATOR);
    if (label === undefined || value === undefined) continue;
    out.push({ label: label.slice(0, STAT_LABEL_MAX), value: value.slice(0, STAT_VALUE_MAX) });
  }
  return out.slice(0, 3);
}

function toSaveSnapshot(sim: Sim): SaveSnapshot {
  const snap = snapshotOf(sim);
  return { label: snap.label, progress: snap.progress, dataSchema: snap.dataSchema, data: snap.data };
}

export function createSession(options: SessionOptions): Session {
  const { duo, content, map } = options;
  const listeners = new Set<(event: WorldEvent) => void>();
  const finished = new Set<() => void>();
  let alpha = 1;
  let ended = false;
  const emit = (events: readonly WorldEvent[]): void => {
    for (const e of events) for (const l of listeners) l(e);
  };

  let host: Host | null = null;
  let guest: Guest | null = null;
  let sim: Sim | null = null;
  let guestWorld: WorldState | null = null;
  let local: CharacterId = 'p1';
  const robotSim = (): Sim | null => {
    if (sim !== null) return sim;
    return guestWorld === null ? null : wrapWorld(content, map, guestWorld);
  };

  const finish = (): void => {
    if (ended) return;
    ended = true;
    for (const f of finished) f();
  };

  if (duo.role === 'host') {
    const players = playerInfos(duo);
    const loaded = duo.saves.loaded;
    let world: Sim | null = null;
    if (loaded !== null) {
      try {
        world = restoreWorld(content, map, decodeSave(loaded.data), loaded.dataSchema, players);
      } catch (error) {
        duo.log.error('sauvegarde illisible: nouvelle partie', { message: error instanceof Error ? error.message : String(error) });
      }
    }
    const hostSim = world ?? createWorld(content, map, duo.seed, players);
    sim = hostSim;
    local = hostSim.world.characters.find((c) => c.playerId === duo.localPlayer.id)?.id ?? 'p1';
    const remote: CharacterId = local === 'p1' ? 'p2' : 'p1';
    const h = createHost(hostSim, openHostChannels(duo.net), local, remote);
    host = h;
    duo.saves.provide(() => toSaveSnapshot(hostSim));
    const results = duo.results;
    const saves = duo.saves;
    const writeNow = (): Promise<void> =>
      saves.write('manual', toSaveSnapshot(hostSim)).then(
        (status) => {
          if (status !== 'ok') duo.log.warn('sauvegarde non écrite', { status });
        },
        (error: unknown) => {
          duo.log.error('sauvegarde en échec', { message: error instanceof Error ? error.message : String(error) });
        },
      );
    const endSession = (): void => {
      void writeNow().then(() => {
        results.endSession({ progress: progressOf(hostSim), stats: endStats(hostSim) });
        finish();
      });
    };
    listeners.add((event) => {
      if (event.type === 'save_point') void writeNow();
      if (event.type === 'session_finish' || event.type === 'demo_ended') endSession();
    });
    h.sendWorld();
  } else {
    const g = createGuest(content, map, openGuestChannels(duo.net), duo.localPlayer.id, options.now);
    guest = g;
    g.onEvent((event) => {
      emit([event]);
    });
  }

  const view: GameView = {
    content,
    map,
    role: duo.role,
    localCharacter() {
      return guest === null ? local : guest.localCharacter();
    },
    world(): ReadonlyWorld {
      const w = sim?.world ?? guestWorld;
      if (w === null) throw new Error('état pas encore reçu');
      return w;
    },
    alpha() {
      return guest === null ? alpha : 1;
    },
    send(intent: Intent) {
      if (host !== null) host.queueLocal(intent);
      else guest?.queueIntent(intent);
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    keyLabel(code) {
      return duo.input.keyLabel(code);
    },
  };

  function robotDecision(frame: ControlFrame): ControlFrame {
    const robot = options.robot;
    const s = robot === undefined || robot === null ? null : robotSim();
    if (robot === undefined || robot === null || s === null) return frame;
    const id = view.localCharacter();
    const decision = robot.decide(s);
    for (const a of decision.intents) if (a.by === id) view.send(a.intent);
    const mine = decision.controls[id];
    return mine === undefined ? frame : { ...mine, seq: frame.seq };
  }

  return {
    view,
    step(frame) {
      const f = robotDecision(frame);
      if (host !== null) emit(host.step(f));
      else guest?.step(f);
    },
    beforeFrame(loopAlpha) {
      alpha = loopAlpha;
      if (guest !== null) guestWorld = guest.render(options.now());
    },
    ready() {
      if (guest === null) return true;
      if (guestWorld === null) guestWorld = guest.render(options.now());
      return guestWorld !== null;
    },
    hostSim() {
      return sim;
    },
    onFinished(listener) {
      finished.add(listener);
      return () => {
        finished.delete(listener);
      };
    },
    dispose() {
      host?.dispose();
      guest?.dispose();
      listeners.clear();
      finished.clear();
    },
  };
}
