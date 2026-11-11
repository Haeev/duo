/**
 * Système « commande de la semaine et courrier » (cahier 4.1, train du samedi). Chez l'hôte:
 * - retient chaque objet que le duo a eu en main (`objets.obtenu.<objet>`): le tirage ne demande
 *   que ce que le duo sait produire;
 * - dès que la livraison attendue change (le train est reparti), tire la commande suivante: les
 *   lignes non livrées sont reportées sans pénalité, d'autres complètent jusqu'à 3 à 5 lignes;
 * - à chaque passage de l'événement du guichet, fait arriver le courrier dont les conditions sont
 *   vraies;
 * - livre une ligne (`order_deliver`) et remet le courrier (`mail_take`) à qui est au guichet.
 * Tout l'état tient en faits de la mémoire (`lecture.ts`): sauvegarde et réseau inchangés.
 */
import type { OrderContent } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { OrderLineDef } from '../../donnees/schemas/commande';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { evaluateAll } from '../regles/conditions';
import { applyEffects } from '../regles/effets';
import { bump, forget, recall, remember } from '../regles/memoire';
import { RULES } from '../regles/reglages';
import { earn } from '../sac/argent';
import { countItem, removeItem } from '../sac/inventaire';
import { SIM_HZ } from '../noyau/constantes';
import {
  askedKey,
  atDesk,
  deliveredKey,
  deskOpen,
  dueDayOf,
  dueKey,
  lettersIn,
  linesDoneKey,
  mailKey,
  mailVisitKey,
  obtainedKey,
  orderView,
  ordersOf,
  unitsKey,
} from './lecture';
import { ORDERS } from './reglages';
import { drawOrder } from './tirage';

/** Le duo a-t-il déjà eu cet objet: fait retenu, vente au comptoir, ou en main maintenant. */
function obtained(sim: SimContext, place: string, orders: OrderContent, item: string): boolean {
  const { memory } = sim.world.progress;
  if (obtainedKey(item) in memory) return true;
  // Parties d'avant la commande: une vente au comptoir ou un objet tenu suffisent.
  const sold = `${ORDERS.facts.sold}.`;
  const tail = `.${item}`;
  for (const key of Object.keys(memory))
    if (key.startsWith(sold) && key.endsWith(tail) && key.split('.').length === 3) return true;
  for (const player of sim.world.players) if (countItem(player, item) > 0) return true;
  for (const id of orders.desk.stores)
    for (const stack of sim.world.places[place]?.objects[id]?.store ?? [])
      if (stack?.item === item) return true;
  return false;
}

/** Tire la commande due le jour `due`; reporte ce qui reste de la précédente. */
export function renewOrder(
  sim: SimContext,
  place: string,
  orders: OrderContent,
  due: number,
): void {
  const before = orderView(sim.content, sim.world, place);
  const carried = (before?.lines ?? []).filter((l) => l.delivered < l.asked);
  for (const line of before?.lines ?? []) {
    forget(sim, askedKey(place, line.id));
    forget(sim, deliveredKey(place, line.id));
  }
  const ctx = { world: sim.world, content: sim.content, actor: null };
  const eligible = (line: OrderLineDef): boolean =>
    obtained(sim, place, orders, line.item) && evaluateAll(ctx, line.when);
  const drawn = drawOrder(
    orders,
    sim.world.seed,
    place,
    due,
    eligible,
    carried.length,
    new Set(carried.map((l) => l.id)),
  );
  for (const line of carried)
    remember(sim, askedKey(place, line.id), line.asked - line.delivered, 'duo');
  for (const line of drawn) remember(sim, askedKey(place, line.id), line.asked, 'duo');
  remember(sim, dueKey(place), due, 'duo');
  sim.emit({ type: 'order_renewed', place, due, lines: carried.length + drawn.length });
}

/** Le courrier du passage d'aujourd'hui: les lettres prêtes, dans leur ordre, jusqu'au plafond. */
function bringMail(sim: SimContext, place: string, orders: OrderContent): void {
  const today = sim.world.common.day;
  if (recall(sim.world, mailVisitKey(place))?.v === today) return;
  remember(sim, mailVisitKey(place), today, 'duo');
  const ctx = { world: sim.world, content: sim.content, actor: null };
  const ready = Object.values(orders.letters)
    .filter((l) => recall(sim.world, mailKey(place, l.id)) === null && evaluateAll(ctx, l.when))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .slice(0, orders.desk.mailPerVisit);
  for (const letter of ready) remember(sim, mailKey(place, letter.id), ORDERS.mailWaiting, 'duo');
}

function noteObtained(sim: SimContext): void {
  for (const event of sim.events ?? [])
    if (event.type === 'item_gained' && recall(sim.world, obtainedKey(event.item)) === null)
      remember(sim, obtainedKey(event.item), true, 'duo');
}

function step(sim: SimContext): void {
  noteObtained(sim);
  // Une fois par seconde de jeu réelle: la livraison attendue ne change qu'au départ du train.
  if (sim.world.tick % SIM_HZ !== 0) return;
  for (const [place, content] of Object.entries(sim.content.places)) {
    const orders = content.orders;
    if (orders === null) continue;
    const ctx = { world: sim.world, content: sim.content, actor: null };
    if (!evaluateAll(ctx, orders.desk.when)) continue;
    const due = dueDayOf(sim, place);
    if (due !== null && recall(sim.world, dueKey(place))?.v !== due)
      renewOrder(sim, place, orders, due);
    if (deskOpen(sim, place)) bringMail(sim, place, orders);
  }
}

/** Ajoute au coffre commun, sans dépasser le plafond; renvoie ce qui est entré. */
function toChest(sim: SimContext, cents: number): number {
  const common = sim.world.common;
  const added = Math.max(0, Math.min(cents, RULES.money.max - common.chest));
  if (added <= 0) return 0;
  common.chest += added;
  sim.touch('common');
  sim.emit({ type: 'money_changed', who: 'chest', delta: added });
  return added;
}

/** Retire jusqu'à `want` exemplaires des rangements du guichet; renvoie ce qui est pris. */
function takeFromStores(sim: SimContext, orders: OrderContent, item: string, want: number): number {
  const place = sim.world.places[sim.world.common.place];
  let taken = 0;
  for (const id of orders.desk.stores) {
    const slots = place?.objects[id]?.store;
    if (slots === undefined) continue;
    for (let i = 0; i < slots.length && taken < want; i++) {
      const stack = slots[i];
      if (stack?.item !== item) continue;
      const n = Math.min(want - taken, stack.count);
      stack.count -= n;
      if (stack.count === 0) slots[i] = null;
      taken += n;
    }
  }
  if (taken > 0) sim.touch('place');
  return taken;
}

/** Ce qui empêche de livrer ou de prendre le courrier ici, ou `null`. */
function deskRefusal(sim: SimContext, player: PlayerIndex): string | null {
  const place = sim.world.common.place;
  if (ordersOf(sim.content, place) === null || !deskOpen(sim, place)) return 'order-closed';
  return atDesk(sim, player) ? null : 'too-far';
}

export function deliverLine(sim: SimContext, player: PlayerIndex, lineId: string): string | null {
  const refusal = deskRefusal(sim, player);
  if (refusal !== null) return refusal;
  const place = sim.world.common.place;
  const orders = ordersOf(sim.content, place);
  const line = orderView(sim.content, sim.world, place)?.lines.find((l) => l.id === lineId);
  if (orders === null || line === undefined) return 'order-unknown-line';
  const want = line.asked - line.delivered;
  if (want <= 0) return 'order-line-done';
  const actor = sim.world.players[player];
  const fromBag = Math.min(want, countItem(actor, line.item));
  if (fromBag > 0 && removeItem(actor, line.item, fromBag)) sim.touch('players');
  const count = fromBag + takeFromStores(sim, orders, line.item, want - fromBag);
  if (count === 0) return 'order-nothing';
  const due = count * line.price;
  const paid = orders.desk.pay === 'chest' ? toChest(sim, due) : earn(sim, player, due);
  const done = line.delivered + count >= line.asked;
  remember(sim, deliveredKey(place, line.id), line.delivered + count, player);
  bump(sim, unitsKey(place), 'duo', count);
  if (done) bump(sim, linesDoneKey(place), 'duo');
  sim.emit({
    type: 'order_delivered',
    player,
    place,
    line: line.id,
    item: line.item,
    count,
    paid,
    done,
  });
  return null;
}

export function takeMail(sim: SimContext, player: PlayerIndex): string | null {
  const refusal = deskRefusal(sim, player);
  if (refusal !== null) return refusal;
  const place = sim.world.common.place;
  const letters = lettersIn(sim.content, sim.world, place, ORDERS.mailWaiting);
  if (letters.length === 0) return 'mail-none';
  for (const letter of letters) {
    remember(sim, mailKey(place, letter.id), ORDERS.mailTaken, player);
    if (letter.attach.length > 0) applyEffects(sim, player, letter.attach);
  }
  sim.emit({ type: 'mail_taken', player, place, letters: letters.map((l) => l.id) });
  return null;
}

function onIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  let refusal: string | null;
  if (intent.type === 'order_deliver') refusal = deliverLine(sim, player, intent.line);
  else if (intent.type === 'mail_take') refusal = takeMail(sim, player);
  else return;
  if (refusal !== null) sim.emit({ type: 'refused', player, reason: refusal, target: null });
}

export const orderSystem: GameSystem = { id: 'commandes', step, intent: onIntent };
