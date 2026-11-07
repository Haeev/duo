/**
 * Points d'extension du service pour les autres chantiers, chez l'hôte (dans leur `system.step`
 * ou `system.intent`, avec le `SimContext` reçu). Aucun ne lève d'erreur: un appel impossible
 * rend `false` ou `null`, l'appelant réessaie au pas suivant.
 */
import type { Content } from '../donnees/charger';
import type { World } from '../etat/monde';
import { furnitureById, objectById, objectOnSlot } from '../simulation/monde';
import type { SimContext } from '../simulation/systemes';
import type { Quality, Receipt } from './etat';
import { itemOf, placeFurniture, recipeKnown, recipeOf } from './regles';

export interface OrderLine {
  readonly recipe: string;
  readonly options?: readonly string[];
  /** Prix de l'ardoise du jour; par défaut le prix conseillé de la recette. */
  readonly price?: number;
}

/**
 * Clientèle (b): un client arrive à la caisse et attend qu'on prenne sa commande. Un joueur
 * « Agit » sur la caisse (2,5 s, plus 0,4 s par article), le ticket monte au rail et l'achat est
 * encaissé (`world.service.receipts`, événement `service-paid`). `false` si une recette est
 * inconnue ou pas encore débloquée.
 */
export function presentOrder(
  sim: SimContext,
  customer: string,
  lines: readonly OrderLine[],
): boolean {
  if (lines.length === 0) return false;
  const articles = [];
  for (const l of lines) {
    const recipe = recipeOf(sim.content, l.recipe);
    if (recipe === undefined || !recipeKnown(sim.content, sim.world, l.recipe)) return false;
    articles.push({
      recipe: l.recipe,
      options: [...(l.options ?? [])],
      price: l.price ?? recipe.price,
      object: null,
    });
  }
  sim.world.service.waiting.push({ customer, articles });
  return true;
}

/**
 * Clientèle (b): le client renonce (patience épuisée). Sa commande quitte la file; un ticket déjà
 * pris est retiré et ses articles restent « Prêts » pour le suivant (CO-09). L'encaissement déjà
 * relevé n'est pas rendu: à l'économie de décider.
 */
export function abandonOrder(sim: SimContext, customer: string): void {
  const s = sim.world.service;
  s.waiting = s.waiting.filter((w) => w.customer !== customer);
  for (const t of s.tickets.filter((u) => u.customer === customer)) {
    for (const i of s.items) if (i.ticket === t.id) i.ticket = null;
  }
  s.tickets = s.tickets.filter((t) => t.customer !== customer);
}

/** Statut de la commande d'un client: en file, au rail, prête sur le passe, ou inconnue. */
export function orderStatus(
  world: World,
  customer: string,
):
  | { readonly kind: 'waiting' }
  | { readonly kind: 'ticket'; readonly ticket: number; readonly ready: boolean }
  | null {
  if (world.service.waiting.some((w) => w.customer === customer)) return { kind: 'waiting' };
  const t = world.service.tickets.find((u) => u.customer === customer);
  return t === undefined ? null : { kind: 'ticket', ticket: t.id, ready: t.status === 'ready' };
}

export interface Collected {
  readonly ticket: number;
  readonly customer: string | null;
  /** Objets posés à la table (le client les consomme, puis `finishConsumption`). */
  readonly objects: readonly number[];
  readonly recipes: readonly string[];
  readonly qualities: readonly (Quality | null)[];
  /** Dessin sur le lait réussi par article (concours, satisfaction). */
  readonly art: readonly (string | null)[];
}

/**
 * Clientèle (b): le client prend son plateau sur le passe (SE-01) et s'assoit à `table` (meuble
 * posé), ou reste au comptoir, ou part (`null`). Les articles se posent sur les emplacements libres
 * de la table; ceux qui n'y tiennent pas sont bus au comptoir et leur vaisselle part à la plonge.
 * `null` si le ticket n'est pas prêt.
 */
export function collectTicket(
  sim: SimContext,
  ticketId: number,
  table: string | null,
): Collected | null {
  const { world, content } = sim;
  const s = world.service;
  const ticket = s.tickets.find((t) => t.id === ticketId);
  if (ticket?.status !== 'ready') return null;
  const placed = table === null ? undefined : furnitureById(world, table);
  const slots = placed === undefined ? [] : (content.furniture.get(placed.type)?.slots ?? []);
  const objects: number[] = [];
  const recipes: string[] = [];
  const qualities: (Quality | null)[] = [];
  const art: (string | null)[] = [];
  const takeaway = table === null && s.equipment.includes('gobelets');
  for (const a of ticket.articles) {
    if (a.object === null) continue;
    const object = objectById(world, a.object);
    const item = itemOf(s, a.object);
    recipes.push(a.recipe);
    qualities.push(item?.quality ?? null);
    art.push(item?.art?.shape ?? null);
    const recipe = recipeOf(content, a.recipe);
    if (object === undefined || recipe === undefined) continue;
    const free =
      placed === undefined
        ? undefined
        : slots.find((sl) => objectOnSlot(world, placed.id, sl.id) === undefined);
    if (placed !== undefined && free !== undefined) {
      object.at = { kind: 'slot', furniture: placed.id, slot: free.id };
      objects.push(object.id);
      s.items = s.items.filter((i) => i.object !== object.id);
    } else {
      s.items = s.items.filter((i) => i.object !== object.id);
      world.objects = world.objects.filter((o) => o.id !== object.id);
      if (!takeaway) s.dirtyBacklog[recipe.vessel] += recipe.dishes;
    }
  }
  s.tickets = s.tickets.filter((t) => t.id !== ticketId);
  sim.emit({ type: 'service-ticket-collected', ticket: ticketId, customer: ticket.customer });
  return { ticket: ticketId, customer: ticket.customer, objects, recipes, qualities, art };
}

/**
 * Clientèle (b): le client a fini; ses articles posés sur la table deviennent de la vaisselle sale
 * à débarrasser (PL-01). Une théière (thé, deux pièces) part directement à la plonge.
 */
export function finishConsumption(sim: SimContext, objects: readonly number[]): void {
  const { world, content } = sim;
  for (const id of objects) {
    const object = objectById(world, id);
    const recipe = object === undefined ? undefined : recipeOf(content, object.type);
    if (object === undefined || recipe === undefined) continue;
    object.type = content.service.settings.vessels[recipe.vessel].dirty;
    if (recipe.dishes > 1) world.service.dirtyBacklog.tasse += recipe.dishes - 1;
  }
}

/**
 * Économie (b): encaissements depuis le dernier relevé (un par commande prise), vidés à la
 * lecture. À appeler chez l'hôte à chaque pas.
 */
export function drainReceipts(world: World): Receipt[] {
  const receipts = world.service.receipts;
  world.service.receipts = [];
  return receipts;
}

/** Économie (b): un pourboire tombe dans le pot (le son suit l'événement). */
export function leaveTip(sim: SimContext, amount: number): void {
  if (amount > 0) sim.emit({ type: 'service-tip', amount: Math.round(amount * 100) / 100 });
}

/**
 * Livraisons (b): un carton d'un ingrédient arrive sur la palette de la cour (ST-03). Les
 * joueurs le portent à son rangement et le rangent d'un geste (ST-04). `false` si la palette est
 * pleine ou absente: réessayer plus tard.
 */
export function deliverCarton(sim: SimContext, ingredient: string, units?: number): boolean {
  const { world, content } = sim;
  const info = content.service.ingredients.get(ingredient);
  const settings = content.service.settings;
  const palette = world.furniture.find((f) => f.type === settings.palette);
  if (info === undefined || palette === undefined) return false;
  const slot = content.furniture
    .get(palette.type)
    ?.slots.find((sl) => objectOnSlot(world, palette.id, sl.id) === undefined);
  if (slot === undefined) return false;
  const id = world.nextObjectId++;
  world.objects.push({
    id,
    type: info.heavy ? settings.cartons.heavy : settings.cartons.light,
    at: { kind: 'slot', furniture: palette.id, slot: slot.id },
  });
  world.service.cartons.push({ object: id, ingredient, units: units ?? info.cartonUnits });
  sim.emit({ type: 'service-carton-delivered', ingredient, object: id });
  return true;
}

/** Stock d'un ingrédient (unités de `ingredients.json`). */
export function stockOf(world: World, ingredient: string): number {
  return world.service.stock[ingredient] ?? 0;
}

/**
 * Fermeture (b): ce qui ne se garde pas (viennoiseries, pain du jour: `shelfDays` 1 au plus)
 * quitte le stock pour le panier du soir (ST-06). Rend les quantités données.
 */
export function takeUnsoldFresh(sim: SimContext): { ingredient: string; qty: number }[] {
  const out: { ingredient: string; qty: number }[] = [];
  for (const i of sim.content.service.ingredients.values()) {
    const qty = sim.world.service.stock[i.id] ?? 0;
    if (i.shelfDays <= 1 && qty > 0) {
      out.push({ ingredient: i.id, qty });
      sim.world.service.stock[i.id] = 0;
    }
  }
  return out;
}

/** Habitués (b): une recette se débloque (« Simone la montre le jour 2 »). */
export function unlockRecipe(sim: SimContext, recipe: string): boolean {
  if (recipeOf(sim.content, recipe) === undefined) return false;
  if (!sim.world.service.unlocked.includes(recipe)) {
    sim.world.service.unlocked.push(recipe);
    sim.emit({ type: 'service-recipe-unlocked', recipe });
  }
  return true;
}

/**
 * Achat d'équipement du service (`service/equipements.json`), payé par l'économie ou
 * l'aménagement: fiche de recette, vaisselle, niveau de poste, et pose du meuble (le moulin à dose
 * remplace le moulin, le lave-vaisselle se glisse sous l'arrière-comptoir). `false` si l'achat
 * est inconnu.
 */
export function applyPurchase(sim: SimContext, purchaseId: string): boolean {
  const { world, content } = sim;
  const purchase = content.service.purchases.get(purchaseId);
  if (purchase === undefined) return false;
  const s = world.service;
  for (const e of purchase.effects) {
    if (e.kind === 'recipe') unlockRecipe(sim, e.recipe);
    else if (e.kind === 'dishes') {
      // Un service de vaisselle: moitié tasses, un quart de verres, un quart d'assiettes.
      const glasses = Math.floor(e.count / 4);
      s.clean.verre += glasses;
      s.clean.assiette += glasses;
      s.clean.tasse += e.count - 2 * glasses;
    } else if (e.kind === 'station-level') {
      // Un poste qui a son meuble (moulin à dose) prend son niveau du meuble posé.
      if (purchase.furniture === null) s.equipment.push(`niveau:${e.station}:${e.level}`);
    } else if (!s.equipment.includes(e.equip)) s.equipment.push(e.equip);
  }
  if (purchase.furniture !== null) installEquipment(content, world, purchase.furniture);
  sim.emit({ type: 'service-equipment', purchase: purchaseId });
  return true;
}

/** Pose un meuble du service acheté à sa place prévue (`service/reglages.json`, `purchaseSpots`). */
export function installEquipment(content: Content, world: World, type: string): boolean {
  const spot = content.service.settings.purchaseSpots[type];
  if (spot === undefined) return false;
  if ('replaces' in spot) {
    const old = world.furniture.find((f) => f.type === spot.replaces);
    if (old === undefined) return false;
    old.type = type;
    return true;
  }
  if (furnitureById(world, spot.id) !== undefined) return true;
  const placed = placeFurniture(world, { ...spot, type });
  if (placed === null) return false;
  world.furniture.push(placed);
  return true;
}

/** Événement « La vieille dame tousse » (b): un groupe ne donne plus qu'un filet, puis revient. */
export function setGroupOut(sim: SimContext, furniture: string, out: boolean): void {
  const s = sim.world.service;
  s.groupsOut = s.groupsOut.filter((f) => f !== furniture);
  if (out) s.groupsOut.push(furniture);
}
