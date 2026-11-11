/**
 * Indicateur de rythme d'un véhicule de voie (la draisine), montré à qui est à bord seulement:
 * un balancier dont le repère va de mon jeton à celui de l'autre au battement de la fiche (il
 * arrive chez qui doit donner le prochain coup), un trait de vitesse, l'arrêt d'ici et le
 * prochain, les touches. Les coups viennent des événements (`vehicle_stroke`): le repère part au
 * pas même du coup, chez l'hôte comme chez l'invité.
 */
import type { Content } from '../donnees/charger';
import type { PlayerIndex } from '../donnees/schemas/communs';
import type { RailVehicleDef } from '../donnees/schemas/vehicule';
import type { ReadonlyWorld } from '../etat/monde';
import type { GameEvent } from '../simulation/noyau/evenements';
import { riddenBy, ridersAboard, seatOf } from '../simulation/vehicules/places';
import { RAIL_VEHICLES } from '../simulation/vehicules/reglages';
import { lineOf } from '../simulation/vehicules/voie';
import { el, setText, show, toggle } from './dom';
import { fill, TEXTS } from './textes';
import './vehicule.css';

/** Réglages de l'indicateur. */
export const VEHICLE_UI = {
  /** Largeur de course du repère (rem): la piste moins le repère. */
  travelRem: 6.25,
  /** Justesse à partir de laquelle l'indicateur dit « en rythme ». */
  inRhythm: 0.6,
  /** Délai entre deux rappels « il manque quelqu'un » (ms). */
  aloneEveryMs: 5000,
} as const;

/** Ce que montre l'indicateur. Logique pure. */
export interface VehicleView {
  readonly vehicle: string;
  /** Ma place (0 ou 1) et si l'autre est à bord. */
  readonly seat: 0 | 1;
  readonly full: boolean;
  readonly moving: boolean;
  /** Vitesse rapportée à la vitesse de pointe (0 à 1), et justesse du rythme (0 à 1). */
  readonly speed: number;
  readonly rhythm: number;
  /** La place qui a donné le dernier coup (`null`: aucun), et le battement de la fiche (s). */
  readonly last: 0 | 1 | null;
  readonly beat: number;
  readonly tolerance: number;
  /** Nom de l'arrêt où l'on se tient, `null` en pleine voie ou en route. */
  readonly here: string | null;
  /** Prochain arrêt dans le sens de marche et sa distance (m), `null`: le bout de la voie. */
  readonly next: { readonly name: string; readonly meters: number } | null;
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** L'indicateur du véhicule où ce joueur a pris place, `null` s'il est à pied. */
export function vehicleView(
  content: Content,
  world: ReadonlyWorld,
  local: PlayerIndex,
): VehicleView | null {
  const placeState = world.places[world.common.place];
  const place = content.places[world.common.place];
  const id = placeState === undefined ? null : riddenBy(placeState, local);
  const state = id === null ? undefined : placeState?.vehicles?.[id];
  const def: RailVehicleDef | undefined = id === null ? undefined : place?.vehicles[id];
  const line = def === undefined || place === undefined ? null : lineOf(place, def);
  if (id === null || state === undefined || def === undefined || line === null) return null;
  const seat = seatOf(state, local);
  if (seat === -1) return null;
  let next: VehicleView['next'] = null;
  for (const stop of line.stops) {
    const ahead = (stop.s - state.s) * state.dir;
    if (ahead <= def.stopReach) continue;
    if (next === null || ahead < next.meters) next = { name: stop.name, meters: ahead };
  }
  return {
    vehicle: id,
    seat,
    full: ridersAboard(state) === 2,
    moving: state.speed > RAIL_VEHICLES.rest,
    speed: Math.min(1, state.speed / def.speed.max),
    rhythm: state.lever.rhythm,
    last: state.lever.seat,
    beat: def.drive.beat,
    tolerance: def.drive.tolerance,
    here: line.stops.find((stop) => stop.id === state.stop)?.name ?? null,
    next,
  };
}

/** La ligne de l'indicateur: où l'on est, puis le prochain arrêt dans le sens de marche. */
export function vehicleLine(view: VehicleView): string {
  const next =
    view.next === null
      ? TEXTS.vehicle.end
      : fill(TEXTS.vehicle.nextAt, {
          nom: view.next.name,
          metres: String(Math.max(5, Math.round(view.next.meters / 5) * 5)),
        });
  return capital(
    view.here === null ? next : fill(TEXTS.vehicle.then, { ici: view.here, suite: next }),
  );
}

/**
 * Place du repère sur le balancier, de 0 (chez moi) à 1 (chez l'autre), `since` secondes après le
 * dernier coup: il quitte le jeton de qui vient de pomper et arrive chez l'autre au battement.
 */
export function leverMark(view: VehicleView, since: number): number {
  if (view.last === null) return 0.5;
  const along = Math.max(0, Math.min(1, since / view.beat));
  return view.last === view.seat ? along : 1 - along;
}

export interface VehicleGauge {
  frame(now: number, world: ReadonlyWorld, local: PlayerIndex, hidden: boolean): void;
  /** Rend un avis à montrer (texte de la fiche), ou `null`. */
  onEvent(event: GameEvent, local: PlayerIndex, now: number): string | null;
  dispose(): void;
}

export function createVehicleGauge(
  root: HTMLElement,
  content: Content,
  keyLabel: (code: string) => string,
  placeOf: () => string | null,
): VehicleGauge {
  const mark = el('i', { class: 'rail__mark' });
  const speed = el('i', { class: 'rail__speed' });
  const track = el('div', { class: 'rail__track' }, [speed, mark]);
  const mine = el('span', { class: 'token rail__me' });
  const theirs = el('span', { class: 'token token--other rail__other' });
  const lever = el('div', { class: 'rail__lever', 'aria-hidden': 'true' }, [mine, track, theirs]);
  const line = el('div', { class: 'rail__line' });
  const key = (code: string, label: string): HTMLElement[] => [
    el('span', { class: 'key', text: keyLabel(code) }),
    el('span', { class: 'rail__do', text: label }),
  ];
  const pump = el('span', { class: 'rail__hint' }, key('Space', TEXTS.vehicle.pump));
  const brake = el('span', { class: 'rail__hint' }, key('ShiftLeft', TEXTS.vehicle.brake));
  const turn = el('span', { class: 'rail__hint' }, key('ShiftLeft', TEXTS.vehicle.turn));
  const leave = el('span', { class: 'rail__hint' }, [
    el('span', {
      class: 'key',
      text: ['KeyW', 'KeyA', 'KeyS', 'KeyD'].map(keyLabel).join(' '),
    }),
    el('span', { class: 'rail__do', text: TEXTS.vehicle.leave }),
  ]);
  const keys = el('div', { class: 'rail__keys' }, [pump, brake, turn, leave]);
  const node = el('div', { class: 'rail', role: 'status' }, [lever, line, keys]);
  node.hidden = true;
  root.append(node);
  /** Dernier coup vu (événement), en temps de l'interface. */
  let strokeAt = Number.NEGATIVE_INFINITY;
  let aloneAt = Number.NEGATIVE_INFINITY;
  let drawn = '';

  const sheet = (id: string): RailVehicleDef | undefined =>
    content.places[placeOf() ?? '']?.vehicles[id];

  return {
    frame(now, world, local, hidden) {
      const view = hidden ? null : vehicleView(content, world, local);
      show(node, view !== null);
      if (view === null) return;
      const since = (now - strokeAt) / 1000;
      const at = leverMark(view, since);
      // Le repère et le trait de vitesse ne bougent que par `transform` (PC de référence).
      mark.style.transform = `translateX(${(at * VEHICLE_UI.travelRem).toFixed(3)}rem)`;
      speed.style.transform = `scaleX(${view.speed.toFixed(3)})`;
      const due = view.last !== null && Math.abs(since - view.beat) <= view.tolerance;
      toggle(node, 'rail--mine', view.full && due && view.last !== view.seat);
      toggle(node, 'rail--theirs', view.full && due && view.last === view.seat);
      toggle(node, 'rail--swing', view.rhythm >= VEHICLE_UI.inRhythm);
      toggle(node, 'rail--alone', !view.full);
      const text = view.full ? vehicleLine(view) : TEXTS.vehicle.alone;
      const signature = `${text}|${view.moving ? 1 : 0}`;
      if (signature === drawn) return;
      drawn = signature;
      setText(line, text);
      show(brake, view.moving);
      show(turn, !view.moving);
      show(leave, !view.moving);
    },
    onEvent(event, local, now) {
      if (event.type === 'vehicle_stroke') {
        if (event.kind === 'push' || event.kind === 'jam') strokeAt = now;
        if (event.kind !== 'alone' || event.player !== local) return null;
        if (now - aloneAt < VEHICLE_UI.aloneEveryMs) return null;
        aloneAt = now;
        return sheet(event.vehicle)?.lines.needsTwo ?? null;
      }
      if (event.type === 'vehicle_warning') return sheet(event.vehicle)?.lines.trainWarning ?? null;
      if (event.type === 'vehicle_in')
        return event.reason === 'train' ? (sheet(event.vehicle)?.lines.putAway ?? null) : null;
      if (event.type === 'vehicle_stopped')
        return event.end ? (sheet(event.vehicle)?.lines.endOfLine ?? null) : null;
      if (event.type === 'vehicle_seat' && event.player === local && event.seat !== null)
        return sheet(event.vehicle)?.seats[event.seat].name ?? null;
      return null;
    },
    dispose() {
      node.remove();
    },
  };
}
