/**
 * Les chantiers (tour 9, section 2.6): deux files, un chantier ouvert à la fois par file. Ceux du
 * bourg se paient par souscription au tableau du quai (par 50 ou 100 aubrins, ou « le reste »), ceux
 * de la maisonnette d'un coup à l'établi de Basile, 10 aubrins de moins par planche apportée. Un
 * chantier payé est bâti par Basile dans la nuit: il paraît au matin suivant. Rien n'est perdu: ce
 * qui est versé reste au chantier.
 */
import { rawText } from '../donnees/contenu';
import type { ImprovementDef, ImprovementQueue } from '../donnees/types';
import type { Character, ImprovementState } from '../etat/types';
import { type Sim, distance, emit, newId, notifyKey, partnerOf, say } from './contexte';
import { countInBag, takeFromBag } from './sac';
import { POINT } from './ids';
import { queueOpen } from '../etat/files-chantiers';
import { confirmOrder, isRoomOrder, morningRooms, orderAtBasile, roomName } from './pieces';

/**
 * Chantiers au départ: aucune entrée. Format 13 (taille de l'état transmis): un chantier qui n'a
 * encore rien reçu n'est pas écrit; `improvementView` le lit à zéro, `improvementState` l'ajoute
 * au premier versement.
 */
export function emptyImprovements(): Record<string, ImprovementState> {
  return {};
}

const UNTOUCHED: Readonly<ImprovementState> = Object.freeze({ paid: 0, planks: 0, funded: false, builtDay: null });

/** Lecture seule: l'état du chantier, à zéro s'il n'a encore rien reçu (rien n'est ajouté). */
export function improvementView(sim: Pick<Sim, 'world'>, id: string): Readonly<ImprovementState> {
  return sim.world.improvements[id] ?? UNTOUCHED;
}

/** L'état du chantier à modifier (ajouté à zéro s'il n'existait pas). */
export function improvementState(sim: Sim, id: string): ImprovementState {
  let state = sim.world.improvements[id];
  if (state === undefined) {
    state = { paid: 0, planks: 0, funded: false, builtDay: null };
    sim.world.improvements[id] = state;
  }
  return state;
}

export function improvementBuilt(sim: Pick<Sim, 'world'>, id: string): boolean {
  const s = sim.world.improvements[id];
  return s !== undefined && s.builtDay !== null;
}

export function improvementName(sim: Sim, id: string): string {
  // Tour 10: les pièces et le grand coffre se commandent aussi à Basile.
  if (isRoomOrder(sim, id)) return roomName(sim, id);
  return rawText(sim.content.texts, 'chantiers', id, 'name') ?? id;
}

/** Prix restant: prix, moins ce qui est versé, moins les planches apportées. */
export function improvementRemaining(sim: Sim, def: ImprovementDef): number {
  const s = sim.content.settings.improvements;
  const state = improvementView(sim, def.id);
  return Math.max(0, def.price - state.paid - state.planks * (s?.plankDiscount ?? 0));
}

/**
 * Le chantier ouvert de cette file: le premier pas encore bâti, une fois la file ouverte; le suivant
 * s'ouvre le matin qui suit la construction du précédent. Un chantier payé reste ouvert jusqu'au
 * matin (Basile y travaille la nuit).
 */
export function openImprovement(sim: Sim, queue: ImprovementQueue): ImprovementDef | null {
  const s = sim.content.settings.improvements;
  if (s === null || !queueOpen(s, sim.world, queue)) return null;
  const list = sim.content.improvements.filter((x) => x.queue === queue).sort((a, b) => a.order - b.order);
  for (const def of list) {
    const state = sim.world.improvements[def.id];
    if (state?.builtDay === null || state === undefined) return def;
    // Bâti ce matin: le suivant s'ouvre le matin d'après.
    if (state.builtDay >= sim.world.clock.day) return null;
  }
  return null;
}

/** Les chantiers ouverts des deux files. */
export function openImprovements(sim: Sim): ImprovementDef[] {
  const out: ImprovementDef[] = [];
  for (const q of ['bourg', 'maisonnette', 'elevage'] as const) {
    const def = openImprovement(sim, q);
    if (def !== null) out.push(def);
  }
  return out;
}

function atPayPoint(sim: Sim, c: Character, def: ImprovementDef): boolean {
  const range = sim.content.settings.ranges.talk;
  const id = def.payAt === 'board' ? POINT.noticeBoard : POINT.workbench;
  const at = sim.map.points[id];
  const menu = def.payAt === 'board' ? c.menu === 'catalogue' : c.menu === 'workbench';
  return menu || (at !== undefined && distance(c.pos, at) <= range);
}

/** Apporter des planches à Basile pour un chantier de la maisonnette (au plus `plankDiscountMax`). */
export function bringPlanks(sim: Sim, c: Character, id: string, count: number): void {
  const s = sim.content.settings.improvements;
  const def = sim.content.improvements.find((x) => x.id === id);
  if (s === null || def?.payAt !== 'basile' || count < 1) return;
  if (openImprovement(sim, def.queue)?.id !== id || !atPayPoint(sim, c, def)) return;
  const state = improvementState(sim, id);
  if (state.funded) return;
  // Jamais plus de planches que ce qui reste à payer (le prix ne descend pas sous zéro).
  const room = Math.min(s.plankDiscountMax - state.planks, Math.floor((def.price - state.paid) / Math.max(1, s.plankDiscount)) - state.planks);
  const n = Math.min(count, room, countInBag(c, 'plank'));
  if (n <= 0) return;
  takeFromBag(c, 'plank', n);
  state.planks += n;
  sim.runtime.changed = true;
  emit(sim, { type: 'improvement_paid', by: c.id, improvement: id, amount: 0, planks: n });
  settleFunded(sim, def);
}

/**
 * Verser au chantier `id`: `amount` aubrins, ou le reste (`null`). À Basile, seulement le reste (d'un
 * coup). Au-delà de `bigPurchaseThreshold`, l'autre doit d'abord accepter (EC-04).
 */
export function payImprovement(sim: Sim, c: Character, id: string, amount: number | null): void {
  if (isRoomOrder(sim, id)) {
    orderAtBasile(sim, c, id);
    return;
  }
  const def = sim.content.improvements.find((x) => x.id === id);
  if (def === undefined || openImprovement(sim, def.queue)?.id !== id || !atPayPoint(sim, c, def)) return;
  const state = improvementState(sim, id);
  if (state.funded) return;
  const remaining = improvementRemaining(sim, def);
  const sum = def.payAt === 'basile' || amount === null ? remaining : Math.min(Math.floor(amount), remaining);
  if (sum <= 0) return;
  if (sim.world.proposals.some((p) => p.purchase.source === 'improvement' && p.purchase.item === id)) return;
  if (sum > sim.world.purse) {
    say(sim, c.id, 'not_enough_money', { missing: sum - sim.world.purse });
    return;
  }
  if (sum >= sim.content.settings.economy.bigPurchaseThreshold) {
    const proposal = newId(sim, 'o');
    sim.world.purse -= sum;
    sim.world.proposals = sim.world.proposals.filter((p) => p.by !== c.id);
    sim.world.proposals.push({ id: proposal, by: c.id, purchase: { source: 'improvement', item: id, count: sum }, price: sum });
    notifyKey(sim, partnerOf(c.id), 'proposal', 'improvement_proposal', { partner: c.name, name: improvementName(sim, id), price: sum }, { proposal });
    emit(sim, { type: 'proposal', by: c.id, proposal });
    return;
  }
  sim.world.purse -= sum;
  creditImprovement(sim, c, id, sum);
}

/** Le versement accepté (ou petit): il s'ajoute au chantier. */
export function creditImprovement(sim: Sim, c: Character, id: string, sum: number): void {
  if (isRoomOrder(sim, id)) {
    confirmOrder(sim, c, id, sum);
    return;
  }
  const def = sim.content.improvements.find((x) => x.id === id);
  if (def === undefined) return;
  const state = improvementState(sim, id);
  // Rien ne se perd: un versement accepté après un autre ne dépasse pas le prix, le trop-perçu revient.
  const room = improvementRemaining(sim, def);
  const kept = Math.min(sum, room);
  if (sum > kept) sim.world.purse += sum - kept;
  state.paid += kept;
  sim.runtime.changed = true;
  emit(sim, { type: 'improvement_paid', by: c.id, improvement: id, amount: kept, planks: 0 });
  settleFunded(sim, def);
}

function settleFunded(sim: Sim, def: ImprovementDef): void {
  if (improvementView(sim, def.id).funded || improvementRemaining(sim, def) > 0) return;
  const state = improvementState(sim, def.id);
  state.funded = true;
  say(sim, 'both', 'improvement_funded', { name: improvementName(sim, def.id) });
  emit(sim, { type: 'improvement_funded', improvement: def.id });
}

/** Le matin: Basile a bâti dans la nuit ce qui est payé. */
export function morningImprovements(sim: Sim): void {
  for (const def of sim.content.improvements) {
    const state = sim.world.improvements[def.id];
    if (state?.funded !== true || state.builtDay !== null) continue;
    state.builtDay = sim.world.clock.day;
    if (!sim.world.flags.includes(def.flag)) sim.world.flags.push(def.flag);
    sim.runtime.dynamicDirty = true;
    sim.runtime.changed = true;
    notifyKey(sim, 'both', 'message', 'chantier_built', { name: improvementName(sim, def.id) });
    emit(sim, { type: 'improvement_built', improvement: def.id });
  }
  // Tour 10: sites et pièces bâties dans la nuit, grand coffre livré.
  morningRooms(sim);
}

/** Chantiers bâtis (compteur de l'écran d'étape). */
export function improvementsBuilt(sim: Pick<Sim, 'world'>): number {
  return Object.values(sim.world.improvements).filter((s) => s.builtDay !== null).length;
}
