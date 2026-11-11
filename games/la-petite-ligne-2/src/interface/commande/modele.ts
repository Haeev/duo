/**
 * Modèle de l'écran de livraison et de la ligne du carnet: pur, lu de l'état transmis (les faits
 * de la commande) et des données. Testable sans DOM.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { LetterDef, OrderDeskDef, OrderPay } from '../../donnees/schemas/commande';
import type { ReadonlyWorld } from '../../etat/monde';
import {
  atDesk,
  availableFor,
  deskOpen,
  lettersIn,
  orderView,
  ordersOf,
} from '../../simulation/commandes/lecture';
import { ORDERS } from '../../simulation/commandes/reglages';
import type { PortraitMood } from '../portrait';
import { fill } from '../textes';
import { ORDER_TEXTS as T } from './textes';

export interface OrderRow {
  readonly id: string;
  readonly item: string;
  readonly name: string;
  readonly tableName: string;
  readonly asked: number;
  readonly delivered: number;
  readonly price: number;
  readonly bag: number;
  readonly store: number;
  /** Ce qu'une livraison donnerait maintenant: le reste demandé, borné par ce qu'on a. */
  readonly deliverable: number;
  readonly done: boolean;
  /** Reste à livrer, et ce qu'il rapportera (centimes): `price` est le prix à l'unité. */
  readonly left: number;
  readonly due: number;
  /** Déjà payé pour cette ligne (centimes). */
  readonly received: number;
}

export type OrderEntry =
  | { readonly kind: 'line'; readonly id: string }
  | { readonly kind: 'mail' }
  | { readonly kind: 'letter'; readonly id: string };

export type ReceiverMood = keyof OrderDeskDef['says'];

export interface OrderScreenModel {
  readonly receiver: string;
  readonly receiverName: string;
  readonly due: number | null;
  readonly dueToday: boolean;
  readonly pay: OrderPay;
  readonly rows: readonly OrderRow[];
  readonly waiting: readonly LetterDef[];
  readonly letters: readonly LetterDef[];
  /** Ce qui se choisit au clavier, dans l'ordre: les lignes, le courrier, les lettres reçues. */
  readonly entries: readonly OrderEntry[];
  /** Le guichet est ouvert et ce joueur est à côté de qui reçoit. */
  readonly here: boolean;
  readonly mood: ReceiverMood;
  readonly says: string;
  /** L'expression du buste, accordée à sa réplique (`RECEIVER_EXPRESSION`). */
  readonly expression: PortraitMood;
  /** Toute la commande: ce qui reste à recevoir et ce qui est déjà payé (centimes). */
  readonly toReceive: number;
  readonly received: number;
}

/**
 * L'expression de qui reçoit selon sa réplique (les portraits en ont cinq). Elle n'est contente
 * que quand il y a de quoi l'être; quand la livraison attendra samedi prochain, elle s'en soucie.
 */
export const RECEIVER_EXPRESSION: Readonly<Record<ReceiverMood, PortraitMood>> = {
  // « La commande de la semaine ! Pose ça sur le quai, je charge. »
  open: 'content',
  // « Tout y est. Je charge, je signe. »
  thanks: 'content',
  // « Le reste, samedi prochain. »: on livrera plus tard.
  partial: 'soucieux',
  // « Rien pour le fourgon ? Pas grave. »: rien de livré, elle reste posée.
  nothing: 'neutre',
  // Elle tend le courrier, amusée.
  mail: 'content',
};

export function entryKey(entry: OrderEntry): string {
  return entry.kind === 'mail' ? 'mail' : `${entry.kind}:${entry.id}`;
}

export function orderScreenModel(
  content: Content,
  world: ReadonlyWorld,
  me: PlayerIndex,
  place: string,
): OrderScreenModel | null {
  const orders = ordersOf(content, place);
  if (orders === null) return null;
  const look = { content, world };
  const view = orderView(content, world, place);
  const here = world.common.place === place && atDesk(look, me);
  const rows: OrderRow[] = (view?.lines ?? []).map((line) => {
    const have =
      world.common.place === place ? availableFor(look, me, line.item) : { bag: 0, store: 0 };
    const left = line.asked - line.delivered;
    return {
      id: line.id,
      item: line.item,
      name: content.items[line.item]?.name ?? line.item,
      tableName: line.tableName,
      asked: line.asked,
      delivered: line.delivered,
      price: line.price,
      bag: have.bag,
      store: have.store,
      deliverable: Math.min(left, have.bag + have.store),
      done: left <= 0,
      left: Math.max(0, left),
      due: line.price * Math.max(0, left),
      received: line.price * line.delivered,
    };
  });
  const waiting = lettersIn(content, world, place, ORDERS.mailWaiting);
  const letters = lettersIn(content, world, place, ORDERS.mailTaken);
  const entries: OrderEntry[] = [
    ...rows.map((row) => ({ kind: 'line' as const, id: row.id })),
    ...(waiting.length > 0 ? [{ kind: 'mail' as const }] : []),
    ...letters.map((letter) => ({ kind: 'letter' as const, id: letter.id })),
  ];
  const pending = rows.filter((r) => !r.done);
  const mood: ReceiverMood =
    waiting.length > 0
      ? 'mail'
      : pending.length === 0
        ? 'thanks'
        : rows.some((r) => r.delivered > 0)
          ? 'partial'
          : pending.every((r) => r.deliverable === 0)
            ? 'nothing'
            : 'open';
  const receiver = orders.desk.receiver;
  const receiverName =
    content.places[place]?.villagers.find((v) => v.id === receiver)?.name ?? receiver;
  return {
    receiver,
    receiverName,
    due: view?.due ?? null,
    dueToday: view?.due === world.common.day && deskOpen(look, place),
    pay: orders.desk.pay,
    rows,
    waiting,
    letters,
    entries,
    here,
    mood,
    says: orders.desk.says[mood],
    expression: RECEIVER_EXPRESSION[mood],
    toReceive: rows.reduce((sum, row) => sum + row.due, 0),
    received: rows.reduce((sum, row) => sum + row.received, 0),
  };
}

/** La ligne du carnet (onglet Quêtes): ce qui est demandé et le courrier qui attend. */
export function orderReminder(
  content: Content,
  world: ReadonlyWorld,
  place: string,
): { head: string; body: string } | null {
  const view = orderView(content, world, place);
  if (view === null) return null;
  const open = view.due === world.common.day && deskOpen({ content, world }, place);
  const parts = view.lines.map((line) => {
    const name = content.items[line.item]?.name ?? line.item;
    const left = line.asked - line.delivered;
    return left <= 0
      ? fill(T.carnet.lineDone, { objet: name })
      : fill(T.carnet.line, { n: left, objet: name });
  });
  const waiting = lettersIn(content, world, place, ORDERS.mailWaiting).length;
  if (waiting > 0) parts.push(fill(T.carnet.mail, { n: waiting }));
  return {
    head: open ? T.carnet.headToday : fill(T.carnet.head, { jour: view.due }),
    body: parts.length === 0 ? T.empty : `${parts.join(', ')}.`,
  };
}
