/**
 * Système « voyage » (lot L2, ADR 0018): un seul lieu simulé, celui où sont les deux joueurs.
 * `day` puis `boarding` (sur le quai, chacun valide « Monter », sans limite d'attente; donner une
 * direction fait redescendre) puis `travel` (le lieu quitté est figé avec `leftOn`, `common.place`
 * change, la tranche du nouveau lieu part; chaque machine charge et envoie `place_loaded` pendant
 * la scène du trajet, longue de `travel.minSeconds` ou passée plus tôt quand les deux joueurs
 * appuient sur la touche d'action) puis `arrival` (descente sur le quai, l'horloge a pris les heures du trajet) et retour à `day`.
 * L'histoire peut aussi faire partir les deux joueurs (effet `travel_to`, `takeDeparture`).
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import { endTalk } from '../briques/parler';
import { postureOf, standUp } from '../briques/postures';
import type { Look } from '../briques/types';
import { SIM_HZ } from '../noyau/constantes';
import { freePlayer } from '../noyau/deblocage';
import { stopPlayer } from '../noyau/deplacement';
import { addMinutes } from '../noyau/horloge';
import { createPlaceState, placeAtArrival } from '../noyau/monde';
import { CORE_TUNING } from '../noyau/reglages-noyau';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { STORY } from '../quetes/reglages';

const PLAYERS: readonly PlayerIndex[] = [0, 1];

/** Ce joueur est-il sur le quai du lieu courant ? */
export function onPlatform(look: Look, player: PlayerIndex): boolean {
  const place = look.content.places[look.world.common.place];
  if (place === undefined) return false;
  const { platform, platformRadius } = place.def.station;
  const at = place.map.points[platform];
  if (at === undefined) return false;
  const { x, y } = look.world.players[player].body;
  return Math.hypot(x - at.x, y - at.y) <= platformRadius;
}

/**
 * Pourquoi ce joueur ne peut pas monter vers `to` maintenant (clé de texte), `null` s'il le peut.
 * Pur: l'interface s'en sert pour proposer « Monter » sur le quai.
 */
export function boardRefusal(look: Look, player: PlayerIndex, to: string): string | null {
  const { content, world } = look;
  const { phase, travel } = world.common;
  if (phase !== 'day' && phase !== 'boarding') return 'train-gone';
  const place = content.places[world.common.place];
  if (place === undefined || !place.def.links.includes(to) || content.places[to] === undefined)
    return 'no-line';
  const { from, to: until } = content.settings.travel;
  if (world.minutes < from || world.minutes > until) return 'no-train-now';
  const actor = world.players[player];
  if (actor.gesture !== null || actor.talk !== null) return 'busy';
  if (!onPlatform(look, player)) return 'not-on-platform';
  const other: PlayerIndex = player === 0 ? 1 : 0;
  if (travel !== null && travel.to !== to && travel.boarded[other]) return 'other-destination';
  return null;
}

/** Les lieux où ce joueur peut monter depuis le quai, dans l'ordre des données; vide hors du quai. */
export function boardingChoices(look: Look, player: PlayerIndex): string[] {
  const place = look.content.places[look.world.common.place];
  if (place === undefined || !onPlatform(look, player)) return [];
  return place.def.links.filter((to) => boardRefusal(look, player, to) === null);
}

function unboard(sim: SimContext, player: PlayerIndex): void {
  const { common } = sim.world;
  const travel = common.travel;
  if (common.phase !== 'boarding' || travel?.boarded[player] !== true) return;
  travel.boarded[player] = false;
  if (!travel.boarded[0] && !travel.boarded[1]) {
    common.travel = null;
    common.phase = 'day';
  }
  sim.touch('common');
  sim.emit({ type: 'train_boarded', player, to: null });
}

/** Les deux sont à bord: le lieu quitté est figé, le lieu d'arrivée devient le lieu courant. */
function depart(sim: SimContext, to: string): void {
  const { world, content } = sim;
  const from = world.common.place;
  const destination = content.places[to];
  const left = world.places[from];
  if (destination === undefined || left === undefined) return;
  for (const player of PLAYERS) {
    endTalk(sim, player);
    if (postureOf(left, player) !== null) standUp(sim, player);
    const actor = world.players[player];
    actor.gesture = null;
    actor.aim = null;
  }
  left.leftOn = world.common.day;
  world.common.place = to;
  const known = world.places[to];
  if (known === undefined) world.places[to] = createPlaceState(content, destination);
  else known.leftOn = null;
  placeAtArrival(content, world);
  for (const player of PLAYERS) {
    stopPlayer(sim, player);
    // Un meuble posé sur le quai depuis la dernière visite ne retient personne.
    freePlayer(content, world, player);
  }
  world.common.phase = 'travel';
  world.common.travel = { to, boarded: [true, true], loaded: [false, false], since: world.tick };
  sim.touch('common');
  sim.touch('players');
  sim.touch('place');
  sim.emit({ type: 'train_departed', from, to });
}

/** Dernier pas où une scène retenait le départ demandé (chez l'hôte seulement, hors de l'état). */
const heldUntil = new WeakMap<object, number>();

/**
 * Départ demandé par l'effet `travel_to` (histoire): pris en journée, `departureDelaySeconds`
 * après la fin de la scène en cours. Vers un lieu du jeu, c'est un vrai départ (sans quai ni
 * ligne); vers un lieu à venir, l'écran de fin de chapitre décrit dans l'effet s'affiche.
 */
function takeDeparture(sim: SimContext): void {
  const { world } = sim;
  const story = world.common.story;
  const departure = story?.departure;
  if (story === undefined || departure === undefined || world.common.phase !== 'day') return;
  if (story.scene !== null) {
    heldUntil.set(world, world.tick);
    return;
  }
  const from = Math.max(departure.since, heldUntil.get(world) ?? 0);
  if ((world.tick - from) / SIM_HZ < STORY.departureDelaySeconds) return;
  delete story.departure;
  heldUntil.delete(world);
  sim.touch('common');
  if (sim.content.places[departure.to] !== undefined) {
    depart(sim, departure.to);
    return;
  }
  if (departure.ending === null) return;
  story.ending = { place: world.common.place, id: departure.ending, closed: [false, false] };
  sim.emit({ type: 'chapter_ended', place: world.common.place, ending: departure.ending });
}

function arrive(sim: SimContext, place: string): void {
  const { world, content } = sim;
  // Le trajet coûte ses heures d'un coup (cahier 4.1); l'horloge est la même dans tous les lieux.
  world.common.phase = 'arrival';
  addMinutes(sim, content.settings.travel.clockHours * 60);
  world.common.travel = {
    to: place,
    boarded: [true, true],
    loaded: [true, true],
    since: world.tick,
  };
  if (!world.progress.opened.includes(place)) {
    // Un lieu où l'on est allé reste desservi: le retour est toujours possible.
    world.progress.opened.push(place);
    sim.touch('progress');
  }
  sim.touch('common');
  sim.emit({ type: 'train_arrived', place });
}

/** Secondes écoulées dans la scène du trajet (0 hors du trajet). Pur: le rendu s'en sert aussi. */
export function tripSeconds(look: Pick<Look, 'world'>): number {
  const { common, tick } = look.world;
  const since = common.travel?.since ?? null;
  if (common.phase !== 'travel' || since === null) return 0;
  return Math.max(0, (tick - since) / SIM_HZ);
}

/** Les deux joueurs ont demandé à passer la scène du trajet. */
function bothSkipped(travel: { readonly skip?: readonly [boolean, boolean] }): boolean {
  return travel.skip !== undefined && travel.skip[0] && travel.skip[1];
}

export const travelSystem: GameSystem = {
  id: 'voyage',
  intent(sim, player, intent) {
    const { common } = sim.world;
    if (intent.type === 'act') {
      // Dans le train, la touche d'action vote pour passer la scène; il faut les deux voix.
      const travel = common.travel;
      if (common.phase !== 'travel' || travel === null) return;
      const skip = travel.skip ?? [false, false];
      if (skip[player]) return;
      skip[player] = true;
      travel.skip = skip;
      sim.touch('common');
      return;
    }
    if (intent.type === 'place_loaded') {
      const travel = common.travel;
      if (common.phase !== 'travel' || travel?.to !== intent.place || travel.loaded[player]) return;
      travel.loaded[player] = true;
      sim.touch('common');
      return;
    }
    if (intent.type !== 'board') return;
    if (intent.to === null) {
      unboard(sim, player);
      return;
    }
    const reason = boardRefusal(sim, player, intent.to);
    if (reason !== null) {
      sim.emit({ type: 'refused', player, reason, target: null });
      return;
    }
    const place = sim.world.places[common.place];
    if (place !== undefined && postureOf(place, player) !== null) standUp(sim, player);
    let travel = common.travel;
    if (travel?.to !== intent.to) {
      travel = { to: intent.to, boarded: [false, false], loaded: [false, false], since: null };
      common.travel = travel;
    }
    if (travel.boarded[player]) return;
    travel.boarded[player] = true;
    common.phase = 'boarding';
    stopPlayer(sim, player);
    sim.touch('common');
    sim.emit({ type: 'train_boarded', player, to: intent.to });
    if (travel.boarded[0] && travel.boarded[1]) depart(sim, intent.to);
  },
  step(sim) {
    takeDeparture(sim);
    const { world, content } = sim;
    const { common } = world;
    const travel = common.travel;
    if (travel === null) return;
    if (common.phase === 'boarding') {
      // Sur le marchepied, donner une direction fait redescendre.
      for (const player of PLAYERS) {
        const input = sim.inputs[player];
        if (!travel.boarded[player]) continue;
        if (Math.hypot(input.moveX, input.moveY) >= CORE_TUNING.moveDeadzone) unboard(sim, player);
      }
      return;
    }
    const elapsed = (world.tick - (travel.since ?? world.tick)) / SIM_HZ;
    if (common.phase === 'travel') {
      const ready = travel.loaded[0] && travel.loaded[1];
      if (ready && (elapsed >= content.settings.travel.minSeconds || bothSkipped(travel)))
        arrive(sim, travel.to);
      else if (
        !ready &&
        world.tick - (travel.since ?? world.tick) ===
          Math.round(content.settings.travel.slowLoadSeconds * SIM_HZ)
      )
        sim.emit({ type: 'train_waiting', loaded: [travel.loaded[0], travel.loaded[1]] });
      return;
    }
    if (common.phase === 'arrival' && elapsed >= CORE_TUNING.arrivalSeconds) {
      common.phase = 'day';
      common.travel = null;
      sim.touch('common');
    }
  },
};
