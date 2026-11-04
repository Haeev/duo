/**
 * Besoins et forme (PE-03 à PE-07), et besoins doux du tour 10 (section 3): le Ventre baisse au fil
 * de la journée et se remplit en mangeant, le Repos (l'endurance) remonte assis et pendant la
 * sieste, le Cœur gagne au fil des moments à deux et ne baisse jamais. Un besoin satisfait donne un
 * bonus (endurance x 0,8 Ventre plein, marche x 1,1 Cœur léger); un besoin bas ne retire rien.
 * La forme du matin garde sa formule; les valeurs de nuit sont au moins celles d'avant ce tour.
 */
import { isTrainDay, secondsPerGameMinuteOn } from '../donnees/calendrier';
import { curtainsClosedWhereSleeping, fellAsleepTogether, furnitureAtHome, isNapTime, isNapping, sleepsInBuiltRoom } from '../etat/maison';
import { type Character, type FormLevel, SIM_HZ } from '../etat/types';
import { type Sim, bump, character, distance, emit, partnerOf, say, secondsToTicks } from './contexte';
import { takeFromBag } from './sac';

const FORM_LEVELS: readonly FormLevel[] = ['low', 'okay', 'good', 'great', 'radiant'];
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_HOUR = 60;

/** Compteurs du jour propres aux besoins (`countersToday`, remis à zéro à l'aube). */
const TODAY = {
  near: 'needs:near_heart',
  light: 'needs:light_said',
  full: 'needs:full_said',
  napTogether: 'needs:nap_together',
  pairedMeal: 'needs:paired_meal',
} as const;

function today(sim: Sim, c: Character, key: string): number {
  return sim.world.countersToday[c.id][key] ?? 0;
}

function setToday(sim: Sim, c: Character, key: string, value: number): void {
  sim.world.countersToday[c.id][key] = value;
}

/** Pas de simulation par minute de jeu, au rythme du jour. */
export function ticksPerGameMinute(sim: Sim): number {
  return secondsPerGameMinuteOn(sim.content.settings, sim.world.clock.day) * SIM_HZ;
}

/** Dépense d'endurance d'une action (coûts de `reglages.endurance.costs`); Ventre plein: 20 % de moins. */
export function spend(sim: Sim, c: Character, cost: string, factor = 1): void {
  spendPoints(sim, c, sim.content.settings.endurance.costs[cost] ?? 0, factor);
}

/** Dépense `base` points d'endurance (avant multiplicateurs), comme `spend` pour un coût lu ailleurs (défricher, 0.13). */
export function spendPoints(sim: Sim, c: Character, base: number, factor = 1): void {
  const e = sim.content.settings.endurance;
  if (base <= 0 || c.endurance <= 0) return;
  const soft = sim.content.settings.needs.soft;
  const full = c.needs.belly >= soft.belly.fullAt ? soft.belly.fullCostMultiplier : 1;
  const before = c.endurance;
  c.endurance = Math.max(0, c.endurance - base * e.costMultiplier * factor * full);
  if (c.endurance === 0) say(sim, c.id, 'no_energy');
  else {
    const low = soft.rest.levels.low * c.enduranceMax;
    if (before >= low && c.endurance < low) say(sim, c.id, 'rest_low');
  }
}

/** À endurance nulle, tout prend plus de temps, mais rien n'est bloqué (PE-06). */
export function durationMultiplier(sim: Sim, c: Character): number {
  return c.endurance <= 0 ? sim.content.settings.endurance.atZeroDurationMultiplier : 1;
}

/** Cœur léger: la marche va 10 % plus vite (jamais plus lente sinon). Le porter à deux a sa propre vitesse. */
export function walkFactor(sim: Sim, c: Character): number {
  const h = sim.content.settings.needs.soft.heart;
  return c.needs.heart >= h.lightAt ? h.lightWalkFactor : 1;
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

/** Sommeil de la nuit: le lit, la chambre (+5), les rideaux fermés de la pièce (+5), plafonné à 100. */
function sleepTonight(sim: Sim, c: Character): number {
  const s = sim.content.settings.needs.soft.sleep;
  let value = sleepOf(sim, c);
  if (c.bedId !== null) {
    if (sleepsInBuiltRoom(sim.map, sim.world, c)) value += s.bedroomBonus;
    if (curtainsClosedWhereSleeping(sim.content, sim.map, sim.world, c)) value += s.curtainsClosedBonus;
  }
  return value;
}

/** La règle d'avant ce tour (le souper seul): le plancher des valeurs de nuit. */
function supperBelly(sim: Sim, c: Character): number {
  const b = sim.content.settings.needs.belly;
  const { bread, simple, stew } = c.supper;
  if (stew > 0 && simple + bread > 0) return b.stewPlusDish;
  if (stew > 0) return b.stew;
  if (simple > 0) return b.simple;
  if (bread > 0) return b.bread;
  return b.none;
}

/** Gains du Cœur notés dans la journée (PE-03: envies, geste et souper à deux, moments, secrets). */
function flagGains(sim: Sim, c: Character): number {
  const h = sim.content.settings.needs.heart;
  let value = 0;
  if (c.heartToday.envie) value += h.envie;
  if (c.heartToday.sharedEnvie) value += h.sharedEnvie;
  if (c.heartToday.ateTogether) value += h.ateTogether;
  if (c.heartToday.gesture) value += h.gestureTogether;
  if (c.heartToday.moment === true) value += sim.content.settings.moments.heartBonus;
  if (c.heartToday.firstTry === true) value += sim.content.settings.secrets.firstTryHeart;
  return value;
}

/** Le Cœur de nuit d'avant ce tour: la base et les gains du jour. Plancher du Cœur du coucher. */
function heartOf(sim: Sim, c: Character): number {
  const h = sim.content.settings.needs.heart;
  return Math.min(h.max, h.base + flagGains(sim, c));
}

/** Confort de la maison (MA-07): les points de confort des meubles posés, divisés par 10, 20 au plus. */
export function homeComfort(sim: Sim): number {
  const h = sim.content.settings.needs.soft.heart;
  let sum = 0;
  for (const f of sim.world.furniture) {
    if (furnitureAtHome(sim.map, sim.world.rooms, f)) sum += sim.content.items[f.item]?.comfort ?? 0;
  }
  return Math.min(h.comfortMax, sum / Math.max(1, h.comfortDivisor));
}

/** Cœur du réveil (section 3.5): 40 + confort de la maison. */
export function morningHeart(sim: Sim): number {
  return sim.content.settings.needs.heart.base + homeComfort(sim);
}

const clamp100 = (v: number): number => Math.max(0, Math.min(100, v));

/**
 * Gain de Cœur (plafond 100, jamais de baisse); passer le seuil du Cœur léger le dit une fois par
 * jour. Exporté pour les gains du lot L3 (coupe remarquée, chocolat à deux).
 */
export function addHeart(sim: Sim, c: Character, amount: number): void {
  if (amount <= 0) return;
  const h = sim.content.settings.needs;
  const before = c.needs.heart;
  c.needs.heart = Math.min(h.heart.max, c.needs.heart + amount);
  if (before < h.soft.heart.lightAt && c.needs.heart >= h.soft.heart.lightAt && today(sim, c, TODAY.light) === 0) {
    setToday(sim, c, TODAY.light, 1);
    say(sim, c.id, 'heart_light');
  }
  sim.runtime.changed = true;
}

/** Ventre (plafond 100): au-delà, le gain est perdu, « Plus faim, mais c'était bon. » */
function addBelly(sim: Sim, c: Character, amount: number, quietCap = false): void {
  if (amount <= 0) return;
  const b = sim.content.settings.needs.soft.belly;
  const before = c.needs.belly;
  const after = before + amount;
  if (after > 100 && !quietCap) say(sim, c.id, 'belly_capped');
  c.needs.belly = Math.min(100, after);
  if (before < b.fullAt && c.needs.belly >= b.fullAt && today(sim, c, TODAY.full) === 0) {
    setToday(sim, c, TODAY.full, 1);
    say(sim, c.id, 'belly_full');
  }
  sim.runtime.changed = true;
}

/** Gains de Cœur notés par les autres règles (`heartToday`) déjà ajoutés, par personnage (recalculable). */
const flagsSeen = new WeakMap<Character, number>();

/**
 * Les gains de PE-03 arrivent au Cœur au moment où ils sont notés. Le premier passage (nouvelle
 * partie, reprise) prend les gains déjà notés pour acquis: ils sont dans le Cœur sauvegardé.
 */
function syncHeartFlags(sim: Sim, c: Character): void {
  const gains = flagGains(sim, c);
  const seen = flagsSeen.get(c);
  flagsSeen.set(c, gains);
  if (seen !== undefined && gains > seen) addHeart(sim, c, gains - seen);
}

/** La nuit fixe les besoins; le matin, la forme et l'endurance du jour, puis les valeurs du réveil. */
export function settleNight(sim: Sim, c: Character): void {
  const soft = sim.content.settings.needs.soft;
  const together = fellAsleepTogether(sim.content, sim.world, ticksPerGameMinute(sim));
  c.needs.belly = clamp100(Math.max(c.needs.belly, soft.belly.nightFloor, supperBelly(sim, c), c.needsSet.belly ?? 0));
  c.needs.sleep = clamp100(c.needsSet.sleep ?? sleepTonight(sim, c));
  const heart = Math.max(c.needs.heart, heartOf(sim, c)) + (together ? soft.sleep.togetherHeart : 0);
  c.needs.heart = clamp100(c.needsSet.heart ?? Math.min(sim.content.settings.needs.heart.max, heart));
  applyForm(sim, c);
  c.endurance = c.enduranceMax;
  // Le réveil: le petit-déjeuner est pris, le Cœur repart de la maison; rien n'est encore compté.
  c.needs.belly = soft.belly.morning;
  c.needs.heart = clamp100(morningHeart(sim));
  c.needs.apartMinutes = 0;
  c.needs.reunionsToday = 0;
  c.needs.nappedToday = false;
  c.needs.napStart = null;
  c.needs.curtainsMorningDone = false;
  c.needs.missingShown = false;
  flagsSeen.delete(c);
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

/** Ventre que donne un objet mangé (`needs.belly.foods`, sinon selon la sorte de plat). */
export function bellyGain(sim: Sim, item: string): number {
  const b = sim.content.settings.needs.soft.belly;
  const dish = sim.content.items[item]?.dish ?? null;
  return b.foods[item] ?? (dish === null ? 0 : b.byDish[dish]);
}

/** Manger un plat du sac (déjà retiré par l'appelant). */
export function eat(sim: Sim, c: Character, item: string): void {
  const def = sim.content.items[item];
  const dish = def?.dish ?? null;
  if (def === undefined || dish === null) return;
  const s = sim.content.settings;
  const soft = s.needs.soft.belly;
  const other = character(sim, partnerOf(c.id));
  // Ventre (tour 10): le souper compte double dès 18 h; ensemble, +10 de plus chacun (sans doubler).
  const supper = sim.world.clock.minutes >= soft.supperFrom;
  const meal = other.lastMeal;
  const window = soft.togetherMinutes * ticksPerGameMinute(sim);
  const together =
    meal !== null &&
    sim.world.tick - meal.tick <= window &&
    distance(c.pos, other.pos) <= s.ranges.eatTogether &&
    today(sim, other, TODAY.pairedMeal) !== meal.tick + 1;
  addBelly(sim, c, bellyGain(sim, item) * (supper ? soft.supperFactor : 1) + (together ? soft.together : 0));
  if (together) {
    addBelly(sim, other, soft.together, true);
    // La paire est comptée une fois (le tick du repas apparié, décalé de 1: 0 veut dire « aucun »).
    setToday(sim, other, TODAY.pairedMeal, meal.tick + 1);
    setToday(sim, c, TODAY.pairedMeal, sim.world.tick + 1);
    bump(sim, 'needs_ate_together', null);
    emit(sim, { type: 'ate_together' });
  }
  if (isSupperTime(sim)) {
    const otherSupped = other.supper.bread + other.supper.simple + other.supper.stew > 0;
    c.supper[dish] += 1;
    const supperTogether =
      otherSupped && meal !== null && distance(c.pos, other.pos) <= s.ranges.eatTogether && !c.heartToday.ateTogether;
    if (supperTogether) {
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
  c.lastMeal = { item, tick: sim.world.tick };
  bump(sim, `ate:${item}`, c.id);
  bump(sim, 'ate', c.id);
  emit(sim, { type: 'ate', by: c.id, item });
}

/**
 * Manger un plat du sac: depuis le carnet, le réchaud, ou Espace le plat en main (R04). Faux si
 * ce n'est pas un plat, ou s'il n'est pas dans le sac.
 */
export function eatFromBag(sim: Sim, c: Character, item: string): boolean {
  const def = sim.content.items[item];
  if (def?.dish === null || def === undefined) return false;
  if (c.status !== 'active' && c.status !== 'menu') return false;
  if (takeFromBag(c, item, 1).length === 0) return false;
  eat(sim, c, item);
  c.action = { kind: 'eat', since: sim.world.tick, duration: secondsToTicks(sim.content.settings.feel.actionSeconds.eat ?? 0), target: null };
  return true;
}

// ---------------------------------------------------------------------------
// Sieste (section 3.4)

function absoluteMinutes(sim: Sim): number {
  return sim.world.clock.day * MINUTES_PER_DAY + sim.world.clock.minutes;
}

function wake(sim: Sim, c: Character, key: string): void {
  c.status = 'active';
  c.bedId = null;
  c.needs.napStart = null;
  c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  sim.runtime.changed = true;
  say(sim, c.id, key);
  emit(sim, { type: 'got_up', by: c.id });
}

/**
 * Appelé juste après le coucher (`goToBed`): de 12 h à 16 h, c'est une sieste, jamais un coucher
 * pour la nuit (TE-07). Une par jour; à deux, Cœur +5 chacun une fois par jour.
 */
export function beginNapIfAfternoon(sim: Sim, c: Character): void {
  if (sim.world.phase !== 'day' || c.status !== 'sleeping' || !isNapTime(sim.content, sim.world.clock.minutes)) return;
  if (c.needs.nappedToday) {
    wake(sim, c, 'nap_once');
    return;
  }
  c.needs.napStart = absoluteMinutes(sim);
  c.needs.nappedToday = true;
  sim.runtime.changed = true;
  bump(sim, 'napped', c.id);
  const other = character(sim, partnerOf(c.id));
  emit(sim, { type: 'nap_started', by: c.id, together: isNapping(other) });
  if (!isNapping(other)) {
    say(sim, c.id, 'nap_start');
    return;
  }
  say(sim, 'both', 'nap_together');
  const gain = sim.content.settings.needs.soft.rest.nap.togetherHeart;
  for (const x of [c, other]) {
    if (today(sim, x, TODAY.napTogether) > 0) continue;
    setToday(sim, x, TODAY.napTogether, 1);
    addHeart(sim, x, gain);
  }
}

/** Facteur de l'horloge (section 3.4): les deux en sieste, elle va `togetherClockFactor` fois plus vite. */
export function napClockFactor(sim: Sim): number {
  const [a, b] = sim.world.characters;
  if (a === undefined || b === undefined || !isNapping(a) || !isNapping(b)) return 1;
  return sim.content.settings.needs.soft.rest.nap.togetherClockFactor;
}

/** Une heure datée toute proche (arrivée ou départ du train): les dormeurs se lèvent avant. */
function eventSoon(sim: Sim): boolean {
  const s = sim.content.settings;
  const { day, minutes } = sim.world.clock;
  const before = s.needs.soft.rest.nap.wakeBeforeEventMinutes;
  if (!isTrainDay(s, day)) return false;
  return [s.train.arrival, s.train.departure].some((t) => minutes >= t - before && minutes < t);
}

function updateNaps(sim: Sim): void {
  const nap = sim.content.settings.needs.soft.rest.nap;
  const now = absoluteMinutes(sim);
  for (const c of sim.world.characters) {
    if (c.needs.napStart === null) continue;
    if (c.status !== 'sleeping') {
      // Levé de lui-même (Agir, « Se lever »).
      c.needs.napStart = null;
      sim.runtime.changed = true;
      say(sim, c.id, 'nap_end');
      continue;
    }
    if (eventSoon(sim)) wake(sim, c, 'nap_wakeup');
    else if (now - c.needs.napStart >= nap.maxMinutes || sim.world.clock.minutes >= nap.to) wake(sim, c, 'nap_end');
  }
}

// ---------------------------------------------------------------------------
// Le fil de la journée

function seatComfortFactor(sim: Sim, c: Character): number {
  const r = sim.content.settings.needs.soft.rest;
  const seat = c.seat;
  if (seat === null) return 1;
  const f = sim.world.furniture.find((x) => x.id === seat.bench);
  const comfort = f === undefined ? 0 : (sim.content.items[f.item]?.comfort ?? 0);
  return comfort >= r.comfortSeatMin ? r.comfortSeatFactor : 1;
}

function restore(c: Character, amount: number): void {
  if (c.endurance < c.enduranceMax) c.endurance = Math.min(c.enduranceMax, c.endurance + amount);
}

function updateOne(sim: Sim, c: Character, minutes: number): void {
  const soft = sim.content.settings.needs.soft;
  const napping = isNapping(c);
  // Couché pour la nuit, ou encore au petit-déjeuner (pris: le Ventre du réveil vaut déjà).
  if ((c.status === 'sleeping' && !napping) || c.status === 'breakfast') return;
  const b = soft.belly;
  const before = c.needs.belly;
  const decay = (b.decayPerHour / MINUTES_PER_HOUR) * minutes * (napping ? soft.rest.nap.bellyDecayFactor : 1);
  c.needs.belly = Math.max(0, c.needs.belly - decay);
  if (before >= b.lowBelow && c.needs.belly < b.lowBelow) say(sim, c.id, 'belly_low');
  if (napping) restore(c, soft.rest.nap.perMinute * minutes);
  else if (c.status === 'active' && (c.seat !== null || c.action.kind === 'sit')) {
    restore(c, soft.rest.sitPerMinute * minutes * seatComfortFactor(sim, c));
  }
}

const awake = (c: Character): boolean => c.status !== 'sleeping' && c.status !== 'night' && c.status !== 'breakfast';

function updatePair(sim: Sim, a: Character, b: Character, minutes: number): void {
  const h = sim.content.settings.needs.soft.heart;
  const r = h.reunion;
  const d = distance(a.pos, b.pos);
  const bothAwake = awake(a) && awake(b);
  for (const c of [a, b]) {
    if (bothAwake && d <= h.nearPartner.radius) {
      const room = h.nearPartner.maxPerDay - today(sim, c, TODAY.near);
      const gain = Math.min(room, (h.nearPartner.perHour / MINUTES_PER_HOUR) * minutes);
      if (gain > 0) {
        setToday(sim, c, TODAY.near, today(sim, c, TODAY.near) + gain);
        addHeart(sim, c, gain);
      }
    }
    if (d > r.apartRadius) c.needs.apartMinutes += minutes;
    else if (d <= r.meetRadius) {
      // Un dormeur ne fête rien: les retrouvailles attendent son réveil.
      if (!bothAwake) continue;
      if (c.needs.apartMinutes >= r.apartMinutes && c.needs.reunionsToday < r.maxPerDay) {
        c.needs.reunionsToday += 1;
        addHeart(sim, c, r.gain);
        say(sim, c.id, 'reunion');
        bump(sim, 'reunion', c.id);
        emit(sim, { type: 'reunion', by: c.id });
      }
      c.needs.apartMinutes = 0;
    } else if (c.needs.apartMinutes < r.apartMinutes) c.needs.apartMinutes = 0;
    if (c.needs.apartMinutes >= r.apartMinutes && !c.needs.missingShown) {
      c.needs.missingShown = true;
      say(sim, c.id, 'heart_missing', { partner: (c === a ? b : a).name });
    }
  }
}

/**
 * À chaque pas, après l'horloge (`minutesBefore`: l'heure avant ce pas). Rien ne baisse quand
 * l'horloge est arrêtée (nuit, veillée, scène, absence, menus des deux).
 */
export function updateNeeds(sim: Sim, minutesBefore: number): void {
  const { world } = sim;
  if (world.phase !== 'day') return;
  for (const c of world.characters) if (c.created) syncHeartFlags(sim, c);
  const minutes = world.clock.minutes - minutesBefore;
  if (minutes > 0) {
    for (const c of world.characters) if (c.created) updateOne(sim, c, minutes);
    const [a, b] = world.characters;
    if (a?.created === true && b?.created === true) updatePair(sim, a, b, minutes);
  }
  // Après les gains: la dernière minute de la sieste compte avant le réveil.
  updateNaps(sim);
}

/**
 * Besoins doux d'une sauvegarde d'avant le tour 10 (migration du format 6): les valeurs du réveil,
 * plus les gains du Cœur déjà notés aujourd'hui. Le Sommeil et la forme ne changent pas.
 */
export function wakeNeedsAfterMigration(sim: Sim, c: Character): void {
  c.needs.belly = sim.content.settings.needs.soft.belly.morning;
  c.needs.heart = clamp100(Math.min(sim.content.settings.needs.heart.max, morningHeart(sim) + flagGains(sim, c)));
}
