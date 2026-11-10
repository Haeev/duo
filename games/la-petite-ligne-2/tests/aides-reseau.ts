/**
 * Aides des tests du réseau (lot L1): lien virtuel sur horloge simulée (latence, gigue, pertes),
 * prédicteur factice et pas factice de l'hôte, en attendant la simulation du lot L2.
 */
import type { Logger, Net, NetChannel } from '@duo/sdk';
import { createRandom } from '@duo/sdk/sim';
import * as v from 'valibot';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import type { ReadonlyWorld } from '../src/etat/monde';
import type { Predictor } from '../src/reseau/prediction';
import { SIM_DT } from '../src/simulation/noyau/constantes';
import type { StepInput } from '../src/simulation/noyau/entrees';
import type { AuthoredIntent, Sim } from '../src/simulation/noyau/pas';

export interface Conditions {
  readonly latencyMs: number;
  readonly jitterMs: number;
  readonly lossPercent: number;
}

/** Réémission TCP après une perte (premier délai de Linux): le flux attend, dans l'ordre. */
const RETRANSMIT_MS = 200;

export interface VirtualLink {
  readonly host: Net;
  readonly guest: Net;
  /** Remet les messages arrivés à l'heure `nowMs`. */
  deliver(nowMs: number): void;
  /** Coupe ou rétablit le lien (les messages envoyés pendant la coupure sont perdus). */
  cut(down: boolean): void;
}

/**
 * Deux `Net` reliés: JSON et schéma à l'arrivée comme sur le fil, ordre gardé dans chaque sens
 * (une seule connexion pour tous les canaux), une perte retarde tout ce qui suit.
 */
export function createVirtualLink(
  conditions: Conditions,
  seed: number,
  now: () => number,
): VirtualLink {
  const random = createRandom(seed);
  const inFlight: { at: number; order: number; run: () => void }[] = [];
  const lastArrival = { toHost: 0, toGuest: 0 };
  let order = 0;
  let down = false;
  const listeners = new Map<string, Set<(json: string) => void>>();

  function schedule(direction: 'toHost' | 'toGuest', run: () => void): void {
    if (down) return;
    let delay = conditions.latencyMs + random.next() * conditions.jitterMs;
    if (random.next() * 100 < conditions.lossPercent) delay += RETRANSMIT_MS;
    const at = Math.max(now() + delay, lastArrival[direction]);
    lastArrival[direction] = at;
    inFlight.push({ at, order: (order += 1), run });
  }

  function side(role: 'host' | 'guest'): Net {
    const direction = role === 'host' ? 'toGuest' : 'toHost';
    const other = role === 'host' ? 'guest' : 'host';
    return {
      role,
      sessionTimeMs: now,
      quality: () => ({
        rttMs: conditions.latencyMs * 2,
        jitterMs: conditions.jitterMs,
        state: 'good',
      }),
      channel<TSchema extends v.GenericSchema>(
        id: number,
        options: { mode: 'reliable' | 'latest'; schema: TSchema },
      ): NetChannel<v.InferOutput<TSchema>> {
        const key = `${role}:${String(id)}`;
        const mine = new Set<(json: string) => void>();
        listeners.set(key, mine);
        return {
          id,
          send(message) {
            const json = JSON.stringify(message);
            schedule(direction, () => {
              for (const listener of listeners.get(`${other}:${String(id)}`) ?? []) listener(json);
            });
          },
          onMessage(listener) {
            const wrapped = (json: string): void => {
              const parsed = v.safeParse(options.schema, JSON.parse(json));
              if (!parsed.success) throw new Error(`message invalide sur le canal ${String(id)}`);
              listener(parsed.output);
            };
            mine.add(wrapped);
            return () => mine.delete(wrapped);
          },
        };
      },
    };
  }

  return {
    host: side('host'),
    guest: side('guest'),
    deliver(nowMs) {
      inFlight.sort((a, b) => a.at - b.at || a.order - b.order);
      while (inFlight.length > 0 && (inFlight[0]?.at ?? Number.POSITIVE_INFINITY) <= nowMs)
        inFlight.shift()?.run();
    },
    cut(value) {
      down = value;
      if (value) inFlight.length = 0;
    },
  };
}

/** Journal qui retient tout (un test vérifie qu'aucune erreur n'est journalisée). */
export function memoryLog(): Logger & { entries: { level: string; message: string }[] } {
  const entries: { level: string; message: string }[] = [];
  return {
    entries,
    info: (message) => entries.push({ level: 'info', message }),
    warn: (message) => entries.push({ level: 'warn', message }),
    error: (message) => entries.push({ level: 'error', message }),
  };
}

/** Vitesse de marche du pas factice (m/s) et mur à l'est (collision rejouée par la prédiction). */
export const WALK_SPEED = 1.5;
export const WALL_X = 1000;
export const GESTURE_TICKS = 30;

/** Le contrat que L2 remplira: ici une marche droite, un mur, un geste si la visée a une cible. */
export const FAKE_PREDICTOR: Predictor = {
  canWalk(world: ReadonlyWorld, player: PlayerIndex) {
    return world.common.phase === 'day' && world.players[player].gesture === null;
  },
  walk(_world, _player, body, input: StepInput) {
    const length = Math.hypot(input.moveX, input.moveY);
    if (length < 0.1) {
      body.speed = 0;
      return;
    }
    const x0 = body.x;
    const y0 = body.y;
    body.x = Math.min(WALL_X, body.x + (input.moveX / length) * WALK_SPEED * SIM_DT);
    body.y += (input.moveY / length) * WALK_SPEED * SIM_DT;
    body.facing = Math.atan2(input.moveY, input.moveX);
    body.speed = Math.hypot(body.x - x0, body.y - y0) / SIM_DT;
  },
  gesture(world, player, intent) {
    if (intent.type !== 'act') return null;
    const aim = world.players[player].aim;
    if (aim === null) return null;
    return { clip: 'reach', target: aim, ticks: GESTURE_TICKS, long: false };
  },
};

/** Pas factice de l'hôte: la marche et le geste du prédicteur factice, sans le noyau. */
export function fakeAdvance(
  sim: Sim,
  inputs: readonly [StepInput, StepInput],
  intents: readonly AuthoredIntent[],
): void {
  // Le pas factice remplace tout le noyau (L2: le vrai noyau marche et vise lui-même, il fausserait
  // la marche et la cible factices de ce banc): seuls le compteur de pas et les événements avancent.
  const { world } = sim;
  world.tick += 1;
  sim.events.length = 0;
  for (const { player, intent } of intents) {
    if (intent.type !== 'act') continue;
    const p = world.players[player];
    const predicted = FAKE_PREDICTOR.gesture(world, player, intent);
    if (predicted === null || p.gesture !== null) {
      sim.events.push({ type: 'refused', player, reason: 'rien-a-faire', target: p.aim });
      continue;
    }
    p.gesture = {
      clip: predicted.clip,
      target: predicted.target,
      until: world.tick + predicted.ticks,
      long: false,
    };
    sim.revisions.players += 1;
    sim.events.push({ type: 'gesture_started', player, clip: predicted.clip, target: p.aim });
  }
  for (const player of [0, 1] as const) {
    const p = world.players[player];
    if (p.gesture !== null && world.tick >= p.gesture.until) {
      p.gesture = null;
      sim.revisions.players += 1;
    }
    if (FAKE_PREDICTOR.canWalk(world, player))
      FAKE_PREDICTOR.walk(world, player, p.body, inputs[player]);
  }
}
