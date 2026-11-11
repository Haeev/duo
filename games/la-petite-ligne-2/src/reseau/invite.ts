/**
 * L'invité (ADR 0007, 0019, 0020): il envoie ses commandes et ses intentions, tient une copie de
 * l'état nourrie par les tranches de l'hôte, affiche les autres avec un coussin de gigue, et
 * prédit son propre déplacement et le début de ses gestes pour répondre au pas même de l'appui.
 *
 * Deux vues de l'état: `world()`, la dernière connue de l'hôte (tests, logique), et
 * `render(now, alpha)`, celle à afficher (autres interpolés, soi-même prédit, geste prédit).
 */
import type { Net } from '@duo/sdk';
import type { Content } from '../donnees/charger';
import type { PlayerIndex } from '../donnees/schemas/communs';
import type { PlayerSlow } from '../etat/joueur';
import type { PlaceSlow, PlaceState } from '../etat/lieu';
import { DATA_SCHEMA, type WorldState } from '../etat/monde';
import type { Intent, StepInput } from '../simulation/noyau/entrees';
import type { GameEvent } from '../simulation/noyau/evenements';
import {
  CHANNEL,
  EventsSchema,
  FastSchema,
  GuestInputSchema,
  SLICE_SCHEMAS,
  type FastMessage,
  type SliceMessage,
} from './canaux';
import { createSnapshotBuffer, lerpMover, type Mover } from './interpolation';
import {
  createWalkPrediction,
  NO_PREDICTION,
  type PredictedGesture,
  type Predictor,
} from './prediction';
import { createPlaceAssembler, PLACE_PART_CHANNEL, PlacePartSchema } from './etat-lieu';
import { createProgressAssembler, PROGRESS_PART_CHANNEL, ProgressPartSchema } from './progression';
import { NET_SETTINGS, type NetSettings } from './reglages';

/** Où en est le lieu chez l'invité: le jeu montre l'attente pendant `switching`. */
export type PlaceStatus =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'settled'; readonly place: string }
  | { readonly kind: 'switching'; readonly from: string; readonly to: string };

export interface GuestStats {
  /** Coussin de gigue courant, en pas. */
  readonly delayTicks: number;
  /** Commandes envoyées et pas encore accusées par l'hôte. */
  readonly unacked: number;
  /** Dernier pas de l'hôte reçu. */
  readonly hostTick: number;
}

export interface Guest {
  /** Toutes les tranches et un instantané rapide sont arrivés au moins une fois. */
  ready(): boolean;
  /** Le dernier état connu de l'hôte, `null` tant qu'il n'est pas complet. */
  world(): WorldState | null;
  /**
   * L'état à afficher à l'heure locale `nowMs` (même horloge que l'option `now`): autres joueur
   * et habitants interpolés derrière le coussin, soi-même prédit entre ses deux derniers pas
   * (`alpha` de la boucle), geste prédit. Objet neuf, à ne pas garder d'une image à l'autre.
   */
  render(nowMs: number, alpha: number): WorldState | null;
  /** Personnage de cette machine, d'après l'identifiant de membre; `null` avant le premier état. */
  localIndex(): PlayerIndex | null;
  /** Intention du joueur: part au prochain pas; un début de geste est joué tout de suite. */
  queueIntent(intent: Intent): void;
  /** Un pas local: envoie la commande et les intentions en attente, prédit le déplacement. */
  step(input: StepInput): void;
  onEvent(listener: (event: GameEvent) => void): () => void;
  placeStatus(): PlaceStatus;
  /** Le lieu courant change: le jeu montre l'attente et charge le lieu (puis `place_loaded`). */
  onPlaceSwitch(listener: (change: { from: string; to: string }) => void): () => void;
  /** Reprise de la liaison (`resume` de la plateforme): oublie instantanés et prédiction. */
  resume(): void;
  stats(): GuestStats;
  dispose(): void;
}

export interface GuestOptions {
  /** Fonctions de prédiction de la simulation (lot L2). Sans elles, rien ne se prédit. */
  readonly predictor?: Predictor;
  /** Horloge locale en millisecondes (arrivée des instantanés), la même que celle de `render`. */
  readonly now?: () => number;
  readonly settings?: NetSettings;
}

function placeFrom(content: Content, id: string, slow: PlaceSlow, fast: FastMessage): PlaceState {
  const villagers: PlaceState['villagers'] = {};
  const order = content.places[id]?.villagers ?? [];
  order.forEach((def, index) => {
    const known = slow.villagers[def.id];
    const mover = fast.villagers[index];
    if (known === undefined || mover === undefined) return;
    villagers[def.id] = {
      ...known,
      body: { x: mover[0], y: mover[1], facing: mover[2], speed: mover[3] },
    };
  });
  return { ...slow, villagers };
}

function playerFrom(
  slow: PlayerSlow,
  fast: FastMessage,
  index: PlayerIndex,
): WorldState['players'][number] {
  const mover = fast.players[index];
  const gauges = fast.needs[index];
  return {
    ...slow,
    body: { x: mover[0], y: mover[1], facing: mover[2], speed: mover[3] },
    needs: { hunger: gauges[0], sleep: gauges[1], hygiene: gauges[2] },
    stamina: fast.stamina[index],
  };
}

interface PendingGesture {
  readonly gesture: PredictedGesture;
  /** Commande qui porte l'intention (`null`: pas encore partie). */
  seq: number | null;
  /** Pas de l'hôte estimé au début du geste. */
  readonly startTick: number;
  /** Pas de l'hôte de la confirmation (`gesture_started`), `null` avant. */
  confirmed: number | null;
  /** Pas locaux depuis l'appui (abandon sans réponse). */
  age: number;
}

export function createGuest(
  content: Content,
  net: Net,
  member: string,
  options: GuestOptions = {},
): Guest {
  const settings = options.settings ?? NET_SETTINGS;
  const predictor = options.predictor ?? NO_PREDICTION;
  const now = options.now ?? ((): number => performance.now());
  const input = net.channel(CHANNEL.guestInput, { mode: 'reliable', schema: GuestInputSchema });
  const listeners = new Set<(event: GameEvent) => void>();
  const switchListeners = new Set<(change: { from: string; to: string }) => void>();
  const intents: Intent[] = [];
  const snapshots = createSnapshotBuffer(settings.interpolation);
  const progress = createProgressAssembler();
  const placeParts = createPlaceAssembler();
  let common: SliceMessage<'common'> | null = null;
  let players: SliceMessage<'players'> | null = null;
  let place: SliceMessage<'place'> | null = null;
  let fast: FastMessage | null = null;
  /** Copie assemblée, refaite seulement quand un message est arrivé depuis. */
  let assembled: WorldState | null = null;
  let stale = true;
  let status: PlaceStatus = { kind: 'waiting' };
  /** Premier pas de l'hôte dans le lieu courant: un instantané plus ancien décrit l'ancien lieu. */
  let placeSince = 0;
  let hostTick = 0;
  /** Pas locaux depuis le dernier instantané (estimation du pas courant de l'hôte). */
  let stepsSinceFast = 0;
  let gesture: PendingGesture | null = null;
  let lastRender: number | null = null;
  let me: PlayerIndex | null = null;

  const walk = createWalkPrediction(
    predictor,
    () => me,
    settings.prediction,
    settings.input.moveDeadzone,
  );

  function emit(event: GameEvent): void {
    for (const listener of listeners) listener(event);
  }

  function onCommon(message: SliceMessage<'common'>): void {
    const before = common?.common.place ?? null;
    common = message;
    stale = true;
    const to = message.common.place;
    if (before === null || before === to) return;
    // Bascule: rien de l'ancien lieu ne s'applique au nouveau (instantanés, prédiction, geste).
    placeSince = message.tick;
    snapshots.clear();
    walk.reset();
    gesture = null;
    status = { kind: 'switching', from: before, to };
    for (const listener of switchListeners) listener({ from: before, to });
  }

  function onFast(message: FastMessage): void {
    if (message.tick < placeSince) return;
    // Positions d'un autre lieu que le lieu connu (voyage en cours): elles n'ont rien à faire ici.
    if (common !== null && message.place !== common.common.place) return;
    if (fast !== null && message.tick <= fast.tick) return;
    fast = message;
    stale = true;
    hostTick = message.tick;
    stepsSinceFast = 0;
    snapshots.push(message, now());
    const w = world();
    if (me === null || w === null) return;
    walk.reconcile(withGesture(w), w.players[me].body, message.ack);
    // L'hôte a joué la commande de l'intention sans confirmer le geste: il ne viendra pas.
    if (gesture !== null && gesture.confirmed === null && gesture.seq !== null)
      if (message.ack >= gesture.seq) gesture = null;
  }

  function onEvents(message: { tick: number; events: readonly GameEvent[] }): void {
    for (const event of message.events) {
      if (gesture !== null && 'player' in event && event.player === me) {
        if (event.type === 'gesture_started' && gesture.confirmed === null) {
          // Déjà joué par prédiction: on ne le rejoue pas.
          gesture.confirmed = message.tick;
          continue;
        }
        // Refus: le geste prédit s'arrête, le refus se joue.
        if (event.type === 'refused') gesture = null;
      }
      emit(event);
    }
  }

  const subscriptions = [
    // Le rapide s'abonne avant les tranches: un instantané reçu avant les écouteurs passe d'abord.
    net.channel(CHANNEL.fast, { mode: 'latest', schema: FastSchema }).onMessage(onFast),
    net
      .channel(CHANNEL.common, { mode: 'latest', schema: SLICE_SCHEMAS.common })
      .onMessage(onCommon),
    net
      .channel(CHANNEL.players, { mode: 'latest', schema: SLICE_SCHEMAS.players })
      .onMessage((message) => {
        players = message;
        stale = true;
        // L'état porte le geste confirmé: le geste prédit n'a plus à s'afficher.
        if (gesture !== null && gesture.confirmed !== null && message.tick >= gesture.confirmed)
          gesture = null;
      }),
    net
      .channel(PROGRESS_PART_CHANNEL, { mode: 'reliable', schema: ProgressPartSchema })
      .onMessage((message) => {
        if (progress.receive(message) !== null) stale = true;
      }),
    net
      .channel(PLACE_PART_CHANNEL, { mode: 'reliable', schema: PlacePartSchema })
      .onMessage((message) => {
        const done = placeParts.receive(message);
        if (done === null) return;
        place = { tick: done.tick, id: done.target, place: done.state };
        stale = true;
      }),
    net.channel(CHANNEL.events, { mode: 'reliable', schema: EventsSchema }).onMessage(onEvents),
  ];

  function assemble(): WorldState | null {
    const known = progress.current();
    if (common === null || players === null || known === null || place === null || fast === null)
      return null;
    // Pendant une bascule, on garde l'ancien état entier tant que le nouveau lieu n'est pas complet.
    if (place.id !== common.common.place || fast.place !== place.id || fast.tick < placeSince)
      return assembled;
    if (status.kind !== 'settled' || status.place !== place.id)
      status = { kind: 'settled', place: place.id };
    return {
      schema: DATA_SCHEMA,
      tick: fast.tick,
      // La graine de la partie sert aux lectures communes (besoin du jour des boutiques); le
      // générateur, lui, ne sert qu'à l'hôte, seul à simuler.
      seed: common.seed,
      rng: [0, 0, 0, 0],
      minutes: fast.minutes,
      common: common.common,
      players: [playerFrom(players.players[0], fast, 0), playerFrom(players.players[1], fast, 1)],
      progress: known,
      places: { [place.id]: placeFrom(content, place.id, place.place, fast) },
    };
  }

  function world(): WorldState | null {
    if (stale) {
      assembled = assemble();
      stale = false;
      if (assembled !== null && me === null) me = assembled.players[0].member === member ? 0 : 1;
    }
    return assembled;
  }

  /** L'état connu, avec le geste prédit du joueur local (copie de surface si besoin). */
  function withGesture(w: WorldState): WorldState {
    if (gesture === null || me === null) return w;
    const mine = w.players[me];
    if (mine.gesture !== null && gesture.confirmed !== null) return w;
    const shown = {
      ...mine,
      gesture: {
        clip: gesture.gesture.clip,
        target: gesture.gesture.target,
        until: gesture.startTick + gesture.gesture.ticks,
        long: gesture.gesture.long,
      },
    };
    const both: WorldState['players'] = me === 0 ? [shown, w.players[1]] : [w.players[0], shown];
    return { ...w, players: both };
  }

  function moverOf(target: { x: number; y: number; facing: number; speed: number }): Mover {
    return { x: target.x, y: target.y, facing: target.facing, speed: target.speed };
  }

  return {
    ready() {
      return world() !== null;
    },
    world,
    render(nowMs, alpha) {
      const w = world();
      if (w === null) return null;
      const dt = lastRender === null ? 0 : Math.max(0, (nowMs - lastRender) / 1000);
      lastRender = nowMs;
      const shown = withGesture(w);
      const sample = snapshots.sample(nowMs);
      const bodies = [moverOf(shown.players[0].body), moverOf(shown.players[1].body)] as const;
      const id = shown.common.place;
      const current = shown.places[id];
      let villagers = current?.villagers;
      let minutes = shown.minutes;
      if (sample !== null) {
        const { a, b, t } = sample;
        lerpMover(a.players[0], b.players[0], t, bodies[0]);
        lerpMover(a.players[1], b.players[1], t, bodies[1]);
        minutes = a.minutes + (b.minutes - a.minutes) * t;
        if (Math.abs(b.minutes - a.minutes) > 720) minutes = b.minutes;
        if (current !== undefined) {
          const moved: PlaceState['villagers'] = {};
          const order = content.places[id]?.villagers ?? [];
          order.forEach((def, index) => {
            const known = current.villagers[def.id];
            const pa = a.villagers[index];
            const pb = b.villagers[index];
            if (known === undefined) return;
            const body = moverOf(known.body);
            if (pa !== undefined && pb !== undefined) lerpMover(pa, pb, t, body);
            moved[def.id] = { ...known, body };
          });
          villagers = moved;
        }
      }
      if (me !== null) walk.render(dt, alpha, bodies[me]);
      return {
        ...shown,
        minutes,
        players: [
          { ...shown.players[0], body: bodies[0] },
          { ...shown.players[1], body: bodies[1] },
        ],
        places:
          current === undefined || villagers === undefined
            ? shown.places
            : { [id]: { ...current, villagers } },
      };
    },
    localIndex() {
      world();
      return me;
    },
    queueIntent(intent) {
      intents.push(intent);
      const w = world();
      if (w === null || me === null || gesture !== null) return;
      const predicted = predictor.gesture(withGesture(w), me, intent);
      if (predicted === null) return;
      gesture = {
        gesture: predicted,
        seq: null,
        startTick: hostTick + stepsSinceFast,
        confirmed: null,
        age: 0,
      };
      // Réponse au pas même de l'appui: animation, son et rebond de la cible partent d'ici.
      emit({ type: 'gesture_started', player: me, clip: predicted.clip, target: predicted.target });
    },
    step(frame) {
      const sentIntents = intents.splice(0, 16);
      input.send({ inputs: [frame], intents: sentIntents });
      stepsSinceFast += 1;
      if (gesture !== null) {
        if (gesture.seq === null && sentIntents.length > 0) gesture.seq = frame.seq;
        gesture.age += 1;
        if (gesture.age > settings.prediction.gestureTimeoutTicks) gesture = null;
      }
      const w = world();
      if (w === null) return;
      walk.step(withGesture(w), frame);
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    placeStatus() {
      world();
      return status;
    },
    onPlaceSwitch(listener) {
      switchListeners.add(listener);
      return () => {
        switchListeners.delete(listener);
      };
    },
    resume() {
      snapshots.clear();
      walk.reset();
      progress.reset();
      placeParts.reset();
      gesture = null;
      lastRender = null;
    },
    stats() {
      return { delayTicks: snapshots.delayTicks(), unacked: walk.pending(), hostTick };
    },
    dispose() {
      for (const unsubscribe of subscriptions) unsubscribe();
      listeners.clear();
      switchListeners.clear();
    },
  };
}
