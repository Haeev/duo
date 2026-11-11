/**
 * Lits de voie des grands lieux (rendu encré): le ballast et ses fossés, en tranchée près d'un
 * tunnel, posés module par module le long du tracé réel des voies (`rails` de la carte), sous les
 * traverses et les rails que le décor dessine déjà. Chaque module d'un mètre est plié sur la voie
 * (courbes comprises) et posé sommet par sommet sur le relief: deux modules voisins partagent
 * leurs bords, d'une tuile à l'autre aussi. Les modules d'une tuile sont fusionnés en un maillage
 * posé à l'origine du lieu, chaque voie d'une seule pièce de contour: aucun trait aux raccords.
 *
 * Le talus d'une tranchée est du sol: ses faces prennent la nature de sol du nuanceur (teinte et
 * matière de la carte du sol, aucun trait entre lui et le pré), sa hauteur et la largeur de son
 * revers ondulent le long de la voie, et ses normales suivent le profil ainsi déformé, coupées net
 * à la crête (un versant au soleil, l'autre à l'ombre, sans dents de scie entre les deux). Un fossé
 * est sec hors de l'eau du plan.
 *
 * Données: `TRACK_BED` de `reglages-files.ts` (sortes, natures, enfoncements). Aucune voie nommée.
 */
import { type BufferGeometry, Color } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MapDef } from '../../donnees/schemas/lieu';
import { KIND } from '../encre/couches';
import { DECOR_MANIFEST, type DecorManifest, variantOf } from './decors-manifeste';
import type { Footprint } from './emprises';
import { TRACK_BED, type TrackBedSort } from './reglages-files';
import { type GroundField, hash01 } from './terrain-rendu';
import { tileOf } from '../../donnees/carte';

export type TrackBedSettings = typeof TRACK_BED;

/** Une voie à ciel ouvert prête à parcourir. */
interface BedTrack {
  readonly id: string;
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  /** Distance du premier point à chaque point. */
  readonly at: Float64Array;
  readonly length: number;
  /** Bouts qui entrent dans un tunnel (début, fin). */
  readonly mouths: readonly [boolean, boolean];
  /** Numéro de pièce de contour (1 à 62): le même pour toute la voie. */
  readonly piece: number;
}

/** Un module posé: sa voie, sa sorte, son modèle (variante comprise) et son tronçon (m). */
export interface BedModule {
  readonly track: number;
  readonly sort: number;
  readonly model: string;
  readonly s0: number;
  readonly s1: number;
  /** Tuile du lieu qui le dessine (celle de son milieu). */
  readonly tile: number;
}

const point = { x: 0, y: 0 };
const ahead = { x: 0, y: 0 };
const behind = { x: 0, y: 0 };

function pointOn(track: BedTrack, s: number, out: { x: number; y: number }): void {
  const last = track.at.length - 1;
  const d = Math.min(track.length, Math.max(0, s));
  let i = 0;
  while (i < last - 1 && (track.at[i + 1] ?? 0) < d) i++;
  const a = track.at[i] ?? 0;
  const span = (track.at[i + 1] ?? a + 1) - a;
  const t = span > 0 ? (d - a) / span : 0;
  const x0 = track.xs[i] ?? 0;
  const y0 = track.ys[i] ?? 0;
  out.x = x0 + ((track.xs[i + 1] ?? x0) - x0) * t;
  out.y = y0 + ((track.ys[i + 1] ?? y0) - y0) * t;
}

/** Distance de (x, y) à la voie. */
function distanceTo(track: BedTrack, x: number, y: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < track.xs.length; i++) {
    const ax = track.xs[i] ?? 0;
    const ay = track.ys[i] ?? 0;
    const dx = (track.xs[i + 1] ?? ax) - ax;
    const dy = (track.ys[i + 1] ?? ay) - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return best;
}

/** Les lits de voie d'un lieu: voies, modules, et ce qu'il faut pour les poser. */
export class TrackBedLayout {
  constructor(
    readonly tracks: readonly BedTrack[],
    readonly modules: readonly BedModule[],
    readonly settings: TrackBedSettings,
    /** Demi-largeur de chaque sorte (m), d'après le manifeste. */
    readonly halfWidths: readonly number[],
    /** Pieds des petits repères du bord de la voie: le fossé s'y arrête. */
    readonly clear: readonly Footprint[] = [],
  ) {}

  /** Modules d'une tuile. */
  inTile(tile: number): BedModule[] {
    return this.modules.filter((m) => m.tile === tile);
  }

  /** Distance (m, le long de la voie) à la bouche de tunnel la plus proche; l'infini sans tunnel. */
  toMouth(track: number, s: number): number {
    const t = this.tracks[track];
    if (t === undefined) return Number.POSITIVE_INFINITY;
    let d = Number.POSITIVE_INFINITY;
    if (t.mouths[0]) d = Math.min(d, s);
    if (t.mouths[1]) d = Math.min(d, t.length - s);
    return d;
  }

  /**
   * Emprise de chaque module (boîte alignée): rien ne se sème sur le ballast ni dans les fossés,
   * ni sur le revers d'un talus, étalé au plus large.
   */
  footprints(): Footprint[] {
    const out: Footprint[] = [];
    for (const m of this.modules) {
      const track = this.tracks[m.track];
      const talus = this.settings.sorts[m.sort]?.talus;
      const model = this.halfWidths[m.sort] ?? 0;
      const half =
        talus === undefined || model <= talus.crest
          ? model
          : talus.crest + (model - talus.crest) * talus.spread[1];
      if (track === undefined) continue;
      pointOn(track, m.s0, behind);
      pointOn(track, m.s1, ahead);
      out.push({
        x0: Math.min(behind.x, ahead.x) - half,
        z0: Math.min(behind.y, ahead.y) - half,
        x1: Math.max(behind.x, ahead.x) + half,
        z1: Math.max(behind.y, ahead.y) + half,
      });
    }
    return out;
  }
}

/**
 * Pose les lits de voie d'un lieu. `sorts` doivent avoir leurs modèles livrés (`has`); sans
 * sorte disponible, aucun module (la voie garde son sol et ses traverses).
 */
export function layTrackBeds(
  map: Pick<MapDef, 'rails' | 'width' | 'height'>,
  field: GroundField,
  has: (model: string) => boolean,
  settings: TrackBedSettings = TRACK_BED,
  manifest: DecorManifest = DECOR_MANIFEST,
  /** Emprises des repères posés au lieu (seuls les petits arrêtent le fossé). */
  landmarks: readonly Footprint[] = [],
): TrackBedLayout {
  const usable = settings.sorts.map((sort) =>
    [sort.model, ...(manifest.models[sort.model]?.variants ?? [])].every(
      (id) => manifest.models[id] !== undefined && has(id),
    ),
  );
  const halfWidths = settings.sorts.map((sort) => (manifest.models[sort.model]?.size.w ?? 0) / 2);
  const rails = map.rails ?? [];
  const tunnels = rails.filter((r) => r.tunnel === true);
  const isMouth = (x: number, y: number): boolean =>
    tunnels.some((t) =>
      [t.points[0], t.points[t.points.length - 1]].some(
        (p) => p !== undefined && Math.hypot(p[0] - x, p[1] - y) < 0.5,
      ),
    );
  const tracks: BedTrack[] = [];
  for (const rail of rails) {
    if (rail.tunnel === true) continue;
    const n = rail.points.length;
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    const at = new Float64Array(n);
    rail.points.forEach(([x, y], i) => {
      xs[i] = x;
      ys[i] = y;
      if (i > 0) at[i] = (at[i - 1] ?? 0) + Math.hypot(x - (xs[i - 1] ?? 0), y - (ys[i - 1] ?? 0));
    });
    const first = rail.points[0];
    const last = rail.points[n - 1];
    tracks.push({
      id: rail.id,
      xs,
      ys,
      at,
      length: at[n - 1] ?? 0,
      mouths: [
        first !== undefined && isMouth(first[0], first[1]),
        last !== undefined && isMouth(last[0], last[1]),
      ],
      piece: 1 + Math.floor(hash01(tracks.length, 17, 61) * 62),
    });
  }
  const layout = new TrackBedLayout(tracks, [], settings, halfWidths);
  const modules: BedModule[] = [];
  const over = new Set(settings.over);
  const shows = (x: number, y: number): boolean => {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= field.width || cy >= field.height) return false;
    return over.has(field.names[field.cells[cy * field.width + cx] ?? 0] ?? '');
  };
  const sample = 0.25;
  tracks.forEach((track, index) => {
    // Tronçons où l'axe de la voie est sur une nature `over`: un passage à niveau les coupe.
    const spans: [number, number][] = [];
    let start = -1;
    for (let s = 0; s <= track.length + 1e-9; s += sample) {
      const d = Math.min(s, track.length);
      pointOn(track, d, point);
      const inside = shows(point.x, point.y);
      if (inside && start < 0) start = d;
      else if (!inside && start >= 0) {
        spans.push([start, d]);
        start = -1;
      }
    }
    if (start >= 0) spans.push([start, track.length]);
    for (const [a, b] of spans) {
      const count = Math.round((b - a) / settings.step);
      if (count < 1) continue;
      const length = (b - a) / count;
      for (let k = 0; k < count; k++) {
        const s0 = a + k * length;
        const s1 = s0 + length;
        const mid = (s0 + s1) / 2;
        const toMouth = layout.toMouth(index, mid);
        const sort = settings.sorts.findIndex(
          (candidate, i) =>
            usable[i] === true &&
            (candidate.nearTunnel === undefined || toMouth <= candidate.nearTunnel),
        );
        const chosen = settings.sorts[sort];
        if (chosen === undefined) continue;
        pointOn(track, mid, point);
        modules.push({
          track: index,
          sort,
          model: variantOf(chosen.model, `${track.id}:${String(k)}:${String(a)}`, manifest),
          s0,
          s1,
          tile: tileOf(map, point.x, point.y),
        });
      }
    }
  });
  const { small, margin } = settings.clear;
  const clear = landmarks
    .filter((f) => f.x1 - f.x0 <= small && f.z1 - f.z0 <= small)
    .map((f) => ({ x0: f.x0 - margin, z0: f.z0 - margin, x1: f.x1 + margin, z1: f.z1 + margin }));
  return new TrackBedLayout(tracks, modules, settings, halfWidths, clear);
}

/** Direction de la voie en `s`, lissée de part et d'autre (aucun pli aux angles du tracé). */
function tangentAt(
  track: BedTrack,
  s: number,
  smooth: number,
  out: { x: number; y: number },
): void {
  pointOn(track, s + smooth, ahead);
  pointOn(track, s - smooth, behind);
  const dx = ahead.x - behind.x;
  const dy = ahead.y - behind.y;
  const n = Math.hypot(dx, dy) || 1;
  out.x = dx / n;
  out.y = dy / n;
}

const tangent = { x: 0, y: 0 };
const shaped = { x: 0, y: 0 };
const endA = { x: 0, y: 0 };
const endB = { x: 0, y: 0 };
const faceNormal = { x: 0, y: 0 };
const dry = new Color();

/** Ondulation lente le long d'une voie, de -1 à 1: deux sinus de longueurs sans rapport simple. */
function waveAt(s: number, wave: number, phase: number): number {
  const k = (Math.PI * 2) / wave;
  return 0.6 * Math.sin(s * k + phase) + 0.4 * Math.sin(s * k * 2.31 + phase * 1.7);
}

/**
 * Ce que la pose fait d'un point du profil d'un module (`lx` en travers, `ly` au-dessus du sol) à
 * la distance `along` de sa voie. Hors d'un talus: rien. Dans un talus: sa hauteur grandit depuis
 * le bout de la sorte et ondule, son revers s'étale plus ou moins; chaque côté a sa phase.
 */
function talusPoint(
  layout: TrackBedLayout,
  track: number,
  sort: TrackBedSort,
  lx: number,
  ly: number,
  along: number,
  out: { x: number; y: number },
): void {
  const talus = sort.talus;
  out.x = lx;
  out.y = ly;
  if (talus === undefined || Math.abs(lx) <= talus.from) return;
  const reach = sort.nearTunnel ?? Number.POSITIVE_INFINITY;
  const grow = Math.min(1, Math.max(0, (reach - layout.toMouth(track, along)) / talus.ramp));
  const phase = (layout.tracks[track]?.piece ?? 0) * 0.61 + (lx < 0 ? 1.7 : 4.1);
  const tall = grow * (1 + talus.swell * waveAt(along, talus.wave, phase));
  out.y = ly * tall - (1 - grow) * layout.settings.sink;
  const across = Math.abs(lx);
  if (across <= talus.crest) return;
  const t = 0.5 + 0.5 * waveAt(along, talus.wave * 0.71, phase + 2.3);
  const spread = talus.spread[0] + (talus.spread[1] - talus.spread[0]) * t;
  out.x = Math.sign(lx) * (talus.crest + (across - talus.crest) * spread);
}

/** Ce qu'on tire une fois d'un modèle de lit: son bord, et de quoi habiller son talus. */
interface BedShape {
  /** Bord extérieur du profil: le sommet le plus loin de l'axe. */
  readonly outer: number;
  /** Profil de la surface (distance à l'axe, hauteur), de l'axe vers le bord. */
  readonly profile: readonly (readonly [number, number])[];
  /** Par sommet: rang dans `profile` du point où il est, -1 hors d'une face de talus. */
  readonly at: Int16Array;
  /** Par sommet: rang de l'autre bout de sa face (en travers). */
  readonly other: Int16Array;
}

const KEY_STEPS = 1000;

/**
 * Lit d'un modèle: la surface du profil est le morceau qui va le plus loin de l'axe; ses faces
 * dont un bout dépasse `from` sont le talus. Chaque sommet d'une face de talus retient les deux
 * points du profil entre lesquels sa face est tendue.
 */
function bedShape(source: BufferGeometry, from: number | undefined): BedShape {
  const position = source.getAttribute('position');
  const ink = source.getAttribute('aInk');
  let outer = 0;
  let outermost = 0;
  for (let i = 0; i < position.count; i++) {
    const across = Math.abs(position.getX(i));
    if (across > outer) {
      outer = across;
      outermost = i;
    }
  }
  const at = new Int16Array(position.count).fill(-1);
  const other = new Int16Array(position.count).fill(-1);
  const index = source.index;
  if (from === undefined || index === null || ink.itemSize < 4)
    return { outer, profile: [], at, other };
  const surface = ink.getW(outermost);
  const key = (i: number): number => Math.round(Math.abs(position.getX(i)) * KEY_STEPS);
  const heights = new Map<number, number>();
  for (let i = 0; i < position.count; i++)
    if (ink.getW(i) === surface) heights.set(key(i), position.getY(i));
  const keys = [...heights.keys()].sort((a, b) => a - b);
  const rank = new Map(keys.map((k, n) => [k, n]));
  for (let t = 0; t + 2 < index.count; t += 3) {
    const corners = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
    if (corners.some((i) => ink.getW(i) !== surface)) continue;
    const ranks = corners.map((i) => rank.get(key(i)) ?? -1);
    const low = Math.min(...ranks);
    const high = Math.max(...ranks);
    if (low < 0 || low === high || (keys[high] ?? 0) / KEY_STEPS <= from) continue;
    corners.forEach((i, n) => {
      at[i] = ranks[n] ?? -1;
      other[i] = ranks[n] === low ? high : low;
    });
  }
  return {
    outer,
    profile: keys.map((k) => [k / KEY_STEPS, heights.get(k) ?? 0] as const),
    at,
    other,
  };
}

/**
 * Modules d'une tuile fusionnés en un maillage posé à l'origine du lieu. `geometryOf`: le modèle
 * livré (attributs du rendu encré compris); `heightAt`: le sol affiché; `field`: les natures.
 */
export function trackBedGeometry(
  layout: TrackBedLayout,
  modules: readonly BedModule[],
  geometryOf: (model: string) => BufferGeometry | null,
  heightAt: (x: number, y: number) => number,
  field: GroundField,
): BufferGeometry | null {
  const s = layout.settings;
  const over = new Set(s.over);
  const parts: BufferGeometry[] = [];
  const shapes = new Map<string, BedShape>();
  dry.set(s.ditch.dry);
  // Lit d'une voie qu'une autre rejoint: celui de la sorte courante (la dernière).
  const joinHalf = layout.halfWidths[s.sorts.length - 1] ?? 0;
  /** Normale (en travers, vers le haut) de la face de talus tendue entre deux points du profil. */
  const faceOf = (
    shape: BedShape,
    track: number,
    sort: TrackBedSort,
    sign: number,
    a: number,
    b: number,
    along: number,
  ): void => {
    const pa = shape.profile[a];
    const pb = shape.profile[b];
    faceNormal.x = 0;
    faceNormal.y = 1;
    if (pa === undefined || pb === undefined) return;
    talusPoint(layout, track, sort, sign * pa[0], pa[1], along, endA);
    talusPoint(layout, track, sort, sign * pb[0], pb[1], along, endB);
    const dx = endB.x - endA.x;
    const dy = endB.y - endA.y;
    const n = Math.hypot(dx, dy) || 1;
    // Perpendiculaire à la face, du côté du ciel.
    const up = dx >= 0 ? 1 : -1;
    faceNormal.x = (-dy / n) * up;
    faceNormal.y = (dx / n) * up;
  };
  for (const module of modules) {
    const track = layout.tracks[module.track];
    const sort = s.sorts[module.sort];
    const source = geometryOf(module.model);
    if (track === undefined || sort === undefined || source === null) continue;
    let shape = shapes.get(module.model);
    if (shape === undefined) {
      shape = bedShape(source, sort.talus?.from);
      shapes.set(module.model, shape);
    }
    const outer = shape.outer;
    const part = source.clone();
    const position = part.getAttribute('position');
    const normal = part.getAttribute('normal');
    const ink = part.getAttribute('aInk');
    const color = part.hasAttribute('color') ? part.getAttribute('color') : null;
    const length = module.s1 - module.s0;
    // Voies plus haut dans l'ordre de la carte: celle-ci passe dans leur lit à l'aiguillage.
    const earlier = layout.tracks.slice(0, module.track);
    for (let i = 0; i < position.count; i++) {
      const lx = position.getX(i);
      const ly = position.getY(i);
      const lz = position.getZ(i);
      const along = module.s0 + (lz + 0.5) * length;
      pointOn(track, along, point);
      tangentAt(track, along, s.smooth, tangent);
      // Repère du module tourné sur la voie: z le long de la voie, x en travers (sans miroir).
      talusPoint(layout, module.track, sort, lx, ly, along, shaped);
      const x = point.x + tangent.y * shaped.x;
      const z = point.y - tangent.x * shaped.x;
      let y = shaped.y;
      if (Math.abs(lx) >= outer - 0.01) y -= s.sink;
      const cx = Math.floor(x);
      const cz = Math.floor(z);
      const nature =
        cx < 0 || cz < 0 || cx >= field.width || cz >= field.height
          ? ''
          : (field.names[field.cells[cz * field.width + cx] ?? 0] ?? '');
      if (!over.has(nature)) y = Math.min(y, -s.sink);
      if (
        Math.abs(lx) > s.junction.crown &&
        layout.clear.some((f) => x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1)
      )
        y = Math.min(y, -s.sink);
      for (const other of earlier) {
        if (distanceTo(other, x, z) >= joinHalf) continue;
        y = Math.abs(lx) > s.junction.crown ? Math.min(y, -s.sink) : y + s.junction.above;
        break;
      }
      position.setXYZ(i, x, heightAt(x, z) + y + s.lift, z);
      let nx = normal.getX(i);
      let ny = normal.getY(i);
      let nz = normal.getZ(i);
      const here = shape.at[i] ?? -1;
      if (here >= 0) {
        // Face de talus: du sol (teinte et matière de la carte du sol, aucun trait avec le pré).
        // Sa normale suit le profil déformé: celle de sa face à la crête et aux bouts (arête
        // nette: un versant au soleil, l'autre à l'ombre), lissée avec la face voisine ailleurs.
        ink.setZ(i, KIND.ground);
        ink.setW(i, 0);
        const sign = lx < 0 ? -1 : 1;
        const far = shape.other[i] ?? here;
        faceOf(shape, module.track, sort, sign, Math.min(here, far), Math.max(here, far), along);
        nx = faceNormal.x;
        ny = faceNormal.y;
        nz = 0;
        const beyond = 2 * here - far;
        const across = shape.profile[here]?.[0] ?? 0;
        const sharp =
          Math.abs(across - (sort.talus?.crest ?? 0)) < 0.02 ||
          across <= (sort.talus?.from ?? 0) ||
          beyond < 0 ||
          beyond >= shape.profile.length;
        if (!sharp) {
          faceOf(
            shape,
            module.track,
            sort,
            sign,
            Math.min(here, beyond),
            Math.max(here, beyond),
            along,
          );
          const k = Math.hypot(nx + faceNormal.x, ny + faceNormal.y) || 1;
          nx = (nx + faceNormal.x) / k;
          ny = (ny + faceNormal.y) / k;
        }
      } else if (color !== null) {
        // Fossé peint en eau par le modèle: sec hors de l'eau du plan.
        const blue = color.getZ(i);
        const wet =
          cx >= 0 &&
          cz >= 0 &&
          cx < field.width &&
          cz < field.height &&
          field.looks[field.cells[cz * field.width + cx] ?? 0]?.water === true;
        if (!wet && blue > color.getY(i) * 1.15 && blue > color.getX(i) * 2)
          color.setXYZ(i, dry.r, dry.g, dry.b);
      }
      normal.setXYZ(i, tangent.y * nx + tangent.x * nz, ny, -tangent.x * nx + tangent.y * nz);
    }
    for (let i = 0; i < ink.count; i++) {
      // La classe de taille du module reste (hachures), le numéro devient celui de la voie.
      const size = Math.floor(ink.getY(i) / 64);
      ink.setY(i, size * 64 + track.piece);
    }
    parts.push(part);
  }
  if (parts.length === 0) return null;
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}
