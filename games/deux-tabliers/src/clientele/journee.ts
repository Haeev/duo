/**
 * La journée et la semaine (cahier 4.2, démo section 4): aube (loyer, livraison, météo, lettre,
 * brocante du lundi), préparation horloge arrêtée, « On ouvre ? » à deux, service, fermeture et
 * fermeture douce, bilan du soir, « À demain » à deux; lundi fermé; jour 15, « Partir pour
 * Mérelles ? » puis l'écran de fin; on peut rester à Ormeval jusqu'au jour 28.
 */
import type { PlayerIndex, World } from '../etat/monde';
import { objectOnSlot } from '../simulation/monde';
import {
  attraction,
  drawGroupSize,
  drawWeather,
  passersPerHour,
  poisson,
  proposeSlate,
} from './attrait';
import { abandon, closeSec, deliverOrder, spm, stepCustomers } from './clients';
import {
  addLot,
  ambiance,
  cents,
  chargesCents,
  deliver,
  eveningBasket,
  lastGoodDay,
  nextOpenDay,
  receiveMorningOrder,
  reconcileLots,
  rentCents,
  suggestedOrder,
  throwExpired,
  updateTiers,
  type Ctx,
} from './economie';
import { emptyDayStats, type Report } from './etat';
import { planRegulars, stepRegulars, storySteps } from './habitues';
import { closeDayEvents, dayAffluence, planEvents, stepEvents } from './scenes';

export function weekday(ctx: Ctx, day = ctx.s.day): string {
  return ctx.cc.days.weekdays[(day - 1) % 7] ?? 'mon';
}

/** Recettes connues faisables avec les postes du café. */
export function possibleRecipes(ctx: Ctx): string[] {
  return ctx.cc.recipeList
    .filter(
      (r) => ctx.s.known.includes(r.id) && r.stations.every((st) => (ctx.s.stations[st] ?? 0) > 0),
    )
    .map((r) => r.id);
}

function forcedWeather(ctx: Ctx, day: number): string | null {
  return ctx.cc.rules.weather.forced.find(([d]) => d === day)?.[1] ?? null;
}

/** La maison au jour 1: caisse de Simone, recettes et postes de départ, première ardoise proposée. */
export function startHouse(ctx: Ctx): void {
  const { s, cc } = ctx;
  const e = cc.economy;
  s.cash = cents(e.startCash);
  s.cups = e.reputation.startCups;
  s.known = cc.recipeList.filter((r) => r.unlock.kind === 'start').map((r) => r.id);
  s.stations = { ...e.stationsAtStart };
  s.dishes = e.dishesAtStart;
  s.tomorrowWeather = forcedWeather(ctx, 1) ?? drawWeather(cc, ctx.sim.random);
  s.slate = proposeSlate(cc, possibleRecipes(ctx)).map((id) => [id, 0]);
  // La réserve de Simone (P0-1): offerte, datée du premier jour ouvert. Le frais reste à commander.
  const first = nextOpenDay(cc, 1);
  for (const [id, n] of e.startStock) {
    const ing = cc.ingredients.get(id);
    if (ing !== undefined) addLot(s, id, n * ing.cartonUnits, lastGoodDay(ing, first));
  }
  dawn(ctx, 1);
}

function plan(ctx: Ctx, day = ctx.s.day): (typeof ctx.cc.days.days)[number] | undefined {
  return ctx.cc.days.days.find((d) => d.day === day);
}

export function dawn(ctx: Ctx, day: number): void {
  const { s, cc } = ctx;
  s.day = day;
  s.votes = {};
  s.proposals = [];
  s.cash -= rentCents(cc);
  s.weather = forcedWeather(ctx, day) ?? s.tomorrowWeather;
  s.serviceSec = 0;
  s.closingAt = 0;
  s.groups = [];
  s.arrivals = [];
  s.expected = [];
  s.dirty = [];
  s.today = emptyDayStats();
  s.event = null;
  s.conditions = [];
  const open = plan(ctx)?.open ?? weekday(ctx) !== 'mon';
  // Le périmé part avant la livraison, lundi compris (P0-3).
  reconcileLots(cc, s);
  throwExpired(ctx);
  if (s.today.lost > 0 && !s.flags.includes('first-loss')) {
    s.flags.push('first-loss');
    for (const line of cc.texts.dialogues.simone_first_loss ?? [])
      ctx.sim.emit({ type: 'clientele-say', who: 'Simone', text: line.text, player: null });
  }
  // Livraison du matin, payée à la livraison: la commande du soir, sinon l'habituelle (jamais
  // bloqué). Un jour fermé, personne ne passe: la commande attend le prochain jour ouvert.
  if (open) {
    receiveMorningOrder(ctx, s.order ?? suggestedOrder(cc, s, day));
    s.order = null;
  }
  if (s.letterDay === 0 && s.renown >= cc.economy.offer.renown) {
    s.letterDay = day;
    ctx.sim.emit({ type: 'clientele-letter', how: 'mail' });
  }
  if (day === 12 && !s.flags.includes('wedding-declined') && !s.flags.includes('wedding-accepted'))
    s.flags.push('wedding-accepted');
  updateTiers(ctx);
  // Étapes à condition de réputation (la pièce du fond de Simone), pour les habitués déjà venus.
  for (const r of cc.regulars.regulars)
    if ((s.regulars[r.id]?.visits ?? 0) > 0) storySteps(ctx, r.id);
  const a = ambiance(ctx);
  s.ambiance = [Math.round(a.value * 10) / 10, a.style, Math.round(a.coherence * 1000) / 1000];
  if (open) {
    s.phase = 'prep';
    planRegulars(ctx);
    planEvents(ctx);
  } else {
    s.phase = 'monday';
    const pool = cc.economy.catalogue.filter((c) => c.source === 'brocante').map((c) => c.id);
    s.brocante = ctx.sim.random.shuffle(pool).slice(0, cc.economy.brocante.pieces);
    s.report = mondayReport(ctx);
    if (plan(ctx)?.endOfDemo === true) {
      if (s.letterDay === 0) s.letterDay = day;
      for (const line of cc.texts.dialogues.rene_letter ?? [])
        ctx.sim.emit({
          type: 'clientele-say',
          who: line.who === 'rene' ? 'René' : 'Simone',
          text: line.text,
          player: null,
        });
    }
    if (day === 1)
      for (const line of cc.texts.dialogues.prologue ?? [])
        ctx.sim.emit({ type: 'clientele-say', who: 'Simone', text: line.text, player: null });
  }
  ctx.sim.emit({
    type: 'clientele-dawn',
    day,
    title: plan(ctx)?.title ?? '',
    weather: s.weather,
    open,
  });
}

function mondayReport(ctx: Ctx): Report {
  const { s, cc } = ctx;
  const rent = rentCents(cc);
  return {
    day: s.day,
    open: false,
    revenue: 0,
    tips: 0,
    materials: 0,
    rent,
    charges: 0,
    purchases: s.today.spent,
    eventEuros: 0,
    goods: 0,
    shipping: 0,
    emergency: 0,
    lost: s.today.lost,
    lostItems: [...s.today.lostItems],
    basketValue: 0,
    result: -rent,
    served: 0,
    left: 0,
    satisfaction: 0,
    cupsBefore: s.cups,
    cupsAfter: s.cups,
    renown: s.renown,
    cash: s.cash,
    words: [],
    tomorrowWeather: s.tomorrowWeather,
    tomorrowAnnounce: announceFor(ctx, s.day + 1),
    event: null,
  };
}

/** Annonce de la veille (TE-11): l'événement prévu demain, sauf les surprises. */
function announceFor(ctx: Ctx, day: number): string | null {
  const p = plan(ctx, day);
  const id = p?.event ?? p?.dayEvent ?? null;
  if (id === null) return null;
  return ctx.cc.events.get(id)?.announce ?? null;
}

function generateArrivals(ctx: Ctx): void {
  const { s, cc } = ctx;
  const wdi = (s.day - 1) % 7;
  const att = {
    slate: s.slate,
    ambiance: s.ambiance[0],
    style: s.ambiance[1],
    coherence: s.ambiance[2],
    equipment: s.equipment,
    cups: s.cups,
    satYesterday: s.satYesterday,
    affluence: 1,
  };
  const out: [number, string, number, boolean][] = [];
  for (const p of cc.profileList) {
    const k = attraction(cc, p, att);
    const perHour = passersPerHour(cc, p, wdi, s.weather, dayAffluence(ctx, p.id));
    perHour.forEach((lam, i) => {
      const n = poisson(ctx.sim.random, lam * k);
      for (let j = 0; j < n; j++) {
        const t = (i + ctx.sim.random.next()) * 60 * spm(ctx);
        const size = drawGroupSize(ctx.sim.random, p);
        const take =
          p.takeAwayShare > 0 &&
          s.equipment.includes('gobelets') &&
          ctx.sim.random.chance(p.takeAwayShare);
        out.push([t, p.id, size, take]);
      }
    });
  }
  out.sort((a, b) => a[0] - b[0]);
  s.arrivals = out;
}

function openNow(ctx: Ctx): void {
  const { s } = ctx;
  s.phase = 'service';
  s.serviceSec = 0;
  const a = ambiance(ctx);
  s.ambiance = [Math.round(a.value * 10) / 10, a.style, Math.round(a.coherence * 1000) / 1000];
  generateArrivals(ctx);
  ctx.sim.emit({ type: 'clientele-opened' });
}

function startClosing(ctx: Ctx): void {
  const { s } = ctx;
  s.phase = 'closing';
  s.closingAt = s.serviceSec;
  s.arrivals = [];
  s.expected = [];
  ctx.sim.emit({ type: 'clientele-closing' });
}

function evening(ctx: Ctx): void {
  const { s, cc } = ctx;
  closeDayEvents(ctx);
  const t = s.today;
  const cupsBefore =
    s.history.length > 0
      ? (s.history[s.history.length - 1]?.[4] ?? s.cups)
      : cc.economy.reputation.startCups;
  const charges = chargesCents(cc);
  s.cash += t.tips - charges;
  // Panier du soir (ST-06, P0-3): les pièces du boulanger qui finissent ce soir, déjà payées,
  // sont données; +1 point par pièce, `basketMaxPerDay` au plus.
  const o = cc.supplies.ordering;
  reconcileLots(cc, s);
  const pieces = eveningBasket(ctx);
  const basket = Math.min(o.basketMaxPerDay, pieces);
  t.basket = pieces;
  s.points += basket * o.basketReputationPerItem;
  s.renown += basket * o.basketReputationPerItem;
  s.usage.push({ ...s.todayUse });
  if (s.usage.length > o.historyDays) s.usage.splice(0, s.usage.length - o.historyDays);
  s.todayUse = {};
  const sat = t.satCount > 0 ? t.satSum / t.satCount : 0;
  if (t.satCount > 0) s.satYesterday = sat;
  s.openDays++;
  if (s.day === cc.economy.challenge.day) {
    s.renown += cc.economy.challenge.renown;
    if (s.letterDay === 0) {
      s.letterDay = s.day;
      ctx.sim.emit({ type: 'clientele-letter', how: 'rene' });
    }
  }
  updateTiers(ctx);
  // Pas de faillite (EC-06): ce qui manque devient « à régler », repris sur les jours suivants.
  if (s.cash < 0) {
    s.debt += -s.cash;
    s.cash = 0;
  } else if (s.debt > 0) {
    const pay = Math.min(s.debt, s.cash);
    s.cash -= pay;
    s.debt -= pay;
  }
  s.tomorrowWeather = forcedWeather(ctx, s.day + 1) ?? drawWeather(cc, ctx.sim.random);
  const rent = rentCents(cc);
  const eventId = plan(ctx)?.event ?? null;
  const outcome = eventId === null ? undefined : s.eventsDone[eventId];
  s.report = {
    day: s.day,
    open: true,
    revenue: t.revenue,
    tips: t.tips,
    materials: t.materials,
    rent,
    charges,
    purchases: t.spent,
    eventEuros: t.euros,
    goods: t.goods,
    shipping: t.shipping,
    emergency: t.emergency,
    lost: t.lost,
    lostItems: [...t.lostItems],
    basketValue: t.basketValue,
    result: t.revenue + t.tips + t.euros - t.goods - t.shipping - t.emergency - rent - charges,
    served: t.served,
    left: t.left,
    satisfaction: Math.round(sat * 10) / 10,
    cupsBefore,
    cupsAfter: s.cups,
    renown: Math.round(s.renown),
    cash: s.cash,
    words: s.guestbook.filter((w) => w.day === s.day),
    tomorrowWeather: s.tomorrowWeather,
    tomorrowAnnounce: announceFor(ctx, s.day + 1),
    event: eventId === null || outcome === undefined ? null : [eventId, outcome],
  };
  s.history.push([s.day, t.revenue, t.served, Math.round(sat * 10) / 10, s.cups]);
  s.phase = 'evening';
  ctx.sim.emit({ type: 'clientele-evening', day: s.day });
  // Conseil de Simone l'avant-veille de la fête: la laitière passe demain (P0-2).
  if (s.day === cc.economy.challenge.day - 2)
    for (const line of cc.texts.dialogues.simone_fete_order ?? [])
      ctx.sim.emit({ type: 'clientele-say', who: 'Simone', text: line.text, player: null });
}

/** Tables débarrassées: plus aucun objet sur leurs emplacements (le service les vide). */
function updateDirty(ctx: Ctx): void {
  const { s } = ctx;
  s.dirty = s.dirty.filter(([table, since]) => {
    if (s.serviceSec - since < 1) return true;
    const placed = ctx.sim.world.furniture.find((f) => f.id === table);
    const type = placed === undefined ? undefined : ctx.sim.content.furniture.get(placed.type);
    if (type === undefined) return false;
    return type.slots.some((slot) => objectOnSlot(ctx.sim.world, table, slot.id) !== undefined);
  });
}

function stepEmergencies(ctx: Ctx): void {
  const { s } = ctx;
  const due = s.emergencies.filter(([, , at]) => at <= s.serviceSec);
  if (due.length === 0) return;
  s.emergencies = s.emergencies.filter(([, , at]) => at > s.serviceSec);
  const order: Record<string, number> = {};
  for (const [ing, n] of due) order[ing] = (order[ing] ?? 0) + n;
  deliver(ctx, order, true);
}

const clocks = new WeakMap<World, { t: number }>();

function clockOf(world: World): { t: number } {
  let c = clocks.get(world);
  if (c === undefined) {
    c = { t: world.clientele.serviceSec };
    clocks.set(world, c);
  }
  return c;
}

/** La boîte de dépôt vers le service reste bornée même si personne ne la vide (64 Kio par message). */
const OUTBOX_KEPT = 40;

export function stepDay(ctx: Ctx): void {
  const { s, cc } = ctx;
  const box = s.outbox;
  if (box.orders.length > OUTBOX_KEPT) box.orders.splice(0, box.orders.length - OUTBOX_KEPT);
  if (box.dishes.length > OUTBOX_KEPT) box.dishes.splice(0, box.dishes.length - OUTBOX_KEPT);
  if (box.cartons.length > OUTBOX_KEPT) box.cartons.splice(0, box.cartons.length - OUTBOX_KEPT);
  if (s.phase !== 'service' && s.phase !== 'closing') return;
  // L'état ne garde que la seconde entière: le domaine part sur le réseau quand il change
  // (technique 5.3, « maison » deux fois par seconde au plus); la fraction reste chez l'hôte.
  const clock = clockOf(ctx.sim.world);
  if (Math.floor(clock.t) !== s.serviceSec) clock.t = s.serviceSec;
  clock.t += ctx.sim.dt;
  s.serviceSec = Math.floor(clock.t);
  if (s.phase === 'service' && s.serviceSec >= closeSec(ctx)) startClosing(ctx);
  stepRegulars(ctx);
  stepEvents(ctx);
  stepEmergencies(ctx);
  stepCustomers(ctx, s.phase === 'service');
  updateDirty(ctx);
  if (s.phase !== 'closing') return;
  const soft = s.closingAt + cc.rules.softClosingGameMinutes * spm(ctx);
  if (s.serviceSec >= soft)
    for (const g of s.groups)
      if (g.paid === null && g.stage !== 'leaving' && g.role === null) abandon(ctx, g);
  // Une commande encore en route longtemps après la fermeture est servie d'office.
  if (s.serviceSec >= soft + cc.rules.closingGraceGameMinutes * spm(ctx))
    for (const g of s.groups) while (g.open > 0) deliverOrder(ctx, g.id, { qualities: ['fine'] });
  if (s.groups.length === 0) evening(ctx);
}

function clearVote(ctx: Ctx, topic: string): void {
  ctx.s.votes = Object.fromEntries(Object.entries(ctx.s.votes).filter(([k]) => k !== topic));
}

/** Un vote de joueur; rend un refus ou `null`. */
export function vote(ctx: Ctx, player: PlayerIndex, topic: string, yes: boolean): string | null {
  const { s, cc } = ctx;
  const allowed: Record<string, readonly string[]> = {
    open: ['prep'],
    close: ['service'],
    'next-day': ['evening', 'monday', 'end'],
    wedding: ['evening'],
    merelles: ['monday'],
    name: ['monday', 'prep', 'evening'],
  };
  if (!(allowed[topic] ?? []).includes(s.phase)) return 'Pas maintenant';
  if (topic === 'next-day' && plan(ctx)?.endOfDemo === true && !s.demoEnded)
    return 'René attend votre réponse';
  if (topic === 'next-day' && s.day >= cc.economy.demoMaxDay) return 'La démo s’arrête au jour 28';
  if (topic === 'merelles' && plan(ctx)?.endOfDemo !== true) return 'Pas maintenant';
  if (topic === 'name' && s.namePending === null) return 'Aucun nom proposé';
  if (topic === 'name' && s.namePending?.by === player) return 'C’est à l’autre de confirmer';
  const v = s.votes[topic] ?? [0, 0];
  v[player] = yes ? 1 : 2;
  s.votes[topic] = v;
  ctx.sim.emit({ type: 'clientele-ask', topic, by: player, yes });
  const both = v[0] !== 0 && v[1] !== 0;
  const bothYes = v[0] === 1 && v[1] === 1;
  if (topic === 'name') {
    if (yes && s.namePending !== null) s.houseName = s.namePending.name;
    s.namePending = null;
    clearVote(ctx, 'name');
    return null;
  }
  if (topic === 'wedding' && both) {
    s.flags = s.flags.filter((f) => f !== 'wedding-accepted' && f !== 'wedding-declined');
    s.flags.push(v[0] === 2 && v[1] === 2 ? 'wedding-declined' : 'wedding-accepted');
    return null;
  }
  // Les deux réponses mènent à l'écran de fin (démo section 4).
  if (topic === 'merelles' && both) {
    s.demoEnded = true;
    s.phase = 'end';
    clearVote(ctx, 'next-day');
    ctx.sim.emit({ type: 'clientele-demo-end' });
    return null;
  }
  if (!bothYes) return null;
  clearVote(ctx, topic);
  if (topic === 'open') openNow(ctx);
  else if (topic === 'close') startClosing(ctx);
  else if (topic === 'next-day') dawn(ctx, s.day + 1);
  return null;
}
