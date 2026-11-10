/**
 * L'invité: il envoie ses commandes et ses intentions, et tient une copie de l'état nourrie par
 * les tranches de l'hôte. Version du socle, sans interpolation ni prédiction: le lot L1 y reprend
 * celles de l'ancien jeu et ajoute la prédiction du début de geste (ADR 0020).
 */
import type { Net } from '@duo/sdk';
import type { Content } from '../donnees/charger';
import type { PlayerIndex } from '../donnees/schemas/communs';
import type { PlayerSlow } from '../etat/joueur';
import type { PlaceSlow, PlaceState } from '../etat/lieu';
import { DATA_SCHEMA, type WorldState } from '../etat/monde';
import type { Intent, StepInput } from '../simulation/noyau/entrees';
import type { GameEvent } from '../simulation/noyau/evenements';
import { CHANNEL, EventsSchema, FastSchema, GuestInputSchema, SLICE_SCHEMAS, type FastMessage, type SliceMessage } from './canaux';

export interface Guest {
  /** Toutes les tranches et un instantané rapide sont arrivés au moins une fois. */
  ready(): boolean;
  /** L'état connu de l'invité, `null` tant qu'il n'est pas complet. */
  world(): WorldState | null;
  /** Personnage de cette machine, d'après l'identifiant de membre; `null` avant le premier état. */
  localIndex(): PlayerIndex | null;
  queueIntent(intent: Intent): void;
  /** Un pas local: envoie la commande et les intentions en attente. */
  step(input: StepInput): void;
  onEvent(listener: (event: GameEvent) => void): () => void;
  dispose(): void;
}

function placeFrom(content: Content, id: string, slow: PlaceSlow, fast: FastMessage): PlaceState {
  const villagers: PlaceState['villagers'] = {};
  const order = content.places[id]?.villagers ?? [];
  order.forEach((def, index) => {
    const known = slow.villagers[def.id];
    const mover = fast.villagers[index];
    if (known === undefined || mover === undefined) return;
    villagers[def.id] = { ...known, body: { x: mover[0], y: mover[1], facing: mover[2], speed: mover[3] } };
  });
  return { leftOn: slow.leftOn, objects: slow.objects, ground: slow.ground, nextGroundId: slow.nextGroundId, villagers };
}

function playerFrom(slow: PlayerSlow, fast: FastMessage, index: PlayerIndex): WorldState['players'][number] {
  const mover = fast.players[index];
  const gauges = fast.needs[index];
  return {
    ...slow,
    body: { x: mover[0], y: mover[1], facing: mover[2], speed: mover[3] },
    needs: { hunger: gauges[0], sleep: gauges[1], hygiene: gauges[2] },
  };
}

export function createGuest(content: Content, net: Net, member: string): Guest {
  const input = net.channel(CHANNEL.guestInput, { mode: 'reliable', schema: GuestInputSchema });
  const listeners = new Set<(event: GameEvent) => void>();
  const intents: Intent[] = [];
  let common: SliceMessage<'common'> | null = null;
  let players: SliceMessage<'players'> | null = null;
  let progress: SliceMessage<'progress'> | null = null;
  let place: SliceMessage<'place'> | null = null;
  let fast: FastMessage | null = null;
  /** Copie assemblée, refaite seulement quand un message est arrivé depuis. */
  let assembled: WorldState | null = null;
  let stale = true;

  const subscriptions = [
    net.channel(CHANNEL.common, { mode: 'latest', schema: SLICE_SCHEMAS.common }).onMessage((message) => {
      common = message;
      stale = true;
    }),
    net.channel(CHANNEL.players, { mode: 'latest', schema: SLICE_SCHEMAS.players }).onMessage((message) => {
      players = message;
      stale = true;
    }),
    net.channel(CHANNEL.progress, { mode: 'latest', schema: SLICE_SCHEMAS.progress }).onMessage((message) => {
      progress = message;
      stale = true;
    }),
    net.channel(CHANNEL.place, { mode: 'latest', schema: SLICE_SCHEMAS.place }).onMessage((message) => {
      place = message;
      stale = true;
    }),
    net.channel(CHANNEL.fast, { mode: 'latest', schema: FastSchema }).onMessage((message) => {
      fast = message;
      stale = true;
    }),
    net.channel(CHANNEL.events, { mode: 'reliable', schema: EventsSchema }).onMessage((message) => {
      for (const event of message.events) for (const listener of listeners) listener(event);
    }),
  ];

  function assemble(): WorldState | null {
    if (common === null || players === null || progress === null || place === null || fast === null) return null;
    // Pendant un voyage, la tranche du lieu d'arrivée peut suivre de peu celle de « commun ».
    if (place.id !== common.common.place) return assembled;
    return {
      schema: DATA_SCHEMA,
      tick: fast.tick,
      // L'invité ne simule pas: ni graine ni générateur.
      seed: 0,
      rng: [0, 0, 0, 0],
      minutes: fast.minutes,
      common: common.common,
      players: [playerFrom(players.players[0], fast, 0), playerFrom(players.players[1], fast, 1)],
      progress: progress.progress,
      places: { [place.id]: placeFrom(content, place.id, place.place, fast) },
    };
  }

  function world(): WorldState | null {
    if (stale) {
      assembled = assemble();
      stale = false;
    }
    return assembled;
  }

  return {
    ready() {
      return world() !== null;
    },
    world,
    localIndex() {
      const w = world();
      if (w === null) return null;
      return w.players[0].member === member ? 0 : 1;
    },
    queueIntent(intent) {
      intents.push(intent);
    },
    step(frame) {
      input.send({ inputs: [frame], intents: intents.splice(0, 16) });
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      for (const unsubscribe of subscriptions) unsubscribe();
      listeners.clear();
    },
  };
}
