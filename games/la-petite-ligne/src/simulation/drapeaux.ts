/**
 * Effets en jeu des drapeaux posés par les quêtes de la 0.13 (`reglages.flagEffects`, lu par
 * `donnees/effets-drapeaux.ts`): planches de la scie affûtée, menuiserie du samedi, soupe du jour
 * et souper de la pension (repas payés qui remplissent le Ventre), jumelles prêtées le mercredi,
 * drapeaux levés dès le départ. Le banc d'Hortense et les chaises du café passent par
 * `etat/drapeaux.ts` (le rendu les lit aussi). Tout se décide à partir de l'état du monde: l'hôte
 * simule, l'invité voit la même chose.
 */
import { weekdayOf } from '../donnees/calendrier';
import type { FlagMeal } from '../donnees/effets-drapeaux';
import type { Character } from '../etat/types';
import { type Sim, bump, distance, emit, notifyKey, say, secondsToTicks } from './contexte';
import { eat } from './besoins';
import { buildingOpen } from './interieurs';
import { countInBag, giveToCharacter, takeFromBag } from './sac';

/** Portée du comptoir ou de la porte où l'on commande un repas (m). */
const MEAL_REACH = 1.8;

function raised(sim: Sim, flag: string): boolean {
  return sim.world.flags.includes(flag);
}

// ---------------------------------------------------------------------------
// Drapeaux levés dès le départ

const settable = new WeakMap<object, Map<string, boolean>>();

/** Une donnée du jeu (quête, dialogue, moment, lettre...) peut-elle poser ce drapeau ? */
function canBeSet(sim: Sim, flag: string): boolean {
  let known = settable.get(sim.content);
  if (known === undefined) {
    known = new Map();
    settable.set(sim.content, known);
  }
  const cached = known.get(flag);
  if (cached !== undefined) return cached;
  const seen = new Set<object>();
  const walk = (node: unknown): boolean => {
    if (typeof node !== 'object' || node === null || seen.has(node)) return false;
    seen.add(node);
    const o = node as { type?: unknown; flag?: unknown };
    if (o.type === 'set_flag' && o.flag === flag) return true;
    for (const child of Object.values(node)) if (walk(child)) return true;
    return false;
  };
  // Les textes ne posent rien: on les saute.
  seen.add(sim.content.texts);
  const found = walk(sim.content);
  known.set(flag, found);
  return found;
}

/**
 * La roue du moulin tourne dès le départ tant qu'aucune quête ne peut lever `mill_running`
 * (sinon elle attend le drapeau): le rendu, le son et l'emploi du temps de Berthe lisent ce drapeau.
 */
export function raiseAutoFlags(sim: Sim): void {
  for (const flag of sim.content.settings.flagEffects.autoFlags) {
    if (raised(sim, flag) || canBeSet(sim, flag)) continue;
    sim.world.flags.push(flag);
    sim.runtime.changed = true;
  }
}

// ---------------------------------------------------------------------------
// Scie affûtée

/** Unités de plus à la fin de cette fabrication (la lame affûtée: 5 planches au lieu de 4). */
export function recipeBonus(sim: Sim, recipe: string): number {
  let extra = 0;
  for (const b of sim.content.settings.flagEffects.recipeBonus) {
    if (b.recipe === recipe && raised(sim, b.flag)) extra += b.extra;
  }
  return extra;
}

// ---------------------------------------------------------------------------
// Menuiserie du samedi

/**
 * La menuiserie est-elle ouverte ? Seulement le samedi, aux heures des réglages, une fois la
 * quête finie (drapeau); pendant la quête de Basile elle reste ouverte pour la scène du balayage.
 */
export function joineryOpen(sim: Sim): boolean {
  const j = sim.content.settings.flagEffects.joinery;
  if (j === null) return true;
  const { clock } = sim.world;
  if (raised(sim, j.flag)) {
    return j.weekdays.includes(weekdayOf(clock.day)) && j.hours.some(([from, to]) => clock.minutes >= from && clock.minutes < to);
  }
  return sim.world.quests.some((q) => q.id === j.quest && q.status === 'active');
}

// ---------------------------------------------------------------------------
// Repas payés (soupe du jour au café, souper du dimanche à la pension)

export function flagMeals(sim: Sim): readonly FlagMeal[] {
  return sim.content.settings.flagEffects.meals;
}

/** Points de la carte où l'on commande un repas (visée et clic). */
export function mealPoints(sim: Sim): string[] {
  return flagMeals(sim).map((m) => m.point);
}

export function mealAtPoint(sim: Sim, point: string): FlagMeal | null {
  return flagMeals(sim).find((m) => m.point === point && raised(sim, m.flag)) ?? null;
}

function mealOn(sim: Sim, meal: FlagMeal): boolean {
  const { clock } = sim.world;
  if (meal.weekdays.length > 0 && !meal.weekdays.includes(weekdayOf(clock.day))) return false;
  if (clock.minutes < meal.from || clock.minutes >= meal.to) return false;
  const building = sim.map.buildings[meal.building];
  return building === undefined || buildingOpen(sim, building);
}

export function nearMeal(sim: Sim, c: Character, meal: FlagMeal): boolean {
  const at = sim.map.points[meal.point];
  return at !== undefined && c.inside === meal.building && distance(c.pos, at) <= MEAL_REACH;
}

function eatenToday(sim: Sim, c: Character, meal: FlagMeal): number {
  return sim.world.countersToday[c.id][`meal:${meal.id}`] ?? 0;
}

/** Peut-il commander ce repas maintenant (pour la visée) ? */
export function canOrderMeal(sim: Sim, c: Character, meal: FlagMeal): boolean {
  return nearMeal(sim, c, meal) && mealOn(sim, meal) && eatenToday(sim, c, meal) < meal.perPlayerPerDay;
}

/**
 * Commande un repas: payé de la bourse commune, mangé sur place. Si l'autre joueur mange dans la
 * foulée près de lui, le Ventre profite du repas pris ensemble (`eat`, `needs.belly.together`).
 */
export function orderMeal(sim: Sim, c: Character, meal: FlagMeal): void {
  if (!nearMeal(sim, c, meal)) return;
  if (!mealOn(sim, meal)) {
    say(sim, c.id, meal.offText);
    return;
  }
  if (eatenToday(sim, c, meal) >= meal.perPlayerPerDay) {
    say(sim, c.id, meal.doneText);
    return;
  }
  if (meal.price > sim.world.purse) {
    say(sim, c.id, 'not_enough_money', { missing: meal.price - sim.world.purse });
    return;
  }
  sim.world.purse -= meal.price;
  bump(sim, `meal:${meal.id}`, c.id);
  emit(sim, { type: 'bought', by: c.id, item: meal.item, count: 1, price: meal.price });
  eat(sim, c, meal.item);
  const sip = secondsToTicks(sim.content.settings.feel.actionSeconds.eat ?? 0);
  c.action = { kind: 'eat', since: sim.world.tick, duration: sip, target: sim.map.points[meal.point] ?? null };
  sim.runtime.changed = true;
}

// ---------------------------------------------------------------------------
// Jumelles prêtées le mercredi

/** Au matin: reprend l'objet prêté la veille, puis le prête de nouveau si c'est le bon jour. */
function morningLoans(sim: Sim): void {
  const weekday = weekdayOf(sim.world.clock.day);
  for (const loan of sim.content.settings.flagEffects.loans) {
    let returned = false;
    for (const c of sim.world.characters) {
      if (countInBag(c, loan.item) > 0) {
        takeFromBag(c, loan.item, countInBag(c, loan.item));
        returned = true;
      }
    }
    const ground = sim.world.groundItems.filter((g) => g.item === loan.item);
    for (const g of ground) {
      sim.world.groundItems.splice(sim.world.groundItems.indexOf(g), 1);
      returned = true;
    }
    if (!raised(sim, loan.flag)) continue;
    if (loan.weekdays.includes(weekday)) {
      for (const c of sim.world.characters) giveToCharacter(sim, c, loan.item, 'ordinary', 1);
      notifyKey(sim, 'both', 'message', loan.lentText);
    } else if (returned) {
      notifyKey(sim, 'both', 'message', loan.returnText);
    }
  }
}

/** À l'aube, avant les emplois du temps: drapeaux d'office et objets prêtés. */
export function morningFlagEffects(sim: Sim): void {
  raiseAutoFlags(sim);
  morningLoans(sim);
  sim.runtime.changed = true;
}
