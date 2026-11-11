/**
 * L'hôte fait autorité (ADR 0007): il simule, applique les intentions des deux joueurs dans leur
 * ordre d'arrivée et envoie à l'invité, à chaque pas, les événements, le canal rapide et les
 * tranches qui ont changé (« joueurs » au pas même, « lieu » et « progression » à leur cadence).
 * La file des commandes de l'invité (coussin, rattrapage, commande devinée) est dans
 * `file-commandes.ts`; la progression (canal 8, `progression.ts`) et l'état lent du lieu (canal 5,
 * `etat-lieu.ts`) partent par différences et par morceaux, par la même méthode (`par-cles.ts`).
 */
import type { Logger, Net, NetChannel, PauseReason } from '@duo/sdk';
import type { PlayerIndex } from '../donnees/schemas/communs';
import type { PlaceSlow } from '../etat/lieu';
import { SLICES, type Slice } from '../etat/monde';
import type { Intent, StepInput } from '../simulation/noyau/entrees';
import type { GameEvent } from '../simulation/noyau/evenements';
import { interruptForPause, step, type AuthoredIntent, type Sim } from '../simulation/noyau/pas';
import {
  BUDGET_BYTES,
  CHANNEL,
  EventsSchema,
  FastSchema,
  GuestInputSchema,
  SLICE_EVERY_TICKS,
  SLICE_KEEPALIVE_TICKS,
  SLICE_SCHEMAS,
  type SliceMessage,
} from './canaux';
import { createCommandQueue } from './file-commandes';
import {
  PROGRESS_PART_CHANNEL,
  PROGRESS_TARGET,
  ProgressPartSchema,
  progressDoc,
} from './progression';
import { PLACE_PART_CHANNEL, PlacePartSchema } from './etat-lieu';
import { cloneDoc, keyedParts } from './par-cles';
import { NET_SETTINGS, type NetSettings } from './reglages';
import { byteLength, fastMessage, sliceMessage } from './tranches';

/** Changement de lieu vu par une machine: le jeu montre l'attente, puis charge le lieu. */
export interface PlaceSwitch {
  readonly from: string;
  readonly to: string;
  /** Pas de l'hôte où le lieu courant a changé. */
  readonly tick: number;
}

export interface Host {
  /** Intention du joueur de cette machine (appliquée au prochain pas, à son rang d'arrivée). */
  queueLocal(intent: Intent): void;
  /** Un pas: commandes du joueur local, simulation, envois. Renvoie les événements du pas. */
  step(local: StepInput): readonly GameEvent[];
  /** Envoie tout l'état tout de suite (départ). */
  sendAll(): void;
  /**
   * Reprise de la liaison (événement `resume` de la plateforme): oublie les commandes en attente
   * de l'invité et renvoie tout, progression complète comprise.
   */
  resume(): void;
  /**
   * Pause de la plateforme (Échap, liaison perdue): chaque système annule ce qui ne peut pas
   * attendre (règle des coupures, `GameSystem.interrupt`). Renvoie les événements à jouer sur
   * cette machine: `session_paused`, puis ceux des annulations, qui partent aussi chez l'invité
   * (tout de suite, ou au retour de la liaison).
   */
  pause(reason: PauseReason): readonly GameEvent[];
  /** Le lieu courant vient de changer (au pas même, avant l'envoi de ses tranches). */
  onPlaceSwitch(listener: (change: PlaceSwitch) => void): () => void;
  /** Mesures: commandes de l'invité en attente, plus gros message de chaque canal depuis le départ. */
  stats(): HostStats;
  dispose(): void;
}

export interface HostStats {
  readonly queued: number;
  readonly ack: number;
  readonly largest: Readonly<Record<string, number>>;
}

export interface HostOptions {
  /**
   * Pas de simulation (par défaut celui du noyau). Les tests y branchent un pas factice; la
   * simulation y appelle aussi `Predictor.walk` pour les deux joueurs.
   */
  readonly advance?: (
    sim: Sim,
    inputs: readonly [StepInput, StepInput],
    intents: readonly AuthoredIntent[],
  ) => void;
  readonly settings?: NetSettings;
}

type SliceChannels = {
  readonly [S in Exclude<Slice, 'progress' | 'place'>]: NetChannel<SliceMessage<S>>;
};
type Budgeted = keyof typeof BUDGET_BYTES;

export function createHost(
  sim: Sim,
  net: Net,
  log: Logger,
  local: PlayerIndex,
  options: HostOptions = {},
): Host {
  const settings = options.settings ?? NET_SETTINGS;
  const advance = options.advance ?? step;
  const remote: PlayerIndex = local === 0 ? 1 : 0;
  const input = net.channel(CHANNEL.guestInput, { mode: 'reliable', schema: GuestInputSchema });
  const fast = net.channel(CHANNEL.fast, { mode: 'latest', schema: FastSchema });
  const events = net.channel(CHANNEL.events, { mode: 'reliable', schema: EventsSchema });
  const slices: SliceChannels = {
    common: net.channel(CHANNEL.common, { mode: 'latest', schema: SLICE_SCHEMAS.common }),
    players: net.channel(CHANNEL.players, { mode: 'latest', schema: SLICE_SCHEMAS.players }),
  };
  const placeChannel = net.channel(PLACE_PART_CHANNEL, {
    mode: 'reliable',
    schema: PlacePartSchema,
  });
  const progressChannel = net.channel(PROGRESS_PART_CHANNEL, {
    mode: 'reliable',
    schema: ProgressPartSchema,
  });
  const sent: Record<Slice, { revision: number; tick: number }> = {
    common: { revision: -1, tick: 0 },
    players: { revision: -1, tick: 0 },
    progress: { revision: -1, tick: 0 },
    place: { revision: -1, tick: 0 },
  };
  const pending: AuthoredIntent[] = [];
  const queue = createCommandQueue(settings.input);
  const switchListeners = new Set<(change: PlaceSwitch) => void>();
  const largest: Record<string, number> = {};
  /** Progression (à plat, `progressDoc`) telle que l'invité la connaît après la dernière révision envoyée. */
  let sentProgress: Record<string, unknown> | null = null;
  let progressRev = -1;
  let progressFullTick = 0;
  /** État du lieu tel que l'invité le connaît après la dernière révision envoyée, et son lieu. */
  let sentPlace: { readonly id: string; readonly state: PlaceSlow } | null = null;
  let placeRev = -1;
  let placeFullTick = 0;
  let place = sim.world.common.place;

  const unsubscribe = input.onMessage((message) => {
    queue.push(message.inputs);
    for (const intent of message.intents) pending.push({ player: remote, intent });
  });

  /**
   * Jamais d'exception pour une taille: un message hors budget est refusé et journalisé, la
   * partie continue (le SDK l'arrêterait des deux côtés au-delà de 64 Kio).
   */
  function fits(channel: Budgeted, message: unknown): boolean {
    const bytes = byteLength(message);
    const budget = BUDGET_BYTES[channel];
    largest[channel] = Math.max(largest[channel] ?? 0, bytes);
    if (bytes > budget) {
      log.error('message hors budget, non envoyé', { channel, bytes, budget });
      return false;
    }
    if (bytes > budget * settings.warnShare)
      log.warn('message proche de son budget', { channel, bytes, budget });
    return true;
  }

  /**
   * Progression: différence depuis la dernière révision, ou complète (`full`, premier envoi,
   * reprise, filet). Tous ses champs partent, sans liste écrite ici (`progression.ts`).
   */
  function sendProgress(full: boolean): void {
    const current = progressDoc(sim.world.progress);
    const base = full ? null : sentProgress;
    const head = {
      target: PROGRESS_TARGET,
      rev: progressRev + 1,
      baseRev: progressRev,
      tick: sim.world.tick,
    };
    const revision = keyedParts(base, current, head, settings.progress.partBytes);
    // Une différence vide n'a rien à dire; une révision complète part toujours (reprise, filet).
    if (revision.empty && !revision.full) return;
    for (const part of revision.parts)
      if (!fits('progressPart', part)) {
        // Un morceau refusé casserait la révision: la prochaine part complète.
        sentProgress = null;
        return;
      }
    for (const part of revision.parts) progressChannel.send(part);
    progressRev += 1;
    sentProgress = cloneDoc(current);
    if (revision.full) progressFullTick = sim.world.tick;
  }

  /**
   * État lent du lieu: différence depuis la dernière révision, ou complète (`full`, premier envoi,
   * reprise, changement de lieu). Seules les entités modifiées partent.
   */
  function sendPlace(full: boolean): void {
    const { id, place: current } = sliceMessage(sim.world, 'place');
    const base = full || sentPlace?.id !== id ? null : sentPlace.state;
    const head = { target: id, rev: placeRev + 1, baseRev: placeRev, tick: sim.world.tick };
    const revision = keyedParts(base, current, head, settings.place.partBytes);
    if (revision.empty && !revision.full) return;
    for (const part of revision.parts)
      if (!fits('placePart', part)) {
        // Un morceau refusé casserait la révision: la prochaine part complète.
        sentPlace = null;
        return;
      }
    for (const part of revision.parts) placeChannel.send(part);
    placeRev += 1;
    sentPlace = { id, state: cloneDoc(current) };
    if (revision.full) placeFullTick = sim.world.tick;
  }

  function sendSlice(slice: Slice, full = false): void {
    // Un cas par tranche: chaque canal garde le type exact de son message.
    switch (slice) {
      case 'common': {
        const message = sliceMessage(sim.world, 'common');
        if (fits(slice, message)) slices.common.send(message);
        break;
      }
      case 'players': {
        const message = sliceMessage(sim.world, 'players');
        if (fits(slice, message)) slices.players.send(message);
        break;
      }
      case 'progress':
        sendProgress(full || sentProgress === null);
        break;
      case 'place':
        sendPlace(full);
        break;
    }
    sent[slice] = { revision: sim.revisions[slice], tick: sim.world.tick };
  }

  /**
   * Le lieu et la progression, sur un canal fiable et ordonné, ne repartent complets qu'à leur
   * filet (toutes les 30 s): avant, la progression entière repartait toutes les 5 s sans raison.
   * « commun » et « joueurs » sont de petites tranches entières: leur filet est le rappel même.
   */
  function fullDue(slice: Slice, tick: number): boolean {
    if (slice === 'place') return tick - placeFullTick >= settings.place.fullEveryTicks;
    if (slice === 'progress') return tick - progressFullTick >= settings.progress.fullEveryTicks;
    return true;
  }

  function sendFast(): void {
    const message = fastMessage(sim.world, sim.content, queue.ack());
    if (fits('fast', message)) fast.send(message);
  }

  function sendAll(): void {
    sendFast();
    for (const slice of SLICES) sendSlice(slice, true);
  }

  return {
    queueLocal(intent) {
      pending.push({ player: local, intent });
    },
    step(localInput) {
      const guest = queue.next();
      const inputs: [StepInput, StepInput] =
        local === 0 ? [localInput, guest] : [guest, localInput];
      advance(sim, inputs, pending.splice(0, pending.length));
      const tick = sim.world.tick;
      if (sim.events.length > 0) {
        const message = { tick, events: [...sim.events] };
        if (fits('events', message)) events.send(message);
      }
      const now = sim.world.common.place;
      if (now !== place) {
        // Bascule: « commun » et « lieu » partent au pas même, le rapide ensuite. L'invité écarte
        // tout instantané rapide d'avant ce pas (il décrit l'ancien lieu).
        const change: PlaceSwitch = { from: place, to: now, tick };
        place = now;
        sendSlice('common');
        sendSlice('place');
        for (const listener of switchListeners) listener(change);
      }
      sendFast();
      for (const slice of SLICES) {
        const due = tick - sent[slice].tick;
        const changed = sim.revisions[slice] !== sent[slice].revision;
        if (due >= SLICE_KEEPALIVE_TICKS) sendSlice(slice, fullDue(slice, tick));
        else if (changed && due >= SLICE_EVERY_TICKS[slice]) sendSlice(slice);
      }
      return sim.events;
    },
    sendAll,
    resume() {
      queue.reset();
      sentProgress = null;
      sentPlace = null;
      sendAll();
    },
    pause(reason) {
      const born = interruptForPause(sim);
      if (born.length > 0) {
        const message = { tick: sim.world.tick, events: born };
        if (fits('events', message)) events.send(message);
      }
      return [{ type: 'session_paused', reason }, ...born];
    },
    onPlaceSwitch(listener) {
      switchListeners.add(listener);
      return () => {
        switchListeners.delete(listener);
      };
    },
    stats() {
      return { queued: queue.size(), ack: queue.ack(), largest: { ...largest } };
    },
    dispose() {
      unsubscribe();
      switchListeners.clear();
    },
  };
}
