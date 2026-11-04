/**
 * Les habitants tels qu'ils s'écrivent (0.13, lot H2): dans l'état transmis à l'invité et dans la
 * sauvegarde, un champ à sa valeur par défaut n'est pas écrit (21 habitants, dont la plupart hors
 * du bourg ou immobiles à leur poste: environ 1,6 Ko de moins). La lecture retrouve ces défauts,
 * comme le format 13 pour les plis et les quêtes. En mémoire, l'habitant reste complet: la
 * simulation et le rendu ne voient jamais la forme écrite.
 */
import type { BuildingId } from './carte';
import type { CharacterId, Vec2, VillagerState, WorldState } from './types';

/** Champs écrits seulement hors de leur valeur par défaut. */
type Defaulted = 'prev' | 'speed' | 'visible' | 'talkingWith' | 'met' | 'inside';

/**
 * Un habitant écrit. Défauts: `prev` égal à `pos` (immobile), `speed` 0, `visible` vrai,
 * `talkingWith` vide, `met` faux, `inside` nul (dehors ou hors de la carte).
 */
export type WrittenVillager = Omit<VillagerState, Defaulted> & {
  prev?: Vec2;
  speed?: number;
  visible?: false;
  talkingWith?: CharacterId[];
  met?: true;
  inside?: BuildingId;
};

/** L'état du monde écrit (message d'état complet de l'hôte, sauvegarde). */
export type WrittenWorld = Omit<WorldState, 'villagers'> & { villagers: WrittenVillager[] };

export function writeVillager(v: VillagerState): WrittenVillager {
  const out: WrittenVillager = {
    id: v.id,
    pos: v.pos,
    facing: v.facing,
    target: v.target,
    activity: v.activity,
  };
  if (v.prev.x !== v.pos.x || v.prev.y !== v.pos.y) out.prev = v.prev;
  if (v.speed !== 0) out.speed = v.speed;
  if (!v.visible) out.visible = false;
  if (v.talkingWith.length > 0) out.talkingWith = v.talkingWith;
  if (v.met) out.met = true;
  if (v.inside !== null) out.inside = v.inside;
  return out;
}

export function readVillager(w: WrittenVillager): VillagerState {
  return {
    id: w.id,
    pos: w.pos,
    prev: w.prev ?? { x: w.pos.x, y: w.pos.y },
    facing: w.facing,
    speed: w.speed ?? 0,
    visible: w.visible ?? true,
    target: w.target,
    activity: w.activity,
    talkingWith: w.talkingWith ?? [],
    met: w.met ?? false,
    inside: w.inside ?? null,
  };
}

/** L'état à écrire: une copie de surface, les habitants sous leur forme écrite (le reste est partagé). */
export function writtenWorld(world: WorldState): WrittenWorld {
  return { ...world, villagers: world.villagers.map(writeVillager) };
}

/** L'état relu d'un message de l'hôte: les habitants retrouvent leurs défauts. */
export function worldFromWritten(world: WrittenWorld): WorldState {
  return { ...world, villagers: world.villagers.map(readVillager) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Une sauvegarde relue (données du disque, tout format): chaque habitant qui a une position
 * retrouve les champs absents à leur valeur par défaut; un champ écrit est gardé tel quel. Les
 * contrôles de forme de la sauvegarde passent après.
 */
export function fillVillagerDefaults(data: unknown): unknown {
  if (!isRecord(data) || !Array.isArray(data.villagers)) return data;
  for (const v of data.villagers) {
    if (!isRecord(v) || !isRecord(v.pos)) continue;
    const { x, y } = v.pos;
    if (!('prev' in v) && typeof x === 'number' && typeof y === 'number') v.prev = { x, y };
    if (!('speed' in v)) v.speed = 0;
    if (!('visible' in v)) v.visible = true;
    if (!('talkingWith' in v)) v.talkingWith = [];
    if (!('met' in v)) v.met = false;
    if (!('inside' in v)) v.inside = null;
  }
  return data;
}
