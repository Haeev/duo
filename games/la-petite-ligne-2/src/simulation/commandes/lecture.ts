/**
 * Lecture de la commande de la semaine et du courrier, d'après l'état transmis (faits de la
 * mémoire) et les données: pure, la même chez l'hôte et chez l'invité. L'interface (écran de
 * livraison, carnet) et l'hôte (intentions) la partagent.
 */
import type { Content, OrderContent } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { LetterDef, OrderLineDef } from '../../donnees/schemas/commande';
import type { CalendarEventDef } from '../../donnees/schemas/temps';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Stack } from '../../etat/joueur';
import type { Look } from '../briques/types';
import { eventsOn } from '../monde/agenda';
import { inHours, minutesSinceDawn } from '../monde/calendrier';
import { ORDERS } from './reglages';

const F = ORDERS.facts;

export function dueKey(place: string): string {
  return `${F.due}.${place}.${F.dueField}`;
}
export function askedKey(place: string, line: string): string {
  return `${F.asked}.${place}.${line}`;
}
export function deliveredKey(place: string, line: string): string {
  return `${F.delivered}.${place}.${line}`;
}
export function linesDoneKey(place: string): string {
  return `${F.due}.${place}.${F.linesDone}`;
}
export function unitsKey(place: string): string {
  return `${F.due}.${place}.${F.units}`;
}
export function obtainedKey(item: string): string {
  return `${F.obtained}.${item}`;
}
export function mailKey(place: string, letter: string): string {
  return `${F.mail}.${place}.${letter}`;
}
export function mailVisitKey(place: string): string {
  return `${F.mailVisit}.${place}`;
}

function numberFact(world: ReadonlyWorld, key: string): number {
  const v = world.progress.memory[key]?.v;
  return typeof v === 'number' ? v : 0;
}

/** Le guichet d'un lieu, ou `null`. */
export function ordersOf(content: Content, place: string): OrderContent | null {
  return content.places[place]?.orders ?? null;
}

/** Une ligne de commande et sa table, par identifiant (toutes tables du lieu). */
export interface LineRef {
  readonly line: OrderLineDef;
  readonly table: string;
  readonly tableName: string;
  /** Rang dans les données: l'ordre d'affichage. */
  readonly rank: number;
}

const lineIndex = new WeakMap<OrderContent, ReadonlyMap<string, LineRef>>();

export function linesOf(orders: OrderContent): ReadonlyMap<string, LineRef> {
  let index = lineIndex.get(orders);
  if (index === undefined) {
    const map = new Map<string, LineRef>();
    let rank = 0;
    for (const table of orders.tables)
      for (const line of table.lines)
        map.set(line.id, { line, table: table.id, tableName: table.name, rank: rank++ });
    index = map;
    lineIndex.set(orders, index);
  }
  return index;
}

/** L'événement du guichet, s'il a lieu ce jour-là (conditions d'histoire comprises). */
function deskEventOn(look: Look, place: string, day: number): CalendarEventDef | null {
  const orders = ordersOf(look.content, place);
  if (orders === null) return null;
  return eventsOn(look, place, day).find((e) => e.id === orders.desk.event) ?? null;
}

/**
 * Jour de la prochaine livraison: le premier jour, aujourd'hui compris tant que l'événement n'est
 * pas fini, où l'événement du guichet a lieu. `null`: aucun dans les jours qui viennent.
 */
export function dueDayOf(look: Look, place: string): number | null {
  const { world, content } = look;
  const today = world.common.day;
  for (let day = today; day <= today + ORDERS.lookahead; day++) {
    const event = deskEventOn(look, place, day);
    if (event === null) continue;
    if (day > today) return day;
    const now = minutesSinceDawn(content, world.minutes);
    if (now < minutesSinceDawn(content, event.hours.to)) return day;
  }
  return null;
}

/** L'événement du guichet est-il en cours dans ce lieu, à l'heure de l'état ? */
export function deskOpen(look: Look, place: string): boolean {
  const event = deskEventOn(look, place, look.world.common.day);
  return event !== null && inHours(event.hours, look.world.minutes);
}

export interface OrderLineView {
  readonly id: string;
  readonly item: string;
  readonly table: string;
  readonly tableName: string;
  readonly asked: number;
  readonly delivered: number;
  /** Prix d'une unité (centimes). */
  readonly price: number;
}

export interface OrderView {
  /** Jour de livraison attendu. */
  readonly due: number;
  readonly lines: readonly OrderLineView[];
}

/** La commande en cours d'un lieu, lue dans les faits; `null`: pas encore de commande. */
export function orderView(content: Content, world: ReadonlyWorld, place: string): OrderView | null {
  const orders = ordersOf(content, place);
  if (orders === null) return null;
  const due = world.progress.memory[dueKey(place)]?.v;
  if (typeof due !== 'number') return null;
  const lines: { view: OrderLineView; rank: number }[] = [];
  const prefix = `${F.asked}.${place}.`;
  const index = linesOf(orders);
  for (const key of Object.keys(world.progress.memory)) {
    if (!key.startsWith(prefix)) continue;
    const id = key.slice(prefix.length);
    const ref = index.get(id);
    const asked = numberFact(world, key);
    if (ref === undefined || asked <= 0) continue;
    lines.push({
      rank: ref.rank,
      view: {
        id,
        item: ref.line.item,
        table: ref.table,
        tableName: ref.tableName,
        asked,
        delivered: Math.min(asked, numberFact(world, deliveredKey(place, id))),
        price: ref.line.price,
      },
    });
  }
  lines.sort((a, b) => a.rank - b.rank);
  return { due, lines: lines.map((line) => line.view) };
}

/** Lignes encore à livrer (en tout ou en partie). */
export function pendingLines(view: OrderView | null): readonly OrderLineView[] {
  return view === null ? [] : view.lines.filter((l) => l.delivered < l.asked);
}

/** Lettres d'un lieu dans cet état du courrier (`waiting`: dans le fourgon; `taken`: remises). */
export function lettersIn(
  content: Content,
  world: ReadonlyWorld,
  place: string,
  state: typeof ORDERS.mailWaiting | typeof ORDERS.mailTaken,
): LetterDef[] {
  const orders = ordersOf(content, place);
  if (orders === null) return [];
  return Object.values(orders.letters)
    .filter((letter) => world.progress.memory[mailKey(place, letter.id)]?.v === state)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** Le joueur est-il à portée de qui reçoit, pendant l'événement du guichet du lieu courant ? */
export function atDesk(look: Look, player: PlayerIndex): boolean {
  const place = look.world.common.place;
  const orders = ordersOf(look.content, place);
  if (orders === null || !deskOpen(look, place)) return false;
  const body = look.world.places[place]?.villagers[orders.desk.receiver]?.body;
  if (body === undefined) return false;
  const me = look.world.players[player].body;
  return Math.hypot(body.x - me.x, body.y - me.y) <= ORDERS.reach;
}

/** Ce qu'il y a à faire au guichet: des lignes à livrer ou du courrier qui attend. */
export function deskHasBusiness(content: Content, world: ReadonlyWorld, place: string): boolean {
  return (
    pendingLines(orderView(content, world, place)).length > 0 ||
    lettersIn(content, world, place, ORDERS.mailWaiting).length > 0
  );
}

/**
 * La page « livrer la commande » s'ajoute-t-elle à la fin d'une conversation avec cet habitant ?
 * Il reçoit la commande du lieu courant, l'événement du guichet est en cours, et il y a de quoi
 * faire (lignes à livrer ou courrier). Pur: l'hôte avance, l'interface affiche.
 */
export function orderOffered(look: Look, villager: string): boolean {
  const place = look.world.common.place;
  const orders = ordersOf(look.content, place);
  return (
    orders !== null &&
    orders.desk.receiver === villager &&
    deskOpen(look, place) &&
    deskHasBusiness(look.content, look.world, place)
  );
}

function countIn(stacks: readonly (Readonly<Stack> | null)[], item: string): number {
  let total = 0;
  for (const stack of stacks) if (stack?.item === item) total += stack.count;
  return total;
}

/** Ce que le joueur a de cet objet: son sac (barre comprise), et les rangements du guichet. */
export function availableFor(
  look: Look,
  player: PlayerIndex,
  item: string,
): { bag: number; store: number } {
  const { world } = look;
  const actor = world.players[player];
  const bag = countIn([...actor.toolbar, ...(actor.bag?.slots ?? [])], item);
  const place = world.common.place;
  const orders = ordersOf(look.content, place);
  let store = 0;
  for (const id of orders?.desk.stores ?? [])
    store += countIn(world.places[place]?.objects[id]?.store ?? [], item);
  return { bag, store };
}
