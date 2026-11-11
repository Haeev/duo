/**
 * Système « habitants »: chaque habitant qui a une vie (`life` de sa fiche) suit son planning,
 * marche d'un poste à l'autre, s'assoit sur une vraie place, discute, salue, réagit, reçoit des
 * cadeaux, arrive et repart par le train. Le moteur ne nomme aucun habitant: tout vient des fiches.
 *
 * Économe: loin des deux joueurs, un habitant ne vit qu'un pas sur `farEveryTicks` (avec un pas de
 * temps d'autant plus long), et le planning ne se relit que tous les `planEveryTicks`. Les chemins
 * et les minuteries ne sont pas dans l'état: à la reprise (sauvegarde, retour dans le lieu),
 * chacun est posé là où son planning le veut.
 */
import type { PlaceContent } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { VillagerDef } from '../../donnees/schemas/habitant';
import type { VillagerLife } from '../../donnees/schemas/vie-habitant';
import type { VillagerLifeState } from '../../etat/habitants';
import type { PlaceState, VillagerState } from '../../etat/lieu';
import type { WorldState } from '../../etat/monde';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { evaluateAll } from '../regles/conditions';
import { remember } from '../regles/memoire';
import { bodyCollides } from '../noyau/grille';
import { placeBlockers } from '../noyau/obstacles';
import { findRoute, type Route } from './chemins';
import { closedLockSet } from '../lieux/chemins';
import { currentEntry, goalOf, type Goal } from './planning';
import { attend, giveGift, showEmote } from './presence';
import { VILLAGERS } from './reglages';
import { arrivalFrame } from '../voyage/arrivee';

/** Ce qui ne se sauvegarde pas: le trajet en cours et les minuteries. */
interface Runtime {
  route: Route | null;
  /** Prochain point du trajet. */
  next: number;
  goal: Goal | null;
  /** Secondes passées à attendre quelqu'un devant soi. */
  waited: number;
  readonly lastReact: Map<string, number>;
}

interface Runtimes {
  place: string;
  readonly byVillager: Map<string, Runtime>;
}

const runtimes = new WeakMap<WorldState, Runtimes>();

function runtimesOf(world: WorldState): Map<string, Runtime> {
  let r = runtimes.get(world);
  if (r?.place !== world.common.place) {
    r = { place: world.common.place, byVillager: new Map() };
    runtimes.set(world, r);
  }
  return r.byVillager;
}

function newLifeState(): VillagerLifeState {
  return {
    presence: 'here',
    entry: -1,
    activity: null,
    pose: 'stand',
    gesture: null,
    seat: null,
    emote: null,
    emoteUntil: 0,
    gaze: null,
  };
}

/** Un joueur tient cette place du meuble: assis (brique `sit`) ou couché (brique `sleep`). */
function heldByPlayer(place: PlaceState, object: string, index: number): boolean {
  const states = place.objects[object];
  return (states?.sit?.[index] ?? null) !== null || (states?.sleep?.[index] ?? null) !== null;
}

/** Une place est prise par un joueur (briques `sit`, `sleep`) ou par un autre habitant. */
function seatTakenIn(place: PlaceState, self: string): (object: string, index: number) => boolean {
  return (object, index) => {
    if (heldByPlayer(place, object, index)) return true;
    for (const [id, other] of Object.entries(place.villagers)) {
      if (id === self) continue;
      const seat = other.life?.seat;
      if (seat?.[0] === object && seat[1] === index) return true;
    }
    return false;
  };
}

function leaveSeat(sim: SimContext, state: VillagerLifeState): void {
  if (state.seat === null) return;
  state.seat = null;
  state.pose = 'stand';
  sim.touch('place');
}

/** Arrivé à son poste: activité, geste, posture, cap; il s'assoit si la place est libre. */
function settle(
  sim: SimContext,
  place: PlaceState,
  id: string,
  life: VillagerLife,
  villager: VillagerState,
  state: VillagerLifeState,
  rt: Runtime,
): void {
  const entry = life.schedule[state.entry];
  const goal = rt.goal;
  if (entry === undefined || goal === null) return;
  const body = villager.body;
  body.speed = 0;
  state.pose = 'stand';
  if (goal.seat !== null && !seatTakenIn(place, id)(goal.seat.object, goal.seat.index)) {
    body.x = goal.seat.x;
    body.y = goal.seat.y;
    body.facing = goal.seat.facing;
    state.seat = [goal.seat.object, goal.seat.index];
    state.pose = goal.seat.pose;
  } else if (goal.facing !== null) body.facing = goal.facing;
  state.activity = entry.activity;
  state.gesture = entry.gesture;
  sim.touch('place');
}

/** Places autour d'un point déjà tenu par un autre habitant: une couronne de six (m). */
const SPREAD_RADIUS = 0.75;
const SPREAD_COUNT = 6;

/**
 * Plusieurs habitants au même point (la cheffe au guichet, un client, deux plannings sur la même
 * place): deux personnages ne s'arrêtent jamais au même endroit. Une place est tenue par qui s'y
 * tient déjà, et aussi par qui y va: le but choisi par un autre la réserve, même s'il marche
 * encore (deux départs à la même heure, ou l'heure avancée d'un coup). Le second prend la
 * première place libre de la couronne autour, jamais l'un dans l'autre ni dans un mur.
 */
function spread(
  sim: SimContext,
  content: PlaceContent,
  place: PlaceState,
  self: string,
  goal: Goal,
): void {
  const near = (x: number, y: number, ox: number, oy: number): boolean =>
    Math.hypot(ox - x, oy - y) < VILLAGERS.radius * 2;
  const goals = runtimesOf(sim.world);
  const taken = (x: number, y: number): boolean => {
    for (const id in place.villagers) {
      const other = place.villagers[id];
      if (id === self || other === undefined || other.life?.presence === 'away') continue;
      const reserved = goals.get(id)?.goal ?? null;
      if (reserved !== null && near(x, y, reserved.x, reserved.y)) return true;
      // Un habitant en marche ne tient que la place où il va (ci-dessus), pas celle où il passe.
      if (other.life?.pose === 'walk') continue;
      if (near(x, y, other.body.x, other.body.y)) return true;
    }
    return false;
  };
  if (!taken(goal.x, goal.y)) return;
  const blockers = placeBlockers(sim.content, content, place, sim.world);
  for (let k = 0; k < SPREAD_COUNT; k++) {
    const a = (2 * Math.PI * k) / SPREAD_COUNT + Math.PI / 2;
    const x = goal.x + Math.cos(a) * SPREAD_RADIUS;
    const y = goal.y + Math.sin(a) * SPREAD_RADIUS;
    if (taken(x, y) || bodyCollides(blockers, x, y, VILLAGERS.radius)) continue;
    goal.x = x;
    goal.y = y;
    return;
  }
}

/**
 * Le point où descendent les joueurs reste dégagé: un poste à moins de `arrivalClearance` est
 * repoussé sur ce cercle, d'abord dans son propre sens; s'il est au point même, derrière les
 * joueurs (ils descendent face au lieu, `placeAtArrival`), hors de leur regard et de leur chemin.
 */
function clearArrival(sim: SimContext, content: PlaceContent, place: PlaceState, goal: Goal): void {
  const arrival = arrivalFrame(content);
  if (arrival === null) return;
  const { arrivalClearance: radius, arrivalClearanceSteps: steps } = VILLAGERS;
  const dx = goal.x - arrival.x;
  const dy = goal.y - arrival.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= radius) return;
  // Au point même: derrière les joueurs, à l'opposé de leur regard.
  const first = distance > 1e-3 ? Math.atan2(dy, dx) : arrival.facing + Math.PI;
  const blockers = placeBlockers(sim.content, content, place, sim.world);
  for (let k = 0; k < steps; k++) {
    // 0, +1, -1, +2, -2...: au plus près du premier sens.
    const turn = (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2);
    const a = first + (2 * Math.PI * turn) / steps;
    const x = arrival.x + Math.cos(a) * radius;
    const y = arrival.y + Math.sin(a) * radius;
    if (bodyCollides(blockers, x, y, VILLAGERS.radius)) continue;
    goal.x = x;
    goal.y = y;
    return;
  }
}

/** Choisit le but de la ligne en cours et le trajet pour y aller (ou l'y pose: `snap`). */
function head(
  sim: SimContext,
  content: PlaceContent,
  place: PlaceState,
  id: string,
  life: VillagerLife,
  villager: VillagerState,
  state: VillagerLifeState,
  rt: Runtime,
  snap: boolean,
): void {
  const entry = life.schedule[state.entry];
  leaveSeat(sim, state);
  state.activity = null;
  state.gesture = null;
  sim.touch('place');
  rt.goal =
    entry === undefined ? null : goalOf(sim.content, content, entry.at, seatTakenIn(place, id));
  if (rt.goal !== null && rt.goal.seat === null) {
    clearArrival(sim, content, place, rt.goal);
    spread(sim, content, place, id, rt.goal);
  }
  rt.route = null;
  rt.next = 0;
  rt.waited = 0;
  if (rt.goal === null) return;
  const body = villager.body;
  if (snap) {
    body.x = rt.goal.x;
    body.y = rt.goal.y;
    settle(sim, place, id, life, villager, state, rt);
    return;
  }
  rt.route = findRoute(
    sim.content,
    content,
    place,
    body.x,
    body.y,
    rt.goal.x,
    rt.goal.y,
    closedLockSet(sim),
  );
  state.pose = 'walk';
}

/** Présence: absent jusqu'à son arrivée par le train, reparti quand l'histoire le veut. */
function updatePresence(
  sim: SimContext,
  content: PlaceContent,
  place: PlaceState,
  def: VillagerDef,
  life: VillagerLife,
  villager: VillagerState,
  state: VillagerLifeState,
  rt: Runtime,
  snap: boolean,
): boolean {
  const ctx = { world: sim.world, content: sim.content, actor: null };
  const gone = life.leaves !== null && evaluateAll(ctx, life.leaves);
  const came = life.arrives === null || evaluateAll(ctx, life.arrives);
  const body = villager.body;
  if (state.presence === 'away' || (snap && (!came || gone))) {
    if (!came || gone) {
      if (state.presence !== 'away' || body.x !== VILLAGERS.offstage.x) {
        state.presence = 'away';
        state.entry = -1;
        leaveSeat(sim, state);
        body.x = VILLAGERS.offstage.x;
        body.y = VILLAGERS.offstage.y;
        body.speed = 0;
        sim.touch('place');
      }
      return false;
    }
    // Il descend du train: sur le quai, puis à pied jusqu'à son poste.
    const arrival = arrivalFrame(content);
    if (arrival !== null && !snap) {
      body.x = arrival.x;
      body.y = arrival.y;
      body.facing = arrival.facing;
      state.presence = 'arriving';
      remember(sim, `habitants.${def.id}.arrive`, true, 'duo');
      sim.emit({ type: 'villager_arrived', villager: def.id });
    } else state.presence = 'here';
    state.entry = -1;
    sim.touch('place');
    return true;
  }
  if (gone && state.presence !== 'leaving') {
    const platform = content.map.points[content.def.station.platform];
    state.presence = 'leaving';
    state.entry = -1;
    leaveSeat(sim, state);
    state.activity = null;
    state.gesture = null;
    state.pose = 'walk';
    rt.goal = platform === undefined ? null : { ...platform, facing: null, seat: null };
    rt.route =
      platform === undefined
        ? null
        : findRoute(
            sim.content,
            content,
            place,
            body.x,
            body.y,
            platform.x,
            platform.y,
            closedLockSet(sim),
          );
    rt.next = 0;
    sim.touch('place');
  }
  return state.presence !== 'leaving';
}

/** Avance le long du trajet; `true` une fois au bout. Il s'écarte et attend devant quelqu'un. */
function walk(
  sim: SimContext,
  place: PlaceState,
  id: string,
  villager: VillagerState,
  rt: Runtime,
  dt: number,
  near: boolean,
): boolean {
  const route = rt.route;
  const body = villager.body;
  if (route === null) return true;
  let budget = VILLAGERS.walkSpeed * dt;
  while (budget > 0) {
    const target = route.points[rt.next];
    if (target === undefined) {
      body.speed = 0;
      return true;
    }
    const dx = target.x - body.x;
    const dy = target.y - body.y;
    // Une porte se franchit d'un coup: il arrive devant l'autre porte de la paire.
    const d = target.jump === true ? 0 : Math.hypot(dx, dy);
    if (d <= budget) {
      body.x = target.x;
      body.y = target.y;
      budget -= d;
      for (const door of route.doors)
        if (door.at === rt.next) sim.emit({ type: 'villager_door', villager: id, door: door.id });
      rt.next += 1;
      rt.waited = 0;
      continue;
    }
    let ux = dx / d;
    let uy = dy / d;
    // Évitement simple, de près et hors du dernier pas: quelqu'un devant, on s'écarte de côté;
    // collé devant, on attend un peu, puis on passe (on ne reste jamais coincé).
    const last = rt.next === route.points.length - 1 && d < VILLAGERS.avoidRadius;
    if (near && !last && rt.waited < VILLAGERS.maxWaitSeconds) {
      const wait = avoid(sim, place, id, body, ux, uy, steer);
      if (wait) {
        rt.waited += dt;
        body.speed = 0;
        return false;
      }
      ux = steer.x;
      uy = steer.y;
    }
    body.x += ux * budget;
    body.y += uy * budget;
    body.facing = Math.atan2(uy, ux);
    body.speed = VILLAGERS.walkSpeed;
    return false;
  }
  body.speed = VILLAGERS.walkSpeed;
  return false;
}

const steer = { x: 0, y: 0 };

/**
 * Direction corrigée par les corps devant soi (joueurs et habitants présents), écrite dans `out`;
 * `true` si l'un d'eux est collé devant (attendre). Sans allocation: appelée à chaque pas de près.
 */
function avoid(
  sim: SimContext,
  place: PlaceState,
  self: string,
  body: { x: number; y: number },
  ux: number,
  uy: number,
  out: { x: number; y: number },
): boolean {
  let sx = 0;
  let sy = 0;
  let blocked = false;
  const consider = (ox: number, oy: number): void => {
    const dx = ox - body.x;
    const dy = oy - body.y;
    const d = Math.hypot(dx, dy);
    if (d > VILLAGERS.avoidRadius || dx * ux + dy * uy <= 0) return;
    if (d < VILLAGERS.radius * 2) blocked = true;
    // L'autre est à gauche de la marche: on s'écarte à droite, et inversement.
    const side = dx * -uy + dy * ux > 0 ? -1 : 1;
    sx += -uy * side;
    sy += ux * side;
  };
  consider(sim.world.players[0].body.x, sim.world.players[0].body.y);
  consider(sim.world.players[1].body.x, sim.world.players[1].body.y);
  for (const id in place.villagers) {
    const other = place.villagers[id];
    if (id === self || other === undefined || other.life?.presence === 'away') continue;
    consider(other.body.x, other.body.y);
  }
  const k = VILLAGERS.sidestep / VILLAGERS.walkSpeed;
  const x = ux + sx * k;
  const y = uy + sy * k;
  const n = Math.hypot(x, y) || 1;
  out.x = x / n;
  out.y = y / n;
  return blocked;
}

function nearPlayers(sim: SimContext, x: number, y: number): boolean {
  return sim.world.players.some(
    (p) => Math.hypot(p.body.x - x, p.body.y - y) < VILLAGERS.nearRadius,
  );
}

/** Partenaire de discussion à son poste, s'il discute bien avec lui en retour. */
function partnerOf(
  content: PlaceContent,
  place: PlaceState,
  id: string,
  life: VillagerLife,
  state: VillagerLifeState,
): { x: number; y: number; id: string } | null {
  const withId = life.schedule[state.entry]?.with;
  if (withId === undefined || state.activity === null) return null;
  const other = place.villagers[withId];
  const otherDef = content.villagers.find((v) => v.id === withId);
  const otherEntry = otherDef?.life?.schedule[other?.life?.entry ?? -1];
  if (other === undefined || otherEntry?.with !== id || other.life?.activity === null) return null;
  return { x: other.body.x, y: other.body.y, id: withId };
}

/**
 * À son poste mais plus à sa place: une scène l'a mené ailleurs, ou on l'a poussé. Pas pendant
 * une scène (elle le place elle-même), ni en conversation, ni assis.
 */
function strayed(
  sim: SimContext,
  villager: VillagerState,
  state: VillagerLifeState,
  rt: Runtime,
): boolean {
  if ((sim.world.common.story?.scene ?? null) !== null) return false;
  if (state.presence !== 'here' || state.seat !== null || villager.talkingWith !== null)
    return false;
  if (rt.route !== null || rt.goal === null) return false;
  const { x, y } = villager.body;
  return Math.hypot(rt.goal.x - x, rt.goal.y - y) > VILLAGERS.returnDistance;
}

/** Il retourne à pied au but de sa ligne en cours (activité suspendue le temps du trajet). */
function backToPost(
  sim: SimContext,
  content: PlaceContent,
  place: PlaceState,
  state: VillagerLifeState,
  rt: Runtime,
  body: { readonly x: number; readonly y: number },
): void {
  const goal = rt.goal;
  if (goal === null) return;
  rt.route = findRoute(
    sim.content,
    content,
    place,
    body.x,
    body.y,
    goal.x,
    goal.y,
    closedLockSet(sim),
  );
  rt.next = 0;
  rt.waited = 0;
  state.activity = null;
  state.gesture = null;
  state.pose = 'walk';
  sim.touch('place');
}

function liveOne(
  sim: SimContext,
  content: PlaceContent,
  place: PlaceState,
  def: VillagerDef,
  life: VillagerLife,
  index: number,
): void {
  const villager = place.villagers[def.id];
  if (villager === undefined) return;
  const all = runtimesOf(sim.world);
  let rt = all.get(def.id);
  const snap = rt === undefined;
  if (rt === undefined) {
    rt = { route: null, next: 0, goal: null, waited: 0, lastReact: new Map() };
    all.set(def.id, rt);
  }
  if (villager.life === undefined) {
    villager.life = newLifeState();
    sim.touch('place');
  }
  const state = villager.life;
  const body = villager.body;
  // Reprise d'une sauvegarde faite en pleine marche: le trajet n'est pas sauvegardé. Celui qui
  // arrivait est là, et chacun reprend sa ligne d'emploi du temps depuis son poste, sinon il
  // resterait figé à mi-chemin, en posture de marche.
  if (snap && (state.presence === 'arriving' || state.presence === 'here')) {
    state.presence = 'here';
    state.entry = -1;
  }
  const near = state.presence !== 'away' && nearPlayers(sim, body.x, body.y);
  const tick = sim.world.tick;
  // Loin: un pas sur `farEveryTicks`, décalé d'un habitant à l'autre pour lisser la charge.
  if (!snap && !near && (tick + index) % VILLAGERS.farEveryTicks !== 0) return;
  const dt = near ? sim.dt : sim.dt * VILLAGERS.farEveryTicks;
  if (state.emote !== null && tick >= state.emoteUntil) {
    state.emote = null;
    sim.touch('place');
  }
  const plan =
    snap || (tick + index) % VILLAGERS.planEveryTicks < (near ? 1 : VILLAGERS.farEveryTicks);
  if (plan) {
    const follows = updatePresence(sim, content, place, def, life, villager, state, rt, snap);
    if (follows) {
      const entry = currentEntry(sim, life);
      if (entry !== state.entry) {
        state.entry = entry;
        head(
          sim,
          content,
          place,
          def.id,
          life,
          villager,
          state,
          rt,
          snap && state.presence === 'here',
        );
      } else if (strayed(sim, villager, state, rt))
        backToPost(sim, content, place, state, rt, villager.body);
    }
  }
  if (state.presence === 'away') return;
  // Un joueur s'est assis (ou couché) à sa place: il se lève, surpris, et reste à côté.
  if (state.seat !== null && heldByPlayer(place, state.seat[0], state.seat[1])) {
    leaveSeat(sim, state);
    if (rt.goal !== null) {
      body.x = rt.goal.x;
      body.y = rt.goal.y;
    }
    showEmote(sim, state, 'surprise');
  }
  // En conversation, il s'arrête et écoute; le trajet en cours (planning changé pendant qu'on
  // lui parle) attend la fin de la conversation au lieu d'être tenu pour fini.
  const busy = villager.talkingWith !== null;
  if (rt.route !== null && state.pose !== (busy ? 'stand' : 'walk')) {
    state.pose = busy ? 'stand' : 'walk';
    sim.touch('place');
  }
  const arrived = !busy && walk(sim, place, def.id, villager, rt, dt, near);
  if (arrived && rt.route !== null) {
    rt.route = null;
    if (state.presence === 'leaving') {
      state.presence = 'away';
      body.x = VILLAGERS.offstage.x;
      body.y = VILLAGERS.offstage.y;
      remember(sim, `habitants.${def.id}.parti`, true, 'duo');
      sim.emit({ type: 'villager_left', villager: def.id });
      sim.touch('place');
      return;
    }
    if (state.presence === 'arriving') state.presence = 'here';
    settle(sim, place, def.id, life, villager, state, rt);
  }
  if (busy) body.speed = 0;
  if (near || state.gaze !== null) {
    const partner = partnerOf(content, place, def.id, life, state);
    attend(sim, def, life, villager, state, rt.route === null, partner, rt.lastReact);
  }
}

function step(sim: SimContext): void {
  if (sim.world.common.phase === 'travel') return;
  const content = sim.content.places[sim.world.common.place];
  const place = sim.world.places[sim.world.common.place];
  if (content === undefined || place === undefined) return;
  content.villagers.forEach((def, index) => {
    if (def.life !== undefined) liveOne(sim, content, place, def, def.life, index);
  });
}

function onIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  if (intent.type !== 'give_gift') return;
  const content = sim.content.places[sim.world.common.place];
  const place = sim.world.places[sim.world.common.place];
  const def = content?.villagers.find((v) => v.id === intent.villager);
  const villager = place?.villagers[intent.villager];
  if (def?.life === undefined || villager?.life === undefined) {
    sim.emit({ type: 'refused', player, reason: 'gone', target: intent.villager });
    return;
  }
  giveGift(sim, player, def, def.life, villager, villager.life);
}

export const villagerSystem: GameSystem = { id: 'habitants', step, intent: onIntent };
