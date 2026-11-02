/**
 * Moments rares (conception du tour 6, section 1): le tirage du matin, les phases d'un moment,
 * l'apogée qui n'attend que les deux joueurs, le geste « tenir » (l'échelle de Basile) et la
 * confidence du matin à un seul joueur. L'hôte fait autorité; l'invité lit `world.moments` et
 * rejoue la chorégraphie depuis `startTick` (`etat/moments.ts`).
 *
 * Le tirage ne consomme pas le générateur de la partie (empreinte de la graine et du jour, comme
 * `variantOf`): ajouter ou retirer un moment ne change rien d'autre (M-11).
 */
import type { ControlFrame } from '../etat/actions';
import type { Character, CharacterId, MomentToday, Vec2 } from '../etat/types';
import type { Condition, MomentDef, MomentWatch, Season } from '../donnees/types';
import { activeWatch, allGoneAfterClimax, drawnPose, freezeState, momentDef, restPosition, startleTicks, watchTarget, type FreezeState } from '../etat/moments';
import { MOVE_DEADZONE, SIM_DT, SIM_HZ } from './constantes';
import { evaluate, evaluateAll, LOOK_CONE, NO_CONTEXT, variantOf } from './conditions';
import { type Sim, bump, character, distance, emit, message, notifyKey, partnerName, partnerOf, point, say, sayIfWritten } from './contexte';
import { refreshBlockers, stopPath } from './deplacement';
import { type Blockers, moveBody, nearestFreeCell } from './grille';
import { runEffects } from './effets';
import { unitDraw } from '../etat/tirage';
import { recordMoment } from './souvenirs';
import { seasonIndex, seasonOf } from '../etat/souvenirs';
import { isTrainDay as trainOn } from '../donnees/calendrier';

// ---------------------------------------------------------------------------
// Tirage sans le générateur de la partie

// Formule commune avec la rumeur du bourg (`etat/tirage.ts`), réexportée pour les tests.
export { fmix32, fnv1a, unitDraw } from '../etat/tirage';

// ---------------------------------------------------------------------------
// Quêtes qui portent un moment

function questState(sim: Sim, quest: string | null): { status: 'active' | 'done' } | null {
  if (quest === null) return null;
  return sim.world.quests.find((q) => q.id === quest) ?? null;
}

/** Évalue des conditions en tenant les plages horaires pour vraies (la quête démarrera-t-elle aujourd'hui ?). */
function trueAtSomeHour(sim: Sim, conditions: readonly Condition[]): boolean {
  const test = (c: Condition): boolean => {
    if (c.type === 'time_is') return true;
    if (c.type === 'all') return c.conditions.every(test);
    if (c.type === 'any') return c.conditions.some(test);
    return evaluate(sim, c, NO_CONTEXT);
  };
  return conditions.every(test);
}

/** La quête de ce moment est en cours, ou démarrera aujourd'hui d'après ses conditions. */
function questMomentToday(sim: Sim, def: MomentDef): boolean {
  if (def.mode === 'ambient' || def.quest === null) return false;
  const state = questState(sim, def.quest);
  if (state !== null) return state.status === 'active';
  const quest = sim.content.quests.find((q) => q.id === def.quest);
  return quest !== undefined && !quest.start.byEffect && trueAtSomeHour(sim, quest.start.when);
}

/**
 * Jour où la quête de ce moment démarrera, si sa variante le veut et qu'elle n'a pas démarré
 * (son `day_at_least`, au plus tôt aujourd'hui), sinon `null`.
 */
function plannedQuestDay(sim: Sim, def: MomentDef): number | null {
  if (def.quest === null || questState(sim, def.quest) !== null) return null;
  const quest = sim.content.quests.find((q) => q.id === def.quest);
  if (quest === undefined || quest.start.byEffect) return null;
  let day = sim.world.clock.day;
  for (const c of quest.start.when) {
    if (c.type === 'variant' && variantOf(sim.world.seed, c.group, c.of) !== c.value) return null;
    if (c.type === 'day_at_least') day = Math.max(day, c.day);
  }
  return day <= sim.content.settings.clock.lastDay.day ? day : null;
}

function lastOccurrence(sim: Sim, id: string): number | null {
  let last: number | null = null;
  for (const h of sim.world.moments.history) if (h.id === id && (last === null || h.day > last)) last = h.day;
  return last;
}

/** Jour du train (`train.days`, puis chaque samedi): seuls les moments `trainDays: "only"` y sortent. */
function isTrainDay(sim: Sim): boolean {
  return trainOn(sim.content.settings, sim.world.clock.day);
}

/**
 * Fenêtre entre deux passages d'un même moment (tour 7, règles 4 et 6): la sienne, sinon 7 jours,
 * puis `cooldownDaysLong` à partir de `longFromDay` (la démo et J1 gardent 7).
 */
export function cooldownOf(sim: Sim, def: MomentDef): number {
  const s = sim.content.settings.moments;
  // Tour 9 (section 4.5): le héron et le renard ont leur propre fenêtre longue (`longCooldownDays`).
  return def.cooldownDays ?? (sim.world.clock.day >= s.longFromDay ? (def.longCooldownDays ?? s.cooldownDaysLong) : s.cooldownDays);
}

/** Un moment d'ambiance peut-il sortir ce matin (section 1.2, étape 4) ? */
export function admissible(sim: Sim, def: MomentDef): boolean {
  const s = sim.content.settings.moments;
  const day = sim.world.clock.day;
  if (def.mode === 'quest' || def.weight <= 0 || !s.tiers.includes(def.tier)) return false;
  // Règle 1: un moment du train ne sort que ces jours-là; les autres, jamais ces jours-là.
  if (def.trainDays === 'only' ? !isTrainDay(sim) : s.noAmbientOnTrainDays && isTrainDay(sim)) return false;
  if (!evaluateAll(sim, def.availableWhen, NO_CONTEXT)) return false;
  const last = lastOccurrence(sim, def.id);
  if (last !== null && day - last < cooldownOf(sim, def)) return false;
  if (questState(sim, def.quest)?.status === 'active') return false;
  const planned = plannedQuestDay(sim, def);
  if (planned !== null && planned - day < s.cooldownDays) return false;
  if (def.maxPerSeason !== null) {
    const memories = sim.content.settings.memories;
    const season = seasonIndex(memories, day);
    const count =
      sim.world.moments.history.filter((h) => h.id === def.id && seasonIndex(memories, h.day) === season).length +
      (planned === null || seasonIndex(memories, planned) !== season ? 0 : 1);
    if (count >= def.maxPerSeason) return false;
  }
  return true;
}

/**
 * Ce moment d'ambiance peut-il sortir dans cette saison (règle 5, taille de la réserve) ? Seules
 * comptent ses conditions de saison et de jour minimal (au plus tard `longFromDay`); le reste
 * (météo, drapeaux) est tenu pour vrai.
 */
function possibleInSeason(def: MomentDef, season: number, day: number, longFromDay: number): boolean {
  const test = (c: Condition): boolean => {
    if (c.type === 'season_is') return c.seasons.some((s) => SEASON_INDEX[s] === season);
    if (c.type === 'day_at_least') return c.day <= Math.max(day, longFromDay);
    if (c.type === 'all') return c.conditions.every(test);
    if (c.type === 'any') return c.conditions.some(test);
    return true;
  };
  return def.availableWhen.every(test);
}

const SEASON_INDEX: Readonly<Record<Season, number>> = { spring: 0, summer: 1, autumn: 2, winter: 3 };

/** Moments d'ambiance possibles dans la saison du jour, hors train (règle 5). */
export function seasonPool(sim: Sim): number {
  const s = sim.content.settings.moments;
  const day = sim.world.clock.day;
  const season = seasonOf(sim.content.settings.memories, day);
  return sim.content.moments.filter(
    (def) => def.mode !== 'quest' && def.weight > 0 && def.trainDays === 'never' && s.tiers.includes(def.tier) && possibleInSeason(def, season, day, s.longFromDay),
  ).length;
}

/** Chance du jour (règle 5): réduite dès J2 quand la réserve de la saison est petite. */
export function dailyChanceOf(sim: Sim): number {
  const s = sim.content.settings.moments;
  if (sim.world.clock.day < s.longFromDay || isTrainDay(sim)) return s.dailyChance;
  return s.dailyChance * Math.min(1, seasonPool(sim) / Math.max(1, s.seasonPoolFull));
}

/** Poids au tirage (règle 7): dès J2, un moment jamais vu ensemble pèse `unseenWeightFactor` fois plus. */
export function drawWeight(sim: Sim, def: MomentDef): number {
  const s = sim.content.settings.moments;
  const unseen = !sim.world.memories.moments.some((m) => m.id === def.id);
  return def.weight * (sim.world.clock.day >= s.longFromDay && unseen ? s.unseenWeightFactor : 1);
}

/** Un moment du jour neuf (phase `absent`), pour ce jour. */
export function newToday(sim: Sim, def: MomentDef, origin: MomentToday['origin']): MomentToday {
  return {
    id: def.id,
    origin,
    day: sim.world.clock.day,
    phase: 'absent',
    phaseTick: sim.world.tick,
    startTick: null,
    elapsed: 0,
    paused: false,
    watchTicks: 0,
    watching: { p1: false, p2: false },
    early: false,
    noticed: [],
    hintTo: null,
    shyUntil: 0,
  };
}

/** Le moment du jour: celui d'une quête s'il y en a un, sinon le tirage (section 1.2). */
export function drawToday(sim: Sim): MomentToday | null {
  const { world, content } = sim;
  const s = content.settings.moments;
  const day = world.clock.day;
  for (const def of content.moments) {
    if (s.tiers.includes(def.tier) && questMomentToday(sim, def)) return newToday(sim, def, 'quest');
  }
  if (s.maxPerDay < 1 || day < s.firstAmbientDay) return null;
  // Les jours de fête ont déjà leur scène à deux (règle 2).
  if (s.noAmbientOnFestivalDays && s.festivalDays.includes(day)) return null;
  if (unitDraw(world.seed, 'moment', day) >= dailyChanceOf(sim)) return null;
  const pool = content.moments.filter((def) => admissible(sim, def));
  const total = pool.reduce((sum, def) => sum + drawWeight(sim, def), 0);
  if (total <= 0) return null;
  let pick = unitDraw(world.seed, 'moment_pick', day) * total;
  for (const def of pool) {
    pick -= drawWeight(sim, def);
    if (pick < 0) return newToday(sim, def, 'ambient');
  }
  return null;
}

/** Habitant rencontré par ce joueur (il lui a parlé au moins une fois). */
function hasMet(sim: Sim, id: CharacterId, villager: string | null): boolean {
  return villager === null || (sim.world.counters[id][`talked:${villager}`] ?? 0) > 0;
}

/** Le matin à 6 h, sur l'hôte: le moment du jour et sa confidence, à un seul joueur. */
export function morningMoments(sim: Sim): void {
  const { world } = sim;
  for (const c of world.characters) {
    c.momentHint = null;
    c.holding = null;
  }
  const today = drawToday(sim);
  world.moments.today = today;
  sim.runtime.changed = true;
  if (today?.origin !== 'ambient') return;
  const def = momentDef(sim.content, today.id);
  if (def === null) return;
  const weekdays = sim.content.texts.weekdays.length;
  world.moments.history.push({ id: def.id, day: world.clock.day, weekday: (world.clock.day - 1) % Math.max(1, weekdays), origin: 'ambient', seen: false });
  if (def.texts.hint === null) return;
  let to = world.moments.hintTurn;
  if (!hasMet(sim, to, def.hintFrom)) to = partnerOf(to);
  if (!hasMet(sim, to, def.hintFrom)) return;
  const text = message(sim, def.texts.hint, { partner: partnerName(sim, to) });
  character(sim, to).momentHint = { moment: def.id, text };
  today.hintTo = to;
  world.moments.hintTurn = partnerOf(to);
  notifyKey(sim, to, 'message', def.texts.hint, { partner: partnerName(sim, to) });
}

// ---------------------------------------------------------------------------
// Phases et apogée

function minutes(sim: Sim): number {
  return sim.world.clock.minutes;
}

function enter(sim: Sim, today: MomentToday, phase: MomentToday['phase']): void {
  today.phase = phase;
  today.phaseTick = sim.world.tick;
  today.elapsed = 0;
  today.paused = false;
  today.watchTicks = 0;
  today.early = false;
  today.watching = { p1: false, p2: false };
  sim.runtime.changed = true;
}


/** L'étape de quête attendue (l'échelle: `help`) est-elle en cours ? */
function questStepReady(sim: Sim, def: MomentDef, today: MomentToday): boolean {
  if (today.origin !== 'quest' || def.quest === null) return true;
  const state = sim.world.quests.find((q) => q.id === def.quest);
  if (state?.status !== 'active') return false;
  if (def.questStep === null) return true;
  return sim.content.quests.find((q) => q.id === def.quest)?.steps[state.step]?.id === def.questStep;
}

/** Dehors, libre, éveillé, présent: ce joueur peut regarder (condition 3). */
function free(sim: Sim, c: Character): boolean {
  return c.created && !c.inHouse && c.menu === null && c.dialogue === null && c.status === 'active' && !c.absent && sim.world.scene === null;
}

/** Place d'allumage (`watch.syncPress`) à portée de ce joueur, ou `null`. */
export function lanternPlaceNear(sim: Sim, c: Character, w: MomentWatch): string | null {
  const sp = w.syncPress;
  if (sp === null) return null;
  const range = sim.content.settings.moments.holdRange;
  let best: string | null = null;
  let bestD = Infinity;
  for (const id of sp.places) {
    const at = sim.map.points[id];
    if (at === undefined) continue;
    const d = distance(c.pos, at);
    if (d <= range && d < bestD) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

/** Ce joueur remplit-il sa part (rayon, immobilité, regard, banc, place tenue) ? */
export function watchPart(sim: Sim, c: Character, w: MomentWatch, target: { x: number; y: number }): boolean {
  if (!free(sim, c)) return false;
  // Les lanternes (tour 9): chacun à une place d'allumage, loin de l'autre (ni rayon ni cible).
  if (w.syncPress !== null) return lanternPlaceNear(sim, c, w) !== null;
  if (w.closeTogether !== null && distance(c.pos, character(sim, partnerOf(c.id)).pos) > w.closeTogether) return false;
  const d = distance(c.pos, target);
  if (d > w.radius || d < w.minRadius) return false;
  if (w.still && c.speed >= sim.content.settings.moments.stillSpeed) return false;
  if (w.facing && d >= 0.5) {
    let diff = Math.abs(Math.atan2(target.y - c.pos.y, target.x - c.pos.x) - c.facing) % (2 * Math.PI);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff > LOOK_CONE) return false;
  }
  if (w.seated && c.seat?.bench !== w.bench) return false;
  if (w.hold !== null && (c.holding === null || !w.hold.includes(c.holding))) return false;
  if (w.opposite !== null && bankSide(c.pos, w.opposite) === 0) return false;
  if (w.facingPartner) {
    const other = character(sim, partnerOf(c.id));
    if (distance(c.pos, other.pos) >= 0.5) {
      let diff = Math.abs(Math.atan2(other.pos.y - c.pos.y, other.pos.x - c.pos.x) - c.facing) % (2 * Math.PI);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff > LOOK_CONE) return false;
    }
  }
  return true;
}

/** Rive d'un joueur (`watch.opposite`): -1 en deçà de `at - gap`, +1 au-delà de `at + gap`, 0 entre les deux. */
export function bankSide(pos: Vec2, o: NonNullable<MomentWatch['opposite']>): -1 | 0 | 1 {
  const v = o.axis === 'x' ? pos.x : pos.y;
  if (v <= o.at - o.gap) return -1;
  if (v >= o.at + o.gap) return 1;
  return 0;
}

function releaseAll(sim: Sim): void {
  for (const c of sim.world.characters) releaseHold(sim, c);
}

function startClimax(sim: Sim, def: MomentDef, today: MomentToday): void {
  const { world } = sim;
  enter(sim, today, 'climax');
  today.startTick = world.tick;
  emit(sim, { type: 'moment_climax', moment: def.id, startTick: world.tick });
  // La récompense part au début de l'apogée: une sortie pendant l'apogée la compte comme vue.
  for (const c of world.characters) {
    c.heartToday.moment = true;
    if (c.momentHint?.moment === def.id) c.momentHint = null;
  }
  if (def.reward.money > 0) {
    world.purse += def.reward.money;
    emit(sim, { type: 'money', amount: def.reward.money });
  }
  const own = world.moments.history.find((h) => h.id === def.id && h.day === today.day && h.origin === today.origin && !h.seen);
  if (own !== undefined) own.seen = true;
  else {
    const weekdays = sim.content.texts.weekdays.length;
    world.moments.history.push({ id: def.id, day: world.clock.day, weekday: (world.clock.day - 1) % Math.max(1, weekdays), origin: today.origin, seen: true });
  }
  world.session.togetherMoments += 1;
  recordMoment(sim, def, today);
  runEffects(sim, def.effects, null);
}

/** Les deux tiennent-ils une place de l'échelle ? (l'apogée de l'échelle se fige sinon) */
function bothHolding(sim: Sim, w: MomentWatch): boolean {
  return sim.world.characters.every((c) => c.holding !== null && (w.hold === null || w.hold.includes(c.holding)));
}

function updateClimax(sim: Sim, def: MomentDef, today: MomentToday): void {
  const w = activeWatch(def, today);
  const choreo = def.climax;
  if (choreo.pauseWhenReleased && today.elapsed < choreo.pauseBefore) {
    const holding = bothHolding(sim, w);
    if (!holding && !today.paused) {
      today.paused = true;
      sim.runtime.changed = true;
      emit(sim, { type: 'moment_paused', moment: def.id });
      say(sim, 'both', 'ladder_hold_on');
    } else if (holding && today.paused) {
      today.paused = false;
      sim.runtime.changed = true;
      emit(sim, { type: 'moment_resumed', moment: def.id });
    }
  } else if (today.paused) {
    today.paused = false;
    emit(sim, { type: 'moment_resumed', moment: def.id });
  }
  if (today.paused) {
    // Échelle lâchée pour de bon (QA6-06): à l'heure de départ, l'apogée se termine quand même,
    // sinon Basile resterait figé et la musique baissée jusqu'au lendemain.
    if (minutes(sim) >= def.present.to) finishClimax(sim, def, today);
    return;
  }
  today.elapsed += SIM_DT;
  sim.runtime.changed = true;
  if (today.elapsed < choreo.seconds) return;
  finishClimax(sim, def, today);
}

/**
 * Fin du spectacle: le texte d'apogée et le compteur `moment_seen` (qui finit l'étape de quête,
 * donc son texte de fin) arrivent maintenant; au début, ils détournaient les yeux de la bête
 * (QA6-07). La récompense, elle, est partie au début.
 */
function finishClimax(sim: Sim, def: MomentDef, today: MomentToday): void {
  notifyKey(sim, 'both', 'message', def.texts.climax);
  bump(sim, `moment_seen:${def.id}`, null);
  releaseAll(sim);
  // L'heure de départ passée pendant l'apogée: l'état d'après se termine aussitôt.
  enter(sim, today, minutes(sim) >= def.present.to ? 'gone' : 'after');
}

/**
 * Reprise d'une sauvegarde faite pendant l'apogée (QA6-08): le spectacle est perdu, mais il compte
 * comme vu; son texte et la fin de l'étape de quête arrivent au rechargement.
 */
export function settleSavedClimax(sim: Sim): void {
  const today = sim.world.moments.today;
  if (today?.phase !== 'climax') return;
  const def = momentDef(sim.content, today.id);
  if (def === null) {
    enter(sim, today, 'gone');
    return;
  }
  finishClimax(sim, def, today);
}

function leaveNow(sim: Sim, def: MomentDef, today: MomentToday): void {
  releaseAll(sim);
  for (const c of sim.world.characters) if (c.momentHint?.moment === def.id) c.momentHint = null;
  // Tout est parti pendant l'apogée (la brume levée, la chevrette dans la haie): rien ne revient
  // pour repartir (QA7-01), le moment s'éteint.
  const nothingLeft = today.phase === 'after' && allGoneAfterClimax(def);
  // Un moment de quête manqué reviendra demain (même occurrence); un moment d'ambiance s'en va.
  if (def.leave !== null && !nothingLeft && (today.origin === 'ambient' || today.phase === 'after')) {
    enter(sim, today, 'left');
    emit(sim, { type: 'moment_left', moment: def.id });
    return;
  }
  enter(sim, today, 'gone');
}

/** Une ligne d'aide, une fois par moment et par joueur (`today.told`). */
function tellOnce(sim: Sim, today: MomentToday, who: CharacterId, key: string, text: string): void {
  const told = (today.told ??= []);
  const id = `${key}:${who}`;
  if (told.includes(id)) return;
  told.push(id);
  say(sim, who, text, { partner: partnerName(sim, who) });
}

/**
 * Les lanternes (tour 9, section 4.4): une flamme allumée seule s'éteint au bout de `gapSeconds`;
 * deux allumages, un à chaque place, à moins de `gapSeconds` l'un de l'autre, font l'apogée.
 */
function updateLanterns(sim: Sim, today: MomentToday, w: MomentWatch): void {
  const sp = w.syncPress;
  if (sp === null) return;
  const presses = (today.presses ??= { p1: null, p2: null });
  const gap = Math.round(sp.gapSeconds * SIM_HZ);
  for (const c of sim.world.characters) {
    const p = presses[c.id];
    if (p === null || sim.world.tick - p.tick <= gap) continue;
    presses[c.id] = null;
    sim.runtime.changed = true;
    emit(sim, { type: 'lantern_out', by: c.id, place: p.place });
    say(sim, c.id, 'moment_lantern_alone', { partner: partnerName(sim, c.id) });
  }
  // L'un à une place, l'autre à aucune: où est l'autre lanterne (une fois par moment).
  for (const c of sim.world.characters) {
    const mine = lanternPlaceNear(sim, c, w);
    const theirs = lanternPlaceNear(sim, character(sim, partnerOf(c.id)), w);
    if (mine === null || theirs !== null) continue;
    const other = sp.places.find((x) => x !== mine);
    if (other === undefined) continue;
    const key = other === 'lantern_square' ? 'moment_lantern_where_square' : 'moment_lantern_where_quay';
    if (Object.hasOwn(sim.content.texts.messages, key)) tellOnce(sim, today, c.id, 'where', key);
  }
}

/** Allumer la lanterne de cette place (Espace à portée): l'apogée si l'autre vient d'allumer la sienne. */
export function lightLantern(sim: Sim, c: Character, place: string): void {
  const today = sim.world.moments.today;
  const def = today === null ? null : momentDef(sim.content, today.id);
  if (today?.phase !== 'waiting' || def === null) return;
  const w = activeWatch(def, today);
  const sp = w.syncPress;
  const m = minutes(sim);
  if (sp === null || !sp.places.includes(place) || m < def.window.from || m >= def.window.to) return;
  const presses = (today.presses ??= { p1: null, p2: null });
  presses[c.id] = { tick: sim.world.tick, place };
  c.action = { kind: 'light', since: sim.world.tick, duration: Math.round(0.6 * SIM_HZ), target: { ...point(sim, place) } };
  sim.runtime.changed = true;
  emit(sim, { type: 'lantern_lit', by: c.id, place });
  const other = presses[partnerOf(c.id)];
  if (other !== null && other.place !== place && sim.world.tick - other.tick <= Math.round(sp.gapSeconds * SIM_HZ)) {
    today.presses = { p1: null, p2: null };
    startClimax(sim, def, today);
  }
}

/** Le moment du jour peut-il s'allumer à cette place maintenant ? (verbe « allumer » de la visée) */
export function lanternTargetNear(sim: Sim, c: Character): string | null {
  const today = sim.world.moments.today;
  if (today?.phase !== 'waiting' || !free(sim, c)) return null;
  const def = momentDef(sim.content, today.id);
  if (def === null) return null;
  const m = minutes(sim);
  if (m < def.window.from || m >= def.window.to) return null;
  return lanternPlaceNear(sim, c, activeWatch(def, today));
}

/**
 * Le salut du mécanicien (tour 9, section 4.2, `watch.arm`): les deux ont tenu les manivelles, les
 * lisses descendent et se verrouillent; les cases de la traversée se ferment et qui s'y trouve est
 * poussé vers le quai. L'apogée attend l'heure du départ (`climaxAt`).
 */
function armMoment(sim: Sim, def: MomentDef, today: MomentToday, w: MomentWatch): void {
  const arm = w.arm;
  if (arm === null) return;
  today.armedTick = sim.world.tick;
  today.watchTicks = 0;
  sim.runtime.dynamicDirty = true;
  sim.runtime.changed = true;
  emit(sim, { type: 'moment_armed', moment: def.id });
  sayIfWritten(sim, 'both', 'moment_gates_down');
  const b = refreshBlockers(sim);
  const cells = arm.cells;
  for (const c of sim.world.characters) {
    const cx = Math.floor(c.pos.x);
    const cy = Math.floor(c.pos.y);
    if (cx < cells.x || cx >= cells.x + cells.w || cy < cells.y || cy >= cells.y + cells.h) continue;
    stopPath(sim, c);
    const to = nearestFreeCell(b, { x: Math.min(Math.max(c.pos.x, cells.x + 0.5), cells.x + cells.w - 0.5), y: arm.pushToward[1] });
    const at = to ?? { x: arm.pushToward[0], y: arm.pushToward[1] };
    c.pos.x = at.x;
    c.pos.y = at.y;
    c.prev.x = at.x;
    c.prev.y = at.y;
  }
}

/** Retours pendant l'attente: la part de chacun, l'invitation à appeler l'autre, la timidité. */
function updateWaiting(sim: Sim, def: MomentDef, today: MomentToday): void {
  const { world } = sim;
  const w = activeWatch(def, today);
  if (w.syncPress !== null) updateLanterns(sim, today, w);
  // Le salut armé: on peut lâcher les manivelles; l'apogée part avec le train.
  if (w.arm !== null && (today.armedTick ?? null) !== null) {
    if (minutes(sim) >= w.arm.climaxAt) startClimax(sim, def, today);
    return;
  }
  const target = watchTarget(sim.map, def, w.target, today);
  const [a, b] = world.characters;
  if (a === undefined || b === undefined) return;
  const parts = { [a.id]: watchPart(sim, a, w, target), [b.id]: watchPart(sim, b, w, target) } as Record<CharacterId, boolean>;
  if (parts.p1 !== today.watching.p1 || parts.p2 !== today.watching.p2) {
    today.watching = { p1: parts.p1, p2: parts.p2 };
    sim.runtime.changed = true;
  }
  // Timidité d'abord: un joueur qui s'approche à ce pas fait filer la bête avant l'apogée.
  updateShy(sim, def, today);
  // Une bête partie se cacher (le martin-pêcheur au ras de l'eau) n'est pas là pour l'apogée:
  // elle partirait de son pieu, où elle réapparaîtrait d'un coup (QA7-03).
  const hidden = today.shyUntil > world.tick && def.actors.some((a) => a.shy?.hideAway === true);
  const m = minutes(sim);
  const inWindow = m >= def.window.from && m < def.window.to && questStepReady(sim, def, today);
  // La brume: chacun sur sa rive, pas tous deux sur la même.
  const sides = w.opposite === null || bankSide(a.pos, w.opposite) !== bankSide(b.pos, w.opposite);
  const freeze = w.freeze === null ? null : updateFreeze(sim, def, today, w, target);
  const both = parts.p1 && parts.p2 && sides;
  const early = both && !inWindow && m < def.window.from;
  if (early !== today.early) {
    today.early = early;
    sim.runtime.changed = true;
  }
  // Aux aguets (la chevrette): le compteur ne tourne que pendant un regard. Les lanternes: pas de compteur.
  if (both && inWindow && !hidden && w.syncPress === null && (freeze === null || freeze.kind === 'look')) {
    today.watchTicks += 1;
    sim.runtime.changed = true;
  } else if (today.watchTicks !== 0) {
    today.watchTicks = 0;
    sim.runtime.changed = true;
  }
  if (today.watchTicks >= Math.max(1, Math.round(w.holdSeconds * SIM_HZ))) {
    if (w.arm !== null) armMoment(sim, def, today, w);
    else startClimax(sim, def, today);
    return;
  }
  const s = sim.content.settings.moments;
  for (const c of world.characters) {
    const other = character(sim, partnerOf(c.id));
    // Seul près d'un moment d'ambiance: « Montre-le à {partner} ! », une fois par moment.
    if (today.origin !== 'ambient' || today.noticed.includes(c.id) || !free(sim, c)) continue;
    if (distance(c.pos, target) > s.noticeRadius || distance(other.pos, target) <= s.noticeRadius) continue;
    today.noticed.push(c.id);
    say(sim, c.id, 'moment_notice', { partner: other.name });
  }
}

/**
 * La bête aux aguets (`watch.freeze`, la chevrette): qui bouge à moins de `noticeRadius` pendant
 * un regard, ou passe sous `watch.minRadius`, l'effarouche; elle recule, broute, revient (pose
 * tirée de `today.shyUntil` par `freezeState`), jamais ne s'enfuit. Rend l'état de ce pas.
 */
function updateFreeze(sim: Sim, def: MomentDef, today: MomentToday, w: MomentWatch, target: Vec2): FreezeState | null {
  const freeze = w.freeze;
  if (freeze === null) return null;
  const { world } = sim;
  const state = freezeState(def, freeze, today, world.tick, world.seed);
  if (state.kind === 'startled') return state;
  const s = sim.content.settings.moments;
  const startles = world.characters.some((c) => {
    if (c.inHouse || !c.created) return false;
    const d = distance(c.pos, target);
    if (d < w.minRadius) return true;
    return state.kind === 'look' && d <= s.noticeRadius && c.speed >= s.stillSpeed;
  });
  if (!startles) return state;
  today.shyUntil = world.tick + startleTicks(freeze);
  today.watchTicks = 0;
  sim.runtime.changed = true;
  if (freeze.startleText !== null) notifyKey(sim, 'both', 'message', freeze.startleText);
  return freezeState(def, freeze, today, world.tick, world.seed);
}

/** Un joueur trop près: l'animal se redresse ou recule, jamais ne s'enfuit (section 1.2, cas limites). */
function updateShy(sim: Sim, def: MomentDef, today: MomentToday): void {
  for (const actor of def.actors) {
    if (actor.shy === null) continue;
    const at = restPosition(sim.map, actor);
    const near = sim.world.characters.some((c) => !c.inHouse && distance(c.pos, at) < (actor.shy?.distance ?? 0));
    if (!near) continue;
    const until = sim.world.tick + Math.round(actor.shy.returnAfterSeconds * SIM_HZ);
    // Prolongée une fois par seconde au plus: l'état ne change pas à chaque pas.
    if (until - today.shyUntil >= SIM_HZ) {
      today.shyUntil = until;
      sim.runtime.changed = true;
    }
  }
}

/**
 * On ne traverse pas une bête: les joueurs sont repoussés hors de son rayon de collision, où
 * qu'elle soit dessinée (QA7-02): à son point, à l'arrivée, effarouchée, pendant l'apogée, le
 * départ et l'état d'après. Une bête qui marche écarte le joueur de côté, perpendiculairement à
 * son trajet, au lieu de le pousser devant elle.
 */
function pushOut(sim: Sim, def: MomentDef, today: MomentToday): void {
  if (today.phase === 'absent' || today.phase === 'gone') return;
  const { world } = sim;
  let b: Blockers | null = null;
  const blockers = (): Blockers => (b ??= refreshBlockers(sim));
  for (const actor of def.actors) {
    if (actor.collisionRadius <= 0) continue;
    const reach = actor.collisionRadius + BODY;
    const rest = restPosition(sim.map, actor);
    const waiting = today.phase === 'waiting';
    if (waiting) {
      // Autour de son point, la bête bouge (QA6-04): le renard mulote dans `roam`, le héron
      // effarouché recule jusqu'à `shy.stepTo`. La zone repoussée couvre ces déplacements.
      const stepTo = actor.shy?.stepTo ?? null;
      for (const c of world.characters) {
        if (c.inHouse) continue;
        const from = stepTo === null ? rest : closestOnSegment(c.pos, rest, { x: stepTo[0], y: stepTo[1] });
        radialPush(blockers, c.pos, from, reach + actor.roam);
      }
    }
    const at = drawnPose(sim.map, def, today, actor, world.tick, world.seed, 0);
    // En vol (le héron, les oies), la bête passe au-dessus des têtes.
    if (at === null || at.z > AIRBORNE) continue;
    if (waiting && Math.abs(at.x - rest.x) < 1e-6 && Math.abs(at.y - rest.y) < 1e-6) continue;
    const prev = drawnPose(sim.map, def, today, actor, world.tick, world.seed, 1);
    const vx = prev === null ? 0 : at.x - prev.x;
    const vy = prev === null ? 0 : at.y - prev.y;
    const speed = Math.hypot(vx, vy);
    for (const c of world.characters) {
      if (c.inHouse || distance(c.pos, at) >= reach) continue;
      if (speed > MOVING && sideStep(blockers(), c.pos, at, vx / speed, vy / speed, reach)) continue;
      radialPush(blockers, c.pos, at, reach);
    }
  }
}

/** Repousse `pos` droit devant lui, à `reach` de `from`. */
function radialPush(blockers: () => Blockers, pos: Vec2, from: Vec2, reach: number): void {
  const d = distance(pos, from);
  if (d >= reach) return;
  const nx = d < 1e-6 ? 1 : (pos.x - from.x) / d;
  const ny = d < 1e-6 ? 0 : (pos.y - from.y) / d;
  moveBody(blockers(), pos, nx * (reach - d), ny * (reach - d));
}

/**
 * Écarte `pos` de côté du trajet d'une bête qui marche (sens `ux`, `uy`) jusqu'à `reach` de
 * `at`, du côté où il se trouve (l'autre si ce côté est bouché). Faux si rien n'a pu bouger.
 */
function sideStep(b: Blockers, pos: Vec2, at: Vec2, ux: number, uy: number, reach: number): boolean {
  const rx = pos.x - at.x;
  const ry = pos.y - at.y;
  const along = rx * ux + ry * uy;
  const across = rx * -uy + ry * ux;
  const need = Math.sqrt(Math.max(0, reach * reach - along * along)) - Math.abs(across);
  if (need <= 0) return true;
  const first = across >= 0 ? 1 : -1;
  for (const side of [first, -first]) {
    const x = pos.x;
    const y = pos.y;
    // De l'autre côté, il faut repasser le trajet: toute la largeur, plus l'écart actuel.
    const step = side === first ? need : need + 2 * Math.abs(across);
    moveBody(b, pos, -uy * side * step, ux * side * step);
    if (Math.hypot(pos.x - x, pos.y - y) >= step * 0.9) return true;
    pos.x = x;
    pos.y = y;
  }
  return false;
}

/** Point du segment [a, b] le plus proche de p. */
function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy;
  const u = length2 < 1e-12 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2));
  return { x: a.x + dx * u, y: a.y + dy * u };
}

/** Rayon du corps d'un personnage pour la collision avec une bête (m). */
const BODY = 0.3;
/** Au-dessus de cette hauteur (m), une bête vole et ne repousse personne. */
const AIRBORNE = 0.6;
/** Déplacement d'une bête en un pas (m) au-delà duquel elle marche: elle écarte de côté. */
const MOVING = 1e-4;

/** Si une quête de moment démarre en cours de journée sans moment ce jour-là, son moment arrive. */
function attachQuestMoment(sim: Sim): void {
  if (sim.world.moments.today !== null) return;
  const tiers = sim.content.settings.moments.tiers;
  for (const def of sim.content.moments) {
    if (!tiers.includes(def.tier) || def.mode === 'ambient' || questState(sim, def.quest)?.status !== 'active') continue;
    sim.world.moments.today = newToday(sim, def, 'quest');
    sim.runtime.changed = true;
    return;
  }
}

/** Un pas des moments (journée seulement). */
export function updateMoments(sim: Sim): void {
  const { world } = sim;
  if (world.phase !== 'day') return;
  attachQuestMoment(sim);
  const today = world.moments.today;
  if (today === null) return;
  const def = momentDef(sim.content, today.id);
  if (def === null) return;
  const m = minutes(sim);
  switch (today.phase) {
    case 'absent': {
      const questOk = today.origin === 'ambient' || questState(sim, def.quest)?.status === 'active';
      if (questOk && m >= def.present.from && m < def.present.to) {
        enter(sim, today, 'waiting');
        emit(sim, { type: 'moment_waiting', moment: def.id });
      }
      break;
    }
    case 'waiting': {
      // Lanternes et salut (tour 9): sans apogée à la fin de la fenêtre, Firmin allume lui-même, le train part comme d'habitude.
      const w = activeWatch(def, today);
      const closesAtWindow = w.syncPress !== null || (w.arm !== null && (today.armedTick ?? null) === null);
      if (today.origin === 'quest' && questState(sim, def.quest)?.status !== 'active') enter(sim, today, 'gone');
      else if (m >= def.present.to || (closesAtWindow && m >= def.window.to)) leaveNow(sim, def, today);
      else updateWaiting(sim, def, today);
      break;
    }
    case 'climax': {
      const arm = activeWatch(def, today).arm;
      const before = today.elapsed;
      updateClimax(sim, def, today);
      // Les lisses remontent seules (`liftAt`): les cases de la traversée se rouvrent.
      const phase: string = today.phase;
      if (arm !== null && (before < arm.liftAt) !== (phase === 'climax' && today.elapsed < arm.liftAt)) sim.runtime.dynamicDirty = true;
      break;
    }
    case 'after':
      if (m >= def.present.to) leaveNow(sim, def, today);
      break;
    case 'left':
      today.elapsed += SIM_DT;
      if (today.elapsed >= (def.leave?.seconds ?? 0)) enter(sim, today, 'gone');
      break;
    case 'gone':
      break;
  }
  pushOut(sim, def, today);
}

// ---------------------------------------------------------------------------
// Geste « tenir » (l'échelle)

/** Le moment du jour attend-il qu'on tienne ses places (attente, ou apogée qui se fige si on lâche) ? */
function holdMoment(sim: Sim): { def: MomentDef; today: MomentToday; places: string[] } | null {
  const today = sim.world.moments.today;
  if (today === null || (today.phase !== 'waiting' && today.phase !== 'climax')) return null;
  const def = momentDef(sim.content, today.id);
  if (def === null) return null;
  const places = activeWatch(def, today).hold;
  // Pendant l'apogée, la quête est déjà finie (la récompense part au début): on tient quand même.
  if (places === null || (today.phase === 'waiting' && !questStepReady(sim, def, today))) return null;
  return { def, today, places };
}

/** Place de l'échelle à portée de ce joueur (libre ou prise par l'autre), la plus proche. */
export function holdPlaceNear(sim: Sim, c: Character): { point: string; taken: boolean } | null {
  const hm = holdMoment(sim);
  if (hm === null || c.holding !== null || c.inHouse || c.seat !== null) return null;
  const range = sim.content.settings.moments.holdRange;
  let best: { point: string; taken: boolean; d: number } | null = null;
  for (const id of hm.places) {
    const at = sim.map.points[id];
    if (at === undefined) continue;
    const d = distance(c.pos, at);
    if (d > range || (best !== null && d >= best.d)) continue;
    const taken = sim.world.characters.some((o) => o.id !== c.id && o.holding === id);
    best = { point: id, taken, d };
  }
  return best === null ? null : { point: best.point, taken: best.taken };
}

/** Prendre une place: le personnage s'y place, face à l'échelle. Une place prise ne se prend pas. */
export function takeHold(sim: Sim, c: Character, place: string): void {
  if (sim.world.characters.some((o) => o.id !== c.id && o.holding === place)) {
    say(sim, c.id, 'ladder_hold_taken', { partner: partnerName(sim, c.id) });
    return;
  }
  const hm = holdMoment(sim);
  const at = point(sim, place);
  const face = hm === null ? null : sim.map.points[hm.def.anchor];
  stopPath(sim, c);
  c.pos.x = at.x;
  c.pos.y = at.y;
  // Face au montant de l'échelle (cap de la place), sinon vers le point du moment.
  const heading = sim.map.pointFacings[place];
  if (heading !== undefined) c.facing = heading;
  else if (face !== undefined && face !== null) c.facing = Math.atan2(face.y - at.y, face.x - at.x);
  c.holding = place;
  c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  sim.runtime.changed = true;
  emit(sim, { type: 'hold_started', by: c.id, point: place });
}

export function releaseHold(sim: Sim, c: Character): void {
  if (c.holding === null) return;
  const place = c.holding;
  c.holding = null;
  sim.runtime.changed = true;
  emit(sim, { type: 'hold_released', by: c.id, point: place });
}

/** Toute direction lâche l'échelle (avant de marcher, au même pas). */
export function releaseHoldsOnMove(sim: Sim, controls: Partial<Record<CharacterId, ControlFrame>>): void {
  for (const c of sim.world.characters) {
    const f = controls[c.id];
    if (c.holding !== null && f !== undefined && Math.hypot(f.moveX, f.moveY) >= MOVE_DEADZONE) releaseHold(sim, c);
  }
}

/** Après les déplacements: on lâche si l'on a quitté sa place (clic au loin), une conversation ou la journée. */
export function updateHolds(sim: Sim): void {
  for (const c of sim.world.characters) {
    if (c.holding === null) continue;
    const at = sim.map.points[c.holding];
    const away = at === undefined || distance(c.pos, at) > 0.3;
    if (away || c.status !== 'active' || holdMoment(sim) === null) releaseHold(sim, c);
  }
}
