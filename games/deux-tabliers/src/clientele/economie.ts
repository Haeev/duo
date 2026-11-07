/**
 * Économie de la démo (cahier 4.9, 4.10, 4.15, 4.16; démo 6.1 et 6.3): caisse en centimes,
 * réputation en demi-tasses, ambiance calculée objet par objet, paliers, achats et accord des deux,
 * fournisseurs. Règles chiffrées de `demo_v0_1.py` (`tasses`, `ambiance`, `coherence`, `palier_ouvert`).
 */
import type { PlayerIndex } from '../etat/monde';
import type { SimContext } from '../simulation/systemes';
import type { CatalogItem, ClienteleContent } from './donnees';
import type { ClienteleState } from './etat';
import { seatList } from './places';

export interface Ctx {
  readonly sim: SimContext;
  readonly cc: ClienteleContent;
  readonly s: ClienteleState;
}

export const cents = (euros: number): number => Math.round(euros * 100);

export function rentCents(cc: ClienteleContent): number {
  return cents(cc.economy.rentPerMonth / cc.economy.rentDaysPerMonth);
}

/** Réserve jamais entamée par un achat: deux jours de loyer et de charges (EC-04, D-05). */
export function reserveCents(cc: ClienteleContent): number {
  return cents(
    cc.economy.reserveDaysOfCharges *
      (cc.economy.rentPerMonth / cc.economy.rentDaysPerMonth + cc.economy.chargesPerOpenDay),
  );
}

/** Ce qu'on peut dépenser: caisse moins la réserve et les sommes réservées par les propositions. */
export function availableCents(cc: ClienteleContent, s: ClienteleState): number {
  const held = s.proposals.reduce((sum, p) => sum + p.price, 0);
  return s.cash - reserveCents(cc) - held - s.debt;
}

export function cupsFromPoints(cc: ClienteleContent, points: number): number {
  const r = cc.economy.reputation;
  let k = 0;
  while (
    (r.stepPoints * (k + 1) * (k + 2)) / 2 <= points &&
    r.startCups + 0.5 * (k + 1) <= r.maxCups
  )
    k++;
  return r.startCups + 0.5 * k;
}

/** Ajoute des points de réputation (et autant de renommée); annonce une demi-tasse gagnée. */
export function addPoints(ctx: Ctx, points: number): void {
  if (points <= 0) return;
  ctx.s.points += points;
  ctx.s.renown += points;
  ctx.s.today.points += points;
  const cups = cupsFromPoints(ctx.cc, ctx.s.points);
  if (cups > ctx.s.cups) {
    ctx.s.cups = cups;
    ctx.sim.emit({ type: 'clientele-cups', cups });
  }
}

export function tierOpen(cc: ClienteleContent, s: ClienteleState, tier: string | null): boolean {
  if (tier === null) return false;
  const t = cc.economy.tiers.find((x) => x.id === tier);
  return t !== undefined && (s.cups >= t.cups || s.day >= t.orDay);
}

/** Paliers ouverts à la réputation ou au jour, le premier des deux (D-04). */
export function updateTiers(ctx: Ctx): void {
  for (const t of ctx.cc.economy.tiers) {
    if (ctx.s.tiers.includes(t.id) || !tierOpen(ctx.cc, ctx.s, t.id)) continue;
    ctx.s.tiers.push(t.id);
    ctx.sim.emit({ type: 'clientele-tier', tier: t.id });
  }
}

export function owns(s: ClienteleState, item: string): boolean {
  return s.purchases.some(([id]) => id === item);
}

export function extensionReady(s: ClienteleState, ext: string): boolean {
  return s.purchases.some(([id, , ready]) => id === ext && ready <= s.day);
}

// ---------------------------------------------------------------------------------------------
// Ambiance (démo 6.3)

interface Decor {
  readonly charm: number;
  readonly style: string;
  readonly light: boolean;
}

function decorList(cc: ClienteleContent, s: ClienteleState): Decor[] {
  const a = cc.economy.ambiance;
  const out: Decor[] = [];
  const push = (item: CatalogItem | undefined, factor: number): void => {
    if (item === undefined) return;
    const coat = a.coatMultiplier[item.category] ?? 1;
    out.push({
      charm: item.charm * factor * coat,
      style: item.style,
      light: item.category === 'light',
    });
  };
  for (const d of cc.economy.startDecor)
    for (let i = 0; i < d.count; i++)
      push(cc.catalogue.get(d.id), d.worn && !owns(s, `renover_${d.id}`) ? a.wornCharmFactor : 1);
  for (const [id] of s.purchases) push(cc.catalogue.get(id), 1);
  for (const [id, day] of s.gifts) if (day <= s.day) push(cc.catalogue.get(id), 1);
  for (const [ext, decor] of Object.entries(a.extensionDecor)) {
    if (!extensionReady(s, ext)) continue;
    for (const [, charm, style, light] of decor) out.push({ charm, style, light: light > 0 });
  }
  return out;
}

export function coherence(
  cc: ClienteleContent,
  points: ReadonlyMap<string, number>,
): [string, number] {
  const wheel = cc.economy.ambiance.wheel;
  const styled = [...points].filter(([k, x]) => wheel.includes(k) && x > 0);
  if (styled.length === 0) return [cc.economy.ambiance.radioStyle, 0];
  let dom = styled[0]?.[0] ?? '';
  for (const [k, x] of styled) if (x > (points.get(dom) ?? 0)) dom = k;
  const i = wheel.indexOf(dom);
  const at = (d: number): number => points.get(wheel[(i + d + 6) % 6] ?? '') ?? 0;
  const total = styled.reduce((sum, [, x]) => sum + x, 0);
  const val = (points.get(dom) ?? 0) + 0.5 * (at(1) + at(-1)) - 0.5 * at(3);
  return [dom, Math.max(0, Math.min(1, val / total))];
}

export interface AmbianceInfo {
  readonly value: number;
  readonly style: string;
  readonly coherence: number;
}

export function ambiance(ctx: Ctx): AmbianceInfo {
  const { cc, s } = ctx;
  const a = cc.economy.ambiance;
  let surface = a.surfaces.salle ?? 26;
  for (const [ext, m2] of Object.entries(a.surfaces))
    if (ext !== 'salle' && extensionReady(s, ext)) surface += m2;
  const decor = decorList(cc, s);
  const pts = new Map<string, number>();
  let charm = 0;
  let lights = 0;
  for (const d of decor) {
    charm += d.charm;
    pts.set(d.style, (pts.get(d.style) ?? 0) + d.charm);
    if (d.light) lights++;
  }
  const deco = Math.min(a.decorMax, (a.decorMax * charm) / (a.charmPerM2ForMax * surface));
  const [style, coh] = coherence(cc, pts);
  const seats = seatList(ctx.sim, cc, s);
  const comfortSeats = seats.filter((x) => x.kind === 'comfort').length;
  const comfort = Math.min(
    a.comfortMax,
    (a.comfortFactor * comfortSeats) / Math.max(1, seats.length),
  );
  const light = Math.min(a.lightMax, (a.lightMax * lights) / (surface / a.lightPerM2));
  const music = style === a.radioStyle ? a.musicMatching : a.musicOther;
  const value = Math.min(
    a.max,
    deco + a.coherenceMax * coh + comfort + light + music + a.cleanliness,
  );
  return { value, style, coherence: coh };
}

// ---------------------------------------------------------------------------------------------
// Achats (EC-04, EC-05, SI-06, SI-10)

export interface Offer {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly kind: 'purchase' | 'extension' | 'catalogue';
}

/** Ce qui s'achète aujourd'hui, prix en centimes (palier ouvert, brocante du lundi, marché aux fleurs). */
export function offerOf(cc: ClienteleContent, s: ClienteleState, item: string): Offer | string {
  const p = cc.purchases.get(item);
  if (p !== undefined) {
    if (owns(s, p.id)) return 'Déjà acheté';
    if (!tierOpen(cc, s, p.tier)) return 'Pas encore à ce palier';
    return { id: p.id, name: p.name, price: cents(p.price), kind: 'purchase' };
  }
  const e = cc.extensions.get(item);
  if (e !== undefined) {
    if (owns(s, e.id)) return 'Déjà commandé';
    if (!tierOpen(cc, s, e.tier) && !s.unlocks.includes(e.id)) return 'Pas encore à ce palier';
    return { id: e.id, name: e.name, price: cents(e.price), kind: 'extension' };
  }
  const c = cc.catalogue.get(item);
  if (c === undefined) return 'Introuvable au catalogue';
  if (c.source === 'brocante') {
    if (!s.brocante.includes(c.id) || cc.days.weekdays[(s.day - 1) % 7] !== 'mon')
      return 'Seulement à la brocante du lundi';
  } else if (c.source !== null) return 'Pièce unique: elle ne s’achète pas';
  else if (!tierOpen(cc, s, c.tier)) return 'Pas encore à ce palier';
  const fm = cc.economy.flowerMarket;
  const discount =
    c.category === 'plant' && s.day >= fm.day && s.day <= fm.untilDay ? fm.discount : 0;
  const coat = cc.economy.ambiance.coatMultiplier[c.category] ?? 1;
  return {
    id: c.id,
    name: c.name,
    price: cents(c.price * coat * (1 - discount)),
    kind: 'catalogue',
  };
}

/** Seuil des achats importants: 150 € ou les recettes moyennes d'une journée (démo 6.1). */
export function bigPurchaseCents(cc: ClienteleContent, s: ClienteleState): number {
  const open = s.history.filter(([, , served]) => served > 0);
  const avg =
    open.length === 0 ? 0 : open.reduce((sum, h) => sum + Math.max(0, h[1]), 0) / open.length;
  return Math.max(
    cents(cc.economy.bigPurchase.minimum),
    Math.round(avg * cc.economy.bigPurchase.shareOfDailyRevenue),
  );
}

function applyEffects(ctx: Ctx, effects: readonly string[]): void {
  const { s } = ctx;
  for (const e of effects) {
    const [kind, a, b] = e.split(':');
    if (kind === 'poste' && a !== undefined) {
      s.stations[a] = Math.max(s.stations[a] ?? 0, Number(b ?? 1));
      for (const r of ctx.cc.recipeList)
        if (
          r.unlock.kind === 'purchase' &&
          r.unlock.item !== undefined &&
          owns(s, r.unlock.item) &&
          !s.known.includes(r.id)
        )
          s.known.push(r.id);
    } else if (kind === 'equip' && a !== undefined && !s.equipment.includes(a)) s.equipment.push(a);
    else if (kind === 'recette' && a !== undefined && !s.known.includes(a)) s.known.push(a);
    else if (kind === 'vaisselle' && a !== undefined) s.dishes += Number(a);
  }
}

/** Achat effectif: débite, inscrit, applique ses effets (stations, recettes, travaux). */
export function completePurchase(ctx: Ctx, offer: Offer, by: PlayerIndex | null): void {
  const { s, cc } = ctx;
  s.cash -= offer.price;
  const nights = offer.kind === 'extension' ? (cc.extensions.get(offer.id)?.nights ?? 1) : 0;
  s.purchases.push([offer.id, s.day, s.day + nights]);
  if (offer.kind === 'purchase') applyEffects(ctx, cc.purchases.get(offer.id)?.effects ?? []);
  const comfort = cc.catalogue.get(offer.id)?.comfort === true;
  if (comfort && !s.equipment.includes('fauteuils')) s.equipment.push('fauteuils');
  ctx.sim.emit({ type: 'clientele-purchased', item: offer.id, by, price: offer.price });
}

/** Un achat demandé par un joueur: refusé, fait tout de suite, ou proposé à l'autre. */
export function requestPurchase(ctx: Ctx, player: PlayerIndex, item: string): string | null {
  const { s, cc } = ctx;
  if (s.debt > 0) return 'Il reste une somme à régler: les achats attendent';
  const offer = offerOf(cc, s, item);
  if (typeof offer === 'string') return offer;
  const mine = s.proposals.findIndex((p) => p.by === player);
  if (mine >= 0) s.proposals.splice(mine, 1);
  const missing = offer.price - availableCents(cc, s);
  if (missing > 0) return `Il manque ${(missing / 100).toFixed(2).replace('.', ',')} €`;
  if (offer.price >= bigPurchaseCents(cc, s)) {
    s.proposals.push({ by: player, item: offer.id, price: offer.price });
    ctx.sim.emit({ type: 'clientele-proposal', by: player, item: offer.id, price: offer.price });
    return null;
  }
  completePurchase(ctx, offer, player);
  return null;
}

/** Réponse de l'autre joueur à une proposition (jamais celui qui l'a faite). */
export function answerProposal(
  ctx: Ctx,
  player: PlayerIndex,
  by: PlayerIndex,
  accept: boolean,
): string | null {
  const { s, cc } = ctx;
  if (by === player) return 'C’est à l’autre de répondre';
  const i = s.proposals.findIndex((p) => p.by === by);
  const p = s.proposals[i];
  if (p === undefined) return 'Plus de proposition';
  s.proposals.splice(i, 1);
  if (!accept) return null;
  const offer = offerOf(cc, s, p.item);
  if (typeof offer === 'string') return offer;
  if (offer.price > availableCents(cc, s)) return 'La caisse ne suffit plus';
  completePurchase(ctx, offer, by);
  return null;
}

// ---------------------------------------------------------------------------------------------
// Fournisseurs (ST-02 à ST-06)

/** Unités servies d'un ingrédient par une recette de l'ardoise. */
function slateNeeds(cc: ClienteleContent, s: ClienteleState): Map<string, number> {
  const need = new Map<string, number>();
  for (const [id] of s.slate) {
    const r = cc.recipes.get(id);
    if (r === undefined) continue;
    for (const [ing, qty] of r.ingredients)
      need.set(ing, (need.get(ing) ?? 0) + qty * cc.supplies.ordering.baselineServingsPerRecipe);
  }
  return need;
}

/** Commande habituelle: moyenne des derniers jours (ou une base pour l'ardoise), moins le stock. */
export function suggestedOrder(cc: ClienteleContent, s: ClienteleState): Record<string, number> {
  const o = cc.supplies.ordering;
  const days = s.usage.slice(-o.historyDays);
  const base = slateNeeds(cc, s);
  const out: Record<string, number> = {};
  for (const ing of cc.supplies.ingredients) {
    let use = 0;
    if (days.length > 0) use = days.reduce((sum, d) => sum + (d[ing.id] ?? 0), 0) / days.length;
    if (use === 0) use = base.get(ing.id) ?? 0;
    const want = use * o.margin - (s.stock[ing.id] ?? 0);
    if (want > 0) out[ing.id] = Math.ceil(want / ing.cartonUnits);
  }
  return out;
}

/** Livraison du matin: le stock monte, les cartons attendent d'être rangés (chantier a). */
export function deliver(
  ctx: Ctx,
  order: Readonly<Record<string, number>>,
  emergency: boolean,
): void {
  const cartons: [string, number, boolean][] = [];
  for (const [id, n] of Object.entries(order)) {
    const ing = ctx.cc.ingredients.get(id);
    if (ing === undefined || n <= 0) continue;
    ctx.s.stock[id] = (ctx.s.stock[id] ?? 0) + n * ing.cartonUnits;
    cartons.push([id, n, ing.cartonHeavy]);
    const pending = ctx.s.cartons.find(([c]) => c === id);
    if (pending === undefined) ctx.s.cartons.push([id, n, ing.cartonHeavy]);
    else pending[1] += n;
  }
  if (cartons.length === 0) return;
  ctx.s.outbox.cartons.push(...cartons.map((c): [string, number, boolean] => [c[0], c[1], c[2]]));
  ctx.sim.emit({ type: 'clientele-delivery', cartons, emergency });
}

/** Une recette se sert-elle encore avec le stock (ST-05: sinon grisée sur l'ardoise) ? */
export function inStock(
  cc: ClienteleContent,
  s: ClienteleState,
  recipe: string,
  portions = 1,
): boolean {
  const r = cc.recipes.get(recipe);
  if (r === undefined) return false;
  return r.ingredients.every(([ing, qty]) => (s.stock[ing] ?? 0) + 1e-9 >= qty * portions);
}

/** Consomme le stock d'une recette vendue et rend son coût en matières (centimes). */
export function consume(cc: ClienteleContent, s: ClienteleState, recipe: string): number {
  const r = cc.recipes.get(recipe);
  if (r === undefined) return 0;
  for (const [ing, qty] of r.ingredients) {
    s.stock[ing] = Math.max(0, (s.stock[ing] ?? 0) - qty);
    s.todayUse[ing] = (s.todayUse[ing] ?? 0) + qty;
  }
  return cents(r.costMaterials);
}

/** Prix d'une ligne de l'ardoise, en centimes. */
export function linePrice(cc: ClienteleContent, s: ClienteleState, recipe: string): number {
  const r = cc.recipes.get(recipe);
  if (r === undefined) return 0;
  const step = s.slate.find(([id]) => id === recipe)?.[1] ?? 0;
  return cents(r.basePrice * (1 + step * cc.economy.priceSteps.step));
}
