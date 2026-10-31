/**
 * Application des intentions des joueurs. L'hôte les valide toutes (portée,
 * fonds, état): une intention impossible est ignorée ou donne un message.
 */
import type { Intent } from '../etat/actions';
import type { Character, CharacterId, Quality } from '../etat/types';
import { TOOLBAR_SLOTS } from './constantes';
import { type Sim, bump, character, distance, emit, partnerOf, secondsToTicks } from './contexte';
import { actFront, getUp, openMenu, perform, resolveClick, verbOf } from './agir';
import { placeFurniture, rotatePlacement, takeFurniture } from './amenagement';
import { durationMultiplier, eat, spend } from './besoins';
import { dialogueChoice, dialogueClose, dialogueNext, giveToVillager } from './dialogues';
import { answerProposal, chestMove, crateMove, nearChest, nearPoint, purchase, sell, withdraw } from './economie';
import { footprintCells, goTo, stopPath } from './deplacement';
import { nightChoice, startDay, startGame } from './horloge';
import { ITEM, POINT } from './ids';
import { clampSlot, giveToCharacter, payMaterials, takeFromBag } from './sac';

const NAME_MAX = 16;

function canAct(c: Character, sim: Sim): boolean {
  return c.created && c.status === 'active' && c.crafting === null && !(c.action.duration > 0 && sim.world.tick < c.action.since + c.action.duration);
}

function createCharacter(sim: Sim, c: Character, name: string, hair: number, outfit: number): void {
  if (sim.world.phase !== 'creation') return;
  const trimmed = name.normalize('NFC').trim();
  const chars = [...trimmed];
  c.name = chars.length >= 1 ? chars.slice(0, NAME_MAX).join('') : c.name;
  c.appearance.hair = Math.max(0, Math.min(2, Math.round(hair)));
  c.appearance.outfit = Math.max(0, Math.min(3, Math.round(outfit)));
  c.created = true;
  sim.runtime.changed = true;
  startGame(sim);
}

function examine(sim: Sim, c: Character): void {
  if (!canAct(c, sim) || !c.inHouse) return;
  const front = { cx: Math.floor(c.pos.x + Math.cos(c.facing)), cy: Math.floor(c.pos.y + Math.sin(c.facing)) };
  const here = { cx: Math.floor(c.pos.x), cy: Math.floor(c.pos.y) };
  // Le meuble devant soi d'abord, puis le tapis sous ses pieds.
  const covering = (cell: { cx: number; cy: number }, floor: boolean): string | null => {
    for (const f of sim.world.furniture) {
      const def = sim.content.items[f.item];
      if (def?.footprint === null || def === undefined || def.floor !== floor) continue;
      if (footprintCells(def.footprint, f.cell, f.rotation).some((k) => k.cx === cell.cx && k.cy === cell.cy)) return f.id;
    }
    return null;
  };
  const id = covering(front, false) ?? covering(front, true) ?? covering(here, true);
  if (id !== null) takeFurniture(sim, c, id);
}

function craft(sim: Sim, c: Character, recipeId: string): void {
  const recipe = sim.content.recipes[recipeId];
  if (recipe === undefined || !canAct(c, sim) && c.status !== 'menu') return;
  if (!sim.world.unlockedRecipes.includes(recipeId)) return;
  const near =
    recipe.station === 'workbench'
      ? nearPoint(sim, c, POINT.workbench, sim.content.settings.ranges.talk)
      : c.inHouse && sim.world.furniture.some((f) => sim.content.items[f.item]?.station === 'stove');
  if (!near || c.crafting !== null) return;
  const paid = payMaterials(sim, c, recipe.inputs);
  if (!paid.ok) return;
  const ticks = secondsToTicks(recipe.seconds * durationMultiplier(sim, c));
  c.crafting = { recipe: recipeId, endsAt: sim.world.tick + ticks };
  const kind = recipe.station === 'stove' ? 'cook' : recipe.inputs.some((i) => i.item === ITEM.log) ? 'saw' : 'hammer';
  c.action = { kind, since: sim.world.tick, duration: ticks, target: null };
  sim.runtime.changed = true;
}

/** Fin d'une fabrication en cours. */
export function updateCrafting(sim: Sim, c: Character): void {
  const job = c.crafting;
  if (job === null || sim.world.tick < job.endsAt) return;
  c.crafting = null;
  const recipe = sim.content.recipes[job.recipe];
  if (recipe === undefined) return;
  giveToCharacter(sim, c, recipe.output.item, 'ordinary', recipe.output.count);
  spend(sim, c, recipe.id in sim.content.settings.endurance.costs ? recipe.id : recipe.station === 'stove' ? 'cook' : 'craft_furniture');
  bump(sim, `crafted:${recipe.id}`, c.id);
  bump(sim, 'crafted', c.id);
  c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  emit(sim, { type: 'crafted', by: c.id, recipe: recipe.id, item: recipe.output.item, count: recipe.output.count });
  if (recipe.station === 'stove') emit(sim, { type: 'cooked', by: c.id, recipe: recipe.id });
}

function eatItem(sim: Sim, c: Character, item: string): void {
  const def = sim.content.items[item];
  if (def?.dish === null || def === undefined) return;
  if (c.status !== 'active' && c.status !== 'menu') return;
  if (takeFromBag(c, item, 1).length === 0) return;
  eat(sim, c, item);
  c.action = { kind: 'eat', since: sim.world.tick, duration: secondsToTicks(sim.content.settings.feel.actionSeconds.eat ?? 0), target: null };
}

function give(sim: Sim, c: Character, to: string, item: string, quality: Quality, count: number): void {
  if (count < 1) return;
  const s = sim.content.settings.ranges;
  if (to === 'p1' || to === 'p2') {
    const other = character(sim, to);
    if (other.id === c.id || distance(c.pos, other.pos) > s.action + 1) return;
    const taken = takeFromBag(c, item, count, quality).reduce((sum, x) => sum + x.count, 0);
    if (taken > 0) {
      giveToCharacter(sim, other, item, quality, taken);
      emit(sim, { type: 'gave', by: c.id, to: other.id, item, count: taken });
    }
    return;
  }
  const v = sim.world.villagers.find((x) => x.id === to);
  if (v === undefined || !v.visible || distance(c.pos, v.pos) > s.talk) return;
  giveToVillager(sim, c, to, item, count);
}

export function applyIntent(sim: Sim, by: CharacterId, intent: Intent): void {
  const c = character(sim, by);
  c.lastInputTick = sim.world.tick;
  switch (intent.type) {
    case 'create_character':
      createCharacter(sim, c, intent.name, intent.hair, intent.outfit);
      return;
    case 'move_to': {
      if (!c.created || (c.status !== 'active' && c.status !== 'menu') || c.crafting !== null) return;
      const target = resolveClick(sim, c, intent.target);
      if (target === null) return;
      if (c.status === 'menu') openMenu(sim, c, null);
      const reach = target.kind === 'villager' ? sim.content.settings.ranges.talk - 0.3 : sim.content.settings.ranges.action - 0.2;
      if (intent.act && distance(c.pos, target.pos) <= reach) {
        stopPath(sim, c);
        const verb = verbOf(sim, c, target);
        if (verb !== null && canAct(c, sim)) perform(sim, c, target, verb);
        return;
      }
      if (goTo(sim, c, target.pos)) sim.runtime.pendingAct[c.id] = intent.act ? intent.target : null;
      return;
    }
    case 'act':
      if (c.status === 'dialogue' || c.status === 'scene') dialogueNext(sim, c);
      else if (c.status === 'sleeping') getUp(sim, c);
      else if (canAct(c, sim)) actFront(sim, c);
      return;
    case 'examine':
      examine(sim, c);
      return;
    case 'select_slot':
      if (intent.slot >= 0 && intent.slot < TOOLBAR_SLOTS) c.selected = intent.slot;
      sim.runtime.changed = true;
      return;
    case 'cycle_slot':
      c.selected = clampSlot(c.selected + Math.sign(intent.delta));
      sim.runtime.changed = true;
      return;
    case 'swap_slots': {
      const a = c.bag[intent.from];
      const b = c.bag[intent.to];
      if (a === undefined || b === undefined) return;
      c.bag[intent.from] = b;
      c.bag[intent.to] = a;
      sim.runtime.changed = true;
      return;
    }
    case 'rotate_furniture':
      rotatePlacement(sim, c, intent.delta);
      return;
    case 'place_furniture':
      if (canAct(c, sim)) placeFurniture(sim, c, intent.cell, intent.rotation);
      return;
    case 'take_furniture': {
      const f = sim.world.furniture.find((x) => x.id === intent.furniture);
      if (f !== undefined && canAct(c, sim) && c.inHouse) takeFurniture(sim, c, f.id);
      return;
    }
    case 'hold_furniture': {
      const slot = c.bag.findIndex((s) => s?.item === intent.item);
      if (slot >= 0 && slot < TOOLBAR_SLOTS) c.selected = slot;
      sim.runtime.changed = true;
      return;
    }
    case 'cancel_placement': {
      const slot = c.bag.findIndex((s, i) => i < TOOLBAR_SLOTS && (s === null || sim.content.items[s.item]?.category !== 'furniture'));
      if (slot >= 0) c.selected = slot;
      c.placement = null;
      sim.runtime.changed = true;
      return;
    }
    case 'menu':
      if (c.status === 'active' || c.status === 'menu') openMenu(sim, c, intent.menu);
      return;
    case 'dialogue_next':
      dialogueNext(sim, c);
      return;
    case 'dialogue_choice':
      dialogueChoice(sim, c, intent.choice);
      return;
    case 'dialogue_close':
      dialogueClose(sim, c);
      return;
    case 'buy':
      purchase(sim, c, { source: 'grocery', item: intent.item, count: Math.floor(intent.count) });
      return;
    case 'sell':
      sell(sim, c, intent.item, intent.quality, Math.floor(intent.count));
      return;
    case 'catalogue_order':
      purchase(sim, c, { source: 'catalogue', item: intent.item, count: 1 });
      return;
    case 'proposal_answer':
      answerProposal(sim, c, intent.proposal, intent.accept);
      return;
    case 'proposal_withdraw':
      withdraw(sim, c.id, true);
      return;
    case 'crate_deposit':
    case 'crate_take':
      crateMove(sim, c, intent.item, intent.quality, Math.floor(intent.count), intent.type === 'crate_deposit');
      return;
    case 'chest_deposit':
    case 'chest_take':
      if (nearChest(sim, c)) chestMove(sim, c, intent.item, intent.quality, Math.floor(intent.count), intent.type === 'chest_deposit');
      return;
    case 'craft':
      craft(sim, c, intent.recipe);
      return;
    case 'eat':
      eatItem(sim, c, intent.item);
      return;
    case 'give':
      give(sim, c, intent.to, intent.item, intent.quality, Math.floor(intent.count));
      return;
    case 'read_letter': {
      const letter = sim.world.letters.find((l) => l.id === intent.letter);
      if (letter !== undefined && !letter.read.includes(c.id)) {
        letter.read.push(c.id);
        sim.runtime.changed = true;
      }
      return;
    }
    case 'start_day':
      startDay(sim, c.id);
      return;
    case 'get_up':
      getUp(sim, c);
      return;
    case 'night_choice':
      nightChoice(sim, c.id, intent.choice);
      return;
    case 'hint_seen':
      return;
  }
}

/** En arrivant au bout d'un trajet au clic: agir sur la cible si on l'avait demandé. */
export function arrive(sim: Sim, c: Character): void {
  const pending = sim.runtime.pendingAct[c.id];
  sim.runtime.pendingAct[c.id] = null;
  if (pending === null || !canAct(c, sim)) return;
  const target = resolveClick(sim, c, pending);
  if (target === null) return;
  const verb = verbOf(sim, c, target);
  if (verb !== null) perform(sim, c, target, verb);
}

export function otherOf(id: CharacterId): CharacterId {
  return partnerOf(id);
}
