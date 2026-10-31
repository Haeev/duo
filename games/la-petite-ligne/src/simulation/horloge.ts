/**
 * Horloge partagée et cycle de la journée (TE-01 à TE-08, démo): journée,
 * veillée qui arrête le temps, coucher à deux, nuit, petit-déjeuner, minuit.
 */
import { reopenCrate } from './economie';
import type { CharacterStatus, ClockStop } from '../etat/types';
import { SECONDS_PER_MINUTE, SIM_HZ } from './constantes';
import { type Sim, character, emit, partnerOf, say } from './contexte';
import { queueHint } from './astuces';
import { applyForm, settleNight } from './besoins';
import { deliverScheduledLetters } from './courrier';
import { cancelProposalsAtNight } from './economie';
import { pickEnvies } from './envies';
import { houseSpawn, midnightReturn, placeCharacter } from './deplacement';
import { placeVillagers } from './habitants';
import { morningEggs } from './poules';
import { morningGrowth } from './potager';
import { crossed, trainClock } from './train';

const BUSY: ReadonlySet<CharacterStatus> = new Set(['menu', 'dialogue', 'scene', 'breakfast']);

function stopReason(sim: Sim): ClockStop | null {
  const { world } = sim;
  const s = sim.content.settings.clock;
  switch (world.phase) {
    case 'creation':
      return 'creation';
    case 'night':
      return 'night';
    case 'breakfast':
      return 'breakfast';
    case 'ended':
      return 'ended';
    case 'day':
      break;
  }
  if (world.scene !== null) return 'scene';
  if (world.clock.minutes >= s.dayEnd) return 'midnight';
  if (world.clock.day >= s.lastDay.day && world.clock.minutes >= s.lastDay.end) return 'ended';
  if (world.clock.veillee) return 'veillee';
  if (world.characters.some((c) => c.absent)) return 'absence';
  if (s.stopWhenBothInMenu && world.characters.every((c) => BUSY.has(c.status))) return 'both_busy';
  return null;
}

/**
 * Absence (PA-04): sans entrée d'un joueur pendant `reglages.absence.minutes`, en pleine
 * journée, son personnage s'assoit et l'horloge l'attend; sa moindre entrée la relance.
 */
export function updateAbsence(sim: Sim): void {
  const { world } = sim;
  const limit = sim.content.settings.absence.minutes * SECONDS_PER_MINUTE * SIM_HZ;
  for (const c of world.characters) {
    const idle = world.tick - c.lastInputTick > limit;
    const absent = world.phase === 'day' && c.status === 'active' && c.created && idle;
    if (absent === c.absent) continue;
    c.absent = absent;
    sim.runtime.changed = true;
    emit(sim, { type: 'absence', who: c.id, absent });
    if (absent) {
      if (c.action.kind === 'idle') c.action = { kind: 'sit', since: world.tick, duration: 0, target: null };
      say(sim, partnerOf(c.id), 'clock_waits', { partner: c.name });
    } else if (c.action.kind === 'sit') {
      c.action = { kind: 'idle', since: world.tick, duration: 0, target: null };
    }
  }
}

/** Fait avancer l'horloge d'un pas et déclenche ce qui dépend de l'heure. */
export function updateClock(sim: Sim, dt: number): void {
  const { world } = sim;
  const s = sim.content.settings.clock;
  const clock = world.clock;
  if (world.phase === 'day') {
    const bothInside = world.characters.every((c) => c.inHouse);
    const veillee = clock.minutes >= s.veilleeFrom && bothInside;
    if (veillee && !clock.veillee) {
      emit(sim, { type: 'veillee_started' });
      queueHint(sim, 'p1', { on: 'veillee_started' });
      queueHint(sim, 'p2', { on: 'veillee_started' });
    }
    if (veillee !== clock.veillee) {
      clock.veillee = veillee;
      sim.runtime.changed = true;
    }
  }
  const reason = stopReason(sim);
  const running = reason === null;
  if (running !== clock.running || reason !== clock.stoppedBy) {
    clock.running = running;
    clock.stoppedBy = reason;
    sim.runtime.changed = true;
  }
  if (!running) return;
  const before = clock.minutes;
  let after = before + dt / s.secondsPerGameMinute;
  if (clock.day >= s.lastDay.day) after = Math.min(after, s.lastDay.end);
  after = Math.min(after, s.dayEnd);
  clock.minutes = after;
  timeTriggers(sim, before, after);
}

function timeTriggers(sim: Sim, before: number, after: number): void {
  const s = sim.content.settings.clock;
  trainClock(sim, before, after);
  deliverScheduledLetters(sim);
  for (const hint of sim.content.hints) {
    if (hint.trigger.on === 'time_reached' && crossed(before, after, hint.trigger.time)) {
      for (const c of sim.world.characters) {
        if (!c.inHouse) queueHint(sim, c.id, { on: 'time_reached', time: hint.trigger.time });
      }
    }
  }
  if (crossed(before, after, s.dayEnd)) {
    midnightReturn(sim);
    emit(sim, { type: 'midnight' });
  }
}

/** Les deux sont couchés: l'écran de nuit (TE-07). */
export function checkNight(sim: Sim): void {
  const { world } = sim;
  if (world.phase !== 'day' || world.scene !== null) return;
  if (!world.characters.every((c) => c.status === 'sleeping')) return;
  world.phase = 'night';
  for (const c of world.characters) {
    c.status = 'night';
    c.nightChoice = null;
  }
  cancelProposalsAtNight(sim);
  emit(sim, { type: 'night' });
}

/** Choix de l'écran de nuit; quand les deux ont choisi, le matin vient. */
export function nightChoice(sim: Sim, id: 'p1' | 'p2', choice: 'continue' | 'finish'): void {
  const { world } = sim;
  if (world.phase !== 'night') return;
  const c = character(sim, id);
  c.nightChoice = choice;
  sim.runtime.changed = true;
  const other = character(sim, partnerOf(id));
  if (other.nightChoice === null) return;
  const finish = c.nightChoice === 'finish' && other.nightChoice === 'finish';
  morning(sim);
  if (finish) emit(sim, { type: 'session_finish' });
}

function copyCounters(sim: Sim): void {
  const c = sim.world.counters;
  sim.world.countersAtDawn = { duo: { ...c.duo }, p1: { ...c.p1 }, p2: { ...c.p2 } };
}

/** Le matin (TE-04): besoins de la nuit, pousse, œufs, courrier, envies, petit-déjeuner. */
export function morning(sim: Sim): void {
  const { world } = sim;
  const s = sim.content.settings;
  for (const c of world.characters) settleNight(sim, c);
  world.counters.duo.nights = (world.counters.duo.nights ?? 0) + 1;
  world.clock.day += 1;
  world.clock.minutes = s.clock.dayStart;
  world.clock.veillee = false;
  world.weather = s.weatherByDay[world.clock.day - 1] ?? world.weather;
  world.weatherTomorrow = s.weatherByDay[world.clock.day] ?? world.weather;
  morningGrowth(sim);
  morningEggs(sim);
  reopenCrate(sim);
  world.grocerSoldToday = 0;
  for (const c of world.characters) {
    const bed = world.furniture.find((f) => f.id === c.bedId);
    const at = bed === undefined ? houseSpawn(sim) : { x: bed.cell.cx + 0.5, y: bed.cell.cy + 0.5 };
    placeCharacter(sim, c, at);
    c.status = 'breakfast';
    c.breakfastDone = false;
    c.nightChoice = null;
    c.bedId = null;
    c.menu = null;
    c.supper = { bread: 0, simple: 0, stew: 0 };
    c.midnightReturn = false;
    c.needsSet = { belly: null, sleep: null, heart: null };
    c.heartToday = { envie: false, sharedEnvie: false, ateTogether: false, gesture: false };
    c.lastMeal = null;
    c.stays = {};
    c.action = { kind: 'idle', since: world.tick, duration: 0, target: null };
  }
  copyCounters(sim);
  pickEnvies(sim);
  deliverScheduledLetters(sim);
  placeVillagers(sim);
  world.phase = 'breakfast';
  world.clock.running = false;
  world.clock.stoppedBy = 'breakfast';
  emit(sim, { type: 'morning', day: world.clock.day });
  emit(sim, { type: 'save_point', reason: 'dawn' });
}

/** Commencer sa journée (petit-déjeuner fini chez ce joueur). */
export function startDay(sim: Sim, id: 'p1' | 'p2'): void {
  const { world } = sim;
  const c = character(sim, id);
  if (c.status !== 'breakfast') return;
  c.status = 'active';
  c.breakfastDone = true;
  if (world.phase === 'breakfast') world.phase = 'day';
  sim.runtime.changed = true;
}

/** Le jour 1 commence quand les deux personnages sont créés. */
export function startGame(sim: Sim): void {
  const { world } = sim;
  if (world.phase !== 'creation' || !world.characters.every((c) => c.created)) return;
  world.phase = 'day';
  for (const c of world.characters) {
    settleFirstDay(sim, c.id);
    queueHint(sim, c.id, { on: 'spawned' });
  }
  copyCounters(sim);
  placeVillagers(sim);
  sim.runtime.changed = true;
}

function settleFirstDay(sim: Sim, id: 'p1' | 'p2'): void {
  const c = character(sim, id);
  applyForm(sim, c);
  c.endurance = c.enduranceMax;
}
