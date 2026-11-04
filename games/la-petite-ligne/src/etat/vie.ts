/**
 * La vie du village, lue sans la simulation (0.13, lot H7; section 7.2 de `v0-13-habitants.md`):
 * scènes entre habitants, places assises des plannings (tables du café), postes de métier. Tout se
 * lit dans le contenu et dans l'état transmis (point visé, activité, horloge, graine): l'hôte et
 * l'invité voient la même chose, sans aucun champ de plus dans l'état.
 *
 * Points virtuels écrits dans `VillagerState.target` (résolus ici, comme `market_spot:0`):
 * - `scene:<scène>:<groupe>:<rang>`: une place d'une scène (en cercle ou assise);
 * - `seat:<point>:<rang>`: une place assise d'un point de planning (`seating` de `vie.json`).
 */
import type { Content, ScheduleEntry, VillagerDef } from '../donnees/types';
import type { SceneDef, SceneGroupDef } from '../donnees/vie';
import { entryHolds, planningCondition, type PlanningMoment } from './planning';
import { secondsPerGameMinuteOn } from '../donnees/calendrier';
import type { ReadonlyWorld, Vec2 } from './types';
import { unitDraw } from './tirage';

export const SCENE_PREFIX = 'scene:';
export const SEAT_PREFIX = 'seat:';

/** Activités où l'habitant n'est pas dans le bourg. */
const HIDDEN = new Set(['home', 'absent']);
const OFFSTAGE = 'offstage';

/** Une place résolue: où se tenir, où regarder, assis ou non. */
export interface LifePlace {
  x: number;
  y: number;
  /** Cap à l'arrivée (radians, convention des personnages), `null`: celui du poste ou de la marche. */
  facing: number | null;
  /** Assis à cette place (dessiné assis, arrêté dessus). */
  seated: boolean;
  /** La place est dans une case pleine (chaise d'une table): le dernier pas y entre. */
  inside: boolean;
}

/** La scène tient-elle à cet instant (plage horaire et conditions du jour) ? */
export function sceneHolds(content: Content, world: ReadonlyWorld, scene: SceneDef, at: PlanningMoment): boolean {
  if (at.minutes < scene.from || at.minutes >= scene.to) return false;
  return scene.when.every((c) => planningCondition(content, world, c, at));
}

/** L'entrée du planning de cet habitant à cet instant (première vraie), ou `null`. */
export function planningEntryAt(
  content: Content,
  world: ReadonlyWorld,
  def: VillagerDef,
  at: PlanningMoment,
): ScheduleEntry | null {
  return def.schedule.find((e) => entryHolds(content, world, e, at)) ?? null;
}

/** Le membre vient-il à la scène (il sort du bon lieu, ou il est dans le bourg) ? */
export function joinsScene(
  content: Content,
  world: ReadonlyWorld,
  scene: SceneDef,
  def: VillagerDef,
  at: PlanningMoment,
): boolean {
  if (scene.cameFrom !== null) {
    const before = planningEntryAt(content, world, def, { ...at, minutes: scene.cameFrom.at });
    return before !== null && scene.cameFrom.points.includes(before.point);
  }
  const now = planningEntryAt(content, world, def, at);
  return now !== null && now.point !== OFFSTAGE && !HIDDEN.has(now.activity);
}

/** La scène et la place de cet habitant à cet instant, ou `null`. */
export function sceneSlotOf(
  content: Content,
  world: ReadonlyWorld,
  def: VillagerDef,
  at: PlanningMoment,
): { scene: SceneDef; group: number; rank: number } | null {
  for (const scene of content.village.scenes) {
    const group = scene.groups.findIndex((g) => g.who.includes(def.id));
    if (group < 0 || !sceneHolds(content, world, scene, at)) continue;
    if (!joinsScene(content, world, scene, def, at)) continue;
    const rank = scene.groups[group]?.who.indexOf(def.id) ?? -1;
    return { scene, group, rank };
  }
  return null;
}

export function sceneTarget(scene: string, group: number, rank: number): string {
  return `${SCENE_PREFIX}${scene}:${String(group)}:${String(rank)}`;
}

export function seatTarget(point: string, rank: number): string {
  return `${SEAT_PREFIX}${point}:${String(rank)}`;
}

/** Le point de planning derrière un point virtuel (`seat:cafe_terrace:1` vers `cafe_terrace`). */
export function seatBase(target: string): string | null {
  if (!target.startsWith(SEAT_PREFIX)) return null;
  const rest = target.slice(SEAT_PREFIX.length);
  const cut = rest.lastIndexOf(':');
  return cut < 0 ? null : rest.slice(0, cut);
}

function parseScene(target: string): { scene: string; group: number; rank: number } | null {
  if (!target.startsWith(SCENE_PREFIX)) return null;
  const [scene, group, rank] = target.slice(SCENE_PREFIX.length).split(':');
  if (scene === undefined || group === undefined || rank === undefined) return null;
  return { scene, group: Number(group), rank: Number(rank) };
}

/** Le groupe de scène d'un point virtuel `scene:...`, ou `null`. */
export function sceneGroupOf(content: Content, target: string): { scene: SceneDef; group: SceneGroupDef; rank: number } | null {
  const t = parseScene(target);
  if (t === null) return null;
  const scene = content.village.scenes.find((s) => s.id === t.scene);
  const group = scene?.groups[t.group];
  if (scene === undefined || group === undefined) return null;
  return { scene, group, rank: t.rank };
}

/** La place d'un point virtuel (scène, siège), ou `null` pour un point ordinaire de la carte. */
export function lifePlace(content: Content, target: string): LifePlace | null {
  const s = sceneGroupOf(content, target);
  if (s !== null) {
    const place = s.group.place;
    if (place.kind === 'spots') {
      const spot = place.spots[s.rank];
      return spot === undefined ? null : { x: spot.x, y: spot.y, facing: spot.facing, seated: place.seated, inside: place.seated };
    }
    if (place.kind === 'circle') {
      const n = s.group.who.length;
      // Les membres répartis sur le cercle, le premier au nord du centre: chacun regarde le centre.
      const angle = -Math.PI / 2 + (2 * Math.PI * s.rank) / Math.max(1, n);
      const x = place.at.x + Math.cos(angle) * place.radius;
      const y = place.at.y + Math.sin(angle) * place.radius;
      return { x, y, facing: Math.atan2(place.at.y - y, place.at.x - x), seated: false, inside: false };
    }
    return null;
  }
  const base = seatBase(target);
  if (base === null) return null;
  const rank = Number(target.slice(target.lastIndexOf(':') + 1));
  const seat = content.village.seating.find((x) => x.point === base)?.seats[rank];
  return seat === undefined ? null : { x: seat.x, y: seat.y, facing: seat.facing, seated: true, inside: true };
}

/** Le poste de métier de ce point et de cette activité, ou `null`. */
export function workPostOf(
  content: Content,
  target: string,
  activity: string,
  villager: string,
): Content['village']['workPosts'][number] | null {
  return (
    content.village.workPosts.find(
      (p) => p.point === target && p.activity === activity && (p.who.length === 0 || p.who.includes(villager)),
    ) ?? null
  );
}

/** Une bulle à afficher: qui la dit, le texte. */
export interface SceneBubble {
  scene: string;
  by: string;
  text: string;
}

/**
 * Les bulles du moment (section 7.2): une par scène en cours, tirée à tour de rôle dans sa réserve
 * parmi les membres présents et arrêtés à leur place, au rythme de `bubbleSeconds` (secondes réelles au rythme de la journée). Le rang de
 * départ vient de la graine et du jour: même bulle chez l'hôte et chez l'invité. Les membres
 * restés à leur point de planning (groupe `planning`) sont reconnus à l'activité de la scène.
 */
export function sceneBubbles(content: Content, world: ReadonlyWorld, out: SceneBubble[] = []): SceneBubble[] {
  out.length = 0;
  const life = content.village;
  if (life.scenes.length === 0) return out;
  const at: PlanningMoment = { day: world.clock.day, minutes: world.clock.minutes, weather: world.weather };
  // Rythme compté en minutes de jeu: l'horloge arrive à l'invité avec les positions rapides, à
  // jour, quand le pas de son dernier état complet peut dater de plusieurs secondes.
  const period = life.bubbleSeconds / Math.max(1e-6, secondsPerGameMinuteOn(content.settings, world.clock.day));
  const beat = Math.floor(world.clock.minutes / period);
  // La dernière part de la période reste vide: les bulles se suivent sans se coller.
  if (world.clock.minutes - beat * period > period * 0.8) return out;
  for (const scene of life.scenes) {
    if (scene.lines.length === 0 || !sceneHolds(content, world, scene, at)) continue;
    const present = new Set<string>();
    scene.groups.forEach((g, gi) => {
      g.who.forEach((who, rank) => {
        const v = world.villagers.find((x) => x.id === who);
        if (v === undefined || !v.visible || v.speed > 0) return;
        const there =
          g.place.kind === 'planning'
            ? !v.target.startsWith(SCENE_PREFIX) && (g.activity === '' || v.activity === g.activity)
            : v.target === sceneTarget(scene.id, gi, rank);
        if (there) present.add(who);
      });
    });
    const lines = scene.lines.filter((l) => present.has(l.by));
    // Une scène ne parle qu'à deux au moins.
    if (lines.length === 0 || present.size < 2) continue;
    const start = Math.floor(unitDraw(world.seed, `scene:${scene.id}`, world.clock.day) * lines.length);
    const line = lines[(start + beat) % lines.length];
    if (line !== undefined) out.push({ scene: scene.id, by: line.by, text: line.text });
  }
  return out;
}

/** Centre d'un groupe resté au point de planning: milieu des autres membres présents. */
export function partnersCenter(world: ReadonlyWorld, members: readonly string[], self: string, out: Vec2): boolean {
  let n = 0;
  out.x = 0;
  out.y = 0;
  for (const who of members) {
    if (who === self) continue;
    const v = world.villagers.find((x) => x.id === who);
    if (v?.visible !== true) continue;
    out.x += v.pos.x;
    out.y += v.pos.y;
    n++;
  }
  if (n === 0) return false;
  out.x /= n;
  out.y /= n;
  return true;
}

/** La pause du village en cours (l'angélus, S10), ou `null`. */
export function villagePause(content: Content, minutes: number): Content['village']['pauses'][number] | null {
  return content.village.pauses.find((p) => p.at.some((t) => minutes >= t && minutes < t + p.minutes)) ?? null;
}
