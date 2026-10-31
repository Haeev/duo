/**
 * Besoins et forme (PE-03 à PE-07): Ventre au souper, Sommeil au lit, Cœur
 * des moments de la journée; forme du matin et endurance du jour.
 */
import type { Character, FormLevel } from '../etat/types';
import { type Sim, bump, character, distance, emit, partnerOf, say } from './contexte';

const FORM_LEVELS: readonly FormLevel[] = ['low', 'okay', 'good', 'great', 'radiant'];

/** Dépense d'endurance d'une action (coûts de `reglages.endurance.costs`, divisés par le réglage de la démo). */
export function spend(sim: Sim, c: Character, cost: string, factor = 1): void {
  const e = sim.content.settings.endurance;
  const base = e.costs[cost] ?? 0;
  if (base <= 0 || c.endurance <= 0) return;
  c.endurance = Math.max(0, c.endurance - base * e.costMultiplier * factor);
  if (c.endurance === 0) say(sim, c.id, 'no_energy');
}

/** À endurance nulle, tout prend plus de temps, mais rien n'est bloqué (PE-06). */
export function durationMultiplier(sim: Sim, c: Character): number {
  return c.endurance <= 0 ? sim.content.settings.endurance.atZeroDurationMultiplier : 1;
}

export function formLevel(sim: Sim, form: number): FormLevel {
  for (const l of sim.content.settings.needs.formLevels) {
    if (form < l.below) {
      const level = FORM_LEVELS.find((x) => x === l.level);
      if (level !== undefined) return level;
    }
  }
  return 'radiant';
}

function sleepOf(sim: Sim, c: Character): number {
  const bed = sim.world.furniture.find((f) => f.id === c.bedId);
  const value = bed === undefined ? sim.content.settings.needs.belly.none : (sim.content.items[bed.item]?.bed?.sleep ?? 0);
  return value + (c.midnightReturn ? sim.content.settings.needs.sleep.midnightPenalty : 0);
}

function bellyOf(sim: Sim, c: Character): number {
  const b = sim.content.settings.needs.belly;
  const { bread, simple, stew } = c.supper;
  if (stew > 0 && simple + bread > 0) return b.stewPlusDish;
  if (stew > 0) return b.stew;
  if (simple > 0) return b.simple;
  if (bread > 0) return b.bread;
  return b.none;
}

function heartOf(sim: Sim, c: Character): number {
  const h = sim.content.settings.needs.heart;
  let value = h.base;
  if (c.heartToday.envie) value += h.envie;
  if (c.heartToday.sharedEnvie) value += h.sharedEnvie;
  if (c.heartToday.ateTogether) value += h.ateTogether;
  if (c.heartToday.gesture) value += h.gestureTogether;
  // Moment rare vu à deux, quête secrète réussie du premier coup (tour 6).
  if (c.heartToday.moment === true) value += sim.content.settings.moments.heartBonus;
  if (c.heartToday.firstTry === true) value += sim.content.settings.secrets.firstTryHeart;
  return Math.min(h.max, value);
}

const clamp100 = (v: number): number => Math.max(0, Math.min(100, v));

/** La nuit fixe les besoins; le matin, la forme et l'endurance du jour. */
export function settleNight(sim: Sim, c: Character): void {
  c.needs.belly = clamp100(Math.max(bellyOf(sim, c), c.needsSet.belly ?? 0));
  c.needs.sleep = clamp100(c.needsSet.sleep ?? sleepOf(sim, c));
  c.needs.heart = clamp100(c.needsSet.heart ?? heartOf(sim, c));
  applyForm(sim, c);
  c.endurance = c.enduranceMax;
}

export function applyForm(sim: Sim, c: Character): void {
  const s = sim.content.settings;
  const w = s.needs.formWeights;
  const form = w.belly * c.needs.belly + w.sleep * c.needs.sleep + w.heart * c.needs.heart;
  c.form = formLevel(sim, form);
  c.enduranceMax = s.endurance.base + s.endurance.perFormPoint * form;
}

/** Le soir (dès la veillée possible), un plat compte pour le souper; avant, c'est un en-cas. */
export function isSupperTime(sim: Sim): boolean {
  return sim.world.clock.minutes >= sim.content.settings.clock.veilleeFrom;
}

/** Manger un plat du sac (déjà retiré par l'appelant). */
export function eat(sim: Sim, c: Character, item: string): void {
  const def = sim.content.items[item];
  const dish = def?.dish ?? null;
  if (def === undefined || dish === null) return;
  const s = sim.content.settings;
  if (isSupperTime(sim)) {
    c.supper[dish] += 1;
    const other = character(sim, partnerOf(c.id));
    const meal = other.lastMeal;
    const together =
      meal !== null && distance(c.pos, other.pos) <= s.ranges.eatTogether && !c.heartToday.ateTogether;
    c.lastMeal = { item, tick: sim.world.tick };
    if (together) {
      bump(sim, 'ate_together', null);
      const table = sim.world.furniture.find((f) => {
        if (sim.content.items[f.item]?.dining !== true) return false;
        const centre = { x: f.cell.cx + 1, y: f.cell.cy + 0.5 };
        return distance(centre, c.pos) <= s.ranges.eatTogether && distance(centre, other.pos) <= s.ranges.eatTogether;
      });
      if (table !== undefined) {
        bump(sim, `ate_together:${table.item}`, null);
        c.heartToday.ateTogether = true;
        other.heartToday.ateTogether = true;
        sim.world.session.togetherMoments += 1;
      }
    }
  } else {
    const snack = s.snacks[dish] ?? 0;
    c.endurance = Math.min(c.enduranceMax, c.endurance + snack);
  }
  bump(sim, `ate:${item}`, c.id);
  bump(sim, 'ate', c.id);
  emit(sim, { type: 'ate', by: c.id, item });
}
