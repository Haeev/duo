/** Création d'une partie neuve et de l'état d'un lieu à la première visite. */
import { createRandom } from '@duo/sdk/sim';
import type { Content, PlaceContent } from '../../donnees/charger';
import type { NeedState } from '../../donnees/schemas/besoins';
import type { NeedId } from '../../donnees/schemas/communs';
import { initialBrickStates } from '../../etat/briques';
import type { PlayerState } from '../../etat/joueur';
import type { PlaceState } from '../../etat/lieu';
import { DATA_SCHEMA, type WorldState } from '../../etat/monde';
import { CORE_TUNING } from './reglages-noyau';

/** Un joueur du duo, tel que la plateforme le donne. */
export interface Member {
  readonly id: string;
  readonly name: string;
}

/** Palier d'un besoin pour une valeur de jauge (le dernier palier dont le seuil est atteint). */
export function tierOf(content: Content, need: NeedId, value: number): NeedState {
  const def = content.needs.needs.find((n) => n.id === need);
  let state: NeedState = 'neutral';
  for (const tier of def?.tiers ?? []) if (value >= tier.from) state = tier.state;
  return state;
}

export function createPlaceState(content: Content, place: PlaceContent): PlaceState {
  const state: PlaceState = {
    leftOn: null,
    placed: [],
    nextPlacedId: 0,
    objects: {},
    ground: [],
    nextGroundId: 0,
    villagers: {},
  };
  for (const object of place.map.objects) {
    const prop = content.props[object.type];
    if (prop === undefined) throw new Error(`objet ${object.id}: meuble ${object.type} inconnu`);
    state.objects[object.id] = initialBrickStates(prop.bricks);
  }
  for (const villager of place.villagers) {
    const at = place.map.points[villager.stands];
    if (at === undefined)
      throw new Error(`habitant ${villager.id}: point ${villager.stands} absent`);
    // Face au sud, vers qui arrive.
    state.villagers[villager.id] = {
      met: [false, false],
      talkingWith: null,
      body: { x: at.x, y: at.y, facing: Math.PI / 2, speed: 0 },
    };
  }
  return state;
}

/**
 * Place les deux joueurs à la descente du train du lieu courant, côte à côte, face au sud (vers
 * le lieu, le dos à la voie).
 */
export function placeAtArrival(content: Content, world: WorldState): void {
  const place = content.places[world.common.place];
  const arrival = place?.map.points[place.def.station.arrival];
  if (arrival === undefined) throw new Error(`point d'arrivée absent: ${world.common.place}`);
  world.players.forEach((player, index) => {
    const side = index === 0 ? -1 : 1;
    player.body = {
      x: arrival.x + side * CORE_TUNING.arrivalSpread,
      y: arrival.y,
      facing: Math.PI / 2,
      speed: 0,
    };
  });
}

function createPlayer(content: Content, member: Member, x: number, y: number): PlayerState {
  const start = content.needs.start;
  return {
    member: member.id,
    name: member.name.slice(0, 40),
    look: null,
    gender: null,
    money: content.settings.start.money,
    toolbar: Array.from({ length: content.bags.toolbarSlots }, () => null),
    bag: null,
    selected: null,
    tiers: {
      hunger: tierOf(content, 'hunger', start),
      sleep: tierOf(content, 'sleep', start),
      hygiene: tierOf(content, 'hygiene', start),
    },
    gesture: null,
    talk: null,
    aim: null,
    body: { x, y, facing: Math.PI / 2, speed: 0 },
    needs: { hunger: start, sleep: start, hygiene: start },
  };
}

/** Partie neuve: les deux joueurs descendent du train au lieu de départ. `members[0]` devient le joueur 0. */
export function createWorld(
  content: Content,
  seed: number,
  members: readonly [Member, Member],
): WorldState {
  const { start } = content.settings;
  const place = content.places[start.place];
  if (place === undefined) throw new Error(`lieu de départ inconnu: ${start.place}`);
  const rng = createRandom(seed).getState();
  const world: WorldState = {
    schema: DATA_SCHEMA,
    tick: 0,
    seed,
    rng: [rng[0], rng[1], rng[2], rng[3]],
    minutes: start.minute,
    common: { phase: 'day', place: start.place, day: 1, weather: 'clear', chest: 0, travel: null },
    players: [createPlayer(content, members[0], 0, 0), createPlayer(content, members[1], 0, 0)],
    progress: {
      memory: {},
      bonds: {},
      quests: {},
      collections: {},
      opened: [start.place],
      prices: {},
    },
    places: { [start.place]: createPlaceState(content, place) },
  };
  placeAtArrival(content, world);
  return world;
}
