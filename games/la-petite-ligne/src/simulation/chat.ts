/**
 * Le chat du bourg (0.13, lot H7, section 7.4 de `v0-13-habitants.md`; réglages `cat` de
 * `vie.json`). Il suit ses habitudes de la journée (tonnelle d'Odette, guichet du fournil, banc du
 * quai...), passe d'une place à l'autre, s'y endort ou s'y assoit, se roule parfois par terre en
 * arrivant. Un joueur qui arrive vite le fait fuir doucement; de petits pas le laissent approcher
 * (il regarde qui vient).
 *
 * Simulé par l'hôte seul, hors de l'état sauvegardé et du message d'état (rien à migrer, rien qui
 * grossisse l'état transmis): ses positions partent avec le canal rapide (`hote.ts`). Toutes ses
 * décisions sont tirées par la graine (`unitDraw`), jamais par `Math.random`. Après une reprise, il
 * réapparaît à sa place de l'habitude en cours.
 */
import type { CatDef, CatHabitDef } from '../donnees/vie';
import type { CatPoseName, CatSnapshot } from '../etat/chat';
import { planningCondition } from '../etat/planning';
import { unitDraw } from '../etat/tirage';
import { SIM_HZ, type CharacterId, type Vec2 } from '../etat/types';
import { type Sim, distance, emit } from './contexte';
import { villagerBlockers } from './deplacement';
import { findPath } from './grille';

/** Le chemin vers le joueur suivi est refait toutes les demi-secondes. */
const FOLLOW_REPATH_TICKS = 15;

/** Identifiant des tirages et des collisions du chat. */
const CAT = 'cat';

export interface CatState {
  pos: Vec2;
  prev: Vec2;
  facing: number;
  speed: number;
  pose: CatPoseName;
  since: number;
  inside: null;
  /** Habitude en cours et rang de la place visée. */
  habit: string;
  spot: number;
  path: Vec2[];
  /** En marche vers une place, en fuite, derrière un joueur, posé. */
  mode: 'walk' | 'flee' | 'follow' | 'rest';
  /** Le joueur suivi et la fin du suivi (pas de la simulation). */
  followBy: CharacterId | null;
  followUntil: number;
  /** Chaque joueur est-il déjà près de lui (une approche ne compte qu'une fois pour le suivi) ? */
  near: Record<CharacterId, boolean>;
  /** Minute du jour où il ira à une autre place (posé). */
  leaveAt: number;
  /** Fin de la roulade (pas de la simulation), -1 sans roulade. */
  rollUntil: number;
  /** Vitesse lissée de chaque joueur (m/s). */
  pace: Record<CharacterId, number>;
}

/** L'habitude du chat à cet instant (la première qui tient), ou `null`: il n'est pas au bourg. */
export function catHabit(sim: Sim, def: CatDef): CatHabitDef | null {
  const { world, content } = sim;
  if (world.phase !== 'day') return null;
  const at = { day: world.clock.day, minutes: world.clock.minutes, weather: world.weather };
  if (!def.when.every((c) => planningCondition(content, world, c, at))) return null;
  return (
    def.habits.find(
      (h) => at.minutes >= h.from && at.minutes < h.to && h.when.every((c) => planningCondition(content, world, c, at)),
    ) ?? null
  );
}

function draw(sim: Sim, key: string): number {
  return unitDraw(sim.world.seed, `${CAT}:${key}`, sim.world.tick);
}

function stayMinutes(sim: Sim, def: CatDef): number {
  const [min, max] = def.stayMinutes;
  return min + (max - min) * draw(sim, 'stay');
}

function goTo(sim: Sim, cat: CatState, to: Vec2, mode: 'walk' | 'flee'): void {
  const path = findPath(villagerBlockers(sim, CAT), cat.pos, to);
  cat.path = path ?? [];
  cat.mode = cat.path.length > 0 ? mode : 'rest';
}

function settle(sim: Sim, cat: CatState, def: CatDef, habit: CatHabitDef): void {
  cat.mode = 'rest';
  cat.leaveAt = sim.world.clock.minutes + stayMinutes(sim, def);
  if (habit.facing !== null) cat.facing = habit.facing;
  if (draw(sim, 'roll') < def.rollChance) {
    cat.pose = 'roll';
    cat.since = sim.world.tick;
    cat.rollUntil = sim.world.tick + Math.round(def.rollSeconds * SIM_HZ);
  } else {
    setPose(sim, cat, habit.pose);
  }
}

function setPose(sim: Sim, cat: CatState, pose: CatPoseName): void {
  if (cat.pose === pose) return;
  cat.pose = pose;
  cat.since = sim.world.tick;
}

function spotOf(habit: CatHabitDef, rank: number): Vec2 {
  const s = habit.spots[rank % habit.spots.length] ?? habit.spots[0];
  return { x: s?.x ?? 0, y: s?.y ?? 0 };
}

/** Un pas du chat (hôte seul). */
export function updateCat(sim: Sim, dt: number): void {
  const def = sim.content.village.cat;
  const habit = def === null ? null : catHabit(sim, def);
  if (def === null || habit === null) {
    sim.runtime.cat = null;
    return;
  }
  let cat = sim.runtime.cat;
  if (cat === null) {
    // Il apparaît à sa place (début de journée, reprise): personne ne le voit arriver de nulle part en marchant.
    const spot = Math.floor(draw(sim, 'spot') * habit.spots.length);
    const at = spotOf(habit, spot);
    cat = {
      pos: { ...at },
      prev: { ...at },
      facing: habit.facing ?? Math.PI / 2,
      speed: 0,
      pose: habit.pose,
      since: sim.world.tick,
      inside: null,
      habit: habit.id,
      spot,
      path: [],
      mode: 'rest',
      leaveAt: sim.world.clock.minutes + stayMinutes(sim, def),
      rollUntil: -1,
      pace: { p1: 0, p2: 0 },
      followBy: null,
      followUntil: -1,
      near: { p1: false, p2: false },
    };
    sim.runtime.cat = cat;
  }
  cat.prev.x = cat.pos.x;
  cat.prev.y = cat.pos.y;
  cat.speed = 0;
  // Nouvelle habitude: il part vers l'une de ses places.
  const resting = cat.habit === '' && cat.mode === 'rest' && sim.world.clock.minutes < cat.leaveAt;
  if (cat.habit !== habit.id && !resting) {
    cat.habit = habit.id;
    cat.spot = Math.floor(draw(sim, 'spot') * habit.spots.length);
    goTo(sim, cat, spotOf(habit, cat.spot), 'walk');
  } else if (cat.mode === 'rest' && sim.world.clock.minutes >= cat.leaveAt && cat.rollUntil < 0) {
    if (habit.spots.length > 1) {
      cat.spot = (cat.spot + 1 + Math.floor(draw(sim, 'next') * (habit.spots.length - 1))) % habit.spots.length;
      goTo(sim, cat, spotOf(habit, cat.spot), 'walk');
    } else {
      cat.leaveAt = sim.world.clock.minutes + stayMinutes(sim, def);
    }
  }
  // Les joueurs: vitesse lissée; qui arrive vite le fait fuir, qui vient à petits pas est regardé.
  const k = Math.min(1, dt / Math.max(dt, def.flee.smoothingSeconds));
  let watched: Vec2 | null = null;
  let best = def.watchRange;
  for (const c of sim.world.characters) {
    const pace = cat.pace[c.id] + (c.speed - cat.pace[c.id]) * k;
    cat.pace[c.id] = pace;
    if (!c.created || c.absent || c.inside !== null) continue;
    const d = distance(c.pos, cat.pos);
    // Celui qu'il suit ne le fait pas fuir.
    if (d < def.flee.range && pace > def.flee.speedAbove && cat.mode !== 'flee' && c.id !== cat.followBy) {
      const away = d > 1e-6 ? { x: (cat.pos.x - c.pos.x) / d, y: (cat.pos.y - c.pos.y) / d } : { x: 1, y: 0 };
      goTo(sim, cat, { x: cat.pos.x + away.x * def.flee.distance, y: cat.pos.y + away.y * def.flee.distance }, 'flee');
      cat.rollUntil = -1;
      cat.followBy = null;
    } else if (d < best) {
      best = d;
      watched = c.pos;
    }
    // Une approche douce: une fois sur `follow.chance`, il se lève et suit ce joueur un moment.
    if (d < def.watchRange && !cat.near[c.id]) {
      cat.near[c.id] = true;
      if (cat.mode === 'rest' && cat.followBy === null && draw(sim, `follow:${c.id}`) < def.follow.chance) {
        cat.followBy = c.id;
        cat.followUntil = sim.world.tick + Math.round(def.follow.seconds * SIM_HZ);
        cat.mode = 'follow';
        cat.rollUntil = -1;
        emit(sim, { type: 'cat_follow', by: c.id, at: { x: cat.pos.x, y: cat.pos.y } });
      }
    } else if (d > def.watchRange + 1) {
      cat.near[c.id] = false;
    }
  }
  if (cat.mode === 'follow') {
    const leader = sim.world.characters.find((c) => c.id === cat.followBy);
    if (leader === undefined || sim.world.tick >= cat.followUntil || leader.inside !== null) {
      // Fini: il s'assoit là, puis retourne à ses places.
      cat.followBy = null;
      cat.mode = 'rest';
      cat.path = [];
      cat.habit = '';
      cat.leaveAt = sim.world.clock.minutes + def.stayMinutes[0] / 2;
      setPose(sim, cat, 'idle');
    } else if (sim.world.tick % FOLLOW_REPATH_TICKS === 0) {
      const behind = {
        x: leader.pos.x - Math.cos(leader.facing) * def.follow.distance,
        y: leader.pos.y - Math.sin(leader.facing) * def.follow.distance,
      };
      cat.path = distance(cat.pos, behind) > def.follow.distance / 2 ? (findPath(villagerBlockers(sim, CAT), cat.pos, behind) ?? []) : [];
    }
  }
  if (cat.rollUntil >= 0 && sim.world.tick >= cat.rollUntil) {
    cat.rollUntil = -1;
    setPose(sim, cat, habit.pose);
  }
  const next = cat.path[0];
  if (cat.mode !== 'rest' && next !== undefined) {
    const speed = cat.mode === 'walk' ? def.walkSpeed : def.fleeSpeed;
    const d = distance(cat.pos, next);
    const step = speed * dt;
    if (d <= step) {
      cat.pos.x = next.x;
      cat.pos.y = next.y;
      cat.path.shift();
    } else {
      cat.pos.x += ((next.x - cat.pos.x) / d) * step;
      cat.pos.y += ((next.y - cat.pos.y) / d) * step;
    }
    cat.facing = Math.atan2(next.y - cat.prev.y, next.x - cat.prev.x);
    cat.speed = speed;
    setPose(sim, cat, 'walk');
    if (cat.path.length === 0 && cat.mode !== 'follow') {
      if (cat.mode === 'flee') {
        // À l'abri: il s'assoit un moment, puis retourne à sa place.
        cat.mode = 'rest';
        cat.leaveAt = sim.world.clock.minutes + def.stayMinutes[0] / 2;
        setPose(sim, cat, 'idle');
        cat.habit = '';
      } else {
        settle(sim, cat, def, habit);
      }
    }
    return;
  }
  if (cat.mode === 'follow') {
    // Rendu derrière le joueur: il attend assis, tourné vers lui.
    setPose(sim, cat, 'idle');
    const leader = sim.world.characters.find((c) => c.id === cat.followBy);
    if (leader !== undefined) cat.facing = Math.atan2(leader.pos.y - cat.pos.y, leader.pos.x - cat.pos.x);
    return;
  }
  if (cat.mode !== 'rest') cat.mode = 'rest';
  // Assis, il tourne la tête vers qui approche doucement; endormi, il ne bouge pas.
  if (watched !== null && cat.pose === 'idle') cat.facing = Math.atan2(watched.y - cat.pos.y, watched.x - cat.pos.x);
}

/** Le chat tel que le rendu le lit chez l'hôte, ou `null`. */
export function catSnapshot(sim: Sim): CatSnapshot | null {
  return sim.runtime.cat;
}
