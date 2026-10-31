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
import { catalogueWindow, currentOrder } from '../donnees/commandes';
import { holdsRod, waterAhead } from './peche';
import { counterRemaining } from './conditions';
import { freeSeatsNear, seatedSeconds } from './bancs';
import type { Condition, MomentWatch } from '../donnees/types';
import { benchById } from '../etat/bancs';
import { momentDef, watchTarget } from '../etat/moments';
import { HEN_NAMES_QUEST, henLabel, secretCards } from '../etat/secrets';
import { LOOK_CONE } from './conditions';
import { activeWatch } from '../etat/moments';
import { HEN_CALL_DIALOGUE } from './secrets';

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
/** Un meuble sans place se réessaie après dix minutes réelles. */
const NO_ROOM_RETRY_TICKS = SIM_HZ * 600;

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
const QUEST_NEEDS: readonly { quest: string; step: string; villager: string; item: string; count: number; by?: CharacterId }[] = [
  // Après-midi de la semaine 2: chacun son colis, son chemin.
  { quest: 'odette_parcels', step: 'deliver', villager: 'firmin', item: 'odette_parcel', count: 1, by: 'p1' },
  { quest: 'odette_parcels', step: 'deliver', villager: 'basile', item: 'odette_parcel', count: 1, by: 'p2' },
  { quest: 'firmin_chub', step: 'bring', villager: 'firmin', item: 'chub', count: 1 },
  { quest: 'jeanne_notebook', step: 'find', villager: 'jeanne', item: 'jeanne_notebook', count: 1 },
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
  const questChop = openCounters(sim).some((o) => o.key === 'chopped');
  if (planks + logs * 4 >= planksWanted(sim) && questStep(sim, 'planks') !== 'chop' && !questChop) return false;
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
  // Un meuble qui ne trouve pas de place attend (sinon aller-retour sans fin entre la maison et le dehors).
  const toPlace = c.bag.find(
    (s) => s !== null && sim.content.items[s.item]?.category === 'furniture' && (m.skip[`poser:${s.item}`] ?? 0) <= sim.world.tick,
  );
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
    m.skip[`poser:${toPlace.item}`] = sim.world.tick + NO_ROOM_RETRY_TICKS;
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
  const wanted =
    orderNeed(sim, 'trout') > inBags(sim, 'trout') ||
    reserved(sim, 'gudgeon') > inBags(sim, 'gudgeon') ||
    reserved(sim, 'chub') > inBags(sim, 'chub') ||
    questWantsFish(sim);
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

/** Buts d'après-midi des jours creux (variantes tirées par la graine), joués par la routine générique. */
const AFTERNOON = new Set(['odette_dandelions', 'heron_watch', 'basile_lost', 'wild_geese', 'jeanne_challenge']);

/** Compteur d'une étape active, et ce qu'il lui manque (conditions `counter` des données). */
interface OpenCounter {
  key: string;
  remaining: number;
}

/** Les compteurs encore ouverts des étapes actives (et de leurs sous-conditions `all`). */
function openCounters(sim: Sim): OpenCounter[] {
  const out: OpenCounter[] = [];
  const walk = (conditions: readonly Condition[], baselines: Record<string, number>): void => {
    for (const cond of conditions) {
      if (cond.type === 'all') walk(cond.conditions, baselines);
      if (cond.type !== 'counter') continue;
      const remaining = counterRemaining(sim, baselines, cond.key, cond.count, cond.since);
      if (remaining > 0) out.push({ key: cond.key, remaining });
    }
  };
  for (const q of sim.world.quests) {
    if (q.status !== 'active' || !AFTERNOON.has(q.id)) continue;
    const step = sim.content.quests.find((x) => x.id === q.id)?.steps[q.step];
    if (step !== undefined) walk(step.conditions, q.baselines);
  }
  return out;
}

/** Rendez-vous des étapes actives: `stayed_at`, avec la plage horaire `time_is` de la même étape; `seated`: assis sur le banc. */
function openStays(sim: Sim): { point: string; seconds: number; seated: boolean }[] {
  const out: { point: string; seconds: number; seated: boolean }[] = [];
  const minutes = sim.world.clock.minutes;
  for (const q of sim.world.quests) {
    if (q.status !== 'active' || !AFTERNOON.has(q.id)) continue;
    const step = sim.content.quests.find((x) => x.id === q.id)?.steps[q.step];
    if (step === undefined) continue;
    const window = step.conditions.find((c) => c.type === 'time_is');
    if (window?.type === 'time_is' && (minutes < window.from || minutes >= window.to)) continue;
    for (const c of step.conditions) {
      if (c.type === 'stayed_at' || c.type === 'looked_at') out.push({ point: c.point, seconds: 0, seated: c.type === 'stayed_at' && c.seated });
    }
  }
  return out;
}

/**
 * Buts d'après-midi et quêtes sans recette propre au robot: aller au rendez-vous (les deux),
 * ramasser ce qu'une quête a posé au sol, apporter ce qu'un habitant attend, parler à qui il faut.
 * Les objets que `QUEST_NEEDS` répartit entre les deux robots sont laissés à `weekTwoQuests`.
 */
function genericQuests(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  const stay = openStays(sim)[0];
  const at = stay === undefined ? undefined : sim.map.points[stay.point];
  if (stay?.seated === true && at !== undefined) return sitAt(sim, c, m, stay.point, at, out);
  if (at !== undefined) {
    if (goTo(sim, c, m, `rendez-vous:${stay?.point ?? ''}`, at, 1.5, out)) return true;
    m.job = 'attendre au rendez-vous';
    return distance(c.pos, at) <= sim.content.settings.ranges.stayAt;
  }
  const managed = new Set(QUEST_NEEDS.map((q) => q.item));
  for (const open of openCounters(sim)) {
    const [kind, villager, item] = open.key.split(':');
    if (kind === 'talked' && villager !== undefined && item === undefined) {
      const v = sim.world.villagers.find((x) => x.id === villager);
      if (c.id === 'p1' && v?.visible === true) {
        return goAct(sim, c, m, `parler:${villager}`, { kind: 'villager', villager }, v.pos, sim.content.settings.ranges.talk - 0.5, out);
      }
      continue;
    }
    if (kind !== 'given' || villager === undefined || item === undefined || managed.has(item)) continue;
    const have = countInBag(c, item) - reserved(sim, item);
    if (have > 0) {
      if (giveVillager(sim, c, m, villager, [{ item, count: Math.min(have, open.remaining) }], out)) return true;
      continue;
    }
    const lying = c.id === 'p1' ? sim.world.groundItems.find((g) => g.item === item) : undefined;
    if (lying !== undefined) return goAct(sim, c, m, `ramasser:${lying.id}`, { kind: 'ground_item', groundItem: lying.id }, lying.pos, 1.2, out);
  }
  return false;
}

/**
 * Rendez-vous assis: va à la place libre la plus proche du point et s'y
 * assoit, comme un clic sur le banc; sans place libre (un habitant et
 * l'autre déjà assis), attend tout près.
 */
function sitAt(sim: Sim, c: Character, m: Memory, pointId: string, at: Vec2, out: Intent[]): boolean {
  if (c.seat !== null && seatedSeconds(sim, c, pointId) > 0) {
    m.job = 'assis au rendez-vous';
    return true;
  }
  const seat = freeSeatsNear(sim, at, sim.content.settings.ranges.stayAt)[0];
  if (seat === undefined) {
    if (goTo(sim, c, m, `rendez-vous:${pointId}`, at, 2, out)) return true;
    m.job = 'attendre une place sur le banc';
    return true;
  }
  return goAct(sim, c, m, `banc:${pointId}`, ground(seat.pos), seat.pos, sim.content.settings.benches.sitRange - 0.1, out);
}

/** Assis pour un moment du jour (les oies de la quête, sur le banc de la berge) ? */
function momentSeat(sim: Sim, c: Character): boolean {
  const today = sim.world.moments.today;
  const def = today === null ? null : momentDef(sim.content, today.id);
  if (today === null || def === null || c.seat === null) return false;
  if (today.phase !== 'waiting' && today.phase !== 'absent' && today.phase !== 'climax') return false;
  const w = activeWatch(def, today);
  return w.seated && c.seat.bench === w.bench;
}

/** Un rendez-vous assis est-il ouvert pour ce point de banc ? (sinon le robot assis par hasard se relève) */
function wantsSeat(sim: Sim, c: Character): boolean {
  const seat = c.seat;
  if (seat === null) return false;
  return openStays(sim).some((st) => st.seated && seatedSeconds(sim, c, st.point) > 0);
}

/** Un compteur ouvert attend-il ce poisson (`caught:<poisson>`, ou `caught` seul) ? */
function questWantsFish(sim: Sim): boolean {
  return openCounters(sim).some((o) => o.key === 'caught' || o.key.startsWith('caught:'));
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
  // Ramasser ce qu'une quête a posé sur la carte (le carnet de Jeanne au ponton).
  const lost = c.id === 'p1' && questStep(sim, 'jeanne_notebook') === 'find' ? sim.world.groundItems.find((g) => g.item === 'jeanne_notebook') : undefined;
  if (lost !== undefined) return goAct(sim, c, m, 'carnet', { kind: 'ground_item', groundItem: lost.id }, lost.pos, 1.2, out);
  const byVillager = new Map<string, { item: string; count: number }[]>();
  for (const q of QUEST_NEEDS) {
    if (questStep(sim, q.quest) !== q.step || (q.by !== undefined && q.by !== c.id)) continue;
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

/**
 * Semaine 2: commander au catalogue un objet lourd (livré en colis, à porter à deux), si la
 * bourse le permet et qu'aucun n'est déjà commandé, livré ou en route.
 */
function orderHeavy(sim: Sim, c: Character, m: Memory, out: Intent[]): boolean {
  const w = sim.world;
  if (c.id !== 'p1' || w.orderIndex === 0 || sim.content.settings.carry.parcel === null) return false;
  const heavy = Object.values(sim.content.items).find((d) => d.carriedByTwo && d.shop === 'catalogue' && d.buyPrice !== null);
  if (heavy === undefined || heavy.buyPrice === null) return false;
  const window = catalogueWindow(sim.content.settings, w.clock.day).orderDeadline;
  if (w.clock.day > window.day || w.purse < heavy.buyPrice + HEAVY_RESERVE) return false;
  if (w.catalogueOrders.includes(heavy.id) || w.heavyDeliveries.includes(heavy.id) || countInStacks(w.cellar, heavy.id) > 0) return false;
  if (w.furniture.some((f) => f.item === heavy.id) || inBags(sim, heavy.id) > 0) return false;
  const board = pt(sim, POINT.noticeBoard);
  if (c.menu !== 'catalogue') return goAct(sim, c, m, 'catalogue', ground(board), board, 1.2, out);
  out.push({ type: 'catalogue_order', item: heavy.id });
  out.push({ type: 'menu', menu: null });
  m.waitUntil = sim.world.tick + 2;
  m.job = 'commander au catalogue';
  return true;
}

/** Sous à garder en bourse après une commande au catalogue. */
const HEAVY_RESERVE = 60;

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
  const spot = b.to;
  if (!b.carried) {
    if (distance(c.pos, b.pos) > sim.content.settings.feel.beamGrabRange - 0.4) {
      return goTo(sim, c, m, 'poutre', b.pos, 0.5, out) || true;
    }
    f.held = true;
    m.job = 'soulever la poutre';
    return true;
  }
  f.held = true;
  // Sur rails (la draisine), droit vers le prochain point de passage; sinon par le chemin de la grille.
  const waypoint = b.route?.[b.leg];
  const next = waypoint ?? findPath(refreshBlockers(sim), b.pos, spot)?.[0] ?? spot;
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
  /**
   * Quêtes à secret (R16): `voice` (par défaut), l'informé lit son propre écran (fiche secrète,
   * étiquettes des poules) et le « dit » à l'autre; `deaf`, ils ne se parlent pas: l'autre devine.
   */
  secrets?: 'voice' | 'deaf';
  /** Aller voir les moments d'ambiance (les moments de quête, toujours). */
  ambientMoments?: boolean;
}

/** Ce que l'informé a « dit » à l'autre (robot à voix): le nom de chaque poule, la réponse de Firmin. */
interface Told {
  hens: Record<string, string>;
  lucie: number | null;
}

/** Ce que l'autre a déjà essayé (robot sourd): noms par poule, réponses à Jeanne. */
interface Tried {
  hens: Record<string, string[]>;
  lucie: string[];
}

/** Les moments de la journée que le robot va voir: heure d'arrivée avant la fenêtre (minutes de jeu). */
const MOMENT_LEAD_MINUTES = 30;
const LUCIE_QUEST = 'lucie_note';
const LUCIE_QUIZ = 'jeanne_lucie_quiz';

function angleTo(c: Character, at: Vec2): number {
  let diff = Math.abs(Math.atan2(at.y - c.pos.y, at.x - c.pos.x) - c.facing) % (2 * Math.PI);
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return diff;
}

/** Deux places de spectateurs (cases libres atteignables) dans l'anneau du moment, l'une près de l'autre. */
function watchSpots(sim: Sim, w: MomentWatch, target: Vec2, from: Vec2): { p1: Vec2; p2: Vec2 } | null {
  const b = refreshBlockers(sim);
  const lo = w.minRadius + 0.4;
  const hi = Math.max(lo, w.radius - 0.8);
  const cells: Vec2[] = [];
  const r = Math.ceil(w.radius);
  for (let cy = Math.floor(target.y) - r; cy <= Math.floor(target.y) + r; cy++) {
    for (let cx = Math.floor(target.x) - r; cx <= Math.floor(target.x) + r; cx++) {
      const centre = { x: cx + 0.5, y: cy + 0.5 };
      const d = distance(centre, target);
      if (d < lo || d > hi || isBlockedCell(b, cx, cy)) continue;
      if (sim.map.house.room.x <= cx && cx < sim.map.house.room.x + sim.map.house.room.w && sim.map.house.room.y <= cy && cy < sim.map.house.room.y + sim.map.house.room.h) continue;
      cells.push(centre);
    }
  }
  cells.sort((a, c) => distance(a, from) - distance(c, from));
  for (const first of cells) {
    if (findPath(b, from, first) === null) continue;
    const second = cells
      .filter((x) => distance(x, first) >= 1 && findPath(b, first, x) !== null)
      .sort((a, c) => distance(a, first) - distance(c, first))[0];
    if (second !== undefined) return { p1: first, p2: second };
  }
  return null;
}

export function createRobot(options: RobotOptions = {}): Robot {
  const solveRiddle = options.riddle ?? true;
  const voice = (options.secrets ?? 'voice') === 'voice';
  const ambient = options.ambientMoments ?? true;
  const told: Told = { hens: {}, lucie: null };
  const tried: Tried = { hens: {}, lucie: [] };
  const spots: Record<string, { p1: Vec2; p2: Vec2 } | null> = {};

  /** L'informé lit son écran (étiquettes des poules, fiche secrète) et le dit à l'autre. */
  function speak(sim: Sim): void {
    if (!voice) return;
    for (const entry of sim.world.secrets.entries) {
      const me = entry.informed;
      if (!entry.revealed || sim.world.quests.some((q) => q.id === entry.quest && q.status === 'done')) continue;
      if (entry.quest === HEN_NAMES_QUEST) {
        for (const hen of sim.world.hens) told.hens[hen.id] = henLabel(sim.world, sim.content, hen, me);
      }
      if (entry.quest === LUCIE_QUEST && told.lucie === null) {
        const card = secretCards(sim.world, sim.content, me).find((k) => k.quest === LUCIE_QUEST);
        const lines = sim.content.quests.find((q) => q.id === LUCIE_QUEST)?.secret?.card.lines ?? [];
        const index = card === undefined ? -1 : lines.findIndex((l) => (Array.isArray(l) ? l.join(' ') : l) === card.lines.join(' '));
        if (index >= 0) told.lucie = index;
      }
    }
  }

  /**
   * Aller voir le moment du jour et prendre la pose demandée (immobile et tourné, assis sur le
   * banc, ou tenant l'échelle), puis ne plus bouger jusqu'à l'apogée et pendant elle.
   */
  function watchMoment(sim: Sim, c: Character, m: Memory, f: { mx: number; my: number }, out: Intent[]): boolean {
    const today = sim.world.moments.today;
    if (today === null) return false;
    const def = momentDef(sim.content, today.id);
    if (def === null) return false;
    if (today.origin === 'ambient' && !ambient) return false;
    const minutes = sim.world.clock.minutes;
    if (today.phase === 'climax') {
      m.job = `apogée: ${def.id}`;
      return c.holding !== null || c.seat !== null || distance(c.pos, watchTarget(sim.map, def, 'anchor', today)) <= def.watch.radius + 2;
    }
    // Un moment du soir (vers luisants): on reste dehors au lieu de rentrer à 19 h.
    const lead = def.present.from >= GO_HOME_AT ? Math.max(MOMENT_LEAD_MINUTES, def.window.from - GO_HOME_AT) : MOMENT_LEAD_MINUTES;
    const soon = today.phase === 'waiting' || (today.phase === 'absent' && minutes >= def.present.from - lead && minutes < def.present.to);
    if (!soon || minutes < def.window.from - lead || minutes >= def.window.to) return false;
    if (today.origin === 'quest') {
      const state = sim.world.quests.find((q) => q.id === def.quest);
      if (state?.status !== 'active') return false;
      const step = sim.content.quests.find((q) => q.id === def.quest)?.steps[state.step]?.id;
      if (def.questStep !== null && step !== def.questStep) return false;
    }
    const w = activeWatch(def, today);
    m.job = `moment: ${def.id}`;
    if (w.hold !== null) {
      const place = w.hold[c.id === 'p1' ? 0 : 1] ?? w.hold[0];
      const at = place === undefined ? undefined : sim.map.points[place];
      if (place === undefined || at === undefined) return false;
      if (c.holding === place) return true;
      // La place se prend à portée (`moments.holdRange`): le trajet s'arrête au centre d'une case voisine.
      if (distance(c.pos, at) > sim.content.settings.moments.holdRange - 0.2) return goTo(sim, c, m, `tenir:${place}`, at, 0.3, out) || true;
      out.push({ type: 'act' });
      m.waitUntil = sim.world.tick + 2;
      return true;
    }
    if (w.seated && w.bench !== null) {
      if (c.seat?.bench === w.bench) return true;
      const prop = benchById(sim.map, w.bench);
      if (prop === null) return false;
      const seat = freeSeatsNear(sim, prop.pos, 1.5).find((s) => s.bench === w.bench);
      if (seat === undefined) return goTo(sim, c, m, `banc:${w.bench}`, prop.pos, 2, out) || true;
      return goAct(sim, c, m, `banc:${w.bench}`, ground(seat.pos), seat.pos, sim.content.settings.benches.sitRange - 0.1, out) || true;
    }
    const target = watchTarget(sim.map, def, w.target, today);
    const key = `${def.id}:${String(today.day)}`;
    if (!(key in spots)) spots[key] = watchSpots(sim, w, target, character(sim, 'p1').pos);
    const spot = spots[key]?.[c.id];
    if (spot === undefined) return false;
    if (distance(c.pos, spot) > 0.35) return goTo(sim, c, m, `regarder:${def.id}`, spot, 0.3, out) || true;
    if (w.facing && angleTo(c, target) > LOOK_CONE * 0.8) {
      // Un pas minuscule vers la bête suffit à se tourner vers elle.
      const d = Math.max(1e-6, distance(c.pos, target));
      f.mx = ((target.x - c.pos.x) / d) * 0.2;
      f.my = ((target.y - c.pos.y) / d) * 0.2;
    }
    return true;
  }

  /** Les noms des poules: l'autre appelle chaque poule; « Le mot de Lucie »: l'autre répond à Jeanne. */
  function secretQuests(sim: Sim, c: Character, m: Memory, f: { mx: number; my: number }, out: Intent[]): boolean {
    for (const entry of sim.world.secrets.entries) {
      if (entry.doer !== c.id) continue;
      if (entry.quest === HEN_NAMES_QUEST && questStep(sim, HEN_NAMES_QUEST) === 'call') {
        const hen = sim.world.hens.filter((h) => h.namedBy === null).sort((a, b) => distance(c.pos, a.pos) - distance(c.pos, b.pos))[0];
        if (hen === undefined) return false;
        if (voice && told.hens[hen.id] === undefined) {
          m.job = 'attendre les noms des poules';
          return false;
        }
        m.job = 'appeler une poule';
        if (distance(c.pos, hen.pos) > 1.0) return goTo(sim, c, m, `poule:${hen.id}`, hen.pos, 0.8, out) || true;
        if (angleTo(c, hen.pos) > Math.PI / 4) {
          const d = Math.max(1e-6, distance(c.pos, hen.pos));
          f.mx = ((hen.pos.x - c.pos.x) / d) * 0.2;
          f.my = ((hen.pos.y - c.pos.y) / d) * 0.2;
          return true;
        }
        out.push({ type: 'act' });
        m.waitUntil = sim.world.tick + 3;
        return true;
      }
      if (entry.quest === LUCIE_QUEST && questStep(sim, LUCIE_QUEST) === 'tell_jeanne') {
        if (voice && told.lucie === null) {
          m.job = 'attendre la réponse de Firmin';
          return false;
        }
        const jeanne = sim.world.villagers.find((v) => v.id === 'jeanne');
        if (!jeanne?.visible) return false;
        m.job = 'raconter à Jeanne';
        return goAct(sim, c, m, 'parler:jeanne:lucie', { kind: 'villager', villager: 'jeanne' }, jeanne.pos, sim.content.settings.ranges.talk - 0.5, out);
      }
    }
    return false;
  }

  /** Le choix d'un robot dans un dialogue à secret: ce qu'on lui a dit, sinon ce qu'il n'a pas encore essayé. */
  function secretChoice(sim: Sim, c: Character): string | null {
    const d = c.dialogue;
    if (d === null) return null;
    if (d.dialogue === HEN_CALL_DIALOGUE) {
      const name = told.hens[d.villager];
      const known = name === undefined ? undefined : d.choices.find((ch) => ch.text === name);
      if (known !== undefined) return known.id;
      const used = new Set(sim.world.hens.filter((h) => h.namedBy !== null).map((h) => h.name));
      const tries = (tried.hens[d.villager] ??= []);
      const guess = d.choices.find((ch) => ch.id.startsWith('name:') && !used.has(ch.text) && !tries.includes(ch.id));
      if (guess === undefined) return null;
      tries.push(guess.id);
      return guess.id;
    }
    if (d.dialogue === LUCIE_QUIZ) {
      if (told.lucie !== null) return `reply_${String(told.lucie)}`;
      const guess = d.choices.find((ch) => !tried.lucie.includes(ch.id));
      if (guess === undefined) return null;
      tried.lucie.push(guess.id);
      return guess.id;
    }
    return null;
  }
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
        out.push({ type: 'dialogue_choice', choice: secretChoice(sim, c) ?? (give ?? d.choices[0])?.id ?? '' });
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
    // Assis sans rendez-vous assis (Espace près d'un banc pour autre chose): un pas le relève.
    if (c.seat !== null && !wantsSeat(sim, c) && !momentSeat(sim, c)) {
      m.job = 'se lever du banc';
      return frame(m, 0, 1);
    }
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
      watchMoment(sim, c, m, f, out) ||
      evening(sim, c, m, out) ||
      secretQuests(sim, c, m, f, out) ||
      social(sim, c, m, out) ||
      giveOdette(sim, c, m, out) ||
      order(sim, c, m, out) ||
      cookForOrder(sim, c, m, out) ||
      weekTwoQuests(sim, c, m, out) ||
      genericQuests(sim, c, m, out) ||
      orderHeavy(sim, c, m, out) ||
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
      speak(sim);
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
