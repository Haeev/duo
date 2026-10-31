/**
 * Robot de test (ADR 0005, point 5): joue la démo à deux avec les mêmes
 * intentions que des joueurs. Sert aux tests de fumée et d'endurance; ce
 * n'est pas un mode de jeu. `p1` s'occupe surtout du potager, `p2` du bois;
 * les rendez-vous se font à deux.
 */
import type { AuthoredIntent, ClickTarget, ControlFrame, Intent } from '../etat/actions';
import type { Character, CharacterId, Vec2 } from '../etat/types';
import { MINUTES_PER_HOUR, SECONDS_PER_MINUTE, SIM_HZ, TOOLBAR_SLOTS } from './constantes';
import { type Sim, character, distance, partnerOf } from './contexte';
import { pickDialogue } from './dialogues';
import { refreshBlockers } from './deplacement';
import { findPath, isBlockedCell } from './grille';
import { ITEM, POINT } from './ids';
import { countInBag, countInStacks, heldStack } from './sac';
import { shopOpen } from './economie';
import { canPlace } from './amenagement';
import { currentOrder } from '../donnees/commandes';
import { holdsRod, waterAhead } from './peche';

interface Memory {
  /** Ne rien décider avant ce tick (attente d'un geste, d'un trajet). */
  waitUntil: number;
  /** Cible du trajet en cours (pour ne pas redemander le même trajet à chaque pas). */
  goingTo: string | null;
  /** Objectifs abandonnés jusqu'à ce tick (inatteignables). */
  skip: Record<string, number>;
  seq: number;
  /** Ce que le robot fait, pour les messages d'échec des tests. */
  job: string;
  /** Dernier tick où il a envoyé une intention (présence, PA-04). */
  lastIntent: number;
}

export interface Robot {
  /** Entrées du pas pour les deux personnages. */
  decide(sim: Sim): { controls: Partial<Record<CharacterId, ControlFrame>>; intents: AuthoredIntent[] };
  job(id: CharacterId): string;
}

const HOUR = MINUTES_PER_HOUR;
/** Heure où le robot rentre à la maison. */
const GO_HOME_AT = 19 * HOUR;
/** Le robot donne signe de vie au moins toutes les N pas (une minute). */
const PRESENCE_TICKS = SECONDS_PER_MINUTE * SIM_HZ;
/** Planches à garder pour la commande en cours (la ligne de planches, s'il y en a une). */
function planksForOrder(sim: Sim): number {
  return currentOrder(sim.content.settings, sim.world).lines.find((l) => l.item === 'plank')?.count ?? 0;
}

function frame(m: Memory, moveX = 0, moveY = 0, actHeld = false): ControlFrame {
  m.seq += 1;
  return { seq: m.seq, moveX, moveY, actHeld };
}

function busy(sim: Sim, c: Character): boolean {
  return c.crafting !== null || (c.action.duration > 0 && sim.world.tick < c.action.since + c.action.duration);
}

/** Va vers une cible et agit en arrivant (même chemin qu'un clic du joueur). */
function goAct(sim: Sim, c: Character, m: Memory, key: string, target: ClickTarget, pos: Vec2, reach: number, out: Intent[]): boolean {
  if ((m.skip[key] ?? 0) > sim.world.tick) return false;
  m.job = key;
  if (distance(c.pos, pos) <= reach) {
    out.push({ type: 'move_to', target, act: true });
    m.goingTo = null;
    m.waitUntil = sim.world.tick + 2;
    return true;
  }
  if (m.goingTo === key && c.destination !== null) return true;
  const path = findPath(refreshBlockers(sim), c.pos, pos);
  if (path === null) {
    m.skip[key] = sim.world.tick + 300;
    return false;
  }
  out.push({ type: 'move_to', target, act: true });
  m.goingTo = key;
  return true;
}

/** Va à un point sans agir. */
function goTo(sim: Sim, c: Character, m: Memory, key: string, pos: Vec2, reach: number, out: Intent[]): boolean {
  if (distance(c.pos, pos) <= reach || (m.skip[key] ?? 0) > sim.world.tick) return false;
  m.job = key;
  if (m.goingTo === key && c.destination !== null) return true;
  if (findPath(refreshBlockers(sim), c.pos, pos) === null) {
    m.skip[key] = sim.world.tick + 300;
    return false;
  }
  out.push({ type: 'move_to', target: { kind: 'ground', x: pos.x, y: pos.y }, act: false });
  m.goingTo = key;
  return true;
}

function selectItem(c: Character, item: string, out: Intent[]): boolean {
  if (heldStack(c)?.item === item) return true;
  const slot = c.bag.findIndex((s) => s?.item === item);
  if (slot < 0) return false;
  if (slot >= TOOLBAR_SLOTS) {
    out.push({ type: 'swap_slots', from: slot, to: TOOLBAR_SLOTS - 1 });
    out.push({ type: 'select_slot', slot: TOOLBAR_SLOTS - 1 });
  } else {
    out.push({ type: 'select_slot', slot });
  }
  return false;
}

function pt(sim: Sim, id: string): Vec2 {
  return sim.map.points[id] ?? { x: 0, y: 0 };
}

function ground(p: Vec2): ClickTarget {
  return { kind: 'ground', x: p.x, y: p.y };
}

function questStep(sim: Sim, quest: string): string | null {
  const q = sim.world.quests.find((x) => x.id === quest);
  if (q?.status !== 'active') return null;
  return sim.content.quests.find((x) => x.id === quest)?.steps[q.step]?.id ?? null;
}

function questDone(sim: Sim, quest: string): boolean {
  return sim.world.quests.some((q) => q.id === quest && q.status === 'done');
}

function built(sim: Sim, id: string): boolean {
  return sim.world.constructions.some((k) => k.id === id && k.status === 'done');
}

// ---------------------------------------------------------------------------
// Tâches

/** Parler à un habitant qui a quelque chose de nouveau à dire (rencontre, quête, indice). */
function social(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  for (const v of sim.world.villagers) {
    if (!v.visible || v.talkingWith.length > 0) continue;
    const d = pickDialogue(sim, v.id, c.id);
    if (d === null || d.kind === 'daily') continue;
    if ((d.kind === 'quest' || d.kind === 'hint') && d.once === null) continue;
    if (goAct(sim, c, m, `parler:${v.id}`, { kind: 'villager', villager: v.id }, v.pos, sim.content.settings.ranges.talk - 0.5, out)) return true;
  }
  return false;
}

function buy(sim: Sim, c: Character, m: Memory, wants: { item: string; count: number }[], out: Intent[]): boolean {
  const missing = wants.filter((w) => countInBag(c, w.item) < w.count);
  if (missing.length === 0 || !shopOpen(sim)) return false;
  const cost = missing.reduce((sum, w) => sum + (sim.content.items[w.item]?.buyPrice ?? 0) * (w.count - countInBag(c, w.item)), 0);
  if (cost > sim.world.purse) return false;
  const counter = pt(sim, POINT.groceryCounter);
  if (c.menu !== 'shop') return goAct(sim, c, m, 'boutique', ground(counter), counter, 1.2, out);
  for (const w of missing) out.push({ type: 'buy', item: w.item, count: w.count - countInBag(c, w.item) });
  out.push({ type: 'menu', menu: null });
  m.waitUntil = sim.world.tick + 2;
  return true;
}

function sellExtra(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  if (!sim.world.flags.includes(sim.content.settings.economy.grocer.buysAfterFlag) || !shopOpen(sim)) return false;
  const carrots = countInBag(c, 'carrot') - Math.max(2, orderNeed(sim, 'carrot'));
  if (carrots < 3 || sim.world.grocerSoldToday > 0) return false;
  const counter = pt(sim, POINT.groceryCounter);
  if (c.menu !== 'shop') return goAct(sim, c, m, 'vendre', ground(counter), counter, 1.2, out);
  out.push({ type: 'sell', item: 'carrot', quality: 'ordinary', count: carrots });
  out.push({ type: 'sell', item: 'carrot', quality: 'fine', count: carrots });
  out.push({ type: 'menu', menu: null });
  m.waitUntil = sim.world.tick + 2;
  return true;
}

/** Ce qu'il est encore utile de semer ce jour-là (mûr avant le train de la commande en cours). */
function seedPlan(sim: Sim): string[] {
  const { day } = sim.world.clock;
  const last = currentOrder(sim.content.settings, sim.world).day;
  if (sim.world.orderIndex > 0) return orderSeedPlan(sim, day, last);
  const plan: string[] = [];
  const order = ['radish', 'lettuce', 'carrot'];
  for (const crop of order) {
    const def = sim.content.crops[crop];
    if (def !== undefined && day + def.growthDays <= last) plan.push(crop);
  }
  return plan;
}

/** Après la première commande: les cultures que la commande demande encore, mûres à temps. */
function orderSeedPlan(sim: Sim, day: number, last: number): string[] {
  const plan: string[] = [];
  for (const crop of Object.values(sim.content.crops)) {
    if (day + crop.growthDays > last) continue;
    const growing = sim.world.garden.filter((g) => g.crop?.crop === crop.id).length * crop.yieldPerCell;
    if (orderNeed(sim, crop.harvest) > inBags(sim, crop.harvest) + growing) plan.push(crop.id);
  }
  return plan;
}

function garden(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  const cells = sim.world.garden;
  // Récolter.
  for (const g of cells) {
    if (g.crop?.ripe === true) {
      const p = { x: g.cell.cx + 0.5, y: g.cell.cy + 0.5 };
      return goAct(sim, c, m, `recolter:${g.index}`, ground(p), p, 1.2, out);
    }
  }
  // Bêcher.
  const grass = cells.find((g) => g.soil === 'grass');
  if (grass !== undefined && countInBag(c, ITEM.hoe) > 0) {
    if (!selectItem(c, ITEM.hoe, out)) return true;
    const p = { x: grass.cell.cx + 0.5, y: grass.cell.cy + 0.5 };
    return goAct(sim, c, m, `becher:${grass.index}`, ground(p), p, 1.2, out);
  }
  // Semer: un tiers de chaque culture encore utile.
  const plan = seedPlan(sim);
  const empty = cells.filter((g) => g.soil === 'tilled' && g.crop === null);
  if (empty.length > 0 && plan.length > 0) {
    const counts = new Map<string, number>();
    for (const g of cells) if (g.crop !== null) counts.set(g.crop.crop, (counts.get(g.crop.crop) ?? 0) + 1);
    const share = Math.ceil(cells.length / 3);
    const crop = plan.find((k) => (counts.get(k) ?? 0) < share) ?? plan[0];
    const seed = crop === undefined ? undefined : sim.content.crops[crop]?.seed;
    if (seed !== undefined) {
      if (countInBag(c, seed) === 0) {
        if (buy(sim, c, m, [{ item: seed, count: Math.min(empty.length, share) }], out)) return true;
      } else {
        if (!selectItem(c, seed, out)) return true;
        const g = empty[0];
        if (g !== undefined) {
          const p = { x: g.cell.cx + 0.5, y: g.cell.cy + 0.5 };
          return goAct(sim, c, m, `semer:${g.index}`, ground(p), p, 1.2, out);
        }
      }
    }
  }
  // Arroser.
  const thirsty = cells.find((g) => g.crop !== null && !g.crop.ripe && !g.wet);
  if (thirsty !== undefined) {
    if (c.water <= 0) {
      const barrel = pt(sim, POINT.waterBarrel);
      if (!selectItem(c, ITEM.wateringCan, out)) return true;
      return goAct(sim, c, m, 'remplir', ground(barrel), barrel, 1.2, out);
    }
    if (!selectItem(c, ITEM.wateringCan, out)) return true;
    const p = { x: thirsty.cell.cx + 0.5, y: thirsty.cell.cy + 0.5 };
    return goAct(sim, c, m, `arroser:${thirsty.index}`, ground(p), p, 1.2, out);
  }
  return false;
}

function hens(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  const egg = sim.world.groundItems.find((g) => g.item === ITEM.egg);
  if (egg !== undefined) return goAct(sim, c, m, 'oeufs', { kind: 'ground_item', groundItem: egg.id }, egg.pos, 1.2, out);
  if (sim.world.hens.length > 0 && !sim.world.feederFilled) {
    const feeder = pt(sim, POINT.henFeeder);
    return goAct(sim, c, m, 'nourrir', ground(feeder), feeder, 1.2, out);
  }
  return false;
}

/** Ce que la commande en cours demande encore de cet objet (caisse déduite), 0 si elle n'en veut pas. */
function orderNeed(sim: Sim, item: string): number {
  if (sim.world.orderResult !== null) return 0;
  const line = currentOrder(sim.content.settings, sim.world).lines.find((l) => l.item === item);
  return line === undefined ? 0 : Math.max(0, line.count - countInStacks(sim.world.crate, item));
}

/** Ce que la commande et les quêtes de la semaine 2 attendent encore de cet objet (à ne pas manger ni vendre). */
function reserved(sim: Sim, item: string): number {
  const quest = QUEST_NEEDS.find((q) => q.item === item && questStep(sim, q.quest) === q.step);
  return orderNeed(sim, item) + (quest?.count ?? 0);
}

/** Objets demandés par les quêtes de la semaine 2 (`quetes.json`), à l'étape où on les apporte. */
const QUEST_NEEDS: readonly { quest: string; step: string; villager: string; item: string; count: number }[] = [
  { quest: 'handcar', step: 'bring', villager: 'basile', item: 'plank', count: 8 },
  { quest: 'handcar', step: 'bring', villager: 'basile', item: 'nail', count: 4 },
  { quest: 'odette_fry', step: 'bring', villager: 'odette', item: 'gudgeon', count: 4 },
  { quest: 'basile_omelette', step: 'bring', villager: 'basile', item: 'omelette', count: 1 },
  { quest: 'lucie_note', step: 'give', villager: 'firmin', item: 'lucie_letter', count: 1 },
  { quest: 'firmin_flowers', step: 'bring', villager: 'firmin', item: 'flower_pot', count: 2 },
];

/** Les deux sacs ensemble. */
function inBags(sim: Sim, item: string): number {
  return countInBag(character(sim, 'p1'), item) + countInBag(character(sim, 'p2'), item);
}

function planksOwned(sim: Sim): number {
  return countInBag(character(sim, 'p1'), 'plank') + countInBag(character(sim, 'p2'), 'plank') + countInStacks(sim.world.cellar, 'plank');
}

/** Planches qui restent à trouver: poulailler, meubles, commande. */
function planksWanted(sim: Sim): number {
  let wanted = planksForOrder(sim) - countInStacks(sim.world.crate, 'plank') + reserved(sim, 'plank') - orderNeed(sim, 'plank');
  if (!built(sim, 'chicken_coop')) wanted += 8;
  for (const r of ['craft_table', 'craft_chair', 'craft_shelf', 'craft_double_bed']) {
    const recipe = sim.content.recipes[r];
    const item = recipe?.output.item ?? '';
    const have = sim.world.furniture.some((f) => f.item === item) || countInBag(character(sim, 'p2'), item) > 0;
    if (!have) wanted += recipe?.inputs.find((i) => i.item === 'plank')?.count ?? 0;
  }
  return Math.max(0, wanted);
}

function wood(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  if (countInBag(c, ITEM.axe) === 0) return false;
  const logs = countInBag(c, ITEM.log);
  const planks = planksOwned(sim);
  if (logs > 0 && (questStep(sim, 'planks') === 'saw' || planks < planksWanted(sim) || logs >= 2)) {
    const bench = pt(sim, POINT.workbench);
    if (distance(c.pos, bench) > 1.5) return goTo(sim, c, m, 'etabli', bench, 1.0, out);
    out.push({ type: 'craft', recipe: 'saw_plank' });
    m.waitUntil = sim.world.tick + 3;
    m.job = 'scier';
    return true;
  }
  if (planks + logs * 4 >= planksWanted(sim) && questStep(sim, 'planks') !== 'chop') return false;
  const tree = sim.world.trees
    .filter((t) => !t.felled && (m.skip[`arbre:${t.id}`] ?? 0) <= sim.world.tick)
    .sort((a, b) => distance(c.pos, a.pos) - distance(c.pos, b.pos))[0];
  if (tree === undefined) return false;
  if (!selectItem(c, ITEM.axe, out)) return true;
  return goAct(sim, c, m, `arbre:${tree.id}`, { kind: 'tree', tree: tree.id }, tree.pos, 1.4, out);
}

function coop(sim: Sim, c: Character, m: Memory, frameOut: { held: boolean }, out: Intent[]): boolean {
  if (questStep(sim, 'hens') !== 'repair_coop') return false;
  const nails = countInBag(c, 'nail') + countInStacks(sim.world.cellar, 'nail');
  const state = sim.world.constructions.find((k) => k.id === 'chicken_coop');
  const nailsNeeded = state?.elements.some((e) => !e.paid && e.id === 'coop_roof') === true ? 2 : 0;
  if (nails < nailsNeeded) return buy(sim, c, m, [{ item: 'nail', count: nailsNeeded }], out);
  if (planksOwned(sim) < 2) return false;
  const at = pt(sim, POINT.chickenCoop);
  if (distance(c.pos, at) > 2) return goTo(sim, c, m, 'poulailler', at, 1.5, out);
  frameOut.held = true;
  m.job = 'construire poulailler';
  return true;
}

function furniture(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  // Poser un meuble du sac.
  const toPlace = c.bag.find((s) => s !== null && sim.content.items[s.item]?.category === 'furniture');
  if (toPlace !== null && toPlace !== undefined) {
    const room = sim.map.house.room;
    if (!c.inHouse) return goTo(sim, c, m, 'maison', sim.map.house.spawn, 0.3, out);
    if (!selectItem(c, toPlace.item, out)) return true;
    const def = sim.content.items[toPlace.item];
    if (def?.footprint === null || def === undefined) return false;
    if (c.placement?.valid === true) {
      out.push({ type: 'act' });
      m.waitUntil = sim.world.tick + 2;
      m.job = 'poser';
      return true;
    }
    // Chercher une place: parcourir la pièce, tourner le meuble.
    for (let cy = room.y; cy < room.y + room.h; cy++) {
      for (let cx = room.x; cx < room.x + room.w; cx++) {
        for (let r = 0; r < 2; r++) {
          if (canPlace(sim, toPlace.item, { cx, cy }, r)) {
            out.push({ type: 'place_furniture', cell: { cx, cy }, rotation: r });
            m.waitUntil = sim.world.tick + 2;
            m.job = 'poser';
            return true;
          }
        }
      }
    }
    return false;
  }
  if (!questDone(sim, 'planks')) return false;
  if (questStep(sim, 'handcar') === 'bring') return false;
  const reserve = planksForOrder(sim) - countInStacks(sim.world.crate, 'plank') + (built(sim, 'chicken_coop') ? 0 : 8);
  const plan: { recipe: string; item: string; needsMattress?: boolean }[] = [
    { recipe: 'craft_table', item: 'table' },
    { recipe: 'craft_chair', item: 'chair' },
    { recipe: 'craft_double_bed', item: 'double_bed', needsMattress: true },
    { recipe: 'craft_shelf', item: 'shelf' },
  ];
  for (const p of plan) {
    if (sim.world.furniture.some((f) => f.item === p.item)) continue;
    const recipe = sim.content.recipes[p.recipe];
    const cost = recipe?.inputs.find((i) => i.item === 'plank')?.count ?? 0;
    if (planksOwned(sim) - cost < reserve) continue;
    if (p.needsMattress === true && countInBag(c, 'mattress') + countInStacks(sim.world.cellar, 'mattress') === 0) {
      if (sim.world.proposals.some((x) => x.by === c.id)) return false;
      if (sim.world.purse < (sim.content.items.mattress?.buyPrice ?? 0) + 20) continue;
      if (buy(sim, c, m, [{ item: 'mattress', count: 1 }], out)) return true;
      continue;
    }
    const bench = pt(sim, POINT.workbench);
    if (distance(c.pos, bench) > 1.5) return goTo(sim, c, m, 'etabli', bench, 1.0, out);
    out.push({ type: 'craft', recipe: p.recipe });
    m.waitUntil = sim.world.tick + 3;
    m.job = `fabriquer ${p.item}`;
    return true;
  }
  return false;
}

/** Les produits de la commande vont dans la caisse dès qu'on en a assez. */
function order(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  if (sim.world.orderResult !== null) return false;
  const { day, minutes } = sim.world.clock;
  const urgent = day === currentOrder(sim.content.settings, sim.world).day;
  const supperPending = questStep(sim, 'welcome_supper') === 'bring' || !sim.world.quests.some((q) => q.id === 'welcome_supper');
  const deposits: { item: string; count: number }[] = [];
  for (const line of currentOrder(sim.content.settings, sim.world).lines) {
    const inCrate = countInStacks(sim.world.crate, line.item);
    const need = line.count - inCrate;
    if (need <= 0) continue;
    let have = countInBag(c, line.item);
    if (line.item === 'plank' && !urgent) have = Math.max(0, have - 0);
    // Garder 3 radis et 2 laitues pour le souper d'Odette tant qu'il n'est pas servi.
    if (supperPending && !urgent && line.item === 'radish') have -= 3;
    if (supperPending && !urgent && line.item === 'lettuce') have -= 2;
    const n = Math.min(need, have);
    if (n > 0 && (urgent || n >= need || line.item !== 'plank')) deposits.push({ item: line.item, count: n });
  }
  if (deposits.length === 0) return false;
  if (!urgent && minutes > GO_HOME_AT - HOUR) return false;
  const crate = pt(sim, POINT.coopCrate);
  if (c.menu !== 'crate') return goAct(sim, c, m, 'caisse', ground(crate), crate, 1.2, out);
  for (const d of deposits) {
    out.push({ type: 'crate_deposit', item: d.item, quality: 'ordinary', count: d.count });
    out.push({ type: 'crate_deposit', item: d.item, quality: 'fine', count: d.count });
  }
  out.push({ type: 'menu', menu: null });
  m.waitUntil = sim.world.tick + 2;
  return true;
}

function riddle(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  if (questStep(sim, 'emile_riddle') !== 'dig' || sim.world.weather !== 'sunny') return false;
  const { minutes } = sim.world.clock;
  if (minutes < 16 * HOUR + 30 || minutes >= 17 * HOUR + 30) return false;
  const spot = pt(sim, 'bell_shadow_spot');
  if (minutes < 17 * HOUR) return goTo(sim, c, m, 'enigme', { x: spot.x - 1, y: spot.y }, 0.4, out) || true;
  if (!selectItem(c, ITEM.hoe, out)) return true;
  return goAct(sim, c, m, 'enigme', ground(spot), spot, 1.2, out);
}

function supperAtOdette(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  if (questStep(sim, 'welcome_supper') !== 'supper' || sim.world.clock.day < 5) return false;
  const { minutes } = sim.world.clock;
  if (minutes < 18 * HOUR + 30 || minutes >= 21 * HOUR) return false;
  const terrace = pt(sim, 'grocery_terrace');
  goTo(sim, c, m, 'souper chez Odette', terrace, 0.8, out);
  m.job = 'souper chez Odette';
  return true;
}

function giveOdette(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  if (questStep(sim, 'welcome_supper') !== 'bring') return false;
  const odette = sim.world.villagers.find((v) => v.id === 'odette');
  if (!odette?.visible) return false;
  const q = sim.world.quests.find((x) => x.id === 'welcome_supper');
  const done = q?.checklist ?? [];
  const wants = [
    { item: 'radish', label: 0 },
    { item: 'lettuce', label: 1 },
  ].filter((w) => done[w.label]?.done !== true && countInBag(c, w.item) > 0);
  if (wants.length === 0) return false;
  return goAct(sim, c, m, 'donner Odette', { kind: 'villager', villager: 'odette' }, odette.pos, sim.content.settings.ranges.talk - 0.5, out);
}

/** La veillée: cuisiner, manger, se coucher. */
function evening(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  const { minutes, day } = sim.world.clock;
  const last = sim.content.settings.clock.lastDay.day;
  if (minutes < GO_HOME_AT || day >= last) return false;
  if (!c.inHouse) return goTo(sim, c, m, 'rentrer', sim.map.house.spawn, 0.3, out) || true;
  const other = character(sim, partnerOf(c.id));
  if (!other.inHouse) {
    m.job = 'attendre';
    return true;
  }
  if (c.supper.bread + c.supper.simple + c.supper.stew === 0) {
    const food = c.bag.find(
      (s) => s !== null && sim.content.items[s.item]?.dish !== null && sim.content.items[s.item] !== undefined && reserved(sim, s.item) === 0,
    );
    if (food !== null && food !== undefined) {
      out.push({ type: 'eat', item: food.item });
      m.waitUntil = sim.world.tick + 70;
      m.job = 'manger';
      return true;
    }
    const cookable = ['cook_vegetable_soup', 'cook_omelette', 'cook_crunchy_radishes'].find((r) => {
      const recipe = sim.content.recipes[r];
      if (recipe === undefined || !sim.world.unlockedRecipes.includes(r)) return false;
      const reserveEggs = r === 'cook_omelette' ? orderNeed(sim, ITEM.egg) : 0;
      const reserveRadish = r !== 'cook_omelette' ? 12 - countInStacks(sim.world.crate, 'radish') : 0;
      return recipe.inputs.every((i) => {
        const reserve = i.item === ITEM.egg ? reserveEggs : i.item === 'radish' ? Math.max(0, reserveRadish - 3) : 0;
        return countInBag(c, i.item) - Math.max(0, reserve) >= i.count;
      });
    });
    if (cookable !== undefined && c.status === 'active') {
      out.push({ type: 'craft', recipe: cookable });
      m.waitUntil = sim.world.tick + 3;
      m.job = 'cuisiner';
      return true;
    }
  }
  // Se coucher: le lit double s'il y en a un, sinon une paillasse libre.
  const beds = sim.world.furniture
    .filter((f) => sim.content.items[f.item]?.bed !== null && sim.content.items[f.item] !== undefined)
    .sort((a, b) => (sim.content.items[b.item]?.bed?.sleep ?? 0) - (sim.content.items[a.item]?.bed?.sleep ?? 0));
  for (const bed of beds) {
    const sleepers = sim.content.items[bed.item]?.bed?.sleepers ?? 1;
    if (sim.world.characters.filter((x) => x.bedId === bed.id).length >= sleepers) continue;
    return goAct(sim, c, m, `lit:${bed.id}`, { kind: 'furniture', furniture: bed.id }, { x: bed.cell.cx + 0.5, y: bed.cell.cy + 0.5 }, 1.2, out);
  }
  return true;
}

/** Omelettes de la commande: au réchaud, une fois les œufs de la commande dans la caisse. */
function cookForOrder(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  const recipe = sim.content.recipes.cook_omelette;
  if (recipe === undefined || reserved(sim, recipe.output.item) <= inBags(sim, recipe.output.item)) return false;
  const eggs = recipe.inputs.find((i) => i.item === ITEM.egg)?.count ?? 0;
  if (orderNeed(sim, ITEM.egg) > 0 || countInBag(c, ITEM.egg) < eggs) return false;
  if (sim.world.clock.minutes > GO_HOME_AT - HOUR) return false;
  if (!c.inHouse) return goTo(sim, c, m, 'rechaud', sim.map.house.spawn, 0.3, out) || true;
  out.push({ type: 'craft', recipe: recipe.id });
  m.waitUntil = sim.world.tick + 3;
  m.job = 'cuisiner pour la commande';
  return true;
}

/** Truites de la commande: au gué, lancer, attendre la touche, ferrer. */
function fishForOrder(sim: Sim, c: Character, m: Memory, f: { mx: number; my: number }, out: Intent[]): boolean {
  const wanted = orderNeed(sim, 'trout') > inBags(sim, 'trout') || reserved(sim, 'gudgeon') > inBags(sim, 'gudgeon');
  if (!wanted || sim.world.clock.minutes > GO_HOME_AT - HOUR) return false;
  if (countInBag(c, ITEM.fishingRod) === 0) return false;
  const ford = pt(sim, 'river_ford');
  if (c.fishing === null && distance(c.pos, ford) > 0.6) return goTo(sim, c, m, 'gue', ford, 0.4, out) || true;
  if (!holdsRod(c)) return selectItem(c, ITEM.fishingRod, out) || true;
  m.job = 'pêcher';
  if (c.fishing?.phase === 'bite') {
    out.push({ type: 'act' });
    return true;
  }
  if (c.fishing !== null) return true;
  if (waterAhead(sim, c) === null) {
    // Un pas vers l'eau la plus proche suffit à se tourner vers elle.
    const water = nearestWater(sim, c.pos);
    if (water === null) return false;
    const d = Math.hypot(water.x - c.pos.x, water.y - c.pos.y);
    f.mx = (water.x - c.pos.x) / d;
    f.my = (water.y - c.pos.y) / d;
    return true;
  }
  out.push({ type: 'act' });
  m.waitUntil = sim.world.tick + 2;
  return true;
}

/** Donne à un habitant (intention `give`), en allant jusqu'à lui. */
function giveVillager(sim: Sim, c: Character, m: Memory, villager: string, gifts: { item: string; count: number }[], out: Intent[]): boolean {
  const v = sim.world.villagers.find((x) => x.id === villager);
  if (!v?.visible || gifts.some((g) => countInBag(c, g.item) < g.count)) return false;
  const reach = sim.content.settings.ranges.talk - 0.5;
  if (distance(c.pos, v.pos) > reach) return goTo(sim, c, m, `donner:${villager}`, v.pos, reach - 0.4, out);
  for (const g of gifts) out.push({ type: 'give', to: villager, item: g.item, quality: 'ordinary', count: g.count });
  m.waitUntil = sim.world.tick + 2;
  m.job = `donner à ${villager}`;
  return true;
}

/** Quêtes de la semaine 2: acheter ce qui s'achète, puis apporter chaque objet à son habitant. */
function weekTwoQuests(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  if (c.id === 'p1' && questStep(sim, 'firmin_flowers') === 'bring' && countInBag(c, 'flower_pot') < 2) {
    if (buy(sim, c, m, [{ item: 'flower_pot', count: 2 }], out)) return true;
  }
  if (c.id === 'p2' && questStep(sim, 'handcar') === 'bring' && countInBag(c, 'nail') < 4) {
    if (buy(sim, c, m, [{ item: 'nail', count: 4 }], out)) return true;
  }
  const byVillager = new Map<string, { item: string; count: number }[]>();
  for (const q of QUEST_NEEDS) {
    if (questStep(sim, q.quest) !== q.step) continue;
    // Ce que la commande attend passe d'abord (omelettes).
    if (countInBag(c, q.item) - orderNeed(sim, q.item) < q.count) continue;
    const list = byVillager.get(q.villager) ?? [];
    list.push({ item: q.item, count: q.count });
    byVillager.set(q.villager, list);
  }
  for (const [villager, gifts] of byVillager) {
    // La draisine demande planches et clous ensemble.
    if (villager === 'basile' && questStep(sim, 'handcar') === 'bring' && gifts.length < 2 && gifts.some((g) => g.item !== 'omelette')) continue;
    if (giveVillager(sim, c, m, villager, gifts, out)) return true;
  }
  return false;
}

/** Essai de la draisine (scène à deux devant la remise, de 8 h à 18 h). */
function handcarTry(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  const { minutes } = sim.world.clock;
  if (questStep(sim, 'handcar') !== 'try' || minutes < 8 * HOUR || minutes >= 17 * HOUR + 30) return false;
  const shed = pt(sim, 'handcar_shed');
  if (goTo(sim, c, m, 'remise', shed, 1.2, out)) return true;
  m.job = 'attendre devant la remise';
  return distance(c.pos, shed) <= sim.content.settings.ranges.talk;
}

/** Deuxième énigme d'Émile: bêcher près du passage à niveau entre 9 h et 10 h. */
function riddle2(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  if (c.id !== 'p1' || questStep(sim, 'emile_riddle_2') !== 'dig') return false;
  const { minutes } = sim.world.clock;
  if (minutes < 8 * HOUR + 30 || minutes >= 10 * HOUR) return false;
  const spot = diggableNear(sim, pt(sim, 'level_crossing'));
  if (spot === null) return false;
  if (minutes < 9 * HOUR) return goTo(sim, c, m, 'enigme 2', spot, 1.0, out) || true;
  if (!selectItem(c, ITEM.hoe, out)) return true;
  return goAct(sim, c, m, 'enigme 2', ground(spot), spot, 1.2, out);
}

/** Case libre où la bêche a quelque chose à faire, à moins de 1,5 m du point (centre de case). */
function diggableNear(sim: Sim, at: Vec2): Vec2 | null {
  const b = refreshBlockers(sim);
  let best: Vec2 | null = null;
  let bestD = Infinity;
  for (let cy = Math.floor(at.y) - 2; cy <= Math.floor(at.y) + 2; cy++) {
    for (let cx = Math.floor(at.x) - 2; cx <= Math.floor(at.x) + 2; cx++) {
      const centre = { x: cx + 0.5, y: cy + 0.5 };
      const d = distance(centre, at);
      if (d > 1.5 || d >= bestD || isBlockedCell(b, cx, cy)) continue;
      if (sim.world.garden.some((g) => g.cell.cx === cx && g.cell.cy === cy)) continue;
      best = centre;
      bestD = d;
    }
  }
  return best;
}

function nearestWater(sim: Sim, from: Vec2): Vec2 | null {
  const { map } = sim;
  let best: Vec2 | null = null;
  let bestD = Infinity;
  for (let cy = Math.max(0, Math.floor(from.y) - 5); cy <= Math.min(map.height - 1, Math.floor(from.y) + 5); cy++) {
    for (let cx = Math.max(0, Math.floor(from.x) - 5); cx <= Math.min(map.width - 1, Math.floor(from.x) + 5); cx++) {
      if (map.ground[cy * map.width + cx] !== 'water') continue;
      const d = Math.hypot(cx + 0.5 - from.x, cy + 0.5 - from.y);
      if (d < bestD) {
        bestD = d;
        best = { x: cx + 0.5, y: cy + 0.5 };
      }
    }
  }
  return best;
}

function beam(sim: Sim, c: Character, m: Memory, f: { held: boolean; mx: number; my: number }, out: Intent[]): boolean {
  const b = sim.world.beam;
  if (b === null) return false;
  const def = sim.content.constructions.find((k) => k.kind === 'carry');
  const spot = def === undefined ? undefined : sim.map.points[def.point];
  if (spot === undefined) return false;
  if (!b.carried) {
    if (distance(c.pos, b.pos) > sim.content.settings.feel.beamGrabRange - 0.4) {
      return goTo(sim, c, m, 'poutre', b.pos, 0.5, out) || true;
    }
    f.held = true;
    m.job = 'soulever la poutre';
    return true;
  }
  f.held = true;
  const path = findPath(refreshBlockers(sim), b.pos, spot);
  const next = path?.[0] ?? spot;
  const d = Math.hypot(next.x - b.pos.x, next.y - b.pos.y);
  if (d > 0.01) {
    f.mx = (next.x - b.pos.x) / d;
    f.my = (next.y - b.pos.y) / d;
  }
  m.job = 'porter la poutre';
  return true;
}

function buildHouse(sim: Sim, c: Character, m: Memory, f: { held: boolean }, out: Intent[]): boolean {
  if (built(sim, 'house_roof') && built(sim, 'house_door')) return false;
  if (sim.world.beam !== null) return false;
  const at = pt(sim, 'house_door');
  if (distance(c.pos, at) > 1.5) return goTo(sim, c, m, 'chantier', at, 1, out) || true;
  f.held = true;
  m.job = 'construire la maison';
  return true;
}

function ironBox(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  const box = sim.world.groundItems.find((g) => g.item === 'iron_box');
  if (box === undefined) return false;
  return goAct(sim, c, m, 'boite', { kind: 'ground_item', groundItem: box.id }, box.pos, 1.2, out);
}

function lastDay(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  const train = currentOrder(sim.content.settings, sim.world).day;
  if (sim.world.clock.day !== train || sim.world.orderResult !== null) return false;
  if (order(sim, c, m, out)) return true;
  const quay = pt(sim, POINT.trainStop);
  return goTo(sim, c, m, 'quai', quay, 2, out) || true;
}

// ---------------------------------------------------------------------------

export interface RobotOptions {
  /** Résoudre l'énigme d'Émile (faux: vérifier qu'elle ne bloque jamais la fin, D-08). */
  riddle?: boolean;
}

export function createRobot(options: RobotOptions = {}): Robot {
  const solveRiddle = options.riddle ?? true;
  const memory: Record<CharacterId, Memory> = {
    p1: { waitUntil: 0, goingTo: null, skip: {}, seq: 0, job: '', lastIntent: 0 },
    p2: { waitUntil: 0, goingTo: null, skip: {}, seq: 0, job: '', lastIntent: 0 },
  };

  function decideOne(sim: Sim, c: Character, out: Intent[]): ControlFrame {
    const m = memory[c.id];
    const w = sim.world;
    if (w.phase === 'creation') {
      if (!c.titleReady) out.push({ type: 'title_ready', ready: true });
      if (!c.created) out.push({ type: 'create_character', name: c.id === 'p1' ? 'Camille' : 'Sacha', hair: 1, outfit: c.id === 'p1' ? 0 : 2 });
      return frame(m);
    }
    if (w.phase === 'ended') {
      if (!c.endReady) out.push({ type: 'end_ready', ready: true });
      return frame(m);
    }
    if (w.phase === 'night') {
      if (c.nightChoice === null) out.push({ type: 'night_choice', choice: 'continue' });
      return frame(m);
    }
    if (c.status === 'breakfast') {
      out.push({ type: 'start_day' });
      return frame(m);
    }
    if (c.status === 'scene') {
      const scene = w.scene;
      if (scene !== null && scene.choices.length > 0 && scene.picks[c.id] === undefined) {
        const choice = scene.choices[c.id === 'p1' ? 0 : scene.choices.length - 1];
        if (choice !== undefined) out.push({ type: 'dialogue_choice', choice: choice.id });
      } else if (scene !== null && !scene.ready.includes(c.id)) {
        out.push({ type: 'dialogue_next' });
      }
      return frame(m);
    }
    if (c.status === 'dialogue') {
      const d = c.dialogue;
      if (d !== null && d.line >= d.lines.length - 1 && d.choices.length > 0) {
        const give = d.choices.find((ch) => ch.id.startsWith('give:'));
        out.push({ type: 'dialogue_choice', choice: (give ?? d.choices[0])?.id ?? '' });
      } else {
        out.push({ type: 'dialogue_next' });
      }
      return frame(m);
    }
    if (c.status === 'sleeping' || c.status === 'gesture') {
      const f = { held: false, mx: 0, my: 0 };
      if (c.status === 'gesture') beam(sim, c, m, f, out);
      return frame(m, f.mx, f.my, f.held);
    }
    // Propositions de l'autre: d'accord.
    for (const p of w.proposals) {
      if (p.by !== c.id) out.push({ type: 'proposal_answer', proposal: p.id, accept: true });
    }
    if (busy(sim, c) || w.tick < m.waitUntil) return frame(m);
    if (c.menu !== null && c.menu !== 'shop' && c.menu !== 'crate') out.push({ type: 'menu', menu: null });

    const f = { held: false, mx: 0, my: 0 };
    const done =
      beam(sim, c, m, f, out) ||
      buildHouse(sim, c, m, f, out) ||
      ironBox(sim, c, m, out) ||
      lastDay(sim, c, m, out) ||
      supperAtOdette(sim, c, m, out) ||
      (solveRiddle && riddle(sim, c, m, out)) ||
      (solveRiddle && riddle2(sim, c, m, out)) ||
      handcarTry(sim, c, m, out) ||
      evening(sim, c, m, out) ||
      social(sim, c, m, out) ||
      giveOdette(sim, c, m, out) ||
      order(sim, c, m, out) ||
      cookForOrder(sim, c, m, out) ||
      weekTwoQuests(sim, c, m, out) ||
      (c.id === 'p1' ? garden(sim, c, m, out) || hens(sim, c, m, out) || sellExtra(sim, c, m, out) : false) ||
      (c.id === 'p2'
        ? coop(sim, c, m, f, out) ||
          fishForOrder(sim, c, m, f, out) ||
          wood(sim, c, m, out) ||
          furniture(sim, c, m, out) ||
          hens(sim, c, m, out) ||
          garden(sim, c, m, out)
        : false);
    if (!done) m.job = 'flâner';
    return frame(m, f.mx, f.my, f.held);
  }

  return {
    decide(sim) {
      const controls: Partial<Record<CharacterId, ControlFrame>> = {};
      const intents: AuthoredIntent[] = [];
      for (const c of sim.world.characters) {
        const out: Intent[] = [];
        controls[c.id] = decideOne(sim, c, out);
        // Un joueur qui flâne touche quand même son clavier de temps en temps (absence, PA-04).
        const m = memory[c.id];
        if (out.length > 0) m.lastIntent = sim.world.tick;
        else if (sim.world.tick - m.lastIntent > PRESENCE_TICKS) {
          out.push({ type: 'select_slot', slot: c.selected });
          m.lastIntent = sim.world.tick;
        }
        for (const intent of out) intents.push({ by: c.id, intent });
      }
      return { controls, intents };
    },
    job(id) {
      return memory[id].job;
    },
  };
}
