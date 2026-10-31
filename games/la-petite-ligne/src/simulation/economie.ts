/**
 * Économie de la démo: bourse commune (EC-01), épicerie d'Odette (EC-02,
 * EC-03), catalogue de la coopérative, gros achats à deux (EC-04), caisse et
 * commande du samedi (EC-05, EC-08).
 */
import type { Character, CharacterId, ItemStack, PurchaseRequest, Quality } from '../etat/types';
import { orderSatisfied } from './conditions';
import { type Sim, character, distance, emit, itemName, message, newId, notify, partnerOf, point, say } from './contexte';
import { queueHint } from './astuces';
import { addStack, countInBag, countInStacks, giveToCharacter, takeFromBag, takeFromStacks } from './sac';

/** Un habitant tient la boutique (activité `serve` au comptoir). */
export function shopOpen(sim: Sim): boolean {
  const counter = sim.map.points.grocery_counter;
  return sim.world.villagers.some(
    (v) => v.visible && v.activity === 'serve' && counter !== undefined && distance(v.pos, counter) <= sim.content.settings.feel.pointRadius * 2,
  );
}

export function nearPoint(sim: Sim, c: Character, id: string, range: number): boolean {
  const at = sim.map.points[id];
  return at !== undefined && distance(c.pos, at) <= range;
}

function canShop(sim: Sim, c: Character): boolean {
  return c.menu === 'shop' || nearPoint(sim, c, 'grocery_counter', sim.content.settings.ranges.talk);
}

function canUseCatalogue(sim: Sim, c: Character): boolean {
  return c.menu === 'catalogue' || nearPoint(sim, c, 'notice_board', sim.content.settings.ranges.talk);
}

function canUseCrate(sim: Sim, c: Character): boolean {
  return c.menu === 'crate' || nearPoint(sim, c, 'coop_crate', sim.content.settings.ranges.talk);
}

function catalogueOpen(sim: Sim): boolean {
  const { day, minutes } = sim.world.clock;
  const deadline = sim.content.settings.economy.catalogue.orderDeadline;
  return day < deadline.day || (day === deadline.day && minutes < deadline.time);
}

function purchasePrice(sim: Sim, request: PurchaseRequest): number {
  return (sim.content.items[request.item]?.buyPrice ?? 0) * request.count;
}

function deliver(sim: Sim, c: Character, request: PurchaseRequest, price: number): void {
  if (request.source === 'catalogue') {
    for (let i = 0; i < request.count; i++) sim.world.catalogueOrders.push(request.item);
    say(sim, c.id, 'catalogue_ordered');
  } else {
    giveToCharacter(sim, c, request.item, 'ordinary', request.count);
  }
  emit(sim, { type: 'bought', by: c.id, item: request.item, count: request.count, price });
}

/** Achat (épicerie ou catalogue). Au-delà du seuil, une proposition chez l'autre. */
export function purchase(sim: Sim, c: Character, request: PurchaseRequest): void {
  const def = sim.content.items[request.item];
  if (def === undefined) return;
  if (def.buyPrice === null || def.shop !== request.source || request.count < 1) return;
  if (request.source === 'grocery' && (!canShop(sim, c) || !shopOpen(sim))) return;
  if (request.source === 'catalogue') {
    if (!canUseCatalogue(sim, c)) return;
    if (!catalogueOpen(sim)) {
      say(sim, c.id, 'catalogue_closed');
      return;
    }
  }
  const price = purchasePrice(sim, request);
  if (price > sim.world.purse) {
    say(sim, c.id, 'not_enough_money', { missing: price - sim.world.purse });
    return;
  }
  if (price >= sim.content.settings.economy.bigPurchaseThreshold) {
    queueHint(sim, c.id, { on: 'big_purchase_attempt' });
    propose(sim, c, request, price);
    return;
  }
  sim.world.purse -= price;
  deliver(sim, c, request, price);
}

function propose(sim: Sim, c: Character, request: PurchaseRequest, price: number): void {
  withdraw(sim, c.id, false);
  const id = newId(sim, 'o');
  sim.world.purse -= price;
  sim.world.proposals.push({ id, by: c.id, purchase: request, price });
  const other = partnerOf(c.id);
  notify(
    sim,
    other,
    'proposal',
    message(sim, 'big_purchase_proposal', { partner: c.name, item: itemName(sim, request.item, request.count), price }),
    { proposal: id },
  );
  emit(sim, { type: 'proposal', by: c.id, proposal: id });
}

/** Retire la proposition de ce joueur (la somme réservée revient à la bourse). */
export function withdraw(sim: Sim, by: CharacterId, announce: boolean): void {
  const index = sim.world.proposals.findIndex((p) => p.by === by);
  if (index < 0) return;
  const [proposal] = sim.world.proposals.splice(index, 1);
  if (proposal === undefined) return;
  sim.world.purse += proposal.price;
  if (announce) say(sim, 'both', 'big_purchase_cancelled');
  emit(sim, { type: 'proposal_resolved', proposal: proposal.id, accepted: false });
}

export function answerProposal(sim: Sim, c: Character, id: string, accept: boolean): void {
  const index = sim.world.proposals.findIndex((p) => p.id === id && p.by !== c.id);
  if (index < 0) return;
  const [proposal] = sim.world.proposals.splice(index, 1);
  if (proposal === undefined) return;
  const buyer = character(sim, proposal.by);
  if (accept) {
    deliver(sim, buyer, proposal.purchase, proposal.price);
    say(sim, 'both', 'big_purchase_accepted', { item: itemName(sim, proposal.purchase.item, proposal.purchase.count) });
  } else {
    sim.world.purse += proposal.price;
    say(sim, 'both', 'big_purchase_declined');
  }
  emit(sim, { type: 'proposal_resolved', proposal: proposal.id, accepted: accept });
}

/** Une proposition sans réponse s'annule à la nuit (EC-04). */
export function cancelProposalsAtNight(sim: Sim): void {
  for (const p of [...sim.world.proposals]) withdraw(sim, p.by, false);
}

function qualityMultiplier(sim: Sim, quality: Quality): number {
  return sim.content.qualities[quality].priceMultiplier;
}

/** Vendre à Odette: 80 % du prix, plafond quotidien (EC-02). */
export function sell(sim: Sim, c: Character, item: string, quality: Quality, count: number): void {
  const s = sim.content.settings.economy.grocer;
  const def = sim.content.items[item];
  if (def?.sellPrice === null || def === undefined || count < 1 || !canShop(sim, c) || !shopOpen(sim)) return;
  if (!sim.world.flags.includes(s.buysAfterFlag)) {
    say(sim, c.id, 'grocer_not_buying');
    return;
  }
  const unit = def.sellPrice * qualityMultiplier(sim, quality) * s.buyRate;
  const room = s.dailyCap - sim.world.grocerSoldToday;
  const have = countInBag(c, item, quality);
  let n = Math.min(count, have);
  while (n > 0 && Math.round(unit * n) > room) n--;
  if (n === 0) {
    if (have > 0) say(sim, c.id, 'grocer_daily_cap');
    return;
  }
  takeFromBag(c, item, n, quality);
  const price = Math.round(unit * n);
  sim.world.purse += price;
  sim.world.grocerSoldToday += price;
  emit(sim, { type: 'sold', by: c.id, item, count: n, price });
  if (n < count && have > n) say(sim, c.id, 'grocer_daily_cap');
}

// ---------------------------------------------------------------------------
// Caisse de la coopérative et coffre

function moveStacks(
  sim: Sim,
  c: Character,
  target: ItemStack[],
  item: string,
  quality: Quality,
  count: number,
  toBox: boolean,
): number {
  if (toBox) {
    const taken = takeFromBag(c, item, count, quality);
    const n = taken.reduce((sum, s) => sum + s.count, 0);
    addStack(target, item, quality, n);
    return n;
  }
  const taken = takeFromStacks(target, item, Math.min(count, countInStacks(target, item, quality)), quality);
  const n = taken.reduce((sum, s) => sum + s.count, 0);
  if (n > 0) giveToCharacter(sim, c, item, quality, n);
  return n;
}

export function crateMove(sim: Sim, c: Character, item: string, quality: Quality, count: number, deposit: boolean): void {
  if (!canUseCrate(sim, c) || sim.world.orderResult !== null || count < 1) return;
  const n = moveStacks(sim, c, sim.world.crate, item, quality, count, deposit);
  if (n === 0) return;
  if (deposit) {
    say(sim, c.id, 'crate_deposited', { count: n, item: itemName(sim, item, n) });
    emit(sim, { type: 'deposited', by: c.id, item, count: n });
  } else {
    emit(sim, { type: 'picked_up', by: c.id, item, count: n });
  }
}

export function nearChest(sim: Sim, c: Character): boolean {
  if (c.menu === 'chest') return true;
  const range = sim.content.settings.ranges.action + 1;
  return sim.world.furniture.some((f) => {
    if (sim.content.items[f.item]?.storage !== 'cellar') return false;
    return distance(c.pos, { x: f.cell.cx + 0.5, y: f.cell.cy + 0.5 }) <= range;
  });
}

export function chestMove(sim: Sim, c: Character, item: string, quality: Quality, count: number, deposit: boolean): void {
  if (!nearChest(sim, c) || count < 1) return;
  const n = moveStacks(sim, c, sim.world.cellar, item, quality, count, deposit);
  if (n > 0) emit(sim, deposit ? { type: 'deposited', by: c.id, item, count: n } : { type: 'picked_up', by: c.id, item, count: n });
}

/**
 * Paiement au départ du train (EC-08, README des données 2.9): chaque ligne
 * remplie à `linePremium` fois le prix de base, la commande complète
 * `fullBonus` en plus, le reste à `extraItemsRate` fois le prix.
 */
export function payOrder(sim: Sim): void {
  const { world } = sim;
  if (world.orderResult !== null) return;
  const o = sim.content.settings.order;
  const complete = orderSatisfied(sim);
  let linesDone = 0;
  let linesPay = 0;
  for (const line of o.lines) {
    if (countInStacks(world.crate, line.item) < line.count) continue;
    linesDone++;
    takeFromStacks(world.crate, line.item, line.count);
    linesPay += line.count * (sim.content.items[line.item]?.sellPrice ?? 0) * o.linePremium;
  }
  let extras = 0;
  for (const stack of world.crate) {
    const price = sim.content.items[stack.item]?.sellPrice ?? null;
    if (price === null) {
      // Rien n'est perdu: ce que la coopérative n'achète pas revient au cellier.
      addStack(world.cellar, stack.item, stack.quality, stack.count);
    } else {
      extras += stack.count * price * o.extraItemsRate;
    }
  }
  world.crate = [];
  const amount = Math.round(linesPay * (complete ? 1 + o.fullBonus : 1) + extras);
  world.purse += amount;
  world.orderResult = { linesDone, linesTotal: o.lines.length, complete, amount };
  emit(sim, { type: 'order_paid', amount, linesDone });
}

/** Les colis du catalogue arrivent par le train, dans le cellier (EC-03). */
export function deliverCatalogue(sim: Sim): void {
  for (const item of sim.world.catalogueOrders) addStack(sim.world.cellar, item, 'ordinary', 1);
  sim.world.catalogueOrders = [];
}

export function crateReachable(sim: Sim, c: Character): boolean {
  return nearPoint(sim, c, 'coop_crate', sim.content.settings.ranges.talk);
}

export function pointReachable(sim: Sim, c: Character, id: string): boolean {
  return distance(c.pos, point(sim, id)) <= sim.content.settings.ranges.talk;
}
