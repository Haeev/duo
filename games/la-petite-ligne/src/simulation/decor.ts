/**
 * Gestes des joueurs avec le décor (0.13, lot H7, section 7.1 de `v0-13-habitants.md`): les 30
 * appuis sur Agir, Maintenir ou Examiner devant un objet de la carte. Les gestes sont des données
 * (`vie.json`, `gestures[]`, lues par `donnees/vie-gestes.ts`); ce module les joue.
 *
 * Tout est décidé par l'hôte: l'invité envoie `act`, `examine` et `actHeld` comme pour le reste, et
 * voit la même chose (geste du personnage dans `Character.action`, événements, notifications,
 * drapeaux du monde). Ce qui n'a pas besoin d'être sauvegardé (repos entre deux gestes, répliques
 * déjà dites, jauge en cours) vit dans `DecorRuntime`, hors de l'état; ce qui se voit des deux
 * côtés et doit survivre à une reprise (cierges allumés, initiales gravées, fleurs sur les tombes)
 * est un drapeau du monde, `nom@jour` quand il expire (le dernier jour où il compte).
 */
import type { DecorGestureDef, DecorLineDef } from '../donnees/vie-gestes';
import { unitDraw } from '../etat/tirage';
import type { ActionKind, Character, CharacterId, Vec2 } from '../etat/types';
import { AIM_CONE, MOVE_DEADZONE, SIM_DT } from './constantes';
import { evaluateAll, NO_CONTEXT } from './conditions';
import {
  type Sim,
  bump,
  character,
  distance,
  emit,
  notify,
  partnerOf,
  secondsToTicks,
} from './contexte';
import { addBond } from './amitie';
import { addHeart, durationMultiplier } from './besoins';
import { toolKindOf } from './catalogue';
import { refill } from './potager';
import { addToBag, heldStack, takeFromBag } from './sac';

/** Le clip d'un geste de décor, en action de la simulation (`rendu/gestes.ts` donne le clip joué). */
export const ACTION_FOR_CLIP: Readonly<Record<string, ActionKind>> = {
  pickup: 'decor_lean',
  hammer_tap: 'decor_tap',
  crank_turn: 'decor_crank',
  give: 'decor_offer',
  look_up: 'decor_look',
  reach_up: 'decor_reach',
  pet: 'decor_pet',
  wave: 'decor_wave',
  drink: 'decor_drink',
  sit_ground: 'decor_sit',
};

/** Pas sans appui tenu avant de compter le relâchement (une commande en retard chez l'invité n'en est pas un). */
const RELEASE_TICKS = 4;
/** Le maintien d'un geste de décor ne se prend que tourné vers lui, comme la visée. */
const FACING_CONE = AIM_CONE;
/** Déplacement qui interrompt un geste où l'on reste (m). */
const DWELL_MOVE = 0.4;
/** Un habitant « présent » est à moins de (m). */
const VILLAGER_PRESENT_RANGE = 6;
/** Fenêtre d'un appui tenu: en dessous, c'est un appui, pas un maintien (s). */
const MIN_CHARGE_SECONDS = 0.15;
/** Jours d'une semaine du calendrier. */
const WEEK = 7;

interface HoldState {
  gesture: string;
  since: number;
  firedAt: number | null;
  /** Dernier pas où l'appui était tenu. */
  lastHeld: number;
}

interface DwellState {
  gesture: string;
  since: number;
  from: Vec2;
}

interface RhythmState {
  gesture: string;
  count: number;
  last: number;
}

/** Un événement qui part plus tard (les rebonds d'un galet, une volée de cloches). */
interface Scheduled {
  tick: number;
  fire: () => void;
}

/** État de travail des gestes de décor, hors de l'état du monde. */
export interface DecorRuntime {
  /** `perso:geste` -> pas avant lequel le geste ne produit plus rien. */
  next: Map<string, number>;
  /** `perso:geste` -> dernier pas où il a vraiment été joué (variante à deux). */
  last: Map<string, number>;
  /** `perso:réplique` -> dernier pas où elle a été dite (la moins récente passe). */
  said: Map<string, number>;
  /** `perso:clé` -> compteur de pages ou de regards. */
  turns: Map<string, number>;
  holds: Record<CharacterId, HoldState | null>;
  dwells: Record<CharacterId, DwellState | null>;
  rhythms: Record<CharacterId, RhythmState | null>;
  queue: Scheduled[];
  /** Dernier jour vu (ménage des drapeaux expirés). */
  day: number;
  /** Abris déjà annoncés sous cette pluie: `jour:geste:point`. */
  sheltered: Set<string>;
  /** Dernier pas où chaque joueur a bougé (rester sous l'abri). */
  stillSince: Record<CharacterId, number>;
}

const runtimes = new WeakMap<object, DecorRuntime>();

export function decorRuntime(sim: Sim): DecorRuntime {
  let r = runtimes.get(sim.runtime);
  if (r === undefined) {
    r = {
      next: new Map(),
      last: new Map(),
      said: new Map(),
      turns: new Map(),
      holds: { p1: null, p2: null },
      dwells: { p1: null, p2: null },
      rhythms: { p1: null, p2: null },
      queue: [],
      day: sim.world.clock.day,
      sheltered: new Set(),
      stillSince: { p1: 0, p2: 0 },
    };
    runtimes.set(sim.runtime, r);
  }
  return r;
}

// ---------------------------------------------------------------------------
// Lieux et disponibilité

/** Un lieu de geste: une position de la carte et le geste qu'on y fait. */
interface Place {
  def: DecorGestureDef;
  pos: Vec2;
}

function gesturesOf(sim: Sim): readonly DecorGestureDef[] {
  return sim.content.village.gestures;
}

function placesOf(sim: Sim, def: DecorGestureDef): Place[] {
  const out: Place[] = [];
  for (const id of def.points) {
    const at = sim.map.points[id];
    if (at !== undefined) out.push({ def, pos: at });
  }
  for (const s of def.spots) out.push({ def, pos: { x: s.x, y: s.y } });
  return out;
}

function reachOf(sim: Sim, def: DecorGestureDef): number {
  return def.reach ?? sim.content.settings.ranges.action;
}

function facingPoint(c: Character, pos: Vec2): boolean {
  const d = distance(c.pos, pos);
  if (d < 0.6) return true;
  const angle = Math.atan2(pos.y - c.pos.y, pos.x - c.pos.x);
  let diff = Math.abs(angle - c.facing) % (2 * Math.PI);
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return diff <= FACING_CONE;
}

function counterToday(sim: Sim, c: Character, def: DecorGestureDef): number {
  return sim.world.countersToday[c.id][`decor:${def.id}`] ?? 0;
}

/** Drapeau du monde portant un jour de fin (`nom@jour`), ou son nom simple. */
function flagName(name: string, c: Character | null, until: number | null): string {
  const named = c === null ? name : name.replaceAll('{by}', c.id);
  return until === null ? named : `${named}@${String(until)}`;
}

function hasFlag(sim: Sim, name: string): boolean {
  const day = sim.world.clock.day;
  return sim.world.flags.some((f) => {
    if (f === name) return true;
    if (!f.startsWith(`${name}@`)) return false;
    return Number(f.slice(name.length + 1)) >= day;
  });
}

function setFlag(sim: Sim, name: string): void {
  if (!sim.world.flags.includes(name)) {
    sim.world.flags.push(name);
    sim.runtime.changed = true;
  }
}

/** Le geste est-il possible pour ce joueur maintenant (conditions du monde, objet en main, habitant là, limites du jour)? */
export function decorAvailable(sim: Sim, c: Character, def: DecorGestureDef): boolean {
  if (!evaluateAll(sim, def.when, { ...NO_CONTEXT, actor: c.id })) return false;
  if (def.rain && sim.world.weather !== 'rain') return false;
  if (def.onceFlag !== null && hasFlag(sim, flagName(def.onceFlag, c, null))) return false;
  if (def.perDay > 0 && counterToday(sim, c, def) >= def.perDay) return false;
  if (def.heldItems.length > 0 && !def.heldItems.some((i) => heldStack(c)?.item === i))
    return false;
  if (def.villagerPresent !== null && !villagerNear(sim, c, def.villagerPresent)) return false;
  if (def.cost > 0 && sim.world.purse < def.cost) return false;
  return true;
}

function villagerNear(sim: Sim, c: Character, id: string): boolean {
  const v = sim.world.villagers.find((x) => x.id === id);
  return v !== undefined && v.visible && distance(c.pos, v.pos) <= VILLAGER_PRESENT_RANGE;
}

// ---------------------------------------------------------------------------
// Cibles pour la visée (agir.ts)

/** Ce qu'un joueur peut viser: le geste principal du lieu (Agir ou Examiner), ou à défaut son maintien. */
export interface DecorTarget {
  gesture: string;
  pos: Vec2;
  label: string;
  /** Rien d'un appui à ce lieu: seulement un geste qu'on tient. */
  holdOnly: boolean;
}

/**
 * Les gestes à portée de ce joueur, un par lieu. Au même lieu, un appui prend le geste d'Agir
 * ou d'Examiner (les regards se relaient: registre, puis horaire); le maintien seul se montre
 * quand il n'y a rien d'autre.
 */
export function decorTargets(
  sim: Sim,
  c: Character,
  around: { at: Vec2; radius: number } | null = null,
): DecorTarget[] {
  const out: DecorTarget[] = [];
  const byPos = new Map<string, Place[]>();
  for (const def of gesturesOf(sim)) {
    if (!decorAvailable(sim, c, def)) continue;
    for (const place of placesOf(sim, def)) {
      if (
        around === null
          ? distance(c.pos, place.pos) > reachOf(sim, def)
          : distance(around.at, place.pos) > around.radius
      )
        continue;
      const key = `${place.pos.x}:${place.pos.y}`;
      const list = byPos.get(key);
      if (list === undefined) byPos.set(key, [place]);
      else list.push(place);
    }
  }
  const rt = decorRuntime(sim);
  for (const places of byPos.values()) {
    const taps = places.filter((p) => p.def.verb !== 'hold');
    const pool = taps.length > 0 ? taps : places;
    const turn = rt.turns.get(`${c.id}:look:${pool[0]?.pos.x ?? 0}:${pool[0]?.pos.y ?? 0}`) ?? 0;
    const place = pool[turn % pool.length];
    if (place !== undefined)
      out.push({
        gesture: place.def.id,
        pos: place.pos,
        label: place.def.label,
        holdOnly: taps.length === 0,
      });
  }
  return out;
}

export function decorDef(sim: Sim, id: string): DecorGestureDef | undefined {
  return gesturesOf(sim).find((d) => d.id === id);
}

// ---------------------------------------------------------------------------
// Jouer un geste

function weekOf(sim: Sim): number {
  return Math.floor((sim.world.clock.day - 1) / WEEK);
}

function lineAllowed(sim: Sim, c: Character, line: DecorLineDef, tag: string | null): boolean {
  if (line.tag !== tag) return false;
  if (line.near !== null && !villagerNear(sim, c, line.near)) return false;
  return evaluateAll(sim, line.when, { ...NO_CONTEXT, actor: c.id });
}

/**
 * La réplique du geste: la moins récemment dite par ce joueur (section 7.0), ou celle de la
 * semaine, ou la suivante. `null` quand aucune ne convient: le geste se joue sans réplique.
 */
function pickLine(
  sim: Sim,
  c: Character,
  def: DecorGestureDef,
  lines: readonly DecorLineDef[],
  tag: string | null,
): string | null {
  const rt = decorRuntime(sim);
  const pool = lines.filter((l) => lineAllowed(sim, c, l, tag));
  if (pool.length === 0) return null;
  if (def.pick === 'week') return pool[weekOf(sim) % pool.length]?.text ?? null;
  if (def.pick === 'cycle') {
    const key = `${c.id}:cycle:${def.id}`;
    const n = rt.turns.get(key) ?? 0;
    rt.turns.set(key, n + 1);
    return pool[n % pool.length]?.text ?? null;
  }
  // Jamais la même deux fois de suite dans les sept jours tant qu'une autre attend (réserve de 4 à 8).
  let best: DecorLineDef | null = null;
  let bestAt = Number.POSITIVE_INFINITY;
  for (const l of pool) {
    const at = rt.said.get(`${c.id}:${l.text}`) ?? -1;
    if (at < bestAt) {
      best = l;
      bestAt = at;
    }
  }
  if (best === null) return null;
  rt.said.set(`${c.id}:${best.text}`, sim.world.tick);
  return best.text;
}

function say(sim: Sim, c: Character, def: DecorGestureDef, text: string): void {
  notify(sim, c.id, 'message', text, { key: `decor_${def.id}` });
}

function actionFor(clip: string | null): ActionKind | null {
  return clip === null ? null : (ACTION_FOR_CLIP[clip] ?? null);
}

function startClip(sim: Sim, c: Character, def: DecorGestureDef, pos: Vec2, seconds: number): void {
  const kind = actionFor(def.clip);
  if (kind === null) return;
  const duration = secondsToTicks(seconds * durationMultiplier(sim, c));
  c.action = { kind, since: sim.world.tick, duration, target: { x: pos.x, y: pos.y } };
  sim.runtime.changed = true;
}

function face(c: Character, pos: Vec2): void {
  c.facing = Math.atan2(pos.y - c.pos.y, pos.x - c.pos.x);
}

function emitSound(sim: Sim, c: Character, def: DecorGestureDef, at: Vec2): void {
  if (def.event !== null) emit(sim, { type: def.event, by: c.id, at: { x: at.x, y: at.y } });
  else if (def.sound !== null)
    emit(sim, {
      type: 'decor_gesture',
      gesture: def.id,
      by: c.id,
      at: { x: at.x, y: at.y },
      sound: def.sound,
    });
}

function schedule(sim: Sim, seconds: number, fire: () => void): void {
  decorRuntime(sim).queue.push({ tick: sim.world.tick + secondsToTicks(seconds), fire });
}

function plural(n: number, one: string, many: string): string {
  return n > 1 ? many : one;
}

/**
 * Joue le geste `def` pour `c` au lieu `pos`. `tag` choisit les répliques étiquetées (résultat
 * d'un lancer, d'un regard); `score` est le résultat d'un lancer (rebonds, quilles).
 */
function play(
  sim: Sim,
  c: Character,
  def: DecorGestureDef,
  pos: Vec2,
  tag: string | null = null,
  score = 0,
): void {
  const rt = decorRuntime(sim);
  const tick = sim.world.tick;
  const key = `${c.id}:${def.id}`;
  face(c, pos);
  // Le repos entre deux gestes: la main reste sur l'objet, muette (la cloche du quai).
  const waitUntil = rt.next.get(key) ?? 0;
  if (tick < waitUntil) {
    startClip(sim, c, def, pos, def.clipSeconds);
    return;
  }
  rt.next.set(key, tick + secondsToTicks(def.cooldownSeconds));
  startClip(sim, c, def, pos, def.clipSeconds);
  const first = counterToday(sim, c, def) === 0;
  bump(sim, `decor:${def.id}`, c.id);

  // Objet en main consommé, bourse, effets sur le joueur.
  if (def.heldItems.length > 0) {
    const held = heldStack(c);
    if (held !== null) takeFromBag(c, held.item, 1, held.quality);
  }
  if (def.cost > 0) sim.world.purse -= Math.min(sim.world.purse, def.cost);
  if (first || def.effectsEvery) {
    if (def.rest > 0) c.endurance = Math.min(c.enduranceMax, c.endurance + def.rest);
    if (def.heart > 0) addHeart(sim, c, def.heart);
    if (def.bond !== null) bondOnce(sim, c, def);
  }
  if (def.find !== null) findOne(sim, c, def);
  if (def.fillCan && toolKindOf(sim, heldStack(c)?.item) === 'watering_can')
    refill(sim, c, def.points[0] ?? def.id);

  // Drapeaux: pour toujours, ou jusqu'à `flagDays` jours.
  if (def.setFlag !== null) {
    const until = def.flagDays > 0 ? sim.world.clock.day + def.flagDays - 1 : null;
    setFlag(sim, flagName(def.setFlag, c, until));
  }
  if (def.onceFlag !== null)
    setFlag(
      sim,
      flagName(def.onceFlag, c, def.flagDays > 0 ? sim.world.clock.day + def.flagDays - 1 : null),
    );

  const together = togetherWith(sim, c, def);
  // L'accord remplace la note quand l'autre joue en même temps.
  if (together !== null && def.duo?.event !== null && def.duo?.event !== undefined) {
    emit(sim, { type: def.duo.event, by: c.id, at: { x: pos.x, y: pos.y } });
  } else {
    emitSound(sim, c, def, pos);
  }
  if (def.then !== null) {
    const then = def.then;
    schedule(sim, then.seconds, () => { emit(sim, { type: then.event, by: c.id, at: { x: pos.x, y: pos.y } }); },
    );
  }
  if (def.kind === 'charge') bounces(sim, c, def, pos, score);

  rt.last.set(key, tick);
  if (together !== null) {
    playTogether(sim, c, def, pos, together);
    return;
  }
  // Un maintien répété (le battoir) ne parle qu'à certains coups.
  const strokeKey = `${c.id}:strokes:${def.id}`;
  const stroke = rt.turns.get(strokeKey) ?? 0;
  rt.turns.set(strokeKey, stroke + 1);
  if (stroke % def.lineEvery !== 0) return;
  const line = pickLine(sim, c, def, def.lines, tag);
  if (line !== null) say(sim, c, def, line.replaceAll('{n}', String(score)));
}

/** L'autre a-t-il fait le même geste assez récemment pour que ce soit « à deux » ? */
function togetherWith(sim: Sim, c: Character, def: DecorGestureDef): Character | null {
  if (def.duo === null) return null;
  const other = character(sim, partnerOf(c.id));
  const at = decorRuntime(sim).last.get(`${other.id}:${def.id}`);
  if (at === undefined || sim.world.tick - at > secondsToTicks(def.duo.windowSeconds)) return null;
  return other;
}

function playTogether(
  sim: Sim,
  c: Character,
  def: DecorGestureDef,
  pos: Vec2,
  other: Character,
): void {
  const duo = def.duo;
  if (duo === null) return;
  emit(sim, { type: 'decor_together', gesture: def.id, by: c.id, at: { x: pos.x, y: pos.y } });
  const line = pickLine(sim, c, def, duo.lines, null);
  for (const who of [c, other]) {
    if (line !== null) say(sim, who, def, line);
    if (duo.heart > 0 && who.created && counterTogetherToday(sim, who, def) === 0) {
      bump(sim, `decor_together:${def.id}`, who.id);
      addHeart(sim, who, duo.heart);
    }
  }
  if (duo.memory !== null && !hasFlag(sim, `decor_memory:${def.id}`)) {
    setFlag(sim, `decor_memory:${def.id}`);
    notify(sim, 'both', 'message', duo.memory, { key: `decor_memory_${def.id}` });
  }
}

function counterTogetherToday(sim: Sim, c: Character, def: DecorGestureDef): number {
  return sim.world.countersToday[c.id][`decor_together:${def.id}`] ?? 0;
}

/** Le lien gagné avec l'habitant, une fois par semaine et par geste. */
function bondOnce(sim: Sim, c: Character, def: DecorGestureDef): void {
  if (def.bond === null) return;
  const flag = `decor_bond:${def.id}:${c.id}:${String(weekOf(sim))}`;
  if (sim.world.flags.includes(flag)) return;
  setFlag(sim, flag);
  addBond(sim, def.bond.villager, def.bond.amount, c.id);
}

/** Une trouvaille: une chance sur `oneIn`, tirée par la graine, au plus une par geste et par jour. */
function findOne(sim: Sim, c: Character, def: DecorGestureDef): void {
  if (def.find === null) return;
  const day = sim.world.clock.day;
  const flag = `decor_find:${def.id}:${c.id}:${String(day)}`;
  if (sim.world.flags.includes(flag)) return;
  setFlag(sim, flag);
  if (unitDraw(sim.world.seed, `deco:${def.id}:${c.id}`, day) * def.find.oneIn >= 1) return;
  if (sim.content.items[def.find.item] === undefined) return;
  addToBag(sim, c, def.find.item, 'ordinary', def.find.count);
}

/** Les rebonds d'un galet, ou les quilles : un événement par rebond, espacés (le son part de chaque `at`). */
function bounces(sim: Sim, c: Character, def: DecorGestureDef, pos: Vec2, score: number): void {
  if (def.event !== 'skim_stone') return;
  const dx = pos.x - c.pos.x;
  const dy = pos.y - c.pos.y;
  const len = Math.hypot(dx, dy) || 1;
  for (let i = 0; i < score; i++) {
    // Chaque rebond est plus loin et plus rapproché que le précédent.
    const gap = 0.9 + 0.6 * i;
    const spot = {
      x: pos.x + (dx / len) * gap * (i + 1) * 0.5,
      y: pos.y + (dy / len) * gap * (i + 1) * 0.5,
    };
    const delay = 0.15 + i * 0.22 - i * i * 0.012;
    schedule(sim, delay, () => { emit(sim, { type: 'skim_stone', by: c.id, at: spot }); });
  }
}

// ---------------------------------------------------------------------------
// Entrées: Agir / Examiner (un appui)

/** Un appui sur le geste visé (Espace, clic, X): le lance, ou dit comment le tenir. */
export function performDecor(sim: Sim, c: Character, gestureId: string, pos: Vec2): void {
  const def = decorDef(sim, gestureId);
  if (def === undefined) return;
  const rt = decorRuntime(sim);
  // Le regard suivant au même lieu prend le geste suivant (registre, puis horaire).
  const lookKey = `${c.id}:look:${pos.x}:${pos.y}`;
  rt.turns.set(lookKey, (rt.turns.get(lookKey) ?? 0) + 1);
  if (def.verb === 'hold') {
    if (def.kind !== 'charge') face(c, pos);
    notify(sim, c.id, 'message', holdHint(def), { key: `decor_hold_${def.id}` });
    return;
  }
  switch (def.kind) {
    case 'rhythm':
      rhythmStep(sim, c, def, pos);
      return;
    case 'dwell':
      startDwell(sim, c, def, pos);
      return;
    case 'forecast':
      forecast(sim, c, def, pos);
      return;
    case 'together':
      togetherStep(sim, c, def, pos);
      return;
    case 'plain':
    case 'charge':
    case 'pages':
      play(sim, c, def, pos);
  }
}

function holdHint(def: DecorGestureDef): string {
  return def.kind === 'charge'
    ? `${def.label}: garde la touche enfoncée, puis relâche.`
    : `${def.label}: garde la touche enfoncée.`;
}

/** La touche Examiner (X): lit le geste d'examen à portée, s'il y en a un. Vrai si c'en était un. */
export function examineDecor(sim: Sim, c: Character): boolean {
  let best: { target: DecorTarget; def: DecorGestureDef; d: number } | null = null;
  for (const t of decorTargets(sim, c)) {
    const def = decorDef(sim, t.gesture);
    if (def?.verb !== 'examine') continue;
    const d = distance(c.pos, t.pos);
    if (d < (best?.d ?? Number.POSITIVE_INFINITY)) best = { target: t, def, d };
  }
  if (best === null) return false;
  performDecor(sim, c, best.def.id, best.target.pos);
  return true;
}

// ---------------------------------------------------------------------------
// Mécaniques

function rhythmStep(sim: Sim, c: Character, def: DecorGestureDef, pos: Vec2): void {
  const rt = decorRuntime(sim);
  const tick = sim.world.tick;
  const state = rt.rhythms[c.id];
  const inTime =
    state !== null &&
    state.gesture === def.id &&
    tick - state.last <= secondsToTicks(def.rhythmSeconds);
  face(c, pos);
  startClip(sim, c, def, pos, def.clipSeconds);
  if (state !== null && state.gesture === def.id && !inTime) {
    // Raté: un seul pied, on reprend du début au prochain appui.
    rt.rhythms[c.id] = null;
    const line = pickLine(sim, c, def, def.lines, 'fail');
    if (line !== null) say(sim, c, def, line);
    return;
  }
  const count = (state?.count ?? 0) + 1;
  emitSound(sim, c, def, pos);
  if (count >= def.rhythmSteps) {
    rt.rhythms[c.id] = null;
    play(sim, c, def, pos, 'win');
    return;
  }
  rt.rhythms[c.id] = { gesture: def.id, count, last: tick };
}

function startDwell(sim: Sim, c: Character, def: DecorGestureDef, pos: Vec2): void {
  const rt = decorRuntime(sim);
  face(c, pos);
  const kind = actionFor(def.clip);
  if (kind !== null)
    c.action = { kind, since: sim.world.tick, duration: 0, target: { x: pos.x, y: pos.y } };
  rt.dwells[c.id] = { gesture: def.id, since: sim.world.tick, from: { x: c.pos.x, y: c.pos.y } };
  sim.runtime.changed = true;
}

function forecast(sim: Sim, c: Character, def: DecorGestureDef, pos: Vec2): void {
  const rt = decorRuntime(sim);
  const day = sim.world.clock.day;
  const key = `${c.id}:forecast:${String(day)}`;
  const used = rt.turns.get(key) ?? 0;
  rt.turns.set(key, used + 1);
  if (used > 0) {
    face(c, pos);
    startClip(sim, c, def, pos, def.clipSeconds);
    const line = pickLine(sim, c, def, def.lines, 'again');
    if (line !== null) say(sim, c, def, line);
    return;
  }
  // Juste quatre fois sur cinq: sinon, le coq se trompe de temps.
  const actual = sim.world.weatherTomorrow;
  const wrong = unitDraw(sim.world.seed, 'weathervane', day) < 0.2;
  const kinds = ['sunny', 'cloudy', 'rain'] as const;
  const shown = wrong
    ? (kinds[
        (kinds.indexOf(actual) +
          1 +
          Math.floor(unitDraw(sim.world.seed, 'weathervane_alt', day) * 2)) %
          3
      ] ?? actual)
    : actual;
  play(sim, c, def, pos, shown);
}

function togetherStep(sim: Sim, c: Character, def: DecorGestureDef, pos: Vec2): void {
  const rt = decorRuntime(sim);
  const tick = sim.world.tick;
  const other = character(sim, partnerOf(c.id));
  const key = `${c.id}:${def.id}`;
  face(c, pos);
  startClip(sim, c, def, pos, def.clipSeconds);
  rt.last.set(key, tick);
  const window = secondsToTicks(def.duo?.windowSeconds ?? 5);
  const at = rt.last.get(`${other.id}:${def.id}`);
  if (
    at !== undefined &&
    tick - at <= window &&
    distance(other.pos, pos) <= reachOf(sim, def) + 2
  ) {
    rt.last.delete(key);
    rt.last.delete(`${other.id}:${def.id}`);
    emit(sim, { type: 'decor_together', gesture: def.id, by: c.id, at: { x: pos.x, y: pos.y } });
    emitSound(sim, c, def, pos);
    bump(sim, `decor:${def.id}`, c.id);
    if (def.setFlag !== null) setFlag(sim, flagName(def.setFlag, null, null));
    if (def.onceFlag !== null) setFlag(sim, flagName(def.onceFlag, null, null));
    const line = pickLine(sim, c, def, def.lines, 'win');
    for (const who of [c, other]) {
      if (line !== null) say(sim, who, def, line);
      if (def.heart > 0) addHeart(sim, who, def.heart);
    }
    if (def.duo?.memory !== undefined && def.duo.memory !== null)
      notify(sim, 'both', 'message', def.duo.memory, { key: `decor_memory_${def.id}` });
    return;
  }
  const wait = pickLine(sim, c, def, def.lines, 'wait');
  if (wait !== null) say(sim, c, def, wait);
}

// ---------------------------------------------------------------------------
// Chaque pas: maintiens, relâchements, séjours, événements en attente

function nearestHoldPlace(sim: Sim, c: Character): Place | null {
  let best: Place | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const def of gesturesOf(sim)) {
    if (def.verb !== 'hold' || !decorAvailable(sim, c, def)) continue;
    for (const place of placesOf(sim, def)) {
      const d = distance(c.pos, place.pos);
      if (d > reachOf(sim, def) || !facingPoint(c, place.pos)) continue;
      if (d < bestD) {
        best = place;
        bestD = d;
      }
    }
  }
  return best;
}

/** Score d'un lancer: plus proche de la durée idéale, plus de rebonds (un peu de hasard de la graine). */
function chargeScore(sim: Sim, c: Character, def: DecorGestureDef, seconds: number): number {
  const closeness = Math.max(
    0,
    1 - Math.abs(seconds - def.chargeIdeal) / Math.max(0.1, def.chargeIdeal),
  );
  const luck = unitDraw(sim.world.seed, `throw:${c.id}:${def.id}`, sim.world.tick);
  return Math.max(
    0,
    Math.min(def.maxScore, Math.round(closeness * (def.maxScore - 1) + luck * 1.2)),
  );
}

function releaseCharge(sim: Sim, c: Character, hold: HoldState): void {
  const def = decorDef(sim, hold.gesture);
  if (def?.kind !== 'charge') return;
  const seconds = Math.min(def.chargeMax, (hold.lastHeld - hold.since) * SIM_DT);
  if (seconds < MIN_CHARGE_SECONDS) return;
  const place = placesOf(sim, def).sort(
    (a, b) => distance(c.pos, a.pos) - distance(c.pos, b.pos),
  )[0];
  if (place === undefined) return;
  const score = chargeScore(sim, c, def, seconds);
  const record = recordOf(sim, def);
  play(
    sim,
    c,
    def,
    place.pos,
    score > record && score > 0 ? 'record' : score === 0 ? 'miss' : 'score',
    score,
  );
  if (score > record) setRecord(sim, def, score);
  if (def.showScore) {
    notify(sim, c.id, 'message', `${String(score)} ${plural(score, 'quille', 'quilles')}.`, {
      key: `decor_score_${def.id}`,
    });
  }
}

function recordOf(sim: Sim, def: DecorGestureDef): number {
  const flag = sim.world.flags.find((f) => f.startsWith(`decor_record:${def.id}:`));
  return flag === undefined ? 0 : Number(flag.slice(`decor_record:${def.id}:`.length));
}

function setRecord(sim: Sim, def: DecorGestureDef, score: number): void {
  const prefix = `decor_record:${def.id}:`;
  sim.world.flags = sim.world.flags.filter((f) => !f.startsWith(prefix));
  sim.world.flags.push(`${prefix}${String(score)}`);
  sim.runtime.changed = true;
}

function updateHolds(sim: Sim, c: Character, held: boolean): void {
  const rt = decorRuntime(sim);
  const tick = sim.world.tick;
  const state = rt.holds[c.id];
  const usable = c.status === 'active' && c.seat === null && c.created;
  if (state !== null) {
    if (held && usable) state.lastHeld = tick;
    const def = decorDef(sim, state.gesture);
    const released = tick - state.lastHeld >= RELEASE_TICKS;
    if (def === undefined || released || !usable) {
      rt.holds[c.id] = null;
      if (def?.kind === 'charge') releaseCharge(sim, c, state);
      return;
    }
    if (def.kind === 'charge') {
      face(c, nearestHoldPlace(sim, c)?.pos ?? c.pos);
      return;
    }
    const elapsed = (tick - state.since) * SIM_DT;
    if (elapsed < def.holdSeconds) return;
    const again =
      state.firedAt !== null &&
      def.repeatSeconds > 0 &&
      (tick - state.firedAt) * SIM_DT >= def.repeatSeconds;
    if (state.firedAt === null || again) {
      state.firedAt = tick;
      const place = placesOf(sim, def).sort(
        (a, b) => distance(c.pos, a.pos) - distance(c.pos, b.pos),
      )[0];
      if (place === undefined || !decorAvailable(sim, c, def)) return;
      if (def.kind === 'together') togetherStep(sim, c, def, place.pos);
      else play(sim, c, def, place.pos);
    }
    return;
  }
  if (!held || !usable) return;
  const place = nearestHoldPlace(sim, c);
  if (place === null) return;
  rt.holds[c.id] = { gesture: place.def.id, since: tick, firedAt: null, lastHeld: tick };
}

function updateDwells(sim: Sim, c: Character, moving: boolean): void {
  const rt = decorRuntime(sim);
  const tick = sim.world.tick;
  if (moving) rt.stillSince[c.id] = tick;
  const state = rt.dwells[c.id];
  if (state !== null) {
    const def = decorDef(sim, state.gesture);
    const moved = distance(c.pos, state.from) > DWELL_MOVE || moving;
    if (def === undefined || moved || c.status !== 'active') {
      rt.dwells[c.id] = null;
      if (c.action.kind === 'decor_sit')
        c.action = { kind: 'idle', since: tick, duration: 0, target: null };
      sim.runtime.changed = true;
      return;
    }
    if ((tick - state.since) * SIM_DT >= def.dwellSeconds) {
      rt.dwells[c.id] = null;
      const place = placesOf(sim, def).sort(
        (a, b) => distance(c.pos, a.pos) - distance(c.pos, b.pos),
      )[0];
      if (place !== undefined && decorAvailable(sim, c, def)) play(sim, c, def, place.pos);
      if (c.action.kind === 'decor_sit')
        c.action = { kind: 'idle', since: tick, duration: 0, target: null };
    }
    return;
  }
  // Sous la pluie, l'abri se prend tout seul: rester `dwellSeconds` à couvert.
  if (sim.world.weather !== 'rain' || c.status !== 'active' || !c.created) return;
  for (const def of gesturesOf(sim)) {
    if (def.kind !== 'dwell' || !def.rain || !decorAvailable(sim, c, def)) continue;
    for (const place of placesOf(sim, def)) {
      if (distance(c.pos, place.pos) > reachOf(sim, def)) continue;
      if ((tick - rt.stillSince[c.id]) * SIM_DT < def.dwellSeconds) continue;
      const key = `${String(sim.world.clock.day)}:${c.id}:${def.id}:${String(place.pos.x)}:${String(place.pos.y)}`;
      if (rt.sheltered.has(key)) continue;
      rt.sheltered.add(key);
      play(sim, c, def, place.pos);
    }
  }
}

/** Les drapeaux qui expirent (cierges du jour, fleurs de trois jours) partent au changement de jour. */
function sweepFlags(sim: Sim): void {
  const day = sim.world.clock.day;
  const kept = sim.world.flags.filter((f) => {
    const at = f.lastIndexOf('@');
    if (at < 0 || !f.startsWith('decor:')) return true;
    return Number(f.slice(at + 1)) >= day;
  });
  if (kept.length !== sim.world.flags.length) {
    sim.world.flags = kept;
    sim.runtime.changed = true;
  }
}

/** À appeler à chaque pas de jour (après les commandes): maintiens, séjours, événements différés. */
export function updateDecor(
  sim: Sim,
  controls: Partial<Record<CharacterId, { moveX: number; moveY: number; actHeld: boolean }>>,
): void {
  if (sim.content.village.gestures.length === 0) return;
  const rt = decorRuntime(sim);
  if (rt.day !== sim.world.clock.day) {
    rt.day = sim.world.clock.day;
    rt.sheltered.clear();
    sweepFlags(sim);
  }
  if (rt.queue.length > 0) {
    const due = rt.queue.filter((q) => q.tick <= sim.world.tick);
    if (due.length > 0) {
      rt.queue = rt.queue.filter((q) => q.tick > sim.world.tick);
      for (const q of due) q.fire();
    }
  }
  for (const c of sim.world.characters) {
    const f = controls[c.id];
    const moving = f !== undefined && Math.hypot(f.moveX, f.moveY) >= MOVE_DEADZONE;
    updateHolds(sim, c, f?.actHeld === true);
    updateDwells(sim, c, moving);
  }
}

/** Ses drapeaux de décor lus par le rendu: cierges allumés, initiales gravées, fleurs sur une tombe. */
export function decorFlagNames(flags: readonly string[], day: number, prefix: string): string[] {
  const out: string[] = [];
  for (const f of flags) {
    if (!f.startsWith(prefix)) continue;
    const at = f.lastIndexOf('@');
    if (at >= 0 && Number(f.slice(at + 1)) < day) continue;
    out.push(at >= 0 ? f.slice(prefix.length, at) : f.slice(prefix.length));
  }
  return out;
}
