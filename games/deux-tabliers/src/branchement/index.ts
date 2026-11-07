/**
 * Branchement des chantiers dans la simulation, chez l'hôte: la clientèle (b) tient les clients,
 * la caisse en centimes, l'ardoise et le stock; le service (a) tient les gestes, les tickets, le
 * passe et la vaisselle; l'aménagement (c) tient les meubles, la décoration et les extensions.
 *
 * Catalogue des recettes et des prix: une seule autorité par sujet.
 * - Carte et prix: `donnees/clientele/carte.json` (prix de base, pas de l'ardoise du jour, ce que
 *   les clients choisissent). Le prix d'une ligne est celui de `linePrice` (clientèle); il est
 *   recopié dans l'article du ticket, jamais relu dans `service/recettes.json`.
 * - Gestes: `donnees/service/recettes.json` (récipient, étapes, postes). Les deux fichiers ont les
 *   mêmes recettes et ingrédients, aux identifiants près: la clientèle écrit `pain_chocolat`, le
 *   service `pain-chocolat` (`serviceId` ci-dessous). Le test de branchement vérifie que chaque
 *   recette et chaque ingrédient de la carte a son double au service.
 * - Stock: celui de la clientèle fait foi (consommé à la commande, livré le matin). Le service en
 *   reçoit une copie à chaque pas, plus ce que les articles pas encore commencés vont prendre,
 *   pour que ses gestes ne refusent jamais une commande déjà payée.
 * - Recettes connues: `clientele.known` fait foi, recopié dans `service.unlocked`.
 *
 * Parcours d'un groupe: en tête de file (`register`), sa commande attend à la caisse
 * (`presentOrder`); un joueur tient Agir sur la caisse, le ticket monte au rail et l'encaissement
 * (`drainReceipts`) fait payer le groupe (`takeOrderAt`). Le ticket prêt sur le passe, le groupe
 * est servi (`deliver`, qualités des gestes) et emporte son plateau à sa place (`collectTicket`).
 * À son départ, ce qu'il a laissé sur la table devient de la vaisselle sale (`finishConsumption`).
 * Une recommande (ou une commande prise par l'interface) devient un ticket sans passer par la
 * caisse; prête, elle part à la table du groupe.
 */
import { connectArrangementEconomy } from '../amenagement';
import {
  availableCents,
  bigPurchaseCents,
  cartonStowed,
  ctxOf,
  deliver,
  prepareOrder,
  reportInspection,
  takeOrderAt,
  takeServiceOutbox,
} from '../clientele';
import { linePrice, tierOpen as clienteleTierOpen } from '../clientele/economie';
import type { Group, Quality as ClienteleQuality } from '../clientele/etat';
import type { World } from '../etat/monde';
import {
  abandonOrder,
  applyPurchase,
  deliverCarton,
  drainReceipts,
  finishConsumption,
  presentOrder,
  setGroupOut,
  collectTicket,
  unlockRecipe,
} from '../service';
import type { Quality, Ticket } from '../service/etat';
import { openTicket, recipeOf } from '../service/regles';
import type { Chantier, SimContext } from '../simulation/systemes';

/** Identifiant du service pour une recette ou un ingrédient de la clientèle. */
export function serviceId(id: string): string {
  return id.replaceAll('_', '-');
}

/** Identifiant de client du service pour un groupe de la clientèle. */
export function customerOf(group: number): string {
  return `g${String(group)}`;
}

/** Client du service venu de la clientèle (les autres, des tests du service, ne sont pas à nous). */
function ours(customer: string | null): customer is string {
  return customer !== null && /^g\d+$/.test(customer);
}

function groupOfCustomer(world: World, customer: string | null): Group | undefined {
  if (!ours(customer)) return undefined;
  const id = Number(customer.slice(1));
  return world.clientele.groups.find((g) => g.id === id);
}

const QUALITY: Readonly<Record<Quality, ClienteleQuality>> = {
  parfait: 'perfect',
  bien: 'good',
  correct: 'fine',
};

/** Ce que l'hôte retient d'un pas à l'autre sans l'écrire dans le monde. */
interface Runtime {
  /** Cartons posés sur la palette par le branchement: objet, ingrédient de la clientèle. */
  readonly cartons: Map<number, string>;
  /** Objets posés à la table d'un groupe, rendus sales à son départ. */
  readonly served: Map<number, number[]>;
}

const runtimes = new WeakMap<World, Runtime>();

function runtimeOf(world: World): Runtime {
  let r = runtimes.get(world);
  if (r === undefined) {
    r = { cartons: new Map(), served: new Map() };
    for (const c of world.service.cartons)
      r.cartons.set(c.object, c.ingredient.replaceAll('-', '_'));
    runtimes.set(world, r);
  }
  return r;
}

/** Stock et recettes de la clientèle recopiés au service (voir l'en-tête). */
function syncService(sim: SimContext): void {
  const { world, content } = sim;
  const c = world.clientele;
  const s = world.service;
  const reserved = new Map<string, number>();
  const reserve = (recipe: string): void => {
    const r = recipeOf(content, recipe);
    if (r === undefined) return;
    for (const i of r.ingredients) reserved.set(i.id, (reserved.get(i.id) ?? 0) + i.qty);
  };
  for (const t of s.tickets) for (const a of t.articles) if (a.object === null) reserve(a.recipe);
  // Café fermé (lundi, soir), le service garde son stock: on s'exerce aux gestes sans rien vendre.
  const open = c.phase === 'prep' || c.phase === 'service' || c.phase === 'closing';
  for (const ing of open ? content.clientele.supplies.ingredients : []) {
    const id = serviceId(ing.id);
    const want = (c.stock[ing.id] ?? 0) + (reserved.get(id) ?? 0);
    if (s.stock[id] !== want) s.stock[id] = want;
  }
  for (const id of c.known) {
    const sid = serviceId(id);
    if (!s.unlocked.includes(sid) && recipeOf(content, sid) !== undefined) unlockRecipe(sim, sid);
  }
}

/** Commande d'un groupe arrivé en tête de file: elle attend à la caisse. */
function presentAtRegister(sim: SimContext): void {
  const { world } = sim;
  const ctx = ctxOf(sim);
  const s = world.service;
  for (const g of world.clientele.groups) {
    if (g.stage !== 'register' || g.paid !== null) continue;
    const customer = customerOf(g.id);
    if (s.waiting.some((w) => w.customer === customer)) continue;
    if (s.tickets.some((t) => t.customer === customer)) continue;
    const items = prepareOrder(ctx, g);
    if (items.length === 0) continue;
    const lines = items.map((id) => ({
      recipe: serviceId(id),
      price: linePrice(ctx.cc, ctx.s, id) / 100,
    }));
    presentOrder(sim, customer, lines);
  }
  // Une commande en attente dont le groupe n'est plus à la caisse (parti, ou commande prise
  // par l'interface) quitte la file.
  for (const w of [...s.waiting]) {
    const g = groupOfCustomer(world, w.customer);
    if (!ours(w.customer)) continue;
    if (g?.stage !== 'register' || g.paid !== null) abandonOrder(sim, w.customer);
  }
}

/** Encaissements du service: le groupe paie (caisse de la clientèle). */
function settleReceipts(sim: SimContext): void {
  const receipts = drainReceipts(sim.world);
  // Les encaissements d'autres clients (tests du service) restent dans la boîte.
  sim.world.service.receipts = receipts.filter((r) => !ours(r.customer));
  for (const r of receipts) {
    const g = groupOfCustomer(sim.world, r.customer);
    if (g?.stage !== 'register' || g.paid !== null) continue;
    takeOrderAt(sim, r.player, g.id);
  }
}

/** Commandes payées sans ticket (recommandes, commande de l'interface): un ticket direct. */
function ticketsFromOutbox(sim: SimContext): void {
  const { world } = sim;
  const ctx = ctxOf(sim);
  const box = takeServiceOutbox(world);
  for (const o of box.orders) {
    const customer = customerOf(o.group);
    if (!o.reorder && world.service.tickets.some((t) => t.customer === customer)) continue;
    const articles = o.items
      .filter((id) => recipeOf(sim.content, serviceId(id)) !== undefined)
      .map((id) => ({
        recipe: serviceId(id),
        options: [],
        price: linePrice(ctx.cc, ctx.s, id) / 100,
        object: null,
      }));
    if (articles.length === 0) {
      deliver(sim, o.group);
      continue;
    }
    abandonOrderIfWaiting(sim, customer);
    openTicket(sim, customer, articles, o.player);
    // L'encaissement est déjà fait par la clientèle (`pay`).
    world.service.receipts = world.service.receipts.filter((r) => r.customer !== customer);
  }
  // Les cartons livrés sont suivis par `stepCartons` (liste `clientele.cartons`), la vaisselle
  // laissée par les vrais objets posés sur les tables.
}

function abandonOrderIfWaiting(sim: SimContext, customer: string): void {
  if (sim.world.service.waiting.some((w) => w.customer === customer)) abandonOrder(sim, customer);
}

function serveResult(
  sim: SimContext,
  ticket: Ticket,
): {
  qualities: ClienteleQuality[];
  latteArt: boolean;
} {
  const qualities: ClienteleQuality[] = [];
  let latteArt = false;
  for (const a of ticket.articles) {
    const item = sim.world.service.items.find((i) => i.object === a.object);
    qualities.push(item?.quality === null || item === undefined ? 'good' : QUALITY[item.quality]);
    if (item !== undefined && item.art !== null) latteArt = true;
  }
  return { qualities, latteArt };
}

/** Tickets prêts sur le passe: le groupe est servi et emporte son plateau à sa place. */
function serveReady(sim: SimContext): void {
  const { world } = sim;
  const rt = runtimeOf(world);
  for (const t of [...world.service.tickets]) {
    if (t.status !== 'ready' || !ours(t.customer)) continue;
    const g = groupOfCustomer(world, t.customer);
    if (g === undefined) {
      // Personne pour ce ticket (parti): ses articles restent prêts pour le suivant (CO-09).
      abandonOrder(sim, t.customer);
      continue;
    }
    if (g.stage !== 'waiting' && g.stage !== 'seated' && g.stage !== 'toSeat') continue;
    const result = serveResult(sim, t);
    const refusal = deliver(sim, g.id, { ...result, homemade: false });
    if (refusal !== null) {
      abandonOrder(sim, t.customer);
      continue;
    }
    const got = collectTicket(sim, t.id, g.takeAway ? null : g.table);
    if (got !== null && got.objects.length > 0)
      rt.served.set(g.id, [...(rt.served.get(g.id) ?? []), ...got.objects]);
  }
}

/** Au départ d'un groupe, ce qu'il a laissé devient sale (le service le fait débarrasser). */
function stepDepartures(sim: SimContext): void {
  const rt = runtimeOf(sim.world);
  for (const [id, objects] of rt.served) {
    const g = sim.world.clientele.groups.find((x) => x.id === id);
    if (g !== undefined && g.stage !== 'leaving') continue;
    finishConsumption(sim, objects);
    rt.served.delete(id);
  }
}

/** Cartons livrés le matin: posés sur la palette quand il y a la place, comptés une fois rangés. */
function stepCartons(sim: SimContext): void {
  const { world } = sim;
  const rt = runtimeOf(world);
  for (const [object, ingredient] of [...rt.cartons]) {
    if (world.service.cartons.some((c) => c.object === object)) continue;
    rt.cartons.delete(object);
    cartonStowed(world, ingredient);
  }
  const onPalette = new Map<string, number>();
  for (const ing of rt.cartons.values()) onPalette.set(ing, (onPalette.get(ing) ?? 0) + 1);
  for (const [ingredient, count] of world.clientele.cartons) {
    let missing = count - (onPalette.get(ingredient) ?? 0);
    while (missing > 0) {
      const before = world.nextObjectId;
      // Le stock est déjà compté à la livraison (clientèle): le carton rangé n'ajoute rien.
      if (!deliverCarton(sim, serviceId(ingredient), 0)) return;
      rt.cartons.set(before, ingredient);
      missing--;
    }
  }
}

/** Achats de la clientèle qui touchent le service (fiche de recette, crêpière, vaisselle...). */
function stepPurchases(sim: SimContext): void {
  const c = sim.world.clientele;
  for (const [id, , ready] of c.purchases) {
    const mark = `service:${id}`;
    if (ready > c.day || c.flags.includes(mark)) continue;
    const sid = serviceId(id);
    if (sim.content.service.purchases.has(sid)) applyPurchase(sim, sid);
    c.flags.push(mark);
  }
}

/** Panne du jour 6: un groupe de la machine sur deux; l'inspection relève la pile de tasses. */
function stepConditions(sim: SimContext): void {
  const { world } = sim;
  const degraded = world.clientele.conditions.includes('machine-degraded');
  const out = world.service.groupsOut.includes('groupe-2');
  if (degraded !== out) setGroupOut(sim, 'groupe-2', degraded);
  if (world.clientele.event?.id === 'l_inspection' && world.service.clean.tasse === 0)
    reportInspection(world, 'cups');
}

export const branchementChantier: Chantier = {
  id: 'branchement',
  system: {
    id: 'branchement',
    step(sim) {
      if (sim.world.clientele.day === 0) return;
      syncService(sim);
      settleReceipts(sim);
      ticketsFromOutbox(sim);
      presentAtRegister(sim);
      serveReady(sim);
      stepDepartures(sim);
      stepCartons(sim);
      stepPurchases(sim);
      stepConditions(sim);
    },
  },
};

// Économie de l'aménagement: la caisse de la clientèle, en centimes (les prix de l'aménagement
// sont en euros). Branché au chargement du module, sur les deux machines.
connectArrangementEconomy({
  available: (world, content) => {
    const c = world.clientele;
    return c.day === 0 ? 0 : Math.max(0, availableCents(content.clientele, c)) / 100;
  },
  spend: (sim, amount) => {
    const c = sim.world.clientele;
    const cost = Math.round(amount * 100);
    c.cash -= cost;
    c.today.spent += cost;
  },
  tierOpen: (world, content, tier) => clienteleTierOpen(content.clientele, world.clientele, tier),
  serviceOpen: (world) =>
    world.clientele.phase === 'service' || world.clientele.phase === 'closing',
  needsAgreement: (world, content, amount) =>
    Math.round(amount * 100) >= bigPurchaseCents(content.clientele, world.clientele),
  occupied: (world, furniture) =>
    world.clientele.groups.some((g) => g.seats.includes(furniture) || g.table === furniture),
});
