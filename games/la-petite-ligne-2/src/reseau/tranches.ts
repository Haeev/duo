/** Passage de l'état aux messages de tranche, et retour. Pur: testé sans réseau. */
import type { Content } from '../donnees/charger';
import { slowOf } from '../etat/joueur';
import { slowOfPlace } from '../etat/lieu';
import type { Slice, WorldState } from '../etat/monde';
import type { FastMessage, SliceMessage } from './canaux';

const encoder = new TextEncoder();

/** Taille d'un message une fois sérialisé, en octets (ce que le SDK mesure). */
export function byteLength(message: unknown): number {
  return encoder.encode(JSON.stringify(message)).length;
}

export function currentPlace(world: WorldState): WorldState['places'][string] {
  const place = world.places[world.common.place];
  if (place === undefined) throw new Error(`lieu courant sans état: ${world.common.place}`);
  return place;
}

export function sliceMessage<S extends Slice>(world: WorldState, slice: S): SliceMessage<S>;
export function sliceMessage(world: WorldState, slice: Slice): SliceMessage<Slice> {
  const tick = world.tick;
  switch (slice) {
    case 'common':
      return { tick, seed: world.seed, common: world.common };
    case 'players':
      return { tick, players: [slowOf(world.players[0]), slowOf(world.players[1])] };
    case 'progress':
      return { tick, progress: world.progress };
    case 'place':
      return { tick, id: world.common.place, place: slowOfPlace(currentPlace(world)) };
  }
}

/**
 * Arrondi au centième (cm, crad, cm/s) des habitants: sous le pixel (2 cm par pixel sur un écran
 * de 1366 px pour la vue de 28 m), et le canal rapide d'un grand lieu passe de 1,9 à 1,1 Ko au
 * pire, 30 fois par seconde. Les joueurs gardent leur précision entière: la réconciliation de la
 * prédiction la compare à la sienne.
 */
function centi(value: number): number {
  return Math.round(value * 100) / 100;
}

export function fastMessage(world: WorldState, content: Content, ack: number): FastMessage {
  const [a, b] = world.players;
  const place = currentPlace(world);
  const order = content.places[world.common.place]?.villagers ?? [];
  const villagers: FastMessage['villagers'] = [];
  for (const def of order) {
    const body = place.villagers[def.id]?.body;
    if (body !== undefined)
      villagers.push([centi(body.x), centi(body.y), centi(body.facing), centi(body.speed)]);
  }
  return {
    tick: world.tick,
    ack,
    minutes: world.minutes,
    place: world.common.place,
    players: [
      [a.body.x, a.body.y, a.body.facing, a.body.speed],
      [b.body.x, b.body.y, b.body.facing, b.body.speed],
    ],
    needs: [
      [a.needs.hunger, a.needs.sleep, a.needs.hygiene],
      [b.needs.hunger, b.needs.sleep, b.needs.hygiene],
    ],
    stamina: [a.stamina, b.stamina],
    villagers,
  };
}
