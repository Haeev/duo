/**
 * Banc des coupures de liaison en pleine activité: l'hôte et l'invité du jeu (vrai pas de
 * simulation) reliés par un fil qui se comporte comme la liaison de Duo (`packages/liaison`,
 * `docs/plateforme/reseau.md` 8.3 et 10.3):
 *
 * - pendant la coupure, rien n'arrive; les messages fiables attendent dans l'ordre, et d'un canal
 *   `latest` seul le dernier est gardé;
 * - la plateforme ne déclare la perte qu'après 2 s de silence: jusque-là les deux jeux continuent,
 *   chacun de son côté (`GAP_STEPS`), puis la pause arrête les pas des deux;
 * - au retour du lien, ce qui attendait est remis; puis la reprise est donnée aux deux jeux.
 */
import type { Net, NetChannel } from '@duo/sdk';
import * as v from 'valibot';
import { expect } from 'vitest';
import type { Content } from '../src/donnees/charger';
import { WorldSchema, type WorldState } from '../src/etat/monde';
import { createGuest, type Guest } from '../src/reseau/invite';
import { createHost, type Host } from '../src/reseau/hote';
import { SIM_HZ } from '../src/simulation/noyau/constantes';
import { idleInput, type Intent, type StepInput } from '../src/simulation/noyau/entrees';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import { step, type Sim } from '../src/simulation/noyau/pas';
import { MEMBERS } from './aides';
import { memoryLog } from './aides-reseau';

/** Pas joués par chaque machine entre la coupure et la pause (2 s de silence, `reseau.md` 8.1). */
export const GAP_STEPS = 2 * SIM_HZ;
/** Durée de la pause sur l'heure de session, qui ne s'arrête pas (ms). */
export const PAUSE_MS = 20_000;

interface Queued {
  readonly to: 'host' | 'guest';
  readonly channel: number;
  readonly json: string;
}

export interface LiaisonLink {
  readonly host: Net;
  readonly guest: Net;
  /** Remet ce qui attend, dans l'ordre d'envoi (rien pendant une coupure). */
  deliver(): void;
  cut(): void;
  restore(): void;
  /** Reprise logique impossible (tampon débordé, jeu relancé): ce qui attendait est perdu. */
  drop(): void;
  /** Oublie les écouteurs d'une machine (son jeu est relancé). */
  forget(role: 'host' | 'guest'): void;
}

export function createLiaisonLink(now: () => number): LiaisonLink {
  let queue: Queued[] = [];
  let down = false;
  const listeners = new Map<string, Set<(json: string) => void>>();

  function side(role: 'host' | 'guest'): Net {
    const to = role === 'host' ? 'guest' : 'host';
    return {
      role,
      sessionTimeMs: now,
      quality: () => ({ rttMs: 2, jitterMs: 0, state: 'good' }),
      channel<TSchema extends v.GenericSchema>(
        id: number,
        options: { mode: 'reliable' | 'latest'; schema: TSchema },
      ): NetChannel<v.InferOutput<TSchema>> {
        const key = `${role}:${String(id)}`;
        const mine = listeners.get(key) ?? new Set<(json: string) => void>();
        listeners.set(key, mine);
        return {
          id,
          send(message) {
            // Un ancien instantané n'a plus de valeur: seul le dernier du canal attend.
            if (options.mode === 'latest')
              queue = queue.filter((m) => !(m.to === to && m.channel === id));
            queue.push({ to, channel: id, json: JSON.stringify(message) });
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
    deliver() {
      if (down) return;
      // Un écouteur peut répondre pendant la remise: on vide jusqu'au bout.
      while (queue.length > 0) {
        const batch = queue;
        queue = [];
        for (const message of batch)
          for (const listener of listeners.get(`${message.to}:${String(message.channel)}`) ?? [])
            listener(message.json);
      }
    },
    cut() {
      down = true;
    },
    restore() {
      down = false;
    },
    drop() {
      queue = [];
    },
    forget(role) {
      for (const [key, set] of listeners) if (key.startsWith(`${role}:`)) set.clear();
    },
  };
}

/** Ce que font les deux joueurs pendant un pas. */
export interface Turn {
  readonly host?: readonly Intent[];
  readonly guest?: readonly Intent[];
  readonly hostInput?: Partial<StepInput>;
  readonly guestInput?: Partial<StepInput>;
}

/**
 * Ordre des signaux de reprise: l'hôte renvoie tout à sa reprise; chez l'invité, le signal peut
 * tomber avant ou après l'arrivée de cet envoi (deux machines, deux files).
 */
export type ResumeOrder = 'guest-first' | 'guest-last';

export interface CutBench {
  readonly sim: Sim;
  readonly host: Host;
  guest(): Guest;
  readonly link: LiaisonLink;
  /** Heure de session commune (ms): elle avance d'un pas à chaque pas, et pendant les pauses. */
  now(): number;
  /** Les deux jeux sont en pause (plus aucun pas). */
  paused(): boolean;
  /** Événements nés chez l'hôte, et ceux que la machine de l'invité a vus, depuis le départ. */
  readonly hostEvents: GameEvent[];
  readonly guestEvents: GameEvent[];
  /** Écoute des événements de chaque machine (interface locale d'un mini-jeu). */
  onHostEvent(listener: (event: GameEvent) => void): void;
  onGuestEvent(listener: (event: GameEvent) => void): void;
  errors(): readonly string[];
  /** Un pas des deux machines. */
  step(turn?: Turn): void;
  run(steps: number, turn?: (index: number) => Turn): void;
  /** Joue jusqu'à `done` (ou `seconds`); rend vrai si c'est arrivé. */
  until(done: () => boolean, turn?: () => Turn, seconds?: number): boolean;
  /**
   * La liaison tombe: chacun joue encore `GAP_STEPS` pas sans l'autre (`during`: ce qu'ils font),
   * puis la plateforme met les deux jeux en pause.
   */
  cut(during?: (index: number) => Turn): void;
  /** Pause demandée par un joueur (Échap), liaison intacte. */
  pause(): void;
  /** Le lien revient (ou la pause finit) et la plateforme donne la reprise aux deux jeux. */
  back(order?: ResumeOrder): void;
  /** Le jeu de l'invité est relancé pendant la pause: instance neuve, rien de ce qui attendait. */
  relaunchGuest(): void;
  /** Laisse partir les tranches lentes sur un monde figé, puis compare les deux états. */
  expectSameState(): WorldState;
}

const centi = (value: number): number => Math.round(value * 100) / 100;

/** Ce que les deux machines doivent avoir en commun (habitants au centième, lieu courant seul). */
function sharedView(world: WorldState): unknown {
  const copy = v.parse(WorldSchema, JSON.parse(JSON.stringify(world)));
  const place = copy.places[copy.common.place];
  if (place === undefined) throw new Error('lieu courant sans état');
  for (const villager of Object.values(place.villagers)) {
    const { body } = villager;
    villager.body = {
      x: centi(body.x),
      y: centi(body.y),
      facing: centi(body.facing),
      speed: centi(body.speed),
    };
  }
  // Le générateur ne sert qu'à l'hôte, seul à simuler.
  return { ...copy, rng: null, places: { [copy.common.place]: place } };
}

export function cutBench(sim: Sim, content: Content = sim.content): CutBench {
  const clock = { now: 0 };
  const link = createLiaisonLink(() => clock.now);
  const log = memoryLog();
  const state = { frozen: false, seq: 0, paused: false };
  const hostEvents: GameEvent[] = [];
  const guestEvents: GameEvent[] = [];
  const hostListeners: ((event: GameEvent) => void)[] = [];
  const guestListeners: ((event: GameEvent) => void)[] = [];
  const host = createHost(sim, link.host, log, 0, {
    advance(s, inputs, intents) {
      if (!state.frozen) step(s, inputs, intents);
      else {
        s.world.tick += 1;
        s.events.length = 0;
      }
    },
  });
  const join = (): Guest => {
    const guest = createGuest(content, link.guest, MEMBERS[1].id, { now: () => clock.now });
    guest.onEvent((event) => {
      guestEvents.push(event);
      for (const listener of guestListeners) listener(event);
    });
    return guest;
  };
  let guest = join();

  function fromHost(events: readonly GameEvent[]): void {
    for (const event of [...events]) {
      hostEvents.push(event);
      for (const listener of hostListeners) listener(event);
    }
  }

  const bench: CutBench = {
    sim,
    host,
    guest: () => guest,
    link,
    now: () => clock.now,
    paused: () => state.paused,
    hostEvents,
    guestEvents,
    onHostEvent(listener) {
      hostListeners.push(listener);
    },
    onGuestEvent(listener) {
      guestListeners.push(listener);
    },
    errors: () => log.entries.filter((e) => e.level === 'error').map((e) => e.message),
    step(turn = {}) {
      if (state.paused) throw new Error('pas demandé pendant la pause');
      clock.now += 1000 / SIM_HZ;
      for (const intent of turn.guest ?? []) guest.queueIntent(intent);
      for (const intent of turn.host ?? []) host.queueLocal(intent);
      guest.step({ ...idleInput((state.seq += 1)), ...turn.guestInput });
      link.deliver();
      fromHost(host.step({ ...idleInput(sim.world.tick), ...turn.hostInput }));
      link.deliver();
    },
    run(steps, turn) {
      for (let i = 0; i < steps; i++) bench.step(turn?.(i));
    },
    until(done, turn, seconds = 90) {
      for (let i = 0; i < seconds * SIM_HZ && !done(); i++) bench.step(turn?.());
      return done();
    },
    cut(during) {
      link.cut();
      bench.run(GAP_STEPS, during);
      state.paused = true;
      fromHost(host.pause('disconnect'));
      guest.pause('disconnect');
    },
    pause() {
      state.paused = true;
      fromHost(host.pause('request'));
      guest.pause('request');
      link.deliver();
    },
    back(order = 'guest-first') {
      clock.now += PAUSE_MS;
      link.restore();
      link.deliver();
      if (order === 'guest-first') guest.resume();
      host.resume();
      link.deliver();
      if (order === 'guest-last') guest.resume();
      state.paused = false;
    },
    relaunchGuest() {
      link.drop();
      link.forget('guest');
      guest.dispose();
      guest = join();
    },
    expectSameState() {
      state.frozen = true;
      bench.run(20);
      state.frozen = false;
      const seen = guest.world();
      if (seen === null) throw new Error('l’invité n’a pas d’état complet');
      expect(sharedView(seen)).toEqual(sharedView(sim.world));
      return seen;
    },
  };
  host.sendAll();
  bench.run(3);
  return bench;
}
