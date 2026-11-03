/**
 * Application des intentions des joueurs. L'hôte les valide toutes (portée,
 * fonds, état): une intention impossible est ignorée ou donne un message.
 */
import type { ClickTarget, Intent } from '../etat/actions';
import type { Character, CharacterId, Quality } from '../etat/types';
import { isHome } from '../etat/interieurs';
import { bakeryBuy, openBakery } from './bourg';
import { answerHairOffer, haircut, offerHaircut, openSalon } from './salon';
import { OUTFIT_COUNT, TOOLBAR_SLOTS } from './constantes';
import { type Sim, bump, character, distance, emit, partnerOf, secondsToTicks } from './contexte';
import { actFront, actOnClick, getUp, openMenu, pointerTarget, resolveClick } from './agir';
import { standUp } from './bancs';
import { clearCorner, designateCorner, placeFurniture, rotatePlacement, takeDecor, takeFurniture, toggleCurtains, topDecorOf, updatePlacement } from './amenagement';
import { durationMultiplier, eatFromBag, spend } from './besoins';
import { dialogueChoice, dialogueClose, dialogueNext, giveToVillager } from './dialogues';
import { answerProposal, crateMove, nearChest, nearPoint, purchase, sell, withdraw } from './economie';
import { depositFamily, sortStorage, storageMove } from './rangement';
import { roomDeposit } from './pieces';
import { bringPlanks, payImprovement } from './chantiers';
import { unstick } from './deblocage';
import { footprintCells, goTo, stopPath } from './deplacement';
import { chooseAtStage } from './fin';
import { nightChoice, startDay, startGame } from './horloge';
import { ITEM, POINT } from './ids';
import { clampSlot, giveToCharacter, payMaterials, takeFromBag } from './sac';

const NAME_MAX = 16;

function inGesture(c: Character, sim: Sim): boolean {
  return c.action.duration > 0 && sim.world.tick < c.action.since + c.action.duration;
}

function canAct(c: Character, sim: Sim): boolean {
  return c.created && c.status === 'active' && c.crafting === null && !inGesture(c, sim);
}

/** Un appui pendant un geste n'est pas perdu: il attend la fin du geste (le dernier remplace le précédent). */
function bufferAct(sim: Sim, c: Character, intent: Intent): void {
  if (c.status !== 'active' || c.crafting !== null || !inGesture(c, sim)) return;
  sim.runtime.bufferedAct[c.id] = { intent, tick: sim.world.tick };
}

/**
 * Fin d'un geste à durée (bêcher, semer, arroser, récolter, couper, ramasser,
 * remplir, manger): l'action repasse à `idle`, puis l'appui mémorisé est joué
 * s'il n'est pas trop vieux. Le rendu joue le geste une fois, de `since` à
 * `since + duration`.
 */
export function endGesture(sim: Sim, c: Character): void {
  const a = c.action;
  if (a.duration > 0 && c.crafting === null && sim.world.tick >= a.since + a.duration) {
    c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
    sim.runtime.changed = true;
  }
  const buffered = sim.runtime.bufferedAct[c.id];
  if (buffered === null || inGesture(c, sim)) return;
  sim.runtime.bufferedAct[c.id] = null;
  if (sim.world.tick - buffered.tick <= secondsToTicks(sim.content.settings.feel.inputBufferSeconds)) applyIntent(sim, c.id, buffered.intent);
}

/** Gestes que l'action tenue répète, case après case, sur le potager. */
const REPEATED: ReadonlySet<string> = new Set(['till', 'sow', 'water', 'harvest']);

/**
 * Espace tenu sur le potager: le geste se répète sur la case suivante visée
 * (jamais deux fois sur la même), après `feel.heldRepeatSeconds` de pause.
 */
export function heldRepeat(sim: Sim, c: Character, held: boolean): void {
  const r = sim.runtime;
  if (!held) {
    r.heldRepeat[c.id] = null;
    return;
  }
  const a = c.action;
  if (a.duration > 0 && REPEATED.has(a.kind) && a.target !== null) {
    r.heldRepeat[c.id] = { cx: Math.floor(a.target.x), cy: Math.floor(a.target.y), endsAt: a.since + a.duration };
  }
  const last = r.heldRepeat[c.id];
  const aim = c.aim;
  const verb = aim?.verb ?? null;
  // La visée de la souris n'enchaîne pas la rangée: ce n'est pas la case devant soi (R11).
  if (last === null || aim === null || aim.source === 'pointer' || verb === null || !REPEATED.has(verb) || !canAct(c, sim)) return;
  if (aim.cell.cx === last.cx && aim.cell.cy === last.cy) return;
  if (sim.world.garden.every((g) => g.cell.cx !== aim.cell.cx || g.cell.cy !== aim.cell.cy)) return;
  if (sim.world.tick < last.endsAt + secondsToTicks(sim.content.settings.feel.heldRepeatSeconds)) return;
  actFront(sim, c);
}

/** Cible survolée reçue du réseau: un point du sol hors des nombres finis ne vise rien. */
function validPointer(target: ClickTarget | null): ClickTarget | null {
  if (target?.kind !== 'ground') return target;
  return Number.isFinite(target.x) && Number.isFinite(target.y) ? target : null;
}

/** Une valeur choisie à l'écran, bornée à [0, `count` - 1] (une valeur absente garde l'actuelle). */
function pick(value: number | undefined, count: number, current: number): number {
  if (value === undefined || !Number.isFinite(value)) return current;
  return Math.max(0, Math.min(count - 1, Math.round(value)));
}

function createCharacter(
  sim: Sim,
  c: Character,
  intent: { name: string; hair: number; outfit: number; hairColor?: number; beard?: number },
): void {
  const { name, hair, outfit } = intent;
  if (sim.world.phase !== 'creation') return;
  const trimmed = name.normalize('NFC').trim();
  // 1 à 16 graphèmes (PE-01, H-01): « Œ » ou un accent combiné comptent pour un.
  const graphemes = Array.from(new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(trimmed), (s) => s.segment);
  c.name = graphemes.length >= 1 ? graphemes.slice(0, NAME_MAX).join('') : c.name;
  // Tour 10 (section 2): 12 coupes à la création (les trois du salon se choisissent chez Solange), 8 couleurs, barbe.
  const look = sim.content.settings.town.appearance;
  c.appearance.hair = pick(hair, look.creationHairStyles, 0);
  c.appearance.hairColor = pick(intent.hairColor, look.hairColors, c.appearance.hairColor);
  c.appearance.beard = pick(intent.beard, look.beards, c.appearance.beard);
  c.appearance.outfit = Math.max(0, Math.min(OUTFIT_COUNT - 1, Math.round(outfit)));
  c.created = true;
  sim.runtime.changed = true;
  startGame(sim);
}

function examine(sim: Sim, c: Character): void {
  if (!canAct(c, sim) || !isHome(c)) return;
  const front = { cx: Math.floor(c.pos.x + Math.cos(c.facing)), cy: Math.floor(c.pos.y + Math.sin(c.facing)) };
  const here = { cx: Math.floor(c.pos.x), cy: Math.floor(c.pos.y) };
  // Le meuble devant soi d'abord, puis le tapis sous ses pieds.
  const covering = (cell: { cx: number; cy: number }, floor: boolean): string | null => {
    for (const f of sim.world.furniture) {
      const def = sim.content.items[f.item];
      if (def?.floor !== floor || def.footprint === null) continue;
      if (footprintCells(def.footprint, f.cell, f.rotation).some((k) => k.cx === cell.cx && k.cy === cell.cy)) return f.id;
    }
    return null;
  };
  const id = covering(front, false) ?? covering(front, true) ?? covering(here, true);
  if (id === null) return;
  // Ce qui est posé dessus d'abord (S03), puis le meuble.
  const top = topDecorOf(sim, id);
  if (top !== null) takeDecor(sim, c, top.id);
  else takeFurniture(sim, c, id);
}

function craft(sim: Sim, c: Character, recipeId: string): void {
  const recipe = sim.content.recipes[recipeId];
  if (recipe === undefined || !canAct(c, sim) && c.status !== 'menu') return;
  if (!sim.world.unlockedRecipes.includes(recipeId)) return;
  const near =
    recipe.station === 'workbench'
      ? nearPoint(sim, c, POINT.workbench, sim.content.settings.ranges.talk)
      : isHome(c) && sim.world.furniture.some((f) => sim.content.items[f.item]?.station === 'stove');
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
    case 'title_ready':
      // L'écran titre est tenu par l'interface; la simulation partage seulement qui est prêt.
      c.titleReady = intent.ready;
      sim.runtime.changed = true;
      return;
    case 'end_ready':
      // L'ancien « Continuer » de l'écran de fin: « Finir la séance ».
      chooseAtStage(sim, by, intent.ready ? 'finish' : null);
      return;
    case 'stage_choice':
      chooseAtStage(sim, by, intent.choice);
      return;
    case 'create_character':
      createCharacter(sim, c, intent);
      return;
    case 'move_to': {
      if (!c.created || (c.status !== 'active' && c.status !== 'menu') || c.crafting !== null) return;
      const target = resolveClick(sim, c, intent.target);
      if (target === null) {
        // L'objet cliqué n'est plus là: l'autre vient peut-être de le ramasser (SI-01).
        if (intent.act && canAct(c, sim)) actOnClick(sim, c, intent.target, null, sim.world.tick);
        return;
      }
      if (c.status === 'menu') openMenu(sim, c, null);
      const reach =
        target.kind === 'villager'
          ? sim.content.settings.ranges.talk - 0.3
          : target.kind === 'bench'
            ? sim.content.settings.benches.sitRange
            : sim.content.settings.ranges.action - 0.2;
      const near = distance(c.pos, target.pos) <= reach;
      // Assis: un clic sur qui est à portée (parler, donner) se fait sans se lever; ailleurs, on se lève.
      const seatedAct = near && intent.act && (target.kind === 'villager' || target.kind === 'partner');
      if (c.seat !== null && !seatedAct) standUp(sim, c);
      if (intent.act && distance(c.pos, target.pos) <= reach) {
        stopPath(sim, c);
        if (canAct(c, sim)) actOnClick(sim, c, intent.target, target, sim.world.tick);
        else bufferAct(sim, c, intent);
        return;
      }
      // Un banc: on va devant la place (l'assise est sur une case du banc, infranchissable).
      const goal = target.kind === 'bench' ? target.stand : target.pos;
      if (goTo(sim, c, goal)) sim.runtime.pendingAct[c.id] = intent.act ? { target: intent.target, since: sim.world.tick } : null;
      return;
    }
    case 'point_at':
      sim.runtime.pointer[c.id] = validPointer(intent.target);
      // L'aperçu du meuble suit la souris dès ce pas: un clic qui suit pose là où on le voit.
      if (c.placement !== null) updatePlacement(sim, c);
      return;
    case 'act': {
      if (c.status === 'dialogue' || c.status === 'scene') {
        dialogueNext(sim, c);
        return;
      }
      if (c.status === 'sleeping') {
        getUp(sim, c);
        return;
      }
      // Espace prend la cible survolée et mise en évidence, comme le clic: les deux ne se contredisent pas.
      const pointed = c.status === 'active' ? pointerTarget(sim, c) : null;
      if (pointed !== null) applyIntent(sim, by, { type: 'move_to', target: pointed.click, act: true });
      else if (canAct(c, sim)) actFront(sim, c);
      else bufferAct(sim, c, intent);
      return;
    }
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
      // Un meuble posé, ou un petit objet posé sur un meuble (S03, même clic droit).
      const known = sim.world.furniture.some((x) => x.id === intent.furniture) || sim.world.decor.some((x) => x.id === intent.furniture);
      if (known && canAct(c, sim) && isHome(c)) takeFurniture(sim, c, intent.furniture);
      return;
    }
    case 'corner':
      if (canAct(c, sim) && Number.isFinite(intent.x) && Number.isFinite(intent.y)) designateCorner(sim, c, intent.x, intent.y);
      return;
    case 'corner_clear':
      if (c.created) clearCorner(sim, c);
      return;
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
      // Pendant la sieste, le carnet s'ouvre (et se ferme) sans réveiller (section 3.4).
      if (c.status === 'sleeping' && c.needs.napStart !== null && (intent.menu === null || intent.menu === 'notebook' || intent.menu === 'letter')) {
        c.menu = intent.menu;
        sim.runtime.changed = true;
        return;
      }
      if (c.status !== 'active' && c.status !== 'menu') return;
      // Le fauteuil et le guichet ont leurs règles (portée, heures, un seul au fauteuil).
      if (intent.menu === 'salon') openSalon(sim, c);
      else if (intent.menu === 'bakery') openBakery(sim, c);
      else openMenu(sim, c, intent.menu);
      return;
    case 'bakery_buy':
      if (c.status === 'active' || c.status === 'menu') bakeryBuy(sim, c, intent.item);
      return;
    case 'haircut':
      haircut(sim, c, intent.hair, intent.hairColor, intent.beard);
      return;
    case 'hair_offer':
      if (c.status === 'active' || c.status === 'menu') offerHaircut(sim, c, intent.hair, intent.hairColor, intent.beard);
      return;
    case 'hair_offer_answer':
      answerHairOffer(sim, c, intent.accept);
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
      // Au comptoir: l'épicerie d'Odette, ou la mercerie de Solange pour ce qu'elle vend (rideaux).
      purchase(sim, c, { source: sim.content.items[intent.item]?.shop === 'haberdashery' ? 'haberdashery' : 'grocery', item: intent.item, count: Math.floor(intent.count) });
      return;
    case 'sell':
      sell(sim, c, intent.item, intent.quality, Math.floor(intent.count));
      return;
    case 'catalogue_order':
      purchase(sim, c, { source: 'catalogue', item: intent.item, count: 1 });
      return;
    case 'improvement_pay':
      payImprovement(sim, c, intent.improvement, intent.amount === null ? null : Math.floor(intent.amount));
      return;
    case 'improvement_planks':
      bringPlanks(sim, c, intent.improvement, Math.floor(intent.count));
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
      // Tour 10: rangement à cases et râtelier (`rangement.ts`).
      if (nearChest(sim, c)) storageMove(sim, c, intent.item, intent.quality, Math.floor(intent.count), intent.type === 'chest_deposit');
      return;
    case 'storage_deposit_family':
      if (nearChest(sim, c)) depositFamily(sim, c, intent.family);
      return;
    case 'storage_sort':
      if (nearChest(sim, c)) sortStorage(sim);
      return;
    case 'room_deposit':
      roomDeposit(sim, c, intent.room, intent.item, Math.floor(intent.count));
      return;
    case 'curtains':
      if (canAct(c, sim)) toggleCurtains(sim, c, intent.furniture);
      return;
    case 'craft':
      craft(sim, c, intent.recipe);
      return;
    case 'eat':
      eatFromBag(sim, c, intent.item);
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
    case 'unstick':
      unstick(sim, c);
      return;
    case 'pin': {
      if (!c.created || !Number.isFinite(intent.x) || !Number.isFinite(intent.y)) return;
      const x = Math.max(0, Math.min(sim.map.width, intent.x));
      const y = Math.max(0, Math.min(sim.map.height, intent.y));
      // Une épingle par joueur: la nouvelle remplace l'ancienne.
      c.pin = { pos: { x, y }, since: sim.world.tick, until: sim.world.tick + secondsToTicks(sim.content.settings.feel.pinSeconds) };
      emit(sim, { type: 'pin', by: c.id, pos: { x, y } });
      return;
    }
  }
}

/** En arrivant au bout d'un trajet au clic: agir sur la cible si on l'avait demandé. */
export function arrive(sim: Sim, c: Character): void {
  const pending = sim.runtime.pendingAct[c.id];
  sim.runtime.pendingAct[c.id] = null;
  if (pending === null || !canAct(c, sim)) return;
  actOnClick(sim, c, pending.target, resolveClick(sim, c, pending.target), pending.since);
}

export function otherOf(id: CharacterId): CharacterId {
  return partnerOf(id);
}
