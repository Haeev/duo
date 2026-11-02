/**
 * Moments rares vus de l'état (tour 6): où se tient chaque acteur et ce qu'il joue, à chaque
 * instant d'une chorégraphie. Pur (sans Three.js): la simulation s'en sert pour la cible de
 * l'apogée (le renard qui bouge), le rendu pour poser et animer les bêtes, et les tests pour
 * mesurer le temps à l'écran (M-02). Les deux machines échantillonnent les mêmes images clés
 * au même temps de simulation: mêmes images au même instant.
 */
import type { Content, MomentActorDef, MomentChoreography, MomentDef, MomentFreeze, MomentKeyframe, MomentWatch } from '../donnees/types';
import type { GameMap } from './carte';
import { SIM_HZ, type DeepReadonly, type MomentToday } from './types';
import { unitDraw } from './tirage';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Pose d'un acteur: position (m, z au-dessus du sol ou de l'eau), clip en cours, opacité (fondu de sortie). */
export interface ActorPose extends Vec3 {
  clip: string | null;
  /** Instant (s depuis le début de la chorégraphie) où ce clip a commencé, pour caler l'animation. */
  clipSince: number;
  opacity: number;
}

/** Conditions de l'apogée de ce moment, selon son origine (les oies de la quête: assis sur le banc). */
export function activeWatch(def: MomentDef, today: DeepReadonly<MomentToday>): MomentWatch {
  return today.origin === 'quest' && def.questWatch !== null ? def.questWatch : def.watch;
}

/**
 * Cases fermées par les barrières baissées (tour 9, le salut du mécanicien, `watch.arm`): de
 * l'armement jusqu'à la remontée des lisses (`liftAt` secondes après le début de l'apogée), sinon
 * `null`.
 */
export function armedCells(content: Pick<Content, 'moments'>, today: DeepReadonly<MomentToday> | null): { x: number; y: number; w: number; h: number } | null {
  if (today === null || (today.armedTick ?? null) === null) return null;
  const def = content.moments.find((m) => m.id === today.id);
  const arm = def?.watch.arm ?? null;
  if (arm === null) return null;
  if (today.phase === 'waiting' || (today.phase === 'climax' && today.elapsed < arm.liftAt)) return arm.cells;
  return null;
}

export function momentDef(content: Content, id: string): MomentDef | null {
  return content.moments.find((m) => m.id === id) ?? null;
}

function catmull(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

/** Les positions des images clés, `null` remplacé par la position d'avant (ou `from` pour la première). */
export function resolveTrack(frames: readonly MomentKeyframe[], from: Vec3): Vec3[] {
  const out: Vec3[] = [];
  let last = from;
  for (const [, x, y, z] of frames) {
    last = { x: x ?? last.x, y: y ?? last.y, z };
    out.push(last);
  }
  return out;
}

/** Pose échantillonnée (position et clip), écrite dans un objet fourni par l'appelant. */
export interface TrackSample extends Vec3 {
  clip: string | null;
  clipSince: number;
}

/**
 * Comme `sampleTrack`, sur des positions déjà résolues (`resolveTrack`), sans rien allouer: le
 * rendu échantillonne ainsi chaque acteur à chaque image.
 */
export function sampleResolved(frames: readonly MomentKeyframe[], points: readonly Vec3[], t: number, out: TrackSample): TrackSample {
  let clip: string | null = null;
  let clipSince = 0;
  for (const f of frames) {
    if (f[0] > t) break;
    if (f[4] !== null) {
      clip = f[4];
      clipSince = f[0];
    }
  }
  out.clip = clip;
  out.clipSince = clipSince;
  const first = frames[0];
  const p0 = points[0];
  if (first === undefined || p0 === undefined) return out;
  const copy = (p: Vec3): TrackSample => {
    out.x = p.x;
    out.y = p.y;
    out.z = p.z;
    return out;
  };
  if (t <= first[0] || frames.length === 1) return copy(p0);
  let i = 0;
  while (i < frames.length - 2 && (frames[i + 1]?.[0] ?? Infinity) <= t) i++;
  const a = frames[i];
  const b = frames[i + 1];
  const pa = points[i];
  const pb = points[i + 1];
  if (a === undefined || b === undefined || pa === undefined || pb === undefined) return copy(p0);
  if (t >= b[0] && i === frames.length - 2) return copy(pb);
  const span = b[0] - a[0];
  const u = span <= 0 ? 1 : Math.min(1, Math.max(0, (t - a[0]) / span));
  const pPrev = points[i - 1] ?? pa;
  const pNext = points[i + 2] ?? pb;
  out.x = catmull(pPrev.x, pa.x, pb.x, pNext.x, u);
  out.y = catmull(pPrev.y, pa.y, pb.y, pNext.y, u);
  out.z = catmull(pPrev.z, pa.z, pb.z, pNext.z, u);
  return out;
}

/**
 * Position et clip sur une piste d'images clés `[t, x, y, z, clip]` au temps `t` (s), par une
 * spline de Catmull-Rom entre les images (extrémités doublées). Avant la première image: la
 * première; après la dernière: la dernière.
 */
export function sampleTrack(frames: readonly MomentKeyframe[], t: number, from: Vec3): Omit<ActorPose, 'opacity'> {
  const out: TrackSample = { x: from.x, y: from.y, z: from.z, clip: null, clipSince: 0 };
  return sampleResolved(frames, resolveTrack(frames, from), t, out);
}

/** Opacité d'une chorégraphie à sa fin (`fadeLastSeconds`). */
export function choreographyFade(choreo: MomentChoreography, t: number): number {
  if (choreo.fadeLastSeconds <= 0) return 1;
  return Math.max(0, Math.min(1, (choreo.seconds - t) / choreo.fadeLastSeconds));
}

function pointOf(map: GameMap, id: string | null, fallback: Vec3): Vec3 {
  const p = id === null ? undefined : map.points[id];
  return p === undefined ? fallback : { x: p.x, y: p.y, z: 0 };
}

/** Où l'acteur attend (son point `at`). */
export function restPosition(map: GameMap, actor: MomentActorDef): Vec3 {
  const p = pointOf(map, actor.at, { x: 0, y: 0, z: 0 });
  return { x: p.x, y: p.y, z: actor.z };
}

// ---------------------------------------------------------------------------
// « Un, deux, trois, soleil » (la chevrette, tour 7) et gestes d'attente datés

/** Ce que fait la bête aux aguets à ce pas: elle broute, elle regarde, ou elle a été effarouchée. */
export type FreezeState =
  | { kind: 'graze'; /** Pas restants avant le prochain regard. */ nextLookIn: number }
  | { kind: 'look'; /** Pas depuis le début du regard. */ since: number }
  | { kind: 'startled'; since: number };

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

/** Durée d'un effarouchement (pas): coup de sabot, recul, broute au point de recul, retour. */
export function startleTicks(freeze: MomentFreeze): number {
  const walk = freeze.startleBack / Math.max(0.05, freeze.walkSpeed);
  return Math.round((freeze.startleSeconds + walk + freeze.resumeAfterSeconds + walk) * SIM_HZ);
}

/**
 * Regards de la bête: le premier `firstAfterSeconds` après le début de l'attente (ou après la fin
 * d'un effarouchement), puis tous les `everySeconds` (tirés par empreinte de la graine, du jour
 * et du point de départ: mêmes regards chez l'hôte et l'invité, sans générateur). L'effarouchement
 * en cours se lit dans `today.shyUntil` (pas de fin), posé par la simulation.
 */
export function freezeState(def: MomentDef, freeze: MomentFreeze, today: DeepReadonly<MomentToday>, tick: number, seed: number): FreezeState {
  const total = startleTicks(freeze);
  if (today.shyUntil > tick && tick >= today.shyUntil - total) return { kind: 'startled', since: tick - (today.shyUntil - total) };
  // Un effarouchement compte s'il a commencé pendant cette attente (pas le 0 d'un moment neuf).
  const startled = today.shyUntil - total >= today.phaseTick && today.shyUntil <= tick;
  const ref = startled ? today.shyUntil : today.phaseTick;
  const look = Math.max(1, Math.round(freeze.lookSeconds * SIM_HZ));
  const [low, high] = freeze.everySeconds;
  const gap = (k: number): number => Math.round(lerp(low, high, unitDraw(seed, `freeze:${def.id}:${String(ref)}:${String(k)}`, today.day)) * SIM_HZ);
  let start = ref + (startled ? gap(0) : Math.round(freeze.firstAfterSeconds * SIM_HZ));
  for (let k = 1; start + look <= tick; k += 1) start += Math.max(look + 1, gap(k));
  if (tick >= start) return { kind: 'look', since: tick - start };
  return { kind: 'graze', nextLookIn: start - tick };
}

/** Pose de la bête effarouchée, `since` pas après le coup de sabot: position, clip, instant du clip. */
export interface StartlePose {
  x: number;
  y: number;
  clip: string;
  clipTime: number;
  /** Elle marche (cap dans le sens du mouvement), sinon elle garde son cap. */
  walking: boolean;
}

/**
 * Effarouchée (fiche 1.4.7): coup de sabot sur place, recul de `startleBack` m vers
 * `startleToward` (jamais au-delà de ce point), broute `resumeAfterSeconds`, puis revient à son
 * point. Pur: le rendu la dessine, les tests vérifient qu'elle ne passe jamais la limite.
 */
export function startlePose(freeze: MomentFreeze, rest: Vec3, idle: string, since: number, out: StartlePose): StartlePose {
  const t = since / SIM_HZ;
  const dx = freeze.startleToward[0] - rest.x;
  const dy = freeze.startleToward[1] - rest.y;
  const room = Math.hypot(dx, dy);
  const back = Math.min(freeze.startleBack, room);
  const bx = room > 1e-6 ? rest.x + (dx / room) * back : rest.x;
  const by = room > 1e-6 ? rest.y + (dy / room) * back : rest.y;
  const walk = back / Math.max(0.05, freeze.walkSpeed);
  const t1 = freeze.startleSeconds;
  const t2 = t1 + walk;
  const t3 = t2 + freeze.resumeAfterSeconds;
  out.walking = false;
  if (t < t1) {
    out.x = rest.x;
    out.y = rest.y;
    out.clip = freeze.startleClip;
    out.clipTime = t;
    return out;
  }
  if (t < t2 || t >= t3) {
    const going = t < t2;
    const u = Math.min(1, going ? (t - t1) / Math.max(1e-6, walk) : (t - t3) / Math.max(1e-6, walk));
    const w = going ? u : 1 - u;
    out.x = rest.x + (bx - rest.x) * w;
    out.y = rest.y + (by - rest.y) * w;
    out.clip = freeze.walkClip;
    out.clipTime = going ? t - t1 : t - t3;
    out.walking = u < 1;
    return out;
  }
  out.x = bx;
  out.y = by;
  out.clip = idle;
  out.clipTime = t - t2;
  return out;
}

/**
 * Geste d'attente daté (`idleExtra` avec `segment`, le plongeon manqué du martin-pêcheur): secondes
 * depuis le début du geste en cours à `t` (s depuis le début de l'attente), ou `null`. Mêmes
 * instants pour le rendu et le son, chez les deux joueurs.
 */
export function idleGestureAt(def: MomentDef, actor: MomentActorDef, seed: number, day: number, t: number): number | null {
  const extra = actor.idleExtra;
  if (extra === null) return null;
  const [low, high] = extra.everySeconds;
  const length = extra.segment === null ? 1 : extra.segment[1] - extra.segment[0];
  let start = lerp(low, high, unitDraw(seed, `gesture:${def.id}:${actor.id}:0`, day));
  for (let k = 1; start + length <= t; k += 1) start += Math.max(length + 0.5, lerp(low, high, unitDraw(seed, `gesture:${def.id}:${actor.id}:${String(k)}`, day)));
  return t >= start ? t - start : null;
}

/** Où l'acteur se tient après l'apogée (point `after.actors[id].at`, sinon la fin de l'apogée). */
export function afterPosition(map: GameMap, def: MomentDef, actor: MomentActorDef): Vec3 {
  const end = def.climax.keyframes[actor.id];
  const climaxEnd = end === undefined ? restPosition(map, actor) : sampleTrack(end, def.climax.seconds, restPosition(map, actor));
  const after = def.after?.actors[actor.id];
  if (def.after === null) return restPosition(map, actor);
  return after === undefined ? { x: climaxEnd.x, y: climaxEnd.y, z: climaxEnd.z } : pointOf(map, after.at, climaxEnd);
}

/**
 * Pose de l'acteur dans l'état du moment: attente au point `at`, chorégraphie de l'apogée ou du
 * départ échantillonnée à `today.elapsed`, état d'après. `null`: l'acteur n'est pas à l'écran.
 */
export function actorPose(map: GameMap, def: MomentDef, today: DeepReadonly<MomentToday>, actorId: string): ActorPose | null {
  const actor = def.actors.find((a) => a.id === actorId);
  if (actor === undefined) return null;
  const rest = restPosition(map, actor);
  switch (today.phase) {
    case 'absent':
    case 'gone':
      return null;
    case 'waiting':
      return { ...rest, clip: actor.idle, clipSince: 0, opacity: 1 };
    case 'climax': {
      const track = def.climax.keyframes[actor.id];
      if (track === undefined) return { ...rest, clip: actor.idle, clipSince: 0, opacity: 1 };
      return { ...sampleTrack(track, today.elapsed, rest), opacity: choreographyFade(def.climax, today.elapsed) };
    }
    case 'after': {
      const after = def.after?.actors[actor.id];
      // Parti pendant l'apogée (les oies, le renard, l'échelle rangée): plus à l'écran.
      if (after?.at === null && after.idle === null) return null;
      return { ...afterPosition(map, def, actor), clip: after?.idle ?? actor.idle, clipSince: 0, opacity: 1 };
    }
    case 'left': {
      const leave = def.leave;
      const track = leave?.keyframes[actor.id];
      if (leave === null || track === undefined) return null;
      // Départ depuis l'état d'après (l'apogée a eu lieu: le héron part de la grève d'en face), sinon de l'attente.
      const from = today.startTick === null ? rest : afterPosition(map, def, actor);
      return { ...sampleTrack(track, today.elapsed, from), opacity: choreographyFade(leave, today.elapsed) };
    }
  }
}

/** Position au sol de la cible de l'apogée (`watch.target`): le point du moment, ou un acteur qui bouge. */
export function watchTarget(map: GameMap, def: MomentDef, target: string, today: DeepReadonly<MomentToday> | null): Vec3 {
  const anchor = pointOf(map, def.anchor, { x: 0, y: 0, z: 0 });
  if (target === 'anchor') return anchor;
  if (today === null) return anchor;
  return actorPose(map, def, today, target) ?? anchor;
}

/**
 * Tous les acteurs sont partis pendant l'apogée (`after.actors[id]` à `at: null, idle: null`):
 * la brume levée, la chevrette rentrée dans la haie, le martin-pêcheur envolé. Rien ne reste à
 * faire partir à l'heure du départ (QA7-01), ni de boucle d'ambiance à garder (QA7-04).
 */
export function allGoneAfterClimax(def: MomentDef): boolean {
  const after = def.after;
  if (after === null) return false;
  return def.actors.every((a) => {
    const entry = after.actors[a.id];
    // Un acteur absent de `after` reste là où l'apogée l'a laissé.
    return entry?.at === null && entry.idle === null;
  });
}

/** Clip d'un acteur qui n'est pas dessiné (sous l'eau, dans l'herbe). */
const HIDDEN_CLIP = 'hidden';

/**
 * Position de l'acteur telle que le rendu la dessine, `back` pas avant `tick` (0: le pas
 * courant): arrivée et effarouchement de l'attente compris, chorégraphies de l'apogée et du
 * départ, état d'après. `null`: pas à l'écran. Sert à repousser les joueurs de la bête qui bouge
 * (QA7-02); le pas d'avant donne son sens de marche.
 */
export function drawnPose(map: GameMap, def: MomentDef, today: DeepReadonly<MomentToday>, actor: MomentActorDef, tick: number, seed: number, back: number): Vec3 | null {
  const rest = restPosition(map, actor);
  switch (today.phase) {
    case 'absent':
    case 'gone':
      return null;
    case 'waiting': {
      const at = tick - back;
      const t = Math.max(0, (at - today.phaseTick) / SIM_HZ);
      const arrive = actor.arrive?.keyframes[actor.id];
      if (actor.arrive !== null && arrive !== undefined && t < actor.arrive.seconds) return sampleTrack(arrive, t, rest);
      const freeze = def.watch.freeze;
      if (freeze !== null && freeze.actor === actor.id) {
        const state = freezeState(def, freeze, today, at, seed);
        if (state.kind === 'startled') {
          const pose = startlePose(freeze, rest, actor.idle, state.since, { x: 0, y: 0, clip: '', clipTime: 0, walking: false });
          return { x: pose.x, y: pose.y, z: rest.z };
        }
      }
      return rest;
    }
    case 'climax':
    case 'left': {
      const choreo = today.phase === 'climax' ? def.climax : def.leave;
      const track = choreo?.keyframes[actor.id];
      if (choreo === null || track === undefined) return today.phase === 'climax' ? rest : null;
      const t = Math.max(0, today.elapsed - back / SIM_HZ);
      if (choreographyFade(choreo, t) <= 0.5) return null;
      const from = today.phase === 'left' && today.startTick !== null ? afterPosition(map, def, actor) : rest;
      const pose = sampleTrack(track, t, from);
      return pose.clip === HIDDEN_CLIP ? null : pose;
    }
    case 'after': {
      const pose = actorPose(map, def, today, actor.id);
      return pose === null ? null : { x: pose.x, y: pose.y, z: pose.z };
    }
  }
}
