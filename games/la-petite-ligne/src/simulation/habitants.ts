/**
 * Habitants: emploi du temps (`habitants.json`, première entrée vraie) et
 * trajets à pied d'un point à l'autre. Ils traversent les personnages (PE-09).
 */
import { inMap } from '../etat/carte';
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
import { announceHabits, currentHabit, notePlanning, sawAtDoor, watchHabits } from './voisins';

/** Activités où l'habitant n'est pas dans le bourg (on ne peut pas lui parler). */
const HIDDEN_ACTIVITIES = new Set(['home', 'absent']);

/** L'entrée du planning en cours: point, activité, habitude (0.13) et minute de début. */
function currentEntry(sim: Sim, def: VillagerDef): { point: string; activity: string; habit: string | null; from: number } {
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
  const at = sim.map.points[pointId] ?? marketPoint(sim, pointId) ?? undefined;
  if (at === undefined) return undefined;
  const spot = { x: at.x, y: at.y };
  villagerRestSpot(sim, v, pointId, spot);
  return spot;
}

function routeTo(sim: Sim, v: VillagerState, pointId: string): void {
  const goal = goalOf(sim, v, pointId);
  // Déjà rendu (apparu à sa place): aucun pas, sinon il se dessinerait un instant debout.
  const there = goal !== undefined && distance(v.pos, goal) < 1e-6;
  const path = goal === undefined || there ? null : findPath(villagerBlockers(sim, v.id), v.pos, goal);
  // Derrière un meuble (Odette au guichet): le dernier pas va sur la case même.
  const last = path?.[path.length - 1];
  if (path !== null && goal !== undefined && VILLAGER_BEHIND_POINTS.has(pointId) && (last === undefined || distance(last, goal) > 1e-6)) path.push({ x: goal.x, y: goal.y });
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
  for (const def of sim.content.villagers) {
    const v = sim.world.villagers.find((x) => x.id === def.id);
    if (v === undefined) continue;
    const entry = currentEntry(sim, def);
    notePlanning(sim, def, v, entry.habit, entry.from);
    const goal = goalOf(sim, v, entry.point);
    const at = goal ?? point(sim, POINT.offstage);
    teleport(v, at.x, at.y);
    v.target = entry.point;
    v.activity = entry.activity;
    // 0.13: un point pas encore sur la carte (carte agrandie en cours) vaut hors du bourg.
    v.visible = goal !== undefined && entry.point !== POINT.offstage && !HIDDEN_ACTIVITIES.has(entry.activity);
    v.speed = 0;
    sim.runtime.villagerPaths[v.id] = { target: entry.point, path: [] };
  }
}

export function updateVillagers(sim: Sim, dt: number): void {
  ensureVillagers(sim);
  const speed = sim.content.settings.feel.villagerSpeed;
  const refresh = sim.world.tick % SCHEDULE_PERIOD_TICKS === 0;
  for (const def of sim.content.villagers) {
    const v = sim.world.villagers.find((x) => x.id === def.id);
    if (v === undefined) continue;
    v.speed = 0;
    if (refresh) {
      const entry = currentEntry(sim, def);
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
      const post = sim.map.pointFacings[v.target];
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
  // 0.13 (section 4.3, 7.3): ce que les joueurs voient d'eux, au rythme des plannings.
  if (refresh) {
    watchHabits(sim);
    announceHabits(sim);
  }
}
