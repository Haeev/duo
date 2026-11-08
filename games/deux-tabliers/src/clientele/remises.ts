/**
 * Remises et marketing (démo v0.2, `docs/jeux/cosy-cafe/demo/remises-marketing-v0-2.md`, P0):
 * heure douce, carte de fidélité, tarif réduit d'un profil, offre du jour, actions pour faire
 * connaître le café. Fonctions pures de l'état et du contenu (`remises.json`, `marketing.json`),
 * sauf `launchCampaign`, `startCampaign` et `applyDiscountSettings` qui écrivent l'état.
 *
 * Règles: une seule remise par ligne, la plus forte pour le client, jamais sous le revient
 * arrondi au dixième supérieur; prix remisé arrondi au dixième inférieur. Le réglage pris à
 * l'ouverture (`activeDiscounts`) vaut pour toute la journée. Sans remise ni action, rien ne
 * change (aucun tirage au hasard de plus): l'économie reste celle du réalisme v0.2 (RM-01).
 */
import type { PlayerIndex } from '../etat/monde';
import { cupsFactor, priceIndex, type Attraction } from './attrait';
import type { ClienteleContent, MarketingAction, Profile, Recipe } from './donnees';
import { availableCents, cents, owns, weekdayId, type Ctx } from './economie';
import type { Campaign, ClienteleState, DiscountSettings, Group } from './etat';

// ---------------------------------------------------------------------------------------------
// Réglages

export function defaultDiscounts(cc: ClienteleContent): DiscountSettings {
  const hh = cc.discounts.happyHour.default;
  const profiles: DiscountSettings['profiles'] = {};
  for (const r of cc.discounts.profileRates)
    profiles[r.id] = { on: false, rate: r.default, days: [...r.defaultDays] };
  return {
    happyHour: { on: false, start: hh.start, length: hh.length, rate: hh.rate, days: [...hh.days] },
    loyalty: false,
    profiles,
    dailyOffer: null,
  };
}

/** Réglage de l'onglet (celui de demain hors service). */
export function discountSettings(cc: ClienteleContent, s: ClienteleState): DiscountSettings {
  return s.discounts ?? defaultDiscounts(cc);
}

function clone(d: DiscountSettings): DiscountSettings {
  return JSON.parse(JSON.stringify(d)) as DiscountSettings;
}

/** Un profil a-t-il des clients au village (`groupsPerDay` > 0) ? Sinon son tarif est grisé. */
export function profileRateAvailable(cc: ClienteleContent, id: string): boolean {
  const r = cc.discounts.profileRates.find((x) => x.id === id);
  return r?.tier === 'P0' && (cc.profiles.get(r.profile)?.groupsPerDay ?? 0) > 0;
}

/**
 * Nouveau réglage demandé par un joueur, borné aux valeurs permises; rend un refus ou `null`.
 * Pendant le service, il vaut pour demain (le réglage du jour reste celui de l'ouverture).
 */
export function applyDiscountSettings(ctx: Ctx, wanted: DiscountSettings): string | null {
  const { cc, s } = ctx;
  const d = cc.discounts;
  const days = cc.days.weekdays.filter((x) => x !== 'mon');
  const keepDays = (list: readonly string[]): string[] => days.filter((x) => list.includes(x));
  const hh = wanted.happyHour;
  if (!d.happyHour.starts.includes(hh.start)) return 'Heure de début impossible';
  if (!d.happyHour.lengths.includes(hh.length)) return 'Durée impossible';
  if (!d.happyHour.rates.some((r) => Math.abs(r - hh.rate) < 1e-9)) return 'Taux impossible';
  if ((hh.start + hh.length) * 60 > cc.days.close) return 'L’heure douce finit après la fermeture';
  if (wanted.loyalty && !owns(s, d.loyaltyCard.purchase))
    return 'Achète d’abord les cartes au catalogue';
  const profiles: DiscountSettings['profiles'] = {};
  for (const r of d.profileRates) {
    const w = wanted.profiles[r.id] ?? { on: false, rate: r.default, days: r.defaultDays };
    if (!r.rates.some((x) => Math.abs(x - w.rate) < 1e-9)) return 'Taux impossible';
    if (w.on && !profileRateAvailable(cc, r.id))
      return cc.discounts.texts.absent[r.id] ?? 'Indisponible';
    profiles[r.id] = { on: w.on, rate: w.rate, days: keepDays(w.days) };
  }
  let offer: DiscountSettings['dailyOffer'] = null;
  if (wanted.dailyOffer !== null) {
    const [recipe, rate] = wanted.dailyOffer;
    if (!s.slate.some(([id]) => id === recipe)) return 'L’offre du jour doit être sur l’ardoise';
    if (!d.dailyOffer.rates.some((x) => Math.abs(x - rate) < 1e-9)) return 'Taux impossible';
    offer = [recipe, rate];
  }
  s.discounts = {
    happyHour: { ...hh, days: keepDays(hh.days) },
    loyalty: wanted.loyalty,
    profiles,
    dailyOffer: offer,
  };
  return null;
}

/** À l'ouverture: le réglage devient celui du jour; l'offre du jour est consommée. */
export function openDiscounts(ctx: Ctx): void {
  const { s } = ctx;
  if (s.discounts === null) {
    s.activeDiscounts = null;
    return;
  }
  s.activeDiscounts = clone(s.discounts);
  s.discounts.dailyOffer = null;
}

/** Le soir: fin du réglage du jour, jours de carte comptés, ventes gardées pour la suggestion. */
export function closeDiscounts(ctx: Ctx): void {
  const { s } = ctx;
  if (s.activeDiscounts?.loyalty === true && owns(s, ctx.cc.discounts.loyaltyCard.purchase))
    s.loyaltyDays++;
  s.activeDiscounts = null;
  s.soldHistory.push({ ...s.today.sold });
  if (s.soldHistory.length > 3) s.soldHistory.splice(0, s.soldHistory.length - 3);
}

// ---------------------------------------------------------------------------------------------
// Prix d'une ligne

export type DiscountKind = 'happyHour' | 'dailyOffer' | `profile:${string}`;

export interface LinePrice {
  /** Prix payé et prix de l'ardoise, en centimes. */
  readonly price: number;
  readonly base: number;
  /** Remise appliquée (la plus forte), `null` sans remise. */
  readonly kind: DiscountKind | null;
  /** Le prix est tenu au plancher du revient. */
  readonly floored: boolean;
}

/** Qui commande, et à quelle minute de jeu se lit l'heure douce. */
export interface Buyer {
  readonly profile: string;
  readonly minute: number;
}

function dayIn(cc: ClienteleContent, s: ClienteleState, days: readonly string[]): boolean {
  return days.includes(weekdayId(cc, s.day));
}

/** Heure douce en cours à cette minute de jeu (réglage donné), jour compris. */
export function happyHourAt(
  cc: ClienteleContent,
  s: ClienteleState,
  d: DiscountSettings,
  minute: number,
): boolean {
  const hh = d.happyHour;
  return (
    hh.on &&
    dayIn(cc, s, hh.days) &&
    minute >= hh.start * 60 - 1e-9 &&
    minute < (hh.start + hh.length) * 60 - 1e-9
  );
}

/** Remises possibles d'une ligne: sorte et taux, la plus forte d'abord. */
function lineRates(
  cc: ClienteleContent,
  s: ClienteleState,
  d: DiscountSettings,
  r: Recipe,
  buyer: Buyer | null,
): [DiscountKind, number][] {
  const out: [DiscountKind, number][] = [];
  if (d.dailyOffer !== null && d.dailyOffer[0] === r.id) out.push(['dailyOffer', d.dailyOffer[1]]);
  if (buyer !== null) {
    if (cc.discounts.happyHour.families.includes(r.family) && happyHourAt(cc, s, d, buyer.minute))
      out.push(['happyHour', d.happyHour.rate]);
    for (const pr of cc.discounts.profileRates) {
      const set = d.profiles[pr.id];
      if (set?.on === true && pr.profile === buyer.profile && dayIn(cc, s, set.days))
        out.push([`profile:${pr.id}`, set.rate]);
    }
  }
  return out.sort((a, b) => b[1] - a[1]);
}

/** Prix de l'ardoise (pas de prix compris), en centimes. */
export function listPrice(cc: ClienteleContent, s: ClienteleState, recipe: string): number {
  const r = cc.recipes.get(recipe);
  if (r === undefined) return 0;
  const step = s.slate.find(([id]) => id === recipe)?.[1] ?? 0;
  return cents(r.basePrice * (1 + step * cc.economy.priceSteps.step));
}

/** Plancher d'une ligne remisée: le revient, arrondi au dixième d'euro supérieur. */
export function floorCents(cc: ClienteleContent, recipe: string): number {
  const cost = cc.recipes.get(recipe)?.costMaterials ?? 0;
  return Math.ceil(Math.round(cost * 1000) / 100 - 1e-9) * 10;
}

/** Prix payé d'une ligne (RM-02 à RM-04), réglage du jour sauf réglage donné. */
export function discountedLine(
  cc: ClienteleContent,
  s: ClienteleState,
  recipe: string,
  buyer: Buyer | null,
  settings: DiscountSettings | null = s.activeDiscounts,
): LinePrice {
  const base = listPrice(cc, s, recipe);
  const r = cc.recipes.get(recipe);
  if (settings === null || r === undefined)
    return { price: base, base, kind: null, floored: false };
  const best = lineRates(cc, s, settings, r, buyer)[0];
  if (best === undefined) return { price: base, base, kind: null, floored: false };
  const raw = Math.floor((base * (1 - best[1])) / 10 + 1e-9) * 10;
  const floor = cc.discounts.floorAtCost ? floorCents(cc, recipe) : 0;
  const price = Math.min(base, Math.max(raw, floor));
  if (price >= base) return { price: base, base, kind: null, floored: raw < floor };
  return { price, base, kind: best[0], floored: raw < floor };
}

// ---------------------------------------------------------------------------------------------
// Carte de fidélité

/** Part des groupes des profils concernés qui ont la carte (10 % le premier jour, 60 % au plus). */
export function holderShare(cc: ClienteleContent, s: ClienteleState): number {
  const l = cc.discounts.loyaltyCard;
  return Math.min(l.holderShareMax, l.holderShareStart + l.holderSharePerDay * s.loyaltyDays);
}

export function loyaltyActive(cc: ClienteleContent, s: ClienteleState): boolean {
  return s.activeDiscounts?.loyalty === true && owns(s, cc.discounts.loyaltyCard.purchase);
}

function isCoffee(cc: ClienteleContent, recipe: string): boolean {
  const f = cc.recipes.get(recipe)?.family;
  return f !== undefined && cc.discounts.loyaltyCard.families.includes(f);
}

export interface PaidOrder {
  /** Total payé, total à l'ardoise (centimes). */
  readonly amount: number;
  readonly list: number;
  /** Part remisée (hors café offert), pour la satisfaction. */
  readonly off: number;
  readonly receipt: [string, number][];
  /** Écart de chaque sorte de remise (centimes): `happyHour`, `dailyOffer`, `profile:…`, `freeCoffee`. */
  readonly by: Record<string, number>;
}

/**
 * Prix de toute une commande: remise de chaque ligne, puis la carte de fidélité (le café le moins
 * cher offert quand la carte est pleine). Écrit les tampons des habitués.
 */
export function priceOrder(
  ctx: Ctx,
  g: Group,
  items: readonly string[],
  minute: number,
  reorder: boolean,
): PaidOrder {
  const { cc, s } = ctx;
  const buyer: Buyer = { profile: g.profile, minute };
  const lines = items.map((id) => ({ id, ...discountedLine(cc, s, id, buyer) }));
  const by: Record<string, number> = {};
  const receipt: [string, number][] = [];
  let free = -1;
  const coffees = lines.map((l, i) => [l, i] as const).filter(([l]) => isCoffee(cc, l.id));
  const card = cc.discounts.loyaltyCard;
  if (!reorder && !g.flatRate && loyaltyActive(cc, s) && coffees.length > 0) {
    const cheapest = [...coffees].sort((a, b) => a[0].price - b[0].price)[0];
    if (g.regular !== null) {
      // Carte vraie: un tampon par café payé, le café qui suit le huitième est offert.
      let n = s.stamps[g.regular] ?? 0;
      for (const [, i] of coffees) {
        if (n >= card.stamps && free < 0) {
          free = i;
          n = 0;
        } else n++;
      }
      s.stamps[g.regular] = n;
      receipt.push(['stamps', n]);
    } else if (card.profiles.includes(g.profile) && ctx.sim.random.chance(holderShare(cc, s))) {
      // Groupe ordinaire: la carte du groupe est pleine une visite sur neuf.
      if (ctx.sim.random.chance(1 / (card.stamps + 1)) && cheapest !== undefined)
        free = cheapest[1];
      else receipt.push(['stamped', 0]);
    }
  }
  let amount = 0;
  let list = 0;
  let listNotFree = 0;
  lines.forEach((l, i) => {
    list += l.base;
    if (i === free) {
      // Le café offert ne s'encaisse pas: tout son prix d'ardoise est une remise consentie.
      by.freeCoffee = (by.freeCoffee ?? 0) + l.base;
      return;
    }
    amount += l.price;
    listNotFree += l.base;
    if (l.kind !== null) by[l.kind] = (by[l.kind] ?? 0) + (l.base - l.price);
  });
  const kinds = Object.entries(by).filter(([k, n]) => k !== 'freeCoffee' && n > 0);
  receipt.unshift(...kinds.map(([k, n]): [string, number] => [k, n]));
  if (free >= 0) receipt.unshift(['freeCoffee', by.freeCoffee ?? 0]);
  const off = listNotFree > 0 ? 1 - amount / listNotFree : 0;
  return { amount, list, off, receipt, by };
}

// ---------------------------------------------------------------------------------------------
// Attrait (RM-05) et offre du jour

/** Indice de prix d'un profil avec les remises données à cette minute (`null`: sans heure douce). */
export function discountedIndex(
  cc: ClienteleContent,
  s: ClienteleState,
  p: Profile,
  d: DiscountSettings,
  minute: number | null,
): number {
  const step = cc.economy.priceSteps.step;
  const buyer: Buyer | null = { profile: p.id, minute: minute ?? -1 };
  const rows: [number, number, boolean][] = [];
  for (const [id, st] of s.slate) {
    const r = cc.recipes.get(id);
    if (r === undefined) continue;
    if (r.family !== p.mainCraving && !p.secondaryCravings.includes(r.family)) continue;
    const rates = lineRates(cc, s, d, r, buyer);
    const announced = rates.find(([k]) => k !== 'dailyOffer');
    rows.push([1 + st * step, rates[0]?.[1] ?? 0, announced !== undefined]);
  }
  // Ce que l'ardoise annonce (« boissons -20 % »): l'indice se lit sur les lignes annoncées.
  const shown = rows.some(([, , a]) => a) ? rows.filter(([, , a]) => a) : rows;
  if (shown.length === 0) return priceIndex(cc, p, s.slate);
  return shown.reduce((sum, [x, rate]) => sum + x * (1 - rate), 0) / shown.length;
}

/** Attrait avec les remises du jour, heure par heure (moyenne pondérée sur l'heure douce). */
export function hourlyAttraction(
  cc: ClienteleContent,
  s: ClienteleState,
  p: Profile,
  a: Attraction,
  attraction: (cc: ClienteleContent, p: Profile, a: Attraction) => number,
  hours: number,
): number[] {
  const d = s.activeDiscounts;
  const base = attraction(cc, p, a);
  let loyal = 1;
  if (d !== null && loyaltyActive(cc, s) && cc.discounts.loyaltyCard.profiles.includes(p.id)) {
    const l = cc.discounts.loyaltyCard;
    loyal = 1 + (l.attractionBonusMax * holderShare(cc, s)) / l.holderShareMax;
  }
  if (d === null) return Array.from({ length: hours }, () => base);
  const off = attraction(cc, p, { ...a, index: discountedIndex(cc, s, p, d, null) }) * loyal;
  const on =
    attraction(cc, p, { ...a, index: discountedIndex(cc, s, p, d, d.happyHour.start * 60) }) *
    loyal;
  const open = cc.days.open / 60;
  const hh0 = d.happyHour.start;
  const hh1 = hh0 + d.happyHour.length;
  const hhToday = d.happyHour.on && dayIn(cc, s, d.happyHour.days);
  return Array.from({ length: hours }, (_, i) => {
    const h = open + i;
    const c = hhToday ? Math.max(0, Math.min(h + 1, hh1) - Math.max(h, hh0)) : 0;
    return off * (1 - c) + on * c;
  });
}

/** Recette de l'offre du jour (réglage du jour), si elle est sur l'ardoise. */
export function featuredRecipe(s: ClienteleState): string | null {
  const o = s.activeDiscounts?.dailyOffer ?? null;
  if (o === null || !s.slate.some(([id]) => id === o[0])) return null;
  return o[0];
}

export interface OfferSuggestion {
  readonly recipe: string;
  readonly left: number;
  readonly usual: number;
}

/**
 * Suggestion de l'offre du jour (RM-09): un lot finit demain et ce qui en reste dépasse les
 * ventes habituelles de la recette (moyenne des trois derniers jours ouverts).
 */
export function offerSuggestion(cc: ClienteleContent, s: ClienteleState): OfferSuggestion | null {
  let best: OfferSuggestion | null = null;
  for (const [id] of s.slate) {
    const r = cc.recipes.get(id);
    if (r === undefined) continue;
    for (const [ing, qty] of r.ingredients) {
      const ending = (s.lots[ing] ?? []).filter((l) => l[1] === s.day + 1 && l[0] > 1e-9);
      if (ending.length === 0 || qty <= 0) continue;
      const left = Math.floor(ending.reduce((sum, l) => sum + l[0], 0) / qty + 1e-9);
      const days = s.soldHistory.slice(-3);
      const usual =
        days.length === 0 ? 0 : days.reduce((sum, d) => sum + (d[id] ?? 0), 0) / days.length;
      if (left < 1 || left <= usual * cc.discounts.dailyOffer.suggestWhenLeftOverUsual) continue;
      if (best === null || left - usual > best.left - best.usual)
        best = { recipe: id, left, usual: Math.round(usual * 10) / 10 };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Marketing

function nextWeekday(cc: ClienteleContent, from: number, wd: string, strict: boolean): number {
  for (let d = strict ? from + 1 : from; d < from + 15; d++) if (weekdayId(cc, d) === wd) return d;
  return from + 1;
}

/** Premier jour d'effet d'une action lancée le soir du jour `day` (RM-11). */
export function campaignFirstDay(cc: ClienteleContent, a: MarketingAction, day: number): number {
  if (a.publishWeekday !== undefined) {
    const deadline =
      a.deadlineWeekday === undefined ? day : nextWeekday(cc, day, a.deadlineWeekday, false);
    return nextWeekday(cc, deadline, a.publishWeekday, true);
  }
  let d = day;
  const launch: readonly string[] = a.launchWeekdays ?? [];
  if (launch.length > 0) while (!launch.includes(weekdayId(cc, d)) && d < day + 8) d++;
  return d + (a.delayDays ?? 1);
}

export function campaignEnd(cc: ClienteleContent, c: Campaign): number {
  return c.firstDay + (cc.actions.get(c.id)?.durationDays ?? 1) - 1;
}

/** Supplément d'une action pour un profil, le jour `day` (avant le plafond). */
export function campaignSupplement(
  cc: ClienteleContent,
  c: Campaign,
  profile: string,
  day: number,
): number {
  const a = cc.actions.get(c.id);
  if (a === undefined) return 0;
  const t = day - c.firstDay;
  if (t < 0 || t >= a.durationDays) return 0;
  return a.peak * (a.profiles[profile] ?? 0) * 0.5 ** (t / a.halfLifeDays) * c.factor;
}

/** Facteur de marketing d'un profil (RM-12): `1 + max x (1 - exp(-E / max))`. */
export function marketingFactor(
  cc: ClienteleContent,
  s: ClienteleState,
  profile: string,
  day = s.day,
): number {
  const max = cc.marketing.maxBoost;
  const e = s.campaigns.reduce((sum, c) => sum + campaignSupplement(cc, c, profile, day), 0);
  return e <= 0 ? 1 : 1 + max * (1 - Math.exp(-e / max));
}

export type CampaignStatus =
  | { readonly kind: 'idle'; readonly firstDay: number; readonly tired: boolean }
  | { readonly kind: 'pending'; readonly firstDay: number }
  | { readonly kind: 'running'; readonly until: number; readonly fading: boolean }
  | { readonly kind: 'locked' };

/** Ce que montre la ligne d'une action dans « Faire connaître ». */
export function campaignStatus(
  cc: ClienteleContent,
  s: ClienteleState,
  id: string,
): CampaignStatus {
  const a = cc.actions.get(id);
  if (a?.tier !== 'P0') return { kind: 'locked' };
  const last = [...s.campaigns].reverse().find((c) => c.id === id);
  if (last !== undefined) {
    const end = campaignEnd(cc, last);
    if (s.day < last.firstDay) return { kind: 'pending', firstDay: last.firstDay };
    if (s.day <= end)
      return { kind: 'running', until: end, fading: s.day - last.firstDay >= a.halfLifeDays };
  }
  const tired =
    last !== undefined && s.day - campaignEnd(cc, last) < cc.marketing.repeatCooldownDays;
  return { kind: 'idle', firstDay: campaignFirstDay(cc, a, s.day), tired };
}

/** Plus de deux actions en cours vers un même profil: elles se marchent dessus. */
export function saturated(cc: ClienteleContent, s: ClienteleState): boolean {
  return cc.profileList.some(
    (p) => s.campaigns.filter((c) => campaignSupplement(cc, c, p.id, s.day) > 0).length >= 3,
  );
}

/** Débit d'une action: tout de suite, ligne « Publicité » du bilan du jour (RM-10). */
export function startCampaign(ctx: Ctx, id: string, by: PlayerIndex | null): string | null {
  const { cc, s } = ctx;
  const a = cc.actions.get(id);
  const st = campaignStatus(cc, s, id);
  if (a === undefined || st.kind === 'locked') return 'Action inconnue';
  if (st.kind !== 'idle') return 'Déjà en cours';
  const price = cents(a.cost);
  if (price > availableCents(cc, s)) return 'La caisse ne suffit plus';
  s.cash -= price;
  s.today.marketing += price;
  // Lancée le soir, après le bilan: le bilan du jour la compte aussi (résultat = somme des lignes).
  if (s.report !== null && s.report.day === s.day) {
    s.report.marketing += price;
    s.report.result -= price;
    s.report.cash = s.cash;
  }
  s.campaigns.push({
    id,
    launchedDay: s.day,
    firstDay: st.firstDay,
    factor: st.tired ? cc.marketing.repeatFactor : 1,
  });
  ctx.sim.emit({ type: 'clientele-campaign', action: id, by, price, firstDay: st.firstDay });
  return null;
}

/** Une action demandée par un joueur: refusée, lancée, ou proposée à l'autre au-delà du seuil. */
export function launchCampaign(ctx: Ctx, player: PlayerIndex, id: string): string | null {
  const { cc, s } = ctx;
  if (s.phase === 'service' || s.phase === 'closing')
    return 'Une action se lance le soir ou avant d’ouvrir';
  if (s.debt > 0) return 'Il reste une somme à régler: les achats attendent';
  const a = cc.actions.get(id);
  const st = campaignStatus(cc, s, id);
  if (a === undefined || st.kind === 'locked') return 'Action inconnue';
  if (st.kind !== 'idle') return 'Déjà en cours';
  const price = cents(a.cost);
  const missing = price - availableCents(cc, s);
  if (missing > 0) return `Il manque ${(missing / 100).toFixed(2).replace('.', ',')} €`;
  const mine = s.proposals.findIndex((p) => p.by === player);
  if (mine >= 0) s.proposals.splice(mine, 1);
  if (a.cost >= cc.marketing.bigProposalEuros) {
    s.proposals.push({ by: player, item: id, price });
    ctx.sim.emit({ type: 'clientele-proposal', by: player, item: id, price });
    return null;
  }
  return startCampaign(ctx, id, player);
}

/** Part d'un groupe servi venue des actions (RM-14), répartie entre elles. */
export function campaignShares(
  cc: ClienteleContent,
  s: ClienteleState,
  profile: string,
): Map<string, number> {
  const out = new Map<string, number>();
  const f = marketingFactor(cc, s, profile);
  if (f <= 1) return out;
  const part = (f - 1) / f;
  const sup = s.campaigns.map((c) => [c.id, campaignSupplement(cc, c, profile, s.day)] as const);
  const e = sup.reduce((sum, [, x]) => sum + x, 0);
  for (const [id, x] of sup) if (x > 0) out.set(id, (out.get(id) ?? 0) + (part * x) / e);
  return out;
}

/** Part due au bouche-à-oreille: les tasses au-delà de 1,5 (affichage seulement). */
export function wordShare(cc: ClienteleContent, cups: number): number {
  return Math.max(0, 1 - cupsFactor(cc, 1.5) / cupsFactor(cc, cups));
}

/** Un groupe servi: compteur « Venus grâce à » (habitués et invités de scène exclus, RM-16). */
export function countServed(ctx: Ctx, g: Group): void {
  const { cc, s } = ctx;
  for (const id of g.items) s.today.sold[id] = (s.today.sold[id] ?? 0) + 1;
  if (g.regular !== null || g.role !== null) return;
  for (const [id, x] of campaignShares(cc, s, g.profile))
    s.today.fromCampaigns[id] = (s.today.fromCampaigns[id] ?? 0) + x;
  s.today.fromWord += wordShare(cc, s.cups);
}

/**
 * Mot du livre d'or dû à une action ou une remise (RM-15): une fois par action et par jour.
 * Rend le texte écrit, `null` sinon (le mot habituel du groupe peut alors s'écrire).
 */
export function campaignWord(ctx: Ctx, g: Group, sat: number): string | null {
  const { cc, s } = ctx;
  if (g.regular !== null || g.role !== null) return null;
  const random = ctx.sim.random;
  const m = cc.marketing;
  const words = s.today.campaignWords;
  const lines = cc.discounts.texts.guestbook;
  if (g.receipt.some(([k]) => k === 'freeCoffee') && !words.includes('fidelite')) {
    if (random.chance(cc.discounts.loyaltyCard.guestbookChance)) {
      words.push('fidelite');
      return random.pick(lines.fidelite ?? ['']);
    }
  }
  if (sat < m.guestbookMinSatisfaction) return null;
  const shares = campaignShares(cc, s, g.profile);
  let total = 0;
  for (const x of shares.values()) total += x;
  if (total > 0 && random.chance(total) && random.chance(m.guestbookChance)) {
    let u = random.next() * total;
    for (const [id, x] of shares) {
      u -= x;
      if (u > 0) continue;
      const a = cc.actions.get(id);
      if (a === undefined || words.includes(id) || a.guestbook.length === 0) return null;
      words.push(id);
      return random.pick(a.guestbook);
    }
    return null;
  }
  for (const [kind, key] of [
    ['happyHour', 'heure_douce'],
    ['profile:randonneurs', 'tarif_randonneur'],
  ] as const) {
    if (!g.receipt.some(([k]) => k === kind) || words.includes(key)) continue;
    if (!random.chance(m.guestbookChance)) continue;
    words.push(key);
    return random.pick(lines[key] ?? ['']);
  }
  return null;
}
