/**
 * Clients (cahier 4.4, 4.6, 4.10): arrivée et renoncement, file à la caisse, commande payée,
 * attente au passe, place, séjour et recommandes, départ, satisfaction, pourboire, réputation,
 * livre d'or, vaisselle laissée. Reproduit `Service` de `simulations/cosy_cafe.py` client par client,
 * en temps réel. Les marcheurs (positions) vivent chez l'hôte seulement, hors du monde.
 */
import type { PlayerIndex, World } from '../etat/monde';
import type { Vec2 } from '../simulation/geometrie';
import { groupOrder, priceIndex } from './attrait';
import type { ClienteleContent, Profile, Recipe } from './donnees';
import { addPoints, consume, inStock, linePrice, type Ctx } from './economie';
import type { Group, PlaceKind, Quality } from './etat';
import { onRegularServed, regularOrder } from './habitues';
import { findPath, navGrid, planPoint, queueSpot, seatList, type Seat } from './places';
import { sceneHooks } from './scenes';

// ---------------------------------------------------------------------------------------------
// Marcheurs (hôte seulement)

export type Anim = 'walk' | 'idle' | 'sit' | 'drink' | 'sit_drink';

export interface Walker {
  x: number;
  z: number;
  yawDeg: number;
  path: Vec2[];
  key: string;
  moving: boolean;
}

interface Runtime {
  readonly walkers: Map<number, Walker>;
}

const runtimes = new WeakMap<World, Runtime>();

export function runtimeOf(world: World): Runtime {
  let r = runtimes.get(world);
  if (r === undefined) {
    r = { walkers: new Map() };
    runtimes.set(world, r);
  }
  return r;
}

/** Clients debout et leur position (hôte): ce que le canal 7 envoie à l'invité. */
export function hostWalkers(world: World): ReadonlyMap<number, Walker> {
  return runtimeOf(world).walkers;
}

function entrance(ctx: Ctx): Vec2 {
  return planPoint(ctx.sim.content, 'entrance') ?? { x: 9.4, z: 16 };
}

function walkerOf(ctx: Ctx, g: Group): Walker {
  const rt = runtimeOf(ctx.sim.world);
  let w = rt.walkers.get(g.id);
  if (w === undefined) {
    // Reprise d'une sauvegarde: le marcheur repart d'un point logique de son étape.
    const seat = g.stage === 'seated' ? placePoint(ctx, g) : null;
    const start = seat ?? (g.stage === 'entering' ? entrance(ctx) : queueSpot(ctx.sim.content, 0));
    w = { x: start.x, z: start.z, yawDeg: 0, path: [], key: '', moving: false };
    rt.walkers.set(g.id, w);
  }
  return w;
}

/** Envoie le marcheur vers `to` (chemin recalculé seulement si la destination change). */
function goTo(ctx: Ctx, g: Group, to: Vec2, key: string): Walker {
  const w = walkerOf(ctx, g);
  if (w.key !== key) {
    w.key = key;
    const grid = navGrid(ctx.sim, ctx.cc, ctx.s);
    w.path = findPath(grid, w, to, ctx.cc.rules.walk.searchNodes);
  }
  return w;
}

function arrived(w: Walker): boolean {
  return w.path.length === 0;
}

function stepWalkers(ctx: Ctx): void {
  const speed = ctx.cc.rules.walk.speed;
  for (const w of runtimeOf(ctx.sim.world).walkers.values()) {
    let budget = speed * ctx.sim.dt;
    w.moving = false;
    while (budget > 0 && w.path.length > 0) {
      const p = w.path[0];
      if (p === undefined) break;
      const dx = p.x - w.x;
      const dz = p.z - w.z;
      const d = Math.hypot(dx, dz);
      if (d <= budget) {
        w.x = p.x;
        w.z = p.z;
        budget -= d;
        w.path.shift();
      } else {
        w.x += (dx / d) * budget;
        w.z += (dz / d) * budget;
        budget = 0;
      }
      if (d > 1e-6) w.yawDeg = (Math.atan2(-dx, -dz) * 180) / Math.PI;
      w.moving = true;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Temps

/** Secondes réelles par minute de jeu (rythme paisible compris). */
export function spm(ctx: Ctx): number {
  return ctx.s.pace === 'peaceful'
    ? ctx.cc.days.peacefulSecondsPerGameMinute
    : ctx.cc.days.secondsPerGameMinute;
}

export function closeSec(ctx: Ctx): number {
  return (ctx.cc.days.close - ctx.cc.days.open) * spm(ctx);
}

/** Minute de jeu de la journée (480 pour 8 h). */
export function clockMinutes(
  cc: ClienteleContent,
  s: { serviceSec: number; pace: 'normal' | 'peaceful' },
): number {
  const k =
    s.pace === 'peaceful' ? cc.days.peacefulSecondsPerGameMinute : cc.days.secondsPerGameMinute;
  return cc.days.open + s.serviceSec / k;
}

// ---------------------------------------------------------------------------------------------
// Groupes

function profileOf(ctx: Ctx, g: Group): Profile {
  const p = ctx.cc.profiles.get(g.profile) ?? ctx.cc.profileList[0];
  if (p === undefined) throw new Error('aucun profil');
  return p;
}

export function groupById(world: World, id: number): Group | undefined {
  return world.clientele.groups.find((g) => g.id === id);
}

export function presentPeople(ctx: Ctx): number {
  return ctx.s.groups.reduce((sum, g) => sum + g.size, 0);
}

function queueGroups(ctx: Ctx): Group[] {
  return ctx.s.groups.filter(
    (g) => g.stage === 'entering' || g.stage === 'queue' || g.stage === 'register',
  );
}

/** Recettes servables maintenant: sur l'ardoise et en stock. */
export function availableRecipes(ctx: Ctx): Recipe[] {
  const out: Recipe[] = [];
  for (const [id] of ctx.s.slate) {
    const r = ctx.cc.recipes.get(id);
    if (r !== undefined && inStock(ctx.cc, ctx.s, id)) out.push(r);
  }
  return out;
}

export interface SpawnOptions {
  readonly profile: string;
  readonly size: number;
  readonly items: readonly string[];
  readonly regular?: string | null;
  readonly role?: string | null;
  readonly takeAway?: boolean;
  readonly flatRate?: boolean;
}

/** Un groupe entre (file d'attente); rend son identifiant. */
export function spawnGroup(ctx: Ctx, o: SpawnOptions): Group {
  const g: Group = {
    id: ctx.s.nextGroupId++,
    profile: o.profile,
    size: o.size,
    regular: o.regular ?? null,
    role: o.role ?? null,
    stage: 'entering',
    since: ctx.s.serviceSec,
    arrivedAt: ctx.s.serviceSec,
    items: [...o.items],
    paid: null,
    flatRate: o.flatRate ?? false,
    takeAway: o.takeAway ?? false,
    place: 'none',
    seats: [],
    table: null,
    servedAt: null,
    leaveAt: null,
    nextReorder: null,
    open: 0,
    orderedBy: null,
    qualities: [],
    latteArt: false,
    homemade: false,
    chat: false,
    asUsual: false,
    dirtySeat: false,
  };
  ctx.s.groups.push(g);
  const w = walkerOf(ctx, g);
  const e = entrance(ctx);
  w.x = e.x;
  w.z = e.z;
  ctx.sim.emit({ type: 'clientele-arrived', group: g.id, profile: g.profile });
  return g;
}

/** Règles CL-02 et CL-03: on n'entre pas devant une attente trop longue ni dans un café plein. */
function refuses(ctx: Ctx, p: Profile, size: number): 'wait' | 'full' | null {
  const r = ctx.cc.rules;
  const waiting = ctx.s.groups.filter((g) => g.open > 0 && g.servedAt === null).length;
  const visible = queueGroups(ctx).length + waiting;
  const estimated = (visible * r.estimatedSecondsPerGroup) / 2;
  const full = presentPeople(ctx) + size > r.presentMax - 2;
  const inQueue = queueGroups(ctx).reduce((sum, g) => sum + g.size, 0);
  if (full || inQueue + size > r.queuePlaces) return 'full';
  if (estimated > p.patienceSeconds) return 'wait';
  return null;
}

function arrive(ctx: Ctx, profileId: string, size: number, takeAway: boolean): void {
  const p = ctx.cc.profiles.get(profileId);
  if (p === undefined) return;
  const items = groupOrder(ctx.cc, ctx.sim.random, p, size, availableRecipes(ctx));
  if (items.length === 0) return;
  const why = refuses(ctx, p, size);
  if (why !== null) {
    ctx.s.today.left++;
    ctx.sim.emit({ type: 'clientele-passed-by', profile: profileId, full: why === 'full' });
    return;
  }
  spawnGroup(ctx, { profile: profileId, size, items, takeAway });
}

/** Prendre la commande du groupe à la caisse: il paie, le service reçoit le ticket. */
export function takeOrder(ctx: Ctx, player: PlayerIndex | null): Group | string {
  const g = ctx.s.groups.find((x) => x.stage === 'register');
  if (g === undefined) return 'Personne à la caisse';
  if (g.regular !== null && g.items.length === 0) g.items = regularOrder(ctx, g.regular);
  const items = g.items.filter((id) => inStock(ctx.cc, ctx.s, id));
  if (items.length === 0) {
    // Plus rien de ce qu'il voulait: il choisit autre chose de ses envies (ST-05).
    const p = profileOf(ctx, g);
    items.push(...groupOrder(ctx.cc, ctx.sim.random, p, g.size, availableRecipes(ctx)));
  }
  if (items.length === 0) return 'Plus rien à servir sur l’ardoise';
  g.items = items;
  pay(ctx, g, items, player, false);
  g.stage = 'waiting';
  g.since = ctx.s.serviceSec;
  sceneHooks.onOrder?.(ctx, g, player);
  return g;
}

function pay(
  ctx: Ctx,
  g: Group,
  items: readonly string[],
  player: PlayerIndex | null,
  reorder: boolean,
): void {
  let amount = 0;
  let materials = 0;
  for (const id of items) {
    amount += g.flatRate ? 0 : linePrice(ctx.cc, ctx.s, id);
    materials += consume(ctx.cc, ctx.s, id);
  }
  ctx.s.cash += amount - materials;
  ctx.s.today.revenue += amount;
  ctx.s.today.materials += materials;
  g.paid = (g.paid ?? 0) + amount;
  g.open++;
  if (!reorder) g.orderedBy = player;
  ctx.s.outbox.orders.push({ group: g.id, items: [...items], reorder, player });
  ctx.sim.emit({
    type: 'clientele-order',
    group: g.id,
    player,
    items: [...items],
    reorder,
    amount,
  });
}

export interface ServeResult {
  readonly qualities?: readonly Quality[];
  readonly latteArt?: boolean;
  readonly homemade?: boolean;
}

/** Commande servie (sur le passe, ou à la table pour une recommande), appelée par le service. */
export function deliverOrder(ctx: Ctx, groupId: number, result: ServeResult = {}): string | null {
  const g = ctx.s.groups.find((x) => x.id === groupId);
  if (g === undefined) return 'Ce client est parti';
  if (g.open <= 0) return 'Rien n’attend pour ce client';
  g.open--;
  g.qualities.push(...(result.qualities ?? ['good']));
  if (result.latteArt === true) g.latteArt = true;
  if (result.homemade === true) g.homemade = true;
  const first = g.servedAt === null;
  if (first) g.servedAt = ctx.s.serviceSec;
  // Les scènes voient le groupe déjà servi (la noce compte ses tables servies).
  sceneHooks.onServed?.(ctx, g, result);
  if (!first) return null;
  ctx.s.today.served++;
  ctx.s.today.people += g.size;
  ctx.s.servedTotal++;
  ctx.sim.emit({ type: 'clientele-served', group: g.id });
  if (g.regular !== null) onRegularServed(ctx, g);
  seat(ctx, g);
  return null;
}

/** « Comme d'habitude ? »: la fétiche servie avant la commande (SE-05), payée en servant. */
export function serveAsUsual(ctx: Ctx, groupId: number): string | null {
  const g = ctx.s.groups.find((x) => x.id === groupId);
  if (g?.regular === null || g === undefined) return 'Ce n’est pas un habitué';
  if (g.paid !== null) return 'Sa commande est déjà prise';
  g.items = regularOrder(ctx, g.regular);
  g.asUsual = true;
  pay(ctx, g, g.items, null, false);
  g.stage = 'waiting';
  ctx.s.outbox.orders.pop();
  return deliverOrder(ctx, g.id);
}

/** Installe tout de suite un invité de scène qui ne commande pas (Jules, l'inspectrice). */
export function seatNow(ctx: Ctx, g: Group): void {
  g.servedAt = ctx.s.serviceSec;
  g.paid = 0;
  seat(ctx, g);
}

function occupied(ctx: Ctx): Set<string> {
  const out = new Set<string>();
  for (const g of ctx.s.groups) for (const id of g.seats) out.add(id);
  return out;
}

function terraceOpen(ctx: Ctx): boolean {
  return (
    (ctx.cc.rules.weather.terraceOpen[ctx.s.weather] ?? false) &&
    !ctx.s.conditions.includes('averse')
  );
}

/** Places libres d'un type, un même guéridon d'abord (CL-07). */
function findSeats(
  ctx: Ctx,
  kind: PlaceKind,
  size: number,
  taken: ReadonlySet<string>,
): Seat[] | null {
  if (kind === 'terrace' && !terraceOpen(ctx)) return null;
  const seats = seatList(ctx.sim, ctx.cc, ctx.s).filter((x) => x.kind === kind && !taken.has(x.id));
  const byTable = new Map<string, Seat[]>();
  for (const x of seats) {
    const key = x.table ?? x.id;
    const list = byTable.get(key) ?? [];
    list.push(x);
    byTable.set(key, list);
  }
  for (const list of byTable.values()) if (list.length >= size) return list.slice(0, size);
  return seats.length >= size ? seats.slice(0, size) : null;
}

function standingFree(ctx: Ctx, taken: ReadonlySet<string>): string[] {
  return ctx.cc.rules.standingSpots
    .map((_, i) => `standing-${String(i)}`)
    .filter((id) => !taken.has(id));
}

/** Où le groupe s'installe une fois servi (`asseoir` et `servir` de la simulation). */
export function seat(ctx: Ctx, g: Group): void {
  const p = profileOf(ctx, g);
  const r = ctx.cc.rules;
  g.stage = 'toSeat';
  g.since = ctx.s.serviceSec;
  if (g.takeAway) {
    g.place = 'none';
    leave(ctx, g);
    return;
  }
  const taken = occupied(ctx);
  const outside = sceneHooks.outsideSeating?.(ctx, g) ?? false;
  let place: PlaceKind = 'none';
  let ids: string[] = [];
  if (outside) {
    place = 'outside';
    const used = new Set(ctx.s.groups.flatMap((x) => x.seats));
    ids = r.picnicSpots
      .map((_, i) => `picnic-${String(i)}`)
      .filter((id) => !used.has(id))
      .slice(0, g.size);
  } else {
    const standing = standingFree(ctx, taken);
    const wantsCounter = p.seat === 'counter';
    const counterSeats = findSeats(ctx, 'counter', g.size, taken);
    if (wantsCounter && counterSeats === null && standing.length >= g.size) {
      place = 'standing';
      ids = standing.slice(0, g.size);
    } else {
      for (const kind of r.seatFallbacks[p.seat] ?? [p.seat]) {
        if (kind === 'counter' && g.size > r.counterSeatMaxGroup) continue;
        const found = findSeats(ctx, kind, g.size, taken);
        if (found !== null) {
          place = kind;
          ids = found.map((x) => x.id);
          g.table = found[0]?.table ?? null;
          break;
        }
      }
      if (place === 'none' && wantsCounter && standing.length >= g.size) {
        place = 'standing';
        ids = standing.slice(0, g.size);
      }
    }
  }
  g.place = place;
  g.seats = ids;
  g.dirtySeat = g.table !== null && ctx.s.dirty.some(([t]) => t === g.table);
  const [lo, hi] = p.stayGameMinutes;
  let stay = ctx.sim.random.float(lo, hi) * spm(ctx);
  if (place === 'none') stay *= r.standingStayFactor;
  const now = ctx.s.serviceSec;
  const soft = closeSec(ctx) + r.softClosingGameMinutes * spm(ctx);
  g.leaveAt = Math.max(
    now + r.servedAfterSoftCloseGameMinutes * spm(ctx),
    Math.min(now + stay, soft),
  );
  g.nextReorder = p.reorder === null ? null : now + p.reorder[0] * spm(ctx);
  sceneHooks.onSeated?.(ctx, g);
}

/** Point du monde où se tient le groupe une fois installé. */
export function placePoint(
  ctx: { sim: { content: Ctx['sim']['content']; world: World }; cc: ClienteleContent; s: Ctx['s'] },
  g: Group,
): Vec2 | null {
  const first = g.seats[0];
  if (first === undefined) return null;
  const r = ctx.cc.rules;
  if (first.startsWith('standing-')) {
    const p = r.standingSpots[Number(first.slice(9))];
    return p === undefined ? null : { x: p[0], z: p[1] };
  }
  if (first.startsWith('picnic-')) {
    const p = r.picnicSpots[Number(first.slice(7))];
    return p === undefined ? null : { x: p[0], z: p[1] };
  }
  const f = ctx.sim.world.furniture.find((x) => x.id === first);
  return f === undefined ? null : { x: f.x, z: f.z };
}

export function satisfaction(ctx: Ctx, g: Group): number {
  const p = profileOf(ctx, g);
  const k = ctx.cc.rules.satisfaction;
  let sat = k.base;
  const wait = (g.servedAt ?? ctx.s.serviceSec) - g.arrivedAt;
  if (wait > p.waitWithoutPenaltySeconds)
    sat += Math.max(k.waitMax, k.perSecond * (wait - p.waitWithoutPenaltySeconds));
  if (g.qualities.length > 0) {
    const val = { perfect: k.perfect, good: k.good, fine: k.fine };
    const weight = p.id === 'connaisseurs' ? k.connoisseurQualityWeight : 1;
    sat += (weight * g.qualities.reduce((sum, q) => sum + val[q], 0)) / g.qualities.length;
  }
  const ip = priceIndex(ctx.cc, p, ctx.s.slate);
  sat += Math.max(
    -k.priceBound,
    Math.min(k.priceBound, (1 - ip) * p.priceSensitivity * k.priceSlope),
  );
  if (g.place === 'none' && !g.takeAway && p.seat !== 'counter') sat += k.standing;
  else if (g.place === p.seat || (g.place === 'standing' && p.seat === 'counter'))
    sat += k.wantedSeat;
  if (g.dirtySeat) sat += k.dirtyTable;
  sat += (ctx.s.ambiance[0] - 50) / k.ambianceDivisor;
  if (g.chat && (p.id === 'voisins' || g.regular !== null)) sat += k.chat;
  if (g.asUsual) sat += k.asUsual;
  if (g.latteArt) sat += k.latteArt;
  if (g.homemade) sat += k.homemade;
  return Math.max(0, Math.min(100, sat));
}

const SIGNS = 'ABCDEFGHIJLMNOPRSTV';

function guestbookWord(ctx: Ctx, g: Group, sat: number): void {
  const r = ctx.cc.rules.guestbook;
  const texts = ctx.cc.texts.guestbook;
  const random = ctx.sim.random;
  let text: string | null = null;
  let sign = `${SIGNS.charAt(random.int(0, SIGNS.length))}.`;
  let good = sat >= 60;
  if (g.regular !== null && random.chance(r.regularChance)) {
    const lines = texts.regulars[g.regular];
    if (lines !== undefined && lines.length > 0) {
      text = random.pick(lines);
      sign = '';
      good = true;
    }
  }
  if (text === null) {
    if (sat >= r.delighted && random.chance(r.delightedChance)) {
      const p = profileOf(ctx, g);
      const reasons: string[] = [];
      if (g.latteArt) reasons.push('latteArt');
      if (g.asUsual) reasons.push('asUsual');
      if (g.chat) reasons.push('chat');
      if (g.qualities.filter((q) => q === 'perfect').length * 2 > g.qualities.length)
        reasons.push('quality');
      if (g.place === 'terrace') reasons.push('terrace');
      if (g.homemade) reasons.push('homemade');
      if (p.id === 'familles' && ctx.s.equipment.includes('coin_enfants')) reasons.push('kids');
      if (p.id === 'promeneurs' && ctx.s.equipment.includes('range_velos')) reasons.push('bikes');
      if (priceIndex(ctx.cc, p, ctx.s.slate) < 0.95) reasons.push('price');
      reasons.push('ambiance');
      const lines = texts.positive[reasons[0] ?? 'ambiance'];
      if (lines !== undefined && lines.length > 0) text = random.pick(lines);
      good = true;
    } else if (sat <= r.disappointed && random.chance(r.disappointedChance)) {
      const p = profileOf(ctx, g);
      const wait = (g.servedAt ?? 0) - g.arrivedAt;
      let reason = 'empty';
      if (wait > p.waitWithoutPenaltySeconds + 20) reason = 'wait';
      else if (g.place === 'none' && !g.takeAway) reason = 'noSeat';
      else if (g.dirtySeat) reason = 'dirtyTable';
      else if (priceIndex(ctx.cc, p, ctx.s.slate) > 1.1) reason = 'price';
      const lines = texts.negative[reason];
      if (lines !== undefined && lines.length > 0) text = random.pick(lines);
      good = false;
    }
  }
  if (text !== null) addGuestbook(ctx, text, sign, good);
}

export function addGuestbook(ctx: Ctx, text: string, sign: string, good: boolean): void {
  ctx.s.guestbook.push({ day: ctx.s.day, text, sign, good });
  ctx.s.guestbookCount++;
  const kept = ctx.cc.rules.guestbook.kept;
  if (ctx.s.guestbook.length > kept) ctx.s.guestbook.splice(0, ctx.s.guestbook.length - kept);
  ctx.sim.emit({ type: 'clientele-guestbook', text, sign });
}

/** Le groupe s'en va (servi): satisfaction, pourboire, réputation, livre d'or, vaisselle. */
function depart(ctx: Ctx, g: Group): void {
  if (g.items.length === 0) {
    // Invité de scène sans commande (Jules, l'inspectrice): ni note ni vaisselle.
    sceneHooks.onLeft?.(ctx, g, 0);
    leave(ctx, g);
    return;
  }
  const sat = satisfaction(ctx, g);
  const p = profileOf(ctx, g);
  const t = ctx.cc.rules.tips;
  let tip = 0;
  if (sat >= t.threshold && ctx.sim.random.chance(t.probability)) {
    const rate = sat >= t.delightedThreshold ? t.delightedRate : t.rate;
    tip = Math.round((g.paid ?? 0) * rate * p.tipFactor);
  }
  ctx.s.today.tips += tip;
  ctx.s.today.satSum += sat;
  ctx.s.today.satCount++;
  const rep = ctx.cc.economy.reputation;
  let pts = Math.max(0, (sat - rep.pivot) / rep.divisor);
  const [after, perDay, max] = rep.catchUp;
  const beyond = ctx.s.openDays + 1 - after;
  if (beyond > 0) pts *= Math.min(max, 1 + perDay * beyond);
  addPoints(ctx, pts);
  guestbookWord(ctx, g, sat);
  if (!g.takeAway && g.place !== 'outside') {
    const pieces = g.items.reduce((sum, id) => sum + (ctx.cc.recipes.get(id)?.dishes ?? 1), 0);
    const dishes = {
      table: g.table,
      seats: g.seats.filter((x) => !x.startsWith('standing-')),
      pieces,
    };
    ctx.s.outbox.dishes.push(dishes);
    ctx.sim.emit({ type: 'clientele-dishes', ...dishes });
    if (g.table !== null && !ctx.s.dirty.some(([x]) => x === g.table))
      ctx.s.dirty.push([g.table, ctx.s.serviceSec]);
  }
  ctx.sim.emit({ type: 'clientele-left', group: g.id, satisfaction: Math.round(sat), tip });
  sceneHooks.onLeft?.(ctx, g, sat);
  leave(ctx, g);
}

function leave(ctx: Ctx, g: Group): void {
  g.stage = 'leaving';
  g.since = ctx.s.serviceSec;
  g.seats = [];
}

/** Un groupe qui n'a pas commandé repart (patience épuisée, fermeture). */
export function abandon(ctx: Ctx, g: Group): void {
  ctx.s.today.left++;
  leave(ctx, g);
}

/** Le groupe s'en va tout de suite (fin d'une scène, fermeture douce): départ normal s'il est servi. */
export function sendHome(ctx: Ctx, g: Group): void {
  if (g.stage === 'leaving') return;
  if (g.servedAt !== null) depart(ctx, g);
  else if (g.paid === null) abandon(ctx, g);
  else leave(ctx, g);
}

// ---------------------------------------------------------------------------------------------
// Pas

export function stepCustomers(ctx: Ctx, arrivalsOpen: boolean): void {
  const { s, cc } = ctx;
  const now = s.serviceSec;
  if (arrivalsOpen) {
    while (s.arrivals.length > 0 && (s.arrivals[0]?.[0] ?? Infinity) <= now) {
      const a = s.arrivals.shift();
      if (a !== undefined) arrive(ctx, a[1], a[2], a[3]);
    }
  }
  const queue = queueGroups(ctx);
  for (const g of [...s.groups]) {
    const p = profileOf(ctx, g);
    switch (g.stage) {
      case 'entering':
      case 'queue':
      case 'register': {
        const k = queue.indexOf(g);
        const spot = queueSpot(ctx.sim.content, Math.max(0, k));
        const w = goTo(ctx, g, spot, `q${String(k)}`);
        if (arrived(w)) {
          if (k === 0 && g.stage !== 'register') {
            g.stage = 'register';
            g.since = now;
            sceneHooks.onRegister?.(ctx, g);
          } else if (k > 0) g.stage = 'queue';
        }
        // Patience (CL-05): les habitués et les invités d'une scène attendent toujours.
        if (g.regular === null && g.role === null && now - g.arrivedAt > p.patienceSeconds)
          abandon(ctx, g);
        break;
      }
      case 'waiting': {
        const spots = cc.rules.waitingSpots;
        const i = s.groups.filter((x) => x.stage === 'waiting').indexOf(g);
        const at = spots[i % Math.max(1, spots.length)] ?? [8.3, 10.6];
        goTo(ctx, g, { x: at[0], z: at[1] }, `w${String(i)}`);
        const fallback = cc.rules.fallbackPrepSeconds;
        if (fallback !== null && now - g.since >= fallback) deliverOrder(ctx, g.id);
        break;
      }
      case 'toSeat': {
        const at = placePoint(ctx, g);
        const w = goTo(ctx, g, at ?? { x: 6.4, z: 11 }, `s${g.seats.join(',')}`);
        if (arrived(w)) {
          g.stage = 'seated';
          g.since = now;
        }
        break;
      }
      case 'seated': {
        if (g.nextReorder !== null && g.leaveAt !== null && now >= g.nextReorder) {
          const [every, chance] = p.reorder ?? [0, 0];
          if (now < g.leaveAt - 10 * spm(ctx) && ctx.sim.random.chance(chance)) {
            const items = groupOrder(cc, ctx.sim.random, p, 1, availableRecipes(ctx)).slice(0, 1);
            if (items.length > 0) {
              pay(ctx, g, items, null, true);
              g.since = now;
            }
          }
          g.nextReorder = every > 0 ? g.nextReorder + every * spm(ctx) : null;
        }
        const fallback = cc.rules.fallbackPrepSeconds;
        if (fallback !== null && g.open > 0 && now - g.since >= fallback) deliverOrder(ctx, g.id);
        if (g.leaveAt !== null && now >= g.leaveAt && g.open === 0) depart(ctx, g);
        break;
      }
      case 'leaving': {
        const exit = planPoint(ctx.sim.content, 'exits') ?? entrance(ctx);
        const w = goTo(ctx, g, exit, 'exit');
        if (arrived(w)) {
          s.groups.splice(s.groups.indexOf(g), 1);
          runtimeOf(ctx.sim.world).walkers.delete(g.id);
        }
        break;
      }
    }
  }
  stepWalkers(ctx);
}

/** Animation d'un groupe, pour le rendu (assis ou debout, en train de boire). */
export function animOf(g: Group, moving: boolean): Anim {
  if (moving) return 'walk';
  if (g.stage === 'seated') {
    const sitting = g.place !== 'standing' && g.place !== 'none';
    return sitting ? 'sit_drink' : 'drink';
  }
  return 'idle';
}
