/**
 * Application des intentions des joueurs. L'hôte les valide toutes (portée,
 * fonds, état): une intention impossible est ignorée ou donne un message.
 */
import { recipeBonus } from './drapeaux';
import { serveBuyer, setMarketLevel, stallMove } from './marche';
import { nameAnimal, startBrood } from './poules';
import type { ClickTarget, Intent } from '../etat/actions';
import type { Character, CharacterId, Quality } from '../etat/types';
import { mapMaxX, mapMaxY, mapMinX, mapMinY } from '../etat/carte';
import { isHome } from '../etat/interieurs';
import { bakeryBuy, openBakery } from './bourg';
import { answerHairOffer, haircut, offerHaircut, openSalon } from './salon';
import { starterWardrobe, starterWear } from '../etat/garde-robe';
import { clothesBuy, openClothesShop, openWardrobe, wearClothing } from './vetements';
import { TOOLBAR_SLOTS } from './constantes';
import { type Sim, bump, character, distance, emit, faceToward, partnerOf, secondsToTicks } from './contexte';
import { actFront, actOnClick, frontCell, furnitureCentre, getUp, openMenu, pointerTarget, resolveClick } from './agir';
import { holdPlot, holdsGardenLine, placePlots, removePlots } from './parcelles';
import { standUp } from './bancs';
import { clearCorner, designateCorner, placeFurniture, rotatePlacement, takeDecor, takeFurniture, toggleCurtains, topDecorOf, updatePlacement } from './amenagement';
import { durationMultiplier, eatFromBag, spend } from './besoins';
import { dialogueChoice, dialogueClose, dialogueNext, giveToVillager } from './dialogues';
import { offerGift } from './amitie';
import { voteDecision } from './decisions';
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
import { examineWater } from './peche';
import { readSign } from './voisins';

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

/** Une case reçue du réseau: deux entiers sûrs (la règle de pose dit ensuite si elle est sur la carte). */
function validCell(cell: { cx: number; cy: number }): boolean {
  return Number.isSafeInteger(cell.cx) && Number.isSafeInteger(cell.cy);
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
  // 0.12: la tenue de départ choisie, portée et rangée dans la garde-robe (seule à la création).
  const starters = sim.content.clothes.settings.starters.length;
  const wear = starterWear(sim.content.clothes, pick(outfit, starters, 0));
  c.appearance.wear = wear;
  c.wardrobe = starterWardrobe(wear);
  c.created = true;
  sim.runtime.changed = true;
  startGame(sim);
}

function examine(sim: Sim, c: Character): void {
  if (!canAct(c, sim)) return;
  // 0.13: le cordeau en main, X reprend la parcelle devant soi (maintenue s'il y a une culture).
  if (holdsGardenLine(c) && c.seat === null) {
    holdPlot(sim, c, frontCell(c));
    return;
  }
  // 0.13 (section 4.4): un écriteau à portée se lit d'abord.
  if (readSign(sim, c)) return;
  if (!isHome(c)) {
    examineWater(sim, c);
    return;
  }
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
  const nearStation = (who: Character): boolean =>
    recipe.station === 'workbench'
      ? nearPoint(sim, who, POINT.workbench, sim.content.settings.ranges.talk)
      : isHome(who) && sim.world.furniture.some((f) => sim.content.items[f.item]?.station === 'stove');
  if (!nearStation(c) || c.crafting !== null) return;
  const paid = payMaterials(sim, c, recipe.inputs);
  if (!paid.ok) return;
  // 0.12 (section 2.5): à deux devant le même poste, conserves et artisanat vont deux fois plus vite.
  const b = sim.content.settings.building;
  const partner = sim.world.characters.find((o) => o.id !== c.id);
  const together = b.twoPlayersRecipes.includes(recipeId) && partner !== undefined && !partner.absent && nearStation(partner);
  const ticks = secondsToTicks((recipe.seconds * durationMultiplier(sim, c)) / (together ? b.twoPlayersSpeedMultiplier : 1));
  c.crafting = { recipe: recipeId, endsAt: sim.world.tick + ticks };
  const kind = recipe.station === 'stove' ? 'cook' : recipe.inputs.some((i) => i.item === ITEM.log) ? 'saw' : 'hammer';
  // Face à l'établi ou au réchaud le temps du travail (le menu s'ouvre souvent de biais).
  // Le point de l'établi est la place devant lui: on regarde l'établi lui-même (l'objet de la carte).
  const bench = sim.map.props.find((p) => p.id === POINT.workbench)?.pos ?? sim.map.points[POINT.workbench] ?? null;
  const station = recipe.station === 'workbench' ? bench : nearestStove(sim, c);
  if (station !== null) faceToward(c, station);
  c.action = { kind, since: sim.world.tick, duration: ticks, target: station === null ? null : { x: station.x, y: station.y } };
  sim.runtime.changed = true;
}

/** Centre du réchaud le plus proche (chez soi), ou `null`. */
function nearestStove(sim: Sim, c: Character): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const f of sim.world.furniture) {
    if (sim.content.items[f.item]?.station !== 'stove') continue;
    const at = furnitureCentre(sim, f);
    const d = distance(c.pos, at);
    if (d < bestD) {
      best = at;
      bestD = d;
    }
  }
  return best;
}

/** Fin d'une fabrication en cours. */
export function updateCrafting(sim: Sim, c: Character): void {
  const job = c.crafting;
  if (job === null || sim.world.tick < job.endsAt) return;
  c.crafting = null;
  const recipe = sim.content.recipes[job.recipe];
  if (recipe === undefined) return;
  // 0.13: la lame affûtée de Basile donne une planche de plus par bûche (`flagEffects.recipeBonus`).
  const count = recipe.output.count + recipeBonus(sim, recipe.id);
  giveToCharacter(sim, c, recipe.output.item, 'ordinary', count);
  spend(sim, c, recipe.id in sim.content.settings.endurance.costs ? recipe.id : recipe.station === 'stove' ? 'cook' : 'craft_furniture');
  bump(sim, `crafted:${recipe.id}`, c.id);
  bump(sim, 'crafted', c.id);
  c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  emit(sim, { type: 'crafted', by: c.id, recipe: recipe.id, item: recipe.output.item, count });
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
      faceToward(c, other.pos);
      giveToCharacter(sim, other, item, quality, taken);
      emit(sim, { type: 'gave', by: c.id, to: other.id, item, count: taken });
    }
    return;
  }
  const v = sim.world.villagers.find((x) => x.id === to);
  if (v === undefined || !v.visible || distance(c.pos, v.pos) > s.talk) return;
  faceToward(c, v.pos);
  giveToVillager(sim, c, to, item, count);
}

/**
 * 0.13 (lot H2): offrir un objet du sac à un habitant visible, à portée de conversation, en
 * journée, hors scène; on peut le faire en lui parlant.
 */
function gift(sim: Sim, c: Character, villager: string, item: string): void {
  const v = sim.world.villagers.find((x) => x.id === villager);
  if (v === undefined || !v.visible || sim.world.phase !== 'day' || sim.world.scene !== null) return;
  const free = c.status === 'active' || (c.status === 'dialogue' && c.dialogue?.villager === villager);
  if (!c.created || !free || distance(c.pos, v.pos) > sim.content.settings.ranges.talk) return;
  faceToward(c, v.pos);
  offerGift(sim, c, villager, item);
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
    case 'plot_place':
      if (canAct(c, sim)) placePlots(sim, c, intent.cells.filter(validCell));
      return;
    case 'plot_remove':
      if (canAct(c, sim)) removePlots(sim, c, intent.cells.filter(validCell));
      return;
    case 'plot_hold':
      if (intent.cell === null) holdPlot(sim, c, null);
      else if (canAct(c, sim) && validCell(intent.cell)) holdPlot(sim, c, intent.cell);
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
      else if (intent.menu === 'clothes_shop') openClothesShop(sim, c);
      else if (intent.menu === 'wardrobe') openWardrobe(sim, c);
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
    case 'clothes_buy':
      if (c.status === 'active' || c.status === 'menu') clothesBuy(sim, c, intent.item);
      return;
    case 'wear':
      if (c.status === 'active' || c.status === 'menu') wearClothing(sim, c, intent.slot, intent.item);
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
    case 'decision_vote':
      voteDecision(sim, c.id, intent.decision, intent.option);
      return;
    case 'proposal_withdraw':
      withdraw(sim, c.id, true);
      return;
    case 'crate_deposit':
    case 'crate_take':
      crateMove(sim, c, intent.item, intent.quality, Math.floor(intent.count), intent.type === 'crate_deposit');
      return;
    case 'stall_deposit':
    case 'stall_take':
      if (c.status === 'active' || c.status === 'menu') stallMove(sim, c, intent.item, intent.quality, Math.floor(intent.count), intent.type === 'stall_deposit');
      return;
    case 'market_level':
      if (c.status === 'active' || c.status === 'menu') setMarketLevel(sim, c, intent.level);
      return;
    case 'market_serve':
      if (c.status === 'active' || c.status === 'menu') serveBuyer(sim, c, intent.villager);
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
    // 0.12: nommer une bête (à son tour, parmi les trois noms), mettre une poule à couver.
    case 'animal_name':
      nameAnimal(sim, c, intent.animal, intent.name);
      return;
    case 'brood_start':
      if (canAct(c, sim)) startBrood(sim, c, intent.hen);
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
    case 'gift':
      gift(sim, c, intent.villager, intent.item);
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
      const x = Math.max(mapMinX(sim.map), Math.min(mapMaxX(sim.map) + 1, intent.x));
      const y = Math.max(mapMinY(sim.map), Math.min(mapMaxY(sim.map) + 1, intent.y));
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
