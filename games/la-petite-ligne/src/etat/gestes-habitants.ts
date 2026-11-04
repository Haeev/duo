/**
 * Gestes des habitants avec le décor (0.13, lot H7, seconde moitié; `gestes-0-13.json`): quel geste
 * joue un habitant rendu à son poste, tourné vers quoi, avec quel accessoire. Lecture pure de l'état
 * déjà transmis (point visé, activité, position, météo, heure): l'hôte et l'invité choisissent le
 * même geste sans rien de plus sur le réseau. Lu par le rendu (clip, cap, accessoire) et par le son
 * (son du geste).
 *
 * L'habitude en cours n'est pas dans l'état: elle se retrouve par le planning, première entrée qui
 * tient à cet instant pour ce point et cette activité (`entryHolds`, mêmes règles que la simulation).
 */
import { seasonOfDay } from '../donnees/calendrier';
import type { GestureDef } from '../donnees/gestes-0-13';
import type { Content } from '../donnees/types';
import type { GameMap } from './carte';
import { entryHolds, momentOf } from './planning';
import type { DeepReadonly, ReadonlyWorld, Vec2, VillagerState } from './types';

/** Au-delà de cette vitesse (m/s), il marche: aucun geste (seuil de marche du rendu). */
const MOVING_SPEED = 0.15;
/**
 * Distance au point de son planning sous laquelle il y est rendu (m): le point d'arrivée de la
 * simulation peut être décalé d'une case (point dans une case pleine, place devant un meuble).
 */
const ARRIVED_DISTANCE = 1.6;
const HIDDEN = new Set(['home', 'absent']);
/** Décalage de phase entre deux habitants qui font le même geste (s par unité du hachage). */
const PHASE_SPREAD_SECONDS = 0.37;

interface HabitCache {
  target: string;
  activity: string;
  minute: number;
  day: number;
  weather: string;
  habit: string | null;
}

/** Cap de boussole (degrés, 0 nord, 90 est) en `facing` de la simulation (radians, 0 est, y vers le sud). */
export function headingToFacing(degrees: number): number {
  const a = (degrees * Math.PI) / 180;
  return Math.atan2(-Math.cos(a), Math.sin(a));
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 9973;
  return h;
}

/** Durée d'une boucle du geste (s); 0 pour un clip seul en boucle. */
export function gestureLoopSeconds(def: GestureDef): number {
  if (def.steps.length < 2) return 0;
  let total = 0;
  for (const s of def.steps) total += s.seconds;
  return total;
}

/** Clip du geste à l'instant `time` (s), décalé selon l'habitant pour que deux voisins ne battent pas ensemble. */
export function gestureClipAt(def: GestureDef, time: number, villager: string): string {
  const first = def.steps[0];
  if (first === undefined) return 'idle';
  const loop = gestureLoopSeconds(def);
  if (loop <= 0) return first.clip;
  let t = (time + hash(villager) * PHASE_SPREAD_SECONDS) % loop;
  for (const s of def.steps) {
    if (t < s.seconds) return s.clip;
    t -= s.seconds;
  }
  return first.clip;
}

export class VillagerGestures {
  private readonly habits = new Map<string, HabitCache>();
  private readonly anchors = new Map<string, Vec2>();
  private readonly byVillager = new Map<string, GestureDef[]>();

  constructor(
    private readonly content: Content,
    private readonly map: GameMap,
  ) {
    for (const g of content.villageLife.gestures) {
      for (const who of g.villagers) {
        const list = this.byVillager.get(who) ?? [];
        list.push(g);
        this.byVillager.set(who, list);
      }
    }
    for (const p of map.props) {
      const r = p.rect;
      this.anchors.set(p.id, r === null ? p.pos : { x: r.x + r.w / 2, y: r.y + r.h / 2 });
    }
    for (const t of map.trees) if (!this.anchors.has(t.id)) this.anchors.set(t.id, t.pos);
  }

  /** L'habitude du planning qui le met à ce point pour cette activité, à cet instant (`null`: aucune). */
  habitOf(villager: DeepReadonly<VillagerState>, world: ReadonlyWorld): string | null {
    const minute = Math.floor(world.clock.minutes);
    const day = world.clock.day;
    const cached = this.habits.get(villager.id);
    if (
      cached?.target === villager.target &&
      cached.activity === villager.activity &&
      cached.minute === minute &&
      cached.day === day &&
      cached.weather === world.weather
    )
      return cached.habit;
    const def = this.content.villagers.find((v) => v.id === villager.id);
    let habit: string | null = null;
    if (def !== undefined) {
      const at = momentOf(world);
      for (const entry of def.schedule) {
        if (entry.point !== villager.target || entry.activity !== villager.activity) continue;
        if (!entryHolds(this.content, world, entry, at)) continue;
        habit = entry.habit;
        break;
      }
    }
    const entry: HabitCache = cached ?? { target: '', activity: '', minute: 0, day: 0, weather: '', habit: null };
    entry.target = villager.target;
    entry.activity = villager.activity;
    entry.minute = minute;
    entry.day = day;
    entry.weather = world.weather;
    entry.habit = habit;
    this.habits.set(villager.id, entry);
    return habit;
  }

  /** Le geste qu'il joue à cette image, ou `null` (en marche, en conversation, pas encore à son poste). */
  gestureOf(villager: DeepReadonly<VillagerState>, world: ReadonlyWorld): GestureDef | null {
    const list = this.byVillager.get(villager.id);
    if (list === undefined || !villager.visible || HIDDEN.has(villager.activity)) return null;
    if (villager.speed > MOVING_SPEED || villager.talkingWith.length > 0) return null;
    const point = this.map.points[villager.target];
    if (point === undefined) return null;
    if (Math.hypot(villager.pos.x - point.x, villager.pos.y - point.y) > ARRIVED_DISTANCE) return null;
    const minutes = world.clock.minutes;
    const season = seasonOfDay(this.content.settings, world.clock.day);
    let habit: string | null | undefined;
    for (const g of list) {
      if (g.points.length > 0 && !g.points.includes(villager.target)) continue;
      if (g.activities.length > 0 && !g.activities.includes(villager.activity)) continue;
      if (g.from !== null && minutes < g.from) continue;
      if (g.to !== null && minutes >= g.to) continue;
      if (g.weather.length > 0 && !g.weather.includes(world.weather)) continue;
      if (g.notWeather.includes(world.weather)) continue;
      if (g.seasons.length > 0 && !g.seasons.includes(season)) continue;
      if (g.habits.length > 0) {
        habit ??= this.habitOf(villager, world);
        if (habit === null || !g.habits.includes(habit)) continue;
      }
      return g;
    }
    return null;
  }

  /** Cap (`facing` de la simulation) du geste, ou `null`: celui de son poste. */
  facingOf(def: GestureDef, villager: DeepReadonly<VillagerState>): number | null {
    const face = def.face;
    if (face === null) return null;
    if (face.kind === 'heading') return headingToFacing(face.degrees);
    const at = face.kind === 'object' ? this.anchors.get(face.id) : this.map.points[face.id];
    if (at === undefined) return null;
    const dx = at.x - villager.pos.x;
    const dy = at.y - villager.pos.y;
    return Math.hypot(dx, dy) < 1e-3 ? null : Math.atan2(dy, dx);
  }
}
