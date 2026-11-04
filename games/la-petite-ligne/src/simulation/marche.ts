/**
 * Le marché du dimanche (0.12, section 2.3 de `v0-12-conception.md`): l'étal se garnit depuis le
 * sac (les deux joueurs, le même étal), un prix pour tout l'étal (Doux, Juste, Fort), les six
 * habitants viennent chacun une fois avec leur liste, deux à la fois au plus (la file de deux),
 * un joueur derrière l'étal sert (Espace sur l'habitant). Sans personne derrière l'étal, rien ne
 * sort et rien n'entre. À 13 h, ce qui reste retourne au cellier. Tirages par la graine.
 */
import { weekdayOf } from '../donnees/calendrier';
import type { MarketLevel } from '../donnees/marche';
import {
  behindStall,
  buyerSpot,
  nearStall,
  onStall,
  stallPose,
  stallSetUp,
  stallSlots,
  stallUnitPrice,
} from '../etat/marche';
import { unitDraw } from '../etat/tirage';
import type { Character, ItemStack, MarketBuyer, MarketState, Quality, Vec2 } from '../etat/types';
import { crossed } from './train';
import { type Sim, bump, emit, format, itemName, itemWithArticle, say } from './contexte';
import { countInBag, takeFromBag } from './sac';
import { storeAtHome } from './rangement';
import { noteGoodsSeen } from './epicerie';
import { addBond } from './amitie';

/** Identifiant de point des places de la file (résolu par `marketPoint`, pas dans la carte). */
export const MARKET_SPOT_PREFIX = 'market_spot:';

function marketOn(sim: Sim): boolean {
  const m = sim.content.market;
  return (
    m !== null && stallSetUp(sim.content, sim.world) && weekdayOf(sim.world.clock.day) === m.weekday
  );
}

/** L'étal du monde (créé à la première demande, quand l'étal est posé). */
function stallState(sim: Sim): MarketState | null {
  const m = sim.content.market;
  if (m === null || !stallSetUp(sim.content, sim.world)) return null;
  sim.world.market ??= { day: 0, level: m.defaultLevel, stall: [], buyers: [] };
  return sim.world.market;
}

/** Position d'une place de la file (`market_spot:0`), ou `null` si ce n'en est pas une. */
export function marketPoint(sim: Sim, pointId: string): Vec2 | null {
  if (!pointId.startsWith(MARKET_SPOT_PREFIX)) return null;
  const pose = stallPose(sim.content, sim.map);
  return pose === null ? null : buyerSpot(pose, Number(pointId.slice(MARKET_SPOT_PREFIX.length)));
}

/** Où se rend un habitant client du marché à cette heure, ou `null` (emploi du temps ordinaire). */
export function marketEntry(
  sim: Sim,
  villager: string,
): { point: string; activity: string } | null {
  const market = sim.world.market;
  if (market?.day !== sim.world.clock.day) return null;
  const b = market.buyers.find((x) => x.villager === villager);
  if (b === undefined || b.spot === null || (b.status !== 'walking' && b.status !== 'waiting'))
    return null;
  return { point: `${MARKET_SPOT_PREFIX}${String(b.spot)}`, activity: 'stand' };
}

// ---------------------------------------------------------------------------
// Garnir l'étal, choisir le prix

export function stallMove(
  sim: Sim,
  c: Character,
  item: string,
  quality: Quality,
  count: number,
  deposit: boolean,
): void {
  const market = stallState(sim);
  if (market === null || count < 1 || !nearStall(sim.content, sim.map, c.pos)) return;
  if (deposit) {
    const def = sim.content.items[item];
    if (def?.sellPrice === null || def === undefined) return;
    const m = sim.content.market;
    // Les cagettes de Basile (quête `market_crates`): posées, elles deviennent les cases de l'étal.
    if (m !== null && item === m.crateItem && !sim.world.flags.includes(m.cratesFlag)) {
      const n = takeFromBag(c, item, Math.min(count, countInBag(c, item, quality)), quality).reduce(
        (sum, s) => sum + s.count,
        0,
      );
      if (n === 0) return;
      bump(sim, `stall_given:${item}`, c.id, n);
      bump(sim, 'stall_given', c.id, n);
      emit(sim, { type: 'deposited', by: c.id, item, count: n });
      sim.runtime.changed = true;
      return;
    }
    const existing = market.stall.find((s) => s.item === item && s.quality === quality);
    if (existing === undefined && market.stall.length >= stallSlots(sim.content, sim.world)) {
      say(sim, c.id, 'stall_full');
      return;
    }
    const room = def.stack - (existing?.count ?? 0);
    const taken = takeFromBag(
      c,
      item,
      Math.min(count, room, countInBag(c, item, quality)),
      quality,
    );
    const n = taken.reduce((sum, s) => sum + s.count, 0);
    if (n === 0) return;
    // Compteurs des quêtes du marché (`donnees/README.md`, section 3.1).
    if (!market.stall.some((s) => s.item === item)) bump(sim, 'stall_kind', c.id);
    bump(sim, `stall_given:${item}`, c.id, n);
    bump(sim, 'stall_given', c.id, n);
    if (existing === undefined) market.stall.push({ item, quality, count: n });
    else existing.count += n;
    emit(sim, { type: 'deposited', by: c.id, item, count: n });
  } else {
    const stack = market.stall.find((s) => s.item === item && s.quality === quality);
    if (stack === undefined) return;
    const n = Math.min(count, stack.count);
    stack.count -= n;
    if (stack.count === 0) market.stall.splice(market.stall.indexOf(stack), 1);
    giveBack(sim, c, item, quality, n);
    emit(sim, { type: 'picked_up', by: c.id, item, count: n });
  }
  sim.runtime.changed = true;
}

function giveBack(sim: Sim, c: Character, item: string, quality: Quality, count: number): void {
  // Le sac d'abord; ce qui n'y tient pas va au cellier (rien n'est perdu).
  let left = count;
  const def = sim.content.items[item];
  const stackMax = def?.stack ?? 99;
  for (const [i, s] of c.bag.entries()) {
    if (left === 0) break;
    if (s !== null && s.item === item && s.quality === quality && s.count < stackMax) {
      const add = Math.min(left, stackMax - s.count);
      s.count += add;
      left -= add;
    } else if (s === null) {
      const add = Math.min(left, stackMax);
      c.bag[i] = { item, quality, count: add };
      left -= add;
    }
  }
  if (left > 0) storeAtHome(sim, item, quality, left);
}

export function setMarketLevel(sim: Sim, c: Character, level: MarketLevel): void {
  const market = stallState(sim);
  if (market === null || !nearStall(sim.content, sim.map, c.pos) || market.level === level) return;
  market.level = level;
  sim.runtime.changed = true;
}

// ---------------------------------------------------------------------------
// Les clients du dimanche

function hallBuilt(sim: Sim): boolean {
  const m = sim.content.market;
  return m !== null && (sim.world.improvements[m.hallImprovement]?.builtDay ?? null) !== null;
}

/** Les clients du jour: qui vient (la pluie en retient), quand, et avec quelle liste. */
function drawBuyers(sim: Sim, day: number): MarketBuyer[] {
  const m = sim.content.market;
  if (m === null) return [];
  const seed = sim.world.seed;
  const rain = sim.world.weather === 'rain' && !hallBuilt(sim);
  const span = Math.max(0, m.arrivals.to - m.arrivals.from);
  const out: MarketBuyer[] = [];
  for (const def of m.buyers) {
    if (!sim.world.villagers.some((v) => v.id === def.villager)) continue;
    if (rain && unitDraw(seed, `marche:pluie:${def.villager}`, day) < m.rainStayHome) continue;
    const wants = def.wants.filter((item) => sim.world.goodsSeen.includes(item));
    if (wants.length === 0) continue;
    const draw = (k: string): number => unitDraw(seed, `marche:${def.villager}:${k}`, day);
    const lines = Math.min(
      wants.length,
      m.list.minLines + Math.floor(draw('lignes') * (m.list.maxLines - m.list.minLines + 1)),
    );
    const start = Math.floor(draw('debut') * wants.length);
    const list = Array.from({ length: lines }, (_, i) => ({
      item: wants[(start + i) % wants.length] ?? def.likes,
      count:
        m.list.minCount +
        Math.floor(draw(`n${String(i)}`) * (m.list.maxCount - m.list.minCount + 1)),
    }));
    out.push({
      villager: def.villager,
      at: m.arrivals.from + Math.floor(draw('heure') * span),
      list,
      status: 'coming',
      spot: null,
      since: 0,
      returned: false,
    });
  }
  // Jamais deux arrivées à moins de `minGapMinutes` (la quête du coup de feu les rapproche à part).
  out.sort((a, b) => a.at - b.at || a.villager.localeCompare(b.villager));
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1];
    const b = out[i];
    if (prev !== undefined && b !== undefined && b.at - prev.at < m.arrivals.minGapMinutes)
      b.at = prev.at + m.arrivals.minGapMinutes;
  }
  return out;
}

/** Une unité de plus pour chacun: fanions de Solange, halle; balance: légumes et cueillettes. */
function extraUnits(sim: Sim, list: MarketBuyer['list']): MarketBuyer['list'] {
  const m = sim.content.market;
  if (m === null || list.length === 0) return list;
  const out = list.map((l) => ({ ...l }));
  const first = out[0];
  if (first !== undefined) {
    if (sim.world.flags.includes(m.garlandFlag)) first.count += 1;
    if (hallBuilt(sim)) first.count += 1;
  }
  const owned =
    sim.world.cellar.some((s) => s.item === m.scaleItem) ||
    sim.world.characters.some((c) => countInBag(c, m.scaleItem) > 0);
  if (owned) {
    const line = out.find((l) =>
      m.scaleCategories.includes(sim.content.items[l.item]?.category ?? ''),
    );
    if (line !== undefined) line.count += 1;
  }
  return out;
}

function villagerName(sim: Sim, id: string): string {
  return sim.content.villagers.find((v) => v.id === id)?.firstName ?? id;
}

/** Prend `count` unités d'un article sur l'étal (la belle qualité d'abord), au prix du niveau. */
function takeFromStall(
  sim: Sim,
  stall: ItemStack[],
  item: string,
  count: number,
  level: MarketLevel,
): { count: number; price: number } {
  let left = count;
  let price = 0;
  const stacks = stall
    .filter((s) => s.item === item)
    .sort((a, b) => (a.quality === b.quality ? 0 : a.quality === 'fine' ? -1 : 1));
  for (const s of stacks) {
    const n = Math.min(left, s.count);
    s.count -= n;
    left -= n;
    price += n * stallUnitPrice(sim.content, item, s.quality, level);
    if (left === 0) break;
  }
  for (let i = stall.length - 1; i >= 0; i--) if (stall[i]?.count === 0) stall.splice(i, 1);
  return { count: count - left, price };
}

/**
 * Servir un client qui attend devant l'étal (Espace sur lui, derrière l'étal). Ce qui est sur l'étal
 * et sur sa liste part au prix de l'étal; un article manquant: une unité de ce qu'il aime s'il y en a.
 * Un refus (le prix): il prend quand même un article de sa liste au prix doux.
 */
export function serveBuyer(sim: Sim, c: Character, villager: string): boolean {
  const m = sim.content.market;
  const market = sim.world.market;
  if (m === null || market?.day !== sim.world.clock.day) return false;
  const b = market.buyers.find((x) => x.villager === villager && x.status === 'waiting');
  if (b === undefined || !behindStall(sim.content, sim.map, c.pos)) return false;
  const name = villagerName(sim, villager);
  const level = m.levels[market.level];
  const served = sim.world.counters.duo.market_served ?? 0;
  const accepted =
    unitDraw(sim.world.seed, `marche:accord:${villager}:${String(served)}`, sim.world.clock.day) <
    level.accept;
  const sold: { item: string; count: number }[] = [];
  let amount = 0;
  if (accepted) {
    let missing = false;
    for (const line of extraUnits(sim, b.list)) {
      const got = takeFromStall(sim, market.stall, line.item, line.count, market.level);
      if (got.count === 0) missing = true;
      else sold.push({ item: line.item, count: got.count });
      amount += got.price;
    }
    const like = m.buyers.find((x) => x.villager === villager)?.likes;
    if (missing && like !== undefined && onStall(market.stall, like) > 0) {
      const got = takeFromStall(sim, market.stall, like, 1, market.level);
      sold.push({ item: like, count: got.count });
      amount += got.price;
    }
  } else {
    say(sim, 'both', 'market_refused', { name });
    emit(sim, { type: 'market_refused', by: c.id, villager });
    const line = b.list.find((l) => onStall(market.stall, l.item) > 0);
    if (line !== undefined) {
      const got = takeFromStall(sim, market.stall, line.item, 1, 'soft');
      sold.push({ item: line.item, count: got.count });
      amount += got.price;
    }
  }
  // Deux clients de la file servis chacun par un joueur, le premier encore là quand le second est arrivé.
  const together = market.buyers.some(
    (o) =>
      o !== b &&
      o.status === 'served' &&
      o.servedBy !== undefined &&
      o.servedBy !== c.id &&
      (o.servedAt ?? -1) >= b.since,
  );
  b.status = 'served';
  b.spot = null;
  b.servedBy = c.id;
  b.servedAt = sim.world.clock.minutes;
  bump(sim, 'market_served', c.id);
  if (together) bump(sim, 'market_served_together', null);
  bump(sim, `market_served:${villager}`, c.id);
  // 0.13 (lot H2): la vente au prix « Doux » nourrit son lien (le compteur `market_bond:` de la 0.12 passe dans `bonds` à la reprise).
  if (accepted && level.bond > 0) addBond(sim, villager, level.bond, c.id);
  sim.runtime.changed = true;
  if (sold.length === 0) {
    say(sim, 'both', 'market_nothing', { name });
    return true;
  }
  sim.world.purse += amount;
  bump(sim, 'market_earned', null, amount);
  say(sim, 'both', 'market_sale', { name, items: joinItems(sim, sold), amount });
  emit(sim, { type: 'market_sale', by: c.id, villager, items: sold, amount });
  return true;
}

function freeSpot(market: MarketState): number | null {
  for (const spot of [0, 1]) {
    if (
      !market.buyers.some(
        (b) => b.spot === spot && (b.status === 'walking' || b.status === 'waiting'),
      )
    )
      return spot;
  }
  return null;
}

function listText(sim: Sim, list: MarketBuyer['list']): string {
  return joinItems(sim, list);
}

/** « 2 mûres, 1 œuf et 3 radis » (`textes.orderFormat`, comme la commande du samedi). */
export function joinItems(sim: Sim, list: readonly { item: string; count: number }[]): string {
  const f = sim.content.texts.orderFormat;
  const parts = list.map((l) =>
    format(f.line, { count: l.count, item: itemName(sim, l.item, l.count) }),
  );
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(f.separator)}${f.lastSeparator}${parts[parts.length - 1] ?? ''}`;
}

/** Le marché à chaque pas: ouverture à 8 h, arrivées, attente, fermeture à 13 h. */
export function marketClock(sim: Sim, before: number, after: number): void {
  const m = sim.content.market;
  if (m === null || !marketOn(sim)) return;
  const market = stallState(sim);
  if (market === null) return;
  const day = sim.world.clock.day;
  if (after >= m.opens && after < m.closes && market.day !== day) {
    market.day = day;
    noteGoodsSeen(sim, market.stall);
    market.buyers = drawBuyers(sim, day);
    say(sim, 'both', 'market_opened');
    emit(sim, { type: 'market_opened' });
    sim.runtime.changed = true;
  }
  if (market.day !== day) return;
  if (crossed(before, after, m.closes)) {
    closeMarket(sim, market);
    return;
  }
  if (after >= m.closes) return;
  const pose = stallPose(sim.content, sim.map);
  for (const b of market.buyers) {
    if (b.status === 'coming' && after >= b.at) {
      const spot = freeSpot(market);
      if (spot === null) continue;
      b.spot = spot;
      b.status = 'walking';
      sim.runtime.changed = true;
    }
    if (b.status === 'walking' && pose !== null && b.spot !== null) {
      const v = sim.world.villagers.find((x) => x.id === b.villager);
      const at = buyerSpot(pose, b.spot);
      if (v !== undefined && Math.hypot(v.pos.x - at.x, v.pos.y - at.y) < 0.6) {
        b.status = 'waiting';
        b.since = after;
        const name = villagerName(sim, b.villager);
        say(sim, 'both', 'market_buyer', { name, list: listText(sim, extraUnits(sim, b.list)) });
        const arrive = `market_arrive_${b.villager}`;
        if (Object.hasOwn(sim.content.texts.messages, arrive)) say(sim, 'both', arrive);
        emit(sim, { type: 'market_buyer_arrived', villager: b.villager });
        sim.runtime.changed = true;
      }
    }
    if (b.status === 'waiting' && after - b.since >= m.waitMinutes) {
      const name = villagerName(sim, b.villager);
      b.spot = null;
      if (b.returned) {
        b.status = 'gone';
        say(sim, 'both', 'market_gone', { name });
      } else {
        b.status = 'coming';
        b.returned = true;
        b.at = after + m.returnAfterMinutes;
        say(sim, 'both', 'market_back_later', { name });
      }
      sim.runtime.changed = true;
    }
  }
}

/** 13 h: ce qui reste sur l'étal retourne au cellier; les clients qui n'ont pas été servis rentrent. */
function closeMarket(sim: Sim, market: MarketState): void {
  for (const s of market.stall) storeAtHome(sim, s.item, s.quality, s.count);
  const had = market.stall.length > 0;
  market.stall = [];
  for (const b of market.buyers) {
    if (b.status !== 'served') b.status = 'gone';
    b.spot = null;
  }
  if (had) say(sim, 'both', 'market_closed');
  emit(sim, { type: 'market_closed' });
  sim.runtime.changed = true;
}

/** Un mot pour le robot et les tests: l'objet avec son article (« 2 mûres »). */
export function marketItemLabel(sim: Sim, item: string, count: number): string {
  return itemWithArticle(sim, item, count);
}
