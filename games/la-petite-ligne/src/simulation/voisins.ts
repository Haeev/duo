/**
 * Le carnet des habitudes, côté simulation (0.13, lot H1; conception `v0-13-habitants.md`,
 * sections 4.3 à 4.9 et 7.3): ce que les joueurs voient, entendent et lisent s'écrit au carnet
 * commun, chez les deux, avec qui l'a appris.
 */
import type { DialogueDef, VillagerDef } from '../donnees/types';
import type { HabitRef } from '../donnees/types-voisins';
import { habitKnown, habitPossible } from '../etat/planning';
import type { Character, CharacterId, VillagerState } from '../etat/types';
import { type HabitSource, writeDiscovery } from '../etat/types-voisins';
import { habitCount } from '../etat/voisins';
import { allHabitsBond } from './amitie';
import { SCHEDULE_PERIOD_TICKS, SIM_DT } from './constantes';
import { type Sim, character, distance, emit, message, notifyKey, partnerOf } from './contexte';

/** Activités où l'habitant est chez lui ou hors du bourg (on le voit seulement franchir sa porte). */
const HIDDEN_ACTIVITIES = new Set(['home', 'absent']);

/** Un joueur qui regarde: créé, présent, éveillé, dans la journée (une scène n'empêche rien, 4.9). */
export function canObserve(sim: Sim, c: Character): boolean {
  return (
    sim.world.phase === 'day' &&
    c.created &&
    !c.absent &&
    c.status !== 'sleeping' &&
    c.status !== 'breakfast' &&
    c.status !== 'night'
  );
}

/** Du même côté d'un mur: dehors tous les deux, ou dans le même intérieur; une fenêtre se voit du dehors. */
function sameSide(sim: Sim, c: Character, v: VillagerState): boolean {
  if (sim.content.settings.habits.windowPoints.includes(v.target)) return true;
  return c.inside === v.inside;
}

function villagerName(sim: Sim, villager: string): string {
  const v = sim.world.villagers.find((x) => x.id === villager);
  const def = sim.content.villagers.find((x) => x.id === villager);
  return v?.met === true && def !== undefined ? def.label : message(sim, 'habit_unknown_person');
}

function labelOf(sim: Sim, villager: string): string {
  return sim.content.villagers.find((x) => x.id === villager)?.label ?? villager;
}

function notifyDiscovery(
  sim: Sim,
  ref: HabitRef,
  label: string,
  source: HabitSource,
  by: CharacterId | 'both' | null,
  from: string | null,
): void {
  const vars = { name: villagerName(sim, ref.villager), habit: label };
  if (source === 'resume') return;
  if (source === 'noted' || by === null) {
    notifyKey(sim, 'both', 'message', 'habit_noted', vars);
    return;
  }
  if (source === 'seen') {
    if (by === 'both') notifyKey(sim, 'both', 'message', 'habit_found_together', vars);
    else
      notifyKey(sim, 'both', 'message', 'habit_found', {
        ...vars,
        player: character(sim, by).name,
      });
    return;
  }
  const who: CharacterId = by === 'both' ? 'p1' : by;
  const player = character(sim, who).name;
  const speaker = from === null ? '' : labelOf(sim, from);
  const [mine, other] =
    source === 'heard' ? ['habit_heard', 'habit_heard_other'] : ['habit_read', 'habit_read_other'];
  notifyKey(sim, who, 'message', mine, { ...vars, speaker, player });
  notifyKey(sim, partnerOf(who), 'message', by === 'both' ? mine : other, {
    ...vars,
    speaker,
    player,
  });
}

/**
 * Écrit une habitude au carnet commun (une seule fois, quel que soit le nombre de joueurs): la
 * liste des connues, la trace des dernières découvertes, la notification chez les deux.
 * `from`: l'habitant qui l'a dite ou l'écriteau lu. Rend `false` si elle y était déjà.
 */
export function revealHabit(
  sim: Sim,
  ref: HabitRef,
  source: HabitSource,
  by: CharacterId | 'both' | null,
  from: string | null,
): boolean {
  const { world } = sim;
  const def = sim.content.villagers
    .find((v) => v.id === ref.villager)
    ?.habits.find((h) => h.id === ref.habit);
  if (def === undefined || habitKnown(world, ref.villager, ref.habit)) return false;
  (world.habits.known[ref.villager] ??= []).push(ref.habit);
  const pending = world.habits.pending[ref.villager];
  if (pending !== undefined && ref.habit in pending) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- l'habitude connue quitte l'attente du rattrapage.
    delete pending[ref.habit];
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- un habitant sans attente ne garde pas d'entrée vide.
    if (Object.keys(pending).length === 0) delete world.habits.pending[ref.villager];
  }
  if (source !== 'resume') {
    const log = world.habits.log;
    log.push(
      writeDiscovery({
        villager: ref.villager,
        habit: ref.habit,
        day: world.clock.day,
        source,
        by,
      }),
    );
    const kept = sim.content.settings.habits.logKept;
    if (log.length > kept) log.splice(0, log.length - kept);
    notifyDiscovery(sim, ref, def.label, source, by, from);
    emit(sim, { type: 'habit_found', villager: ref.villager, habit: ref.habit, source, by });
    const count = habitCount(sim.content, world, ref.villager);
    if (count.known === count.total) {
      notifyKey(sim, 'both', 'message', 'habits_all', { name: villagerName(sim, ref.villager) });
      allHabitsBond(sim, ref.villager);
    }
  }
  sim.runtime.changed = true;
  return true;
}

/**
 * À chaque mise à jour des plannings: l'habitude de l'entrée en cours, et, pour un habitant
 * rencontré, un jour de plus où elle a tenu sans être connue (variantes au carnet, rattrapage 4.8).
 * Rend l'habitude d'avant (porte franchie à la fin d'une habitude chez soi).
 */
export function notePlanning(
  sim: Sim,
  def: VillagerDef,
  v: VillagerState,
  habit: string | null,
  from: number,
): string | null {
  const runtime = sim.runtime.villagerHabits;
  const before = runtime.get(def.id);
  // La minute de début ne change qu'avec l'habitude (deux entrées de la même habitude se suivent).
  if (before?.habit !== habit) runtime.set(def.id, { habit, from });
  if (habit === null || !v.met || habitKnown(sim.world, def.id, habit))
    return before?.habit ?? null;
  const day = sim.world.clock.day;
  const pending = (sim.world.habits.pending[def.id] ??= {});
  const entry = pending[habit];
  if (entry === undefined) pending[habit] = [1, day];
  else if (entry[1] !== day) pending[habit] = [entry[0] + 1, day];
  else return before?.habit ?? null;
  sim.runtime.changed = true;
  return before?.habit ?? null;
}

/** L'habitude de l'entrée en cours de cet habitant (`null`: aucune, ou pas encore relue). */
export function currentHabit(sim: Sim, villager: string): string | null {
  return sim.runtime.villagerHabits.get(villager)?.habit ?? null;
}

/** Rendu à son poste: visible, pas chez lui, arrivé (à moins de `arrivedDistance` du point), immobile. */
function atPost(sim: Sim, v: VillagerState): boolean {
  if (!v.visible || HIDDEN_ACTIVITIES.has(v.activity) || v.speed > 0) return false;
  if ((sim.runtime.villagerPaths[v.id]?.path.length ?? 0) > 0) return false;
  const at = sim.map.points[v.target];
  return at === undefined || distance(v.pos, at) <= sim.content.settings.habits.arrivedDistance;
}

/**
 * Règle d'observation (section 4.3), à chaque mise à jour des plannings: un joueur à moins de
 * `seeDistance` (`nightSeeDistance` le soir) d'un habitant rendu à son poste, du même côté d'un
 * mur, pendant `watchSeconds` d'affilée, écrit l'habitude. Les deux ensemble: « vu ensemble ».
 */
export function watchHabits(sim: Sim): void {
  const { world } = sim;
  const s = sim.content.settings.habits;
  const watch = sim.runtime.habitWatch;
  const period = SCHEDULE_PERIOD_TICKS * SIM_DT;
  const range = world.clock.minutes >= s.nightFrom ? s.nightSeeDistance : s.seeDistance;
  for (const def of sim.content.villagers) {
    if (def.habits.length === 0) continue;
    const v = world.villagers.find((x) => x.id === def.id);
    const habit = currentHabit(sim, def.id);
    const open =
      v !== undefined && habit !== null && !habitKnown(world, def.id, habit) && atPost(sim, v);
    const ready: CharacterId[] = [];
    let watching = 0;
    for (const c of world.characters) {
      const key = `${c.id}:${def.id}`;
      if (!open || !canObserve(sim, c) || distance(c.pos, v.pos) > range || !sameSide(sim, c, v)) {
        watch.delete(key);
        continue;
      }
      const seconds = (watch.get(key) ?? 0) + period;
      watch.set(key, seconds);
      watching += 1;
      if (seconds >= s.watchSeconds - 1e-9) ready.push(c.id);
    }
    const first = ready[0];
    if (first === undefined || habit === null) continue;
    revealHabit(sim, { villager: def.id, habit }, 'seen', watching === 2 ? 'both' : first, null);
    for (const c of world.characters) watch.delete(`${c.id}:${def.id}`);
  }
}

/**
 * Il franchit sa porte (section 4.3, « V entre ou sort »): en entrant pour une habitude chez soi
 * ou hors de la carte, ou en sortant à la fin de l'une d'elles. Qui est à moins de `doorDistance`,
 * du même côté, l'écrit.
 */
export function sawAtDoor(sim: Sim, v: VillagerState, habit: string | null): void {
  if (habit === null || habitKnown(sim.world, v.id, habit)) return;
  const range = sim.content.settings.habits.doorDistance;
  const by = sim.world.characters
    .filter((c) => canObserve(sim, c) && distance(c.pos, v.pos) <= range && sameSide(sim, c, v))
    .map((c) => c.id);
  const first = by[0];
  if (first === undefined) return;
  revealHabit(sim, { villager: v.id, habit }, 'seen', by.length === 2 ? 'both' : first, null);
}

/** On lui parle pendant son habitude (même s'il marche encore): elle s'écrit. */
export function sawInConversation(sim: Sim, c: Character, v: VillagerState): void {
  const habit = currentHabit(sim, v.id);
  if (habit === null || HIDDEN_ACTIVITIES.has(v.activity)) return;
  revealHabit(sim, { villager: v.id, habit }, 'seen', c.id, null);
}

/** Une réplique révélatrice entendue jusqu'au bout écrit ses habitudes (`from`: qui l'a dite). */
export function heardReveals(sim: Sim, c: Character, def: DialogueDef): void {
  for (const ref of def.reveals ?? []) revealHabit(sim, ref, 'heard', c.id, def.villager);
}

/** Ce qu'une réplique révélatrice apporte encore (choix de la réplique du quotidien, section 4.4). */
export type RevealUse =
  /** réplique ordinaire: tout ce qu'elle dit est au carnet */
  | 'none'
  /** elle parle d'une habitude pas possible aujourd'hui (quête pas faite, habitude disparue): elle se tait */
  | 'hidden'
  /** une habitude inconnue au rattrapage: avant tout le quotidien */
  | 'overdue'
  /** une habitude inconnue: avant les répliques ordinaires */
  | 'fresh';

/**
 * Décision du manager (2026-11-03): une réplique révélatrice, rumeurs comprises, ne se dit que si
 * toutes ses habitudes sont possibles aujourd'hui (`habitPossible`), et se tait quand l'une disparaît.
 */
export function revealUse(sim: Sim, def: DialogueDef): RevealUse {
  const refs = def.reveals ?? [];
  if (refs.length === 0) return 'none';
  const { world, content } = sim;
  const after = content.settings.habits.gossipAfterDays;
  let use: RevealUse = 'none';
  for (const ref of refs) {
    if (!habitPossible(content, world, ref.villager, ref.habit)) return 'hidden';
    if (habitKnown(world, ref.villager, ref.habit)) continue;
    if ((world.habits.pending[ref.villager]?.[ref.habit]?.[0] ?? 0) >= after) use = 'overdue';
    else if (use === 'none') use = 'fresh';
  }
  return use;
}

/** Lire un écriteau (Examiner à portée de son point): ses lignes, et ses habitudes au carnet. */
export function readSign(sim: Sim, c: Character): boolean {
  let best: string | null = null;
  let bestDistance = sim.content.settings.habits.signRange;
  for (const id in sim.content.signs) {
    const at = sim.map.points[id];
    if (at === undefined) continue;
    const d = distance(c.pos, at);
    if (d <= bestDistance) {
      best = id;
      bestDistance = d;
    }
  }
  const sign = best === null ? undefined : sim.content.signs[best];
  if (best === null || sign === undefined) return false;
  emit(sim, { type: 'sign_read', by: c.id, sign: best });
  for (const line of sign.lines) {
    for (const ref of line.habits)
      if (habitPossible(sim.content, sim.world, ref.villager, ref.habit))
        revealHabit(sim, ref, 'read', c.id, best);
  }
  return true;
}

/**
 * Il annonce en passant où il va (section 7.3): lien `announce.bondAtLeast` ou plus, en route vers
 * une habitude qui a sa réplique `announce`, au plus `announce.minutes` après son début, croisé à
 * moins de `announce.distance`; une fois par habitude et par jour, et elle s'écrit au carnet.
 */
export function announceHabits(sim: Sim): void {
  const { world } = sim;
  const a = sim.content.settings.habits.announce;
  const minutes = world.clock.minutes;
  for (const def of sim.content.villagers) {
    if ((world.bonds[def.id] ?? 0) < a.bondAtLeast) continue;
    const v = world.villagers.find((x) => x.id === def.id);
    const cur = sim.runtime.villagerHabits.get(def.id);
    const habit = cur?.habit ?? null;
    if (
      v === undefined ||
      cur === undefined ||
      habit === null ||
      !v.visible ||
      (sim.runtime.villagerPaths[v.id]?.path.length ?? 0) === 0
    )
      continue;
    if (minutes < cur.from || minutes - cur.from > a.minutes) continue;
    const text = def.habits.find((h) => h.id === habit)?.announce ?? null;
    const key = `announce:${def.id}:${habit}`;
    if (text === null || (world.countersToday.duo[key] ?? 0) > 0) continue;
    const c = world.characters.find(
      (x) => canObserve(sim, x) && distance(x.pos, v.pos) <= a.distance && sameSide(sim, x, v),
    );
    if (c === undefined) continue;
    // Une clé du jour seulement (remise à zéro à l'aube), sans compteur permanent.
    world.countersToday.duo[key] = 1;
    emit(sim, { type: 'villager_remark', villager: def.id, to: c.id, text });
    revealHabit(sim, { villager: def.id, habit }, 'heard', c.id, def.id);
  }
}
