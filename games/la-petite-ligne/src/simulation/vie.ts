/**
 * La vie du village dans la simulation (0.13, lot H7; section 7.2 de `v0-13-habitants.md`):
 * scènes entre habitants et places assises, qui passent avant le planning, postes de métier, pause
 * de l'angélus et coups d'outil pour le son. Les règles de lecture sont dans `etat/vie.ts`, communes
 * avec le rendu; ici, seulement ce qui décide et ce qui émet.
 */
import type { ScheduleEntry, VillagerDef } from '../donnees/types';
import { momentOf } from '../etat/planning';
import { SIM_HZ, type Vec2, type VillagerState } from '../etat/types';
import {
  lifePlace,
  partnersCenter,
  sceneSlotOf,
  sceneTarget,
  villagePause,
  seatTarget,
  workPostOf,
} from '../etat/vie';
import { type Sim, distance, emit } from './contexte';

/** Ce que le planning donne à cet instant (forme de `currentEntry` d'`habitants.ts`). */
export interface LifeEntry {
  point: string;
  activity: string;
  habit: string | null;
  from: number;
}

/** Deux places plus proches que cela sont la même place (chaise prise). */
const SAME_PLACE = 0.3;

/**
 * L'entrée qui remplace celle du planning: une scène en cours dont il est membre, ou une place
 * assise du point où son planning l'envoie. `null`: le planning tel quel.
 */
export function lifeEntry(sim: Sim, def: VillagerDef, v: VillagerState, entry: LifeEntry): LifeEntry | null {
  const { content, world } = sim;
  if (content.village.scenes.length === 0 && content.village.seating.length === 0) return null;
  const at = momentOf(world);
  const slot = sceneSlotOf(content, world, def, at);
  if (slot !== null) {
    const group = slot.scene.groups[slot.group];
    if (group === undefined) return null;
    if (group.place.kind === 'planning') return group.activity === '' ? null : { ...entry, activity: group.activity };
    // Sortie d'un lieu (messe): l'habitude vue est celle d'où il sort, pas celle qui l'attend chez lui.
    let habit = entry.habit;
    if (slot.scene.cameFrom !== null) {
      const before: ScheduleEntry | undefined = def.schedule.find(
        (e) => e.from <= (slot.scene.cameFrom?.at ?? 0) && (slot.scene.cameFrom?.at ?? 0) < e.to && slot.scene.cameFrom?.points.includes(e.point) === true,
      );
      habit = before?.habit ?? null;
    }
    return { point: sceneTarget(slot.scene.id, slot.group, slot.rank), activity: group.activity, habit, from: slot.scene.from };
  }
  const seating = content.village.seating.find((s) => s.point === entry.point && s.activities.includes(entry.activity));
  if (seating === undefined) return null;
  // Il garde sa chaise s'il l'a déjà, sinon la première libre (aucun autre habitant n'y va).
  for (let rank = 0; rank < seating.seats.length; rank++) {
    const target = seatTarget(seating.point, rank);
    if (v.target === target) return { ...entry, point: target };
  }
  for (let rank = 0; rank < seating.seats.length; rank++) {
    const seat = seating.seats[rank];
    if (seat === undefined || placeTaken(sim, v, seat)) continue;
    return { ...entry, point: seatTarget(seating.point, rank) };
  }
  return null;
}

/** Un autre habitant visible va-t-il déjà à cette place (scène ou siège au même endroit) ? */
function placeTaken(sim: Sim, self: VillagerState, at: Vec2): boolean {
  return sim.world.villagers.some((o) => {
    if (o === self || !o.visible) return false;
    const place = lifePlace(sim.content, o.target);
    return place !== null && Math.hypot(place.x - at.x, place.y - at.y) < SAME_PLACE;
  });
}

/** Un autre habitant visible se tient-il là, ou y va-t-il (bout de son trajet) ? */
function standingNear(sim: Sim, self: VillagerState, at: Vec2): boolean {
  return sim.world.villagers.some((o) => {
    if (o === self || !o.visible) return false;
    const path = sim.runtime.villagerPaths[o.id]?.path;
    const end = path?.[path.length - 1] ?? o.pos;
    return Math.hypot(end.x - at.x, end.y - at.y) < SAME_PLACE * 2;
  });
}

/** Où se tenir pour ce point: place d'une scène ou d'un siège, poste de métier; `null`: le point de la carte. */
export function lifeGoal(sim: Sim, v: VillagerState, pointId: string): { at: Vec2; stepInto: boolean } | null {
  const place = lifePlace(sim.content, pointId);
  if (place !== null) return { at: { x: place.x, y: place.y }, stepInto: place.inside };
  const post = workPostOf(sim.content, pointId, v.activity, v.id);
  const at = post?.at ?? null;
  // Poste déjà tenu (Barnabé qui livre pendant que Mado est à l'enclume): il reste au point.
  if (at === null || placeTaken(sim, v, at) || standingNear(sim, v, at)) return null;
  return { at: { x: at.x, y: at.y }, stepInto: false };
}

const scratch = { x: 0, y: 0 };

/** Cap à l'arrivée: celui de la place, du poste, vers les autres membres d'une scène; `undefined`: celui du point. */
export function lifeFacing(sim: Sim, v: VillagerState): number | undefined {
  const place = lifePlace(sim.content, v.target);
  const facing = place?.facing ?? null;
  if (facing !== null) return facing;
  const post = workPostOf(sim.content, v.target, v.activity, v.id);
  if (post !== null && post.facing !== null) return post.facing;
  // Scène au point du planning: il se tourne vers les autres membres.
  const def = sim.content.villagers.find((d) => d.id === v.id);
  const slot = def === undefined ? null : sceneSlotOf(sim.content, sim.world, def, momentOf(sim.world));
  if (slot?.scene.groups[slot.group]?.place.kind === 'planning') {
    const all = slot.scene.groups.flatMap((g) => g.who);
    if (partnersCenter(sim.world, all, v.id, scratch)) return Math.atan2(scratch.y - v.pos.y, scratch.x - v.pos.x);
  }
  return undefined;
}

/** Pause de l'angélus (S10) en cours ? */
export function villagePaused(sim: Sim): boolean {
  return villagePause(sim.content, sim.world.clock.minutes) !== null;
}

/**
 * Coups d'outil (son du lot H8): un événement du poste (`forge_strike`, `joinery_saw`) toutes les `strokeSeconds` pour chaque
 * habitant arrivé à son poste, si un joueur l'entend.
 */
export function workStrokes(sim: Sim): void {
  const { world } = sim;
  for (const v of world.villagers) {
    if (!v.visible || v.speed > 0 || v.talkingWith.length > 0) continue;
    const post = workPostOf(sim.content, v.target, v.activity, v.id);
    const event = post?.event ?? null;
    if (post === null || event === null) continue;
    const at = post.at ?? sim.map.points[post.point];
    if (at === undefined || distance(v.pos, at) > (post.at === null ? 2 : 0.05)) continue;
    const period = Math.max(1, Math.round(post.strokeSeconds * SIM_HZ));
    if (world.tick % period !== 0) continue;
    if (!world.characters.some((c) => distance(c.pos, v.pos) <= post.hearRange)) continue;
    emit(sim, { type: event, villager: v.id, at: { x: v.pos.x, y: v.pos.y } });
  }
}
