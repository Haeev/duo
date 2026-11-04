/**
 * Habitants: emploi du temps (`habitants.json`, première entrée vraie) et
 * trajets à pied d'un point à l'autre. Ils traversent les personnages (PE-09).
 */
import { inMap, offstagePoint } from '../etat/carte';
import type { Vec2, VillagerState } from '../etat/types';
import type { VillagerDef } from '../donnees/types';
import { evaluateAll, NO_CONTEXT } from './conditions';
import { MINUTES_PER_DAY, SCHEDULE_PERIOD_TICKS } from './constantes';
import { type Sim, distance, point } from './contexte';
import { villagerRestSpot } from './bancs';
import { villagerBlockers } from './deplacement';
import { bodyCollides, findPath } from './grille';
import { POINT, VILLAGER_BEHIND_POINTS } from './ids';
import { newVillagerState } from './monde';
import { marketEntry, marketPoint } from './marche';
import { watchBirthdays } from './amitie';
import { lifeEntry, lifeFacing, lifeGoal, villagePaused, workStrokes, type LifeEntry } from './vie';
import { announceHabits, currentHabit, notePlanning, sawAtDoor, watchHabits } from './voisins';

/** Activités où l'habitant n'est pas dans le bourg (on ne peut pas lui parler). */
const HIDDEN_ACTIVITIES = new Set(['home', 'absent']);

/** L'entrée du planning en cours: point, activité, habitude (0.13) et minute de début. */
function currentEntry(sim: Sim, def: VillagerDef, v: VillagerState): LifeEntry {
  const base = planningEntry(sim, def);
  // 0.13 (lot H7): une scène en cours ou une place assise passe avant le planning.
  return lifeEntry(sim, def, v, base) ?? base;
}

function planningEntry(sim: Sim, def: VillagerDef): LifeEntry {
  const m = Math.min(sim.world.clock.minutes, MINUTES_PER_DAY - 1);
  // 0.12: un client du marché du dimanche va à sa place devant l'étal, puis reprend sa journée.
  const market = marketEntry(sim, def.id);
  if (market !== null) return { ...market, habit: def.habits.find((h) => h.kind === 'market')?.id ?? null, from: Math.floor(m) };
  for (const entry of def.schedule) {
    if (m < entry.from || m >= entry.to) continue;
    if (!evaluateAll(sim, entry.when, NO_CONTEXT)) continue;
    return { point: entry.point, activity: entry.activity, habit: entry.habit, from: entry.from };
  }
  return { point: POINT.offstage, activity: 'absent', habit: null, from: Math.floor(m) };
}

function teleport(v: VillagerState, x: number, y: number): void {
  v.pos.x = x;
  v.pos.y = y;
  v.prev.x = x;
  v.prev.y = y;
}

/**
 * Où l'habitant se rend pour le point `pointId`: le point lui-même, ou, quand
 * c'est un banc, l'endroit d'où il s'y assoit (jamais dans l'emprise du banc).
 */
function goalOf(sim: Sim, v: VillagerState, pointId: string): Vec2 | undefined {
  const life = lifeGoal(sim, v, pointId);
  if (life !== null) return life.at;
  const mapPoint = sim.map.points[pointId];
  const at = mapPoint ?? marketPoint(sim, pointId) ?? undefined;
  if (at === undefined) return undefined;
  const spot = { x: at.x, y: at.y };
  if (villagerRestSpot(sim, v, pointId, spot)) return spot;
  // 0.13 (lot H7): plusieurs habitants au même point (la traite, la chorale, la pesée): chacun sa
  // place autour du point, jamais l'un dans l'autre.
  if (mapPoint !== undefined && !VILLAGER_BEHIND_POINTS.has(pointId)) spreadGoal(sim, v, pointId, spot);
  return spot;
}

/** Places autour d'un point partagé: le point, puis deux couronnes (m). */
const SPREAD_RINGS: readonly { radius: number; count: number }[] = [
  { radius: 0, count: 1 },
  { radius: 0.75, count: 6 },
  { radius: 1.4, count: 8 },
];
/** Deux places plus proches que cela se touchent. */
const SPREAD_GAP = 0.65;

/**
 * Plusieurs habitants au même point: le n-ième (rang dans la liste des habitants, parmi ceux qui
 * visent ce point et sont dans le bourg) prend la n-ième place libre autour du point (le point
 * d'abord, puis deux couronnes), hors des cases pleines et des places de scène des autres. Lu dans
 * l'état seul (points visés, activités): la même place chez l'hôte et chez l'invité, quel que soit
 * l'ordre des arrivées.
 */
function spreadGoal(sim: Sim, v: VillagerState, pointId: string, spot: Vec2): void {
  const sharing = sim.world.villagers.filter(
    (o) => o === v || (o.target === pointId && !HIDDEN_ACTIVITIES.has(o.activity)),
  );
  const rank = sharing.indexOf(v);
  const taken: Vec2[] = [];
  for (const o of sim.world.villagers) {
    if (o === v) continue;
    const place = lifeGoal(sim, o, o.target);
    if (place !== null) taken.push(place.at);
  }
  if (rank <= 0 && !taken.some((t) => distance(t, spot) < SPREAD_GAP)) return;
  const blockers = villagerBlockers(sim, v.id);
  const cx = spot.x;
  const cy = spot.y;
  let free = 0;
  for (const ring of SPREAD_RINGS) {
    for (let k = 0; k < ring.count; k++) {
      const a = (2 * Math.PI * k) / ring.count;
      const x = cx + Math.cos(a) * ring.radius;
      const y = cy + Math.sin(a) * ring.radius;
      if (ring.radius > 0 && bodyCollides(blockers, x, y)) continue;
      if (taken.some((t) => distance(t, { x, y }) < SPREAD_GAP)) continue;
      spot.x = x;
      spot.y = y;
      if (free === Math.max(0, rank)) return;
      free++;
    }
  }
}

function routeTo(sim: Sim, v: VillagerState, pointId: string): void {
  const goal = goalOf(sim, v, pointId);
  // Déjà rendu (apparu à sa place): aucun pas, sinon il se dessinerait un instant debout.
  const there = goal !== undefined && distance(v.pos, goal) < 1e-6;
  const path = goal === undefined || there ? null : findPath(villagerBlockers(sim, v.id), v.pos, goal);
  // Derrière un meuble (Odette au guichet): le dernier pas va sur la case même.
  const last = path?.[path.length - 1];
  const stepInto = VILLAGER_BEHIND_POINTS.has(pointId) || lifeGoal(sim, v, pointId)?.stepInto === true;
  if (path !== null && goal !== undefined && stepInto && (last === undefined || distance(last, goal) > 1e-6)) path.push({ x: goal.x, y: goal.y });
  sim.runtime.villagerPaths[v.id] = { target: pointId, path: path ?? [] };
}

/**
 * Un habitant ajouté au contenu après la sauvegarde (Achille et Solange, tour 10) n'a pas encore
 * d'état: il en reçoit un, hors de la carte, à la suite des autres.
 */
function ensureVillagers(sim: Sim): void {
  const { villagers } = sim.world;
  if (villagers.length >= sim.content.villagers.length) return;
  for (const def of sim.content.villagers) {
    if (!villagers.some((v) => v.id === def.id)) villagers.push(newVillagerState(sim.map, def.id));
  }
  sim.runtime.changed = true;
}

/** Place tous les habitants à leur point de l'emploi du temps (début de partie, matin, chargement). */
export function placeVillagers(sim: Sim): void {
  ensureVillagers(sim);
  // Deux passes: tous les points visés d'abord, puis les places (un point partagé se répartit
  // d'après les points des autres, comme chez l'invité qui reçoit l'état entier).
  const placed: { v: VillagerState; entry: LifeEntry }[] = [];
  for (const def of sim.content.villagers) {
    const v = sim.world.villagers.find((x) => x.id === def.id);
    if (v === undefined) continue;
    const entry = currentEntry(sim, def, v);
    notePlanning(sim, def, v, entry.habit, entry.from);
    v.target = entry.point;
    v.activity = entry.activity;
    placed.push({ v, entry });
  }
  for (const { v, entry } of placed) {
    const goal = goalOf(sim, v, entry.point);
    const at = goal ?? point(sim, POINT.offstage);
    teleport(v, at.x, at.y);
    // 0.13: un point pas encore sur la carte (carte agrandie en cours) vaut hors du bourg.
    v.visible = goal !== undefined && entry.point !== POINT.offstage && !HIDDEN_ACTIVITIES.has(entry.activity);
    v.speed = 0;
    sim.runtime.villagerPaths[v.id] = { target: entry.point, path: [] };
  }
}

/**
 * Chez l'invité, un habitant reçu sans position rapide (état arrivé avant le premier instantané):
 * il est posé là où `placeVillagers` le mettrait pour son point en cours, sans changer de point,
 * tourné comme son poste le veut. C'est sa place exacte en début de partie et à chaque aube.
 */
export function placeAtTarget(sim: Sim, v: VillagerState): void {
  const at = goalOf(sim, v, v.target) ?? sim.map.points[POINT.offstage] ?? offstagePoint(sim.map);
  teleport(v, at.x, at.y);
  const post = lifeFacing(sim, v) ?? sim.map.pointFacings[v.target];
  if (post !== undefined) v.facing = post;
  v.speed = 0;
}

export function updateVillagers(sim: Sim, dt: number): void {
  ensureVillagers(sim);
  const speed = sim.content.settings.feel.villagerSpeed;
  const refresh = sim.world.tick % SCHEDULE_PERIOD_TICKS === 0;
  const paused = villagePaused(sim);
  for (const def of sim.content.villagers) {
    const v = sim.world.villagers.find((x) => x.id === def.id);
    if (v === undefined) continue;
    v.speed = 0;
    if (refresh) {
      const entry = currentEntry(sim, def, v);
      const wasHidden = HIDDEN_ACTIVITIES.has(v.activity);
      const habitBefore = notePlanning(sim, def, v, entry.habit, entry.from);
      if (entry.point !== v.target || entry.activity !== v.activity) {
        v.target = entry.point;
        v.activity = entry.activity;
        sim.runtime.changed = true;
        // 0.13: un point pas encore sur la carte (carte agrandie en cours) vaut hors du bourg.
        if (entry.point === POINT.offstage || goalOf(sim, v, entry.point) === undefined) {
          const off = point(sim, POINT.offstage);
          teleport(v, off.x, off.y);
          v.visible = false;
          sim.runtime.villagerPaths[v.id] = { target: entry.point, path: [] };
          continue;
        }
        if (!v.visible) {
          // Il arrive d'en dehors du bourg: il apparaît directement là où il va (sur un banc,
          // devant sa place, donc assis), jamais au milieu d'une emprise d'où il ressortirait.
          const at = goalOf(sim, v, entry.point);
          const offMap = !inMap(sim.map, Math.floor(v.pos.x), Math.floor(v.pos.y));
          // 0.13: il sort de chez lui (pas du hors-carte): qui est là voit la fin de son habitude chez soi.
          if (!offMap && wasHidden) sawAtDoor(sim, v, habitBefore);
          if (at !== undefined && offMap) teleport(v, at.x, at.y);
          v.visible = true;
        }
        routeTo(sim, v, entry.point);
      }
    }
    // Reprise d'une sauvegarde: les trajets ne sont pas sauvegardés, il repart vers son point
    // (un corps resté dans un obstacle, comme une ancienne sauvegarde au milieu d'un banc, y est posé).
    if (sim.runtime.villagerPaths[v.id] === undefined && v.visible) {
      const goal = goalOf(sim, v, v.target);
      const stuck = bodyCollides(villagerBlockers(sim, v.id), v.pos.x, v.pos.y);
      if (goal !== undefined && stuck) teleport(v, goal.x, goal.y);
      routeTo(sim, v, v.target);
    }
    // En conversation: il attend.
    if (v.talkingWith.length > 0) continue;
    const route = sim.runtime.villagerPaths[v.id];
    const next = route?.path[0];
    if (route === undefined || next === undefined) {
      // Rendu à son poste: il regarde où le poste le dit (`rotation` de la carte), pas dans le sens de son dernier pas.
      const post = lifeFacing(sim, v) ?? sim.map.pointFacings[v.target];
      if (post !== undefined && v.visible) v.facing = post;
      const hidden = HIDDEN_ACTIVITIES.has(v.activity);
      if (hidden && v.visible) {
        // 0.13: il passe sa porte (ou s'en va hors du bourg) sous les yeux de qui est là.
        sawAtDoor(sim, v, currentHabit(sim, v.id));
        v.visible = false;
        sim.runtime.changed = true;
      }
      continue;
    }
    // L'angélus (S10): dehors, il s'arrête un instant là où il est.
    if (paused && v.inside === null) continue;
    const d = distance(v.pos, next);
    const stepLen = speed * dt;
    if (d <= stepLen) {
      v.pos.x = next.x;
      v.pos.y = next.y;
      route.path.shift();
    } else {
      v.pos.x += ((next.x - v.pos.x) / d) * stepLen;
      v.pos.y += ((next.y - v.pos.y) / d) * stepLen;
    }
    v.facing = Math.atan2(next.y - v.prev.y, next.x - v.prev.x);
    v.speed = speed;
  }
  workStrokes(sim);
  // 0.13 (section 4.3, 7.3): ce que les joueurs voient d'eux, au rythme des plannings.
  if (refresh) {
    watchHabits(sim);
    announceHabits(sim);
    watchBirthdays(sim);
  }
}
