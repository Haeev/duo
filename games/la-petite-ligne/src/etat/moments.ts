/**
 * Moments rares vus de l'état (tour 6): où se tient chaque acteur et ce qu'il joue, à chaque
 * instant d'une chorégraphie. Pur (sans Three.js): la simulation s'en sert pour la cible de
 * l'apogée (le renard qui bouge), le rendu pour poser et animer les bêtes, et les tests pour
 * mesurer le temps à l'écran (M-02). Les deux machines échantillonnent les mêmes images clés
 * au même temps de simulation: mêmes images au même instant.
 */
import type { Content, MomentActorDef, MomentChoreography, MomentDef, MomentKeyframe, MomentWatch } from '../donnees/types';
import type { GameMap } from './carte';
import type { DeepReadonly, MomentToday } from './types';

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
  return pointOf(map, actor.at, { x: 0, y: 0, z: 0 });
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
